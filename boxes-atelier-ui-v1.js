/* ArtEssencia — Catálogos & Boxes: navegação e composição não destrutiva.
   Mantém os formulários e dados existentes. Uma box nunca é publicada automaticamente. */
(function(){
'use strict';
const ID='aeBoxesHubV1', $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const text=v=>String(v??'').trim();
const productKey=p=>text(p?.code||p?.id);
const usable=p=>p&&p.active!==false&&!p.archivedV1803;
let selected=[], custom=[], activeTab='ready';
function products(){return (Array.isArray(db?.products)?db.products:[]).filter(p=>usable(p)&&productKey(p)&&text(p.name)).sort((a,b)=>text(a.name).localeCompare(text(b.name),'pt-PT'))}
function match(code){return (db?.products||[]).find(p=>productKey(p)===code)}
function composition(){return selected.map(x=>({code:String(x.code),qty:Math.max(1,Math.min(1000,Number(x.qty)||1))})).filter(x=>match(x.code))}
function aeMarginValueV1(id){
 const raw=String($(id)?.value??'').trim().replace(',','.');
 const val=Number(raw);
 return raw!==''&&Number.isFinite(val)&&val>=0&&val<=95?val:null;
}
function aeSuggestedPriceV1(cost,margin){
 return cost>0&&Number.isFinite(cost)&&margin!==null?Math.ceil((cost/(1-margin/100)-1e-9)*100)/100:null;
}
function aeActualMarginV1(cost,price){return price>0?(price-cost)/price*100:null;}
function aeMissingProductCostsV1(rows){
 if(typeof productCostBreakdownV110!=='function')return rows.map(x=>text(x.code));
 return rows.filter(x=>{
  const p=match(x.code),c=p?Number(productCostBreakdownV110(p)?.total):NaN;
  return !Number.isFinite(c)||c<=0;
 }).map(x=>text(match(x.code)?.name||x.code));
}
function aeCostRowV1(label,value){return '<div class="ae-box-cost-row"><span>'+safe(label)+'</span><strong>'+money(value)+'</strong></div>';}
function selectedTotal(rows,cost=false){return rows.reduce((sum,x)=>{const p=match(x.code);if(!p)return sum;const n=cost?(typeof calculatedProductCost==='function'?Number(calculatedProductCost(p))||0:Number(p.cost)||0):(Number(p.onlinePrice)>0?Number(p.onlinePrice):Number(p.price)||0);return sum+n*x.qty},0)}
function drawPicker(target,rows,editMode){
 const h=$(target);if(!h)return;
 const source=products();
 const selectedCodes=new Set(rows.map(x=>x.code));
 const options=source.filter(p=>!selectedCodes.has(productKey(p))).map(p=>'<option value="'+safe(productKey(p))+'">'+safe(p.name)+' · '+safe(p.category||'Sem categoria')+'</option>').join('');
 const title=editMode?'Produtos que integram esta box':'Artigos escolhidos para a box';
 h.innerHTML='<div class="ae-box-pick-head"><b>'+title+'</b><small>Produtos reais do Backoffice, sem duplicar stock</small></div>'+
 '<div class="ae-box-add"><select id="'+target+'Add" aria-label="Adicionar produto"><option value="">Escolher produto…</option>'+options+'</select><button type="button" class="btn" data-aebox="add" data-target="'+target+'">+ Adicionar</button></div>'+
 '<div class="ae-box-items">'+(rows.length?rows.map((x,i)=>{const p=match(x.code);return '<div class="ae-box-line" data-line="'+i+'"><span><b>'+safe(p?.name||x.code)+'</b><small>'+safe(x.code)+'</small></span><label>Qtd.<input data-aebox-qty="'+i+'" type="number" min="1" max="1000" value="'+x.qty+'"></label><button type="button" class="btn" data-aebox-remove="'+i+'" aria-label="Retirar '+safe(p?.name||x.code)+'">Retirar</button></div>'}).join(''):'<div class="soft-note">Ainda não adicionaste artigos.</div>')+'</div>'+
 '<div class="ae-box-totals"><span>'+rows.reduce((s,r)=>s+r.qty,0)+' peça(s)</span><span>Custo de produtos: '+money(selectedTotal(rows,true))+'</span><span>PVP dos artigos: '+money(selectedTotal(rows,false))+'</span></div>';
}
function techDraftV2(){const num=id=>Math.max(0,Number(document.getElementById(id)?.value)||0);return {mode:document.getElementById('aeBoxMode')?.value||'finished',waxG:num('aeBoxWax'),fragranceG:num('aeBoxFragrance'),materialsCost:num('aeBoxMaterials'),productionMinutes:num('aeBoxProduction'),assemblyMinutes:num('aeBoxAssembly'),packagingMinutes:num('aeBoxPacking'),energyCost:num('aeBoxEnergy'),otherCost:num('aeBoxOther'),notes:document.getElementById('aeBoxTechNotes')?.value||''};}
function techCostV2(items,settings){
 const tech=settings||techDraftV2(),joint=tech.mode==='joint';
 let materials=0,labor=0,energy=0,indirect=0;
 if(!joint)for(const item of items){const p=match(item.code);if(!p)continue;const b=productCostBreakdownV110(p),q=Number(item.qty)||1;materials+=(Number(b.materials)||0)*q;labor+=(Number(b.labor)||0)*q+(Number(b.editionLabor)||0)*q;energy+=(Number(b.energy)||0)*q;indirect+=(Number(b.fixed)||0)*q+(Number(b.other)||0)*q+(Number(b.waste)||0)*q;}
 const rate=pricingLaborHourlyRateV1745();
 labor+=rate*((Number(tech.productionMinutes)||0)+(Number(tech.assemblyMinutes)||0)+(Number(tech.packagingMinutes)||0))/60;
 materials+=Number(tech.materialsCost)||0;energy+=Number(tech.energyCost)||0;indirect+=Number(tech.otherCost)||0;
 return {materials,labor,energy,indirect,total:materials+labor+energy+indirect,incomplete:joint&&!(Number(tech.materialsCost)>0)};
}
window.aeBoxTechDraftV2=techDraftV2;
window.aeBoxCostSnapshotV4=(items,tech,basePackaging,decorationCost,price)=>{
 const breakdown=techCostV2(items,tech);
 const physical=(db.packaging||[]).find(p=>p.name===basePackaging);
 const packaging=(Number(physical?.cost)||0)+(Number(decorationCost)||0);
 const total=breakdown.total+packaging;
 return {breakdown,packaging,total,price:Number(price)||0,profit:(Number(price)||0)-total,capturedAt:new Date().toISOString(),estimated:true};
};
let originRequestIdV4='';
window.aeBoxOriginRequestV4=()=>originRequestIdV4;
function previewPredefined(){
 const id=text($('themeBoxId')?.value),existing=(db.themedBoxes||[]).find(x=>x.id===id);
 const packaging=Math.max(0,Number((db.packaging||[]).find(x=>x.name===$('themeBoxBasePackaging')?.value)?.cost)||0);
 const decoration=Math.max(0,Number($('themeBoxDecorationCost')?.value)||0);
 const price=Number($('themeBoxPrice')?.value)||0,tech=techDraftV2(),items=composition();
 const breakdown=techCostV2(items,tech),cost=breakdown.total+packaging+decoration;
 const missing=tech.mode==='joint'?[]:aeMissingProductCostsV1(items);
 const complete=items.length>0&&!breakdown.incomplete&&cost>0&&Number.isFinite(cost)&&!missing.length;
 const margin=aeMarginValueV1('aeReadyMarginPctV1'),suggested=complete?aeSuggestedPriceV1(cost,margin):null;
 const info=$('aeBoxEstimateV1');if(!info)return;
 const actual=aeActualMarginV1(cost,price);
 info.innerHTML='<b>Simulador de custo e preço · '+(tech.mode==='joint'?'Produção conjunta':'Montagem de produtos acabados')+'</b>'+
  '<div class="ae-box-cost-lines">'+aeCostRowV1('Matérias-primas e produtos',breakdown.materials)+
   aeCostRowV1('Mão de obra de produção e montagem',breakdown.labor)+
   aeCostRowV1('Energia',breakdown.energy)+aeCostRowV1('Outros custos e desperdício',breakdown.indirect)+
   aeCostRowV1('Caixa física',packaging)+aeCostRowV1('Decoração',decoration)+'</div>'+
  '<div class="ae-box-cost-total"><span>Custo total estimado</span><strong>'+(complete?money(cost):'Por completar')+'</strong></div>'+
  '<div class="ae-box-cost-total"><span>PVP sugerido para '+(margin===null?'margem inválida':margin.toLocaleString('pt-PT')+'% de margem')+'</span><strong>'+(suggested===null?'—':money(suggested))+'</strong></div>'+
  '<div class="ae-box-cost-row"><span>PVP atualmente definido</span><strong>'+(price>0?money(price):'Por definir')+'</strong></div>'+
  (complete&&price>0?'<div class="ae-box-cost-row"><span>Lucro bruto com PVP atual</span><strong>'+money(price-cost)+'</strong></div>'+
  '<div class="ae-box-cost-row"><span>Margem efetiva</span><strong>'+actual.toLocaleString('pt-PT',{maximumFractionDigits:1})+'%</strong></div>':'')+
  (missing.length?'<small class="ae-box-cost-warning">Custos em falta: '+safe(missing.join(', '))+'. Completa as fichas técnicas desses produtos.</small>':'')+
  (!items.length?'<small class="ae-box-cost-warning">Adiciona produtos à Box.</small>':'')+
  (breakdown.incomplete?'<small class="ae-box-cost-warning">Na produção conjunta, insere o custo total da receita própria.</small>':'')+
  (margin===null?'<small class="ae-box-cost-warning">A margem tem de estar entre 0% e 95%.</small>':'')+
  '<small>Fórmula: preço sugerido = custo total ÷ (1 − margem/100). A margem incide sobre o preço de venda, não é um acréscimo ao custo.</small>'+
  '<small>Na montagem somam-se os custos técnicos dos produtos mais os extras da Box. Na produção conjunta, o custo da receita é introduzido diretamente para não duplicar cera e mão de obra.</small>'+
  (existing?'<small>O preço da Box guardada só muda se aplicares o preço sugerido e guardares novamente.</small>':'');
 const apply=$('aeReadyApplyPriceV1');
 if(apply){apply.disabled=suggested===null;apply.dataset.suggested=suggested===null?'':String(suggested);}
}

function loadExisting(b){selected=Array.isArray(b?.items)?b.items.map(x=>({code:text(x.code),qty:Number(x.qty)||1})).filter(x=>x.code):[];drawPicker('aeBoxProductsV1',selected,true);previewPredefined();}
function showTab(tab){
 const hub=$(ID);if(!hub)return;
 const names=['ready','custom','requests','pdf','advanced'];
 activeTab=names.includes(tab)?tab:'ready';
 names.forEach(n=>{
  const panel=$('aeHubPanel_'+n);if(panel)panel.hidden=n!==activeTab;
  const btn=hub.querySelector('[data-ae-tab="'+n+'"]');
  if(btn){btn.classList.toggle('primary',n===activeTab);btn.setAttribute('aria-selected',String(n===activeTab));}
 });
 if(activeTab==='ready'){drawPicker('aeBoxProductsV1',selected,true);previewPredefined();}
 if(activeTab==='ready')reloadPublicBoxesV1();
 if(activeTab==='custom')drawCustom();
 if(activeTab==='requests')loadBoxRequestsV2();
}
function phone(){let n=text(db?.settings?.businessPhone).replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);return n.length===9?'351'+n:n;}
function proposal(){
 const title=text($('aeCustomTitleV1')?.value)||'Box personalizada ArtEssencia';
 const notes=text($('aeCustomNotesV1')?.value),dedication=text($('aeCustomNameV1')?.value);
 const box=text($('aeCustomPackagingV1')?.value);
 const lines=custom.map(x=>{const p=match(x.code);return x.qty+' × '+(p?.name||x.code)+' (ref. '+x.code+')'}).join('\n');
 if(!lines)throw new Error('Escolhe pelo menos um produto');
 return ['Olá! Gostaria de pedir informações sobre uma Box ArtEssencia.',title,'',lines,'','Apresentação: '+(box||'Por definir'),
 dedication?'Nome/mensagem: '+dedication:'',
 notes?'Preferências: '+notes:'',
 aeCustomEstimateV1().quote!==null?'Preço indicativo proposto: '+money(aeCustomEstimateV1().quote):'Preço final sujeito a orçamento da ArtEssencia',
 'Stock, embalagem e prazo sujeitos a confirmação da ArtEssencia.'].filter(Boolean).join('\n');
}
async function buildCustomBoxPdfV1(){
 const proposalText=proposal();
 const pages=[],W=1240,H=1754;
 let canvas,ctx,y;
 async function start(){
  canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  ctx=canvas.getContext('2d');if(!ctx)throw new Error('PDF indisponível');
  await drawArtEssenciaHeader(ctx,'BOX PERSONALIZADA','Proposta não vinculativa · '+new Date().toLocaleDateString('pt-PT'));
  y=235;
 }
 async function finish(){
  drawCatalogFooter(ctx);
  const blob=await new Promise((ok,no)=>canvas.toBlob(file=>file?ok(file):no(new Error('Erro ao gerar PDF')),'image/jpeg',0.9));
  pages.push(blob);
 }
 await start();
 for(const textLine of proposalText.split('\n')){
  ctx.font='21px Arial';ctx.fillStyle='#49382e';
  const lines=textLine?wrapCanvasText(ctx,textLine,1040):[''];
  for(const line of lines){
   if(y+48>1570){await finish();await start();}
   ctx.fillText(line,90,y);y+=38;
  }
  y+=12;
 }
 await finish();
 return jpegBlobsToPDF(pages,W,H);
}

function customerLink(items){
 const url=new URL('https://catalogo.artessenciatlier.pt/boxes.html');
 items.filter(x=>{const p=match(x.code);return p&&p.shopVisible&&p.publicReleasePendingV1803!==true;}).slice(0,30).forEach(x=>url.searchParams.append('produto',x.code));
 return url.href;
}
function copy(v){
 if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(v).then(()=>toast('Copiado'));
 const node=document.createElement('textarea');node.value=v;node.style.position='fixed';node.style.opacity='0';document.body.append(node);node.select();document.execCommand('copy');node.remove();toast('Copiado');
}
function aeCustomEstimateV1(){
 const pk=$('aeCustomPackagingV1')?.value||'';
 const packaging=Math.max(0,Number((db.packaging||[]).find(x=>x.name===pk)?.cost)||0);
 const assembly=Math.max(0,Number($('aeCustomAssemblyV1')?.value)||0);
 const extras=Math.max(0,Number($('aeCustomMaterialsV1')?.value)||0);
 const others=Math.max(0,Number($('aeCustomOtherV1')?.value)||0);
 const breakdown=techCostV2(custom,{mode:'finished',materialsCost:extras,
   productionMinutes:0,assemblyMinutes:assembly,packagingMinutes:0,energyCost:0,otherCost:others});
 const cost=breakdown.total+packaging,missing=aeMissingProductCostsV1(custom);
 const complete=custom.length>0&&missing.length===0&&cost>0&&Number.isFinite(cost);
 const margin=aeMarginValueV1('aeCustomMarginPctV1');
 const suggested=complete?aeSuggestedPriceV1(cost,margin):null;
 const quoteRaw=String($('aeCustomQuotePriceV1')?.value??'').trim().replace(',','.');
 const quote=quoteRaw!==''&&Number(quoteRaw)>0&&Number.isFinite(Number(quoteRaw))?Number(quoteRaw):null;
 return {breakdown,packaging,assembly,extras,others,cost,missing,complete,margin,suggested,quote};
}
function renderCustomEstimateV1(){
 const v=aeCustomEstimateV1(),el=$('aeCustomTotalV1');if(!el)return;
 el.innerHTML='<b>Como se calcula o preço da Box personalizada</b>'+
 '<div class="ae-box-cost-lines">'+aeCostRowV1('Matérias-primas dos artigos e extras',v.breakdown.materials)+
 aeCostRowV1('Mão de obra dos artigos e montagem',v.breakdown.labor)+
 aeCostRowV1('Energia dos artigos',v.breakdown.energy)+
 aeCostRowV1('Outros custos dos artigos e extras',v.breakdown.indirect)+
 aeCostRowV1('Embalagem escolhida',v.packaging)+'</div>'+
 '<div class="ae-box-cost-total"><span>Custo total estimado</span><strong>'+(v.complete?money(v.cost):'Por completar')+'</strong></div>'+
 '<div class="ae-box-cost-total"><span>Preço sugerido ('+(v.margin===null?'margem inválida':v.margin.toLocaleString('pt-PT')+'% de margem')+')</span><strong>'+(v.suggested===null?'—':money(v.suggested))+'</strong></div>'+
 (v.complete&&v.quote!==null?'<div class="ae-box-cost-row"><span>Lucro com o preço proposto</span><strong>'+money(v.quote-v.cost)+'</strong></div>'+
 '<div class="ae-box-cost-row"><span>Margem efetiva do preço proposto</span><strong>'+aeActualMarginV1(v.cost,v.quote).toLocaleString('pt-PT',{maximumFractionDigits:1})+'%</strong></div>':'')+
 (v.missing.length?'<small class="ae-box-cost-warning">Custos técnicos em falta: '+safe(v.missing.join(', '))+'.</small>':'')+
 (!custom.length?'<small class="ae-box-cost-warning">Seleciona os artigos para calcular o custo.</small>':'')+
 (v.margin===null?'<small class="ae-box-cost-warning">Introduz uma margem entre 0% e 95%.</small>':'')+
 '<small>Preço sugerido = custo total ÷ (1 − margem/100). Inclui custo de fabrico dos artigos, embalagem, materiais extra e tempo de montagem.</small>'+
 '<small>Este simulador calcula montagem de produtos acabados. Se a Box tiver uma receita produzida em conjunto, prepara uma ficha técnica própria em Boxes pré-definidas ou a partir de um pedido.</small>'+
 '<small>O preço indicativo só aparece na proposta enviada se estiver preenchido; não é uma encomenda confirmada.</small>';
 const apply=$('aeCustomApplyPriceV1');
 if(apply){apply.disabled=v.suggested===null;apply.dataset.suggested=v.suggested===null?'':String(v.suggested);}
}
function drawCustom(){drawPicker('aeCustomProductsV1',custom,false);renderCustomEstimateV1();}

function renderPredefinedExtras(){
 const editor=document.querySelector('#catalogs .catalog-editor-card');
 if(!editor||$('aeBoxProductsV1'))return;
 const box=document.createElement('div');
 box.innerHTML='<div class="ae-box-composition"><h3>Composição da Box</h3><p class="muted">Escolhe produtos e quantidades. Não cria produtos nem encomendas adicionais.</p><div id="aeBoxProductsV1"></div><div class="ae-box-margin-editor"><label>Margem de lucro pretendida (%)<input id="aeReadyMarginPctV1" type="number" inputmode="decimal" min="0" max="95" step="0.5" value="35"></label><button type="button" class="btn" id="aeReadyApplyPriceV1" data-ae-price-apply="ready">Aplicar preço sugerido ao PVP</button></div><div id="aeBoxEstimateV1" class="ae-box-estimate" aria-live="polite"></div></div>';
 editor.append(box);
 const name=$('themeBoxName');if(name)name.placeholder='Ex.: Box Natal — Doces & Aromas';
 ['themeBoxPrice','themeBoxBasePackaging','themeBoxDecorationCost','aeReadyMarginPctV1'].forEach(id=>{$(id)?.addEventListener('input',previewPredefined);$(id)?.addEventListener('change',previewPredefined)});
 const original=window.editThemedBox;
 if(typeof original==='function')window.editThemedBox=function(id){original(id);const b=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));const m=$('aeReadyMarginPctV1');if(m)m.value=b?.targetMarginPct!=null&&Number.isFinite(Number(b.targetMarginPct))?String(b.targetMarginPct):'35';loadExisting(b);loadTechV2(b);originRequestIdV4=text(b?.originRequestId||'');showTab('ready')};
 const clear=window.clearThemedBoxForm;
 if(typeof clear==='function')window.clearThemedBoxForm=function(){clear();selected=[];originRequestIdV4='';const m=$('aeReadyMarginPctV1');if(m)m.value='35';drawPicker('aeBoxProductsV1',selected,true);loadTechV2(null);previewPredefined()};
 const tech=document.createElement('div');tech.className='ae-box-composition';
 tech.innerHTML='<h3>Ficha técnica própria da Box</h3><p class="muted">Produção conjunta não soma novamente a cera e a mão de obra das fichas individuais.</p><div class="ae-custom-grid">'+
 '<label>Tipo de produção<select id="aeBoxMode"><option value="finished">Montar produtos acabados</option><option value="joint">Produção conjunta / receita própria</option></select></label>'+
 '<label>Cera total (g)<input id="aeBoxWax" type="number" step=".1" min="0"></label>'+
 '<label>Fragrância total (g)<input id="aeBoxFragrance" type="number" step=".1" min="0"></label>'+
 '<label>Custo das matérias-primas adicionais ou receita própria (€)<input id="aeBoxMaterials" type="number" step=".01" min="0"></label>'+
 '<label>Produção conjunta (min)<input id="aeBoxProduction" type="number" min="0"></label>'+
 '<label>Montagem (min)<input id="aeBoxAssembly" type="number" min="0"></label>'+
 '<label>Embalagem (min)<input id="aeBoxPacking" type="number" min="0"></label>'+
 '<label>Energia adicional (€)<input id="aeBoxEnergy" type="number" min="0" step=".01"></label>'+
 '<label>Outros custos (€)<input id="aeBoxOther" type="number" min="0" step=".01"></label>'+
 '<label>Instruções de fabrico<textarea id="aeBoxTechNotes" rows="3"></textarea></label></div><div id="aeBoxTechSummary" class="ae-box-estimate"></div>';
 editor.append(tech);
 const tools=document.createElement('div');tools.className='ae-custom-actions';tools.innerHTML='<button type="button" class="btn" data-ae-techprint="A5">Imprimir ficha de produção (A5)</button><button type="button" class="btn" data-ae-techprint="A4">Imprimir ficha com custos (A4)</button>';
 tech.append(tools);
 tools.querySelectorAll('[data-ae-techprint]').forEach(button=>button.addEventListener('click',()=>aeBoxPrintTechnicalV3(button.dataset.aeTechprint)));
 tech.addEventListener('input',()=>{previewPredefined();showTechSummaryV2()});
 tech.addEventListener('change',()=>{previewPredefined();showTechSummaryV2()});
 loadExisting(null);loadTechV2(null);
}
function loadTechV2(b){const x=b?.technicalV2||{},keys={aeBoxMode:x.mode||'finished',aeBoxWax:x.waxG||0,aeBoxFragrance:x.fragranceG||0,aeBoxMaterials:x.materialsCost||0,aeBoxProduction:x.productionMinutes||0,aeBoxAssembly:x.assemblyMinutes||0,aeBoxPacking:x.packagingMinutes||0,aeBoxEnergy:x.energyCost||0,aeBoxOther:x.otherCost||0,aeBoxTechNotes:x.notes||''};Object.entries(keys).forEach(([k,v])=>{const el=document.getElementById(k);if(el)el.value=v});showTechSummaryV2();previewPredefined()}
function aeBoxPrintTechnicalV3(format){
 const boxId=text($('themeBoxId')?.value);
 const box=(db.themedBoxes||[]).find(x=>String(x.id)===boxId);
 if(!box){toast('Guarda a Box antes de imprimir a ficha técnica.');return;}
 const full=format==='A4';
 const escape=safe;
 const tech=box.technicalV2||{};
 const savedSnapshot=box.technicalRevisionV4?.snapshot;
 const breakdown=savedSnapshot?.breakdown||techCostV2(box.items||[],tech);
 const physical=(db.packaging||[]).find(p=>p.name===box.basePackaging);
 const packaging=savedSnapshot?.packaging??((Number(physical?.cost)||0)+(Number(box.decorationCost)||0));
 const total=savedSnapshot?.total??(breakdown.total+packaging);
 const title='Ficha técnica · '+escape(box.name);
 const info=[
  ['Referência',box.id],['Versão da ficha técnica',String(box.technicalRevisionV4?.version||1)],['Tipo de produção',tech.mode==='joint'?'Produção conjunta':'Montagem de produtos acabados'],
  ['Capacidade',String(box.capacity||1)+' unidades'],
  ['Cera',String(Number(tech.waxG)||0)+' g'],
  ['Fragrância',String(Number(tech.fragranceG)||0)+' g'],
  ['Produção',String(Number(tech.productionMinutes)||0)+' min'],
  ['Montagem',String(Number(tech.assemblyMinutes)||0)+' min'],
  ['Embalagem',String(Number(tech.packagingMinutes)||0)+' min'],
  ['Apresentação física',box.basePackaging||'Por definir']
 ];
 const items=(box.items||[]).map(x=>{
  const p=match(x.code);return {qty:Math.max(1,Number(x.qty)||1),name:p?.name||x.code,code:x.code};
 });
 const src=String(box.image||'');
 const photo=/^https:\/\//.test(src)||/^data:image\/(png|jpeg|webp);base64,/i.test(src)?'<img class="photo" src="'+escape(src)+'" alt="Foto da Box">':'';
 const finance=full?'<h2>Custos internos</h2><table><tbody>'+
  [['Matérias-primas',breakdown.materials],['Mão de obra',breakdown.labor],['Energia',breakdown.energy],['Outros custos',breakdown.indirect],['Caixa e decoração',packaging],['Custo total estimado',total],['Preço de venda',Number(box.price)||0],['Lucro bruto',Number(box.price||0)-total]].map(([key,v])=>'<tr><td>'+escape(key)+'</td><td>'+money(v)+'</td></tr>').join('')+
 '</tbody></table><p class="note">Os custos guardados correspondem à versão da ficha técnica e são estimativas. Confirmar materiais, disponibilidade e mão de obra antes de produzir.</p>':'';
 const markup='<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>'+title+'</title>'+
 '<style>@page{size:'+format+';margin:12mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#392f28;margin:0;overflow-wrap:anywhere}header{display:flex;gap:12px;align-items:start;border-bottom:2px solid #745a42;padding-bottom:11px}h1{font:24px Georgia,serif;margin:0}h2{font-size:15px;margin:19px 0 8px;color:#674c37}.photo{height:100px;width:100px;object-fit:cover;border-radius:8px;flex-shrink:0}.meta{color:#766960}.fields{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.field{border-bottom:1px solid #e7ddd0;padding:5px 0;break-inside:avoid}.field strong{display:block;font-size:10px;color:#766758}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left}td:last-child{text-align:right}.note{white-space:pre-wrap;line-height:1.5}.toolbar{padding:10px;background:#f0e7d9;margin-bottom:14px}.toolbar button{border:0;border-radius:8px;padding:9px 15px;background:#584535;color:white;font-weight:bold;cursor:pointer}@media print{.toolbar{display:none!important}h2{break-after:avoid}tr,.field{break-inside:avoid}}@media screen{body{max-width:800px;margin:auto;padding:15px}}</style></head><body>'+
 '<div class="toolbar"><button id="print" type="button">Imprimir / Guardar PDF</button> · Formato '+format+'</div>'+
 '<header>'+photo+'<div><h1>'+title+'</h1><p class="meta">ArtEssencia · Ficha técnica interna · '+escape(new Date().toLocaleDateString('pt-PT'))+'</p></div></header>'+
 '<h2>Parâmetros de fabrico</h2><section class="fields">'+info.map(([k,v])=>'<div class="field"><strong>'+escape(k)+'</strong>'+escape(v)+'</div>').join('')+'</section>'+
 '<h2>Produtos incluídos</h2><table><thead><tr><th>Artigo</th><th>Quantidade</th></tr></thead><tbody>'+
 items.map(item=>'<tr><td>'+escape(item.name)+' ('+escape(item.code)+')</td><td>'+item.qty+'</td></tr>').join('')+'</tbody></table>'+
 (tech.notes?'<h2>Instruções de fabrico</h2><div class="note">'+escape(tech.notes)+'</div>':'')+finance+
 '<script>document.getElementById("print").addEventListener("click",function(){window.focus();window.print()});</script></body></html>';
 const w=window.open('','_blank');
 if(!w){toast('Abre o Backoffice no navegador e permite janelas para imprimir a ficha.');return;}
 w.opener=null;w.document.open();w.document.write(markup);w.document.close();
}

