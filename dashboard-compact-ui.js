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
   button.id='aeDashTab'+i;
   block.wrap.id=block.wrap.id||'aeDashPanel'+i;
   block.wrap.setAttribute('role','tabpanel');
   block.wrap.setAttribute('aria-labelledby',button.id);
   button.setAttribute('aria-controls',block.wrap.id);
   button.addEventListener('click',()=>select(i));nav.append(button);return button;
 });
 function select(index){
   blocks.forEach((b,i)=>{
    const active=i===index;b.heading.hidden=!active;b.wrap.hidden=!active;
    buttons[i].setAttribute('aria-selected',String(active));buttons[i].tabIndex=active?0:-1;
   });
 }
 nav.addEventListener('keydown',event=>{
  const i=buttons.indexOf(document.activeElement);if(i<0)return;
  let next=i;
  if(event.key==='ArrowRight')next=(i+1)%buttons.length;
  else if(event.key==='ArrowLeft')next=(i+buttons.length-1)%buttons.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=buttons.length-1;
  else return;
  event.preventDefault();buttons[next].click();buttons[next].focus();
 });
 blocks[0].heading.before(nav);select(0);
 const kpis=document.getElementById('kpis');
 if(kpis){
   const controls=document.createElement('div');controls.className='ae-dash-compact-kpis';
   const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Ver indicadores financeiros';toggle.setAttribute('aria-expanded','false');
   toggle.setAttribute('aria-controls','kpis');
   controls.append(toggle);kpis.after(controls);
   function update(){
     const open=toggle.getAttribute('aria-expanded')==='true';
     const cards=[...kpis.children].filter(el=>el.nodeType===1);
     const essential=cards.filter(card=>{
       const label=card.querySelector('.label')?.textContent?.trim()||'';
       return /encomendas|pendentes|por receber|stock baixo|produção/i.test(label);
     });
     // Quando o Backoffice renomeia os KPI, nunca deixar o resumo vazio.
     for(const card of cards)if(essential.length<Math.min(4,cards.length)&&!essential.includes(card))essential.push(card);
     cards.forEach(card=>{card.hidden=!open&&!essential.includes(card)});
     toggle.textContent=open?'Recolher indicadores adicionais':'Ver mais indicadores';
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
