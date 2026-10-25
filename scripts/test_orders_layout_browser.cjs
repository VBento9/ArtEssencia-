// Real UI flows against local fixture data; all external requests are blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 async function open(width){const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('dialog',d=>d.accept());await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof showOrder==='function');await page.waitForTimeout(400);await page.evaluate(()=>{
  document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};queueOrderBusinessSyncV1757=()=>{};save=()=>{localStorage.setItem(KEY,JSON.stringify(db));renderOrders()};
  db.clients=[];db.cash=[];db.productionRuns=[];db.packaging=[{name:'Fixture box',cost:0,capacity:1}];
  db.orders=Array.from({length:25},(_,i)=>({id:'FIX-'+String(i).padStart(2,'0'),client:'Álvaro '+i,contact:'900000000',created:'2026-10-01',delivery:'2026-11-01',status:'Pedido',payment:'Dinheiro',paid:0,box:'Fixture box',boxes:1,items:[{code:'FIX',name:'Fixture candle',qty:2,price:10,cost:2}],notes:'Fixture notes'}));
  db.orders.push({id:'HISTORY',client:'Outro',created:'2025-01-01',delivery:'2025-02-01',status:'Entregue',items:[],paid:0});go('orders');window.initialOrders=JSON.stringify(db.orders);
 });return {context,page}}
 const {context,page}=await open(1000),errors=[];page.on('pageerror',e=>errors.push(e.message));
 assert.ok(await page.locator('#ordersTableWrap').isVisible());assert.equal(await page.locator('#ordersBody tr').count(),10);assert.equal(await page.locator('#ordersCards article').count(),10);
 await page.locator('#orderSearch').fill('alvaro');assert.match(await page.locator('#ordersResultsV1915').innerText(),/25 de 25/);
 await page.locator('[data-orders-next]').first().click();assert.match(await page.locator('[data-orders-page-count]').first().innerText(),/11–20 de 25/);
 const button=page.locator('#ordersBody [data-order-open]').first(),id=await button.getAttribute('data-order-open');await button.click();await page.locator('#orderDetail > .ae-order-detail-layout').waitFor();
 assert.equal(await page.locator('#orderDetail .ae-order-detail-customer strong').innerText(),'Álvaro 14');
 assert.deepEqual(await page.locator('#orderDetail .ae-order-detail-primary').evaluateAll(es=>es.map(e=>e.dataset.section)),['Fluxo da encomenda','Produtos']);
 assert.equal(await page.locator('#detailClient').isVisible(),false);assert.equal(await page.locator('#orderDetail .totalbox').isVisible(),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(db.orders)===initialOrders),true);
 await page.locator('#orderDetail details[data-section="Dados da encomenda"] > summary').click();await page.locator('#detailContact').fill('912345678');await page.locator('#detailNotes').fill('Rascunho preservado');
 await page.locator('#orderDetail details[data-section="Dados da encomenda"] > summary').click();await page.locator('#orderDetail details[data-section="Dados da encomenda"] > summary').click();assert.equal(await page.locator('#detailContact').inputValue(),'912345678');assert.equal(await page.locator('#detailNotes').inputValue(),'Rascunho preservado');
 await page.getByRole('button',{name:'Guardar dados',exact:true}).click();await page.waitForFunction(id=>db.orders.find(o=>o.id===id).contact==='912345678',id);await page.locator('#orderDetail details[data-section="Dados da encomenda"][open]').waitFor();
 await page.locator('#orderDetail details[data-section="Pagamentos"] > summary').click();await page.locator('#detailNewPaid').fill('5');await page.getByRole('button',{name:'Registar pagamento',exact:true}).click();await page.waitForFunction(id=>db.orders.find(o=>o.id===id).paid===5,id);assert.equal(await page.evaluate(id=>db.cash.filter(c=>c.orderId===id).reduce((s,c)=>s+c.value,0),id),5);
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'🖨️ Imprimir encomenda completa',exact:true}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.ok((await popup.locator('body').innerText()).includes(id));await popup.close();
 await page.locator('#orderDialog').getByRole('button',{name:'Fechar',exact:true}).click();assert.equal(await page.locator('#orderSearch').inputValue(),'alvaro');assert.match(await page.locator('[data-orders-page-count]').first().innerText(),/11–20 de 25/);await page.waitForFunction(id=>document.activeElement?.dataset.orderOpen===id,id);
 await page.locator('[data-orders-next]').first().click();assert.equal(await page.locator('#ordersBody tr').count(),5);assert.equal(await page.locator('[data-orders-next]').first().isEnabled(),false);
 await page.locator('#orderSearch').fill('sem-correspondencia');assert.match(await page.locator('#ordersBody').innerText(),/Sem encomendas/);await page.locator('#ordersClearFiltersV1915').click();assert.equal(await page.locator('#ordersBody tr').count(),10);
 await page.locator('#ordersHistoryTabV1882').click();assert.equal(await page.locator('#ordersBody tr').count(),1);assert.match(await page.locator('#ordersBody').innerText(),/HISTORY/);await page.locator('#ordersActiveTabV1882').click();assert.equal(await page.locator('#ordersBody tr').count(),10);
 assert.deepEqual(errors,[]);await context.close();
 const mobile=await open(390);assert.ok(await mobile.page.locator('#ordersCards').isVisible());assert.equal(await mobile.page.locator('#ordersTableWrap').isVisible(),false);
 const card=mobile.page.locator('#ordersCards article').first();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),false);await card.locator('summary').click();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),true);
 await card.getByRole('button',{name:'Abrir encomenda',exact:true}).click();await mobile.page.locator('#orderDetail > .ae-order-detail-layout').waitFor();assert.equal(await mobile.page.locator('#orderDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);await mobile.context.close();
 console.log('PASS Chromium: desktop table/mobile cards, bounded pagination, accent search, filters/page/focus retained, disclosure preserves drafts, real edit/payment/print handlers, no writes on navigation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
