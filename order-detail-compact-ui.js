/* Progressive disclosure: move original controls, preserving every business handler. */
(function(){'use strict';
function init(){
 const root=document.getElementById('orderDetail'),dialog=document.getElementById('orderDialog');if(!root)return;
 const remembered=new Map();
 function decorate(){
  if(!root.children.length||root.querySelector(':scope > .ae-order-detail-layout'))return;
  observer.disconnect();
  const id=root.dataset.orderId||'',expanded=remembered.get(id)||new Set(),layout=document.createElement('div');layout.className='ae-order-detail-layout';
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
  if(print){const toolbar=document.createElement('div');toolbar.className='ae-order-detail-tools';toolbar.append(print);layout.append(toolbar)}
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
  // Histórico de estados and Anulação / eliminação remain available, collapsed by default.
  root.replaceChildren(layout);observer.observe(root,{childList:true});
 }
 const observer=new MutationObserver(decorate);observer.observe(root,{childList:true});decorate();
 dialog?.addEventListener('close',()=>{
  if(typeof orderListReturnV1928==='undefined'||!orderListReturnV1928)return;
  const position=orderListReturnV1928;orderListReturnV1928=null;
  requestAnimationFrame(()=>{if(!document.getElementById('orders')?.classList.contains('active'))return;
   const button=[...document.querySelectorAll('#orders [data-order-open]')].find(e=>e.dataset.orderOpen===position.id&&e.getClientRects().length);
   button?.focus({preventScroll:true});window.scrollTo({top:position.scroll,behavior:'instant'});
  });
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
