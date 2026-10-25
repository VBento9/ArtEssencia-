const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:800,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>typeof consumeProduction==='function');await page.waitForTimeout(400);
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>{
   document.getElementById('authGateV1880')?.remove(); // fixture only: all remote requests are blocked
   scheduleCloudPushV1860=()=>{};ensureCloudSession=async()=>({id:'fixture-owner'});cloudUser={id:'fixture-owner'};cloudStartupDone=true;cloudHydrating=false;cloudBusy=false;cloudPushRunning=false;
   cloudMeta=()=>({});relOrderPendingSet=()=>new Set();relDetectChangedOrders=()=>{};localStorage.removeItem(REL_DIRTY);
   db.stock=[{name:'Fixture wax',qty:100,unit:'g',unitCost:.01}];db.products=[{code:'FIXTURE',_rid:'fixture-product',name:'Fixture',manufactured:true,price:10,cost:1}];
   db.orders=[{id:'FIXTURE-ORDER',_rid:'fixture-order',status:'Em produção',delivery:'2026-10-25',items:[{code:'FIXTURE',name:'Fixture',qty:1}],box:'',boxes:0}];db.productionRuns=[];db.stockMoves=[];db.productRecipes={FIXTURE:[{item:'Fixture wax',qty:20}]};
   prodDate.value='2026-10-25';fetchCloudRowAuthoritative=async()=>({user_id:'fixture-owner',revision:7,data:operationalCloudSnapshotV139()});
   relFetchAll=async table=>table===REL_TABLES.orders?db.orders.map(o=>({id:o._rid,data:relClone(o)})):db.products.map(p=>({id:p._rid,data:relClone(p)}));
   window.rpcCalls=[];window.failRPC=true;
   cloudClient={rpc:async(name,args)=>{rpcCalls.push({name,args:relClone(args)});if(failRPC)throw new Error('Simulated lost connection');const data=operationalCloudSnapshotV139();data.stock[0].qty=80;data.productionRuns.push(args.p_run);data.stockMoves.push({item:'Fixture wax',type:'production',qty:20,productionRunId:args.p_run.id});return {data:{state:{user_id:'fixture-owner',revision:8,data},orders:[{id:'fixture-order',status:'Pronta',data:{...db.orders[0],status:'Pronta'}}]}}}};
   go('production');
  });
  await page.evaluate(()=>consumeProduction());
  assert.equal(await page.evaluate(()=>rpcCalls.length),1);
  assert.deepEqual(await page.evaluate(()=>[db.stock[0].qty,db.orders[0].status]),[100,'Em produção']);
  await page.locator('#productionTransactionV1926 button').waitFor();
  await page.evaluate(()=>failRPC=false);await page.locator('#productionTransactionV1926 button').click();
  await page.waitForFunction(()=>!productionPendingV1926());
  assert.deepEqual(await page.evaluate(()=>[db.stock[0].qty,db.orders[0].status,rpcCalls[0].args.p_run.id===rpcCalls[1].args.p_run.id]),[80,'Pronta',true]);
  // Execute a hostile note through the actual DOM renderer, not only a string assertion.
  await page.evaluate(()=>{window.noteExecuted=false;db.stockMoves=[{item:'Fixture wax',qty:1,type:'in',note:'<img src=x onerror="window.noteExecuted=true">'}];showStockHistory(0)});
  assert.equal(await page.locator('#stockHistoryDetail img').count(),0);assert.equal(await page.evaluate(()=>noteExecuted),false);await page.evaluate(()=>stockDialog.close());
  await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===KEY)throw new DOMException('Test quota','QuotaExceededError');return realSetItem.call(this,k,v)};db.stock[0].qty=81;save()});
  await page.locator('#localSaveRecoveryV1926').waitFor();assert.equal(await page.evaluate(()=>db.stock[0].qty),81);
  await page.evaluate(()=>Storage.prototype.setItem=realSetItem);await page.locator('#localSaveRecoveryV1926 button').last().click();await page.waitForFunction(()=>!document.getElementById('localSaveRecoveryV1926'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).stock[0].qty),81);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // Actual offline reload: local JS/CSS must be served by the current worker.
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof consumeProduction==='function');
  const offline=await page.evaluate(async()=>Promise.all(['/stock-compact-ui.js','/stock-compact-ui.css','/pwa-update.js'].map(async url=>{const r=await fetch(url);return r.ok&&(await r.text()).length>20})));
  assert.deepEqual(offline,[true,true,true]);assert.deepEqual(errors,[]);
  console.log('PASS Chromium: real production button flow, lost-response retry with same id, hostile notes, quota recovery and offline code/CSS reload.');await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
