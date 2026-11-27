/* Central ArtEssencia Intelligence */
(function(){
'use strict';
const labels={director:'Diretor Geral',stock:'Stock',producao:'Produção',financeiro:'Financeiro',comercial:'Comercial',marketing:'Marketing',inovacao:'Inovação',catalogo:'Catálogo',auditoria:'Auditoria'};
const kinds={director:['daily_priority_plan'],stock:['inventory_audit','stock_organization_plan'],producao:['production_plan','inventory_audit'],financeiro:['finance_review'],comercial:['commercial_review'],marketing:['marketing_plan'],inovacao:['innovation_review'],catalogo:['catalog_review'],auditoria:['technical_review','inventory_audit']};
const names={daily_priority_plan:'Plano de prioridades',inventory_audit:'Auditoria de inventário',inventory_count_plan:'Contagem física',stock_organization_plan:'Organização de materiais',stock_rename_plan:'Normalização de nomes',stock_merge_batch_plan:'Consolidação de duplicados',production_plan:'Planeamento de produção',finance_review:'Análise financeira',commercial_review:'Seguimento comercial',marketing_plan:'Planeamento de marketing',innovation_review:'Revisão de conceitos',catalog_review:'Revisão de catálogo',technical_review:'Auditoria técnica'};
const modes=[['off','Desligado'],['manual','Manual'],['semi','Semiautomático'],['auto','Automático']];
const el=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;return e;};
const btn=(label,fn)=>{const b=el('button',label);b.type='button';b.className='btn';b.onclick=fn;return b;};
const select=(options,label)=>{const s=el('select');s.setAttribute('aria-label',label);for(const [v,t] of options){const o=el('option',t);o.value=v;s.append(o);}return s;};
const statusNames={pending_review:'A aguardar aprovação',approved:'Aprovada',working:'Em execução',review_ready:'Para revisão',blocked:'Bloqueada',cancelled:'Cancelada'};
const sections=['Gabinete do Diretor Geral','Funcionários','Comunicação','Missões','Trabalhos em execução','Planeamento','Aprovações','Documentos produzidos','Memória profissional','Objetivos','Desempenho','Controlo financeiro','Auditoria','Configurações'];
const allOff=()=>Object.fromEntries(Object.keys(labels).map(key=>[key,'off']));
const unlockedNow=()=>typeof unlocked!=='undefined'&&unlocked===true&&['authGateV1880','lockScreen'].every(id=>document.getElementById(id)?.classList.contains('hidden'));
function init(){
 const anchor=document.querySelector('#dashboard .dashboard-hero');
 if(!anchor||document.querySelector('#aeIntelligenceCentral'))return;
 const root=el('section');root.id='aeIntelligenceCentral';root.className='card';
 const body=el('div'), notice=el('p'), content=el('div');
 notice.setAttribute('role','status');
 const nav=select(sections.map(s=>[s,s]),'Área de trabalho');
 const toggle=btn('Abrir central de agentes',()=>{if(opened)close();else if(unlockedNow()){opened=true;body.hidden=false;toggle.textContent='Fechar central';load();}});
 root.append(el('h3','ArtEssencia Intelligence'),toggle,body);body.append(nav,btn('Atualizar',()=>load()),notice,content);body.hidden=true;anchor.after(root);
 let opened=false,generation=0,state=null,busy=false,recipient='director';
 function close(){generation++;recipient='director';opened=false;busy=false;state=null;content.replaceChildren();body.hidden=true;notice.textContent='';toggle.textContent='Abrir central de agentes';}
 async function rpc(action,args){
  if(!unlockedNow()||typeof cloudClient==='undefined'||!cloudClient?.rpc)throw Error();
  const result=await cloudClient.rpc('artessencia_intelligence_console_v1',{p_action:action,p_args:args});
  if(result.error||result.data==null)throw Error();
  return result.data;
 }
 async function load(action='read',args={}){
  if(!opened||busy||!unlockedNow())return;
  const ticket=++generation;busy=true;content.inert=true;notice.textContent='A consultar a Cloud…';
  try{
   let receipt;
   if(action==='execute'){
    const auth=await cloudClient.auth.getSession();
    if(ticket!==generation||!unlockedNow()||!auth.data?.session?.access_token)throw Error();
    const response=await fetch('/api/intelligence-worker',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.session.access_token},body:JSON.stringify(args),cache:'no-store'});
    if(!response.ok)throw Error();
   }else if(action!=='read')receipt=await rpc(action,args);
   if(ticket!==generation||!unlockedNow())return;
   const data=await rpc('read',{});
   if(ticket!==generation||!unlockedNow())return;
   state=data;notice.textContent=action==='create_material'?'Material confirmado na Cloud. Recebe e valida os dados da Cloud antes de alterar o stock.':action==='plan_task'?(receipt.status==='archived'?'A tarefa já foi arquivada.':'Tarefa confirmada no Planeamento.'):'';
   if(action==='plan_task')document.dispatchEvent(new CustomEvent('ae-task-refresh'));render();
  }catch{if(ticket===generation){state=null;content.replaceChildren();notice.textContent=action==='read'?'Central Cloud indisponível. Verifica a sessão e a instalação do serviço.':'Resultado por confirmar. Atualiza a central antes de repetir a operação.';}}
  finally{if(ticket===generation){busy=false;content.inert=false;}}
 }
 nav.onchange=()=>{if(state&&unlockedNow())render();};
 function render(){
  content.replaceChildren();
  const area=nav.value, controls=state.controls||{revision:0,enabled:false,modes:allOff()};
  const list=state.missions;
  const line=text=>content.append(el('p',text));
  function missionCard(m){
   const card=el('article');card.append(el('strong',labels[m.agent]+' · '+(names[m.kind]||m.kind)),el('p',m.instruction),el('small',statusNames[m.status]));
   if(m.result_summary)card.append(el('p',m.result_summary));
   const args={id:m.mission_id,revision:m.revision};
   if(m.status==='approved')card.append(btn('Executar missão aprovada',()=>load('execute',{missionId:m.mission_id,revision:m.revision})));
   if(m.status==='pending_review')card.append(btn('Aprovar',()=>load('approve',args)));
   if(['pending_review','approved','working'].includes(m.status))card.append(btn('Cancelar missão',()=>load('cancel',args)));
   if(m.parent_id)card.append(el('small','Missão de origem · '+m.parent_id));
   if(m.agent==='director'&&['approved','working'].includes(m.status)){
    const dept=select(Object.entries(labels).filter(([key])=>key!=='director'),'Delegar em'),kind=select([],'Trabalho delegado'),instruction=el('textarea');
    function update(){kind.replaceChildren();for(const k of kinds[dept.value])kind.add(new Option(names[k],k));}dept.onchange=update;update();instruction.maxLength=4000;instruction.placeholder='Instrução para o departamento';
    card.append(dept,kind,instruction,btn('Delegar missão',()=>{if(instruction.value.trim())load('delegate',{id:crypto.randomUUID(),parent:m.mission_id,agent:dept.value,kind:kind.value,instruction:instruction.value.trim(),revision:controls.revision});}));
   }
   content.append(card);
  }
  if(area==='Funcionários'||area==='Configurações'){
   const master=btn(controls.enabled?'Desligar equipa':'Ligar equipa',()=>load('controls',{revision:controls.revision,enabled:!controls.enabled,modes:allOff()}));content.append(master);
   for(const [key,label] of Object.entries(labels)){
    const row=el('label',label+' '),mode=select(modes,'Modo de '+label);
    mode.value=controls.modes[key];mode.disabled=!controls.enabled;
    mode.onchange=()=>load('controls',{revision:controls.revision,enabled:true,modes:{...controls.modes,[key]:mode.value}});
    row.append(mode);row.style.display='block';content.append(row);
   }
  }else if(area==='Comunicação'||area===sections[0]){
   const agent=select(Object.entries(labels),'Funcionário'),kind=select([],'Tipo de missão'),instruction=el('textarea');
   instruction.placeholder='Descreve o trabalho';instruction.maxLength=4000;instruction.setAttribute('aria-label','Instrução');
   const file=el('input');file.type='file';file.accept='.txt,.csv,.pdf,.jpg,.jpeg,.png';file.setAttribute('aria-label','Anexo de inventário');
   const upload=el('label','Inventário · JPG, PNG ou PDF até 1 MiB, TXT ou CSV até 60 kB. Usa uma cópia sem contactos ou dados bancários. Para contagem física em TXT/CSV: primeira linha nome;quantidade contada;unidade. Até 100 materiais; nenhuma alteração automática. ');upload.append(file);
   const send=btn('Enviar missão',async()=>{
    if(!instruction.value.trim()||busy)return;
    const args={id:crypto.randomUUID(),agent:agent.value,kind:kind.value,instruction:instruction.value.trim(),revision:controls.revision};
    const selected=!upload.hidden&&file.files[0],ticket=generation;
    if(selected){
     try{
      const ext=selected.name.toLowerCase().split('.').pop(),mime=({csv:'text/csv',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',pdf:'application/pdf'})[ext];
      if(!mime||selected.size>(mime.startsWith('text/')?60000:1048576)||!selected.size)throw Error();
      send.disabled=true;
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(selected);});
      if(ticket!==generation||!opened||!unlockedNow()||!send.isConnected)return;
      args.attachment={mime,content:encoded};
     }catch{notice.textContent='Verifica o formato e o tamanho do ficheiro de inventário.';return;}
     finally{send.disabled=false;}
    }
    await load('mission',args);
   });
   const history=el('div');
   function refresh(){file.value='';upload.hidden=agent.value!=='stock';kind.replaceChildren();for(const k of kinds[agent.value])kind.add(new Option(names[k],k));send.disabled=!controls.enabled||controls.modes[agent.value]==='off';history.replaceChildren();for(const m of list.filter(m=>m.agent===agent.value)){history.append(el('p',m.instruction+' · '+statusNames[m.status]));if(m.result_summary)history.append(el('p',m.result_summary));}}
   agent.disabled=area===sections[0];agent.value=agent.disabled?'director':recipient;agent.onchange=()=>{recipient=agent.value;refresh();};refresh();kind.onchange=()=>{upload.hidden=agent.value!=='stock'||!['inventory_audit','stock_organization_plan'].includes(kind.value);if(upload.hidden)file.value='';};content.append(agent,kind,instruction,upload,send,history);
  }else if(area==='Documentos produzidos'){
   if(!state.documents.length)line('Sem documentos concluídos.');
   for(const d of state.documents){line(labels[d.agent]+' · '+d.mission_id);line(d.content);
    const count=d.physical_count;
    if(d.agent==='stock'&&count?.mode==='physical_count_proposal_only'&&Array.isArray(count.proposals)){
     const status={new_material_review:'Material novo — rever criação',name_review:'Nome diferente — confirmar identidade',ambiguous:'Possível duplicado — rever',unit_or_balance_review:'Unidade ou saldo por validar',balance_review:'Diferença de saldo — rever',invalid:'Linha inválida'};
     content.append(el('h4','Contagem física — propostas sem alteração de stock'));
     line('Revisão de origem: '+count.sourceRevision+' · Confirma a identidade, unidade e saldo antes de qualquer alteração.');
     for(const row of count.proposals){
      const details=[row.name,status[row.status]||'Por rever'];
      if(Number.isFinite(row.counted))details.push('Contado: '+row.counted+' '+row.unit);
      if(Number.isFinite(row.current))details.push('Registado: '+row.current+' '+row.unit,'Diferença: '+row.delta+' '+row.unit);
      if(row.candidate)details.push('Material existente: '+row.candidate);
      if(Array.isArray(row.candidates)&&row.candidates.length)details.push('Candidatos: '+row.candidates.map(c=>c.name+' ('+c.unit+')').join(', '));
      line(details.join(' · '));
      const receipt=(d.material_receipts||[]).find(r=>r.index===row.index);
      if(receipt)line('Material criado · revisão '+receipt.revision+' · '+receipt.name);
      else if(row.status==='new_material_review'){
       const cost=el('input');cost.type='number';cost.min='0';cost.step='any';cost.placeholder='Custo por '+row.unit+' (€)';cost.setAttribute('aria-label','Custo unitário confirmado de '+row.name);
       content.append(cost,btn('Confirmar criação sem saldo',()=>{
        const value=Number(cost.value);
        if(!Number.isFinite(value)||value<=0||value>1000000){notice.textContent='Indica o custo unitário confirmado.';return;}
        if(!window.confirm('Criar '+row.name+' ('+row.unit+') com saldo 0 e custo unitário '+value+' €? Não altera fichas técnicas, compras, movimentos ou o saldo contado. É necessária nova leitura da Cloud após confirmar.'))return;
        load('create_material',{mission:d.mission_id,index:row.index,sourceRevision:count.sourceRevision,unitCost:value,confirmed:true});
       }));
      }
     }
    }
    for(const receipt of d.tool_receipts||[])line((receipt.tool==='delegate'?'Missão delegada':'Tarefa no Planeamento')+' · '+receipt.id);
    for(const t of d.tasks||[])if(t.agent===d.agent&&t.requiresApproval===true){line(t.title);content.append(btn('Aprovar para Planeamento',()=>load('plan_task',{mission:d.mission_id,key:t.key})));}
   }
  }else if(['Missões','Aprovações','Trabalhos em execução'].includes(area)){
   const expected={'Aprovações':'pending_review','Trabalhos em execução':'working','Documentos produzidos':'review_ready'}[area];
   const items=list.filter(m=>!expected||m.status===expected);
   if(!items.length)line('Sem registos nesta vista.');items.forEach(missionCard);
  }else if(area==='Memória profissional'||area==='Objetivos'){
   for(const entry of state.memory.filter(m=>area!=='Objetivos'||m.kind==='objective')){
    line(labels[entry.agent]+' · '+entry.summary);
    if(!entry.revoked_at)content.append(btn('Corrigir',()=>{const summary=window.prompt('Corrigir memória profissional',entry.summary);if(summary?.trim())load('correct',{id:entry.memory_id,previous:entry.summary,summary:summary.trim()});}),btn('Revogar',()=>load('revoke',{id:entry.memory_id})));
    else content.append(btn('Eliminar memória revogada',()=>{if(window.confirm('Eliminar definitivamente esta memória?'))load('erase',{id:entry.memory_id});}));
   }
   const evidence=list.filter(m=>m.status==='review_ready');
   if(!evidence.length){line('É necessária uma missão concluída para validar uma nova memória.');return;}
   const origin=select(evidence.map(m=>[m.mission_id,labels[m.agent]+' · '+m.instruction.slice(0,80)]),'Missão de origem'),summary=el('textarea');summary.maxLength=1000;summary.placeholder='Conhecimento profissional validado';
   content.append(origin,summary,btn('Validar e guardar',()=>{const m=evidence.find(m=>m.mission_id===origin.value);if(summary.value.trim())load('remember',{id:crypto.randomUUID(),agent:m.agent,mission:m.mission_id,summary:summary.value.trim(),kind:area==='Objetivos'?'objective':'lesson'});}));
  }else if(area==='Controlo financeiro'){
   const eur=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:4}).format(n/1000000);
   const used=state.budget.settled+state.budget.pending;
   if(state.budget.unknown)line('Chamadas suspensas até à reconciliação dos custos desconhecidos.');
   else if(used>=23000000)line('Limite preventivo atingido.');
   else if(used>=18400000)line('Já foram comprometidos pelo menos 80% do limite preventivo.');
   for(const [channel,amount] of Object.entries(state.budget.channels||{})){const label=labels[channel]||({legacy_social:'Publicações',legacy_description:'Descrição de produto',legacy_insights:'Estatísticas digitais'})[channel];line(label+' · '+eur(amount.settled)+' liquidados · '+eur(amount.pending)+' reservados');}
   line('Consumo liquidado no mês · '+eur(state.budget.settled));line('Reservas pendentes · '+eur(state.budget.pending));line('Custos por esclarecer · '+state.budget.unknown);line('Limite preventivo 23 € · Reserva de segurança 7 € · Teto mensal 30 €');
  }else if(area==='Auditoria'){
   for(const e of state.events)line(new Date(e.occurred_at).toLocaleString('pt-PT')+' · '+statusNames[e.status]+' · '+e.mission_id);
   if(!state.events.length)line('Sem movimentos.');
  }else if(area==='Planeamento'){
   const who=select(Object.entries(labels),'Responsável pela rotina'), cadences={daily:'Diária',weekly:'Semanal',monthly:'Mensal'},period=select(Object.entries(cadences),'Periodicidade'),instruction=el('textarea');instruction.maxLength=4000;instruction.placeholder='Objetivo da rotina';
   content.append(who,period,instruction,btn('Guardar rotina',()=>{if(instruction.value.trim())load('routine',{agent:who.value,cadence:period.value,instruction:instruction.value.trim(),enabled:true,revision:controls.revision});}));
   for(const r of state.routines){line(labels[r.agent]+' · '+cadences[r.cadence]+' · '+r.instruction);content.append(btn(r.enabled?'Suspender rotina':'Retomar rotina',()=>load('routine',{...r,enabled:!r.enabled,revision:controls.revision})));}
   const planner=document.getElementById('aeTasksCloudToggleV1');
   if(planner)content.append(btn('Abrir Planeamento de Tarefas',()=>{if(planner.getAttribute('aria-expanded')!=='true')planner.click();planner.scrollIntoView({block:'start'});}));else line('Planeamento de Tarefas indisponível.');
  }else if(area==='Desempenho'){
   line('Últimas '+list.length+' missões consultadas');
   for(const [key,label] of Object.entries(labels))line(label+' · '+list.filter(m=>m.agent===key&&m.status==='review_ready').length+' para revisão');
  }
 }
 const observer=new MutationObserver(()=>{if(!unlockedNow())close();});
 for(const id of ['authGateV1880','lockScreen']){const e=document.getElementById(id);if(e)observer.observe(e,{attributes:true,attributeFilter:['class']});}
 window.addEventListener('pagehide',close);window.addEventListener('offline',close);document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
