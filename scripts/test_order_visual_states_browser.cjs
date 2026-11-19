'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   const page=await context.newPage();
   page.on('dialog',d=>d.accept());
   page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof showOrder==='function'&&typeof aeOrderVisualStateV19163==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();
    finishAppUnlockV19135();
    window.scheduleCloudPushV1860=()=>{};
    window.queueOrderBusinessSyncV1757=()=>{};
    const base={
     client:'Cliente teste',created:'2026-11-17',delivery:'2026-12-20',
     paid:0,box:'',boxes:0,items:[{code:'TEST',name:'Vela teste',qty:1,price:50,cost:10}]
    };
    const all=[
     ['FEITA','Pedido',0],['CONFIRMADA','Confirmada',0],
     ['PRODUCAO','Em produção',50],['PRONTA','Pronta',0],
     ['PARCIAL','Pronta',20],['PAGA','Pronta',50]
    ];
    db.orders=all.map(([id,status,paid])=>({...base,id,status,paid}));
    db.productionRuns=[];db.cash=[];db.clients=[];go('orders');renderOrders();
    window.initialColorFixtures=JSON.stringify(db.orders);
   });
   await page.waitForFunction(()=>document.querySelector('#ordersCards article[data-ae-order-state="ready-unpaid"]'));
   const expected={
    FEITA:['created','due'],
    CONFIRMADA:['confirmed','due'],
    PRODUCAO:['production','paid'],
    PRONTA:['ready-unpaid','due'],
    PARCIAL:['ready-unpaid','partial'],
    PAGA:['ready-paid','paid']
   };
   for(const [id,[state,payment]] of Object.entries(expected)){
    const card=page.locator('#ordersCards article.order-card').filter({has:page.locator('[data-order-open="'+id+'"]')});
    assert.equal(await card.getAttribute('data-ae-order-state'),state,id+' cartão');
    assert.equal(await card.getAttribute('data-ae-payment-state'),payment,id+' pagamento cartão');
    const row=page.locator('#ordersBody tr').filter({has:page.locator('[data-order-open="'+id+'"]')});
    assert.equal(await row.getAttribute('data-ae-order-state'),state,id+' tabela');
    assert.equal(await row.getAttribute('data-ae-payment-state'),payment,id+' pagamento tabela');
    const balanceBadge=row.locator('td').nth(4).locator('.ae-order-payment-v19163');
    assert.equal(await balanceBadge.getAttribute('data-payment'),payment);
    assert.equal(await row.locator('td').nth(5).locator('.ae-order-payment-v19163').count(),0);
    const border=await card.evaluate(el=>getComputedStyle(el).borderInlineStartColor);
    assert.notEqual(border,'rgba(0, 0, 0, 0)','sem borda colorida');
   }
   assert.equal(await page.locator('.ae-order-colors-legend-v19163').count(),1);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.orders)===initialColorFixtures),true);
   await page.evaluate(()=>{
    db.orders.find(x=>x.id==='PRONTA').paid=50;renderOrders();
   });
   await page.waitForFunction(()=>document.querySelector('#ordersCards article[data-ae-order-state="ready-paid"] [data-order-open="PRONTA"]'));
   await page.evaluate(()=>showOrder('PRODUCAO'));
   await page.waitForFunction(()=>document.querySelector('#orderDetail[data-ae-order-state="production"] .ae-order-payment-v19163')?.textContent==='Paga');
   assert.equal(await page.locator('#orderDetail .ae-order-payment-v19163').innerText(),'Paga');
   await context.close();
  }
  console.log('PASS Chromium: 390 px e 1120 px, cartões/tabela/detalhe, pagamento parcial e atualização visual sem gravações.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
