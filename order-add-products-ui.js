/* ArtEssencia 1.9.160 — acrescentar artigos a encomendas ainda não iniciadas.
 * Não cria encomendas, altera pagamentos nem consulta a Loja Online.
 * Mantém as escolhas de cada unidade como dados estruturados na linha. */
(()=>{
 'use strict';
 const VERSION='19160';
 const ALLOWED_STATUS=new Set(['Pedido','Confirmada']);
 const $=(selector,root=document)=>root.querySelector(selector);
 const txt=(value)=>String(value==null?'':value).trim();
 const normal=(value)=>txt(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
 const arr=(value)=>Array.isArray(value)?value:[];
 const euroLocal=(v)=>Number(v||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
 const create=(tag,className,textValue)=>{
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(textValue!==undefined)n.textContent=textValue;
  return n;
 };
 const activeProduct=(product)=>!!product&&
  (typeof productUsableV1803==='function'?productUsableV1803(product):product.active!==false&&!product.archivedV1803);
 const productFor=(code)=>(db.products||[]).find(p=>String(p.code||'')===String(code||''));
 const profileOf=(product)=>product?.personalizationV1773||product?.personalization||{};
 const distinctNames=(list)=>[...new Set(arr(list).map(v=>txt(typeof v==='string'?v:v?.name||v?.label||'')).filter(Boolean))];
 const master=()=>{
  const cfg=db.settings?.personalizationLibraryV1791||{};
  return {colors:distinctNames(cfg.colors),fragrances:distinctNames(cfg.fragrances)};
 };
 function canAdd(order){
  if(!order||order.source==='online_store'||order.voidedAt||order.deletedAt||order.deleted||order.clientDeleted)return false;
  if(!ALLOWED_STATUS.has(txt(order.status||'Pedido')))return false;
  return !isOrderProduced(order.id);
 }
 window.canAddProductsToOrderV19160=canAdd;
 let activeDialog=null;
 function field(label,control){
  const n=create('label','ae-order-add-field-v19160');
  n.append(create('span','',label),control);
  return n;
 }
 function choices(list,selected,includeNone=false){
  const select=create('select');
  const option=(value,caption)=>{
   const o=create('option','',caption);o.value=value;select.append(o);
  };
  option('','Por definir');
  distinctNames(list).forEach(v=>option(v,v));
  if(includeNone)option('Sem fragrância','Sem fragrância');
  if(selected&&!Array.from(select.options).some(o=>o.value===selected))option(selected,selected+' (valor anterior)');
  select.value=selected||'';
  return select;
 }
 function createDraft(product){
  return {code:String(product.code),qty:1,colors:[],fragrance:'',notes:'',colorLabels:[]};
 }
 function buildLine(product,draft){
  if(!activeProduct(product))throw new Error('Produto indisponível: '+txt(product?.name||draft.code));
  const qty=Number(draft.qty);
  if(!Number.isSafeInteger(qty)||qty<1||qty>999)throw new Error('A quantidade deve estar entre 1 e 999.');
  const price=Number(product.price);
  if(!Number.isFinite(price)||price<0)throw new Error('O produto não tem um preço válido.');
  const ep=effectiveProduct(product);
  const raw={
   code:product.code,name:product.name,category:product.category||'',
   qty,price,cost:Number(ep.cost)||0,
   directSaleOptionsV19158:{
    colors:arr(draft.colors).map(v=>txt(v)),
    colorLabels:arr(draft.colorLabels).map(v=>txt(v)),
    fragrance:txt(draft.fragrance),notes:txt(draft.notes),open:false
   }
  };
  return ensureLineDetailedCostSnapshotV1769(
   ensureLineCostSnapshotV134(raw,'order_add_v19160'),'order_add_v19160');
 }
 function renderDraftCard(dialog,draft,index,onDelete,onUpdate){
  const product=productFor(draft.code);
  const article=create('article','ae-order-add-line-v19160');
  const head=create('div','ae-order-add-line-head-v19160');
  const name=create('strong','',txt(product?.name||draft.code));
  const remove=create('button','btn ghost','Remover');
  remove.type='button';remove.addEventListener('click',()=>onDelete(index));
  head.append(name,remove);article.append(head);
  const controls=create('div','ae-order-add-controls-v19160');
  const qty=create('input');qty.type='number';qty.min='1';qty.max='999';qty.step='1';qty.value=String(draft.qty);
  qty.addEventListener('input',()=>{draft.qty=qty.value;onUpdate()});
  controls.append(field('Quantidade',qty));
  const p=profileOf(product),colors=p.colors||{},fr=p.fragrance||{},library=master();
  const declared=Object.prototype.hasOwnProperty.call(colors,'max');
  const numberOfColors=colors.enabled===false||(declared&&Number(colors.max)===0)?
   0:Math.min(3,Math.max(1,Number(colors.max)||1));
  const names=Array.isArray(colors.labels)?colors.labels:[];
  const palette=arr(colors.palette).length?colors.palette:library.colors;
  for(let j=0;j<numberOfColors;j++){
   const label=txt(names[j])||(numberOfColors===1?'Cor (se aplicável)':'Cor '+(j+1));
   draft.colorLabels[j]=label;
   const select=choices(palette,draft.colors[j]||'');
   select.addEventListener('change',()=>{draft.colors[j]=select.value;onUpdate()});
   controls.append(field(label,select));
  }
  if(fr.enabled!==false){
   const frList=arr(fr.options).length?fr.options:library.fragrances;
   const select=choices(frList,draft.fragrance,true);
   select.addEventListener('change',()=>{draft.fragrance=select.value;onUpdate()});
   controls.append(field('Fragrância (se aplicável)',select));
  }
  const instructions=create('textarea');instructions.rows=2;
  instructions.placeholder='Inscrições, disposição das cores ou acabamentos';
  instructions.value=draft.notes||'';
  instructions.addEventListener('input',()=>{draft.notes=instructions.value;onUpdate()});
  const note=field('Instruções deste artigo',instructions);
  note.classList.add('ae-order-add-notes-v19160');
  controls.append(note);article.append(controls);
  return article;
 }
 function open(orderId){
  if(activeDialog?.open)return;
  const order=(db.orders||[]).find(o=>String(o.id)===String(orderId));
  if(!canAdd(order))return toast('Só podes acrescentar artigos antes de iniciar a produção.');
  const dialog=create('dialog','ae-order-add-dialog-v19160');
  dialog.setAttribute('aria-label','Adicionar artigos à encomenda');
  dialog.innerHTML='<div class="ae-order-add-shell-v19160">'+
   '<header class="ae-order-add-header-v19160"><div><h2>Adicionar artigos</h2><p>Encomenda existente · mantém cliente, notas e pagamentos.</p></div><button class="ae-order-add-close-v19160" type="button" aria-label="Fechar">×</button></header>'+
   '<div class="ae-order-add-body-v19160">'+
   '<label class="ae-order-add-field-v19160"><span>Pesquisar produtos</span><input data-ae-order-search-v19160 type="search" autocomplete="off" placeholder="Nome ou referência do produto"></label>'+
   '<div class="ae-order-add-results-v19160" data-ae-order-results-v19160></div>'+
   '<h3>Artigos a acrescentar</h3><div data-ae-order-drafts-v19160 class="ae-order-add-drafts-v19160"></div></div>'+
   '<div class="ae-order-add-footer-v19160"><div data-ae-order-total-v19160 aria-live="polite"></div><div class="ae-order-add-actions-v19160"><button type="button" class="btn ghost" data-ae-order-cancel-v19160>Cancelar</button><button type="button" class="btn primary" data-ae-order-confirm-v19160>Guardar artigos</button></div></div></div>';
  document.body.append(dialog);activeDialog=dialog;
  const drafts=[],search=$('[data-ae-order-search-v19160]',dialog),results=$('[data-ae-order-results-v19160]',dialog),
   rows=$('[data-ae-order-drafts-v19160]',dialog),total=$('[data-ae-order-total-v19160]',dialog),
   confirm=$('[data-ae-order-confirm-v19160]',dialog);
  let submitting=false;
  const close=()=>{if(submitting)return;dialog.close();dialog.remove();if(activeDialog===dialog)activeDialog=null};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  $('.ae-order-add-close-v19160',dialog).addEventListener('click',close);
  $('[data-ae-order-cancel-v19160]',dialog).addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  function updateSummary(){
   const delta=drafts.reduce((sum,draft)=>{
    const p=productFor(draft.code),qty=Number(draft.qty);
    return sum+(p&&Number.isFinite(qty)&&qty>=1?Number(p.price||0)*qty:0);
   },0);
   const old=calcOrder(order);
   total.textContent=drafts.length+
    ' artigo(s) · Acrescentar '+euroLocal(delta)+' · Novo total '+euroLocal(old.total+delta)+
    ' · Por pagar '+euroLocal(Math.max(0,old.total+delta-(Number(order.paid)||0)));
   confirm.disabled=!drafts.length||submitting;
  }
  function renderDrafts(){
   rows.replaceChildren();
   if(!drafts.length)rows.append(create('p','ae-order-add-empty-v19160','Seleciona um ou mais produtos acima.'));
   drafts.forEach((draft,index)=>rows.append(
    renderDraftCard(dialog,draft,index,i=>{drafts.splice(i,1);renderDrafts()},updateSummary)));
   updateSummary();
  }
  function renderResults(){
   results.replaceChildren();
   const query=normal(search.value);
   const products=(db.products||[]).filter(p=>
    activeProduct(p)&&p.code&&(!query||normal(p.name).includes(query)||normal(p.code).includes(query))
   ).slice(0,20);
   if(!products.length)results.append(create('span','ae-order-add-empty-v19160','Nenhum produto disponível.'));
   products.forEach(product=>{
    const btn=create('button','ae-order-add-product-v19160');
    btn.type='button';
    btn.append(create('strong','',txt(product.name||product.code)),
               create('small','',txt(product.code)+' · '+euroLocal(product.price)));
    btn.addEventListener('click',()=>{
     drafts.push(createDraft(product));renderDrafts();search.value='';renderResults();
     rows.lastElementChild?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    results.append(btn);
   });
  }
  confirm.addEventListener('click',()=>{
   if(submitting||!drafts.length)return;
   const freshOrder=(db.orders||[]).find(o=>String(o.id)===String(orderId));
   if(!canAdd(freshOrder)){
    toast('A produção foi iniciada ou o estado da encomenda mudou. Não foram acrescentados artigos.');
    close();return;
   }
   let newLines;
   try{newLines=drafts.map(d=>buildLine(productFor(d.code),d))}
   catch(error){toast(error.message||'Confirma os artigos e quantidades.');return}

   const oldItems=arr(freshOrder.items),oldSubtotal=freshOrder.subtotal,oldTotal=freshOrder.total;
   submitting=true;confirm.disabled=true;
   try{
    freshOrder.items=oldItems.concat(newLines);
    freshOrder.subtotal=freshOrder.items.reduce((sum,line)=>sum+(Number(line.qty)||0)*(Number(line.price)||0),0);
    freshOrder.total=calcOrder(freshOrder).total;
    if(!save())throw new Error('Não foi possível confirmar a gravação local. Os artigos não foram acrescentados.');
    relMarkOrderPending(freshOrder);
    dialog.close();dialog.remove();activeDialog=null;
    showOrder(freshOrder.id);
    toast(newLines.length+' artigo(s) acrescentado(s) à encomenda. Sincronização Cloud pendente de confirmação.');
   }catch(error){
    freshOrder.items=oldItems;freshOrder.subtotal=oldSubtotal;freshOrder.total=oldTotal;
    toast(error.message||'Não foi possível guardar os artigos.');
   }finally{submitting=false;confirm.disabled=!drafts.length}
  });
  search.addEventListener('input',renderResults);
  search.addEventListener('search',renderResults);
  renderResults();renderDrafts();dialog.showModal();search.focus();
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-existing-order-add-v19160]');
  if(target){event.preventDefault();open(target.getAttribute('data-existing-order-add-v19160'))}
 });
 window.openExistingOrderAddProductsV19160=open;
})();
