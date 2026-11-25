/* Progressive disclosure: move original controls, preserving every business handler. */
(function(){'use strict';

async function customerOrderPdf(order){
 const items=(order.items||[]).filter(item=>!['quote_discount','quote_adjustment'].includes(item.type));
 if(!items.length)throw new Error('A encomenda não tem produtos.');
 const total=calcOrder(order).total,paid=Number(order.paid)||0;
 const due=Math.max(0,total-paid);
 const method=order.paymentRequested==='pay_later'?'No levantamento ou entrega':
  order.paymentRequested?onlineRequestedPaymentLabel(order):order.payment;
 const details=[];
 if(order.client)details.push('Cliente: '+order.client);
 if(order.delivery||order.deliveryTime){
  const date=String(order.delivery||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$3/$2/$1');
  details.push('Entrega prevista: '+[date,order.deliveryTime].filter(Boolean).join(' · '));
 }
 if(order.deliveryMethod==='local_delivery')details.push(['Entrega local',order.address,order.postalCode].filter(Boolean).join(' · '));
 if(order.deliveryMethod==='pickup')details.push('Levantamento no atelier');
 details.push('Meio de pagamento: '+(method||'A combinar'));
 if(due>0.005){
  const mb=mbWayInstructionsForOrderV1800(order).trim().split('\n')[0];
  if(mb)details.push(mb);
  if(method==='Transferência'&&db.settings?.iban)details.push('IBAN: '+db.settings.iban);
 }
 if(paid>0)details.push('Pago: '+euro(paid)+'     Por pagar: '+euro(due));
 const pages=[],canvas=createCatalogPrintCanvas(),ctx=canvas.getContext('2d');
 let y;
 async function startPage(){
  await drawArtEssenciaHeader(ctx,'ENCOMENDA',String(order.id));
  ctx.fillStyle='#5a240b';ctx.font='bold 24px Arial';
  let headingY=245;
  if(!pages.length){
   ctx.font='24px Arial';
   for(const detail of details){
    ctx.fillText(detail,70,headingY,1100);headingY+=36;
   }
   headingY+=35;
  }
  ctx.font='bold 24px Arial';ctx.fillText('Produto',70,headingY);ctx.textAlign='right';ctx.fillText('Quantidade',1170,headingY);ctx.textAlign='left';
  ctx.font='26px Arial';y=headingY+70;
 }
 async function finishPage(){
  ctx.font='20px Arial';ctx.fillText('Página '+(pages.length+1),70,1690);
  const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
  if(!image)throw new Error('Não foi possível gerar o PDF.');
  pages.push(image);
 }
 await startPage();
 for(const item of items){
  const lines=wrapCanvasText(ctx,item.name||'Produto',900);
  for(const [index,line] of lines.entries()){
   if(y>1590){await finishPage();await startPage()}
   ctx.fillText(line,70,y,900);
   if(index===0){ctx.textAlign='right';ctx.fillText(String(item.qty),1170,y,150);ctx.textAlign='left'}
   y+=36;
  }
  y+=18;
 }
 if(y+60>1590){await finishPage();await startPage()}
 ctx.fillStyle='#5a240b';ctx.fillRect(70,y,1100,2);
 ctx.font='bold 32px Arial';ctx.fillText('Valor final',70,y+55);
 ctx.textAlign='right';ctx.fillText(euro(total),1170,y+55);ctx.textAlign='left';
 await finishPage();
 return jpegBlobsToPDF(pages,canvas.width,canvas.height);
}

function materialPreview(orderId,expanded,onToggle){
 const details=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('div');
 details.className='ae-order-detail-section ae-order-materials';details.dataset.section='Materiais previstos';summary.textContent='Materiais previstos';details.append(summary,content);
 const node=(tag,text,cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el};
 function render(){
  content.replaceChildren();
  const o=(db.orders||[]).find(x=>String(x.id)===orderId);if(!o)return;
  if(isOrderProduced(o.id)||['Pronta','Entregue','Cancelado'].includes(o.status)){content.append(node('p','Esta encomenda já não está pendente de produção.'));return}
  try{
   const missing=productionMissingRecipesV1757([o]),unresolved=productionUnresolvedLinesV148([o]);
   if(missing.length||unresolved.length)content.append(node('p','Composição incompleta: '+[...missing,...unresolved].map(x=>x.name).join(' · ')+'. Verifica os produtos e as fichas técnicas.','ae-material-warning'));
   const needs=Object.entries(productionOrderNeedsV12632(o));
   if(needs.some(([,q])=>!Number.isFinite(Number(q))||Number(q)<0))content.append(node('p','Existem quantidades inválidas na composição. Verifica a ficha técnica antes de produzir.','ae-material-warning'));
   const commitments=productionOtherCommitmentsV20261021(o.delivery||'', [o]);
   const list=node('div','','ae-material-list');
   for(const [name,raw] of needs){
    const qty=Number(raw);if(!Number.isFinite(qty)||qty<=0)continue;
    const st=stockByName(name),rawStock=st?.qty,stock=Number(rawStock),reserved=Number(commitments[name]||0);
    const valid=!!st&&rawStock!==null&&rawStock!==undefined&&String(rawStock).trim()!==''&&Number.isFinite(stock)&&stock>=0&&Number.isFinite(reserved)&&reserved>=0;
    const available=valid?Math.max(0,stock-reserved):null,shortage=valid?Math.max(0,qty-available):null;
    const unit=String(st?.unit||''),fmt=n=>productionFmtQtyV12632(n)+(unit?' '+unit:' · unidade por confirmar');
    const row=node('section','','ae-material-row');row.append(node('strong',name));
    const values=node('dl','','ae-material-values');
    for(const [label,value] of [['Necessário',fmt(qty)],['Em stock',valid?fmt(stock):'Não confirmado'],['Outros compromissos',valid?fmt(reserved):'—'],['Disponível',valid?fmt(available):'—']]){
     const field=node('div','');field.append(node('dt',label),node('dd',value));values.append(field);
    }
    row.append(values);
    if(!st)row.append(node('p','Material não encontrado no Stock.','ae-material-warning'));
    else if(!valid)row.append(node('p','Stock inválido: verifica o registo deste material.','ae-material-warning'));
    else if(shortage>1e-9)row.append(node('p','Em falta: '+fmt(shortage),'ae-material-warning'));
    list.append(row);
   }
   if(!list.children.length)content.append(node('p','Sem materiais calculados para esta encomenda.'));else content.append(list);
   content.append(node('p',o.delivery?'Os outros compromissos incluem encomendas confirmadas ou em produção com entrega até '+String(o.delivery)+'.':'Sem data de entrega: são considerados todos os outros compromissos ativos.','ae-material-note'));
   content.append(node('p','Consulta indicativa segundo a composição usada pela Produção, incluindo a ficha guardada na confirmação quando exista. Não reserva nem desconta stock.','ae-material-note'));
  }catch(_){content.replaceChildren(node('p','Não foi possível calcular os materiais. Consulta o módulo Produção e verifica as fichas técnicas.','ae-material-warning'))}
 }
 details.addEventListener('toggle',()=>{onToggle(details.open);if(details.open)render()});
 details.open=expanded;if(expanded)render();return details;
}

function init(){
 const root=document.getElementById('orderDetail'),dialog=document.getElementById('orderDialog');if(!root)return;
 const title=dialog?.querySelector('h2');
 if(title){title.id='orderDetailTitle';dialog.setAttribute('aria-labelledby',title.id)}
 const remembered=new Map();
 function decorate(){
  if(!root.children.length||root.querySelector(':scope > .ae-order-detail-layout'))return;
  observer.disconnect();
  const id=root.dataset.orderId||'',expanded=remembered.get(id)||new Set(),layout=document.createElement('div');layout.className='ae-order-detail-layout';
  if(title)title.textContent=id?'Encomenda '+id:'Detalhe da encomenda';
  const groups=[],intro=[];let group=null;
  for(const node of [...root.children]){
   if(node.classList.contains('section-title')){group={label:node.textContent.trim(),heading:node,nodes:[]};groups.push(group)}
   else if(group)group.nodes.push(node);else intro.push(node);
  }
  const customer=document.createElement('div');customer.className='ae-order-detail-customer';
  const name=document.createElement('strong'),date=document.createElement('span');name.textContent=root.querySelector('#detailClient')?.value||'Cliente';date.textContent='Entrega: '+(root.querySelector('#detailDelivery')?.value||'Por definir');customer.append(name,date);
  layout.append(...intro,customer);
  const totals=root.querySelector('.totalbox');if(totals){layout.append(totals);for(const g of groups)g.nodes=g.nodes.filter(n=>n!==totals)}
  const print=root.querySelector('button[onclick*="printOrderCompleteV12634"]');
  if(print){
   const toolbar=document.createElement('div');toolbar.className='ae-order-detail-tools';const customerPdf=document.createElement('button');customerPdf.type='button';customerPdf.className='btn primary';
   customerPdf.textContent='PDF para o cliente';
   customerPdf.addEventListener('click',async()=>{
    const order=(db.orders||[]).find(entry=>String(entry.id)===id);
    if(!order)return toast('Encomenda não encontrada');
    const fileName='ArtEssencia_Encomenda_'+id.replace(/[^a-z0-9_-]/gi,'_')+'.pdf';
    let phone=normalizePhone(order.contact).replace(/^00/,'');
    if(/^9\d{8}$/.test(phone))phone='351'+phone;
    const valid=/^[1-9]\d{7,14}$/.test(phone);
    const android=/Android/i.test(navigator.userAgent);
    const tab=valid&&!android?window.open('about:blank','_blank'):null;
    if(tab)tab.opener=null;
    customerPdf.disabled=true;
    try{
     const pdf=await customerOrderPdf(order);
     downloadBlob(pdf,fileName);
     if(!valid){toast('PDF guardado. Verifica o contacto na encomenda para abrir o WhatsApp.');return}
     const greeting='Olá! Segue o resumo da encomenda '+id+' da ArtEssencia.';
     if(tab)tab.location.href='https://wa.me/'+phone+'?text='+encodeURIComponent(greeting);
     else if(android)openWhatsAppBusinessV1801(phone,greeting);
     else window.location.assign('https://wa.me/'+phone+'?text='+encodeURIComponent(greeting));
    }catch(error){tab?.close();toast(error.message||'Não foi possível preparar o PDF')}
    finally{customerPdf.disabled=false}
   });
   const hint=document.createElement('small');hint.className='muted';
   hint.textContent='O PDF fica nas transferências. Na conversa do cliente, anexa-o como documento.';
   toolbar.append(customerPdf,print);
   if(document.getElementById('orders')?.classList.contains('active')){
    const agenda=document.createElement('button');agenda.type='button';agenda.className='btn';agenda.textContent='Ver agenda de produção';
    let edited=false;
    layout.addEventListener('input',()=>{edited=true});
    agenda.addEventListener('click',()=>{
     if(edited&&!window.confirm('Sair do detalhe e descartar as alterações por guardar?'))return;
     viewOrderProductionV1915(id);
    });
    toolbar.append(agenda);
   }
   layout.append(toolbar,hint);
  }
  const priority=['Fluxo da encomenda','Produtos','Conjuntos Temáticos','Entrega e pagamento','Saldo após entrega','Conclusão'];
  const ordered=[...priority.map(label=>groups.find(g=>g.label===label)).filter(Boolean),...groups.filter(g=>!priority.includes(g.label))];
  for(const g of ordered){
   if(priority.includes(g.label)){
    const section=document.createElement('section');section.className='ae-order-detail-primary';section.dataset.section=g.label;section.append(g.heading,...g.nodes);layout.append(section);
   }else{
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='ae-order-detail-section';details.dataset.section=g.label;
    const label=g.label==='Dados da encomenda'?'Editar dados e notas':g.label;
    summary.textContent=label;details.append(summary,...g.nodes);details.open=expanded.has(g.label);
    details.addEventListener('toggle',()=>{const current=remembered.get(id)||new Set();if(details.open)current.add(g.label);else current.delete(g.label);remembered.set(id,current)});layout.append(details);
   }
  }
  const order=typeof db!=='undefined'?(db.orders||[]).find(o=>String(o.id)===id):null;
  if(order&&['Pedido','Confirmada','Em produção','Produção'].includes(order.status)&&!isOrderProduced(order.id)){
   const materials=materialPreview(id,expanded.has('Materiais previstos'),open=>{const current=remembered.get(id)||new Set();if(open)current.add('Materiais previstos');else current.delete('Materiais previstos');remembered.set(id,current)});
   const products=[...layout.children].find(el=>el.dataset.section==='Produtos');if(products)products.after(materials);else layout.append(materials);
  }
  // Histórico de estados and Anulação / eliminação remain available, collapsed by default.
  root.replaceChildren(layout);observer.observe(root,{childList:true});
 }
 const observer=new MutationObserver(decorate);observer.observe(root,{childList:true});decorate();
 dialog?.addEventListener('close',()=>{
  if(typeof orderListReturnV1928==='undefined'||!orderListReturnV1928)return;
  const position=orderListReturnV1928;orderListReturnV1928=null;
  focusOrderInListV1928(position);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
