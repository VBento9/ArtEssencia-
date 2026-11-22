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
  // shopVisible é a intenção interna atualmente existente. O feed público
  // é comum ao Catálogo e à Loja; não existe marcação independente "published".
  const publicIntent=typeof p.shopVisible==='boolean'?p.shopVisible:null;
  if(publicIntent===true&&!['from','quote'].includes(trim(p.publicPriceMode))&&!(Number(p.onlinePrice)>0||Number(p.price)>0))issues.push('Preço de venda');
  let review='unknown';
  if(typeof reviewer==='function'){
   try{const result=reviewer(p);review=['reviewed','ready','pending'].includes(result?.kind)?result.kind:'unknown'}
   catch(_){review='unknown'}
  }
  return {product:p,code:trim(p.code),name:trim(p.name)||'Sem nome',issues,review,publicIntent,
   ready:issues.length===0&&review==='reviewed'};
 });
 return {records,summary:{
  total:records.length,needsAttention:records.filter(x=>!x.ready).length,
  ready:records.filter(x=>x.ready).length,missingPhoto:records.filter(x=>x.issues.includes('Fotografia principal')).length,
  markedPublic:records.filter(x=>x.publicIntent===true).length,
  unknownPublicIntent:records.filter(x=>x.publicIntent===null).length,
  reviewUnknown:records.filter(x=>x.review==='unknown').length
 }};
}
function comparePublicFeed(localProducts,feedProducts){
 const local=auditProducts(localProducts).records;
 if(!Array.isArray(feedProducts))return {status:'unavailable',rows:[],feedCount:0};
 if(feedProducts.length===0)return {status:'empty',rows:[],feedCount:0};
 const remote=feedProducts.filter(p=>p&&typeof p==='object');
 const localCodeCounts=new Map(),remoteCodeCounts=new Map();
 const localIds=new Set();
 for(const row of local){
  if(row.code)localCodeCounts.set(row.code,(localCodeCounts.get(row.code)||0)+1);
  const id=trim(row.product._rid||row.product.id||row.product.product_id);
  if(id)localIds.add(id);
 }
 for(const item of remote){
  const code=trim(item.code);
  if(code)remoteCodeCounts.set(code,(remoteCodeCounts.get(code)||0)+1);
 }
 const rows=local.map(row=>{
  const id=trim(row.product._rid||row.product.id||row.product.product_id);
  const exact=id?remote.filter(item=>trim(item.backoffice_product_id)===id):[];
  let status='absent';
  if(exact.length>1)status='ambiguous';
  else if(exact.length===1)status='present';
  else if(row.code){
   const candidates=remote.filter(item=>trim(item.code)===row.code);
   if(localCodeCounts.get(row.code)>1||remoteCodeCounts.get(row.code)>1)status='ambiguous';
   else if(candidates.length===1)status='code_only';
  }else if(!id)status='unmatched';
  return {code:row.code,name:row.name,marked:row.publicIntent,status};
 });
 // Produtos remotos sem ligação ao conjunto carregado: apenas diagnóstico,
 // nunca retirar/editar os registos a partir deste painel.
 const unlinkedRemote=remote.filter(item=>{
  const origin=trim(item.backoffice_product_id);
  return !origin||!localIds.has(origin);
 }).map(item=>({
  code:trim(item.code),name:trim(item.name)||'Sem nome',
  reason:trim(item.backoffice_product_id)?'Origem não encontrada no dispositivo':'Sem identificador de origem'
 }));
 const present=rows.filter(r=>r.status==='present').length;
 return {status:'ok',rows,feedCount:remote.length,present,unlinkedRemote,
  missingMarked:rows.filter(r=>r.marked===true&&r.status==='absent').length,
  unexpectedPresent:rows.filter(r=>r.marked===false&&r.status==='present').length,
  uncertain:rows.filter(r=>['ambiguous','unmatched','code_only'].includes(r.status)).length,
  withoutOrigin:remote.filter(r=>!trim(r.backoffice_product_id)).length,
  originNotInDevice:remote.filter(r=>trim(r.backoffice_product_id)&&!localIds.has(trim(r.backoffice_product_id))).length
 };
}
if(typeof module==='object'&&module.exports)module.exports={auditProducts,comparePublicFeed};
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
 section.innerHTML='<div class="ae-publication-head-v1"><div><h3>Centro de Publicação · diagnóstico</h3><p>Consulta editorial e intenção de presença pública. O feed é partilhado pelo Catálogo e pela Loja. Não publica nem altera produtos.</p></div><button type="button" class="btn ghost" id="aePublicationRefreshV1">Atualizar</button></div>'+
 '<div id="aePublicationMetricsV1" class="ae-publication-metrics-v1"></div>'+
 '<section class="ae-publication-public-v1" id="aePublicationPublicV1"><div class="ae-publication-public-head-v1"><div><h4>Verificação do feed público</h4><p>Consulta a Cloud sem alterar produtos. Estar no feed não garante visibilidade no canal.</p></div><button type="button" class="btn ghost" id="aePublicationCheckV1">Consultar</button></div><div id="aePublicationPublicResultV1" role="status" aria-live="polite">Ainda não consultado.</div></section>'+
 '<div class="ae-publication-tools-v1"><label>Filtrar <select id="aePublicationFilterV1"><option value="attention">A exigir atenção</option><option value="ready">Revistos e completos</option><option value="marked">Assinalados para publicação</option><option value="unmarked">Sem marcação pública</option><option value="all">Todos</option></select></label><label>Pesquisar <input type="search" id="aePublicationSearchV1" placeholder="Nome ou código"></label></div>'+
 '<div id="aePublicationResultsV1" class="ae-publication-results-v1" aria-live="polite"></div>'+
 '<div class="ae-publication-paging-v1"><button class="btn ghost" type="button" id="aePublicationPrevV1">Anterior</button><span id="aePublicationPageV1"></span><button class="btn ghost" type="button" id="aePublicationNextV1">Seguinte</button></div>'+
 '<p class="ae-publication-disclaimer-v1">Os estados referem-se a este dispositivo. A marcação shopVisible não confirma presença no feed. Os dois canais usam o mesmo feed e aplicam regras de visibilidade próprias. O checkout da Loja permanece fechado.</p>';
 // A vista compacta gere visibilidade apenas de .products-list-card e do editor.
 // O painel tem de estar DENTRO da lista, não entre a navegação e a lista.
 // Na vista de revisão, a regra .ae-review-focus1995 mostra apenas o módulo editorial.
 list.prepend(section);
 E('aePublicationRefreshV1').addEventListener('click',render);
 E('aePublicationCheckV1').addEventListener('click',checkPublicFeed);
 E('aePublicationFilterV1').addEventListener('change',e=>{filter=e.target.value;page=0;render()});
 E('aePublicationSearchV1').addEventListener('input',e=>{query=e.target.value;page=0;render()});
 E('aePublicationPrevV1').addEventListener('click',()=>{page=Math.max(0,page-1);render()});
 E('aePublicationNextV1').addEventListener('click',()=>{page++;render()});
 E('aePublicationResultsV1').addEventListener('click',e=>{
  const btn=e.target.closest('[data-ae-publication-review]');
  if(btn)openReview(btn.dataset.aePublicationReview);
 });
 // A edição/Cloud pode refrescar os cartões sem focar novamente a janela.
 // Recalcular somente a apresentação, sem alterar db nem criar escrita Cloud.
 const cards=E('productsCards');
 if(cards){
  let scheduled=false;
  new MutationObserver(()=>{
   if(scheduled)return;
   scheduled=true;
   queueMicrotask(()=>{scheduled=false;render()});
  }).observe(cards,{childList:true});
 }
 window.addEventListener('focus',render);
 window.addEventListener('pageshow',render);
 render();
}

