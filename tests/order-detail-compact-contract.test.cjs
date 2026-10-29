const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('order-detail-compact-ui.js','utf8');
test('critical actions remain unchanged',()=>{
 for(const t of ['function showOrder(id)','registerOrderPayment(','printOrderCompleteV12634(','consumeProduction(','orderDialog.showModal()'])assert(s.includes(t),t);
 assert(s.includes('order-detail-compact-ui.js'));assert(s.includes('order-detail-compact-ui.css'));
});
test('secondary panels and material consultation remain read-only',()=>{
 for(const t of ['Histórico de estados','Anulação / eliminação','Materiais previstos'])assert(js.includes(t));
 for(const t of ['supabase','localStorage','save(','saveOrder(','registerOrderPayment(','deleteOrder(','consumeProduction('])assert(!js.includes(t),t);
 // The material consultation can locate the current order, but cannot write it.
 assert.deepEqual([...new Set([...js.matchAll(/\bdb\.(\w+)/g)].map(m=>m[1]))],['orders']);
 assert.doesNotMatch(js,/\bdb\.orders\s*(?:=(?!=)|\+=|\+\+)|\bdb\.orders\.(?:push|pop|splice|sort|reverse)\(/);
 assert(js.includes('productionOrderNeedsV12632(o)'));
 assert(js.includes("productionOtherCommitmentsV20261021(o.delivery||'', [o])"));
 assert(js.includes('el.textContent=text'));
});
