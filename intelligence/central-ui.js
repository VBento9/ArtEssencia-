/* Central ArtEssencia Intelligence */
(function(){
'use strict';
const labels={director:'Diretor Geral',stock:'Stock',producao:'Produção',financeiro:'Financeiro',comercial:'Comercial',marketing:'Marketing',inovacao:'Inovação',catalogo:'Catálogo',auditoria:'Auditoria'};
const trainingOverview={"version":"AE-FORM-1.0.0","profiles":{"director":{"modules":"Central, Planeamento, Objetivos, Desempenho","procedures":["Ordena prioridades por risco, compromisso, prazo e evidência; não inventes urgências.","Consulta relatórios disponíveis, evita repetir tarefas existentes e delega no máximo uma missão por departamento autorizado.","Define um resultado verificável, responsável e critério de conclusão; acompanha bloqueios e recibos, sem declarar execução não confirmada."],"quality":"Plano exequível, sem duplicados, com destinatários ativos e decisões pendentes explícitas.","exercise":"Distribuir a revisão de um inventário fictício ao Stock e validar o recibo da missão e das tarefas."},"stock":{"modules":"Stock, compras, fichas técnicas, Central","procedures":["Distingue identidade do material, quantidade comprada e saldo físico confirmado. Uma fotografia ou fatura não comprova saldo atual.","Confirma unidade e identidade antes de propor criação, normalização ou fusão. Não confundas cera de alto/baixo ponto de fusão, fragrâncias, resinas ou embalagens semelhantes.","Mostra impacto em fichas, custo, movimentos e histórico. Bloqueia referências ambíguas, saldos duplicados e revisões antigas; preserva identificadores e recibos."],"quality":"Inventário rastreável, unidades compatíveis e nenhuma quantidade inferida. Biblioteca de Fragrâncias independente.","exercise":"Comparar contagem fictícia com stock e separar material novo, duplicado potencial e diferença de saldo."},"producao":{"modules":"Encomendas, Produção, Stock, fichas técnicas","procedures":["Distingue encomendas confirmadas, em produção, prontas e pagas; pagamento e produção são estados diferentes.","Usa as fichas técnicas e os consumos canónicos. Confirma variantes, cores, fragrâncias, embalagem, quantidades e disponibilidade; não dupliques consumos de peças já produzidas.","Planeia por prazo confirmado, necessidades e capacidade comprovada. Sinaliza falta de materiais e ensaios de qualidade; não declares peças prontas automaticamente."],"quality":"Necessidades verificáveis, tarefas por prazo e sem movimentos duplicados.","exercise":"Calcular necessidades fictícias para uma encomenda e identificar uma ficha incompleta."},"financeiro":{"modules":"Caixa, custos, Mapa de Fundos, relatórios","procedures":["Usa fórmulas canónicas e distingue custos de materiais, embalagem, trabalho, extras, fixos e lucro. Não inventes valores em falta.","Distingue vendas, valores pagos, pendentes e movimentos de caixa. Identifica margem sobre venda versus acréscimo sobre custo.","Reconcilia períodos e recibos; aponta divergências e propõe revisão. Não alters preços, pagamentos ou repartições."],"quality":"Cálculos reproduzíveis, fontes claras e lacunas assinaladas.","exercise":"Rever margem de um produto fictício e identificar uma venda com pagamento pendente."},"comercial":{"modules":"Orçamentos, pedidos, encomendas","procedures":["Distingue pedido de informação, orçamento em rascunho, enviado, aceite e convertido; não transformes um pedido em venda.","Confirma produtos, quantidades, variantes, validade, entrega e condições de pagamento no editor existente; assinala informação em falta.","Prepara propostas internas ligadas à origem, valida se esta mudou e exige aprovação para envio ou conversão. Não incluas dados pessoais desnecessários."],"quality":"Proposta rastreável sem preços inventados nem contacto não autorizado.","exercise":"Preparar seguimento interno de um orçamento fictício enviado e bloquear uma origem alterada."},"marketing":{"modules":"Publicações, edições especiais, estatísticas digitais","procedures":["Mantém linguagem PT-PT, identidade artesanal rústica/minimalista e comunicação clara, sem alegações não verificadas.","Adapta conteúdo à ocasião, às fotografias e aos atributos reais do produto. Não inventes fragrâncias, cores, disponibilidade ou descontos.","Distingue calendário editorial, métricas reais e hipóteses. Propõe conteúdo e campanhas para revisão, sem publicação ou despesa."],"quality":"Conteúdos coerentes com produto e marca, com objetivo mensurável e aprovação.","exercise":"Preparar um plano de publicação para uma edição sazonal fictícia sem lançar publicidade."},"inovacao":{"modules":"Conceitos, fichas técnicas, produção, custos","procedures":["Propõe diferenciação artesanal concreta; não afirmes exclusividade mundial sem evidência.","Avalia materiais, viabilidade, custo, execução repetível, segurança e apresentação antes de recomendar lançamento.","Separa conceito, protótipo, ensaio e produto aprovado. Para velas, exige validação do conjunto cera/pavio/recipiente e ensaios de queima; não inventes limites de fragrância."],"quality":"Conceito distintivo com plano de ensaios e custos por validar; sem alegações de segurança prematuras.","exercise":"Avaliar um conceito fictício de vela diferenciada e listar ensaios antes da venda."},"catalogo":{"modules":"Produtos, Catálogo Digital, Loja Online, coleções","procedures":["Compara Backoffice e serviço público por código e identificador; assinala correspondências ambíguas.","Confirma fotografias, descrição, família, coleções, opções e disponibilidade. Uma referência de imagem não prova carregamento ou apresentação visual.","Respeita edições exclusivas e estado fechado da Loja; propõe correções sem publicar, modificar preços ou reabrir encomendas."],"quality":"Divergências rastreáveis e cobertura explícita de serviço público versus apresentação nos sites.","exercise":"Comparar um catálogo fictício com fotografia em falta e confirmar encomendas bloqueadas."},"auditoria":{"modules":"Auditoria, Cloud, Planeamento, recibos, controlo financeiro","procedures":["Classifica risco por impacto, distingue falha comprovada de teste não realizado e identifica versão ou revisão da evidência.","Confirma autorização, atomicidade, idempotência, recuperação, sincronização e ausência de efeitos externos; nunca exponhas credenciais.","Distingue testes locais, Cloud isolada e PWA instaladas. Exige correção e novo ensaio antes de recomendar entrada em produção."],"quality":"Relatório com evidência, gravidade, correção proposta e critérios de aceitação.","exercise":"Auditar uma interrupção fictícia e comprovar que não duplica tarefas ou despesas."}}};
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
 let opened=false,generation=0,state=null,busy=false,recipient='director',stockPreview=null;
 function close(){stockPreview=null;generation++;recipient='director';opened=false;busy=false;state=null;content.replaceChildren();body.hidden=true;notice.textContent='';toggle.textContent='Abrir central de agentes';}
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
   if(action==='stock_change_preview')stockPreview={mission:args.mission,request:args,result:receipt,operationId:crypto.randomUUID()};
   else stockPreview=null;
   state=data;notice.textContent=action==='professional_assess'?'Avaliação profissional registada. Não altera permissões.':action==='commercial_approve'?'Proposta interna guardada em Orçamentos. Nenhum contacto enviado.':['stock_change_apply','stock_change_revert'].includes(action)?'Operação confirmada na Cloud. Recebe e valida os dados antes de editar.':action==='repair_recipe_reference'?'Referência confirmada na ficha técnica. Recebe e valida a Cloud antes de editar.':action==='create_material'?'Material confirmado na Cloud. Recebe e valida os dados da Cloud antes de alterar o stock.':action==='plan_task'?(receipt.status==='archived'?'A tarefa já foi arquivada.':'Tarefa confirmada no Planeamento.'):'';
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
    if(area==='Funcionários'){
     const p=trainingOverview.profiles[key],details=el('details');
     details.append(el('summary','Formação profissional · '+trainingOverview.version),el('p','Módulos: '+p.modules));
     const ul=el('ul');for(const procedure of p.procedures)ul.append(el('li',procedure));details.append(ul);
     details.append(el('p','Critério de qualidade: '+p.quality),el('p','Exercício de integração: '+p.exercise));
     const trained=state.documents.find(d=>d.agent===key&&d.professional_training?.version===trainingOverview.version);
     details.append(el('p',trained?'Instruções registadas numa missão. Competência prática por avaliar.':'Formação definida; aplicação nesta versão ainda por confirmar.'));
     const evaluations=(state.assessments||[]).filter(x=>x.agent===key&&x.training_version===trainingOverview.version);
     if(evaluations.length){
      const latest=evaluations[0];
      details.append(el('p','Última avaliação: '+latest.score+'% · '+(latest.verdict==='review_pass'?'Resultado satisfatório nesta missão':'Requer correção e nova avaliação')),
       el('p',latest.evidence_kind==='simulation'?'Ensaio simulado — não certifica competência real.':'Origem do fornecedor por validar — não certifica competência real.'),el('p',latest.feedback));
     }
     content.append(details);
    }
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
    if(d.professional_training?.kind==='instructions_applied'){
     line('Formação '+d.professional_training.version+' · instruções registadas · avaliação pelo administrador');
     const evaluation=el('details');evaluation.append(el('summary','Avaliar trabalho entregue'));
     evaluation.append(el('p','Critério do departamento: '+d.professional_training.quality));
     const criteria=[['technical','Correção técnica',30],['procedures','Procedimentos',25],['quality','Qualidade da entrega',20],['safety','Segurança e permissões',15],['efficiency','Organização e eficiência',10]];
     const inputs={};
     for(const [key,label,weight] of criteria){
      const row=el('label',label+' ('+weight+'%) '),field=el('input');
      field.type='number';field.min='0';field.max='100';field.step='1';field.setAttribute('aria-label',label+' de '+d.mission_id);
      row.style.display='block';row.append(field);inputs[key]=field;evaluation.append(row);
     }
     const critical=el('input');critical.type='checkbox';const criticalLabel=el('label',' Falha crítica de segurança');criticalLabel.prepend(critical);
     const feedback=el('textarea');feedback.placeholder='Justificação, erros e correções a aplicar';feedback.maxLength=2000;feedback.setAttribute('aria-label','Justificação da avaliação');
     evaluation.append(criticalLabel,feedback,el('p','Mínimo 85% e segurança ≥ 85; uma falha crítica impede resultado satisfatório. Não concede autonomia.'));
     const assessmentId=crypto.randomUUID();
     evaluation.append(btn('Registar avaliação',()=>{
      const scores=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()===''?NaN:Number(v.value)]));
      if(Object.values(scores).some(v=>!Number.isInteger(v)||v<0||v>100)||!feedback.value.trim()){notice.textContent='Preenche as cinco classificações e a justificação.';return;}
      if(window.confirm('Registar esta avaliação profissional? Não modifica permissões nem autoriza trabalho real.'))load('professional_assess',{id:assessmentId,mission:d.mission_id,scores,critical:critical.checked,feedback:feedback.value.trim(),confirmed:true});
     }));
     for(const e of (state.assessments||[]).filter(x=>x.mission_id===d.mission_id)){
      evaluation.append(el('p',e.score+'% · '+(e.verdict==='review_pass'?'Resultado satisfatório':'Requer formação')+' · '+(e.evidence_kind==='simulation'?'Simulação':'Fornecedor por validar')+' · '+e.created_at),el('p',e.feedback));
     }
     content.append(evaluation);
    }
    if(d.agent==='stock'&&list.some(m=>m.mission_id===d.mission_id&&['inventory_audit','stock_organization_plan'].includes(m.kind))){
     content.append(el('h4','Analisar renomeação ou consolidação'));
     const op=select([['rename','Renomear material'],['merge','Consolidar dois materiais']],'Operação de stock');
     const source=el('input'),target=el('input');
     source.placeholder='Nome atual exato';source.setAttribute('aria-label','Material de origem');
     target.placeholder='Nome final exato';target.setAttribute('aria-label','Material de destino');
     const identity=el('input');identity.type='checkbox';
     const balance=el('input');balance.type='checkbox';
     const l1=el('label',' Confirmei que são o mesmo material. '),l2=el('label',' Confirmei que os saldos são físicos e distintos, sem duplicação. ');
     l1.prepend(identity);l2.prepend(balance);
     function update(){l1.hidden=l2.hidden=op.value!=='merge';}op.onchange=update;update();
     content.append(op,source,target,l1,l2,btn('Analisar impacto sem alterar stock',()=>{
      if(!source.value.trim()||!target.value.trim())return;
      load('stock_change_preview',{mission:d.mission_id,operation:op.value,source:source.value.trim(),target:target.value.trim(),identityConfirmed:identity.checked,balanceMode:balance.checked?'distinct_physical_balances':'unverified'});
     }));
     if(stockPreview?.mission===d.mission_id){
      const p=stockPreview.result;
      line(p.source+' → '+p.target+' · revisão '+p.sourceRevision+' · '+(p.status==='review'?'Simulação sem bloqueios identificados':'Operação bloqueada'));
      line('Fichas afetadas: '+p.productsAffected+' · linhas: '+p.recipeLines+' · referências em produtos/encomendas/orçamentos: '+p.relatedProductRecords+'/'+p.relatedOrderRecords+'/'+p.relatedQuoteRecords);
      line('Saldo origem: '+(p.sourceQty??'por validar')+' · saldo destino: '+(p.targetQty??'—')+' · unidade: '+(p.unit??'por validar'));
      if(p.proposedQty!==null)line('Saldo simulado: '+p.proposedQty+' '+p.unit+' · valor simulado: '+p.inventoryValue+' €');
      for(const reason of p.blockers||[])line('Bloqueio: '+reason.replaceAll('_',' '));
      line('Esta análise não grava alterações e não constitui aprovação de execução.');
      if(p.status==='review'&&p.executionEnabled===true){
       const pending=stockPreview;
       content.append(btn('Confirmar e gravar '+(p.operation==='merge'?'consolidação':'renomeação'),()=>{
        if(window.confirm('Confirmas '+p.source+' → '+p.target+'? Saldo final '+p.proposedQty+' '+p.unit+', '+p.recipeLines+' referências e valor '+p.inventoryValue+' €. Esta operação altera o Stock canónico.'))load('stock_change_apply',{request:pending.request,preview:p,operationId:pending.operationId,confirmed:true});
       }));
      }else if(p.status==='review')line('Execução desligada até validação técnica.');
     }
    }
    for(const receipt of d.stock_change_receipts||[]){
     line('Recibo '+receipt.source+' → '+receipt.target+' · revisão '+receipt.revision+(receipt.revertedRevision?' · revertida na revisão '+receipt.revertedRevision:''));
     if(!receipt.revertedRevision)content.append(btn('Pedir reversão do recibo',()=>{
      if(window.confirm('Reverter '+receipt.source+' → '+receipt.target+'? Apenas é possível sem alterações posteriores.'))load('stock_change_revert',{operationId:receipt.id,confirmed:true});
     }));
    }
    if(d.agent==='comercial'&&Array.isArray(d.commercial_proposals)&&d.commercial_proposals.length){
     content.append(el('h4','Propostas internas para Orçamentos'));
     d.commercial_proposals.forEach((p,index)=>{
      line((p.kind==='quote'?'Orçamento ':'Pedido ')+p.reference+' · '+p.instruction);
      if((d.commercial_receipts||[]).includes(index))line('Proposta interna guardada');
      else content.append(btn('Guardar proposta interna',()=>{
       if(window.confirm('Guardar a proposta interna para '+p.reference+'? Não altera o orçamento, preços, quantidades nem envia mensagens.'))load('commercial_approve',{mission:d.mission_id,index,confirmed:true});
      }));
     });
    }
    if(d.agent==='catalogo'&&d.public_comparison?.mode==='public_api_comparison'){
     const p=d.public_comparison;
     content.append(el('h4','Comparação Backoffice · serviço público · Catálogo e Loja'));
     line('Produtos internos: '+(p.totalInternal??'por validar')+' · produtos públicos: '+(p.totalPublic??'por validar')+' · ocorrências: '+p.issueCount);
     line('Encomendas na Loja: '+({blocked:'bloqueadas',enabled:'ativas — verificar',unknown:'por confirmar'}[p.storeOrders]||'por confirmar'));
     line('Cobertura: produtos '+(p.coverage.products?'consultados':'por validar')+' · famílias '+(p.coverage.families?'consultadas':'por validar')+' · coleções '+(p.coverage.collections?'consultadas':'por validar'));
     const names={missing_internal_code:'Código interno em falta',ambiguous_public_product:'Correspondência pública ambígua',missing_public_product_review:'Produto ausente do serviço público — rever disponibilidade',hidden_product_in_public_feed_review:'Produto oculto no serviço público — rever',name_mismatch:'Nome diferente',description_mismatch:'Descrição diferente',missing_public_image:'Referência de fotografia em falta',image_reference_mismatch:'Referência de fotografia diferente',family_mapping_review:'Família por reconciliar',public_availability_review:'Disponibilidade por confirmar',unmatched_public_product_review:'Produto público sem correspondência interna',collection_reference_not_in_feed_review:'Referência de coleção ausente do serviço público — rever'};
     for(const i of p.issues||[])line(i.code+' · '+(names[i.kind]||'Por rever'));
     if(p.issueCount>(p.issues||[]).length)line('Lista limitada às primeiras 100 ocorrências.');
     line('A comparação não comprova o carregamento de imagens nem a apresentação visual nos sites. Não altera publicações.');
    }
    const repair=d.reference_repairs;
    if(d.agent==='stock'&&repair?.mode==='reference_repair_only'&&Array.isArray(repair.proposals)&&repair.proposals.length){
     content.append(el('h4','Normalização de referências nas fichas técnicas'));
     line('Liga referências sem correspondência ao material existente. Não altera nomes no stock, saldos ou histórico. O custo calculado da ficha poderá mudar.');
     repair.proposals.forEach((p,index)=>{
      line(p.code+' · linha '+(p.line+1)+' · '+p.before+' → '+p.after+' · '+p.quantity+' '+p.unit+' · custo unitário '+p.unitCost+' €');
      const receipt=(d.reference_receipts||[]).find(r=>r.index===index);
      if(receipt)line('Referência corrigida · revisão '+receipt.revision);
      else content.append(btn('Confirmar correção da referência',()=>{
       if(window.confirm('Corrigir '+p.before+' para '+p.after+' na ficha '+p.code+'? Mantém quantidade e movimentos. Confirma a unidade e o custo apresentado.'))load('repair_recipe_reference',{mission:d.mission_id,index,sourceRevision:repair.sourceRevision,confirmed:true});
      }));
     });
    }
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
 // Separate, explicit consultation in the existing native Orçamentos screen.
 const quoteScreen=document.getElementById('quotes');
 let commercialGeneration=0;
 const commercialResults=el('div');
 function clearCommercial(){commercialGeneration++;commercialResults.replaceChildren();}
 if(quoteScreen&&!document.getElementById('aeIntelligenceCommercial')){
  const panel=el('section');panel.id='aeIntelligenceCommercial';panel.className='card';
  const refreshCommercial=btn('Consultar propostas internas',async()=>{
   if(!unlockedNow())return;
   const ticket=++commercialGeneration;commercialResults.replaceChildren(el('p','A consultar a Cloud…'));
   try{
    const proposals=await rpc('commercial_read',{});
    if(ticket!==commercialGeneration||!unlockedNow())return;
    commercialResults.replaceChildren();
    if(!Array.isArray(proposals))throw Error();
    if(!proposals.length)commercialResults.append(el('p','Sem propostas internas guardadas.'));
    for(const p of proposals){
     const entry=el('article');entry.append(el('strong',(p.kind==='quote'?'Orçamento ':'Pedido ')+p.reference),
      el('p',p.instruction),el('small',p.current?'Origem atual · proposta interna, não enviada':'Origem alterada ou encerrada · voltar a analisar'));
     if(p.current&&p.kind==='quote'&&typeof db!=='undefined'&&Array.isArray(db.quotes)&&db.quotes.filter(q=>q.id===p.reference&&!q.orderId).length===1&&typeof editQuoteV1279==='function'){
      entry.append(btn('Abrir orçamento existente',()=>{if(unlockedNow())editQuoteV1279(p.reference);}));
     }
     commercialResults.append(entry);
    }
   }catch{if(ticket===commercialGeneration&&unlockedNow())commercialResults.replaceChildren(el('p','Propostas internas indisponíveis. Confirma a ligação Cloud.'));}
  });
  panel.append(el('h3','Gestor Comercial · Propostas internas'),el('p','Consulta de propostas aprovadas na Central. Não são orçamentos enviados nem alteram o estado comercial.'),refreshCommercial,commercialResults);
  quoteScreen.prepend(panel);
 }
 const observer=new MutationObserver(()=>{if(!unlockedNow()){close();clearCommercial();}});
 for(const id of ['authGateV1880','lockScreen']){const e=document.getElementById(id);if(e)observer.observe(e,{attributes:true,attributeFilter:['class']});}
 window.addEventListener('pagehide',()=>{close();clearCommercial();});window.addEventListener('offline',()=>{close();clearCommercial();});document.addEventListener('visibilitychange',()=>{if(document.hidden){close();clearCommercial();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
