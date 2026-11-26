'use strict';
// Motor puro: não acede à Cloud, API, armazenamento ou DOM.
function auditInventory(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.stock) || !Array.isArray(snapshot.products) || !snapshot.productRecipes || typeof snapshot.productRecipes !== 'object' || Array.isArray(snapshot.productRecipes)) throw new TypeError('Snapshot operacional inválido ou incompleto');
  const str=v=>typeof v==='string'?v:'';
  const norm=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  const validNumber=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&(typeof v==='number'||typeof v==='string')&&Number.isFinite(Number(v))&&Number(v)>=0;
  const issues=[],exact=new Map(),normalized=new Map(),products=new Map();
  const add=(kind,details)=>issues.push({kind,...details});
  const insert=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
  const baseUnits=new Set(['g','ml','cm','un']);
  for(const [index,row] of snapshot.stock.entries()){
    const name=str(row?.name),unit=str(row?.unit);
    if(!name.trim()){add('material_sem_nome',{index});continue;}
    insert(exact,name,{index,name,unit});
    insert(normalized,norm(name),{index,name,unit});
    if(!baseUnits.has(unit))add('unidade_por_validar',{index,name,unit});
    if(!validNumber(row.qty))add('quantidade_por_validar',{index,name});
    if(!validNumber(row.unitCost)||Number(row.unitCost)===0)add('custo_por_validar',{index,name});
  }
  for(const [key,rows] of normalized)if(rows.length>1)add('possivel_duplicado',{key,materials:rows,requiresApproval:true});
  for(const p of snapshot.products){const code=str(p?.code);if(code)insert(products,code,p);}
  for(const [code,rows] of products)if(rows.length>1)add('codigo_produto_duplicado',{code,count:rows.length});
  let recipeLines=0,resolved=0;
  for(const [code,rows] of Object.entries(snapshot.productRecipes)){
    if(!products.has(code))add('ficha_sem_produto',{code});
    if(!Array.isArray(rows)){add('ficha_invalida',{code});continue;}
    if(!rows.length)add('ficha_vazia_por_rever',{code});
    for(const [line,row] of rows.entries()){
      recipeLines++;
      const name=str(row?.item),matches=exact.get(name)||[];
      if(!validNumber(row?.qty)||Number(row?.qty)===0)add('quantidade_ficha_por_validar',{code,line,name});
      if(matches.length===1){
        resolved++;
        if(row.unit&&row.unit!==matches[0].unit)add('unidade_ficha_incompativel',{code,line,name,recipeUnit:row.unit,stockUnit:matches[0].unit});
      }else if(matches.length>1)add('referencia_ambigua',{code,line,name,candidates:matches,requiresApproval:true});
      else{
        const candidates=normalized.get(norm(name))||[];
        add('referencia_nao_encontrada',{code,line,name,candidates,requiresApproval:true});
      }
    }
  }
  for(const [code] of products)if(!Object.prototype.hasOwnProperty.call(snapshot.productRecipes,code))add('ficha_instalada_ausente_por_rever',{code});
  return {version:1,mode:'read-only',stockCount:snapshot.stock.length,productCount:snapshot.products.length,recipeLines,resolved,issues};
}
if(typeof module==='object'&&module.exports)module.exports={auditInventory};
else globalThis.ArtEssenciaInventoryAudit={auditInventory};
