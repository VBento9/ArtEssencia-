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
 // Priority sorting must reset pagination, put missing dates last and never save.
 await page.evaluate(()=>{
  db.orders.filter(o=>o.id!=='HISTORY').forEach((o,i)=>{o.delivery=i===0?'2026-10-30':i===1?'2026-10-30':i===2?'2026-02-30':i===3?'':'2026-11-01';o.deliveryTime=i===0?'10:00':i===1?'09:00':''});
  window.beforeSorting=JSON.stringify(db.orders);window.sortWrites=0;save=()=>{window.sortWrites++};renderOrders();
 });
 await page.locator('[data-orders-next]').first().click();
 await page.getByLabel('Ordenar encomendas ativas',{exact:true}).selectOption('due');
 assert.match(await page.locator('[data-orders-page-count]').first().innerText(),/1–10 de 25/);
 assert.deepEqual(await page.locator('#ordersBody [data-order-open]').evaluateAll(es=>es.slice(0,2).map(e=>e.dataset.orderOpen)),['FIX-01','FIX-00']);
 await page.locator('[data-orders-next]').first().click();await page.locator('[data-orders-next]').first().click();
 const lastIds=await page.locator('#ordersBody [data-order-open]').evaluateAll(es=>es.map(e=>e.dataset.orderOpen));
 assert.deepEqual(lastIds.slice(-2),['FIX-03','FIX-02']);
 await page.locator('#ordersHistoryTabV1882').click();assert.equal(await page.locator('#ordersSortV1916').isDisabled(),true);assert.match(await page.locator('#ordersBody').innerText(),/HISTORY/);
 await page.locator('#ordersActiveTabV1882').click();await page.locator('#ordersClearFiltersV1915').click();assert.equal(await page.locator('#ordersSortV1916').inputValue(),'recent');
 assert.equal(await page.locator('#ordersBody [data-order-open]').first().getAttribute('data-order-open'),'FIX-24');
 assert.equal(await page.evaluate(()=>JSON.stringify(db.orders)===beforeSorting&&sortWrites===0),true);
 assert.deepEqual(errors,[]);await context.close();
 const mobile=await open(390);assert.ok(await mobile.page.locator('#ordersCards').isVisible());assert.equal(await mobile.page.locator('#ordersTableWrap').isVisible(),false);
 await mobile.page.getByLabel('Ordenar encomendas ativas',{exact:true}).selectOption('due');await mobile.page.waitForFunction(()=>document.getElementById('ordersSortV1916')?.getBoundingClientRect().height>=44);assert.ok(await mobile.page.locator('#ordersSortV1916').evaluate(e=>e.getBoundingClientRect().height>=44));
 const card=mobile.page.locator('#ordersCards article').first();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),false);await card.locator('summary').click();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),true);
 await card.getByRole('button',{name:'Abrir encomenda',exact:true}).click();await mobile.page.locator('#orderDetail > .ae-order-detail-layout').waitFor();assert.equal(await mobile.page.locator('#orderDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);await mobile.context.close();
 async function verifyMaterials(width){
  const {context,page}=await open(width);
  await page.evaluate(()=>{
   const wax='Cera <img src=x onerror=alert(1)> '+ 'X'.repeat(100);
   db.products=[{code:'MAT',name:'Vela fixture',manufactured:true},{code:'NO-RECIPE',name:'Sem receita',manufactured:true},{code:'RESALE',name:'Revenda',manufactured:false}];
   db.productRecipes={MAT:[{item:wax,qty:999}]};
   db.stock=[{name:wax,qty:100,unit:'g'},{name:'Caixa fixture',qty:5,unit:'un'},{name:'Stock inválido',qty:'erro',unit:'g'}];
   const o={id:'MAT-ORDER',client:'Fixture',status:'Confirmada',delivery:'2026-11-01',box:'Caixa fixture',boxes:1,items:[{code:'MAT',name:'Vela fixture',qty:3,price:10},{code:'NO-RECIPE',name:'Sem receita',qty:1,price:1},{code:'UNKNOWN',name:'Não encontrado',qty:1,price:1},{code:'RESALE',name:'Revenda',qty:1,price:1}],technicalSnapshotV1757:{lines:[{index:0,code:'MAT',materialsCaptured:true,materials:[{item:wax,qtyPerUnit:20,unit:'g'},{item:'Material ausente',qtyPerUnit:1,unit:'g'},{item:'Stock inválido',qtyPerUnit:2,unit:'g'}]}]}};
   const other={id:'OTHER',status:'Confirmada',delivery:'2026-10-31',items:[{code:'MAT',qty:1}],technicalSnapshotV1757:{lines:[{index:0,code:'MAT',materialsCaptured:true,materials:[{item:wax,qtyPerUnit:50,unit:'g'}]}]}};
   db.orders=[o,other];db.productionRuns=[];db.stockMoves=[];window.materialsBefore=JSON.stringify(db);window.materialWrites=0;save=()=>{materialWrites++};showOrder(o.id);
  });
  const details=page.locator('.ae-order-materials');await details.waitFor();assert.equal(await details.getAttribute('open'),null);
  await details.locator('summary').click();await details.locator('.ae-material-row').first().waitFor();
  assert.equal(await details.locator('.ae-material-row').count(),4);
  const wax=details.locator('.ae-material-row').first();
  assert.deepEqual(await wax.locator('dd').allTextContents(),['60 g','100 g','50 g','50 g']);assert.match(await wax.innerText(),/Em falta: 10 g/);
  assert.match(await details.innerText(),/Sem receita/);assert.match(await details.innerText(),/Não encontrado/);assert.match(await details.innerText(),/Material não encontrado no Stock/);assert.match(await details.innerText(),/Stock inválido: verifica/);
  assert.equal(await details.locator('img,script').count(),0);
  assert.deepEqual(await details.locator('.ae-material-row').last().locator('dd').allTextContents(),['1 un','5 un','0 un','5 un']);
  await details.locator('summary').click();await details.locator('summary').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(db)===materialsBefore&&materialWrites===0),true);
  assert.equal(await page.locator('#orderDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
  if(process.env.AE_MATERIAL_SCREENSHOTS){await details.locator('.ae-material-values').first().scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/ae-order-materials-'+width+'.png'})}
  // Reopening recomputes the consultation; the saved recipe remains unchanged.
  await details.locator('summary').click();await page.evaluate(()=>{db.stock[0].qty=150});await details.locator('summary').click();await page.waitForFunction(()=>document.querySelectorAll('.ae-material-row dd')[1]?.textContent==='150 g');
  assert.deepEqual(await wax.locator('dd').allTextContents(),['60 g','150 g','50 g','100 g']);
  await page.evaluate(()=>{db.productionRuns=[{id:'RUN',orders:['MAT-ORDER']}];showOrder('MAT-ORDER')});await page.locator('#orderDetail > .ae-order-detail-layout').waitFor();assert.equal(await page.locator('.ae-order-materials').count(),0);
  await context.close();
 }
 await verifyMaterials(1000);await verifyMaterials(390);
 console.log('PASS Chromium: desktop table/mobile cards, bounded pagination, accent search, filters/page/focus retained, disclosure preserves drafts, real edit/payment/print handlers, no writes on navigation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
