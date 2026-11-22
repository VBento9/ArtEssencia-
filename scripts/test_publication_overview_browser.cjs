// Fixture isolada com Chromium: nenhuma conexão à Cloud ou dados comerciais reais.
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1366,800,390]){
   const context=await browser.newContext({viewport:{width,height:940},serviceWorkers:'block'});
   const page=await context.newPage();
   await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith('http://127.0.0.1:8765/'))return route.continue();
    return route.abort();
   });
   await page.goto('http://127.0.0.1:8765/tests/publication-overview-browser-fixture.html');
   await page.locator('#aePublicationOverviewV1').waitFor();
   assert.equal(await page.locator('#aePublicationMetricsV1 .ae-publication-metric-v1').count(),6);
   const before=await page.evaluate(()=>JSON.stringify(db.products));
   await page.locator('#aePublicationCheckV1').click();
   await page.getByText('Vela teste 1').waitFor({state:'attached'});
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Catálogo: open/);
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Loja: closed/);
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/1 Origem não encontrada neste dispositivo/);
   assert.deepEqual(await page.evaluate(()=>__rpcCalls),[
    'store_public_catalog_v1','store_public_content_v3','store_public_config_v1'
   ]);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.products)),before);
   await page.locator('#aePublicationFilterV1').selectOption('marked');
   assert.equal(await page.locator('.ae-publication-row-v1').count(),1);
   await page.locator('#aePublicationFilterV1').selectOption('all');
   await page.locator('#aePublicationSearchV1').fill('Sabonete');
   assert.equal(await page.locator('.ae-publication-row-v1').count(),1);
   await page.locator('#aePublicationSearchV1').fill('');
   // Sessão ausente: nenhuma RPC adicional.
   await page.evaluate(()=>{__isLoggedIn=false;__rpcCalls=[]});
   await page.locator('#aePublicationCheckV1').click();
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Inicia sessão/);
   assert.deepEqual(await page.evaluate(()=>__rpcCalls),[]);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.products)),before);
   const scroll=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
   assert(scroll.page<=scroll.viewport+2,'Sem overflow horizontal na largura '+width+': '+JSON.stringify(scroll));
   await context.close();
  }
  console.log('PASS: painel responsivo em 1366/800/390; RPC apenas leitura; registo órfão; filtros; sessão; dados intactos.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
