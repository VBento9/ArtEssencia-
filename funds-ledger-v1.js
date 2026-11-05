/* ArtEssencia — Mapa de Fundos V1.9.129
   Reservas calculadas a partir do Caixa. Não cria nem altera pagamentos. */
(function(){
'use strict';
const DEPTS=['materials','extras','profit','unclassified'];
const LABEL={materials:'Materiais',extras:'Despesas extras',profit:'Lucro reservado',unclassified:'Por classificar'};
const SOURCES=new Set(['order_payment','order_payment_correction','quote_payment']);
const TODAY=new Date();
const state={mode:'month',year:TODAY.getFullYear(),slot:TODAY.getMonth()+1,page:1};
const PAGE_SIZE=15;
const euroC=c=>(Number(c||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const cents=n=>Number.isFinite(Number(n))?Math.round(Number(n)*100):0;
const date=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''};
const base=()=>({materials:0,extras:0,profit:0,unclassified:0});
const total=x=>DEPTS.reduce((a,k)=>a+(x[k]||0),0);
const fill=(a,b)=>DEPTS.forEach(k=>a[k]+=(b[k]||0));
function rules(){
 const data=db?.settings?.fundsRatesV1929;
 return (Array.isArray(data)?data:[]).filter(x=>date(x.start)&&Number.isFinite(Number(x.percent))&&Number(x.percent)>=0&&Number(x.percent)<=100).sort((a,b)=>a.start.localeCompare(b.start));
}
function rateAt(d){let r=0;for(const x of rules()){if(x.start<=d)r=Number(x.percent);else break}return r}
function matchedOrder(c){
 const orders=Array.isArray(db?.orders)?db.orders:[];
 if(c.orderId){const o=orders.find(x=>String(x.id)===String(c.orderId));if(o)return o}
 if(c.quoteId){return orders.find(x=>String(x.sourceQuoteId||'')===String(c.quoteId))||null}
 return null;
}
function paymentBreakdown(c){
 const n=cents(c.value)*(c.type==='Entrada'?1:-1),o=matchedOrder(c);
 if(!o||o.status==='Cancelado'||o.voidedAt)return {amounts:{unclassified:n},why:'Pagamento sem encomenda válida'};
 const calc=calcOrder(o),gross=cents(calc.total),lines=Array.isArray(o.items)?o.items:[];
 const valid=lines.filter(x=>!['quote_discount','quote_adjustment'].includes(x.type)&&Number(x.qty)>0);
 const missing=valid.some(x=>x.cost===null||x.cost===undefined||x.cost===''||!Number.isFinite(Number(x.cost))||Number(x.cost)<0);
 const cost=cents(calc.cost);
 if(gross<=0||!valid.length||missing||cost<=0)return {amounts:{unclassified:n},why:'Falta custo histórico validado'};
 const a=Math.abs(n),sgn=n<0?-1:1;
 const mat=Math.min(a,Math.round(a*Math.min(1,cost/gross)));
 const extras=Math.min(a-mat,Math.round((a-mat)*rateAt(date(c.date))/100));
 return {amounts:{materials:sgn*mat,extras:sgn*extras,profit:sgn*(a-mat-extras)},why:cost>gross?'Custo superior à venda; reserva limitada ao recebido':'Distribuição pelo custo histórico'};
}
function movements(){
 const cash=Array.isArray(db?.cash)?db.cash:[];
 return cash.map((c,i)=>{
  const day=date(c.date),signed=cents(c.value)*(c.type==='Entrada'?1:-1),source=String(c.source||'manual');
  if(!day)return {c,i,date:'',signed,amounts:{unclassified:signed},why:'Data inválida'};
  if(SOURCES.has(source))return {c,i,date:day,signed,...paymentBreakdown(c)};
  const dept=source==='purchase'?'materials':source==='gateway_fee'?'extras':DEPTS.includes(c.fundsDepartmentV1929)?c.fundsDepartmentV1929:'unclassified';
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
 const rates=rules(),last=rates[rates.length-1],dateField=document.getElementById('fundsRateStartV1929'),pct=document.getElementById('fundsRatePercentV1929');
 if(dateField&&document.activeElement!==dateField)dateField.value=last?.start||String(TODAY.getFullYear())+'-01-01';
 if(pct&&document.activeElement!==pct)pct.value=last?String(last.percent):'0';
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
  const cls=automatic?'<span class="funds-auto-v1929">'+(SOURCES.has(src)?'Distribuição automática':LABEL[currently])+'</span>':
  '<select class="funds-dept-v1929" aria-label="Departamento do movimento" data-cashid="'+escapeAttr(String(c.id||''))+'">'+DEPTS.map(k=>'<option value="'+k+'" '+(currently===k?'selected':'')+'>'+LABEL[k]+'</option>').join('')+'</select>';
  return '<tr><td>'+escapeHtml(m.date)+'</td><td><strong>'+escapeHtml(String(c.desc||'Movimento'))+'</strong><small>'+escapeHtml(m.why)+'</small></td><td>'+cls+'</td><td class="'+(m.signed<0?'funds-debit-v1929':'funds-credit-v1929')+'">'+(m.signed<0?'−':'+')+euroC(Math.abs(m.signed))+'</td></tr>';
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
 if(kpi)kpi.innerHTML=[['Entradas no período',inSum],['Saídas no período',outSum],['Variação do período',inSum-outSum],['Saldo acumulado',total(r.closing)]].map(([name,v])=>'<div class="funds-kpi-v1929"><small>'+name+'</small><strong>'+euroC(v)+'</strong></div>').join('');
 body.innerHTML=DEPTS.map(k=>'<tr><th scope="row">'+LABEL[k]+'</th><td>'+euroC(r.opening[k])+'</td><td>'+euroC(r.inflow[k])+'</td><td>'+euroC(r.outflow[k])+'</td><td class="'+(r.closing[k]<0?'funds-negative-v1929':'')+'"><strong>'+euroC(r.closing[k])+'</strong></td></tr>').join('')+
 '<tr class="funds-total-v1929"><th scope="row">Total</th><td>'+euroC(total(r.opening))+'</td><td>'+euroC(inSum)+'</td><td>'+euroC(outSum)+'</td><td><strong>'+euroC(total(r.closing))+'</strong></td></tr>';
 const note=document.getElementById('fundsQualityV1929');
 if(note){
  const uncertain=r.rows.filter(x=>SOURCES.has(x.c.source)&&x.amounts.unclassified).length,manual=r.rows.filter(x=>!SOURCES.has(x.c.source)&&x.amounts.unclassified).length;
  note.textContent=(r.rows.length?r.rows.length+' movimento(s) no período.':'Sem movimentos registados neste período.')+
  ' Saldo inicial '+euroC(total(r.opening))+' transitado de períodos anteriores; não é receita do período. '+
  (rules().length?'Reserva extra configurada por data.':'Reserva extra por configurar: 0% até definir a regra.')+
  ' · '+uncertain+' pagamento(s) sem custos completos · '+manual+' movimento(s) sem departamento'+
  (r.invalid.length?' · '+r.invalid.length+' movimento(s) com data inválida excluídos':'')+
  '. Isto é uma estimativa interna, não prova de saldo bancário nem lucro fiscal.';
 }
 renderAnnualBreakdown(r);movementsTable(r);
}
function modeChange(){
 const nextMode=document.getElementById('fundsPeriodV1929')?.value||'month';
 const nextYear=Number(document.getElementById('fundsYearV1929')?.value)||TODAY.getFullYear();
 if(nextMode!==state.mode)state.slot=nextMode==='month'&&nextYear===TODAY.getFullYear()?TODAY.getMonth()+1:1;
 state.mode=nextMode;state.year=nextYear;state.page=1;slotOptions();render();
}
function saveRate(){
 const field=document.getElementById('fundsRatePercentV1929'),from=date(document.getElementById('fundsRateStartV1929')?.value),pct=Number(field?.value);
 if(!field||field.value===''||!from||!Number.isFinite(pct)||pct<0||pct>100)return toast('Define uma percentagem entre 0 e 100 e uma data válida.');
 if(!confirm('Aplicar uma reserva extra de '+pct+'% a partir de '+from+'? A repartição será recalculada desde essa data, sem alterar movimentos de Caixa.'))return;
 db.settings=db.settings||{};
 const old=Array.isArray(db.settings.fundsRatesV1929)?db.settings.fundsRatesV1929.slice():[];
 db.settings.fundsRatesV1929=[...old.filter(x=>x.start!==from),{start:from,percent:pct}].sort((a,b)=>a.start.localeCompare(b.start));
 if(!save()){db.settings.fundsRatesV1929=old;render();return toast('A regra não foi guardada.')}
 render();toast('Reserva de despesas extras guardada.');
}
function classify(id,dept){
 if(!DEPTS.includes(dept))return;
 const c=(db.cash||[]).find(x=>String(x.id)===String(id));if(!c)return;
 if(SOURCES.has(c.source)||['purchase','gateway_fee'].includes(c.source))return;
 const was=c.fundsDepartmentV1929||'unclassified';if(was===dept)return;
 c.fundsDepartmentV1929=dept;
 if(!save()){c.fundsDepartmentV1929=was;render();return toast('Classificação não guardada.')}
 render();toast('Departamento atualizado: '+LABEL[dept]);
}
function exportCsv(){
 const r=calculate(),fmt=n=>(n/100).toFixed(2).replace('.',',');
 const rows=[['Departamento','Saldo inicial (EUR)','Entradas (EUR)','Saídas (EUR)','Saldo final (EUR)']];
 DEPTS.forEach(k=>rows.push([LABEL[k],fmt(r.opening[k]),fmt(r.inflow[k]),fmt(r.outflow[k]),fmt(r.closing[k])]));
 rows.push(['Total',fmt(total(r.opening)),fmt(total(r.inflow)),fmt(total(r.outflow)),fmt(total(r.closing))]);
 const csv=rows.map(line=>line.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 downloadBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),'ArtEssencia_mapa_fundos_'+r.period.from+'_'+r.period.until+'.csv');
}
function bind(){
 const screen=document.getElementById('funds');if(!screen||screen.dataset.boundFundsV1929)return;
 screen.dataset.boundFundsV1929='1';controls();
 document.getElementById('fundsPeriodV1929')?.addEventListener('change',modeChange);
 document.getElementById('fundsYearV1929')?.addEventListener('change',modeChange);
 document.getElementById('fundsSlotV1929')?.addEventListener('change',e=>{state.slot=Number(e.target.value)||1;state.page=1;render()});
 document.getElementById('fundsSaveRateV1929')?.addEventListener('click',saveRate);
 document.getElementById('fundsExportV1929')?.addEventListener('click',exportCsv);
 document.getElementById('fundsMovementBodyV1929')?.addEventListener('change',e=>{if(e.target?.classList.contains('funds-dept-v1929'))classify(e.target.dataset.cashid,e.target.value)});
 document.getElementById('fundsPaginationV1929')?.addEventListener('click',e=>{const btn=e.target.closest('button[data-funds-page]');if(!btn)return;state.page+=Number(btn.dataset.fundsPage)||0;render()});
 render();
}
window.renderFundsV1929=render;
window.aeFundsCalculateV1929=calculate;
window.aeFundsAnnualRowsV1930=annualRows;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();