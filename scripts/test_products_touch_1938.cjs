// Existing installed interface, isolated fixtures and no remote Cloud access.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,800]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',hasTouch:true});
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof openProductTechnicalSheetV1936==='function');
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.products=[{code:"FIX'QUOTE",name:'Vela de teste com nome comprido',category:'Velas em recipiente',price:12,laborMinutes:5,manufactured:true,publicCharacteristics:{waxType:'Soja',approximateWeight:'90 g'},shopImageUrl:''}];db.stock=[{name:'Cera fixture',unit:'g',qty:500,unitCost:.01}];db.productRecipes={"FIX'QUOTE":[{item:'Cera fixture',qty:90}]};go('products');window.before=JSON.stringify(db);window.actionCalls=[];archiveProductV1803=code=>actionCalls.push(['archive',code]);deleteProduct=code=>actionCalls.push(['delete',code]);});
 const card=page.locator('#productsCards .product-card');
 assert.equal(await card.getByRole('button',{name:'Arquivar',exact:true}).isVisible(),false);
 const targets=card.locator('.product-card-actions>.btn,summary');
 for(const target of await targets.all()){const box=await target.boundingBox();assert(box.width>=44&&box.height>=44,'Touch target '+width)}
 const read=await card.getByRole('button',{name:'Ver ficha',exact:true}).boundingBox(),edit=await card.getByRole('button',{name:'Editar',exact:true}).boundingBox();assert(Math.abs(read.y-edit.y)<2);assert(edit.x>=read.x+read.width+8);
 assert.equal(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 await card.locator('summary').click();await card.getByRole('button',{name:'Arquivar',exact:true}).click();assert.deepEqual(await page.evaluate(()=>actionCalls),[['archive',"FIX'QUOTE"]]);await card.locator('summary').click();
 await card.getByRole('button',{name:'Ver ficha',exact:true}).click();const dialog=page.locator('#ae-product-sheet');assert.equal(await page.locator('.products-form-card').isHidden(),true);assert.match(await dialog.innerText(),/Soja/);assert.equal(await dialog.locator('.ts-photo,.ts-no-photo').count(),0);
 assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'Sheet width '+width);
 for(const b of await dialog.locator('.ts-actions button').all()){const r=await b.boundingBox();assert(r.width>=44&&r.height>=44)}
 await page.screenshot({path:'/tmp/artessencia-sheet-touch-'+width+'.png'});await dialog.getByRole('button',{name:'Fechar',exact:true}).click();assert.equal(await page.evaluate(()=>scrollX),0);await page.screenshot({path:'/tmp/artessencia-products-touch-'+width+'.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(db)===before),true);
 await card.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await page.locator('.products-form-card').isVisible(),true);assert.equal(await page.locator('#prodCode').inputValue(),"FIX'QUOTE");
 await page.evaluate(()=>{db.products[0].publicCharacteristics={};db.products[0].waxType='Colza antiga';db.products[0].shopImageUrl='javascript:alert(1)';delete db.productRecipes["FIX'QUOTE"];db.products[0].recipe=[{materialId:'m',qty:100}];db.products[0].batchUnits=5;db.materials=[{id:'m',name:'Cera antiga',unit:'g',unitCost:.01}];openProductTechnicalSheetV1936("FIX'QUOTE")});
 assert.match(await dialog.innerText(),/Colza antiga/);assert.match(await dialog.locator('tbody tr').innerText(),/20 g/);assert.equal(await dialog.locator('.ts-photo').count(),0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: 320/390/800px touch targets, two-column primary buttons, secondary menu original identifiers, no edit/data writes from consultation, no-photo and legacy batch recipe, no horizontal overflow.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
