'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const src=fs.readFileSync('orders-compact-ui.js','utf8');
const css=fs.readFileSync('orders-compact-ui.css','utf8');
const start=src.indexOf(' function visualState(order){');
const end=src.indexOf('\n window.aeOrderVisualStateV19163=visualState;',start);
assert.ok(start>0&&end>start,'Classificador visual 1.9.163 presente');
const ctx={calcOrder:o=>({total:o.testTotal})};
vm.runInNewContext(src.slice(start,end),ctx);
const classify=(status,total,paid)=>ctx.visualState({status,testTotal:total,paid});
test('fase visual corresponde ao estado funcional existente',()=>{
 for(const [status,expected] of [
  ['Pedido','created'],['Confirmada','confirmed'],
  ['Em produção','production'],['Produção','production'],
  ['Pronta','ready-unpaid'],['Entregue','delivered'],['Cancelado','cancelled']
 ]) assert.equal(classify(status,50,0).state,expected,status);
});
test('paga não substitui a fase de produção',()=>{
 const info=classify('Em produção',50,50);
 assert.equal(info.state,'production');
 assert.equal(info.payment,'paid');
 assert.equal(info.paymentLabel,'Paga');
});
test('pronta não paga, parcialmente paga e paga têm classificação distinta',()=>{
 const unpaid=classify('Pronta',50,0);
 const partial=classify('Pronta',50,20);
 const paid=classify('Pronta',50,50);
 assert.equal(unpaid.state,'ready-unpaid');
 assert.equal(unpaid.payment,'due');
 assert.equal(partial.state,'ready-unpaid');
 assert.equal(partial.payment,'partial');
 assert.equal(partial.balance,30);
 assert.equal(paid.state,'ready-paid');
 assert.equal(paid.payment,'paid');
});
test('não classifica indevidamente como paga se o total é zero ou desconhecido',()=>{
 assert.equal(classify('Pedido',0,0).payment,'unknown');
 assert.equal(classify('Pronta',0,0).state,'ready');
 assert.equal(classify('Pronta',NaN,10).payment,'unknown');
 assert.equal(classify('Pronta',NaN,10).state,'ready');
});
test('apenas apresentação: sem mutações de encomendas ou chamadas Cloud',()=>{
 const presentation=src.slice(src.indexOf('/* V1.9.163'));
 for(const forbidden of ['save(', 'setStatus(', 'registerOrderPayment(', 'localStorage.setItem', 'supabase.', 'queueOrderBusinessSyncV1757(']){
  assert.equal(presentation.includes(forbidden),false,forbidden);
 }
 for(const marker of ['article.order-card','ordersBody','orderDetail','MutationObserver','paymentLabel']){
  assert.ok(presentation.includes(marker),marker);
 }
 for(const state of ['created','confirmed','production','ready-unpaid','ready-paid']){
  assert.ok(css.includes('[data-ae-order-state="'+state+'"]'),state);
 }
});
