/* ArtEssencia Intelligence — plano de alteração, sem escrita. */
function createRenamePlanner(){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const map=o=>o&&typeof o==='object'&&!Array.isArray(o);
 const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const validName=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=200&&!/[\u0000-\u001f\u007f]/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
 const clone=o=>JSON.parse(JSON.stringify(o));
 function requireSnapshot(db){
  if(!map(db)||!['stock','products','purchases','stockMoves','productionRuns','orders'].every(k=>Array.isArray(db[k]))||!map(db.productRecipes)||!map(db.costMeta))throw Error('Snapshot incompleto: não é seguro prever a alteração.');
  if(!db.stock.every(s=>map(s)&&typeof s.name==='string')||!Object.values(db.productRecipes).every(rs=>Array.isArray(rs)&&rs.every(map))||!['products','purchases','stockMoves','productionRuns','orders'].every(k=>db[k].every(map)))throw Error('Estrutura de referência inválida.');
 }
 function planRename(db,oldName,newName){
  requireSnapshot(db);
  if(!validName(oldName)||!validName(newName)||oldName===newName)throw Error('Nome inválido ou sem alteração.');
  const source=db.stock.map((s,index)=>({s,index})).filter(x=>x.s.name===oldName);
  const target=db.stock.filter(s=>s.name!==oldName&&normalize(s.name)===normalize(newName));
  const blockers=[];
  if(source.length!==1)blockers.push('origem_ausente_ou_ambigua');
  if(target.length)blockers.push('destino_existente_ou_semelhante');
  if(db.stock.some(s=>s.name!==oldName&&normalize(s.name)===normalize(oldName)))blockers.push('origem_com_duplicado_candidato');
  const references=[];
  for(const [code,rows] of Object.entries(db.productRecipes))for(const [index,row] of rows.entries())if(row.item===oldName)references.push({code,index});
  const purchases=db.purchases.filter(x=>x.item===oldName).length;
  const moves=db.stockMoves.filter(x=>x.item===oldName).length;
  const packaging=db.orders.filter(x=>String(x.box??'').trim()===oldName).length;
  const historicalRuns=db.productionRuns.filter(run=>[run.materials,run.materialUnitCosts,...(map(run.orderMaterials)?Object.values(run.orderMaterials):[])].some(o=>map(o)&&own(o,oldName))).length;
  const costMeta=own(db.costMeta,oldName)||own(db.costMeta,newName);
  const legacyRecipe=db.products.filter(p=>Array.isArray(p.recipe)&&p.recipe.some(x=>x?.item===oldName||x?.name===oldName||x?.materialId!=null)).length;
  const stockLegacy=Array.isArray(db.materials)&&db.materials.some(m=>normalize(m?.name)===normalize(oldName)||normalize(m?.name)===normalize(newName));
  if(purchases||moves||historicalRuns||packaging)blockers.push('historico_ou_encomendas_exigem_reconciliacao');
  if(costMeta)blockers.push('metadados_de_custo_exigem_reconciliacao');
  if(legacyRecipe||stockLegacy)blockers.push('referencias_legadas_exigem_validacao');
  if(Object.values(db.productRecipes).some(rows=>rows.some(r=>r.item===newName)))blockers.push('destino_ja_referenciado_em_ficha');
  const impact={recipeLines:references.length,productsAffected:new Set(references.map(r=>r.code)).size,purchases,moves,historicalRuns,packaging,costMeta,legacyRecipe,stockLegacy};
  const patches=blockers.length?[]:[{path:['stock',source[0].index,'name'],before:oldName,after:newName},...references.map(r=>({path:['productRecipes',r.code,r.index,'item'],before:oldName,after:newName}))];
  return {oldName,newName,status:blockers.length?'blocked':'review',requiresApproval:true,impact,blockers,patches};
 }
 // Simulação sobre cópia. O plano é recalculado e comparado antes de aplicar.
 function simulateRename(db,plan){
  if(!map(plan)||plan.status!=='review')throw Error('Plano não elegível.');
  const current=planRename(db,plan.oldName,plan.newName);
  if(current.status!=='review'||JSON.stringify(current)!==JSON.stringify(plan))throw Error('Plano alterado ou desatualizado; voltar a analisar.');
  const after=clone(db);
  for(const p of current.patches){let parent=after;for(const key of p.path.slice(0,-1)){if(!own(parent,key))throw Error('Referência inválida');parent=parent[key];}const key=p.path.at(-1);if(!own(parent,key)||parent[key]!==p.before)throw Error('Referência alterada');parent[key]=p.after;}
  return {mode:'simulation_only',snapshot:after,reversePatches:current.patches.slice().reverse().map(p=>({path:p.path,before:p.after,after:p.before}))};
 }
 return {planRename,simulateRename};
}
if(typeof module==='object'&&module.exports)module.exports=createRenamePlanner();
else globalThis.ArtEssenciaRenamePlanner=createRenamePlanner();
