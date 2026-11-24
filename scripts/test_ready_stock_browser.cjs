const assert = require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,900,1440]){
   const db=new PGlite(),ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage();
   try{
    await require('./ready_stock_sql_fixture.cjs')(db);
    await db.exec('set role authenticated');
    const owner='00000000-0000-4000-8000-000000000001',rid='00000000-0000-4000-8000-000000000002';
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    const product={_rid:rid,code:'VELA-F',name:'Vela de feira',price:8,cost:2,category:'Velas',manufactured:true};
    await db.query('insert into artessencia_v1_products values($1,$2,$3,now())',[rid,owner,JSON.stringify(product)]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
    await page.exposeFunction('fixtureState',async()=>(await db.query('select to_jsonb(s) as row from artessencia_v1_state s')).rows[0].row);
    await page.exposeFunction('fixtureProducts',async()=>(await db.query('select to_jsonb(p) as row from artessencia_v1_products p')).rows.map(r=>r.row));
    await page.exposeFunction('fixtureRpc',async(name,args)=>{
     try{
      let result;
      if(name==='artessencia_register_ready_stock_v1')result=await db.query('select artessencia_register_ready_stock_v1($1,$2,$3,$4) as result',[args.p_revision,JSON.stringify(args.p_run),JSON.stringify(args.p_product),args.p_device]);
      else if(name==='artessencia_commit_ready_sale_v1')result=await db.query('select artessencia_commit_ready_sale_v1($1,$2,$3) as result',[args.p_revision,JSON.stringify(args.p_order),args.p_device]);
      else throw Error(name);
      return {data:result.rows[0].result};
     }catch(e){console.error(e.message);return {error:{code:e.code,message:e.message}}}
    });
    await page.goto('http://127.0.0.1:8765');
    await page.waitForFunction(()=>typeof openReadyStock==='function');
    await page.waitForTimeout(350);
    const initial=await page.evaluate(({owner,product})=>{
      document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
      db.products=[product];db.orders=[];db.cash=[];db.stockMoves=[];db.productionRuns=[];db.clients=[];
      db.stock=[{name:'Cera',qty:100,unit:'g'}];db.productRecipes={'VELA-F':[{item:'Cera',qty:10}]};
      ensureCloudSession=async()=>({id:owner});fetchCloudRowAuthoritative=window.fixtureState;relFetchAll=window.fixtureProducts;cloudClient={rpc:window.fixtureRpc};
      scheduleCloudPushV1860=()=>{};relDetectChangedOrders=()=>{};cloudStartupDone=true;cloudBusy=false;cloudHydrating=false;cloudPushRunning=false;
      localStorage.removeItem(REL_DIRTY);setCloudMeta({dirty:false,conflict:false});localStorage.setItem(KEY,JSON.stringify(db));go('production');
      return operationalCloudSnapshotV139();
    },{owner,product});
    await db.query('insert into artessencia_v1_state(user_id,data,revision) values($1,$2,0)',[owner,JSON.stringify(initial)]);
    await page.locator('#production button[onclick="openReadyStock()"]').click();
    for(const [idx,mode] of ['consume','already','damage'].entries()){
     if(idx)await page.evaluate(()=>openReadyStock());
     await page.selectOption('#readyProduct','VELA-F');await page.selectOption('#readyMode',mode);
     await page.fill('#readyQty','1');
     if(mode==='damage')await page.fill('#readyReason','Quebra de teste');
     await page.check('#readyConfirm');await page.click('#readySubmit');
     await page.waitForFunction(n=>db.productionRuns.length===n,idx+1,{timeout:6000});
    }
    assert.equal(await page.evaluate(()=>db.cash.length),0);
    assert.equal(await page.evaluate(()=>db.stock[0].qty),90);
    await page.evaluate(()=>go('stock'));await page.locator('#stock button[onclick="openReadyStock(true)"]').click();
    assert.equal(await page.isHidden('#readyForm'),true);
    await page.fill('#readyFilter','VELA-F');await page.click('#readyList summary');
    assert.match(await page.locator('#readyList').innerText(),/Quebra de teste/);
    assert.equal(await page.locator('#readyStockDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.click('#readyClose');await page.evaluate(()=>go('sale'));await page.click('#sale button[onclick="openDirectSalePOS()"]');
    await page.selectOption('#posCategory','Velas');await page.click('#posProducts button');await page.click('#posFinish');
    await page.waitForFunction(()=>db.cash.length===1,{},{timeout:6000});
    assert.deepEqual(await page.evaluate(()=>[readyStockInventory().get('VELA-F').available,db.cash[0].value,db.orders.length,db.clients.length]),[0,8,1,0]);
    console.log('PASS browser + SQL, '+width+' px');
   }catch(e){console.error(await page.evaluate(()=>({message:document.querySelector('#toast')?.textContent,overlay:document.querySelector('#productionTransactionV1926')?.innerText,preview:document.querySelector('#readyPreview')?.innerText})).catch(()=>null));throw e}
   finally{await ctx.close();await db.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
