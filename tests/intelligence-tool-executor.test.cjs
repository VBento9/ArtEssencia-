'use strict';
const factory=require('../intelligence/tool-executor.cjs');
async function checks(factory){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=async f=>{let x=false;try{await f()}catch{x=true}check(x,'expected rejection')};
 let enabled=true,granted=true,stored=new Map(),calls=0,failed=false,archived=false;
 const digest=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h.toString(16).padStart(64,'0');};
 const store={insertOnce:async(r,g)=>{calls++;if(failed)throw Error('network');if(!enabled||!granted)throw Error('atomic guard');const id=r.record_id||r.id;if(stored.has(id))return {id,status:archived?'archived':'existing'};stored.set(id,r);return {id,status:'created'};}};
 const opts={digest,taskStore:store,draftStore:store,authorize:async q=>({...q,verified:true,enabled,missionActive:true,toolGranted:granted,serverTime:'2026-11-26T10:00:00Z'})};
 const q={owner:'owner-a',agent:'stock',missionId:'m1',kind:'inventory_audit',tool:'create_task',actionId:'a1',args:{title:'Validar inventário',semanticKey:'review-stock-cera',priority:'alta',dueDate:null,estimateMin:15,details:'Rever contagem.'}};
 await reject(()=>factory(opts).run(q));check(calls===0,'off');
 const e=factory({...opts,releaseEnabled:true});
 const result=await e.run(q);check(result.status==='created','create');
 const saved=stored.get(result.id);check(saved.entity==='operational_tasks_v1'&&saved.data.status==='pendente'&&saved.data.category==='Gestão','existing schema');
 check(saved.data.intelligence_agent==='stock','origin');check((await e.run({...q,missionId:'m2'})).status==='existing','dedup across missions');
 archived=true;check((await e.run(q)).status==='archived','no reopen');archived=false;
 enabled=false;await reject(()=>e.run(q));enabled=true;granted=false;await reject(()=>e.run(q));granted=true;
 await reject(()=>e.run({...q,tool:'delete_stock'}));await reject(()=>e.run({...q,agent:'financeiro'}));
 await reject(()=>e.run({...q,args:{...q.args,dueDate:'2026-02-30'}}));await reject(()=>e.run({...q,args:{...q.args,title:'cliente@example.com'}}));
 const d={...q,tool:'save_draft',actionId:'a2',args:{type:'lista_compras',title:'Materiais a rever',content:'Cera: confirmar quantidade.',evidenceIds:['audit1']}};
 const out=await e.run(d);check(stored.get(out.id).status==='draft_review','draft');await reject(()=>e.run({...d,args:{...d.args,type:'publicacao'}}));
 failed=true;const previous=calls;await reject(()=>e.run({...q,actionId:'a3'}));check(calls===previous+1,'no retry');
 return n;
}
checks(factory).then(n=>console.log('Verificações concluídas:',n)).catch(e=>{console.error(e);process.exitCode=1});
