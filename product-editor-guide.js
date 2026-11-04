/* ArtEssencia — organização do editor sem substituir campos ou handlers. */
(function(){'use strict';
const aeTechNotesModels={"wax_mold":["Confirmar o molde limpo e seco. Pesar cera, corante e fragrância segundo a receita. Preparar e verter respeitando as recomendações dos materiais; deixar solidificar, desenformar, finalizar e respeitar a cura.","Conferir peso, composição, fissuras, bolhas, detalhes, cor e acabamento. Confirmar estabilidade, rotulagem, embalagem e adequação dos ensaios de queima."],"wax_container":["Confirmar recipiente limpo e íntegro; fixar o pavio apropriado. Pesar os componentes e preparar e verter conforme as especificações. Deixar arrefecer e curar, aparar o pavio e finalizar.","Verificar integridade do recipiente, pavio firme e centrado, superfície, peso e acabamento. Confirmar identificação, embalagem e ensaios de queima adequados."],"wax_melt":["Preparar molde e matérias-primas conforme a receita. Fundir a cera, adicionar os ingredientes segundo as recomendações e verter. Deixar solidificar, desenformar e embalar.","Verificar peso por unidade, homogeneidade, cor, fragrância e ausência de fissuras ou deformações. Confirmar rotulagem e embalagem."],"soap":["Confirmar a fórmula e a adequação dos ingredientes ao uso previsto. Preparar a base e aditivos conforme os fornecedores, misturar, moldar e deixar estabilizar. Desenformar e proteger da humidade.","Verificar peso, aspeto, integridade e ausência de impurezas. Confirmar fórmula, lote e requisitos de rotulagem aplicáveis antes da venda."],"resin":["Preparar o molde e usar a proteção indicada. Pesar e misturar os componentes conforme as proporções do fabricante, verter e reduzir bolhas. Respeitar a cura, desenformar e finalizar.","Verificar cura, estabilidade, dimensões, bolhas, fissuras e acabamento. Não declarar contacto alimentar ou resistência ao calor sem validação."],"laser":["Confirmar desenho, medidas e compatibilidade do material. Preparar equipamento e ventilação; gravar sob supervisão, limpar e finalizar a peça.","Verificar posicionamento, legibilidade, contraste e ausência de danos. Confirmar o pedido e o acabamento antes de embalar."],"assembly":["Conferir pedido, componentes, medidas e personalização. Montar, fixar e finalizar de acordo com o modelo e embalar.","Conferir quantidades, fixações, dimensões, personalização, estabilidade e acabamento. Confirmar correspondência à encomenda."],"other":["Conferir materiais e preparar o posto de trabalho. Executar as etapas específicas do produto conforme as instruções dos fornecedores. Finalizar e embalar.","Conferir materiais, quantidades, integridade, acabamento, identificação e segurança de utilização."]};
function installTechnicalNotesDefaults(editor){
 const process=document.getElementById('prodProductionTypeV130'),prod=document.getElementById('prodProductionNotesV130'),quality=document.getElementById('prodQualityNotesV130');
 if(!process||!prod||!quality)return;
 const fields=[prod,quality],generated=['',''],manual=[false,false];
 const editing=()=>typeof editingProductCodeV147!=='undefined'&&!!editingProductCodeV147;
 function seed(){
  const texts=aeTechNotesModels[process.value]||aeTechNotesModels.other;
  let filled=false;
  fields.forEach((field,i)=>{
   if(manual[i])return;
   const current=String(field.value||'');
   // Preenche campos vazios também ao editar; preserva textos próprios já guardados.
   if(current.trim()&&current!==generated[i])return;
   const suggested=texts[i];
   if(current!==suggested){field.value=suggested;filled=true}
   generated[i]=suggested;
  });
  if(filled&&editing())editor.dispatchEvent(new Event('artessencia:technical-notes-auto-filled'));
 }
 function resetSession(){
  manual.fill(false);
  generated.fill('');
  editor.dispatchEvent(new Event('artessencia:product-editor-session'));
  // editProduct() carrega os valores guardados antes da execução deste observador.
  seed();
 }
 fields.forEach((field,i)=>field.addEventListener('input',()=>{manual[i]=true}));
 editor.addEventListener('change',event=>{
  if(['prodCat','prodProductionTypeV130'].includes(event.target?.id))seed();
 });
 const title=document.getElementById('productEditorTitleV145');
 if(title)new MutationObserver(resetSession).observe(title,{childList:true,subtree:true,characterData:true});
 const nav=editor.querySelector('.product-editor-nav-v1762');
 if(nav)nav.addEventListener('click',event=>{
  if(event.target.closest('[data-product-panel-btn="production"]'))seed();
 });
 window.addEventListener('pageshow',seed);
 resetSession();
}
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
 // O botão deve estar disponível no passo 3 mesmo antes do primeiro render.
 const bridge=document.getElementById('prodTechSheetBridge');
 if(bridge){
  const production=panel('production');
  if(bridge.parentElement!==production)production.prepend(bridge);
  bridge.style.removeProperty('display');
  const action=bridge.querySelector('#prodTechSheetBtn');
  if(action){action.classList.remove('ghost');action.classList.add('primary');action.type='button'}
 }
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
 const copy=document.createElement('div');copy.className='ae-editor-guide-copy';
 const progress=document.createElement('span');progress.className='ae-editor-progress';progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');
 const heading=document.createElement('strong'),hint=document.createElement('span');
 // A orientação completa continua disponível sem ocupar altura permanente.
 const details=document.createElement('details');details.className='ae-editor-step-help';
 const summary=document.createElement('summary');summary.textContent='Orientação deste passo';
 details.append(summary,hint);copy.append(progress,heading,details);
 const controls=document.createElement('div');controls.className='ae-editor-step-actions';controls.setAttribute('role','group');controls.setAttribute('aria-label','Navegação dos passos do editor');
 const previous=document.createElement('button');previous.type='button';previous.className='btn ghost';previous.textContent='← Anterior';previous.setAttribute('aria-label','Passo anterior do editor');
 const next=document.createElement('button');next.type='button';next.className='btn ghost';next.textContent='Próximo →';next.setAttribute('aria-label','Próximo passo do editor');
 controls.append(previous,next);guide.append(copy,controls);nav.after(guide);
 const navButtons=[...nav.querySelectorAll('[data-product-panel-btn]')];
 let previousKey='';
 function currentStep(){
  const active=nav.querySelector('[data-product-panel-btn].active');
  const index=navButtons.indexOf(active);
  return Math.max(0,index);
 }
 function activateAdjacent(delta){
  const nextIndex=Math.max(0,Math.min(navButtons.length-1,currentStep()+delta));
  const button=navButtons[nextIndex];
  if(!button)return;
  // O próprio botão original escolhe o painel: não tocar em dados ou handlers.
  button.click();
  const target=button.getBoundingClientRect(),reference=nav.getBoundingClientRect();
  if(nav.scrollWidth>nav.clientWidth&&typeof nav.scrollTo==='function'){
   nav.scrollTo({left:Math.max(0,nav.scrollLeft+target.left-reference.left-(nav.clientWidth-target.width)/2),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  guide.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 }
 previous.addEventListener('click',()=>activateAdjacent(-1));
 next.addEventListener('click',()=>activateAdjacent(1));
 function update(){
  const index=currentStep(),active=navButtons[index];
  const key=active?.dataset.productPanelBtn||'identity',data=steps[key]||steps.identity;
  progress.textContent='Passo '+(index+1)+' de '+navButtons.length;
  heading.textContent=data[0];hint.textContent=data[1];
  previous.disabled=index===0;next.disabled=index===navButtons.length-1;
  if(previousKey!==key)details.open=false;
  if(previousKey!==key&&typeof renderQuickNav==='function')renderQuickNav(key);
  navButtons.forEach((button,i)=>{
   const selected=i===index;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  if(previousKey!==key&&active){
   previousKey=key;
   if(nav.scrollWidth>nav.clientWidth&&typeof nav.scrollTo==='function'){
    const tab=active.getBoundingClientRect(),bounds=nav.getBoundingClientRect();
    nav.scrollTo({left:Math.max(0,nav.scrollLeft+tab.left-bounds.left-(nav.clientWidth-tab.width)/2),behavior:'auto'});
   }
  }
 }

 // Navegação interna não destrutiva nas duas etapas mais longas.
 // Atua apenas nos títulos/controles existentes e não toca em valores ou gravação.
 const quickNav=document.createElement('nav');
 quickNav.className='ae-editor-section-jump';
 quickNav.setAttribute('aria-label','Ir para uma área do passo atual');
 const quickHeading=document.createElement('span');
 quickHeading.className='ae-editor-section-jump-label';quickHeading.textContent='Nesta etapa';
 const quickList=document.createElement('div');quickList.className='ae-editor-section-links';
 const quickTop=document.createElement('button');
 quickTop.type='button';quickTop.className='ae-editor-section-top';quickTop.textContent='↑ Início do passo';
 quickTop.addEventListener('click',()=>{
  const key=navButtons[currentStep()]?.dataset.productPanelBtn;
  const destination=key&&panel(key);
  if(destination)destination.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
 quickNav.append(quickHeading,quickList,quickTop);guide.after(quickNav);
 const quickTargets={
  production:[
   ['Ficha técnica','#prodTechSheetBridge'],
   ['Parâmetros de produção','#prodProductionTypeV130'],
   ['Instruções de produção','#prodProductionNotesV130'],
   ['Controlo de qualidade','#prodQualityNotesV130']
  ],
  public:[
   ['Estado de publicação','#productPublicStatusV1850'],
   ['Descrição e apresentação','#prodDescription'],
   ['Fotografias e texto público','#descriptionPhotoAnalyzeV1890']
  ]
 };
 function renderQuickNav(key){
  quickList.replaceChildren();
  quickNav.hidden=!['production','public'].includes(key);
  if(quickNav.hidden)return;
  const targetPanel=panel(key),seen=new Set(),seenLabels=new Set();
  if(!targetPanel)return;
  const direct=(quickTargets[key]||[]).map(([label,selector])=>({label,el:targetPanel.querySelector(selector)})).filter(({el})=>!!el);
  const headings=[...targetPanel.querySelectorAll('h3,h4,legend,.product-section-title-v1748,.product-section-divider-v1748')].map(el=>({el,label:String(el.textContent||'').trim().replace(/\s+/g,' ')})).filter(x=>x.label.length>=4&&x.label.length<=66);
  const entries=[...direct,...headings];
  for(const {label,el} of entries){
   if(!el||seen.has(el))continue;
   const normalized=label.toLocaleLowerCase('pt-PT').replace(/\s+/g,' ').trim();
   if(seenLabels.has(normalized))continue;
   seen.add(el);seenLabels.add(normalized);
   if(quickList.childElementCount>=5)break;
   const button=document.createElement('button');button.type='button';button.className='ae-editor-section-link';
   button.textContent=label;
   button.addEventListener('click',()=>{
    // Scroll ao título/campo real, sem fechar painéis ou ativar gravações.
    el.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const focusable=el.matches('input,textarea,select,button')?el:null;
    if(focusable)focusable.focus({preventScroll:true});
   });
   quickList.append(button);
  }
  if(!quickList.childElementCount){
   const empty=document.createElement('span');empty.className='ae-editor-section-empty';
   empty.textContent='Consulta os campos desta etapa abaixo.';
   quickList.append(empty);
  }
 }

 nav.addEventListener('click',event=>{
  const selected=event.target.closest('[data-product-panel-btn]');
  if(selected)requestAnimationFrame(()=>renderQuickNav(selected.dataset.productPanelBtn));
  if(event.target.closest('[data-product-panel-btn="production"]')&&typeof refreshProductTechSheetBridgeV1250==='function')
   refreshProductTechSheetBridgeV1250();
 });
 nav.addEventListener('keydown',event=>{
  const buttons=[...nav.querySelectorAll('[data-product-panel-btn]')],index=buttons.indexOf(event.target);
  if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  buttons[next].click();buttons[next].focus();
 });
 new MutationObserver(update).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});

 // Preserva o rascunho dos produtos novos; para os existentes, abre a ficha correta em Custos.
 const techButton=document.getElementById('prodTechSheetBtn');
 if(techButton){
  let changedProductCode='';
  editor.addEventListener('artessencia:product-editor-session',()=>{changedProductCode=''});
  editor.addEventListener('artessencia:technical-notes-auto-filled',()=>{
   const code=typeof editingProductCodeV147!=='undefined'?String(editingProductCodeV147||''):'';
   if(code)changedProductCode=code;
  });
  const markEditorChange=event=>{
   if(!event.isTrusted)return;
   const code=typeof editingProductCodeV147!=='undefined'?String(editingProductCodeV147||''):'';
   if(code)changedProductCode=code;
  };
  editor.addEventListener('input',markEditorChange,true);
  editor.addEventListener('change',markEditorChange,true);
  techButton.onclick=()=>{
   const code=typeof editingProductCodeV147!=='undefined'?String(editingProductCodeV147||''):'';
   const saved=code&&typeof findProductByCodeV147==='function'?findProductByCodeV147(code):null;
   if(!saved){
    if(typeof openProductTechSheetV1250==='function')openProductTechSheetV1250();
    return;
   }
   if(changedProductCode===code&&!confirm('Existem alterações neste produto que podem não estar guardadas. Queres sair do editor e abrir a ficha técnica em Custos?'))return;
   if(typeof go!=='function')return;
   go('costs');
   if(typeof showCostTabV1927==='function')showCostTabV1927('recipes');
   const select=document.getElementById('costProduct');
   if(!select){
    if(typeof toast==='function')toast('Não foi possível abrir o seletor de fichas técnicas.');
    return;
   }
   if(!Array.from(select.options).some(option=>option.value===code))select.add(new Option(saved.name||code,code));
   if(typeof chooseRecipeProductV1763==='function')chooseRecipeProductV1763(code);
   else{
    select.value=code;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    if(typeof renderProductRecipeEditor==='function')renderProductRecipeEditor();
   }
   requestAnimationFrame(()=>{
    document.getElementById('costPanelrecipes')?.scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('recipeProductChoiceV1763')?.focus({preventScroll:true});
   });
  };
 }
 installTechnicalNotesDefaults(editor);
 restoreProductPanelV1762();update();
 renderQuickNav(navButtons[currentStep()]?.dataset.productPanelBtn||'identity');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
