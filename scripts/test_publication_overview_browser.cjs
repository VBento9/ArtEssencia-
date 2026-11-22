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
   // Um utilizador em cache não substitui a verificação de sessão real.
   await page.evaluate(()=>{window.cloudUser={id:'fixture-owner'};window.__rpcCalls=[];window.__authCalls=[];});
   await page.locator('#aePublicationCheckV1').click();
   assert.deepEqual(await page.evaluate(()=>__rpcCalls),[],'Sessão em cache não permite RPC');
   assert.deepEqual(await page.evaluate(()=>__authCalls),['getSession']);
   // Sessão local presente, mas rejeitada pelo Auth remoto.
   await page.evaluate(()=>{__isLoggedIn=true;__authFail=true;__rpcCalls=[];__authCalls=[]});
   await page.locator('#aePublicationCheckV1').click();
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Sessão Cloud expirada/);
   assert.deepEqual(await page.evaluate(()=>__rpcCalls),[]);
   assert.deepEqual(await page.evaluate(()=>__authCalls),['getSession','getUser']);
   // Bloqueio PIN ou portal de autenticação: nem tentativa de leitura.
   await page.evaluate(()=>{__authFail=false;__authCalls=[];__rpcCalls=[];
    document.getElementById('lockScreen').classList.remove('hidden');
    document.getElementById('aePublicationCheckV1').click();});
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Desbloqueia o Backoffice/);
   assert.deepEqual(await page.evaluate(()=>__authCalls),[]);
   await page.evaluate(()=>{document.getElementById('lockScreen').classList.add('hidden');
    document.getElementById('authGateV1880').classList.remove('hidden');
    document.getElementById('aePublicationCheckV1').click();});
   assert.match(await page.locator('#aePublicationPublicResultV1').innerText(),/Desbloqueia o Backoffice/);
   await page.evaluate(()=>document.getElementById('authGateV1880').classList.add('hidden'));
   // Bloquear durante RPC impede apresentar dados que chegaram tarde.
   await page.evaluate(()=>{
    window.__holdFeed=true;window.__rpcCalls=[];window.__authCalls=[];
    document.getElementById('aePublicationCheckV1').click();
   });
   await page.waitForFunction(()=>typeof __resolveFeed==='function');
   await page.evaluate(()=>{
    document.getElementById('lockScreen').classList.remove('hidden');
    window.__resolveFeed();
   });
   await page.waitForFunction(()=>document.getElementById('aePublicationPublicResultV1')?.textContent.includes('Consulta interrompida'));
   assert.doesNotMatch(await page.locator('#aePublicationPublicResultV1').innerText(),/Feed público: 2/);
   await page.evaluate(()=>{
    document.getElementById('lockScreen').classList.add('hidden');
    window.__holdFeed=false;delete window.__resolveFeed;
   });
   assert.equal(await page.evaluate(()=>JSON.stringify(db.products)),before);
   const scroll=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
   assert(scroll.page<=scroll.viewport+2,'Sem overflow horizontal na largura '+width+': '+JSON.stringify(scroll));
   await context.close();
  }
  console.log('PASS: painel responsivo em 1366/800/390; RPC apenas leitura; registo órfão; filtros; sessão; dados intactos.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
