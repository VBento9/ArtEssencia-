'use strict';
// Tests with synthetic values only; never connect to real Supabase.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const add=fs.readFileSync('order-add-products-ui.js','utf8');
const prices=fs.readFileSync('order-price-edit-v19168.js','utf8');
const section=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+1);
 assert.ok(a>=0&&b>a,'Section missing: '+start);
 return html.slice(a,b);
};
const calc=vm.runInNewContext(section('function calcOrder(o){','function saleProductFilterOptionsV1754()')+';calcOrder');
const lineIgnored=vm.runInNewContext(section('function productionLineIgnoredV148(line){','function productionUnresolvedLinesV148(')+';productionLineIgnoredV148');
const person=vm.runInNewContext(section('function productionOrderPersonalizationV12653(o){','function productionDeliveryLabelV12653(')+';productionOrderPersonalizationV12653',
 {dynamicPersonalizationLabelsV12658:()=>[]});
const order=()=>({
 source:'box_quote',id:'BX-SINTETICA',status:'Pedido',paid:0,box:'Caixa Kraft',
 boxes:1,boxCostSnapshot:15.50,
 items:[
  {code:'C01',type:'box_component',name:'Vela fictícia',qty:2,price:0,cost:0},
  {code:'C02',type:'box_component',name:'Sabonete fictício',qty:1,price:0,cost:0},
  {code:'',type:'quote_adjustment',name:'Valor total aprovado',qty:1,price:25,cost:0}
 ],
 boxCustomerPreferences:{colors:'bege e verde',scents:'maçã e especiarias',dedication:'Parabéns',
  occasion:'Natal',packaging:'kraft',notes:'sem laço'}
});
test('3 produtos reais, 25 euros de venda e 15,50 de custos',()=>{
 const result=calc(order());
 assert.equal(result.qty,3);
 assert.equal(result.total,25);
 assert.equal(result.cost,15.50);
});
test('o ajuste global de orçamento não é artigo nem material de produção',()=>{
 assert.equal(lineIgnored(order().items[2]),true);
 assert.equal(lineIgnored(order().items[0]),false);
 const source=section('function printOrderCompleteV12634(id){','function showOrder(id)');
 assert.match(source,/productionLineIgnoredV148\(item\)\?0/);
 assert.match(source,/if\(productionLineIgnoredV148\(line\)\)return ''/);
 assert.match(source,/\.filter\(i=>!productionLineIgnoredV148\(i\)\)\.map/);
});
test('agenda recebe preferências estruturadas de Box, sem perder fragrâncias',()=>{
 const parts=person(order());
 assert.equal(parts.length,1);
 assert.match(parts[0],/Cores: bege e verde/);
 assert.match(parts[0],/Fragrâncias: maçã e especiarias/);
 assert.match(parts[0],/Dedicatória: Parabéns/);
 const daily=section('function renderProductionDailyCenterV12653(date){','async function buildProductionDailyPdfBlobV12653(');
 assert.match(daily,/\.filter\(i=>!productionLineIgnoredV148\(i\)\)/);
});
test('detalhe da Box protege composição e preço aprovado',()=>{
 const detail=section('function showOrder(id){','function updateOrderDetails(id){');
 assert.match(detail,/const boxQuoteInfo=o\.source==='box_quote'/);
 assert.match(detail,/\.filter\(i=>!\(o\.source==='box_quote'&&productionLineIgnoredV148\(i\)\)\)/);
 assert.match(detail,/\(produced\|\|o\.source==='box_quote'\)/);
 assert.match(detail,/!\['online_store','box_quote'\]\.includes\(o\.source\)/);
 const edits=section('function editOrderQty(id,ix,val){','const DEFAULT_PRODUCT_RECIPES=');
 assert.equal((edits.match(/if\(o\.source==='box_quote'\)return toast/g)||[]).length,2);
 assert.match(add,/includes\(order\.source\)/);
 assert.match(prices,/includes\(order\.source\)/);
});
test('impressão conserva notas e origem correta',()=>{
 const printer=section('function printOrderCompleteV12634(id){','function showOrder(id)');
 assert.match(printer,/o.source==='box_quote'\?'Proposta de Box aceite'/);
 assert.match(printer,/white-space:pre-line/);
 assert.match(printer,/productionLineIgnoredV148/);
});
