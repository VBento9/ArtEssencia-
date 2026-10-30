/* ArtEssencia — Catálogos & Boxes: navegação e composição não destrutiva.
   Mantém os formulários e dados existentes. Uma box nunca é publicada automaticamente. */
(function(){
'use strict';
const ID='aeBoxesHubV1', $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const text=v=>String(v??'').trim();
const productKey=p=>text(p?.code||p?.id);
const usable=p=>p&&p.active!==false&&!p.archivedV1803;
let selected=[], custom=[], activeTab='ready';
function products(){return (Array.isArray(db?.products)?db.products:[]).filter(p=>usable(p)&&productKey(p)&&text(p.name)).sort((a,b)=>text(a.name).localeCompare(text(b.name),'pt-PT'))}
function match(code){return (db?.products||[]).find(p=>productKey(p)===code)}
function composition(){return selected.map(x=>({code:String(x.code),qty:Math.max(1,Math.min(1000,Number(x.qty)||1))})).filter(x=>match(x.code))}
function selectedTotal(rows,cost=false){return rows.reduce((sum,x)=>{const p=match(x.code);if(!p)return sum;const n=cost?(typeof calculatedProductCost==='function'?Number(calculatedProductCost(p))||0:Number(p.cost)||0):(Number(p.onlinePrice)>0?Number(p.onlinePrice):Number(p.price)||0);return sum+n*x.qty},0)}
function drawPicker(target,rows,editMode){
 const h=$(target);if(!h)return;
 const source=products();
 const selectedCodes=new Set(rows.map(x=>x.code));
 const options=source.filter(p=>!selectedCodes.has(productKey(p))).map(p=>'<option value="'+safe(productKey(p))+'">'+safe(p.name)+' · '+safe(p.category||'Sem categoria')+'</option>').join('');
 const title=editMode?'Produtos que integram esta box':'Artigos escolhidos para a box';
 h.innerHTML='<div class="ae-box-pick-head"><b>'+title+'</b><small>Produtos reais do Backoffice, sem duplicar stock</small></div>'+
 '<div class="ae-box-add"><select id="'+target+'Add" aria-label="Adicionar produto"><option value="">Escolher produto…</option>'+options+'</select><button type="button" class="btn" data-aebox="add" data-target="'+target+'">+ Adicionar</button></div>'+
 '<div class="ae-box-items">'+(rows.length?rows.map((x,i)=>{const p=match(x.code);return '<div class="ae-box-line" data-line="'+i+'"><span><b>'+safe(p?.name||x.code)+'</b><small>'+safe(x.code)+'</small></span><label>Qtd.<input data-aebox-qty="'+i+'" type="number" min="1" max="1000" value="'+x.qty+'"></label><button type="button" class="btn" data-aebox-remove="'+i+'" aria-label="Retirar '+safe(p?.name||x.code)+'">Retirar</button></div>'}).join(''):'<div class="soft-note">Ainda não adicionaste artigos.</div>')+'</div>'+
 '<div class="ae-box-totals"><span>'+rows.reduce((s,r)=>s+r.qty,0)+' peça(s)</span><span>Custo de produtos: '+money(selectedTotal(rows,true))+'</span><span>PVP dos artigos: '+money(selectedTotal(rows,false))+'</span></div>';
}
function previewPredefined(){
 const id=text($('themeBoxId')?.value);
 const existing=(db.themedBoxes||[]).find(x=>x.id===id);
 const base=(db.packaging||[]).find(x=>x.name===$('themeBoxBasePackaging')?.value);
 const packaging=Number(base?.cost)||0,extra=Number($('themeBoxDecorationCost')?.value)||0;
 const price=Number($('themeBoxPrice')?.value)||0;
 const cost=selectedTotal(composition(),true)+packaging+extra;
 const diff=price-cost;
 const info=$('aeBoxEstimateV1');
 if(info)info.innerHTML='<b>Estimativa da Box</b><div>Custo dos produtos: '+money(selectedTotal(composition(),true))+'</div><div>Caixa física e decoração: '+money(packaging+extra)+'</div><div>Preço definido: '+money(price)+'</div><strong>Diferença estimada: '+money(diff)+'</strong><small>Sem prometer disponibilidade, não substitui o custo detalhado de Produção.</small>'+
 (existing?'<small>Esta composição fica associada à Box guardada.</small>':'<small>Guarda a Box para associar a composição.</small>');
}
function loadExisting(b){selected=Array.isArray(b?.items)?b.items.map(x=>({code:text(x.code),qty:Number(x.qty)||1})).filter(x=>x.code):[];drawPicker('aeBoxProductsV1',selected,true);previewPredefined();}
function showTab(tab){
 const hub=$(ID);if(!hub)return;
 const names=['ready','custom','pdf','advanced'];
 activeTab=names.includes(tab)?tab:'ready';
 names.forEach(n=>{
  const panel=$('aeHubPanel_'+n);if(panel)panel.hidden=n!==activeTab;
  const btn=hub.querySelector('[data-ae-tab="'+n+'"]');
  if(btn){btn.classList.toggle('primary',n===activeTab);btn.setAttribute('aria-selected',String(n===activeTab));}
 });
 if(activeTab==='ready'){drawPicker('aeBoxProductsV1',selected,true);previewPredefined();}
 if(activeTab==='ready')reloadPublicBoxesV1();
 if(activeTab==='custom')drawCustom();
}
function phone(){let n=text(db?.settings?.businessPhone).replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);return n.length===9?'351'+n:n;}
function proposal(){
 const title=text($('aeCustomTitleV1')?.value)||'Box personalizada ArtEssencia';
 const notes=text($('aeCustomNotesV1')?.value),dedication=text($('aeCustomNameV1')?.value);
 const box=text($('aeCustomPackagingV1')?.value);
 const lines=custom.map(x=>{const p=match(x.code);return x.qty+' × '+(p?.name||x.code)+' (ref. '+x.code+')'}).join('\n');
 if(!lines)throw new Error('Escolhe pelo menos um produto');
 return ['Olá! Gostaria de pedir informações sobre uma Box ArtEssencia.',title,'',lines,'','Apresentação: '+(box||'Por definir'),
 dedication?'Nome/mensagem: '+dedication:'',
 notes?'Preferências: '+notes:'',
 'Valor de referência dos artigos: '+money(selectedTotal(custom,false)),
 'Preço final, stock e prazo sujeitos a confirmação da ArtEssencia.'].filter(Boolean).join('\n');
}
function customerLink(items){
 const url=new URL('https://catalogo.artessenciatlier.pt/boxes.html');
 items.filter(x=>{const p=match(x.code);return p&&p.shopVisible&&p.publicReleasePendingV1803!==true;}).slice(0,30).forEach(x=>url.searchParams.append('produto',x.code));
 return url.href;
}
function copy(v){
 if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(v).then(()=>toast('Copiado'));
 const node=document.createElement('textarea');node.value=v;node.style.position='fixed';node.style.opacity='0';document.body.append(node);node.select();document.execCommand('copy');node.remove();toast('Copiado');
}
function drawCustom(){
 drawPicker('aeCustomProductsV1',custom,false);
 $('aeCustomTotalV1').textContent='Referência de preço dos artigos: '+money(selectedTotal(custom,false))+' · Sujeito a orçamento final';
}
function renderPredefinedExtras(){
 const editor=document.querySelector('#catalogs .catalog-editor-card');
 if(!editor||$('aeBoxProductsV1'))return;
 const box=document.createElement('div');
 box.innerHTML='<div class="ae-box-composition"><h3>Composição da Box</h3><p class="muted">Escolhe produtos e quantidades. Não cria produtos nem encomendas adicionais.</p><div id="aeBoxProductsV1"></div><div id="aeBoxEstimateV1" class="ae-box-estimate"></div></div>';
 editor.append(box);
 const name=$('themeBoxName');if(name)name.placeholder='Ex.: Box Natal — Doces & Aromas';
 ['themeBoxPrice','themeBoxBasePackaging','themeBoxDecorationCost'].forEach(id=>$(id)?.addEventListener('change',previewPredefined));
 const original=window.editThemedBox;
 if(typeof original==='function')window.editThemedBox=function(id){original(id);const b=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));loadExisting(b);showTab('ready')};
 const clear=window.clearThemedBoxForm;
 if(typeof clear==='function')window.clearThemedBoxForm=function(){clear();selected=[];drawPicker('aeBoxProductsV1',selected,true);previewPredefined()};
 loadExisting(null);
}
function install(){
 const screen=$('catalogs');if(!screen||$(ID))return;
 const dashboard=screen.querySelector('.catalog-dashboard');
 const summary=$('catalogSummary');
 const pdf=screen.querySelector('.catalog-documents-stack-v1731');
 const editor=screen.querySelector('.catalog-editor-card');
 const creator=screen.querySelector('.catalog-creator-card');
 const heading=screen.querySelector('.catalog-saved-head');
 const list=$('themedBoxesGrid');
 if(!dashboard||!summary||!pdf||!editor||!creator||!heading||!list)return;
 const hub=document.createElement('section');hub.id=ID;
 hub.innerHTML='<div class="ae-hub-intro"><div><h2>Boxes ArtEssencia</h2><p>Cria, combina e partilha boxes com artigos reais. Nenhuma alteração publica automaticamente produtos.</p></div></div>'+
 '<div class="ae-hub-tabs" role="tablist" aria-label="Secções de Boxes">'+
 [['ready','Boxes pré-definidas'],['custom','Criar Box personalizada'],['pdf','Catálogos para clientes'],['advanced','Regras e opções']].map(([id,name])=>'<button type="button" role="tab" class="btn" data-ae-tab="'+id+'">'+name+'</button>').join('')+
 '</div>';
 dashboard.insertAdjacentElement('afterend',hub);
 summary.style.marginTop='12px';
 const ready=document.createElement('div');ready.id='aeHubPanel_ready';ready.className='ae-hub-panel';
 ready.innerHTML='<div class="ae-hub-heading"><h3>Boxes pré-definidas</h3><p>Define a composição, embalagem, fotografia e preço. Para apresentar uma Box no Catálogo Digital ou na Loja, cria a respetiva ficha pública em Produtos e publica-a pelo processo habitual.</p><button type="button" class="btn" id="aeNewBoxV1">+ Nova Box</button></div>';
 ready.append(editor,heading,list);
 const customPane=document.createElement('div');customPane.id='aeHubPanel_custom';customPane.className='ae-hub-panel';
 customPane.innerHTML='<div class="ae-hub-heading"><h3>Criar Box personalizada</h3><p>Proposta não vinculativa; artigos e custos vêm dos Produtos. A confirmação de stock, embalagem e prazo é feita pela ArtEssencia.</p></div>'+
 '<div class="ae-custom-grid"><label>Título da Box<input id="aeCustomTitleV1" placeholder="Ex.: Presente especial"></label><label>Embalagem<select id="aeCustomPackagingV1"></select></label><label>Nome / dedicatória<input id="aeCustomNameV1" maxlength="120" placeholder="Opcional"></label><label>Preferências de cor, aroma e observações<textarea id="aeCustomNotesV1" rows="3" maxlength="400"></textarea></label></div>'+
 '<div id="aeCustomProductsV1"></div><p id="aeCustomTotalV1" class="ae-box-estimate"></p><div class="ae-custom-actions">'+
 '<button type="button" class="btn" data-action="copy">Copiar proposta</button><button type="button" class="btn primary" data-action="whatsapp">Enviar por WhatsApp</button><button type="button" class="btn" data-action="client">Copiar ligação para o cliente escolher</button><a class="btn" href="https://catalogo.artessenciatlier.pt/boxes.html" target="_blank" rel="noopener">Abrir configurador do cliente</a></div>';
 const docs=document.createElement('div');docs.id='aeHubPanel_pdf';docs.className='ae-hub-panel';
 docs.innerHTML='<div class="ae-hub-heading"><h3>Catálogos para clientes</h3><p>Escolhe entre produtos gerais e boxes existentes. PDFs são gerados a partir dos dados do Backoffice.</p></div>';
 docs.append(pdf);
 const advanced=document.createElement('div');advanced.id='aeHubPanel_advanced';advanced.className='ae-hub-panel';
 advanced.innerHTML='<div class="ae-hub-heading"><h3>Regras e opções de personalização</h3><p>Opções técnicas do criador atual, preservadas para compatibilidade com a Loja. A ativação não reabre a Loja.</p></div>';
 advanced.append(creator);
 hub.append(ready,customPane,docs,advanced);
 hub.querySelectorAll('[data-ae-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.aeTab)));
 renderPredefinedExtras();
 $('aeNewBoxV1')?.addEventListener('click',()=>{clearThemedBoxForm();showTab('ready');$('themeBoxName')?.focus();});
 const pack=$('aeCustomPackagingV1');
 pack.innerHTML='<option value="">Embalagem a confirmar</option>'+(db.packaging||[]).map(x=>'<option value="'+safe(x.name)+'">'+safe(x.name)+'</option>').join('');
 hub.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  const target=b.dataset.target;
  if(b.dataset.aebox==='add'&&target){
   const s=$(target+'Add');if(!s?.value)return;
   const arr=target==='aeBoxProductsV1'?selected:custom;
   if(arr.some(x=>x.code===s.value))return;
   arr.push({code:s.value,qty:1});
   if(target==='aeBoxProductsV1'){drawPicker(target,arr,true);previewPredefined();}else drawCustom();
   return;
  }
  if(b.dataset.aeboxRemove!==undefined){
   const holder=b.closest('.ae-box-items').parentElement;
   const arr=holder.id==='aeBoxProductsV1'?selected:custom;
   arr.splice(Number(b.dataset.aeboxRemove),1);
   if(holder.id==='aeBoxProductsV1'){drawPicker(holder.id,arr,true);previewPredefined();}else drawCustom();return;
  }
  if(b.dataset.aePublish){
   b.disabled=true;
   aePublishBoxV1(b.dataset.aeBoxid,b.dataset.aePublish)
    .catch(error=>{console.error(error);toast(error.message||'Erro ao atualizar a Box pública')})
    .finally(()=>{b.disabled=false;});
   return;
  }
  if(b.dataset.action){
   try{
    if(b.dataset.action==='copy')copy(proposal());
    if(b.dataset.action==='whatsapp'){const p=phone();if(!p)throw Error('Define o contacto telefónico da ArtEssencia em Definições.');window.open('https://wa.me/'+p+'?text='+encodeURIComponent(proposal()),'_blank','noopener');}
    if(b.dataset.action==='client')copy(customerLink(custom));
   }catch(error){toast(error.message);}
  }
 });
 hub.addEventListener('input',ev=>{
  if(ev.target.dataset.aeboxQty===undefined)return;
  const holder=ev.target.closest('.ae-box-items')?.parentElement;
  const arr=holder?.id==='aeBoxProductsV1'?selected:custom;
  const idx=Number(ev.target.dataset.aeboxQty);if(arr[idx])arr[idx].qty=Math.max(1,Math.min(1000,Number(ev.target.value)||1));
  if(holder?.id==='aeBoxProductsV1')previewPredefined();else $('aeCustomTotalV1').textContent='Referência de preço dos artigos: '+money(selectedTotal(custom,false));
 });
 window.aeBoxItemsDraftV1=()=>composition();
 window.aeBoxesShowTabV1=showTab;
 // A eliminação de uma Box publicada é precedida da retirada segura dos canais públicos.
 const oldDelete=window.deleteThemedBox;
 window.deleteThemedBox=async function(id){
  const box=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));if(!box)return;
  if(!confirm('Apagar a Box "'+box.name+'"? A versão pública será também retirada.'))return;
  try{
   const {c}=await publicClient();
   const {error}=await c.from('artessencia_boxes_public_v1').delete().eq('id',String(id));
   if(error)throw error;
  }catch(error){toast('Não foi possível confirmar a retirada pública. A Box foi preservada.');return;}
  db.themedBoxes=db.themedBoxes.filter(x=>String(x.id)!==String(id));
  save();publicRows.delete(String(id));renderPublicationButtonsV1();toast('Box apagada');
 };
 showTab('ready');
}

