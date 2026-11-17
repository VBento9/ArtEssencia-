/* Dashboard operativo: apenas apresentação de encomendas existentes, sem novas fontes de dados. */
(function(){
 'use strict';
 const HOST='dashboardTodayList';
 const escaped=value=>typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>typeof euro==='function'?euro(value):Number(value||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
 const dateISO=()=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 };
 const shift=iso=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
 const validISO=iso=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return false;const date=new Date(iso+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso};
 let selected='all',installed=false;
 function source(){
  if(typeof db==='undefined'||!db||!Array.isArray(db.orders)||typeof calcOrder!=='function')return [];
  const today=dateISO(),tomorrow=shift(today);
  return db.orders.filter(o=>o&&!o.voidedAt&&o.status!=='Cancelado'&&o.status!=='Entregue'&&validISO(o.delivery))
   .map(o=>{
    const calc=calcOrder(o),due=Math.max(0,(Number(calc.total)||0)-(Number(o.paid)||0));
    const bucket=o.delivery<today?'late':o.delivery===today?'today':o.delivery===tomorrow?'tomorrow':'next';
    return {o,calc,due,bucket};
   }).sort((a,b)=>a.o.delivery.localeCompare(b.o.delivery)||String(a.o.id||'').localeCompare(String(b.o.id||''),'pt-PT'));
 }
 function display(){
  const list=document.getElementById(HOST),card=list?.closest('.dashboard-today-card');
  if(!list||!card)return;
  const data=source();
  const counts={all:data.length,late:data.filter(x=>x.bucket==='late').length,today:data.filter(x=>x.bucket==='today').length,next:data.filter(x=>['tomorrow','next'].includes(x.bucket)).length};
  let tools=card.querySelector('#aeDeliveryFocusControlsV19165');
  if(!tools){
   tools=document.createElement('div');tools.id='aeDeliveryFocusControlsV19165';tools.className='ae-delivery-focus-controls';
   const heading=card.querySelector('.dashboard-today-head');
   const headingTitle=heading?.querySelector('strong');if(headingTitle)headingTitle.textContent='Entregas e prazos';
   heading?.after(tools);
  }
  tools.replaceChildren();
  for(const [key,label] of [['all','Todas'],['late','Atrasadas'],['today','Hoje'],['next','Próximas']]){
   const b=document.createElement('button');b.type='button';b.textContent=label+' · '+counts[key];
   b.className=key===selected?'active':'';
   b.setAttribute('aria-pressed',String(key===selected));
   b.addEventListener('click',()=>{selected=key;display()});
   tools.append(b);
  }
  const filtered=data.filter(x=>selected==='all'||(selected==='next'?['tomorrow','next'].includes(x.bucket):x.bucket===selected)).slice(0,6);
  const html=filtered.map(({o,calc,due,bucket})=>{
   const dateText=new Date(o.delivery+'T12:00:00Z').toLocaleDateString('pt-PT',{timeZone:'UTC',day:'2-digit',month:'short'});
   const priority=bucket==='late'?'Em atraso':bucket==='today'?'Hoje':bucket==='tomorrow'?'Amanhã':dateText;
   const productionAllowed=['Confirmada','Em produção','Produção','Confirmado'].includes(o.status);
   const productionButton=productionAllowed?'<button type="button" class="ae-delivery-focus-open ae-delivery-focus-production" data-dashboard-production="'+escaped(o.id)+'" aria-label="Abrir produção da encomenda '+escaped(o.id)+'">Produção</button>':'';
   return '<div class="ae-delivery-focus-row '+bucket+'">'
    +'<div class="ae-delivery-focus-date"><b>'+escaped(priority)+'</b><small>'+escaped(dateText)+'</small></div>'
    +'<div class="ae-delivery-focus-person"><b>'+escaped(o.client||'Cliente')+'</b><small>'+escaped(o.id||'')+'</small></div>'
    +'<div class="ae-delivery-focus-detail"><b>'+escaped(o.status||'Estado por definir')+'</b><small class="'+(due>.001?'unpaid':'')+'">'+(due>.001?'Por receber '+money(due):'Pagamento OK')+'</small></div>'
    +'<div class="ae-delivery-focus-actions">'+productionButton+'<button type="button" class="ae-delivery-focus-open" data-dashboard-order="'+escaped(o.id)+'" aria-label="Abrir encomenda '+escaped(o.id)+'">Abrir</button></div>'
    +'</div>';
  }).join('');
  const nextHTML=html||'<div class="dashboard-today-empty">'+(data.length?'Sem encomendas neste filtro.':'Não existem entregas pendentes com data definida.')+'</div>';
  if(list.innerHTML!==nextHTML)list.innerHTML=nextHTML;
  const label=document.getElementById('dashboardTodayLabel');
  if(label)label.textContent=data.length+' encomenda(s) por tratar · '+counts.late+' atrasada(s)';
  let foot=card.querySelector('#aeDeliveryFocusFooterV19165');
  if(!foot){foot=document.createElement('div');foot.id='aeDeliveryFocusFooterV19165';foot.className='ae-delivery-focus-footer';card.append(foot)}
  foot.replaceChildren();
  const seeAll=document.createElement('button');seeAll.type='button';seeAll.className='btn';seeAll.textContent='Ver todas as encomendas';
  seeAll.addEventListener('click',()=>go('orders'));foot.append(seeAll);
 }
 function init(){
  const list=document.getElementById(HOST);if(!list||installed)return;
  installed=true;
  // Interceta apenas o renderizador já existente. Não observar mutações criadas por esta vista.
  const original=window.renderDashboardDaily;
  if(typeof original==='function'){
   window.renderDashboardDaily=function(...args){const result=original.apply(this,args);display();return result};
  }
  display();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
