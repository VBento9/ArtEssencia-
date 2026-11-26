/* Free deterministic operational planning — no external effects. */
function createOperationalAgents(){
 'use strict';
 const validText=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
 const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12;
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const units=['g','ml','cm','un'];
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
 const unique=(rows,key)=>{if(!Array.isArray(rows)||rows.some(r=>!validText(r?.[key]))||new Set(rows.map(r=>r[key])).size!==rows.length)throw Error('Identificadores ausentes ou duplicados.');};
 const task=(agent,kind,id,title,priority,dueDate=null,details={})=>({key:JSON.stringify([agent,kind,id]),agent,kind,title,priority,dueDate,details,requiresApproval:true});
 function production(input){
  const {orders,stock,today}=input||{};if(!date(today)||!Array.isArray(stock)||!Array.isArray(orders))throw Error('Dados de produção incompletos.');unique(orders,'id');
  const materials=new Map(),tasks=[],blocked=[],planned=[];
  const active=orders.filter(o=>['Confirmada','Confirmado','Em produção','Produção'].includes(o.status)&&o.alreadyProduced===false);
  const unknown=orders.filter(o=>['Confirmada','Confirmado','Em produção','Produção'].includes(o.status)&&typeof o.alreadyProduced!=='boolean');
  for(const o of unknown){blocked.push(o.id);tasks.push(task('producao','review_order',o.id,'Validar histórico de produção — '+o.id,1));}
  const sortDate=o=>date(o.delivery)?o.delivery:'9999-12-31';
  active.sort((a,b)=>sortDate(a).localeCompare(sortDate(b))||a.id.localeCompare(b.id));
  for(const o of active){
   if(o.complete!==true||!Array.isArray(o.needs)||o.needs.some(r=>!validText(r?.name)||!num(r.qty)||r.qty===0||!units.includes(r.unit)||r.unit==='un'&&!Number.isInteger(r.qty))||!date(o.delivery)){
    blocked.push(o.id);tasks.push(task('producao','review_order',o.id,'Validar ficha técnica e prazo — '+o.id,1,date(o.delivery)?o.delivery:null));continue;
   }
   const combined=new Map();let bad=false;
   for(const r of o.needs){const prior=combined.get(r.name);if(prior&&prior.unit!==r.unit){bad=true;break;}const qty=(prior?.qty||0)+r.qty;if(!num(qty)){bad=true;break;}combined.set(r.name,{name:r.name,unit:r.unit,qty});}
   const matched=[];
   for(const r of combined.values()){
    const candidates=stock.filter(s=>typeof s?.name==='string'&&norm(s.name)===norm(r.name));
    const m=materials.get(r.name);
    if(candidates.length!==1||candidates[0].name!==r.name||candidates[0].unit!==r.unit||!num(candidates[0].qty)||r.unit==='un'&&!Number.isInteger(candidates[0].qty)||m&&m.unit!==r.unit||!num((m?.required||0)+r.qty)){bad=true;break;}
    matched.push({r,available:candidates[0].qty});
   }
   if(bad){blocked.push(o.id);tasks.push(task('producao','review_material',o.id,'Resolver referências de stock — '+o.id,1,o.delivery));continue;}
   planned.push(o.id);
   for(const {r,available} of matched){const old=materials.get(r.name)||{name:r.name,unit:r.unit,available,required:0,orders:[]};old.required+=r.qty;old.orders.push(o.id);materials.set(r.name,old);}
   tasks.push(task('producao','plan_order',o.id,'Planear produção — '+o.id,o.delivery<=today?1:3,o.delivery));
  }
  const requirements=[...materials.values()].map(m=>({...m,shortage:Math.max(0,m.required-m.available)}));
  for(const m of requirements)if(m.shortage>1e-8)tasks.push(task('producao','material_shortage',m.name,'Resolver falta de '+m.name,1,null,{knownShortage:m.shortage,unit:m.unit,orders:m.orders}));
  return {mode:'proposal_only',coverage:blocked.length?'partial':'complete',planned,blocked,requirements,tasks};
 }
 function finance(input){
  const {products,orders,today,targetMarginPct}=input||{};if(!date(today)||!num(targetMarginPct)||targetMarginPct>100)throw Error('Configuração financeira inválida.');unique(products,'code');unique(orders,'id');
  const tasks=[],margins=[],receivables=[];
  for(const p of products){
   // Only complete canonical costs are accepted, never material-only or historical approximations.
   if(p.costComplete!==true||!num(p.totalCost)||!num(p.netSalePrice)||p.netSalePrice<=0){
    tasks.push(task('financeiro','review_cost',p.code,'Validar custo e preço — '+p.code,2));continue;
   }
   const profit=p.netSalePrice-p.totalCost,marginPct=100*profit/p.netSalePrice;
   margins.push({code:p.code,netSalePrice:p.netSalePrice,totalCost:p.totalCost,profit,marginPct});
   if(marginPct<targetMarginPct)tasks.push(task('financeiro','review_margin',p.code,'Rever margem — '+p.code,profit<0?1:2,null,{marginPct,targetMarginPct}));
  }
  for(const o of orders){
   if(!['Confirmada','Confirmado','Em produção','Produção','Pronta','Entregue','Entregue parcialmente'].includes(o.status))continue;
   if(o.paymentComplete!==true||!num(o.total)||!num(o.paid)||o.total<=0){tasks.push(task('financeiro','review_payment',o.id,'Validar pagamento — '+o.id,2));continue;}
   const dueCents=Math.max(0,Math.round(o.total*100)-Math.round(o.paid*100));
   if(dueCents>0){receivables.push({id:o.id,dueCents});if(['Pronta','Entregue','Entregue parcialmente'].includes(o.status)||date(o.delivery)&&o.delivery<=today)tasks.push(task('financeiro','payment_followup',o.id,'Verificar pagamento pendente — '+o.id,2,date(o.delivery)?o.delivery:null,{dueCents}));}
  }
  return {mode:'proposal_only',margins,receivables,tasks};
 }
 function director(input){
  const {reports,existingTaskKeys,enabledAgents,today,limit=30}=input||{};
  if(!date(today)||!Array.isArray(reports)||!Array.isArray(existingTaskKeys)||!Array.isArray(enabledAgents)||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Contexto de planeamento inválido.');
  const existing=new Set(existingTaskKeys),enabled=new Set(enabledAgents),proposed=new Map();
  for(const report of reports){
   if(report?.mode!=='proposal_only'||!Array.isArray(report.tasks))throw Error('Relatório de agente inválido.');
   for(const t of report.tasks){
    if(!t||!validText(t.key)||!validText(t.title)||!['producao','financeiro','stock','auditoria','marketing','comercial','inovacao','catalogo'].includes(t.agent)||!Number.isInteger(t.priority)||t.priority<1||t.priority>3||t.requiresApproval!==true||t.dueDate!==null&&!date(t.dueDate))throw Error('Proposta inválida.');
    if(!enabled.has(t.agent)||existing.has(t.key))continue;
    const prior=proposed.get(t.key);
    if(prior&&JSON.stringify(prior)!==JSON.stringify(t))throw Error('Propostas incompatíveis para a mesma tarefa.');
    proposed.set(t.key,t);
   }
  }
  const ranked=[...proposed.values()].sort((a,b)=>a.priority-b.priority||(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')||a.key.localeCompare(b.key));
  return {mode:'proposal_only',today,tasks:ranked.slice(0,limit),deferred:Math.max(0,ranked.length-limit)};
 }
 return {production,finance,director};
}
if(typeof module==='object'&&module.exports)module.exports=createOperationalAgents();else globalThis.ArtEssenciaOperationalAgents=createOperationalAgents();
