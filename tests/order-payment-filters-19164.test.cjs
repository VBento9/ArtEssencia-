'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('orders-compact-ui.css','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const version=JSON.parse(fs.readFileSync('version.json','utf8'));
const start=html.indexOf('function orderPaymentPositionV19164(order){');
const end=html.indexOf('function renderOrders(){',start);
assert.ok(start>0&&end>start,'funções financeiras existentes');
const ctx={calcOrder:o=>({total:o.testTotal})};
vm.runInNewContext(html.slice(start,end),ctx);
const order=(status,total,paid)=>({status,testTotal:total,paid});
test('saldo pendente, não pagas, parciais e pagas são diferentes',()=>{
 const none=order('Confirmada',30,0);
 const part=order('Confirmada',30,8);
 const paid=order('Confirmada',30,30);
 assert.equal(ctx.orderPaymentPositionV19164(none).kind,'unpaid');
 assert.equal(ctx.orderPaymentPositionV19164(part).kind,'partial');
 assert.equal(ctx.orderPaymentPositionV19164(part).due,22);
 assert.equal(ctx.orderPaymentPositionV19164(paid).kind,'paid');
 assert.equal(ctx.orderPaymentMatchesV19164(part,'due'),true);
 assert.equal(ctx.orderPaymentMatchesV19164(paid,'due'),false);
 assert.equal(ctx.orderPaymentMatchesV19164(none,'partial'),false);
});
test('prontas por receber apenas quando prontas e têm saldo',()=>{
 assert.equal(ctx.orderPaymentMatchesV19164(order('Pronta',50,0),'ready-due'),true);
 assert.equal(ctx.orderPaymentMatchesV19164(order('Pronta',50,30),'ready-due'),true);
 assert.equal(ctx.orderPaymentMatchesV19164(order('Pronta',50,50),'ready-due'),false);
 assert.equal(ctx.orderPaymentMatchesV19164(order('Em produção',50,0),'ready-due'),false);
});
test('totais zero ou inválidos nunca são apresentados como pagos',()=>{
 assert.equal(ctx.orderPaymentPositionV19164(order('Pronta',0,0)).kind,'unknown');
 assert.equal(ctx.orderPaymentPositionV19164(order('Pronta',NaN,10)).kind,'unknown');
 assert.equal(ctx.orderPaymentPositionV19164(order('Pronta',50,-3)).kind,'unknown');
 assert.equal(ctx.orderPaymentMatchesV19164(order('Pronta',NaN,0),'ready-due'),false);
});
test('filtro incluído nas combinações de pesquisa, paginação e limpeza',()=>{
 for(const marker of ['id="orderPaymentFilterV19164"','id="ordersReadyDueShortcutV19164"','showReadyDueOrdersV19164()',
  '&&orderPaymentMatchesV19164(o,paymentFilter)','from,to,paymentFilter,sortMode','orderPaymentFilterV19164']){
  assert.ok(html.includes(marker),marker);
 }
 assert.ok(css.includes('.orders-ready-due-shortcut-v19164[aria-pressed="true"]'));
});
test('versão PWA 1.9.164 consistente',()=>{
 assert.equal(version.app,'1.9.164');
 assert.match(worker,/artessencia-backoffice-1\.9\.164/);
 assert.match(html,/const APP_VERSION='1\.9\.164'/);
 assert.match(html,/name="artessencia-version" content="1\.9\.164"/);
});
