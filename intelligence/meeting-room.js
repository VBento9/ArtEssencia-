/* Persistent executive meetings; Cloud evidence is never replaced by invented replies. */
(function(){
'use strict';
const e=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const money=n=>((Number(n)||0)/1000000).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:6})+' €';
const time=t=>t?new Date(t).toLocaleString('pt-PT'):'Data indisponível';
function render({container,data,controls,people,perform,choose,openMissions,missionActions}){
 const button=(label,fn,disabled=false)=>{const b=e('button',label);b.type='button';b.className='btn';b.disabled=disabled;b.onclick=fn;return b;};
 const select=(items,label)=>{const s=e('select');s.setAttribute('aria-label',label);for(const [value,text]of items){const o=e('option',text);o.value=value;s.append(o);}return s;};
 const field=(tag,label,value='')=>{const n=e(tag);n.setAttribute('aria-label',label);n.value=value;return n;};
 const text=t=>container.append(e('p',t));
 const name=key=>people[key]?.name||key;
 const state={open:'Aberta',paused:'Suspensa',closed:'Encerrada'};
 const all=data.meetings||[],current=all.find(x=>x.meeting_id===data.selected);
 const call=(action,args={},confirm)=>{if(confirm&&!window.confirm(confirm))return;perform(action,{meeting:current?.meeting_id,revision:current?.revision,...args});};
 text('Reunião guardada na Cloud. As perguntas e intervenções podem ser retomadas noutro dispositivo. Nenhuma chamada de IA é iniciada ao guardar uma pergunta.');
 const create=e('details');create.open=!all.length;create.append(e('summary','Convocar reunião'));
 const title=field('input','Título da reunião','Reunião geral de gestão');title.maxLength=140;
 const agenda=field('textarea','Ordem de trabalhos da reunião','Conhecer os resultados, os problemas, as oportunidades e as prioridades da próxima semana.');agenda.maxLength=1800;
 const scheduled=field('input','Data da reunião');scheduled.type='datetime-local';
 const participants=e('fieldset');participants.className='ae-meeting-participants';participants.append(e('legend','Participantes convocados'));
 const boxes={};for(const [key,person]of Object.entries(people)){const label=e('label'),box=field('input','Convocar '+person.name);box.type='checkbox';box.checked=true;boxes[key]=box;label.append(box,e('span',person.name+' · '+person.role));participants.append(label);}
 const error=e('p');error.setAttribute('role','status');
 create.append(title,agenda,scheduled,participants,e('small','A data é uma convocatória. Não ativa agendamento nem despesas automaticamente.'),button('Guardar convocatória',()=>{
  const selected=Object.keys(boxes).filter(k=>boxes[k].checked);
  if(!title.value.trim()||!agenda.value.trim()||!selected.length){error.textContent='Indica um título, a ordem de trabalhos e pelo menos um participante.';return;}
  perform('create',{meeting:crypto.randomUUID(),title:title.value.trim(),agenda:agenda.value.trim(),participants:selected,scheduledAt:scheduled.value?new Date(scheduled.value).toISOString():null});
 }),error);container.append(create);
 if(!all.length){text('Ainda não existem reuniões persistentes. A equipa pode permanecer desligada durante a preparação.');return;}
 const list=select(all.map(m=>[m.meeting_id,m.title+' · '+state[m.status]]),'Reunião guardada');list.value=current?.meeting_id||all[0].meeting_id;list.onchange=()=>choose(list.value);container.append(list);
 if(!current){text('Seleciona uma reunião para consultar o conteúdo.');return;}
 const header=e('article');header.append(e('strong',current.title),e('p',current.agenda),e('small',state[current.status]+' · revisão '+current.revision+' · atualizada '+time(current.updated_at)),e('p','Convocados: '+current.participants.map(name).join(', ')));
 if(current.scheduled_at)header.append(e('p','Convocatória: '+time(current.scheduled_at)));
 header.append(button(current.status==='paused'?'Retomar reunião':'Suspender reunião',()=>call(current.status==='paused'?'resume':'pause'),current.status==='closed'),button('Encerrar reunião',()=>call('close',{},'Encerrar esta reunião? Não serão iniciadas novas intervenções.'),current.status==='closed'));
 container.append(header);
 const cost=e('details');cost.append(e('summary','Controlo financeiro da reunião'),e('p','Liquidado: '+money(data.cost?.settledMicroeur)+' · reservado: '+money(data.cost?.pendingMicroeur)+' · teto aprovado: '+money(current.max_microeur)),e('p','Este teto inclui as delegações associadas. Não substitui a autorização financeira global.'));
 const cap=field('input','Teto da reunião em euros',String(current.max_microeur/1000000));cap.type='number';cap.min='0';cap.max='23';cap.step='0.000001';
 cost.append(cap,button('Aprovar teto da reunião',()=>{
  const amount=Math.round(Number(cap.value)*1000000);if(!Number.isSafeInteger(amount)||amount<0||amount>23000000)return;
  call('budget',{maximumMicroeur:amount,confirmed:true},'Registar o teto máximo de '+money(amount)+' para esta reunião? Isto não ativa a faturação global.');
 },current.status==='closed'));container.append(cost);
 const commitments=e('details');commitments.append(e('summary','Compromissos de reuniões anteriores'));
 for(const c of data.commitments||[]){commitments.append(e('p',name(c.agent)+' · '+c.title+' · '+(c.task_archived?'Tarefa arquivada':c.task_status||'Ainda sem tarefa no Planeamento')+(c.due_date?' · prazo '+c.due_date:'')));}
 if(!(data.commitments||[]).length)commitments.append(e('p','Sem decisões aprovadas registadas.'));container.append(commitments);
 const thread=e('section');thread.className='ae-meeting-thread';thread.setAttribute('aria-label','Conversa da reunião');
 for(const message of data.messages||[]){
  const article=e('article');article.append(e('strong',message.author==='owner'?'Proprietário':name(message.agent)+' · relatório reutilizado'),e('small',time(message.created_at)),e('p',message.content));
  if(message.author==='reused')article.append(e('small','Análise anterior de '+time(message.source_at)+'. Não é uma nova intervenção. Missão: '+message.evidence_mission));
  const turns=(data.turns||[]).filter(t=>t.messageId===message.message_id);
  for(const turn of turns){const reply=e('blockquote');reply.append(e('strong',name(turn.agent)+' · '+(people[turn.agent]?.role||'')),e('small','Missão '+turn.missionId+' · '+({pending_review:'aguarda aprovação',approved:'aprovada',working:'em execução',review_ready:'para revisão',blocked:'bloqueada',cancelled:'cancelada'}[turn.status]||turn.status)));
   if(turn.status==='review_ready'&&turn.content){reply.append(e('p',turn.content),e('small','Concluída em '+time(turn.completedAt)+' · custo liquidado '+(turn.costMicroeur===null?'por reconciliar':money(turn.costMicroeur))));
    const p=turn.provenance;reply.append(e('p',p?'Informação consultada: revisão '+p.sourceRevision+' · captura '+time(p.capturedAt)+' · fontes: '+(p.evidenceIds||[]).join(', '):'Proveniência detalhada indisponível neste relatório. Não assumir uma análise atual.'));
   }else reply.append(e('p','Sem intervenção concluída. Não foi inventada uma resposta.'));
   if(typeof missionActions==='function')reply.append(missionActions(turn));
   article.append(reply);
  }
  if(message.author==='owner'&&current.status==='open'){
   if(!turns.length)article.append(button('Solicitar ronda dos participantes',()=>call('round',{message:message.message_id},'Preparar uma missão por participante? Todas ficam pendentes de aprovação. Não inicia chamadas pagas.'),!controls?.enabled||current.participants.some(a=>!controls.modes?.[a]||controls.modes[a]==='off')));
   for(const agent of current.participants.filter(a=>!turns.some(t=>t.agent===a))){const disabled=!controls?.enabled||controls.modes?.[agent]==='off'||!controls.modes?.[agent];article.append(button('Solicitar intervenção de '+name(agent),()=>call('request',{message:message.message_id,agent},'Preparar uma intervenção de '+name(agent)+'? Será criada uma missão pendente de aprovação; não inicia uma chamada paga.'),disabled));}
  }
  thread.append(article);
 }
 if(!(data.messages||[]).length)thread.append(e('p','Ainda não há perguntas ou relatórios associados.'));container.append(thread);
 const question=field('textarea','Pergunta na reunião');question.maxLength=1800;question.placeholder='Leonor, o que foi feito desde a última reunião?';
 container.append(question,button('Guardar pergunta',()=>{if(question.value.trim())call('message',{text:question.value.trim()});},current.status==='closed'),button('Consultar missões e aprovações',openMissions));
 if(!controls?.enabled)text('A equipa está desligada. Podes preparar a reunião; as intervenções permanecem indisponíveis.');
 const reuse=e('details');reuse.append(e('summary','Reutilizar relatório existente'));
 const report=field('input','Identificador da missão a reutilizar');report.placeholder='UUID da missão concluída';
 reuse.append(report,button('Associar relatório anterior',()=>{if(/^[0-9a-f-]{36}$/i.test(report.value))call('reuse',{mission:report.value});},current.status==='closed'));container.append(reuse);
 const minutes=e('section');minutes.className='ae-meeting-minutes';minutes.append(e('h4','Atas e decisões'));
 minutes.append(button('Preparar ata dos relatórios concluídos',()=>call('minutes'),current.status==='closed'),e('p','A compilação identifica os relatórios efetivamente concluídos. Não é apresentada como uma síntese de Leonor por IA.'));
 const latest=(data.minutes||[])[0];
 if(latest){
  minutes.append(e('p','Custo registado nesta versão: '+money(latest.cost_snapshot?.settledMicroeur)+' · reservado '+money(latest.cost_snapshot?.pendingMicroeur)));
  const edit=field('textarea','Texto da ata',latest.content);edit.maxLength=12000;
  minutes.append(e('p','Ata v'+latest.version+' · '+(latest.approved_at?'aprovada em '+time(latest.approved_at):'por aprovar')+' · origem '+(latest.origin==='owner_revision'?'revisão do proprietário':'compilação de relatórios')),edit,
   button('Guardar nova revisão da ata',()=>call('minutes',{text:edit.value}),current.status==='closed'),
   button('Aprovar esta versão da ata',()=>call('approve_minutes',{minute:latest.minute_id},'Aprovar exatamente a versão '+latest.version+' da ata guardada? Alterações no campo só contam depois de guardar uma nova revisão.'),!!latest.approved_at||edit.value!==latest.content));
  const approveButton=minutes.lastElementChild;edit.oninput=()=>{approveButton.disabled=!!latest.approved_at||edit.value!==latest.content;};
  const history=e('details');history.append(e('summary','Histórico de revisões'));
  for(const item of data.minutes||[]){const row=e('details');row.append(e('summary','Versão '+item.version+' · '+time(item.created_at)+(item.approved_at?' · aprovada':'')),e('p',item.content));history.append(row);}minutes.append(history);
  const approved=(data.minutes||[]).find(m=>m.approved_at);
  if(approved){const title=field('input','Decisão proposta');title.maxLength=160;const person=select(current.participants.map(a=>[a,name(a)]),'Responsável pela decisão'),due=field('input','Prazo da decisão');due.type='date';const acceptance=field('textarea','Critério de conclusão');acceptance.maxLength=500;
   minutes.append(e('p','Nova proposta ligada à ata aprovada v'+approved.version),title,person,due,acceptance,button('Registar proposta de decisão',()=>{if(title.value.trim()&&acceptance.value.trim())call('decision',{minute:approved.minute_id,text:title.value.trim(),agent:person.value,dueDate:due.value||null,acceptance:acceptance.value.trim()});}));
  }
 }
 for(const decision of data.decisions||[]){const article=e('article');article.append(e('strong',decision.title),e('p','Critério: '+decision.acceptance),e('p',name(decision.agent)+' · '+({proposed:'proposta',approved:'aprovada',rejected:'rejeitada'}[decision.status])+(decision.due_date?' · prazo '+decision.due_date:'')));
  if(decision.status==='proposed')article.append(button('Aprovar decisão',()=>call('approve_decision',{decision:decision.decision_id},'Aprovar a decisão «'+decision.title+'»? A criação da tarefa é um passo separado.')),button('Rejeitar decisão',()=>call('reject_decision',{decision:decision.decision_id})));
  if(decision.status==='approved')article.append(button(decision.task_id?'Confirmar ligação ao Planeamento':'Criar tarefa no Planeamento',()=>call('plan',{decision:decision.decision_id},'Registar esta decisão aprovada no Planeamento existente? Não será criada uma segunda tarefa com a mesma referência.')),
   e('p',decision.task_id?'Planeamento: '+(decision.taskArchived?'arquivada':decision.taskStatus||'estado indisponível')+' · referência '+decision.task_id:'Ainda não enviada ao Planeamento.'));
  minutes.append(article);
 }
 container.append(minutes);
}
window.ArtEssenciaMeetingRoom={render};
})();
