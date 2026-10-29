// PDF/print regression for the isolated read-only technical sheet; no Cloud or real data.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('product-technical-sheet.js','utf8');
new vm.Script(source,{filename:'product-technical-sheet.js'});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:760,height:900}});
  await context.addInitScript(()=>{window.print=()=>{window.__printRequested=true}});
  const page=await context.newPage();
  await page.setContent('<!doctype html><html lang="pt-PT"><body><main>Ficha técnica · teste isolado</main></body></html>');
  await page.evaluate(()=>{
   const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgAAAAABJRU5ErkJggg==';
   const product={code:'AE-TESTE-001',name:'Vela artesanal de amostra com um título comprido',
    category:'Velas em recipiente',price:19.9,shopImageUrl:image,laborMinutes:30,
    productionType:'wax_container',cureHours:48,productionNotes:'Aguardar a cura antes de testar a queima.',
    qualityNotes:'Verificar superfície, pavio e acabamento.',
    publicCharacteristics:{waxType:'Cera vegetal',approximateWeight:'180 g',dimensions:'7 × 8 cm',burnTime:'25 h'}};
   const recipe=Array.from({length:90},(_,i)=>({item:'Componente de teste '+String(i+1).padStart(3,'0'),qty:i+0.25}));
   window.db={products:[product],productRecipes:{[product.code]:recipe},
    stock:recipe.map(x=>({name:x.item,unit:'g',unitCost:0.007}))};
   window.productCostBreakdownV110=()=>({materials:3.5,labor:4,fixed:1.5,other:0.75,total:9.75});
   window.productProductionTypeV130=p=>p.productionType;
   window.productionTypeLabelV130=()=> 'Vela em recipiente';
  });
  await page.addScriptTag({path:'product-technical-sheet.js'});
  const before=await page.evaluate(()=>JSON.stringify(db));
  await page.evaluate(()=>openProductTechnicalSheetV1936('AE-TESTE-001'));
  const dialog=page.locator('#ae-product-sheet');
  await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('.ts-table tbody tr').count(),90);
  async function checkPrint(button,size,expectedCost){
   const opened=context.waitForEvent('page');
   await dialog.getByRole('button',{name:button}).click();
   const popup=await opened;
   await popup.waitForFunction(()=>document.title.includes('ArtEssencia_FichaTecnica_')&&!!document.querySelector('.ts-table tbody tr'));
   const content=await popup.locator('body').innerText();
   const css=await popup.locator('style').innerText();
   assert.match(content,/Composição por unidade/i);
   assert.equal(content.includes('Custos e rentabilidade'),expectedCost);
   assert.equal(content.includes('Margem estimada'),expectedCost);
   assert.equal(await popup.locator('.ts-table th').count(),expectedCost?3:2);
   assert.match(css,new RegExp('size:'+size+' portrait'));
   assert.match(css,/counter\(pages\)/);
   assert.match(css,/table-header-group/);
   const pdf=await popup.pdf({preferCSSPageSize:true,printBackground:true});
   assert.equal(pdf.subarray(0,4).toString(),'%PDF');
   assert(pdf.length>4000);
   const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
   assert(pages>=2,'A long technical sheet should span multiple PDF pages');
   await popup.close();
   return pages;
  }
  const a5=await checkPrint('Imprimir A5','A5',false);
  const a4=await checkPrint('Imprimir A4 / PDF','A4',true);
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),before);
  console.log('PASS: valid script, read-only sheet, real Chromium PDFs A5/A4, no costs in A5, A4 costs, 90-line pagination, print margins and repeated table headers; pages='+a5+'/'+a4);
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
