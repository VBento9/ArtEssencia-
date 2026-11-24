/* Produtos acabados: apenas sessões explícitas de stock, nunca inferidas de encomendas antigas. */
(function(){
 'use strict';
 function inventory(runs,orders){
  const result=new Map();
  for(const r of runs||[])if(r.kind==='ready_stock')for(const p of r.products||[]){
   if(!p.code||!Number.isSafeInteger(p.qty)||p.qty<=0)continue;
   const prev=result.get(p.code)||{made:0,sold:0,available:0};
   prev.made+=p.qty;result.set(p.code,prev);
  }
  for(const o of orders||[])if(o.source==='direct_sale'&&(!o.voidedAt||o.readyRestocked!==true))for(const l of o.items||[]){
   if(!l.readyStockTracked||!result.has(l.code)||!Number.isSafeInteger(l.qty)||l.qty<=0)continue;
   result.get(l.code).sold+=l.qty;
  }
  for(const x of result.values())x.available=x.made-x.sold;
  return result;
 }
 function plan(product,qty,mode,recipes,stock,committed={}){
  if(!product?.code||!Number.isSafeInteger(qty)||qty<1||qty>100000||!['consume','already'].includes(mode))throw Error('Selecione um produto, quantidade e modo válidos.');
  if(mode==='already')return {};
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
  dialog.innerHTML='<header><div><small>PRODUÇÃO PARA STOCK</small><h2>Produtos acabados</h2></div><button type="button" class="btn" id="readyClose">Fechar</button></header><div class="ready-body"><p>Regista peças já produzidas, sem criar encomendas ou pagamentos.</p><label>Pesquisar produto<input id="readySearch" placeholder="Nome ou código"></label><label>Produto<select id="readyProduct"></select></label><label>Unidades prontas<input id="readyQty" type="number" min="1" step="1" value="1"></label><label>Materiais<select id="readyMode"><option value="consume">Descontar pela ficha técnica</option><option value="already">Materiais já contabilizados</option></select></label><div id="readyPreview" role="status"></div><label class="ready-confirm"><input id="readyConfirm" type="checkbox"> Confirmo a quantidade física e o estado dos materiais.</label><button id="readySubmit" type="button" class="btn primary">Registar peças prontas</button><h3>Disponíveis para venda</h3><div id="readyList"></div></div>';
  document.body.append(dialog);el('readyClose').onclick=()=>{if(!busy)dialog.close()};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  el('readySearch').oninput=renderOptions;for(const id of ['readyProduct','readyQty','readyMode'])el(id).onchange=()=>{el('readyConfirm').checked=false;preview()};
  el('readyConfirm').onchange=preview;el('readySubmit').onclick=submit;
 }
 function renderOptions(){
  const s=el('readyProduct'),previous=s.value,q=el('readySearch').value.toLowerCase().trim();
  s.replaceChildren(new Option('Selecionar produto',''));
  for(const p of (db.products||[]).filter(p=>productUsableV1803(p)&&[p.name,p.code].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt')))s.append(new Option(p.name,p.code));
  if([...s.options].some(o=>o.value===previous))s.value=previous;
  el('readyConfirm').checked=false;preview();
 }
 function preview(){
  const host=el('readyPreview');host.replaceChildren();let ok=false;
  try{const p=selected(),needs=plan(p,qty(),mode(),db.productRecipes||{},db.stock||[],productionOtherCommitmentsV20261021('',[]));const text=document.createElement('p');text.textContent=mode()==='already'?'Não altera matérias-primas.':Object.entries(needs).map(([name,n])=>name+' · '+productionFmtQtyV12632(n)+' '+(stockByName(name)?.unit||'')).join(' | ');host.append(text);ok=true}catch(e){host.textContent=e.message}
  el('readySubmit').disabled=busy||!ok||!el('readyConfirm').checked;
 }
 function renderList(){
  const host=el('readyList');host.replaceChildren();
  for(const [code,x] of window.readyStockInventory()){
   const row=document.createElement('div');row.className='ready-row';const p=(db.products||[]).find(p=>p.code===code);
   const name=document.createElement('strong');name.textContent=p?.name||code;const count=document.createElement('span');count.textContent=x.available+' disponíveis';row.append(name,count);host.append(row);
  }
  if(!host.childElementCount)host.textContent='Ainda não existem peças prontas registadas.';
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
   const p=selected(),n=qty(),m=mode(),needs=plan(p,n,m,db.productRecipes||{},db.stock||[],productionOtherCommitmentsV20261021('',[]));
   const user=await ensureCloudSession();if(!user||!auth())throw Error('Sessão necessária.');
   const [state,products]=await Promise.all([fetchCloudRowAuthoritative(user),relFetchAll(REL_TABLES.products)]);
   if(!state||stableStringify(operationalCloudSnapshotV139())!==stableStringify(operationalCloudRowSnapshotV1858(state)))throw Error('Os dados mudaram na Cloud. Recebe os dados antes de continuar.');
   const row=products.find(x=>x.id===p._rid);if(!row||productionComparableV1926(row.data,'product')!==productionComparableV1926(p,'product'))throw Error('Produto ainda não sincronizado ou alterado.');
   if(!auth())throw Error('Desbloqueia a aplicação.');
   const costs=Object.fromEntries(Object.keys(needs).map(name=>[name,materialUnitCost(name)]));
   const run={id:uid('PROD'),kind:'ready_stock',mode:m,date:todayISO(),products:[{code:p.code,name:p.name,qty:n}],total:n,materials:needs,materialUnitCosts:costs,materialCostTotal:Object.entries(needs).reduce((s,[name,q])=>s+q*costs[name],0),orders:[],orderMaterials:{},orderProducts:{}};
   localStorage.setItem(PRODUCTION_PENDING_V1926,JSON.stringify({kind:'ready_stock',userId:user.id,args:{p_revision:state.revision,p_run:run,p_product:row,p_device:getDeviceId()}}));
   dialog.close();
  }catch(e){toast(e.message||'Não foi possível preparar o registo.');return}
  finally{busy=false;productionBusyV1926=false;preview()}
  await resumeProductionV1926();
 }
 window.openReadyStock=()=>{if(!auth())return;mount();renderOptions();renderList();if(!dialog.open)dialog.showModal()};
 window.closeReadyStockOnLock=()=>{if(dialog?.open)dialog.close()};
})();
