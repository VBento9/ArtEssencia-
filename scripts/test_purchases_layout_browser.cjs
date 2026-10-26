// Local synthetic purchases only; external requests and real Cloud writes are blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1000,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',hasTouch:true}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof renderPurchases==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.cash=[];db.costMeta={};db.stock=[{name:'Fixture item',qty:100,unit:'un',min:10,target:200,unitCost:1}];db.purchases=Array.from({length:25},(_,i)=>({id:'PUR-FIX-'+i,date:'2026-10-01',supplier:'Fixture supplier '+i,item:'Fixture item',qty:2,purchaseQtyEntered:2,purchaseUnit:'un',baseUnit:'un',total:10,unitCost:5,status:'ordered',method:'Dinheiro',note:''}));go('purchases');window.beforePurchases=JSON.stringify([db.purchases,db.stock,db.cash])});
 const rows=page.locator('#purchasesBody tr:not([hidden])'),pages=page.locator('#purchases .ae-purchases-pages').first();
 assert.equal(await rows.count(),10);assert.equal(await page.locator('.purchase-form-card').isVisible(),false);await pages.getByRole('button',{name:'Seguinte',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 25/);
 await rows.first().getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await page.locator('#purchaseSupplier').inputValue(),'Fixture supplier 14');await page.locator('#purchaseNote').fill('Rascunho compra');
 await page.getByRole('button',{name:'Voltar ao histórico',exact:true}).click();await page.locator('#aePurchasesToolbar').getByRole('button',{name:'Abrir formulário',exact:true}).click();assert.equal(await page.locator('#purchaseNote').inputValue(),'Rascunho compra');assert.equal(await page.evaluate(()=>JSON.stringify([db.purchases,db.stock,db.cash])===beforePurchases),true);
 await page.locator('#purchaseSaveBtn').click();await page.waitForFunction(()=>db.purchases.find(p=>p.id==='PUR-FIX-14')?.note==='Rascunho compra');assert.equal(await page.evaluate(()=>db.stock[0].qty),100);assert.equal(await page.evaluate(()=>db.cash.length),0);
 await page.getByRole('button',{name:'Voltar ao histórico',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 25/);
 await rows.first().getByRole('button',{name:'Receber',exact:true}).click();await page.waitForFunction(()=>db.stock[0].qty===102);assert.equal(await page.evaluate(()=>db.cash.length),1);assert.equal(await page.evaluate(()=>db.cash[0].value),10);assert.ok(Math.abs(await page.evaluate(()=>db.stock[0].unitCost)-110/102)<1e-9);
 assert.equal(await rows.first().evaluate(e=>getComputedStyle(e).display),width<650?'grid':'table-row');if(width<650)assert.equal(await page.locator('.purchase-tablewrap').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
 await page.getByLabel('Estado da compra',{exact:true}).selectOption('received');assert.equal(await rows.count(),1);await page.getByLabel('Estado da compra',{exact:true}).selectOption('ordered');await page.getByLabel('Compras por página',{exact:true}).selectOption('20');assert.equal(await rows.count(),20);await page.locator('#purchaseMethodFilter').selectOption('Cartão');assert.match(await page.locator('#purchasesBody').innerText(),/Sem compras/);await page.locator('#purchaseMethodFilter').selectOption('all');await page.locator('#purchaseSearch').fill('supplier 24');assert.equal(await rows.count(),1);
 // Exercise actual cross-module Stock → Compras preselection and reveal.
 await page.evaluate(()=>{go('stock');stockGoPurchase(0)});await page.waitForFunction(()=>document.getElementById('purchaseItem').value==='Fixture item'&&!document.querySelector('.purchase-form-card').hidden);assert.equal(await page.locator('#purchaseItem').isVisible(),true);
 await context.close();
 }
 console.log('PASS: responsive purchases, pagination/state/payment/search, drafts and page retained, real ordered save without effects, receipt changes stock/cost/cash exactly once, Stock entry opens original form.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
