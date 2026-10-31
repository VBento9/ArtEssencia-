/* ArtEssencia 1.9.67 — períodos equivalentes e avaliação de lançamentos.
 * Usa a RPC existente de leitura; nenhuma gravação ou migração.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const fmt=v=>numeric(v).toLocaleString('pt-PT');
const storage=new Map();
let serial=0,launchSerial=0,currentKey='',previous=null,range=null,source='catalog',current=null;
let launchChoice='',launchDate='',launchDays=7,launchResult=null,launchBusy=false;
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const utc=s=>Date.parse(s+'T00:00:00Z');
const day=s=>new Date(s).toISOString().slice(0,10);
const shift=(s,n)=>day(utc(s)+n*86400000);
const dayCount=(a,b)=>Math.round((utc(b)-utc(a))/86400000)+1;
function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const fullDate=s=>dateValid(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
function totals(data){return data&&typeof data.totals==='object'&&data.totals!==null?data.totals:null}
function keyFor(p){const id=String(p?.product_id||'').trim();const name=String(p?.name||'').trim();return id?'id:'+id:'nome:'+name.toLocaleLowerCase('pt-PT')}
function top(data){return Array.isArray(data?.top_products)?data.top_products.filter(p=>p&&keyFor(p)!=='nome:'):[]}
function session(){try{return typeof digitalStatsStateV1795==='object'?digitalStatsStateV1795:null}catch(_){return null}}
function fail(reason){$('dsCompareResultV1967').textContent=reason}
function metric(label,now,before){const diff=now-before;const change=before>0?(diff>=0?'+':'')+(100*diff/before).toLocaleString('pt-PT',{maximumFractionDigits:1})+'%':now>0?'Sem base percentual':'0%';
return '<div class="ds-cmp-metric-v1967"><span>'+esc(label)+'</span><strong>'+fmt(now)+'</strong><small>Anterior: '+fmt(before)+' · '+esc(change)+'</small></div>'}
function compareProducts(){
 const host=$('dsProductComparisonV1967');if(!host)return;
 const p=top(previous),now=top(current);
 if(!p.length||!now.length){host.innerHTML='<p class="ds-cmp-note-v1967">A Cloud não devolveu produtos suficientes nos dois períodos para uma comparação individual.</p>';return}
 const byId=new Map(p.map(x=>[keyFor(x),x]));
 const records=now.slice(0,5).map(x=>{
   const other=byId.get(keyFor(x));
   const label=esc(x.name||x.product_id||'Produto');
   const before=other?fmt(other.views):'Não consta do top';
   const after=fmt(x.views);
   return '<div class="ds-cmp-product-v1967"><strong>'+label+'</strong><small>'+before+' → '+after+' visualizações</small></div>';
 });
 host.innerHTML=records.join('')+'<p class="ds-cmp-note-v1967">“Não consta do top” não significa zero visualizações. Os rankings podem estar limitados pela RPC.</p>';
}
function showComparison(){
 const box=$('dsCompareResultV1967');
 if(!box)return;
 const now=totals(current),before=totals(previous);
 if(!now||!before){box.textContent='Sem totais comparáveis. Atualiza os dados e tenta novamente.';return}
 const shop=source==='shop';
 const keys=shop?[['Sessões','sessions'],['Produtos vistos','product_views'],['Carrinhos','add_to_cart'],['Pedidos submetidos','order_submitted']]:
 [['Sessões','sessions'],['Produtos vistos','product_views'],['Favoritos','favorite_adds'],['Contactos','contact_clicks']];
 const pStart=shift(range.from,-dayCount(range.from,range.to)),pEnd=shift(range.from,-1);
 box.innerHTML='<p class="ds-cmp-note-v1967">Atual: '+fullDate(range.from)+'–'+fullDate(range.to)+' · Anterior: '+fullDate(pStart)+'–'+fullDate(pEnd)+'</p>'+
 '<div class="ds-cmp-kpis-v1967">'+keys.map(([label,key])=>metric(label,numeric(now[key]),numeric(before[key]))).join('')+'</div>'+
 '<p class="ds-cmp-note-v1967">Variações representam eventos registados, não clientes distintos nem efeitos comprovados de campanhas. Os períodos têm igual número de dias.</p>';
 compareProducts();
}
async function requestPrevious({refresh=false}={}){
 const box=$('dsCompareResultV1967');if(!box||!range||!current)return;
 const ticket=++serial;
 const days=dayCount(range.from,range.to);
 if(days<1||days>366){fail('Seleciona um intervalo válido de até 366 dias para comparar.');return}
 const previousFrom=shift(range.from,-days),previousTo=shift(range.from,-1);
 const cacheKey=source+'|'+previousFrom+'|'+previousTo;
 if(!refresh&&storage.has(cacheKey)){
   previous=storage.get(cacheKey);showComparison();return;
 }
 box.textContent='A comparar com os '+days+' dias anteriores…';
 try{
   if(typeof cloudClient==='undefined'||!cloudClient)throw new Error('Cloud indisponível');
   const {data,error}=await cloudClient.rpc('artessencia_analytics_summary_v1',{p_source:source,p_from:previousFrom,p_to:previousTo});
   if(ticket!==serial)return;
   if(error)throw new Error('A consulta anterior falhou');
   if(!data||!totals(data))throw new Error('Sem totais no período anterior');
   previous=data;storage.set(cacheKey,data);
   showComparison();
 }catch(error){if(ticket===serial){previous=null;fail(error.message||'Não foi possível comparar os períodos.');$('dsProductComparisonV1967').textContent='Sem comparação disponível.'}}
}
function ensureLaunchProducts(){
 const select=$('dsLaunchProductV1967');if(!select)return;
 const list=top(current);
 const old=launchChoice||select.value;
 select.replaceChildren(new Option('Selecionar produto…',''),...list.map(p=>new Option(p.name||p.product_id||'Produto',keyFor(p))));
 if(list.some(p=>keyFor(p)===old)){select.value=old;launchChoice=old}else{select.value='';launchChoice=''}
}
function updateCurrent(event){
 const st=session();serial++;launchSerial++;
 current=st?.data&&totals(st.data)?st.data:null;
 previous=null;launchResult=null;
 const d=event.detail||{};
 range={from:d.from,to:d.to};source=d.source==='shop'?'shop':'catalog';currentKey=source+'|'+range.from+'|'+range.to;
 const cmp=$('dsCompareResultV1967');if(cmp)cmp.textContent=current?'A preparar comparação…':'Sem dados atuais válidos.';
 const product=$('dsProductComparisonV1967');if(product)product.textContent='A aguardar a comparação.';
 const out=$('dsLaunchResultV1967');if(out)out.textContent='Escolhe o produto e a data de lançamento para analisar janelas equivalentes.';
 ensureLaunchProducts();
 if(current&&dateValid(range.from)&&dateValid(range.to))requestPrevious();
}
function dateWindows(date,days){
 if(!dateValid(date))throw new Error('Indica uma data de lançamento válida.');
 const today=localToday();
 if(date>today)throw new Error('O lançamento ainda não aconteceu. Não existem dados posteriores para comparar.');
 const elapsed=Math.min(days,dayCount(date,today));
 return {
   before:{from:shift(date,-elapsed),to:shift(date,-1)},
   after:{from:date,to:shift(date,elapsed-1)},
   complete:elapsed===days,days:elapsed
 };
}
function matched(data,choice){
 return top(data).find(p=>keyFor(p)===choice)||null;
}
async function analyseLaunch(){
 const out=$('dsLaunchResultV1967');
 if(!out||launchBusy)return;
 const select=$('dsLaunchProductV1967'),input=$('dsLaunchDateV1967'),span=$('dsLaunchDaysV1967');
 launchChoice=select?.value||'';launchDate=input?.value||'';launchDays=Number(span?.value)||7;
 if(!launchChoice){out.textContent='Seleciona um produto com registos no ranking atual.';return}
 let windows;try{windows=dateWindows(launchDate,launchDays)}catch(e){out.textContent=e.message;return}
 const ticket=++launchSerial,forSource=source;
 launchBusy=true;const button=$('dsLaunchRunV1967');if(button)button.disabled=true;
 out.textContent='A consultar as visualizações nos '+windows.days+' dias antes e depois do lançamento…';
 try{
   if(typeof cloudClient==='undefined'||!cloudClient)throw new Error('Cloud indisponível.');
   const query=(d)=>cloudClient.rpc('artessencia_analytics_summary_v1',{p_source:forSource,p_from:d.from,p_to:d.to});
   const [pre,post]=await Promise.all([query(windows.before),query(windows.after)]);
   if(ticket!==launchSerial||source!==forSource)return;
   if(pre.error||post.error)throw new Error('Não foi possível consultar ambos os intervalos.');
   const before=matched(pre.data,launchChoice),after=matched(post.data,launchChoice);
   if(!before||!after){
     out.innerHTML='<p class="ds-cmp-note-v1967">O produto não aparece no ranking devolvido pela Cloud em pelo menos um dos períodos. Não é correto assumir zero visualizações; por isso, não é apresentada uma evolução numérica.</p>';
     return;
   }
   const a=numeric(before.views),b=numeric(after.views),change=b-a;
   const percent=a>0?((change>=0?'+':'')+(100*change/a).toLocaleString('pt-PT',{maximumFractionDigits:1})+'%'):'Sem referência percentual';
   const result=(b>=a?'+':'')+change.toLocaleString('pt-PT');
   out.innerHTML='<div class="ds-launch-comparison-v1967">'+
      '<div><span>Antes · '+fullDate(windows.before.from)+'–'+fullDate(windows.before.to)+'</span><strong>'+fmt(a)+'</strong></div>'+
      '<div><span>Depois · '+fullDate(windows.after.from)+'–'+fullDate(windows.after.to)+'</span><strong>'+fmt(b)+'</strong></div>'+
      '<div><span>Variação observada</span><strong>'+esc(result)+'</strong><small>'+esc(percent)+'</small></div></div>'+
      '<p class="ds-cmp-note-v1967">'+(windows.complete?'Janela completa.':'Janela parcial: só existem '+windows.days+' dia(s) após a data selecionada. ')+' Os períodos têm igual duração. A variação não prova que o lançamento ou a publicidade tenham causado a diferença.</p>';
 }catch(e){if(ticket===launchSerial)out.textContent=e.message||'Não foi possível analisar este lançamento.'}
 finally{launchBusy=false;if(button)button.disabled=false}
}
function initialise(){
 const nav=$('dsNavigationV1966'),root=$('digitalStats'),panels=root?.querySelector('.ds-panels-v1966');
 const summary=panels?.querySelector('[data-ds-panel="resumo"]'),products=panels?.querySelector('[data-ds-panel="produtos"]');
 if(!nav||!root||!panels||!summary||!products||root.dataset.statsCompare1967)return;
 const block=document.createElement('section');
 block.className='ds-comparison-v1967';
 block.innerHTML='<div class="ds-cmp-title-v1967"><div><strong>Comparar com o período anterior</strong><small>Mesma origem e mesmo número de dias</small></div><button class="btn" type="button" id="dsCompareRefreshV1967">Recalcular</button></div><div id="dsCompareResultV1967" class="ds-cmp-content-v1967" role="status">A aguardar estatísticas.</div>';
 summary.prepend(block);
 const pc=document.createElement('section');pc.className='ds-comparison-v1967';
 pc.innerHTML='<div class="ds-cmp-title-v1967"><strong>Mudança nos produtos mais vistos</strong></div><div id="dsProductComparisonV1967">A aguardar comparação.</div>';
 products.append(pc);
 const navButton=document.createElement('button');navButton.type='button';navButton.className='ds-tab-v1966';navButton.dataset.dsTab='lancamentos';navButton.textContent='Lançamentos';
 const ref=nav.querySelector('[data-ds-tab="evolucao"]');if(ref)nav.insertBefore(navButton,ref);else nav.append(navButton);
 const pane=document.createElement('section');pane.className='ds-panel-v1966';pane.dataset.dsPanel='lancamentos';pane.hidden=true;pane.setAttribute('aria-label','Acompanhar lançamento');
 pane.innerHTML='<div class="ds-launch-v1967"><strong>Avaliar o interesse antes e depois do lançamento</strong>'+
   '<p class="ds-cmp-note-v1967">Escolhe um produto presente no ranking atual, a data de divulgação e uma janela de análise. Não altera campanhas nem produtos.</p>'+
   '<div class="ds-launch-fields-v1967"><label>Produto<select id="dsLaunchProductV1967"></select></label>'+
   '<label>Data da divulgação<input type="date" id="dsLaunchDateV1967"></label>'+
   '<label>Janela<select id="dsLaunchDaysV1967"><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label>'+
   '<button class="btn primary" id="dsLaunchRunV1967" type="button">Comparar períodos</button></div>'+
   '<div id="dsLaunchResultV1967" class="ds-launch-results-v1967" role="status">Escolhe os dados do lançamento para iniciar.</div>'+
   '<p class="ds-cmp-note-v1967">A Cloud devolve apenas os produtos presentes no seu ranking agregado; a ausência de um produto num período impede calcular a variação desse produto.</p></div>';
 const beforePane=panels.querySelector('[data-ds-panel="evolucao"]');if(beforePane)panels.insertBefore(pane,beforePane);else panels.append(pane);
 navButton.addEventListener('click',()=>{nav.querySelectorAll('[data-ds-tab]').forEach(b=>{b.classList.toggle('selected',b===navButton);b.setAttribute('aria-selected',String(b===navButton))});panels.querySelectorAll('[data-ds-panel]').forEach(p=>p.hidden=p!==pane);nav.scrollIntoView({block:'start',behavior:'smooth'})});
 nav.querySelectorAll('button:not([data-ds-tab="lancamentos"])').forEach(b=>b.addEventListener('click',()=>{pane.hidden=true}));
 $('dsCompareRefreshV1967').addEventListener('click',()=>requestPrevious({refresh:true}));
 $('dsLaunchRunV1967').addEventListener('click',analyseLaunch);
 root.dataset.statsCompare1967='1';
 document.addEventListener('ae:digital-stats-loaded',updateCurrent);
 document.addEventListener('ae:digital-stats-start',()=>{serial++;launchSerial++;previous=null;$('dsCompareResultV1967').textContent='A atualizar dados…';$('dsProductComparisonV1967').textContent='A aguardar nova consulta.';$('dsLaunchResultV1967').textContent='O período mudou. Executa a análise novamente.'});
 const st=session();
 if(st?.data&&totals(st.data)&&typeof digitalStatsRangeV1795==='function'){
   const r=digitalStatsRangeV1795();
   updateCurrent({detail:{source:st.source,from:r.from,to:r.to}});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialise,{once:true});else initialise();
})();