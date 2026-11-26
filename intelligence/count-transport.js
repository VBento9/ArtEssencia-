/* Disabled-by-default command adapter; no live transport. */
function createCountTransport(options){
 'use strict';
 const {command,session,releaseEnabled=false}=options||{};
 if(typeof command!=='function'||typeof session!=='function')throw Error('Canal indisponível.');
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 async function invoke(action,r){
  const s=await session();
  if(!releaseEnabled||!s||s.verified!==true||s.owner!==r?.owner||!uuid(r?.missionId))throw Error('Canal desativado ou sessão inválida.');
  const payload={mission:r.missionId};
  if(action==='approve'||action==='execute'){
   if(s.enabled!==true||!Number.isSafeInteger(r.revision)||r.revision<0||!Array.isArray(r.lines)||!r.lines.length||r.lines.length>500)throw Error('Missão indisponível.');
   payload.revision=r.revision;payload.lines=r.lines.map(l=>({name:l.name,unit:l.unit,before:l.before,after:l.after}));
   if(action==='execute')payload.device=r.device;
  }
  const reply=await command(action,payload);const current=await session();
  if(current?.verified!==true||current.owner!==s.owner||reply?.mission!==r.missionId)throw Error('Resposta não confirmada.');
  if(action==='status'&&reply.owner!==s.owner)throw Error('Recibo de outro proprietário.');
  return reply;
 }
 return {approve:r=>invoke('approve',r),execute:r=>invoke('execute',r),status:r=>invoke('status',r),revoke:r=>invoke('revoke',r)};
}
if(typeof module==='object'&&module.exports)module.exports=createCountTransport;else globalThis.ArtEssenciaCountTransport=createCountTransport;
