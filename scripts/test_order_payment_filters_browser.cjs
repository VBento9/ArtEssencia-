'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'});
   const page=await context.newPage();
   page.on('dialog',d=>d.accept());
   await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8765'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>typeof showReadyDueOrdersV19164==='function'&&typeof renderOrders==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
    window.scheduleCloudPushV1860=()=>{};window.queueOrderBusinessSyncV1757=()=>{};
    const fixture={created:'2026-11-17',delivery:'2026-12-20',client:'Teste',items:[{code:'TEST',name:'Vela',qty:1,price:50,cost:10}]};
    db.orders=[
     {...fixture,id:'READY1',status:'Pronta',paid:0},
     {...fixture,id:'READY2',status:'Pronta',paid:20},
     {...fixture,id:'READY3',status:'Pronta',paid:50},
     {...fixture,id:'PRODUCTION',status:'Em produção',paid:0},
     {...fixture,id:'HISTORY',status:'Entregue',paid:0}
    ];
    db.productionRuns=[];db.clients=[];db.cash=[];go('orders');renderOrders();window.originalFixture=JSON.stringify(db.orders);
   });
   await page.waitForFunction(()=>document.getElementById('ordersReadyDueShortcutV19164')?.textContent.includes('80,00'));
   const shortcut=page.locator('#ordersReadyDueShortcutV19164');
   assert.match(await shortcut.innerText(),/2/);
   assert.equal(await shortcut.getAttribute('aria-pressed'),'false');
   await shortcut.click();
   await page.waitForFunction(()=>document.querySelector('#orderPaymentFilterV19164')?.value==='ready-due');
   assert.equal(await page.locator('#ordersBody tr').count(),2);
   assert.match(await page.locator('#ordersResultsV1915').innerText(),/2 de 4/);
   assert.equal(await shortcut.getAttribute('aria-pressed'),'true');
   await page.locator('#ordersClearFiltersV1915').click();
   assert.equal(await page.locator('#orderPaymentFilterV19164').inputValue(),'');
   assert.equal(await page.locator('#ordersBody tr').count(),4);
   await page.locator('#orderPaymentFilterV19164').selectOption('paid');
   assert.equal(await page.locator('#ordersBody tr').count(),1);
   await page.locator('#orderPaymentFilterV19164').selectOption('partial');
   assert.equal(await page.locator('#ordersBody tr').count(),1);
   await page.locator('#ordersHistoryTabV1882').click();
   assert.equal(await page.locator('#orderPaymentFilterV19164').isDisabled(),true);
   assert.equal(await shortcut.isVisible(),false);
   await page.locator('#ordersActiveTabV1882').click();
   assert.equal(await page.locator('#orderPaymentFilterV19164').isEnabled(),true);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.orders)===originalFixture),true);
   await context.close();
  }
  console.log('PASS: 390/1120 px, filtros financeiros, atalho, histórico e conservação de dados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
