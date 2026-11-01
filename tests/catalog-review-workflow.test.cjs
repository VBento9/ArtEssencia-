const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../catalog-review-workflow-v1995.js'),'utf8');
function setup(persist=true){
 const window={confirm:()=>true};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const db={products:[],productRecipes:{}};
 let writes=0;
 const ctx={window,document,db,toast(){},save(store){assert.equal(store,'products');writes++;return persist},
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
 assert.match(source,/aeProductsListNav1997/);
 assert.match(source,/aeProductsReviewNav1997/);
 assert.match(source,/Voltar à lista e aos botões/);
 assert.match(source,/setMode\(false\)/);
 assert.doesNotMatch(source,/list\.classList\.add\('ae-review-focus1995'\)/);
});

test('falha de gravação não mantém revisão confirmada em memória',()=>{
 const {p,api,writes}=setup(false);api.mark('EX-1',true);
 assert.equal(api.assessment(p).kind,'ready');assert.equal(writes(),1);
});
test('peças antigas sem flag manufactured exigem ficha de composição',()=>{
 const {p,db,api}=setup();delete p.manufactured;db.productRecipes={};
 assert.ok(api.missing(p).includes('Composição técnica'));
});
test('produto sem código aparece como pendente para regularização',()=>{
 const {db,api}=setup();db.products.push({name:'Antigo sem referência',category:'Vela'});
 assert.equal(api.rows().length,2);
 assert.ok(api.missing(db.products[1]).includes('Código'));
});
test('imagem secundária não substitui a fotografia principal da loja',()=>{
 const {p,api}=setup();p.shopImageUrl='';p.shopImageUrl2='https://example.invalid/other.png';
 assert.ok(api.missing(p).includes('Fotografia principal'));
});
test('sinalizadores Por rever e importação pendente são respeitados',()=>{
 const {p,api}=setup();p.tagsV1753=['Por rever'];p.aprecoNeedsReviewV1753=true;
 assert.ok(api.missing(p).includes('Marcado «Por rever»'));
 assert.ok(api.missing(p).includes('Revisão de importação'));
});

test('clicar no cartão de revisão e Enter abrem editor sem passar pela lista geral',()=>{
 assert.match(source,/ae-review-clickable/);
 assert.match(source,/data-review-code/);
 assert.match(source,/addEventListener\('keydown'/);
 assert.match(source,/edit\(card\.dataset\.reviewCode\)/);
 assert.match(source,/value\(b\.textContent\)==='Abrir editor'/);
});

test('a revisão usa via unitária com proteção contra conflitos remotos',()=>{
 assert.match(source,/async function syncOneReview\(/);
 assert.match(source,/cloudMeta\(\)\.dirty/);
 assert.match(source,/reviewCleanSnapshot\(remote\.data\)!==reviewCleanSnapshot\(p\)/);
 assert.match(source,/eq\('updated_at',remote\.updated_at\)/);
 assert.match(source,/Revisão sincronizada na Cloud para este produto/);
});

test('sincronização unitária não invoca gravação geral de produtos',async()=>{
 const window={confirm:()=>true},document={readyState:'loading',addEventListener(){}};
 const p={_rid:'prod-1',code:'EX-2',name:'Vela',category:'Vela',catalogGroupV191:'vela',
  catalogSubgroupV191:'religiosa',shopDescription:'Descrição',shopImageUrl:'https://example.invalid/photo',
  manufactured:false,price:10};
 let writes=0,updates=0,stored=0;
 const remote=JSON.parse(JSON.stringify(p));
 const chain={select(){return this},eq(){return this},update(row){updates++;this.changed=row;return this},
  maybeSingle(){return Promise.resolve(updates?{data:{id:'prod-1'}}:{data:{id:'prod-1',user_id:'u1',updated_at:'before',data:remote}})}};
 const ctx={window,document,db:{products:[p],productRecipes:{}},navigator:{onLine:true},
  localStorage:{setItem(){stored++}},KEY:'fixture',save(){writes++;return true},
  cloudMeta:()=>({dirty:false,conflict:false}),cloudUser:{id:'u1'},
  cloudClient:{from(table){assert.equal(table,'artessencia_v1_products');return chain}},
  REL_TABLES:{products:'artessencia_v1_products'},toast(){},
  catalogFamilyV191:()=>({subs:[['religiosa','Religiosa']]})};
 const instrumented=source.replace("if(document.readyState==='loading')",
  "window.__reviewTest={mark,assessment};\nif(document.readyState==='loading')");
 const isolated=instrumented.replace(/  render\(\);\n  alertUser\(approve\?/,
  "  alertUser(approve?").replace(/    render\(\);alertUser\('Revisão sincronizada/,
  "    alertUser('Revisão sincronizada");
 vm.runInNewContext(isolated,ctx);
 await window.__reviewTest.mark('EX-2',true);
 assert.equal(updates,1);assert.equal(writes,0);assert.equal(stored,1);
 assert.equal(p.catalogReviewV1995.status,'reviewed');
 assert.equal(window.__reviewTest.assessment(p).kind,'reviewed');
});
