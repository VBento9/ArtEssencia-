/* Stock compacto: camada de apresentação, sem alterações de dados. */
(function(){
'use strict';
const DEFAULT_PAGE_SIZE=20;
function init(){
 const stock=document.getElementById('stock'),body=document.getElementById('stockBody');
 if(!stock||!body||document.getElementById('aeStockCompactControls'))return;
 const list=stock.querySelector('.stock-list-card');
 const form=stock.querySelector('.stock-create-section-v1736');
 const movement=stock.querySelector('.stock-move-section-v1721');
 const anchor=list?.querySelector('.tablewrap');
 if(!list||!form||!movement||!anchor)return;
 const makeButton=label=>{const b=document.createElement('button');b.type='button';b.textContent=label;return b};
 const container=document.createElement('div');container.id='aeStockCompactControls';container.className='ae-stock-compact-controls';
 const actions=document.createElement('div');actions.className='ae-stock-action-tabs';
 const add=makeButton('Abrir formulário'),move=makeButton('Movimento rápido');
 add.setAttribute('aria-expanded','false');move.setAttribute('aria-expanded','false');
 actions.append(add,move);
 const pages=document.createElement('div');pages.className='ae-stock-pages';
 const prev=makeButton('Anterior'),next=makeButton('Seguinte'),indicator=document.createElement('span');
 indicator.setAttribute('aria-live','polite');pages.append(prev,indicator,next);
 container.append(actions,pages);list.insertBefore(container,anchor);
 const bottom=pages.cloneNode(false);bottom.classList.add('ae-stock-bottom-pages');
 const prev2=makeButton('Anterior'),next2=makeButton('Seguinte'),indicator2=document.createElement('span');
 indicator2.setAttribute('aria-live','polite');bottom.append(prev2,indicator2,next2);list.append(bottom);
 let page=0,pageSize=DEFAULT_PAGE_SIZE,preservePage=false,lastEditAction='';
 const sizeLabel=document.createElement('label'),size=document.createElement('select');
 sizeLabel.className='ae-stock-page-size';sizeLabel.append(document.createTextNode('Artigos por página '));
 size.setAttribute('aria-label','Artigos por página');
 [10,20,50].forEach(value=>{const option=document.createElement('option');option.value=String(value);option.textContent=String(value);size.append(option)});
 size.value=String(pageSize);sizeLabel.append(size);container.append(sizeLabel);
 size.addEventListener('change',()=>{pageSize=Number(size.value);page=0;apply()});
 const headers=[...list.querySelectorAll('thead th')].map(th=>th.textContent.trim());
 function returnToList(){
   open(null);list.scrollIntoView({block:'start'});
   const target=[...body.querySelectorAll('.stock-actions button')].find(b=>b.getAttribute('onclick')===lastEditAction&&!b.closest('tr').hidden);
   target?.focus({preventScroll:true});
 }
 [form,movement].forEach(section=>{
   const back=makeButton('Voltar à lista');back.className='btn ae-stock-return';
   back.addEventListener('click',returnToList);(section.querySelector('.stock-form-head')||section).append(back);
 });
 ['stockSearch','stockStateFilter'].forEach(id=>{
   const field=document.getElementById(id);field?.addEventListener(id==='stockSearch'?'input':'change',()=>{preservePage=false;page=0});
 });
 function open(which){
   form.hidden=which!=='form';movement.hidden=which!=='movement';
   add.setAttribute('aria-expanded',String(which==='form'));
   move.setAttribute('aria-expanded',String(which==='movement'));
   if(which==='form'||which==='movement')(which==='form'?form:movement).scrollIntoView({block:'nearest'});
 }
 add.addEventListener('click',()=>open(form.hidden?'form':null));
 move.addEventListener('click',()=>open(movement.hidden?'movement':null));
 function apply(){
   // A posição visual muda, mas os índices das linhas e handlers inline ficam inalterados.
   const rows=Array.from(body.rows).filter(row=>!row.querySelector('td[colspan]'));
   const count=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.max(0,Math.min(page,count-1));
   rows.forEach((row,i)=>{row.hidden=i<page*pageSize||i>=(page+1)*pageSize});
   rows.forEach(row=>[...row.cells].forEach((cell,i)=>{if(headers[i])cell.dataset.stockLabel=headers[i]}));
   const label=`${rows.length?page*pageSize+1:0}–${Math.min((page+1)*pageSize,rows.length)} de ${rows.length} artigos · ${page+1} / ${count}`;
   indicator.textContent=indicator2.textContent=label;
   prev.disabled=prev2.disabled=page===0;next.disabled=next2.disabled=page===count-1;
   pages.hidden=bottom.hidden=count===1;
 }
 function advance(delta){page+=delta;apply();list.scrollIntoView({block:'start'})}
 prev.onclick=prev2.onclick=()=>advance(-1);next.onclick=next2.onclick=()=>advance(1);
 // Stock original recria tbody após pesquisa/filtro/gravação.
 const observer=new MutationObserver(()=>{if(!preservePage)page=0;apply()});
 observer.observe(body,{childList:true});
 stock.addEventListener('click',e=>{
   const btn=e.target.closest?.('button');
   if(!btn)return;
   if(btn.closest('.stock-actions')&&btn.textContent.trim()==='Editar'){
     // O handler original loadStock continua a preencher os campos.
     // Abrir antes da ação inline para tornar o formulário visível.
     preservePage=true;lastEditAction=btn.getAttribute('onclick')||'';open('form');
   }
   if(btn.id==='stockCancelBtnV145'){open(null);queueMicrotask(returnToList)}
 });
 // Nunca ocultar um formulário já em edição ao inicializar.
 const editing=document.getElementById('stockCancelBtnV145');
 if(!(editing&&!editing.classList.contains('hidden')))open(null);
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
