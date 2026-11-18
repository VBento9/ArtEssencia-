// Static contract for cash/purchases responsive layout: no database or production access.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [id,file,table,limit] of [
 ['cash','cash-compact-ui.css','cash-table',1060],
 ['purchases','purchases-compact-ui.css','purchase-table',1220]
]){
 test(id+': apresentação depende da largura útil e preserva os registos',()=>{
  const css=fs.readFileSync(path.join(root,file),'utf8');
  assert.match(css,/container-type:inline-size/);
  assert.ok(css.includes('@container (max-width:'+limit+'px)'));
  assert.match(css,new RegExp('#'+id+'\\.ae-'+(id==='cash'?'cash':'purchases')+'-compact'));
  assert.match(css,new RegExp('\\.'+table+' td::before'));
  assert.match(css,/tr\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(css,/word-break:\s*break-all/);
  assert.match(css,/min-height:44px/);
 });
}
