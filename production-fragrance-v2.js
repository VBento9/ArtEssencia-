/* Actual consumption is a production-run fact; recipes and customer choices are immutable here. */
(function(root){
'use strict';
const isFragrance=(name,allowed=[])=>allowed.includes(name)||/fragr[aâ]n|ess[eê]ncia arom[aá]tica/i.test(name);
function applySelections(needs,selections,stock,allowed){
 const result={...needs};
 for(const s of selections){
  const ref=stock.filter(x=>x.name===s.referenceItem),actual=stock.filter(x=>x.name===s.actualItem);
  if(!allowed.includes(s.referenceItem)||!allowed.includes(s.actualItem))throw Error('Identifica primeiro os artigos como fragrâncias.');
  if(ref.length!==1||actual.length!==1)throw Error('Artigo de Stock inexistente ou ambíguo.');
  if(!['g','ml'].includes(s.unit)||ref[0].unit!==s.unit||actual[0].unit!==s.unit)throw Error('Unidades incompatíveis.');
  if(!Number.isFinite(s.actualQty)||s.actualQty<=0||!Number.isFinite(s.referenceQty)||s.referenceQty<=0)throw Error('Quantidade inválida.');
  if(![s.referenceUnitCost,actual[0].unitCost].every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0))throw Error('Preenche o custo unitário dos artigos de fragrância no Stock.');
  result[s.referenceItem]=(result[s.referenceItem]||0)-s.referenceQty;
  result[s.actualItem]=(result[s.actualItem]||0)+s.actualQty;
 }
 for(const [name,qty] of Object.entries(result)){
  if(Math.abs(qty)<1e-8){delete result[name];continue}
  const matches=stock.filter(x=>x.name===name);
  if(qty<0||matches.length!==1||!Number.isFinite(Number(matches[0].qty))||Number(matches[0].qty)+1e-9<qty)throw Error('Stock insuficiente ou ambíguo: '+name);
 }
 return result;
}
const api={isFragrance,applySelections};
if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
root.aeProductionFragranceV2=api;
function dialog(title){const d=document.createElement('dialog');d.className='ae-fragrance-production';d.setAttribute('aria-label',title);d.addEventListener('close',()=>d.remove(),{once:true});const h=document.createElement('h2');h.textContent=title;d.append(h);document.body.append(d);return d}
function button(text,fn){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=fn;return b}
function label(text,input){const l=document.createElement('label');l.textContent=text;l.append(input);return l}
api.configure=()=>{
 if(productionBlockedV1926())return toast('Termina primeiro a operação pendente.');
 const d=dialog('Artigos de Stock que são fragrâncias'),intro=document.createElement('p');intro.textContent='Marca apenas fragrâncias, incluindo o artigo usado como referência nas receitas. A Biblioteca Técnica mantém-se independente.';d.append(intro);
 const allowed=db.settings.productionFragranceStockV2||[],checks=[];
 for(const s of db.stock.filter(x=>['g','ml'].includes(x.unit))){const c=document.createElement('input');c.type='checkbox';c.checked=allowed.includes(s.name);checks.push([s.name,c]);d.append(label(s.name+' ('+s.unit+')',c))}
 d.append(button('Guardar identificação',()=>{db.settings.productionFragranceStockV2=checks.filter(x=>x[1].checked).map(x=>x[0]);const saved=save();d.close();d.remove();if(saved!==false)toast('Identificação guardada. Aguarda a sincronização antes de produzir.')}),button('Cancelar',()=>{d.close();d.remove()}));d.showModal();
};
api.choose=async orders=>{
 if(document.querySelector('.ae-fragrance-production'))return null;
 const allowed=db.settings.productionFragranceStockV2||[],rows=[];
 for(const o of orders)for(const [lineIndex,line] of (o.items||[]).entries()){
  if(productionLineIgnoredV148(line))continue;
  const p=productionProductForLineV130(line);if(!p||!productManufacturedV130(p))continue;
  const recipe=productionRecipeForOrderLineV1757(o,line,lineIndex),frozen=orderSnapshotLineV1757(o,line,lineIndex);
  recipe.forEach((r,recipeIndex)=>{if(!isFragrance(r.item,allowed))return;const ref=stockByName(r.item),original=frozen?.materialsCaptured?frozen.materials[recipeIndex]:r,pricingRows=(line.quantityPricingSnapshot?.materials||[]).filter(x=>x.item===r.item),pricing=pricingRows.length===1?pricingRows[0]:null;
   rows.push({o,line,orderId:o.id,lineIndex,recipeIndex,referenceItem:r.item,referenceQty:Number(r.qty)*Number(line.qty),unit:ref?.unit,referenceUnitCost:original?.unitCost??pricing?.unitCost??ref?.unitCost,costBasis:original?.unitCost!=null||pricing?.unitCost!=null?'Receita guardada':'Referência atual (custo histórico indisponível)'})});
 }
 if(!rows.length)return [];
 return new Promise(resolve=>{
  const d=dialog('Confirmar fragrâncias utilizadas'),intro=document.createElement('p');intro.textContent='Seleciona o artigo realmente utilizado e a quantidade total por linha. O preço cobrado mantém-se.';d.append(intro);
  const selections=[];
  rows.forEach(r=>{
   const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=r.orderId+' · '+(r.line.name||r.line.code)+' · '+r.line.qty+' un.';box.append(legend);
   const pref=document.createElement('p');const personal=r.line.personalization||r.line.personalizationV1773||{};
   pref.textContent='Pedido do cliente: '+(personal.fragrance||r.line.fragrance||personal.scent||'Sem fragrância indicada')+(r.o.notes?' · Notas: '+r.o.notes:'');box.append(pref);
   const select=document.createElement('select');select.add(new Option('Selecionar artigo utilizado',''));db.stock.filter(s=>allowed.includes(s.name)&&s.unit===r.unit).forEach(s=>select.add(new Option(s.name,s.name)));
   const qty=document.createElement('input');qty.type='number';qty.min='0.000001';qty.step='any';qty.value=r.referenceQty;
   const info=document.createElement('output');const update=()=>{const st=stockByName(select.value),cost=Number(qty.value)*Number(st?.unitCost),expected=r.referenceQty*Number(r.referenceUnitCost);info.textContent='Disponível: '+(st?.qty??'—')+' '+(r.unit||'')+' · Previsto: '+(Number.isFinite(expected)?euro(expected):'—')+' · Real: '+(Number.isFinite(cost)?euro(cost):'—')+' · Impacto na margem: '+(Number.isFinite(cost)?euro(expected-cost):'—')+' · '+r.costBasis};select.onchange=qty.oninput=update;update();
   box.append(label('Artigo utilizado',select),label('Quantidade total ('+(r.unit||'unidade em falta')+')',qty),info);d.append(box);selections.push({r,select,qty});
  });
  const error=document.createElement('p');error.setAttribute('role','alert');d.append(error);
  const finish=value=>{d.close();d.remove();resolve(value)};
  d.addEventListener('cancel',e=>{e.preventDefault();finish(null)});
  d.append(button('Confirmar consumo e concluir',()=>{try{
   const values=selections.map(({r,select,qty})=>({orderId:r.orderId,lineIndex:r.lineIndex,recipeIndex:r.recipeIndex,referenceItem:r.referenceItem,referenceQty:r.referenceQty,referenceUnitCost:r.referenceUnitCost,actualItem:select.value,actualQty:Number(qty.value),unit:r.unit}));
   const needs={};orders.forEach(o=>Object.entries(productionOrderNeedsV12632(o)).forEach(([n,q])=>needs[n]=(needs[n]||0)+q));applySelections(needs,values,db.stock,allowed);finish(values);
  }catch(e){error.textContent=e.message}}),button('Cancelar',()=>finish(null)));d.showModal();
 });
};
api.history=run=>(run.fragranceActualsV2||[]).map(x=>'<p>'+escapeHtml(x.orderId)+' · linha '+(x.lineIndex+1)+': '+escapeHtml(x.actualItem)+' · '+x.actualQty+' '+escapeHtml(x.unit)+' · previsto '+euro(x.referenceCost)+' / real '+euro(x.actualCost)+' · diferença '+euro(x.costDifference)+' · margem '+euro(x.marginImpact)+(x.referenceCostBasis==='current_reference_stock'?' · referência atual, sem custo histórico':' · custo de referência guardado')+'</p>').join('');
})(typeof window!=='undefined'?window:globalThis);
