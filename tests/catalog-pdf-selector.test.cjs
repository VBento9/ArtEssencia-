const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('catalog-pdf-manager-v2.js','utf8');
const products=[
  {code:'N1',_rid:'r1',name:'Vela Natal',category:'Velas em molde',shopVisible:true},
  {code:'N2',_rid:'r2',name:'Sabonete Natal',category:'Sabonetes',shopVisible:true},
  {code:'O1',_rid:'r3',name:'Vela Outono',category:'Velas em recipiente',shopVisible:true,collection:'Outono'},
  {code:'N3',_rid:'r4',name:'Vela Natal rascunho',category:'Velas em molde',shopVisible:false},
  {code:'N4',_rid:'r5',name:'Arquivada',category:'Velas em molde',shopVisible:true,archived:true},
  {code:'N5',_rid:'r6',name:'Arranjo Natal',category:'Arranjos florais',productionType:'wax_mold',shopVisible:true}
];
const editions=[{id:'natal',name:'Natal',data:{products:[{id:'r1'},{id:'r2'},{id:'r4'},{id:'r5'},{id:'r6'}]}},{id:'outono',name:'Outono',data:{products:['r3']}}];
const db={products};const original=JSON.stringify(db);
let stored=JSON.stringify({scope:'published',selected:null,images:false});
function setup(){
  const nodes=new Map();let ready,drawn=[],placements=[],fills=[],pagesMade=0,rpcError=false,rpcCalls=0;
  class Node{
    constructor(){this.events={};this.dataset={};this.value='';this.hidden=false;this.options=[];}
    set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
    set innerHTML(v){this.markup=v;this.options=[...v.matchAll(/<option value="([^"]*)"/g)].map(m=>({value:m[1]}));for(const m of v.matchAll(/id="([^"]+)"/g))if(!nodes.has(m[1])){const n=new Node();n.id=m[1];}}
    get innerHTML(){return this.markup||'';}
    setAttribute(){}addEventListener(k,fn){this.events[k]=fn;}appendChild(){}prepend(n){this.first=n;}after(){}
    querySelector(key){if(!this.children)this.children={};return this.children[key]||(this.children[key]=new Node());}
    matches(){return false;}
  }
  const card=new Node();card.textContent='Produtos ArtEssencia';
  const env={db,window:{},specialEditionsAdmin:[],cloudUser:{id:'test'},console,setTimeout,clearTimeout,
    visualCatalogsDataV192:()=>[{id:'guardado',title:'Natal escolhido',productIds:['N1','N2']}],
    visualCollectionsV192:p=>[p.collection].filter(Boolean),productUsableV1803:p=>!p.archived,
    initCloudClient:()=>({rpc:async name=>{rpcCalls++;assert.equal(name,'artessencia_list_shop_special_editions_admin_v1');return rpcError?{error:new Error('offline')}:{data:editions};}}),
    localStorage:{getItem:()=>stored,setItem:(k,v)=>{assert.equal(k,'artessencia.catalog.pdf.prefs.v2');stored=v;}},toast:()=>{},
    document:{readyState:'loading',getElementById:id=>nodes.get(id),querySelectorAll:()=>[card],createElement:()=>new Node(),head:new Node(),addEventListener:(event,fn)=>{ready=fn;}},
    drawArtEssenciaHeader:async(ctx,t,subtitle)=>{drawn.push(subtitle);},drawCatalogFooter:()=>{},
    createCatalogPrintCanvas:()=>{pagesMade++;return {getContext:()=>({measureText:t=>({width:String(t).length*9}),fillText:(t,x,y)=>{drawn.push(String(t));placements.push({text:String(t),x,y,page:pagesMade});},fillRect(x,y,w,h){fills.push({x,y,w,h,page:pagesMade,color:this.fillStyle});},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}),toBlob:cb=>cb({})};},
    jpegBlobsToPDF:async()=>drawn
  };
  vm.createContext(env);vm.runInContext(source,env);ready();
  const panel=nodes.get('aeCatalogPdfV2');
  return {nodes,env,setError:v=>{rpcError=v;},calls:()=>rpcCalls,
    async open(){card.querySelector('.catalog-actions').first.events.click();await new Promise(resolve=>setImmediate(resolve));},
    change(id,value){const n=nodes.get(id);if(typeof value==='boolean')n.checked=value;else n.value=value;panel.events.change({target:n});},
    click(action){panel.events.click({target:{closest:()=>({dataset:{aeAction:action}})}});},
    placements:()=>placements.slice(),fills:()=>fills.slice(),pageCount:()=>pagesMade,
    async pdf(){drawn=[];placements=[];fills=[];pagesMade=0;return env.window.buildMenuPdfBlob();}
  };
}
(async()=>{
  let app=setup();await app.open();
  assert(app.nodes.get('aePdfSource').innerHTML.includes('Natal'));
  app.change('aePdfSource','edition:natal');app.change('aePdfCandles',true);
  let text=await app.pdf();assert(text.includes('Vela Natal'));assert(text.includes('Arranjo Natal'));
  for(const name of ['Sabonete Natal','Vela Outono','Vela Natal rascunho','Arquivada'])assert(!text.includes(name),name);
  assert.match(app.nodes.get('aePdfSummary').textContent,/Natal · Só velas — 2 produto/);
  app=setup();await app.open();text=await app.pdf();assert(text.includes('Vela Natal'));assert(!text.includes('Vela Outono'));
  app.change('aePdfScope','all');app.change('aePdfSource','edition:natal');text=await app.pdf();assert(text.includes('Vela Natal rascunho'));assert(!text.includes('Arquivada'));
  // Products in one category appear on the same A4 row, in two independent columns.
  let grid=app.placements();
  const first=grid.find(x=>x.text==='Vela Natal'),second=grid.find(x=>x.text==='Vela Natal rascunho');
  assert(first&&second,'Both product names must be rendered');
  assert.equal(first.page,second.page);assert.equal(first.y,second.y);
  assert(second.x>first.x+500,'Second product must occupy a distinct right-hand column');
  app.change('aePdfImages',true);text=await app.pdf();
  grid=app.placements();
  assert(grid.some(x=>x.text==='Vela Natal'));
  assert(grid.every(x=>!Number.isFinite(x.y)||x.y<=1709),'No rendered text below the printed footer');
  app.change('aePdfSource','catalog:guardado');app.change('aePdfCandles',false);text=await app.pdf();assert(text.includes('Vela Natal'));assert(text.includes('Sabonete Natal'));assert(!text.includes('Arranjo Natal'));
  app.change('aePdfCategory','Sabonetes');app.click('replaceFiltered');text=await app.pdf();assert(text.includes('Sabonete Natal'));assert(!text.includes('Vela Natal'));
  app.click('auto');app.change('aePdfSource','collection:Outono');text=await app.pdf();assert(text.includes('Vela Outono'));assert(!text.includes('Vela Natal'));
  app.change('aePdfSource','edition:missing');await assert.rejects(app.pdf(),/não está disponível/);
  app.change('aePdfSource','edition:natal');app.setError(true);await assert.rejects(app.pdf(),/ligação à Cloud/);
  assert(app.calls()>0);assert.equal(JSON.stringify(db),original);
  // A long catalogue must paginate with section headings; never render outside the A4 content area.
  const originalLength=products.length;
  const generated=Array.from({length:29},(_,i)=>({
    code:'GRID-'+String(i+1).padStart(2,'0'),name:'Produto Coluna '+String(i+1).padStart(2,'0'),
    category:'Velas em molde',shopVisible:true,price:5
  }));
  products.push(...generated);
  const lastPreferences=stored;
  stored=JSON.stringify({scope:'published',selected:null,images:true,source:'',candles:false});
  const many=setup();await many.open();await many.pdf();
  assert(many.pageCount()>=2,'Large customer catalogues must paginate');
  assert.equal(many.fills().filter(e=>e.x===0&&e.y===188&&e.w===1240&&e.h===1450&&e.color==='#e9d6b8').length,many.pageCount(),
    'Every A4 page must include the kraft editorial sheet');
  assert.equal(many.fills().filter(e=>e.x===0&&e.y===1570&&e.w===1240&&e.h===184&&e.color==='#e9d6b8').length,many.pageCount(),
    'Every page must have a reserved kraft footer');
  const positions=many.placements();
  const columns=positions.filter(x=>x.text.startsWith('Produto Coluna '));
  assert.equal(columns.length,generated.length);
  assert(columns.every(x=>x.x>=80&&x.x<=1160&&x.y<1570));
  assert(columns.some((x,i)=>columns.some((other,j)=>i!==j&&other.page===x.page&&other.y===x.y&&Math.abs(other.x-x.x)>500)),
    'Product cards must share rows in two columns');
  products.splice(originalLength);stored=lastPreferences;
  assert.equal(JSON.stringify(db),original);
  console.log('PASS: real UI handlers select Natal + candles, saved catalogue and collection; scoped PDF content, publication/archive limits, persistence, replace-filter action, missing/offline failures, no product writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
