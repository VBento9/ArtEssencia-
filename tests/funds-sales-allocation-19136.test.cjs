const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const js=fs.readFileSync('funds-ledger-v1.js','utf8');
const a=js.indexOf('const HISTORY_KEY=');
const b=js.indexOf('function movements(){',a);
assert.ok(a>0&&b>a,'Encontrar distribuição pelos custos históricos');
const code=js.slice(a,b);
function make({order,orders,products}={}){
 const base={id:'ORD-1',status:'Entregue',items:[],total:100,boxes:0,boxCostSnapshot:0,...order};
 const ctx={
  db:{orders:orders||[base],products:products||[],costMeta:{}},
  calcOrder:o=>({
   total:Number(o.total),
   cost:(o.items||[]).reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.cost)||0),0)+
    (Number(o.boxes)||0)*(Number(o.boxCostSnapshot)||0)
  }),
  cents:x=>Number.isFinite(Number(x))?Math.round(Number(x)*100):0
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 return {ctx,order:base,split:c=>ctx.paymentBreakdown({...c,value:Math.abs(c.value),type:c.value>=0?'Entrada':'Saída',orderId:'ORD-1'})};
}
const item=(m,e,l,qty=1)=>({type:'product',qty,cost:m+e+l,
 costBreakdownSnapshotV1769:{materials:m,fixed:e,other:0,labor:l,total:m+e+l,estimated:false}});
