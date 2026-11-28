'use strict';
const {createHash}=require('node:crypto');
const curriculum=require('./professional-training.json');
const digest=createHash('sha256').update(JSON.stringify(curriculum)).digest('hex');
function profile(agent){
 if(!Object.prototype.hasOwnProperty.call(curriculum.profiles,agent))throw Error('Formação profissional indisponível.');
 const p=curriculum.profiles[agent];
 return JSON.parse(JSON.stringify({version:curriculum.version,digest,agent,...p,company:curriculum.company}));
}
function instructions(agent){
 const p=profile(agent);
 return ['Formação profissional '+p.version+' · '+p.role,p.mission,'Dossier da empresa '+p.company.version+' · revisto em '+p.company.reviewedAt,p.company.source,...p.company.identity,...p.company.operatingRules,...p.company.sourcePolicy,...p.company.workCycle,...p.company.unknowns,'Regras comuns:',...curriculum.common,'Responsabilidades permanentes:',...p.responsibilities,'Informação a consultar quando autorizada:',...p.inputs,'Colaboração:',...p.collaboration,'Procedimentos do departamento:',...p.procedures,'Critério de qualidade: '+p.quality,'Critérios práticos de avaliação:',...p.acceptance].join('\n');
}
function receipt(agent){
 const p=profile(agent);
 return {version:p.version,digest:p.digest,companyVersion:p.company.version,agent,role:p.role,modules:p.modules,quality:p.quality,kind:'instructions_applied',certification:'not_assessed'};
}
module.exports={profile,instructions,receipt};
