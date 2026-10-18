'use strict';
// Same-origin owner planning proxy. No credentials are returned to the browser.
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(req.method==='GET'&&process.env.VERCEL_ENV==='preview'){
  if(!process.env.VERCEL_OIDC_TOKEN)return res.status(503).json({ok:false,error:'preview_link_unconfigured'});
  try{const r=await fetch('https://artessencia-loja-git-feature-portes-por-43942a-vascobento9-4541.vercel.app/api/delivery-estimates',{headers:{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});
   const d=(r.headers.get('content-type')||'').includes('application/json')?await r.json():null;
   const reachable=r.status===405&&d?.error==='method_not_allowed';return res.status(reachable?200:503).json({ok:reachable,upstreamReachable:reachable,notForCheckout:true,...(!reachable?{error:'preview_link_unconfigured'}:{})});
  }catch{return res.status(503).json({ok:false,error:'preview_link_unconfigured'})}
 }
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
 const origin=req.headers?.origin;
 if(origin){try{const u=new URL(origin);if(u.protocol!=='https:'||u.host!==req.headers?.host)return res.status(403).json({ok:false,error:'origin_denied'})}catch{return res.status(403).json({ok:false,error:'origin_denied'})}}
 const auth=req.headers?.authorization;if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(auth))return res.status(401).json({ok:false,error:'owner_session_required'});
 if(!String(req.headers?.['content-type']||'').startsWith('application/json'))return res.status(415).json({ok:false,error:'json_required'});
 let body=req.body;try{if(typeof body==='string'){if(Buffer.byteLength(body)>4096)return res.status(413).json({ok:false,error:'invalid_request'});body=JSON.parse(body)}}catch{return res.status(400).json({ok:false,error:'invalid_request'})}
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>4096)return res.status(400).json({ok:false,error:'invalid_request'});
 const preview=process.env.VERCEL_ENV==='preview',headers={'Content-Type':'application/json',Authorization:auth};
 if(preview){if(!process.env.VERCEL_OIDC_TOKEN)return res.status(503).json({ok:false,error:'preview_link_unconfigured'});headers['x-vercel-trusted-oidc-idp-token']=process.env.VERCEL_OIDC_TOKEN}
 const target=preview?'https://artessencia-loja-git-feature-portes-por-43942a-vascobento9-4541.vercel.app/api/delivery-estimates':'https://artessencia-loja.vercel.app/api/delivery-estimates';
 try{
  const upstream=await fetch(target,{method:'POST',headers,body:JSON.stringify({locality:body.locality,pricing:body.pricing}),redirect:'error',signal:AbortSignal.timeout(55000)});
  const type=upstream.headers.get('content-type')||'';
  if(!type.includes('application/json'))return res.status(503).json({ok:false,error:preview?'preview_link_unconfigured':'estimate_unavailable'});
  const result=await upstream.json();
  // Vercel access-control responses are never forwarded verbatim.
  if(typeof result?.error==='object'||JSON.stringify(result).includes('TRUSTED_SOURCES_'))return res.status(503).json({ok:false,error:'preview_link_unconfigured'});
  return res.status(upstream.status).json(result);
 }catch{return res.status(503).json({ok:false,error:'estimate_unavailable'})}
};
