'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('sale-tablet-ux-v19165.css','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const version=JSON.parse(fs.readFileSync('version.json','utf8'));

test('nova encomenda não exige embalagem global',()=>{
 assert.ok(html.includes('id="saleBox"')&&html.includes('id="saleBoxes"'),'IDs históricos permanecem para compatibilidade');
 assert.match(html,/class="sale-legacy-packaging-v19165" hidden aria-hidden="true"/);
 assert.match(html,/box:boxName,boxCostSnapshot:0,boxes:0,paid,status:'Pedido'/);
 assert.match(html,/const id=await nextManualOrderId\(\),boxName='',clientName=/);
 assert.ok(!html.includes("return toast('Configura pelo menos uma embalagem antes de guardar a encomenda')"));
});
test('custo do produto preservado e legado de embalagem não alterado',()=>{
 assert.match(html,/items:cart\.map\(x=>\(\{\.\.\.ensureLineDetailedCostSnapshotV1769/);
 assert.match(html,/const boxes=Math\.max\(0,Number\(o\?\.boxes\)\|\|0\),boxCost=Math\.max\(0,Number\(o\?\.boxCostSnapshot\)\|\|0\)\*boxes/);
 assert.match(html,/function orderPackagingStockNeedV1757\(o\)/);
 assert.match(html,/const pkg=orderPackagingStockNeedV1757\(o\);if\(pkg\)add\(pkg\.name,pkg\.qty\)/);
});
test('filtros e paginação de 24 artigos mantêm o carrinho',()=>{
 for(const token of ['clearSaleProductFiltersV19165','salePickerLimitV19165=24','salePickerFilterKeyV19165',
  "rows.slice(0,salePickerLimitV19165)","salePickerLimitV19165+=24;renderPicker()",
  'saleProductSearchV1754','saleProductTypeV1754','saleProductTagV1754','saleProductCollectionV1754',
  'id="salePickerMoreV19165"']){
  assert.ok(html.includes(token),token);
 }
 const clear=html.slice(html.indexOf('function clearSaleProductFiltersV19165(){'),html.indexOf('function addProductToCartV1745(',html.indexOf('function clearSaleProductFiltersV19165(){')));
 for(const blocked of ['cart=[]','cart.splice','save()','db.products='])assert.ok(!clear.includes(blocked),blocked);
});
test('estilo da venda limitado ao módulo e com tamanho legível',()=>{
 assert.match(html,/href="\.\/sale-tablet-ux-v19165\.css"/);
 assert.match(css,/#sale \.sale-customer-grid-v1727/);
 assert.match(css,/#sale \.sale-product-picker-v1754/);
 assert.match(css,/font-size:14px!important/);
 assert.match(css,/font-size:12px!important/);
 assert.match(css,/@media \(min-width:701px\) and \(max-width:1199px\)/);
});
test('app, meta, cache e version.json alinhados',()=>{
 const app=version.app;
 assert.match(app,/^\d+\.\d+\.\d+$/);
 assert.equal(html.match(/const APP_VERSION='([\d.]+)'/)?.[1],app);
 assert.equal(html.match(/name="artessencia-version" content="([\d.]+)"/)?.[1],app);
 assert.equal(worker.match(/const CACHE='artessencia-backoffice-([\d.]+)'/)?.[1],app);
});
