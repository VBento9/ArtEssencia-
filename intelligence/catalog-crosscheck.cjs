'use strict';
// Read only the exact anonymous RPCs consumed by the public websites.
const {projectUrl}=require('./worker-transport.cjs');
const limited=async response=>{
 if(!response.ok)throw Error('Serviço público indisponível.');
 if(!response.body?.getReader)throw Error('Resposta pública inválida.');
 const reader=response.body.getReader();let length=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4000000)throw Error('Resposta pública excede o limite.');chunks.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};
function createReader(env=process.env,request=fetch){
 const base=projectUrl(env),key=env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY;
 // Never forward worker JWT, owner tokens or service-role credentials.
 if(typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw Error('Chave pública específica necessária.');
 return async()=>{
  const read=name=>request(base+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:key,'Content-Type':'application/json'},body:'{}'}).then(limited);
  const result=await Promise.allSettled(['store_public_catalog_v1','store_public_content_v3','store_public_config_v1'].map(read));
  return Object.fromEntries(['catalog','content','config'].map((name,i)=>[name,result[i].status==='fulfilled'?result[i].value:null]));
 };
}
const str=v=>typeof v==='string'?v.trim():'';
const key=v=>str(v).normalize('NFC');
const rows=(v,max=5000)=>Array.isArray(v)&&v.length<=max&&v.every(x=>x&&typeof x==='object'&&!Array.isArray(x))?v:null;
const refs=p=>[p?.id,p?.backoffice_product_id,p?.product_id,p?.code].map(x=>String(x??'')).filter(Boolean);
function compare(internal,publicData){
 const local=rows(internal?.products),products=rows(publicData?.catalog?.products),categories=rows(publicData?.catalog?.categories);
 const content=publicData?.content,store=publicData?.config?.store_status;
 const families=rows(content?.catalog_families),campaigns=rows(content?.campaigns),upcoming=rows(content?.upcoming_campaigns);
 const catalogMode=str(content?.catalog_status?.mode).toLowerCase(),storeMode=str(store?.mode).toLowerCase();
 const storeOrders=store?.enabled===false||store?.accepting_orders===false||['closed','updating'].includes(storeMode)?'blocked':store?.enabled===true&&store?.accepting_orders===true&&storeMode==='open'?'enabled':'unknown';
 const out={mode:'public_api_comparison',coverage:{products:!!(local&&products),families:!!(categories&&families?.length),collections:!!(campaigns&&upcoming),siteRendering:'not_tested',imageLoading:'not_tested'},storeOrders,catalogMode:['open','closed','updating'].includes(catalogMode)?catalogMode:'unknown',totalInternal:local?.length??null,totalPublic:products?.length??null,issues:[],issueCount:0};
 function issue(code,kind){out.issueCount++;if(out.issues.length<100)out.issues.push({code:String(code).slice(0,70),kind});}
 if(!local||!products)return out;
 const used=new Set();
 for(const p of local){
  if(!str(p.code)){issue('sem-codigo','missing_internal_code');continue;}
  const match=products.filter(x=>str(x.code)===p.code||p.recordId&&String(x.backoffice_product_id??'')===p.recordId);
  if(match.length>1){issue(p.code,'ambiguous_public_product');match.forEach(x=>used.add(x));continue;}
  if(!match.length){if(p.catalogEligible===true)issue(p.code,'missing_public_product_review');continue;}
  const q=match[0];used.add(q);
  if(p.catalogEligible===false){issue(p.code,'hidden_product_in_public_feed_review');continue;}
  if(str(p.name)&&key(p.name)!==key(q.name))issue(p.code,'name_mismatch');
  if(str(p.description)&&key(p.description)!==key(q.description))issue(p.code,'description_mismatch');
  if(!str(q.image_url))issue(p.code,'missing_public_image');
  else if(str(p.imageUrl)&&key(p.imageUrl)!==key(q.image_url))issue(p.code,'image_reference_mismatch');
  if(categories&&families?.length&&str(p.family)){
   const cat=categories.find(c=>String(c.id??'')===String(q.category_id??''));
   const mapped=families.filter(f=>f.enabled!==false&&Array.isArray(f.categories)&&f.categories.includes(cat?.name));
   if(mapped.length!==1||![mapped[0].id,mapped[0].label].map(key).includes(key(p.family)))issue(p.code,'family_mapping_review');
  }
  if(q.active===false||q.available===false)issue(p.code,'public_availability_review');
 }
 for(const p of products)if(!used.has(p))issue(str(p.code)||'sem-codigo','unmatched_public_product_review');
 if(campaigns&&upcoming)for(const c of [...campaigns,...upcoming]){
  const entries=c?.data?.products;if(!Array.isArray(entries))continue;
  for(const ref of entries.slice(0,500)){
   const ids=typeof ref==='string'?[ref]:refs(ref);
   if(ids.length&&!products.some(p=>refs(p).some(id=>ids.includes(id))))issue(ids[0],'collection_reference_not_in_feed_review');
  }
 }
 return out;
}
module.exports={createReader,compare};
