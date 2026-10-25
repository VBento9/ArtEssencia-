/* Clientes: apresentação apenas; preserva campos, botões e handlers existentes. */
(function(){'use strict';
function init(){
 const root=document.getElementById('clients'),box=document.getElementById('clientsCards'),form=root?.querySelector('.clients-form-card'),list=root?.querySelector('.clients-list-card');
 if(!box||!form||!list||document.getElementById('aeClientsToolbar'))return;
 root.classList.add('ae-clients-compact');
 const button=text=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;return b};
 const bar=document.createElement('div');bar.id='aeClientsToolbar';bar.className='ae-clients-toolbar';
 const showList=button('Ver clientes'),showForm=button('Abrir formulário');bar.append(showList,showForm);root.querySelector('.clients-stack-v1724').before(bar);
 let page=0,size=10,preservePage=false,lastAction='';
 function show(editor){form.hidden=!editor;showForm.setAttribute('aria-expanded',String(editor));}
 function back(){show(false);list.scrollIntoView({block:'start'});[...box.querySelectorAll('button[onclick]')].find(b=>b.getAttribute('onclick')===lastAction&&!b.closest('.client-card').hidden)?.focus({preventScroll:true})}
 showList.addEventListener('click',back);showForm.addEventListener('click',()=>{show(form.hidden);if(!form.hidden)document.getElementById('clientName')?.focus()});
 const returnButton=button('Voltar à lista');returnButton.addEventListener('click',back);form.querySelector('.clients-form-head').append(returnButton);
 const pages=[];
 function pager(){
  const el=document.createElement('div');el.className='ae-clients-pages';
  const prev=button('Anterior'),next=button('Seguinte'),label=document.createElement('span');label.setAttribute('aria-live','polite');
  prev.addEventListener('click',()=>{page--;apply();list.scrollIntoView({block:'start'})});next.addEventListener('click',()=>{page++;apply();list.scrollIntoView({block:'start'})});
  el.append(prev,label,next);pages.push({prev,next,label});return el;
 }
 const top=pager();box.before(top);box.after(pager());
 const label=document.createElement('label');label.append(document.createTextNode('Clientes por página '));
 const select=document.createElement('select');select.setAttribute('aria-label','Clientes por página');[10,20,50].forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=String(n);select.append(o)});label.append(select);top.append(label);
 select.addEventListener('change',()=>{size=Number(select.value);page=0;apply()});
 function apply(){
  const cards=[...box.querySelectorAll(':scope > .client-card')],count=Math.max(1,Math.ceil(cards.length/size));page=Math.max(0,Math.min(page,count-1));
  cards.forEach((card,i)=>{
   card.hidden=i<page*size||i>=(page+1)*size;
   const actions=card.querySelector('.client-actions');if(!actions||actions.querySelector('details'))return;
   const secondary=[...actions.querySelectorAll('button')].filter(b=>/clientCommunicationV171|deleteClient/.test(b.getAttribute('onclick')||''));
   if(secondary.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Mais ações';details.append(summary,...secondary);actions.append(details)}
  });
  pages.forEach(p=>{p.prev.disabled=page===0;p.next.disabled=page>=count-1;p.label.textContent=`${cards.length?page*size+1:0}–${Math.min((page+1)*size,cards.length)} de ${cards.length} clientes`});
 }
 new MutationObserver(()=>{if(!preservePage)page=0;apply()}).observe(box,{childList:true});
 root.addEventListener('click',event=>{
  const b=event.target.closest?.('button'),action=b?.getAttribute('onclick')||'';
  if(action.includes('editClient(')){preservePage=true;lastAction=action;show(true)}
  if(b?.id==='clientCancelBtn'){show(false);queueMicrotask(back)}
 },true);
 ['clientSearch','clientOrderFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='clientSearch'?'input':'change',()=>{page=0;preservePage=false}));
 show(!document.getElementById('clientCancelBtn')?.classList.contains('hidden'));apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
