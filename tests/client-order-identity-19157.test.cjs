const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('orders-compact-ui.js','utf8');
function setup(clients=[],orders=[]){
 let n=0;const handlers={};
 const input={value:'',addEventListener:(e,fn)=>handlers[e]=fn};
 const check={checked:false,addEventListener(){}};
 const el={after(){}};
 const document={readyState:'complete',getElementById:id=>id==='saleClient'?input:id==='saleClientMatchesV1756'?el:null,createElement:tag=>tag==='input'?check:{append(){}},createTextNode:()=>({})};
 const ctx={document,db:{clients:structuredClone(clients),orders:structuredClone(orders)},uid:()=>String(++n),todayISO:()=> '2026-11-17',isQuarantinedProductClient:c=>!!c.quarantined,upsertClientFromOrder:()=>{},ensureClientsFromOrders:()=>{},chooseSaleClientV1756:id=>{input.value=ctx.db.clients.find(c=>c.id===id)?.name||''},clearSale:()=>{},setTimeout};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script,ctx);return {ctx,check,input,handlers}
}
test('telefone temporario repetido nao identifica pessoas distintas',()=>{
 const {ctx}=setup([{id:'A',name:'Maria',phone:'900000000'}]);
 assert.notEqual(ctx.upsertClientFromOrder('Joao','900000000'),'A');
 assert.equal(ctx.db.clients.length,2);
});
test('nome unico de cliente existente pode ser reutilizado',()=>{
 const {ctx}=setup([{id:'A',name:'Maria',phone:'900000000'}]);
 assert.equal(ctx.upsertClientFromOrder('Maria','912345678'),'A');
});
test('homonimos nao sao fundidos sem selecao',()=>{
 const {ctx}=setup([{id:'A',name:'Maria'},{id:'B',name:'Maria'}]);
 assert.equal(ctx.db.clients.length,2);
 assert.notEqual(ctx.upsertClientFromOrder('Maria',''),'A');
});
test('selecao explicita do cliente correto',()=>{
 const {ctx}=setup([{id:'A',name:'Maria'},{id:'B',name:'Maria'}]);
 ctx.chooseSaleClientV1756('B');assert.equal(ctx.upsertClientFromOrder('Maria',''),'B');
});
test('criar ficha independente com nome repetido',()=>{
 const {ctx,check}=setup([{id:'A',name:'Maria'}]);check.checked=true;
 assert.notEqual(ctx.upsertClientFromOrder('Maria',''),'A');
});
test('encomenda historica ligada fica inalterada',()=>{
 const {ctx}=setup([{id:'A',name:'Maria',phone:'900000000'}],[{id:'E1',client:'Joao',contact:'900000000',clientId:'A'}]);
 ctx.ensureClientsFromOrders();
 assert.equal(ctx.db.orders[0].clientId,'A');
});
test('encomenda sem ID nao reutiliza cliente so pelo telefone',()=>{
 const {ctx}=setup([{id:'A',name:'Maria',phone:'900000000'}],[{id:'E1',client:'Joao',contact:'900000000'}]);
 ctx.ensureClientsFromOrders();assert.notEqual(ctx.db.orders[0].clientId,'A');
});
