/* Produtos acabados: apenas sessões explícitas de stock, nunca inferidas de encomendas antigas. */
(function(){
 'use strict';
 function inventory(runs,orders){
  const result=new Map();
  for(const r of runs||[])if(r.kind==='ready_stock')for(const p of r.products||[]){
   if(!p.code||!Number.isSafeInteger(p.qty)||p.qty<=0)continue;
   const prev=result.get(p.code)||{made:0,sold:0,available:0};
   if(['loss','damage','correct_down'].includes(r.mode))prev.adjusted=(prev.adjusted||0)-p.qty;
   else if(r.mode==='correct_up')prev.adjusted=(prev.adjusted||0)+p.qty;
   else prev.made+=p.qty;
   result.set(p.code,prev);
  }
  for(const o of orders||[])if(o.source==='direct_sale'&&(!o.voidedAt||o.readyRestocked!==true))for(const l of o.items||[]){
   if(!l.readyStockTracked||!result.has(l.code)||!Number.isSafeInteger(l.qty)||l.qty<=0)continue;
   const balances=result.get(l.code);
   if(o.voidedAt)balances.damagedReturns=(balances.damagedReturns||0)+l.qty;
   else balances.sold+=l.qty;
  }
  for(const x of result.values())x.available=x.made+(x.adjusted||0)-x.sold-(x.damagedReturns||0);
  return result;
 }
 function plan(product,qty,mode,recipes,stock,committed={}){
  if(!product?.code||!Number.isSafeInteger(qty)||qty<1||qty>100000||!['consume','already','loss','damage','correct_down','correct_up'].includes(mode))throw Error('Selecione um produto, quantidade e modo válidos.');
  if(mode!=='consume')return {};
  if(product.manufactured===false)throw Error('Este produto não está definido como fabricado.');
  const recipe=recipes[product.code];
  if(!Array.isArray(recipe)||!recipe.length)throw Error('Falta a ficha técnica de materiais.');
  const needs=Object.create(null);
  for(const r of recipe){
   const n=Number(r.qty);
   if(!r.item||!Number.isFinite(n)||n<=0)throw Error('Ficha técnica inválida.');
   needs[r.item]=(needs[r.item]||0)+n*qty;
  }
  for(const [name,need] of Object.entries(needs)){
   const rows=stock.filter(s=>s.name===name),have=rows.length===1?Number(rows[0].qty):NaN;
   if(!Number.isFinite(have)||have-(Number(committed[name])||0)+1e-8<need)throw Error('Stock insuficiente ou comprometido: '+name);
  }
  return needs;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={inventory,plan};return}
 window.readyStockInventory=()=>inventory(db.productionRuns,db.orders);
 let dialog,busy=false;
 const el=id=>document.getElementById(id);
 const auth=()=>unlocked===true&&(!el('authGateV1880')||el('authGateV1880').classList.contains('hidden'));
 const selected=()=> (db.products||[]).find(p=>p.code===el('readyProduct').value&&productUsableV1803(p));
 const qty=()=>Number(el('readyQty').value);
 const mode=()=>el('readyMode').value;
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='readyStockDialog';
  dialog.innerHTML='<header><div><small>PRODUÇÃO PARA STOCK</small><h2>Produtos acabados</h2></div><button type="button" class="btn" id="readyClose">Fechar</button></header><div class="ready-body"><nav><button type="button" id="readyRegisterTab" class="btn">Registar movimento</button> <button type="button" id="readyInventoryTab" class="btn">Inventário e histórico</button></nav><section id="readyForm"><p>Regista a produção ou um ajuste à contagem física.</p><label>Pesquisar produto<input id="readySearch" placeholder="Nome ou código"></label><label>Produto<select id="readyProduct"></select></label><label>Data do movimento<input type="date" id="readyDate" required></label><label>Unidades<input id="readyQty" type="number" min="1" step="1" value="1"></label><label>Movimento<select id="readyMode"><option value="consume">Descontar pela ficha técnica</option><option value="already">Materiais já contabilizados</option><option value="damage">Peças danificadas</option><option value="loss">Perda</option><option value="correct_down">Correção de contagem (retirar)</option><option value="correct_up">Correção de contagem (adicionar)</option></select></label><label id="readyReasonLabel" hidden>Motivo do ajuste<input id="readyReason" maxlength="250"></label><div id="readyPreview" role="status"></div><label class="ready-confirm"><input id="readyConfirm" type="checkbox"> Confirmo a quantidade física e o estado dos materiais.</label><button id="readySubmit" type="button" class="btn primary">Confirmar registo</button></section><section id="readyInventory"><h3>Produtos acabados</h3><label>Pesquisar no inventário<input id="readyFilter" placeholder="Nome, referência ou categoria"></label><label>Disponibilidade<select id="readyAvailability"><option value="">Todas</option><option value="yes">Disponíveis</option><option value="no">Esgotados</option></select></label><div id="readyList"></div></section></div>';
  document.body.append(dialog);el('readyRegisterTab').onclick=()=>showArea(false);el('readyInventoryTab').onclick=()=>showArea(true);el('readyClose').onclick=()=>{if(!busy)dialog.close()};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  el('readyFilter').oninput=renderList;el('readyAvailability').onchange=renderList;el('readySearch').oninput=renderOptions;for(const id of ['readyProduct','readyQty','readyMode','readyDate','readyReason'])el(id).onchange=()=>{el('readyConfirm').checked=false;preview()};
  el('readyReason').oninput=()=>{el('readyConfirm').checked=false;preview()};el('readyConfirm').onchange=preview;el('readySubmit').onclick=submit;
 }
 function showArea(inventoryOnly){
  el('readyForm').hidden=inventoryOnly;el('readyInventory').hidden=!inventoryOnly;
  el('readyRegisterTab').setAttribute('aria-pressed',String(!inventoryOnly));
  el('readyInventoryTab').setAttribute('aria-pressed',String(inventoryOnly));
  if(inventoryOnly)renderList();
 }
 function renderOptions(){
  const s=el('readyProduct'),previous=s.value,q=el('readySearch').value.toLowerCase().trim();
  s.replaceChildren(new Option('Selecionar produto',''));
  for(const p of (db.products||[]).filter(p=>productUsableV1803(p)&&[p.name,p.code].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt')))s.append(new Option(p.name,p.code));
  if([...s.options].some(o=>o.value===previous))s.value=previous;
  el('readyConfirm').checked=false;preview();
 }
 function validateMovement(){
  const adjustment=!['already','consume'].includes(mode());
  el('readyReasonLabel').hidden=!adjustment;
  const day=el('readyDate').value;
  if(!day||day>todayISO())throw Error('Seleciona a data do movimento, até hoje.');
  if(adjustment&&!el('readyReason').value.trim())throw Error('Indica o motivo do ajuste.');
  if(adjustment&&mode()!=='correct_up'&&(window.readyStockInventory().get(selected()?.code)?.available||0)<qty())throw Error('Não existem unidades suficientes para retirar.');
 }
 function preview(){
  const host=el('readyPreview');host.replaceChildren();let ok=false;
  try{validateMovement();const p=selected(),needs=plan(p,qty(),mode(),db.productRecipes||{},db.stock||[],productionOtherCommitmentsV20261021('',[]));const text=document.createElement('p');text.textContent=mode()!=='consume'?'Este movimento regista apenas unidades acabadas.':Object.entries(needs).map(([name,n])=>name+' · '+productionFmtQtyV12632(n)+' '+(stockByName(name)?.unit||'')).join(' | ');host.append(text);ok=true}catch(e){host.textContent=e.message}
  el('readySubmit').disabled=busy||!ok||!el('readyConfirm').checked;
 }
 function renderList(){
  const host=el('readyList');host.replaceChildren();
  for(const [code,x] of window.readyStockInventory()){
   const p=(db.products||[]).find(p=>p.code===code);
   const label=[p?.name,code,p?.category].filter(Boolean).join(' · ');
   if(!label.toLowerCase().includes(el('readyFilter').value.trim().toLowerCase()))continue;
   if(el('readyAvailability').value==='yes'&&x.available<=0||el('readyAvailability').value==='no'&&x.available>0)continue;
   const details=document.createElement('details'),summary=document.createElement('summary');
   const runs=(db.productionRuns||[]).filter(r=>r.kind==='ready_stock'&&r.products.some(i=>i.code===code));
   const events=runs.map(r=>({date:r.date,text:({consume:'Produção',already:'Produção (materiais contabilizados)',damage:'Danos',loss:'Perda',correct_down:'Correção (retirar)',correct_up:'Correção (adicionar)'})[r.mode]+' · '+r.products[0].qty+' un.'+(r.reason?' · '+r.reason:'')}));
   for(const o of db.orders||[]){
    if(o.source!=='direct_sale')continue;
    const item=o.items?.find(i=>i.code===code&&i.readyStockTracked);
    if(!item)continue;
    events.push({date:o.created,text:'Venda '+o.id+' · '+item.qty+' un.'});
    if(o.voidedAt)events.push({date:o.voidedAt.slice(0,10),text:o.readyRestocked?'Devolução com reposição · '+item.qty+' un.':'Devolução sem reposição · '+item.qty+' un.'});
   }
   const last=runs.filter(r=>['consume','already'].includes(r.mode)).map(r=>r.date).sort().pop();
   const img=visualProductImageV192(p);
   if(img){const photo=new Image();photo.src=img;photo.alt='';photo.loading='lazy';summary.append(photo)}
   const name=document.createElement('strong');name.textContent=label;
   summary.append(name,document.createTextNode(' · '+x.available+' disponíveis'));
   const stats=document.createElement('small');stats.textContent='Produzidas '+x.made+' · Vendidas '+x.sold+' · Devolvidas sem reposição '+(x.damagedReturns||0)+' · Ajustes '+(x.adjusted||0)+' · Última produção '+(last||'—');
   summary.append(stats);details.append(summary);
   for(const event of events.sort((a,b)=>String(b.date).localeCompare(String(a.date)))){const line=document.createElement('p');line.textContent=event.date+' · '+event.text;details.append(line)}
   host.append(details);
  }
  if(!host.childElementCount)host.textContent='Sem produtos acabados para esta pesquisa.';
 }
 async function submit(){
  if(busy||!auth()||!el('readyConfirm').checked)return;
  if(productionBlockedV1926())return toast('Existe uma produção por confirmar.');
  if(!navigator.onLine)return toast('Liga a internet para registar produção com segurança.');
  if(cloudBusy||cloudPushRunning||cloudHydrating||!cloudStartupDone)return toast('Aguarda a sincronização Cloud.');
  relDetectChangedOrders();
  if(cloudMeta().dirty||cloudMeta().conflict||localStorage.getItem(REL_DIRTY)==='1'||relOrderPendingSet().size){scheduleCloudPushV1860(100);return toast('Sincroniza as alterações antes de registar as peças.')}
  busy=true;productionBusyV1926=true;preview();
  try{
   validateMovement();const p=selected(),n=qty(),m=mode(),needs=plan(p,n,m,db.productRecipes||{},db.stock||[],productionOtherCommitmentsV20261021('',[]));
   const user=await ensureCloudSession();if(!user||!auth())throw Error('Sessão necessária.');
   const [state,products]=await Promise.all([fetchCloudRowAuthoritative(user),relFetchAll(REL_TABLES.products)]);
   if(!state||stableStringify(operationalCloudSnapshotV139())!==stableStringify(operationalCloudRowSnapshotV1858(state)))throw Error('Os dados mudaram na Cloud. Recebe os dados antes de continuar.');
   const row=products.find(x=>x.id===p._rid);if(!row||productionComparableV1926(row.data,'product')!==productionComparableV1926(p,'product'))throw Error('Produto ainda não sincronizado ou alterado.');
   if(!auth())throw Error('Desbloqueia a aplicação.');
   const costs=Object.fromEntries(Object.keys(needs).map(name=>[name,materialUnitCost(name)]));
   const run={id:uid('PROD'),kind:'ready_stock',mode:m,date:el('readyDate').value,reason:['consume','already'].includes(m)?'':el('readyReason').value.trim(),products:[{code:p.code,name:p.name,qty:n}],total:n,materials:needs,materialUnitCosts:costs,materialCostTotal:Object.entries(needs).reduce((s,[name,q])=>s+q*costs[name],0),orders:[],orderMaterials:{},orderProducts:{}};
   localStorage.setItem(PRODUCTION_PENDING_V1926,JSON.stringify({kind:'ready_stock',userId:user.id,args:{p_revision:state.revision,p_run:run,p_product:row,p_device:getDeviceId()}}));
   dialog.close();
  }catch(e){toast(e.message||'Não foi possível preparar o registo.');return}
  finally{busy=false;productionBusyV1926=false;preview()}
  await resumeProductionV1926();
 }
 window.openReadyStock=(inventoryOnly=false)=>{if(!auth())return;mount();el('readyDate').value=todayISO();el('readyDate').max=todayISO();renderOptions();showArea(inventoryOnly);if(!dialog.open)dialog.showModal();if(inventoryOnly)el('readyFilter').focus()};
 window.closeReadyStockOnLock=()=>{if(dialog?.open)dialog.close()};
})();
