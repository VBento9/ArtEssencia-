// Isolated component fixture using the exact administrator functions from index.html.
// No Cloud session, external requests, local business data or production writes.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const start=html.indexOf('const DELIVERY_PRICING_FIELDS_V199='),end=html.indexOf('function renderShopDeliverySettings(){',start);
 assert(start>0&&end>start);const code=html.slice(start,end);
 const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const browser=await chromium.launch({headless:true,executablePath:process.env.AE_TEST_CHROMIUM,args:['--no-sandbox','--no-zygote','--single-process']});
 try{const page=await browser.newPage();
  await page.route('**/*',r=>r.abort());
  for(const viewport of [{width:412,height:915},{width:1280,height:800}]){
   await page.setViewportSize(viewport);await page.setContent('<style>'+styles+'</style><main class="delivery-v33" id="fixture" style="padding:12px"></main>');
   await page.addScriptTag({content:code+"\ndocument.getElementById('fixture').innerHTML=deliveryPricingCardV199({localDeliveryEnabled:false});"});
   assert.equal(await page.locator('#setDistanceEnabledV199').isChecked(),false);
   const expected={enabled:false,routeShareCount:3,fixedFeeCents:100,consumptionWhPerKm:163,electricityCentsPerKwh:20,chargingPermille:1100,wearCentsPerKm:10,hourlyCents:800,serviceSeconds:300,roundingStepCents:1,maxRoundTripMetres:100000,maxFeeCents:10000};
   assert.deepEqual(await page.evaluate(()=>readDeliveryPricingV199()),expected);
   await page.locator('#deliveryPricing_electricityCentsPerKwh').fill('0.25');await page.locator('#deliveryPricing_wearCentsPerKm').fill('0.12');await page.locator('label:has(#setDistanceEnabledV199)').click();
   assert.deepEqual(await page.evaluate(()=>readDeliveryPricingV199()),{...expected,enabled:true,electricityCentsPerKwh:25,wearCentsPerKm:12});
   await page.locator('#deliveryPricing_routeShareCount').fill('2');
   assert.equal(await page.evaluate(()=>readDeliveryPricingV199().routeShareCount),2);
   await page.locator('#deliveryPricing_routeShareCount').fill('1.5');
   assert.equal(await page.evaluate(()=>{try{readDeliveryPricingV199();return false}catch{return true}}),true);
   await page.locator('#deliveryPricing_routeShareCount').fill('3');
   await page.locator('#deliveryPricing_hourlyCents').fill('');
   assert.equal(await page.evaluate(()=>{try{readDeliveryPricingV199();return false}catch{return true}}),true);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false);
   console.log('PASS Backoffice pricing fields '+viewport.width+': confirmed defaults, editable prices, activation separate, empty input refused, no horizontal overflow');
   // New document prevents duplicate top-level const declarations on next viewport.
   await page.goto('about:blank');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
