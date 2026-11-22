/* Edição isolada de preço por linha nas encomendas manuais. */
(function(root){
'use strict';
const HISTORY='priceAdjustmentHistoryV19168';
function parsePrice(raw){
 const value=String(raw??'').trim();
 if(!/^[0-9]{1,7}(?:[.,][0-9]{1,2})?$/.test(value))return null;
 const cents=Math.round(Number(value.replace(',','.'))*100);
 return Number.isSafeInteger(cents)&&cents>=0&&cents<=999999999?cents/100:null;
}
function editable(order,produced){
 return !!order&&!produced&&!order.voidedAt&&!['online_store','box_quote'].includes(order.source)&&
  ['Pedido','Confirmada','Em produção'].includes(String(order.status||'Pedido'));
}
function preview(order,index,raw,calculator){
 if(!order||!Array.isArray(order.items)||!Number.isInteger(index)||index<0||index>=order.items.length)
  throw new Error('Artigo não encontrado nesta encomenda.');
 const line=order.items[index];
 if(!line||['quote_discount','quote_adjustment'].includes(line.type)||!(Number(line.qty)>0))
  throw new Error('Esta linha não permite editar o preço.');
 const price=parsePrice(raw);
 if(price===null)throw new Error('Indica um preço válido com até duas casas decimais.');
 const items=order.items.map((item,i)=>i===index?{...item,price}:item);
 const old=calculator(order),next=calculator({...order,items}),paid=Number(order.paid||0);
 if(!Number.isFinite(old.total)||!Number.isFinite(next.total)||!Number.isFinite(paid)||paid<0)
  throw new Error('Não foi possível validar o total da encomenda.');
 if(next.total+0.005<paid)throw new Error('O novo total fica abaixo do valor já recebido. Corrige primeiro o pagamento.');
 return {price,oldPrice:Number(line.price)||0,oldTotal:old.total,newTotal:next.total,paid,cost:next.cost,margin:next.margin};
}
if(typeof module!=='undefined'&&module.exports)module.exports={parsePrice,editable,preview};
if(typeof document==='undefined')return;
const money=v=>typeof euro==='function'?euro(v):Number(v||0).toFixed(2)+' €';
function el(tag,value,klass){
 const node=document.createElement(tag);if(value!=null)node.textContent=value;
 if(klass)node.className=klass;return node;
}
const findOrder=id=>(db.orders||[]).find(o=>String(o.id)===String(id));
let active=null;
function decorate(){
 const host=document.getElementById('orderDetail');
 if(!host?.dataset.orderId)return;
 const order=findOrder(host.dataset.orderId),group=host.querySelector('[data-section="Produtos"]');
 if(!order||!group)return;
 const rows=[...group.querySelectorAll(':scope > .cart-row')];
 if(rows.length!==order.items.length)return;
 const can=editable(order,isOrderProduced(order.id));
 rows.forEach((row,index)=>{
  const line=order.items[index],cell=row.querySelector(':scope > span');
  if(!cell||cell.querySelector('.ae-order-price-unit-v19168'))return;
  cell.append(el('small','Preço/un.: '+money(line.price),'ae-order-price-unit-v19168'));
  if(can&&!['quote_discount','quote_adjustment'].includes(line.type)&&Number(line.qty)>0){
   const button=el('button','Alterar preço','btn ghost ae-order-price-open-v19168');
   button.type='button';button.dataset.orderPriceEditV19168=String(order.id);
   button.dataset.lineIndex=String(index);cell.append(button);
  }
 });
 const history=Array.isArray(order[HISTORY])?order[HISTORY]:[];
 if(history.length&&!group.querySelector('.ae-order-price-history-v19168')){
  const details=el('details',null,'ae-order-price-history-v19168');
  details.append(el('summary','Histórico de alterações de preço ('+history.length+')'));
  const list=el('ul');
  history.slice().reverse().forEach(h=>{
   const date=new Date(h.changedAt),dateLabel=Number.isFinite(date.getTime())?date.toLocaleString('pt-PT'):'—';
   list.append(el('li',String(h.productName||h.productCode||'Artigo')+' · '+money(h.previousPrice)+' → '+
    money(h.newPrice)+' · '+String(h.reason||'Motivo não registado')+' · '+dateLabel));
  });
  details.append(list);group.append(details);
 }
}
function open(orderId,index){
 if(active)return;
 const order=findOrder(orderId);
 if(!editable(order,order&&isOrderProduced(order.id)))return toast('Edição indisponível nesta fase da encomenda.');
 const line=order.items?.[index];
 if(!line||['quote_discount','quote_adjustment'].includes(line.type))return toast('Artigo não editável.');
 const initialPrice=Number(line.price),initialCode=String(line.code||''),initialName=String(line.name||'');
 const hasPayments=Number(order.paid||0)>0.005||
  (Array.isArray(order.paymentHistory)&&order.paymentHistory.some(p=>Number(p.amount)>0));
 const dlg=el('dialog',null,'ae-order-price-dialog-v19168'),form=el('form');
 form.noValidate=true;
 form.append(el('h2','Alterar preço unitário'),
  el('p',String(line.name||line.code||'Artigo')+' · '+Number(line.qty)+' unidade(s)','ae-order-price-sub-v19168'),
  el('p','Preço atual: '+money(line.price)+' · Total da encomenda: '+money(calcOrder(order).total)));
 const priceLabel=el('label','Novo preço por unidade (€)'),priceInput=el('input');
 priceInput.type='text';priceInput.inputMode='decimal';priceInput.autocomplete='off';priceInput.maxLength=11;
 priceInput.value=Number(line.price||0).toFixed(2).replace('.',',');
 priceLabel.append(priceInput);form.append(priceLabel);
 const reasonLabel=el('label','Motivo da alteração'),reason=el('input');
 reason.type='text';reason.required=true;reason.maxLength=180;
 reason.placeholder='Ex.: preço especial acordado com o cliente';
 reasonLabel.append(reason);form.append(reasonLabel);
 const totals=el('div','','ae-order-price-preview-v19168');
 totals.setAttribute('aria-live','polite');form.append(totals);
 let ack=null;
 if(hasPayments){
  const label=el('label',null,'ae-order-price-ack-v19168');
  ack=el('input');ack.type='checkbox';
  label.append(ack,el('span','Esta encomenda já tem pagamentos. Confirmo o preço acordado; os recebimentos mantêm-se e a repartição no Mapa de Fundos poderá ser recalculada.'));
  form.append(label);
 }
 const error=el('p','','ae-order-price-error-v19168');error.setAttribute('role','alert');form.append(error);
 const actions=el('div',null,'ae-order-price-actions-v19168'),
  cancel=el('button','Cancelar','btn ghost'),submit=el('button','Guardar novo preço','btn primary');
 cancel.type='button';submit.type='submit';actions.append(cancel,submit);form.append(actions);
 dlg.append(form);document.body.append(dlg);active=dlg;
 let result=null;
 function refresh(){
  error.textContent='';
  try{
   result=preview(order,index,priceInput.value,calcOrder);
   totals.textContent='Novo total: '+money(result.newTotal)+' · Recebido: '+money(result.paid)+
    ' · Em falta: '+money(Math.max(0,result.newTotal-result.paid))+
    ' · Margem: '+(result.margin*100).toFixed(1).replace('.',',')+'%';
  }catch(e){result=null;totals.textContent='';error.textContent=e.message}
  submit.disabled=!result||Math.abs(result.price-initialPrice)<0.001||
   reason.value.trim().length<3||(ack&&!ack.checked);
 }
 function close(){if(dlg.open)dlg.close();dlg.remove();active=null}
 cancel.addEventListener('click',close);
 dlg.addEventListener('cancel',e=>{e.preventDefault();close()});
 priceInput.addEventListener('input',refresh);reason.addEventListener('input',refresh);
 ack?.addEventListener('change',refresh);
 form.addEventListener('submit',event=>{
  event.preventDefault();refresh();if(submit.disabled||!result)return;
  const fresh=findOrder(orderId);
  if(!editable(fresh,fresh&&isOrderProduced(fresh.id))||
     fresh.items?.[index]!==line||String(line.code||'')!==initialCode||
     String(line.name||'')!==initialName||Number(line.price)!==initialPrice){
   error.textContent='A encomenda mudou entretanto. Fecha e reabre para atualizar os valores.';submit.disabled=true;return;
  }
  let proposed;
  try{proposed=preview(fresh,index,priceInput.value,calcOrder)}
  catch(e){error.textContent=e.message;return}
  const prior={price:line.price,subtotal:fresh.subtotal,total:fresh.total,history:fresh[HISTORY]};
  submit.disabled=true;
  try{
   line.price=proposed.price;
   fresh.subtotal=fresh.items.reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.price)||0),0);
   fresh.total=calcOrder(fresh).total;
   fresh[HISTORY]=[...(Array.isArray(prior.history)?prior.history:[]),{
    changedAt:new Date().toISOString(),lineIndex:index,
    productCode:String(line.code||''),productName:String(line.name||''),
    previousPrice:proposed.oldPrice,newPrice:proposed.price,
    previousTotal:proposed.oldTotal,newTotal:fresh.total,
    paidAtChange:proposed.paid,reason:reason.value.trim(),source:'manual_order'
   }];
   if(!save())throw new Error('A alteração não ficou gravada localmente.');
   if(typeof relMarkOrderPending==='function')relMarkOrderPending(fresh);
   close();showOrder(orderId);toast('Preço atualizado nesta encomenda. Sincronização Cloud pendente.');
  }catch(e){
   line.price=prior.price;fresh.subtotal=prior.subtotal;fresh.total=prior.total;
   if(prior.history===undefined)delete fresh[HISTORY];else fresh[HISTORY]=prior.history;
   error.textContent=e.message||'Erro ao guardar o preço.';submit.disabled=false;
  }
 });
 dlg.showModal();priceInput.focus();priceInput.select();refresh();
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-order-price-edit-v19168]');
 if(button){event.preventDefault();open(button.dataset.orderPriceEditV19168,Number(button.dataset.lineIndex))}
});
function init(){
 const host=document.getElementById('orderDetail');if(!host)return;
 const observer=new MutationObserver(decorate);
 observer.observe(host,{childList:true,subtree:true});decorate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
root.AeOrderPriceEditV19168={parsePrice,editable,preview,open};
})(typeof window!=='undefined'?window:globalThis);
