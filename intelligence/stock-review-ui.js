/* Intelligence Hybrid — revisão local, somente leitura, sem persistência. */
(function(){
'use strict';
const script=document.currentScript;
if(!script)return;
const base=new URL('.',script.src);
const load=name=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(name,base).href;s.onload=resolve;s.onerror=()=>reject(Error('Motor indisponível'));document.head.append(s);});
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
let dependencies;
function engines(){return dependencies||(dependencies=Promise.all(['review-guard.js','control-core.js','inventory-audit.js','stock-organizer.js'].map(load)).catch(e=>{dependencies=null;throw e;}));}
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
 root.append(title,notice,label,actions,output);anchor.after(root);
 let generation=0,running=false;
 function state(owner){
  const meta=typeof cloudMeta==='function'?cloudMeta():{};
  return {unlocked:typeof unlocked!=='undefined'&&unlocked===true,authHidden:document.getElementById('authGateV1880')?.classList.contains('hidden')===true,lockHidden:document.getElementById('lockScreen')?.classList.contains('hidden')===true,online:navigator.onLine===true,cloudReady:typeof cloudStartupDone!=='undefined'&&cloudStartupDone===true&&typeof cloudUser!=='undefined'&&!!cloudUser?.id,verified:meta.verified===true,dirty:meta.dirty,conflict:meta.conflict,busy:typeof cloudBusy==='undefined'||cloudBusy||cloudApplying||cloudHydrating||cloudPushRunning,owner};
 }
 function clear(message='Agente desligado.'){generation++;enabled.checked=false;running=false;audit.disabled=true;output.replaceChildren(node('p',message));}
 enabled.onchange=()=>{if(!enabled.checked)return clear();generation++;output.replaceChildren(node('p','Ativo nesta sessão. A análise exige Cloud validada.'));audit.disabled=false;};
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