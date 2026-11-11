/* ArtEssencia — Biblioteca de Fragrâncias v1.
   Arquivo de referência independente: não lê/escreve stock, compras, caixa ou produtos. */
(function(){
'use strict';
const FIELD='manualFragranceLibraryV1';
const ledger=window.FragranceLedger;
const FAMILIES=['Por classificar','Floral','Frutada','Cítrica','Gourmand','Amadeirada','Aromática','Especiada','Oriental','Outra'];
const FAMILY_EXAMPLES={
 Floral:'rosa, jasmim, peónia',Frutada:'maçã, figo, frutos vermelhos',
 Cítrica:'limão, laranja, bergamota',Gourmand:'baunilha, chocolate, caramelo',
 Amadeirada:'cedro, sândalo, vetiver',Aromática:'lavanda, alecrim, menta',
 Especiada:'canela, cravinho, gengibre',Oriental:'âmbar, resinas, incenso'
};
const COMMON_NOTES='Dosagens de referência — Velas: 7% a 10%. Velas de massagem: 2%. Sabonetes: 0,5% a 1,5%. Confirma a adequação da fragrância e o limite para a aplicação na documentação do fornecedor antes de usar.';
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
const ml=n=>n.toLocaleString('pt-PT',{maximumFractionDigits:3})+' ml';
const time=()=>new Date().toISOString();
const uid=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'frag-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const hasBalance=row=>(row.movements||[]).some(move=>move.type!=='capacity');
const today=()=>new Date().toLocaleDateString('sv-SE');
function initialize(row,quantity,capacity){
 const values=[['correction',quantity,'Contagem inicial'],['capacity',capacity,'Capacidade inicial']];
 for(const [type,value,note] of values){
  if(value.trim())row=ledger.apply(row,{id:uid(),type,quantity:value.trim(),date:today(),note});
 }
 return row;
}
function balanceLabel(row){
 if(!hasBalance(row))return 'Quantidade por registar';
 return ml(ledger.balance(row)/1000)+(ledger.balance(row)===0?' · Esgotada':'');
}
function duplicate(list,row,ignore){
 return list.some(x=>x.id!==ignore&&(
    (norm(row.originalName)&&norm(x.originalName)===norm(row.originalName))
    ||(norm(x.name)===norm(row.name)&&(!norm(row.originalName)||!norm(x.originalName)))
 ));
}
function saveRows(next){
 if(typeof cloudMeta==='function'&&(cloudMeta().conflict||typeof cloudConflict!=='undefined'&&cloudConflict)){toast('Resolve o conflito Cloud antes de registar novos movimentos.');return false}
 const prior=db.settings?.[FIELD];
 try{const persisted=JSON.parse(localStorage.getItem(KEY)||'null');if(persisted&&JSON.stringify(persisted.settings?.[FIELD])!==JSON.stringify(prior)){toast('Existe uma versão mais recente guardada. Atualiza a aplicação antes de continuar.');return false}}catch(e){toast('Não foi possível validar o armazenamento.');return false}
 db.settings=db.settings||{};
 db.settings[FIELD]=next;
 let ok=false;
 try{ok=save('settings')===true}catch(e){console.error('Biblioteca de Fragrâncias: gravação',e)}
 if(ok){render();toast('Guardado neste dispositivo. A confirmação Cloud é apresentada no estado de sincronização.')}
 if(!ok){if(prior===undefined)delete db.settings[FIELD];else db.settings[FIELD]=prior;toast('Não foi possível guardar a biblioteca. Nenhum artigo de stock foi alterado.');return false}
 return true;
}
function makeGauge(x){
  const level=ledger.tank(x), gauge=document.createElement('div');gauge.className='fl-gauge';gauge.dataset.level=level.percent===null?'unknown':level.percent<=5?'critical':level.percent<=20?'low':'normal';
  gauge.innerHTML='<div class="fl-tank" role="img" aria-label="'+text(level.percent===null?'Capacidade por definir':level.percent.toFixed(1)+'% disponível')+'"><i style="height:'+ (level.percent||0)+'%"></i></div><div><strong>'+text(balanceLabel(x))+'</strong><br><span class="fl-tank-reference">'+ (level.percent===null?'Capacidade por definir':level.percent.toFixed(1)+'% · referência '+level.capacity+' ml')+'</span><br><small>'+(level.percent===null?'Sem referência':level.percent<=5?'Nível crítico':level.percent<=20?'Nível baixo':level.available>level.capacity?'Acima da referência — ajustar capacidade':'Nível normal')+'</small></div>';
  if(!hasBalance(x)){
   gauge.dataset.level='unknown';
   gauge.querySelector('.fl-tank').setAttribute('aria-label','Quantidade por registar');
   gauge.querySelector('.fl-tank-reference').textContent=level.capacity?'Referência '+ml(level.capacity):'Capacidade por definir';
   gauge.querySelector('small').textContent='';
  }
 return gauge;
}
let fragranceView='cards';
function statusOfFragrance(row){
 if(row.archived)return 'archived';
 if(!hasBalance(row))return 'pending';
 if(ledger.balance(row)===0)return 'empty';
 const percent=ledger.tank(row).percent;
 return percent!==null&&percent<=20?'low':'available';
}
function matchesFragranceStatus(row,status){
 const state=statusOfFragrance(row);
 return status==='all'||status==='active'&&!row.archived||
  status==='available'&&!row.archived&&hasBalance(row)&&ledger.balance(row)>0||
  status===state;
}
function quickFilter(status){
 const select=document.getElementById('aeFlStatusV1');
 if(!select)return;
 document.getElementById('aeFlSearchV1').value='';
 document.getElementById('aeFlFamilyV1').value='';
 select.value=status;render();
}
function clearFilters(){
 const select=document.getElementById('aeFlStatusV1');
 if(!select)return;
 document.getElementById('aeFlSearchV1').value='';
 document.getElementById('aeFlFamilyV1').value='';
 document.getElementById('aeFlSort').value='name';
 select.value='active';render();
}
function setView(mode){if(mode==='cards'||mode==='list'){fragranceView=mode;render()}}
function makeQuickConsumption(row){
 if(row.archived||!hasBalance(row)||ledger.balance(row)<=0)return null;
 const snapshot=JSON.stringify(row),opId=uid();
 const form=document.createElement('form');form.className='fl-quick-use';form.noValidate=true;
 form.setAttribute('aria-label','Utilização rápida de '+row.name);
 const label=document.createElement('label');label.textContent='Uso rápido · hoje (ml)';
 const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.name='quickQuantity';
 input.autocomplete='off';input.placeholder='Ex.: 7,5';input.required=true;
 input.setAttribute('aria-label','Quantidade utilizada (ml) · '+row.name);
 const button=document.createElement('button');button.type='submit';button.className='btn primary';
 button.textContent='Registar utilização';
 const preview=document.createElement('output');preview.className='fl-quick-preview';preview.setAttribute('aria-live','polite');
 const error=document.createElement('p');error.className='fl-quick-error';error.setAttribute('aria-live','polite');
 label.append(input);form.append(label,button,preview,error);
 const operation=quantity=>({id:opId,type:'consumption',quantity,date:today(),note:'Registo rápido de utilização'});
 function updatePreview(){
  error.textContent='';
  const value=input.value.trim();
  if(!value){preview.textContent='Disponível: '+balanceLabel(row);return}
  try{
   const after=ledger.apply(row,operation(value));
   preview.textContent=ml(ledger.balance(row)/1000)+' → '+ml(ledger.balance(after)/1000)+' após confirmação';
  }catch(e){preview.textContent=e.message||'Quantidade inválida.'}
 }
 input.addEventListener('input',updatePreview);updatePreview();
 let confirmed=false;
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(confirmed)return;
  const quantity=input.value.trim();
  if(!quantity){error.textContent='Indica os ml utilizados.';input.focus();return}
  confirmed=true;button.disabled=true;
  try{
   const current=rows().find(item=>item.id===row.id);
   if(!current||JSON.stringify(current)!==snapshot)throw Error('A ficha foi alterada. Atualiza a lista antes de registar a utilização.');
   const after=ledger.apply(current,operation(quantity));
   if(!saveRows(rows().map(item=>item.id===row.id?after:item)))throw Error('Não foi possível guardar. Nenhum consumo foi confirmado.');
   toast('Consumo guardado neste dispositivo: '+ml((ledger.balance(current)-ledger.balance(after))/1000)+
    ' · restam '+ml(ledger.balance(after)/1000)+'. Confirma a sincronização Cloud no indicador da aplicação.');
  }catch(e){
   confirmed=false;button.disabled=false;
   error.textContent=e.message||'Não foi possível registar a utilização.';
  }
 });
 return form;
}
function render(){
 const root=document.getElementById('technicalLibrary');if(!root)return;
 const q=document.getElementById('aeFlSearchV1'),f=document.getElementById('aeFlFamilyV1'),s=document.getElementById('aeFlStatusV1');
 const family=f.value,list=rows(),used=[...new Set(list.map(x=>x.family||FAMILIES[0]))].sort((a,b)=>a.localeCompare(b,'pt-PT'));
 f.replaceChildren(new Option('Todas as famílias',''),...used.map(x=>new Option(x,x)));f.value=family;
 const search=norm(q.value),status=s.value;
 const shown=list.filter(x=>(!family||x.family===family)&&matchesFragranceStatus(x,status)&&
  (!search||norm([x.name,x.originalName,x.supplier,x.description,x.family].join(' ')).includes(search)))
  .sort((a,b)=>document.getElementById('aeFlSort').value==='quantity'?ledger.balance(a)-ledger.balance(b):String(a.name).localeCompare(String(b.name),'pt-PT'));
 const summary=document.getElementById('aeFlSummaryV2');
 if(summary)for(const b of summary.querySelectorAll('button[data-filter]')){
  const value=b.dataset.filter;
  b.querySelector('strong').textContent=String(list.filter(row=>matchesFragranceStatus(row,value)).length);
  b.setAttribute('aria-pressed',String(value===status));
 }
 for(const button of root.querySelectorAll('.fl-view-switch [data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===fragranceView));
 const box=document.getElementById('aeFlCardsV1');box.dataset.view=fragranceView;box.replaceChildren();
 document.getElementById('aeFlCountsV1').textContent=shown.length+' fragrâncias apresentadas · '+list.filter(x=>!x.archived).length+' ativas · '+list.filter(x=>x.archived).length+' arquivadas';
 if(!shown.length){
  const empty=document.createElement('div');empty.className='fl-library-empty';
  const message=document.createElement('p');message.textContent=list.length?'Nenhuma fragrância corresponde aos filtros selecionados.':'Ainda não existem fragrâncias registadas.';
  const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent=list.length?'Limpar filtros':'Criar primeira fragrância';
  reset.onclick=list.length?clearFilters:()=>openEditor(null);
  empty.append(message,reset);box.append(empty);return;
 }
 for(const x of shown){
  const card=document.createElement('article');card.className='ae-fl-card-v1';card.dataset.status=statusOfFragrance(x);
  const main=document.createElement('div');main.className='ae-fl-card-main-v1';
  const photo=document.createElement('button');photo.type='button';photo.className='fl-photo-slot';
  photo.setAttribute('aria-label','Fotografia de '+x.name);photo.onclick=()=>openEditor(x.id,true);
  renderPhoto(photo,x.photoData||x.photoUrl);
  const identity=document.createElement('div');identity.className='fl-card-identity';
  const familyLabel=document.createElement('span');familyLabel.className='fl-family-label';familyLabel.textContent=x.family||'Por classificar';
  const title=document.createElement('h3');title.textContent=x.name;identity.append(familyLabel,title);
  if(x.originalName&&norm(x.originalName)!==norm(x.name)){
   const original=document.createElement('small');original.textContent=x.originalName;identity.append(original);
  }
  if(x.description){const description=document.createElement('p');description.textContent=x.description;identity.append(description)}
  main.append(photo,identity);
  const level=ledger.tank(x),state=statusOfFragrance(x);
  const labels={archived:'Arquivada',pending:'Por registar',empty:'Esgotada',low:'Nível baixo',available:level.percent===null?'Sem capacidade':'Disponível'};
  const balancePanel=document.createElement('div');balancePanel.className='fl-card-balance';
  const statusBadge=document.createElement('span');statusBadge.className='fl-status-label';statusBadge.textContent=labels[state];
  balancePanel.append(statusBadge,makeGauge(x));
  const quick=makeQuickConsumption(x);
  const bottom=document.createElement('div');bottom.className='fl-card-bottom';
  const refill=document.createElement('button');refill.type='button';refill.className='btn fl-card-refill';
  refill.textContent='Adicionar fragrância';refill.disabled=!!x.archived;
  refill.onclick=()=>movement(x.id,'refill');bottom.append(refill);
  const edit=document.createElement('button');edit.type='button';edit.className='btn fl-card-edit';edit.textContent='Abrir ficha';edit.onclick=()=>openEditor(x.id);bottom.append(edit);
  const more=document.createElement('details');more.className='fl-card-more';
  const moreSummary=document.createElement('summary');moreSummary.textContent='Mais opções';
  const secondary=document.createElement('div');secondary.className='fl-card-secondary';
  const history=document.createElement('button');history.type='button';history.className='btn';history.textContent='Histórico';history.onclick=()=>showHistory(x.id);
  const manage=document.createElement('button');manage.type='button';manage.className='btn';manage.textContent='Gerir fragrância';manage.disabled=!!x.archived;
  manage.onclick=()=>movement(x.id,hasBalance(x)&&ledger.balance(x)>0?'consumption':'refill',null,true);
  const detailed=document.createElement('button');detailed.type='button';detailed.className='btn';
  detailed.textContent='Registo com data e observação';
  detailed.disabled=!!x.archived||!hasBalance(x)||ledger.balance(x)<=0;
  detailed.onclick=()=>movement(x.id,'consumption');
  secondary.append(detailed,manage,history);
  if(level.percent===null&&!x.archived){
   const capacity=document.createElement('button');capacity.type='button';capacity.className='btn';
   capacity.textContent='Definir capacidade';capacity.onclick=()=>movement(x.id,'capacity');secondary.append(capacity);
  }
  more.append(moreSummary,secondary);bottom.append(more);
  if(quick)card.append(main,balancePanel,quick,bottom);
  else card.append(main,balancePanel,bottom);
  box.append(card);
 }
}
function renderPhoto(container,source){
 const empty=document.createElement('span');empty.textContent='Sem fotografia';
 container.replaceChildren(empty);
 if(!source)return;
 const image=document.createElement('img');image.alt='';image.className='fl-photo';
 image.addEventListener('error',()=>{if(image.parentNode===container)container.replaceChildren(empty)},{once:true});
 image.src=source;container.replaceChildren(image);
}
function dialog(title,fields,existing,focusPhoto=false){
 const d=document.createElement('dialog');d.className='ae-fl-dialog-v1';d.setAttribute('aria-label',title);
 const form=document.createElement('form');form.method='dialog';
 const h=document.createElement('h2');h.textContent=title;form.append(h);
 const info=document.createElement('p');info.className='muted';info.textContent='Ficha de referência técnica. Não altera a precificação nem movimentos de stock.';form.append(info);
 const grid=document.createElement('div');grid.className='ae-fl-edit-v1';
 const details=document.createElement('details');details.className='fl-optional';
 const summary=document.createElement('summary');summary.textContent='Descrição, fotografia e documentos';details.append(summary);
 const extra=document.createElement('div');extra.className='ae-fl-edit-v1';details.append(extra);
 for(const [key,label,type] of fields){
  const wrapper=document.createElement('label');wrapper.textContent=label;
  let control;
  if(type==='textarea'){control=document.createElement('textarea');control.rows=3}
  else if(type==='family'){control=document.createElement('select');for(const v of FAMILIES){const o=document.createElement('option');o.value=v;o.textContent=FAMILY_EXAMPLES[v]?v+' — '+FAMILY_EXAMPLES[v]:v;control.append(o)}}
  else{control=document.createElement('input');control.type=type==='url'?'url':'text';control.maxLength=type==='url'?600:220}
  control.name=key;control.value=existing?.[key]||(type==='family'?FAMILIES[0]:'');if(key==='name')control.required=true;
  wrapper.append(control);
  if(type==='family'){
   const help=document.createElement('small');
   help.textContent='Escolhe a nota que mais se destaca. Se tiveres dúvidas, deixa «Por classificar».';
   wrapper.append(help);
  }
  (['description','applications','technicalNotes','photoUrl','ifraUrl','sdsUrl','supplier','reference'].includes(key)?extra:grid).append(wrapper);
 }
 if(!existing){
  grid.insertAdjacentHTML('beforeend','<label>Quantidade inicial (ml)<input name="initialQuantity" inputmode="decimal"></label><label>Capacidade de referência (ml)<input name="initialCapacity" inputmode="decimal"></label>');
 }
 const photo=document.createElement('fieldset');photo.className='fl-photo-editor';
 photo.innerHTML='<legend>Fotografia</legend><div class="fl-photo-preview"></div><label>Escolher fotografia<input type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="btn">Remover fotografia</button><p role="status"></p>';
 const file=photo.querySelector('input'),remove=photo.querySelector('button');
 const preview=photo.querySelector('.fl-photo-preview'),status=photo.querySelector('[role=status]');
 const url=form.elements.photoUrl||extra.querySelector('[name=photoUrl]');
 let photoData=existing?.photoData||'',photoRequest=0,processingPhoto=false;
 const refreshPhoto=()=>{
  renderPhoto(preview,photoData||url.value);
  remove.disabled=!photoData&&!url.value;
 };
 url.addEventListener('change',refreshPhoto);
 remove.onclick=()=>{
  photoRequest++;processingPhoto=false;submit.disabled=false;
  photoData='';file.value='';url.value='';status.textContent='';refreshPhoto();
 };
 file.onchange=async()=>{
  const selected=file.files[0];
  if(!selected)return;
  const request=++photoRequest;
  processingPhoto=true;submit.disabled=true;status.textContent='A preparar fotografia…';
  try{
   if(!/^image\/(jpeg|png|webp)$/.test(selected.type)||selected.size>8*1024*1024)throw Error('Escolhe uma imagem JPG, PNG ou WebP até 8 MB.');
   const data=await compressImageFile(selected,480,480,.76);
   if(request!==photoRequest)return;
   photoData=data;status.textContent='Fotografia pronta para guardar.';refreshPhoto();
  }catch(error){
   if(request===photoRequest){file.value='';status.textContent=error.message||'Não foi possível abrir a fotografia.'}
  }finally{
   if(request===photoRequest){processingPhoto=false;submit.disabled=false}
  }
 };
 refreshPhoto();
 const commonNotes=document.createElement('fieldset');
 commonNotes.className='fl-technical-notes';
 const legend=document.createElement('legend');legend.textContent='Notas técnicas comuns';
 const note=document.createElement('p');note.textContent=COMMON_NOTES;
 commonNotes.append(legend,note);
 details.insertBefore(photo,extra);
 const notesDetails=document.createElement('details');notesDetails.className='fl-optional fl-notes-details';
 const notesSummary=document.createElement('summary');notesSummary.textContent='Dosagens de referência';notesDetails.append(notesSummary,commonNotes);
 form.append(grid,details,notesDetails);
 const actions=document.createElement('div');actions.className='ae-fl-dialog-actions-v1';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>d.close());
 const submit=document.createElement('button');submit.type='submit';submit.className='btn primary';submit.textContent='Guardar ficha';actions.append(cancel,submit);
 if(existing){const history=document.createElement('button');history.type='button';history.className='btn';history.textContent='Histórico e ajustes';history.onclick=()=>{d.close();showHistory(existing.id)};actions.prepend(history);const archive=document.createElement('button');archive.type='button';archive.className='btn';archive.textContent=existing.archived?'Reativar':'Arquivar';archive.addEventListener('click',()=>{if(JSON.stringify(rows().find(x=>x.id===existing.id))!==JSON.stringify(existing)){toast('A ficha mudou. Volta a abrir.');return}const next=rows().map(x=>x.id===existing.id?{...x,archived:!x.archived,updatedAt:time()}:x);if(saveRows(next))d.close()});actions.prepend(archive)}
 form.append(actions);d.append(form);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});
 form.addEventListener('submit',ev=>{
  ev.preventDefault();
  if(processingPhoto||!form.reportValidity())return;
  const x=Object.fromEntries(new FormData(form).entries());
  x.name=String(x.name||'').trim();x.originalName=String(x.originalName||'').trim();
  if(!x.name)return;
  for(const key of ['photoUrl','ifraUrl','sdsUrl'])if(x[key]&&!/^https?:\/\//i.test(x[key])){toast('Usa um endereço https:// ou http:// no campo '+key);return}
  if(duplicate(rows(),x,existing?.id)){toast('Já existe uma fragrância com essa identificação.');return}
  if(existing&&JSON.stringify(rows().find(v=>v.id===existing.id))!==JSON.stringify(existing)){toast('Esta ficha mudou. Fecha e volta a abrir antes de guardar.');return}
  const {initialQuantity='',initialCapacity='',...metadata}=x;
  let updated=existing?{...existing,...x,updatedAt:time()}:{...metadata,id:uid(),source:'Registo manual',movements:[],capacityUnits:null,archived:false,createdAt:time(),updatedAt:time()};
  try{if(!existing)updated=initialize(updated,initialQuantity,initialCapacity)}
  catch(error){toast(error.message);return}
  updated.photoData=photoData;
  if(saveRows(existing?rows().map(v=>v.id===existing.id?updated:v):[...rows(),updated]))d.close();
 });
 if(focusPhoto)details.open=true;
 d.showModal();
 if(focusPhoto)file.focus();
}
const FIELDS=[['name','Nome utilizado no atelier','text'],['originalName','Nome comercial / original','text'],
 ['family','Família olfativa','family'],['description','Descrição olfativa','textarea'],
 ['applications','Aplicações / recomendações confirmadas','textarea'],['supplier','Fornecedor','text'],
 ['reference','Referência do fabricante','text'],['technicalNotes','Notas técnicas da fragrância','textarea'],
 ['photoUrl','Ligação à fotografia (opcional)','url'],['ifraUrl','Ligação ao certificado IFRA (opcional)','url'],
 ['sdsUrl','Ligação à ficha de segurança (opcional)','url']];
