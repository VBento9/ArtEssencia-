/* ArtEssencia — extensão do motor de Precificação em Quantidade V2.
   Reutiliza o cálculo V1750; não altera fichas técnicas, stock ou encomendas.
   O histórico fica exclusivamente numa tabela Cloud com RLS owner. */
(function () {
  'use strict';
  const TABLE='artessencia_quantity_simulations_v1';
  const $=id=>document.getElementById(id);
  const euroV2=n=>(Number(n)||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
  const pctV2=n=>(Number(n)||0).toLocaleString('pt-PT',{maximumFractionDigits:1})+'%';
  const numberV2=(id,limit=1000000)=>{const n=Number(String($(id)?.value??'0').replace(',','.'));return Number.isFinite(n)?Math.min(limit,Math.max(0,n)):0};
  const baseline=window.quantityPricingSnapshotV1751;
  const originalRefresh=window.refreshQuantityPricingV1750;
  const originalRender=window.renderQuantityPricingV1750;
  let busy=false,lastSaved=null,historyLoadedAt=0,currentCommercialOffer=null;
  if(typeof baseline!=='function'||typeof originalRefresh!=='function'||typeof originalRender!=='function')return;
  function safeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function priceFor(cost,percent,mode) {
    if (!Number.isFinite(cost)||cost<0||!Number.isFinite(percent)) return NaN;
    const raw=mode==='markup'?cost*(1+percent/100):cost/(1-percent/100);
    return typeof batchPriceRoundV1743==='function'?batchPriceRoundV1743(raw):Math.ceil((raw-1e-9)*100)/100;
  }
  function compute(units) {
    if($('qtyPricingModeV1750')?.value==='box')return computeBoxV23(units);
    const b=baseline(),q=Math.max(1,Math.min(10000,Math.round(Number(units)||b.units||1)));
    const ratio=q/Math.max(1,b.units||1);
    const setupMinutes=numberV2('aeQSetupMin',100000);
    const packagePerUnit=numberV2('aeQPackaging',100000);
    const wastePct=numberV2('aeQWaste',100);
    const mode=$('aeQMarginMode')?.value==='markup'?'markup':'margin';
    const target=Math.min(mode==='margin'?95:1000,numberV2('qtyPricingMarginV1750',1000));
    const materials=b.materialsCost*ratio;
    const wasteCost=materials*wastePct/100;
    const packagingCost=packagePerUnit*q;
    const totalMinutes=b.totalMinutes*ratio+setupMinutes;
    const labor=pricingLaborHourlyRateV1745()*totalMinutes/60;
    const overhead=pricingFixedHourlyRateV1745()*totalMinutes/60;
    const manualOther=!!$('qtyPricingOtherLotV1750')?.dataset.manual;
    const other=manualOther?b.otherCost:b.otherCost*ratio;
    const costTotal=materials+wasteCost+packagingCost+labor+overhead+other;
    const unitCost=costTotal/q;
    const recommendedUnit=priceFor(unitCost,target,mode);
    const discount=Math.min(100,numberV2('qtyPricingDiscountV1750',100));
    const manualRaw=String($('qtyPricingManualUnitV1750')?.value??'').trim();
    const finalUnit=manualRaw===''?Math.round((recommendedUnit*(1-discount/100)+Number.EPSILON)*100)/100:numberV2('qtyPricingManualUnitV1750');
    const finalTotal=finalUnit*q,profit=finalTotal-costTotal;
    const rows=b.materials.map(r=>Object.assign({},r,{totalQty:r.totalQty*ratio,cost:r.cost*ratio}));
    return Object.assign({},b,{
      pricingEngine:'quantity_v2',units:q,materials:rows,materialsCost:materials,
      laborCost:labor,fixedCost:overhead,otherCost:other,
      setupMinutes,packagingPerUnit:packagePerUnit,packagingCost,wastePct,wasteCost,
      totalMinutes,costTotal,costUnit:unitCost,marginMode:mode,marginPct:target,
      recommendedUnit,recommendedTotal:recommendedUnit*q,
      discountPct:discount,finalUnit,finalTotal,profit,
      marginReal:finalTotal>0?profit/finalTotal:0,
      markupReal:costTotal>0?profit/costTotal:0,
      manualPrice:manualRaw!=='',otherCostMode:manualOther?'fixed':'per-unit'
    });
  }
  function format(id,value) {const n=$(id);if(n)n.textContent=euroV2(value);}
  function addUI() {
    const root=$('quantityPricing');if(!root||$('aeQSetupMin'))return;
    const unitsInput=$('qtyPricingUnitsV1750');if(unitsInput)unitsInput.max='10000';
    const grid=root.querySelector('.quantity-pricing-cost-grid-v1750');
    if(!grid)return;
    const newFields='<div class="field"><label>Preparação fixa do lote (min)</label><input id="aeQSetupMin" type="number" min="0" step="1" value="0" oninput="refreshQuantityPricingV1750()"><small>Preparação, limpeza e afinação, paga uma única vez por lote.</small></div>'+
      '<div class="field"><label>Embalagem adicional / unidade (€)</label><input id="aeQPackaging" type="number" inputmode="decimal" min="0" step="0.01" value="0" oninput="refreshQuantityPricingV1750()"><small>Não repitas a embalagem já incluída nos materiais.</small></div>'+
      '<div class="field"><label>Desperdício sobre materiais (%)</label><input id="aeQWaste" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="0" oninput="refreshQuantityPricingV1750()"><small>Aplicado apenas às matérias-primas do lote.</small></div>';
    grid.insertAdjacentHTML('afterbegin',newFields);
    const margin=$('qtyPricingMarginV1750')?.closest('.field');
    margin?.insertAdjacentHTML('beforeend','<label class="aeq-sub-label" for="aeQMarginMode">Método de margem</label><select id="aeQMarginMode" onchange="quantityPricingMarginMethodV2()"><option value="margin">Margem sobre o preço de venda</option><option value="markup">Acréscimo sobre o custo (markup)</option></select><small>40% de margem ≠ 40% de acréscimo.</small>');
    const results=root.querySelector('.quantity-pricing-results-v1750');
    results?.insertAdjacentHTML('beforeend',
      '<div><span>Preparação fixa (incluída na mão de obra/custos gerais)</span><strong id="aeQSetupCost">0,00 €</strong></div>'+
      '<div><span>Desperdício de materiais</span><strong id="aeQWasteCost">0,00 €</strong></div>'+
      '<div><span>Embalagens adicionais</span><strong id="aeQPackagingCost">0,00 €</strong></div>'+
      '<div><span>Acréscimo real sobre custo</span><strong id="aeQMarkupReal">0%</strong></div>');
    const warning=$('qtyPricingWarningV1750');
    warning?.insertAdjacentHTML('afterend',
      '<div class="aeq-panel"><h3>Como é formado o preço</h3><div id="aeQExplanation" aria-live="polite"></div></div>'+
      '<div class="aeq-panel"><h3>Comparar quantidades</h3><p>10, 25, 50, 100 unidades e a quantidade escolhida. Materiais e tempo por unidade mantêm-se proporcionais; a preparação fixa dilui-se pelo lote.</p><div class="aeq-table-scroll"><table><thead><tr><th>Unidades</th><th>Custo do lote</th><th>Custo / un.</th><th>PVP / un.</th><th>Lucro final</th><th>Margem final</th></tr></thead><tbody id="aeQTiers"></tbody></table></div></div>'+
      '<div class="aeq-panel"><h3>Histórico Cloud e propostas comerciais</h3><div class="aeq-actions"><label>Referência da simulação<input id="aeQLabel" maxlength="120" placeholder="Ex.: Lembranças casamento"></label><button class="btn primary" type="button" id="aeQSave">Guardar simulação na Cloud</button><button class="btn" type="button" id="aeQReload">Atualizar histórico</button></div><label class="aeq-check"><input type="checkbox" id="aeQApproval"> Confirmei materiais, custos, margens e condições comerciais.</label><button class="btn" type="button" id="aeQProposal">Preparar proposta comercial (rascunho)</button><p id="aeQCloudState" role="status" aria-live="polite">Os rascunhos são gravados na Cloud; nenhum pedido ou stock é alterado.</p><div id="aeQHistory"></div><div id="aeQHistoryDetail" aria-live="polite"></div><label class="aeq-proposal-label">Texto da proposta para copiar<textarea id="aeQProposalText" rows="5" readonly></textarea></label><button class="btn" type="button" id="aeQCopy">Copiar proposta</button></div>');
    const convert=root.querySelector('.quantity-pricing-convert-v1751');
    if(convert)convert.remove(); // Não transportar diretamente uma simulação para encomenda.
    $('aeQSave')?.addEventListener('click',()=>saveSimulation(false));
    $('aeQProposal')?.addEventListener('click',()=>saveSimulation(true));
    $('aeQReload')?.addEventListener('click',()=>loadHistory(true));
    $('aeQCopy')?.addEventListener('click',async()=>{
      const str=$('aeQProposalText')?.value||'';
      if(!str)return state('Ainda não existe texto de proposta.');
      try{await navigator.clipboard.writeText(str);state('Texto da proposta copiado.')}catch(e){state('Seleciona e copia o texto manualmente.')}
    });
    organiseCompactUI();
    installProductFinderV22();
    installQuickQuantitiesV22();
    installBoxV23();
    installCommercialV24();
  }

  // V2.1 — disposição compacta: os elementos existentes são movidos, não recriados.
  // Inputs, event listeners, IDs e cálculos mantêm-se inalterados.
  let activeCompactTab='tiers',historyVisible=6;
  const compactTabs=[
    ['materials','Materiais'],
    ['costs','Custos'],
    ['tiers','Escalões'],
    ['details','Detalhes'],
    ['history','Guardar']
  ];
  function showCompactTab(tab,focus=false){
    const root=$('quantityPricing');if(!root?.dataset.aeqCompact||!compactTabs.some(x=>x[0]===tab))return;
    activeCompactTab=tab;
    root.querySelectorAll('[data-aeq-tab]').forEach(btn=>{
      const selected=btn.dataset.aeqTab===tab;
      btn.setAttribute('aria-selected',String(selected));btn.tabIndex=selected?0:-1;
      if(selected&&focus)btn.focus({preventScroll:true});
    });
    root.querySelectorAll('[data-aeq-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.aeqPanel!==tab;
    });
    if(tab==='history'&&Date.now()-historyLoadedAt>60000)loadHistory(false);
  }
  function updateHistoryPaging(){
    const root=$('quantityPricing'),list=$('aeQHistory'),more=$('aeQMoreHistory');
    if(!root?.dataset.aeqCompact||!list||!more)return;
    const rows=[...list.querySelectorAll('.aeq-history-row')];
    rows.forEach((row,i)=>{row.hidden=i>=historyVisible;});
    more.hidden=rows.length<=historyVisible;
    more.textContent='Mostrar mais ('+Math.min(6,Math.max(0,rows.length-historyVisible))+')';
  }
  function organiseCompactUI(){
    const root=$('quantityPricing');
    if(!root||root.dataset.aeqCompact==='1'||!$('aeQSetupMin'))return;
    const cards=[...root.children].filter(el=>el.classList.contains('quantity-pricing-card-v1750'));
    if(cards.length!==4)return;
    const [baseCard,materialsCard,costsCard,resultsCard]=cards;
    const explanation=$('aeQExplanation')?.closest('.aeq-panel');
    const tiers=$('aeQTiers')?.closest('.aeq-panel');
    const history=$('aeQHistory')?.closest('.aeq-panel');
    if(!explanation||!tiers||!history)return;
    // O desconto é frequentemente usado: colocá-lo junto da margem e quantidade.
    const baseGrid=baseCard.querySelector('.quantity-pricing-base-grid-v1750');
    const discount=$('qtyPricingDiscountV1750')?.closest('.field');
    if(baseGrid&&discount)baseGrid.append(discount);
    const manualPrice=$('qtyPricingManualUnitV1750')?.closest('.field');
    if(baseGrid&&manualPrice){
      const holder=document.createElement('details');holder.className='aeq-manual-price';
      holder.innerHTML='<summary>Definir preço final manual (opcional)</summary>';
      holder.append(manualPrice);baseCard.append(holder);
    }
    // O painel financeiro original continua a ser atualizado pelo motor.
    const guide=baseCard.querySelector('.pricing-margin-guide-v1772');
    if(guide){
      const help=document.createElement('details');help.className='aeq-margin-help';
      help.innerHTML='<summary>Referências de margem</summary>';
      help.append(guide);baseCard.append(help);
    }
    const ref=$('qtyPricingProductReferenceV1750');
    if(ref)resultsCard.append(ref);
    const warning=$('qtyPricingWarningV1750');
    const summary=document.createElement('section');
    summary.className='aeq-main-summary';
    summary.setAttribute('aria-label','Resumo de precificação');
    summary.innerHTML='<div class="aeq-main-summary-grid">'+
      '<div><small>Custo por unidade</small><strong id="aeqSummaryCost">—</strong></div>'+
      '<div><small>PVP sugerido</small><strong id="aeqSummaryPrice">—</strong></div>'+
      '<div><small>Total final</small><strong id="aeqSummaryTotal">—</strong></div>'+
      '<div><small>Margem efetiva</small><strong id="aeqSummaryMargin">—</strong></div>'+
      '</div><div class="aeq-summary-profit">Lucro estimado do lote: <strong id="aeqSummaryProfit">—</strong></div>';
    baseCard.after(summary);
    if(warning)summary.append(warning);
    const issues=document.createElement('div');issues.id='aeQDataIssues';
    issues.className='aeq-data-issues';issues.setAttribute('role','status');issues.hidden=true;
    summary.append(issues);
    // A listagem longa de cálculos fica atrás de uma expansão voluntária.
    const breakdown=document.createElement('details');breakdown.className='aeq-breakdown';
    breakdown.innerHTML='<summary>Ver cálculo completo e discriminação de custos</summary>';
    breakdown.append(resultsCard);breakdown.append(explanation);
    const tabShell=document.createElement('div');tabShell.className='aeq-tab-shell';
    const nav=document.createElement('div');nav.className='aeq-tab-nav';nav.setAttribute('role','tablist');
    nav.setAttribute('aria-label','Secções da precificação');
    const panels=document.createElement('div');panels.className='aeq-tab-panels';
    const contents={materials:[materialsCard],costs:[costsCard],tiers:[tiers],details:[breakdown],history:[history]};
    compactTabs.forEach(([id,label])=>{
      const button=document.createElement('button');button.type='button';
      button.className='aeq-tab';button.dataset.aeqTab=id;button.id='aeq-tab-'+id;
      button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','aeq-panel-'+id);
      button.addEventListener('click',()=>showCompactTab(id));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const ix=compactTabs.findIndex(t=>t[0]===id);
        const next=event.key==='Home'?0:event.key==='End'?compactTabs.length-1:
          (ix+(event.key==='ArrowLeft'?-1:1)+compactTabs.length)%compactTabs.length;
        showCompactTab(compactTabs[next][0],true);
      });
      nav.append(button);
      const panel=document.createElement('section');panel.dataset.aeqPanel=id;
      panel.id='aeq-panel-'+id;panel.className='aeq-tab-panel';
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
      contents[id].forEach(content=>panel.append(content));panels.append(panel);
    });
    tabShell.append(nav,panels);summary.after(tabShell);
    const more=document.createElement('button');more.type='button';more.className='btn aeq-more-history';
    more.id='aeQMoreHistory';more.hidden=true;
    more.addEventListener('click',()=>{historyVisible+=6;updateHistoryPaging();});
    $('aeQHistory')?.after(more);
    root.dataset.aeqCompact='1';
    showCompactTab(activeCompactTab);
  }

  // V2.2 — seletor de produtos pesquisável e escolha rápida de escalões.
  // Os controlos originais e a ficha técnica continuam a ser a fonte dos cálculos.
  function selectQuantityV22(q){
    const value=Number(q),input=$('qtyPricingUnitsV1750');
    if(!input||!Number.isInteger(value)||value<1||value>10000)return;
    input.value=String(value);
    if(typeof quantityPricingUnitsChangedV1750==='function')quantityPricingUnitsChangedV1750();
    else window.refreshQuantityPricingV1750();
  }
  function normalizeSearchV22(value){
    return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }
  function installProductFinderV22(){
    const root=$('quantityPricing'),field=$('qtyPricingProductFieldV1750'),selector=$('qtyPricingProductV1750');
    if(!root||!field||!selector||$('aeQProductFinder'))return;
    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='aeq-product-search-toggle';
    toggle.textContent='Pesquisar produto';toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-controls','aeQProductFinder');
    const area=document.createElement('div');area.id='aeQProductFinder';
    area.className='aeq-product-finder';area.hidden=true;
    const label=document.createElement('label');label.htmlFor='aeQProductQuery';
    label.textContent='Pesquisar por nome ou código';
    const input=document.createElement('input');input.id='aeQProductQuery';
    input.type='search';input.autocomplete='off';
    input.placeholder='Escreve para procurar…';
    const options=document.createElement('div');options.className='aeq-product-found';
    options.setAttribute('aria-label','Resultados da pesquisa');
    const status=document.createElement('small');status.id='aeQSearchStatus';
    area.append(label,input,status,options);
    field.append(toggle,area);
    const close=()=>{
      area.hidden=true;toggle.setAttribute('aria-expanded','false');
      toggle.textContent='Pesquisar produto';input.value='';
      options.replaceChildren();status.textContent='';
    };
    function search(){
      options.replaceChildren();
      const query=normalizeSearchV22(input.value);
      if(query.length<2){status.textContent='Escreve pelo menos 2 caracteres.';return;}
      const list=(Array.isArray(db?.products)?db.products:[])
        .filter(p=>(typeof productUsableV1803!=='function'||productUsableV1803(p))&&p?.code)
        .filter(p=>normalizeSearchV22(p.name).includes(query)||normalizeSearchV22(p.code).includes(query))
        .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-PT'));
      status.textContent=list.length?list.length+' produto(s) encontrado(s).':'Nenhum produto encontrado.';
      list.slice(0,7).forEach(p=>{
        const button=document.createElement('button');button.type='button';
        button.className='aeq-product-choice';
        button.textContent=String(p.name||p.code)+' · '+String(p.code);
        button.addEventListener('click',()=>{
          // O seletor continua a determinar o produto; não se escreve na ficha técnica.
          const mode=$('qtyPricingModeV1750');
          if(mode&&mode.value!=='product'){
            mode.value='product';
            if(typeof quantityPricingModeChangedV1750==='function')quantityPricingModeChangedV1750();
          }
          const current=$('qtyPricingProductV1750');if(!current)return;
          current.value=String(p.code);
          if(current.value!==String(p.code)){
            status.textContent='O produto já não está disponível. Atualiza a lista.';
            return;
          }
          if(typeof loadQuantityPricingProductV1750==='function')loadQuantityPricingProductV1750(true);
          close();
        });
        options.append(button);
      });
      if(list.length>7){
        const note=document.createElement('small');
        note.textContent='Refina a pesquisa para ver os restantes resultados.';
        options.append(note);
      }
    }
    toggle.addEventListener('click',()=>{
      if(area.hidden){
        area.hidden=false;toggle.setAttribute('aria-expanded','true');
        toggle.textContent='Fechar pesquisa';search();input.focus();
      }else close();
    });
    input.addEventListener('input',search);
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();toggle.focus();}});
  }
  function installQuickQuantitiesV22(){
    const units=$('qtyPricingUnitsV1750');
    if(!units||$('aeQQuickQuantities'))return;
    const group=document.createElement('div');
    group.id='aeQQuickQuantities';group.className='aeq-quick-quantities';
    group.setAttribute('aria-label','Quantidades rápidas');
    [10,25,50,100].forEach(q=>{
      const b=document.createElement('button');b.type='button';b.dataset.aeqQuick=String(q);
      b.className='aeq-quick-quantity';b.textContent=String(q);
      b.setAttribute('aria-label','Simular '+q+' unidades');
      b.addEventListener('click',()=>selectQuantityV22(q));
      group.append(b);
    });
    units.closest('.field')?.append(group);
    $('aeQTiers')?.addEventListener('click',event=>{
      const btn=event.target.closest('button[data-aeq-choose-qty]');
      if(!btn)return;selectQuantityV22(btn.dataset.aeqChooseQty);
    });
  }
  function priceDataIssuesV22(s){
    const problems=[];
    const units=Number($('qtyPricingUnitsV1750')?.value);
    if(!Number.isInteger(units)||units<1||units>10000)problems.push('Quantidade inválida (1 a 10 000).');
    if(!Number.isFinite(s.costTotal)||s.costTotal<=0)problems.push('O custo total precisa de ser positivo.');
    const noCost=(s.materials||[]).filter(m=>Number(m.totalQty)>0&&!(Number(m.unitCost)>0));
    if(noCost.length)problems.push('Matérias-primas sem custo: '+noCost.slice(0,3).map(m=>String(m.item||'sem identificação')).join(', ')+(noCost.length>3?'…':'')+'.');
    if(s.mode==='box'&&!s.boxSourceValid)problems.push(s.boxError||'Box com ficha técnica inválida.');
    if(!Number.isFinite(s.finalUnit)||s.finalUnit<=0)problems.push('Define um preço final por unidade válido.');
    return problems;
  }
  function refreshQuickQuantitiesV22(s){
    document.querySelectorAll('#aeQQuickQuantities [data-aeq-quick]').forEach(button=>{
      const selected=Number(button.dataset.aeqQuick)===s.units;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }

  // Fonte Box: usa os custos de uma revisão imutável, sem somar novamente
  // os materiais, embalagem ou mão de obra dos produtos integrantes.
  function boxSourceV23(){
    const id=String($('aeQBoxSelectV23')?.value||'');
    const b=(db?.themedBoxes||[]).find(x=>String(x.id)===id);
    const r=b?.technicalRevisionV4,s=r?.snapshot,d=s?.breakdown;
    const fail=reason=>({valid:false,box:b,reason});
    if(!b)return fail('Escolhe uma Box guardada.');
    if(!b.items?.length||!s||!d)return fail('Guarda primeiro a composição e ficha técnica da Box.');
    if(r.fingerprint!==JSON.stringify({items:b.items,technicalV2:b.technicalV2,basePackaging:b.basePackaging,decorationCost:b.decorationCost,price:b.price}))
      return fail('Ficha alterada depois da última revisão. Guarda a Box.');
    const a=[d.materials,d.labor,d.energy,d.indirect,s.packaging,s.total].map(Number);
    if(d.incomplete||a.some(n=>!Number.isFinite(n)||n<0)||a[5]<=0)return fail('A ficha tem custos incompletos ou inválidos.');
    if(Math.abs(a.slice(0,5).reduce((v,n)=>v+n,0)-a[5])>.03)return fail('Os custos e o total da ficha não coincidem.');
    return {valid:true,box:b,revision:Number(r.version)||1,components:{materials:a[0],labor:a[1],energy:a[2],indirect:a[3],packaging:a[4],total:a[5]}};
  }
  function computeBoxV23(units){
    const x=boxSourceV23(),q=Math.max(1,Math.min(10000,Math.round(Number(units)||Number($('qtyPricingUnitsV1750')?.value)||1)));
    const c=x.valid?x.components:{materials:0,labor:0,energy:0,indirect:0,packaging:0,total:0};
    const setup=numberV2('aeQSetupMin',100000),extraPack=numberV2('aeQPackaging'),wastePct=numberV2('aeQWaste',100);
    const materialsCost=c.materials*q,wasteCost=materialsCost*wastePct/100;
    const laborCost=c.labor*q+pricingLaborHourlyRateV1745()*setup/60;
    const fixedCost=(c.energy+c.indirect)*q+pricingFixedHourlyRateV1745()*setup/60;
    const packagingCost=(c.packaging+extraPack)*q,otherCost=numberV2('qtyPricingOtherLotV1750');
    const costTotal=materialsCost+wasteCost+laborCost+fixedCost+packagingCost+otherCost,costUnit=costTotal/q;
    const marginMode=$('aeQMarginMode')?.value==='markup'?'markup':'margin';
    const marginPct=Math.min(marginMode==='margin'?95:1000,numberV2('qtyPricingMarginV1750',1000));
    const recommendedUnit=x.valid?priceFor(costUnit,marginPct,marginMode):0;
    const discountPct=numberV2('qtyPricingDiscountV1750',100),raw=String($('qtyPricingManualUnitV1750')?.value||'').trim();
    const finalUnit=raw?numberV2('qtyPricingManualUnitV1750'):Math.round((recommendedUnit*(1-discountPct/100)+Number.EPSILON)*100)/100;
    const finalTotal=finalUnit*q,profit=finalTotal-costTotal;
    return {version:APP_VERSION,createdAt:new Date().toISOString(),pricingEngine:'quantity_box_revision_v23',
      mode:'box',productCode:'',productName:'',
      boxId:x.valid?String(x.box.id):'',boxName:x.valid?String(x.box.name):'',
      boxRevision:x.valid?x.revision:null,boxSourceValid:x.valid,boxError:x.valid?'':x.reason,
      boxCostComponents:x.valid?c:null,
      boxItems:x.valid?x.box.items.map(i=>({code:String(i.code),qty:Number(i.qty)||0})):[],
      units:q,materials:[],materialsCost,minutesPerUnit:0,efficiencyPct:0,totalMinutes:setup,
      laborCost,fixedCost,otherCost,setupMinutes:setup,packagingPerUnit:extraPack,
      packagingCost,wastePct,wasteCost,costTotal,costUnit,marginMode,marginPct,recommendedUnit,
      recommendedTotal:recommendedUnit*q,discountPct,finalUnit,finalTotal,profit,
      marginReal:finalTotal>0?profit/finalTotal:0,markupReal:costTotal>0?profit/costTotal:0,
      manualPrice:!!raw,otherCostMode:'fixed'};
  }
  function fillBoxesV23(){
    const sel=$('aeQBoxSelectV23');if(!sel)return;
    const previous=sel.value;sel.replaceChildren();
    const first=document.createElement('option');first.value='';first.textContent='Selecionar Box guardada…';sel.append(first);
    const boxes=(db?.themedBoxes||[]).filter(x=>x?.id&&x?.name).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-PT'));
    boxes.forEach(box=>{const o=document.createElement('option');o.value=box.id;
      o.textContent=String(box.name)+' · rev. '+String(box.technicalRevisionV4?.version||'—');sel.append(o);});
    sel.value=boxes.some(x=>String(x.id)===previous)?previous:'';
  }
  function boxUIV23(s){
    const isBox=$('qtyPricingModeV1750')?.value==='box';
    if($('aeQBoxFieldV23'))$('aeQBoxFieldV23').hidden=!isBox;
    if($('aeQBoxNoteV23'))$('aeQBoxNoteV23').hidden=!isBox;
    const materials=$('quantityPricing')?.querySelector('[data-aeq-panel="materials"] .quantity-pricing-card-v1750');
    if(materials)materials.style.display=isBox?'none':'';
    const boxMaterials=$('aeQBoxMaterialsV23');if(boxMaterials)boxMaterials.hidden=!isBox;
    ['qtyPricingMinutesUnitV1750','qtyPricingEfficiencyV1750','qtyPricingTotalMinutesV1750']
      .forEach(id=>{const field=$(id)?.closest('.field');if(field)field.style.display=isBox?'none':'';});
    const other=$('qtyPricingOtherLotV1750')?.closest('.field')?.querySelector('label');
    if(other)other.textContent=isBox?'Outros custos EXTRA do lote':'Outros custos do lote';
    if(!isBox||!s)return;
    const source=boxSourceV23();
    if(boxMaterials){boxMaterials.replaceChildren();
      const label=document.createElement('strong');label.textContent=source.valid?
        String(source.box.name)+' · revisão '+source.revision:source.reason;boxMaterials.append(label);
      if(source.valid){const desc=document.createElement('p');
       desc.textContent='Custos guardados por Box; não são somados novamente a partir do Stock. Atualiza a ficha da Box quando os custos mudarem.';
       boxMaterials.append(desc);
       const lines=document.createElement('dl');lines.className='aeq-box-costs';
       [['Produtos e matérias-primas',source.components.materials],['Trabalho',source.components.labor],
        ['Energia',source.components.energy],['Outros custos',source.components.indirect],
        ['Embalagem',source.components.packaging],['Total por Box',source.components.total]].forEach(([name,value])=>{
         const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
         dt.textContent=name;dd.textContent=euroV2(value);row.append(dt,dd);lines.append(row);});
       boxMaterials.append(lines);}
    }
    const ref=$('qtyPricingProductReferenceV1750');
    if(ref){ref.replaceChildren();const strong=document.createElement('strong');
      strong.textContent=source.valid?source.box.name+' · rev. '+source.revision:source.reason;ref.append(strong);}
    const info=$('aeQExplanation');
    if(info)info.textContent='Base: '+s.units+' × '+euroV2(source.valid?source.components.total:0)+
      ' por Box + preparação fixa '+euroV2((pricingLaborHourlyRateV1745()+pricingFixedHourlyRateV1745())*s.setupMinutes/60)+
      ' + embalagem EXTRA '+euroV2(s.packagingPerUnit*s.units)+' + desperdício EXTRA '+euroV2(s.wasteCost)+
      ' + outros custos de lote '+euroV2(s.otherCost)+' = '+euroV2(s.costTotal)+'.';
    if(!source.valid){const warning=$('aeQDataIssues');if(warning){warning.hidden=false;warning.textContent=source.reason;}}
  }
  function installBoxV23(){
    const root=$('quantityPricing'),mode=$('qtyPricingModeV1750');
    if(!root||!mode||$('aeQBoxFieldV23'))return;
    const opt=document.createElement('option');opt.value='box';opt.textContent='Box predefinida';mode.append(opt);
    const field=document.createElement('div');field.className='field';field.id='aeQBoxFieldV23';
    field.innerHTML='<label for="aeQBoxSelectV23">Box guardada</label><select id="aeQBoxSelectV23"></select>';
    field.hidden=true;root.querySelector('.quantity-pricing-base-grid-v1750')?.append(field);
    const note=document.createElement('p');note.id='aeQBoxNoteV23';note.className='aeq-box-note';note.hidden=true;
    note.textContent='A ficha da Box já inclui produção, cera e embalagem. Insere apenas custos adicionais específicos deste lote.';
    root.querySelector('.quantity-pricing-base-grid-v1750')?.after(note);
    const data=document.createElement('div');data.id='aeQBoxMaterialsV23';data.className='aeq-panel';data.hidden=true;
    root.querySelector('[data-aeq-panel="materials"]')?.append(data);
    fillBoxesV23();
    $('aeQBoxSelectV23')?.addEventListener('change',()=>{
      const b=boxSourceV23().box,margin=$('qtyPricingMarginV1750');
      if(b&&margin)margin.value=String(Number.isFinite(Number(b.targetMarginPct))?b.targetMarginPct:35);
      window.refreshQuantityPricingV1750();
    });
  }
  const priorModeV23=window.quantityPricingModeChangedV1750;
  if(typeof priorModeV23==='function')window.quantityPricingModeChangedV1750=function(){
    const box=$('qtyPricingModeV1750')?.value==='box';priorModeV23();
    if(box){
      const margin=$('qtyPricingMarginV1750'),source=boxSourceV23().box;
      if(margin)margin.value=String(Number.isFinite(Number(source?.targetMarginPct))?source.targetMarginPct:35);
      for(const id of ['qtyPricingMinutesUnitV1750','qtyPricingEfficiencyV1750',
        'qtyPricingTotalMinutesV1750','qtyPricingDiscountV1750','qtyPricingManualUnitV1750','qtyPricingOtherLotV1750']){
        const el=$(id);if(el)el.value=['qtyPricingMinutesUnitV1750','qtyPricingEfficiencyV1750','qtyPricingOtherLotV1750'].includes(id)?'0':'';
      }
      if($('qtyPricingOtherLotV1750'))$('qtyPricingOtherLotV1750').dataset.manual='1';
    }
    window.refreshQuantityPricingV1750();
  };
  window.aeBoxQuantityOpenV23=function(id){
    if(!(db?.themedBoxes||[]).some(b=>String(b.id)===String(id)))return;
    if(typeof go==='function')go('quantityPricing');
    installBoxV23();fillBoxesV23();
    const mode=$('qtyPricingModeV1750'),box=$('aeQBoxSelectV23');
    if(mode)mode.value='box';if(box)box.value=String(id);
    window.quantityPricingModeChangedV1750();
  };
  window.quantityPricingMarginMethodV2=function(){const input=$('qtyPricingMarginV1750');if(input)input.max=$('aeQMarginMode')?.value==='markup'?'1000':'95';window.refreshQuantityPricingV1750();};
  function state(message) {const el=$('aeQCloudState');if(el)el.textContent=message;}
  function signature(s) {
    return JSON.stringify([s.mode,s.productCode,s.units,s.materials,s.minutesPerUnit,
      s.efficiencyPct,s.totalMinutes,s.otherCost,s.setupMinutes,s.packagingCost,s.wasteCost,
      s.marginMode,s.marginPct,s.discountPct,s.finalUnit,s.finalTotal,s.boxId,s.boxRevision,s.boxCostComponents,s.boxItems]);
  }
  function renderEnhanced() {
    if(!$('quantityPricing'))return;addUI();
    const s=compute();
    format('qtyPricingResultMaterialsV1750',s.materialsCost);
    format('qtyPricingResultLaborV1750',s.laborCost);
    format('qtyPricingResultFixedV1750',s.fixedCost);
    format('qtyPricingResultOtherV1750',s.otherCost);
    format('qtyPricingResultCostTotalV1750',s.costTotal);
    format('qtyPricingResultCostUnitV1750',s.costUnit);
    format('qtyPricingResultBreakEvenV1750',s.costUnit);
    format('qtyPricingResultRecommendedUnitV1750',s.recommendedUnit);
    format('qtyPricingResultRecommendedTotalV1750',s.recommendedTotal);
    format('qtyPricingResultFinalUnitV1750',s.finalUnit);
    format('qtyPricingResultFinalTotalV1750',s.finalTotal);
    format('qtyPricingResultProfitV1750',s.profit);
    format('aeQWasteCost',s.wasteCost);format('aeQPackagingCost',s.packagingCost);
    format('aeQSetupCost',(pricingLaborHourlyRateV1745()+pricingFixedHourlyRateV1745())*s.setupMinutes/60);
    format('aeqSummaryCost',s.costUnit);format('aeqSummaryPrice',s.recommendedUnit);
    format('aeqSummaryTotal',s.finalTotal);format('aeqSummaryProfit',s.profit);
    const aeqMargin=$('aeqSummaryMargin');if(aeqMargin)aeqMargin.textContent=pctV2(s.marginReal*100);
    const aeqSummary=$('quantityPricing')?.querySelector('.aeq-main-summary');
    if(aeqSummary)aeqSummary.classList.toggle('aeq-negative',s.finalTotal+1e-9<s.costTotal);
    refreshQuickQuantitiesV22(s);
    const errors=priceDataIssuesV22(s),notice=$('aeQDataIssues');
    if(notice){notice.hidden=!errors.length;notice.textContent=errors.length?'Dados por completar: '+errors.join(' '):'';}
    const tm=$('qtyPricingResultTimeV1750');if(tm)tm.textContent=Math.round(s.totalMinutes).toLocaleString('pt-PT')+' min';
    const mar=$('qtyPricingResultMarginV1750');if(mar)mar.textContent=pctV2(s.marginReal*100);
    const mark=$('aeQMarkupReal');if(mark)mark.textContent=pctV2(s.markupReal*100);
    const explanation=$('aeQExplanation');
    if(explanation)explanation.textContent='Materiais '+euroV2(s.materialsCost)+' + desperdício '+euroV2(s.wasteCost)+
      ' + mão de obra '+euroV2(s.laborCost)+' + custos gerais '+euroV2(s.fixedCost)+
      ' + embalagem adicional '+euroV2(s.packagingCost)+' + outros custos '+euroV2(s.otherCost)+
      ' = '+euroV2(s.costTotal)+' por '+s.units+' unidades. Custo/un. '+euroV2(s.costUnit)+
      (s.marginMode==='margin'?' ÷ (1 − '+pctV2(s.marginPct)+')':' × (1 + '+pctV2(s.marginPct)+')')+
      ' → preço recomendado '+euroV2(s.recommendedUnit)+' por unidade (arredondado).'+
      (s.manualPrice?' O preço final manual substitui o desconto.':' Desconto '+pctV2(s.discountPct)+' aplicado ao preço recomendado.');
    const warn=$('qtyPricingWarningV1750');
    if(warn){const below=s.finalTotal+1e-9<s.costTotal;
      warn.className='soft-note quantity-pricing-warning-v1750 '+(below?'warn':'ok');
      warn.textContent=below?'Preço abaixo do custo. Prejuízo previsto '+euroV2(-s.profit)+'.':
        'Margem efetiva após desconto: '+pctV2(s.marginReal*100)+'. Simulação sem efeitos no stock, fichas técnicas ou encomendas.';
    }
    const tiers=[...new Set([10,25,50,100,s.units])].sort((a,b)=>a-b);
    const priceInput=$('qtyPricingMarginV1750');if(priceInput)priceInput.max=s.marginMode==='markup'?'1000':'95';
    const table=$('aeQTiers');
    if(table)table.innerHTML=tiers.map(q=>{
      const n=compute(q),highlight=q===s.units?' class="aeq-current"':'';
      return '<tr'+highlight+'><td><button type="button" class="aeq-tier-choose" data-aeq-choose-qty="'+q+'" aria-label="Simular '+q+' unidades">'+q+' un.</button></td><td>'+euroV2(n.costTotal)+'</td><td>'+euroV2(n.costUnit)+'</td><td>'+euroV2(n.recommendedUnit)+'</td><td>'+euroV2(n.profit)+'</td><td>'+pctV2(n.marginReal*100)+'</td></tr>';
    }).join('');
    boxUIV23(s);
  }
  window.refreshQuantityPricingV1750=function(){originalRefresh();renderEnhanced();};
  window.quantityPricingSnapshotV1751=function(){return compute();};
  window.renderQuantityPricingV1750=function(){addUI();fillBoxesV23();originalRender();renderEnhanced();};

  // V2.4 — projeção de dados permitidos ao cliente. Não exportar o payload técnico.
  const plainOfferV24=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  function makeCommercialOfferV24(snapshot,label,form={}){
    const quantity=Number(snapshot?.units),unit=Number(snapshot?.finalUnit),total=Number(snapshot?.finalTotal);
    const unitCents=Math.round(unit*100),totalCents=Math.round(total*100);
    if(!Number.isInteger(quantity)||quantity<1||quantity>10000||
       !Number.isSafeInteger(unitCents)||unitCents<=0||!Number.isSafeInteger(totalCents)||
       unitCents*quantity!==totalCents)throw Error('O preço unitário e o total não coincidem. Confirma os valores antes da proposta.');
    const kind=snapshot.mode==='box'?'Box':snapshot.mode==='product'?'Produto':'Conjunto personalizado';
    const item=plainOfferV24(snapshot.mode==='box'?snapshot.boxName:snapshot.productName,120)||
      plainOfferV24(label,120)||'Artigos artesanais';
    const validity=plainOfferV24(form.validUntil,10);
    if(validity&&!/^\d{4}-\d{2}-\d{2}$/.test(validity))throw Error('Data de validade inválida.');
    if(validity){
      const expiry=new Date(validity+'T23:59:59');
      if(!Number.isFinite(expiry.getTime())||expiry<new Date()||
         expiry.getFullYear()+'-'+String(expiry.getMonth()+1).padStart(2,'0')+'-'+String(expiry.getDate()).padStart(2,'0')!==validity)
        throw Error('A validade da proposta deve ser uma data futura.');
    }
    return {
      schema:'artessencia_commercial_offer_v1',kind,item,
      reference:plainOfferV24(label,120)||item,quantity,
      unitCents,totalCents,currency:'EUR',
      customer:plainOfferV24(form.customer,120),
      validUntil:validity,
      leadTime:plainOfferV24(form.leadTime,180),
      conditions:plainOfferV24(form.conditions,500)
    };
  }
  function offerFromStoredV24(row){
    if(!row||row.kind!=='proposal'||!row.payload)return null;
    // Lista branca: a estrutura enviada nunca inclui custos, margens, receitas, stock ou dados Cloud.
    const p=row.payload,prior=p.customerOffer;
    const offer=makeCommercialOfferV24(p,row.label||'',{
      customer:prior?.customer||'',
      validUntil:'',
      leadTime:prior?.leadTime||'',
      conditions:prior?.conditions||''
    });
    const rawValidity=plainOfferV24(prior?.validUntil,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(rawValidity))offer.validUntil=rawValidity;
    offer.reference=plainOfferV24(prior?.reference||row.label,120);
    return offer;
  }
  function customerTextV24(offer){
    if(!offer)return '';
    const euros=cents=>euroV2(Number(cents)/100);
    const expiry=offer.validUntil?new Date(offer.validUntil+'T12:00:00').toLocaleDateString('pt-PT'):'A confirmar';
    return [
      'ARTESSENCIA — PROPOSTA COMERCIAL',
      offer.reference?'Referência: '+offer.reference:'',
      offer.customer?'Destinatário: '+offer.customer:'',
      offer.kind+': '+offer.item,
      'Quantidade: '+offer.quantity+' unidades',
      'Preço por unidade: '+euros(offer.unitCents),
      'Total proposto: '+euros(offer.totalCents),
      'Validade da proposta: '+expiry,
      offer.leadTime?'Prazo previsto: '+offer.leadTime:'',
      offer.conditions?'Condições: '+offer.conditions:'',
      'Valores e disponibilidade sujeitos a confirmação pela ArtEssencia.',
      'A aceitação da proposta não confirma uma encomenda nem constitui pagamento.'
    ].filter(Boolean).join('\n');
  }
  function displayCommercialV24(offer){
    currentCommercialOffer=offer;
    const textarea=$('aeQProposalText'),text=customerTextV24(offer);
    if(textarea)textarea.value=text;
    for(const id of ['aeQCopy','aeQPrintV24','aeQWhatsAppV24']){
      const button=$(id);if(button)button.disabled=!offer;
    }
    const status=$('aeQOfferPrivacyV24');if(status)status.textContent=offer?
      'Documento para cliente: apenas artigos, quantidades, preços e condições comerciais. Sem custos internos.':
      'Guarda uma proposta aprovada ou consulta uma proposta anterior para disponibilizar o texto.';
  }
  function currentOfferFieldsV24(){
    return {
      customer:$('aeQOfferClientV24')?.value||'',
      validUntil:$('aeQOfferExpiryV24')?.value||'',
      leadTime:$('aeQOfferLeadV24')?.value||'',
      conditions:$('aeQOfferConditionsV24')?.value||''
    };
  }
  function printableOfferV24(){
    if(!currentCommercialOffer)return state('Seleciona uma proposta guardada antes de imprimir.');
    const win=window.open('','_blank','width=780,height=920');
    if(!win){state('A impressão foi bloqueada pelo navegador. Usa Copiar proposta.');return;}
    try{
      win.opener=null;
      const content=customerTextV24(currentCommercialOffer).split('\n');
      const rows=content.map((line,i)=>i===0?
        '<h1>'+safeText(line)+'</h1>':
        '<p>'+safeText(line)+'</p>').join('');
      win.document.open();
      win.document.write('<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Proposta comercial ArtEssencia</title>'+
        '<style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#48362b;line-height:1.5;max-width:780px;margin:32px auto;padding:0 18px}'+
        'h1{font-family:Georgia,serif;font-size:23px;border-bottom:2px solid #a78b6a;padding-bottom:12px}p{font-size:13px;margin:9px 0;overflow-wrap:anywhere}'+
        'p:nth-of-type(5){font-size:16px;font-weight:bold}p:last-child{margin-top:25px;font-size:11px;color:#806e5f}</style></head><body>'+rows+'</body></html>');
      win.document.close();win.focus();win.print();
    }catch(error){state('Não foi possível imprimir: '+(error?.message||String(error)));}
  }
  function whatsappOfferV24(){
    if(!currentCommercialOffer)return state('Seleciona uma proposta guardada antes de partilhar.');
    const text=customerTextV24(currentCommercialOffer);
    const url='https://wa.me/?text='+encodeURIComponent(text);
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(!opened)state('Se o WhatsApp não abrir, copia a proposta e envia-a manualmente.');
  }
  function installCommercialV24(){
    const panel=$('aeQHistory')?.closest('.aeq-panel'),approval=$('aeQApproval')?.closest('label');
    if(!panel||!approval||$('aeQOfferClientV24'))return;
    const details=document.createElement('details');details.className='aeq-offer-fields-v24';
    details.innerHTML='<summary>Personalizar condições da proposta ao cliente</summary>'+
      '<div class="aeq-offer-grid-v24">'+
      '<label>Nome do cliente (opcional)<input id="aeQOfferClientV24" maxlength="120" autocomplete="off" placeholder="Destinatário"></label>'+
      '<label>Válida até (opcional)<input id="aeQOfferExpiryV24" type="date"></label>'+
      '<label>Prazo previsto (opcional)<input id="aeQOfferLeadV24" maxlength="180" placeholder="Ex.: A confirmar após aceitação"></label>'+
      '<label>Condições comerciais (opcional)<textarea id="aeQOfferConditionsV24" rows="2" maxlength="500" placeholder="Ex.: Transporte sob orçamento separado"></textarea></label>'+
      '</div><small>Estas condições serão fixadas na nova proposta. Não modificam simulações anteriores.</small>';
    approval.before(details);
    const copy=$('aeQCopy');if(copy){
      const actions=document.createElement('div');actions.className='aeq-offer-actions-v24';
      copy.before(actions);actions.append(copy);
      const print=document.createElement('button');print.type='button';
      print.className='btn';print.id='aeQPrintV24';print.textContent='Imprimir / PDF';
      print.addEventListener('click',printableOfferV24);actions.append(print);
      const whatsapp=document.createElement('button');whatsapp.type='button';
      whatsapp.className='btn';whatsapp.id='aeQWhatsAppV24';whatsapp.textContent='Abrir WhatsApp';
      whatsapp.addEventListener('click',whatsappOfferV24);actions.append(whatsapp);
    }
    const note=document.createElement('p');note.id='aeQOfferPrivacyV24';
    note.className='aeq-offer-privacy-v24';panel.append(note);
    displayCommercialV24(null);
  }

  // V2.5 — gestão de decisões comerciais. A escrita só funciona com a migração RLS aplicada.
  const EVENTS_V25='artessencia_quantity_proposal_events_v1';
  let eventsAvailableV25=false,eventsByProposalV25=new Map(),eventBusyV25=false;
  const EVENT_LABEL_V25={sent:'Enviada',accepted:'Aceite',declined:'Recusada',cancelled:'Cancelada'};
  const EVENT_CHANNEL_V25={whatsapp:'WhatsApp',email:'Email',phone:'Telefone',in_person:'Presencial',other:'Outro'};
  function proposalStatusV25(row){
    const events=eventsByProposalV25.get(row.simulation_id)||[];
    const last=events[events.length-1]?.event_type;
    if(['accepted','declined','cancelled'].includes(last))
      return {value:last,label:EVENT_LABEL_V25[last]};
    const date=String(row.payload?.customerOffer?.validUntil||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
      const expiry=new Date(date+'T23:59:59');
      if(Number.isFinite(expiry.getTime())&&expiry.getTime()<Date.now())
        return {value:'expired',label:'Validade terminada'+(last==='sent'?' (enviada)':'')};
    }
    return last==='sent'?{value:'sent',label:'Enviada'}:{value:'draft',label:'Rascunho'};
  }
  async function loadProposalEventsV25(userId,ids){
    eventsAvailableV25=false;eventsByProposalV25=new Map();
    if(!ids.length){eventsAvailableV25=true;return;}
    const {data,error}=await cloudClient.from(EVENTS_V25)
      .select('event_id,proposal_id,event_type,channel,note,created_at')
      .eq('user_id',userId).in('proposal_id',ids)
      .order('created_at',{ascending:true}).limit(200);
    if(error){state('Histórico das decisões indisponível. Não é possível alterar estados até corrigir a ligação Cloud.');return;}
    eventsAvailableV25=true;
    (data||[]).forEach(e=>{
      if(!eventsByProposalV25.has(e.proposal_id))eventsByProposalV25.set(e.proposal_id,[]);
      eventsByProposalV25.get(e.proposal_id).push(e);
    });
  }
  function manageProposalV25(row,holder){
    const status=proposalStatusV25(row);
    const panel=document.createElement('details');panel.className='aeq-status-panel-v25';
    const summary=document.createElement('summary');summary.textContent='Estado: '+status.label+' · Gerir';panel.append(summary);
    const history=document.createElement('div');history.className='aeq-status-history-v25';
    const existing=eventsByProposalV25.get(row.simulation_id)||[];
    history.textContent=existing.length?'Histórico de decisões':'Sem decisões registadas';
    existing.forEach(e=>{
      const line=document.createElement('p');
      line.textContent=new Date(e.created_at).toLocaleString('pt-PT')+
        ' · '+(EVENT_LABEL_V25[e.event_type]||e.event_type)+
        ' · '+(EVENT_CHANNEL_V25[e.channel]||e.channel)+
        (e.note?' · '+e.note:'');
      history.append(line);
    });
    panel.append(history);
    if(!eventsAvailableV25){
      const note=document.createElement('p');note.textContent='A gestão de estados necessita da migração Cloud autorizada.';panel.append(note);
      holder.append(panel);return;
    }
    const available=status.value==='draft'?['sent','cancelled']:
      status.value==='sent'?['accepted','declined','cancelled']:
      status.value==='expired'?['cancelled']:[];
    if(available.length){
      const actions=document.createElement('div');actions.className='aeq-status-actions-v25';
      const select=document.createElement('select');select.setAttribute('aria-label','Nova decisão');
      available.forEach(v=>{const option=document.createElement('option');option.value=v;option.textContent=EVENT_LABEL_V25[v];select.append(option);});
      const channel=document.createElement('select');channel.setAttribute('aria-label','Canal de confirmação');
      Object.entries(EVENT_CHANNEL_V25).forEach(([key,label])=>{
        const option=document.createElement('option');option.value=key;option.textContent=label;channel.append(option);
      });
      const note=document.createElement('textarea');note.rows=2;note.maxLength=500;
      note.placeholder='Referência da comunicação ou confirmação do cliente';
      note.setAttribute('aria-label','Justificação ou evidência');
      if(status.value==='expired'){
        const expiryNote=document.createElement('p');expiryNote.className='aeq-status-expired-v25';
        expiryNote.textContent='A validade terminou. Só é permitido cancelar esta proposta; para novo orçamento, cria outra simulação.';
        actions.append(expiryNote);
      }
      const submit=document.createElement('button');submit.type='button';submit.className='btn';submit.textContent='Registar decisão';
      submit.addEventListener('click',async()=>{
        const target=select.value,noteValue=note.value.trim();
        if(eventBusyV25)return;
        if(target!=='cancelled'&&noteValue.length<5)return state('Indica como foi confirmada a decisão (mínimo 5 caracteres).');
        const question=target==='accepted'?
          'Registar a aceitação do cliente? Isto NÃO cria encomenda nem reserva stock.':
          'Registar '+(EVENT_LABEL_V25[target]||target).toLowerCase()+'? O evento ficará no histórico sem possibilidade de alteração.';
        if(!confirm(question))return;
        eventBusyV25=true;submit.disabled=true;
        try{
          const user=await session();
          if(!user?.id)throw Error('Sessão Cloud inválida.');
          const payload={proposal_id:row.simulation_id,user_id:user.id,event_type:target,channel:channel.value,note:noteValue};
          const {error}=await cloudClient.from(EVENTS_V25).insert(payload);
          if(error)throw error;
          state('Decisão registada na Cloud. Nenhuma encomenda ou movimento de stock foi criado.');
          await loadHistory(true);
        }catch(e){state('Não foi possível registar a decisão: '+(e?.message||String(e)));}
        finally{eventBusyV25=false;submit.disabled=false;}
      });
      actions.append(select,channel,note,submit);panel.append(actions);
    }else{
      const note=document.createElement('p');
      note.textContent='Decisão final: para alterar o resultado, cria uma nova proposta comercial.';
      panel.append(note);
    }
    holder.append(panel);
  }
  function session() {
    if(typeof cloudClient==='undefined'||!cloudClient||typeof ensureCloudSession!=='function')throw new Error('É necessária uma sessão Cloud autenticada.');
    return ensureCloudSession();
  }
  async function saveSimulation(proposal) {
    if(busy)return;busy=true;
    try {
      if(navigator.onLine===false)throw new Error('Sem ligação à Internet. Não foi gravado.');
      const u=await session();if(!u?.id)throw new Error('Inicia sessão na Cloud.');
      const now=compute(),sign=signature(now);
      const issues=priceDataIssuesV22(now);
      if(issues.length)throw new Error(issues.join(' '));
      const entered=Number($('qtyPricingUnitsV1750')?.value);
      if(!Number.isInteger(entered)||entered<1||entered>10000||entered!==now.units)throw new Error('Indica uma quantidade inteira entre 1 e 10 000 unidades.');
      if(now.materials.some(m=>Number(m.totalQty)>0&&!(Number(m.unitCost)>0)))throw new Error('Existem materiais sem custo unitário válido no Stock. Corrige a ficha de custos antes de guardar.');
      if(proposal) {
        if(!$('aeQApproval')?.checked)throw new Error('Confirma a validação dos custos antes de preparar a proposta.');
        if(!lastSaved||lastSaved.signature!==sign)throw new Error('Guarda primeiro esta versão da simulação na Cloud.');
      }
      const label=($('aeQLabel')?.value||now.productName||'Lote personalizado').trim().slice(0,120)||'Simulação';
      const offer=proposal?makeCommercialOfferV24(lastSaved.payload,label,currentOfferFieldsV24()):null;
      const payload=proposal?Object.assign({},lastSaved.payload,{approvedAt:new Date().toISOString(),customerOffer:offer}):Object.assign({},now,{createdAt:new Date().toISOString()});
      state(proposal?'A guardar proposta em rascunho…':'A guardar simulação…');
      const row={user_id:u.id,kind:proposal?'proposal':'simulation',status:'draft',
        label:proposal?'Proposta — '+label:label,payload};
      if(proposal)row.source_simulation_id=lastSaved.id;
      const {data,error}=await cloudClient.from(TABLE).insert(row).select('simulation_id,created_at').single();
      if(error)throw error;
      if(!proposal){
        lastSaved={id:data.simulation_id,signature:sign,payload};
        state('Simulação guardada na Cloud em '+new Date(data.created_at).toLocaleString('pt-PT')+'.');
      }else{
        displayCommercialV24(offer);
        state('Proposta '+data.simulation_id.slice(0,8)+' criada como rascunho privado na Cloud. Não foi enviada nem convertida em encomenda.');
      }
      await loadHistory(true);
    } catch (e) {state('Não foi guardado: '+(e?.message||String(e)));}
    finally{busy=false;}
  }
  async function loadHistory(force) {
    if(busy&&!force)return;
    if(!force&&Date.now()-historyLoadedAt<60000)return;
    try{
      const u=await session();if(!u?.id)return;
      const {data,error}=await cloudClient.from(TABLE)
        .select('simulation_id,kind,status,label,payload,created_at,source_simulation_id')
        .eq('user_id',u.id).order('created_at',{ascending:false}).limit(50);
      if(error)throw error;
      historyLoadedAt=Date.now();
      const el=$('aeQHistory');if(!el)return;
      el.replaceChildren();
      if(!data?.length){el.textContent='Ainda não existem simulações guardadas na Cloud.';return;}
      historyVisible=6;
      const proposalIds=(data||[]).filter(r=>r.kind==='proposal').map(r=>r.simulation_id);
      await loadProposalEventsV25(u.id,proposalIds);
      data.forEach(row=>{
        const wrap=document.createElement('div');wrap.className='aeq-history-row';
        const info=document.createElement('span');
        info.textContent=(row.kind==='proposal'?'Proposta · ':'Simulação · ')+row.label+' · '+
          new Date(row.created_at).toLocaleString('pt-PT')+' · '+euroV2(row.payload?.finalTotal);
        const btn=document.createElement('button');btn.className='btn';btn.type='button';
        btn.textContent='Consultar';btn.onclick=()=>consultSnapshot(row);
        wrap.append(info,btn);if(row.kind==='proposal')manageProposalV25(row,wrap);el.append(wrap);
      });
      updateHistoryPaging();
    } catch(e) {state('Histórico Cloud indisponível: '+(e?.message||e));}
  }
  function consultSnapshot(row) {
    const s=row?.payload,el=$('aeQHistoryDetail');
    if(!el)return;
    if(!s||!Array.isArray(s.materials)){el.textContent='O registo guardado está incompleto.';displayCommercialV24(null);return;}
    if(row.kind==='proposal'){
      try{displayCommercialV24(offerFromStoredV24(row));}
      catch(error){displayCommercialV24(null);state('A proposta antiga tem valores inconsistentes e não pode ser partilhada.');}
    }else displayCommercialV24(null);
    // Ler o cenário original; nunca aplicar silenciosamente os custos atuais do Stock.
    const rows=[
      ...(s.mode==='box'?[['Box',String(s.boxName||'—')],['Revisão',String(s.boxRevision||'—')],['Custo da revisão por Box',euroV2(s.boxCostComponents?.total||0)]]:[]),
      ['Unidades',String(s.units||'—')],
      ['Custo total guardado',euroV2(s.costTotal)],
      ['Custo unitário guardado',euroV2(s.costUnit)],
      ['Preço recomendado à data',euroV2(s.recommendedUnit)],
      ['Preço final por unidade',euroV2(s.finalUnit)],
      ['Preço comercial total',euroV2(s.finalTotal)],
      ['Lucro previsto à data',euroV2(s.profit)],
      ['Margem efetiva à data',pctV2((Number(s.marginReal)||0)*100)]
    ];
    el.innerHTML='<div class="aeq-panel"><h3>'+safeText(row.label)+'</h3>'+
      '<p>Consulta do registo original em '+safeText(new Date(row.created_at).toLocaleString('pt-PT'))+
      '. Os custos de materiais, taxas de trabalho e valores registados não são recalculados.</p>'+
      '<dl class="aeq-snapshot">'+rows.map(([name,value])=>'<div><dt>'+safeText(name)+
        '</dt><dd>'+safeText(value)+'</dd></div>').join('')+'</dl>'+
      '<details><summary>Materiais e custos registados</summary><ul>'+
      s.materials.map(m=>'<li>'+safeText(m.item)+': '+safeText(m.totalQty)+' '+
        safeText(m.unit)+' · '+euroV2(m.cost)+'</li>').join('')+'</ul></details></div>';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUI,{once:true});
  else addUI();
})();