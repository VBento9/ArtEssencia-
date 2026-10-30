import test from 'node:test';
import assert from 'node:assert/strict';
import {planRelationalWriteV1950,tagHydratedRowV1950,stripRelSyncMetadataV1950,writeRelationalRowsCasV1950,assertCanHydrateV1950,hasUnsentLocalRowsV1950,nextRelationalTimestampV1950} from '../relational-cas-v1950.mjs';
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const local=()=>({_rid:'r1',id:'C1',name:'Maria'}),remote=(name='Maria',t='t1')=>({id:'r1',updated_at:t,data:{_rid:'r1',id:'C1',name}});
test('untouched local row is never pushed over newer remote',()=>{const l=local();tagHydratedRowV1950(l,remote(),stable);assert.equal(planRelationalWriteV1950(l,remote('Nova','t2'),stable).action,'skip')});
test('changed local row uses previous remote timestamp',()=>{const l=local();tagHydratedRowV1950(l,remote(),stable);l.name='Outra';assert.equal(planRelationalWriteV1950(l,remote(),stable).action,'update');assert.equal(planRelationalWriteV1950(l,remote('Nova','t2'),stable).reason,'remote_changed')});
test('legacy snapshots cannot overwrite rows without baseline',()=>{assert.equal(planRelationalWriteV1950({...local(),name:'Antigo'},remote(),stable).reason,'missing_baseline');assert.equal(planRelationalWriteV1950(local(),remote(),stable).action,'adopt');assert.equal(planRelationalWriteV1950(local(),null,stable).action,'insert')});
test('metadata is not written into canonical data',()=>{const l=local();tagHydratedRowV1950(l,remote(),stable);assert.deepEqual(stripRelSyncMetadataV1950(l),local())});
test('conflict aborts before requesting a database write',async()=>{const l=local();tagHydratedRowV1950(l,remote(),stable);l.name='Outra';let calls=0;await assert.rejects(writeRelationalRowsCasV1950({client:{from(){calls++;throw Error('unexpected write')}},table:'clients',rows:[{id:'r1'}],remoteRows:[remote('Nova','t2')],localRows:[l],userId:'owner',stringify:stable}),/CONFLITO/);assert.equal(calls,0)});
test('update uses optimistic updated_at predicate',async()=>{const l=local();tagHydratedRowV1950(l,remote(),stable);l.name='Outra';let filters=[];const q={update(){return this},eq(k,v){filters.push([k,v]);return this},select(){return this},maybeSingle:async()=>({data:{id:'r1',updated_at:'t2'},error:null})};await writeRelationalRowsCasV1950({client:{from(){return q}},table:'clients',rows:[{id:'r1',data:{_rid:'r1',id:'C1',name:'Outra'}}],remoteRows:[remote()],localRows:[l],userId:'owner',stringify:stable});assert.ok(filters.some(([k,v])=>k==='updated_at'&&v==='t1'));assert.equal(l._relSyncUpdatedAtV1950,'t2')});

test('dirty local record cannot be overwritten by Cloud hydration',()=>{
 const l=local();tagHydratedRowV1950(l,remote(),stable);l.name='Alterado';
 assert.throws(()=>assertCanHydrateV1950(l,local(),{dirty:true,stringify:stable,kind:'cliente',id:'r1'}),/CONFLITO_RECECAO_V1950/);
});
test('unchanged local record accepts newer remote hydration',()=>{
 const l=local();tagHydratedRowV1950(l,remote(),stable);
 assert.equal(assertCanHydrateV1950(l,{...local(),name:'Atualizado'},{dirty:true,stringify:stable}),true);
});
test('legacy dirty row without baseline is not silently discarded',()=>{
 assert.throws(()=>assertCanHydrateV1950(local(),{...local(),name:'Atualizado'},{dirty:true,stringify:stable}),/CONFLITO_RECECAO_V1950/);
});
test('new insert cannot duplicate a product or order logical ID',async()=>{
 for(const [table,key,value] of [['artessencia_v1_products','code','P1'],['artessencia_v1_orders','id','AS-2026-0001']]){
  let n=0;
  await assert.rejects(writeRelationalRowsCasV1950({client:{from(){n++;throw Error('UNEXPECTED INSERT')}},table,
   rows:[{id:'new',data:{[key]:value}}],remoteRows:[{id:'old',data:{[key]:value}}],
   localRows:[{_rid:'new'}],userId:'owner',stringify:stable}),/identificador lógico duplicado/);
  assert.equal(n,0);
 }
});

