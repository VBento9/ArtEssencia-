/* ArtEssencia — guia não destrutivo do editor existente. */
(function(){'use strict';
function init(){
 const root=document.getElementById('products'),editor=root?.querySelector('.products-form-card'),nav=editor?.querySelector('.product-editor-nav-v1762');
 if(!editor||!nav||document.getElementById('aeProductEditorGuide'))return;
 const guide=document.createElement('div');guide.id='aeProductEditorGuide';guide.className='ae-product-editor-guide';
 const heading=document.createElement('strong'),hint=document.createElement('span');
 const steps={identity:['Identificação','Começa pelo nome e tipo. Liga a ficha técnica sem sair deste editor.'],pricing:['Custos e PVP','Confirma a margem e o preço. Os cálculos existentes mantêm-se.'],production:['Produção','Define o processo, a cura e os parâmetros aplicáveis.'],public:['Apresentação pública','Revisa fotografias, personalização e visibilidade no Catálogo.']};
 guide.append(heading,hint);nav.after(guide);
 function update(){
  const active=nav.querySelector('[data-product-panel-btn].active')||nav.querySelector('[data-product-panel-btn][aria-selected="true"]');
  const key=active?.getAttribute('data-product-panel-btn')||'identity';
  const data=steps[key]||steps.identity;heading.textContent=data[0];hint.textContent=data[1];
 }
 nav.addEventListener('click',()=>queueMicrotask(update));
 new MutationObserver(update).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
