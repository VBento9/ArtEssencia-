/* ArtEssencia — ficha técnica independente dos rascunhos de boxes.
   Esta etapa é local, sem publicar, reservar matérias-primas ou criar encomendas. */
(function () {
  'use strict';
  const DRAFT_KEY = 'ae_boxes_unified_drafts_v1';
  const TECH_KEY = 'ae_boxes_technical_v1';
  const $ = id => document.getElementById(id);
  const finite = n => Number.isFinite(n) && n >= 0;
  const number = id => { const v = $(id)?.value; return v == null || v === '' ? NaN : Number(v); };
  const money = n => Number(n).toLocaleString('pt-PT', {style:'currency',currency:'EUR'});
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const products = () => typeof db !== 'undefined' && Array.isArray(db.products) ? db.products : [];
  const stock = () => typeof db !== 'undefined' && Array.isArray(db.stock) ? db.stock : [];
  const productId = p => String(p?.code || p?.sku || p?.id || '').trim();
  const stockId = m => String(m?.id || m?.code || m?.name || '').trim();
  const getDrafts = () => { try { const v=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } };
  const getTechs = () => { try { const v=JSON.parse(localStorage.getItem(TECH_KEY)||'{}'); return v && typeof v==='object'&&!Array.isArray(v)?v:{}; } catch { return {}; } };
  let extraMaterials = [];
  const defaults = {minutes:0,hourly:6,waste:0,other:0,target:60,materials:[]};
  function selectMaterialOptions(){
    const s=$('aeTechMaterial'); if(!s)return;
    const before=s.value; s.replaceChildren();
    const blank=document.createElement('option');blank.value='';blank.textContent='Selecionar material';s.append(blank);
    for(const m of stock()){
      const id=stockId(m);if(!id)continue;
      const op=document.createElement('option');op.value=id;op.textContent=(m.name||id)+' · '+(m.unit||'un.');s.append(op);
    }
    if([...s.options].some(o=>o.value===before))s.value=before;
  }
  function model(){
    return {minutes:number('aeTechMinutes'),hourly:number('aeTechHourly'),waste:number('aeTechWaste'),
      other:number('aeTechOther'),target:number('aeTechTarget'),
      materials:extraMaterials.map(x=>({id:String(x.id),qty:Number(x.qty)}))};
  }
  function valid(t){
    return [t.minutes,t.hourly,t.waste,t.other,t.target].every(finite)
      && t.minutes<=100000 && t.waste<=100 && t.target<=95
      && t.materials.every(m=>m.id&&Number.isFinite(m.qty)&&m.qty>0);
  }
  function setModel(t){
    t=t||defaults;extraMaterials=Array.isArray(t.materials)?t.materials.filter(x=>x&&x.id&&Number.isFinite(Number(x.qty))&&Number(x.qty)>0).map(x=>({id:String(x.id),qty:Number(x.qty)})):[];
    const fieldMap={aeTechMinutes:'minutes',aeTechHourly:'hourly',aeTechWaste:'waste',aeTechOther:'other',aeTechTarget:'target'};
    for(const [id,key] of Object.entries(fieldMap)) if($(id)) $(id).value=finite(Number(t[key]))?String(t[key]):String(defaults[key]);
    update();
  }
  function currentComponents(){
    const id=$('aeBoxDraftId')?.value||'';
    const fromSaved=getDrafts().find(x=>x.id===id);
    if(fromSaved)return fromSaved.components||[];
    // O editor expõe apenas a composição guardada. Antes de guardar,
    // a ficha informa que necessita do modelo persistido.
    return [];
  }
  function compute(components,tech){
    const errors=[],items=[],materials=[];
    let componentCost=0,extraCost=0;
    if(!Array.isArray(components)||!components.length)errors.push('Guarda a composição da box para completar a ficha técnica.');
    for(const c of components||[]){
      const p=products().find(p=>productId(p)===String(c.productId));
      const qty=Number(c.qty);if(!p||!Number.isInteger(qty)||qty<1){errors.push('Componente da box inválido.');continue;}
      let unit=NaN;
      try { if(typeof calculatedProductCost==='function') unit=Number(calculatedProductCost(p)); } catch {}
      if(!Number.isFinite(unit)||unit<=0){errors.push('Custo de produção não validado: '+(p.name||c.productId));continue;}
      const cost=unit*qty;componentCost+=cost;items.push({name:p.name||c.productId,qty,unit,cost});
    }
    for(const m of tech.materials||[]){
      const matches=stock().filter(s=>stockId(s)===m.id),s=matches[0],qty=Number(m.qty);
      const unit=s?.unitCost==null||s.unitCost===''?NaN:Number(s.unitCost);
      if(matches.length!==1||!Number.isFinite(unit)||unit<0||!Number.isFinite(qty)||qty<=0){
        errors.push('Material adicional sem custo válido ou referência única: '+m.id);continue;
      }
      const cost=qty*unit;extraCost+=cost;
      materials.push({id:m.id,name:s.name||m.id,qty,unitName:s.unit||'un.',unit,cost});
    }
    if(!valid(tech))errors.push('Corrige os valores técnicos da box.');
    const labor=tech.minutes/60*tech.hourly, waste=extraCost*tech.waste/100;
    const packaging=number('aeBoxDraftPackaging');
    const total=componentCost+extraCost+waste+labor+packaging+tech.other;
    const salePrice=number('aeBoxDraftPrice');
    const suggested=tech.target<100?total/(1-tech.target/100):NaN;
    if(!finite(packaging)||!finite(total)||!finite(salePrice))errors.push('Embalagem, PVP ou custo total inválidos.');
    const margin=salePrice>0?(salePrice-total)/salePrice*100:NaN;
    return {ok:errors.length===0,errors,items,materials,componentCost,extraCost,waste,labor,packaging,other:tech.other,total,salePrice,suggested,margin};
  }
  function extraList(){
    const host=$('aeTechExtraLines');if(!host)return;
    host.replaceChildren();
    for(const [i,m] of extraMaterials.entries()){
      const stockItem=stock().find(s=>stockId(s)===m.id),row=document.createElement('div');
      row.className='btnrow';row.style.margin='5px 0';
      const label=document.createElement('span');label.textContent=(stockItem?.name||'Material indisponível')+' · '+m.qty+' '+(stockItem?.unit||'un.');
      const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Retirar';
      remove.addEventListener('click',()=>{extraMaterials.splice(i,1);update()});row.append(label,remove);host.append(row);
    }
  }
  function update(){
    if(!$('aeTechSummary'))return;
    extraList();
    const result=compute(currentComponents(),model()),host=$('aeTechSummary');
    host.replaceChildren();
    const para=document.createElement('p');
    para.textContent='Produtos: '+money(result.componentCost)+' · Materiais adicionais: '+money(result.extraCost)+' · Desperdício adicional: '+money(result.waste)+' · Trabalho próprio da box: '+money(result.labor)+' · Embalagem: '+money(result.packaging)+' · Outros: '+money(result.other);
    const total=document.createElement('strong');
    total.textContent='Custo estimado: '+money(result.total)+' · PVP-alvo: '+money(result.suggested)+' · Margem no PVP definido: '+(Number.isFinite(result.margin)?result.margin.toFixed(1)+'%':'indisponível');
    host.append(para,total);
    if(result.errors.length){
      const warn=document.createElement('p');warn.style.color='#9d3727';
      warn.textContent='Por validar: '+[...new Set(result.errors)].join(' · ')+' Não utilizar este custo para aprovar um orçamento.';
      host.append(warn);
    } else {
      const note=document.createElement('small');note.className='muted';
      note.textContent='Estimativa atual: não reserva stock, não desconta materiais e não inclui taxas/comissões não registadas.';
      host.append(note);
    }
  }
  function install(){
    const editor=$('aeUnifiedBoxesEditor');
    if(!editor||$('aeTechnicalBoxPanel'))return;
    const card=document.createElement('section');card.id='aeTechnicalBoxPanel';card.className='card';
    card.style.margin='12px 0';card.innerHTML=
      '<div class="section-title">Ficha técnica própria da Box</div>'+
      '<p class="muted">Custos dos artigos + materiais e tempo específicos desta box. Não altera as fichas individuais nem o stock. Esta ficha fica apenas neste dispositivo.</p>'+
      '<div class="form-grid">'+
        '<div class="field"><label>Matéria-prima adicional</label><select id="aeTechMaterial"></select></div>'+
        '<div class="field"><label>Quantidade na unidade do Stock</label><input id="aeTechQty" type="number" min="0.001" step="any" value="1"></div>'+
        '<div class="field"><label>&nbsp;</label><button id="aeTechAdd" class="btn" type="button">Adicionar à ficha</button></div>'+
      '</div><div id="aeTechExtraLines"></div>'+
      '<div class="form-grid">'+
        '<div class="field"><label>Tempo próprio da box (min)</label><input id="aeTechMinutes" type="number" min="0" step="1" value="0"></div>'+
        '<div class="field"><label>Custo por hora (€)</label><input id="aeTechHourly" type="number" min="0" step=".01" value="6"></div>'+
        '<div class="field"><label>Desperdício de matérias adicionais (%)</label><input id="aeTechWaste" type="number" min="0" max="100" step=".1" value="0"></div>'+
        '<div class="field"><label>Outros custos próprios (€)</label><input id="aeTechOther" type="number" min="0" step=".01" value="0"></div>'+
        '<div class="field"><label>Margem-alvo da box (%)</label><input id="aeTechTarget" type="number" min="0" max="95" step="1" value="60"></div>'+
      '</div><div id="aeTechSummary" class="card" aria-live="polite"></div>'+
      '<div class="btnrow"><button type="button" class="btn" id="aeTechPrintA4">Ficha A4 interna (custos)</button>'+
      '<button type="button" class="btn" id="aeTechPrintA5">Ficha A5 (sem custos)</button></div>';
    const review=$('aeBoxDraftReview');if(review)editor.insertBefore(card,review);else editor.append(card);
    selectMaterialOptions();
    for(const id of ['aeTechMinutes','aeTechHourly','aeTechWaste','aeTechOther','aeTechTarget','aeBoxDraftPackaging','aeBoxDraftPrice'])
      $(id)?.addEventListener('input',update);
    $('aeTechAdd').addEventListener('click',()=>{
      const id=$('aeTechMaterial').value,qty=number('aeTechQty');
      if(!id||!Number.isFinite(qty)||qty<=0)return alert('Seleciona a matéria e uma quantidade positiva.');
      if(stock().filter(m=>stockId(m)===id).length!==1)return alert('Referência de material inexistente ou duplicada.');
      const existing=extraMaterials.find(m=>m.id===id);
      if(existing)existing.qty+=qty;else extraMaterials.push({id,qty});
      update();
    });
    $('aeTechPrintA4').addEventListener('click',()=>printSheet(true));
    $('aeTechPrintA5').addEventListener('click',()=>printSheet(false));
    const oldSave=window.aeBoxDraftSave,oldReset=window.aeBoxDraftReset;
    if(typeof oldSave==='function')window.aeBoxDraftSave=function(){
      const t=model();if(!valid(t))return alert('Corrige a ficha técnica antes de guardar.');
      oldSave();
      const id=$('aeBoxDraftId')?.value,found=getDrafts().find(b=>b.id===id);
      if(!found)return;
      const all=getTechs();all[id]={...t,savedAt:new Date().toISOString()};
      try{localStorage.setItem(TECH_KEY,JSON.stringify(all))}catch{return alert('Modelo gravado, mas a ficha técnica não pôde ser guardada neste dispositivo.')}
      update();
    };
    if(typeof oldReset==='function')window.aeBoxDraftReset=function(){oldReset();setModel(defaults)};
    const savedHost=$('aeBoxDraftSaved');
    savedHost?.addEventListener('click',e=>{
      if(e.target?.closest('button') && e.target.textContent?.trim()==='Editar')
        setTimeout(()=>setModel(getTechs()[$('aeBoxDraftId')?.value]||defaults),0);
    });
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('[onclick*="catalogs"]'))setTimeout(()=>{selectMaterialOptions();update()},150);
    });
    setModel(getTechs()[$('aeBoxDraftId')?.value]||defaults);
  }
  function printSheet(internal){
    const id=$('aeBoxDraftId')?.value||'',box=getDrafts().find(b=>b.id===id);
    if(!box)return alert('Guarda primeiro o modelo de box para imprimir.');
    const t=getTechs()[id]||model(),r=compute(box.components,t);
    if(internal&&!r.ok)return alert('Ficha A4 bloqueada: custos por validar. '+r.errors.join(' · '));
    const w=window.open('','_blank');
    if(!w)return alert('Permite janelas de impressão no navegador.');
    const image=/^(https:\/\/[^\s]+|data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+)$/i.test(box.image||'')?'<img style="max-width:100%;max-height:170px;object-fit:contain" src="'+esc(box.image)+'" alt="Fotografia da box">':'';
    const rows=r.items.length?r.items.map(i=>'<tr><td>'+esc(i.name)+'</td><td>'+i.qty+'</td>'+(internal?'<td>'+money(i.cost)+'</td>':'')+'</tr>').join(''):
      (box.components||[]).map(c=>{const p=products().find(p=>productId(p)===c.productId);return '<tr><td>'+esc(p?.name||'Artigo indisponível')+'</td><td>'+esc(c.qty)+'</td></tr>'}).join('');
    const materialRows=(t.materials||[]).map(m=>{const st=stock().find(x=>stockId(x)===m.id);return '<tr><td>'+esc(st?.name||m.id)+'</td><td>'+esc(m.qty)+' '+esc(st?.unit||'un.')+'</td></tr>'}).join('');
    const financial=internal?'<h2>Custos exclusivos da Box</h2><p>Componentes: '+money(r.componentCost)+' · Matérias adicionais: '+money(r.extraCost)+' · Desperdício: '+money(r.waste)+' · Trabalho: '+money(r.labor)+' · Embalagem: '+money(r.packaging)+' · Outros: '+money(r.other)+'</p><h2>Total: '+money(r.total)+'</h2><p>PVP registado: '+money(r.salePrice)+' · PVP-alvo: '+money(r.suggested)+' · Margem: '+(Number.isFinite(r.margin)?r.margin.toFixed(1)+'%':'n/d')+'</p>':'';
    w.document.write('<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>ArtEssencia · Ficha de Box</title><style>@page{size:'+(internal?'A4':'A5')+';margin:14mm}body{font:12px Arial;color:#342820}h1{font-size:21px}h2{font-size:14px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:5px;text-align:left}small{color:#666}</style></head><body><h1>ArtEssencia · Ficha da Box</h1><h2>'+esc(box.name)+'</h2>'+image+'<p>'+esc(box.description||'')+'</p><h2>Composição</h2><table><tr><th>Produto</th><th>Qtd.</th>'+(internal?'<th>Custo</th>':'')+'</tr>'+rows+'</table><h2>Matérias específicas da Box</h2><table>'+materialRows+'</table><p>Tempo próprio da box: '+esc(t.minutes)+' min.</p>'+financial+'<small>Ficha '+(internal?'interna':'sem custos')+' · Rascunho privado · Sem reserva de stock · Gerada em '+esc(new Date().toLocaleDateString('pt-PT'))+'</small><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();