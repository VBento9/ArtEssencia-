'use strict';
// Construct on the server with a connection restricted to these ledger operations.
module.exports = function sqlBudgetLedger(query) {
  async function call(sql, args) {
    const result = await query(sql, args);
    if (result.rows.length !== 1) throw Error('Recibo financeiro indisponível.');
    return result.rows[0].receipt;
  }
  return {
    reserve: r => call('select artessencia_intelligence_private.ai_budget_reserve($1,$2,$3,$4) as receipt',
      [r.requestId,r.channel,r.model,r.maximumMicroeur]),
    claim: id => call('select artessencia_intelligence_private.ai_budget_claim($1) as receipt',[id]),
    unknown: id => call('select artessencia_intelligence_private.ai_budget_unknown($1) as receipt',[id]),
    settle: r => call('select artessencia_intelligence_private.ai_budget_settle($1,$2,$3,$4) as receipt',
      [r.requestId,r.actualMicroeur,r.evidenceRef,r.noCharge])
  };
};
