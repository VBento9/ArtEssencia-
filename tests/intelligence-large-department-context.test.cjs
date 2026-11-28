'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,LIMIT}=require('../intelligence/reasoning-context.cjs');
const finance=require('../intelligence/operational-agents.js').finance;
const catalog=require('../intelligence/business-agents.js').catalog;
const create=require('../intelligence/mission-runner.cjs'),core=require('../intelligence/control-core.js');
const products=Array.from({length:209},(_,i)=>({code:'P-'+String(i).padStart(4,'0'),costComplete:i>=101,totalCost:12+i/100,netSalePrice:10,targetMarginPct:35}));
const orders=Array.from({length:22},(_,i)=>({id:'O-'+i,status:'Confirmada',paymentComplete:true,total:20,paid:5,delivery:'2026-11-28'}));
const fin=finance({today:'2026-11-28',targetMarginPct:35,products,orders});
const cat=catalog({products:Array.from({length:209},(_,i)=>({code:'P-'+String(i).padStart(4,'0'),catalogEligible:i<102,hasVerifiedImage:false,description:null,family:null,optionsComplete:null,priceVerified:false})),crosscheck:{mode:'public_api_comparison',storeOrders:'blocked',coverage:{products:true,siteRendering:'not_tested'},totalInternal:209,totalPublic:102,issueCount:200,issues:Array.from({length:100},(_,i)=>({code:'P-'+i,kind:'missing_public_image'}))}});
const base=report=>({professionalMemory:[],departmentFacts:{coverage:'fixture'},sourceRevision:2260,evidenceIds:['consulta-fixture'],report});
for(const [name,report] of [['financeiro',fin],['catalogo',cat]])test(name+' large context preserves complete report and evidence',()=>{
 const input=base(report),before=JSON.stringify(input);assert.ok(before.length>LIMIT);
 const out=build(input),parsed=JSON.parse(out.context);
 assert.ok(out.context.length<=LIMIT);assert.equal(JSON.stringify(input),before);
 assert.equal(parsed.sourceRevision,2260);assert.deepEqual(parsed.evidenceIds,input.evidenceIds);
 assert.equal(out.coverage.collections['report.tasks'].total,report.tasks.length);assert.ok(out.coverage.collections['report.tasks'].omitted>0);
 assert.ok(Buffer.byteLength(JSON.stringify({...report,reasoningCoverage:out.coverage}))<=75000);
 if(name==='financeiro'){assert.equal(out.coverage.collections['report.receivables'].totalDueCents,33000);assert.equal(out.coverage.collections['report.margins'].negativeMargin,108);}
 if(name==='catalogo'){assert.equal(parsed.report.publicComparison.issueCount,200);assert.equal(parsed.report.publicComparison.storeOrders,'blocked');}
});
test('small contexts unchanged; essential evidence fails closed',()=>{
 const small=base({mode:'proposal_only',tasks:[]});assert.deepEqual(build(small),{context:JSON.stringify(small),coverage:null});
 assert.throws(()=>build({...small,departmentFacts:{text:'x'.repeat(25000)}}),e=>e.contextCode==='context_limit');
});
for(const [agent,kind,report,engines] of [['financeiro','finance_review',fin,{operational:{finance:()=>fin}}],['catalogo','catalog_review',cat,{business:{catalog:()=>cat}}]])test(agent+' mission finishes once with full report and no writes',async()=>{
 const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0'),owner=id(1),missionId=id(2),leaseId=id(3),requestId=id(4);
 let calls=0,saved;
 const m={owner,id:missionId,leaseId,requestId,agent,kind,instruction:'Rever dados',controlRevision:5,revision:2,status:'working'};
 const settings={...core.defaults(),enabled:true,agents:{...core.defaults().agents,[agent]:'semi'}};
 const runner=create({releaseEnabled:true,core,engines,store:{
 claim:async()=>m,verifyLease:async()=>({verified:true,owner,missionId,leaseId,agent,kind,controlRevision:5,active:true,settings,actions:[]}),
 finish:async q=>{saved=q;return {status:'review_ready',missionId,leaseId}},interrupt:async()=>({status:'blocked',missionId,leaseId})
 },contextSource:async()=>({verified:true,owner,agent,missionId,leaseId,sourceRevision:2260,evidenceIds:['consulta-fixture'],payload:{}}),
 gateway:{run:async q=>{calls++;assert.ok(q.context.length<=LIMIT);return {requestId,agent,status:'review',text:'Rever dados fornecidos.',chargedMicroeur:1}}},executor:{run:async()=>{throw Error('unexpected external effect')}}});
 const result=await runner.run({owner,missionId,expectedRevision:1});assert.equal(result.status,'review_ready');assert.equal(calls,1);
 assert.deepEqual(saved.report.tasks,report.tasks);assert.ok(saved.report.reasoningCoverage);assert.deepEqual(saved.receipts,[]);
});
