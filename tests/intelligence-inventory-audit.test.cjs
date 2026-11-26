'use strict';
const {auditInventory}=require('../intelligence/inventory-audit.cjs');
function checks(audit){
 const assert=(condition,message)=>{if(!condition)throw new Error(message)};
 const data={stock:[{name:'Cera Soja APF',unit:'g',qty:200,unitCost:.008},{name:'Fragrância',unit:'ml',qty:20,unitCost:.05},{name:'FRAGRÂNCIA',unit:'ml',qty:10,unitCost:0},{name:'Pavio',unit:'un',qty:10,unitCost:.1},{name:'Pavio',unit:'un',qty:2,unitCost:.1}],products:[{code:'A'},{code:'B'}],productRecipes:{A:[{item:'Cera Soja APF',qty:30},{item:'cera soja apf',qty:4},{item:'Pavio',qty:1},{item:'Fragrância',qty:2,unit:'g'},{item:'Ausente',qty:null}],X:[]}};
 const before=JSON.stringify(data),r=audit(data),has=k=>r.issues.some(i=>i.kind===k);
 assert(r.recipeLines===5&&r.resolved===2,'contagens');
 assert(has('possivel_duplicado'),'duplicados');
 assert(has('referencia_ambigua'),'ambiguidade');
 assert(r.issues.find(i=>i.name==='cera soja apf').candidates.length===1,'candidato normalizado');
 assert(has('unidade_ficha_incompativel'),'unidade');
 assert(has('custo_por_validar'),'custo');
 assert(has('quantidade_ficha_por_validar'),'quantidade');
 assert(has('ficha_sem_produto')&&has('ficha_instalada_ausente_por_rever'),'fichas');
 assert(JSON.stringify(data)===before,'imutabilidade');
 let rejected=false;try{audit({stock:[]})}catch{rejected=true}assert(rejected,'snapshot incompleto');
 return 10;
}
console.log('Verificações concluídas:',checks(auditInventory));
