// Navegador isolado: bloqueia todos os pedidos externos e usa apenas dados fictícios.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1100]){
   const ctx=await browser.newContext({viewport:{width,height:940},serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof showOrder==='function'&&typeof openExistingOrderAddProductsV19160==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};queueOrderBusinessSyncV1757=()=>{};
    save=()=>{localStorage.setItem(KEY,JSON.stringify(db));return true};
    db.orders=[{id:'TEST-ORDER-1',client:'Ana',clientId:'TEST-CLIENT',contact:'912345678',status:'Pedido',source:'manual',paid:6,created:'2026-11-17',delivery:'2026-11-20',payment:'Dinheiro',paymentHistory:[{amount:6,method:'Dinheiro'}],notes:'Nota existente',items:[{code:'P-OLD',name:'Vela anterior',qty:1,price:10,cost:2}]}];
    db.clients=[{id:'TEST-CLIENT',name:'Ana'}];
    db.products=[{code:'P-OLD',name:'Vela anterior',price:10,cost:2,category:'Vela'},{code:'P-NEW',name:'Nova vela',price:7,cost:2,category:'Vela',personalizationV1773:{colors:{max:2,labels:['Base','Detalhes'],palette:[{name:'Azul'},{name:'Branco'}]},fragrance:{enabled:true,required:false,options:['Lavanda']}}}];
    db.productionRuns=[];db.packaging=[{name:'Caixa',cost:1}];
    go('orders');showOrder('TEST-ORDER-1');
   });
   const add=page.locator('[data-existing-order-add-v19160]');assert.equal(await add.count(),1);
   await add.click();
   const dialog=page.locator('.ae-order-add-dialog-v19160');
   await dialog.waitFor({state:'visible'});
   await dialog.locator('[data-ae-order-search-v19160]').fill('Nova vela');
   await dialog.getByRole('button',{name:/Nova vela/}).click();
   const row=dialog.locator('.ae-order-add-line-v19160');
   await row.locator('input[type=number]').fill('2');
   await row.locator('select').nth(0).selectOption('Azul');
   await row.locator('select').nth(1).selectOption('Branco');
   await row.locator('select').nth(2).selectOption('Lavanda');
   await row.locator('textarea').fill('Peça personalizada');
   const confirm=dialog.locator('[data-ae-order-confirm-v19160]');
   assert.equal(await confirm.isVisible(),true,'Guardar artigos deve estar visível no telemóvel');
   await confirm.click();
   await page.waitForFunction(()=>db.orders[0].items.length===2);
   const state=await page.evaluate(()=>({
    order:JSON.parse(JSON.stringify(db.orders[0])),
    local:JSON.parse(localStorage.getItem(KEY)).orders.find(x=>x.id==='TEST-ORDER-1'),
    pending:relIsOrderPending(db.orders[0])
   }));
   assert.equal(state.order.items[1].qty,2);
   assert.equal(state.order.items[1].directSaleOptionsV19158.fragrance,'Lavanda');
   assert.deepEqual(state.order.items[1].directSaleOptionsV19158.colors,['Azul','Branco']);
   assert.equal(state.order.clientId,'TEST-CLIENT');
   assert.equal(state.order.paid,6);
   assert.equal(state.order.notes,'Nota existente');
   assert.equal(state.order.paymentHistory[0].amount,6);
   assert.equal(state.local.items.length,2);
   assert.equal(state.order.total,24);
   assert.equal(state.pending,true);
   const cloud=await page.evaluate(async()=>{
    const writes={};
    cloudUser={id:'fixture-user'};cloudBusy=false;cloudPushRunning=false;cloudPushPending=false;cloudStartupDone=false;
    cloudClient={from(table){return {upsert:async rows=>{writes[table]=JSON.parse(JSON.stringify(rows));return {error:null}}}}};
    relFetchAll=async()=>[];
    const ok=await relationalSyncCore(false);
    return {ok,writes,dirty:cloudMeta().dirty,pending:relOrderPendingSet().size};
   });
   assert.equal(cloud.ok,true);
   assert.equal(cloud.pending,0);
   assert.equal(cloud.dirty,true,'A fase relacional não deve declarar a Cloud totalmente sincronizada');
   const cloudOrder=cloud.writes.artessencia_v1_orders?.[0];
   assert.ok(cloudOrder,'A atualização da encomenda deve ser enviada à Cloud');
   assert.equal(cloudOrder.data.id,'TEST-ORDER-1');
   assert.equal(cloudOrder.data.items.length,2);
   assert.equal(cloudOrder.data.items[1].directSaleOptionsV19158.fragrance,'Lavanda');
   assert.equal(cloudOrder.data.paid,6);
   assert.match(await page.locator('#orderDetail').innerText(),/Base: Azul/);
   const popupPromise=page.waitForEvent('popup');
   await page.evaluate(()=>printOrderCompleteV12634('TEST-ORDER-1'));
   const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
   const printed=await popup.locator('body').innerText();
   assert.match(printed,/Base: Azul/);assert.match(printed,/Peça personalizada/);
   assert.match(printed,/Nota existente/);
   await popup.close();
   await page.evaluate(()=>{db.orders[0].status='Em produção';showOrder('TEST-ORDER-1')});
   assert.equal(await page.locator('[data-existing-order-add-v19160]').count(),0);
   assert.equal(await page.evaluate(()=>canAddProductsToOrderV19160(db.orders[0])),false);
   await page.evaluate(()=>{db.orders[0].status='Pedido';db.productionRuns=[{orders:['TEST-ORDER-1']}];showOrder('TEST-ORDER-1')});
   assert.equal(await page.locator('[data-existing-order-add-v19160]').count(),0);
   await page.evaluate(()=>{db.productionRuns=[];db.orders[0].source='online_store';showOrder('TEST-ORDER-1')});
   assert.equal(await page.locator('[data-existing-order-add-v19160]').count(),0);
   assert.deepEqual(errors,[]);
   await ctx.close();
   console.log('PASS adicionar artigos '+width+'px: cliente, notas, pagamento, Cloud pendente, impressão e bloqueios');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});