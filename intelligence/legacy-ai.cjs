'use strict';
const accountedResponse = require('./accounted-response.cjs');
const departments = { legacy_social: 'marketing', legacy_description: 'catalogo', legacy_insights: 'marketing' };

// A reviewed server composition is required to enable billing. An API key alone never enables it.
function createLegacyService(runtime) {
  return async function generate(channel, payload, requestId) {
    if (!runtime || !Object.hasOwn(departments, channel)) throw Error('Consumo de IA suspenso.');
    const agent = departments[channel];
    const rate = await runtime.pricing(agent);
    const result = await accountedResponse({
      requestId, channel, rate, ledger: runtime.ledger, provider: runtime.provider,
      authorize: () => runtime.permitted(agent), payload: { ...payload, model: rate.model, store: false }
    });
    if (!result.authorized) throw Error('Autorização retirada.');
    return result.response;
  };
}
async function generate(channel,payload,id) {
  const server=require('./server-runtime.cjs');
  return server.runLegacy(server.compose(),channel,payload,id);
}
module.exports = { generate, createLegacyService };
