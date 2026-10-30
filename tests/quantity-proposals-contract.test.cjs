// ArtEssencia — contratos da gestão de propostas (sem dados reais).
// Executar: node --test tests/quantity-proposals-contract.test.cjs
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'quantity-pricing-v2.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'sql/quantity_proposal_tracking_v1.sql'),'utf8');

test('o JavaScript é sintaticamente válido',()=>{
  assert.doesNotThrow(()=>new Function(src));
});
test('o ficheiro SQL tem exatamente duas funções e dois triggers sem duplicação',()=>{
  for(const name of ['ae_quantity_proposal_link_guard_v1','ae_quantity_proposal_event_transition_v1']){
    assert.equal((sql.match(new RegExp('create function public\\.'+name+'\\(\\)','g'))||[]).length,1);
    assert.equal((sql.match(new RegExp('create trigger '+name.replace('_v1','_insert_v1'),'g'))||[]).length,1);
  }
  assert.equal((sql.match(/\$\$/g)||[]).length,4);
  assert.equal((sql.match(/create trigger /g)||[]).length,2);
  assert.equal((sql.match(/end;\s*\$\$;/g)||[]).length,2);
});
test('a origem é validada por trigger com RLS e sem recursão na política',()=>{
  const policy=sql.split('alter policy quantity_simulations_owner_insert_v1')[1].split('create function')[0];
  assert.doesNotMatch(policy,/select\s+1\s+from\s+public\.artessencia_quantity_simulations_v1/i);
  assert.match(sql,/source\.simulation_id\s*=\s*new\.source_simulation_id/);
  assert.match(sql,/security invoker/g);
  assert.match(sql,/user_id\s*=\s*\(select auth\.uid\(\)\)/);
});
test('eventos só podem ser acrescentados pelo proprietário, nunca editados pelo cliente',()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/grant select on public\.artessencia_quantity_proposal_events_v1 to authenticated/);
  assert.match(sql,/grant insert \(proposal_id,user_id,event_type,channel,note\)/);
  assert.doesNotMatch(sql,/grant (update|delete) on public\.artessencia_quantity_proposal_events_v1 to authenticated/i);
  assert.match(sql,/advisory_xact_lock/);
  assert.match(sql,/new\.created_at\s*=\s*pg_catalog\.clock_timestamp\(\)/);
  assert.match(sql,/time zone 'Europe\/Lisbon'/);
});
test('a interface nunca cria encomendas nem movimenta stock para aceitar orçamento',()=>{
  assert.match(src,/EVENTS_V25='artessencia_quantity_proposal_events_v1'/);
  assert.match(src,/eventBusyV25/);
  assert.match(src,/if\(!eventsAvailableV25\)/);
  assert.match(src,/event_type:target/);
  assert.doesNotMatch(src.slice(src.indexOf('// V2.5'),src.indexOf('  function session()',src.indexOf('// V2.5'))),/renderCart\(|db\.stock\s*=|cart\s*=/);
});
test('o estado comercial é calculado por fuso Portugal e respeita decisão terminal',()=>{
  const start=src.indexOf('  function todayLisbonV25()');
  const end=src.indexOf('  async function loadProposalEventsV25(',start);
  assert.ok(start>=0&&end>start);
  const factory=new Function('eventsByProposalV25','EVENT_LABEL_V25',
    src.slice(start,end)+';return proposalStatusV25;');
  const labels={accepted:'Aceite',declined:'Recusada',cancelled:'Cancelada'};
  const future='2099-12-31',past='2020-01-01';
  const row=(id,validUntil)=>({simulation_id:id,payload:{customerOffer:{validUntil}}});
  const map=new Map([['a',[{event_type:'sent'},{event_type:'accepted'}]],
    ['b',[{event_type:'sent'}]],['c',[{event_type:'sent'},{event_type:'declined'}]]]);
  const fn=factory(map,labels);
  assert.equal(fn(row('a',past)).value,'accepted');
  assert.equal(fn(row('c',past)).value,'declined');
  assert.equal(fn(row('b',past)).value,'expired');
  assert.equal(fn(row('b',past)).wasSent,true);
  assert.equal(fn(row('b',future)).value,'sent');
  assert.equal(fn(row('d',past)).value,'expired');
  assert.equal(fn(row('d',future)).value,'draft');
});
test('a leitura do histórico usa grupos, não oculta eventos por limite global',()=>{
  assert.match(src,/ids\.slice\(i,i\+12\)/);
  assert.match(src,/data\.length>=100/);
  assert.match(src,/eventsAvailableV25=false;eventsByProposalV25=new Map\(\)/);
  assert.match(src,/eventsAvailableV25=true/);
  assert.match(src,/status\.wasSent\?\['declined','cancelled'\]:\['cancelled'\]/);
});