function publicationAccessAllowed(){
 const gate=E('authGateV1880'),lock=E('lockScreen');
 const app=document.querySelector('.app');
 return !(gate&&!gate.classList.contains('hidden'))&&
  !(lock&&!lock.classList.contains('hidden'))&&
  !(app&&app.inert);
}
async function checkPublicFeed(){
 const button=E('aePublicationCheckV1'),host=E('aePublicationPublicResultV1');
 if(!button||!host)return;
 if(!publicationAccessAllowed()){
  host.textContent='Desbloqueia o Backoffice antes de consultar os canais públicos.';
  return;
 }
 button.disabled=true;
 host.textContent='A validar a sessão Cloud e a consultar dados públicos…';
 try{
  // Nunca usar cloudUser em cache para autorizar a consulta. A identidade é
  // confirmada pelo Auth e não por uma propriedade local ou código de acesso.
  if(typeof ensureCloudSession!=='function')throw Error('Validação de sessão Cloud indisponível');
  const user=await ensureCloudSession();
  if(!publicationAccessAllowed())throw Error('Consulta interrompida: Backoffice bloqueado');
  if(!user?.id)throw Error('Inicia sessão na ArtEssencia Cloud antes de consultar');
  const client=typeof initCloudClient==='function'?initCloudClient():null;
  if(!client||typeof client.rpc!=='function'||typeof client.auth?.getUser!=='function')
   throw Error('Validação de identidade Cloud indisponível');
  const verified=await client.auth.getUser();
  if(verified?.error)throw verified.error;
  if(!verified?.data?.user?.id||String(verified.data.user.id)!==String(user.id))
   throw Error('Sessão Cloud expirada ou alterada; volta a autenticar');
  if(!publicationAccessAllowed())throw Error('Consulta interrompida: Backoffice bloqueado');
  const call=async name=>{try{return await client.rpc(name,{})}catch(error){return {error}}};
  const [catalog,content,store]=await Promise.all([
   call('store_public_catalog_v1'),call('store_public_content_v3'),call('store_public_config_v1')
  ]);
  // Um bloqueio ou fim de sessão durante o pedido invalida o resultado obtido.
  if(!publicationAccessAllowed())throw Error('Consulta interrompida: Backoffice bloqueado');
  if(typeof cloudUser!=='undefined'&&(!cloudUser||String(cloudUser.id)!==String(user.id)))
   throw Error('Consulta interrompida: a sessão Cloud foi alterada');
  if(catalog.error)throw catalog.error;
  if(!catalog.data||!Array.isArray(catalog.data.products))throw Error('Resposta inválida do feed de produtos');
  const report=comparePublicFeed(typeof db==='undefined'?[]:db.products,catalog.data.products);
  const catalogMode=content.error?'Não confirmado':String(content.data?.catalog_status?.mode||'Não confirmado');
  const shopMode=store.error?'Não confirmado':String(store.data?.store_status?.mode||'Não confirmado');
  const statusLine='Consulta em '+new Date().toLocaleString('pt-PT')+
   ' · Feed público: '+report.feedCount+' produtos · Catálogo: '+catalogMode+' · Loja: '+shopMode;
  if(report.status!=='ok'){
   host.textContent=statusLine+'. Feed sem artigos: não é possível concluir que existam publicações em falta.';
   return;
  }
  const discrepancies=report.rows.filter(r=>
   (r.marked&&r.status==='absent')||(!r.marked&&r.status==='present')||
   r.status==='ambiguous'||r.status==='unmatched'||r.status==='code_only').slice(0,16);
  const meta=typeof cloudMeta==='function'?cloudMeta():null;
  const unconfirmed=!!((typeof cloudBusy!=='undefined'&&cloudBusy)||
   (meta&&(meta.dirty||meta.conflict||!meta.verified))||
   (typeof hasPendingProductEditsV19102==='function'&&hasPendingProductEditsV19102()));
  const warning=unconfirmed?
   '<p>Atenção: sincronização local/Cloud por confirmar. As divergências podem refletir dados desatualizados neste dispositivo; não constituem prova de falha de publicação.</p>':'';
  const issueLabel=r=>r.status==='code_only'?'Código coincide, mas origem não confirmada':r.status==='ambiguous'?'Identificação ambígua':
   r.status==='unmatched'?'Sem identificador fiável':
   r.status==='absent'?'Assinalado no Backoffice, não encontrado no feed':
   'Encontrado no feed, sem marcação local';
  host.innerHTML='<p>'+escapeHtml(statusLine)+'</p>'+
   '<div class="ae-publication-feed-metrics-v1">'+
    [['Correspondências por origem',report.present],['Assinalados mas ausentes',report.missingMarked],
     ['No feed sem marcação local',report.unexpectedPresent],['Identificação incerta',report.uncertain],
     ['No feed sem origem identificada',report.withoutOrigin],['Origem não encontrada neste dispositivo',report.originNotInDevice]]
      .map(([label,count])=>'<span><b>'+count+'</b> '+escapeHtml(label)+'</span>').join('')+
   '</div>'+warning+
   (report.unlinkedRemote.length?
    '<details><summary>Produtos no feed sem ligação confirmada ('+report.unlinkedRemote.length+')</summary><div class="ae-publication-public-list-v1">'+
    report.unlinkedRemote.slice(0,16).map(item=>'<div><strong>'+escapeHtml(item.name)+'</strong><small>'+
    escapeHtml(item.code||'Sem código')+' · '+escapeHtml(item.reason)+'</small></div>').join('')+
    '</div></details>':'')+
   (discrepancies.length?'<details><summary>Examinar até 16 divergências</summary><div class="ae-publication-public-list-v1">'+
    discrepancies.map(r=>'<div><strong>'+escapeHtml(r.name)+'</strong><small>'+
      escapeHtml(r.code||'Sem código')+' · '+escapeHtml(issueLabel(r))+'</small></div>').join('')+
    '</div></details>':'<p>Sem divergências detetadas para os artigos identificados.</p>')+
   '<p class="ae-publication-disclaimer-v1">Comparação com o feed público partilhado, sem aceder à apresentação real dos canais. Origem não encontrada neste dispositivo pode significar sincronização incompleta. Edições, filtros e estados dos canais podem ocultar produtos. Não confirma visibilidade na página nem sincronização completa entre dispositivos. O checkout da Loja permanece fechado.</p>';
 }catch(error){
  host.textContent='Verificação não concluída: '+String(error?.message||error)+'. Não foram alterados dados.';
 }finally{button.disabled=false}
}
function render(){
 if(!E('aePublicationOverviewV1'))return;
 const reviewer=typeof root.aeCatalogReviewAssessmentV1995==='function'?root.aeCatalogReviewAssessmentV1995:null;
 const all=auditProducts(typeof db==='undefined'?[]:db.products,reviewer);
 const s=all.summary;
 const cells=[['Produtos no dispositivo',s.total],['A exigir atenção',s.needsAttention],
  ['Revistos e completos',s.ready],['Sem fotografia principal',s.missingPhoto],
  ['Assinalados para publicação',s.markedPublic],['Intenção por definir',s.unknownPublicIntent]];
 E('aePublicationMetricsV1').innerHTML=cells.map(([name,count])=>'<div class="ae-publication-metric-v1"><strong>'+count+'</strong><small>'+escapeHtml(name)+'</small></div>').join('');
 const terms=query.toLocaleLowerCase('pt-PT').trim();
 const filtered=all.records.filter(x=>{
  if(filter==='attention'&&x.ready)return false;
  if(filter==='ready'&&!x.ready)return false;
  if(filter==='marked'&&x.publicIntent!==true)return false;
  if(filter==='unmarked'&&x.publicIntent!==false)return false;
  return !terms||[x.name,x.code,x.product.category,x.product.catalogGroupV191].join(' ').toLocaleLowerCase('pt-PT').includes(terms);
 }).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const lastPage=Math.max(0,Math.ceil(filtered.length/PAGE)-1);
 page=Math.min(page,lastPage);
 const visible=filtered.slice(page*PAGE,(page+1)*PAGE);
 E('aePublicationResultsV1').innerHTML=visible.length?visible.map(x=>{
  const reason=x.issues.length?'Em falta: '+x.issues.join(' · '):x.review==='reviewed'?'Revisão editorial atual':'Revisão editorial por confirmar';
  const signal=x.publicIntent===true?'Publicação solicitada':x.publicIntent===false?'Não assinalado para publicação':'Intenção pública não registada';
  const safeCode=escapeHtml(x.code);
  return '<article class="ae-publication-row-v1"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+safeCode+' · '+escapeHtml(signal)+'</small><p>'+escapeHtml(reason)+'</p></div>'+
    (x.code?'<button class="btn ghost" type="button" data-ae-publication-review="'+safeCode+'">Ver na revisão</button>':'')+'</article>';
 }).join(''):'<p class="ae-publication-empty-v1">Sem produtos neste filtro.</p>';
 E('aePublicationPageV1').textContent='Página '+(page+1)+' de '+(lastPage+1)+' · '+filtered.length+' produtos';
 E('aePublicationPrevV1').disabled=page===0;
 E('aePublicationNextV1').disabled=page>=lastPage;
}
const css=document.createElement('link');css.rel='stylesheet';css.href='/catalog-publication-overview-v1.css';document.head.appendChild(css);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof window!=='undefined'?window:globalThis);
