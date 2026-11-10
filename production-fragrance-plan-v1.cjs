'use strict';
// Planeador puro: nao altera dados, precos, encomendas ou stock.
function planProductionFragrance({orderId,lineId,recipe,selectedStockItem,actualQty,stock}){
 const fail=reason=>{throw new Error('FRAGRANCE_PLAN: '+reason)};
 if(!orderId||!lineId)fail('linha nao identificada');
 if(!Array.isArray(recipe))fail('receita invalida');
 const indexes=recipe.flatMap((r,i)=>/fragr[aâ]n|ess[eê]ncia arom[aá]tica/i.test(String(r.item||''))?[i]:[]);
 if(indexes.length!==1)fail('exige uma unica linha de fragrancia');
 const original=recipe[indexes[0]];
 const item=String(selectedStockItem||'').trim();
 const matches=(stock||[]).filter(s=>String(s.name||s.item).trim().toLowerCase()===item.toLowerCase());
 if(matches.length!==1)fail('artigo de stock inexistente ou ambiguo');
 const match=matches[0],unit=String(match.unit||'').toLowerCase();
 if(!unit||unit!==String(original.unit||'').toLowerCase())fail('unidade incompativel');
 const qty=Number(actualQty),available=Number(match.qty??match.quantity);
 if(!Number.isFinite(qty)||qty<=0)fail('quantidade invalida');
 if(!Number.isFinite(available)||qty>available)fail('stock insuficiente');
 const referenceQty=Number(original.qty),referenceUnitCost=Number(original.unitCost??0),actualUnitCost=Number(match.unitCost??0);
 if(![referenceQty,referenceUnitCost,actualUnitCost].every(v=>Number.isFinite(v)&&v>=0))fail('custo ou receita invalidos');
 const referenceCost=referenceQty*referenceUnitCost,actualCost=qty*actualUnitCost;
 return {orderId,lineId,cloudValidated:false,materials:recipe.map((r,i)=>i===indexes[0]?{...r,item,qty,unit}:({...r})),substitution:{referenceItem:original.item,referenceQty,actualItem:item,actualQty:qty,unit,referenceCost,actualCost,costDifference:actualCost-referenceCost}};
}
module.exports={planProductionFragrance};
