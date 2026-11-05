const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('funds-ledger-v1.js','utf8');
const start=js.indexOf('const DEPTS=');
const end=js.indexOf('function slotOptions(){',start);
assert.ok(start>0&&end>start);
const snippet=js.slice(start,end);
function scenario(cash,orders,year=2026,month=11){
 const ctx={
  db:{cash,orders},
  document:{},
  Date,Number,String,Object,Math,Array,Set,
  calcOrder:o=>({total:o.total,cost:(o.items||[]).reduce((a,x)=>a+x.cost*x.qty,0)}),
 };
 vm.createContext(ctx);
 vm.runInContext(snippet,ctx);
 vm.runInContext('state.mode="month";state.year='+year+';state.slot='+month,ctx);
 return ctx.calculate();
}
function plain(x){return JSON.parse(JSON.stringify(x))}
const item={qty:1,cost:70,costBreakdownSnapshotV1769:{materials:25,other:0,fixed:15,labor:30,total:70,estimated:false}};
const orders=[{id:'ORD-1',total:100,status:'Entregue',items:[item]}];
test('Entradas de novembro são repartidas sem saldo NaN',()=>{
 const r=scenario([{date:'2026-11-05',type:'Entrada',value:100,source:'order_payment',orderId:'ORD-1'}],orders);
 assert.deepEqual(plain(r.closing),{materials:2500,expenses:1500,labor:3000,profit:3000,unclassified:0});
 assert.equal(Object.values(r.closing).reduce((s,n)=>s+n,0),10000);
});
test('Saldo de outubro transita para novembro nas quatro rubricas',()=>{
 const r=scenario([
  {date:'2026-10-31',type:'Entrada',value:40,source:'order_payment',orderId:'ORD-1'},
  {date:'2026-11-05',type:'Entrada',value:60,source:'order_payment',orderId:'ORD-1'}
 ],orders);
 assert.deepEqual(plain(r.opening),{materials:1000,expenses:600,labor:1200,profit:1200,unclassified:0});
 assert.deepEqual(plain(r.inflow),{materials:1500,expenses:900,labor:1800,profit:1800,unclassified:0});
 assert.equal(r.rows.length,1);
 assert.deepEqual(plain(r.closing),{materials:2500,expenses:1500,labor:3000,profit:3000,unclassified:0});
});
test('Saída classificada como despesa reduz o saldo de despesas',()=>{
 const r=scenario([
  {date:'2026-11-05',type:'Entrada',value:100,source:'order_payment',orderId:'ORD-1'},
  {date:'2026-11-06',type:'Saída',value:10,source:'manual',fundsDepartmentV1929:'expenses'}
 ],orders);
 assert.equal(r.closing.expenses,500);
 assert.equal(Object.values(r.closing).reduce((s,n)=>s+n,0),9000);
});
test('Classificações antigas extras são preservadas como despesas',()=>{
 const r=scenario([{date:'2026-11-05',type:'Saída',value:5,source:'manual',fundsDepartmentV1929:'extras'}],orders);
 assert.equal(r.closing.expenses,-500);
 assert.equal(r.closing.unclassified,0);
});
test('Compra reduz materiais sem mexer no dinheiro do trabalho',()=>{
 const r=scenario([
  {date:'2026-11-05',type:'Entrada',value:100,source:'order_payment',orderId:'ORD-1'},
  {date:'2026-11-06',type:'Saída',value:12,source:'purchase'}
 ],orders);
 assert.equal(r.closing.materials,1300);
 assert.equal(r.closing.labor,3000);
 assert.equal(Object.values(r.closing).reduce((s,n)=>s+n,0),8800);
});
