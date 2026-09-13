import * as db from './db.js';
import {calcProduct} from './domain.js';
export async function runAudit(){
  const names=['products','materials','orders','orderItems','clients','productionBatches','kitItems','collections','purchases','payments'];
  const data={};for(const n of names)data[n]=await db.all(n);
  const issues=[];const push=(level,area,message)=>issues.push({level,area,message});
  push('ok','Base de dados','IndexedDB acessível e stores principais carregadas.');
  const sku=new Map();
  for(const p of data.products){
    const key=String(p.sku||'').trim().toUpperCase();
    if(!key)push('warn','Catálogo',`Produto "${p.name||'Sem nome'}" sem SKU.`);
    else if(sku.has(key))push('error','Catálogo',`SKU duplicado: ${key}.`);
    else sku.set(key,p.id);
    if(p.family!=='kit'&&!(p.recipe||[]).length)push('warn','Ficha técnica',`"${p.name}" não tem matérias na ficha técnica.`);
    const econ=calcProduct(p,data.materials,data.kitItems,data.products);
    if(Number(p.price||0)>0&&econ.margin<Number(p.alertMarginPct??40))push('warn','Margem',`"${p.name}" está com margem ${econ.margin.toFixed(1)}%.`);
    for(const r of p.recipe||[])if(!data.materials.some(m=>m.id===r.materialId))push('error','Ficha técnica',`"${p.name}" referencia uma matéria eliminada.`);
  }
  for(const m of data.materials){
    if(Number(m.stock||0)<0)push('error','Stock',`${m.name}: stock negativo.`);
    else if(Number(m.stock||0)<=Number(m.minStock||0))push('warn','Stock',`${m.name}: stock crítico (${m.stock||0} ${m.unit||''}).`);
    if(Number(m.stock||0)>0&&Number(m.unitCost||0)<=0)push('warn','Custos',`${m.name}: existe stock sem custo médio.`);
  }
  const clientIds=new Set(data.clients.map(x=>x.id)),productIds=new Set(data.products.map(x=>x.id)),orderIds=new Set(data.orders.map(x=>x.id));
  for(const o of data.orders){
    if(o.clientId&&!clientIds.has(o.clientId))push('error','Encomendas',`${o.number||o.id}: cliente inexistente.`);
    if(!data.orderItems.some(i=>i.orderId===o.id))push('warn','Encomendas',`${o.number||o.id}: sem artigos.`);
  }
  for(const i of data.orderItems){
    if(!orderIds.has(i.orderId))push('error','Encomendas',`Linha órfã ${i.id}.`);
    if(i.productId&&!productIds.has(i.productId))push('warn','Histórico',`Linha de encomenda aponta para produto eliminado: ${i.productName||i.productId}.`);
  }
  for(const k of data.kitItems){
    if(!productIds.has(k.kitProductId)||!productIds.has(k.productId))push('error','Kits',`Componente inválido no kit ${k.kitProductId}.`);
  }
  if(!issues.some(x=>x.level==='error'))push('ok','Integridade','Não foram encontradas relações estruturais partidas.');
  const counts={error:issues.filter(x=>x.level==='error').length,warn:issues.filter(x=>x.level==='warn').length,ok:issues.filter(x=>x.level==='ok').length};
  return {at:new Date().toISOString(),issues,counts};
}
