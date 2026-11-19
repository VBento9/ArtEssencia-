'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const labels=['Departamento','Saldo inicial','Entradas','Saídas','Saldo final'];
const movementLabels=['Data','Movimento','Departamento','Montante'];
const quoteCells=['AS-2026-Q001','Cliente Evento','2026-11-19','2026-12-01','56,00 €','20,00 €','Rascunho','Ver PDF'];
const quoteRow='<tr>'+quoteCells.map((v,i)=>'<td data-label="'+['N.º','Cliente','Evento','Validade','Total','Pagamento','Estado','Ações'][i]+'">'+v+'</td>').join('')+'</tr>';
const deptRow='<tr><th scope="row">Materiais</th>'+['10,00 €','24,00 €','3,00 €','31,00 €'].map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const moveRow='<tr>'+['2026-11-19','Pagamento encomenda de teste','Distribuição automática','+ 21,50 €'].map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const html='<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}.app{display:grid;grid-template-columns:205px minmax(0,1fr)}.sidebar{background:#eee}.main{padding:20px;min-width:0}.screen{min-width:0}.card{border:1px solid #ddd;border-radius:10px;padding:13px;margin:0 0 10px;min-width:0}.tablewrap{overflow:auto}.btn{min-height:44px;padding:9px 11px;border:1px solid #ddd}.quotes-history-table-v1730 tbody tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.quotes-history-table-v1730 tbody td{min-width:0}.qh-toolbar-1965{display:grid;grid-template-columns:2fr 1fr 1fr;gap:9px}.qh-toolbar-1965 label{display:grid}.qh-toolbar-1965 input,.qh-toolbar-1965 select{min-width:0}.reports-stack-v1725,.reports-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.report-line{display:grid;grid-template-columns:1fr auto}.funds-tablewrap-v1929{overflow-x:auto}.funds-tablewrap-v1929 table{width:100%;min-width:640px;border-collapse:collapse}.funds-tablewrap-v1929 th,.funds-tablewrap-v1929 td{padding:10px;border-bottom:1px solid #ddd}.funds-kpis-v1929{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media(max-width:650px){.app{grid-template-columns:1fr}.sidebar{display:none}.main{padding:12px}}</style></head><body><div class="app"><aside class="sidebar"></aside><main class="main">'+
'<section id="quotes" class="screen"><div class="card quotes-history-card-v1730"><div class="qh-toolbar-1965"><label class="qh-search-1965">Pesquisar<input></label><label>Estado<select><option>Todos</option></select></label><label>Por página<select><option>8</option></select></label></div><div class="tablewrap quotes-history-table-v1730"><table><thead><tr>'+['N.º','Cliente','Evento','Validade','Total','Pagamento','Estado','Ações'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+quoteRow+'</tbody></table></div></div></section>'+
'<section id="reports" class="screen"><div class="reports-kpis">'+Array.from({length:6},(_,i)=>'<div class="card report-kpi"><span>Indicador '+i+'</span><strong>24,00 €</strong><small>Período selecionado</small></div>').join('')+'</div><div class="reports-stack-v1725"><section class="card reports-section-v1725"><div class="report-line"><span>Recebido no período</span><strong>24,00 €</strong></div></section><section class="card reports-section-v1725"><div class="report-line"><span>Lucro estimado</span><strong>9,50 €</strong></div></section></div></section>'+
'<section id="funds" class="screen"><section class="card funds-controls-v1929"><label>Período</label></section><section class="card funds-card-v1929"><div class="funds-tablewrap-v1929"><table><thead><tr>'+labels.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody id="fundsTableBodyV1929">'+deptRow.repeat(2)+'</tbody></table></div></section><section class="card funds-card-v1929"><div class="funds-tablewrap-v1929"><table class="funds-movement-table-v1929"><thead><tr>'+movementLabels.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody id="fundsMovementBodyV1929">'+moveRow.repeat(2)+'</tbody></table></div></section></section>'+
'</main></div></body></html>';
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1440,1024,800,390]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  await page.setContent(html);
  for(const file of ['quote-history-compact-v1965.css','funds-ledger-v1.css','backoffice-visual.css'])await page.addStyleTag({path:path.resolve(__dirname,'..',file)});
  const layout=await page.evaluate(()=>{
   const $=s=>document.querySelector(s),cs=s=>getComputedStyle($(s));
   const columns=s=>cs(s).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
   const overflow=s=>$(s).scrollWidth-$(s).clientWidth;
   return {quotesWidth:$('.quotes-history-card-v1730').clientWidth,quotesCols:columns('.qh-toolbar-1965'),quotesScroll:overflow('.quotes-history-table-v1730'),reportsWidth:$('#reports').clientWidth,reportsCols:columns('.reports-stack-v1725'),reportsKpis:columns('.reports-kpis'),fundsWidth:$('#funds .funds-card-v1929').clientWidth,fundsCardRow:cs('#fundsTableBodyV1929 tr').display,movementCardRow:cs('#fundsMovementBodyV1929 tr').display,fundsScroll:overflow('#funds .funds-tablewrap-v1929'),movementScroll:overflow('#funds .funds-movement-table-v1929'),reportLineValue:cs('.report-line strong').whiteSpace};
  });
  assert.equal(layout.quotesCols,layout.quotesWidth<=540?1:layout.quotesWidth<=820?2:3,JSON.stringify({width,layout}));
  assert.equal(layout.reportsCols,layout.reportsWidth<=960?1:2,JSON.stringify({width,layout}));
  assert.equal(layout.reportsKpis,layout.reportsWidth<=520?1:layout.reportsWidth<=960?2:3,JSON.stringify({width,layout}));
  assert.equal(layout.fundsCardRow,layout.fundsWidth<=880?'grid':'table-row',JSON.stringify({width,layout}));
  assert.equal(layout.movementCardRow,layout.fundsWidth<=880?'grid':'table-row',JSON.stringify({width,layout}));
  if(layout.fundsWidth<=880)assert.ok(layout.fundsScroll<=2&&layout.movementScroll<=2,'Mapa com scroll em '+width+' '+JSON.stringify(layout));
  assert.equal(layout.reportLineValue,'nowrap');
  await page.close();
 }
 console.log('PASS — Orçamentos, Relatórios e Mapa de Fundos: 1440/1024/800/390 px, sem Cloud');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
