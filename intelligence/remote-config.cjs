'use strict';
// Public connection metadata is separate from the two independently managed secrets.
// Never log parsing errors: they can contain fragments of a malformed secret.
module.exports=function remoteConfig(env=process.env){
 const fail=()=>{throw Error('Configuração remota indisponível.');};
 const split=env.INTELLIGENCE_REMOTE_PUBLIC_CONFIG||env.INTELLIGENCE_SERVICE_PASSWORD||env.INTELLIGENCE_OPENAI_API_KEY||env.INTELLIGENCE_FINANCIAL_APPROVAL;
 if(env.INTELLIGENCE_REMOTE_CONFIG){
  if(split)fail();
  let legacy;try{legacy=JSON.parse(env.INTELLIGENCE_REMOTE_CONFIG);}catch{fail();}
  if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))fail();
  return legacy;
 }
 let metadata;try{metadata=JSON.parse(env.INTELLIGENCE_REMOTE_PUBLIC_CONFIG||'null');}catch{fail();}
 if(!metadata||Object.keys(metadata).sort().join(',')!=='publishableKey,serviceEmail,serviceId'||
  !Object.values(metadata).every(x=>typeof x==='string'&&x.trim())||
  typeof env.INTELLIGENCE_SERVICE_PASSWORD!=='string'||!env.INTELLIGENCE_SERVICE_PASSWORD||
  typeof env.INTELLIGENCE_OPENAI_API_KEY!=='string'||!env.INTELLIGENCE_OPENAI_API_KEY)fail();
 return {...metadata,servicePassword:env.INTELLIGENCE_SERVICE_PASSWORD,apiKey:env.INTELLIGENCE_OPENAI_API_KEY,
  financialApproval:env.INTELLIGENCE_FINANCIAL_APPROVAL||'{}'};
};
