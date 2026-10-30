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
  let busy=false,lastSaved=null,historyLoadedAt=0;
  if(typeof baseline!=='function'||typeof originalRefresh!=='function'||typeof originalRender!=='function')return;
  function safeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function priceFor(cost,percent,mode) {
    if (!Number.isFinite(cost)||cost<0||!Number.isFinite(percent)) return NaN;
    const raw=mode==='markup'?cost*(1+percent/100):cost/(1-percent/100);
    return typeof batchPriceRoundV1743==='function'?batchPriceRoundV1743(raw):Math.ceil((raw-1e-9)*100)/100;
  }
  function compute(units) {
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
  }
  window.quantityPricingMarginMethodV2=function(){const input=$('qtyPricingMarginV1750');if(input)input.max=$('aeQMarginMode')?.value==='markup'?'1000':'95';window.refreshQuantityPricingV1750();};
  function state(message) {const el=$('aeQCloudState');if(el)el.textContent=message;}
  function signature(s) {
    return JSON.stringify([s.mode,s.productCode,s.units,s.materials,s.minutesPerUnit,
      s.efficiencyPct,s.totalMinutes,s.otherCost,s.setupMinutes,s.packagingCost,s.wasteCost,
      s.marginMode,s.marginPct,s.discountPct,s.finalUnit,s.finalTotal]);
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
      return '<tr'+highlight+'><td>'+q+'</td><td>'+euroV2(n.costTotal)+'</td><td>'+euroV2(n.costUnit)+'</td><td>'+euroV2(n.recommendedUnit)+'</td><td>'+euroV2(n.profit)+'</td><td>'+pctV2(n.marginReal*100)+'</td></tr>';
    }).join('');
  }
  window.refreshQuantityPricingV1750=function(){originalRefresh();renderEnhanced();};
  window.quantityPricingSnapshotV1751=function(){return compute();};
  window.renderQuantityPricingV1750=function(){addUI();originalRender();renderEnhanced();if(Date.now()-historyLoadedAt>60000)loadHistory(false);};
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
      if(!Number.isFinite(now.costTotal)||now.costTotal<=0||now.units<1||now.finalUnit<=0)throw new Error('Indica custos positivos e um preço final válido.');
      const entered=Number($('qtyPricingUnitsV1750')?.value);
      if(!Number.isInteger(entered)||entered<1||entered>10000||entered!==now.units)throw new Error('Indica uma quantidade inteira entre 1 e 10 000 unidades.');
      if(now.materials.some(m=>Number(m.totalQty)>0&&!(Number(m.unitCost)>0)))throw new Error('Existem materiais sem custo unitário válido no Stock. Corrige a ficha de custos antes de guardar.');
      if(proposal) {
        if(!$('aeQApproval')?.checked)throw new Error('Confirma a validação dos custos antes de preparar a proposta.');
        if(!lastSaved||lastSaved.signature!==sign)throw new Error('Guarda primeiro esta versão da simulação na Cloud.');
      }
      const label=($('aeQLabel')?.value||now.productName||'Lote personalizado').trim().slice(0,120)||'Simulação';
      const payload=proposal?Object.assign({},lastSaved.payload,{approvedAt:new Date().toISOString()}):Object.assign({},now,{createdAt:new Date().toISOString()});
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
        const price=euroV2(payload.finalTotal);
        const txt='ARTESSENCIA — PROPOSTA COMERCIAL (rascunho)\n'+
          label+'\n'+payload.units+' unidades · '+euroV2(payload.finalUnit)+' por unidade.\n'+
          'Total proposto: '+price+'.\n'+
          'Valores sujeitos a confirmação de disponibilidade, prazo e condições comerciais.\n'+
          'Esta proposta não constitui encomenda nem reserva de produtos.';
        if($('aeQProposalText'))$('aeQProposalText').value=txt;
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
      data.forEach(row=>{
        const wrap=document.createElement('div');wrap.className='aeq-history-row';
        const info=document.createElement('span');
        info.textContent=(row.kind==='proposal'?'Proposta · ':'Simulação · ')+row.label+' · '+
          new Date(row.created_at).toLocaleString('pt-PT')+' · '+euroV2(row.payload?.finalTotal);
        const btn=document.createElement('button');btn.className='btn';btn.type='button';
        btn.textContent='Consultar';btn.onclick=()=>consultSnapshot(row);
        wrap.append(info,btn);el.append(wrap);
      });
    } catch(e) {state('Histórico Cloud indisponível: '+(e?.message||e));}
  }
  function consultSnapshot(row) {
    const s=row?.payload,el=$('aeQHistoryDetail');
    if(!el)return;
    if(!s||!Array.isArray(s.materials)){el.textContent='O registo guardado está incompleto.';return;}
    // Ler o cenário original; nunca aplicar silenciosamente os custos atuais do Stock.
    const rows=[
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