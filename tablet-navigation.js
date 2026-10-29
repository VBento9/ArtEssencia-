// Tablet-only presentation state: never persists or modifies business data.
(function () {
 'use strict';
 function init() {
  const heading=document.querySelector('.page-heading'), sidebar=document.querySelector('.sidebar');
  if(!heading||!sidebar||document.getElementById('aeTabletMenu'))return;
  const tablet=window.matchMedia('(min-width:651px) and (max-width:1250px)');
  const button=document.createElement('button');
  button.id='aeTabletMenu';button.type='button';button.className='btn';
  sidebar.id=sidebar.id||'aeSidebar';button.setAttribute('aria-controls',sidebar.id);
  function sync(){
   if(!tablet.matches)document.body.classList.remove('ae-tablet-menu-collapsed');
   const collapsed=document.body.classList.contains('ae-tablet-menu-collapsed');
   button.hidden=!tablet.matches;
   button.textContent=collapsed?'Mostrar menu lateral':'Recolher menu lateral';
   button.setAttribute('aria-expanded',String(!collapsed));
  }
  button.addEventListener('click',()=>{if(!tablet.matches)return;document.body.classList.toggle('ae-tablet-menu-collapsed');sync()});
  tablet.addEventListener('change',sync);heading.append(button);sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
