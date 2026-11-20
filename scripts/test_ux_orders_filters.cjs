'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
for(const id of ['orderSearch','orderFilter','orderDateFromV1882','orderDateToV1882','ordersClearFiltersV1915','ordersResultsV1915'])assert.ok(html.includes('id="'+id+'"'), 'Missing '+id);
assert.match(html,/function clearOrderFiltersV1915\(\)\{/);
assert.match(html,/if\(clearBtn\)clearBtn.disabled=!filtersActive/);
assert.match(html,/if\(results\)results.textContent=rows.length/);
assert.match(html,/function renderOrders\(\)/);
assert.match(html,/function setStatus\(/);
assert.match(html,/function showOrder\(/);
assert.match(html,/function orderAttentionLabelV1915\(o\)/);
assert.match(html,/Pronta · pagamento pendente/);
assert.match(html,/order-attention-v1915/);

const vm=require('node:vm');
const start=html.indexOf('function orderAttentionLabelV1915(o){');
const end=html.indexOf('\nfunction ',start+10);
assert.ok(start>=0&&end>start,'Attention-label function should be extractable');
const context={calcOrder:o=>({total:o.total})};
vm.runInNewContext(html.slice(start,end),context);
assert.equal(context.orderAttentionLabelV1915({status:'Pedido'}),'Por confirmar');
assert.equal(context.orderAttentionLabelV1915({status:'Em produção'}),'Em produção');
assert.equal(context.orderAttentionLabelV1915({status:'Pronta',total:30,paid:10}),'Pronta · pagamento pendente');
assert.equal(context.orderAttentionLabelV1915({status:'Pronta',total:30,paid:30}),'Pronta para entrega');
assert.equal(context.orderAttentionLabelV1915({status:'Entregue'}),'');
assert.match(html,/function viewOrderProductionV1915\(id\)/);
assert.match(html,/go\('production'\)/);
assert.match(html,/Ver produção/);
assert.ok(html.includes("onclick=\"viewOrderProductionV1915('${escapeHtml(o.id)}')\""),'Production button handler must have valid quoting');
assert.match(html,/id="orderProductionContextV1915"/);
assert.match(html,/id="orderProductionMessageV1915"/);
assert.match(html,/Voltar às encomendas/);
assert.match(html,/A agenda pode incluir outras encomendas da mesma data/);
// Exercise the real navigation functions: invalid deliveries must leave the agenda on its current day.
const agendaSource=html.slice(html.indexOf('function viewOrderProductionV1915('),html.indexOf('function clearOrderFiltersV1915('));
const order={id:'A',delivery:''};
const prodDate={value:''};
const agendaContext={hidden:true};
let renders=0;
const agenda={db:{orders:[order]},prodDate,productionListOriginV1915:null,window:{scrollY:0},
 document:{getElementById:id=>id==='orderProductionContextV1915'?agendaContext:null,querySelector:()=>null},
 go:page=>assert.equal(page,'production'),renderProduction:()=>{renders++}};
vm.runInNewContext(agendaSource,agenda);
for(const [delivery,expected] of [['2028-02-29','2028-02-29'],['2026-02-29','2026-10-01'],['','2026-10-01']]){
 order.delivery=delivery;prodDate.value='2026-10-01';renders=0;agendaContext.hidden=true;
 agenda.viewOrderProductionV1915(order.id);
 assert.equal(prodDate.value,expected);
 assert.equal(renders,1);
 assert.equal(agendaContext.hidden,false);
}
console.log('Orders filters and read-only attention labels structural checks passed');
