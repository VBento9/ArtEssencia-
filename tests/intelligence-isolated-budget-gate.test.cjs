'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('Isolated budget gate permits only deterministic zero-cost simulation with paid release disabled',()=>{
 const sql=fs.readFileSync('sql/isolated/intelligence_test_simulation_budget_gate_v1.sql','utf8');
 assert.match(sql,/UNSAFE_ISOLATED_FIXTURE/);
 assert.match(sql,/p_model='artessencia-simulation-v1'/);
 assert.match(sql,/b.owner_id=auth.uid\(\) AND b.enabled AND s.enabled/);
 assert.match(sql,/c.release_enabled OR c.frozen OR NOT artessencia_intelligence_private.isolated_simulation_budget_allowed\(p_model\)/);
 assert.match(sql,/isolated_simulation_budget_allowed\(e.model\)/);
 assert.match(sql,/e.model IS DISTINCT FROM 'artessencia-simulation-v1' OR p_actual<>0/);
 assert.doesNotMatch(sql,/SET release_enabled=true/);
});
