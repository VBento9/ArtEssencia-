import scheduledWorker from '../intelligence/scheduled-worker.cjs';
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
  return scheduledWorker.handle(req,res,{worker});
}
