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
  const originalRender=renderCart,originalSave=saveOrder;
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
    const opts=line.directSaleOptionsV19158||{};
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