import { waitUntil } from '@vercel/functions';
import background from '../intelligence/hosted-background.cjs';
import scheduledWorker from '../intelligence/scheduled-worker.cjs';
import worker from '../intelligence/server-runtime.cjs';
import workerTransport from '../intelligence/worker-transport.cjs';
import readiness from '../intelligence/hosted-readiness.cjs';


export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).end();
  if(req.method==='POST'){
    try{
      const id=await workerTransport.ownerSession(req);if(!id)return res.status(403).end();
      if(req.body?.operation==='availability')return res.status(200).json(await readiness.checkedAvailability(process.env,worker,workerTransport.transport,id));
      const mode=worker.hostedMode();
      const {missionId,revision}=req.body||{};
      if(typeof missionId!=='string'||!/^[0-9a-f-]{36}$/i.test(missionId)||!Number.isSafeInteger(revision)||revision<0)return res.status(400).end();
      if(process.env.INTELLIGENCE_WORKER_ENABLED!=='true')return res.status(503).json({status:'desligado'});
      if(mode==='prepare_only')return res.status(503).json({status:'faturacao_suspensa'});
      const runtime=await worker.composeHosted();
      const job=background.start(worker,runtime,{owner:id,missionId,revision});
      waitUntil(job.completion);
      await job.accepted;
      return res.status(202).json({status:'accepted',missionId,mode});
    }catch{return res.status(503).json({status:'por_confirmar'});}
  }
  return scheduledWorker.handle(req,res,{worker});
}
