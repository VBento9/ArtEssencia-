'use strict';
const agents=require('../intelligence/operational-agents.js');
function checks(a){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const rejects=(f,m)=>{let x=false;try{f()}catch{x=true}check(x,m)};
 const today='2026-11-26',stock=[{name:'Cera',unit:'g',qty:100}];
 const order=(id,qty,extra={})=>({id,status:'Confirmada',alreadyProduced:false,complete:true,delivery:today,needs:[{name:'Cera',unit:'g',qty}],...extra});
 const input={today,stock,orders:[order('A',60),order('B',70),order('C',10,{alreadyProduced:true}),order('D',10,{complete:false}),order('E',10,{status:'Cancelado'})]};
 const original=JSON.stringify(input),p=a.production(input);
 check(p.coverage==='partial'&&p.blocked[0]==='D','incomplete');check(p.planned.join(',')==='A,B','eligible');check(p.requirements[0].required===130&&p.requirements[0].shortage===30,'aggregated stock');check(JSON.stringify(input)===original,'immutable');
 check(a.production({...input,orders:[order('A',10,{needs:[{name:'Cera',unit:'ml',qty:10}]})]}).blocked.length===1,'unit');
 check(a.production({...input,stock:[...stock,{name:'CERA',unit:'g',qty:10}]}).requirements.length===0,'ambiguous');
 rejects(()=>a.production({...input,orders:[order('A',10),order('A',20)]}),'duplicates');
 check(a.production({...input,orders:[order('A',10,{alreadyProduced:undefined})]}).blocked.length===1,'unknown history');
 const f=a.finance({today,targetMarginPct:30,products:[{code:'P1',costComplete:true,totalCost:8,netSalePrice:10},{code:'P2',costComplete:true,totalCost:12,netSalePrice:10},{code:'P3',costComplete:false,totalCost:0,netSalePrice:10}],orders:[{id:'O1',status:'Pronta',paymentComplete:true,total:20,paid:5},{id:'O2',status:'Cancelado',paymentComplete:true,total:10,paid:0}]});
 check(f.margins.length===2&&f.margins[0].marginPct===20,'margin');check(f.tasks.some(t=>t.kind==='review_margin'&&t.priority===1),'loss');check(f.tasks.some(t=>t.kind==='review_cost'),'missing cost');check(f.receivables.length===1&&f.receivables[0].dueCents===1500,'receivable');
 const d=a.director({today,reports:[p,f,p],existingTaskKeys:[p.tasks[0].key],enabledAgents:['producao','financeiro'],limit:100});
 check(new Set(d.tasks.map(t=>t.key)).size===d.tasks.length,'dedup');check(!d.tasks.some(t=>t.key===p.tasks[0].key),'existing');check(d.tasks[0].priority===1,'priority');
 check(a.director({today,reports:[p,f],existingTaskKeys:[],enabledAgents:['financeiro']}).tasks.every(t=>t.agent==='financeiro'),'disabled');
 check(a.director({today,reports:[p,f],existingTaskKeys:[],enabledAgents:['financeiro','producao'],limit:1}).deferred>0,'limit');
 rejects(()=>a.director({today,reports:[p,{...p,tasks:[{...p.tasks[0],title:'Outro'}]}],existingTaskKeys:[],enabledAgents:['producao']}),'conflict');
 return n;
}
console.log('Verificações concluídas:',checks(agents));
