'use strict';
const {environment}=require('./local-trial.cjs');
const server=require('./server-runtime.cjs');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
async function run(config,command,host=process.env,{compose=server.composeRemoteTrial,processNext=server.processNext}={}){
 if(!uuid(command?.missionId)||!Number.isSafeInteger(command.revision)||command.revision<1)throw Error('Missão aprovada e revisão obrigatórias.');
 const env={...environment(config),INTELLIGENCE_EXECUTION_HOST:'github_actions'};
 for(const key of ['GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','VERCEL_ENV','VERCEL','VERCEL_GIT_COMMIT_REF'])env[key]=host[key];
 // The runtime validates Actions, repository, main, manual dispatch, financial scope,
 // expiry and isolated Cloud release before any claim or provider request.
 const runtime=await compose({env});
 const owner=await runtime.call('identity');
 if(!uuid(owner)||owner===config.serviceId)throw Error('Titular do executor inválido.');
 // Never creates or approves a mission, follows a queue, or retries a consumed claim.
 const result=await processNext(runtime,{owner,missionId:command.missionId,revision:command.revision});
 return {status:result.status,missionId:command.missionId,chargedMicroeur:result.chargedMicroeur??null,
  stage:result.stage??null,diagnostic:result.diagnostic??null,automaticRetry:false};
}
module.exports={run};
