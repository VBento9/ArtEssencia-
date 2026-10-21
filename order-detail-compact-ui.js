/* Order detail progressive disclosure; no business operation is altered. */
(function(){'use strict';
function init(){
 const root=document.getElementById('orderDetail');if(!root)return;
 function decorate(){
  for(const heading of [...root.querySelectorAll('.section-title')]){
   const label=(heading.textContent||'').trim();
   if(!['Histórico de estados','Anulação / eliminação'].includes(label)||heading.dataset.aeCompact)return;
   heading.dataset.aeCompact='1';
   const btn=document.createElement('button');btn.type='button';btn.className='ae-order-detail-toggle';btn.textContent=label+' ▾';btn.setAttribute('aria-expanded','false');
   const segments=[];let next=heading.nextElementSibling;
   while(next&&!next.classList.contains('section-title')){segments.push(next);next=next.nextElementSibling}
   if(!segments.length)continue;
   heading.textContent='';heading.append(btn);
   function show(open){for(const node of segments)node.classList.toggle('ae-order-detail-collapsed',!open);btn.setAttribute('aria-expanded',String(open));btn.textContent=label+(open?' ▴':' ▾')}
   btn.addEventListener('click',()=>show(btn.getAttribute('aria-expanded')!=='true'));
   show(false);
  }
 }
 new MutationObserver(decorate).observe(root,{childList:true});
 decorate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();