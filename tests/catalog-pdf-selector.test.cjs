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
  const nodes=new Map();let ready,drawn=[],rpcError=false,rpcCalls=0;
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
    createCatalogPrintCanvas:()=>({getContext:()=>({measureText:t=>({width:String(t).length*9}),fillText:t=>drawn.push(String(t)),fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}),toBlob:cb=>cb({})}),
    jpegBlobsToPDF:async()=>drawn
  };
  vm.createContext(env);vm.runInContext(source,env);ready();
  const panel=nodes.get('aeCatalogPdfV2');
  return {nodes,env,setError:v=>{rpcError=v;},calls:()=>rpcCalls,
    async open(){card.querySelector('.catalog-actions').first.events.click();await new Promise(resolve=>setImmediate(resolve));},
    change(id,value){const n=nodes.get(id);if(typeof value==='boolean')n.checked=value;else n.value=value;panel.events.change({target:n});},
    click(action){panel.events.click({target:{closest:()=>({dataset:{aeAction:action}})}});},
    async pdf(){drawn=[];return env.window.buildMenuPdfBlob();}
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
  app.change('aePdfSource','catalog:guardado');app.change('aePdfCandles',false);text=await app.pdf();assert(text.includes('Vela Natal'));assert(text.includes('Sabonete Natal'));assert(!text.includes('Arranjo Natal'));
  app.change('aePdfCategory','Sabonetes');app.click('replaceFiltered');text=await app.pdf();assert(text.includes('Sabonete Natal'));assert(!text.includes('Vela Natal'));
  app.click('auto');app.change('aePdfSource','collection:Outono');text=await app.pdf();assert(text.includes('Vela Outono'));assert(!text.includes('Vela Natal'));
  app.change('aePdfSource','edition:missing');await assert.rejects(app.pdf(),/não está disponível/);
  app.change('aePdfSource','edition:natal');app.setError(true);await assert.rejects(app.pdf(),/ligação à Cloud/);
  assert(app.calls()>0);assert.equal(JSON.stringify(db),original);
  console.log('PASS: real UI handlers select Natal + candles, saved catalogue and collection; scoped PDF content, publication/archive limits, persistence, replace-filter action, missing/offline failures, no product writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
