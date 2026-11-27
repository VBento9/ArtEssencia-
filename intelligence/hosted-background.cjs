'use strict';
// Acknowledge only after the database has atomically consumed the approved
// revision. The promise is attached to Vercel's request lifetime, never detached.
// A crash is recovered by the existing tick/lease mechanism, never by replaying AI.
function start(worker,runtime,mission){
 let resolve,reject,claimed=false;
 const accepted=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const completion=Promise.resolve().then(()=>worker.processNext(runtime,mission,{onClaim:receipt=>{
  if(claimed||receipt.missionId!==mission.missionId||receipt.revision!==mission.revision+1||receipt.status!=='working')throw Error('Claim não confirmado.');
  claimed=true;resolve();
 }})).then(()=>{if(!claimed)reject(Error('Execução não iniciada.'));},()=>{
  if(!claimed)reject(Error('Execução por confirmar.'));
  // No log of credentials, instructions, response text or transport errors.
  // If the runtime could not finish, the persisted lease remains recoverable.
 });
 return {accepted,completion};
}
module.exports={start};
