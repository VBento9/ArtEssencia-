// Isolated local data and blocked external requests, including communication actions.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1000,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',hasTouch:true}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof renderClients==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.clients=Array.from({length:25},(_,i)=>({id:'CLI-FIX-'+i,name:'Álvaro '+i,phone:String(912340000+i),email:'fixture'+i+'@example.invalid',note:'Nota fixture'}));db.orders=[];db.quotes=[];go('clients');window.initialClients=JSON.stringify(db.clients)});
 const cards=page.locator('#clientsCards > .client-card:not([hidden])'),pages=page.locator('#clients .ae-clients-pages').first();
 assert.equal(await cards.count(),10);assert.equal(await page.locator('.clients-form-card').isVisible(),false);
 await page.locator('#clientSearch').fill('alvaro');assert.equal(await cards.count(),10);await pages.getByRole('button',{name:'Seguinte',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 25/);
 const card=cards.first();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),false);await card.locator('summary').click();assert.equal(await card.getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),true);await card.locator('summary').click();
 await card.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await page.locator('#clientName').inputValue(),'Álvaro 10');await page.locator('#clientNote').fill('Rascunho preservado');
 await page.locator('.clients-form-head').getByRole('button',{name:'Voltar à lista',exact:true}).click();await page.locator('#aeClientsToolbar').getByRole('button',{name:'Abrir formulário',exact:true}).click();assert.equal(await page.locator('#clientNote').inputValue(),'Rascunho preservado');assert.equal(await page.evaluate(()=>JSON.stringify(db.clients)===initialClients),true);
 await page.locator('#clientSaveBtn').click();await page.waitForFunction(()=>db.clients[10].note==='Rascunho preservado');await page.locator('.clients-form-head').getByRole('button',{name:'Voltar à lista',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 25/);assert.equal(await page.locator('#clientSearch').inputValue(),'alvaro');
 await cards.first().getByRole('button',{name:'Ver ficha',exact:true}).click();await page.locator('#clientDetailDialog[open]').waitFor();assert.match(await page.locator('#clientDetailDialog').innerText(),/Álvaro 10/);await page.keyboard.press('Escape');
 assert.equal(await page.locator('.clients-list-card').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'Client list must fit '+width);
 await cards.first().getByRole('button',{name:'Nova encomenda',exact:true}).click();await page.waitForFunction(()=>document.getElementById('saleClient').value==='Álvaro 10');assert.equal(await page.locator('#saleContact').inputValue(),'912340010');await page.evaluate(()=>go('clients'));
 await page.getByLabel('Clientes por página',{exact:true}).selectOption('20');assert.equal(await cards.count(),20);await page.locator('#clientOrderFilter').selectOption('with');await page.waitForFunction(()=>document.querySelectorAll('#clientsCards .client-card').length===0);assert.match(await page.locator('#clientsCards').innerText(),/Sem clientes/);await page.locator('#clientOrderFilter').selectOption('without');assert.equal(await cards.count(),20);
 await context.close();
 }
 console.log('PASS: bounded client pagination, accent search, touch tablet/mobile layout, original edit/save/detail/new-order actions, retained drafts/page/filter, secondary actions collapsed, no writes on navigation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
