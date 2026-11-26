/* Budget policy: pure simulation. Not an atomic ledger or an API gateway. */
function createBudgetPolicy(){
 'use strict';
 const ceiling=30000000,stop=23000000; // integer micro-euros, gross conservative envelope
 const channels=['director','financeiro','producao','stock','marketing','comercial','inovacao','auditoria','catalogo','legacy_insights','legacy_description','legacy_social'];
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 const month=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 const key=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(k);
 const copy=x=>JSON.parse(JSON.stringify(x));
 function blank(){return {version:1,blocked:false,entries:[]}}
 function validate(s){
  if(s?.version!==1||typeof s.blocked!=='boolean'||!Array.isArray(s.entries)||s.entries.some(e=>!key(e.id)||!month(e.month)||!channels.includes(e.channel)||!integer(e.maximum)||e.maximum===0||!['reserved','unknown','settled','void'].includes(e.status)||e.status==='settled'&&!integer(e.actual))||new Set(s.entries.map(e=>e.id)).size!==s.entries.length)throw Error('Registo de orçamento inválido.');
 }
 function usage(s,m){
  validate(s);if(!month(m))throw Error('Mês inválido.');
  let committed=0,reserved=0;
  for(const e of s.entries){
   if(e.month>m)throw Error('Período inconsistente.');
   if(e.status==='settled'&&e.month===m)committed+=e.actual;
   if(['reserved','unknown'].includes(e.status))reserved+=e.maximum;
  }
  if(!integer(committed)||!integer(reserved)||!integer(committed+reserved))throw Error('Total inválido.');
  return {committed,reserved,used:committed+reserved,remaining:Math.max(0,stop-committed-reserved),ceiling,stop};
 }
 // Pricing supplied exclusively by a verified server-side allowlist; no provider rates hardcoded.
 // Unit prices are rounded-up EUR micro-units per million tokens, before tax; FX is already included.
 function estimate(p){
  if(!p||p.verified!==true||p.current!==true||p.toolsEnabled!==false||!key(p.model)||!integer(p.maxInputTokens)||!integer(p.maxOutputTokens)||p.maxInputTokens===0||p.maxOutputTokens===0||!integer(p.inputRate)||!integer(p.outputRate)||p.outputRate===0||!integer(p.grossBps)||p.grossBps<10000||p.grossBps>30000)throw Error('Preço ou limites não verificados.');
  const cost=(BigInt(p.maxInputTokens)*BigInt(p.inputRate)+BigInt(p.maxOutputTokens)*BigInt(p.outputRate))*BigInt(p.grossBps);
  const gross=(cost+9999999999n)/10000000000n; // tokens / million, multiplier / 10000, round up
  if(gross>BigInt(stop)||gross===0n)throw Error('Custo máximo inválido.');
  return Number(gross);
 }
 function reserve(s,r){
  validate(s);if(s.blocked||r?.releaseEnabled!==true||r.authorized!==true||!key(r.id)||!channels.includes(r.channel)||!month(r.month))throw Error('Consumo bloqueado.');
  const maximum=estimate(r.pricing),u=usage(s,r.month);
  if(s.entries.some(e=>e.id===r.id))throw Error('Pedido repetido.');
  if(maximum>u.remaining)throw Error('Limite preventivo atingido.');
  return {...copy(s),entries:[...copy(s.entries),{id:r.id,month:r.month,channel:r.channel,maximum,status:'reserved',model:r.pricing.model}]};
 }
 function markUnknown(s,id){
  validate(s);const e=s.entries.find(x=>x.id===id);if(e?.status!=='reserved')throw Error('Reserva indisponível.');
  return {...copy(s),entries:s.entries.map(x=>x.id===id?{...x,status:'unknown'}:{...x})};
 }
 function reconcile(s,r){
  validate(s);const e=s.entries.find(x=>x.id===r?.id);
  if(!e||!['reserved','unknown'].includes(e.status)||r.trustedEvidence!==true)throw Error('Confirmação não verificada.');
  if(r.noChargeConfirmed===true&&r.actual===0)return {...copy(s),entries:s.entries.map(x=>x.id===e.id?{...x,status:'void',actual:0}:{...x})};
  if(!integer(r.actual))throw Error('Custo inválido.');
  return {...copy(s),blocked:s.blocked||r.actual>e.maximum,entries:s.entries.map(x=>x.id===e.id?{...x,status:'settled',actual:r.actual}:{...x})};
 }
 return {ceiling,stop,channels:[...channels],blank,usage,estimate,reserve,markUnknown,reconcile};
}
module.exports=createBudgetPolicy();
