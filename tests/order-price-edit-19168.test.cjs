const test=require('node:test'),assert=require('node:assert/strict');
const {parsePrice,editable,preview}=require('../order-price-edit-v19168.js');
function calc(o){
 const total=Math.max(0,o.items.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0)-(Number(o.discountTotal)||0));
 const cost=o.items.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.cost)||0),0);
 return {total,cost,margin:total?(total-cost)/total:0};
}
const make=(more={})=>({id:'T1',status:'Pedido',source:'manual',discountTotal:0,paid:0,items:[{code:'P1',name:'Peça',qty:2,price:10,cost:4}],...more});
test('aceita euros e cêntimos sem negativos, expoentes ou precisão indevida',()=>{
 assert.equal(parsePrice('12,50'),12.5);assert.equal(parsePrice('9.00'),9);assert.equal(parsePrice('0'),0);
 for(const value of ['','1.234','-1','1e3','NaN','5,3,2','1/2','99999999'])assert.equal(parsePrice(value),null);
});
test('pré-visualização calcula total, desconto e margem sem alterar o registo',()=>{
 const order=make({discountTotal:2}),snapshot=JSON.stringify(order);
 const result=preview(order,0,'8,50',calc);
 assert.equal(result.oldTotal,18);assert.equal(result.newTotal,15);assert.equal(result.price,8.5);assert.equal(result.cost,8);
 assert.equal(JSON.stringify(order),snapshot);
});
test('nunca permite novo total inferior ao já recebido',()=>{
 const order=make({discountTotal:2,paid:10});
 assert.throws(()=>preview(order,0,'5',calc),/valor já recebido/);
 assert.equal(preview(order,0,'6',calc).newTotal,10);
});
test('apenas manual em pedido, confirmada ou em produção sem execução concluída',()=>{
 assert.equal(editable(make(),false),true);
 assert.equal(editable(make({status:'Confirmada'}),false),true);
 assert.equal(editable(make({status:'Em produção'}),false),true);
 for(const status of ['Pronta','Entregue','Cancelado'])assert.equal(editable(make({status}),false),false);
 assert.equal(editable(make({source:'online_store'}),false),false);
 assert.equal(editable(make({voidedAt:'2026-11-18'}),false),false);
 assert.equal(editable(make(),true),false);
});
test('não admite linha de desconto nem índice inexistente',()=>{
 assert.throws(()=>preview(make(),9,'2',calc),/não encontrado/);
 assert.throws(()=>preview(make({items:[{type:'quote_discount',qty:1,price:2}]}),0,'5',calc),/não permite/);
});
