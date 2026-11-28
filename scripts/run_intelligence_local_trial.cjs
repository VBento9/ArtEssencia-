'use strict';
// Run directly in Terminal on a trusted Mac. Secrets are entered with echo disabled,
// never saved to files, put in shell arguments, logs, browser storage or Git.
const fs=require('node:fs'),readline=require('node:readline/promises'),{Writable}=require('node:stream');
const {run}=require('../intelligence/local-trial.cjs');
async function main(){
 if(!process.stdin.isTTY||!process.stdout.isTTY||process.env.VERCEL||process.env.VERCEL_ENV)throw Error('Utiliza o Terminal local, sem redirecionar entradas.');
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Necessário Node.js 22 ou superior.');
 let muted=false;
 const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}});
 const rl=readline.createInterface({input:process.stdin,output,terminal:true,historySize:0});
 const ask=async(label,secret=false)=>{
  if(!secret)return (await rl.question(label)).trim();
  process.stdout.write(label);muted=true;
  try{return (await rl.question('')).trim();}finally{muted=false;process.stdout.write('\n');}
 };
 try{
  console.log('ArtEssencia — ensaio local, Cloud isolada, limite acumulado 1 EUR. Não uses credenciais de produção.');
  const file=await ask('Caminho do ficheiro de aprovação financeira (JSON): ');
  const financialApproval=fs.readFileSync(file,'utf8');
  const config={financialApproval,publishableKey:await ask('Chave publishable do projeto isolado: '),serviceId:await ask('ID da conta de serviço: '),
   serviceEmail:await ask('Email da conta de serviço: '),servicePassword:await ask('Palavra-passe da conta de serviço (oculta): ',true),
   ownerEmail:await ask('Email do titular de ensaio: '),ownerPassword:await ask('Palavra-passe do titular de ensaio (oculta): ',true),
   apiKey:await ask('Chave OpenAI dedicada (oculta): ',true)};
  const result=await run(config,{write:console.log,confirm:async()=>await ask('Escreve EXECUTAR para autorizar esta missão: ')==='EXECUTAR'});
  console.log(JSON.stringify(result,null,2));
  console.log('Não repitas uma missão cujo resultado esteja por confirmar. A autorização Cloud deve ser encerrada após o ensaio.');
 }finally{rl.close();}
}
main().catch(()=>{console.error('Ensaio bloqueado ou resultado por confirmar. Não repetir automaticamente. Verificar a Cloud antes de novo pedido.');process.exitCode=1;});
