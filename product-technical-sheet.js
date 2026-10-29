/* ArtEssencia 1.9.36 — fichas técnicas de consulta, sem escrita de dados. */
(function productSheetAddon(){
'use strict';
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>(Number(v)||0).toLocaleString('pt-PT',{maximumFractionDigits:3});
const eur=v=>(Number(v)||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
function photo(p){
 const c=p.shopImageUrl||p.imageUrl||p.image||p.photo||(Array.isArray(p.images)?p.images[0]:'')||'';
 const raw=typeof c==='string'?c:c?.url||c?.src||'';
 if(/^data:image\/(?:jpeg|png|webp);base64,/i.test(raw))return raw;
 try{const u=new URL(raw,location.href);return ['https:','blob:'].includes(u.protocol)||(u.protocol==='http:'&&location.protocol==='http:')?u.href:''}catch(_){return ''}
}
function snapshot(code){
 const p=(db.products||[]).find(x=>String(x.code)===String(code));if(!p)return null;
 const recipe=Array.isArray(db.productRecipes?.[p.code])?db.productRecipes[p.code].map(x=>{
  const st=(db.stock||[]).find(s=>s.name===x.item);
  return {item:x.item||'',qty:Number(x.qty)||0,unit:st?.unit||x.unit||'',cost:Number(st?.unitCost)||0,missing:!st};
 }):[];
 return {p,recipe,cost:productCostBreakdownV110(p),photo:photo(p)};
}
const styles='.ts-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.ts-head h2{margin:6px 0;color:#62483b}.ts-photo{width:112px;height:112px;object-fit:contain;border:1px solid #ddd;border-radius:10px}.ts-block{margin-top:14px}.ts-block h3{font-size:14px;color:#62483b;padding-bottom:6px;border-bottom:1px solid #ddd}.ts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ts-field{break-inside:avoid;min-width:0}.ts-field small{display:block;color:#796e67}.ts-field strong{font-size:12px;overflow-wrap:anywhere}.ts-table{width:100%;border-collapse:collapse;font-size:12px}.ts-table th,.ts-table td{padding:7px 5px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}.ts-table th{background:#f7f3ef}.ts-table tr{break-inside:avoid}.ts-note{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.ts-warn{color:#894d26;font-size:12px}';
function markup(s,full,img){
 const {p,recipe,cost}=s,c=p.publicCharacteristics&&typeof p.publicCharacteristics==='object'?p.publicCharacteristics:{};
 const fields=[['SKU',p.code],['Produto',p.name],['Categoria',p.category],['Tipo',typeof productionTypeLabelV130==='function'?productionTypeLabelV130(productProductionTypeV130(p)):p.productionType],['Tipo de cera',c.waxType],['Material',c.materialType||c.material_type],['Peso aproximado',c.approximateWeight],['Tamanho',c.sizeCategory||c.dimensions],['Tempo de queima',c.burnTime],['Recipiente',c.materialContainer],['Trabalho',p.laborMinutes!=null?num(p.laborMinutes)+' min':''],['Cura',p.cureHours!=null&&p.cureHours!==''?num(p.cureHours)+' h':''],['Temperatura de preparação',p.prepTemp!=null&&p.prepTemp!==''?num(p.prepTemp)+' °C':''],['Temperatura de mistura',p.mixTemp!=null&&p.mixTemp!==''?num(p.mixTemp)+' °C':''],['Temperatura de vertimento',p.pourTemp!=null&&p.pourTemp!==''?num(p.pourTemp)+' °C':'']].filter(([,v])=>v!==null&&v!==undefined&&v!=='');
 const grid=rows=>'<div class="ts-grid">'+rows.map(([a,b])=>'<div class="ts-field"><small>'+clean(a)+'</small><strong>'+clean(b)+'</strong></div>').join('')+'</div>';
 const ingredients=recipe.length?'<table class="ts-table"><thead><tr><th>Componente</th><th>Quantidade / unidade</th>'+(full?'<th>Custo</th>':'')+'</tr></thead><tbody>'+recipe.map(x=>'<tr><td>'+clean(x.item)+(x.missing?' (sem correspondência no Stock)':'')+'</td><td>'+clean(num(x.qty)+' '+x.unit)+'</td>'+(full?'<td>'+eur(x.qty*x.cost)+'</td>':'')+'</tr>').join('')+'</tbody></table>':'<p class="ts-note">Sem materiais registados.</p>';
 const notes=[['Processo',p.productionNotes],['Qualidade',p.qualityNotes],['Descrição',p.shopDescription]].filter(([,v])=>typeof v==='string'&&v.trim());
 const costs=full?'<section class="ts-block"><h3>Custos e preço (uso interno)</h3>'+grid([['Materiais',eur(cost.materials)],['Mão de obra',eur(cost.labor)],['Custos gerais',eur(cost.fixed)],['Outros',eur(cost.other)],['Custo total',eur(cost.total)],['PVP',eur(p.price)],['Margem',Number(p.price)>0?num(100*(Number(p.price)-cost.total)/Number(p.price))+' %':'—']])+'</section>':'';
 return '<header class="ts-head"><div><small>ArtEssencia · Ficha técnica</small><h2>'+clean(p.name||'Produto')+'</h2><small>'+clean(p.code||'')+'</small></div>'+(img?'<img class="ts-photo" src="'+clean(img)+'" alt="Fotografia do produto">':'<div class="ts-note">Sem fotografia</div>')+'</header><section class="ts-block"><h3>Características</h3>'+grid(fields)+'</section><section class="ts-block"><h3>Composição por unidade</h3>'+ingredients+'</section>'+(notes.length?'<section class="ts-block"><h3>Instruções e observações</h3>'+notes.map(([k,v])=>'<div class="ts-note"><b>'+clean(k)+'</b><p>'+clean(v)+'</p></div>').join('')+'</section>':'')+costs;
}
async function dataImage(src){
 if(!src||/^data:image\//.test(src))return src;
 const res=await fetch(src,{cache:'no-store',credentials:'omit'});
 if(!res.ok)throw Error('Imagem indisponível');
 const blob=await res.blob();
 if(!/^image\/(png|jpeg|webp)$/i.test(blob.type)||blob.size>10000000)throw Error('Formato de imagem');
 return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(Error('Fotografia'));r.readAsDataURL(blob)});
}
async function printSheet(code,format){
 const s=snapshot(code);if(!s)return;
 const size=format==='A4'?'A4':'A5',full=size==='A4';
 const win=window.open('','_blank');
 if(!win){alert('Ativa as janelas emergentes para imprimir.');return;}
 win.document.write('<!doctype html><title>A preparar impressão</title><p>A preparar a ficha técnica…</p>');
 let img=s.photo,embedFailed=false;
 if(img){try{img=await dataImage(img)}catch(_){embedFailed=true;}}
 if(win.closed)return;
 const css='@page{size:'+size+' portrait;margin:'+(full?13:10)+'mm}body{font:12px Arial,sans-serif;color:#2f2823;margin:0}'+styles+'.ts-head h2{font-size:'+(full?21:17)+'px}.ts-photo{width:'+(full?128:86)+'px;height:'+(full?128:86)+'px}@media print{.ts-tools{display:none}thead{display:table-header-group}}';
 const warning=embedFailed?'<p class="ts-warn" id="ts-warning">A carregar a fotografia diretamente…</p>':'';
 win.document.open();
 win.document.write('<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Ficha técnica '+clean(s.p.code)+' · '+size+'</title><style>'+css+'</style></head><body><div class="ts-tools"><button onclick="print()">Imprimir / guardar PDF</button> · '+size+'</div>'+warning+markup(s,full,img)+'</body></html>');
 win.document.close();
 const image=win.document.querySelector('.ts-photo');
 if(image){try{if(!image.complete)await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),5000))]);if(!image.naturalWidth)throw Error('sem imagem');}catch(_){image.remove();const note=win.document.getElementById('ts-warning')||win.document.createElement('p');note.className='ts-warn';note.textContent='Fotografia indisponível. É possível imprimir sem imagem.';if(!note.parentNode)win.document.body.prepend(note);}}
 if(!win.closed){win.focus();win.print();}
}
function openSheet(code){
 const s=snapshot(code);if(!s){alert('Produto não encontrado. Atualiza a lista.');return;}
 document.getElementById('ae-product-sheet')?.remove();
 const dialog=document.createElement('dialog');dialog.id='ae-product-sheet';dialog.setAttribute('aria-label','Ficha técnica de '+(s.p.name||'produto'));
 Object.assign(dialog.style,{width:'min(760px,calc(100% - 24px))',maxHeight:'90vh',overflow:'auto',padding:'16px',border:'1px solid #d8c8b9',borderRadius:'15px',background:'#fff',color:'#302820'});
 const style=document.createElement('style');style.textContent=styles+'#ae-product-sheet::backdrop{background:rgba(20,12,8,.66)}#ae-product-sheet .ts-actions{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:-16px;padding:10px 0;background:#fff;z-index:1}#ae-product-sheet .ts-actions button{min-height:42px;cursor:pointer}';
 dialog.append(style);const actions=document.createElement('div');actions.className='ts-actions';
 for(const [label,fn] of [['Fechar',()=>dialog.close()],['Imprimir A5',()=>void printSheet(code,'A5')],['Imprimir A4 / PDF',()=>void printSheet(code,'A4')]]){const b=document.createElement('button');b.type='button';b.className='btn '+(label.includes('A5')?'primary':'ghost');b.textContent=label;b.addEventListener('click',fn);actions.append(b);}
 dialog.append(actions);const content=document.createElement('div');content.innerHTML=markup(s,true,s.photo);dialog.append(content);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
window.openProductTechnicalSheetV1936=openSheet;
})();
