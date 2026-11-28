'use strict';
const organizer=require('../intelligence/stock-organizer.js');
function testOrganizer(o){
 let count=0;const check=(v,msg)=>{if(!v)throw Error(msg);count++;};
 const db={stock:[{name:'Cera APF',qty:100,unit:'g',unitCost:.02},{name:'Cera soja APF',qty:250,unit:'g',unitCost:.02},{name:'Pavio',qty:4,unit:'un',unitCost:.1},{name:'Pavios',qty:6,unit:'un',unitCost:.1}],products:[{code:'A'},{code:'B'}],productRecipes:{A:[{item:'Cera APF',qty:20}],B:[{item:'Pavio',qty:1}]},purchases:[],stockMoves:[],productionRuns:[],orders:[],costMeta:{}};
 const req={sourceName:'Cera APF',targetName:'Cera soja APF',identityConfirmed:true,balanceMode:'distinct_physical_balances'},req2={...req,sourceName:'Pavio',targetName:'Pavios'};
 const before=JSON.stringify(db),plan=o.planMerge(db,req),sim=o.simulateMerge(db,plan);
 check(plan.status==='review'&&plan.quantity===350&&plan.inventoryValue===7,'saldo e valor');
 check(sim.snapshot.stock.length===3&&sim.snapshot.stock[0].name===req.targetName,'stock simulado');
 check(sim.snapshot.productRecipes.A[0].item===req.targetName&&sim.snapshot.productRecipes.A[0].qty===20,'receita');
 check(JSON.stringify(sim.rollbackSnapshot)===before&&JSON.stringify(db)===before,'reversao e imutabilidade');
 check(o.planMerge(db,{...req,identityConfirmed:false}).status==='blocked','identidade');
 check(o.planMerge(db,{...req,balanceMode:'duplicate_record'}).status==='blocked','dupla contagem');
 check(o.planMerge({...db,stock:db.stock.map((s,i)=>i===1?{...s,unitCost:.03}:s)},req).status==='blocked','custo');
 check(o.planMerge({...db,stock:db.stock.map((s,i)=>i===1?{...s,unit:'ml'}:s)},req).status==='blocked','unidade');
 check(o.planMerge({...db,stock:db.stock.map((s,i)=>i===1?{...s,preferredSupplier:'Outro'}:s)},req).status==='blocked','metadados');
 check(o.planMerge({...db,purchases:[{item:req.targetName}]},req).status==='blocked','historico');
 check(o.planMerge({...db,productRecipes:{A:[...db.productRecipes.A,{item:req.targetName,qty:1}]}},req).status==='blocked','duas linhas');
 check(o.planMerge({...db,stock:db.stock.map((s,i)=>i===1?{...s,id:'abc'}:s)},req).status==='blocked','id');
 check(o.planBatch(db,[req,req2]).snapshot.stock.length===2,'lote');
 check(o.planBatch(db,[req,req]).status==='blocked','sobreposicao');
 check(!o.planBatch(db,[req,{...req2,identityConfirmed:false}]).snapshot,'lote atomico simulado');
 check(o.classify([{name:'Cera de soja'},{name:'Fragrância Baunilha'},{name:'Caixa para cera'},{name:'Produto 1'}]).map(x=>x.suggestedCategory).join('|')==='Ceras|Fragrâncias||','classificacao');
 check(o.duplicates([{name:'Fragrância'},{name:'FRAGRANCIA'},{name:'Cera'}]).length===1,'duplicados candidatos');
 let denied=false;try{o.simulateMerge({...db,stock:db.stock.map((s,i)=>i===0?{...s,qty:99}:s)},plan)}catch{denied=true;}check(denied,'plano obsoleto');
 denied=false;try{o.simulateMerge(db,{...plan,quantity:999})}catch{denied=true;}check(denied,'plano manipulado');
 return count;
}
console.log('Verificações concluídas:',testOrganizer(organizer));
