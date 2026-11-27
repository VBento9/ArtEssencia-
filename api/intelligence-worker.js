import { timingSafeEqual, createHash } from 'node:crypto';
import worker from '../intelligence/server-runtime.cjs';
import workerTransport from '../intelligence/worker-transport.cjs';


export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).end();
  if(req.method==='POST'){
    try{
      const mode=worker.hostedMode();
      const id=await workerTransport.ownerSession(req);if(!id)return res.status(403).end();
      const {missionId,revision}=req.body||{};
      if(typeof missionId!=='string'||!/^[0-9a-f-]{36}$/i.test(missionId)||!Number.isSafeInteger(revision)||revision<0)return res.status(400).end();
      if(process.env.INTELLIGENCE_WORKER_ENABLED!=='true')return res.status(503).json({status:'desligado'});
      if(mode==='prepare_only')return res.status(503).json({status:'faturacao_suspensa'});
      const runtime=await worker.composeHosted();
      const result=await worker.processNext(runtime,{owner:id,missionId,revision});
      return res.status(200).json({status:result.status,mode});
    }catch{return res.status(503).json({status:'por_confirmar'});}
  }
  const secret=process.env.CRON_SECRET;
  const digest=s=>createHash('sha256').update(s).digest();
  if(!secret||secret.length<32||!timingSafeEqual(digest(String(req.headers.authorization||'')),digest('Bearer '+secret)))return res.status(401).end();
  if(process.env.INTELLIGENCE_WORKER_ENABLED!=='true')return res.status(503).json({status:'desligado'});
  try{
    const runtime=await worker.composeHosted();
    const tick=await runtime.call('tick');
    if(runtime.mode==='prepare_only')return res.status(200).json({prepared:tick.prepared,recovered:tick.recovered,paid:false,mode:runtime.mode});
    const deadline=Date.now()+45000;
    let completed=0,status='idle';
    do{
      const result=await worker.processNext(runtime);status=result.status;
      if(status!=='review_ready')break;
      completed++;
    }while(completed<9 && Date.now()<deadline);
    return res.status(200).json({prepared:tick.prepared,recovered:tick.recovered,completed,status,mode:runtime.mode});
  }catch{return res.status(503).json({status:'por_confirmar'});}
}
