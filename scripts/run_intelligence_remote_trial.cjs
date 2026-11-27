'use strict';
const {run}=require('../intelligence/remote-trial.cjs');
async function main(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22 necessário.');
 const config=JSON.parse(process.env.INTELLIGENCE_REMOTE_CONFIG||'null');
 if(!config||typeof config!=='object')throw Error('Configuração indisponível.');
 const raw=process.env.INTELLIGENCE_MISSION_REVISION;
 if(!/^[1-9][0-9]{0,8}$/.test(raw||''))throw Error('Revisão inválida.');
 const result=await run(config,{missionId:process.env.INTELLIGENCE_MISSION_ID,revision:Number(raw)});
 // Public Actions logs must never contain the report, inputs, credentials or raw errors.
 console.log(JSON.stringify(result));
 if(result.status!=='review_ready')process.exitCode=1;
}
main().catch(()=>{console.error('Executor bloqueado ou resultado por confirmar. Consultar missão e ledger; não repetir automaticamente.');process.exitCode=1;});
