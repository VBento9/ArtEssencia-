export const families={
  candle:{label:'Velas',icon:'🕯️',prefix:'VEL',stages:['Preparar','Produção','Cura','Acabamento','Pronto']},
  wax:{label:'Wax Melts',icon:'🧊',prefix:'WAX',stages:['Preparar','Produção','Arrefecer','Desmoldar','Pronto']},
  jesmonite:{label:'Jesmonite',icon:'🏺',prefix:'JES',stages:['Preparar','Verter','Desmoldar','Acabamento','Pronto']},
  soap:{label:'Sabonetes',icon:'🧼',prefix:'SAB',stages:['Preparar','Produção','Cura','Acabamento','Pronto']},
  magnet:{label:'Ímanes & Lembranças',icon:'🧲',prefix:'IMA',stages:['Preparar','Produção','Acabamento','Personalizar','Pronto']},
  custom:{label:'Personalizados',icon:'✨',prefix:'PER',stages:['Preparar','Produção','Personalizar','Acabamento','Pronto']},
  kit:{label:'Kits & Presentes',icon:'🎁',prefix:'KIT',stages:['Separar','Montar','Personalizar','Embalar','Pronto']},
  other:{label:'Outros',icon:'🧵',prefix:'ART',stages:['Preparar','Produção','Acabamento','Verificar','Pronto']}
};
export const materialCategories=['Ceras','Fragrâncias','Pavios','Recipientes','Pigmentos & Corantes','Jesmonite','Selantes & Acabamentos','Sabonetes','Embalagens','Personalização & Decoração','Outros'];
export const orderStatuses=['Orçamento','Confirmada','Em produção','Pronta','Entregue','Cancelada'];
export const euro=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n||0));
export const uid=(p='id')=>`${p}_${crypto.randomUUID?.()||Date.now()+Math.random().toString(16).slice(2)}`;
export function calcProduct(product,materials){
  const matMap=Object.fromEntries(materials.map(m=>[m.id,m]));
  const materialCost=(product.recipe||[]).reduce((sum,r)=>sum+(Number(r.qty||0)*Number(matMap[r.materialId]?.unitCost||0)),0);
  const units=Math.max(1,Number(product.batchUnits||1));
  const laborHours=Number(product.laborMinutes||0)/60;
  const laborPerUnit=(laborHours*Number(product.laborRate||5.8))/units;
  const moldPerUnit=Number(product.moldCost||0)>0&&Number(product.moldLife||0)>0?Number(product.moldCost)/Number(product.moldLife):0;
  const energyPerUnit=((Number(product.equipmentMinutes||0)/60)*Number(product.equipmentRate||0))/units;
  const base=(materialCost/units)+laborPerUnit+moldPerUnit+energyPerUnit+Number(product.packagingCost||0);
  const extras=base*(Number(product.extrasPct||5)/100);
  const waste=(base+extras)*(Number(product.wastePct||10)/100);
  const production=base+extras+waste;
  const feePct=Number(product.paymentFeePct||0)/100;
  const target=Number(product.targetMarginPct||60)/100;
  const practiced=Number(product.price||0);
  const fee=practiced*feePct;
  const trueCost=production+fee;
  const profit=practiced-trueCost;
  const margin=practiced>0?profit/practiced*100:0;
  const recommended=(1-feePct-target)>0?production/(1-feePct-target):0;
  return {materialCost:materialCost/units,laborPerUnit,moldPerUnit,energyPerUnit,extras,waste,production,fee,trueCost,profit,margin,recommended};
}
export function nextSku(products,family){const f=families[family]||families.other;const nums=products.map(p=>String(p.sku||'').match(new RegExp(`^${f.prefix}-(\\d+)$`,'i'))).filter(Boolean).map(m=>Number(m[1]));return `${f.prefix}-${String((Math.max(0,...nums)+1)).padStart(3,'0')}`;}
