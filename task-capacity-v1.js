/* ArtEssencia 1.9.78 — planeamento de capacidade, isolado de stock e encomendas. */
(()=>{
'use strict';
const SETTINGS_ID='ae-capacity-settings-v1';
const readMinutes=t=>Math.max(0,Math.min(600,Number(t.estimate_min)||0));
const modeDate=t=>t.planned_date||t.due_date;
const dayName=(date,dt)=>dt(date).toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'});
const isAtelierDay=(date,dt)=>[0,1].includes(dt(date).getUTCDay());
window.aeTaskCapacityV1=function(ctx){
 const {body,tasks,rows,upsert,mutate,today,dt,shift,pretty,valid,node,button}=ctx;
 const current=today();
 const record=rows.find(r=>r.record_id===SETTINGS_ID)?.data||null;
 const defaults={'0':240,'1':240,'2':30,'3':30,'4':30,'5':30,'6':30};
 const minutes={...defaults,...(record?.minutes||{})};
 const budget=d=>Math.max(0,Number(minutes[String(dt(d).getUTCDay())])||0);
 const outstanding=tasks.filter(t=>t.status!=='concluida');
 const dayTasks=date=>outstanding.filter(t=>modeDate(t)===date);
 const load=date=>dayTasks(date).reduce((sum,t)=>sum+readMinutes(t),0);
 const title=node('h3','','Capacidade e distribuição do trabalho');
 body.append(title);
 body.append(node('p','ae-tm-subtext','Compara tempo estimado e disponibilidade. Domingos e segundas-feiras são os dias principais de atelier. Alterar a data prevista nunca muda o prazo final.'));
 const form=node('form','ae-cap-config');
 const opts=[['0','Domingo'],['1','Segunda-feira'],['other','Terça-feira a sábado']];
 const inputs=[];
 for(const [key,label] of opts){
  const wrap=node('label','ae-cap-field');wrap.append(node('span','',label+' (minutos disponíveis)'));
  const input=node('input');input.type='number';input.step='15';input.min='0';input.max='900';
  input.value=String(key==='other'?minutes['2']:minutes[key]);
  wrap.append(input);form.append(wrap);inputs.push([key,input]);
 }
 const save=node('button','btn primary','Guardar disponibilidade');save.type='submit';
 form.append(save);
 form.onsubmit=event=>{
  event.preventDefault();
  const updated={...minutes};
  for(const [key,input] of inputs){
   const v=Number(input.value);
   if(!Number.isFinite(v)||v<0||v>900||v%15!==0){
    window.alert('Indica a disponibilidade de 0 a 900 minutos, em intervalos de 15 minutos.');
    return;
   }
   if(key==='other')for(let d=2;d<=6;d++)updated[String(d)]=v;
   else updated[key]=v;
  }
  mutate(user=>upsert(user,{
   ...record,id:SETTINGS_ID,kind:'planning_settings',minutes:updated,
   createdAt:record?.createdAt||new Date().toISOString()
  }));
 };
 body.append(form);
 if(!record)body.append(node('p','ae-tm-subtext','Disponibilidade inicial de referência: 4 horas no domingo e segunda-feira; 30 minutos nos restantes dias. Ajusta estes valores antes de confiar no planeamento.'));
 const days=Array.from({length:14},(_,i)=>shift(current,i));
 const total=days.reduce((sum,date)=>sum+load(date),0);
 const totalCapacity=days.reduce((sum,date)=>sum+budget(date),0);
 body.append(node('p','ae-tm-capacity-summary',total+' de '+totalCapacity+' minutos planeados para os próximos 14 dias. As tarefas sem data ou vencidas não contam nestas barras.'));
 const chart=node('div','ae-cap-days');
 for(const date of days){
  const amount=load(date),limit=budget(date);
  if(!amount&&date!==current&&!isAtelierDay(date,dt))continue;
  const row=node('div','ae-cap-day'+(amount>limit?' overloaded':''));
  const head=node('div','ae-cap-day-head');
  head.append(node('strong','',dayName(date,dt)),node('small','',amount+' / '+limit+' min · '+dayTasks(date).length+' tarefas'));
  row.append(head);
  const track=node('div','ae-cap-track'),fill=node('span','ae-cap-fill');
  fill.style.width=Math.min(100,limit?100*amount/limit:amount?100:0)+'%';
  track.append(fill);row.append(track);
  if(amount>limit)row.append(node('small','ae-cap-warning','Sobrecarga estimada: '+(amount-limit)+' minutos'));
  chart.append(row);
 }
 body.append(chart);
 const suggestions=node('section','ae-cap-suggestions');
 suggestions.append(node('strong','','Sugestões de redistribuição'));
 const overloaded=days.filter(date=>load(date)>budget(date));
 let options=0;
 const occupied={};
 for(const date of days)occupied[date]=load(date);
 for(const source of overloaded){
  const candidates=dayTasks(source)
   .filter(t=>t.status==='pendente'&&!t.origin_rule_id&&t.source!=='edition-plan'&&['Criação','Produção'].includes(t.category))
   .sort((a,b)=>(a.priority==='baixa'?0:a.priority==='normal'?1:2)-(b.priority==='baixa'?0:b.priority==='normal'?1:2));
  for(const task of candidates){
   if(options>=3)break;
   const duration=readMinutes(task);
   if(!duration||occupied[source]<=budget(source))continue;
   const target=days.find(date=>date!==source&&date>=current&&isAtelierDay(date,dt)
     &&(!valid(task.due_date)||date<=task.due_date)&&occupied[date]+duration<=budget(date));
   if(!target)continue;
   occupied[source]-=duration;occupied[target]+=duration;options++;
   const line=node('div','ae-cap-proposal');
   line.append(node('span','',task.title+' · '+duration+' minutos: '+pretty(source)+' → '+pretty(target)));
   line.append(button('Reagendar',()=>{
    if(!window.confirm('Mudar apenas a execução prevista de «'+task.title+'» para '+pretty(target)+'? O prazo de '+pretty(task.due_date)+' mantém-se.'))return;
    mutate(user=>upsert(user,{...task,planned_date:target}));
   }));
   suggestions.append(line);
  }
 }
 if(!options)suggestions.append(node('p','ae-tm-empty',overloaded.length?'Existem dias sobrecarregados, mas não há redistribuições seguras antes dos prazos. Revê a carga manualmente.':'Sem sobrecarga nos dias planeados.'));
 body.append(suggestions);
};
})();