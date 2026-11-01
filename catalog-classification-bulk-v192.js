/* ArtEssencia — classificar produtos em lote usando catalogGroupV191/catalogSubgroupV191. */
(()=>{
'use strict';
const E=id=>document.getElementById(id),HT=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PAGE=18;let selected=new Set(),page=0,query='',filter='missing',technical='all';
function list(){
 return (db.products||[]).filter(p=>p?.code).filter(p=>filter==='missing'?!catalogFamilyV191(p.catalogGroupV191):filter==='complete'?!!catalogFamilyV191(p.catalogGroupV191):true).filter(p=>technical==='all'||p.category===technical).filter(p=>[p.name,p.code,p.category].join(' ').toLocaleLowerCase('pt-PT').includes(query.toLocaleLowerCase('pt-PT'))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt'));
}
function drawSub(){
 const family=catalogFamilyV191(E('bulkFamily192').value),sub=E('bulkSub192'),old=sub.value;
 sub.innerHTML='<option value="">Sem subcategoria</option>'+(family?.subs||[]).map(x=>'<option value="'+HT(x[0])+'">'+HT(x[1])+'</option>').join('');
 sub.value=family?.subs.some(x=>x[0]===old)?old:'';sub.disabled=!family;
}
function updateCount(){
 E('bulkCount192').textContent=selected.size+' selecionado(s)';
 E('bulkApply192').disabled=!selected.size||!catalogFamilyV191(E('bulkFamily192').value);
}
function draw(){
 const all=db.products||[],arr=list();page=Math.min(page,Math.max(0,Math.ceil(arr.length/PAGE)-1));
 const shown=arr.slice(page*PAGE,(page+1)*PAGE);
 E('bulkProgress192').textContent=all.filter(p=>!!catalogFamilyV191(p.catalogGroupV191)).length+'/'+all.length+' classificados comercialmente';
 E('bulkRows192').innerHTML=shown.length?shown.map(p=>'<label class="ae-bulk-row"><input type="checkbox" data-code="'+HT(p.code)+'" '+(selected.has(String(p.code))?'checked':'')+'><span><b>'+HT(p.name)+'</b><small>'+HT(p.code)+' · '+HT(p.category)+'</small></span><em>'+HT(catalogBreadcrumbV191(p)||'Por classificar')+'</em></label>').join(''):'<p class="ae-bulk-empty">Nenhum produto com estes filtros.</p>';
 E('bulkRows192').querySelectorAll('[data-code]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.code):selected.delete(input.dataset.code);updateCount()});
 E('bulkPage192').textContent='Página '+(page+1)+' / '+Math.max(1,Math.ceil(arr.length/PAGE))+' · '+arr.length+' produto(s)';
 E('bulkPrevious192').disabled=page===0;E('bulkNext192').disabled=(page+1)*PAGE>=arr.length;
 updateCount();
}
function saveBulk(){
 const family=catalogFamilyV191(E('bulkFamily192').value),sub=E('bulkSub192').value;
 if(!family||!selected.size)return;
 if(sub&&!family.subs.some(x=>x[0]===sub))return toast('Subcategoria inválida');
 if(typeof cloudBusy!=='undefined'&&cloudBusy)return toast('Sincronização Cloud em curso. Volta a tentar.');
 const affected=(db.products||[]).filter(p=>selected.has(String(p.code)));
 if(!affected.length)return;
 const message='Aplicar a classificação a '+affected.length+' produto(s)?\n\n'+family.name+(sub?' → '+catalogSubnameV191(family.id,sub):'')+'\n\nOs restantes campos, incluindo preços, custos, fichas técnicas, publicação e temas, não serão modificados.';
 if(!confirm(message))return;
 for(const p of affected){p.catalogGroupV191=family.id;p.catalogSubgroupV191=sub;}
 save('products');
 selected.clear();page=0;updateCatalogFiltersV191(db.products);renderProducts();draw();
 toast('Classificação guardada localmente. Confirma a sincronização Cloud.');
}
function open(){
 selected.clear();page=0;query='';filter='missing';technical='all';
 E('bulkSearch192').value='';E('bulkState192').value='missing';E('bulkTechnical192').value='all';E('bulkFamily192').value='';drawSub();draw();E('bulkDialog192').showModal();
}
function init(){
 const anchor=E('catalogClassificationProgressV191');if(!anchor||E('bulkDialog192'))return;
 const b=document.createElement('button');b.type='button';b.className='btn ghost ae-bulk-trigger';b.textContent='Classificar em lote';b.onclick=open;anchor.insertAdjacentElement('afterend',b);
 const dialog=document.createElement('dialog');dialog.id='bulkDialog192';dialog.className='ae-bulk-dialog';
 dialog.innerHTML='<div class="ae-bulk-content"><div class="ae-bulk-head"><div><strong>Classificação comercial em lote</strong><small id="bulkProgress192"></small></div><button type="button" class="btn ghost" id="bulkClose192">Fechar</button></div><p class="ae-bulk-hint">Seleciona os produtos e atribui apenas família e subcategoria. A gravação requer confirmação.</p><div class="ae-bulk-controls"><input id="bulkSearch192" type="search" placeholder="Pesquisar nome ou código" aria-label="Pesquisar"><select id="bulkState192"><option value="missing">Por classificar</option><option value="complete">Classificados</option><option value="all">Todos</option></select><select id="bulkTechnical192"></select></div><div class="ae-bulk-choices"><b id="bulkCount192">0 selecionados</b><button type="button" id="bulkSelectPage192" class="btn ghost">Selecionar página</button><button type="button" id="bulkClear192" class="btn ghost">Limpar</button></div><div class="ae-bulk-rows" id="bulkRows192"></div><div class="ae-bulk-pagination"><button id="bulkPrevious192" type="button" class="btn ghost">Anterior</button><span id="bulkPage192"></span><button id="bulkNext192" type="button" class="btn ghost">Seguinte</button></div><div class="ae-bulk-target"><label>Família comercial<select id="bulkFamily192"></select></label><label>Subcategoria<select id="bulkSub192" disabled></select></label></div><div class="ae-bulk-foot"><small>Não altera produção nem preços.</small><button type="button" class="btn primary" id="bulkApply192" disabled>Guardar seleção</button></div></div>';
 document.body.append(dialog);
 E('bulkFamily192').innerHTML='<option value="">Escolher família…</option>'+CATALOG_FAMILIES_V191.map(x=>'<option value="'+HT(x.id)+'">'+HT(x.name)+'</option>').join('');
 E('bulkTechnical192').innerHTML='<option value="all">Todas as categorias técnicas</option>'+[...new Set((db.products||[]).map(p=>String(p.category||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt')).map(c=>'<option value="'+HT(c)+'">'+HT(c)+'</option>').join('');
 E('bulkFamily192').onchange=()=>{drawSub();updateCount()};
 E('bulkClose192').onclick=()=>dialog.close();
 E('bulkSearch192').oninput=e=>{query=e.target.value;page=0;draw()};
 E('bulkState192').onchange=e=>{filter=e.target.value;page=0;draw()};
 E('bulkTechnical192').onchange=e=>{technical=e.target.value;page=0;draw()};
 E('bulkSelectPage192').onclick=()=>{list().slice(page*PAGE,(page+1)*PAGE).forEach(p=>selected.add(String(p.code)));draw()};
 E('bulkClear192').onclick=()=>{selected.clear();draw()};
 E('bulkPrevious192').onclick=()=>{page--;draw()};
 E('bulkNext192').onclick=()=>{page++;draw()};
 E('bulkApply192').onclick=saveBulk;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Módulo de revisão isolado: mantém a classificação em lote intacta. */
(function(){
 var css=document.createElement('link');css.rel='stylesheet';css.href='/catalog-review-workflow-v1995.css';document.head.appendChild(css);
 var script=document.createElement('script');script.src='/catalog-review-workflow-v1995.js';document.head.appendChild(script);
})();
