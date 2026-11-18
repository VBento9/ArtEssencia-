const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,900]){
   const ctx=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof showOrder==='function'&&!!window.AeOrderPriceEditV19168);
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};queueOrderBusinessSyncV1757=()=>{};
    save=()=>{localStorage.setItem(KEY,JSON.stringify(db));return true};
    db.orders=[{id:'PRICE-TEST',client:'Cliente fictício',contact:'912345678',status:'Pedido',source:'manual',paid:6,discountTotal:2,
      delivery:'2026-12-01',payment:'Dinheiro',paymentHistory:[{amount:6,method:'Dinheiro'}],
      items:[{code:'P1',name:'Vela de teste',qty:2,price:10,cost:4}]}];
    db.products=[{code:'P1',name:'Vela de teste',price:10,cost:4}];db.productionRuns=[];db.packaging=[];
    go('orders');showOrder('PRICE-TEST');
   });
   const button=page.locator('[data-order-price-edit-v19168]');await button.waitFor();assert.equal(await button.count(),1);
   await button.click();
   const dialog=page.locator('.ae-order-price-dialog-v19168');await dialog.waitFor({state:'visible'});
   const price=dialog.locator('input[type=text]').nth(0),reason=dialog.locator('input[type=text]').nth(1),saveButton=dialog.getByRole('button',{name:'Guardar novo preço'});
   await price.fill('3,00');await reason.fill('Desconto especial');
   assert.match(await dialog.locator('[role=alert]').innerText(),/abaixo do valor já recebido/);
   assert.equal(await saveButton.isDisabled(),true);
   await price.fill('9,00');assert.equal(await saveButton.isDisabled(),true);
   await dialog.locator('input[type=checkbox]').check();
   assert.equal(await saveButton.isDisabled(),false);await saveButton.click();await dialog.waitFor({state:'detached'});
   const r=await page.evaluate(()=>({o:JSON.parse(JSON.stringify(db.orders[0])),product:db.products[0].price,
      local:JSON.parse(localStorage.getItem(KEY)).orders[0]}));
   assert.equal(r.o.items[0].price,9);assert.equal(r.o.subtotal,18);assert.equal(r.o.total,16);
   assert.equal(r.o.paid,6);assert.equal(r.o.paymentHistory[0].amount,6);assert.equal(r.product,10);
   assert.equal(r.o.priceAdjustmentHistoryV19168.length,1);assert.equal(r.o.priceAdjustmentHistoryV19168[0].previousPrice,10);
   assert.equal(r.local.items[0].price,9);
   assert.match(await page.locator('#orderDetail').innerText(),/Histórico de alterações de preço/);
   await page.evaluate(()=>{db.orders[0].source='online_store';showOrder('PRICE-TEST')});
   assert.equal(await button.count(),0);
   await page.evaluate(()=>{db.orders[0].source='manual';db.orders[0].status='Pronta';showOrder('PRICE-TEST')});
   assert.equal(await button.count(),0);
   await page.evaluate(()=>{db.orders[0].status='Pedido';db.productionRuns=[{orders:['PRICE-TEST']}];showOrder('PRICE-TEST')});
   assert.equal(await button.count(),0);assert.equal(errors.length,0,errors.join('; '));
   await ctx.close();
  }
  console.log('PASS: preço isolado, pagamentos preservados, histórico e guardado localmente, estados protegidos, telemóvel e tablet');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