function showTechSummaryV2(){const el=document.getElementById('aeBoxTechSummary');if(!el)return;const x=techCostV2(composition(),techDraftV2());el.innerHTML='<b>Fabrico: '+money(x.total)+'</b><span>Materiais: '+money(x.materials)+' · Trabalho: '+money(x.labor)+' · Energia: '+money(x.energy)+' · Outros: '+money(x.indirect)+'</span><small>'+(x.incomplete?'Preenche o custo das matérias-primas para produção conjunta.':'Estimativa sem embalagem física e decoração, adicionadas no total da Box.')+'</small>'}
function install(){
 const screen=$('catalogs');if(!screen||$(ID))return;
 const dashboard=screen.querySelector('.catalog-dashboard');
 const summary=$('catalogSummary');
 const pdf=screen.querySelector('.catalog-documents-stack-v1731');
 const editor=screen.querySelector('.catalog-editor-card');
 const creator=screen.querySelector('.catalog-creator-card');
 const heading=screen.querySelector('.catalog-saved-head');
 const list=$('themedBoxesGrid');
 if(!dashboard||!summary||!pdf||!editor||!creator||!heading||!list)return;
 const hub=document.createElement('section');hub.id=ID;
 hub.innerHTML='<div class="ae-hub-intro"><div><h2>Boxes ArtEssencia</h2><p>Cria, combina e partilha boxes com artigos reais. Nenhuma alteração publica automaticamente produtos.</p></div></div>'+
 '<div class="ae-hub-tabs" role="tablist" aria-label="Secções de Boxes">'+
 [['ready','Boxes pré-definidas'],['custom','Criar Box personalizada'],['requests','Pedidos de clientes'],['pdf','Catálogos para clientes'],['advanced','Regras e opções']].map(([id,name])=>'<button type="button" role="tab" class="btn" data-ae-tab="'+id+'">'+name+'</button>').join('')+
 '</div>';
 dashboard.insertAdjacentElement('afterend',hub);
 hub.querySelector('.ae-hub-tabs').before(summary);
 summary.style.marginTop='12px';
 const ready=document.createElement('div');ready.id='aeHubPanel_ready';ready.className='ae-hub-panel';
 ready.innerHTML='<div class="ae-hub-heading"><h3>Boxes pré-definidas</h3><p>Define a composição, embalagem, fotografia e preço. Depois de guardar, utiliza os botões de publicação de cada Box para escolher Catálogo Digital, Loja ou ambos.</p><button type="button" class="btn" id="aeNewBoxV1">+ Nova Box</button></div>';
 ready.append(editor,heading,list);
 const customPane=document.createElement('div');customPane.id='aeHubPanel_custom';customPane.className='ae-hub-panel';
 customPane.innerHTML='<div class="ae-hub-heading"><h3>Criar Box personalizada</h3><p>Escolhe os produtos, introduz os custos adicionais e o tempo de montagem, e define a margem de lucro pretendida. O preço sugerido é calculado automaticamente.</p></div>'+
 '<div class="ae-custom-grid"><label>Título da Box<input id="aeCustomTitleV1" placeholder="Ex.: Presente especial"></label><label>Embalagem<select id="aeCustomPackagingV1"></select></label><label>Nome / dedicatória<input id="aeCustomNameV1" maxlength="120" placeholder="Opcional"></label><label>Preferências de cor, aroma e observações<textarea id="aeCustomNotesV1" rows="3" maxlength="400"></textarea></label></div>'+
 '<div id="aeCustomProductsV1"></div><div class="ae-box-composition"><h3>Custos e margem desta Box</h3><p class="muted">Os custos dos artigos vêm das fichas técnicas. Introduz apenas os extras específicos desta Box.</p><div class="ae-custom-grid">'+
 '<label>Materiais extra / decoração (€)<input id="aeCustomMaterialsV1" type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>'+
 '<label>Tempo de montagem adicional (min)<input id="aeCustomAssemblyV1" type="number" inputmode="numeric" min="0" step="1" value="0"></label>'+
 '<label>Outros custos (€)<input id="aeCustomOtherV1" type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>'+
 '<label>Margem de lucro pretendida (%)<input id="aeCustomMarginPctV1" type="number" inputmode="decimal" min="0" max="95" step="0.5" value="35"></label>'+
 '<label>Preço indicativo a propor (€)<input id="aeCustomQuotePriceV1" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Opcional"></label></div>'+
 '<div class="ae-box-margin-editor"><button type="button" class="btn" id="aeCustomApplyPriceV1" data-ae-price-apply="custom">Aplicar preço sugerido à proposta</button></div>'+
 '<div id="aeCustomTotalV1" class="ae-box-estimate" aria-live="polite"></div></div><div class="ae-custom-actions">'+
 '<button type="button" class="btn" data-action="copy">Copiar proposta</button><button type="button" class="btn primary" data-action="whatsapp">Enviar por WhatsApp</button><button type="button" class="btn" data-action="pdf">Ver proposta PDF</button><button type="button" class="btn" data-action="sendpdf">Enviar PDF</button><button type="button" class="btn" data-action="client">Copiar ligação para o cliente escolher</button><a class="btn" href="https://catalogo.artessenciatlier.pt/boxes.html" target="_blank" rel="noopener">Abrir configurador do cliente</a></div>';
 const docs=document.createElement('div');docs.id='aeHubPanel_pdf';docs.className='ae-hub-panel';
 docs.innerHTML='<div class="ae-hub-heading"><h3>Catálogos para clientes</h3><p>Escolhe entre produtos gerais e boxes existentes. PDFs são gerados a partir dos dados do Backoffice.</p></div>';
 docs.append(pdf);
 const advanced=document.createElement('div');advanced.id='aeHubPanel_advanced';advanced.className='ae-hub-panel';
 advanced.innerHTML='<div class="ae-hub-heading"><h3>Regras e opções de personalização</h3><p>Opções técnicas do criador atual, preservadas para compatibilidade com a Loja. A ativação não reabre a Loja.</p></div>';
 const legacy=document.createElement('details');legacy.className='ae-creator-legacy-v1';
 legacy.innerHTML='<summary style="padding:15px;cursor:pointer;font-weight:700;background:#fff;border:1px solid #dfd2c6;border-radius:12px">Mostrar configuração técnica antiga (compatibilidade)</summary>';
 legacy.append(creator);advanced.append(legacy);
 const requestsPane=document.createElement('div');requestsPane.id='aeHubPanel_requests';requestsPane.className='ae-hub-panel';
 requestsPane.innerHTML='<div class="ae-hub-heading"><h3>Pedidos de Boxes personalizadas</h3><p>Pedidos recebidos no Catálogo Digital e na Loja. Define custos, envia uma ligação privada com validade e aguarda a resposta. A aceitação não cria automaticamente encomendas nem altera stock.</p><button class="btn" type="button" id="aeRefreshBoxRequests">Atualizar pedidos</button></div><div id="aeBoxRequestList" class="ae-box-items">A consultar Cloud…</div>';
 hub.append(ready,customPane,requestsPane,docs,advanced);
 $('aeRefreshBoxRequests').addEventListener('click',loadBoxRequestsV2);
 requestsPane.addEventListener('click',async ev=>{
 const button=ev.target.closest('[data-box-request-action]');if(!button)return;
 const id=button.dataset.id,action=button.dataset.boxRequestAction;
 const record=requestsCache.find(x=>x.request_id===id);
 if(!record)return;
 const row=button.closest('[data-request-row]');
 if(action==='prepare'){
  const items=Array.isArray(record.items)?record.items:[];
  const available=items.map(x=>({code:String(x.code||''),qty:Math.max(1,Number(x.qty)||1)}))
    .filter(x=>match(x.code));
  if(available.length!==items.length || !available.length){
   toast('A composição contém produtos que já não estão disponíveis no Backoffice. Confirma os artigos antes de criar a ficha.');
   return;
  }
  if(!confirm('Criar uma ficha de Box privada a partir deste pedido? A Box não será publicada.'))return;
  clearThemedBoxForm();
  selected=available;
  originRequestIdV4=id;
  $('themeBoxId').value='';
  $('themeBoxName').value='Box personalizada · '+id.slice(0,8);
  $('themeBoxCapacity').value=available.reduce((n,x)=>n+x.qty,0);
  $('themeBoxPrice').value=record.quoted_total||0;
  $('themeBoxActive').value='0';
  $('themeBoxDesc').value='';
  drawPicker('aeBoxProductsV1',selected,true);
  loadTechV2(null);
  showTab('ready');
  $('themeBoxName')?.focus();
  toast('Ficha privada preparada. Define a receita, o tempo de trabalho e guarda a Box.');
  return;
 }
 if(action==='reply'||action==='copylink'){
  if(!['quoted','sent'].includes(record.status)||!record.response_token||!record.quote_valid_until||new Date(record.quote_valid_until)<=new Date()){toast('Prepara um orçamento válido antes de enviar.');return;}
  const url='https://catalogo.artessenciatlier.pt/proposta-box.html#proposta='+encodeURIComponent(record.response_token);
  if(action==='copylink'){await copy(url);return;}
  const number=String(record.phone||'').replace(/\D/g,'').replace(/^00/,'');
  if(number.length!==9&&number.length<11){toast('Contacto inválido. Usa Copiar ligação para enviar por outro canal.');return;}
  const normalized=number.length===9?'351'+number:number;
  const msg=['Olá '+record.customer_name+',','O orçamento da tua Box ArtEssencia está disponível.',
   'Valor final proposto: '+money(record.quoted_total),
   'Válido até: '+new Date(record.quote_valid_until).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'}),
   record.quote_message||'','Podes consultar, aceitar ou pedir alterações nesta ligação privada:',url,
   'A aceitação não constitui pagamento nem confirma a encomenda.'].filter(Boolean).join('\n');
  window.open('https://wa.me/'+normalized+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
  toast('WhatsApp aberto. Marca como enviado apenas depois de confirmares o envio.');
  return;
 }
 button.disabled=true;
 try{
  const {c}=await publicClient();
  if(action==='quote'){
   const total=Number(row.querySelector('[data-box-total]')?.value);
   const note=row.querySelector('[data-box-note]')?.value.trim()||'';
   const validDays=Number(row.querySelector('[data-box-validity]')?.value);
   if(!Number.isFinite(total)||total<=0||total>100000||!Number.isInteger(validDays)||validDays<1||validDays>30)throw Error('Indica um preço válido e validade entre 1 e 30 dias.');
   if(!confirm('Emitir uma nova versão de orçamento? A ligação anterior deixará de ser válida.'))return;
   const {data,error}=await c.rpc('artessencia_owner_quote_box_v1',{
    p_request_id:id,p_amount:total,p_message:note,p_valid_days:validDays
   });
   if(error)throw error;
   if(!data?.ok)throw Error('Não foi possível guardar o orçamento');
   await loadBoxRequestsV2();toast('Versão '+data.version+' guardada. A proposta está pronta para enviar.');
   return;
  }
  if(action==='marksent'){
   if(record.status!=='quoted')throw Error('O orçamento já não está pendente de envio.');
   if(!confirm('Confirmas que enviaste a ligação de orçamento ao cliente?'))return;
   const {data,error}=await c.from('artessencia_box_requests_v1')
    .update({status:'sent',sent_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    .eq('request_id',id).eq('status','quoted').eq('quote_version',record.quote_version)
    .select('request_id');
   if(error)throw error;
   if(data?.length!==1)throw Error('O estado do pedido mudou. Atualiza a listagem.');
   await loadBoxRequestsV2();toast('Envio registado.');
   return;
  }
  if(action==='review'){
   if(!['new','reviewing','revision_requested'].includes(record.status))throw Error('Não é possível alterar para análise uma proposta já enviada ou decidida.');
   const {data,error}=await c.from('artessencia_box_requests_v1')
    .update({status:'reviewing',updated_at:new Date().toISOString()})
    .eq('request_id',id).eq('status',record.status).select('request_id');
   if(error)throw error;
   if(data?.length!==1)throw Error('O pedido foi atualizado noutro dispositivo.');
   await loadBoxRequestsV2();toast('Pedido em análise.');
   return;
  }
 }catch(error){toast(error.message||'Não foi possível atualizar o pedido')}finally{button.disabled=false;}
});

 hub.querySelectorAll('[data-ae-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.aeTab)));
 renderPredefinedExtras();
 $('aeNewBoxV1')?.addEventListener('click',()=>{clearThemedBoxForm();showTab('ready');$('themeBoxName')?.focus();});
 const pack=$('aeCustomPackagingV1');
 pack.innerHTML='<option value="">Embalagem a confirmar</option>'+(db.packaging||[]).map(x=>'<option value="'+safe(x.name)+'">'+safe(x.name)+'</option>').join('');
 hub.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.aePriceApply){
   const n=Number(b.dataset.suggested);
   if(!Number.isFinite(n)||n<=0)return toast('Completa os custos e a margem antes de aplicar o preço.');
   const output=b.dataset.aePriceApply==='ready'?$('themeBoxPrice'):$('aeCustomQuotePriceV1');
   if(!output)return;
   output.value=n.toFixed(2);
   if(b.dataset.aePriceApply==='ready')previewPredefined();else renderCustomEstimateV1();
   toast('Preço sugerido preenchido. Confirma antes de guardar ou partilhar.');return;
  }
  const target=b.dataset.target;
  if(b.dataset.aebox==='add'&&target){
   const s=$(target+'Add');if(!s?.value)return;
   const arr=target==='aeBoxProductsV1'?selected:custom;
   if(arr.some(x=>x.code===s.value))return;
   arr.push({code:s.value,qty:1});
   if(target==='aeBoxProductsV1'){drawPicker(target,arr,true);previewPredefined();}else drawCustom();
   return;
  }
  if(b.dataset.aeboxRemove!==undefined){
   const holder=b.closest('.ae-box-items').parentElement;
   const arr=holder.id==='aeBoxProductsV1'?selected:custom;
   arr.splice(Number(b.dataset.aeboxRemove),1);
   if(holder.id==='aeBoxProductsV1'){drawPicker(holder.id,arr,true);previewPredefined();}else drawCustom();return;
  }
  if(b.dataset.aePublish){
   b.disabled=true;
   aePublishBoxV1(b.dataset.aeBoxid,b.dataset.aePublish)
    .catch(error=>{console.error(error);toast(error.message||'Erro ao atualizar a Box pública')})
    .finally(()=>{b.disabled=false;});
   return;
  }
  if(b.dataset.action){
   try{
    if(b.dataset.action==='copy')copy(proposal());
    if(b.dataset.action==='whatsapp'){const p=phone();if(!p)throw Error('Define o contacto telefónico da ArtEssencia em Definições.');window.open('https://wa.me/'+p+'?text='+encodeURIComponent(proposal()),'_blank','noopener');}
    if(b.dataset.action==='client')copy(customerLink(custom));
    if(b.dataset.action==='pdf')openPdfBlob(buildCustomBoxPdfV1);
    if(b.dataset.action==='sendpdf')sharePdfBlob(buildCustomBoxPdfV1,'ArtEssencia_Proposta_Box_Personalizada.pdf','Proposta de Box ArtEssencia',proposal());
   }catch(error){toast(error.message);}
  }
 });
 hub.addEventListener('input',ev=>{
  if(['aeCustomPackagingV1','aeCustomMaterialsV1','aeCustomAssemblyV1','aeCustomOtherV1','aeCustomMarginPctV1','aeCustomQuotePriceV1'].includes(ev.target.id)){renderCustomEstimateV1();return;}
  if(ev.target.dataset.aeboxQty===undefined)return;
  const holder=ev.target.closest('.ae-box-items')?.parentElement;
  const arr=holder?.id==='aeBoxProductsV1'?selected:custom;
  const idx=Number(ev.target.dataset.aeboxQty);if(arr[idx])arr[idx].qty=Math.max(1,Math.min(1000,Number(ev.target.value)||1));
  if(holder?.id==='aeBoxProductsV1')previewPredefined();else renderCustomEstimateV1();
 });
 hub.addEventListener('change',ev=>{if(ev.target.id==='aeCustomPackagingV1')renderCustomEstimateV1()});
 window.aeBoxItemsDraftV1=()=>composition();
 window.aeBoxesShowTabV1=showTab;
 // A eliminação de uma Box publicada é precedida da retirada segura dos canais públicos.
 const oldDelete=window.deleteThemedBox;
 window.deleteThemedBox=async function(id){
  const box=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));if(!box)return;
  if(!confirm('Apagar a Box "'+box.name+'"? A versão pública será também retirada.'))return;
  try{
   const {c}=await publicClient();
   const {error}=await c.from('artessencia_boxes_public_v1').delete().eq('id',String(id));
   if(error)throw error;
  }catch(error){toast('Não foi possível confirmar a retirada pública. A Box foi preservada.');return;}
  db.themedBoxes=db.themedBoxes.filter(x=>String(x.id)!==String(id));
  save();publicRows.delete(String(id));renderPublicationButtonsV1();toast('Box apagada');
 };
 showTab('ready');
}

