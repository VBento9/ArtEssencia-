// Interface real do Backoffice em localhost, com todos os serviços externos bloqueados.
// Não guarda dados reais, não faz autenticação nem contacta serviços públicos.
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1366,800,390]){
   const context=await browser.newContext({viewport:{width,height:940},serviceWorkers:'block'});
   const page=await context.newPage();
   await page.route('**/*',route=>{
    if(route.request().url().startsWith('http://127.0.0.1:8765/'))return route.continue();
    return route.abort();
   });
   await page.goto('http://127.0.0.1:8765/');
   await page.waitForFunction(()=>typeof go==='function'&&!!document.getElementById('aeProductsCompact'));
   await page.locator('#aePublicationOverviewV1').waitFor();
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();
    finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};
    db.products=[{
     _rid:'test-origin-001',code:'TEST-001',name:'Vela de demonstração',category:'Velas em molde',
     catalogGroupV191:'velas-decorativas',catalogSubgroupV191:'figuras-decorativas',
     shopDescription:'Descrição fictícia',shopImageUrl:'https://fixture.invalid/a.png',
     price:10,shopVisible:true,manufactured:false
    }];
    if(typeof go==='function')go('products');
   });
   await page.locator('#aePublicationRefreshV1').click();
   const before=await page.evaluate(()=>JSON.stringify(db.products));
   assert.equal(await page.locator('#aePublicationOverviewV1').isVisible(),true,'Painel visível na lista '+width);
   assert.equal(await page.locator('#aePublicationOverviewV1').evaluate(e=>e.parentElement.classList.contains('products-list-card')),true,'Painel na lista '+width);
   const compact=page.locator('#aeProductsCompact button');
   await compact.nth(1).click();
   assert.equal(await page.locator('.products-form-card').isVisible(),true,'Editor visível '+width);
   assert.equal(await page.locator('#aePublicationOverviewV1').isVisible(),false,'Painel oculto no editor '+width);
   await compact.nth(0).click();
   assert.equal(await page.locator('#aePublicationOverviewV1').isVisible(),true,'Painel regressa à lista '+width);
   await page.locator('#aePublicationFilterV1').selectOption('all');
   await page.locator('button[data-ae-publication-review="TEST-001"]').click();
   assert.equal(await page.locator('.products-list-card').evaluate(e=>e.classList.contains('ae-review-focus1995')),true,'Vista revisão '+width);
   assert.equal(await page.locator('#aePublicationOverviewV1').isVisible(),false,'Painel oculto na revisão '+width);
   assert.equal(await page.locator('#aeReviewSearch1995').inputValue(),'TEST-001','Pesquisa sincronizada '+width);
   assert.equal(await page.locator('.ae-review-item').count(),1,'Produto encontrado na revisão '+width);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.products)),before,'Nenhuma alteração aos produtos '+width);
   await context.close();
  }
  console.log('PASS: Backoffice completo, 1366/800/390: lista, editor, revisão, navegação, dados fictícios intactos.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
