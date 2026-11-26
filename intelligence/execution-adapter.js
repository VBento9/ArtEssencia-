/* Intelligence — adapter isolated from live transport; explicit release gate. */
function createExecutionAdapter(){
 'use strict';
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e12;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 function normalize(lines){
  if(!Array.isArray(lines)||!lines.length||lines.length>500)throw Error('Lista de ajustes inválida.');
  const seen=new Set();
  return lines.map(l=>{
   if(!l||typeof l.name!=='string'||!l.name||l.name.length>200||l.name.trim()!==l.name||/[\u0000-\u001f\u007f]/.test(l.name)||!['g','ml','cm','un'].includes(l.unit)||!num(l.before)||!num(l.after)||l.before===l.after||l.unit==='un'&&(!Number.isSafeInteger(l.before)||!Number.isSafeInteger(l.after)))throw Error('Ajuste inválido.');
   const key=norm(l.name);if(!key||seen.has(key))throw Error('Material ambíguo.');seen.add(key);
   return {name:l.name,unit:l.unit,before:l.before,after:l.after};
  });
 }
 function prepare(batch,context){
  if(context?.releaseEnabled!==true||context?.allowed!==true||batch?.status!=='approved_preview'||batch.owner!==context.owner||batch.revision!==context.revision||!uuid(context.missionId)||!Number.isSafeInteger(context.revision)||context.revision<0||typeof context.device!=='string'||!context.device||context.device.length>150)throw Error('Execução desativada ou revisão desatualizada.');
  if(!Array.isArray(batch.approved)||!Array.isArray(batch.plan)||!Array.isArray(context.stock))throw Error('Revisão inválida.');
  const lines=normalize(batch.approved);
  for(const [i,l] of lines.entries()){
   const a=batch.approved[i],p=batch.plan[a.index],matches=context.stock.filter(s=>typeof s?.name==='string'&&norm(s.name)===norm(l.name));
   if(!p||p.status!=='balance_review'||p.name!==l.name||p.unit!==l.unit||p.current!==l.before||p.counted!==l.after||matches.length!==1||matches[0].name!==l.name||matches[0].unit!==l.unit||Number(matches[0].qty)!==l.before)throw Error('A revisão ou saldo mudou.');
  }
  return {version:1,owner:context.owner,missionId:context.missionId.toLowerCase(),revision:context.revision,device:context.device,lines,status:'pending_approval'};
 }
 function validate(record,ctx){
  if(!record||record.version!==1||!uuid(record.missionId)||record.owner!==ctx?.owner||!Number.isSafeInteger(record.revision)||record.revision<0||typeof record.device!=='string'||!record.device||record.device.length>150||ctx.releaseEnabled!==true||ctx.allowed!==true||!['pending_approval','approved','execution_unknown','confirmed'].includes(record.status))throw Error('Operação indisponível.');
  normalize(record.lines);
 }
 function sameLines(a,b){
  try{const sort=x=>normalize(x).sort((l,r)=>l.name<r.name?-1:l.name>r.name?1:0);return JSON.stringify(sort(a))===JSON.stringify(sort(b));}catch{return false}
 }
 function confirmed(record,response){
  if(response?.mission!==record.missionId||response?.owner!==record.owner||response?.status!=='committed'||!sameLines(response.lines,record.lines)||!Number.isSafeInteger(response.committedRevision)||response.committedRevision!==record.revision+1)throw Error('Recibo não confirmado.');
  return {...record,status:'confirmed',committedRevision:response.committedRevision,needsCloudRefresh:true};
 }
 // Transport must expose authenticated commands only. Store must confirm durable write.
 // No actual transport or storage is wired into the PWA in this module.
 function createSession({store,transport,context}){
  if(!store||!transport||typeof context!=='function')throw Error('Adaptador indisponível.');
  let busy=false;
  async function locked(fn){if(busy)throw Error('Operação em curso.');busy=true;try{return await fn()}finally{busy=false}}
  const save=async r=>{if(await store.save(copy(r))!==true)throw Error('Não foi possível guardar a recuperação.');return r;};
  async function current(){const r=await store.read();const c=await context();validate(r,c);return {r,c};}
  return {
   begin:(batch,missionId)=>locked(async()=>{
    if(await store.read())throw Error('Existe uma missão pendente. Verifica-a primeiro.');
    return save(prepare(batch,{...await context(),missionId}));
   }),
   approve:()=>locked(async()=>{
    const {r,c}=await current();
    if(r.status!=='pending_approval'||c.revision!==r.revision)throw Error('Nova revisão necessária.');
    const reply=await transport.approve(copy(r));
    if(reply?.mission!==r.missionId||reply?.revision!==r.revision||reply?.status!=='approved'||!Number.isFinite(Date.parse(reply.expires_at)))throw Error('Autorização não confirmada. Verifica a missão.');
    return save({...r,status:'approved',expiresAt:reply.expires_at});
   }),
   execute:()=>locked(async()=>{
    const {r,c}=await current();
    if(r.status!=='approved'||c.revision!==r.revision||Date.parse(r.expiresAt)<=Date.now())throw Error('Autorização expirada ou estado alterado.');
    // Persist BEFORE contacting server. Any loss of response requires receipt lookup.
    await save({...r,status:'execution_unknown'});
    const now=await context();validate(r,now);if(now.revision!==r.revision)throw Error('Revisão alterada.');
    await transport.execute(copy(r));
    // Do not apply response snapshots. Check independent receipt, then refresh canonical Cloud.
    const result=confirmed(r,await transport.status(copy(r)));
    return save(result);
   }),
   recover:()=>locked(async()=>{
    const {r}=await current(),reply=await transport.status(copy(r));
    if(reply?.status==='committed')return save(confirmed(r,reply));
    if(reply?.mission!==r.missionId||reply?.owner!==r.owner)throw Error('Estado da missão não confirmado.');
    if(reply.status==='approved'&&reply.revision===r.revision&&sameLines(reply.lines,r.lines)&&Number.isFinite(Date.parse(reply.expires_at))&&Date.parse(reply.expires_at)>Date.now())return save({...r,status:'approved',expiresAt:reply.expires_at});
    // Never blindly resend a write, even if server says missing/revoked/expired.
    return {...r,recoveryStatus:reply.status,requiresManualReview:true};
   }),
   clearConfirmed:()=>locked(async()=>{
    const {r,c}=await current();
    if(r.status!=='confirmed'||c.cloudVerified!==true||c.revision<r.committedRevision)throw Error('Recebe e valida os dados da Cloud antes de concluir.');
    if(await store.clear()!==true)throw Error('Não foi possível limpar a recuperação.');
    return {status:'completed',missionId:r.missionId};
   })
  };
 }
 return {prepare,createSession};
}
if(typeof module==='object'&&module.exports)module.exports=createExecutionAdapter();else globalThis.ArtEssenciaExecutionAdapter=createExecutionAdapter();
