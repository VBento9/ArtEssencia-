export const families={
 candle:{label:'Velas',icon:'🕯️',prefix:'VEL',subtypes:['Recipiente','Molde','Tealight','Escultural'],stages:['Preparar','Produzir','Cura','Acabamento','Pronto']},
 wax:{label:'Wax Melts',icon:'🧊',prefix:'WAX',subtypes:['Tablete','Figuras','Pot'],stages:['Preparar','Produzir','Arrefecer','Desmoldar','Pronto']},
 jesmonite:{label:'Jesmonite',icon:'🏺',prefix:'JES',subtypes:['Bandeja','Vaso','Porta-velas','Figura','Base','Outro'],stages:['Preparar','Verter','Desmoldar','Acabamento','Pronto']},
 soap:{label:'Sabonetes',icon:'🧼',prefix:'SAB',subtypes:['Retangular','Oval','Figura','Conjunto'],stages:['Preparar','Produzir','Arrefecer','Desmoldar','Pronto']},
 magnet:{label:'Ímanes & Lembranças',icon:'🧲',prefix:'IMA',subtypes:['Íman','Lembrança','Marcador','Tag'],stages:['Preparar','Produzir','Personalizar','Acabamento','Pronto']},
 custom:{label:'Personalizados',icon:'✨',prefix:'PER',subtypes:['Laser','Etiqueta','Peça personalizada','Conjunto'],stages:['Preparar','Produzir','Personalizar','Verificar','Pronto']},
 kit:{label:'Kits & Presentes',icon:'🎁',prefix:'KIT',subtypes:['Kit presente','Cabaz','Lembrança evento','Conjunto'],stages:['Separar','Montar','Personalizar','Embalar','Pronto']},
 other:{label:'Outros',icon:'🧵',prefix:'ART',subtypes:['Outro'],stages:['Preparar','Produzir','Acabamento','Verificar','Pronto']}
};
export const materialCategories=['Ceras','Fragrâncias','Pavios','Recipientes','Pigmentos & Corantes','Jesmonite','Selantes & Acabamentos','Base de Sabonete','Embalagens','Personalização & Decoração','Consumíveis','Outros'];
export const orderStatuses=['Orçamento','Aguardando confirmação','Confirmada','Em produção','Pronta','Entregue','Cancelada'];
export const paymentMethods=['Dinheiro','MB Way','Transferência','Multibanco','Outro'];
export const deliveryMethods=['Levantamento','Entrega local','Envio'];
export const euro=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n||0));
export const uid=(p='id')=>`${p}_${crypto.randomUUID?.()||Date.now()+Math.random().toString(16).slice(2)}`;
export function nextSku(products,family){
  const f=families[family]||families.other;
  const nums=products.map(p=>String(p.sku||'').match(new RegExp(`^${f.prefix}-(\\d+)$`,'i'))).filter(Boolean).map(m=>Number(m[1]));
  return `${f.prefix}-${String(Math.max(0,...nums)+1).padStart(3,'0')}`;
}
export function calcProduct(product,materials,kitItems=[],products=[]){
  const mm=Object.fromEntries(materials.map(m=>[m.id,m]));
  const recipe=product.recipe||[];
  const batchUnits=Math.max(1,Number(product.batchUnits||1));
  const recipeBatch=recipe.reduce((s,r)=>s+Number(r.qty||0)*Number(mm[r.materialId]?.unitCost||0),0);
  const materialUnit=recipeBatch/batchUnits;
  const labor=(Number(product.laborMinutes||0)/60)*Number(product.laborRate||5.8)/batchUnits;
  const mold=Number(product.moldCost||0)>0&&Number(product.moldLife||0)>0?Number(product.moldCost)/Number(product.moldLife):0;
  const energy=(Number(product.equipmentMinutes||0)/60)*Number(product.equipmentRate||0)/batchUnits;
  let kitCost=0;
  if(product.family==='kit'){
    const children=kitItems.filter(k=>k.kitProductId===product.id);
    for(const c of children){
      const child=products.find(p=>p.id===c.productId);
      if(child)kitCost+=Number(c.qty||1)*Number(child.lastTrueCost||child.lastProductionCost||0);
    }
  }
  const base=materialUnit+labor+mold+energy+Number(product.packagingCost||0)+kitCost;
  const extras=base*(Number(product.extrasPct??5)/100);
  const waste=(base+extras)*(Number(product.wastePct??10)/100);
  const production=base+extras+waste;
  const practiced=Number(product.price||0);
  const feePct=Number(product.paymentFeePct||0)/100;
  const fee=practiced*feePct;
  const trueCost=production+fee;
  const profit=practiced-trueCost;
  const margin=practiced>0?profit/practiced*100:0;
  const target=Number(product.targetMarginPct??60)/100;
  const recommended=(1-feePct-target)>0?production/(1-feePct-target):0;
  const wholesale=Number(product.wholesalePrice||0);
  const wholesaleFee=wholesale*feePct;
  const wholesaleMargin=wholesale>0?(wholesale-production-wholesaleFee)/wholesale*100:0;
  return {materialUnit,labor,mold,energy,kitCost,extras,waste,production,fee,trueCost,profit,margin,recommended,wholesaleMargin};
}
export function stockNeed(product,qty){
  const batchUnits=Math.max(1,Number(product.batchUnits||1));
  return (product.recipe||[]).map(r=>({materialId:r.materialId,qty:Number(r.qty||0)/batchUnits*Number(qty||1)}));
}
export function dateISO(){return new Date().toISOString().slice(0,10)}
