'use strict';
const model='gpt-5.4-mini-2026-03-17';
// Rates are micro-USD per million tokens. An account review may raise these upper bounds.
module.exports=function approvedPricing(env,now=new Date()){
  if(!env.INTELLIGENCE_FINANCIAL_APPROVAL)return {};
  const p=JSON.parse(env.INTELLIGENCE_FINANCIAL_APPROVAL);
  const stamp=now.getTime(), issued=Date.parse(p.checkedAt), expires=Date.parse(p.validUntil);
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  const expired=!Number.isFinite(issued)||!Number.isFinite(expires)||issued>stamp||expires<=stamp;
  if(expired||p.model!==model||p.autoRechargeOff!==true||p.dedicatedKeyVerified!==true||
     p.usageReconciled!==true||p.infrastructureVerified!==true||!integer(p.otherGrossMonthlyUpperMicroeur)||
     p.otherGrossMonthlyUpperMicroeur>7000000||!integer(p.grossBps)||p.grossBps<10000||p.grossBps>30000||
     !integer(p.eurPerUsdUpperPpm)||p.eurPerUsdUpperPpm<1||p.eurPerUsdUpperPpm>5000000||
     !integer(p.inputMicroUsdPerMillion)||p.inputMicroUsdPerMillion<750000||
     !integer(p.outputMicroUsdPerMillion)||p.outputMicroUsdPerMillion<4500000||
     typeof p.evidenceRef!=='string'||!p.evidenceRef.trim())throw Error('Validação financeira indisponível.');
  const eur=usd=>Number((BigInt(usd)*BigInt(p.eurPerUsdUpperPpm)+999999n)/1000000n);
  return {[model]:{model,verified:true,current:true,validUntil:p.validUntil,toolsEnabled:false,contextLimit:400000,maxInputTokens:400000,
    maxOutputTokens:2000,inputRate:eur(p.inputMicroUsdPerMillion),outputRate:eur(p.outputMicroUsdPerMillion),grossBps:p.grossBps}};
};
