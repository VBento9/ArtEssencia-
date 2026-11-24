const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,900,1440]){
   const ctx=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'}),page=await ctx.newPage();
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof openDirectSalePOS==='function');
   await page.waitForTimeout(350);
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};queueOrderBusinessSyncV1757=()=>{};
    db.orders=[];db.cash=[];db.clients=[];db.productionRuns=[];db.stock=[{name:'Cera',qty:20000,unit:'g'}];
    db.products=[{code:'POS-TEST',name:'Vela de teste POS',price:7.5,cost:2}];
    db.productRecipes={};localStorage.setItem(KEY,JSON.stringify(db));
    go('sale');
   });
   await page.getByRole('button',{name:'Venda direta',exact:true}).click();
   const pos=page.locator('#directSalePOS');await pos.waitFor({state:'visible'});
   await ctx.setOffline(true);
   await pos.locator('#posSearch').fill('POS-TEST');
   await pos.locator('#posProducts').getByRole('button').click();
   await pos.getByRole('button',{name:'Adicionar uma unidade de Vela de teste POS'}).click();
   await pos.locator('#posMethod').selectOption('MB Way');
   await pos.locator('#posFinish').click();
   assert.equal(await page.evaluate(()=>db.orders.length),0);
   await pos.locator('#posStockConfirmed').check();
   await pos.locator('#posFinish').click();
   let r=await page.evaluate(()=>({o:db.orders[0],cash:db.cash,clients:db.clients.length,stock:db.stock[0].qty,runs:db.productionRuns.length,stored:JSON.parse(localStorage.getItem(KEY)).orders.length}));
   assert.equal(r.o.paid,15);assert.equal(r.o.clientId,null);assert.equal(r.cash.length,1);assert.equal(r.cash[0].value,15);assert.equal(r.clients,0);assert.equal(r.stock,20000);assert.equal(r.runs,0);assert.equal(r.stored,1);
   assert.equal(await pos.locator('#posFinish').isDisabled(),true);
   await pos.getByRole('button',{name:'Histórico de vendas diretas'}).click();
   page.once('dialog',d=>d.accept());await pos.getByRole('button',{name:'Anular e registar devolução'}).click();
   r=await page.evaluate(()=>({o:db.orders[0],cash:db.cash,stored:JSON.parse(localStorage.getItem(KEY)).cash}));
   assert.equal(r.o.status,'Cancelado');assert.equal(r.o.paid,0);assert.equal(r.cash.length,2);assert.equal(r.cash[1].type,'Saída');assert.equal(r.cash[1].value,15);assert.equal(r.stored.length,2);
   assert.equal(await pos.getByRole('button',{name:'Anular e registar devolução'}).count(),0);
   assert.equal(await pos.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
   await page.evaluate(()=>lockNow());
   assert.equal(await pos.evaluate(e=>e.open),false);
   await page.evaluate(()=>openDirectSalePOS());
   assert.equal(await pos.evaluate(e=>e.open),false);
   await ctx.close();
  }
  console.log('PASS: POS no browser, offline durante operação, telemóvel/tablet/desktop, Caixa, devolução e proteção de stock.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
