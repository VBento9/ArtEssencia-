'use strict';
// Deliberately distinct from commercial approval: one bounded local pilot,
// no claim that the provider cap or prepaid balance is instantaneous.
const {isolatedTrialEnvironment}=require('./worker-transport.cjs');
const model='gpt-5.4-mini-2026-03-17';
module.exports=function localTrialPricing(env,now=new Date()){
 if(!['local','github_actions'].includes(env.INTELLIGENCE_EXECUTION_HOST)||!isolatedTrialEnvironment(env)||env.INTELLIGENCE_TARIFF_ID!==model)throw Error('Validação financeira local indisponível.');
 const p=JSON.parse(env.INTELLIGENCE_FINANCIAL_APPROVAL),stamp=now.getTime(),start=Date.parse(p.checkedAt),end=Date.parse(p.validUntil);
 if(p.scope!==(env.INTELLIGENCE_EXECUTION_HOST==='github_actions'?'isolated_remote_trial_v1':'isolated_local_trial_v1')||p.model!==model||p.ownerApproved!==true||p.autoRechargeOff!==true||
  p.dedicatedKeyConfigured!==true||p.noNewHosting!==true||p.noTopup!==true||p.providerCutoffInstantaneous!==false||
  p.maxTrialMicroeur!==1000000||p.projectObservedSpendMicroUsd!==0||
  !Number.isSafeInteger(p.observedBalanceMicroUsd)||p.observedBalanceMicroUsd<1000000||
  !Number.isFinite(stamp)||!Number.isFinite(start)||!Number.isFinite(end)||start>stamp||end<=stamp||end-start>2*3600000||
  typeof p.evidenceRef!=='string'||!p.evidenceRef.trim()||typeof p.ownerApprovalRef!=='string'||!p.ownerApprovalRef.trim()||
  p.inputMicroUsdPerMillion!==750000||p.outputMicroUsdPerMillion!==4500000||
  p.eurPerUsdUpperPpm!==1100000||p.grossBps!==12500)throw Error('Validação financeira local indisponível.');
 const eur=usd=>Number((BigInt(usd)*1100000n+999999n)/1000000n);
 return {model,verified:true,current:true,validUntil:p.validUntil,toolsEnabled:false,contextLimit:400000,maxInputTokens:400000,maxOutputTokens:2000,
  inputRate:eur(p.inputMicroUsdPerMillion),outputRate:eur(p.outputMicroUsdPerMillion),grossBps:p.grossBps};
};
