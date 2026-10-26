/* Caixa: apresentação apenas; mantém os controlos e handlers originais. */
(function(){'use strict';
function init(){
 const root=document.getElementById('cash'),body=document.getElementById('cashBody'),form=root?.querySelector('.cash-form-card'),list=root?.querySelector('.cash-list-card');
 if(!body||!form||!list||document.getElementById('aeCashToolbar'))return;
 root.classList.add('ae-cash-compact');
 const caption=document.createElement('p');caption.className='ae-cash-summary-note';caption.textContent='Resumo global de Caixa. Os filtros abaixo aplicam-se à lista de movimentos.';document.getElementById('cashKpis')?.before(caption);
 const button=text=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;return b};
 const bar=document.createElement('div');bar.id='aeCashToolbar';bar.className='ae-cash-toolbar';
 const history=button('Ver movimentos'),editor=button('Abrir formulário');bar.append(history,editor);form.before(bar);
 let page=0,size=10,preservePage=false,lastAction='';
 function show(open){form.hidden=!open;editor.setAttribute('aria-expanded',String(open))}
 function back(){show(false);list.scrollIntoView({block:'start'});[...body.querySelectorAll('button[onclick]')].find(b=>b.getAttribute('onclick')===lastAction&&!b.closest('tr').hidden)?.focus({preventScroll:true})}
 history.addEventListener('click',back);editor.addEventListener('click',()=>{show(form.hidden);if(!form.hidden)document.getElementById('cashDesc')?.focus()});
 const returnButton=button('Voltar aos movimentos');returnButton.addEventListener('click',back);form.querySelector('.cash-form-head').append(returnButton);

 const pages=[];
 function pager(){const el=document.createElement('div');el.className='ae-cash-pages';const prev=button('Anterior'),next=button('Seguinte'),label=document.createElement('span');label.setAttribute('aria-live','polite');prev.addEventListener('click',()=>{page--;apply();list.scrollIntoView({block:'start'})});next.addEventListener('click',()=>{page++;apply();list.scrollIntoView({block:'start'})});el.append(prev,label,next);pages.push({prev,next,label});return el}
 const anchor=list.querySelector('.tablewrap'),top=pager();anchor.before(top);anchor.after(pager());
 const label=document.createElement('label');label.append(document.createTextNode('Movimentos por página '));const select=document.createElement('select');select.setAttribute('aria-label','Movimentos por página');[10,20,50].forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=String(n);select.append(o)});label.append(select);top.append(label);select.addEventListener('change',()=>{size=Number(select.value);page=0;apply()});
 const headers=[...list.querySelectorAll('thead th')].map(th=>th.textContent.trim());
 function apply(){const rows=[...body.rows].filter(row=>!row.querySelector('td[colspan]')),count=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,count-1));rows.forEach((row,i)=>{row.hidden=i<page*size||i>=(page+1)*size;[...row.cells].forEach((cell,j)=>{cell.dataset.cashLabel=headers[j]||''})});pages.forEach(p=>{p.prev.disabled=page===0;p.next.disabled=page>=count-1;p.label.textContent=`${rows.length?page*size+1:0}–${Math.min((page+1)*size,rows.length)} de ${rows.length} movimentos`})}
 new MutationObserver(()=>{if(!preservePage)page=0;apply()}).observe(body,{childList:true});
 root.addEventListener('click',event=>{const b=event.target.closest?.('button'),action=b?.getAttribute('onclick')||'';if(action.includes('editCash(')){preservePage=true;lastAction=action;show(true)}if(b?.id==='cashCancelBtn'){show(false);queueMicrotask(back)}},true);
 ['cashSearch','cashMethodFilter','cashTypeFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='cashSearch'?'input':'change',()=>{page=0;preservePage=false}));
 show(!document.getElementById('cashCancelBtn')?.classList.contains('hidden'));apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
