'use strict';
async function test(create){
 const owner='00000000-0000-0000-0000-000000000001',missionId='00000000-0000-0000-0000-000000000002',leaseId='00000000-0000-0000-0000-000000000003';
 const q={owner,missionId,leaseId,agent:'financeiro',kind:'finance_review'};
 let calls=0,n=0;const ok=x=>{if(!x)throw Error('check failed');n++};const reject=async f=>{let fail=false;try{await f()}catch{fail=true}ok(fail)};
 const options={owner,releaseEnabled:true,stockContext:async()=>({stock:true}),loadVerified:async x=>{calls++;return {...x,verified:true,sourceRevision:7,evidenceIds:['r7'],payload:{today:'2026-11-26',targetMarginPct:40,products:[{code:'A',costComplete:true,totalCost:3,netSalePrice:5,description:'private',customer:'secret'}],orders:[{id:'O1',total:5,paid:0,phone:'secret'}],customers:['secret']}}}};
 const route=create(options),r=await route(q);ok(r.payload.products[0].totalCost===3);ok(!JSON.stringify(r).includes('secret'));ok(!('description'in r.payload.products[0]));ok(!('customers'in r.payload));
 await reject(()=>create({...options,releaseEnabled:false})(q));await reject(()=>route({...q,owner:'other'}));await reject(()=>route({...q,kind:'catalog_review'}));await reject(()=>route({...q,agent:'producao',kind:'production_plan'}));ok(calls===1);
 ok((await route({...q,agent:'stock',kind:'inventory_audit'})).stock);
 await reject(()=>create({...options,loadVerified:async x=>({...x,verified:false})})(q));
 await reject(()=>create({...options,loadVerified:async x=>({...await options.loadVerified(x),payload:{}})})(q));
 await reject(()=>create({...options,loadVerified:async x=>({...await options.loadVerified(x),leaseId:missionId})})(q));
 return n;
}
test(require('../intelligence/context-router.cjs')).then(n=>console.log('Checks:',n)).catch(e=>{console.error(e);process.exitCode=1});
