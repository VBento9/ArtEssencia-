'use strict';
const assert=require('node:assert/strict');const c=require('../intelligence/control-core.js');const a=require('../intelligence/operational-agents.js');
const settings=c.defaults();settings.enabled=true;settings.agents.director='manual';settings.agents.financeiro='manual';
const mission=c.createMission(settings,{id:'director-1',agent:'director',kind:'daily_priority_plan'});
const payload={today:'2026-11-26',reports:[{mode:'proposal_only',tasks:[{key:'x',agent:'producao',kind:'x',title:'teste',priority:1,dueDate:null,requiresApproval:true}]}],existingTaskKeys:[],enabledAgents:['producao']};
assert.equal(c.runMission(settings,mission,payload,null,null,null,a).result.tasks.length,0);
assert.equal(c.runMission(c.defaults(),mission,payload,null,null,null,a).status,'blocked');
assert.throws(()=>c.createMission(settings,{id:'auto',agent:'director',kind:'daily_priority_plan',trigger:'automatic'}));
console.log('3 verificações de integração concluídas');
