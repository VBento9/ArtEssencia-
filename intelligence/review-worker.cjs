'use strict';
const createStore = require('./sql-run-store.cjs');
const createGateway = require('./ai-gateway.cjs');
const createRunner = require('./mission-runner.cjs');
const createStockContext = require('./sql-stock-context.cjs');
const createLedger = require('./sql-budget-ledger.cjs');
const providerFactory = require('./responses-provider.cjs');
const budget = require('./ai-budget-policy.cjs');
const core = require('./control-core.js');

module.exports = function createReviewWorker({query, owner, pricing, apiKey, transport, enabled=false}) {
  const stockContext = createStockContext({query,owner,releaseEnabled:enabled});
  const store = createStore({query,owner,releaseEnabled:enabled,loadGrants:async()=>[]});
  const gateway = createGateway({
    budget, pricing, releaseEnabled:enabled, ledger:createLedger(query),
    provider: providerFactory(apiKey,transport),
    authorize: async subject => {
      const state=await store.status(subject.missionId);
      return {verified:state.owner===owner && state.agent===subject.agent, enabled:state.active===true, paidEnabled:enabled};
    }
  });
  async function contextSource(q) {
    if(q.agent==='director' && q.kind==='daily_priority_plan'){
      const result=await query('select artessencia_intelligence_private.team_director_context($1,$2) as evidence',[q.missionId,q.leaseId]);
      return result.rows[0]?.evidence;
    }
    return stockContext(q);
  }
  return createRunner({
    store, gateway, core, contextSource, releaseEnabled:enabled,
    engines:{audit:require('./inventory-audit.js').auditInventory, organizer:require('./stock-organizer.js'),operational:require('./operational-agents.js')},
    // The owner can promote reviewed proposals through the separately authenticated planning command.
    executor:{run:async()=>{throw Error('Ferramenta sem autorização.');}}
  });
};
