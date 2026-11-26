/* Intelligence Hybrid — revisão local, somente leitura, sem persistência. */
(function(){
'use strict';
const script=document.currentScript;
if(!script)return;
const base=new URL('.',script.src);
const load=name=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(name,base).href;s.onload=resolve;s.onerror=()=>reject(Error('Motor indisponível'));document.head.append(s);});
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
let dependencies;
function engines(){return dependencies||(dependencies=Promise.all(['review-guard.js','control-core.js','inventory-audit.js','stock-organizer.js','batch-review.js'].map(load)).catch(e=>{dependencies=null;throw e;}));}
function init(){
 const anchor=document.querySelector('#stock .stock-hero');
 if(!anchor||document.getElementById('aeIntelligenceStockPreview'))return;
 const root=node('section');root.id='aeIntelligenceStockPreview';root.className='card';root.style.margin='10px 0';root.style.minWidth='0';
 const title=node('h3','ArtEssencia Intelligence — Stock');
 const notice=node('p','Pré-visualização de leitura · sem IA paga · sem alterações ao inventário.');
 const enabled=node('input');enabled.type='checkbox';enabled.checked=false;const label=node('label');label.append(enabled,document.createTextNode(' Ativar agente nesta sessão'));
 const audit=node('button','Analisar inventário e fichas');audit.type='button';audit.className='btn';audit.disabled=true;
 const stop=node('button','Desligar e limpar');stop.type='button';stop.className='btn';
 const output=node('div','Agente desligado.');output.setAttribute('aria-live','polite');
 const actions=node('div');actions.style.display='flex';actions.style.flexWrap='wrap';actions.style.gap='8px';actions.append(audit,stop);
 const countBox=node('section');countBox.hidden=true;
 const countTitle=node('h4','Delegar contagem física');const countHelp=node('p','Uma linha por material: nome; quantidade; unidade. Indica o saldo físico total, não uma compra.');
 const countInput=node('textarea');countInput.setAttribute('aria-label','Lista de inventário físico');countInput.placeholder='Cera de soja; 1; kg';countInput.rows=5;countInput.style.width='100%';
 const prepare=node('button','Preparar revisão');prepare.type='button';prepare.className='btn';const batchOutput=node('div');batchOutput.setAttribute('aria-live','polite');
 countBox.append(countTitle,countHelp,countInput,prepare,batchOutput);root.append(title,notice,label,actions,output,countBox);anchor.after(root);
 let generation=0,running=false,batch=null,batchGeneration=0;
 function state(owner){
  const meta=typeof cloudMeta==='function'?cloudMeta():{};
  return {unlocked:typeof unlocked!=='undefined'&&unlocked===true,authHidden:document.getElementById('authGateV1880')?.classList.contains('hidden')===true,lockHidden:document.getElementById('lockScreen')?.classList.contains('hidden')===true,online:navigator.onLine===true,cloudReady:typeof cloudStartupDone!=='undefined'&&cloudStartupDone===true&&typeof cloudUser!=='undefined'&&!!cloudUser?.id,verified:meta.verified===true,dirty:meta.dirty,conflict:meta.conflict,busy:typeof cloudBusy==='undefined'||cloudBusy||cloudApplying||cloudHydrating||cloudPushRunning,owner};
 }
 function clear(message='Agente desligado.'){generation++;batchGeneration++;batch=null;countInput.value='';countBox.hidden=true;batchOutput.replaceChildren();prepare.disabled=false;enabled.checked=false;running=false;audit.disabled=true;output.replaceChildren(node('p',message));}
 enabled.onchange=()=>{if(!enabled.checked)return clear();generation++;output.replaceChildren(node('p','Ativo nesta sessão. A análise exige Cloud validada.'));audit.disabled=false;countBox.hidden=false;};
 stop.onclick=()=>clear();
 const lockObserver=new MutationObserver(()=>{const s=state(false);if(!s.unlocked||!s.authHidden||!s.lockHidden)clear();});
 for(const id of ['authGateV1880','lockScreen']){const e=document.getElementById(id);if(e)lockObserver.observe(e,{attributes:true,attributeFilter:['class']});}
 window.addEventListener('pagehide',()=>clear());
 window.addEventListener('offline',()=>clear('Sem ligação. Agente desligado.'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 function section(label,items,describe){
  const h=node('h4',label+' ('+items.length+')');output.append(h);
  if(!items.length){output.append(node('p','Sem ocorrências nesta análise.'));return;}
  const list=node('ul');for(const x of items.slice(0,60))list.append(node('li',describe(x)));output.append(list);
  if(items.length>60)output.append(node('p','A apresentar 60 de '+items.length+' ocorrências.'));
 }

 async function ownerContext(ticket){
  await engines();const g=globalThis.ArtEssenciaReviewGuard;
  if(ticket!==batchGeneration||!enabled.checked||!g.allowed(state(true)))throw Error('Agente desligado ou Cloud por validar.');
  const c=initCloudClient(),id=cloudUser?.id;
  if(!c||!id)throw Error('Sessão indisponível.');
  const u=await c.auth.getUser();if(u.error||u.data?.user?.id!==id)throw Error('Sessão inválida.');
  const owner=await c.rpc('artessencia_is_owner_v1');
  if(ticket!==batchGeneration||!enabled.checked||owner.error||owner.data!==true||cloudUser?.id!==id||!g.allowed(state(true)))throw Error('Sessão ou sincronização alterada.');
  const revision=Number(cloudMeta().remoteRevision);
  if(!Number.isSafeInteger(revision)||revision<0)throw Error('Revisão Cloud indisponível.');
  return {owner:id,revision,stock:g.snapshot(db).stock,core:globalThis.ArtEssenciaIntelligence,at:new Date().toISOString()};
 }
 countInput.oninput=()=>{batchGeneration++;batch=null;prepare.disabled=false;batchOutput.replaceChildren(node('p','Lista alterada. Prepara uma nova revisão.'));};
 function renderBatch(){
  batchOutput.replaceChildren();
  if(!batch)return;
  if(batch.status==='approved_preview'){
   batchOutput.append(node('p',batch.approved.length+' ajustes aprovados para pré-visualização. Nenhum movimento foi gravado.'));
   for(const a of batch.approved)batchOutput.append(node('p',a.name+' · '+a.before+' → '+a.after+' '+a.unit));
   const download=node('button','Exportar relatório de revisão');download.type='button';download.className='btn';
   download.onclick=async()=>{const ticket=batchGeneration,chosen=batch;try{await ownerContext(ticket);if(ticket!==batchGeneration||batch!==chosen)return;const body=JSON.stringify(globalThis.ArtEssenciaBatchReview.exportDecision(chosen),null,2);const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));const a=node('a');a.href=url;a.download='ArtEssencia-revisao-inventario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){if(ticket===batchGeneration)batchOutput.append(node('p','Exportação bloqueada.'));}};
   batchOutput.append(download);
  }else if(batch.status==='review'){
   const selected=new Map(),statusLabels={balance_review:'Saldo contado',new_material_review:'Novo material — por validar',name_review:'Nome por validar',ambiguous:'Duplicado possível',invalid:'Linha inválida',unit_or_balance_review:'Unidade ou saldo por validar'};
   batchOutput.append(node('p','Seleciona os ajustes inequívocos. As restantes linhas ficam por resolver.'));
   for(const row of batch.plan){const l=node('label');l.style.display='block';const ck=node('input');ck.type='checkbox';ck.disabled=row.status!=='balance_review'||row.delta===0;ck.checked=false;selected.set(row.index,ck);l.append(ck,document.createTextNode(' '+row.name+' · '+(statusLabels[row.status]||row.status)+(row.status==='balance_review'?' · '+row.current+' → '+row.counted+' '+row.unit:'')));batchOutput.append(l);}
   const approve=node('button','Aprovar seleção (sem gravar)');approve.type='button';approve.className='btn';batchOutput.append(approve);
   approve.onclick=async()=>{const ticket=batchGeneration,chosen=batch;approve.disabled=true;try{const context=await ownerContext(ticket);if(ticket!==batchGeneration||batch!==chosen)return;batch=globalThis.ArtEssenciaBatchReview.decide(chosen,{...context,allowed:true,selected:[...selected].filter(([,ck])=>ck.checked&&!ck.disabled).map(([i])=>i)});renderBatch();}catch(e){if(ticket===batchGeneration){batchOutput.append(node('p',e.message||'Aprovação bloqueada.'));approve.disabled=false;}}};
  }
  const cancel=node('button','Cancelar revisão');cancel.type='button';cancel.className='btn';
  cancel.onclick=()=>{batchGeneration++;batch=globalThis.ArtEssenciaBatchReview.cancel(batch,new Date().toISOString());batchOutput.replaceChildren(node('p','Revisão cancelada.'));prepare.disabled=false;};
  batchOutput.append(cancel);
 }
 prepare.onclick=async()=>{const ticket=++batchGeneration;batch=null;prepare.disabled=true;batchOutput.replaceChildren(node('p','A validar sessão e contagem…'));try{const context=await ownerContext(ticket);if(ticket!==batchGeneration)return;batch=globalThis.ArtEssenciaBatchReview.create({...context,id:'count-'+Date.now(),text:countInput.value});renderBatch();}catch(e){if(ticket===batchGeneration)batchOutput.replaceChildren(node('p',e.message||'Não foi possível preparar a revisão.'));}finally{if(ticket===batchGeneration)prepare.disabled=false;}};

 audit.onclick=async()=>{
  if(!enabled.checked||running)return;
  const ticket=++generation;running=true;audit.disabled=true;output.replaceChildren(node('p','A validar sessão e estado da Cloud…'));
  try{
   await engines();const g=globalThis.ArtEssenciaReviewGuard;
   if(ticket!==generation||!enabled.checked)return;
   if(!g.allowed(state(true)))throw Error('É necessário desbloquear o Backoffice e concluir a sincronização Cloud sem conflitos.');
   const c=initCloudClient(),expected=cloudUser?.id;
   if(!c||!expected)throw Error('Sessão indisponível.');
   const user=await c.auth.getUser();
   if(user.error||user.data?.user?.id!==expected)throw Error('Sessão não validada.');
   const owner=await c.rpc('artessencia_is_owner_v1');
   if(ticket!==generation||!enabled.checked)return;
   if(owner.error||owner.data!==true||cloudUser?.id!==expected||!g.allowed(state(true)))throw Error('Acesso reservado ao proprietário com Cloud sincronizada.');
   const snapshot=g.snapshot(db);
   const core=globalThis.ArtEssenciaIntelligence,settings=core.defaults();settings.enabled=true;settings.agents.stock='manual';
   const mission=core.createMission(settings,{id:'stock-review-'+Date.now(),agent:'stock',kind:'inventory_audit'});
   const report=core.runMission(settings,mission,snapshot,globalThis.ArtEssenciaInventoryAudit.auditInventory).result;
   const organizer=globalThis.ArtEssenciaStockOrganizer;
   const classifications=organizer.classify(snapshot.stock).filter(x=>x.suggestedCategory&&x.suggestedCategory!==x.currentCategory);
   const duplicates=organizer.duplicates(snapshot.stock);
   if(ticket!==generation||!enabled.checked||!g.allowed(state(true)))return clear('Análise cancelada: estado alterado.');
   output.replaceChildren(node('p',new Date().toLocaleString('pt-PT')+' · '+report.stockCount+' materiais · '+report.productCount+' produtos · '+report.recipeLines+' linhas de ficha.'));
   const labels={material_sem_nome:'Material sem nome',unidade_por_validar:'Unidade por validar',quantidade_por_validar:'Quantidade por validar',custo_por_validar:'Custo por validar',possivel_duplicado:'Possível duplicado',codigo_produto_duplicado:'Código duplicado',ficha_sem_produto:'Ficha sem produto',ficha_invalida:'Ficha inválida',ficha_vazia_por_rever:'Ficha vazia por rever',quantidade_ficha_por_validar:'Quantidade de ficha por validar',unidade_ficha_incompativel:'Unidade incompatível',referencia_ambigua:'Referência ambígua',referencia_nao_encontrada:'Referência não encontrada',ficha_instalada_ausente_por_rever:'Ficha instalada ausente por rever'};
   section('Auditoria',report.issues,x=>[labels[x.kind]||x.kind,x.name,x.code].filter(Boolean).join(' · '));
   section('Categorias sugeridas',classifications,x=>x.name+' → '+x.suggestedCategory);
   section('Candidatos a duplicados',duplicates,x=>x.rows.map(r=>r.name).join(' / '));
   output.append(node('p','Resultado apenas consultivo. Nenhuma alteração, tarefa, fusão ou chamada de IA realizada.'));
  }catch(e){if(ticket===generation)output.replaceChildren(node('p','Análise não concluída. '+(e instanceof Error?e.message:'Verifica a sessão e a ligação.')));}
  finally{if(ticket===generation){running=false;audit.disabled=!enabled.checked;}}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();