/* ArtEssencia 1.9.39 — fichas técnicas de consulta, sem escrita de dados. */
(function productSheetAddon(){
'use strict';
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>(Number(v)||0).toLocaleString('pt-PT',{maximumFractionDigits:3});
const eur=v=>(Number(v)||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
function photo(p){
 const candidates=[p.shopImageUrl,p.imageUrl,p.image,p.photo,p.photo1,p.coverImage,...(Array.isArray(p.images)?p.images:[])];
 for(const c of candidates){
  const raw=typeof c==='string'?c:c?.url||c?.src||'';
  if(!raw||/[\u0000-\u001f\u007f]/.test(raw))continue;
  if(/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(raw))return raw;
  try{const u=new URL(raw,location.href);if(!u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&u.origin===location.origin)))return u.href}catch(_){}
 }
 return '';
}
function snapshot(code){
 const p=(db.products||[]).find(x=>String(x.code)===String(code));if(!p)return null;
 const installed=Array.isArray(db.productRecipes?.[p.code]);
 const batch=Number(p.batchUnits)>0?Number(p.batchUnits):null;
 const rows=installed?db.productRecipes[p.code]:(Array.isArray(p.recipe)?p.recipe:[]);
 const recipe=rows.map(x=>{
  const st=installed?(db.stock||[]).find(s=>s.name===x.item):(db.materials||[]).find(m=>String(m.id)===String(x.materialId));
  const raw=x.qty,amount=raw!==''&&raw!=null&&Number.isFinite(Number(raw))?Number(raw):null;
  const qty=installed?amount:(batch&&amount!==null?amount/batch:amount);
  return {item:st?.name||x.item||('Material não encontrado'+(x.materialId?' · '+x.materialId:'')),qty,unit:st?.unit||x.unit||'',cost:st&&Number.isFinite(Number(st.unitCost))?Number(st.unitCost):null,missing:!st};
 });
 return {p,recipe,cost:productCostBreakdownV110(p),photo:photo(p),basis:installed||batch?'Por unidade':'Por lote',batch,legacy:!installed&&rows.length>0};
}
const styles="\n.ts-sheet,.ts-sheet *{box-sizing:border-box}\n.ts-sheet{overflow-wrap:anywhere;word-break:normal}\n.ts-sheet :where(div,section,header,span,p,h2,h3,small,strong,b){min-width:0;max-width:100%}\n.ts-tag{overflow-wrap:anywhere;white-space:normal}\n.ts-section-head{flex-wrap:wrap}\n\n/* Identidade visual da ficha técnica, isolada do Backoffice. */\n.ts-sheet{max-width:100%;font-family:Arial,Helvetica,sans-serif;color:#352a24;line-height:1.42}\n.ts-masthead{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #866047;padding-bottom:10px}\n.ts-identity{display:flex;align-items:center;gap:10px;min-width:0}\n.ts-monogram{display:flex;align-items:center;justify-content:center;flex:none;width:39px;height:39px;background:#6a4e3d;border-radius:8px;color:white;font:700 16px Georgia,serif}\n.ts-brand{font:700 19px Georgia,serif;letter-spacing:.01em;color:#5c4235}\n.ts-brand-caption{font:700 8px Arial,sans-serif;text-transform:uppercase;letter-spacing:.16em;color:#8e7868}\n.ts-doc-kind{text-align:right;flex:0 1 auto}\n.ts-doc-kind strong{display:block;font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#6a4e3d}\n.ts-doc-kind small{display:block;font-size:9px;color:#867468}\n.ts-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;margin-top:14px}\n.ts-head h2{font:700 23px/1.15 Georgia,serif;color:#3f3028;margin:6px 0 10px;overflow-wrap:anywhere}\n.ts-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8a6e5b;font-weight:700}\n.ts-tags{display:flex;gap:6px;flex-wrap:wrap}\n.ts-tag{display:inline-block;padding:4px 7px;border:1px solid #e0d5c9;background:#f7f2ec;border-radius:5px;font-size:9px;color:#624838;font-weight:700}\n.ts-photo{display:block;width:128px;height:128px;object-fit:contain;border:1px solid #e6ded6;border-radius:8px;background:#fff;padding:5px;box-sizing:border-box}\n.ts-no-photo{width:110px;height:80px;border:1px dashed #d6c8ba;color:#8c7c6d;border-radius:6px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px}\n.ts-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px;padding-top:8px;border-top:1px solid #ebe5df;font-size:9px;color:#78685e}\n.ts-block{margin-top:16px}\n.ts-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px;border-bottom:1px solid #dbc8b7;padding-bottom:6px;break-after:avoid}\n.ts-section-head h3{margin:0;font-size:12px;color:#62483b;text-transform:uppercase;letter-spacing:.09em}\n.ts-section-head span{font-size:10px;color:#8f796a}\n.ts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:13px;row-gap:9px}\n.ts-field{break-inside:avoid;min-width:0}\n.ts-field small{display:block;margin-bottom:2px;font-size:9px;color:#7c6b60}\n.ts-field strong{display:block;font-size:11px;font-weight:700;overflow-wrap:anywhere;white-space:pre-wrap}\n.ts-table{width:100%;min-width:0;border-collapse:collapse;table-layout:fixed;font-size:10.5px}\n.ts-table th,.ts-table td{padding:7px 8px;border-bottom:1px solid #e8ded6;text-align:left;vertical-align:top;overflow-wrap:anywhere}\n.ts-table th{background:#f2eae2;color:#543c30;font-size:9px;text-transform:uppercase;letter-spacing:.04em;font-weight:700}\n.ts-table tbody tr:nth-child(even){background:#fbf8f5}\n.ts-table tr{break-inside:avoid;page-break-inside:avoid}\n.ts-table th:nth-child(2),.ts-table td:nth-child(2){width:34%;text-align:right}\n.ts-table.has-cost th:last-child,.ts-table.has-cost td:last-child{width:21%;text-align:right}\n.ts-missing{font-size:9px;color:#975b39}\n.ts-note{font-size:10.5px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.48;margin:5px 0 0}\n.ts-note-item{margin:10px 0;orphans:3;widows:3}\n.ts-note-item b{font-size:10px;color:#5c4434}\n.ts-empty{font-size:11px;color:#776b65;background:#fcf8f4;border:1px dashed #e1d7cd;padding:10px;border-radius:6px}\n.ts-finance{padding:10px 12px;background:#f8f2ed;border:1px solid #e8ddd2;border-radius:7px;break-inside:avoid}\n.ts-finance .ts-grid{row-gap:11px}\n.ts-finance .ts-highlight{border-top:1px solid #ccb8a6;padding-top:7px}\n.ts-finance .ts-highlight strong{color:#593e2d;font-size:13px}\n.ts-warn{color:#874b25;font-size:11px;margin:8px 0}\n.ts-legend{font-size:9px;color:#8e7b70;margin:8px 0 0}\n@media(max-width:480px){.ts-head{gap:9px}.ts-photo{width:94px;height:94px}.ts-head h2{font-size:20px}.ts-doc-kind strong{font-size:10px}.ts-brand{font-size:17px}.ts-grid{column-gap:8px}.ts-table th,.ts-table td{padding:5px}}\n";
function markup(s,full,img){
 const {p,recipe,cost}=s;
 const c=p.publicCharacteristics&&typeof p.publicCharacteristics==='object'?p.publicCharacteristics:{};
 const fields=[
  ['Categoria',p.category],['Processo',typeof productionTypeLabelV130==='function'?productionTypeLabelV130(productProductionTypeV130(p)):p.productionType],
  ['Tipo de cera',c.waxType??p.waxType],['Material',c.materialType||c.material_type],['Peso aproximado',c.approximateWeight??p.approximateWeight],
  ['Dimensões',c.dimensions||c.sizeCategory||p.dimensions],['Tempo de queima',c.burnTime??p.burnTime],
  ['Recipiente / material',c.materialContainer??p.materialContainer],
  ['Unidades por lote',s.batch],
  ['Tempo de trabalho',p.laborMinutes!=null?num(p.laborMinutes)+' min':''],
  ['Tempo de cura',p.cureHours!=null&&p.cureHours!==''?num(p.cureHours)+' h':''],
  ['Temperatura de preparação',p.prepTemp!=null&&p.prepTemp!==''?num(p.prepTemp)+' °C':''],
  ['Temperatura de mistura',p.mixTemp!=null&&p.mixTemp!==''?num(p.mixTemp)+' °C':''],
  ['Temperatura de vertimento',p.pourTemp!=null&&p.pourTemp!==''?num(p.pourTemp)+' °C':'']
 ].filter(([,v])=>v!==null&&v!==undefined&&v!=='');
 const grid=(rows,finance=false)=>'<div class="ts-grid">'+rows.map(([label,value],i)=>'<div class="ts-field'+(finance&&i>=rows.length-3?' ts-highlight':'')+'"><small>'+clean(label)+'</small><strong>'+clean(value)+'</strong></div>').join('')+'</div>';
 const date=new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'});
 const section=(n,title,meta='')=>'<div class="ts-section-head"><h3>'+clean(n+'  /  '+title)+'</h3>'+(meta?'<span>'+clean(meta)+'</span>':'')+'</div>';
 const recipeTable=recipe.length?'<table class="ts-table'+(full?' has-cost':'')+'"><thead><tr><th>Material / componente</th><th>Quantidade / unidade</th>'+(full?'<th>Custo direto</th>':'')+'</tr></thead><tbody>'+recipe.map(x=>'<tr><td>'+clean(x.item)+(x.missing?'<div class="ts-missing">Sem correspondência no Stock</div>':'')+'</td><td>'+clean((x.qty===null?'Não indicada':num(x.qty))+' '+x.unit)+'</td>'+(full?'<td>'+(x.qty===null||x.cost===null?'—':eur(x.qty*x.cost))+'</td>':'')+'</tr>').join('')+'</tbody></table>':'<div class="ts-empty">Esta ficha ainda não tem componentes registados.</div>';
 const notes=[['Notas de produção',p.productionNotes],['Controlo de qualidade',p.qualityNotes],['Descrição',p.shopDescription]].filter(([,v])=>typeof v==='string'&&v.trim());
 const financeRows=[['Materiais',eur(cost.materials)],['Mão de obra',eur(cost.labor)],['Trabalho sazonal',eur(cost.editionLabor)],['Eletricidade',eur(cost.energy)],['Desperdício',eur(cost.waste)],['Custos gerais',eur(cost.fixed)],['Outros custos',eur(cost.other)],['Custo total estimado',eur(cost.total)],['Preço de venda',eur(p.price)],['Margem estimada',Number(p.price)>0?num((Number(p.price)-cost.total)/Number(p.price)*100)+' %':'—']];
 const finance=full&&!s.legacy?'<section class="ts-block">'+section('04','Custos e rentabilidade','Uso interno')+'<div class="ts-finance">'+grid(financeRows,true)+'</div><p class="ts-legend">Valores estimados com base nos custos atualmente registados no Backoffice.</p></section>':'';
 return '<article class="ts-sheet"><div class="ts-masthead"><div class="ts-identity"><div class="ts-monogram">AE</div><div><div class="ts-brand">ArtEssencia</div><div class="ts-brand-caption">Atelier artesanal</div></div></div><div class="ts-doc-kind"><strong>Ficha técnica</strong><small>'+(full?'A4 · Completa':'A5 · Compacta')+'</small></div></div>'+
 '<header class="ts-head"><div><span class="ts-eyebrow">Identificação do produto</span><h2>'+clean(p.name||'Produto sem nome')+'</h2><div class="ts-tags"><span class="ts-tag">'+clean(p.code||'Sem SKU')+'</span>'+(p.category?'<span class="ts-tag">'+clean(p.category)+'</span>':'')+'</div></div>'+(img?'<img class="ts-photo" src="'+clean(img)+'" alt="Fotografia do produto">':'')+'</header>'+
 '<div class="ts-meta"><span>Documento de consulta</span><span>Emitido em '+clean(date)+'</span><span>'+recipe.length+' componente(s)</span></div>'+
 '<section class="ts-block">'+section('01','Características')+(fields.length?grid(fields):'<div class="ts-empty">Sem características adicionais registadas.</div>')+'</section>'+
 '<section class="ts-block">'+section('02','Composição',s.basis)+recipeTable+'</section>'+
 (notes.length?'<section class="ts-block">'+section('03','Instruções e observações')+notes.map(([a,v])=>'<div class="ts-note-item"><b>'+clean(a)+'</b><p class="ts-note">'+clean(v)+'</p></div>').join('')+'</section>':'')+finance+'</article>';
}
async function dataImage(src){
 if(!src||/^data:image\//.test(src))return src;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 let res,blob;try{res=await fetch(src,{cache:'no-store',credentials:'omit',signal:controller.signal});
 if(!res.ok)throw Error('Imagem indisponível');blob=await res.blob()}finally{clearTimeout(timer)}
 if(!res.ok)throw Error('Imagem indisponível');
 if(!/^image\/(png|jpeg|webp)$/i.test(blob.type)||blob.size>10000000)throw Error('Formato de imagem');
 return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(Error('Fotografia'));r.readAsDataURL(blob)});
}
function printSheet(code,format){
 return (async()=>{
 const s=snapshot(code);if(!s)return;
 const size=format==='A4'?'A4':'A5',full=size==='A4';
 const win=window.open('','_blank');
 if(!win){alert('Permite janelas emergentes para imprimir. Se a PWA não abrir a impressão, abre o Backoffice no navegador e usa Produtos → Ver ficha → Imprimir. Na janela de impressão podes escolher Guardar como PDF.');return}
 win.opener=null;
 win.document.write('<!doctype html><html lang="pt-PT"><meta charset="utf-8"><title>A preparar a ficha técnica</title><body style="font:14px Arial,sans-serif;padding:20px">A preparar impressão…</body></html>');
 let img=s.photo,embedFailed=false;
 if(img){try{img=await dataImage(img)}catch(_){embedFailed=true}}
 if(win.closed)return;
 const fileName='ArtEssencia_FichaTecnica_'+String(s.p.code||'Produto').replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+size;
 const css='@page{size:'+size+' portrait;margin:'+(full?'13mm 12mm 18mm':'10mm 9mm 15mm')+';'+
  '@bottom-left{content:"ARTESSENCIA  ·  FICHA TÉCNICA";font:8px Arial,sans-serif;color:#806e61}'+
  '@bottom-right{content:"PÁG. " counter(page) " / " counter(pages);font:8px Arial,sans-serif;color:#806e61}}'+
  'html,body{margin:0;padding:0}body{font:11px Arial,sans-serif;color:#322820;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
  styles+
  '.ts-sheet{width:100%;max-width:100%}.ts-head h2{font-size:'+(full?23:18)+'px}.ts-photo{width:'+(full?130:88)+'px;height:'+(full?130:88)+'px}'+
  '.ts-head{gap:'+(full?16:8)+'px}.ts-grid{row-gap:'+(full?9:6)+'px}.ts-block{margin-top:'+(full?16:11)+'px}.ts-table th,.ts-table td{padding:'+(full?7:5)+'px '+(full?8:5)+'px}'+
  '.ts-identity .ts-monogram{width:'+(full?39:30)+'px;height:'+(full?39:30)+'px;font-size:'+(full?16:13)+'px}'+
  '.ts-brand{font-size:'+(full?19:16)+'px}.ts-doc-kind strong{font-size:'+(full?12:10)+'px}'+
  '@media print{.ts-tools,.ts-warn{display:none!important}.ts-section-head{break-after:avoid;page-break-after:avoid}'+
  '.ts-field,.ts-finance,.ts-masthead{break-inside:avoid;page-break-inside:avoid}'+
  '.ts-table thead{display:table-header-group}.ts-table tbody tr{break-inside:avoid;page-break-inside:avoid}'+
  '.ts-head{break-inside:avoid}body{overflow:visible}}'+
  '@media screen{.ts-tools{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px;background:#f4eee8;margin-bottom:16px;border-radius:8px}.ts-tools button{padding:9px 15px;border-radius:7px;border:0;background:#684b3b;color:white;cursor:pointer}.ts-sheet{max-width:'+(full?'760':'520')+'px;margin:auto}}';
 const fallback=embedFailed?'<p class="ts-warn" id="ts-warning">Fotografia externa não incorporada. A verificar carregamento…</p>':'';
 const html='<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+clean(fileName)+'</title><style>'+css+'</style></head><body><div class="ts-tools"><div><b>Pré-visualização '+size+'</b><small> · Para guardar em PDF, escolhe “Guardar como PDF” na impressão.</small></div><button id="ts-print-action" type="button" disabled>Imprimir / Guardar PDF</button></div>'+fallback+markup(s,full,img)+'</body></html>';
 win.document.open();win.document.write(html);win.document.close();
 const printButton=win.document.getElementById('ts-print-action');
 printButton.onclick=()=>{try{win.focus();win.print()}catch(_){alert('A impressão não abriu. Usa o menu Imprimir do navegador ou abre o Backoffice num navegador compatível.')}};
 const image=win.document.querySelector('.ts-photo');
 if(image){
  try{if(!image.complete)await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de imagem excedido')),6000))]);if(!image.naturalWidth)throw new Error('Imagem vazia')}
  catch(_){image.remove();const note=win.document.getElementById('ts-warning')||win.document.createElement('p');note.className='ts-warn';note.textContent='Fotografia indisponível. A impressão pode continuar sem imagem.';if(!note.parentNode)win.document.body.prepend(note);}
 }
 if(!win.closed){printButton.disabled=false;printButton.click()}
 })();
}
function openSheet(code){
 const s=snapshot(code);if(!s){alert('Produto não encontrado. Atualiza a lista.');return;}
 document.getElementById('ae-product-sheet')?.remove();
 const dialog=document.createElement('dialog');dialog.id='ae-product-sheet';dialog.setAttribute('aria-label','Ficha técnica de '+(s.p.name||'produto'));
 Object.assign(dialog.style,{width:'min(760px,calc(100% - 24px))',maxHeight:'90vh',overflow:'auto',padding:'16px',border:'1px solid #d8c8b9',borderRadius:'15px',background:'#fff',color:'#302820'});
 const style=document.createElement('style');style.textContent=styles+'#ae-product-sheet::backdrop{background:rgba(20,12,8,.66)}#ae-product-sheet .ts-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;position:sticky;top:-16px;padding:10px 0;background:#fff;z-index:1}#ae-product-sheet .ts-actions button{min-height:44px;min-width:44px;white-space:normal;line-height:1.3;padding:11px 12px;margin:0;cursor:pointer}';
 style.textContent+='#ae-product-sheet .ts-actions button:last-child{grid-column:1/-1}#ae-product-sheet .ts-actions button:focus-visible{outline:3px solid #9e7958;outline-offset:2px}';
 dialog.append(style);const actions=document.createElement('div');actions.className='ts-actions';
 for(const [label,fn] of [['Imprimir A5',()=>void printSheet(code,'A5')],['Imprimir A4 / PDF',()=>void printSheet(code,'A4')],['Fechar',()=>dialog.close()]]){const b=document.createElement('button');b.type='button';b.className='btn '+(label.includes('A5')?'primary':'ghost');b.textContent=label;b.addEventListener('click',fn);actions.append(b);}
 dialog.append(actions);const content=document.createElement('div');content.innerHTML=markup(s,true,s.photo);const preview=content.querySelector('.ts-photo');if(preview)preview.addEventListener('error',()=>preview.remove(),{once:true});dialog.append(content);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
window.openProductTechnicalSheetV1936=openSheet;
})();
