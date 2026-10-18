const {test}=require('node:test'),assert=require('node:assert/strict'),handler=require('../../api/delivery-estimates.js');
const res=()=>({setHeader(){},status(s){this.code=s;return this},json(b){this.body=b;return this}});
test('same-origin proxy keeps Vercel credentials server-only and never follows redirects',async()=>{
 const saved={...process.env},real=global.fetch,contextSymbol=Symbol.for('@vercel/request-context'),savedContext=globalThis[contextSymbol];
 const fixtureToken=Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.isolated-signature';
 globalThis[contextSymbol]={get:()=>({headers:{'x-vercel-oidc-token':fixtureToken}})};Object.assign(process.env,{VERCEL_ENV:'preview',VERCEL_OIDC_TOKEN:'isolated-oidc-secret'});let call;
 global.fetch=async(url,options)=>{call={url,options};return{status:200,headers:{get:()=> 'application/json'},json:async()=>({ok:true,notForCheckout:true,fee_cents:249})}};
 const req=()=>({method:'POST',headers:{host:'preview.example',origin:'https://preview.example','content-type':'application/json',authorization:'Bearer isolated-owner-session-token'},body:{locality:'Alcaide',pricing:{routeShareCount:3},target:'https://attacker.example'}});
 try{
  const s=res();await handler(req(),s);assert.equal(s.code,200);assert.equal(call.options.headers['x-vercel-trusted-oidc-idp-token'],fixtureToken);assert.equal(call.options.redirect,'error');assert(!call.url.includes('attacker'));assert(!JSON.stringify(s.body).includes('isolated-oidc'));
  global.fetch=async()=>({status:405,headers:{get:()=> 'application/json'},json:async()=>({error:'method_not_allowed'})});const health=res();await handler({method:'GET'},health);assert.equal(health.body.upstreamReachable,true);assert(!JSON.stringify(health.body).includes('isolated-oidc'));
  const bad=req();bad.headers.origin='https://attacker.example';const denied=res();await handler(bad,denied);assert.equal(denied.code,403);
  global.fetch=async()=>({status:401,headers:{get:()=> 'text/html'}});const protectedResponse=res();await handler(req(),protectedResponse);assert.equal(protectedResponse.body.error,'preview_link_unconfigured');
  process.env.VERCEL_ENV='production';global.fetch=async(url,o)=>{assert.equal(o.headers['x-vercel-trusted-oidc-idp-token'],undefined);return{status:404,headers:{get:()=> 'application/json'},json:async()=>({ok:false,error:'unavailable'})}};await handler(req(),res());
 }finally{globalThis[contextSymbol]=savedContext;global.fetch=real;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
});
