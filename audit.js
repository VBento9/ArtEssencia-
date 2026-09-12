import * as db from './db.js';
import {calcProduct} from './domain.js';
export async function runAudit(){
  const [products,materials,clients,orders,orderItems,production]=await Promise.all(['products','materials','clients','orders','orderItems','productionBatches'].map(db.all));
  const issues=[]; const add=(area,level,message)=>issues.push({area,level,message});
  const sku=new Map();for(const p of products){if(!p.sku)add('Catálogo','warn',`Produto ${p.name||'(sem nome)'} sem SKU.`);else{const k=p.sku.toLowerCase();if(sku.has(k))add('Catálogo','error',`SKU duplicado: ${p.sku}.`);sku.set(k,true)}if(!p.recipe?.length&&p.family!=='kit')add('Ficha Técnica','warn',`${p.name} sem matérias na ficha técnica.`);const c=calcProduct(p,materials);if(Number(p.price)>0&&c.margin<Number(p.alertMarginPct||40))add('Custos','warn',`${p.name} com margem ${c.margin.toFixed(1)}%.`);}
  const matIds=new Set(materials.map(m=>m.id));for(const p of products)for(const r of p.recipe||[])if(!matIds.has(r.materialId))add('Ficha Técnica','error',`${p.name} referencia uma matéria inexistente.`);
  for(const m of materials){if(Number(m.stock)<0)add('Stock','error',`${m.name} tem stock negativo.`);else if(Number(m.stock)<=Number(m.minStock||0))add('Stock','warn',`${m.name} atingiu o stock mínimo.`);if(Number(m.stock)>0&&Number(m.unitCost)<=0)add('Stock','warn',`${m.name} tem stock mas não tem custo médio.`)}
  const clientIds=new Set(clients.map(c=>c.id));const orderIds=new Set(orders.map(o=>o.id));for(const o of orders){if(o.clientId&&!clientIds.has(o.clientId))add('Encomendas','error',`Encomenda ${o.number||o.id} ligada a cliente inexistente.`);if(!orderItems.some(i=>i.orderId===o.id))add('Encomendas','warn',`Encomenda ${o.number||o.id} sem artigos.`)}for(const i of orderItems)if(!orderIds.has(i.orderId))add('Encomendas','error','Existe uma linha órfã sem encomenda.');
  for(const b of production)if(!products.some(p=>p.id===b.productId))add('Atelier','error',`Produção ${b.id} ligada a produto inexistente.`);
  if(!issues.length)add('Geral','ok','Nenhum problema estrutural detetado.');
  const counts={ok:issues.filter(i=>i.level==='ok').length,warn:issues.filter(i=>i.level==='warn').length,error:issues.filter(i=>i.level==='error').length};
  await db.put('auditLog',{id:`audit_${Date.now()}`,createdAt:new Date().toISOString(),counts,issues});
  return {counts,issues};
}
