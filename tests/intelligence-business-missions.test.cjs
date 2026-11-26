'use strict';
const assert=require('node:assert/strict'),c=require('../intelligence/control-core.js'),b=require('../intelligence/business-agents.js');
const s=c.defaults();s.enabled=true;const inputs=[["comercial","commercial_review",{"today":"2026-11-26","quotes":[],"requests":[]}],["marketing","marketing_plan",{"today":"2026-11-26","campaigns":[],"posts":[]}],["catalogo","catalog_review",{"products":[]}],["inovacao","innovation_review",{"ideas":[]}],["auditoria","technical_review",{"checks":[],"syncVerified":true}]];
for(const [agent,kind,payload] of inputs){s.agents[agent]='manual';const m=c.createMission(s,{id:'test',agent,kind});assert.equal(c.runMission(s,m,payload,null,null,null,null,b).result.mode,'proposal_only');s.agents[agent]='off';assert.equal(c.runMission(s,m,payload,null,null,null,null,b).status,'blocked');}
console.log('10 verificações de integração concluídas');
