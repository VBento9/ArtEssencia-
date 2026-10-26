// Synthetic local cash records only. All external requests are blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1000,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',hasTouch:true}),page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof renderCash==='function');await page.waitForTimeout(400);
 await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();scheduleCloudPushV1860=()=>{};db.orders=[];db.quotes=[];db.cash=Array.from({length:25},(_,i)=>({id:'CASH-FIX-'+i,date:'2026-10-01',type:i%2?'Despesa':'Entrada',desc:'Fixture manual '+i,method:'Dinheiro',value:10,source:'manual'}));db.cash.push(...['purchase','order_payment','quote_payment'].map((source,i)=>({id:'LOCK-'+i,date:'2026-10-01',type:'Entrada',desc:'Fixture locked '+source,method:'Cartão',value:5,source})));go('cash');window.beforeCash=JSON.stringify(db.cash);window.beforeKpis=document.getElementById('cashKpis').textContent});
 const rows=page.locator('#cashBody tr:not([hidden])'),pages=page.locator('#cash .ae-cash-pages').first();
 assert.equal(await rows.count(),10);assert.equal(await page.locator('.cash-form-card').isVisible(),false);
 for(const label of ['Compras','Encomendas','Orçamentos']){const row=page.locator('#cashBody tr').filter({hasText:'Gerido em '+label});assert.equal(await row.count(),1);assert.equal(await row.locator('button').count(),0)}
 await pages.getByRole('button',{name:'Seguinte',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 28/);
 await rows.first().getByRole('button',{name:'Editar',exact:true}).click();const id=await page.evaluate(()=>editingCashId);await page.locator('#cashDesc').fill('Rascunho caixa');
 await page.getByRole('button',{name:'Voltar aos movimentos',exact:true}).click();await page.locator('#aeCashToolbar').getByRole('button',{name:'Abrir formulário',exact:true}).click();assert.equal(await page.locator('#cashDesc').inputValue(),'Rascunho caixa');assert.equal(await page.evaluate(()=>JSON.stringify(db.cash)===beforeCash),true);
 await page.locator('#cashValue').fill('12.5');await page.locator('#cashSaveBtn').click();await page.waitForFunction(id=>db.cash.find(c=>c.id===id)?.value===12.5,id);assert.equal(await page.evaluate(id=>db.cash.find(c=>c.id===id).desc,id),'Rascunho caixa');assert.equal(await page.evaluate(()=>db.cash.length),28);
 await page.getByRole('button',{name:'Voltar aos movimentos',exact:true}).click();assert.match(await pages.locator('span').innerText(),/11–20 de 28/);
 assert.equal(await rows.first().evaluate(e=>getComputedStyle(e).display),width<650?'grid':'table-row');if(width<650)assert.equal(await page.locator('.cash-tablewrap').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
 const totals=await page.locator('#cashKpis').innerText();await page.locator('#cashMethodFilter').selectOption('Cartão');assert.equal(await rows.count(),3);assert.equal(await page.locator('#cashKpis').innerText(),totals);await page.locator('#cashTypeFilter').selectOption('Despesa');assert.match(await page.locator('#cashBody').innerText(),/Sem movimentos/);await page.locator('#cashTypeFilter').selectOption('all');await page.locator('#cashMethodFilter').selectOption('all');await page.getByLabel('Movimentos por página',{exact:true}).selectOption('20');assert.equal(await rows.count(),20);await page.locator('#cashSearch').fill('locked');assert.equal(await rows.count(),3);
 await page.evaluate(()=>{cancelCashEdit();editCash('LOCK-0');editCash('LOCK-1');editCash('LOCK-2')});assert.equal(await page.evaluate(()=>editingCashId),null);
 await page.locator('#aeCashToolbar').getByRole('button',{name:'Abrir formulário',exact:true}).click();await page.locator('#cashDesc').fill('Fixture new manual');await page.locator('#cashValue').fill('7');await page.locator('#cashSaveBtn').click();assert.equal(await page.evaluate(()=>db.cash.filter(c=>c.desc==='Fixture new manual'&&c.source==='manual'&&c.value===7).length),1);
 await context.close();
 }
 console.log('PASS: cash pagination/mobile layout, original manual edit/create, preserved drafts/page, filters without changing global totals, protected purchase/order/quote records remain uneditable.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
