'use strict';
const planner=require('../intelligence/rename-planner.js');
function testPlanner(p){
 const assert=(v,m)=>{if(!v)throw Error(m);};let n=0;const check=(v,m)=>{assert(v,m);n++;};
 const db={stock:[{name:'Cera soja APF',unit:'g',qty:1000,unitCost:.01}],products:[{code:'A'},{code:'B'}],productRecipes:{A:[{item:'Cera soja APF',qty:25}],B:[{item:'Cera soja APF',qty:40}]},purchases:[],stockMoves:[],productionRuns:[],orders:[],costMeta:{}};
 const before=JSON.stringify(db),plan=p.planRename(db,'Cera soja APF','Cera de Soja — Alto Ponto de Fusão');
 check(plan.status==='review'&&plan.impact.recipeLines===2&&plan.patches.length===3,'impacto');
 const sim=p.simulateRename(db,plan);
 check(sim.snapshot.stock[0].name===plan.newName&&sim.snapshot.productRecipes.B[0].item===plan.newName,'referencias');
 check(sim.snapshot.stock[0].qty===1000&&sim.snapshot.stock[0].unitCost===.01&&sim.snapshot.productRecipes.B[0].qty===40,'quantidades e custos');
 check(sim.reversePatches.length===3&&sim.reversePatches[0].before===plan.newName,'reversao');
 check(JSON.stringify(db)===before,'imutabilidade');
 check(p.planRename({...db,stock:[...db.stock,{name:plan.newName.toUpperCase()}]},plan.oldName,plan.newName).status==='blocked','colisao');
 check(p.planRename({...db,purchases:[{item:plan.oldName}]},plan.oldName,plan.newName).status==='blocked','compras');
 check(p.planRename({...db,stockMoves:[{item:plan.oldName}]},plan.oldName,plan.newName).status==='blocked','movimentos');
 check(p.planRename({...db,productionRuns:[{kind:'ready_stock',materials:{[plan.oldName]:2}}]},plan.oldName,plan.newName).status==='blocked','historico producao');
 check(p.planRename({...db,orders:[{box:plan.oldName}]},plan.oldName,plan.newName).status==='blocked','embalagem');
 check(p.planRename({...db,costMeta:{[plan.oldName]:{}}},plan.oldName,plan.newName).status==='blocked','metadados');
 check(p.planRename({...db,products:[{code:'A',recipe:[{materialId:1}]}]},plan.oldName,plan.newName).status==='blocked','legado');
 check(p.planRename({...db,productRecipes:{...db.productRecipes,C:[{item:plan.newName}]}},plan.oldName,plan.newName).status==='blocked','destino orfao');
 let rejected=false;try{p.simulateRename({...db,productRecipes:{A:db.productRecipes.A}},plan)}catch{rejected=true;}check(rejected,'plano desatualizado');
 rejected=false;try{p.simulateRename(db,{...plan,patches:[]})}catch{rejected=true;}check(rejected,'plano adulterado');
 rejected=false;try{p.planRename({...db,orders:undefined},plan.oldName,plan.newName)}catch{rejected=true;}check(rejected,'snapshot incompleto');
 rejected=false;try{p.planRename(db,plan.oldName,'__proto__')}catch{rejected=true;}check(rejected,'chave insegura');
 return n;
}
console.log('Verificações concluídas:',testPlanner(planner));
