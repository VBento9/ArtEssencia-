/* ArtEssencia — Consultor IA: painel compacto das Estatísticas Digitais.
 * Sem efeitos comerciais: não publica produtos, preços ou campanhas.
 */
(() => {
 'use strict';
 const ROOT='digitalStats';
 const byId=id=>document.getElementById(id);
 const state=()=>{try{return typeof digitalStatsStateV1795!=='undefined'?digitalStatsStateV1795:null}catch{return null}};
 const range=()=>{try{return typeof digitalStatsRangeV1795==='function'?digitalStatsRangeV1795():null}catch{return null}};
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node};
 const number=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 let busy=false,latest=null,createdFor='';
 function usableData(st){return !!(st?.data?.totals&&st.source&&range()?.from&&range()?.to)}
 function addText(parent,tag,cls,value){const node=el(tag,cls,value);parent.append(node);return node}
 function createAction(a,index){
  const item=el('article','ae-advisor-action');
  const heading=el('div','ae-advisor-action-heading');
  const name=el('strong','',a.title||'Melhoria sugerida');
  const pill=el('span','ae-advisor-priority '+(a.priority==='Alta'?'high':a.priority==='Baixa'?'low':'medium'),(a.priority||'Média')+' · '+(a.area||'Medição'));
  heading.append(name,pill);item.append(heading);
  addText(item,'p','ae-advisor-evidence',a.evidence||'Sem evidência específica.');
  addText(item,'p','ae-advisor-action-text',a.action||'');
  const measure=el('p','ae-advisor-metric');
  addText(measure,'strong','', 'Como medir: ');addText(measure,'span','',a.metric||'Comparar resultados após a alteração.');
  item.append(measure);
  const review=el('button','btn ae-advisor-reviewed','Marcar como analisada');
  review.type='button';review.setAttribute('aria-pressed','false');
  review.addEventListener('click',()=>{
   const on=review.getAttribute('aria-pressed')!=='true';
   review.setAttribute('aria-pressed',String(on));review.textContent=on?'Analisada ✓':'Marcar como analisada';
   item.classList.toggle('reviewed',on);
  });
  item.append(review);
  return item;
 }
 function planText(proposal,source,from,to){
  const lines=['ArtEssencia — Consultor IA',source==='shop'?'Loja Online':'Catálogo Digital','Período: '+from+' a '+to,'',proposal.diagnosis||''];
  for(const [i,a] of (proposal.actions||[]).entries())lines.push('',(i+1)+'. '+a.title+' ['+a.priority+' · '+a.area+']','Observação: '+a.evidence,'Ação: '+a.action,'Acompanhar: '+a.metric);
  if(proposal.limitations)lines.push('','Limitações: '+proposal.limitations);
  lines.push('','Sugestões sujeitas à aprovação humana. A loja permanece fechada a encomendas.');
  return lines.join('\n');
 }
 function renderResult(host,response){
  const p=response?.proposal||{},stamp=response?.generatedAt;
  host.replaceChildren();
  const diagnostic=el('div','ae-advisor-diagnosis');
  addText(diagnostic,'strong','','Diagnóstico do período');
  addText(diagnostic,'p','',p.diagnosis||'Não foi possível estabelecer um diagnóstico fundamentado.');
  host.append(diagnostic);
  if(Array.isArray(p.actions)&&p.actions.length){
   addText(host,'h3','ae-advisor-subheading','Plano de melhoria');
   const list=el('div','ae-advisor-list');
   p.actions.forEach((action,i)=>list.append(createAction(action,i)));
   host.append(list);
  }else addText(host,'p','ae-advisor-empty','Sem ações suficientemente fundamentadas.');
  if(p.limitations)addText(host,'p','ae-advisor-limitations','Limitações da análise: '+p.limitations);
  const footer=el('div','ae-advisor-footer');
  const copy=el('button','btn','Copiar plano');copy.type='button';
  copy.addEventListener('click',async()=>{
   const txt=planText(p,response.source,response.period?.from,response.period?.to);
   try{
    if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
    await navigator.clipboard.writeText(txt);copy.textContent='Plano copiado ✓';
   }catch{copy.textContent='Cópia indisponível neste navegador'}
  });
  footer.append(copy);if(stamp)addText(footer,'small','', 'Gerado em '+new Date(stamp).toLocaleString('pt-PT'));
  host.append(footer);
 }
 async function generate(button,host,status){
  if(busy)return;
  const st=state(),r=range();
  if(!usableData(st)){status.textContent='Atualiza primeiro as Estatísticas Digitais, com uma fonte e período válidos.';return}
  if(!navigator.onLine){status.textContent='É necessária ligação à Internet para consultar a IA.';return}
  busy=true;button.disabled=true;button.textContent='A analisar…';status.textContent='A analisar os indicadores agregados do período selecionado.';
  try{
   if(typeof cloudClient==='undefined'||!cloudClient?.auth?.getSession)throw Error('Liga a sessão Cloud antes de gerar recomendações.');
   const {data:auth,error:authError}=await cloudClient.auth.getSession();
   if(authError||!auth?.session?.access_token)throw Error('É necessária uma sessão Cloud válida.');
   const payload={source:st.source,range:{from:r.from,to:r.to},data:{
    totals:st.data.totals,
    top_products:(st.data.top_products||[]).slice(0,15),
    daily:(st.data.daily||[]).slice(-45)
   }};
   const api=await fetch('/api/digital-insights-ai',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.session.access_token},
    body:JSON.stringify(payload),cache:'no-store'
   });
   const data=await api.json().catch(()=>({}));
   if(!api.ok||!data.ok)throw Error(data.error||'Não foi possível gerar recomendações.');
   latest=data;createdFor=st.source+'|'+r.from+'|'+r.to;
   renderResult(host,data);status.textContent='Análise concluída. As sugestões não alteram os dados nem a loja.';
  }catch(error){status.textContent=String(error?.message||'Falha ao consultar a IA.').slice(0,280)}
  finally{busy=false;button.disabled=false;button.textContent='Gerar recomendações com IA'}
 }
 function init(){
  const root=byId(ROOT),nav=byId('dsNavigationV1966');
  if(!root||!nav||byId('aeAdvisorPanelV1968'))return;
  const panes=root.querySelector('[data-ds-panel]')?.parentElement;if(!panes)return;
  const tab=el('button','ds-tab-v1966','Consultor IA');tab.type='button';
  tab.dataset.dsTab='consultor';tab.setAttribute('aria-selected','false');
  const panel=el('section','ds-panel-v1966 ae-advisor-panel');
  panel.id='aeAdvisorPanelV1968';panel.dataset.dsPanel='consultor';panel.setAttribute('aria-label','Consultor IA');panel.hidden=true;
  const head=el('div','ae-advisor-head');
  const intro=el('div');
  addText(intro,'h3','','Consultor IA · Catálogo e Loja');
  addText(intro,'p','','Sugestões baseadas nos eventos agregados existentes. A IA não publica nem altera produtos.');
  const btn=el('button','btn primary','Gerar recomendações com IA');btn.type='button';
  head.append(intro,btn);panel.append(head);
  const status=el('p','ae-advisor-status','Seleciona um período nas Estatísticas Digitais e escolhe Gerar recomendações.');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  const host=el('div','ae-advisor-results');panel.append(host);
  const quality=el('details','ae-advisor-method');
  const summary=el('summary','','Dados e limites da análise');
  addText(quality,'p','','Envia apenas contagens agregadas e nomes de até 15 produtos, nunca nomes, moradas, emails ou telefones de clientes. O acesso exige autenticação e confirmação de proprietário no servidor. As visualizações não são vendas; dados insuficientes não permitem previsões. A loja mantém-se fechada.');
  quality.prepend(summary);panel.append(quality);
  nav.append(tab);panes.append(panel);
  tab.addEventListener('click',()=>{
   root.querySelectorAll('[data-ds-tab]').forEach(button=>{
    const active=button===tab;button.classList.toggle('selected',active);button.setAttribute('aria-selected',String(active));
   });
   root.querySelectorAll('[data-ds-panel]').forEach(p=>p.hidden=p!==panel);
   nav.scrollIntoView({block:'start',behavior:'smooth'});
  });
  btn.addEventListener('click',()=>generate(btn,host,status));
  function resetForData(){
   const st=state(),r=range();const key=st?.source+'|'+(r?.from||'')+'|'+(r?.to||'');
   if(!usableData(st)){
    status.textContent='Atualiza as Estatísticas Digitais para analisar dados recentes.';
    latest=null;createdFor='';host.replaceChildren();return;
   }
   if(latest&&createdFor!==key){
    latest=null;createdFor='';host.replaceChildren();
    status.textContent='Alteraste a fonte ou o período. Gera uma nova análise para evitar conclusões desatualizadas.';
   }else if(!latest)status.textContent='Dados disponíveis. A geração de recomendações é manual.';
  }
  document.addEventListener('ae:digital-stats-loaded',resetForData);
  document.addEventListener('ae:digital-stats-start',()=>{if(!busy)status.textContent='A atualizar indicadores. Aguarda a conclusão antes de analisar.'});
  resetForData();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
