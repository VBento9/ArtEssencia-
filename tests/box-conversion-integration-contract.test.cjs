'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const client=fs.readFileSync('boxes-atelier-ui-v1.js','utf8');
const sql=fs.readFileSync('sql/box_conversion_preserve_preferences_REVIEW_ONLY.sql','utf8');
const backoffice=fs.readFileSync('index.html','utf8');

function extractFunction(source,startText,endText){
 const start=source.indexOf(startText);
 const end=source.indexOf(endText,start);
 assert.ok(start>=0&&end>start,'Função de validação deve existir no código publicado');
 return source.slice(start,end);
}

const validate=vm.runInNewContext(extractFunction(client,
 'function aeBoxMatchesAcceptedRequestV1(box,request){',
 'async function convertAcceptedBoxRequestV1(')+';aeBoxMatchesAcceptedRequestV1;');

const request=()=>({request_id:'fake-request-01',status:'accepted',responded_at:'2026-11-21T12:00:00Z',
 quoted_total:25,quote_version:1,items:[{code:'A1',qty:2},{code:'B1',qty:1}]});
const box=()=>({id:'box-fixture',originRequestId:'fake-request-01',active:false,price:25,
 technicalV2:{mode:'finished'},
 technicalRevisionV4:{version:3,snapshot:{total:15}},
 items:[{code:'B1',qty:1},{code:'A1',qty:2}]});

test('script de boxes tem sintaxe válida',()=>assert.doesNotThrow(()=>new vm.Script(client)));
test('ficha privada compatível aceita componentes mesmo em ordem diferente',()=>{
 assert.equal(validate(box(),request()),true);
});
test('rejeita ficha pública, custo ausente, revisão e preço divergentes',()=>{
 const r=request();
 assert.equal(validate({...box(),active:true},r),false);
 assert.equal(validate({...box(),price:26},r),false);
 assert.equal(validate({...box(),technicalRevisionV4:{version:0,snapshot:{total:15}}},r),false);
 assert.equal(validate({...box(),technicalRevisionV4:{version:3,snapshot:{total:0}}},r),false);
});
test('rejeita composição alterada, referência de origem diferente e duplicados',()=>{
 const r=request();
 assert.equal(validate({...box(),originRequestId:'outro-pedido'},r),false);
 assert.equal(validate({...box(),items:[{code:'A1',qty:1},{code:'B1',qty:1}]},r),false);
 assert.equal(validate({...box(),items:[{code:'A1',qty:2},{code:'A1',qty:1}]},r),false);
});
test('conversão é manual, idempotente no servidor e não faz cópias locais',()=>{
 assert.match(client,/record\.status!=='accepted'/);
 assert.match(client,/artessencia_box_order_links_v1/);
 assert.match(client,/if\(!confirm\(question\)\)return/);
 assert.match(client,/artessencia_owner_convert_box_v1/);
 assert.match(client,/p_expected_box_version:Number\(box\.technicalRevisionV4\.version\)/);
 assert.doesNotMatch(extractFunction(client,'async function convertAcceptedBoxRequestV1(','async function loadBoxRequestsV2('),
  /db\.orders\.push|db\.stock\s*=|db\.cash\s*=|cloudPullNow\(true\)/);
});
test('receção após conversão usa sincronização relacional segura, sem forçar hidratação',()=>{
 assert.match(client,/relationalHydrateCore\(false,false\)/);
 assert.match(client,/catch\(syncError\)/);
 assert.match(client,/Encomenda .* confirmada na Cloud/);
 assert.match(backoffice,/REL_TABLES=\{clients:'artessencia_v1_clients',products:'artessencia_v1_products',orders:'artessencia_v1_orders'/);
 assert.match(backoffice,/db\.orders=remoteHydratedOrders\.map/);
});
test('proposta SQL preserva preferências para produção e não toca stock',()=>{
 assert.match(sql,/REVISÃO MANUAL — NÃO APLICAR AUTOMATICAMENTE/);
 assert.match(sql,/'boxCustomerPreferences',coalesce\(r\.preferences/);
 assert.match(sql,/'notes',concat_ws\(chr\(10\),/);
 for(const k of ['colors','scents','dedication','occasion','packaging','budget','notes'])
  assert.ok(sql.includes("r.preferences->>'"+k+"'"),'Preferência em falta: '+k);
 assert.match(sql,/security definer/i);
 assert.match(sql,/artessencia_is_owner_v1/);
 assert.match(sql,/already_converted/);
 assert.doesNotMatch(sql,/\b(?:insert into|update|delete from)\s+public\.(?:store_payments|artessencia_v1_sales|stock_movements)\b/i);
});
