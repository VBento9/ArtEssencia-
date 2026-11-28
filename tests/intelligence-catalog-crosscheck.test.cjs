'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare,createReader}=require('../intelligence/catalog-crosscheck.cjs');
test('Public feed comparison reports gaps, not a false empty catalogue',()=>{
 const internal={products:[{code:'A',name:'Vela',description:'Descrição',imageUrl:'photo',family:'velas',catalogEligible:true},{code:'B',catalogEligible:true},{code:'C',catalogEligible:false}]};
 assert.equal(compare(internal,null).coverage.products,false);
 assert.equal(compare(internal,null).storeOrders,'unknown');
 assert.equal(compare(internal,null).issueCount,0);
 const data={catalog:{products:[{code:'A',name:'Vela',description:'Outra',image_url:'',category_id:'1'},{code:'C'},{code:'D'}],categories:[{id:'1',name:'Velas'}]},content:{catalog_families:[{id:'velas',categories:['Velas']}],campaigns:[{data:{products:['Z']}}],upcoming_campaigns:[]},config:{store_status:{enabled:true,accepting_orders:false}}};
 const out=compare(internal,data);
 assert.equal(out.storeOrders,'blocked');assert.equal(out.coverage.siteRendering,'not_tested');
 for(const k of ['description_mismatch','missing_public_image','missing_public_product_review','hidden_product_in_public_feed_review','unmatched_public_product_review','collection_reference_not_in_feed_review'])assert.ok(out.issues.some(i=>i.kind===k),k);
 assert.ok(!out.issues.some(i=>i.kind==='family_mapping_review'));
});
test('Anonymous public reader uses only fixed RPCs and handles unavailable sources',async()=>{
 const base='https://abcdefghijklmnopqrst.supabase.co',urls=[];
 const env={INTELLIGENCE_SUPABASE_URL:base,INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',INTELLIGENCE_WORKER_JWT:'private'};
 const read=createReader(env,async(url,options)=>{
  urls.push(url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);
  assert.equal(options.headers.apikey,env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY);
  return url.endsWith('config_v1')?new Response('{}',{status:503}):new Response('{}');
 });
 const result=await read();assert.equal(result.config,null);assert.deepEqual(result.catalog,{});
 assert.equal(urls.length,3);assert.ok(urls.every(u=>u.startsWith(base+'/rest/v1/rpc/store_public_')));
 assert.throws(()=>createReader({...env,INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'secret'}));
});
