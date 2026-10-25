/* ArtEssencia — organização do editor sem substituir campos ou handlers. */
(function(){'use strict';
function init(){
 const root=document.getElementById('products'),editor=root?.querySelector('.products-form-card'),nav=editor?.querySelector('.product-editor-nav-v1762');
 if(!editor||!nav||document.getElementById('aeProductEditorGuide'))return;
 const panel=key=>editor.querySelector('[data-product-panel="'+key+'"]');
 const photo=editor.querySelector('.product-photo-section-v1726');
 if(!photo||!panel('public')||!panel('production'))return;
 // Move the original nodes: selected files, listeners and field identities survive.
 const photos=document.createElement('div');photos.className='product-editor-panel-v1762';photos.dataset.productPanel='photos';
 panel('identity').after(photos);photos.append(photo);
 const photoButton=document.createElement('button');photoButton.type='button';photoButton.dataset.productPanelBtn='photos';
 photoButton.innerHTML='<b>2</b><span>Fotografias</span><small>Imagem e galeria</small>';
 photoButton.addEventListener('click',()=>showProductPanelV1762('photos'));nav.append(photoButton);
 const bridge=document.getElementById('prodTechSheetBridge');if(bridge)panel('production').prepend(bridge);
 const status=document.getElementById('productPublicStatusV1850');if(status)panel('public').prepend(status);
 const steps={identity:['Identificação','Nome, tipo e disponibilidade.'],photos:['Fotografias','Escolhe uma fotografia, confirma a pré-visualização e carrega-a para a Cloud antes de guardar.'],production:['Ficha técnica','Consulta a composição e os parâmetros de produção.'],pricing:['Preços','Confirma os custos, a margem e o preço de venda.'],public:['Publicação','Revê a descrição, a personalização e os canais de publicação.']};
 Object.entries(steps).forEach(([key,data],i)=>{
  const button=nav.querySelector('[data-product-panel-btn="'+key+'"]'),section=panel(key);
  nav.append(button);button.querySelector('b').textContent=String(i+1);button.querySelector('span').textContent=data[0];
  if(key==='identity')button.querySelector('small').textContent='Dados base';
  if(key==='production')button.querySelector('small').textContent='Composição e produção';
  button.id='ae-product-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','ae-product-panel-'+key);
  section.id='ae-product-panel-'+key;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',button.id);
  const divider=section.querySelector('.product-section-divider-v1748 > span');if(divider)divider.textContent=String(i+1);
 });
 const guide=document.createElement('div');guide.id='aeProductEditorGuide';guide.className='ae-product-editor-guide';
 const heading=document.createElement('strong'),hint=document.createElement('span');guide.append(heading,hint);nav.after(guide);
 function update(){
  const key=nav.querySelector('[data-product-panel-btn].active')?.dataset.productPanelBtn||'identity';
  const data=steps[key]||steps.identity;heading.textContent=data[0];hint.textContent=data[1];
 }
 nav.addEventListener('keydown',event=>{
  const buttons=[...nav.querySelectorAll('[data-product-panel-btn]')],index=buttons.indexOf(event.target);
  if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  buttons[next].click();buttons[next].focus();
 });
 new MutationObserver(update).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 restoreProductPanelV1762();update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
