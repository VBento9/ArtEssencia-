'use strict';
const budget = require('./ai-budget-policy.cjs');

async function accountedResponse({ requestId, channel, ledger, authorize, rate, payload, provider }) {
  if (!budget.channels.includes(channel) || !await authorize()) throw Error('Consumo não autorizado.');
  if (!rate || rate.contextLimit !== rate.maxInputTokens ||
      !Number.isSafeInteger(payload.max_output_tokens) || payload.max_output_tokens < 1 ||
      payload.max_output_tokens > rate.maxOutputTokens || rate.maxOutputTokens > 2000 ||
      Object.keys(payload).some(key => !['model','store','instructions','input','text','max_output_tokens'].includes(key)) ||
      payload.model !== rate.model || payload.store !== false) throw Error('Modelo ou pedido não autorizado.');
  const maximumMicroeur = budget.estimate(rate);
  const reservation = await ledger.reserve({ requestId, channel, model: rate.model, maximumMicroeur });
  if (reservation?.requestId !== requestId || reservation.status !== 'reserved' ||
      reservation.maximumMicroeur !== maximumMicroeur) throw Error('Reserva não confirmada.');
  if (!await authorize()) throw Error('Autorização retirada. Reserva retida.');
  const claim = await ledger.claim(requestId);
  if (claim?.requestId !== requestId || claim.status !== 'inflight' ||
      claim.model !== rate.model || claim.maximumMicroeur !== maximumMicroeur) throw Error('Execução não confirmada.');
  let response, actual;
  try {
    response = await provider(payload);
    const usage = response?.usage;
    const within = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
    if (typeof response?.id !== 'string' || !response.id.trim() || response.id.length > 200 ||
        response.model !== rate.model || !within(usage?.input_tokens, rate.maxInputTokens) ||
        !within(usage?.output_tokens, payload.max_output_tokens)) throw Error('Consumo desconhecido.');
    const cost = BigInt(usage.input_tokens)*BigInt(rate.inputRate) + BigInt(usage.output_tokens)*BigInt(rate.outputRate);
    actual = Number((cost*BigInt(rate.grossBps)+9999999999n)/10000000000n);
    const settled = await ledger.settle({ requestId, actualMicroeur: actual, evidenceRef: response.id, noCharge: false });
    if (settled?.requestId !== requestId || settled.status !== 'settled' ||
        settled.actualMicroeur !== actual || settled.overrun !== false) throw Error('Liquidação por confirmar.');
  } catch {
    await ledger.unknown(requestId);
    throw Error('Faturação por reconciliar.');
  }
  return { response, actual, authorized: await authorize() };
}
module.exports = accountedResponse;
