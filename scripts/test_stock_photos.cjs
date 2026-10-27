// Isolated browser regression: no real Cloud requests or production data.
const {chromium}=require('playwright');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:800,height:1100},serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8765'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:8765');
 await page.waitForFunction(()=>typeof loadStock==='function'&&typeof initStockImagePickerV1925==='function');
 assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>APP_VERSION),'1.9.34');
 await page.evaluate(()=>{
  window.photoCalls=[];window.photoFail=false;window.photoDelay=null;
  cloudUser={id:'fixture-owner'};
  // Delayed authentication startup can clear cloudUser; keep the fake session deterministic.
  ensureCloudSession=async()=>({id:'fixture-owner'});
  initCloudClient=()=>({storage:{from:bucket=>({
   upload:async(path,file,options)=>{photoCalls.push({bucket,path,type:file.type,options});if(photoDelay)await photoDelay;return photoFail?{error:new Error('fixture upload failure')}:{error:null}},
   getPublicUrl:path=>({data:{publicUrl:'https://fixture.invalid/storage/v1/object/public/artessencia-shop/'+path}}),
   remove:async()=>{throw new Error('Must preserve previously stored objects')}
  })}});
  // Exercise real addStock and serialization without scheduling cloud synchronization.
  scheduleCloudPushV1860=()=>{};
  window.fixtureOld='https://fixture.invalid/old.png';
  db.stock=[{name:'Fixture wax',qty:1000,unit:'g',min:0,target:null,unitCost:.01,preferredSupplier:'',imageUrl:fixtureOld}];
  go('stock');loadStock(0);
 });
 assert.deepEqual(await page.evaluate(()=>{
  const a=document.getElementById('prodShopImageFile'),b=document.getElementById('stockImageFileV1771');
  return [a.type===b.type,a.accept===b.accept,!b.hasAttribute('capture'),b.multiple===a.multiple];
 }),[true,true,true,true]);
 const photo={name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgAAAAABJRU5ErkJggg==','base64')};
 await page.locator('#stockImageFileV1771').setInputFiles(photo);
 await page.waitForFunction(()=>document.getElementById('stockImagePreviewV1771').src.startsWith('data:image/png'));
 assert.equal(await page.evaluate(()=>document.getElementById('stockImageUrlV1771').value),'https://fixture.invalid/old.png');
 await page.evaluate(()=>addStock());
 assert.equal(await page.evaluate(()=>db.stock[0].imageUrl),'https://fixture.invalid/old.png');
 await page.evaluate(()=>uploadStockImageV1771());
 const uploaded=await page.locator('#stockImageUrlV1771').inputValue();
 assert.match(uploaded,/fixture-owner\/stock\/fixture-wax\/photo-/);
 assert.equal(await page.evaluate(()=>photoCalls[0].bucket),'artessencia-shop');
 await page.evaluate(()=>addStock());
 assert.equal(await page.evaluate(()=>db.stock[0].imageUrl),uploaded);
 await page.evaluate(()=>loadStock(0));
 assert.equal(await page.locator('#stockImageUrlV1771').inputValue(),uploaded);
 await page.evaluate(()=>{removeStockImageV1771();cancelStockEditV145();loadStock(0)});
 assert.equal(await page.locator('#stockImageUrlV1771').inputValue(),uploaded);
 await page.evaluate(()=>{removeStockImageV1771();addStock();loadStock(0)});
 assert.equal(await page.locator('#stockImageUrlV1771').inputValue(),'');
 // Failed replacement retains the saved association.
 await page.evaluate(()=>{db.stock[0].imageUrl=fixtureOld;loadStock(0);photoFail=true});
 await page.locator('#stockImageFileV1771').setInputFiles(photo);
 await page.evaluate(()=>uploadStockImageV1771());
 assert.equal(await page.locator('#stockImageUrlV1771').inputValue(),'https://fixture.invalid/old.png');
 // Late response after changing editor may not attach to another material.
 await page.evaluate(()=>{photoFail=false;photoDelay=new Promise(resolve=>window.releasePhoto=resolve);window.uploadTask=uploadStockImageV1771()});
 await page.waitForFunction(()=>photoCalls.length===3);
 await page.evaluate(()=>{resetStockFormV145(false);releasePhoto();return uploadTask});
 assert.equal(await page.locator('#stockImageUrlV1771').inputValue(),'');
 // Create a new material with its photo.
 await page.evaluate(()=>{photoDelay=null;stockName.value='Fixture new';stockPurchaseQtyV1736.value='1';stockPurchaseTotalV1736.value='10';stockPurchaseUnitV1736.value='kg'});
 await page.locator('#stockImageFileV1771').setInputFiles(photo);
 await page.evaluate(()=>uploadStockImageV1771());
 const createdUrl=await page.locator('#stockImageUrlV1771').inputValue();
 await page.evaluate(()=>addStock());
 assert.equal(await page.evaluate(()=>db.stock.find(x=>x.name==='Fixture new')?.imageUrl),createdUrl);
 // Products default handler remains functional.
 await page.locator('#prodShopImageFile').setInputFiles(photo);
 await page.waitForFunction(()=>document.getElementById('prodShopImagePreview').src.startsWith('data:image/png'));
 for(const width of [800,412]){
  await page.setViewportSize({width,height:1100});
  await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();document.querySelectorAll('.lock-screen,.lock').forEach(x=>x.remove());go('stock');loadStock(0)});
  await page.screenshot({path:'/tmp/stock-photo-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: main script syntax, full app startup, identical Products picker, preview, upload fixture, save/reopen, remove/cancel/save, replacement failure, late upload, new material, Products preview, phone/tablet viewports.');
 await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
