/* ArtEssencia — estado interno de revisão do catálogo (1.9.95).
 * A classificação comercial e a revisão editorial são independentes.
 * Nenhum produto é aprovado automaticamente. Não modifica a publicação pública.
 */
(function(){
'use strict';
var PAGE=12,view='pending',page=0,search='';
var el=id=>document.getElementById(id);
var esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var value=v=>String(v==null?'':v).trim();
var rows=()=>typeof db==='undefined'||!Array.isArray(db.products)?[]:db.products.filter(p=>p&&p.code);
var family=p=>typeof catalogFamilyV191==='function'?catalogFamilyV191(p.catalogGroupV191):null;
function missing(p){
 var lack=[];
 if(!value(p.name))lack.push('Nome');
 if(!value(p.code))lack.push('Código');
 if(!value(p.category))lack.push('Categoria técnica');
 var f=family(p);
 if(!f)lack.push('Família comercial');
 else if(Array.isArray(f.subs)&&f.subs.length&&!f.subs.some(s=>String(s[0])===value(p.catalogSubgroupV191)))lack.push('Subcategoria');
 if(!value(p.shopDescription))lack.push('Descrição pública');
 if(![p.shopImageUrl,p.imageUrl,p.image,p.photo,p.coverImage].some(value)&&!(Array.isArray(p.images)&&p.images.some(v=>value(typeof v==='string'?v:v&&v.url))))lack.push('Fotografia');
 if(p.manufactured===true){
  var recipe=typeof db==='undefined'?null:db.productRecipes&&db.productRecipes[p.code];
  if(!(Array.isArray(recipe)&&recipe.length)&&!(Array.isArray(p.recipe)&&p.recipe.length))lack.push('Composição técnica');
  if(!value(p.productionNotes))lack.push('Instruções de produção');
  if(!value(p.qualityNotes))lack.push('Controlo de qualidade');
 }
 if((p.published===true||p.shopPublished===true)&&!(Number(p.price)>0))lack.push('Preço de venda');
 return lack;
}
function fingerprint(p){
 var recipe=typeof db==='undefined'?null:db.productRecipes&&db.productRecipes[p.code];
 var fields=[p.code,p.name,p.category,p.catalogGroupV191,p.catalogSubgroupV191,p.shopDescription,
  p.shopImageUrl,p.imageUrl,p.image,p.photo,p.coverImage,p.images,p.price,p.published,p.shopPublished,
  p.manufactured,p.productionType,p.productionNotes,p.qualityNotes,p.recipe,recipe,p.publicCharacteristics];
 var s=JSON.stringify(fields),h=2166136261;
 for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(36);
}
function assessment(p){
 var lack=missing(p),prior=p.catalogReviewV1995||{};
 var same=prior.status==='reviewed'&&prior.fingerprint===fingerprint(p);
 return {p:p,lack:lack,kind:lack.length?'pending':same?'reviewed':'ready',
  changed:prior.status==='reviewed'&&!same};
}
function data(){return rows().map(assessment)}
function labelOf(a){return a.kind==='reviewed'?'Revisto':a.kind==='ready'?'Pronto para validar':'Por tratar'}
function render(){
 var root=el('aeReviewWorkflow1995');if(!root)return;
 var all=data(),pending=all.filter(a=>a.kind==='pending').length,ready=all.filter(a=>a.kind==='ready').length,
 reviewed=all.filter(a=>a.kind==='reviewed').length;
 var totals={pending:pending,ready:ready,reviewed:reviewed,all:all.length};
 root.querySelectorAll('[data-review-tab]').forEach(b=>{
  var key=b.dataset.reviewTab;
  b.textContent=({pending:'Por tratar',ready:'Prontos para validar',reviewed:'Revistos',all:'Todos'}[key])+' ('+totals[key]+')';
  b.setAttribute('aria-pressed',String(view===key));
 });
 el('aeReviewCount1995').textContent=reviewed+' de '+all.length+' produtos revistos';
 var percent=all.length?Math.round(reviewed/all.length*100):0;
 el('aeReviewBar1995').style.width=percent+'%';
 el('aeReviewBar1995').setAttribute('aria-valuenow',String(percent));
 var shown=all.filter(a=>(view==='all'||a.kind===view)&&
  [a.p.name,a.p.code,a.p.category,a.p.catalogGroupV191,a.p.catalogSubgroupV191].join(' ').toLocaleLowerCase('pt-PT').includes(search.toLocaleLowerCase('pt-PT')));
 shown.sort((a,b)=>a.p.name.localeCompare(b.p.name,'pt'));
 var totalPages=Math.max(1,Math.ceil(shown.length/PAGE));
 page=Math.min(page,totalPages-1);
 var slice=shown.slice(page*PAGE,(page+1)*PAGE);
 el('aeReviewRows1995').innerHTML=slice.length?slice.map(a=>{
  var p=a.p,category=typeof catalogBreadcrumbV191==='function'?catalogBreadcrumbV191(p):p.catalogGroupV191;
  return '<article class="ae-review-item"><div class="ae-review-item-info"><strong>'+esc(p.name||'Produto sem nome')+'</strong>'+
   '<small>'+esc(p.code)+' · '+esc(p.category||'Sem categoria técnica')+'</small>'+
   '<small>'+esc(category||'Por classificar')+'</small>'+
   '<span class="ae-review-status" data-kind="'+esc(a.kind)+'">'+esc(labelOf(a))+(a.changed?' · Alterado após revisão':'')+'</span>'+
   (a.lack.length?'<div class="ae-review-missing"><b>Falta tratar:</b> '+a.lack.map(esc).join(' · ')+'</div>':'')+'</div>'+
   '<div class="ae-review-item-actions"><button class="btn ghost" type="button" data-review-action="edit" data-code="'+esc(p.code)+'">Editar</button>'+
   (a.kind==='reviewed'?'<button class="btn ghost" type="button" data-review-action="reset" data-code="'+esc(p.code)+'">Reabrir revisão</button>':
   a.kind==='ready'?'<button class="btn primary" type="button" data-review-action="approve" data-code="'+esc(p.code)+'">Confirmar revisão</button>':
   '<button class="btn ghost" type="button" data-review-action="edit" data-code="'+esc(p.code)+'">Completar dados</button>')+
   '</div></article>';
 }).join(''):'<p class="ae-review-empty">Não existem produtos neste estado com esta pesquisa.</p>';
 el('aeReviewPage1995').textContent='Página '+(page+1)+' de '+totalPages+' · '+shown.length+' produto(s)';
 el('aeReviewPrev1995').disabled=page<=0;
 el('aeReviewNext1995').disabled=page>=totalPages-1;
}
function alertUser(message){if(typeof toast==='function')toast(message);else window.alert(message)}
function edit(code){
 var button=el('aeProductsCompact')&&el('aeProductsCompact').querySelectorAll('button')[1];
 if(button)button.click();
 if(typeof editProduct==='function')editProduct(code);
 else alertUser('Abre o editor de Produtos para tratar este produto.');
}
function mark(code,approve){
 var p=rows().find(x=>String(x.code)===code);if(!p)return;
 var status=assessment(p);
 if(approve&&status.lack.length){alertUser('Ainda faltam campos: '+status.lack.join(', '));return}
 if(typeof cloudBusy!=='undefined'&&cloudBusy){alertUser('Sincronização Cloud em curso. Tenta novamente.');return}
 if(!window.confirm(approve?
  'Confirmar a revisão de "'+String(p.name||code)+'"?\n\nEsta operação é interna. Não publica o produto nem altera o preço.':
  'Reabrir a revisão de "'+String(p.name||code)+'"?'))return;
 var previous=p.catalogReviewV1995,previousTime=p.updatedAt;
 var at=new Date().toISOString();
 p.catalogReviewV1995=approve?{status:'reviewed',reviewedAt:at,fingerprint:fingerprint(p)}:{status:'pending',reviewedAt:null,fingerprint:null};
 p.updatedAt=at;
 try{
  if(typeof save!=='function')throw Error('Gravação indisponível');
  var result=save('products');
  if(result&&typeof result.catch==='function')result.catch(e=>alertUser('Erro de gravação: '+String(e.message||e)));
  render();
  alertUser(approve?'Revisão guardada. Confirma a sincronização Cloud.':'Revisão reaberta. Confirma a sincronização Cloud.');
 }catch(e){
  p.catalogReviewV1995=previous;p.updatedAt=previousTime;
  alertUser('Não foi possível guardar a revisão: '+String(e.message||e));
 }
}
function init(){
 var list=el('products')?.querySelector('.products-list-card');
 if(!list||el('aeReviewWorkflow1995'))return;
 var root=document.createElement('section');root.id='aeReviewWorkflow1995';root.className='ae-review-workflow';
 root.innerHTML='<div class="ae-review-head"><div><h3>Revisão do catálogo de produtos</h3><p>Separação interna dos produtos por tratar, prontos para validar e revistos. Não altera a publicação na loja.</p></div><button type="button" class="btn ghost" id="aeReviewRefresh1995">Atualizar</button></div>'+
  '<div class="ae-review-progress"><div class="ae-review-progress-caption" id="aeReviewCount1995"></div><div class="ae-review-track"><span id="aeReviewBar1995" role="progressbar" aria-label="Produtos revistos" aria-valuemin="0" aria-valuemax="100"></span></div></div>'+
  '<div class="ae-review-tabs" aria-label="Filtrar produtos por revisão"><button type="button" data-review-tab="pending"></button><button type="button" data-review-tab="ready"></button><button type="button" data-review-tab="reviewed"></button><button type="button" data-review-tab="all"></button></div>'+
  '<label class="ae-review-search-label">Pesquisar neste estado <input id="aeReviewSearch1995" type="search" placeholder="Nome, código ou categoria"></label>'+
  '<div id="aeReviewRows1995" class="ae-review-rows" aria-live="polite"></div>'+
  '<div class="ae-review-pagination"><button type="button" class="btn ghost" id="aeReviewPrev1995">Anterior</button><span id="aeReviewPage1995"></span><button type="button" class="btn ghost" id="aeReviewNext1995">Seguinte</button></div>'+
  '<p class="ae-review-note">Só é possível confirmar a revisão após preencher os dados indicados. Uma alteração posterior nos dados relevantes faz regressar o produto à validação.</p>';
 list.prepend(root);
 root.querySelectorAll('[data-review-tab]').forEach(b=>b.onclick=()=>{view=b.dataset.reviewTab;page=0;render()});
 el('aeReviewSearch1995').oninput=e=>{search=e.target.value;page=0;render()};
 el('aeReviewPrev1995').onclick=()=>{page=Math.max(0,page-1);render()};
 el('aeReviewNext1995').onclick=()=>{page++;render()};
 el('aeReviewRefresh1995').onclick=render;
 el('aeReviewRows1995').addEventListener('click',e=>{
  var btn=e.target.closest('button[data-review-action]');if(!btn)return;
  var code=btn.dataset.code,action=btn.dataset.reviewAction;
  if(action==='edit')edit(code);
  if(action==='approve')mark(code,true);
  if(action==='reset')mark(code,false);
 });
 var cards=el('productsCards');if(cards){
  var scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render()})}).observe(cards,{childList:true});
 }
 window.addEventListener('focus',render);
 window.addEventListener('pageshow',render);
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();