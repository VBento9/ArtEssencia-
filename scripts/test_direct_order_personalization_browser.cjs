// ArtEssencia: testes de integração reais em Chromium com dados de teste isolados.
// Bloqueia TODOS os destinos externos; não comunica com Supabase, Vercel ou serviços de produção.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1120,390]){
   const context=await browser.newContext({viewport:{width,height:980},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:8765'?route.continue():route.abort();
   });
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof saveOrder==='function'&&typeof directOrderLineInstructionsV19158==='function'&&typeof renderCart==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();
    finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};
    scheduleRelationalSync=()=>{};
    syncOrderBusinessStateV1757=async()=>false;
    nextManualOrderId=async()=> 'AS-2026-9999';
    cloudClient=null;cloudUser=null;
    db.orders=[];db.clients=[{id:'CLI-EXIST',name:'Maria',phone:'912345678',email:''}];
    db.products=[{code:'VELA-T',name:'Vela de teste',price:12,cost:3,category:'Vela',personalizationV1773:{colors:{max:2,labels:['Cor da base','Cor dos detalhes'],palette:[{name:'Azul'},{name:'Branco'},{name:'Vermelho'}]},fragrance:{enabled:true,required:true,options:['Lavanda','Coco & Baunilha']}}}];
    db.packaging=[{name:'Caixa teste',cost:0,capacity:10}];db.stock=[];db.productionRuns=[];db.cash=[];
    cart=[];
    document.getElementById('saleBox').innerHTML='<option value="Caixa teste">Caixa teste</option>';
    document.getElementById('saleClient').value='João';
    document.getElementById('saleContact').value='912345678'; // mesmo contacto provisório
    document.getElementById('saleDate').value='2026-11-25';
    document.getElementById('saleNotes').value='Entregar na segunda-feira';
    document.getElementById('salePaid').value='0';
    document.getElementById('saleBoxes').value='1';
    document.getElementById('salePayment').value='Dinheiro';
    addProductToCartV1745('VELA-T');
   });
   assert.equal(await page.locator('#cart .ae-direct-order-options-v19158').count(),1);
   const first=page.locator('#cart .ae-direct-order-options-v19158').first();
   await first.locator('summary').click();
   await first.locator('select').nth(0).selectOption('Azul');
   await first.locator('select').nth(1).selectOption('Branco');
   await first.locator('select').nth(2).selectOption('Lavanda');
   await first.locator('textarea').fill('Acabamento mate');
   await page.evaluate(()=>addProductToCartV1745('VELA-T'));
   assert.equal(await page.locator('#cart .ae-direct-order-options-v19158').count(),2);
   const second=page.locator('#cart .ae-direct-order-options-v19158').nth(1);
   if(!(await second.evaluate(e=>e.open)))await second.locator('summary').click();
   await second.locator('select').nth(0).selectOption('Vermelho');
   await second.locator('select').nth(2).selectOption('Coco & Baunilha');
   const cost=await page.evaluate(()=>cart.reduce((t,x)=>t+x.qty*x.price,0));
   assert.equal(cost,24);
   await page.evaluate(()=>saveOrder());
   const snapshot=await page.evaluate(()=>({
    orders:db.orders.map(o=>({id:o.id,client:o.client,clientId:o.clientId,notes:o.notes,items:o.items.map(i=>({qty:i.qty,options:i.directSaleOptionsV19158}))})),
    clients:db.clients.map(c=>({id:c.id,name:c.name})),
    local:JSON.parse(localStorage.getItem(KEY)).orders.find(o=>o.id==='AS-2026-9999')?.items.map(i=>i.directSaleOptionsV19158)
   }));
   assert.equal(snapshot.orders.length,1);
   assert.equal(snapshot.orders[0].items.length,2);
   assert.equal(snapshot.orders[0].notes,'Entregar na segunda-feira');
   assert.equal(snapshot.orders[0].items[0].options.colors[0],'Azul');
   assert.equal(snapshot.orders[0].items[1].options.colors[0],'Vermelho');
   assert.equal(snapshot.local[0].fragrance,'Lavanda');
   assert.equal(snapshot.local[1].fragrance,'Coco & Baunilha');
   assert.notEqual(snapshot.orders[0].clientId,'CLI-EXIST');
   assert.equal(snapshot.clients.find(c=>c.id==='CLI-EXIST').name,'Maria');
   await page.evaluate(()=>showOrder('AS-2026-9999'));
   const detail=await page.locator('#orderDetail').innerText();
   assert.match(detail,/Cor da base: Azul/);
   assert.match(detail,/Cor da base: Vermelho/);
   assert.match(detail,/Fragrância: Lavanda/);
   const popupPromise=page.waitForEvent('popup');
   await page.evaluate(()=>printOrderCompleteV12634('AS-2026-9999'));
   const popup=await popupPromise;
   await popup.waitForLoadState('domcontentloaded');
   const printed=await popup.locator('body').innerText();
   assert.match(printed,/Cor da base: Azul/);
   assert.match(printed,/Cor da base: Vermelho/);
   assert.match(printed,/Fragrância: Coco & Baunilha/);
   assert.match(printed,/Acabamento mate/);
   assert.match(printed,/Entregar na segunda-feira/);
   assert.equal((printed.match(/Entregar na segunda-feira/g)||[]).length,1);
   await popup.close();
   assert.equal(errors.length,0,errors.join('\n'));
   await context.close();
   console.log('PASS: '+width+'px, cliente distinto com telefone repetido, guardar local, personalização por unidade, detalhe e impressão A4');
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
