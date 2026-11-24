/* Venda direta: peças já prontas; sem mutação de matérias-primas. */
(function(){
 'use strict';
 const methods=['Dinheiro','MB Way','Multibanco','Transferência','Outro'];
 function buildOrder(lines,method,identity,day,now,paymentId){
  if(!methods.includes(method)||!Array.isArray(lines)||!lines.length)throw Error('Selecione produtos e pagamento.');
  let totalCents=0;
  const items=lines.map(line=>{
   if(!line.code||!Number.isSafeInteger(line.qty)||line.qty<1||!Number.isSafeInteger(Math.round(line.price*100))||!Number.isFinite(line.price)||line.price<0||!Number.isFinite(line.cost)||line.cost<0)throw Error('Quantidade, preço ou custo inválido.');
   const cents=Math.round(line.price*100);
   totalCents+=cents*line.qty;
   if(!Number.isSafeInteger(totalCents))throw Error('Total inválido.');
   return {...line,price:cents/100};
  });
  if(totalCents<=0)throw Error('O valor da venda deve ser superior a zero.');
  const total=totalCents/100;
  return {id:identity.id,_rid:identity.rid,source:'direct_sale',created:day,client:'',clientId:null,contact:'',email:'',delivery:'',status:'Entregue',deliveredAt:now,payment:method,paid:total,total,subtotal:total,discountTotal:0,box:'',boxes:0,boxCostSnapshot:0,notes:'Venda presencial · consumidor final',stockPolicy:'materials_already_accounted',items,paymentHistory:[{id:paymentId,date:now,localDate:day,amount:total,method,type:'payment',source:'direct_sale'}]};
 }
 function refundOrder(o,now,paymentId,day=now.slice(0,10)){
  if(!o||o.source!=='direct_sale'||o.status!=='Entregue'||o.voidedAt||!(o.paid>0))throw Error('Venda já anulada ou inválida.');
  const paid=o.paid;
  if(Math.round(paid*100)!==Math.round(o.total*100))throw Error('Pagamento não coincide com o total da venda.');
  return {...o,status:'Cancelado',voidedAt:now,voidedFrom:'Entregue',voidedPaid:paid,paid:0,paymentHistory:[...o.paymentHistory,{id:paymentId,date:now,localDate:day,amount:-paid,method:o.payment,type:'correction',source:'direct_sale',note:'Devolução integral confirmada'}]};
 }
 function cashForPayment(order,payment,day){
  const correction=payment.type==='correction';
  return {id:'CASH-'+payment.id,date:day,type:payment.amount<0?'Saída':'Entrada',desc:(correction?'Devolução venda direta ':'Venda direta ')+order.id,method:payment.method,value:Math.abs(payment.amount),source:correction?'order_payment_correction':'order_payment',orderId:order.id,paymentId:payment.id};
 }
 function stageSale(orders,cash,order,previous,day){
  const current=orders.find(o=>o.id===order.id);
  if(previous?current!==previous:!!current)throw Error('A venda foi alterada. Reabra o histórico.');
  const p=order.paymentHistory[order.paymentHistory.length-1],move=cashForPayment(order,p,p.localDate||day);
  if(cash.some(c=>c.paymentId===p.id||c.id===move.id))throw Error('Pagamento já registado.');
  return {orders:previous?orders.map(o=>o===previous?order:o):[...orders,order],cash:[...cash,move]};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={buildOrder,refundOrder,cashForPayment,stageSale};return}
 let lines=[],busy=false,dialog,externalWrite=false;
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null)externalWrite=true});
 const h=v=>escapeHtml(String(v??''));
 const get=id=>document.getElementById(id);
 const authorized=()=>unlocked===true&&(!get('authGateV1880')||get('authGateV1880').classList.contains('hidden'));
 window.closeDirectSalePOSOnLock=function(){if(dialog?.open)dialog.close()};
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='directSalePOS';
  dialog.innerHTML='<header><div><small>PONTO DE VENDA</small><h2>Venda direta</h2></div><button class="btn" data-pos-close type="button">Fechar</button></header><div class="pos-body"><nav><button class="btn" data-pos-new>Nova venda</button><button class="btn" data-pos-history>Histórico de vendas diretas</button></nav><section data-pos-entry><div class="pos-layout"><div class="pos-catalog"><p class="muted">Consumidor final · sem ficha de cliente.</p><label>Pesquisar produto<input id="posSearch" placeholder="Nome ou código" autocomplete="off"></label><div id="posProducts" class="pos-products"></div></div><div class="pos-checkout"><h3>Artigos selecionados</h3><div id="posLines"></div><label>Método de pagamento<select id="posMethod">'+methods.map(m=>'<option>'+h(m)+'</option>').join('')+'</select></label><div class="pos-total"><strong>Total</strong><strong id="posTotal">0 €</strong></div><label class="pos-confirm"><input type="checkbox" id="posStockConfirmed"> As peças estão prontas e os materiais já foram contabilizados.</label><button type="button" class="btn primary" id="posFinish">Confirmar pagamento e finalizar</button></div></div></section><section data-pos-list hidden></section></div>';
  document.body.append(dialog);
  dialog.querySelector('[data-pos-close]').onclick=()=>{if(!busy)dialog.close()};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  dialog.querySelector('[data-pos-new]').onclick=()=>viewEntry();
  dialog.querySelector('[data-pos-history]').onclick=()=>viewHistory();
  get('posSearch').oninput=renderProducts;
  get('posFinish').onclick=finish;
  renderProducts();renderLines();
 }
 function viewEntry(){dialog.querySelector('[data-pos-entry]').hidden=false;dialog.querySelector('[data-pos-list]').hidden=true;renderProducts();renderLines();get('posSearch').focus()}
 function renderProducts(){
  const q=String(get('posSearch').value||'').toLowerCase().trim();
  const products=(db.products||[]).filter(p=>productUsableV1803(p)&&Number(p.price)>0&&[p.name,p.code].join(' ').toLowerCase().includes(q)).slice(0,30);
  get('posProducts').replaceChildren();
  for(const p of products){
   const b=document.createElement('button');b.type='button';b.className='btn';const ready=window.readyStockInventory?.().get(p.code);b.classList.add('pos-product');const title=document.createElement('strong'),sub=document.createElement('small'),price=document.createElement('b');title.textContent=p.name;sub.textContent=(ready?ready.available+' prontas':p.category||'Sem registo de peças prontas');price.textContent=euro(Number(p.price));b.append(title,sub,price);b.onclick=()=>{const existing=lines.find(l=>l.code===p.code);if(ready&&ready.available<=(existing?.qty||0))return toast('Sem peças prontas suficientes. Registe a produção.');if(existing)existing.qty++;else lines.push({code:p.code,name:p.name,category:p.category||'',qty:1,price:Number(p.price)});renderLines()};get('posProducts').append(b);
  }
  if(!products.length)get('posProducts').textContent='Nenhum produto encontrado.';
 }
 function renderLines(){
  const host=get('posLines');host.replaceChildren();
  for(const line of lines){
   const row=document.createElement('div');row.className='pos-line';row.innerHTML='<strong>'+h(line.name)+'</strong><span>'+euro(line.price)+'</span>';
   const less=document.createElement('button'),more=document.createElement('button'),qty=document.createElement('span');
   less.type=more.type='button';less.className=more.className='btn';less.textContent='−';more.textContent='+';qty.textContent=String(line.qty);
   less.setAttribute('aria-label','Retirar uma unidade de '+line.name);more.setAttribute('aria-label','Adicionar uma unidade de '+line.name);
   less.onclick=()=>{line.qty--;if(line.qty===0)lines=lines.filter(l=>l!==line);renderLines()};more.onclick=()=>{const ready=window.readyStockInventory?.().get(line.code);if(ready&&line.qty>=ready.available)return toast('Sem peças prontas suficientes.');line.qty++;renderLines()};
   row.append(less,qty,more);host.append(row);
  }
  if(!lines.length)host.textContent='Adicione artigos.';
  const tracked=lines.length&&lines.every(l=>window.readyStockInventory?.().has(l.code));get('posStockConfirmed').closest('label').hidden=!!tracked;
  get('posTotal').textContent=euro(lines.reduce((n,l)=>n+Math.round(l.price*100)*l.qty,0)/100);
  get('posFinish').disabled=busy||!lines.length;
 }
 function persistOrder(order,previous=null){
  // Persistir encomenda e caixa juntos no mesmo snapshot local, antes da sincronização.
  if(externalWrite)throw Error('Dados alterados noutra janela. Atualize a aplicação antes de continuar.');
  const oldOrders=db.orders,oldCash=db.cash;
  const staged=stageSale(oldOrders,oldCash||[],order,previous,todayISO());
  const oldRaw=localStorage.getItem(KEY);
  const stored=oldRaw?JSON.parse(oldRaw):null;
  // Não substituir uma venda recebida/alterada noutra janela por uma cópia desatualizada.
  if(stored){
   const signature=rows=>JSON.stringify((rows||[]).filter(o=>o.source==='direct_sale').map(o=>[o.id,o.status,o.paid,o.paymentHistory]));
   if(signature(stored.orders)!==signature(oldOrders))throw Error('Vendas alteradas noutro ecrã. Atualize a aplicação antes de continuar.');
  }
  localStorage.setItem(KEY,JSON.stringify({...db,orders:staged.orders,cash:staged.cash}));
  db.orders=staged.orders;db.cash=staged.cash;
  try{relMarkOrderPending(order);localStorage.setItem(REL_DIRTY,'1');setCloudMeta({dirty:true,verified:false,localChangedAt:new Date().toISOString()})}catch(e){cloudLogMsg('Venda guardada localmente; metadados Cloud pendentes: '+order.id)}
  try{refreshOperationalViewsV1413('direct_sale');if(typeof renderFundsV1929==='function')renderFundsV1929();scheduleRelationalSync();queueOrderBusinessSyncV1757(order,'venda direta')}catch(e){cloudLogMsg('Venda guardada localmente; atualização pendente: '+order.id)}
  return true;
 }
 async function commitTracked(order){
  if(externalWrite)throw Error('Dados alterados noutra janela. Atualize a aplicação.');
  if(!navigator.onLine)throw Error('As vendas com stock acabado registado precisam de ligação à internet.');
  if(productionBlockedV1926()||cloudBusy||cloudPushRunning||cloudHydrating||!cloudStartupDone)throw Error('Aguarde a sincronização antes de finalizar.');
  relDetectChangedOrders();
  if(cloudMeta().dirty||cloudMeta().conflict||localStorage.getItem(REL_DIRTY)==='1'||relOrderPendingSet().size){scheduleCloudPushV1860(100);throw Error('Existem alterações por sincronizar.')}
  productionBusyV1926=true;
  try{
   const u=await ensureCloudSession();if(!u||!authorized())throw Error('Sessão necessária.');
   const state=await fetchCloudRowAuthoritative(u);
   if(!state||stableStringify(operationalCloudSnapshotV139())!==stableStringify(operationalCloudRowSnapshotV1858(state)))throw Error('Os dados mudaram na Cloud. Receba os dados antes de continuar.');
   if(!authorized()||externalWrite)throw Error('Dados ou sessão alterados.');
   localStorage.setItem(PRODUCTION_PENDING_V1926,JSON.stringify({kind:'ready_sale',userId:u.id,args:{p_revision:state.revision,p_order:order,p_device:getDeviceId()}}));
   dialog.close();
  }finally{productionBusyV1926=false}
  return resumeProductionV1926();
 }
 async function finish(){
  if(busy||!authorized())return;
  if(lines.some(l=>!window.readyStockInventory?.().has(l.code))&&!get('posStockConfirmed').checked)return toast('Confirme que os materiais das peças prontas não registadas já foram contabilizados.');
  if(productionBlockedV1926())return toast('Resolva primeiro a produção pendente.');
  busy=true;renderLines();
  try{
   const prepared=lines.map(l=>{
    const p=(db.products||[]).find(p=>p.code===l.code&&productUsableV1803(p));
    if(!p||Number(p.price)!==l.price)throw Error('Produto ou preço alterado. Volte a selecionar o artigo.');
    const cost=Number(effectiveProduct(p).cost);
    if(!Number.isFinite(cost)||cost<0)throw Error('Custo indisponível: '+p.name);
    const ready=window.readyStockInventory?.().get(l.code);if(ready&&ready.available<l.qty)throw Error('Peças prontas insuficientes: '+l.name);return ensureLineDetailedCostSnapshotV1769({...l,cost,type:'product',readyStockTracked:!!ready},'direct_sale');
   });
   const rid=relUuid({}),day=todayISO(),now=new Date().toISOString(),identity={rid,id:'VD-'+day.replace(/-/g,'')+'-'+rid.replace(/-/g,'').slice(0,16).toUpperCase()};
   const order=buildOrder(prepared,get('posMethod').value,identity,day,now,'PAY-'+rid+'-SALE');
   if((db.orders||[]).some(o=>o.id===order.id))throw Error('Identificador já utilizado.');
   if(order.items.some(l=>l.readyStockTracked)){const accepted=await commitTracked(order);if(!accepted&&!productionPendingV1926())return;}else persistOrder(order);
   lines=[];get('posStockConfirmed').checked=false;get('posSearch').value='';renderProducts();if(!productionPendingV1926())toast('Venda direta guardada: '+euro(order.total));
  }catch(e){toast(e.message||'Não foi possível guardar a venda.')}
  finally{busy=false;renderLines()}
 }
 function viewHistory(id){
  dialog.querySelector('[data-pos-entry]').hidden=true;
  const host=dialog.querySelector('[data-pos-list]');host.hidden=false;host.replaceChildren();
  const all=(db.orders||[]).filter(o=>o.source==='direct_sale').slice().reverse();
  const orders=id?all.filter(o=>o.id===id):all.slice(0,100);
  if(!orders.length)host.textContent='Sem vendas diretas.';
  for(const o of orders){
   const row=document.createElement('article');row.className='pos-record';
   row.innerHTML='<strong>'+h(o.created)+' · '+euro(calcOrder(o).total)+' · '+h(o.status==='Cancelado'?'Anulada':'Paga')+'</strong><small>'+h(o.id)+' · '+h(o.payment)+'</small><p>'+h(o.items.map(i=>i.qty+' × '+i.name).join(' · '))+'</p>';
   if(o.status!=='Cancelado'){
    const btn=document.createElement('button');btn.type='button';btn.className='btn danger';btn.textContent='Anular e registar devolução';
    btn.onclick=async()=>{if(busy||!authorized())return;if(productionBlockedV1926())return toast('Resolva primeiro a produção pendente.');const current=(db.orders||[]).find(x=>x.id===o.id);if(current!==o||current.status!=='Entregue')return viewHistory(id);if(!confirm('Confirma que devolveu integralmente o pagamento ao cliente?'))return;busy=true;try{const next=refundOrder(current,new Date().toISOString(),'PAY-'+current._rid+'-REFUND',todayISO());if(current.items.some(i=>i.readyStockTracked))next.readyRestocked=confirm('As peças devolvidas estão fisicamente disponíveis e em condições de voltar a vender?');if(current.items.some(i=>i.readyStockTracked)){const accepted=await commitTracked(next);if(!accepted)return;}else persistOrder(next,current);viewHistory(id);toast('Venda anulada e devolução registada.')}catch(e){toast(e.message)}finally{busy=false}};
    row.append(btn);
   }
   host.append(row);
  }
 }
 window.openDirectSalePOS=function(id){if(!authorized())return;mount();if(!dialog.open)dialog.showModal();if(id)viewHistory(id);else viewEntry()};
})();
