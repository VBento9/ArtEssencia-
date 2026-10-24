/* Stock compacto: camada de apresentação, sem alterações de dados. */
(function(){
'use strict';
const PAGE_SIZE=20;
function init(){
 const stock=document.getElementById('stock'),body=document.getElementById('stockBody');
 if(!stock||!body||document.getElementById('aeStockCompactControls'))return;
 const list=stock.querySelector('.stock-list-card');
 const form=stock.querySelector('.stock-create-section-v1736');
 const movement=stock.querySelector('.stock-move-section-v1721');
 const anchor=list?.querySelector('.tablewrap');
 if(!list||!form||!movement||!anchor)return;
 // No formulário de matérias-primas, escolher imagens guardadas em vez de abrir a câmara.
 // Preserva os handlers de pré-visualização e gravação existentes.
 const useStoredImages=()=>{
   form.querySelectorAll('input[type="file"]').forEach(input=>{
     input.removeAttribute('capture');
     // Extensões explícitas evitam o pedido de captura da câmara em Android.
     input.setAttribute('accept','.jpg,.jpeg,.png,.webp,.gif,.heic,.heif');
   });
 };
 useStoredImages();
 new MutationObserver(useStoredImages).observe(form,{childList:true,subtree:true,attributes:true,attributeFilter:['capture','accept']});
 // Ajustar também imediatamente antes do gesto que abre o seletor.
 form.addEventListener('pointerdown',useStoredImages,true);
 form.addEventListener('click',useStoredImages,true);
 const makeButton=label=>{const b=document.createElement('button');b.type='button';b.textContent=label;return b};
 const container=document.createElement('div');container.id='aeStockCompactControls';container.className='ae-stock-compact-controls';
 const actions=document.createElement('div');actions.className='ae-stock-action-tabs';
 const add=makeButton('Nova matéria-prima'),move=makeButton('Movimento rápido');
 add.setAttribute('aria-expanded','false');move.setAttribute('aria-expanded','false');
 actions.append(add,move);
 const pages=document.createElement('div');pages.className='ae-stock-pages';
 const prev=makeButton('Anterior'),next=makeButton('Seguinte'),indicator=document.createElement('span');
 indicator.setAttribute('aria-live','polite');pages.append(prev,indicator,next);
 container.append(actions,pages);list.insertBefore(container,anchor);
 const bottom=pages.cloneNode(false);bottom.classList.add('ae-stock-bottom-pages');
 const prev2=makeButton('Anterior'),next2=makeButton('Seguinte'),indicator2=document.createElement('span');
 indicator2.setAttribute('aria-live','polite');bottom.append(prev2,indicator2,next2);list.append(bottom);
 let page=0;
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
   const count=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.max(0,Math.min(page,count-1));
   rows.forEach((row,i)=>{row.hidden=i<page*PAGE_SIZE||i>=(page+1)*PAGE_SIZE});
   const label=`${page+1} / ${count} · ${rows.length} artigos`;
   indicator.textContent=indicator2.textContent=label;
   prev.disabled=prev2.disabled=page===0;next.disabled=next2.disabled=page===count-1;
   pages.hidden=bottom.hidden=count===1;
 }
 function advance(delta){page+=delta;apply();list.scrollIntoView({block:'start'})}
 prev.onclick=prev2.onclick=()=>advance(-1);next.onclick=next2.onclick=()=>advance(1);
 // Stock original recria tbody após pesquisa/filtro/gravação.
 const observer=new MutationObserver(()=>{page=0;apply()});
 observer.observe(body,{childList:true});
 stock.addEventListener('click',e=>{
   const btn=e.target.closest?.('button');
   if(!btn)return;
   if(btn.closest('.stock-actions')&&btn.textContent.trim()==='Editar'){
     // O handler original loadStock continua a preencher os campos.
     // Abrir antes da ação inline para tornar o formulário visível.
     open('form');
   }
   if(btn.id==='stockCancelBtnV145')open(null);
 });
 // Nunca ocultar um formulário já em edição ao inicializar.
 const editing=document.getElementById('stockCancelBtnV145');
 if(!(editing&&!editing.classList.contains('hidden')))open(null);
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
