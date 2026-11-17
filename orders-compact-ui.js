/* ArtEssencia — Encomendas: apresentação e salvaguarda da identidade dos clientes. */
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


/* V1.9.157 — identidade do cliente nas encomendas; sem atualização automática de históricos. */
(function(){
 'use strict';
 function install(){
  if(window.__aeOrderClientIdentity19157)return;
  if(typeof upsertClientFromOrder!=='function'||typeof ensureClientsFromOrders!=='function'||typeof chooseSaleClientV1756!=='function')return;
  const nameInput=document.getElementById('saleClient');
  const matchBox=document.getElementById('saleClientMatchesV1756');
  if(!nameInput||!matchBox)return;
  window.__aeOrderClientIdentity19157=true;
  const normal=v=>String(v||'').trim().toLocaleLowerCase('pt-PT').replace(/\s+/g,' ');
  const safe=c=>c&&!isQuarantinedProductClient(c);
  const exact=name=>{
   const matches=(db.clients||[]).filter(c=>safe(c)&&normal(c.name)===normal(name));
   return matches.length===1?matches[0]:null;
  };
  const label=document.createElement('label');
  label.className='sale-client-new-v19157';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.id='saleNewClientV19157';
  label.append(checkbox,document.createTextNode(' Criar ficha independente, mesmo com nome ou contacto repetido'));
  matchBox.after(label);
  let selectedId='';
  nameInput.addEventListener('input',()=>{selectedId=''},true);
  checkbox.addEventListener('change',()=>{if(checkbox.checked)selectedId=''});
  const originalChoose=chooseSaleClientV1756,originalClear=clearSale;
  window.chooseSaleClientV1756=function(id){
   originalChoose(id);
   const c=(db.clients||[]).find(c=>safe(c)&&String(c.id)===String(id));
   selectedId=c?String(c.id):'';
   if(c)checkbox.checked=false;
  };
  window.clearSale=function(){
   selectedId='';checkbox.checked=false;
   return originalClear.apply(this,arguments);
  };
  window.ensureClientsFromOrders=function(){
   db.clients=db.clients||[];
   (db.orders||[]).forEach(order=>{
    if(!order.client||order.clientDeleted)return;
    if(order.clientId&&db.clients.some(c=>safe(c)&&String(c.id)===String(order.clientId)))return;
    const name=String(order.client).trim();
    let c=exact(name);
    if(!c){
     c={id:uid('CLI'),name,phone:order.contact||'',email:order.email||'',notes:'',created:order.created||todayISO(),source:order.source==='online_store'?'online_store':'order'};
     db.clients.push(c);
    }
    order.clientId=c.id;
   });
  };
  window.upsertClientFromOrder=function(name,contact,email=''){
   name=String(name||'').trim();if(!name)return null;
   db.clients=db.clients||[];
   let c=null;
   if(!checkbox.checked){
    c=(db.clients||[]).find(c=>safe(c)&&String(c.id)===selectedId&&normal(c.name)===normal(name))||exact(name);
   }
   selectedId='';
   const mail=String(email||'').trim().toLowerCase();
   if(c){
    if(!c.name)c.name=name;
    if(!c.phone&&contact)c.phone=contact;
    if(!c.email&&mail)c.email=mail;
    return c.id;
   }
   c={id:uid('CLI'),name,phone:contact||'',email:mail,notes:'',created:todayISO(),source:'order'};
   db.clients.push(c);
   return c.id;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
/* V1.9.158 — escolhas estruturadas por artigo, apenas em encomendas manuais.
   Os valores são guardados na própria linha e resumidos nas notas já impressas. */
(function(){
 'use strict';
 function install(){
  if(window.__aeDirectOrderOptions19158)return;
  if(typeof renderCart!=='function'||typeof saveOrder!=='function'||typeof cart==='undefined')return;
  const host=document.getElementById('cart'),notes=document.getElementById('saleNotes');
  if(!host||!notes)return;
  window.__aeDirectOrderOptions19158=true;
  const originalRender=renderCart;
  const normalized=v=>String(v||'').trim().toLocaleLowerCase('pt-PT');
  const product=line=>(db.products||[]).find(p=>String(p.code||'')===String(line.code||''))||null;
  const profile=line=>product(line)?.personalizationV1773||product(line)?.personalization||{};
  const master=()=>{
   const raw=db.settings?.personalizationLibraryV1791||{};
   return {colors:Array.isArray(raw.colors)?raw.colors:[],fragrances:Array.isArray(raw.fragrances)?raw.fragrances:[]};
  };
  const labelFor=(value)=>String(typeof value==='string'?value:value?.name||'').trim();
  const values=(list)=>[...new Set((Array.isArray(list)?list:[]).map(labelFor).filter(Boolean))];
  const pick=(title,list,current,onChange)=>{
   const label=document.createElement('label');label.className='ae-direct-option-field-v19158';
   const head=document.createElement('span');head.textContent=title;label.append(head);
   const select=document.createElement('select');
   const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)};
   option('','Por definir');
   values(list).forEach(v=>option(v,v));
   if(current&&!Array.from(select.options).some(x=>x.value===current))option(current,current+' (valor guardado)');
   select.value=current||'';
   select.addEventListener('change',()=>onChange(select.value));
   label.append(select);
   return label;
  };
  function renderOptions(){
   if(!document.getElementById('cart'))return;
   const rows=[...host.querySelectorAll(':scope > .sale-cart-row-v1754')];
   rows.forEach((row,index)=>{
    const line=cart[index];if(!line)return;
    const opts=line.directSaleOptionsV19158||(line.directSaleOptionsV19158={colors:[],fragrance:'',notes:'',open:false});
    const p=profile(line),co=p.colors||{},fr=p.fragrance||{},all=master();
    const slots=Math.min(3,Math.max(1,Number(co.max)||1));
    const colorValues=values(Array.isArray(co.palette)&&co.palette.length?co.palette:all.colors);
    const fragranceValues=values(Array.isArray(fr.options)&&fr.options.length?fr.options:all.fragrances);
    const details=document.createElement('details');
    details.className='ae-direct-order-options-v19158';
    details.open=!!opts.open;
    const summary=document.createElement('summary');
    const parts=[...(Array.isArray(opts.colors)?opts.colors:[]).filter(Boolean)];
    if(opts.fragrance)parts.push(opts.fragrance);
    summary.textContent='Cores e fragrância'+(parts.length?' · '+parts.join(' / '):' · por definir');
    details.append(summary);
    const content=document.createElement('div');content.className='ae-direct-order-options-content-v19158';
    for(let j=0;j<slots;j++){
     content.append(pick((Array.isArray(co.labels)&&co.labels[j])|| (slots===1?'Cor (se aplicável)':'Cor '+(j+1)),colorValues,opts.colors?.[j]||'',value=>{
      const o=line.directSaleOptionsV19158||(line.directSaleOptionsV19158={colors:[],fragrance:'',notes:''});
      if(!Array.isArray(o.colors))o.colors=[];
      o.colorLabels=Array.isArray(co.labels)?co.labels.slice(0,3):[];
      o.colors[j]=value;
      summary.textContent='Cores e fragrância · '+([...(o.colors||[]).filter(Boolean),o.fragrance].filter(Boolean).join(' / ')||'por definir');
     }));
    }
    content.append(pick('Fragrância (se aplicável)',fragranceValues.concat(['Sem fragrância']),opts.fragrance||'',value=>{
     const o=line.directSaleOptionsV19158||(line.directSaleOptionsV19158={colors:[],fragrance:'',notes:''});
     o.fragrance=value;
     summary.textContent='Cores e fragrância · '+([...(o.colors||[]).filter(Boolean),o.fragrance].filter(Boolean).join(' / ')||'por definir');
    }));
    const notesLabel=document.createElement('label');notesLabel.className='ae-direct-option-field-v19158';
    const noteTitle=document.createElement('span');noteTitle.textContent='Instruções específicas deste artigo';
    const note=document.createElement('textarea');note.rows=2;note.placeholder='Ex.: posição das cores, inscrição, acabamento';
    note.value=opts.notes||'';
    note.addEventListener('input',()=>{const o=line.directSaleOptionsV19158||(line.directSaleOptionsV19158={colors:[],fragrance:'',notes:''});o.notes=note.value});
    notesLabel.append(noteTitle,note);content.append(notesLabel);
    if(Number(line.qty)>1){
     const split=document.createElement('button');split.type='button';split.className='btn ghost';split.textContent='Separar 1 unidade para personalizar de forma diferente';
     split.addEventListener('click',()=>{
      if(Number(line.qty)<=1)return;
      line.qty=Number(line.qty)-1;
      const other={...line,qty:1,directSaleOptionsV19158:{colors:[],fragrance:'',notes:'',open:true}};
      cart.splice(index+1,0,other);
      renderCart();
     });
     content.append(split);
    }
    details.append(content);
    details.addEventListener('toggle',()=>{const o=line.directSaleOptionsV19158||(line.directSaleOptionsV19158={colors:[],fragrance:'',notes:''});o.open=details.open});
    row.after(details);
   });
  }
  window.renderCart=function(...args){const result=originalRender.apply(this,args);renderOptions();return result};
  window.setDirectOrderLineQtyV19158=function(index,nextValue){
   const line=cart[index];if(!line)return;
   const oldQty=Math.max(1,Number(line.qty)||1),nextQty=Math.max(1,Math.floor(Number(nextValue)||1));
   const opt=line.directSaleOptionsV19158||{};
   const chosen=(Array.isArray(opt.colors)&&opt.colors.some(Boolean))||String(opt.fragrance||'').trim()||String(opt.notes||'').trim();
   if(chosen&&nextQty>oldQty){
    const newQty=nextQty-oldQty;
    const available=cart.find((x,i)=>i!==index&&String(x.code||'')===String(line.code||'')&&Number(x.price)===Number(line.price)&&!(x.directSaleOptionsV19158?.colors||[]).some(Boolean)&&!x.directSaleOptionsV19158?.fragrance&&!x.directSaleOptionsV19158?.notes);
    if(available)available.qty=(Number(available.qty)||0)+newQty;
    else cart.splice(index+1,0,{...line,qty:newQty,directSaleOptionsV19158:{colors:[],fragrance:'',notes:'',open:true}});
   }else line.qty=nextQty;
   renderCart();renderPicker();
  };
  renderOptions();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
/* V1.9.158 — impedir que uma nova unidade herde as opções de outra. */
(function(){
 'use strict';
 function install(){
  if(window.__aeDirectSaleDistinctLines19158||typeof addProductToCartV1745!=='function'||typeof cart==='undefined')return;
  window.__aeDirectSaleDistinctLines19158=true;
  const originalAdd=addProductToCartV1745;
  window.addProductToCartV1745=function(code){
   const p=(db.products||[]).find(x=>String(x.code||'')===String(code||''));
   const current=p?cart.find(x=>String(x.code||'')===String(code||'')&&Number(x.price)===Number(p.price)):null;
   const oldQty=Number(current?.qty)||0;
   const chosen=current?.directSaleOptionsV19158;
   const hasChoices=!!(chosen&&(
    (Array.isArray(chosen.colors)&&chosen.colors.some(Boolean))||
    String(chosen.fragrance||'').trim()||
    String(chosen.notes||'').trim()
   ));
   const result=originalAdd.apply(this,arguments);
   if(hasChoices&&current&&Number(current.qty)>oldQty){
    current.qty=oldQty;
    const available=cart.find(x=>x!==current&&String(x.code||'')===String(current.code||'')&&Number(x.price)===Number(current.price)&&!(x.directSaleOptionsV19158?.colors||[]).some(Boolean)&&!x.directSaleOptionsV19158?.fragrance&&!x.directSaleOptionsV19158?.notes);
    if(available)available.qty=(Number(available.qty)||0)+1;
    else cart.push({...current,qty:1,directSaleOptionsV19158:{colors:[],fragrance:'',notes:'',open:true}});
    renderCart();
    renderPicker();
   }
   return result;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();


/* V1.9.163 — estados visuais de encomendas, sem criar estados nem alterar pagamentos.
   A produção determina a cor principal; o pagamento é informação independente. */
(function(){
 'use strict';
 if(window.__aeOrderColorsV19163)return;
 window.__aeOrderColorsV19163=true;
 function visualState(order){
  const status=String(order?.status||'Pedido').trim();
  let total=NaN;
  try{if(typeof calcOrder==='function')total=Number(calcOrder(order)?.total)}catch(_){}
  const rawPaid=Number(order?.paid);
  const amountPaid=Number.isFinite(rawPaid)?Math.max(0,rawPaid):0;
  const knownTotal=Number.isFinite(total)&&total>0;
  const balance=knownTotal?Math.max(0,total-amountPaid):0;
  const fullyPaid=knownTotal&&balance<=0.005;
  const partial=knownTotal&&amountPaid>0.005&&!fullyPaid;
  let state='other';
  if(status==='Pedido')state='created';
  else if(status==='Confirmada')state='confirmed';
  else if(status==='Em produção'||status==='Produção')state='production';
  else if(status==='Pronta')state=knownTotal&&balance>0.005?'ready-unpaid':fullyPaid?'ready-paid':'ready';
  else if(status==='Entregue')state='delivered';
  else if(status==='Cancelado'||status==='Cancelada')state='cancelled';
  return {
   state,
   payment:fullyPaid?'paid':partial?'partial':knownTotal&&balance>0.005?'due':'unknown',
   paymentLabel:fullyPaid?'Paga':partial?'Pagamento parcial':knownTotal&&balance>0.005?'Por pagar':'',
   balance
  };
 }
 window.aeOrderVisualStateV19163=visualState;
 function init(){
  const root=document.getElementById('orders'),cards=document.getElementById('ordersCards'),
   table=document.getElementById('ordersBody'),detail=document.getElementById('orderDetail');
  if(!root||!cards||!table)return;
  function makeBadge(host){
   let badge=host.querySelector(':scope > .ae-order-payment-v19163');
   if(!badge){badge=document.createElement('span');badge.className='ae-order-payment-v19163';host.append(badge)}
   return badge;
  }
  function setBadge(badge,info,hideIfAttention){
   const label=hideIfAttention&&info.state==='ready-unpaid'?'':info.paymentLabel;
   if(badge.textContent!==label)badge.textContent=label;
   badge.dataset.payment=info.payment;
   badge.hidden=!label;
  }
  function paint(){
   const orders=typeof db!=='undefined'&&Array.isArray(db['orders'])?db['orders']:[];
   const lookup=new Map(orders.map(o=>[String(o.id),o]));
   cards.querySelectorAll('article.order-card').forEach(card=>{
    const id=card.querySelector('[data-order-open]')?.dataset.orderOpen;
    const order=lookup.get(String(id||''));if(!order)return;
    const info=visualState(order);
    card.dataset.aeOrderState=info.state;
    card.dataset.aePaymentState=info.payment;
    const header=card.querySelector('.order-card-head');
    if(header)setBadge(makeBadge(header),info,!!header.querySelector('.order-attention-v1915'));
   });
   table.querySelectorAll('tr').forEach(row=>{
    const id=row.querySelector('[data-order-open]')?.dataset.orderOpen;
    const order=lookup.get(String(id||''));if(!order)return;
    const info=visualState(order);
    row.dataset.aeOrderState=info.state;
    row.dataset.aePaymentState=info.payment;
    const cell=row.cells?.[5];
    if(cell)setBadge(makeBadge(cell),info,false);
   });
   if(detail){
    const id=detail.dataset.orderId;
    const order=lookup.get(String(id||''));
    const heading=detail.querySelector('.ae-order-detail-customer');
    if(order&&heading){
     const info=visualState(order);
     detail.dataset.aeOrderState=info.state;
     setBadge(makeBadge(heading),info,false);
    }
   }
  }
  const legendAnchor=root.querySelector('.ae-orders-list-nav');
  if(legendAnchor&&!root.querySelector('.ae-order-colors-legend-v19163')){
   const legend=document.createElement('details');legend.className='ae-order-colors-legend-v19163';
   const title=document.createElement('summary');title.textContent='Legenda de cores · estado e pagamento';legend.append(title);
   const list=document.createElement('div');list.className='ae-order-colors-legend-list-v19163';
   for(const [state,label] of [
    ['created','Pedido efetuado'],['confirmed','Confirmada'],['production','Em produção'],
    ['ready','Pronta'],['ready-unpaid','Pronta · por pagar'],['ready-paid','Pronta e paga']
   ]){
    const chip=document.createElement('span');chip.className='ae-order-colors-legend-chip-v19163';
    chip.dataset.aeOrderState=state;chip.textContent=label;list.append(chip);
   }
   const note=document.createElement('p');
   note.textContent='A cor indica a fase da encomenda. O indicador «Paga» identifica pagamentos concluídos, mesmo durante a produção.';
   list.append(note);legend.append(list);legendAnchor.after(legend);
  }
  let pending=false;
  function schedule(){
   if(pending)return;pending=true;
   queueMicrotask(()=>{pending=false;paint()});
  }
  const observer=new MutationObserver(schedule);
  observer.observe(cards,{childList:true,subtree:true});
  observer.observe(table,{childList:true,subtree:true});
  if(detail)observer.observe(detail,{childList:true,subtree:true});
  paint();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
