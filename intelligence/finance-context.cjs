'use strict';
// Reviewed financial functions from the Backoffice. A parity test verifies each function body against index.html.
module.exports=function financeContext(data){
 const db={settings:data.settings,stock:data.stock,productRecipes:data.recipes};
 const recipeLinesForCodeV1805=code=>Array.isArray(db.productRecipes?.[code])?db.productRecipes[code]:[];
function stockByName(name){return db.stock.find(x=>x.name===name)}
function materialUnitCost(name){const x=stockByName(name);return x?Number(x.unitCost)||0:0}
function toppingUnitCost(code){
  const lines=recipeLinesForCodeV1805(code);
  return lines.reduce((sum,l)=>sum+(Number(l.qty)||0)*materialUnitCost(l.item),0)
}
function productNullableNumberV110(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function productLaborMinutesV110(p){const n=productNullableNumberV110(p?.laborMinutes);return Math.max(0,n===null?0:n)}
function pricingFixedCostsTotalV1744(){return (db.settings.pricingFixedCosts||[]).reduce((sum,x)=>sum+Math.max(0,Number(x?.value)||0),0)}
function pricingProductiveHoursMonthV1744(){return Math.max(1,Number(db.settings.pricingProductiveHoursMonthly)||80)}
function pricingLaborHourlyRateV1745(){const mode=db.settings.pricingLaborMode==='salary'?'salary':'hourly';if(mode==='salary')return Math.max(0,Number(db.settings.pricingSalaryMonthly)||0)/pricingProductiveHoursMonthV1744();const own=productNullableNumberV110(db.settings.pricingHourlyRate);return Math.max(0,own===null?(Number(db.settings.laborRate)||0):own)}
function pricingFixedHourlyRateV1745(){return pricingFixedCostsTotalV1744()/pricingProductiveHoursMonthV1744()}
function pricingProductMarginPctV1745(p){const own=productNullableNumberV110(p?.marginPct??p?.profitPct);return Math.max(0,Math.min(95,own===null?(Number(db.settings.pricingDefaultMarginPct)||0):own))}
function pricingMaterialCostV1744(p){return toppingUnitCost(p?.code)}
function pricingGlobalWastePctV1802(){return Math.max(0,Math.min(100,Number(db.settings.pricingGlobalWastePctV1802??0)||0))}
function pricingElectricityHourlyV1802(){return Math.max(0,Number(db.settings.pricingElectricityHourlyV1802)||0)}
function pricingSeasonalLaborPctV1802(){return Math.max(0,Number(db.settings.pricingSeasonalLaborPctV1802)||0)}
function pricingLaborCostV1745(p,minutes=productLaborMinutesV110(p)){return pricingLaborHourlyRateV1745()*Math.max(0,Number(minutes)||0)/60}
function pricingElectricityCostV1802(p,minutes=productLaborMinutesV110(p)){return pricingElectricityHourlyV1802()*Math.max(0,Number(minutes)||0)/60}
function pricingFixedCostV1745(p,minutes=productLaborMinutesV110(p)){return pricingFixedHourlyRateV1745()*Math.max(0,Number(minutes)||0)/60}
function pricingOtherCostV1745(p){return Math.max(0,Number(p?.otherCost)||0)}
function normalizeProductAvailabilityV1244(p){
 // Backward compatible: every existing product remains regular unless explicitly marked edition-exclusive.
 return p?.availabilityType==='edition'||p?.editionExclusive===true?'edition':'regular'
}
function productCostBreakdownV110(product){const materials=pricingMaterialCostV1744(product),wasteRate=pricingGlobalWastePctV1802()/100,waste=materials*wasteRate,labor=pricingLaborCostV1745(product),seasonalLabor=normalizeProductAvailabilityV1244(product)==='edition'?labor*pricingSeasonalLaborPctV1802()/100:0,electricity=pricingElectricityCostV1802(product),fixed=pricingFixedCostV1745(product),other=pricingOtherCostV1745(product),total=materials+waste+labor+seasonalLabor+electricity+fixed+other;return {materials,labor,fixed,editionLabor:seasonalLabor,mold:0,packaging:0,indirect:fixed,manualIndirect:0,energy:electricity,equipmentWear:0,generalConsumables:0,other,subtotal:total,wasteRate,waste,total}}
 const finite=n=>n!==null && n!==undefined && n!=='' && Number.isFinite(Number(n)) && Number(n)>=0;
 if(!db.settings||!Array.isArray(db.stock)||!db.productRecipes)throw Error('Dados financeiros incompletos.');
 const products=data.products.map(p=>{
  const lines=recipeLinesForCodeV1805(p.code);
  const complete=lines.length>0 && lines.every(l=>{
   const matches=db.stock.filter(s=>s.name===l.item);
   return finite(l.qty)&&Number(l.qty)>0&&matches.length===1&&finite(matches[0].unitCost);
  });
  return {code:p.code,costComplete:complete,totalCost:complete?productCostBreakdownV110(p).total:null,netSalePrice:p.price,targetMarginPct:pricingProductMarginPctV1745(p)};
 });
 return {today:data.today,orders:data.orders,products,targetMarginPct:pricingProductMarginPctV1745({})};
};
