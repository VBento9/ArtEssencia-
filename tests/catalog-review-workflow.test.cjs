const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../catalog-review-workflow-v1995.js'),'utf8');
function setup(){
 const window={confirm:()=>true};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const db={products:[],productRecipes:{}};
 let writes=0;
 const ctx={window,document,db,toast(){},save(store){assert.equal(store,'products');writes++},
 catalogFamilyV191(id){return id==='vela'?{id:'vela',subs:[['religiosa','Religiosa']]}:null},
 catalogBreadcrumbV191(p){return p.catalogGroupV191+' > '+p.catalogSubgroupV191}};
 const instrumented=source.replace("if(document.readyState==='loading')",
  "window.__reviewTest={assessment,missing,fingerprint,rows,mark};\nif(document.readyState==='loading')".replace('\\n','\n'));
 assert.notEqual(instrumented,source,'Ponto de instrumentação encontrado');
 // Apenas no ambiente isolado: não existe DOM para desenhar o painel.
 const isolated=instrumented.replace(/  render\(\);\n  alertUser\(approve\?/,
   "  alertUser(approve?");
 vm.runInNewContext(isolated,ctx);
 const p={code:'EX-1',name:'Vela',category:'Vela',catalogGroupV191:'vela',catalogSubgroupV191:'religiosa',
  shopDescription:'Vela artesanal',shopImageUrl:'https://example.invalid/vela.png',
  manufactured:true,productionNotes:'Preparar',qualityNotes:'Conferir',price:12};
 db.products.push(p);db.productRecipes['EX-1']=[{item:'cera',qty:100}];
 return {p,db,window,api:window.__reviewTest,writes:()=>writes};
}
test('o produto completo exige confirmação humana',()=>{
 const {p,api}=setup();assert.equal(api.assessment(p).kind,'ready');
});
test('confirmação regista estado no próprio produto e chama persistência',()=>{
 const {p,api,writes}=setup();api.mark('EX-1',true);
 assert.equal(api.assessment(p).kind,'reviewed');assert.equal(writes(),1);
});
test('alterações posteriores invalidam a revisão, mesmo com campos preenchidos',()=>{
 const {p,api}=setup();api.mark('EX-1',true);
 p.shopDescription='Outro texto';assert.equal(api.assessment(p).kind,'ready');
});
test('falta de família, subcategoria ou receita origina pendência',()=>{
 const {p,db,api}=setup();
 p.catalogGroupV191='';assert.ok(api.missing(p).includes('Família comercial'));
 p.catalogGroupV191='vela';p.catalogSubgroupV191='';
 assert.ok(api.missing(p).includes('Subcategoria'));
 p.catalogSubgroupV191='religiosa';db.productRecipes={};
 assert.ok(api.missing(p).includes('Composição técnica'));
});
test('revisão não altera preço nem estado da publicação',()=>{
 const {p,api}=setup();p.published=false;api.mark('EX-1',true);
 assert.equal(p.published,false);assert.equal(p.price,12);
});
test('interface mantém acesso à listagem antiga e ao editor',()=>{
 assert.match(source,/aeReviewToggle1995/);assert.match(source,/ae-review-focus1995/);
 assert.match(source,/editProduct\(code\)/);
});
