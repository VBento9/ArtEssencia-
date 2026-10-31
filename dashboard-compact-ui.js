/* Dashboard compacto ArtEssencia: composição visual, sem alteração de dados. */
(function(){
'use strict';
function init(){
 const dash=document.getElementById('dashboard');
 if(!dash||document.getElementById('aeDashCompact'))return;
 // IDs are carried as HTML data, never interpolated into JavaScript handlers.
 dash.addEventListener('click',event=>{
   const production=event.target.closest('[data-dashboard-production]');
   const open=event.target.closest('[data-dashboard-order]');
   const target=production||open;if(!target||!dash.contains(target))return;
   event.stopPropagation();
   if(production)dashboardGoProduction(production.dataset.dashboardProduction);
   else if(target.closest('#dashboardTodayList'))dashboardDailyOpen(target.dataset.dashboardOrder);
   else showOrder(target.dataset.dashboardOrder);
 });
 const bodyIds=['pendingOrders','receivablesBody','quotePipelineBody'];
 const blocks=bodyIds.map(id=>{
   const body=document.getElementById(id),wrap=body?.closest('.tablewrap'),heading=wrap?.previousElementSibling;
   if(!body||!wrap||!heading||!heading.classList.contains('section-title')||!dash.contains(wrap))return null;
   return {heading,wrap};
 });
 if(blocks.some(x=>!x))return; // falha segura: não modificar DOM incompleto
 const nav=document.createElement('div');nav.id='aeDashCompact';nav.className='ae-dash-compact-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Listagens do Dashboard');
 const labels=['Encomendas pendentes','Valores a receber','Orçamentos'];
 const buttons=blocks.map((block,i)=>{
   const button=document.createElement('button');button.type='button';button.textContent=labels[i];button.setAttribute('role','tab');
   button.addEventListener('click',()=>select(i));nav.append(button);return button;
 });
 function select(index){
   blocks.forEach((b,i)=>{const active=i===index;b.heading.hidden=!active;b.wrap.hidden=!active;buttons[i].setAttribute('aria-selected',String(active));});
 }
 blocks[0].heading.before(nav);select(0);
 const kpis=document.getElementById('kpis');
 if(kpis){
   const controls=document.createElement('div');controls.className='ae-dash-compact-kpis';
   const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Ver indicadores financeiros';toggle.setAttribute('aria-expanded','false');
   controls.append(toggle);kpis.after(controls);
   const main=new Set(['Encomendas','Pendentes','Por receber','Stock baixo']);
   function update(){
     const open=toggle.getAttribute('aria-expanded')==='true';
     [...kpis.children].forEach(card=>{
       const label=card.querySelector('.label')?.textContent?.trim()||'';
       card.hidden=!open&&!main.has(label);
     });
     toggle.textContent=open?'Recolher indicadores financeiros':'Ver indicadores financeiros';
   }
   toggle.addEventListener('click',()=>{toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true'));update()});
   // renderDashboard substitui os KPI; sem afetar os listeners de negócio.
   new MutationObserver(update).observe(kpis,{childList:true});
   update();
 }
 const chart=document.getElementById('trendChart');
 const trendCard=chart?.closest('.card');
 const trendTitle=trendCard?.previousElementSibling;
 if(trendCard&&trendTitle?.classList?.contains('section-title')&&dash.contains(trendCard)){
   const toggle=document.createElement('button');toggle.className='ae-dash-analysis-toggle';toggle.type='button';toggle.textContent='Mostrar evolução dos últimos 12 meses';toggle.setAttribute('aria-expanded','false');
   trendTitle.before(toggle);trendTitle.hidden=true;trendCard.hidden=true;
   toggle.addEventListener('click',()=>{const visible=trendCard.hidden;trendTitle.hidden=!visible;trendCard.hidden=!visible;toggle.setAttribute('aria-expanded',String(visible));toggle.textContent=visible?'Recolher evolução':'Mostrar evolução dos últimos 12 meses'});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Planeamento Cloud: carregamento progressivo no Dashboard existente. */
if(!document.getElementById('aeTasksCloudScriptV1')){
 const script=document.createElement('script');script.id='aeTasksCloudScriptV1';
 script.src='/task-manager-v2.js';script.defer=true;document.head.append(script);
}
