const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'),start=html.indexOf('const DELIVERY_PRICING_FIELDS_V199='),end=html.indexOf('function renderShopDeliverySettings(){',start),code=html.slice(start,end),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const browser=await chromium.launch({headless:true,executablePath:process.env.AE_TEST_CHROMIUM,args:['--no-sandbox','--no-zygote','--single-process']});
 try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 for(const width of [412,1280]){
  await page.setViewportSize({width,height:915});await page.setContent('<style>'+styles+'</style><main class="delivery-v33" id="fixture" style="padding:12px"></main>');
  await page.addScriptTag({content:code+`
   window.deliveryZonesV197=[{locality:'Localidade configurada',active:false}];window.calls=[];window.signedIn=true;
   window.initCloudClient=()=>({auth:{getSession:async()=>({data:{session:window.signedIn?{access_token:'isolated-owner-jwt-for-browser-test'}:null}})}});
   window.fetch=async(url,options)=>{window.calls.push({url,body:JSON.parse(options.body)});if(window.delay)await new Promise(r=>window.resolveEstimate=r);return{ok:true,json:async()=>({ok:true,notForCheckout:true,fee_cents:249,roundTripMetres:17423,routeShareCount:window.calls.at(-1).body.pricing.routeShareCount,referencePrecision:'locality',referenceLabel:'Ponto de referência da localidade: Alcaide'})}};
   document.getElementById('fixture').innerHTML=deliveryPricingCardV199({})+deliveryEstimatesCardV1911();renderDeliveryEstimateRowsV1911();bindDeliveryEstimatePricingV1911();`});
  assert.equal(await page.evaluate(()=>window.calls.length),0);
  const row=page.locator('.delivery-estimate-row').filter({has:page.locator('strong',{hasText:/^Alcaide$/})}),button=row.locator('button'),result=row.locator('[role=status]');
  await button.click();await page.waitForFunction(()=>document.querySelector('[data-locality="Alcaide"] .delivery-estimate-result').dataset.calculated==='true');
  assert((await result.textContent()).includes('2,49'));assert((await result.textContent()).includes('estimados'));assert.equal(await page.evaluate(()=>window.calls[0].body.locality),'Alcaide');assert.equal(await page.evaluate(()=>window.calls[0].body.pricing.routeShareCount),3);
  await page.locator('#deliveryPricing_routeShareCount').fill('2');assert((await result.textContent()).includes('recalcular'));
  await page.evaluate(()=>window.delay=true);await button.click();await page.waitForFunction(()=>typeof window.resolveEstimate==='function');await page.locator('#deliveryPricing_hourlyCents').fill('9');await page.evaluate(()=>window.resolveEstimate());await page.waitForFunction(()=>!document.querySelector('[data-locality="Alcaide"] button').disabled);assert((await result.textContent()).includes('recalcular'));
  await page.evaluate(()=>{window.delay=false;window.signedIn=false});const n=await page.evaluate(()=>window.calls.length);await button.click();assert((await result.textContent()).includes('Cloud'));assert.equal(await page.evaluate(()=>window.calls.length),n);
  await page.locator('#deliveryEstimateLocalityV1911').fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Adicionar à simulação'}).click();assert.equal(await page.locator('#deliveryEstimateRowsV1911 img').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  console.log('PASS locality estimates '+width+': owner session, explicit reference, current unsaved costs, stale result refusal, no silent activation or writes, safe locality text, mobile layout');await page.goto('about:blank');
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
