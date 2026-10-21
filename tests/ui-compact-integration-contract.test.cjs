const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('os quatro módulos carregam um JS e um CSS, uma única vez',()=>{
 for(const key of ['stock','dashboard','products','orders']){
  for(const extension of ['js','css']){
   const file=key+'-compact-ui.'+extension,esc=file.replace(/\./g,'\\.');
   assert.equal((html.match(new RegExp(esc,'g'))||[]).length,1,file+' ausente ou duplicado');
   assert.equal(fs.existsSync(path.join(root,file)),true,file+' não existe');
  }
 }
});
test('IDs existentes de negócio continuam presentes na interface principal',()=>{
 for(const id of ['stockBody','stockSearch','stockSaveBtnV143','pendingOrders','receivablesBody','quotePipelineBody','dashboardProfitabilityV1769','productsCards','productCancelEditBtnV145','prodTechSheetBtn','productSaveBtnV145','ordersCards','ordersTableWrap','ordersBody','orderDateFromV1882','orderDateToV1882']){
  assert.ok(html.includes('id="'+id+'"'),id+' ausente');
 }
});
test('nenhum componente visual faz gravações no banco de dados',()=>{
 for(const name of ['stock','dashboard','products','orders']){
  const code=fs.readFileSync(path.join(root,name+'-compact-ui.js'),'utf8');
  for(const forbidden of ['supabase','localStorage.setItem','db.orders','db.products','db.stock','fetch('])assert.ok(!code.includes(forbidden),name+': '+forbidden);
 }
});