test('local records absent from Cloud remain dirty rather than being declared synchronized',()=>{
 assert.equal(hasUnsentLocalRowsV1950([{_rid:'new',id:'C2'}],[], 'id'),true);
 assert.equal(hasUnsentLocalRowsV1950([{_rid:'r1',id:'C1'}],[{id:'r1',data:{id:'C1'}}], 'id'),false);
 assert.equal(hasUnsentLocalRowsV1950([{code:'P-new'}],[{id:'p1',data:{code:'P-old'}}], 'code'),true);
});

test('revision stamp strictly advances beyond a remote timestamp despite clock skew',()=>{
 const latest=nextRelationalTimestampV1950('2026-10-30T11:59:00.999999+00:00',Date.parse('2026-10-30T11:00:00.000Z'));
 assert.equal(latest,'2026-10-30T11:59:01.000Z');
 assert.equal(nextRelationalTimestampV1950('2026-10-30T11:59:01.000Z',Date.parse('2026-10-30T11:59:01.000Z')),'2026-10-30T11:59:01.001Z');
 assert.throws(()=>nextRelationalTimestampV1950('invalid-time'),/revisão Cloud inválida/);
});
test('two devices updating the same row: second must fail without replacing the first',async()=>{
 const state={id:'r1',user_id:'owner',updated_at:'2026-10-30T11:59:00.000Z',data:{_rid:'r1',id:'C1',name:'Original'}};
 const original={...state,data:{...state.data}};
 const first={...original.data},second={...original.data};
 tagHydratedRowV1950(first,original,stable);
 tagHydratedRowV1950(second,original,stable);
 first.name='Tablet';second.name='Desktop';
 let writes=0;
 const client={from(){const q={};
  let payload=null,filters=[];
  q.update=entry=>{payload=entry;return q};
  q.eq=(key,value)=>{filters.push([key,value]);return q};
  q.select=()=>q;
  q.maybeSingle=async()=>{
    if(filters.some(([k,v])=>state[k]!==v))return {data:null,error:null};
    writes++;Object.assign(state,payload);return {data:{...state},error:null};
  };
  return q;
 }};
 const save=async local=>writeRelationalRowsCasV1950({
  client,table:'artessencia_v1_clients',
  rows:[{id:'r1',user_id:'owner',data:stripRelSyncMetadataV1950(local)}],
  remoteRows:[original],localRows:[local],userId:'owner',stringify:stable
 });
 assert.equal((await save(first)).updated,1);
 assert.equal(state.data.name,'Tablet');
 assert.notEqual(state.updated_at,original.updated_at);
 await assert.rejects(save(second),/CONFLITO_RELACIONAL_V1950/);
 assert.equal(writes,1);
 assert.equal(state.data.name,'Tablet');
});
test('unchanged device does not update stale Cloud data',async()=>{
 const baseline={id:'r1',user_id:'owner',updated_at:'2026-10-30T11:59:00Z',data:{_rid:'r1',id:'C1',name:'Maria'}};
 const local={...baseline.data};
 tagHydratedRowV1950(local,baseline,stable);
 let writes=0;
 const result=await writeRelationalRowsCasV1950({
  client:{from(){writes++;throw Error('No write permitted')}},table:'artessencia_v1_clients',
  rows:[{id:'r1',data:{...baseline.data}}],remoteRows:[{...baseline,updated_at:'2026-10-30T12:00:00Z',data:{...baseline.data,name:'Atualizado'}}],
  localRows:[local],userId:'owner',stringify:stable
 });
 assert.equal(result.skipped,1);assert.equal(writes,0);
});
