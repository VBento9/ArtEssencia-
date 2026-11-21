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
 assert.match(client,/confirmada na Cloud\. A receção neste dispositivo ficou pendente/);
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


function fixtureConvert({alreadyLinked=false,confirmResult=true,hydrate='ok'}={}){
 const ctx={console,Date,Number,String,Math,JSON,Set,Intl,Promise,
  db:{themedBoxes:[box()],orders:[]},
  cloudBusy:false,cloudHydrating:false,cloudPushRunning:false,
  notes:[],rpcCalls:[],reads:[],confirmCalls:[],loads:0,
  money:n=>Number(n).toFixed(2)+' EUR',
  confirm:message=>{ctx.confirmCalls.push(message);return confirmResult;},
  toast:message=>ctx.notes.push(message),
  loadBoxRequestsV2:async()=>{ctx.loads++;return true;},
  publicClient:async()=>({c:{
   from(name){
    return {select(){
     return {eq(){
      return {
       async maybeSingle(){
        ctx.reads.push(name);
        return {data:alreadyLinked?{public_order_id:'BX-2026-EXISTING'}:null,error:null};
       },
       async single(){
        ctx.reads.push(name);
        return {data:{request_id:'fake-request-01',status:'accepted',
          responded_at:'2026-11-21T12:00:00Z',quote_version:1,quoted_total:25,items:request().items},error:null};
       }
      };
     }};
    }};
   },
   async rpc(name,args){
    ctx.rpcCalls.push({name,args});
    return {data:{ok:true,order_id:'fixture-order-uuid',public_order_id:'BX-2026-00001'},error:null};
   }
  }}),
  relationalHydrateCore:async(a,b)=>{
   ctx.hydrateArgs=[a,b];
   if(hydrate==='error')throw new Error('offline');
   if(hydrate==='ok')ctx.db.orders.push({_rid:'fixture-order-uuid',id:'BX-2026-00001'});
   return hydrate==='ok';
  },
  aeBoxMatchesAcceptedRequestV1:validate,
  aeTodayLisbonBoxV1:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',
    year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
 };
 // The date helper used in production is also exercised from the real code.
 const currentDate=extractFunction(client,
  'function aeTodayLisbonBoxV1(){','function aeBoxMatchesAcceptedRequestV1(');
 vm.createContext(ctx);
 vm.runInContext(currentDate+extractFunction(client,
  'async function convertAcceptedBoxRequestV1(','async function loadBoxRequestsV2(')+
  ';globalThis.convertAcceptedBoxRequestV1=convertAcceptedBoxRequestV1;',ctx);
 const date=ctx.aeTodayLisbonBoxV1();
 const row={querySelector:selector=>({value:selector==='[data-box-private-id]'?'box-fixture':date})};
 return {ctx,row};
}

test('conversão válida invoca RPC uma vez e sincroniza por hidratação segura',async()=>{
 const {ctx,row}=fixtureConvert();
 await ctx.convertAcceptedBoxRequestV1(request(),row);
 assert.equal(ctx.rpcCalls.length,1);
 assert.equal(ctx.rpcCalls[0].name,'artessencia_owner_convert_box_v1');
 assert.equal(ctx.rpcCalls[0].args.p_expected_box_version,3);
 assert.deepEqual([...ctx.hydrateArgs],[false,false]);
 assert.equal(ctx.db.orders.length,1);
 assert.ok(ctx.notes.some(x=>x.includes('disponível no módulo')));
 assert.equal(ctx.confirmCalls.length,1);
});
test('uma proposta previamente convertida não volta a invocar RPC',async()=>{
 const {ctx,row}=fixtureConvert({alreadyLinked:true});
 await ctx.convertAcceptedBoxRequestV1(request(),row);
 assert.equal(ctx.rpcCalls.length,0);
 assert.equal(ctx.confirmCalls.length,0);
 assert.ok(ctx.notes.some(x=>x.includes('já foi convertida')));
});
test('cancelamento da confirmação impede a conversão',async()=>{
 const {ctx,row}=fixtureConvert({confirmResult:false});
 await ctx.convertAcceptedBoxRequestV1(request(),row);
 assert.equal(ctx.rpcCalls.length,0);
 assert.equal(ctx.db.orders.length,0);
});
test('falha de receção depois de confirmação da Cloud não gera segunda encomenda',async()=>{
 const {ctx,row}=fixtureConvert({hydrate:'error'});
 await ctx.convertAcceptedBoxRequestV1(request(),row);
 assert.equal(ctx.rpcCalls.length,1);
 assert.equal(ctx.db.orders.length,0);
 assert.ok(ctx.notes.some(x=>x.includes('confirmada na Cloud')));
});
test('a proposta não aceite é recusada antes de consultar ou alterar a Cloud',async()=>{
 const {ctx,row}=fixtureConvert();
 await assert.rejects(()=>ctx.convertAcceptedBoxRequestV1({...request(),status:'sent'},row),
  /não foi aceite/);
 assert.equal(ctx.rpcCalls.length,0);
 assert.equal(ctx.reads.length,0);
});
