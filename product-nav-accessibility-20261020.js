/* Melhoria de navegação dos Produtos. Não substitui showProductPanelV1762 nem altera formulários. */
(()=>{'use strict';
function init(){
 const nav=document.querySelector('#products .product-editor-nav-v1762');
 if(!nav||nav.dataset.aeEnhanced==='1')return;
 nav.dataset.aeEnhanced='1';
 const buttons=Array.from(nav.querySelectorAll('button[data-product-panel-btn]'));
 if(!buttons.length)return;
 const css=document.createElement('style');css.id='ae-product-nav-safe-style';
 css.textContent='#products .product-editor-nav-v1762{scrollbar-width:thin}#products .product-editor-nav-v1762 button:focus-visible{outline:3px solid #a76f3e;outline-offset:2px}@media(max-width:700px){#products .product-editor-nav-v1762{display:flex;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;gap:6px;max-width:100%;padding:6px;top:58px}#products .product-editor-nav-v1762 button{flex:0 0 auto;min-width:126px;min-height:44px;scroll-snap-align:start;padding:7px 9px;grid-template-columns:24px 1fr}#products .product-editor-nav-v1762 button b{width:24px;height:24px}#products .product-editor-nav-v1762 button small{display:none}}@media(min-width:701px) and (max-width:1150px){#products .product-editor-nav-v1762{gap:5px;padding:5px}#products .product-editor-nav-v1762 button{min-height:48px;padding:7px}#products .product-editor-nav-v1762 button small{font-size:9px}}';
 document.head.appendChild(css);
 function sync(){
  for(const b of buttons){const active=b.classList.contains('active');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
 }
 nav.setAttribute('aria-label','Separadores do produto');
 buttons.forEach((b,i)=>{
  b.addEventListener('click',sync);
  b.addEventListener('keydown',e=>{
   if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
   e.preventDefault();
   const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   buttons[next].click();
   buttons[next].focus({preventScroll:true});
   buttons[next].scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
   sync();
  });
 });
 const observer=new MutationObserver(sync);observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();