let publicRows=new Map();
let publicLoading=false;
async function publicClient(){
 const c=initCloudClient();
 const u=cloudUser||await ensureCloudSession();
 if(!c||!u)throw new Error('Inicia sessão na Cloud para publicar Boxes.');
 return {c,u};
}
async function reloadPublicBoxesV1(){
 if(publicLoading)return;
 publicLoading=true;
 try{
  const {c}=await publicClient();
  const {data,error}=await c.from('artessencia_boxes_public_v1')
     .select('id,visible_catalog,visible_shop,active');
  if(error)throw error;
  publicRows=new Map((data||[]).map(row=>[String(row.id),row]));
  renderPublicationButtonsV1();
 }catch(error){console.warn('Boxes públicas indisponíveis:',error.message);renderPublicationButtonsV1();}
 finally{publicLoading=false;}
}
function renderPublicationButtonsV1(){
 const cards=$('themedBoxesGrid')?.querySelectorAll('.catalog-pro-card')||[];
 (db.themedBoxes||[]).forEach((box,i)=>{
  const card=cards[i];
  const parent=card?.querySelector('.body');
  if(!parent)return;
  let ui=parent.querySelector('.ae-box-publish-v1');
  if(!ui){ui=document.createElement('div');ui.className='ae-box-publish-v1';parent.appendChild(ui);}
  const remote=publicRows.get(String(box.id))||{};
  const inCatalog=remote.active!==false && remote.visible_catalog===true;
  const inShop=remote.active!==false && remote.visible_shop===true;
  ui.innerHTML='<small>Publicação independente: '+(inCatalog?'Catálogo ativo':'Catálogo não publicado')+' · '+(inShop?'Loja ativa':'Loja não publicada')+'</small>'+
   '<div><button type="button" class="btn" data-ae-publish="catalog" data-ae-boxid="'+safe(box.id)+'">'+(inCatalog?'Retirar do Catálogo':'Publicar no Catálogo')+'</button>'+
   '<button type="button" class="btn" data-ae-publish="shop" data-ae-boxid="'+safe(box.id)+'">'+(inShop?'Retirar da Loja':'Publicar na Loja')+'</button>'+
   (inCatalog?'<button type="button" class="btn" data-ae-publish="link" data-ae-boxid="'+safe(box.id)+'">Copiar ligação</button>':'')+
   ((inCatalog||inShop)?'<button type="button" class="btn" data-ae-publish="refresh" data-ae-boxid="'+safe(box.id)+'">Atualizar ficha pública</button>':'')+'</div>';
 });
}
async function uploadBoxImageV1(c,u,box){
 const url=text(box.image);
 if(/^https:\/\//.test(url))return url;
 if(!url.startsWith('data:image/'))throw new Error('Esta Box necessita de uma fotografia válida');
 const data=await fetch(url);
 const blob=await data.blob();
 if(!blob.type.startsWith('image/')||blob.size>5*1024*1024)throw new Error('Fotografia inválida ou demasiado grande');
 const path=u.id+'/boxes/'+String(box.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+Date.now()+'.jpg';
 const uploaded=await c.storage.from('artessencia-shop').upload(path,blob,{cacheControl:'3600',upsert:false,contentType:blob.type||'image/jpeg'});
 if(uploaded.error)throw uploaded.error;
 const p=c.storage.from('artessencia-shop').getPublicUrl(path)?.data?.publicUrl;
 if(!p)throw new Error('A imagem foi carregada, mas a URL pública está indisponível');
 return p;
}
async function aePublishBoxV1(id,channel){
 const box=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));
 if(!box)throw new Error('Box não encontrada');
 if(channel==='link'){
  const address='https://catalogo.artessenciatlier.pt/boxes.html?box='+encodeURIComponent(id);
  await copy(address);return;
 }
 const {c,u}=await publicClient();
 const {data:prev,error:lookupError}=await c.from('artessencia_boxes_public_v1').select('*').eq('id',id).maybeSingle();
 if(lookupError)throw lookupError;
 const refresh=channel==='refresh';
 const field=channel==='catalog'?'visible_catalog':'visible_shop';
 const next=refresh||!(prev?.active!==false&&prev?.[field]===true);
 if(refresh&&!(prev?.visible_catalog||prev?.visible_shop))throw new Error('Esta Box ainda não tem uma publicação a atualizar');
 if(next){
  if(box.active===false)throw new Error('A Box está oculta no Backoffice');
  if(!Array.isArray(box.items)||!box.items.length)throw new Error('Guarda primeiro a composição da Box com os produtos incluídos');
  if(!text(box.name)||!text(box.image))throw new Error('A Box precisa de nome e imagem');
  if(Number(box.price)<=0)throw new Error('Define um PVP válido antes de publicar');
  if(!confirm(refresh?'Atualizar os detalhes públicos da Box "'+box.name+'" nos canais já publicados?':'Publicar "'+box.name+'" em '+(field==='visible_catalog'?'Catálogo Digital':'Loja')+'? O público poderá consultar e pedir informações, mas não efetuar encomendas por este configurador.'))return;
 }else{
  if(!confirm('Retirar "'+box.name+'" de '+(field==='visible_catalog'?'Catálogo Digital':'Loja')+'?'))return;
 }
 let img=prev?.image_url||'';
 if(next)img=await uploadBoxImageV1(c,u,box);
 const base={
  id:String(box.id),title:String(box.name).slice(0,120),
  description:String(box.description||''),image_url:img,
  price:Number(box.price)||0,price_mode:'fixed',capacity:Number(box.capacity)||1,
  items:Array.isArray(box.items)?box.items.map(x=>{
    const p=match(x.code);return {code:String(x.code),name:String(p?.name||x.code),qty:Number(x.qty)||1};
  }):[],
  active:box.active!==false,
  visible_catalog:prev?.visible_catalog===true,
  visible_shop:prev?.visible_shop===true,
  updated_at:new Date().toISOString()
 };
 if(!refresh)base[field]=next;
 const {error}=await c.from('artessencia_boxes_public_v1').upsert(base,{onConflict:'id'});
 if(error)throw error;
 await reloadPublicBoxesV1();
 toast(refresh?'Ficha pública atualizada':(next?'Box publicada com sucesso':'Box retirada do canal selecionado'));
}
window.aeBoxesRenderPublicV1=renderPublicationButtonsV1;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
(()=>{const s=document.createElement('style');s.textContent="#aeBoxesHubV1{margin-top:12px}#aeBoxesHubV1 .ae-hub-intro{padding:16px 18px;background:#fffaf5;border:1px solid #ded2c1;border-radius:16px}#aeBoxesHubV1 h2,#aeBoxesHubV1 h3{font:600 22px Georgia,serif;margin:0 0 6px}#aeBoxesHubV1 h3{font-size:19px}#aeBoxesHubV1 p{line-height:1.55;margin:4px 0 12px}#aeBoxesHubV1 .ae-hub-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#aeBoxesHubV1 .ae-hub-tabs .btn{flex:1 1 170px;min-height:46px}#aeBoxesHubV1 .ae-hub-panel[hidden]{display:none!important}#aeBoxesHubV1 .ae-hub-panel{display:grid;gap:12px}#aeBoxesHubV1 .ae-hub-heading{border:1px solid #ded2c1;border-radius:14px;background:#fff;padding:15px}#aeBoxesHubV1 .ae-hub-heading .btn{margin-top:6px}#aeBoxesHubV1 .ae-hub-heading p{font-size:13px;color:#6d6158}#aeBoxesHubV1 .ae-box-composition{margin-top:14px;padding:14px;border:1px solid #dfd2c6;border-radius:14px;background:#fffaf5}#aeBoxesHubV1 .ae-box-pick-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;margin:10px 0}#aeBoxesHubV1 .ae-box-pick-head small{color:#78695c}#aeBoxesHubV1 .ae-box-add{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#aeBoxesHubV1 .ae-box-add select{min-width:0;flex:1 1 210px}#aeBoxesHubV1 .ae-box-line{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #e5dace}#aeBoxesHubV1 .ae-box-line>span{flex:1;min-width:0;overflow-wrap:anywhere}#aeBoxesHubV1 .ae-box-line small{display:block;color:#86796b}#aeBoxesHubV1 .ae-box-line label{font-size:12px;width:70px}#aeBoxesHubV1 .ae-box-line input{width:100%;min-width:0}#aeBoxesHubV1 .ae-box-totals{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;font-size:12px;font-weight:600}#aeBoxesHubV1 .ae-box-totals span{padding:6px 8px;border:1px solid #dfd2c6;border-radius:9px}#aeBoxesHubV1 .ae-box-estimate{padding:12px;margin-top:10px;background:#f2e9dc;border:1px solid #ddcdb9;border-radius:13px;display:grid;gap:6px;font-size:13px}#aeBoxesHubV1 .ae-box-estimate small{color:#706153}#aeBoxesHubV1 .ae-custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:#fff;padding:14px;border-radius:13px}#aeBoxesHubV1 .ae-custom-grid label{display:grid;gap:6px;font-size:13px}#aeBoxesHubV1 .ae-custom-grid label:last-child{grid-column:1/-1}#aeBoxesHubV1 .ae-custom-grid input,#aeBoxesHubV1 .ae-custom-grid textarea,#aeBoxesHubV1 .ae-custom-grid select{width:100%;min-width:0}#aeBoxesHubV1 .ae-custom-actions{display:flex;flex-wrap:wrap;gap:8px}#aeBoxesHubV1 .ae-custom-actions>*{flex:1 1 170px;display:inline-flex;align-items:center;justify-content:center}#aeBoxesHubV1 .ae-box-items{max-height:470px;overflow:auto}#aeBoxesHubV1 .ae-hub-panel > .catalog-grid{margin:0}#aeBoxesHubV1 .ae-hub-panel .catalog-creator-card{margin:0}@media(max-width:650px){#aeBoxesHubV1 .ae-hub-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#aeBoxesHubV1 .ae-hub-tabs .btn{font-size:12px;min-width:0}#aeBoxesHubV1 .ae-custom-grid{grid-template-columns:minmax(0,1fr)}#aeBoxesHubV1 .ae-box-line{flex-wrap:wrap}#aeBoxesHubV1 .ae-box-line>span{flex:1 1 100%}}";document.head.appendChild(s)})();