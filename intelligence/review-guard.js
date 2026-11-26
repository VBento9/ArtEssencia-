/* Guardas de leitura e projeção mínima. */
function createReviewGuard(){
 const allowed=s=>!!s&&s.unlocked===true&&s.authHidden===true&&s.lockHidden===true&&s.online===true&&s.cloudReady===true&&s.verified===true&&s.dirty===false&&s.conflict===false&&s.busy===false&&s.owner===true;
 function snapshot(data){
  if(!data||!Array.isArray(data.stock)||!Array.isArray(data.products)||!data.productRecipes||typeof data.productRecipes!=='object'||Array.isArray(data.productRecipes))throw Error('Inventário indisponível.');
  return JSON.parse(JSON.stringify({stock:data.stock.map(s=>({name:s?.name,unit:s?.unit,qty:s?.qty,unitCost:s?.unitCost,category:s?.category})),products:data.products.map(p=>({code:p?.code})),productRecipes:Object.fromEntries(Object.entries(data.productRecipes).map(([code,rows])=>[code,Array.isArray(rows)?rows.map(row=>({item:row?.item,qty:row?.qty,unit:row?.unit})):null]))}));
 }
 return {allowed,snapshot};
}
if(typeof module==='object'&&module.exports)module.exports=createReviewGuard();else globalThis.ArtEssenciaReviewGuard=createReviewGuard();
