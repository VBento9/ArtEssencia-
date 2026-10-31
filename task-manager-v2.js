/* ArtEssencia — Gestor operacional V2. Cloud existente, sem mexer em encomendas ou stock. */
(()=>{'use strict';
const ENTITY='operational_tasks_v1',TABLE='artessencia_cloud_records',ROOT='aeTaskManagerV2';
const PAGE=6,TZ='Europe/Lisbon';
const sections=[['today','Hoje'],['week','Semana'],['calendar','Calendário'],['done','Concluídas'],['rules','Rotinas'],['capacity','Capacidade']];
const statuses=[['pendente','Pendente'],['em_curso','Em curso'],['concluida','Concluída']];
const priorities=[['alta','Alta'],['normal','Normal'],['baixa','Baixa']];
const categories=['Gestão','Comercial','Produção','Criação','Marketing','Segurança'];
const frequencies=[['daily','Diária'],['weekly','Semanal'],['monthly','Mensal'],['yearly','Anual']];
const seeded=[
 {id:'ae-routine-daily-comms-v2',title:'Verificar mensagens, pedidos e pagamentos pendentes',category:'Comercial',estimate_min:10},
 {id:'ae-routine-daily-priorities-v2',title:'Rever prioridades, prazos e tarefas do dia',category:'Gestão',estimate_min:5}
];
const $=id=>document.getElementById(id),node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
const button=(label,click,cls='')=>{const b=node('button','btn '+cls,label);b.type='button';b.addEventListener('click',click);return b};
const select=(opts,current)=>{const s=node('select','ae-tm-select');opts.forEach(([value,label])=>{const o=node('option','',label);o.value=value;s.append(o)});s.value=current;return s};
const dateParts=()=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const today=()=>{const p=dateParts();return p.year+'-'+p.month+'-'+p.day};
const dt=iso=>new Date(String(iso)+'T12:00:00Z');
const valid=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))&&Number.isFinite(+dt(iso))&&dt(iso).toISOString().startsWith(iso);
const iso=d=>d.toISOString().slice(0,10);
const shift=(date,days)=>{const d=dt(date);d.setUTCDate(d.getUTCDate()+days);return iso(d)};
const monthShift=(date,n)=>{const d=dt(date);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);return iso(d)};
const pretty=date=>valid(date)?dt(date).toLocaleDateString('pt-PT',{timeZone:'UTC',day:'numeric',month:'short'}):'Sem prazo';
const uid=()=>globalThis.crypto?.randomUUID?.()||('tm-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const priorityWeight={alta:0,normal:1,baixa:2};
let rows=[],screen='today',daySelected=today(),calendarMonth=today().slice(0,7)+'-01',page=0;
let loaded=false,busy=false,refreshing=null,message='',filterText='',newFormOpen=false,formEdit=null;
let editions=[],fetchEditions=false,root=null,body=null,toolbar=null;
function client(){if(typeof cloudClient==='undefined'||!cloudClient?.from)throw Error('É necessária uma sessão Cloud no Backoffice.');return cloudClient}
async function session(){const {data,error}=await client().auth.getSession();if(error||!data?.session?.user?.id)throw Error('Inicia sessão na Cloud.');return data.session.user.id}
async function getAll(user){
 const out=[];
 for(let n=0;n<5000;n+=250){
  const {data,error}=await client().from(TABLE).select('record_id,data,client_updated_at')
  .eq('user_id',user).eq('entity',ENTITY).is('deleted_at',null)
  .order('record_id',{ascending:true}).range(n,n+249);
  if(error)throw error;
  out.push(...(data||[]));if(!data||data.length<250)return out;
 }
 throw Error('Limite de registos excedido; não foram efetuadas alterações.');
}
function objects(){return rows.map(r=>({...r.data,id:r.record_id})).filter(r=>r.id)}
function tasks(){return objects().filter(r=>r.kind!=='recurring_rule'&&r.kind!=='planning_settings')}
function rules(){return objects().filter(r=>r.kind==='recurring_rule')}
function occurrences(rule){return tasks().filter(t=>t.origin_rule_id===rule.id).sort((a,b)=>String(b.occurrence_date||b.due_date||'').localeCompare(String(a.occurrence_date||a.due_date||'')))}
function nextOccurrence(anchor,freq,after){
 if(!valid(anchor)||!valid(after))return null;
 const source=dt(anchor),last=dt(after);
 if(freq==='daily'||freq==='weekly'){
  const size=freq==='weekly'?7:1;
  const delta=Math.max(0,Math.floor((+last-+source)/86400000/size)+1);
  return shift(anchor,delta*size);
 }
 if(freq==='monthly'||freq==='yearly'){
  const a=source.getUTCFullYear()*12+source.getUTCMonth(),b=last.getUTCFullYear()*12+last.getUTCMonth();
  const step=freq==='yearly'?12:1;
  for(let k=Math.max(0,Math.floor((b-a)/step)-1);k<1500;k++){
   const x=new Date(Date.UTC(source.getUTCFullYear(),source.getUTCMonth()+k*step,1,12));
   const maximum=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0,12)).getUTCDate();
   x.setUTCDate(Math.min(source.getUTCDate(),maximum));
   if(+x>+last&&+x>=+source)return iso(x);
  }
 }
 return null;
}
async function upsert(user,record,unique=false){
 const now=new Date().toISOString(),payload={...record,updatedAt:now};
 const existing=rows.find(r=>r.record_id===record.id);
 // Optimistic concurrency: a stale device cannot overwrite another device's edit.
 if(existing&&!unique){
  const {data,error}=await client().from(TABLE).update({
   data:payload,client_updated_at:now,device_id:'task-manager-v2'
  }).eq('user_id',user).eq('entity',ENTITY).eq('record_id',record.id)
   .eq('client_updated_at',existing.client_updated_at).is('deleted_at',null).select('record_id');
  if(error)throw error;
  if(!Array.isArray(data)||data.length!==1){
   await refresh();
   throw Error('Esta tarefa foi alterada noutro dispositivo. A lista foi atualizada; revê a alteração antes de guardar.');
  }
  return;
 }
 const {data,error}=await client().from(TABLE).upsert({
  user_id:user,entity:ENTITY,record_id:record.id,data:payload,client_updated_at:now,
  deleted_at:null,device_id:'task-manager-v2'
 },{onConflict:'user_id,entity,record_id',ignoreDuplicates:unique}).select('record_id');
 if(error)throw error;
 if(!unique&&(!Array.isArray(data)||data.length!==1))throw Error('A Cloud não confirmou a gravação.');
}
async function archive(user,id){
 const current=rows.find(r=>r.record_id===id);
 if(!current)throw Error('Tarefa não encontrada. Atualiza a lista antes de eliminar.');
 const {data,error}=await client().from(TABLE).update({deleted_at:new Date().toISOString(),device_id:'task-manager-v2'})
 .eq('user_id',user).eq('entity',ENTITY).eq('record_id',id)
 .eq('client_updated_at',current.client_updated_at)
 .is('deleted_at',null).select('record_id');
 if(error)throw error;
 if(!Array.isArray(data)||data.length!==1){
  await refresh();throw Error('Não foi possível eliminar: o registo foi alterado noutro dispositivo.');
 }
}
async function seedDaily(user){
 let changed=false,ids=new Set(rows.map(r=>r.record_id));
 for(const item of seeded){
  if(ids.has(item.id))continue;
  // Não reativar uma rotina anteriormente apagada.
  const {data:prior,error}=await client().from(TABLE).select('record_id').eq('user_id',user)
   .eq('entity',ENTITY).eq('record_id',item.id).limit(1);
  if(error)throw error;
  if(prior?.length)continue;
  await upsert(user,{...item,kind:'recurring_rule',frequency:'daily',anchor_date:today(),active:true,priority:'normal',createdAt:new Date().toISOString()},true);
  changed=true;
 }
 return changed;
}
async function generate(user){
 let changed=false,all=tasks(),horizon=shift(today(),14);
 for(const rule of rules().filter(r=>r.active!==false)){
  const prev=occurrences(rule)[0];
  if(prev&&prev.status!=='concluida')continue;
  const floor=prev?[prev.occurrence_date||prev.due_date,shift(today(),-1)].sort().at(-1):shift(today(),-1);
  const due=nextOccurrence(rule.anchor_date,rule.frequency,floor);
  if(!due||due>horizon)continue;
  const id='ae-occ-'+rule.id+'-'+due;
  if(all.some(t=>t.id===id))continue;
  await upsert(user,{id,kind:'task',title:rule.title,category:rule.category||'Gestão',
   priority:rule.priority||'normal',estimate_min:rule.estimate_min||0,due_date:due,
   status:'pendente',origin_rule_id:rule.id,occurrence_date:due,createdAt:new Date().toISOString()},true);
  changed=true;
 }
 return changed;
}
async function refresh(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  try{
   const user=await session();
   rows=await getAll(user);
   if(await seedDaily(user))rows=await getAll(user);
   if(await generate(user))rows=await getAll(user);
   loaded=true;message='';render();
  }catch(e){message='Cloud: '+String(e.message||e);render();}
  finally{refreshing=null}
 })();
 return refreshing;
}
async function mutate(fn){
 if(busy)return;busy=true;render();
 try{
  // Uma leitura iniciada antes da gravação nunca deve substituir o estado recém-gravado.
  if(refreshing)await refreshing;
  const user=await session();
  await fn(user);
  await refresh();
  message='Alteração guardada na Cloud.';
 }catch(e){message='Não foi possível guardar: '+String(e.message||e);}
 finally{busy=false;render()}
}
function readEditions(){
 try {
  if(typeof specialEditionsAdmin!=='undefined'&&Array.isArray(specialEditionsAdmin)){
   editions=specialEditionsAdmin.filter(ed=>ed&&ed.name).map(ed=>({
    id:String(ed.id||ed.edition_id||ed.slug||ed.name),
    name:String(ed.name),start:ed.starts_at?String(ed.starts_at).slice(0,10):null,
    end:ed.ends_at?String(ed.ends_at).slice(0,10):null,active:ed.active!==false
   }));
  }
 }catch(_){}
}
async function updateEditions(){
 if(fetchEditions)return;fetchEditions=true;
 try{if(typeof loadSpecialEditionsAdmin==='function')await loadSpecialEditionsAdmin(false)}catch(_){}
 readEditions();fetchEditions=false;render();
}
function top(){
 root.className='ae-task-shell ae-tm';
 const header=node('div','ae-tm-header');
 const left=node('div','ae-tm-heading');left.append(node('strong','','Planeamento e tarefas'),node('small','','Gestão diária · Cloud'));
 const side=node('div','ae-tm-head-actions');
 side.append(button('+ Nova tarefa',()=>{newFormOpen=!newFormOpen;formEdit=null;render()},'primary'));
 side.append(button('Atualizar',refresh));
 header.append(left,side);root.append(header);
 const stats=node('div','ae-tm-kpis');
 const list=tasks(),pending=list.filter(t=>t.status!=='concluida'),now=today();
 const counts=[['Em atraso',pending.filter(t=>t.due_date&&t.due_date<now).length],['Hoje',pending.filter(t=>(t.planned_date||t.due_date)===now).length],['Próximos 7 dias',pending.filter(t=>(t.planned_date||t.due_date)>now&&(t.planned_date||t.due_date)<=shift(now,7)).length],['Concluídas',list.length-pending.length]];
 counts.forEach(([label,n],i)=>{const card=node('div','ae-tm-kpi'+(i===0&&n?' is-late':''));card.append(node('strong','',n),node('small','',label));stats.append(card)});
 root.append(stats);
 const tabbar=node('div','ae-tm-tabs');tabbar.setAttribute('role','tablist');
 sections.forEach(([id,label])=>{const tab=button(label,()=>{screen=id;page=0;filterText='';render()});tab.className='ae-tm-tab'+(screen===id?' active':'');tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(screen===id));tabbar.append(tab)});
 root.append(tabbar);
 body=node('div','ae-tm-main');root.append(body);
 const footer=node('div','ae-tm-footer');
 footer.append(node('span','','As tarefas são pessoais e sincronizadas na Cloud. Não alteram encomendas, stock nem edições.'));
 const help=node('details');help.append(node('summary','','Como funciona?'));
 const p=node('p','','Tarefa = ação concreta, concluída uma vez. Rotina = regra que cria uma tarefa a cada período; só gera a seguinte quando a anterior está concluída. Pausar pára novas ocorrências. Eliminar a rotina preserva tarefas e histórico. A geração ocorre quando abres/atualizas o Backoffice com Internet, não em segundo plano.');
 help.append(p);footer.append(help);root.append(footer);
}
function input(label,value,type='text',required=false){
 const l=node('label','ae-tm-field'),name=node('span','',label),x=node('input');
 x.type=type;x.value=value||'';x.required=required;
 l.append(name,x);return {wrap:l,input:x};
}
function choice(label,options,current){
 const l=node('label','ae-tm-field');l.append(node('span','',label));const s=select(options,current);l.append(s);return {wrap:l,input:s};
}
function taskForm(){
 const form=node('form','ae-tm-form');
 form.append(node('strong','',' '+(formEdit?'Editar tarefa':'Nova tarefa')));
 const name=input('O que fazer?',formEdit?.title,'text',true);name.input.maxLength=160;
 const date=input('Prazo final',formEdit?.due_date||today(),'date');
 const planned=input('Data prevista de execução',formEdit?.planned_date||formEdit?.due_date||today(),'date');
 const category=choice('Área',categories.map(c=>[c,c]),formEdit?.category||'Gestão');
 const pri=choice('Prioridade',priorities,formEdit?.priority||'normal');
 const estimate=input('Minutos estimados',String(formEdit?.estimate_min??15),'number');estimate.input.min='0';estimate.input.max='600';
 const related=choice('Edição especial',[['','Sem ligação'],...editions.map(ed=>[ed.id,ed.name])],formEdit?.edition_id||'');
 const notes=input('Notas',formEdit?.details||'');
 const fields=node('div','ae-tm-form-grid');[name,date,planned,category,pri,estimate,related,notes].forEach(x=>fields.append(x.wrap));
 form.append(fields);
 const actions=node('div','ae-tm-actions');
 actions.append(button('Cancelar',()=>{newFormOpen=false;formEdit=null;render()}));
 const save=node('button','btn primary','Guardar tarefa');save.type='submit';actions.append(save);form.append(actions);
 form.onsubmit=event=>{
  event.preventDefault();const title=name.input.value.trim();if(!title)return;
  if(date.input.value&&planned.input.value&&planned.input.value>date.input.value&&!window.confirm('A execução está prevista para depois do prazo final. Guardar mesmo assim?'))return;
  const data={...formEdit,id:formEdit?.id||uid(),kind:'task',title,
   category:category.input.value,priority:pri.input.value,due_date:date.input.value||null,planned_date:planned.input.value||null,
   estimate_min:Math.max(0,Math.min(600,Number(estimate.input.value)||0)),
   edition_id:related.input.value||null,details:notes.input.value.trim().slice(0,600),
   status:formEdit?.status||'pendente',createdAt:formEdit?.createdAt||new Date().toISOString()};
  mutate(async user=>{await upsert(user,data);newFormOpen=false;formEdit=null});
 };
 return form;
}
function taskCard(task){
 const line=node('article','ae-tm-task'+(task.status==='concluida'?' done':''));
 const content=node('div','ae-tm-task-content');
 const title=node('strong','',task.title||'Tarefa sem título');content.append(title);
 const meta=node('small','');
 const ed=editions.find(e=>e.id===task.edition_id);
 meta.textContent=['Execução: '+pretty(task.planned_date||task.due_date),task.planned_date&&task.planned_date!==task.due_date?'Prazo: '+pretty(task.due_date):'',task.category||'Gestão',ed?'Edição: '+ed.name:'',
  task.estimate_min?task.estimate_min+' min':'',task.origin_rule_id?'Recorrente':''].filter(Boolean).join(' · ');
 content.append(meta);
 if(task.details)content.append(node('p','',task.details));
 line.append(content);
 const side=node('div','ae-tm-task-buttons');
 const pill=node('span','ae-tm-priority '+(task.priority||'normal'),task.priority==='alta'?'Alta':task.priority==='baixa'?'Baixa':'Normal');
 side.append(pill);
 const update=button(task.status==='concluida'?'Reabrir':'✓ Concluir',()=>mutate(user=>upsert(user,{...task,status:task.status==='concluida'?'pendente':'concluida',
  completed_at:task.status==='concluida'?null:new Date().toISOString()})));
 side.append(update);
 const more=node('details','ae-tm-more');more.append(node('summary','','•••'));
 const menu=node('div','ae-tm-more-menu');
 menu.append(button('Editar',()=>{formEdit=task;newFormOpen=true;render()}));
 if(task.status==='pendente')menu.append(button('Iniciar',()=>mutate(user=>upsert(user,{...task,status:'em_curso'}))));
 menu.append(button('Eliminar tarefa',()=>{
  if(!window.confirm('Eliminar esta tarefa? Esta ação não elimina a rotina associada.'))return;
  mutate(user=>archive(user,task.id));
 },'ae-tm-danger'));
 more.append(menu);side.append(more);
 line.append(side);return line;
}
function sorted(list){
 return list.sort((a,b)=>{
  const now=today(),urgent=x=>x.due_date&&x.due_date<now?0:x.status==='em_curso'?1:2;
  const planned=x=>x.planned_date||x.due_date||'9999';
  return urgent(a)-urgent(b)||(priorityWeight[a.priority]??1)-(priorityWeight[b.priority]??1)
   ||planned(a).localeCompare(planned(b))||(a.due_date||'9999').localeCompare(b.due_date||'9999')
   ||String(a.title).localeCompare(String(b.title),'pt-PT');
 });
}
function taskList(list,empty){
 const all=sorted(list.filter(t=>!filterText||String(t.title+' '+(t.category||'')+' '+(t.details||'')).toLocaleLowerCase('pt-PT').includes(filterText)));
 if(!all.length){body.append(node('p','ae-tm-empty',empty));return}
 const pages=Math.max(1,Math.ceil(all.length/PAGE));page=Math.min(pages-1,page);
 const wrap=node('div','ae-tm-list');
 all.slice(page*PAGE,(page+1)*PAGE).forEach(t=>wrap.append(taskCard(t)));body.append(wrap);
 if(pages>1){const pag=node('div','ae-tm-pagination');
 pag.append(node('small','',(page+1)+' / '+pages+' · '+all.length+' tarefas'));
 if(page)pag.append(button('Anterior',()=>{page--;render()}));
 if(page<pages-1)pag.append(button('Seguinte',()=>{page++;render()}));
 body.append(pag)}
}
function currentView(){
 const date=today(),uncompleted=tasks().filter(t=>t.status!=='concluida');
 const q=node('input','ae-tm-search');q.type='search';q.placeholder='Pesquisar tarefas';q.value=filterText;
 q.onchange=()=>{filterText=q.value.trim().toLocaleLowerCase('pt-PT');page=0;render()};
 if(screen==='today'){
  body.append(node('h3','','Prioridades de hoje'));
  body.append(node('p','ae-tm-subtext','Verifica primeiro os atrasos e os trabalhos com prazo para hoje. No resto da semana, dá prioridade a tarefas curtas de gestão.'));
  const focus=uncompleted.filter(t=>t.status==='em_curso'||(t.due_date&&t.due_date<=date)||((t.planned_date||t.due_date)&&((t.planned_date||t.due_date)<=date)));
 const minutes=focus.reduce((sum,t)=>sum+Math.max(0,Number(t.estimate_min)||0),0);
 const weekend=[0,1].includes(dt(date).getUTCDay());
 body.append(node('p','ae-tm-subtext',focus.length+' tarefa(s) a acompanhar · '+minutes+' minutos previstos. '+(weekend?'Dia de atelier: dá prioridade à produção e criação.':'Dia de gestão: verifica pedidos, prazos e bloqueios; reserva a produção para domingo/segunda.')));
 body.append(q);taskList(focus,'Não há tarefas em curso, pendentes ou atrasadas para hoje.');
 }else if(screen==='week'){
  body.append(node('h3','','Próximos sete dias'));
  body.append(q);taskList(uncompleted.filter(t=>{const plan=t.planned_date||t.due_date;return (plan&&plan>=date&&plan<=shift(date,7))||(t.due_date&&t.due_date>=date&&t.due_date<=shift(date,7))}),'Sem tarefas planeadas ou com prazo nesta semana.');
 }else if(screen==='done'){
  body.append(node('h3','','Histórico concluído'));
  body.append(q);taskList(tasks().filter(t=>t.status==='concluida').sort((a,b)=>String(b.completed_at||'').localeCompare(String(a.completed_at||''))),'Ainda não existem tarefas concluídas.');
 }else if(screen==='calendar')renderCalendar();
 else if(screen==='rules')renderRules();
 else if(typeof window.aeTaskCapacityV1==='function')window.aeTaskCapacityV1({body,tasks:tasks(),rows,upsert,mutate,today,dt,shift,pretty,valid,node,button});
 else body.append(node('p','ae-tm-empty','O painel de capacidade não está disponível.'));
}
function renderCalendar(){
 const head=node('div','ae-tm-calendar-top');
 head.append(button('‹',()=>{calendarMonth=monthShift(calendarMonth,-1);render()}));
 head.append(node('strong','',dt(calendarMonth).toLocaleDateString('pt-PT',{timeZone:'UTC',month:'long',year:'numeric'})));
 head.append(button('Hoje',()=>{calendarMonth=today().slice(0,7)+'-01';daySelected=today();render()}));
 head.append(button('›',()=>{calendarMonth=monthShift(calendarMonth,1);render()}));body.append(head);
 const grid=node('div','ae-tm-month');
 ['S','T','Q','Q','S','S','D'].forEach(w=>grid.append(node('span','ae-tm-weekday',w)));
 const d=dt(calendarMonth),offset=(d.getUTCDay()+6)%7,last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();
 for(let i=0;i<Math.ceil((offset+last)/7)*7;i++){
  const date=shift(calendarMonth,i-offset),inMonth=date.slice(0,7)===calendarMonth.slice(0,7);
  const due=tasks().filter(t=>(t.planned_date||t.due_date)===date&&t.status!=='concluida').length;
  const editionStart=editions.filter(e=>e.start===date);
  const b=button(String(dt(date).getUTCDate())+(due?' · '+due:'')+(editionStart.length?' ✦':''),()=>{daySelected=date;render()});
  b.className='ae-tm-day'+(!inMonth?' outside':'')+(daySelected===date?' selected':'')+(date===today()?' today':'');
  b.setAttribute('aria-label',date+' · '+due+' tarefas'+(editionStart.length?' · '+editionStart.length+' edições':''));
  grid.append(b);
 }
 body.append(grid);
 const detail=node('div','ae-tm-calendar-detail');
 detail.append(node('h3','','Dia '+pretty(daySelected)));
 const markers=editions.filter(e=>e.start===daySelected||e.end===daySelected);
 for(const ed of markers){
  const bar=node('div','ae-tm-edition');
  bar.append(node('span','',(ed.start===daySelected?'Início':'Fim')+' da edição «'+ed.name+'»'));
  bar.append(button('Abrir edição',()=>{if(typeof go==='function')go('specialEditions')}));
  detail.append(bar);
 }
 const selected=tasks().filter(t=>(t.planned_date||t.due_date)===daySelected);
 if(selected.length)selected.slice(0,5).forEach(t=>detail.append(taskCard(t)));
 else detail.append(node('p','ae-tm-empty','Sem tarefas neste dia.'));
 if(selected.length>5)detail.append(node('small','','Mais '+(selected.length-5)+' tarefas. Usa a vista Semana para consultar.'));
 detail.append(button('+ Tarefa para este dia',()=>{formEdit={due_date:daySelected};newFormOpen=true;render()},'primary'));
 body.append(detail);
 renderEditionPlanning();
}
function lastAtelierDay(date){
 if(!valid(date))return null;
 const week=dt(date).getUTCDay();
 return week===0||week===1?date:shift(date,-(week-1));
}
async function createEditionPlan(ed){
 if(!valid(ed.start))return;
 const steps=[[-21,'Definir produtos e capacidade de produção','Criação',90],
  [-14,'Validar custos, fichas técnicas e materiais','Gestão',45],
  [-7,'Preparar fotografia, textos e catálogo','Marketing',60],
  [-1,'Rever publicação e confirmar disponibilidade','Comercial',20]];
 const planned=steps.map(([days,title,category,estimate_min])=>({
  days,title,category,estimate_min,
  due_date:category==='Criação'||category==='Produção'?
   lastAtelierDay(shift(ed.start,days)):shift(ed.start,days)
 })).filter(step=>step.due_date>=today());
 const skipped=steps.length-planned.length;
 if(!planned.length){
  message='A edição «'+ed.name+'» não tem etapas de preparação futuras. Não foram criadas tarefas atrasadas.';
  render();return;
 }
 const prompt='Criar '+planned.length+' tarefa(s) para «'+ed.name+'»?'
  +(skipped?' '+skipped+' etapa(s) com prazo passado serão ignoradas.':'')
  +' As edições, os produtos e os preços não serão alterados.';
 if(!window.confirm(prompt))return;
 await mutate(async user=>{
  for(const step of planned){
   const id='ae-edition-'+encodeURIComponent(ed.id).slice(0,110)+'-'+(21+step.days);
   await upsert(user,{id,kind:'task',title:step.title+' — '+ed.name,
    category:step.category,priority:'alta',due_date:step.due_date,edition_id:ed.id,
    status:'pendente',source:'edition-plan',estimate_min:step.estimate_min,
    createdAt:new Date().toISOString()},true);
  }
 });
}
function renderEditionPlanning(){
 const detail=node('details','ae-tm-edition-planning');
 detail.append(node('summary','','Planeamento ligado às edições especiais'));
 const wrap=node('div');
 wrap.append(node('p','ae-tm-subtext','Mostra datas reais das edições. O plano é opcional e só cria tarefas futuras: criação no domingo/segunda-feira, preparação comercial e marketing com prazos próprios. Nunca publica a edição ou modifica preços.'));
 if(!editions.length)wrap.append(node('p','ae-tm-empty','Ainda não foram carregadas edições com datas.'));
 for(const ed of editions.filter(x=>x.active).slice(0,12)){
  const row=node('div','ae-tm-edition');
  row.append(node('span','',ed.name+' · '+(ed.start?pretty(ed.start):'Sem data de início')));
  if(ed.start)row.append(button('Criar plano',()=>createEditionPlan(ed)));
  wrap.append(row);
 }
 wrap.append(button('Atualizar edições',updateEditions));
 detail.append(wrap);body.append(detail);
}
function renderRules(){
 body.append(node('h3','','Rotinas automáticas'));
 body.append(node('p','ae-tm-subtext','As duas verificações diárias básicas são criadas uma única vez. Cada rotina gera, no máximo, uma ocorrência em aberto. As rotinas são executadas quando abres ou atualizas o Backoffice.'));
 const list=node('div','ae-tm-rule-list');
 for(const rule of rules().sort((a,b)=>String(a.title).localeCompare(String(b.title),'pt-PT'))){
  const row=node('div','ae-tm-rule');
  const detail=node('div','ae-tm-rule-info');
  detail.append(node('strong','',rule.title));
  const active=occurrences(rule).find(t=>t.status!=='concluida');
  detail.append(node('small','',(frequencies.find(([id])=>id===rule.frequency)?.[1]||rule.frequency)+' · '+(rule.active===false?'Pausada':'Ativa')+(active?' · pendente: '+pretty(active.due_date):'')));
  row.append(detail);
  const actions=node('div','ae-tm-rule-actions');
  actions.append(button(rule.active===false?'Reativar':'Pausar',()=>mutate(user=>upsert(user,{...rule,active:rule.active===false}))));
  actions.append(button('Eliminar',()=>{
   if(!window.confirm('Eliminar a rotina «'+rule.title+'»? As tarefas já criadas permanecem no histórico.'))return;
   mutate(user=>archive(user,rule.id));
  },'ae-tm-danger'));
  row.append(actions);list.append(row);
 }
 if(!rules().length)list.append(node('p','ae-tm-empty','Sem rotinas.'));
 body.append(list);
 const form=node('form','ae-tm-form');
 form.append(node('strong','','Nova rotina'));
 const title=input('Nome',undefined,'text',true);title.input.maxLength=160;
 const start=input('Primeiro dia',today(),'date',true);
 const repeat=choice('Periodicidade',frequencies,'weekly');
 const cat=choice('Área',categories.map(c=>[c,c]),'Gestão');
 const pri=choice('Prioridade',priorities,'normal');
 const estimate=input('Duração prevista (min)', '10','number');estimate.input.min='0';estimate.input.max='600';
 const fields=node('div','ae-tm-form-grid');[title,start,repeat,cat,pri,estimate].forEach(x=>fields.append(x.wrap));form.append(fields);
 const save=node('button','btn primary','Criar rotina');save.type='submit';form.append(save);
 form.onsubmit=e=>{e.preventDefault();const name=title.input.value.trim();if(!name||!valid(start.input.value))return;
  mutate(user=>upsert(user,{id:uid(),kind:'recurring_rule',title:name,
   anchor_date:start.input.value,frequency:repeat.input.value,category:cat.input.value,
   priority:pri.input.value,estimate_min:Math.max(0,Math.min(600,Number(estimate.input.value)||0)),
   active:true,createdAt:new Date().toISOString()}));};
 body.append(form);
}
function render(){
 if(!root)return;
 root.replaceChildren();top();
 if(!loaded){body.append(node('p','ae-tm-empty',message||'A ligar à Cloud para carregar as tarefas…'));return;}
 if(message)body.append(node('p','ae-tm-info',message));
 if(newFormOpen)body.append(taskForm());
 currentView();
 root.classList.toggle('busy',busy);
}
function mount(){
 if($(ROOT))return;
 const dash=$('dashboard');if(!dash)return;
 const shell=node('div','ae-task-shell');dash.prepend(shell);root=shell;root.id=ROOT; if(!document.getElementById('aeTaskManagerV2Styles')){const style=document.createElement('link');style.id='aeTaskManagerV2Styles';style.rel='stylesheet';style.href='/task-manager-v2.css';document.head.append(style)}
 render();refresh();updateEditions();
 // Atualiza ao regressar ao Dashboard noutro dispositivo sem exigir fechar a PWA.
 let lastPull=0;
 function refreshOnReturn(){
  if(!dash.classList.contains('active')||busy||refreshing)return;
  if(Date.now()-lastPull<20000)return;
  lastPull=Date.now();
  refresh();
 }
 new MutationObserver(refreshOnReturn).observe(dash,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOnReturn()});
 window.addEventListener('online',refreshOnReturn);
 window.addEventListener('pageshow',refreshOnReturn);
 window.addEventListener('focus',refreshOnReturn);
}
function start(){
 if($('dashboard'))mount();
 else{
  const watcher=new MutationObserver(()=>{if($('dashboard')){watcher.disconnect();mount()}});
  watcher.observe(document.body,{childList:true,subtree:true});
 }
}
import('./task-capacity-v1.js').then(()=>{if(!document.getElementById('aeTaskCapacityStyles')){const link=document.createElement('link');link.id='aeTaskCapacityStyles';link.rel='stylesheet';link.href='/task-capacity-v1.css';document.head.append(link)}if(screen==='capacity')render()}).catch(e=>console.warn('Capacidade indisponível',e));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();