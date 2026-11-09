/* ArtEssencia — Biblioteca Técnica de Fragrâncias v1.
   Arquivo de referência independente: não lê/escreve stock, compras, caixa ou produtos. */
(function(){
'use strict';
const FIELD='technicalFragrancesV1';
const FAMILIES=['Por classificar','Floral','Frutada','Cítrica','Gourmand','Amadeirada','Aromática','Especiada','Oriental','Outra'];
const RECEIPT=[
 ['Baunilha da Polinésia Francesa','VAINILLA DE LA POLINESIA FRANCESA'],
 ['Maçã & Canela — Manzana & Canela','MANZANA & CANELA'],
 ['Lavanda & Camomila','LAVANDA & MANZANILLA'],
 ['Figo','HIGO'],
 ['Flor de Lótus','FLOR DE LOTO'],
 ['Bolachas de Gengibre','GINGERBREAD COOKIES'],
 ['Frutos Vermelhos','FRUTOS ROJOS'],
 ['Peónia Exótica','EXOTIC PEONY'],
 ['Maçã & Canela — Cinnamon Apple','CINNAMON APPLE'],
 ['Caramelo, Framboesa & Baunilha','CARAMEL RASPBERRY & VAINILLA'],
 ['Pistácio Bourbon','BOURBON PISTACHIO'],
 ['Baunilha Negra','BLACK VANILLA'],
 ['Banana & Caramelo','BANANA CARAMEL'],
 ['Bambu & Flor de Cerejeira','BAMBÚ & FLOR DE CEREZO'],
 ['Coco & Cítricos','COCO & CÍTRICOS']
];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT').replace(/[^a-z0-9]+/g,' ').trim();
const text=s=>typeof escapeHtml==='function'?escapeHtml(String(s??'')):String(s??'').replace(/[&<>"']/g,'');
const rows=()=>Array.isArray(db?.settings?.[FIELD])?db.settings[FIELD]:[];
const time=()=>new Date().toISOString();
const uid=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'frag-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function duplicate(list,row,ignore){
 return list.some(x=>x.id!==ignore&&(
    (norm(row.originalName)&&norm(x.originalName)===norm(row.originalName))
    ||(norm(x.name)===norm(row.name)&&(!norm(row.originalName)||!norm(x.originalName)))
 ));
}
function saveRows(next){
 const prior=db.settings?.[FIELD];
 db.settings=db.settings||{};
 db.settings[FIELD]=next;
 let ok=false;
 try{ok=save('settings')===true}catch(e){console.error('Biblioteca de Fragrâncias: gravação',e)}
 if(!ok){if(prior===undefined)delete db.settings[FIELD];else db.settings[FIELD]=prior;toast('Não foi possível guardar a biblioteca. Nenhum artigo de stock foi alterado.');return false}
 return true;
}
function render(){
 const root=document.getElementById('technicalLibrary');if(!root)return;
 const q=document.getElementById('aeFlSearchV1'),f=document.getElementById('aeFlFamilyV1'),s=document.getElementById('aeFlStatusV1');
 const family=f.value,used=[...new Set(rows().map(x=>x.family||FAMILIES[0]))].sort((a,b)=>a.localeCompare(b,'pt-PT'));
 f.innerHTML='<option value="">Todas as famílias</option>'+used.map(x=>'<option value="'+text(x)+'">'+text(x)+'</option>').join('');f.value=family;
 const list=rows(),search=norm(q.value),status=s.value;
 const shown=list.filter(x=>(!family||x.family===family)&&
  (status==='all'||(status==='active'&&!x.archived)||(status==='archived'&&x.archived))&&
  (!search||norm([x.name,x.originalName,x.supplier,x.description,x.family].join(' ')).includes(search)))
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-PT'));
 document.getElementById('aeFlCountsV1').textContent=list.filter(x=>!x.archived).length+' ativas · '+list.filter(x=>x.archived).length+' arquivadas · '+shown.length+' apresentadas';
 const box=document.getElementById('aeFlCardsV1');box.replaceChildren();
 if(!shown.length){const empty=document.createElement('p');empty.className='muted';empty.textContent=list.length?'Nenhuma fragrância corresponde à pesquisa.':'Ainda não existem fichas. Cria a primeira ou importa o recibo.';box.append(empty);return}
 for(const x of shown){
  const card=document.createElement('article');card.className='ae-fl-card-v1';
  const main=document.createElement('div');main.className='ae-fl-card-main-v1';
  const title=document.createElement('h3');title.textContent=x.name;main.append(title);
  const original=document.createElement('small');original.textContent=x.originalName||'Nome comercial não indicado';main.append(original);
  const meta=document.createElement('span');meta.textContent=(x.family||'Por classificar')+(x.archived?' · Arquivada':'');main.append(meta);
  const description=document.createElement('p');description.textContent=x.description||'Descrição aromática por preencher.';main.append(description);
  const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Abrir ficha';edit.addEventListener('click',()=>openEditor(x.id));
  card.append(main,edit);box.append(card);
 }
}
function dialog(title,fields,existing){
 const d=document.createElement('dialog');d.className='ae-fl-dialog-v1';d.setAttribute('aria-label',title);
 const form=document.createElement('form');form.method='dialog';
 const h=document.createElement('h2');h.textContent=title;form.append(h);
 const info=document.createElement('p');info.className='muted';info.textContent='Ficha de referência técnica. Não altera a precificação nem movimentos de stock.';form.append(info);
 const grid=document.createElement('div');grid.className='ae-fl-edit-v1';
 for(const [key,label,type] of fields){
  const wrapper=document.createElement('label');wrapper.textContent=label;
  let control;
  if(type==='textarea'){control=document.createElement('textarea');control.rows=3}
  else if(type==='family'){control=document.createElement('select');for(const v of FAMILIES){const o=document.createElement('option');o.value=v;o.textContent=v;control.append(o)}}
  else{control=document.createElement('input');control.type=type==='url'?'url':'text';control.maxLength=type==='url'?600:220}
  control.name=key;control.value=existing?.[key]||'';if(key==='name')control.required=true;
  wrapper.append(control);grid.append(wrapper);
 }
 form.append(grid);
 const actions=document.createElement('div');actions.className='ae-fl-dialog-actions-v1';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>d.close());
 const submit=document.createElement('button');submit.type='submit';submit.className='btn primary';submit.textContent='Guardar ficha';actions.append(cancel,submit);
 if(existing){const archive=document.createElement('button');archive.type='button';archive.className='btn';archive.textContent=existing.archived?'Reativar':'Arquivar';archive.addEventListener('click',()=>{const next=rows().map(x=>x.id===existing.id?{...x,archived:!x.archived,updatedAt:time()}:x);if(saveRows(next))d.close()});actions.prepend(archive)}
 form.append(actions);d.append(form);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});
 form.addEventListener('submit',ev=>{
  ev.preventDefault();
  if(!form.reportValidity())return;
  const x=Object.fromEntries(new FormData(form).entries());
  x.name=String(x.name||'').trim();x.originalName=String(x.originalName||'').trim();
  if(!x.name)return;
  for(const key of ['photoUrl','ifraUrl','sdsUrl'])if(x[key]&&!/^https?:\/\//i.test(x[key])){toast('Usa um endereço https:// ou http:// no campo '+key);return}
  if(duplicate(rows(),x,existing?.id)){toast('Já existe uma fragrância com essa identificação.');return}
  const updated=existing?{...existing,...x,updatedAt:time()}:{...x,id:uid(),source:'Registo manual',archived:false,createdAt:time(),updatedAt:time()};
  if(saveRows(existing?rows().map(v=>v.id===existing.id?updated:v):[...rows(),updated]))d.close();
 });
 d.showModal();
}
const FIELDS=[['name','Nome utilizado no atelier','text'],['originalName','Nome comercial / original','text'],
 ['family','Família olfativa','family'],['description','Descrição olfativa','textarea'],
 ['applications','Aplicações / recomendações confirmadas','textarea'],['supplier','Fornecedor','text'],
 ['reference','Referência do fabricante','text'],['technicalNotes','Notas técnicas','textarea'],
 ['photoUrl','Ligação à fotografia (opcional)','url'],['ifraUrl','Ligação ao certificado IFRA (opcional)','url'],
 ['sdsUrl','Ligação à ficha de segurança (opcional)','url']];
function openEditor(id){dialog(id?'Editar ficha de fragrância':'Nova fragrância',FIELDS,id?rows().find(x=>x.id===id):null)}
function importReceipt(){
 if(!confirm('Importar as 15 fragrâncias do recibo 67827 para a Biblioteca Técnica? Não serão criados artigos, custos ou movimentos de stock.'))return;
 let added=0,skipped=0;const next=rows().slice();
 RECEIPT.forEach(([name,originalName],i)=>{
  const candidate={id:'receipt-67827-'+String(i+1).padStart(2,'0'),name,originalName,
   family:'Por classificar',description:'',applications:'',supplier:'',reference:'',
   technicalNotes:'',photoUrl:'',ifraUrl:'',sdsUrl:'',source:'Recibo 67827 — 09/11/2026',
   archived:false,createdAt:time(),updatedAt:time()};
  if(next.some(x=>x.id===candidate.id)||duplicate(next,candidate)){skipped++;return}
  next.push(candidate);added++;
 });
 if(!added){toast('Não existem fichas novas para importar.');return}
 if(saveRows(next))toast(added+' fragrâncias adicionadas · '+skipped+' já existentes.');
}
function exportCsv(){
 const headers=['Nome','Nome original','Família','Descrição','Aplicações','Fornecedor','Referência','Notas técnicas','Origem','Estado','IFRA','FDS'];
 const csv=[headers,...rows().map(x=>[x.name,x.originalName,x.family,x.description,x.applications,x.supplier,x.reference,x.technicalNotes,x.source,x.archived?'Arquivada':'Ativa',x.ifraUrl,x.sdsUrl])]
  .map(a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ArtEssencia_Biblioteca_Fragrancias.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.renderTechnicalLibraryV1=render;
window.aeFragrancesV1={render,add:()=>openEditor(null),importReceipt,exportCsv};
})();