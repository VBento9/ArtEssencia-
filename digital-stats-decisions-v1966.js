/* ArtEssencia 1.9.66 — leitura operacional das Estatísticas Digitais.
 * Apenas UI: utiliza o resultado existente de artessencia_analytics_summary_v1.
 * Não grava estatísticas, não altera campanhas e não infere vendas a partir de visitas.
 */
(() => {
'use strict';
const ROOT='digitalStats';
const uid=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const n=value=>number(value).toLocaleString('pt-PT');
let currentTab='resumo',chartDays=7;
const tabs=[
  ['resumo','Resumo e decisões'],['produtos','Produtos'],['evolucao','Evolução'],
  ['campanhas','Campanhas'],['qualidade','Qualidade dos dados']
];
function state(){
 try{return typeof digitalStatsStateV1795!=='undefined'?digitalStatsStateV1795:null}catch(_){return null}
}
function make(tag,cls,id){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(id)node.id=id;
 return node;
}
function tab(id,scroll=false){
 const root=uid(ROOT);if(!root?.dataset.dsDecisionReady1966)return;
 currentTab=id;
 root.querySelectorAll('[data-ds-tab]').forEach(b=>{
   const active=b.dataset.dsTab===id;
   b.classList.toggle('selected',active);
   b.setAttribute('aria-selected',String(active));
 });
 root.querySelectorAll('[data-ds-panel]').forEach(p=>{p.hidden=p.dataset.dsPanel!==id});
 if(scroll)uid('dsNavigationV1966')?.scrollIntoView({
   behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
   block:'start'
 });
}
function card(label,value,desc){
 return '<div class="ds-insight-kpi-v1966"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(desc)+'</small></div>';
}
function row(title,body){
 return '<div class="ds-takeaway-v1966"><strong>'+safe(title)+'</strong><span>'+safe(body)+'</span></div>';
}
function render(){
 const root=uid(ROOT);if(!root?.dataset.dsDecisionReady1966)return;
 const st=state(),summary=uid('dsExecutiveV1966'),ranking=uid('dsProductInsightsV1966'),trend=uid('dsDailyInsightsV1966');
 if(!summary||!ranking||!trend)return;
 if(!st?.data){
   const msg=st?.loading?'A atualizar os dados…':st?.error?'Não há dados válidos para analisar neste momento.':'Escolhe o período e atualiza as estatísticas.';
   summary.innerHTML='<p class="ds-state-v1966">'+safe(msg)+'</p>';
   ranking.innerHTML='<p class="ds-state-v1966">Sem dados para comparar produtos.</p>';
   trend.innerHTML='<p class="ds-state-v1966">Sem dados diários disponíveis.</p>';
   return;
 }
 const shop=st.source==='shop',t=st.data.totals||{};
 const views=number(t.product_views),sessions=number(t.sessions),visitors=number(t.visitors);
 const contacts=number(t.contact_clicks),cart=number(t.add_to_cart),orders=number(t.order_submitted);
 const favorites=number(t.favorite_adds),shares=number(t.share_clicks),collections=number(t.campaign_clicks);
 const products=Array.isArray(st.data.top_products)?st.data.top_products:[];
 const daily=Array.isArray(st.data.daily)?st.data.daily.slice().sort((a,b)=>String(a.day||'').localeCompare(String(b.day||''))):[];
 const signals=shop?cart:contacts+favorites+shares;
 const signalName=shop?'Adições ao carrinho':'Contactos, favoritos e partilhas';
 const metrics=shop?[
   ['Sessões',n(sessions),'Sessões anónimas registadas'],
   ['Detalhes de produtos',n(views),'Aberturas de produtos'],
   ['Adições ao carrinho',n(cart),'Ações, não compras confirmadas'],
   ['Pedidos registados',n(orders),'Não confundir com pagamentos']
 ]:[
   ['Visitantes',n(visitors),'Identificadores anónimos distintos'],
   ['Produtos abertos',n(views),'Aberturas de detalhe'],
   ['Ações de interesse',n(signals),'Contactos + favoritos + partilhas'],
   ['Contactos',n(contacts),'Cliques de contacto, não vendas']
 ];
 const kpis='<div class="ds-insight-kpis-v1966">'+metrics.map(x=>card(...x)).join('')+'</div>';
 const rows=products.map(x=>({
   name:String(x.name||x.product_id||'Produto sem nome'),
   views:number(x.views),
   signals:shop?number(x.cart_adds):number(x.contacts),
   actionLabel:shop?'adições ao carrinho':'contactos'
 }));
 const attention=rows.slice().sort((a,b)=>b.views-a.views)[0];
 const credible=rows.filter(x=>x.views>=20);
 const candidate=credible.filter(x=>x.signals>0).sort((a,b)=>(b.signals/Math.max(1,b.views))-(a.signals/Math.max(1,a.views)))[0];
 const review=credible.filter(x=>x.signals===0).sort((a,b)=>b.views-a.views)[0];
 const observed=daily.filter(x=>number(x.product_views)>0);
 const peak=observed.sort((a,b)=>number(b.product_views)-number(a.product_views))[0];
 let conclusions=[];
 if(!views&&!sessions&&!visitors)conclusions.push(['Ainda não existe base de observação','Sem atividade suficiente no período selecionado. Não é possível recomendar lançamentos a partir destes dados.']);
 if(attention&&attention.views)conclusions.push(['Produto que mais desperta curiosidade',attention.name+' teve '+n(attention.views)+' visualizações. Atenção não equivale a procura comprovada.']);
 if(candidate)conclusions.push(['Candidato a testar em destaque',candidate.name+' registou '+n(candidate.signals)+' '+candidate.actionLabel+' em '+n(candidate.views)+' visualizações. É uma hipótese de promoção, não uma previsão de vendas.']);
 else if(views)conclusions.push(['Ainda sem sinal sólido de intenção','Não há produtos com pelo menos 20 visualizações e uma ação de interesse nos dados devolvidos. Mantém a recolha antes de tirar conclusões.']);
 if(review)conclusions.push(['Produto a rever antes de promover',review.name+' acumulou '+n(review.views)+' visualizações sem '+review.actionLabel+' registados. Experimenta melhorar a descrição ou a fotografia e volta a medir.']);
 if(peak)conclusions.push(['Pico diário observado',safeDate(peak.day)+' teve '+n(peak.product_views)+' aberturas de produtos. Isto não determina o melhor horário para lançar novidades.']);
 if(shop)conclusions.push(['Atenção à disponibilidade da loja','Os eventos de carrinho ou checkout não provam encomendas pagas. Se a loja estiver fechada, usa estes dados apenas como interesse exploratório.']);
 summary.innerHTML=kpis+
   '<div class="ds-summary-v1966"><div class="ds-summary-head-v1966"><strong>O que estes números sugerem</strong><small>'+safe(shop?'Loja':'Catálogo Digital')+' · período selecionado</small></div>'+
   '<div class="ds-summary-list-v1966">'+conclusions.map(x=>row(...x)).join('')+'</div>'+
   '<p class="ds-method-v1966">Os sinais são eventos agregados e podem repetir-se para a mesma pessoa. A classificação de candidato usa um mínimo exploratório de 20 visualizações; não representa uma previsão estatística.</p></div>';
 const maxViews=Math.max(1,...rows.map(x=>x.views));
 ranking.innerHTML=rows.length?'<div class="ds-ranked-list-v1966">'+rows.slice(0,5).map((x,i)=>{
   const sample=x.views>=20;
   const action=x.signals>0?n(x.signals)+' '+x.actionLabel:'Sem '+x.actionLabel+' registados';
   return '<div class="ds-ranked-item-v1966"><span class="ds-rank-v1966">'+(i+1)+'</span><div class="ds-ranked-main-v1966">'+
    '<strong>'+safe(x.name)+'</strong><small>'+n(x.views)+' visualizações · '+safe(action)+
    (sample&&x.signals?(' · '+safe((100*x.signals/x.views).toLocaleString('pt-PT',{maximumFractionDigits:1}))+' ações/100 visualizações'):'')+
    '</small><div class="ds-bar-track-v1966"><span style="width:'+Math.max(1,100*x.views/maxViews).toFixed(1)+'%"></span></div></div>'+
    '<span class="ds-sample-v1966">'+(sample?'Observação útil':'Pouca amostra')+'</span></div>';
 }).join('')+'</div><p class="ds-method-v1966">Rácios são ações por visualização, não percentagens de compradores. O resumo mostra apenas os produtos devolvidos pela Cloud.</p>':
 '<p class="ds-state-v1966">Não existem produtos identificados neste período. Sem dados não há ranking nem recomendações.</p>';
 const days=[7,14,30];
 chartDays=days.includes(chartDays)?chartDays:7;
 const windowed=daily.slice(-chartDays);
 const maxDaily=Math.max(1,...windowed.map(x=>number(x.product_views)));
 const barChart=windowed.map(x=>{
    const v=number(x.product_views);
    const height=v?Math.max(5,Math.round(v/maxDaily*100)):1;
    return '<div class="ds-day-v1966" title="'+safe(safeDate(x.day)+' · '+n(v)+' produtos vistos')+'"><span class="ds-day-count-v1966">'+n(v)+'</span><div class="ds-day-bar-shell-v1966"><i style="height:'+height+'%"></i></div><small>'+safe(shortDate(x.day))+'</small></div>';
 }).join('');
 trend.innerHTML='<div class="ds-trend-head-v1966"><strong>Aberturas de produtos por dia</strong>'+
   '<label>Mostrar <select id="dsChartWindowV1966">'+days.map(d=>'<option value="'+d+'" '+(chartDays===d?'selected':'')+'>'+d+' dias</option>').join('')+'</select></label></div>'+
   (windowed.length?'<div class="ds-day-bars-v1966">'+barChart+'</div>':'<p class="ds-state-v1966">Não foram devolvidos registos diários.</p>')+
   '<p class="ds-method-v1966">Gráfico baseado em eventos diários; não apresenta horas de maior atividade nem permite prever a data ideal de lançamento.</p>';
 uid('dsChartWindowV1966')?.addEventListener('change',e=>{chartDays=Number(e.target.value)||7;render()});
}
function safeDate(value){const s=String(value||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):s||'—'}
function shortDate(value){const s=String(value||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(8,10)+'/'+s.slice(5,7):s.slice(-5)||'—'}
function setup(){
 const root=uid(ROOT),kpis=uid('digitalStatsKpisV1795'),internals=uid('digitalStatsInternalSummaryV1947'),
 campaign=uid('launchCampaignCardV1813'),products=uid('digitalStatsProductsV1795'),daily=uid('digitalStatsDailyV1795');
 const reports=products?.closest('.reports-stack-v1725'),productSection=products?.closest('.reports-section-v1725'),dailySection=daily?.closest('.reports-section-v1725');
 if(!root||!kpis||!internals||!campaign||!productSection||!dailySection||root.dataset.dsDecisionReady1966)return;
 const hero=root.querySelector('.reports-hero'),period=hero?.nextElementSibling;
 if(!period)return;
 const title=root.querySelector('.reports-hero small');
 if(title)title.textContent='Interesse pelos produtos, qualidade dos sinais e decisões para futuros lançamentos.';
 const executive=make('section','ds-executive-v1966','dsExecutiveV1966');
 const heading=make('div','ds-dashboard-heading-v1966');
 heading.innerHTML='<div><strong>Leitura para tomar decisões</strong><small>Sem confundir visitas com vendas</small></div>';
 const shell=make('section','ds-dashboard-v1966');
 shell.append(heading,executive);
 period.after(shell);
 const navigation=make('nav','ds-navigation-v1966','dsNavigationV1966');
 navigation.setAttribute('aria-label','Secções das Estatísticas Digitais');
 const panes=make('div','ds-panels-v1966');
 for(const [id,label] of tabs){
   const button=make('button','ds-tab-v1966');button.type='button';button.dataset.dsTab=id;
   button.textContent=label;button.addEventListener('click',()=>tab(id,true));navigation.append(button);
   const pane=make('section','ds-panel-v1966');pane.dataset.dsPanel=id;pane.setAttribute('aria-label',label);panes.append(pane);
 }
 shell.after(navigation,panes);
 const pane=id=>panes.querySelector('[data-ds-panel="'+id+'"]');
 const details=(title,node)=>{
   const d=make('details','ds-details-v1966'),s=make('summary');
   s.textContent=title;d.append(s,node);return d;
 };
 pane('resumo').append(details('Consultar todos os indicadores',kpis));
 const productInsights=make('section','ds-compact-content-v1966','dsProductInsightsV1966');
 pane('produtos').append(productInsights,details('Ver lista detalhada de produtos',productSection));
 const trendInsights=make('section','ds-compact-content-v1966','dsDailyInsightsV1966');
 pane('evolucao').append(trendInsights,details('Ver todos os registos diários',dailySection));
 const campaignDetails=details('Abrir configuração e resultados da campanha',campaign);
 campaignDetails.id='dsCampaignDetailsV1966';
 pane('campanhas').append(campaignDetails);
 const intro=make('p','ds-method-v1966');
 intro.textContent='As estatísticas são agregadas e não identificam compradores. O tráfego interno só é excluído quando é reconhecido pelos mecanismos existentes.';
 pane('qualidade').append(intro,internals);
 const privacy=root.querySelector('.reports-note');
 if(privacy)pane('qualidade').append(privacy);
 if(reports&&!reports.children.length)reports.remove();
 const update=()=>render();
 new MutationObserver(update).observe(products,{childList:true});
 root.dataset.dsDecisionReady1966='1';
 tab('resumo');
 render();
 // Os atalhos existentes no Catálogo Digital devem continuar a abrir a campanha.
 document.addEventListener('click',event=>{
   const button=event.target.closest('button[onclick]');
   if(button?.getAttribute('onclick')?.includes('launchCampaignCardV1813')){
     tab('campanhas');campaignDetails.open=true;
   }
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
else setup();
})();
