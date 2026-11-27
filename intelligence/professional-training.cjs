'use strict';
const {createHash}=require('node:crypto');
const curriculum=require('./professional-training.json');
const digest=createHash('sha256').update(JSON.stringify(curriculum)).digest('hex');
function profile(agent){
 if(!Object.prototype.hasOwnProperty.call(curriculum.profiles,agent))throw Error('Formação profissional indisponível.');
 const p=curriculum.profiles[agent];
 return {version:curriculum.version,digest,agent,role:p.role,modules:p.modules,mission:p.mission,procedures:[...p.procedures],quality:p.quality,exercise:p.exercise};
}
function instructions(agent){
 const p=profile(agent);
 return ['Formação profissional '+p.version+' · '+p.role,p.mission,'Regras comuns:',...curriculum.common,'Procedimentos do departamento:',...p.procedures,'Critério de qualidade: '+p.quality].join('\n');
}
function receipt(agent){
 const p=profile(agent);
 return {version:p.version,digest:p.digest,agent,role:p.role,modules:p.modules,quality:p.quality,kind:'instructions_applied',certification:'not_assessed'};
}
module.exports={profile,instructions,receipt};