let requestsCache=[];
async function loadBoxRequestsV2(){
 const root=$('aeBoxRequestList');if(!root)return;
 try{
  const {c}=await publicClient();
  const [reqs,hist]=await Promise.all([
    c.from('artessencia_box_requests_v1').select('*')
     .in('status',['new','reviewing','quoted','sent','accepted','declined','revision_requested'])
     .order('created_at',{ascending:false}).limit(100),
    c.from('artessencia_box_quote_history_v1')
     .select('request_id,quote_version,event_type,created_at')
     .order('created_at',{ascending:false}).limit(250)
  ]);
  if(reqs.error)throw reqs.error;
  requestsCache=Array.isArray(reqs.data)?reqs.data:[];
  const history=hist.error?[]:(hist.data||[]);
  const labels={new:'Novo',reviewing:'Em análise',quoted:'Orçamento preparado',sent:'Proposta enviada',accepted:'Aceite pelo cliente',declined:'Recusado',revision_requested:'Alterações solicitadas'};
  root.innerHTML=requestsCache.length?requestsCache.map(r=>{
   const items=Array.isArray(r.items)?r.items:[];
   const prefs=r.preferences&&typeof r.preferences==='object'?r.preferences:{};
   const details=Object.entries(prefs).filter(([k,v])=>v!==null&&v!==undefined&&String(v).trim())
    .map(([k,v])=>'<small>'+safe(k)+': '+safe(typeof v==='object'?JSON.stringify(v):v)+'</small>').join('');
   const canQuote=['new','reviewing','quoted','sent','revision_requested'].includes(r.status);
   const canSend=['quoted','sent'].includes(r.status)&&r.response_token&&r.quote_valid_until&&new Date(r.quote_valid_until)>new Date();
   const previous=history.filter(h=>h.request_id===r.request_id).slice(0,8)
    .map(h=>'v'+safe(h.quote_version)+' · '+safe(h.event_type)+' · '+safe(new Date(h.created_at).toLocaleDateString('pt-PT'))).join(' | ');
   const metadata='<b>'+safe(r.customer_name)+'</b><small>'+safe(r.phone)+' · '+safe(r.email||'Sem email')+' · '+safe(r.source)+'</small>'+
    '<small>'+safe(r.created_at?.slice(0,16)||'')+' · '+safe(labels[r.status]||r.status)+'</small>';
   return '<article data-request-row="'+safe(r.request_id)+'" class="card" style="padding:14px;margin:10px 0">'+
    metadata+'<p>'+items.map(x=>safe(x.qty)+' × '+safe(x.name||x.code)).join(' · ')+'</p>'+
    '<div>'+details+'</div>'+
    (r.customer_note?'<p class="ae-box-estimate">Mensagem do cliente: '+safe(r.customer_note)+'</p>':'')+
    '<div class="ae-custom-grid"><label>Orçamento final (€)<input data-box-total type="number" step=".01" min=".01" max="100000" value="'+safe(r.quoted_total??'')+'" '+(canQuote?'':'disabled')+'></label>'+
    '<label>Validade (dias)<input data-box-validity type="number" min="1" max="30" step="1" value="7" '+(canQuote?'':'disabled')+'></label>'+
    '<label style="grid-column:1/-1">Condições e observações para o cliente<textarea data-box-note rows="2" maxlength="1600" '+(canQuote?'':'disabled')+'>'+safe(r.quote_message||'')+'</textarea></label></div>'+
    (r.quoted_total?'<small>Proposta v'+safe(r.quote_version)+' · '+money(r.quoted_total)+
     (r.quote_valid_until?' · Até '+safe(new Date(r.quote_valid_until).toLocaleDateString('pt-PT')):'')+'</small>':'')+
    '<div class="ae-custom-actions">'+
     (['new','reviewing','revision_requested'].includes(r.status)?'<button class="btn" data-box-request-action="review" data-id="'+safe(r.request_id)+'">Em análise</button>':'')+
     '<button class="btn" data-box-request-action="prepare" data-id="'+safe(r.request_id)+'">Criar ficha técnica da Box</button>'+
     (canQuote?'<button class="btn primary" data-box-request-action="quote" data-id="'+safe(r.request_id)+'">Guardar orçamento</button>':'')+
     (canSend?'<button class="btn" data-box-request-action="reply" data-id="'+safe(r.request_id)+'">Enviar WhatsApp</button>'+
      '<button class="btn" data-box-request-action="copylink" data-id="'+safe(r.request_id)+'">Copiar ligação privada</button>':'')+
     (r.status==='quoted'?'<button class="btn" data-box-request-action="marksent" data-id="'+safe(r.request_id)+'">Marcar enviado</button>':'')+
    '</div>'+
    (previous?'<small class="muted">Histórico: '+previous+'</small>':'')+
    (r.status==='accepted'?'<p class="ae-box-estimate">Aceite: a conversão em encomenda depende da confirmação interna; o stock permanece inalterado.</p>':'')+
    '</article>';
  }).join(''):'<div class="soft-note">Sem pedidos de Boxes. Quando um cliente enviar uma proposta, aparecerá aqui.</div>';
 }catch(error){
  console.warn('Pedidos de Boxes',error);
  root.textContent='Não foi possível carregar os pedidos. Confirma a sessão e a ligação Cloud.';
 }
}

