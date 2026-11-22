/* ArtEssencia — resumo editorial de canais (fase 1, somente leitura).
 * Usa dados locais já carregados; nunca confirma publicação pública real.
 */
(function(root){
'use strict';
const trim=v=>String(v==null?'':v).trim();
function auditProducts(products,reviewer){
 const rows=(Array.isArray(products)?products:[]).filter(p=>p&&typeof p==='object'&&p.deleted!==true&&!p.deletedAt&&p.isDeleted!==true);
 const seen=new Map();
 rows.forEach(p=>{const code=trim(p.code);if(code)seen.set(code,(seen.get(code)||0)+1)});
 const records=rows.map(p=>{
  const issues=[];
  if(!trim(p.name))issues.push('Nome');
  if(!trim(p.code))issues.push('Código');
  if(trim(p.code)&&seen.get(trim(p.code))>1)issues.push('Código duplicado');
  if(!trim(p.category))issues.push('Categoria técnica');
  if(!trim(p.catalogGroupV191))issues.push('Família comercial');
  if(!trim(p.shopDescription))issues.push('Descrição pública');
  if(!trim(p.shopImageUrl))issues.push('Fotografia principal');
  const catalogMarked=p.published===true;
  const shopMarked=p.shopVisible===true||p.shopPublished===true;
  if(shopMarked&&!['from','quote'].includes(trim(p.publicPriceMode))&&!(Number(p.onlinePrice)>0||Number(p.price)>0))issues.push('Preço de venda');
  let review='unknown';
  if(typeof reviewer==='function'){
   try{const result=reviewer(p);review=['reviewed','ready','pending'].includes(result?.kind)?result.kind:'unknown'}
   catch(_){review='unknown'}
  }
  return {product:p,code:trim(p.code),name:trim(p.name)||'Sem nome',issues,review,catalogMarked,shopMarked,
   ready:issues.length===0&&review==='reviewed'};
 });
 return {records,summary:{
  total:records.length,needsAttention:records.filter(x=>!x.ready).length,
  ready:records.filter(x=>x.ready).length,missingPhoto:records.filter(x=>x.issues.includes('Fotografia principal')).length,
  markedCatalog:records.filter(x=>x.catalogMarked).length,markedShop:records.filter(x=>x.shopMarked).length,
  reviewUnknown:records.filter(x=>x.review==='unknown').length
 }};
}
if(typeof module==='object'&&module.exports)module.exports={auditProducts};
if(typeof document==='undefined')return;
const escapeHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const E=id=>document.getElementById(id);
const PAGE=12;
let filter='attention',query='',page=0;
function openReview(code){
 const nav=E('aeProductsReviewNav1997');
 if(!nav)return;
 nav.click();
 const all=document.querySelector('[data-review-tab="all"]');
 if(all)all.click();
 const search=E('aeReviewSearch1995');
 if(search){search.value=code||'';search.dispatchEvent(new Event('input',{bubbles:true}))}
 E('aeReviewWorkflow1995')?.scrollIntoView?.({block:'start',behavior:'auto'});
}
function install(){
 if(E('aePublicationOverviewV1'))return;
 const products=E('products'),list=products?.querySelector('.products-list-card');
 if(!list)return;
 const section=document.createElement('section');
 section.id='aePublicationOverviewV1';
 section.className='ae-publication-overview-v1';
 section.innerHTML='<div class="ae-publication-head-v1"><div><h3>Centro de Publicação · diagnóstico</h3><p>Consulta editorial de produtos e sinalizações por canal. Não publica, não altera produtos e não confirma visibilidade pública.</p></div><button type="button" class="btn ghost" id="aePublicationRefreshV1">Atualizar</button></div>'+
 '<div id="aePublicationMetricsV1" class="ae-publication-metrics-v1"></div>'+
 '<div class="ae-publication-tools-v1"><label>Filtrar <select id="aePublicationFilterV1"><option value="attention">A exigir atenção</option><option value="ready">Revistos e completos</option><option value="catalog">Sinalizados para Catálogo</option><option value="shop">Sinalizados para Loja</option><option value="all">Todos</option></select></label><label>Pesquisar <input type="search" id="aePublicationSearchV1" placeholder="Nome ou código"></label></div>'+
 '<div id="aePublicationResultsV1" class="ae-publication-results-v1" aria-live="polite"></div>'+
 '<div class="ae-publication-paging-v1"><button class="btn ghost" type="button" id="aePublicationPrevV1">Anterior</button><span id="aePublicationPageV1"></span><button class="btn ghost" type="button" id="aePublicationNextV1">Seguinte</button></div>'+
 '<p class="ae-publication-disclaimer-v1">Os estados referem-se aos dados disponíveis neste dispositivo. “Sinalizado” não significa “publicado”. A confirmação da publicação exige consulta ao canal público e sincronização Cloud estável. A Loja continua com checkout fechado.</p>';
 const nav=E('aeProductsViews1997');
 if(nav)nav.insertAdjacentElement('afterend',section);
 else list.parentNode.insertBefore(section,list);
 E('aePublicationRefreshV1').addEventListener('click',render);
 E('aePublicationFilterV1').addEventListener('change',e=>{filter=e.target.value;page=0;render()});
 E('aePublicationSearchV1').addEventListener('input',e=>{query=e.target.value;page=0;render()});
 E('aePublicationPrevV1').addEventListener('click',()=>{page=Math.max(0,page-1);render()});
 E('aePublicationNextV1').addEventListener('click',()=>{page++;render()});
 E('aePublicationResultsV1').addEventListener('click',e=>{
  const btn=e.target.closest('[data-ae-publication-review]');
  if(btn)openReview(btn.dataset.aePublicationReview);
 });
 window.addEventListener('focus',render);
 window.addEventListener('pageshow',render);
 render();
}
function render(){
 if(!E('aePublicationOverviewV1'))return;
 const reviewer=typeof root.aeCatalogReviewAssessmentV1995==='function'?root.aeCatalogReviewAssessmentV1995:null;
 const all=auditProducts(typeof db==='undefined'?[]:db.products,reviewer);
 const s=all.summary;
 const cells=[['Produtos no dispositivo',s.total],['A exigir atenção',s.needsAttention],
  ['Revistos e completos',s.ready],['Sem fotografia principal',s.missingPhoto],
  ['Sinalizados para Catálogo',s.markedCatalog],['Sinalizados para Loja',s.markedShop]];
 E('aePublicationMetricsV1').innerHTML=cells.map(([name,count])=>'<div class="ae-publication-metric-v1"><strong>'+count+'</strong><small>'+escapeHtml(name)+'</small></div>').join('');
 const terms=query.toLocaleLowerCase('pt-PT').trim();
 const filtered=all.records.filter(x=>{
  if(filter==='attention'&&x.ready)return false;
  if(filter==='ready'&&!x.ready)return false;
  if(filter==='catalog'&&!x.catalogMarked)return false;
  if(filter==='shop'&&!x.shopMarked)return false;
  return !terms||[x.name,x.code,x.product.category,x.product.catalogGroupV191].join(' ').toLocaleLowerCase('pt-PT').includes(terms);
 }).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const lastPage=Math.max(0,Math.ceil(filtered.length/PAGE)-1);
 page=Math.min(page,lastPage);
 const visible=filtered.slice(page*PAGE,(page+1)*PAGE);
 E('aePublicationResultsV1').innerHTML=visible.length?visible.map(x=>{
  const reason=x.issues.length?'Em falta: '+x.issues.join(' · '):x.review==='reviewed'?'Revisão editorial atual':'Revisão editorial por confirmar';
  const signal=[x.catalogMarked?'Catálogo assinalado':'',x.shopMarked?'Loja assinalada':''].filter(Boolean).join(' · ');
  const safeCode=escapeHtml(x.code);
  return '<article class="ae-publication-row-v1"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+safeCode+(signal?' · '+escapeHtml(signal):'')+'</small><p>'+escapeHtml(reason)+'</p></div>'+
    (x.code?'<button class="btn ghost" type="button" data-ae-publication-review="'+safeCode+'">Ver na revisão</button>':'')+'</article>';
 }).join(''):'<p class="ae-publication-empty-v1">Sem produtos neste filtro.</p>';
 E('aePublicationPageV1').textContent='Página '+(page+1)+' de '+(lastPage+1)+' · '+filtered.length+' produtos';
 E('aePublicationPrevV1').disabled=page===0;
 E('aePublicationNextV1').disabled=page>=lastPage;
}
const css=document.createElement('link');css.rel='stylesheet';css.href='/catalog-publication-overview-v1.css';document.head.appendChild(css);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof window!=='undefined'?window:globalThis);
