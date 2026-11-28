'use strict';
const factory=require('../intelligence/count-transport.js');
async function checks(factory){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const rejects=async(fn)=>{let denied=false;try{await fn()}catch{denied=true}check(denied,'expected rejection')};
 const record={owner:'owner-a',missionId:'00000000-0000-0000-0000-000000000015',revision:7,lines:[{name:'Cera',unit:'g',before:5,after:10,extra:'discard'}],device:'test'};
 let s={owner:record.owner,verified:true,enabled:true},calls=[],reply={mission:record.missionId,owner:record.owner,status:'committed'};
 const options={command:async(action,payload)=>{calls.push({action,payload});return reply},session:async()=>s};
 await rejects(()=>factory(options).status(record));check(calls.length===0,'off');
 const t=factory({...options,releaseEnabled:true});await t.approve(record);check(calls[0].payload.lines[0].extra===undefined&&!('owner'in calls[0].payload),'minimal payload');
 await t.execute(record);check(calls[1].payload.device==='test','device');
 s.enabled=false;await rejects(()=>t.execute(record));check((await t.status(record)).status==='committed','read when disabled');
 s.verified=false;await rejects(()=>t.status(record));s.verified=true;
 reply={...reply,owner:'other'};await rejects(()=>t.status(record));reply={...reply,owner:record.owner};
 s.owner='other';await rejects(()=>t.status(record));s.owner=record.owner;
 reply={...reply,mission:'wrong'};await rejects(()=>t.revoke(record));return n;
}
checks(factory).then(n=>console.log('Verificações concluídas:',n)).catch(e=>{console.error(e);process.exitCode=1});
