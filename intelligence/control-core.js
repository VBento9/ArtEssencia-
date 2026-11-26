/* ArtEssencia Intelligence — núcleo isolado, sem efeitos externos. */
function createIntelligenceCore() {
  'use strict';
  const agents=['director','financeiro','producao','stock','marketing','comercial','inovacao','auditoria','catalogo'];
  const modes=['off','manual','auto','semi'];
  const capabilities={stock:['inventory_count_plan','inventory_audit','stock_rename_plan','stock_organization_plan','stock_merge_batch_plan'],auditoria:['inventory_audit'],producao:['inventory_audit']};
  const defaults=()=>({enabled:false,agents:Object.fromEntries(agents.map(a=>[a,'off'])),paidEnabled:false,monthlyCeilingCents:1000});
  function config(input){
    if(!input||typeof input.enabled!=='boolean'||input.paidEnabled!==false||input.monthlyCeilingCents!==1000||!input.agents||!agents.every(a=>modes.includes(input.agents[a])))throw Error('Configuração inválida: execução bloqueada.');
    return {enabled:input.enabled,agents:Object.fromEntries(agents.map(a=>[a,input.agents[a]])),paidEnabled:false,monthlyCeilingCents:1000};
  }
  function permit(settings,agent,kind,trigger='manual'){
    let c;try{c=config(settings)}catch{return {ok:false,reason:'configuracao_invalida'};}
    if(!c.enabled||!agents.includes(agent)||c.agents[agent]==='off')return {ok:false,reason:'agente_desligado'};
    if(!(capabilities[agent]||[]).includes(kind))return {ok:false,reason:'missao_nao_implementada'};
    if(!['manual','automatic'].includes(trigger)||trigger==='automatic'&&!['auto','semi'].includes(c.agents[agent]))return {ok:false,reason:'modo_incompativel'};
    return {ok:true};
  }
  const norm=v=>typeof v==='string'?v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' '):'';
  const units={g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],cm:['cm',1],m:['cm',100],un:['un',1]};
  const num=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0;
  function inventoryPlan(rows,stock){
    if(!Array.isArray(rows)||!rows.length||rows.length>500||!Array.isArray(stock))throw Error('Inventário inválido: fornece 1 a 500 linhas e uma lista de stock.');
    const counts=new Map();
    for(const r of rows){const n=norm(r?.name);counts.set(n,(counts.get(n)||0)+1);}
    return rows.map((r,index)=>{
      const name=typeof r?.name==='string'?r.name.trim():'',key=norm(name),u=Object.prototype.hasOwnProperty.call(units,r?.unit)?units[r.unit]:null;
      const base={index,name,requiresApproval:true};
      if(!key||name.length>200||!u||!num(r?.qty)||!Number.isFinite(Number(r.qty)*u[1]))return {...base,status:'invalid'};
      const counted=Number(r.qty)*u[1],unit=u[0];
      if(unit==='un'&&!Number.isInteger(counted))return {...base,status:'invalid'};
      const candidates=stock.filter(s=>norm(s?.name)===key);
      if(counts.get(key)>1||candidates.length>1)return {...base,status:'ambiguous',counted,unit,candidates:candidates.map(s=>({name:s.name,unit:s.unit}))};
      if(!candidates.length)return {...base,status:'new_material_review',counted,unit};
      const s=candidates[0];
      if(s.name!==name)return {...base,status:'name_review',counted,unit,candidate:s.name};
      if(s.unit!==unit||!num(s.qty))return {...base,status:'unit_or_balance_review',counted,unit,candidate:s.name};
      return {...base,status:'balance_review',counted,unit,current:Number(s.qty),delta:counted-Number(s.qty)};
    });
  }
  function createMission(settings,{id,agent,kind,trigger='manual'}){
    const p=permit(settings,agent,kind,trigger);
    if(!p.ok)throw Error(p.reason);
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Identificador inválido');
    return {id,agent,kind,trigger,status:'pending'};
  }
  function runMission(settings,mission,payload,audit,renamePlanner,organizer){
    if(!mission||mission.status!=='pending')throw Error('Missão não pendente');
    const p=permit(settings,mission.agent,mission.kind,mission.trigger);
    if(!p.ok)return {...mission,status:'blocked',reason:p.reason};
    let result;
    if(mission.kind==='inventory_count_plan')result=inventoryPlan(payload.rows,payload.stock);
    else if(mission.kind==='inventory_audit'&&typeof audit==='function')result=audit(payload);
    else if(mission.kind==='stock_rename_plan'&&typeof renamePlanner==='function')result=renamePlanner(payload.snapshot,payload.oldName,payload.newName);
    else if(mission.kind==='stock_organization_plan'&&organizer)result={categories:organizer.classify(payload.stock),duplicates:organizer.duplicates(payload.stock)};
    else if(mission.kind==='stock_merge_batch_plan'&&organizer)result=organizer.planBatch(payload.snapshot,payload.requests);
    else throw Error('Motor indisponível');
    return {...mission,status:'review',result};
  }
  function cancelMission(mission){
    if(!mission||!['pending','review','blocked'].includes(mission.status))throw Error('Missão não cancelável');
    return {id:mission.id,agent:mission.agent,kind:mission.kind,trigger:mission.trigger,status:'cancelled'};
  }
  return {agents:[...agents],defaults,config,permit,inventoryPlan,createMission,runMission,cancelMission};
}
if(typeof module==='object'&&module.exports)module.exports=createIntelligenceCore();
else globalThis.ArtEssenciaIntelligence=createIntelligenceCore();
