/* ArtEssencia — Encomendas: só apresentação; mantém filtros e handlers originais. */
(function(){
 'use strict';
 function init(){
  const root=document.getElementById('orders');
  if(!root||document.getElementById('aeOrdersCompact'))return;
  const toolbar=root.querySelector('.orders-toolbar-controls-v1728');
  if(!toolbar)return;
  const dateFields=[...toolbar.querySelectorAll('.orders-period-v1882')];
  if(dateFields.length!==2)return;
  const advanced=document.createElement('div');
  advanced.id='aeOrdersAdvanced';advanced.className='ae-orders-advanced';
  const button=document.createElement('button');
  button.id='aeOrdersCompact';button.type='button';button.className='btn ghost';
  button.textContent='Filtrar por datas';button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','aeOrdersAdvanced');
  const anchor=toolbar.querySelector('.orders-filter-utility-v1915')||dateFields[1].nextElementSibling;
  if(anchor)toolbar.insertBefore(button,anchor);else toolbar.append(button);
  toolbar.insertBefore(advanced,button);
  dateFields.forEach(field=>advanced.append(field));
  function dateCount(){
   return dateFields.reduce((total,field)=>total+[...field.querySelectorAll('input')].filter(x=>!!String(x.value||'').trim()).length,0);
  }
  function apply(open){
   advanced.hidden=!open;
   button.setAttribute('aria-expanded',String(open));
   const count=dateCount();
   button.dataset.hasDates=count?'true':'false';
   button.textContent=open?'Recolher datas':count?'Datas ativas · Alterar':'Filtrar por datas';
   button.setAttribute('aria-label',count
    ?(open?'Recolher filtros por datas; '+count+' datas definidas':'Alterar filtros por datas; '+count+' datas definidas')
    :(open?'Recolher filtros por datas':'Filtrar por datas'));
  }
  const hasDates=dateFields.some(field=>[...field.querySelectorAll('input')].some(input=>!!input.value));
  button.addEventListener('click',()=>apply(advanced.hidden));
  dateFields.forEach(field=>field.querySelectorAll('input').forEach(input=>{
   input.addEventListener('change',()=>apply(!advanced.hidden));
   input.addEventListener('input',()=>apply(!advanced.hidden));
  }));
  apply(hasDates);
  const header=document.querySelector('.topbar');
  if(header){const measure=()=>root.style.setProperty('--ae-orders-top-offset',(header.getBoundingClientRect().height+8)+'px');measure();if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(header)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
