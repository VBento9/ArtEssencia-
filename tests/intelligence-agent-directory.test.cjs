'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=require('../intelligence/agent-directory.json'),directory=require('../intelligence/agent-directory.cjs');
const budget=require('../intelligence/ai-budget-policy.cjs'),core=require('../intelligence/control-core.js');
test('Nine named departments and legacy assistants share a single planning envelope',()=>{
 assert.deepEqual(Object.keys(data.agents).sort(),core.agents.slice().sort());
 assert.equal(Object.values(data.agents).reduce((s,p)=>s+p.planningMicroeur,0),21000000);
 assert.equal(data.legacyPlanningMicroeur,2000000);
 assert.equal(data.preventiveMicroeur,budget.stop);assert.equal(data.reserveMicroeur,7000000);assert.equal(data.ceilingMicroeur,budget.ceiling);
 assert.ok(fs.readFileSync('intelligence/central-ui.js','utf8').includes('const teamDirectory='+JSON.stringify(data)+';'));
 for(const agent of core.agents){
  const p=directory.profile(agent);assert.ok(p.name&&p.firstMission&&p.cadence);assert.equal(p.agent,agent);
 }
 assert.throws(()=>directory.profile('__proto__'));
 assert.ok(fs.readFileSync('intelligence/ai-gateway.cjs','utf8').includes('directory.profile(request.agent).name'));
 assert.equal(core.defaults().enabled,false);assert.equal(core.defaults().paidEnabled,false);
});
