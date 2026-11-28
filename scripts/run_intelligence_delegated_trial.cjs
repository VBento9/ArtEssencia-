'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),readline=require('node:readline/promises'),{Writable}=require('node:stream'),{execFileSync}=require('node:child_process');
const {run}=require('../intelligence/local-delegated-trial.cjs');
async function main(){
 if(!process.stdin.isTTY||!process.stdout.isTTY||process.env.VERCEL||process.env.VERCEL_ENV||Number(process.versions.node.split('.')[0])<22)throw Error('Terminal local com Node 22+ necessário.');
 const parentId=process.argv[2],visible=process.argv.includes('--show-passwords');
 let muted=false;
 const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}});
 const rl=readline.createInterface({input:process.stdin,output,terminal:true,historySize:0});
 const ask=async(label,secret=false)=>{
  if(secret&&visible&&label.startsWith('Palavra-passe')&&process.platform==='darwin'){
   return execFileSync('/usr/bin/osascript',['-e','text returned of (display dialog '+JSON.stringify(label)+' default answer "" with title "ArtEssencia Intelligence")'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  }
  if(!secret)return (await rl.question(label)).trim();
  process.stdout.write(label);muted=true;
  try{return (await rl.question('')).trim();}finally{muted=false;process.stdout.write('\n');}
 };
 try{
  const financialApproval=fs.readFileSync(path.join(os.homedir(),'Downloads','artessencia-autorizacao-ensaio.json'),'utf8');
  const config={financialApproval,publishableKey:await ask('Chave publishable do projeto isolado: '),serviceId:await ask('ID da conta de serviço: '),
   serviceEmail:await ask('Email da conta de serviço: '),servicePassword:await ask('Palavra-passe da conta de serviço: ',true),
   ownerEmail:await ask('Email do titular de ensaio: '),ownerPassword:await ask('Palavra-passe do titular de ensaio: ',true),
   apiKey:await ask('Chave OpenAI dedicada (oculta): ',true)};
  const result=await run(config,parentId,{write:console.log,confirm:async()=>await ask('Escreve EXECUTAR para aprovar esta delegação: ')==='EXECUTAR'});
  console.log(JSON.stringify({status:result.status,completed:result.results?.map(({agent,missionId,chargedMicroeur})=>({agent,missionId,chargedMicroeur})),missionId:result.missionId,blocked:result.blocked,stage:result.stage,diagnostic:result.diagnostic},null,2));
 }finally{rl.close();}
}
main().catch(()=>{console.error('Ensaio bloqueado ou resultado por confirmar. Não repetir automaticamente; verificar a Cloud.');process.exitCode=1;});
