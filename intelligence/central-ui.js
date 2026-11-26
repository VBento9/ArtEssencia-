/* ArtEssencia Intelligence — central de gestão, preview local sem execução. */
(function(){
'use strict';
const script=document.currentScript;if(!script)return;
const base=new URL('.',script.src);
const labels={director:'Diretor Geral',stock:'Stock',producao:'Produção',financeiro:'Financeiro',comercial:'Comercial',marketing:'Marketing',inovacao:'Inovação',catalogo:'Catálogo',auditoria:'Auditoria'};
const kinds={director:['daily_priority_plan'],stock:['inventory_audit','inventory_count_plan','stock_organization_plan','stock_rename_plan','stock_merge_batch_plan'],producao:['production_plan','inventory_audit'],financeiro:['finance_review'],comercial:['commercial_review'],marketing:['marketing_plan'],inovacao:['innovation_review'],catalogo:['catalog_review'],auditoria:['technical_review','inventory_audit']};
const names={daily_priority_plan:'Plano de prioridades',inventory_audit:'Auditoria de inventário',inventory_count_plan:'Contagem física',stock_organization_plan:'Organização de materiais',stock_rename_plan:'Normalização de nomes',stock_merge_batch_plan:'Consolidação de duplicados',production_plan:'Planeamento de produção',finance_review:'Análise financeira',commercial_review:'Seguimento comercial',marketing_plan:'Planeamento de marketing',innovation_review:'Revisão de conceitos',catalog_review:'Revisão de catálogo',technical_review:'Auditoria técnica'};
const modes=[['off','Desligado'],['manual','Manual'],['semi','Semiautomático'],['auto','Automático']];
const el=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;return e;};
const btn=(label,fn)=>{const b=el('button',label);b.type='button';b.className='btn';b.onclick=fn;return b;};
const select=(options,label)=>{const s=el('select');s.setAttribute('aria-label',label);for(const [v,t] of options){const o=el('option',t);o.value=v;s.append(o);}return s;};
let dependency;
function loadCore(){
 if(globalThis.ArtEssenciaIntelligence)return Promise.resolve(globalThis.ArtEssenciaIntelligence);
 return dependency||(dependency=new Promise((resolve,reject)=>{const s=el('script');s.src=new URL('control-core.js',base).href;s.onload=()=>globalThis.ArtEssenciaIntelligence?resolve(globalThis.ArtEssenciaIntelligence):reject(Error('Núcleo indisponível'));s.onerror=()=>reject(Error('Núcleo indisponível'));document.head.append(s);}).catch(e=>{dependency=null;throw e;}));
}
function localUnlocked(){
 return typeof unlocked!=='undefined'&&unlocked===true&&document.getElementById('authGateV1880')?.classList.contains('hidden')===true&&document.getElementById('lockScreen')?.classList.contains('hidden')===true;
}
function init(){
 const anchor=document.querySelector('#dashboard .dashboard-hero');
 if(!anchor||document.getElementById('aeIntelligenceCentral'))return;
 const root=el('section');root.id='aeIntelligenceCentral';root.className='card';root.style.cssText='margin:10px 0;min-width:0';
 const heading=el('div');heading.style.cssText='display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px';
 const title=el('h3','ArtEssencia Intelligence');title.style.margin='0';
 const body=el('div');body.hidden=true;
 const toggle=btn('Abrir central de agentes',()=>open());toggle.setAttribute('aria-expanded','false');
 heading.append(title,toggle);root.append(heading,el('small','Pré-visualização de desenvolvimento · IA e gravação Cloud indisponíveis.'),body);anchor.after(root);
 let core=null,settings=null,missionList=[],generation=0,opened=false;
 function reset(){generation++;opened=false;settings=null;missionList=[];body.replaceChildren();body.hidden=true;toggle.disabled=false;toggle.textContent='Abrir central de agentes';toggle.setAttribute('aria-expanded','false');}
 async function open(){
  if(opened)return reset();
  if(!localUnlocked())return;
  const ticket=++generation;toggle.disabled=true;
  try{const loaded=await loadCore();if(ticket!==generation||!localUnlocked())return;core=loaded;settings=core.defaults();opened=true;body.hidden=false;toggle.textContent='Fechar e limpar central';toggle.setAttribute('aria-expanded','true');render();}
  catch(e){if(ticket===generation){body.hidden=false;body.replaceChildren(el('p','Central indisponível. Nenhum agente foi ativado.'));}}
  finally{if(ticket===generation)toggle.disabled=false;}
 }
 function render(){
  if(!opened||!settings||!localUnlocked())return reset();
  body.replaceChildren();
  const overview=el('p','Orçamento máximo: 30,00 € / mês · bloqueio preventivo: 23,00 € · faturação real: indisponível.');
  overview.style.fontSize='12px';body.append(overview);
  const master=el('input');master.type='checkbox';master.checked=settings.enabled;master.setAttribute('aria-label','Ativar simulação da equipa');
  const ml=el('label');ml.append(master,document.createTextNode(' Ativar simulação da equipa nesta sessão'));body.append(ml);
  master.onchange=()=>{settings.enabled=master.checked;if(!settings.enabled){for(const k of Object.keys(settings.agents))settings.agents[k]='off';missionList=missionList.map(m=>m.status==='pending'?{...m,status:'cancelled'}:m);}render();};
  const grid=el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:8px;margin:10px 0';
  for(const agent of core.agents){
   const card=el('div');card.style.cssText='border:1px solid #b9a99a;border-radius:10px;padding:9px;min-width:0;display:grid;gap:6px';
   const mode=select(modes,'Modo de '+labels[agent]);mode.value=settings.agents[agent];mode.disabled=!settings.enabled;
   mode.onchange=()=>{settings.agents[agent]=mode.value;if(mode.value==='off')missionList=missionList.map(m=>m.agent===agent&&m.status==='pending'?{...m,status:'cancelled'}:m);render();};
   card.append(el('strong',labels[agent]),mode);grid.append(card);
  }
  body.append(grid);
  const form=el('form');form.style.cssText='display:grid;gap:8px;margin:12px 0';
  const agent=select(Object.entries(labels),'Agente destinatário');
  const kind=select([],'Tipo de missão');
  const instruction=el('textarea');instruction.rows=3;instruction.maxLength=4000;instruction.placeholder='Descreve o trabalho (apenas dados fictícios).';instruction.setAttribute('aria-label','Instruções da missão');
  const send=el('button','Preparar missão local');send.className='btn';send.type='submit';
  const feedback=el('p');feedback.setAttribute('aria-live','polite');
  const refreshKinds=()=>{kind.replaceChildren();for(const k of kinds[agent.value]||[]){const o=el('option',names[k]);o.value=k;kind.append(o);}send.disabled=!settings.enabled||settings.agents[agent.value]==='off';};
  agent.onchange=refreshKinds;refreshKinds();form.append(el('h4','Central de delegação'),agent,kind,instruction,send,feedback);
  form.onsubmit=e=>{e.preventDefault();if(!localUnlocked())return reset();try{const text=instruction.value.trim();if(!text)throw Error('Indica o trabalho a preparar.');if(missionList.length>=30)throw Error('Limite de missões locais atingido.');const id='preview-'+crypto.randomUUID();const m=core.createMission(settings,{id,agent:agent.value,kind:kind.value});missionList.push({...m,instruction:text});render();}catch(err){feedback.textContent=err.message||'Missão bloqueada.';}};
  body.append(form);
  body.append(el('h4','Missões locais ('+missionList.length+')'));
  if(!missionList.length)body.append(el('p','Ainda não existem missões nesta sessão.'));
  for(const m of missionList.slice().reverse()){
   const card=el('div');card.style.cssText='border-top:1px solid #b9a99a;padding:8px 0;overflow-wrap:anywhere';
   card.append(el('strong',labels[m.agent]+' · '+names[m.kind]),el('p',m.instruction),el('small',m.status==='cancelled'?'Cancelada':'Preparada — não enviada, não executada'));
   if(m.status==='pending')card.append(btn('Cancelar missão',()=>{missionList=missionList.map(x=>x.id===m.id?{...x,status:'cancelled'}:x);render();}));
   body.append(card);
  }
  body.append(el('p','Documentos, histórico Cloud e execução por IA: ainda não disponíveis.'),btn('Desligar equipa e limpar sessão',reset));
 }
 const observer=new MutationObserver(()=>{if(!localUnlocked())reset();});
 for(const id of ['authGateV1880','lockScreen']){const e=document.getElementById(id);if(e)observer.observe(e,{attributes:true,attributeFilter:['class']});}
 window.addEventListener('pagehide',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});window.addEventListener('offline',reset);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
