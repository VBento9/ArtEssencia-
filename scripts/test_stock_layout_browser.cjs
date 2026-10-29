// Local fixtures only: never contact Cloud or modify real stock.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1000,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof renderStock==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.stock=Array.from({length:45},(_,i)=>({name:'Fixture '+String(i).padStart(2,'0'),qty:100,unit:'g',min:10,target:200,unitCost:.02,imageUrl:'',preferredSupplier:''}));go('stock');window.initialStock=JSON.stringify(db.stock)});
 const rows=page.locator('#stockBody tr:not([hidden])'),controls=page.locator('#aeStockCompactControls');
 assert.equal(await rows.count(),20);await page.getByLabel('Artigos por página',{exact:true}).selectOption('10');assert.equal(await rows.count(),10);
 await controls.getByRole('button',{name:'Seguinte',exact:true}).click();assert.match(await controls.locator('.ae-stock-pages span').innerText(),/11–20 de 45/);
 await rows.first().getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#stockPreferredSupplier').fill('Fornecedor em rascunho');
 await page.locator('#stockImageFileV1771').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgAAAAABJRU5ErkJggg==','base64')});
 await page.waitForFunction(()=>document.getElementById('stockImagePreviewV1771').src.startsWith('data:image/png'));
 await page.locator('.stock-create-section-v1736 .ae-stock-return').click();assert.equal(await page.locator('.stock-create-section-v1736').isVisible(),false);assert.match(await controls.locator('.ae-stock-pages span').innerText(),/11–20 de 45/);
 await controls.getByRole('button',{name:'Abrir formulário',exact:true}).click();assert.equal(await page.locator('#stockPreferredSupplier').inputValue(),'Fornecedor em rascunho');assert.equal(await page.locator('#stockImageFileV1771').evaluate(e=>e.files[0].name),'fixture.png');assert.equal(await page.evaluate(()=>JSON.stringify(db.stock)===initialStock),true);
 await page.locator('#stockCancelBtnV145').click();assert.match(await controls.locator('.ae-stock-pages span').innerText(),/11–20 de 45/);
 // Save via the original handler, using only fixture data.
 await rows.first().getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#stockPreferredSupplier').fill('Fornecedor guardado');await page.locator('#stockSaveBtnV143').click();
 await page.waitForFunction(()=>db.stock[10].preferredSupplier==='Fornecedor guardado');await page.locator('.stock-create-section-v1736 .ae-stock-return').click();assert.match(await controls.locator('.ae-stock-pages span').innerText(),/11–20 de 45/);
 await rows.first().getByRole('button',{name:'Histórico',exact:true}).click();assert.ok(await page.locator('dialog[open]').count());await page.keyboard.press('Escape');
 assert.equal(await rows.first().evaluate(e=>getComputedStyle(e).display),width<650?'grid':'table-row');
 if(width<650){assert.equal(await page.locator('.stock-tablewrap').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);assert.equal(await rows.first().locator('td').nth(1).getAttribute('data-stock-label'),'Disponível')}
 await page.locator('#stockSearch').fill('Fixture 44');assert.equal(await rows.count(),1);assert.match(await rows.first().innerText(),/Fixture 44/);await page.locator('#stockSearch').fill('inexistente');assert.match(await page.locator('#stockBody').innerText(),/Nenhum artigo/);
 await page.locator('#stockSearch').fill('');
 await page.evaluate(()=>{db.stock[0].qty=0;db.stock[1].qty=5;db.stock[2].qty=10;db.stock[3].qty=-1;window.beforeReplenish=JSON.stringify(db.stock);window.filterWrites=0;save=()=>{window.filterWrites++};renderStock()});
 await page.getByLabel('Estado do stock',{exact:true}).selectOption('replenish');assert.equal(await rows.count(),4);assert.match(await controls.locator('.ae-stock-pages span').innerText(),/1–4 de 4/);
 await page.locator('#stockSearch').fill('Fixture 01');assert.equal(await rows.count(),1);await page.locator('#stockSearch').fill('');
 await page.getByLabel('Estado do stock',{exact:true}).selectOption('low');assert.equal(await rows.count(),2);
 await page.getByLabel('Estado do stock',{exact:true}).selectOption('out');assert.equal(await rows.count(),2);
 await page.getByLabel('Estado do stock',{exact:true}).selectOption('all');assert.equal(await rows.count(),10);
 assert.equal(await page.evaluate(()=>JSON.stringify(db.stock)===beforeReplenish&&filterWrites===0),true);
 await context.close();
 }
 console.log('PASS: desktop table/mobile cards, page size and filters, preserved page/draft/file/preview, original save and history, no data changes from navigation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
