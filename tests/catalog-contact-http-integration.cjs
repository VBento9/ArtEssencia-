'use strict';
// PostgREST HTTP test in the disposable CI database, never against a live Supabase URL.
const assert=require('node:assert/strict');

const base=process.env.CATALOG_CONTACT_TEST_API;
assert.ok(base && /^http:\/\/127\.0\.0\.1:3000$/.test(base),
 'Only the isolated local PostgREST server is permitted');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function call(endpoint,body){
 const result=await fetch(base+endpoint,{
  method:body===undefined?'GET':'POST',
  headers:body===undefined?{}:{'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 let data;
 const raw=await result.text();
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:result.status,data};
}

async function main(){
 let ready=false;
 for(let i=0;i<40;i++){
  try{
   const r=await call('/');
   if(r.status===200){ready=true;break}
  }catch(_){/* PostgREST may still be starting */}
  await sleep(1000);
 }
 assert.ok(ready,'Local PostgREST failed to become ready');

 const payload={
  name:'Cliente HTTP Sintético',phone:'917000001',email:'cliente@example.invalid',
  message:'Gostaria de saber mais sobre esta vela artesanal.',
  kind:'information',product_ref:'AE-TEST-001',
  client_request_id:'22222222-2222-4222-8222-222222222222',
  privacy_consent:true,website:''
 };
 const one=await call('/rpc/catalog_submit_contact_request_v1',{p_payload:payload});
 assert.equal(one.status,200,'Valid public submission: '+JSON.stringify(one));
 assert.match(String(one.data),/^[a-f0-9-]{36}$/i);
 const again=await call('/rpc/catalog_submit_contact_request_v1',{p_payload:payload});
 assert.equal(again.status,200,'Idempotency request: '+JSON.stringify(again));
 assert.equal(again.data,one.data,'Duplicate token created a second contact');

 const read=await call('/artessencia_shop_event_requests');
 assert.ok([401,403].includes(read.status),'Anonymous read of PII unexpectedly permitted: '+read.status);

 const missingConsent=await call('/rpc/catalog_submit_contact_request_v1',{
  p_payload:{...payload,privacy_consent:false,
   client_request_id:'33333333-3333-4333-8333-333333333333'}
 });
 assert.ok(missingConsent.status>=400,'Missing consent was accepted');

 const oversized=await call('/rpc/catalog_submit_contact_request_v1',{
  p_payload:{...payload,message:'x'.repeat(6000),
   client_request_id:'44444444-4444-4444-8444-444444444444'}
 });
 assert.ok(oversized.status>=400,'Oversized public submission was accepted');
 console.log('PASS: HTTP RPC, UUID response, idempotency, denial of public PII, consent and size limits');
}

main().catch(error=>{console.error(error);process.exitCode=1});