function openEditor(id,focusPhoto=false){dialog(id?'Editar ficha de fragrância':'Nova fragrância',FIELDS,id?rows().find(x=>x.id===id):null,focusPhoto)}
function importReceipt(){
 if(!confirm('Importar as 15 fragrâncias do recibo 67827 para a Biblioteca de Fragrâncias? Não serão criados artigos, custos ou movimentos de stock.'))return;
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
function batchSetup(){
 const candidates=rows().filter(row=>!row.archived&&(!hasBalance(row)||!row.capacityUnits));
 const d=document.createElement('dialog');
 d.className='ae-fl-dialog-v1 fl-batch-dialog';
 d.setAttribute('aria-label','Preencher quantidades em conjunto');
 d.innerHTML='<form><h2>Preencher quantidades em conjunto</h2><p>Preenche apenas os valores que conheces. Introduz 0 para marcar uma fragrância como esgotada.</p><div class="fl-batch-rows"></div><p role="alert"></p><div class="fl-actions"><button type="button" class="btn">Fechar</button><button class="btn primary">Guardar quantidades</button></div></form>';
 const form=d.querySelector('form'),list=d.querySelector('.fl-batch-rows');
 for(const [index,row] of candidates.entries()){
  const line=document.createElement('div');line.className='fl-batch-row';
  line.innerHTML='<strong>'+text(row.name)+'</strong><label>Disponível (ml)<input name="quantity'+index+'" inputmode="decimal"></label><label>Capacidade (ml)<input name="capacity'+index+'" inputmode="decimal"></label>';
  for(const [name,value] of [['quantity',hasBalance(row)?ledger.balance(row)/1000:null],['capacity',row.capacityUnits?row.capacityUnits/1000:null]]){
   if(value!==null){const input=line.querySelector('[name="'+name+index+'"]');input.value=value;input.disabled=true}
  }
  list.append(line);
 }
 if(!candidates.length){list.textContent='Todas as fichas ativas estão preenchidas.';form.querySelector('.primary').disabled=true}
 form.querySelector('[type=button]').onclick=()=>d.close();
 form.onsubmit=event=>{
  event.preventDefault();
  const updates=new Map();
  try{
   for(const [index,row] of candidates.entries()){
    const quantity=form.elements['quantity'+index],capacity=form.elements['capacity'+index];
    const available=quantity.disabled?'':quantity.value.trim(),reference=capacity.disabled?'':capacity.value.trim();
    if(!available&&!reference)continue;
    if(JSON.stringify(rows().find(current=>current.id===row.id))!==JSON.stringify(row))throw Error(row.name+' mudou. Reabre a tabela para atualizar os valores.');
    try{updates.set(row.id,initialize(row,available,reference))}
    catch(error){throw Error(row.name+' · '+error.message)}
   }
   if(!updates.size){d.close();return}
   if(saveRows(rows().map(row=>updates.get(row.id)||row)))d.close();
   else throw Error('Não foi possível guardar as quantidades.');
  }catch(error){form.querySelector('[role=alert]').textContent=error.message}
 };
 d.onclose=()=>d.remove();
 document.body.append(d);d.showModal();
}
const PDF_AROMA_CATEGORIES=[
 {key:'Cítrica',title:'Cítricas',subtitle:'Frescas e luminosas'},
 {key:'Frutada',title:'Frutadas',subtitle:'Notas vivas e frutadas'},
 {key:'Floral',title:'Florais',subtitle:'Flores e delicadeza'},
 {key:'Aromática',title:'Aromáticas',subtitle:'Ervas e frescura'},
 {key:'Gourmand',title:'Doces & gourmand',subtitle:'Aromas doces e reconfortantes'},
 {key:'Especiada',title:'Especiadas',subtitle:'Especiarias e intensidade'},
 {key:'Amadeirada',title:'Amadeiradas',subtitle:'Madeiras e profundidade'},
 {key:'Oriental',title:'Orientais',subtitle:'Âmbar, incenso e resinas'},
 {key:'Outras',title:'Outras fragrâncias',subtitle:'Mais aromas para descobrir'}
];
const PDF_CUSTOMER_LAYOUT={width:1240,height:1754,margin:76,columnWidth:506,columnGap:76,top:292,bottom:1588,sectionHeight:131};
function customerPdfGroups(available){
 const grouped=new Map(PDF_AROMA_CATEGORIES.map(category=>[category.key,[]]));
 for(const row of available){
  const family=grouped.has(row.family)&&row.family!=='Outras'?row.family:'Outras';
  grouped.get(family).push(row);
 }
 return PDF_AROMA_CATEGORIES.map(category=>({...category,entries:grouped.get(category.key)
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-PT'))})).filter(group=>group.entries.length);
}
function customerPdfLines(ctx,value,width,maxLines){
 const normalized=String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 if(!normalized)return [];
 const wrapped=wrapCanvasText(ctx,normalized,width);
 if(wrapped.length<=maxLines)return wrapped;
 const displayed=wrapped.slice(0,maxLines);
 let finalLine=displayed[maxLines-1].replace(/[\s,;]+$/,'');
 while(finalLine.length&&ctx.measureText(finalLine+'…').width>width)finalLine=finalLine.slice(0,-1);
 displayed[maxLines-1]=finalLine+'…';
 return displayed;
}
function customerPdfPrepareEntry(ctx,row){
 ctx.font='34px Georgia, serif';
 const names=customerPdfLines(ctx,row.name,PDF_CUSTOMER_LAYOUT.columnWidth,2);
 ctx.font='19px Arial, sans-serif';
 const descriptions=customerPdfLines(ctx,row.description,PDF_CUSTOMER_LAYOUT.columnWidth,2);
 const height=names.length*43+(descriptions.length?descriptions.length*30+20:0)+35;
 return {kind:'entry',names,descriptions,height};
}
function customerPdfPaginate(groups){
 const measure=document.createElement('canvas').getContext('2d');
 const pages=[{columns:[[],[]]}];
 let column=0,y=PDF_CUSTOMER_LAYOUT.top;
 function nextColumn(){
  if(column===0){column=1}else{column=0;pages.push({columns:[[],[]]})}
  y=PDF_CUSTOMER_LAYOUT.top;
 }
 function push(item){pages[pages.length-1].columns[column].push({...item,y})}
 function pushSection(group,index,continued){
  push({kind:'section',group,index,continued});y+=PDF_CUSTOMER_LAYOUT.sectionHeight;
 }
 for(const [index,group] of groups.entries()){
  for(const [entryIndex,row] of group.entries.entries()){
   const item=customerPdfPrepareEntry(measure,row);
   if(entryIndex===0){
    if(y+PDF_CUSTOMER_LAYOUT.sectionHeight+item.height>PDF_CUSTOMER_LAYOUT.bottom)nextColumn();
    pushSection(group,index,false);
   }else if(y+item.height>PDF_CUSTOMER_LAYOUT.bottom){
    nextColumn();pushSection(group,index,true);
   }
   // A continuation heading and at least one complete entry always stay together.
   push(item);y+=item.height;
  }
  y+=24;
 }
 customerPdfBalanceLastPage(pages);
 return pages;
}
function customerPdfBalanceLastPage(pages){
 const last=pages[pages.length-1];
 if(!last||!last.columns[1].length)return;
 const chunks=[];
 for(const item of [...last.columns[0],...last.columns[1]]){
  if(item.kind==='section'){
   if(chunks[chunks.length-1]?.group.key!==item.group.key)chunks.push({group:item.group,index:item.index,continued:item.continued,entries:[]});
  }else if(chunks.length)chunks[chunks.length-1].entries.push(item);
 }
 if(chunks.length<2)return;
 const heights=chunks.map(chunk=>PDF_CUSTOMER_LAYOUT.sectionHeight+chunk.entries.reduce((sum,item)=>sum+item.height,0)+24);
 const available=PDF_CUSTOMER_LAYOUT.bottom-PDF_CUSTOMER_LAYOUT.top;
 let best=null;
 for(let i=1;i<chunks.length;i++){
  const left=heights.slice(0,i).reduce((a,b)=>a+b,0);
  const right=heights.slice(i).reduce((a,b)=>a+b,0);
  if(left>available||right>available)continue;
  const difference=Math.abs(left-right);
  if(!best||difference<best.difference)best={split:i,difference};
 }
 if(!best)return;
 last.columns=[[],[]];
 for(const column of [0,1]){
  const selected=column===0?chunks.slice(0,best.split):chunks.slice(best.split);
  let y=PDF_CUSTOMER_LAYOUT.top;
  for(const chunk of selected){
   last.columns[column].push({kind:'section',group:chunk.group,index:chunk.index,continued:chunk.continued,y});
   y+=PDF_CUSTOMER_LAYOUT.sectionHeight;
   for(const entry of chunk.entries){last.columns[column].push({...entry,y});y+=entry.height}
   y+=24;
  }
 }
}
const PDF_KRAFT_PALETTE={
 paper:'#e6d1ad',paperShade:'#dbc29a',panel:'#d3b78b',ink:'#342719',
 accent:'#795638',muted:'#68533e',rule:'#bea27e'
};
function drawCustomerPdfKraft(ctx){
 const {width,height}=PDF_CUSTOMER_LAYOUT;
 ctx.fillStyle=PDF_KRAFT_PALETTE.paper;
 ctx.fillRect(0,0,width,height);
 // Subtle deterministic paper fibres, with no photographs or external assets.
 ctx.save();
 ctx.strokeStyle='rgba(104,73,40,0.065)';
 ctx.lineWidth=1;
 for(let i=0;i<560;i++){
  const x=(i*271+43)%width,y=(i*619+113)%height;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x+5+i%9,y+(i%3)-1);ctx.stroke();
 }
 ctx.restore();
}
function drawCustomerPdfLogo(ctx,logo,x,y,maxWidth,maxHeight){
 if(logo){
  const scale=Math.min(maxWidth/logo.naturalWidth,maxHeight/logo.naturalHeight);
  const width=logo.naturalWidth*scale,height=logo.naturalHeight*scale;
  ctx.drawImage(logo,x,y+(maxHeight-height)/2,width,height);
 }else{
  ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='bold 38px Georgia, serif';
  ctx.fillText('ArtEssencia',x,y+maxHeight*.68,maxWidth);
 }
}
function drawCustomerPdfFooter(ctx,contacts,pageNumber,totalPages){
 ctx.fillStyle=PDF_KRAFT_PALETTE.rule;ctx.fillRect(76,1647,1088,2);
 ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.textAlign='left';ctx.font='18px Arial, sans-serif';
 ctx.fillText('ARTESSENCIA  ·  CATÁLOGO DE FRAGRÂNCIAS',76,1691,520);
 ctx.textAlign='right';ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='19px Arial, sans-serif';
 for(const [index,contact] of contacts.slice(0,2).entries())ctx.fillText(contact,1164,1678+index*27,485);
 ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='17px Arial, sans-serif';
 ctx.fillText(String(pageNumber).padStart(2,'0')+' / '+String(totalPages).padStart(2,'0'),1164,1730);
 ctx.textAlign='left';
}
function drawCustomerPdfCover(ctx,logo,groups,pages,contacts,totalPages){
 const {width}=PDF_CUSTOMER_LAYOUT;
 drawCustomerPdfKraft(ctx);
 drawCustomerPdfLogo(ctx,logo,76,62,277,140);
 ctx.fillStyle=PDF_KRAFT_PALETTE.rule;ctx.fillRect(76,240,1088,2);
 ctx.strokeStyle='rgba(112,78,41,0.17)';ctx.lineWidth=2;
 for(const radius of [225,322,419]){
  ctx.beginPath();ctx.arc(1256,570,radius,0,Math.PI*2);ctx.stroke();
 }
 ctx.fillStyle=PDF_KRAFT_PALETTE.accent;ctx.font='bold 22px Arial, sans-serif';
 ctx.fillText('CATÁLOGO DE FRAGRÂNCIAS',76,358);
 ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='102px Georgia, serif';
 ctx.fillText('Escolhe',70,495);ctx.fillText('o teu aroma.',70,611);
 ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='26px Arial, sans-serif';
 ctx.fillText('Uma seleção de aromas para dar personalidade',76,703);
 ctx.fillText('às tuas peças favoritas.',76,742);
 ctx.fillStyle=PDF_KRAFT_PALETTE.accent;ctx.fillRect(76,847,65,4);
 ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='37px Georgia, serif';
 ctx.fillText('Explora por famílias',76,937);
 ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='21px Arial, sans-serif';
 ctx.fillText('Encontra as fragrâncias que mais combinam contigo.',76,979);
 const firstPages=new Map();
 for(const [pageIndex,page] of pages.entries())for(const column of page.columns)for(const item of column){
  if(item.kind==='section'&&!firstPages.has(item.group.key))firstPages.set(item.group.key,pageIndex+2);
 }
 const lines=Math.ceil(groups.length/2);
 groups.forEach((group,index)=>{
  const column=Math.floor(index/lines),line=index%lines;
  const x=76+column*565,y=1088+line*72;
  ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='23px Arial, sans-serif';
  ctx.fillText(group.title,x,y,423);
  ctx.fillStyle=PDF_KRAFT_PALETTE.accent;ctx.font='bold 20px Arial, sans-serif';
  ctx.fillText(String(firstPages.get(group.key)||2).padStart(2,'0'),x+478,y);
  ctx.fillStyle=PDF_KRAFT_PALETTE.rule;ctx.fillRect(x,y+14,505,1);
 });
 ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='22px Arial, sans-serif';
 ctx.fillText('Escolhe as tuas favoritas e indica os nomes quando fizeres o pedido.',76,1535,1088);
 drawCustomerPdfFooter(ctx,contacts,1,totalPages);
}
function drawCustomerPdfPage(ctx,logo,page,contacts,pageNumber,totalPages){
 const {width,margin,columnWidth,columnGap}=PDF_CUSTOMER_LAYOUT;
 drawCustomerPdfKraft(ctx);
 drawCustomerPdfLogo(ctx,logo,margin,43,185,100);
 ctx.textAlign='right';ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='20px Arial, sans-serif';
 ctx.fillText('CATÁLOGO DE FRAGRÂNCIAS',width-margin,95);
 ctx.textAlign='left';ctx.fillStyle=PDF_KRAFT_PALETTE.rule;ctx.fillRect(margin,160,width-2*margin,2);
 ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='46px Georgia, serif';
 ctx.fillText('Descobre as fragrâncias',margin,238);
 // Quiet central rule signals the printed-magazine columns.
 ctx.fillStyle='rgba(113,79,46,0.16)';ctx.fillRect(width/2,292,1,1294);
 page.columns.forEach((items,column)=>{
  const x=margin+column*(columnWidth+columnGap);
  for(const item of items){
   if(item.kind==='section'){
    ctx.fillStyle=PDF_KRAFT_PALETTE.panel;
    ctx.fillRect(x,item.y+7,columnWidth,78);
    ctx.fillStyle=PDF_KRAFT_PALETTE.accent;ctx.font='bold 19px Arial, sans-serif';
    ctx.fillText(String(item.index+1).padStart(2,'0'),x+16,item.y+43);
    ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='bold 22px Arial, sans-serif';
    const family=item.group.title.toLocaleUpperCase('pt-PT')+(item.continued?' · CONT.':'');
    ctx.fillText(family,x+65,item.y+43,columnWidth-78);
    ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='italic 20px Georgia, serif';
    ctx.fillText(item.group.subtitle,x+4,item.y+113,columnWidth-8);
   }else{
    // Names use a larger, regular-weight serif; families use smaller bold sans-serif.
    ctx.fillStyle=PDF_KRAFT_PALETTE.ink;ctx.font='34px Georgia, serif';
    item.names.forEach((line,index)=>ctx.fillText(line,x,item.y+35+index*43,columnWidth));
    if(item.descriptions.length){
     ctx.fillStyle=PDF_KRAFT_PALETTE.muted;ctx.font='19px Arial, sans-serif';
     const start=item.y+item.names.length*43+28;
     item.descriptions.forEach((line,index)=>ctx.fillText(line,x,start+index*30,columnWidth));
    }
    ctx.fillStyle=PDF_KRAFT_PALETTE.rule;ctx.fillRect(x,item.y+item.height-11,columnWidth,1);
   }
  }
 });
 drawCustomerPdfFooter(ctx,contacts,pageNumber,totalPages);
}
async function buildCustomerPdf(available,contacts){
 const groups=customerPdfGroups(available);
 const layout=customerPdfPaginate(groups);
 const {width,height}=PDF_CUSTOMER_LAYOUT;
 const totalPages=layout.length+1;
 let logo=null;
 try{logo=await loadCanvasImage('brand-artessencia-transparente.svg')}catch{}
 const pages=[];
 for(let index=-1;index<layout.length;index++){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(index===-1)drawCustomerPdfCover(ctx,logo,groups,layout,contacts,totalPages);
  else drawCustomerPdfPage(ctx,logo,layout[index],contacts,index+2,totalPages);
  const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível gerar o catálogo.')),'image/jpeg',.8));
  pages.push(jpeg);canvas.width=0;canvas.height=0;
 }
 return jpegBlobsToPDF(pages,width,height);
}
function downloadCustomerPdf(){
 const available=rows().filter(row=>!row.archived&&ledger.balance(row)>0);
 if(!available.length){toast('Regista uma quantidade positiva numa fragrância ativa para gerar o PDF.');return}
 const phone=String(db.settings.businessPhone||'').trim();
 const email=String(db.settings.businessEmail||'').trim()||'geral@artessenciatlier.pt';
 const contacts=[email,phone].filter(Boolean);
 return downloadPdfBlob(()=>buildCustomerPdf(available,contacts),'ArtEssencia_Catalogo_Fragrancias.pdf');
}
function exportCsv(){
 const headers=['Disponível ml','Capacidade ml','Movimentos JSON','Nome','Nome original','Família','Descrição','Aplicações','Fornecedor','Referência','Notas técnicas','Origem','Estado','IFRA','FDS'];
 const csv=[headers,...rows().map(x=>[hasBalance(x)?ledger.balance(x)/1000:'',x.capacityUnits?x.capacityUnits/1000:'',JSON.stringify(x.movements||[]),x.name,x.originalName,x.family,x.description,x.applications,x.supplier,x.reference,[COMMON_NOTES,x.technicalNotes].filter(Boolean).join('\n'),x.source,x.archived?'Arquivada':'Ativa',x.ifraUrl,x.sdsUrl])]
  .map(a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ArtEssencia_Biblioteca_Fragrancias.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function movement(id,type,host=null,panel=false){
 const existing=rows().find(x=>x.id===id), snapshot=JSON.stringify(existing),opId=uid();
 const names={consumption:'Registar utilização',refill:'Adicionar fragrância',correction:'Correção manual',capacity:'Capacidade de referência'};
 const d=host||document.createElement('dialog');d.className='ae-fl-dialog-v1 fl-movement-dialog';d.setAttribute('aria-label',names[type]);
 d.innerHTML='<form><h2>'+names[type]+'</h2><p>'+text(existing.name)+' · '+text(balanceLabel(existing))+'</p><label>'+ (type==='correction'?'Novo saldo':type==='capacity'?'Capacidade de referência':'Quantidade')+' (ml)<input name="quantity" inputmode="decimal" required></label><label>Data<input name="date" type="date" required></label><label>Observação'+(['correction','capacity'].includes(type)?' / justificação obrigatória':' opcional')+'<textarea name="note"></textarea></label><p role="alert"></p><div class="fl-actions"><button type="button">Cancelar</button><button type="submit" class="btn primary">Confirmar</button></div></form>';
 if(panel){
  d.classList.add('fl-work-panel');
  const actions=document.createElement('div');actions.className='fl-actions';
  for(const kind of ['consumption','refill']){
   const button=document.createElement('button');button.type='button';button.className='btn';
   button.textContent=names[kind];button.setAttribute('aria-pressed',String(kind===type));
   button.onclick=()=>movement(id,kind,d,true);actions.append(button);
  }
  d.prepend(makeGauge(existing),actions);
  const recent=document.createElement('details');
  recent.innerHTML='<summary>Últimos movimentos</summary><ol>'+[...(existing.movements||[])].reverse().slice(0,5).map(move=>'<li>'+text(move.date)+' · '+text(names[move.type])+' · '+ml(move.after/1000)+'</li>').join('')+'</ol>';
  if(!existing.movements?.length)recent.querySelector('ol').replaceWith(document.createTextNode('Ainda sem movimentos.'));
  d.append(recent);
 }
 const form=d.querySelector('form');form.elements.date.value=new Date().toLocaleDateString('sv-SE');
 const preview=document.createElement('output');preview.className='fl-movement-preview';preview.setAttribute('aria-live','polite');
 const hint=document.createElement('p');hint.className='muted';hint.textContent=type==='capacity'?'A referência define o tanque. Não altera os mililitros disponíveis.':'O saldo só muda depois de confirmares.';
 form.querySelector('[role=alert]').before(preview,hint);
 function updatePreview(){
  const value=form.elements.quantity.value;
  if(!value.trim()){preview.textContent=balanceLabel(existing);return}
  try{
   const next=ledger.apply(existing,{id:opId,type,quantity:value,date:form.elements.date.value,note:form.elements.note.value||'Pré-visualização'});
   if(type==='capacity'){const level=ledger.tank(next);preview.textContent=level.percent===null?'Capacidade por definir':ml(level.available)+' disponíveis · referência '+ml(level.capacity)+' · '+level.percent.toLocaleString('pt-PT',{maximumFractionDigits:1})+'%'}
   else preview.textContent=ml(ledger.balance(existing)/1000)+' → '+ml(ledger.balance(next)/1000)+' após confirmação';
  }catch(error){preview.textContent=error.message}
 }
 form.addEventListener('input',updatePreview);updatePreview();
 form.querySelector('[type=button]').onclick=()=>d.close();
 let done=false;form.onsubmit=e=>{e.preventDefault();if(done)return;try{
 const current=rows().find(x=>x.id===id);if(JSON.stringify(current)!==snapshot)throw Error('A ficha mudou. Fecha e volta a abrir para usar o saldo atualizado.');
 const next=ledger.apply(current,{id:opId,type,quantity:form.elements.quantity.value,date:form.elements.date.value,note:form.elements.note.value});
 if(saveRows(rows().map(x=>x.id===id?next:x))){done=true;if(panel)movement(id,type,d,true);else d.close()}else throw Error('Não foi possível guardar. A operação não foi confirmada.');
 }catch(error){form.querySelector('[role=alert]').textContent=error.message}};
 if(!host){d.onclose=()=>d.remove();document.body.append(d);d.showModal()}
}
function showHistory(id){
 const row=rows().find(item=>item.id===id);
 if(!row){toast('Esta fragrância deixou de estar disponível. Atualiza a biblioteca.');return}
 const dialog=document.createElement('dialog');dialog.className='ae-fl-dialog-v1 fl-history-dialog';
 dialog.setAttribute('aria-label','Histórico de '+row.name);
 const heading=document.createElement('header');heading.className='fl-history-heading';
 const title=document.createElement('h2');title.textContent='Histórico · '+row.name;
 const subtitle=document.createElement('p');subtitle.className='muted';
 subtitle.textContent='Movimentos manuais e totais por período. As correções não contam como consumo.';
 const balance=document.createElement('span');balance.className='fl-history-current';
 balance.textContent='Saldo atual · '+balanceLabel(row);
 heading.append(title,subtitle,balance);
 const controls=document.createElement('div');controls.className='fl-history-controls';
 const field=(label,name,element)=>{
  const wrapper=document.createElement('label');wrapper.textContent=label;
  element.name=name;wrapper.append(element);return wrapper;
 };
 const period=document.createElement('select');
 for(const [value,label] of [
  ['month','Este mês'],['last30','Últimos 30 dias'],['last90','Últimos 90 dias'],
  ['year','Este ano'],['all','Todo o histórico'],['custom','Escolher datas']
 ])period.add(new Option(label,value));
 controls.append(field('Período','period',period));
 const type=document.createElement('select');
 for(const [value,label] of [
  ['all','Todos os movimentos'],['consumption','Consumos'],['refill','Reposições'],
  ['correction','Correções'],['capacity','Capacidade']
 ])type.add(new Option(label,value));
 controls.append(field('Mostrar','type',type));
 const dates=document.createElement('div');dates.className='fl-history-dates';dates.hidden=true;
 const from=document.createElement('input');from.type='date';
 const until=document.createElement('input');until.type='date';
 const currentDay=today();from.value=currentDay.slice(0,7)+'-01';until.value=currentDay;
 dates.append(field('De','from',from),field('Até','until',until));
 controls.append(dates);
 const stats=document.createElement('div');stats.className='fl-history-stats';
 for(const [key,label] of [['consumption','Utilizado'],['refill','Reposto'],['moves','Movimentos'],['adjust','Ajustes']]){
  const card=document.createElement('div');card.className='fl-history-stat';card.dataset.stat=key;
  const small=document.createElement('span');small.textContent=label;
  const value=document.createElement('strong');value.textContent='—';
  card.append(small,value);stats.append(card);
 }
 const result=document.createElement('p');result.className='fl-history-result';result.setAttribute('aria-live','polite');
 const movements=document.createElement('ol');movements.className='fl-history-list';
 const more=document.createElement('button');more.className='btn fl-history-more';more.type='button';
 more.textContent='Ver mais movimentos';more.hidden=true;
 const actions=document.createElement('div');actions.className='ae-fl-dialog-actions-v1 fl-history-actions';
 for(const [label,kind] of [['Corrigir saldo','correction'],['Ajustar capacidade','capacity']]){
  const button=document.createElement('button');button.className='btn';button.type='button';
  button.textContent=label;button.disabled=!!row.archived;
  button.addEventListener('click',()=>{dialog.close();movement(id,kind)});
  actions.append(button);
 }
 const close=document.createElement('button');close.className='btn primary';close.type='button';
 close.textContent='Fechar';close.addEventListener('click',()=>dialog.close());actions.append(close);
 dialog.append(heading,controls,stats,result,movements,more,actions);
 let limit=10;
 const sorted=[...(row.movements||[])].map((move,index)=>({move,index})).sort((a,b)=>
  String(b.move.date||'').localeCompare(String(a.move.date||''))||b.index-a.index);
 const names={consumption:'Consumo',refill:'Reposição',correction:'Correção de saldo',capacity:'Capacidade de referência'};
 function range(){
  const choice=period.value;
  if(choice==='all')return {from:'',until:''};
  if(choice==='custom')return {from:from.value,until:until.value};
  if(choice==='month')return {from:currentDay.slice(0,7)+'-01',until:currentDay};
  if(choice==='year')return {from:currentDay.slice(0,4)+'-01-01',until:currentDay};
  const days=choice==='last90'?90:30;
  const first=new Date();first.setDate(first.getDate()-(days-1));
  return {from:first.toLocaleDateString('sv-SE'),until:currentDay};
 }
 function draw(){
  dates.hidden=period.value!=='custom';
  const bounds=range(),invalid=!bounds.from&&period.value==='custom'||!bounds.until&&period.value==='custom'||bounds.from>bounds.until;
  const filtered=invalid?[]:sorted.filter(({move})=>(!bounds.from||move.date>=bounds.from)&&(!bounds.until||move.date<=bounds.until));
  const total=(kind)=>filtered.reduce((sum,{move})=>sum+(move.type===kind?Number(move.delta)||0:0),0);
  stats.querySelector('[data-stat=consumption] strong').textContent=ml(Math.abs(total('consumption'))/1000);
  stats.querySelector('[data-stat=refill] strong').textContent=ml(total('refill')/1000);
  stats.querySelector('[data-stat=moves] strong').textContent=String(filtered.length);
  stats.querySelector('[data-stat=adjust] strong').textContent=String(filtered.filter(({move})=>move.type==='correction'||move.type==='capacity').length);
  const visible=filtered.filter(({move})=>type.value==='all'||move.type===type.value);
  const shown=visible.slice(0,limit);
  movements.replaceChildren();
  for(const {move} of shown){
   const item=document.createElement('li');item.className='fl-history-item';item.dataset.type=move.type;
   const top=document.createElement('div');top.className='fl-history-line';
   const name=document.createElement('strong');name.textContent=names[move.type]||'Movimento';
   const date=document.createElement('time');date.dateTime=move.date;
   date.textContent=String(move.date||'Sem data');
   const delta=document.createElement('span');delta.className='fl-history-delta';
   if(move.type==='capacity')delta.textContent='Referência: '+ml((Number(move.capacityAfter)||0)/1000);
   else delta.textContent=(move.delta>0?'+':move.delta<0?'−':'')+ml(Math.abs(Number(move.delta)||0)/1000);
   top.append(name,date,delta);item.append(top);
   if(move.type!=='capacity'){
    const detail=document.createElement('div');detail.className='fl-history-flow';
    detail.textContent='Saldo: '+ml((Number(move.before)||0)/1000)+' → '+ml((Number(move.after)||0)/1000);
    item.append(detail);
   }
   if(move.note){
    const note=document.createElement('p');note.className='fl-history-note';note.textContent=String(move.note);
    item.append(note);
   }
   movements.append(item);
  }
  if(!shown.length){
   const empty=document.createElement('li');empty.className='fl-history-empty';
   empty.textContent=invalid?'A data inicial não pode ser posterior à final. Verifica o período.':
    (row.movements||[]).length?'Sem movimentos neste período ou filtro.':'Ainda não existem movimentos para esta fragrância.';
   movements.append(empty);
  }
  result.textContent=invalid?'Período inválido':visible.length+
   ' movimentos encontrados · '+shown.length+' apresentados';
  more.hidden=visible.length<=limit;more.textContent='Ver mais movimentos ('+(visible.length-limit)+' restantes)';
 }
 period.addEventListener('change',()=>{limit=10;draw()});
 type.addEventListener('change',()=>{limit=10;draw()});
 from.addEventListener('change',()=>{limit=10;draw()});
 until.addEventListener('change',()=>{limit=10;draw()});
 more.addEventListener('click',()=>{limit+=10;draw()});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);draw();dialog.showModal();
}

/* Reporting is read-only: all totals are derived from immutable manual ledger movements. */
function fragranceReportBounds(choice,from,until,reference=today()){
 const month=Number(reference.slice(5,7));
 if(choice==='all')return {from:'',until:'',invalid:false};
 if(choice==='custom'){
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&
   !Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  return {from,until,invalid:!validDate(from)||!validDate(until)||from>until};
 }
 const prefix=reference.slice(0,4);
 const start=choice==='quarter'?String(1+3*Math.floor((month-1)/3)).padStart(2,'0'):
  choice==='semester'?(month<=6?'01':'07'):choice==='year'?'01':reference.slice(5,7);
 const startDay=prefix+'-'+start+'-01';
 return {from:startDay,until:reference,invalid:!['month','quarter','semester','year'].includes(choice)};
}
function fragranceGlobalUsage(data,bounds){
 const result={rows:[],families:[],usedUnits:0,refillUnits:0,adjustments:0,movements:0,fragrances:0};
 if(bounds.invalid)return result;
 const familyMap=new Map();
 for(const row of data){
  let usedUnits=0,refillUnits=0,adjustments=0,movements=0;
  for(const move of row.movements||[]){
   if(typeof move.date!=='string'||(bounds.from&&move.date<bounds.from)||(bounds.until&&move.date>bounds.until))continue;
   movements++;
   const units=Number(move.delta)||0;
   if(move.type==='consumption'&&units<0)usedUnits+=-units;
   else if(move.type==='refill'&&units>0)refillUnits+=units;
   else if(move.type==='correction'||move.type==='capacity')adjustments++;
  }
  if(!movements)continue;
  const family=row.family||'Por classificar';
  const entry={id:row.id,name:row.name,family,archived:!!row.archived,usedUnits,refillUnits,adjustments,movements};
  result.rows.push(entry);
  result.usedUnits+=usedUnits;result.refillUnits+=refillUnits;
  result.adjustments+=adjustments;result.movements+=movements;
  if(usedUnits>0)result.fragrances++;
  const group=familyMap.get(family)||{name:family,usedUnits:0,refillUnits:0,fragrances:0};
  group.usedUnits+=usedUnits;group.refillUnits+=refillUnits;
  if(usedUnits>0)group.fragrances++;
  familyMap.set(family,group);
 }
 result.rows.sort((a,b)=>b.usedUnits-a.usedUnits||b.refillUnits-a.refillUnits||a.name.localeCompare(b.name,'pt-PT'));
 result.families=[...familyMap.values()].filter(item=>item.usedUnits>0||item.refillUnits>0)
  .sort((a,b)=>b.usedUnits-a.usedUnits||a.name.localeCompare(b.name,'pt-PT'));
 return result;
}
function exportFragranceUsageCsv(report,periodLabel){
 const safeCell=value=>{
  let valueText=String(value??'');
  if(/^[\s]*[=+@-]/.test(valueText))valueText="'"+valueText;
  return '"'+valueText.replace(/"/g,'""')+'"';
 };
 const lines=[
  ['Relatório global de fragrâncias',periodLabel],
  ['Fragrância','Família','Utilizado (ml)','Reposto (ml)','Ajustes','Movimentos','Estado'],
  ...report.rows.map(row=>[row.name,row.family,(row.usedUnits/1000).toFixed(3).replace('.',','),
   (row.refillUnits/1000).toFixed(3).replace('.',','),row.adjustments,row.movements,row.archived?'Arquivada':'Ativa'])
 ];
 const csv=lines.map(row=>row.map(safeCell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const download=document.createElement('a');download.href=url;download.download='ArtEssencia_Relatorio_Global_Fragrancias.csv';
 download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function showFragranceUsageReport(){
 const d=document.createElement('dialog');d.className='ae-fl-dialog-v1 fl-report-dialog';
 d.setAttribute('aria-label','Relatório global de consumos');
 const h=document.createElement('header');h.className='fl-report-heading';
 const title=document.createElement('h2');title.textContent='Relatório de consumos';
 const subtitle=document.createElement('p');subtitle.className='muted';
 subtitle.textContent='Comparação de todas as fragrâncias pelos movimentos manuais, incluindo as arquivadas. As correções não contam como consumo.';
 h.append(title,subtitle);
 const controls=document.createElement('div');controls.className='fl-report-controls';
 const makeLabel=(caption,control)=>{
  const label=document.createElement('label');label.textContent=caption;label.append(control);return label;
 };
 const period=document.createElement('select');period.name='period';
 for(const [value,label] of [['month','Este mês'],['quarter','Este trimestre'],['semester','Este semestre'],
  ['year','Este ano'],['all','Todo o histórico'],['custom','Escolher datas']]){
  period.add(new Option(label,value));
 }
 controls.append(makeLabel('Período',period));
 const dateControls=document.createElement('div');dateControls.className='fl-report-dates';
 const start=document.createElement('input');start.type='date';start.name='from';
 const end=document.createElement('input');end.type='date';end.name='until';
 start.value=today().slice(0,7)+'-01';end.value=today();
 dateControls.append(makeLabel('De',start),makeLabel('Até',end));dateControls.hidden=true;controls.append(dateControls);
 const totals=document.createElement('div');totals.className='fl-report-totals';
 for(const [key,label] of [['used','Utilizado'],['refill','Reposto'],['fragrances','Fragrâncias utilizadas'],['movements','Movimentos']]){
  const card=document.createElement('div');card.className='fl-report-total';card.dataset.stat=key;
  const textNode=document.createElement('span');textNode.textContent=label;
  const value=document.createElement('strong');value.textContent='—';
  card.append(textNode,value);totals.append(card);
 }
 const description=document.createElement('p');description.className='fl-report-description';description.setAttribute('aria-live','polite');
 const sectionTitle=document.createElement('h3');sectionTitle.textContent='Fragrâncias mais utilizadas';
 const ranked=document.createElement('ol');ranked.className='fl-report-ranking';
 const more=document.createElement('button');more.type='button';more.className='btn fl-report-more';more.textContent='Ver mais fragrâncias';
 const familyDetails=document.createElement('details');familyDetails.className='fl-report-families';
 const familySummary=document.createElement('summary');familySummary.textContent='Consumo por família olfativa';
 const familyList=document.createElement('div');familyList.className='fl-report-family-list';
 familyDetails.append(familySummary,familyList);
 const actions=document.createElement('div');actions.className='ae-fl-dialog-actions-v1 fl-report-actions';
 const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='btn';
 exportButton.textContent='Exportar relatório CSV';
 const close=document.createElement('button');close.type='button';close.className='btn primary';
 close.textContent='Fechar';close.addEventListener('click',()=>d.close());
 actions.append(exportButton,close);
 d.append(h,controls,totals,description,sectionTitle,ranked,more,familyDetails,actions);
 let current=null,currentBounds=null,limit=12;
 function redraw(){
  dateControls.hidden=period.value!=='custom';
  currentBounds=fragranceReportBounds(period.value,start.value,end.value);
  current=fragranceGlobalUsage(rows(),currentBounds);
  const format=name=>ml(current[name]/1000);
  totals.querySelector('[data-stat=used] strong').textContent=format('usedUnits');
  totals.querySelector('[data-stat=refill] strong').textContent=format('refillUnits');
  totals.querySelector('[data-stat=fragrances] strong').textContent=String(current.fragrances);
  totals.querySelector('[data-stat=movements] strong').textContent=String(current.movements);
  const periodName=period.options[period.selectedIndex].text;
  const periodText=currentBounds.from&&currentBounds.until?currentBounds.from+' a '+currentBounds.until:'sem restrição de datas';
  description.textContent=currentBounds.invalid?'Verifica as datas. A data inicial não pode ser posterior à final.':
    periodName+' · '+periodText+' · '+current.adjustments+' ajustes não contabilizados como consumo';
  ranked.replaceChildren();
  for(const [index,row] of current.rows.slice(0,limit).entries()){
   const item=document.createElement('li');item.className='fl-report-item';
   const top=document.createElement('div');top.className='fl-report-item-top';
   const caption=document.createElement('div');caption.className='fl-report-identity';
   const family=document.createElement('span');family.textContent=row.family;
   const name=document.createElement('strong');name.textContent=(index+1)+'. '+row.name;
   caption.append(family,name);
   if(row.archived){
    const archive=document.createElement('small');archive.textContent='Arquivada';caption.append(archive);
   }
   const measure=document.createElement('div');measure.className='fl-report-measures';
   const used=document.createElement('b');used.textContent=ml(row.usedUnits/1000)+' utilizados';
   const replenished=document.createElement('span');replenished.textContent=ml(row.refillUnits/1000)+' repostos';
   measure.append(used,replenished);top.append(caption,measure);
   const bar=document.createElement('div');bar.className='fl-report-bar';bar.setAttribute('role','img');
   bar.setAttribute('aria-label',row.name+': '+ml(row.usedUnits/1000)+' utilizados');
   const fill=document.createElement('i');
   fill.style.width=(current.usedUnits>0?Math.max(0,Math.min(100,row.usedUnits/current.usedUnits*100)):0)+'%';
   bar.append(fill);
   const bottom=document.createElement('div');bottom.className='fl-report-item-bottom';
   const details=document.createElement('span');details.textContent=row.movements+' movimentos · '+row.adjustments+' ajustes';
   const history=document.createElement('button');history.className='btn';history.type='button';
   history.textContent='Ver histórico';
   history.setAttribute('aria-label','Ver histórico de '+row.name);
   history.addEventListener('click',()=>{d.close();showHistory(row.id)});
   bottom.append(details,history);
   item.append(top,bar,bottom);ranked.append(item);
  }
  if(!current.rows.length){
   const empty=document.createElement('li');empty.className='fl-report-empty';
   empty.textContent=currentBounds.invalid?'Corrige as datas para consultar o relatório.':
    'Não há movimentos manuais registados neste período.';
   ranked.append(empty);
  }
  more.hidden=current.rows.length<=limit;
  more.textContent='Ver mais fragrâncias ('+(current.rows.length-limit)+' restantes)';
  familyList.replaceChildren();
  for(const row of current.families){
   const line=document.createElement('div');line.className='fl-report-family-row';
   const left=document.createElement('span');left.textContent=row.name+' · '+row.fragrances+' utilizadas';
   const right=document.createElement('strong');right.textContent=ml(row.usedUnits/1000);
   line.append(left,right);familyList.append(line);
  }
  if(!current.families.length){
   const noData=document.createElement('p');noData.className='muted';noData.textContent='Sem consumo ou reposições no período.';
   familyList.append(noData);
  }
  exportButton.disabled=currentBounds.invalid||!current.rows.length;
 }
 period.addEventListener('change',()=>{limit=12;redraw()});
 start.addEventListener('change',()=>{limit=12;redraw()});
 end.addEventListener('change',()=>{limit=12;redraw()});
 more.addEventListener('click',()=>{limit+=12;redraw()});
 exportButton.addEventListener('click',()=>{
  if(!current||currentBounds.invalid)return;
  exportFragranceUsageCsv(current,period.options[period.selectedIndex].text+' ('+
   (currentBounds.from||'início')+' — '+(currentBounds.until||'sem fim')+')');
 });
 d.addEventListener('close',()=>d.remove(),{once:true});
 document.body.append(d);redraw();d.showModal();
}
window.renderTechnicalLibraryV1=render;
window.aeFragrancesV1={render,quickFilter,clearFilters,setView,batchSetup,showUsageReport:showFragranceUsageReport,add:()=>openEditor(null),importReceipt,exportCsv,downloadCustomerPdf};
render();
})();
