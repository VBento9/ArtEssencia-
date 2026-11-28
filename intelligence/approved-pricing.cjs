'use strict';
const model='gpt-5.4-mini-2026-03-17';
// Rates are micro-USD per million tokens. An account review may raise these upper bounds.
module.exports=function approvedPricing(env,now=new Date()){
  if(!env.INTELLIGENCE_FINANCIAL_APPROVAL)return {};
  const p=JSON.parse(env.INTELLIGENCE_FINANCIAL_APPROVAL);
  const stamp=now.getTime(), issued=Date.parse(p.checkedAt), expires=Date.parse(p.validUntil);
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  const month=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit'}).formatToParts(date).filter(x=>x.type==='year'||x.type==='month').map(x=>x.value).join('-');
  const expired=!Number.isFinite(stamp)||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>stamp||expires<=stamp||expires-issued>7*86400000;
  if(expired)throw Error('Validação financeira indisponível.');
  const period=month(now);
  if(p.budgetMonth!==period||month(new Date(issued))!==period||month(new Date(expires-1))!==period)throw Error('Período financeiro por reconciliar.');
  if(expired||p.model!==model||p.autoRechargeOff!==true||p.dedicatedKeyVerified!==true||
     p.usageReconciled!==true||p.infrastructureVerified!==true||!integer(p.otherGrossMonthlyUpperMicroeur)||
     p.otherGrossMonthlyUpperMicroeur>7000000||!integer(p.grossBps)||p.grossBps<10000||p.grossBps>30000||
     !integer(p.eurPerUsdUpperPpm)||p.eurPerUsdUpperPpm<1||p.eurPerUsdUpperPpm>5000000||
     !integer(p.inputMicroUsdPerMillion)||p.inputMicroUsdPerMillion<750000||
     !integer(p.outputMicroUsdPerMillion)||p.outputMicroUsdPerMillion<4500000||
     typeof p.evidenceRef!=='string'||!p.evidenceRef.trim()||
     typeof p.ownerApprovalRef!=='string'||!p.ownerApprovalRef.trim()||
     p.exclusiveProjectVerified!==true||p.providerHardLimitVerified!==true||
     p.taxVerified!==true||p.exchangeUpperBoundVerified!==true||p.pendingExternalCostsReconciled!==true||
     !integer(p.providerHardLimitMicroUsd)||p.providerHardLimitMicroUsd===0)throw Error('Validação financeira indisponível.');
  // The legacy strict policy remains valid. A new, explicitly documented target
  // permits external billing headroom only; the SQL ledger remains capped at 23 EUR.
  const flexible=p.budgetPolicy==='monthly_target_v1';
  if(p.budgetPolicy!==undefined&&!flexible)throw Error('Política financeira desconhecida.');
  if(flexible&&(p.targetGrossMonthlyMicroeur!==30000000||p.contingencyGrossMicroeur!==5000000||
     p.ownerAcceptsNonInstantCutoff!==true))throw Error('Margem financeira por confirmar.');
  // A verified provider-enforced limit is still required; it is not an instantaneous cutoff.
  // The account evidence is an administrator attestation, not automatic provider verification.
  const grossCap=(BigInt(p.providerHardLimitMicroUsd)*BigInt(p.eurPerUsdUpperPpm)*BigInt(p.grossBps)+9999999999n)/10000000000n;
  if(grossCap>(flexible?28000000n:23000000n)||grossCap+BigInt(p.otherGrossMonthlyUpperMicroeur)>(flexible?35000000n:30000000n))throw Error('Limite do fornecedor incompatível com o orçamento.');
  const eur=usd=>Number((BigInt(usd)*BigInt(p.eurPerUsdUpperPpm)+999999n)/1000000n);
  return {[model]:{model,verified:true,current:true,validUntil:p.validUntil,toolsEnabled:false,contextLimit:400000,maxInputTokens:400000,
    maxOutputTokens:2000,inputRate:eur(p.inputMicroUsdPerMillion),outputRate:eur(p.outputMicroUsdPerMillion),grossBps:p.grossBps}};
};
