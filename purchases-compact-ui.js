/* Compras: apresentação apenas; mantém os controlos e handlers originais. */
(function(){'use strict';
function init(){
 const root=document.getElementById('purchases'),body=document.getElementById('purchasesBody'),form=root?.querySelector('.purchase-form-card'),list=root?.querySelector('.purchase-list-card');
 if(!body||!form||!list||document.getElementById('aePurchasesToolbar'))return;
 root.classList.add('ae-purchases-compact');
 const button=text=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;return b};
 const bar=document.createElement('div');bar.id='aePurchasesToolbar';bar.className='ae-purchases-toolbar';
 const history=button('Ver histórico'),editor=button('Abrir formulário');bar.append(history,editor);form.before(bar);
 let page=0,size=10,preservePage=false,lastAction='';
 function show(open){form.hidden=!open;editor.setAttribute('aria-expanded',String(open))}
 function back(){show(false);list.scrollIntoView({block:'start'});[...body.querySelectorAll('button[onclick]')].find(b=>b.getAttribute('onclick')===lastAction&&!b.closest('tr').hidden)?.focus({preventScroll:true})}
 history.addEventListener('click',back);editor.addEventListener('click',()=>{show(form.hidden);if(!form.hidden)document.getElementById('purchaseSupplier')?.focus()});
 const returnButton=button('Voltar ao histórico');returnButton.addEventListener('click',back);form.querySelector('.purchase-form-head').append(returnButton);
 // Stock preselects an article and dispatches change directly on this original select.
 document.getElementById('purchaseItem')?.addEventListener('change',()=>show(true));
 const pages=[];
 function pager(){const el=document.createElement('div');el.className='ae-purchases-pages';const prev=button('Anterior'),next=button('Seguinte'),label=document.createElement('span');label.setAttribute('aria-live','polite');prev.addEventListener('click',()=>{page--;apply();list.scrollIntoView({block:'start'})});next.addEventListener('click',()=>{page++;apply();list.scrollIntoView({block:'start'})});el.append(prev,label,next);pages.push({prev,next,label});return el}
 const anchor=list.querySelector('.tablewrap'),top=pager();anchor.before(top);anchor.after(pager());
 const label=document.createElement('label');label.append(document.createTextNode('Compras por página '));const select=document.createElement('select');select.setAttribute('aria-label','Compras por página');[10,20,50].forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=String(n);select.append(o)});label.append(select);top.append(label);select.addEventListener('change',()=>{size=Number(select.value);page=0;apply()});
 const headers=[...list.querySelectorAll('thead th')].map(th=>th.textContent.trim());
 function apply(){const rows=[...body.rows].filter(row=>!row.querySelector('td[colspan]')),count=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,count-1));rows.forEach((row,i)=>{row.hidden=i<page*size||i>=(page+1)*size;[...row.cells].forEach((cell,j)=>{cell.dataset.purchaseLabel=headers[j]||''})});pages.forEach(p=>{p.prev.disabled=page===0;p.next.disabled=page>=count-1;p.label.textContent=`${rows.length?page*size+1:0}–${Math.min((page+1)*size,rows.length)} de ${rows.length} compras`})}
 new MutationObserver(()=>{if(!preservePage)page=0;apply()}).observe(body,{childList:true});
 root.addEventListener('click',event=>{const b=event.target.closest?.('button'),action=b?.getAttribute('onclick')||'';if(action.includes('editPurchase(')){preservePage=true;lastAction=action;show(true)}if(action.includes('receivePurchaseV135('))preservePage=true;if(b?.id==='purchaseCancelBtn'){show(false);queueMicrotask(back)}},true);
 ['purchaseSearch','purchaseMethodFilter','purchaseStateFilterV1932'].forEach(id=>document.getElementById(id)?.addEventListener(id==='purchaseSearch'?'input':'change',()=>{page=0;preservePage=false}));
 show(!document.getElementById('purchaseCancelBtn')?.classList.contains('hidden'));apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
