// Real editor, isolated local fixture. External services are never contacted.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1100,800,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof saveProduct==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.products=[];go('products');window.originalFile=document.getElementById('prodShopImageFile');window.beforeProducts=JSON.stringify(db.products)});
 await page.locator('#aeProductsCompact button').nth(1).click();
 const tab=key=>page.locator('[data-product-panel-btn="'+key+'"]');
 assert.deepEqual(await page.locator('.product-editor-nav-v1762 button').evaluateAll(es=>es.map(e=>e.dataset.productPanelBtn)),['identity','photos','production','pricing','public']);
 await tab('identity').click();await page.locator('#prodName').fill('Fixture editor');await page.locator('#prodCode').fill('FIX-EDITOR');
 await tab('photos').click();await page.locator('#prodShopImageFile').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgAAAAABJRU5ErkJggg==','base64')});
 await page.waitForFunction(()=>document.getElementById('prodShopImagePreview').src.startsWith('data:image/png'));
 await tab('production').click();await page.locator('#prodProductionNotesV130').fill('Rascunho técnico');assert.equal(await page.locator('#prodTechSheetBridge').evaluate(e=>e.closest('[data-product-panel]').dataset.productPanel),'production');
 await tab('pricing').click();await page.locator('#prodPriceQuickV1762').fill('12.5');
 await tab('public').click();await page.locator('#prodShopDescription').fill('Descrição fixture');assert.ok(await page.locator('#productPublicStatusV1850').isVisible());
 await page.locator('#aeProductsCompact button').first().click();await page.locator('#aeProductsCompact button').nth(1).click();await tab('photos').click();
 assert.equal(await page.evaluate(()=>originalFile===document.getElementById('prodShopImageFile')),true);assert.equal(await page.locator('#prodShopImageFile').evaluate(e=>e.files[0].name),'fixture.png');
 assert.equal(await page.locator('#prodName').inputValue(),'Fixture editor');assert.equal(await page.locator('#prodProductionNotesV130').inputValue(),'Rascunho técnico');assert.equal(await page.evaluate(()=>JSON.stringify(db.products)===beforeProducts),true);
 await tab('photos').focus();await page.keyboard.press('ArrowRight');assert.equal(await tab('production').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('.product-editor-nav-v1762').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
 // Existing save handler with no pending upload. Stored URL is a local fixture reference.
 await page.locator('#prodShopImageFile').setInputFiles([]);await page.evaluate(()=>{document.getElementById('prodShopImageUrl').value='https://fixture.invalid/saved.png';saveProduct()});
 await page.waitForFunction(()=>db.products.some(p=>p.code==='FIX-EDITOR'));
 const saved=await page.evaluate(()=>db.products.find(p=>p.code==='FIX-EDITOR'));assert.equal(saved.price,12.5);assert.equal(saved.shopImageUrl,'https://fixture.invalid/saved.png');assert.equal(saved.productionNotes,'Rascunho técnico');
 await page.evaluate(()=>editProduct('FIX-EDITOR'));assert.equal(await page.locator('#prodShopImageUrl').inputValue(),'https://fixture.invalid/saved.png');
 await context.close();
 }
 console.log('PASS: five accessible panels at desktop/tablet/mobile sizes, original photo picker and preview, retained drafts/files, keyboard navigation, unchanged save/edit handlers and photo association.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
