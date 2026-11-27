'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const config=require('../intelligence/remote-config.cjs');
const metadata={publishableKey:'sb_publishable_fixture',serviceId:'00000000-0000-0000-0000-000000000001',serviceEmail:'service@example.invalid'};
const env={INTELLIGENCE_REMOTE_PUBLIC_CONFIG:JSON.stringify(metadata),INTELLIGENCE_SERVICE_PASSWORD:' fixture password ',INTELLIGENCE_OPENAI_API_KEY:'fixture-key'};
test('split secrets preserve exact password and default to blocked financial approval',()=>{
 const actual=config(env);assert.deepEqual(actual,{...metadata,servicePassword:' fixture password ',apiKey:'fixture-key',financialApproval:'{}'});
 assert.equal(config({...env,INTELLIGENCE_FINANCIAL_APPROVAL:'{"fixture":true}'}).financialApproval,'{"fixture":true}');
});
test('missing, malformed, mixed or credential-bearing public configuration fails without disclosure',()=>{
 for(const input of [{},{...env,INTELLIGENCE_REMOTE_PUBLIC_CONFIG:'private-fixture-invalid'},{...env,INTELLIGENCE_SERVICE_PASSWORD:''},
 {...env,INTELLIGENCE_OPENAI_API_KEY:''},{...env,INTELLIGENCE_REMOTE_CONFIG:'{}'},
 {...env,INTELLIGENCE_REMOTE_PUBLIC_CONFIG:JSON.stringify({...metadata,apiKey:'private-fixture'})},
 {INTELLIGENCE_REMOTE_CONFIG:'private-fixture-invalid'}]){
  assert.throws(()=>config(input),e=>e.message==='Configuração remota indisponível.'&&!e.message.includes('private-fixture'));
 }
});
test('legacy format remains usable only in isolation',()=>{
 const legacy={...metadata,servicePassword:'fixture',apiKey:'fixture',financialApproval:'{}'};
 assert.deepEqual(config({INTELLIGENCE_REMOTE_CONFIG:JSON.stringify(legacy)}),legacy);
 assert.throws(()=>config({INTELLIGENCE_REMOTE_CONFIG:'[]'}));
});
