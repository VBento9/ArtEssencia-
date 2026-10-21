const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/tests/ui-compact-browser-fixture.html';
for(const viewport of [{width:390,height:844},{width:1024,height:768}]){
 test('Interface compacta '+viewport.width+'px, sem Cloud',async({page})=>{
  await page.setViewportSize(viewport);
  // Este ensaio não comunica com serviços externos nem faz login.
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   return route.abort();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  for(const [section,control] of [
   ['stock','#aeStockCompactControls'],
   ['dashboard','#aeDashCompact'],
   ['products','#aeProductsCompact'],
   ['orders','#aeOrdersCompact']]){
    await expect(page.locator('#'+section+' '+control)).toHaveCount(1);
  }
  await page.locator('#aeProductsCompact button').nth(1).click();
  await expect(page.locator('#products .products-form-card')).not.toHaveAttribute('hidden','');
  await page.locator('#aeProductsCompact button').nth(0).click();
  await expect(page.locator('#products .products-list-card')).not.toHaveAttribute('hidden','');
  await activate('orders');
  await page.locator('#aeOrdersCompact').click();
  await expect(page.locator('#aeOrdersAdvanced')).not.toHaveAttribute('hidden','');
  await activate('dashboard');
  await page.locator('#aeDashCompact button').nth(1).click();
  await expect(page.locator('#dashboard #receivablesBody').locator('xpath=ancestor::div[contains(@class,"tablewrap")]')).not.toHaveAttribute('hidden','');
 });
}