let publicRows=new Map();
let publicVerified=false;
let publicLoading=false;
async function publicClient(){
 const c=initCloudClient();
 const u=cloudUser||await ensureCloudSession();
 if(!c||!u)throw new Error('Inicia sessão na Cloud para publicar Boxes.');
 return {c,u};
}
async function reloadPublicBoxesV1(){
 if(publicLoading)return;
 publicLoading=true;
 try{
  const {c}=await publicClient();
  const {data,error}=await c.from('artessencia_boxes_public_v1')
     .select('id,visible_catalog,visible_shop,active');
  if(error)throw error;
  publicRows=new Map((data||[]).map(row=>[String(row.id),row]));
  publicVerified=true;
  renderPublicationButtonsV1();
 }catch(error){publicVerified=false;console.warn('Boxes públicas indisponíveis:',error.message);renderPublicationButtonsV1();}
 finally{publicLoading=false;}
}
function renderPublicationButtonsV1(){
 const cards=$('themedBoxesGrid')?.querySelectorAll('.catalog-pro-card')||[];
 (db.themedBoxes||[]).forEach((box,i)=>{
  const card=cards[i];
  const parent=card?.querySelector('.body');
  if(!parent)return;
  let ui=parent.querySelector('.ae-box-publish-v1');
  if(!ui){ui=document.createElement('div');ui.className='ae-box-publish-v1';parent.appendChild(ui);}
  const remote=publicRows.get(String(box.id))||{};
  const inCatalog=remote.active!==false && remote.visible_catalog===true;
  const inShop=remote.active!==false && remote.visible_shop===true;
  if(!publicVerified){ui.innerHTML='<small>Estado da publicação não confirmado. Liga a Cloud e abre novamente esta secção.</small>';return;}
  ui.innerHTML='<small>Publicação independente: '+(inCatalog?'Catálogo ativo':'Catálogo não publicado')+' · '+(inShop?'Loja ativa':'Loja não publicada')+'</small>'+
   '<div><button type="button" class="btn" data-ae-publish="catalog" data-ae-boxid="'+safe(box.id)+'">'+(inCatalog?'Retirar do Catálogo':'Publicar no Catálogo')+'</button>'+
   '<button type="button" class="btn" data-ae-publish="shop" data-ae-boxid="'+safe(box.id)+'">'+(inShop?'Retirar da Loja':'Publicar na Loja')+'</button>'+
   (inCatalog?'<button type="button" class="btn" data-ae-publish="link" data-ae-boxid="'+safe(box.id)+'">Copiar ligação</button>':'')+
   ((inCatalog||inShop)?'<button type="button" class="btn" data-ae-publish="refresh" data-ae-boxid="'+safe(box.id)+'">Atualizar ficha pública</button>':'')+'</div>';
 });
}
async function uploadBoxImageV1(c,u,box){
 const url=text(box.image);
 if(/^https:\/\//.test(url))return url;
 if(!url.startsWith('data:image/'))throw new Error('Esta Box necessita de uma fotografia válida');
 const data=await fetch(url);
 const blob=await data.blob();
 if(!blob.type.startsWith('image/')||blob.size>5*1024*1024)throw new Error('Fotografia inválida ou demasiado grande');
 const path=u.id+'/boxes/'+String(box.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+Date.now()+'.jpg';
 const uploaded=await c.storage.from('artessencia-shop').upload(path,blob,{cacheControl:'3600',upsert:false,contentType:blob.type||'image/jpeg'});
 if(uploaded.error)throw uploaded.error;
 const p=c.storage.from('artessencia-shop').getPublicUrl(path)?.data?.publicUrl;
 if(!p)throw new Error('A imagem foi carregada, mas a URL pública está indisponível');
 return p;
}
async function aePublishBoxV1(id,channel){
 const box=(db.themedBoxes||[]).find(x=>String(x.id)===String(id));
 if(!box)throw new Error('Box não encontrada');
 if(channel==='link'){
  const address='https://catalogo.artessenciatlier.pt/boxes.html?box='+encodeURIComponent(id);
  await copy(address);return;
 }
 const {c,u}=await publicClient();
 const {data:prev,error:lookupError}=await c.from('artessencia_boxes_public_v1').select('*').eq('id',id).maybeSingle();
 if(lookupError)throw lookupError;
 const refresh=channel==='refresh';
 const field=channel==='catalog'?'visible_catalog':'visible_shop';
 const next=refresh||!(prev?.active!==false&&prev?.[field]===true);
 if(refresh&&!(prev?.visible_catalog||prev?.visible_shop))throw new Error('Esta Box ainda não tem uma publicação a atualizar');
 if(next){
  if(box.active===false)throw new Error('A Box está oculta no Backoffice');
  if(!Array.isArray(box.items)||!box.items.length)throw new Error('Guarda primeiro a composição da Box com os produtos incluídos');
  if(!text(box.name)||!text(box.image))throw new Error('A Box precisa de nome e imagem');
  if(Number(box.price)<=0)throw new Error('Define um PVP válido antes de publicar');
  if(!confirm(refresh?'Atualizar os detalhes públicos da Box "'+box.name+'" nos canais já publicados?':'Publicar "'+box.name+'" em '+(field==='visible_catalog'?'Catálogo Digital':'Loja')+'? O público poderá consultar e pedir informações, mas não efetuar encomendas por este configurador.'))return;
 }else{
  if(!confirm('Retirar "'+box.name+'" de '+(field==='visible_catalog'?'Catálogo Digital':'Loja')+'?'))return;
 }
 let img=prev?.image_url||'';
 if(next)img=await uploadBoxImageV1(c,u,box);
 const base={
  id:String(box.id),title:String(box.name).slice(0,120),
  description:String(box.description||''),image_url:img,
  price:Number(box.price)||0,price_mode:'fixed',capacity:Number(box.capacity)||1,
  items:Array.isArray(box.items)?box.items.map(x=>{
    const p=match(x.code);return {code:String(x.code),name:String(p?.name||x.code),qty:Number(x.qty)||1};
  }):[],
  active:box.active!==false,
  visible_catalog:prev?.visible_catalog===true,
  visible_shop:prev?.visible_shop===true,
  updated_at:new Date().toISOString()
 };
 if(!refresh)base[field]=next;
 const {error}=await c.from('artessencia_boxes_public_v1').upsert(base,{onConflict:'id'});
 if(error)throw error;
 await reloadPublicBoxesV1();
 toast(refresh?'Ficha pública atualizada':(next?'Box publicada com sucesso':'Box retirada do canal selecionado'));
}
window.aeBoxesRenderPublicV1=renderPublicationButtonsV1;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
(()=>{const s=document.createElement('style');s.textContent="#aeBoxesHubV1{margin-top:12px}#aeBoxesHubV1 .ae-hub-intro{padding:16px 18px;background:#fffaf5;border:1px solid #ded2c1;border-radius:16px}#aeBoxesHubV1 h2,#aeBoxesHubV1 h3{font:600 22px Georgia,serif;margin:0 0 6px}#aeBoxesHubV1 h3{font-size:19px}#aeBoxesHubV1 p{line-height:1.55;margin:4px 0 12px}#aeBoxesHubV1 .ae-hub-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#aeBoxesHubV1 .ae-hub-tabs .btn{flex:1 1 170px;min-height:46px}#aeBoxesHubV1 .ae-hub-panel[hidden]{display:none!important}#aeBoxesHubV1 .ae-hub-panel{display:grid;gap:12px}#aeBoxesHubV1 .ae-hub-heading{border:1px solid #ded2c1;border-radius:14px;background:#fff;padding:15px}#aeBoxesHubV1 .ae-hub-heading .btn{margin-top:6px}#aeBoxesHubV1 .ae-hub-heading p{font-size:13px;color:#6d6158}#aeBoxesHubV1 .ae-box-composition{margin-top:14px;padding:14px;border:1px solid #dfd2c6;border-radius:14px;background:#fffaf5}#aeBoxesHubV1 .ae-box-pick-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;margin:10px 0}#aeBoxesHubV1 .ae-box-pick-head small{color:#78695c}#aeBoxesHubV1 .ae-box-add{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#aeBoxesHubV1 .ae-box-add select{min-width:0;flex:1 1 210px}#aeBoxesHubV1 .ae-box-line{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #e5dace}#aeBoxesHubV1 .ae-box-line>span{flex:1;min-width:0;overflow-wrap:anywhere}#aeBoxesHubV1 .ae-box-line small{display:block;color:#86796b}#aeBoxesHubV1 .ae-box-line label{font-size:12px;width:70px}#aeBoxesHubV1 .ae-box-line input{width:100%;min-width:0}#aeBoxesHubV1 .ae-box-totals{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;font-size:12px;font-weight:600}#aeBoxesHubV1 .ae-box-totals span{padding:6px 8px;border:1px solid #dfd2c6;border-radius:9px}#aeBoxesHubV1 .ae-box-estimate{padding:12px;margin-top:10px;background:#f2e9dc;border:1px solid #ddcdb9;border-radius:13px;display:grid;gap:6px;font-size:13px}#aeBoxesHubV1 .ae-box-estimate small{color:#706153}#aeBoxesHubV1 .ae-custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:#fff;padding:14px;border-radius:13px}#aeBoxesHubV1 .ae-custom-grid label{display:grid;gap:6px;font-size:13px}#aeBoxesHubV1 .ae-custom-grid label:last-child{grid-column:1/-1}#aeBoxesHubV1 .ae-custom-grid input,#aeBoxesHubV1 .ae-custom-grid textarea,#aeBoxesHubV1 .ae-custom-grid select{width:100%;min-width:0}#aeBoxesHubV1 .ae-custom-actions{display:flex;flex-wrap:wrap;gap:8px}#aeBoxesHubV1 .ae-custom-actions>*{flex:1 1 170px;display:inline-flex;align-items:center;justify-content:center}#aeBoxesHubV1 .ae-box-items{max-height:470px;overflow:auto}#aeBoxesHubV1 .ae-hub-panel > .catalog-grid{margin:0}#aeBoxesHubV1 .ae-hub-panel .catalog-creator-card{margin:0}@media(max-width:650px){#aeBoxesHubV1 .ae-hub-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#aeBoxesHubV1 .ae-hub-tabs .btn{font-size:12px;min-width:0}#aeBoxesHubV1 .ae-custom-grid{grid-template-columns:minmax(0,1fr)}#aeBoxesHubV1 .ae-box-line{flex-wrap:wrap}#aeBoxesHubV1 .ae-box-line>span{flex:1 1 100%}}";document.head.appendChild(s)})();
(()=>{const st=document.createElement('style');st.id='aeBoxesPricingResponsiveV1';st.textContent="\n#aeBoxesHubV1,#aeBoxesHubV1 *{box-sizing:border-box}\n#aeBoxesHubV1,#aeBoxesHubV1 .ae-hub-panel,#aeBoxesHubV1 .ae-hub-heading,\n#aeBoxesHubV1 .ae-box-composition,#aeBoxesHubV1 .ae-custom-grid,\n#aeBoxesHubV1 .ae-box-estimate,#aeBoxesHubV1 .ae-box-items,\n#aeBoxesHubV1 .catalog-editor-card,#aeBoxesHubV1 .catalog-grid,\n#aeBoxesHubV1 .catalog-saved-head{min-width:0;max-width:100%;overflow-wrap:anywhere}\n#aeBoxesHubV1 .ae-hub-intro p,#aeBoxesHubV1 .ae-hub-heading p,\n#aeBoxesHubV1 .ae-box-composition p{overflow-wrap:anywhere;white-space:normal}\n#aeBoxesHubV1 .ae-box-add select,#aeBoxesHubV1 .ae-custom-grid input,\n#aeBoxesHubV1 .ae-custom-grid textarea,#aeBoxesHubV1 .ae-custom-grid select,\n#aeBoxesHubV1 .ae-box-margin-editor input,#aeBoxesHubV1 .ae-box-line input{\nwidth:100%;min-width:0;max-width:100%;font-size:16px}\n#aeBoxesHubV1 .ae-custom-grid label{min-width:0;max-width:100%;overflow-wrap:anywhere}\n#aeBoxesHubV1 .ae-box-margin-editor{display:flex;flex-wrap:wrap;gap:10px;align-items:end;\nmargin:14px 0;padding:12px;border:1px solid #dfd2c6;border-radius:12px;background:#fff}\n#aeBoxesHubV1 .ae-box-margin-editor label{flex:1 1 190px;min-width:0;display:grid;gap:6px;font-size:13px}\n#aeBoxesHubV1 .ae-box-margin-editor button{flex:1 1 190px;min-width:0;white-space:normal;min-height:44px}\n#aeBoxesHubV1 .ae-box-cost-lines{display:grid;gap:4px;padding:8px 0;border-bottom:1px solid #ddd0bd}\n#aeBoxesHubV1 .ae-box-cost-row,#aeBoxesHubV1 .ae-box-cost-total{\ndisplay:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;\npadding:6px 0;overflow-wrap:anywhere}\n#aeBoxesHubV1 .ae-box-cost-row strong,#aeBoxesHubV1 .ae-box-cost-total strong{\nwhite-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}\n#aeBoxesHubV1 .ae-box-cost-total{font-size:15px;border-bottom:1px solid #d8cab8;padding:12px 0}\n#aeBoxesHubV1 .ae-box-cost-warning{color:#8b4323;font-weight:600}\n#aeBoxesHubV1 .ae-box-estimate small{display:block;line-height:1.5}\n#aeBoxesHubV1 .ae-hub-tabs button,#aeBoxesHubV1 .ae-custom-actions .btn{\nwhite-space:normal;overflow-wrap:anywhere;min-width:0;max-width:100%}\n@media(max-width:650px){\n#aeBoxesHubV1 .ae-hub-tabs{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\n#aeBoxesHubV1 .ae-hub-tabs button{font-size:12px;line-height:1.35;padding:10px 7px;min-height:48px}\n#aeBoxesHubV1 .ae-custom-grid{grid-template-columns:minmax(0,1fr)!important;gap:10px}\n#aeBoxesHubV1 .ae-custom-grid label:last-child{grid-column:auto!important}\n#aeBoxesHubV1 .ae-box-add{display:grid;grid-template-columns:minmax(0,1fr)}\n#aeBoxesHubV1 .ae-box-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}\n#aeBoxesHubV1 .ae-box-line>span{grid-column:1/-1;min-width:0}\n#aeBoxesHubV1 .ae-box-line label{width:100%;min-width:0}\n#aeBoxesHubV1 .ae-custom-actions{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}\n#aeBoxesHubV1 .ae-custom-actions>*{width:100%;min-width:0;justify-content:center;min-height:44px}\n#aeBoxesHubV1 .ae-box-margin-editor{display:grid;grid-template-columns:minmax(0,1fr)}\n#aeBoxesHubV1 .ae-box-cost-row,#aeBoxesHubV1 .ae-box-cost-total{gap:6px}\n#aeBoxesHubV1 .ae-box-cost-row strong,#aeBoxesHubV1 .ae-box-cost-total strong{white-space:normal}\n}\n@media(max-width:355px){\n#aeBoxesHubV1 .ae-hub-tabs{grid-template-columns:minmax(0,1fr)}\n#aeBoxesHubV1 .ae-box-cost-row,#aeBoxesHubV1 .ae-box-cost-total{grid-template-columns:minmax(0,1fr)}\n#aeBoxesHubV1 .ae-box-cost-row strong,#aeBoxesHubV1 .ae-box-cost-total strong{text-align:left}\n}";document.head.appendChild(st);})();
