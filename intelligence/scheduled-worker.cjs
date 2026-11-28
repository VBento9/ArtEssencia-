'use strict';
const {timingSafeEqual,createHash}=require('node:crypto');
const digest=s=>createHash('sha256').update(s).digest();
async function handle(req,res,{worker,env=process.env,now=Date.now}){
 const secret=env.CRON_SECRET;
 if(typeof secret!=='string'||secret.length<32||!timingSafeEqual(digest(String(req.headers?.authorization||'')),digest('Bearer '+secret)))return res.status(401).end();
 if(env.INTELLIGENCE_WORKER_ENABLED!=='true')return res.status(503).json({status:'desligado'});
 if(env.INTELLIGENCE_EXECUTION_MODE==='trial')return res.status(503).json({status:'ensaio_manual'});
 const deadline=now()+45000;
 try{
  const runtime=await worker.composeHosted();
  if(runtime.mode==='trial')return res.status(503).json({status:'ensaio_manual'});
  const tick=await runtime.call('tick');
  if(runtime.mode==='prepare_only')return res.status(200).json({prepared:tick.prepared,recovered:tick.recovered,paid:false,mode:runtime.mode});
  let completed=0,status='deadline';
  while(completed<9&&now()<deadline){
   const result=await worker.processNext(runtime,undefined,{scheduled:true});status=result.status;
   if(status!=='review_ready')break;
   completed++;
  }
  return res.status(200).json({prepared:tick.prepared,recovered:tick.recovered,completed,status,mode:runtime.mode});
 }catch{return res.status(503).json({status:'por_confirmar'});}
}
module.exports={handle};