function plain(x){return JSON.parse(JSON.stringify(x))}
test('Pagamento de 100 € divide custos reais por quatro rubricas',()=>{
 const a=make({order:{items:[item(25,15,30)]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{materials:2500,expenses:0,fixed:1500,labor:3000,profit:3000});
});
test('Sinal de 40 € distribui apenas a parte recebida',()=>{
 const a=make({order:{items:[item(25,15,30)]}});
 assert.deepEqual(plain(a.split({value:40}).amounts),{materials:1000,expenses:0,fixed:600,labor:1200,profit:1200});
});
test('Correção negativa reverte as quatro rubricas',()=>{
 const a=make({order:{items:[item(25,15,30)]}});
 assert.deepEqual(plain(a.split({value:-20}).amounts),{materials:-500,expenses:0,fixed:-300,labor:-600,profit:-600});
});
test('Custo de embalagens junta-se a materiais',()=>{
 const a=make({order:{items:[item(20,10,20)],boxes:2,boxCostSnapshot:5}});
 const got=plain(a.split({value:100}).amounts);
 assert.equal(got.materials,3000);assert.equal(got.expenses,0);assert.equal(got.fixed,1000);assert.equal(got.labor,2000);assert.equal(got.profit,4000);
});
test('Custo maior que o preço é identificado como margem negativa',()=>{
 const a=make({order:{items:[item(40,30,50)]}});
 const got=plain(a.split({value:100}).amounts);
 assert.equal(got.profit,-2000);assert.equal(Object.values(got).reduce((a,b)=>a+b,0),10000);
});
test('Sem snapshot discriminado, não inventar valor de trabalho nem lucro',()=>{
 const a=make({order:{items:[{type:'product',qty:1,cost:30}]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{unclassified:10000});
});
test('Snapshot estimado não serve para movimentar fundos confirmados',()=>{
 const line=item(20,5,5);line.costBreakdownSnapshotV1769.estimated=true;
 const a=make({order:{items:[line]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{unclassified:10000});
});
test('Não usar o custo atual do produto em vendas antigas',()=>{
 const a=make({order:{items:[{type:'product',qty:1,cost:30,code:'P1'}]},products:[{code:'P1',price:100,cost:20,labor:5}]});
 assert.deepEqual(plain(a.split({value:100}).amounts),{unclassified:10000});
});
test('Cada pagamento reconcilia ao cêntimo',()=>{
 const a=make({order:{items:[item(10.33,5.33,7.33)]}});
 for(const amount of [0.01,0.05,0.99,33.33,100]){
  const got=plain(a.split({value:amount}).amounts);
  assert.equal(Object.values(got).reduce((sum,value)=>sum+value,0),Math.round(amount*100));
 }
});

test('Snapshot sem rubricas reais não é aceite como custo discriminado',()=>{
 const line=item(25,15,30);delete line.costBreakdownSnapshotV1769.labor;
 const a=make({order:{items:[line]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{unclassified:10000});
});
test('Snapshot de preço por quantidade sem componentes reais permanece por classificar',()=>{
 const line={type:'product',qty:1,cost:70,quantityPricingSnapshot:{units:1,materialsCost:25,laborCost:30,fixedCost:15}};
 const a=make({order:{items:[line]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{unclassified:10000});
});

test('Separar custos extras de custos fixos',()=>{
 const line={qty:1,cost:70,costBreakdownSnapshotV1769:{materials:20,labor:30,fixed:10,other:10,total:70,estimated:false}};
 const a=make({order:{items:[line]}});
 assert.deepEqual(plain(a.split({value:100}).amounts),{materials:2000,expenses:1000,fixed:1000,labor:3000,profit:3000});
});
test('Ajuste positivo pequeno confirmado pelo custo histórico pertence aos extras',()=>{
 const line={qty:1,cost:3.84,costBreakdownSnapshotV1769:{materials:1.89,labor:1.62,fixed:.20,other:0,total:3.84,estimated:false}};
 const a=make({order:{items:[line],total:10}});
 assert.deepEqual(plain(a.split({value:10}).amounts),{materials:189,expenses:13,fixed:20,labor:162,profit:616});
});
test('Não inventar complemento quando o total histórico é inconsistente',()=>{
 const line={qty:1,cost:3.84,costBreakdownSnapshotV1769:{materials:1.89,labor:1.62,fixed:.20,other:0,total:3.60,estimated:false}};
 const a=make({order:{items:[line],total:10}});
 assert.deepEqual(plain(a.split({value:10}).amounts),{unclassified:1000});
});

test('Snapshot antigo de preço por quantidade discrimina custos sem entrada manual',()=>{
 const line={type:'product',qty:25,cost:2.7581317777777783,quantityPricingSnapshot:{
  units:50,materialsCost:95.7177,laborCost:38.88888888888889,fixedCost:3.3,otherCost:0,costTotal:137.9065888888889
 }};
 const a=make({order:{items:[line],total:97.5}});
 const result=plain(a.split({value:97.5}).amounts);
 assert.equal(Object.keys(result).includes('unclassified'),false);
 assert.equal(Object.values(result).reduce((sum,v)=>sum+v,0),9750);
 assert.equal(result.materials>0&&result.labor>0&&result.fixed>0,true);
});
test('Conciliação histórica confirmada usa custos totais das unidades sem alterar a encomenda',()=>{
 const line={type:'product',name:'Peça histórica',code:'H1',qty:5,cost:4.292003580246914,price:8};
 const a=make({order:{items:[line],total:40}});
 const key='__fundsHistoricalLineCostsV1';
 a.ctx.db.costMeta[key]={'ORD-1':{'0':{materials:1000,labor:600,fixed:300,other:246,
  originalCostCents:2146,fingerprint:a.ctx.historicalFingerprint(line),source:'manual_historical_verified',confirmedAt:'2026-11-05T12:00:00Z'}}};
 const result=plain(a.split({value:40}).amounts);
 assert.deepEqual(result,{materials:1000,expenses:246,fixed:300,labor:600,profit:1854});
 assert.equal(line.cost,4.292003580246914);
});
test('Conciliação de uma linha alterada ou sem valores reais é rejeitada',()=>{
 const line={type:'product',name:'Peça histórica',code:'H1',qty:5,cost:4.292003580246914,price:8};
 const a=make({order:{items:[line],total:40}});
 const key='__fundsHistoricalLineCostsV1';
 a.ctx.db.costMeta[key]={'ORD-1':{'0':{materials:1000,labor:600,fixed:300,other:246,
  originalCostCents:2146,fingerprint:a.ctx.historicalFingerprint(line),source:'manual_historical_verified',confirmedAt:'2026-11-05T12:00:00Z'}}};
 line.qty=6;
 assert.deepEqual(plain(a.split({value:40}).amounts),{unclassified:4000});
});

test('Retificar uma conciliação mantém a composição original no histórico',()=>{
 const line={type:'product',name:'Peça histórica',code:'H1',qty:5,cost:4.292003580246914,price:8};
 const a=make({order:{items:[line],total:40}});
 const key='__fundsHistoricalLineCostsV1';
 a.ctx.db.costMeta[key]={'ORD-1':{'0':{materials:1000,labor:600,fixed:300,other:246,
  originalCostCents:2146,fingerprint:a.ctx.historicalFingerprint(line),source:'manual_historical_verified',confirmedAt:'2026-11-05T12:00:00Z'}}};
 let saveCount=0;
 Object.assign(a.ctx,{state:{reconcileMode:'amend',reconcileOrderId:'ORD-1'},LABEL:{materials:'Materiais',labor:'Trabalho',fixed:'Custos fixos',expenses:'Custos extras'},render:()=>{},toast:()=>{},save:()=>{saveCount++;return true;},document:{getElementById:()=>null}});
 vm.runInContext(js.slice(js.indexOf('function historicEditor('),js.indexOf('function movementsTable(')),a.ctx);
 const values={materials:'9.00',labor:'7.00',fixed:'3.00',other:'2.46'};
 const form={dataset:{fundsOrder:'ORD-1',fundsMode:'amend'},querySelector(selector){
  if(selector==='[name="confirmed"]')return {checked:true};
  if(selector==='[name="correctionReason"]')return {value:'Conferência de comprovativos originais'};
  const m=selector.match(/data-funds-field="([^"]+)"/);
  return m?{value:values[m[1]]}:null;
 }};
 a.ctx.saveHistoricalReview(form);
 const rec=a.ctx.db.costMeta[key]['ORD-1']['0'];
 assert.equal(saveCount,1);assert.equal(rec.revision,2);
 assert.equal(rec.history.length,1);assert.equal(rec.history[0].previous.materials,1000);
 assert.equal(rec.materials,900);assert.equal(rec.labor,700);
 assert.equal(line.qty,5);assert.equal(line.cost,4.292003580246914);
 const valuesPaid=plain(a.split({value:40}).amounts);
 assert.equal(valuesPaid.materials,900);
 assert.equal(Object.values(valuesPaid).reduce((x,y)=>x+y,0),4000);
});
