'use strict';
// Staging is opt-in, financial approval is independently checked and the
// deployment proof still requires a disabled Cloud binding. No model call here.
const {productionServiceEnvironment}=require('./worker-transport.cjs');
const pricing=require('./approved-pricing.cjs');
const budget=require('./ai-budget-policy.cjs');
function manualStage(env=process.env,now=new Date()){
 if(!env.INTELLIGENCE_ACTIVATION_STAGE)return false;
 if(env.INTELLIGENCE_ACTIVATION_STAGE!=='manual_only_v1'||!productionServiceEnvironment(env)||
    env.INTELLIGENCE_WORKER_ENABLED!=='true'||env.INTELLIGENCE_PAID_RELEASE!=='approved'||
    !env.INTELLIGENCE_OPENAI_API_KEY||
    !env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY||
    !env.INTELLIGENCE_SERVICE_EMAIL||!env.INTELLIGENCE_SERVICE_PASSWORD||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.INTELLIGENCE_SERVICE_USER_ID||''))throw Error('Ativação manual indisponível.');
 const approval=JSON.parse(env.INTELLIGENCE_FINANCIAL_APPROVAL||'{}');
 if(approval.budgetPolicy!=='monthly_target_v1'||!env.INTELLIGENCE_ACTIVATION_APPROVAL_REF||
    approval.ownerApprovalRef!==env.INTELLIGENCE_ACTIVATION_APPROVAL_REF)throw Error('Ativação manual por autorizar.');
 budget.estimate(pricing(env,now)[env.INTELLIGENCE_TARIFF_ID]);
 return true;
}
module.exports={manualStage};
