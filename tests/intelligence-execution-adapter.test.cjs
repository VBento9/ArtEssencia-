'use strict';
const adapter=require('../intelligence/execution-adapter.js');
async function checks(adapter){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const rejects=async(f,m)=>{let failed=false;try{await f()}catch{failed=true}check(failed,m)};
 const id='00000000-0000-0000-0000-000000000015',owner='owner-a',line={index:0,name:'Cera',unit:'g',before:500,after:1000,delta:500};
 const batch={status:'approved_preview',owner,revision:7,approved:[line],plan:[{status:'balance_review',name:'Cera',unit:'g',current:500,counted:1000}]};
 let context={owner,releaseEnabled:true,allowed:true,revision:7,device:'fixture',stock:[{name:'Cera',unit:'g',qty:500}],cloudVerified:true},record=null,receipt=null,approved=null,writes=0,fail=false,lose=false;
 const store={read:async()=>record,save:async r=>{if(fail)return false;record=r;return true},clear:async()=>{record=null;return true}};
 const transport={approve:async r=>{approved={mission:r.missionId,owner:r.owner,revision:r.revision,lines:r.lines,status:'approved',expires_at:new Date(Date.now()+600000).toISOString()};return approved},execute:async r=>{writes++;receipt={mission:r.missionId,owner:r.owner,lines:r.lines,status:'committed',committedRevision:r.revision+1};if(lose)throw Error('network lost');return {}},status:async()=>receipt||approved};
 const session=adapter.createSession({store,transport,context:async()=>context});
 context.releaseEnabled=false;await rejects(()=>session.begin(batch,id),'off');context.releaseEnabled=true;
 fail=true;await rejects(()=>session.begin(batch,id),'storage failure');fail=false;
 check((await session.begin(batch,id)).status==='pending_approval','prepare');
 await rejects(()=>session.begin(batch,id),'duplicate pending');
 await rejects(()=>session.execute(),'approval required');
 check((await session.approve()).status==='approved','approve');
 fail=true;await rejects(()=>session.execute(),'no durable recovery');check(writes===0,'no write');fail=false;
 lose=true;await rejects(()=>session.execute(),'lost response');check(record.status==='execution_unknown'&&writes===1,'pending persisted');
 await rejects(()=>session.execute(),'no blind replay');
 context.owner='other';await rejects(()=>session.recover(),'owner');context.owner=owner;
 check((await session.recover()).status==='confirmed'&&writes===1,'receipt recovery');
 await rejects(()=>session.clearConfirmed(),'refresh first');
 context.revision=8;context.cloudVerified=false;await rejects(()=>session.clearConfirmed(),'cloud unverified');
 context.cloudVerified=true;check((await session.clearConfirmed()).status==='completed'&&record===null,'clear');
 await rejects(()=>adapter.prepare(batch,{...context,revision:7,stock:[{name:'Cera',unit:'g',qty:501}],missionId:id}),'changed count');
 return n;
}
checks(adapter).then(n=>console.log('Verificações concluídas:',n)).catch(e=>{console.error(e);process.exitCode=1});
