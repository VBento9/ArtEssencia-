/* Progressive disclosure: move original controls, preserving every business handler. */
(function(){'use strict';

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
  requestAnimationFrame(()=>{if(!document.getElementById('orders')?.classList.contains('active'))return;
   const button=[...document.querySelectorAll('#orders [data-order-open]')].find(e=>e.dataset.orderOpen===position.id&&e.getClientRects().length);
   button?.focus({preventScroll:true});window.scrollTo({top:position.scroll,behavior:'instant'});
  });
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
