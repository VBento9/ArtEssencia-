/* ArtEssencia — Planeamento operacional Cloud v1. Registos independentes; sem afetar encomendas ou stock. */
(function(){
'use strict';
const ENTITY='operational_tasks_v1', ROOT_ID='aeTasksCloudV1', PAGE_SIZE=10;
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const pick=(values,val)=>{const s=el('select','ae-task-select');for(const [v,l] of values){const o=el('option','',l);o.value=v;s.append(o);}s.value=val;return s;};
const statuses=[['pendente','Pendente'],['em_curso','Em curso'],['concluida','Concluída']];
const categories=['Produção','Criação','Gestão','Marketing','Comercial','Segurança'];
let tasks=[],expanded=false,filter='ativas',search='',page=0,updating=false,loaded=false,notice='';
let weekOffset=0, dayFilter=null;
function localISO(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return obj.year+'-'+obj.month+'-'+obj.day;
}
function moveDay(iso,days){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function weekBase(){const today=localISO(),weekday=new Date(today+'T12:00:00Z').getUTCDay();return moveDay(today,-((weekday+6)%7)+weekOffset*7);}
function renderCalendar(area){
 const today=localISO(),active=taskItems().filter(x=>x.status!=='concluida');
 const late=active.filter(x=>x.due_date&&x.due_date<today).length;
 const now=active.filter(x=>x.due_date===today).length;
 const soon=active.filter(x=>x.due_date>today&&x.due_date<=moveDay(today,7)).length;
 const stats=el('div','ae-tasks-alert-line');
 stats.append(el('span','','Atrasadas: '+late),el('span','','Hoje: '+now),el('span','','Próximos 7 dias: '+soon));
 if(late)stats.classList.add('has-overdue');
 area.append(stats);
 const panel=el('div','ae-week-panel');
 const nav=el('div','ae-week-nav');
 nav.append(btn('←',()=>{weekOffset--;dayFilter=null;page=0;render();}));
 nav.append(el('strong','','Semana de '+new Date(weekBase()+'T12:00:00Z').toLocaleDateString('pt-PT',{timeZone:'UTC',day:'numeric',month:'short'})));
 nav.append(btn('Hoje',()=>{weekOffset=0;dayFilter=null;page=0;render();}));
 nav.append(btn('→',()=>{weekOffset++;dayFilter=null;page=0;render();}));
 panel.append(nav);
 const days=el('div','ae-week-days'),base=weekBase();
 for(let i=0;i<7;i++){
  const iso=moveDay(base,i),date=new Date(iso+'T12:00:00Z');
  const count=active.filter(t=>t.due_date===iso).length;
  const button=btn(date.toLocaleDateString('pt-PT',{timeZone:'UTC',weekday:'short'})+' '+date.getUTCDate()+' · '+count,
   ()=>{dayFilter=dayFilter===iso?null:iso;page=0;render();});
  button.classList.add('ae-week-day');
  if(iso===today)button.classList.add('is-today');
  if(dayFilter===iso){button.classList.add('is-selected');button.setAttribute('aria-pressed','true');}
  else button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','Filtrar tarefas de '+date.toLocaleDateString('pt-PT',{timeZone:'UTC'}));
  days.append(button);
 }
 panel.append(days);
 if(dayFilter)panel.append(btn('Limpar filtro do dia',()=>{dayFilter=null;page=0;render();}));
 area.append(panel);
}
const taskItems=()=>tasks.filter(t=>t.kind!=='recurring_rule');
function client(){if(typeof cloudClient==='undefined'||!cloudClient?.auth?.getSession||!cloudClient?.from)throw Error('Liga a sessão Cloud no Backoffice para sincronizar tarefas.');return cloudClient;}
async function currentUser(){
 const {data,error}=await client().auth.getSession();
 if(error||!data?.session?.user?.id)throw Error('Inicia sessão na Cloud para gerir as tarefas.');
 return data.session.user.id;
}
async function refresh(){
 const seq=++refresh.sequence;
 try{
  const userId=await currentUser();
  const rows=[];
  for(let offset=0;offset<5000;offset+=250){
   const {data,error}=await client().from('artessencia_cloud_records')
    .select('record_id,data,server_updated_at')
    .eq('entity',ENTITY).eq('user_id',userId).is('deleted_at',null)
    .order('server_updated_at',{ascending:false}).order('record_id',{ascending:true})
    .range(offset,offset+249);
   if(error)throw error;
   rows.push(...(data||[]));
   if(!data||data.length<250)break;
   if(offset===4750)throw Error('Limite de 5000 tarefas atingido; contactar suporte.');
  }
  if(seq!==refresh.sequence)return;
  tasks=rows.filter(x=>x.data&&typeof x.data==='object')
   .map(x=>({...x.data,id:String(x.record_id)}));
  loaded=true;notice='';render();
 }catch(error){if(seq!==refresh.sequence)return;loaded=false;notice=String(error?.message||error);render();}
}
refresh.sequence=0;
async function save(task){
 if(updating)return;
 updating=true;notice='A guardar na Cloud…';render();
 try{
  const uid=await currentUser();
  const now=new Date().toISOString();
  const payload={...task,id:String(task.id),updatedAt:now};
  const {error}=await client().from('artessencia_cloud_records').upsert({
   user_id:uid,entity:ENTITY,record_id:payload.id,data:payload,
   client_updated_at:now,deleted_at:null,device_id:'backoffice-task-planner'
  },{onConflict:'user_id,entity,record_id'});
  if(error)throw error;
  updating=false;await refresh();document.dispatchEvent(new CustomEvent('ae-task-saved'));
 }catch(error){updating=false;notice='Não foi possível guardar: '+String(error?.message||error);render();}
}
function btn(label,fn,cls){const b=el('button','btn '+(cls||''),label);b.type='button';b.disabled=updating;b.addEventListener('click',fn);return b;}
function countSummary(){
 const items=taskItems(),done=items.filter(t=>t.status==='concluida').length;
 return el('p','ae-task-summary',items.length+' tarefas · '+(items.length-done)+' por concluir · '+done+' concluídas');
}
function render(){
 const area=$('aeTasksCloudContentV1'),toggle=$('aeTasksCloudToggleV1');if(!area||!toggle)return;
 toggle.textContent=expanded?'Recolher tarefas':'Planeamento e tarefas'+(loaded?' ('+taskItems().filter(t=>t.status!=='concluida').length+')':'');
 toggle.setAttribute('aria-expanded',String(expanded));
 area.hidden=!expanded;if(!expanded)return;
 area.replaceChildren();
 const title=el('div','ae-task-head');title.append(el('strong','','Tarefas sincronizadas na Cloud'),btn('Atualizar',refresh));area.append(title);
 if(notice)area.append(el('p','ae-task-alert',notice));
 if(!loaded){area.append(el('p','ae-task-hint','Inicia sessão na Cloud e utiliza Atualizar para carregar as tarefas.'));return;}
 area.append(countSummary());renderCalendar(area);
 const toolbar=el('div','ae-task-toolbar');
 const options=[['ativas','Por concluir'],['todas','Todas'],['concluidas','Concluídas']];
 const filtering=pick(options,filter);filtering.setAttribute('aria-label','Filtrar tarefas');filtering.addEventListener('change',()=>{filter=filtering.value;page=0;render();});
 const q=el('input','ae-task-search');q.type='search';q.placeholder='Pesquisar tarefas';q.value=search;q.setAttribute('aria-label','Pesquisar tarefas');q.addEventListener('change',()=>{search=q.value.trim().toLocaleLowerCase('pt-PT');page=0;render();});
 toolbar.append(filtering,q);area.append(toolbar);
 const list=taskItems().filter(t=>{
  if(dayFilter&&t.due_date!==dayFilter)return false;
  if(filter==='ativas'&&t.status==='concluida')return false;
  if(filter==='concluidas'&&t.status!=='concluida')return false;
  return !search||(String(t.title)+' '+String(t.category)+' '+String(t.details||'')).toLocaleLowerCase('pt-PT').includes(search);
 }).sort((a,b)=>(a.due_date||'9999-12-31').localeCompare(b.due_date||'9999-12-31')||String(a.priority||'').localeCompare(String(b.priority||'')));
 const maxPage=Math.max(0,Math.ceil(list.length/PAGE_SIZE)-1);page=Math.min(page,maxPage);
 const visible=list.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 if(!visible.length)area.append(el('p','ae-task-hint','Sem tarefas para este filtro.'));
 for(const t of visible){
  const card=el('div','ae-task-row'+(t.status==='concluida'?' is-done':''));
  const content=el('div','ae-task-info');
  content.append(el('strong','',t.title||'Sem título'));
  const meta=[t.due_date?new Date(t.due_date+'T12:00:00').toLocaleDateString('pt-PT'):'Sem prazo',t.category||'Gestão',t.priority==='alta'?'Prioridade alta':''];
  content.append(el('small','',meta.filter(Boolean).join(' · ')));
  if(t.details)content.append(el('p','',t.details));
  const actions=el('div','ae-task-actions');
  const status=pick(statuses,t.status||'pendente');
  status.setAttribute('aria-label','Estado de '+t.title);status.disabled=updating;
  status.addEventListener('change',()=>save({...t,status:status.value}));
  actions.append(status,btn('Editar',()=>{
    const text=window.prompt('Descrição da tarefa',t.title||'');
    if(text===null)return;const name=text.trim();if(!name)return;
    save({...t,title:name.slice(0,160)});
  }));
  card.append(content,actions);area.append(card);
 }
 const paging=el('div','ae-task-paging');
 paging.append(el('small','',list.length+' resultados · página '+(page+1)+' de '+(maxPage+1)));
 if(page>0)paging.append(btn('Anterior',()=>{page--;render();}));
 if(page<maxPage)paging.append(btn('Seguinte',()=>{page++;render();}));
 area.append(paging);
 const form=el('form','ae-task-new');
 form.append(el('strong','','Adicionar tarefa'));
 const fields=el('div','ae-task-new-fields');
 const name=el('input');name.placeholder='Nova tarefa';name.maxLength=160;name.required=true;name.setAttribute('aria-label','Nome da tarefa');
 const date=el('input');date.type='date';date.setAttribute('aria-label','Prazo');
 const category=pick(categories.map(x=>[x,x]),'Gestão');category.setAttribute('aria-label','Categoria');
 const priority=pick([['normal','Normal'],['alta','Alta']], 'normal');priority.setAttribute('aria-label','Prioridade');
 fields.append(name,date,category,priority);form.append(fields);
 const submit=el('button','btn primary','Adicionar à Cloud');submit.type='submit';submit.disabled=updating;form.append(submit);
 form.addEventListener('submit',event=>{
  event.preventDefault();const title=name.value.trim();if(!title)return;
  save({id:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'task-'+Date.now()+'-'+Math.random().toString(36).slice(2)),
   title,details:'',due_date:date.value||null,category:category.value,priority:priority.value,status:'pendente',createdAt:new Date().toISOString()});
 });
 area.append(form);
}
function init(){
 const root=$('dashboard');if(!root||$(ROOT_ID))return;
 const panel=el('section','ae-task-root');panel.id=ROOT_ID;
 const toggle=btn('Planeamento e tarefas',()=>{
  expanded=!expanded;render();
  if(expanded)refresh();
 });toggle.id='aeTasksCloudToggleV1';toggle.setAttribute('aria-expanded','false');
 const content=el('div','ae-task-panel');content.id='aeTasksCloudContentV1';content.hidden=true;
 panel.append(toggle,content);root.prepend(panel);render();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&expanded)refresh();});
 document.addEventListener('ae-task-refresh',()=>{if(expanded)refresh();});
}
const style=document.createElement('link');style.rel='stylesheet';style.href='/task-planner-cloud-v1.css';style.id='aeTaskStylesV1';if(!$(style.id))document.head.append(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* Rotinas Cloud: módulo complementar, carregado pelo planeamento existente. */
import('./task-recurring-cloud-v1.js').catch(e=>console.warn('Rotinas indisponíveis',e));
