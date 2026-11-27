'use strict';
async function main(){
 const config=require('../intelligence/remote-config.cjs')();
 const result=await require('../intelligence/remote-preflight.cjs')(config);
 console.log(JSON.stringify(result));
 if(result.status!=='preflight_passed')process.exitCode=1;
}
main().catch(()=>{console.error('Configuração remota incompleta; nenhuma missão iniciada.');process.exitCode=1;});
