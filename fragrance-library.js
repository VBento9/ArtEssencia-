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
function render(){
 const root=document.getElementById('technicalLibrary');if(!root)return;
 const q=document.getElementById('aeFlSearchV1'),f=document.getElementById('aeFlFamilyV1'),s=document.getElementById('aeFlStatusV1');
 if(!s.querySelector('[value=pending]')){
  s.add(new Option('Quantidade por registar','pending'));
  s.add(new Option('Esgotadas','empty'));
  const setup=document.createElement('button');setup.type='button';setup.className='btn';
  setup.textContent='Preencher quantidades em conjunto';setup.onclick=batchSetup;
  root.querySelector('.fl-actions').append(setup);
 }
 const family=f.value,used=[...new Set(rows().map(x=>x.family||FAMILIES[0]))].sort((a,b)=>a.localeCompare(b,'pt-PT'));
 f.innerHTML='<option value="">Todas as famílias</option>'+used.map(x=>'<option value="'+text(x)+'">'+text(x)+'</option>').join('');f.value=family;
 const list=rows(),search=norm(q.value),status=s.value;
 const shown=list.filter(x=>(!family||x.family===family)&&
  (status==='all'||(status==='active'&&!x.archived)||(status==='archived'&&x.archived)||(status==='pending'&&!x.archived&&!hasBalance(x))||(status==='empty'&&!x.archived&&hasBalance(x)&&ledger.balance(x)===0)||(status==='low'&&!x.archived&&hasBalance(x)&&ledger.tank(x).percent!==null&&ledger.tank(x).percent<=20))&&
  (!search||norm([x.name,x.originalName,x.supplier,x.description,x.family].join(' ')).includes(search)))
  .sort((a,b)=>document.getElementById('aeFlSort').value==='quantity'?ledger.balance(a)-ledger.balance(b):String(a.name).localeCompare(String(b.name),'pt-PT'));
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
  const gauge=makeGauge(x);
  const photo=document.createElement('button');
  photo.type='button';photo.className='fl-photo-slot';
  photo.setAttribute('aria-label','Fotografia de '+x.name);
  photo.onclick=()=>openEditor(x.id,true);
  renderPhoto(photo,x.photoData||x.photoUrl);
  main.prepend(photo);
  const actions=document.createElement('div');actions.className='fl-actions';
  for(const [label,type] of [['Registar utilização','consumption'],['Adicionar fragrância','refill']]){const b=document.createElement('button');b.type='button';b.className='btn'+(type==='consumption'?' primary':'');b.textContent=label;b.disabled=!!x.archived;b.onclick=()=>movement(x.id,type);actions.append(b)}
  const secondary=document.createElement('div');secondary.className='fl-card-secondary';
  const history=document.createElement('button');history.type='button';history.className='btn';history.textContent='Histórico';history.onclick=()=>showHistory(x.id);
  const manage=document.createElement('button');manage.type='button';manage.className='btn';
  manage.textContent='Gerir fragrância';manage.disabled=!!x.archived;
  manage.onclick=()=>movement(x.id,hasBalance(x)&&ledger.balance(x)>0?'consumption':'refill',null,true);
  secondary.append(manage,edit,history);
  const level=ledger.tank(x);
  if(level.percent===null&&!x.archived){const capacity=document.createElement('button');capacity.type='button';capacity.className='btn';capacity.textContent='Definir capacidade';capacity.onclick=()=>movement(x.id,'capacity');secondary.append(capacity)}
  card.append(main,gauge,actions,secondary);box.append(card);
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
  (['description','applications','technicalNotes','photoUrl','ifraUrl','sdsUrl'].includes(key)?extra:grid).append(wrapper);
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
 form.append(photo,grid,commonNotes,details);
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
 const x=rows().find(x=>x.id===id),d=document.createElement('dialog');d.className='ae-fl-dialog-v1 fl-history-dialog';d.setAttribute('aria-label','Histórico de '+x.name);
 d.innerHTML='<h2>Histórico · '+text(x.name)+'</h2><div class="fl-actions"></div><ol>'+[...(x.movements||[])].reverse().map(m=>'<li>'+text(m.date)+' · '+({consumption:'Consumo',refill:'Reposição',correction:'Correção manual',capacity:'Capacidade de referência'}[m.type])+' · '+m.before/1000+' → '+m.after/1000+' ml'+(m.type==='capacity'?' · referência '+(m.capacityAfter||0)/1000+' ml':'')+'<p>'+text(m.note)+'</p></li>').join('')+'</ol><button class="btn">Fechar</button>';
 for(const [label,type] of [['Corrigir saldo','correction'],['Ajustar capacidade','capacity']]){const b=document.createElement('button');b.className='btn';b.textContent=label;b.disabled=!!x.archived;b.onclick=()=>{d.close();movement(id,type)};d.querySelector('.fl-actions').append(b)}
 if(!(x.movements||[]).length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Ainda não existem movimentos. Adiciona a quantidade que tens disponível para começar.';d.querySelector('ol').replaceWith(empty)}
 d.lastElementChild.onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();
}
window.renderTechnicalLibraryV1=render;
window.aeFragrancesV1={render,add:()=>openEditor(null),importReceipt,exportCsv,downloadCustomerPdf};
render();
})();
