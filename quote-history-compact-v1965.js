/* ArtEssencia — Histórico de Orçamentos, UI compacta e paginada (v1.9.65).
   Reorganiza somente os nós existentes; preserva os handlers e os dados reais. */
(() => {
  'use strict';
  function initialise() {
    const screen=document.getElementById('quotes');
    const section=screen?.querySelector('.quotes-history-card-v1730');
    const tbody=document.getElementById('quotesBody');
    const wrapper=section?.querySelector('.quotes-history-table-v1730');
    if(!section||!tbody||!wrapper||section.dataset.quoteHistoryReady1965)return;
    section.dataset.quoteHistoryReady1965='1';
    const createCard=screen.querySelector('.quotes-main-card-v1730');
    if(createCard)screen.insertBefore(section,createCard);
    const toolbar=document.createElement('div');
    toolbar.className='qh-toolbar-1965';
    toolbar.innerHTML='<label class="qh-search-1965">Pesquisar<input type="search" placeholder="Cliente, referência ou evento" aria-label="Pesquisar orçamentos"></label>'+
      '<label>Estado<select aria-label="Filtrar estado"><option value="">Todos</option><option value="Rascunho">Rascunhos</option><option value="Enviado">Enviados</option><option value="Aceite">Aceites</option><option value="Recusado">Recusados</option><option value="Expirado">Expirados</option><option value="Convertido">Convertidos</option></select></label>'+
      '<label>Por página<select aria-label="Orçamentos por página"><option value="8">8</option><option value="16">16</option><option value="32">32</option></select></label>';
    const counter=document.createElement('p');counter.className='qh-counter-1965';counter.setAttribute('role','status');
    const nav=document.createElement('div');nav.className='qh-nav-1965';
    const previous=document.createElement('button'),next=document.createElement('button'),pageText=document.createElement('span');
    previous.type=next.type='button';previous.className=next.className='btn';
    previous.textContent='Anterior';next.textContent='Seguinte';nav.append(previous,pageText,next);
    section.insertBefore(toolbar,wrapper);section.insertBefore(counter,wrapper);wrapper.after(nav);
    const [search,status,size]=toolbar.querySelectorAll('input,select');
    let page=1;
    const labels=['N.º','Cliente','Evento','Validade','Total','Pagamento','Estado','Ações'];
    function enhance(tr) {
      if(tr.dataset.qhReady1965)return;
      const cells=[...tr.cells];
      if(cells.length!==8)return;
      tr.dataset.qhReady1965='1';
      cells.forEach((cell,i)=>cell.dataset.label=labels[i]);
      const actions=cells[7],buttons=[...actions.querySelectorAll('button')];
      if(!buttons.length)return;
      const primary=document.createElement('div');primary.className='qh-primary-1965';
      const more=document.createElement('details');more.className='qh-more-1965';
      const summary=document.createElement('summary');summary.textContent='Mais ações';
      const secondary=document.createElement('div');secondary.className='qh-secondary-1965';
      buttons.forEach(button=>{
        const label=button.textContent.trim();
        if(label==='Ver PDF'||label==='Editar'||label==='Converter em encomenda')primary.append(button);
        else secondary.append(button);
      });
      more.append(summary,secondary);
      actions.replaceChildren(primary,more);
    }
    function refresh() {
      const rows=[...tbody.rows];
      rows.forEach(enhance);
      const query=search.value.trim().toLocaleLowerCase('pt-PT'),filter=status.value;
      const results=rows.filter(row=>{
        if(row.cells.length!==8)return !query&&!filter;
        const text=[0,1,2].map(i=>row.cells[i]?.textContent||'').join(' ').toLocaleLowerCase('pt-PT');
        const cell=row.cells[6];
        const actual=cell?.querySelector('select')?.value||cell?.textContent.trim()||'';
        return (!query||text.includes(query))&&(!filter||filter===actual);
      });
      const per=Number(size.value)||8,maximum=Math.max(1,Math.ceil(results.length/per));
      page=Math.max(1,Math.min(maximum,page));
      const offset=(page-1)*per;
      const current=new Set(results.slice(offset,offset+per));
      rows.forEach(row=>{row.hidden=!current.has(row)});
      const start=results.length?offset+1:0,end=results.length?Math.min(results.length,offset+per):0;
      counter.textContent=results.length?'A mostrar '+start+'–'+end+' de '+results.length+' orçamento(s)':'Sem orçamentos para estes filtros.';
      pageText.textContent='Página '+page+' de '+maximum;
      previous.disabled=page<=1;next.disabled=page>=maximum;
      nav.hidden=maximum===1;
    }
    search.addEventListener('input',()=>{page=1;refresh()});
    status.addEventListener('change',()=>{page=1;refresh()});
    size.addEventListener('change',()=>{page=1;refresh()});
    tbody.addEventListener('change',event=>{if(event.target.matches('select'))queueMicrotask(refresh)});
    previous.addEventListener('click',()=>{page--;refresh();section.scrollIntoView({block:'start'})});
    next.addEventListener('click',()=>{page++;refresh();section.scrollIntoView({block:'start'})});
    new MutationObserver(refresh).observe(tbody,{childList:true});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialise,{once:true});else initialise();
})();
