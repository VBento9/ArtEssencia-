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
  const anchor=toolbar.querySelector('.orders-filter-utility-v1915')||dateFields[1].nextElementSibling;
  if(anchor)toolbar.insertBefore(button,anchor);else toolbar.append(button);
  toolbar.insertBefore(advanced,button);
  dateFields.forEach(field=>advanced.append(field));
  function apply(open){
   advanced.hidden=!open;
   button.setAttribute('aria-expanded',String(open));
   button.textContent=open?'Recolher datas':'Filtrar por datas';
  }
  const hasDates=dateFields.some(field=>[...field.querySelectorAll('input')].some(input=>!!input.value));
  button.addEventListener('click',()=>apply(advanced.hidden));
  apply(hasDates);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
