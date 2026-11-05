/* ArtEssencia — Mapa de Fundos V1.9.139
   Reservas calculadas a partir do Caixa. Não cria nem altera pagamentos. */
(function(){
'use strict';
const DEPTS=['materials','labor','expenses','fixed','profit','unclassified'];
const FUNDS_DEPTS=DEPTS.filter(k=>k!=='unclassified');
const LABEL={materials:'Materiais e embalagens',labor:'Mão de obra / salário',expenses:'Custos extras',fixed:'Custos fixos',profit:'Lucro',unclassified:'Pendente de conciliação histórica'};
const SOURCES=new Set(['order_payment','order_payment_correction','quote_payment']);
const TODAY=new Date();
const state={mode:'month',year:TODAY.getFullYear(),slot:TODAY.getMonth()+1,page:1,reconcileOrderId:null};
const PAGE_SIZE=15;
const euroC=c=>(Number(c||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const cents=n=>Number.isFinite(Number(n))?Math.round(Number(n)*100):0;
const date=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''};
const base=()=>Object.fromEntries(DEPTS.map(k=>[k,0]));
const total=x=>DEPTS.reduce((a,k)=>a+(x[k]||0),0);
const distributed=x=>FUNDS_DEPTS.reduce((a,k)=>a+(x[k]||0),0);
const fill=(a,b)=>DEPTS.forEach(k=>a[k]+=(b[k]||0));

/* Conciliações históricas: guardadas em costMeta (já sincronizado pela Cloud),
   separadas da encomenda original, imutável para este efeito. */
const HISTORY_KEY='__fundsHistoricalLineCostsV1';
function historicalKey(order){return String(order?.id||'').trim()}
function historicalFingerprint(line){
 return JSON.stringify([String(line?.code??''),String(line?.name??''),Number(line?.qty)||0,Number(line?.price)||0,Number(line?.cost)||0,String(line?.type||'')]);
}
function historicalRecords(){
 const meta=db?.costMeta;
 const value=meta&&typeof meta==='object'&&!Array.isArray(meta)?meta[HISTORY_KEY]:null;
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function manualHistoricalLineCost(line,order,index){
 if(!order?.id||!Number.isInteger(index))return null;
 const rec=historicalRecords()?.[historicalKey(order)]?.[String(index)];
 if(!rec||rec.source!=='manual_historical_verified'||rec.fingerprint!==historicalFingerprint(line)||typeof rec.confirmedAt!=='string')return null;
 const qty=Number(line?.qty),cost=Number(line?.cost);
 if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(cost)||cost<0)return null;
 const fields=['materials','labor','fixed','other'];
 if(fields.some(k=>!Number.isSafeInteger(rec[k])||rec[k]<0))return null;
 if(fields.reduce((sum,k)=>sum+rec[k],0)!==cents(qty*cost)||rec.originalCostCents!==cents(qty*cost))return null;
 return {materials:rec.materials/100,labor:rec.labor/100,fixed:rec.fixed/100,expenses:rec.other/100,total:qty*cost,adjusted:0,manual:true};
}

/* Histórico contabilístico: nunca recalcular uma venda com custos atuais do produto. */
/* Respeitar o total de custo registado na venda, sem consultar a ficha
   atual. Uma pequena diferença positiva confirmada pelo total histórico
   representa custo complementar e é imputada aos custos extras. */
function historicalLineCost(line,order,index){
 function reconcile(materials,labor,fixed,other,cost,verifiedTotal){
  const vals=[materials,labor,fixed,other,cost];
  if(vals.some(v=>!Number.isFinite(v)||v<0))return null;
  const diff=cost-(materials+labor+fixed+other);
  const rounding=Math.abs(diff)<=0.03;
  const smallAdjustment=verifiedTotal&&diff>0&&diff<=Math.max(0.03,cost*0.05);
  if((!rounding&&!smallAdjustment)||other+diff<0)return null;
  return {materials,labor,fixed,expenses:other+diff,adjusted:smallAdjustment&&!rounding?diff:0};
 }
 const qty=Number(line?.qty),cost=Number(line?.cost);
 if(!line||!Number.isFinite(qty)||qty<=0||line.cost==null||line.cost===''||!Number.isFinite(cost)||cost<0)return null;
 if(line.type==='quote_extra')return {materials:0,expenses:cost*qty,fixed:0,labor:0,total:cost*qty,adjusted:0};
 let parts=null;
 const snap=line.costBreakdownSnapshotV1769;
 if(snap&&typeof snap==='object'){
  if(snap.estimated!==true&&['materials','labor','fixed','other'].every(k=>snap[k]!=null&&snap[k]!==''&&Number.isFinite(Number(snap[k]))&&Number(snap[k])>=0)){
   const verified=snap.total!=null&&snap.total!==''&&Number.isFinite(Number(snap.total))&&Math.abs(Number(snap.total)-cost)<=0.03;
   parts=reconcile(Number(snap.materials),Number(snap.labor),Number(snap.fixed),Number(snap.other),cost,verified);
  }
 }else if(line.quantityPricingSnapshot&&Number(line.quantityPricingSnapshot.units)>0){
  const p=line.quantityPricingSnapshot,u=Number(p.units);
  if(['materialsCost','laborCost','fixedCost','otherCost'].every(k=>p[k]!=null&&p[k]!==''&&Number.isFinite(Number(p[k]))&&Number(p[k])>=0))
   parts=reconcile(Number(p.materialsCost)/u,Number(p.laborCost)/u,Number(p.fixedCost)/u,Number(p.otherCost)/u,cost,false);
 }
 if(!parts)return manualHistoricalLineCost(line,order,index);
 return {materials:parts.materials*qty,expenses:parts.expenses*qty,fixed:parts.fixed*qty,labor:parts.labor*qty,total:cost*qty,adjusted:parts.adjusted*qty};
}
function matchedOrder(c){
 const orders=Array.isArray(db?.orders)?db.orders:[];
 if(c.orderId){const o=orders.find(x=>String(x.id)===String(c.orderId));if(o)return o}
 if(c.quoteId)return orders.find(x=>String(x.sourceQuoteId||'')===String(c.quoteId))||null;
 return null;
}
function orderReserveCosts(o){
 const items=Array.isArray(o.items)?o.items:[];
 const lines=items.map((line,index)=>({line,index})).filter(({line})=>!['quote_discount','quote_adjustment'].includes(line?.type)&&Number(line?.qty)>0);
 if(!lines.length)return null;
 const sums={materials:0,expenses:0,fixed:0,labor:0,adjusted:0};let cost=0;
 for(const {line,index} of lines){
  const p=historicalLineCost(line,o,index);
  if(!p)return null;
  for(const k of ['materials','expenses','fixed','labor'])sums[k]+=p[k];
  sums.adjusted+=p.adjusted||0;cost+=p.total;
 }
 const boxes=Number(o.boxes)||0;
 if(!Number.isFinite(boxes)||boxes<0)return null;
 if(boxes>0&&(o.boxCostSnapshot==null||!Number.isFinite(Number(o.boxCostSnapshot))||Number(o.boxCostSnapshot)<0))return null;
 const packaging=Math.max(0,Number(o.boxCostSnapshot)||0)*boxes;
 sums.materials+=packaging;cost+=packaging;
 if(Math.abs(calcOrder(o).cost-cost)>0.04)return null;
 return sums;
}
function paymentBreakdown(c){
 const n=cents(c.value)*(c.type==='Entrada'?1:-1),o=matchedOrder(c);
 if(!o||o.status==='Cancelado'||o.voidedAt)return {amounts:{unclassified:n},why:'Sem encomenda histórica válida associada'};
 const gross=cents(calcOrder(o).total),cost=orderReserveCosts(o);
 if(gross<=0||!cost||Math.abs(n)>gross+1)return {amounts:{unclassified:n},why:'É necessária a conciliação dos custos históricos desta venda'};
 const amount=Math.abs(n),sign=n<0?-1:1;
 const materials=Math.round(amount*cents(cost.materials)/gross);
 const expenses=Math.round(amount*cents(cost.expenses)/gross);
 const fixed=Math.round(amount*cents(cost.fixed)/gross);
 const labor=Math.round(amount*cents(cost.labor)/gross);
 const profit=amount-materials-expenses-fixed-labor;
 return {amounts:{materials:sign*materials,expenses:sign*expenses,fixed:sign*fixed,labor:sign*labor,profit:sign*profit},
  why:profit<0?'Venda com margem negativa':cost.adjusted>0?'Repartição automática; complemento histórico nos custos extras':'Repartição automática pelos custos históricos'};
}
function movements(){
 const cash=Array.isArray(db?.cash)?db.cash:[];
 return cash.map((c,i)=>{
  const day=date(c.date),signed=cents(c.value)*(c.type==='Entrada'?1:-1),source=String(c.source||'manual');
  if(!day)return {c,i,date:'',signed,amounts:{unclassified:signed},why:'Data inválida'};
  if(SOURCES.has(source))return {c,i,date:day,signed,...paymentBreakdown(c)};
  const previous=c.fundsDepartmentV1929==='extras'?'expenses':c.fundsDepartmentV1929;
  const dept=source==='purchase'?'materials':source==='gateway_fee'?'expenses':DEPTS.includes(previous)?previous:'unclassified';
  return {c,i,date:day,signed,amounts:{[dept]:signed},why:source==='purchase'?'Compra de materiais':source==='gateway_fee'?'Taxa de pagamento':dept==='unclassified'?'Movimento sem classificação':'Classificado manualmente'};
 });
}
function period(){
 const y=Math.max(2000,Math.min(2200,Math.floor(Number(state.year)||TODAY.getFullYear())));
 const slot=Math.max(1,Math.floor(Number(state.slot)||1));
 let m1=1,m2=12,label='Ano de '+y;
 if(state.mode==='month'){m1=m2=Math.min(12,slot);label=new Date(y,m1-1,1).toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}
 if(state.mode==='quarter'){m1=(Math.min(slot,4)-1)*3+1;m2=m1+2;label=Math.ceil(m1/3)+'.º trimestre de '+y}
 if(state.mode==='semester'){m1=slot===2?7:1;m2=m1+5;label=(m1===1?'1.º':'2.º')+' semestre de '+y}
 const from=y+'-'+String(m1).padStart(2,'0')+'-01';
 const until=y+'-'+String(m2).padStart(2,'0')+'-'+String(new Date(y,m2,0).getDate()).padStart(2,'0');
 return {from,until,label,year:y,firstMonth:m1,lastMonth:m2};
}
function calculate(){
 const p=period(),opening=base(),inflow=base(),outflow=base(),closing=base(),rows=[],invalid=[];
 for(const m of movements()){
  if(!m.date){invalid.push(m);continue}
  if(m.date<p.from){fill(opening,m.amounts);continue}
  if(m.date>p.until)continue;
  rows.push(m);
  for(const k of DEPTS){const v=m.amounts[k]||0;if(v>=0)inflow[k]+=v;else outflow[k]-=v}
 }
 for(const k of DEPTS)closing[k]=opening[k]+inflow[k]-outflow[k];
 return {period:p,opening,inflow,outflow,closing,rows,invalid};
}
function slotOptions(){
 const el=document.getElementById('fundsSlotV1929');if(!el)return;
 const options=[];
 if(state.mode==='month')for(let i=1;i<=12;i++)options.push([i,new Date(2026,i-1,1).toLocaleDateString('pt-PT',{month:'long'})]);
 else if(state.mode==='quarter')for(let i=1;i<=4;i++)options.push([i,i+'.º trimestre']);
 else if(state.mode==='semester')for(let i=1;i<=2;i++)options.push([i,i+'.º semestre']);
 else options.push([1,'Ano completo']);
 if(!options.some(o=>o[0]===state.slot))state.slot=1;
 el.innerHTML=options.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('');
 el.disabled=state.mode==='year';el.value=String(state.slot);
}
function controls(){
 const mode=document.getElementById('fundsPeriodV1929'),year=document.getElementById('fundsYearV1929');
 if(mode)mode.value=state.mode;
 if(year)year.value=String(state.year);
 slotOptions();
}
/* Os recebimentos históricos são agrupados por encomenda, incluindo períodos
   anteriores ao filtro atual. Não se pode imputar um custo desconhecido ao lucro. */
function pendingHistoricalOrders(){
 const groups=new Map();
 for(const c of Array.isArray(db?.cash)?db.cash:[]){
  if(!SOURCES.has(String(c?.source||'')))continue;
  const result=paymentBreakdown(c);
  if(!result.amounts.unclassified)continue;
  const o=matchedOrder(c);
  const key=o?.id?'order:'+historicalKey(o):'cash:'+String(c?.id||groups.size);
  if(!groups.has(key))groups.set(key,{key,order:o,payments:0,amount:0,lastDate:'',reason:result.why});
  const row=groups.get(key);
  row.payments++;row.amount+=result.amounts.unclassified;
  row.lastDate=date(c.date)>row.lastDate?date(c.date):row.lastDate;
 }
 return Array.from(groups.values()).sort((a,b)=>b.lastDate.localeCompare(a.lastDate));
}
function historicEditor(order){
 const lines=(Array.isArray(order.items)?order.items:[]).map((line,index)=>({line,index})).filter(({line,index})=>Number(line?.qty)>0&&!['quote_discount','quote_adjustment'].includes(line?.type)&&!historicalLineCost(line,order,index));
 if(!lines.length)return '<p>Esta encomenda não tem linhas por conciliar. Verifica a associação do pagamento ou o total da encomenda.</p>';
 const input=(index,k,label)=>'<label>'+label+'<input inputmode="decimal" type="number" min="0" step="0.01" required data-funds-field="'+k+'" data-funds-line="'+index+'" placeholder="0,00" aria-label="'+label+' da linha '+(index+1)+'"></label>';
 return '<form id="fundsHistoryFormV1" data-funds-order="'+escapeAttr(historicalKey(order))+'">'+
  '<p>Indica os <strong>custos totais de cada linha</strong> (para todas as unidades), tal como eram na data da venda. Não usar preços ou custos atuais sem comprovativo. O total de cada linha deve coincidir ao cêntimo com o custo histórico.</p>'+
  lines.map(({line,index})=>'<fieldset class="funds-history-line-v1"><legend>'+escapeHtml(String(line.name||line.code||'Produto'))+'</legend>'+
   '<small>Quantidade: '+escapeHtml(String(line.qty))+' · Custo histórico da linha: <strong>'+euroC(cents(Number(line.cost)*Number(line.qty)))+'</strong></small>'+
   '<div class="funds-history-grid-v1">'+input(index,'materials','Materiais')+input(index,'labor','Mão de obra')+input(index,'fixed','Custos fixos')+input(index,'other','Custos extras')+'</div></fieldset>').join('')+
  '<label class="funds-history-confirm-v1"><input type="checkbox" name="confirmed" required> Confirmo que os valores foram verificados com os registos históricos da venda.</label>'+
  '<p role="alert" class="funds-history-error-v1" id="fundsHistoryErrorV1" hidden></p>'+
  '<div class="funds-history-actions-v1"><button class="btn primary" type="submit">Guardar conciliação</button><button class="btn ghost" type="button" data-funds-cancel="1">Cancelar</button></div></form>';
}
function renderHistoricalPanel(){
 const screen=document.getElementById('funds');if(!screen)return;
 let panel=document.getElementById('fundsHistoryV1');
 if(!panel){panel=document.createElement('section');panel.id='fundsHistoryV1';panel.className='card funds-card-v1929 funds-history-v1';screen.appendChild(panel)}
 const outstanding=pendingHistoricalOrders();
 panel.hidden=!outstanding.length;
 if(panel.hidden){state.reconcileOrderId=null;return}
 const amount=outstanding.reduce((n,x)=>n+x.amount,0);
 panel.innerHTML='<div class="funds-card-head-v1929"><div><h3 class="section-title">Conciliação histórica</h3>'+
 '<small>'+outstanding.length+' encomenda(s) por verificar · '+euroC(amount)+' fora dos fundos disponíveis</small></div></div>'+
 '<p class="funds-history-intro-v1">O saldo não é perdido: mantém-se registado no Caixa até existirem custos históricos comprovados. Esta correção não modifica encomendas nem pagamentos.</p>'+
 '<div class="funds-history-list-v1">'+outstanding.map((x,i)=>{
  const name=x.order?'Encomenda '+String(x.order.id):'Pagamento sem encomenda associada';
  return '<div class="funds-history-row-v1"><div><strong>'+escapeHtml(name)+'</strong><small>'+escapeHtml(x.lastDate||'Data por confirmar')+' · '+x.payments+' movimento(s) · '+escapeHtml(x.reason)+'</small></div>'+
   '<div class="funds-history-row-actions-v1"><b>'+euroC(x.amount)+'</b>'+
   (x.order?'<button type="button" class="btn ghost" data-funds-review="'+escapeAttr(historicalKey(x.order))+'">Conciliar</button>':'<small>Corrigir ligação em Encomendas</small>')+'</div></div>';
 }).join('')+'</div>'+
 (state.reconcileOrderId?(()=>{const o=outstanding.find(x=>x.order&&historicalKey(x.order)===state.reconcileOrderId)?.order;return o?'<div class="funds-history-editor-v1"><h4>Verificar composição da venda</h4>'+historicEditor(o)+'</div>':''})():'');
}
function historicalError(message){
 const note=document.getElementById('fundsHistoryErrorV1');
 if(note){note.hidden=false;note.textContent=message}
}
function saveHistoricalReview(form){
 const key=String(form?.dataset.fundsOrder||''),o=(db?.orders||[]).find(x=>historicalKey(x)===key);
 if(!o||!key)return historicalError('A encomenda já não foi encontrada. Atualiza os dados antes de continuar.');
 if(o.status==='Cancelado'||o.voidedAt)return historicalError('Não é possível conciliar uma encomenda anulada.');
 const pending=(Array.isArray(o.items)?o.items:[]).map((line,index)=>({line,index})).filter(({line,index})=>Number(line?.qty)>0&&!['quote_discount','quote_adjustment'].includes(line?.type)&&!historicalLineCost(line,o,index));
 if(!pending.length)return historicalError('Não existem linhas pendentes. Atualiza o Mapa de Fundos.');
 if(!form.querySelector('[name="confirmed"]')?.checked)return historicalError('Confirma que verificaste os registos históricos.');
 const updates={};
 for(const {line,index} of pending){
  const values={};
  for(const k of ['materials','labor','fixed','other']){
   const field=form.querySelector('[data-funds-line="'+index+'"][data-funds-field="'+k+'"]');
   const raw=String(field?.value??'').trim().replace(',','.');
   if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return historicalError('Preenche '+LABEL[k==='other'?'expenses':k]+' com um valor válido (duas casas decimais) na linha '+(index+1)+'.');
   values[k]=cents(Number(raw));
  }
  const expected=cents(Number(line.qty)*Number(line.cost));
  const actual=values.materials+values.labor+values.fixed+values.other;
  if(actual!==expected)return historicalError('Linha '+(index+1)+': a soma é '+euroC(actual)+', mas o custo histórico é '+euroC(expected)+'. Corrige antes de guardar.');
  updates[String(index)]={...values,originalCostCents:expected,fingerprint:historicalFingerprint(line),confirmedAt:new Date().toISOString(),source:'manual_historical_verified'};
 }
 const before=db.costMeta;
 const meta=before&&typeof before==='object'&&!Array.isArray(before)?before:{};
 const existing=historicalRecords();
 db.costMeta={...meta,[HISTORY_KEY]:{...existing,[key]:{...(existing[key]||{}),...updates}}};
 if(!save('none')){db.costMeta=before;return historicalError('A conciliação não ficou guardada. Verifica o armazenamento e tenta novamente.')}
 state.reconcileOrderId=null;render();
 toast('Conciliação guardada no dispositivo; aguarda sincronização Cloud.');
}

function movementsTable(r){
 const body=document.getElementById('fundsMovementBodyV1929');if(!body)return;
 const rows=r.rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.i-a.i),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
 state.page=Math.min(pages,Math.max(1,state.page));
 const sub=rows.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE);
 body.innerHTML=sub.length?sub.map(m=>{
  const c=m.c,src=String(c.source||'manual');
  const automatic=SOURCES.has(src)||src==='purchase'||src==='gateway_fee';
  const currently=DEPTS.find(k=>m.amounts[k])||'unclassified';
  const split=DEPTS.filter(k=>m.amounts[k]).map(k=>'<span class="funds-part-v1936"><b>'+LABEL[k]+'</b> '+euroC(m.amounts[k])+'</span>').join('');
  const cls=automatic?'<span class="funds-auto-v1929">'+(SOURCES.has(src)?'Distribuição automática':LABEL[currently])+'</span>':
  '<select class="funds-dept-v1929" aria-label="Departamento do movimento" data-cashid="'+escapeAttr(String(c.id||''))+'">'+DEPTS.map(k=>'<option value="'+k+'" '+(currently===k?'selected':'')+'>'+LABEL[k]+'</option>').join('')+'</select>';
  return '<tr><td>'+escapeHtml(m.date)+'</td><td><strong>'+escapeHtml(String(c.desc||'Movimento'))+'</strong><small>'+escapeHtml(m.why)+'</small>'+(SOURCES.has(src)?'<div class="funds-split-v1936">'+split+'</div>':'')+'</td><td>'+cls+'</td><td class="'+(m.signed<0?'funds-debit-v1929':'funds-credit-v1929')+'">'+(m.signed<0?'−':'+')+euroC(Math.abs(m.signed))+'</td></tr>';
 }).join(''):'<tr><td colspan="4" class="empty">Sem movimentos no período selecionado.</td></tr>';
 const pagesNode=document.getElementById('fundsPaginationV1929');
 if(pagesNode)pagesNode.innerHTML=pages>1?'<button class="btn" type="button" data-funds-page="-1" '+(state.page===1?'disabled':'')+'>Anterior</button><span>Página '+state.page+' de '+pages+'</span><button class="btn" type="button" data-funds-page="1" '+(state.page===pages?'disabled':'')+'>Seguinte</button>':'';
 const count=document.getElementById('fundsMovementCountV1929');if(count)count.textContent=rows.length+' movimento(s)';
}
function annualRows(r){
 const months=Array.from({length:12},(_,i)=>({month:i+1,entries:0,exits:0,count:0,closing:0}));
 for(const m of r.rows){
  const month=Number(m.date.slice(5,7));if(month<1||month>12)continue;
  const row=months[month-1];row.count++;
  if(m.signed>=0)row.entries+=m.signed;else row.exits-=m.signed;
 }
 let balance=total(r.opening);
 for(const row of months){balance+=row.entries-row.exits;row.closing=balance}
 return months;
}
function renderAnnualBreakdown(r){
 const body=document.getElementById('fundsTableBodyV1929'),wrapper=body?.closest?.('.funds-tablewrap-v1929');if(!wrapper)return;
 let panel=document.getElementById('fundsAnnualBreakdownV1930');
 if(!panel){panel=document.createElement('section');panel.id='fundsAnnualBreakdownV1930';panel.className='funds-annual-v1930';wrapper.insertAdjacentElement('afterend',panel)}
 panel.hidden=state.mode!=='year';if(panel.hidden)return;
 panel.innerHTML='<h3>Resumo mensal de '+r.period.year+'</h3><p>Os movimentos pertencem ao mês indicado; o saldo acumulado inclui períodos anteriores.</p>'+
 '<div class="funds-tablewrap-v1929"><table><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Variação</th><th>Saldo acumulado</th></tr></thead><tbody>'+
 annualRows(r).map(row=>'<tr><th scope="row">'+new Date(r.period.year,row.month-1,1).toLocaleDateString('pt-PT',{month:'long'})+
 '</th><td>'+euroC(row.entries)+'</td><td>'+euroC(row.exits)+'</td><td>'+euroC(row.entries-row.exits)+'</td><td>'+euroC(row.closing)+'</td></tr>').join('')+
 '</tbody></table></div>'+(!r.rows.length?'<p>Sem movimentos de Caixa registados neste ano; o saldo inicial transita de anos anteriores.</p>':'');
}
function render(){
 const body=document.getElementById('fundsTableBodyV1929');if(!body)return;
 const r=calculate(),label=document.getElementById('fundsAppliedV1929');if(label)label.textContent='Período: '+r.period.label;
 const kpi=document.getElementById('fundsKpisV1929'),inSum=total(r.inflow),outSum=total(r.outflow);
 if(kpi)kpi.innerHTML=[...FUNDS_DEPTS.map(k=>[LABEL[k],r.closing[k]]),['Total distribuído',distributed(r.closing)]].map(([name,v])=>'<div class="funds-kpi-v1929"><small>'+name+'</small><strong>'+euroC(v)+'</strong></div>').join('');
 body.innerHTML=FUNDS_DEPTS.map(k=>'<tr><th scope="row">'+LABEL[k]+'</th><td>'+euroC(r.opening[k])+'</td><td>'+euroC(r.inflow[k])+'</td><td>'+euroC(r.outflow[k])+'</td><td class="'+(r.closing[k]<0?'funds-negative-v1929':'')+'"><strong>'+euroC(r.closing[k])+'</strong></td></tr>').join('')+
 '<tr class="funds-total-v1929"><th scope="row">Total distribuído</th><td>'+euroC(distributed(r.opening))+'</td><td>'+euroC(distributed(r.inflow))+'</td><td>'+euroC(distributed(r.outflow))+'</td><td><strong>'+euroC(distributed(r.closing))+'</strong></td></tr>';
 const note=document.getElementById('fundsQualityV1929');
 if(note){
  const uncertain=r.rows.filter(x=>SOURCES.has(x.c.source)&&x.amounts.unclassified).length,manual=r.rows.filter(x=>!SOURCES.has(x.c.source)&&x.amounts.unclassified).length;
  note.textContent=(r.rows.length?r.rows.length+' movimento(s) no período.':'Sem movimentos registados neste período.')+
  ' Saldo inicial '+euroC(total(r.opening))+' transitado de períodos anteriores; não é receita do período. '+
  ' Repartição pelos custos históricos de cada venda, quando completos.'+
  (r.closing.unclassified?' · Atenção: '+euroC(r.closing.unclassified)+' em conciliação histórica, fora dos fundos disponíveis.':'')+
  (uncertain||manual?' · '+uncertain+' pagamento(s) com dados históricos insuficientes · '+manual+' movimento(s) avulso(s) por conciliar.':'')+
  (r.invalid.length?' · '+r.invalid.length+' movimento(s) com data inválida excluídos':'')+
  '. Isto é uma estimativa interna, não prova de saldo bancário nem lucro fiscal.';
 }
 renderAnnualBreakdown(r);movementsTable(r);renderHistoricalPanel();
}
function modeChange(){
 const nextMode=document.getElementById('fundsPeriodV1929')?.value||'month';
 const nextYear=Number(document.getElementById('fundsYearV1929')?.value)||TODAY.getFullYear();
 if(nextMode!==state.mode)state.slot=nextMode==='month'&&nextYear===TODAY.getFullYear()?TODAY.getMonth()+1:1;
 state.mode=nextMode;state.year=nextYear;state.page=1;slotOptions();render();
}
function classify(id,dept){
 if(!DEPTS.includes(dept))return;
 const c=(db.cash||[]).find(x=>String(x.id)===String(id));if(!c)return;
 if(SOURCES.has(c.source)||['purchase','gateway_fee'].includes(c.source))return;
 const was=c.fundsDepartmentV1929||'unclassified';if(was===dept||(was==='extras'&&dept==='expenses'))return;
 c.fundsDepartmentV1929=dept;
 if(!save()){c.fundsDepartmentV1929=was;render();return toast('Classificação não guardada.')}
 render();toast('Departamento atualizado: '+LABEL[dept]);
}
function exportCsv(){
 const r=calculate(),fmt=n=>(n/100).toFixed(2).replace('.',',');
 const rows=[['Departamento','Saldo inicial (EUR)','Entradas (EUR)','Saídas (EUR)','Saldo final (EUR)']];
 FUNDS_DEPTS.forEach(k=>rows.push([LABEL[k],fmt(r.opening[k]),fmt(r.inflow[k]),fmt(r.outflow[k]),fmt(r.closing[k])]));
 rows.push(['Total distribuído',fmt(distributed(r.opening)),fmt(distributed(r.inflow)),fmt(distributed(r.outflow)),fmt(distributed(r.closing))]);
 if(r.opening.unclassified||r.inflow.unclassified||r.outflow.unclassified||r.closing.unclassified)rows.push(['Em conciliação histórica (não disponível)',fmt(r.opening.unclassified),fmt(r.inflow.unclassified),fmt(r.outflow.unclassified),fmt(r.closing.unclassified)]);
 rows.push(['Saldo contabilístico de Caixa',fmt(total(r.opening)),fmt(total(r.inflow)),fmt(total(r.outflow)),fmt(total(r.closing))]);
 const csv=rows.map(line=>line.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 downloadBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),'ArtEssencia_mapa_fundos_'+r.period.from+'_'+r.period.until+'.csv');
}
function bind(){
 const screen=document.getElementById('funds');if(!screen||screen.dataset.boundFundsV1929)return;
 screen.dataset.boundFundsV1929='1';controls();
 document.getElementById('fundsPeriodV1929')?.addEventListener('change',modeChange);
 document.getElementById('fundsYearV1929')?.addEventListener('change',modeChange);
 document.getElementById('fundsSlotV1929')?.addEventListener('change',e=>{state.slot=Number(e.target.value)||1;state.page=1;render()});
 document.getElementById('fundsExportV1929')?.addEventListener('click',exportCsv);
 document.getElementById('fundsMovementBodyV1929')?.addEventListener('change',e=>{if(e.target?.classList.contains('funds-dept-v1929'))classify(e.target.dataset.cashid,e.target.value)});
 document.getElementById('fundsPaginationV1929')?.addEventListener('click',e=>{const btn=e.target.closest('button[data-funds-page]');if(!btn)return;state.page+=Number(btn.dataset.fundsPage)||0;render()});
 screen.addEventListener('click',e=>{
  const review=e.target.closest?.('[data-funds-review]'),cancel=e.target.closest?.('[data-funds-cancel]');
  if(review){state.reconcileOrderId=review.dataset.fundsReview;renderHistoricalPanel()}
  if(cancel){state.reconcileOrderId=null;renderHistoricalPanel()}
 });
 screen.addEventListener('submit',e=>{
  if(e.target?.id!=='fundsHistoryFormV1')return;
  e.preventDefault();saveHistoricalReview(e.target);
 });
 render();
}
window.renderFundsV1929=render;
window.aeFundsCalculateV1929=calculate;
window.aeFundsAnnualRowsV1930=annualRows;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();