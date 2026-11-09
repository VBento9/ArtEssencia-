const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planProductionFragrance:plan}=require('../production-fragrance-plan-v1.cjs');
const recipe=[{item:'Cera',qty:100,unit:'g'},{item:'Fragrância de referência',qty:10,unit:'g',unitCost:.08},{item:'Pavio',qty:1,unit:'un'}];
const stock=[{name:'Fragrância real',qty:60,unit:'g',unitCost:.11}];
const args=()=>({orderId:'O-1',lineId:'L-1',recipe,selectedStockItem:'Fragrância real',actualQty:12,stock});
test('substitui apenas fragrância, preserva origem e não modifica entrada',()=>{const a=args(),before=JSON.stringify(a),out=plan(a);assert.equal(out.materials[0].item,'Cera');assert.equal(out.materials[1].item,'Fragrância real');assert.equal(out.materials[2].item,'Pavio');assert.equal(out.substitution.referenceCost,.8);assert.ok(Math.abs(out.substitution.costDifference-.52)<1e-9);assert.equal(out.cloudValidated,false);assert.equal(JSON.stringify(a),before)});
test('rejeita stock insuficiente e unidades incompatíveis',()=>{assert.throws(()=>plan({...args(),actualQty:80}),/stock insuficiente/);assert.throws(()=>plan({...args(),stock:[{...stock[0],unit:'ml'}]}),/unidade/);assert.throws(()=>plan({...args(),actualQty:0}),/quantidade/)});
test('rejeita receita ambígua',()=>{assert.throws(()=>plan({...args(),recipe:[recipe[0]]}),/unica/);assert.throws(()=>plan({...args(),recipe:[...recipe,{item:'Essência aromática',qty:2,unit:'g'}]}),/unica/)});
