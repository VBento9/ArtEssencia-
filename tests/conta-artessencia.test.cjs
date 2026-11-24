const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const compactUI = fs.readFileSync('cash-compact-ui.js','utf8');

function account() {
  const { window } = new JSDOM(html,{runScripts:'outside-only',url:'https://example.test/conta/'});
  window.document.documentElement.classList.add('business-account');
  Object.assign(window,{
    db:{cash:[]}, editingCashId:null, uid:()=> 'test-cash', save:()=>true,
    todayISO:()=> '2026-11-24', toast:()=>{}, ensureRecordIds:()=>{},
    ensureOrderPaymentCashLedger:()=>{}, euro:String, escapeHtml:String
  });
  const start=html.indexOf('function addCash(){');
  const end=html.indexOf('function mergeDuplicateClients()',start);
  assert.ok(start>=0 && end>start);
  window.eval(html.slice(start,end));
  window.eval(compactUI);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

test('A despesa rápida abre o formulário, recusa valores negativos e impede um segundo lançamento após guardar',()=>{
  const w=account();
  try {
    const button=[...w.document.querySelectorAll('#aeCashToolbar button')].find(b=>b.textContent==='Registar despesa');
    button.click();
    assert.equal(w.cashType.value,'Despesa');
    assert.equal(w.document.querySelector('.cash-form-card').hidden,false);
    w.cashValue.value='-5';
    w.addCash();
    assert.equal(w.db.cash.length,0);
    w.cashValue.value='12.45';
    w.cashDesc.value='Portes';
    w.addCash();
    w.addCash();
    assert.equal(w.db.cash.length,1);
    assert.equal(w.db.cash[0].value,12.45);
    assert.equal(w.db.cash[0].type,'Despesa');
  } finally {w.close()}
});

test('O filtro mensal afeta a lista e preserva o saldo global',()=>{
  const w=account();
  try {
    w.db.cash.push({id:'s',type:'Entrada',value:50,desc:'Pagamento',source:'order_payment',date:'2026-10-31'},
                   {id:'c',type:'Despesa',value:18,desc:'Cera',source:'purchase',date:'2026-11-01'});
    w.accountCashMonth.value='2026-11';
    w.renderCash();
    assert.equal(w.cashBody.rows.length,1);
    assert.match(w.cashBody.textContent,/Cera/);
    assert.equal(w.cashKpis.lastElementChild.querySelector('.value').textContent,'32');
    w.accountCashMonth.value='';
    w.renderCash();
    assert.equal(w.cashBody.rows.length,2);
  } finally {w.close()}
});
