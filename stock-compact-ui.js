/* Stock compacto — apresentação exclusivamente; não escreve dados. */
(function(){
'use strict';
const PAGE_SIZE=20;
let page=0, enabled=false, observer=null, ignore=false;
const id=x=>document.getElementById(x);
function setup(){
 const stock=id('stock'), body=id('stockBody');
 if(!stock||!body||id('aeStockCompactControls'))return;
 const stack=stock.querySelector('.stock-stack-v1721');
 const list=stock.querySelector('.stock-list-card');
 if(!stack||!list)return;
 const toolbar=document.createElement('div');
 toolbar.id='aeStockCompactControls';toolbar.className='ae-stock-compact-controls';
 const create=document.createElement('button');create.type='button';create.textContent='Nova matéria-prima';create.setAttribute('aria-expanded','false');
 const move=document.createElement('button');move.type='button';move.textContent='Movimento rápido';move.setAttribute('aria-expanded','false');
 const previous=document.createElement('button');previous.type='button';previous.textContent='Anterior';
 const next=document.createElement('button');next.type='button';next.textContent='Seguinte';
 const pages=document.createElement('span');pages.setAttribute('aria-live','polite');
 const form=stock.querySelector('.stock-create-section-v1736');
 const movement=stock.querySelector('.stock-move-section-v1721');
 function toggle(which,button){const expanded=button.getAttribute('aria-expanded')==='true';form.hidden=which!=='create'||expanded;movement.hidden=which!=='move'||expanded;create.setAttribute('aria-expanded',String(which==='create'&&!expanded));move.setAttribute('aria-expanded',String(which==='move'&&!expanded));if(!expanded)(which==='create'?form:movement).scrollIntoView({block:'nearest',behavior:'smooth'});}
 create.onclick=()=>toggle('create',create);
 move.onclick=()=>toggle('move',move);
 const actions=document.createElement('div');actions.className='ae-stock-action-tabs';actions.append(create,move);
 const pagination=document.createElement('div');pagination.className='ae-stock-pages';pagination.append(previous,pages,next);
 toolbar.append(actions,pagination);
 list.insertBefore(toolbar,list.querySelector('.tablewrap'));
 const lower=document.createElement('div');lower.className='ae-stock-pages ae-stock-bottom-pages';
 const prevBottom=document.createElement('button');prevBottom.type='button';prevBottom.textContent='Anterior';
 const nextBottom=document.createElement('button');nextBottom.type='button';nextBottom.textContent='Seguinte';
 const labelBottom=document.createElement('span');labelBottom.setAttribute('aria-live','polite');
 lower.append(prevBottom,labelBottom,nextBottom);list.append(lower);
 function apply(){
   const rows=[...body.rows].filter(row=>!row.querySelector('td[colspan]'));
   const pagesCount=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
   page=Math.min(page,pagesCount-1);
   rows.forEach((row,index)=>{row.hidden=index<page*PAGE_SIZE||index>=(page+1)*PAGE_SIZE});
   const text=(page+1)+' / '+pagesCount+' · '+rows.length+' artigos';
   pages.textContent=text;labelBottom.textContent=text;
   previous.disabled=prevBottom.disabled=page===0;
   next.disabled=nextBottom.disabled=page>=pagesCount-1;
   lower.hidden=pagesCount===1;pagination.hidden=pagesCount===1;
 }
 const jump=delta=>{page+=delta;apply();list.scrollIntoView({block:'start',behavior:'smooth'})};
 previous.onclick=prevBottom.onclick=()=>jump(-1);
 next.onclick=nextBottom.onclick=()=>jump(1);
 // Reaplica só depois de o renderStock substituir os filhos de tbody.
 observer=new MutationObserver(()=>{if(!ignore){page=0;apply()}});
 observer.observe(body,{childList:true});
 form.hidden=true;movement.hidden=true;
 // Quando Editar é acionado, o formulário existente tem de estar visível.
 // Não altera loadStock, nem reatribui handlers de dados.
 stock.addEventListener('click',event=>{
   const edit=event.target.closest('.stock-actions button');
   if(edit&&edit.textContent.trim()==='Editar'){
     form.hidden=false;movement.hidden=true;
     create.setAttribute('aria-expanded','true');move.setAttribute('aria-expanded','false');
   }
 });
 apply();enabled=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
