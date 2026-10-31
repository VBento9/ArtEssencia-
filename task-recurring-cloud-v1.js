/* Rotinas Cloud ArtEssencia 1.9.70: uma ocorrência em aberto por regra. */
(()=>{'use strict';
const E='operational_tasks_v1', $=id=>document.getElementById(id);
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text||'';return n};
const day=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const d=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return d.year+'-'+d.month+'-'+d.day};
const dt=s=>new Date(s+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10);
function next(anchor,unit,after){
 const original=dt(anchor);if(!Number.isFinite(+original))return null;
 for(let i=0;i<1500;i++){
  let d;
  if(unit==='daily'||unit==='weekly'){
   d=new Date(+original);d.setUTCDate(d.getUTCDate()+i*(unit==='weekly'?7:1));
  }else if(unit==='monthly'||unit==='yearly'){
   d=new Date(Date.UTC(original.getUTCFullYear(),original.getUTCMonth()+i*(unit==='yearly'?12:1),1,12));
   const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();
   d.setUTCDate(Math.min(original.getUTCDate(),last));
  }else return null;
  if(iso(d)>after)return iso(d);
 }return null;
}
function cloud(){if(typeof cloudClient==='undefined'||!cloudClient?.from)throw Error('É necessária sessão Cloud');return cloudClient}
async function load(){const cl=cloud();const {data:{session},error:authError}=await cl.auth.getSession();if(authError||!session?.user?.id)throw Error('Inicia sessão na Cloud');const uid=session.user.id;const {data,error}=await cl.from('artessencia_cloud_records').select('record_id,data').eq('user_id',uid).eq('entity',E).is('deleted_at',null).limit(1000);if(error)throw error;return {uid,rows:data||[]};}
async function write(uid,record,unique=false){const cl=cloud(),now=new Date().toISOString();const {error}=await cl.from('artessencia_cloud_records').upsert({user_id:uid,entity:E,record_id:record.id,data:{...record,updatedAt:now},client_updated_at:now,device_id:'recurrence-v1',deleted_at:null},{onConflict:'user_id,entity,record_id',ignoreDuplicates:unique});if(error)throw error;}
async function removeRule(uid,rule){
 const now=new Date().toISOString();
 const {data,error}=await cloud().from('artessencia_cloud_records')
  .update({deleted_at:now,client_updated_at:now,device_id:'recurrence-v1'})
  .eq('user_id',uid).eq('entity',E).eq('record_id',rule.id)
  .is('deleted_at',null).select('record_id');
 if(error)throw error;
 if(!Array.isArray(data)||data.length!==1)throw Error('Não foi possível confirmar a eliminação na Cloud.');
}
function cadenceName(key){
 return {daily:'Diária',weekly:'Semanal',monthly:'Mensal',yearly:'Anual'}[key]||'Sem repetição';
}
async function sync(){const {uid,rows}=await load();const today=day(), horizon=iso(new Date(+dt(today)+30*86400000));let added=0;for(const r of rows.filter(x=>x.data?.kind==='recurring_rule'&&x.data.active!==false)){const rule=r.data;const occurrences=rows.filter(x=>x.data?.origin_rule_id===r.record_id).sort((a,b)=>String(b.data.due_date).localeCompare(String(a.data.due_date)));const last=occurrences[0]?.data;if(last&&last.status!=='concluida')continue;const floor=last?[last.due_date,iso(new Date(+dt(today)-86400000))].sort().at(-1):iso(new Date(+dt(today)-86400000));const due=next(rule.anchor_date,rule.frequency,floor);if(!due||due>horizon)continue;const id='ae-occ-'+r.record_id+'-'+due;if(rows.some(x=>x.record_id===id))continue;await write(uid,{id,title:rule.title,due_date:due,category:rule.category||'Gestão',priority:rule.priority||'normal',status:'pendente',origin_rule_id:r.record_id,kind:'task'},true);added++;}if(added)document.dispatchEvent(new CustomEvent('ae-task-refresh'));return {uid,rows,added};}
function start(){const host=$('aeTasksCloudV1');if(!host||$('aeRecurrenceV1'))return;const wrap=el('details');wrap.id='aeRecurrenceV1';wrap.style.cssText='margin:10px 0;padding:10px;border:1px solid #d7c9bc;border-radius:8px';const summary=el('summary','Rotinas e tarefas automáticas');wrap.append(summary);const body=el('div');body.style.cssText='display:grid;gap:8px;padding-top:9px';const info=el('small','1. Cria uma rotina com um nome e uma periodicidade. 2. Ao abrires ou atualizares esta secção com Internet, surge a tarefa correspondente. 3. Quando a concluis, a próxima é criada na atualização seguinte. Pausar interrompe novas tarefas; Eliminar retira a regra, sem apagar o histórico.');body.append(info);
const help=el('p','As tarefas já criadas continuam na lista mesmo que pauses ou elimines a rotina. A geração não funciona em segundo plano.');
help.className='ae-routine-help';body.append(help);
const refresh=el('button','Atualizar rotinas');refresh.type='button';refresh.className='btn';const list=el('div');body.append(refresh,list);
async function paint(){refresh.disabled=true;try{const state=await sync();list.replaceChildren();if(state.added)list.append(el('p',state.added+' nova(s) tarefa(s) gerada(s).'));for(const row of state.rows.filter(x=>x.data?.kind==='recurring_rule')){const rule=row.data;const line=el('div');line.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0';line.className='ae-routine-line';
 const label=el('span',rule.title+' · '+cadenceName(rule.frequency)+' · '+(rule.active===false?'Pausada':'Ativa'));
 const latest=state.rows.filter(x=>x.data?.origin_rule_id===row.record_id&&x.data?.status!=='concluida');
 if(latest.length)label.textContent+=' · tarefa pendente: '+(latest[0].data.due_date||'sem data');
 line.append(label);
 const actions=el('div');actions.className='ae-routine-actions';line.append(actions);const toggle=el('button',rule.active===false?'Reativar':'Pausar');toggle.type='button';toggle.className='btn';toggle.onclick=async()=>{toggle.disabled=true;try{await write(state.uid,{...rule,active:rule.active===false});await paint();}catch(e){list.prepend(el('p',String(e.message||e)));}};actions.append(toggle);
 const del=el('button','Eliminar');del.type='button';del.className='btn ae-routine-delete';
 del.setAttribute('aria-label','Eliminar rotina '+rule.title);
 del.onclick=async()=>{
  if(!window.confirm('Eliminar a rotina «'+rule.title+'»?\n\nNão serão geradas novas tarefas. As tarefas já criadas, incluindo as concluídas, ficam no histórico.'))return;
  del.disabled=true;toggle.disabled=true;
  try{
   await removeRule(state.uid,{...rule,id:row.record_id});
   await paint();
   list.prepend(el('p','Rotina eliminada. As tarefas existentes foram preservadas.'));
  }catch(e){list.prepend(el('p','Erro ao eliminar rotina: '+String(e.message||e)));del.disabled=false;toggle.disabled=false;}
 };
 actions.append(del);list.append(line);}if(!state.rows.some(x=>x.data?.kind==='recurring_rule'))list.append(el('p','Ainda não há rotinas.'));}catch(e){list.replaceChildren(el('p','Cloud: '+String(e.message||e)));}finally{refresh.disabled=false;}}
refresh.onclick=paint;
const form=el('form');form.style.cssText='display:flex;flex-wrap:wrap;gap:7px';form.append(el('strong','Nova rotina:'));const title=el('input');title.placeholder='Nome da rotina';title.required=true;title.maxLength=160;const date=el('input');date.type='date';date.required=true;date.value=day();const freq=el('select');for(const [value,label] of [['daily','Diária'],['weekly','Semanal'],['monthly','Mensal'],['yearly','Anual']]){const o=el('option',label);o.value=value;freq.append(o)}const add=el('button','Criar rotina');add.type='submit';add.className='btn primary';form.append(title,date,freq,add);form.onsubmit=async ev=>{ev.preventDefault();add.disabled=true;try{const state=await load(),id='ae-rule-'+(crypto.randomUUID?.()||Date.now().toString(36));await write(state.uid,{id,kind:'recurring_rule',title:title.value.trim(),anchor_date:date.value,frequency:freq.value,active:true,category:'Gestão',priority:'normal',createdAt:new Date().toISOString()});title.value='';await paint();}catch(e){list.prepend(el('p',String(e.message||e)));}finally{add.disabled=false;}};body.append(form);
const presets=el('div');presets.style.cssText='display:flex;flex-wrap:wrap;gap:7px';
const presetData=[
 ['stock','Revisão semanal de stock','weekly',day(),'Gestão'],
 ['indicadores','Analisar resultados comerciais','weekly',day(),'Gestão'],
 ['natal','Preparar coleção de Natal','yearly',day().slice(0,4)+'-09-01','Criação'],
 ['valentim','Preparar São Valentim','yearly',day().slice(0,4)+'-01-05','Criação'],
 ['halloween','Preparar Halloween','yearly',day().slice(0,4)+'-08-15','Criação']
];
for(const [slug,title,frequency,anchor,category] of presetData){
 const b=el('button','+ '+title);b.type='button';b.className='btn';
 b.onclick=async()=>{b.disabled=true;try{
 const state=await load(),id='ae-rule-template-'+slug;
 if(state.rows.some(r=>r.record_id===id)){list.prepend(el('p','Esta rotina já foi criada.'));return;}
 await write(state.uid,{id,kind:'recurring_rule',title,anchor_date:anchor,frequency,category,priority:'normal',active:true,createdAt:new Date().toISOString()});
 await paint();
 }catch(e){list.prepend(el('p',String(e.message||e)));}finally{b.disabled=false;}};
 presets.append(b);
}
body.append(el('strong','Modelos de rotina e coleções'));body.append(presets);
wrap.append(body);host.after(wrap);wrap.addEventListener('toggle',()=>{if(wrap.open)paint()});}
function boot(){start();if(!$('aeRecurrenceV1')){const obs=new MutationObserver(()=>{start();if($('aeRecurrenceV1'))obs.disconnect()});obs.observe(document.body,{childList:true,subtree:true});}}document.addEventListener('ae-task-saved',()=>{const panel=$('aeRecurrenceV1');if(panel?.open)panel.querySelector('button')?.click()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();