'use strict';
const data=require('./agent-directory.json');
const core=require('./control-core.js'),budget=require('./ai-budget-policy.cjs');
function validate(){
 const ids=Object.keys(data.agents).sort();
 if(JSON.stringify(ids)!==JSON.stringify(core.agents.slice().sort())||
 new Set(Object.values(data.agents).map(p=>p.name)).size!==ids.length||
 Object.values(data.agents).some(p=>!p.name||!p.role||!p.firstMission||!['daily','weekly','monthly'].includes(p.cadence)||!Number.isSafeInteger(p.planningMicroeur)||p.planningMicroeur<=0)||
 data.preventiveMicroeur!==budget.stop||data.ceilingMicroeur!==budget.ceiling||
 data.reserveMicroeur!==budget.ceiling-budget.stop||
 Object.values(data.agents).reduce((s,p)=>s+p.planningMicroeur,0)+data.legacyPlanningMicroeur!==budget.stop)throw Error('Diretório ou orçamento de planeamento inválido.');
}
validate();
function profile(agent){
 if(!Object.prototype.hasOwnProperty.call(data.agents,agent))throw Error('Funcionário indisponível.');
 return {...data.agents[agent],agent,version:data.version};
}
module.exports={profile};
