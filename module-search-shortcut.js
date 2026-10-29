// Contextual navigation only. Keeps existing searches, filters and editor drafts.
(function(){
 'use strict';
 function init(){
  const heading=document.querySelector('.page-heading');
  if(!heading||document.getElementById('aeModuleSearch'))return;
  const fields={orders:['orderSearch','Pesquisar encomendas'],products:['productSearch','Pesquisar produtos'],stock:['stockSearch','Pesquisar stock'],clients:['clientSearch','Pesquisar clientes'],production:['prodDate','Escolher data de produção']};
  const button=document.createElement('button');button.id='aeModuleSearch';button.type='button';button.className='btn';
  function target(){const active=document.querySelector('.screen.active'),entry=fields[active?.id];return entry&&{id:active.id,input:document.getElementById(entry[0]),label:entry[1]}}
  function update(){const t=target();button.hidden=!t?.input;if(t?.input){button.textContent=t.label;button.setAttribute('aria-controls',t.input.id)}else button.removeAttribute('aria-controls')}
  button.addEventListener('click',()=>{
   const t=target();if(!t?.input)return;
   // Reuse the catalogue action so the compact editor retains its draft and state.
   if(t.id==='products'&&t.input.closest('[hidden]'))document.querySelector('#aeProductsCompact button')?.click();
   if(!t.input.getClientRects().length)return;
   t.input.focus({preventScroll:true});
   t.input.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  const actions=document.createElement('div');actions.className='ae-heading-actions';
  const menu=document.getElementById('aeTabletMenu');if(menu)actions.append(menu);
  actions.append(button);heading.append(actions);
  const observer=new MutationObserver(update);
  document.querySelectorAll('.screen').forEach(screen=>observer.observe(screen,{attributes:true,attributeFilter:['class']}));
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
