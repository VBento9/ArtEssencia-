// Isolated Chromium fixture: external requests blocked; no real Cloud writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [390,1000]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof visualCatalogsDataV192==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.products=[{code:'P-TEST',name:'Produto fictício',price:1}];localStorage.setItem(VISUAL_CATALOG_KEY_V192,JSON.stringify([{id:'legacy-test',title:'Rascunho antigo',productIds:['P-TEST'],format:'A4'}]));go('visualCatalogs')});
 const list=page.locator('#visualCatalogListV192');await page.getByRole('button',{name:'Integrar rascunhos locais',exact:true}).click();
 assert.match(await list.innerText(),/Rascunho antigo/);
 assert.equal(await page.evaluate(()=>db.visualCatalogsV1935.rows.length),1);
 await list.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#visualCatalogTitleV192').fill('Título atualizado');await page.getByRole('button',{name:'Guardar rascunho',exact:true}).click();assert.match(await list.innerText(),/Título atualizado/);
 assert.equal(await page.evaluate(()=>backupPayload().data.visualCatalogsV1935.rows[0].title),'Título atualizado');
 await page.reload();await page.waitForFunction(()=>typeof visualCatalogsDataV192==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};go('visualCatalogs')});
 assert.match(await list.innerText(),/Título atualizado/);await list.getByRole('button',{name:'Eliminar',exact:true}).click();
 assert.equal(await page.evaluate(()=>visualCatalogsDataV192().length),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(VISUAL_CATALOG_KEY_V192))[0].title),'Rascunho antigo');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).visualCatalogsV1935.rows.length),0);
 await context.close();
 }
 console.log('PASS: mobile/tablet legacy import, original edit/save buttons, backup, persisted reload, delete without legacy resurrection; no external requests.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
