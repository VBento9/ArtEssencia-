/* ArtEssencia Intelligence — organização e consolidação em memória, sem escrita. */
function createStockOrganizer(){
 'use strict';
 const norm=v=>typeof v==='string'?v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' '):'';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 const clone=o=>JSON.parse(JSON.stringify(o));
 const n=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0;
 const safeName=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=200&&!/[\u0000-\u001f\u007f]/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
 const categories=[
 ['Ceras',/\b(cera|parafina)\b/],['Fragrâncias',/\b(fragrancia|essencia aromatica|oleo aromatico)\b/],['Pavios',/\b(pavio|pavios)\b/],['Recipientes',/\b(lata|latas|copo|copos|frasco|frascos)\b/],['Pigmentos & Corantes',/\b(pigmento|pigmentos|corante|corantes)\b/],['Jesmonite / Resina orgânica',/\b(jesmonite|resina organica|resina eco)\b/],['Resina epóxi',/\b(resina epoxi|epoxy)\b/],['Selantes & Acabamentos',/\b(selante|verniz)\b/],['Base de Sabonete',/\b(base de sabonete|glicerina)\b/],['Embalagens',/\b(embalagem|embalagens|caixa|caixas|saco|sacos)\b/],['Personalização & Decoração',/\b(etiqueta|etiquetas|fita|fitas)\b/],['Consumíveis',/\b(luva|luvas|alcool isopropilico)\b/]];
 function classify(stock){
  if(!Array.isArray(stock))throw Error('Stock inválido');
  return stock.map((s,index)=>{const name=typeof s?.name==='string'?s.name:'',matches=categories.filter(x=>x[1].test(norm(name))).map(x=>x[0]);return {index,name,currentCategory:typeof s?.category==='string'?s.category:null,suggestedCategory:matches.length===1?matches[0]:null,candidates:matches,status:matches.length===1?'review':'unclassified',requiresApproval:true};});
 }
 function requireSnapshot(db){
  if(!obj(db)||!['stock','products','purchases','stockMoves','productionRuns','orders'].every(k=>Array.isArray(db[k])&&db[k].every(obj))||!obj(db.productRecipes)||!Object.values(db.productRecipes).every(rs=>Array.isArray(rs)&&rs.every(obj))||!obj(db.costMeta))throw Error('Snapshot incompleto ou inválido.');
 }
 function duplicates(stock){
  if(!Array.isArray(stock))throw Error('Stock inválido');
  const groups=new Map();for(const [index,s] of stock.entries()){const key=norm(s?.name);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({index,name:s.name,unit:s.unit,qty:s.qty,unitCost:s.unitCost});}
  return [...groups.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows,status:'identity_and_balance_review',requiresApproval:true}));
 }
 function comparable(s){return JSON.stringify(Object.keys(s).filter(k=>!['name','qty','unitCost'].includes(k)).sort().map(k=>[k,s[k]]));}
 function planMerge(db,request){
  requireSnapshot(db);
  const {sourceName,targetName,identityConfirmed,balanceMode}=request||{};
  if(!safeName(sourceName)||!safeName(targetName)||sourceName===targetName)throw Error('Indica dois nomes distintos e válidos.');
  const a=db.stock.map((s,i)=>({s,i})).filter(x=>x.s.name===sourceName),b=db.stock.map((s,i)=>({s,i})).filter(x=>x.s.name===targetName),names=new Set([sourceName,targetName]),blockers=[];
  if(identityConfirmed!==true)blockers.push('identidade_nao_confirmada');
  if(balanceMode!=='distinct_physical_balances')blockers.push('origem_dos_saldos_nao_confirmada');
  if(a.length!==1||b.length!==1)blockers.push('referencia_stock_ambigua');
  if(db.stock.some(s=>!names.has(s.name)&&[norm(sourceName),norm(targetName)].includes(norm(s.name))))blockers.push('terceiro_duplicado_candidato');
  const x=a[0]?.s,y=b[0]?.s;
  if(x&&y){
   if(x.unit!==y.unit||!['g','ml','cm','un'].includes(x.unit))blockers.push('unidades_incompativeis');
   if(!n(x.qty)||!n(y.qty)||!Number.isFinite(Number(x.qty)+Number(y.qty))||x.unit==='un'&&(!Number.isSafeInteger(Number(x.qty))||!Number.isSafeInteger(Number(y.qty))||!Number.isSafeInteger(Number(x.qty)+Number(y.qty))))blockers.push('saldos_invalidos');
   if(!n(x.unitCost)||!n(y.unitCost)||Number(x.unitCost)!==Number(y.unitCost)||!Number.isFinite((Number(x.qty)+Number(y.qty))*Number(y.unitCost)))blockers.push('custos_diferentes_ou_invalidos');
   if(comparable(x)!==comparable(y)||own(x,'id')||own(y,'id'))blockers.push('metadados_distintos_ou_identificadores');
  }
  const refs=[];for(const [code,rows] of Object.entries(db.productRecipes)){const relevant=rows.filter(r=>names.has(r.item));if(relevant.some(r=>!n(r.qty)||Number(r.qty)<=0||r.unit&&x&&r.unit!==x.unit))blockers.push('quantidade_ou_unidade_ficha_invalida');if(relevant.length>1)blockers.push('varias_linhas_na_mesma_ficha');rows.forEach((r,index)=>{if(r.item===sourceName)refs.push({code,index});});}
  const purchases=db.purchases.filter(r=>names.has(r.item)).length,moves=db.stockMoves.filter(r=>names.has(r.item)).length,orders=db.orders.filter(r=>names.has(String(r.box??'').trim())).length;
  const runs=db.productionRuns.filter(r=>[r.materials,r.materialUnitCosts,...(obj(r.orderMaterials)?Object.values(r.orderMaterials):[])].some(v=>obj(v)&&[...names].some(name=>own(v,name)))).length;
  if(purchases||moves||orders||runs)blockers.push('historico_exige_reconciliacao');
  if([...names].some(name=>own(db.costMeta,name)))blockers.push('metadados_custo_exigem_reconciliacao');
  if(db.products.some(p=>Array.isArray(p.recipe)&&p.recipe.some(r=>r?.materialId!=null||names.has(r?.item)||names.has(r?.name)))||Array.isArray(db.materials)&&db.materials.some(m=>[norm(sourceName),norm(targetName)].includes(norm(m?.name))))blockers.push('legado_exige_validacao');
  const impact={recipeLines:refs.length,productsAffected:new Set(refs.map(r=>r.code)).size,purchases,moves,orders,runs};
  if(blockers.length)return {status:'blocked',request:{sourceName,targetName,identityConfirmed,balanceMode},requiresApproval:true,blockers:[...new Set(blockers)],impact};
  const quantity=Number(x.qty)+Number(y.qty),cost=Number(y.unitCost);
  return {status:'review',request:{sourceName,targetName,identityConfirmed,balanceMode},requiresApproval:true,blockers:[],impact,sourceIndex:a[0].i,targetIndex:b[0].i,sourceBefore:clone(x),targetBefore:clone(y),recipeRefs:refs,quantity,unit:y.unit,unitCost:cost,inventoryValue:quantity*cost};
 }
 function simulateMerge(db,plan){
  if(plan?.status!=='review')throw Error('Plano bloqueado.');
  const current=planMerge(db,plan.request);
  if(current.status!=='review'||JSON.stringify(current)!==JSON.stringify(plan))throw Error('Plano desatualizado ou alterado.');
  const out=clone(db);
  out.stock[current.targetIndex].qty=current.quantity;
  for(const r of current.recipeRefs)out.productRecipes[r.code][r.index].item=current.request.targetName;
  out.stock.splice(current.sourceIndex,1);
  return {mode:'simulation_only',snapshot:out,rollbackSnapshot:clone(db)};
 }
 function planBatch(db,requests){
  requireSnapshot(db);
  if(!Array.isArray(requests)||!requests.length||requests.length>50)throw Error('O lote deve ter entre 1 e 50 propostas.');
  const seen=new Set();let working=clone(db);const plans=[];
  for(const request of requests){
   const names=[request?.sourceName,request?.targetName].map(norm);
   if(names.some(k=>seen.has(k)))return {status:'blocked',reason:'lote_com_operacoes_sobrepostas',plans};
   names.forEach(k=>seen.add(k));
   const plan=planMerge(working,request);plans.push(plan);
   if(plan.status!=='review')return {status:'blocked',reason:'lote_contem_plano_bloqueado',plans};
   working=simulateMerge(working,plan).snapshot;
  }
  return {status:'review',mode:'simulation_only',requiresApproval:true,plans,snapshot:working,rollbackSnapshot:clone(db)};
 }
 return {classify,duplicates,planMerge,simulateMerge,planBatch};
}
if(typeof module==='object'&&module.exports)module.exports=createStockOrganizer();
else globalThis.ArtEssenciaStockOrganizer=createStockOrganizer();
