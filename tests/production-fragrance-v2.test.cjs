const {test}=require('node:test'),assert=require('node:assert/strict');
const {applySelections}=require('../production-fragrance-v2.js');
const stock=[{name:'Cera',unit:'g',qty:500},{name:'Ref',unit:'g',qty:50,unitCost:.1},{name:'A',unit:'g',qty:30,unitCost:.2},{name:'B',unit:'g',qty:20,unitCost:.3}],allowed=['Ref','A','B'];
const selection=(actualItem,actualQty,referenceQty=10)=>({referenceItem:'Ref',referenceQty,referenceUnitCost:.1,actualItem,actualQty,unit:'g'});
test('distinct line choices aggregate actual consumption without input writes',()=>{const before=JSON.stringify(stock),needs={Cera:300,Ref:30};assert.deepEqual(applySelections(needs,[selection('A',22,20),selection('B',9)],stock,allowed),{Cera:300,A:22,B:9});assert.deepEqual(needs,{Cera:300,Ref:30});assert.equal(JSON.stringify(stock),before)});
test('aggregate stock exhaustion blocked even when individual lines fit',()=>{assert.throws(()=>applySelections({Ref:20},[selection('A',20),selection('A',20)],stock,allowed),/insuficiente/)});
test('same reference article works without extra consumption',()=>{assert.deepEqual(applySelections({Ref:10},[selection('Ref',10)],stock,allowed),{Ref:10})});
test('missing, unauthorized, incompatible, zero, missing cost rejected',()=>{
 for(const [s,items,list] of [[selection('Missing',1),stock,[...allowed,'Missing']],[selection('Cera',1),stock,allowed],[{...selection('A',1),unit:'ml'},stock,allowed],[selection('A',0),stock,allowed],[selection('A',1),stock.map(x=>x.name==='A'?{...x,unitCost:null}:x),allowed]])assert.throws(()=>applySelections({Ref:10},[s],items,list));
});
