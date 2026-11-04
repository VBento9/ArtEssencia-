// Contextual navigation only. Keeps existing searches, filters and editor drafts.
(function(){
 'use strict';
 function init(){
  const heading=document.querySelector('.page-heading');
  if(!heading||document.getElementById('aeModuleSearch'))return;
  const fields={orders:['orderSearch','Pesquisar encomendas'],products:['productSearch','Pesquisar produtos'],stock:['stockSearch','Pesquisar stock'],clients:['clientSearch','Pesquisar clientes'],production:['prodDate','Escolher data de produção']};
  const button=document.createElement('button');button.id='aeModuleSearch';button.type='button';button.className='btn';
  function target(){const active=document.querySelector('.screen.active'),entry=fields[active?.id];return entry&&{id:active.id,input:document.getElementById(entry[0]),label:entry[1]}}
  function update(){const t=target();button.hidden=!t?.input;if(t?.input){button.textContent=t.label;button.setAttribute('aria-controls',t.input.id)}else button.removeAttribute('aria-controls')}
  button.addEventListener('click',()=>{
   const t=target();if(!t?.input)return;
   // Reuse the catalogue action so the compact editor retains its draft and state.
   if(t.id==='products'&&t.input.closest('[hidden]'))document.querySelector('#aeProductsCompact button')?.click();
   if(!t.input.getClientRects().length)return;
   t.input.focus({preventScroll:true});
   t.input.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  const actions=document.createElement('div');actions.className='ae-heading-actions';
  const menu=document.getElementById('aeTabletMenu');if(menu)actions.append(menu);
  actions.append(button);heading.append(actions);
  // Pesquisa de módulos baseada exclusivamente na navegação já existente.
  const jump=document.createElement('button');
  jump.id='aeJumpModule';jump.type='button';jump.className='btn ghost';
  jump.textContent='Ir para módulo';jump.setAttribute('aria-haspopup','dialog');
  jump.setAttribute('aria-label','Ir rapidamente para outro módulo do Backoffice');
  jump.title='Ir para módulo (Ctrl+K)';
  actions.append(jump);
  const backdrop=document.createElement('div');
  backdrop.id='aeModulePaletteBackdrop';backdrop.className='ae-module-palette-backdrop';
  backdrop.hidden=true;
  const dialog=document.createElement('div');
  dialog.className='ae-module-palette';dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','aePaletteHeading');
  const header=document.createElement('div');header.className='ae-module-palette-header';
  const title=document.createElement('strong');title.id='aePaletteHeading';title.textContent='Ir para módulo';
  const close=document.createElement('button');close.type='button';close.className='ae-palette-close';close.textContent='Fechar';
  close.setAttribute('aria-label','Fechar pesquisa de módulos');
  header.append(title,close);
  const search=document.createElement('input');search.id='aeModulePaletteInput';
  search.type='search';search.autocomplete='off';search.placeholder='Pesquisar Produtos, Stock, Encomendas…';
  search.setAttribute('aria-label','Pesquisar módulo');
  search.setAttribute('aria-controls','aeModulePaletteResults');
  const results=document.createElement('div');results.id='aeModulePaletteResults';
  results.className='ae-module-palette-results';results.setAttribute('role','listbox');
  results.setAttribute('aria-label','Módulos disponíveis');
  const help=document.createElement('p');help.className='ae-module-palette-help';
  help.textContent='Escreve o nome do módulo. Enter para abrir · Esc para fechar.';
  dialog.append(header,search,results,help);backdrop.append(dialog);document.body.append(backdrop);
  let returnFocus=null;
  const items=()=>[...document.querySelectorAll('.sidebar .nav button, .sidebar .nav-btn, .app .nav button')]
    .filter((item,index,all)=>all.indexOf(item)===index&&!item.disabled&&!item.hidden)
    .map(item=>({item,label:String(item.querySelector('.nav-label')?.textContent||item.textContent||'').replace(/\s+/g,' ').trim()}))
    .filter(({item,label})=>label.length>1&&!item.closest('.sidebar-footer'));
  function closePalette(){
   if(backdrop.hidden)return;
   backdrop.hidden=true;document.body.classList.remove('ae-palette-open');
   const target=returnFocus;returnFocus=null;
   if(target&&document.contains(target))target.focus({preventScroll:true});
  }
  function navigate(target){
   if(!target||!document.contains(target))return;
   closePalette();
   target.click();
  }
  function renderPalette(){
   const query=search.value.trim().toLocaleLowerCase('pt-PT');
   const matches=items().filter(x=>x.label.toLocaleLowerCase('pt-PT').includes(query)).slice(0,30);
   results.replaceChildren();
   if(!matches.length){
    const empty=document.createElement('p');empty.className='ae-palette-empty';
    empty.textContent='Nenhum módulo encontrado. Experimenta outra palavra.';
    results.append(empty);return;
   }
   for(const {item,label} of matches){
    const row=document.createElement('button');row.type='button';row.className='ae-palette-result';
    row.setAttribute('role','option');row.textContent=label;
    if(item.classList.contains('active')||item.getAttribute('aria-current')==='page'){
     row.classList.add('is-current');row.setAttribute('aria-selected','true');
    }
    row.addEventListener('click',()=>navigate(item));
    results.append(row);
   }
  }
  function openPalette(){
   if(!backdrop.hidden){search.focus();return}
   const options=items();
   if(!options.length)return;
   returnFocus=document.activeElement;
   search.value='';renderPalette();backdrop.hidden=false;
   document.body.classList.add('ae-palette-open');search.focus();
  }
  jump.addEventListener('click',openPalette);
  close.addEventListener('click',closePalette);
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)closePalette()});
  search.addEventListener('input',renderPalette);
  search.addEventListener('keydown',event=>{
   if(event.key==='Enter'){
    const first=results.querySelector('.ae-palette-result');
    if(first){event.preventDefault();first.click()}
   }else if(event.key==='ArrowDown'){
    const first=results.querySelector('.ae-palette-result');if(first){event.preventDefault();first.focus()}
   }
  });
  results.addEventListener('keydown',event=>{
   const options=[...results.querySelectorAll('.ae-palette-result')];
   const at=options.indexOf(document.activeElement);
   if(event.key==='ArrowDown'&&at>=0){event.preventDefault();options[Math.min(options.length-1,at+1)]?.focus()}
   if(event.key==='ArrowUp'&&at>=0){event.preventDefault();at===0?search.focus():options[at-1]?.focus()}
   if(event.key==='Enter'&&at>=0){event.preventDefault();options[at].click()}
  });
  document.addEventListener('keydown',event=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.altKey){
    if(!backdrop.hidden){event.preventDefault();search.focus();return}
    if(!event.target.closest('input,textarea,select,[contenteditable="true"]')){
     event.preventDefault();openPalette();
    }
    return;
   }
   if(backdrop.hidden)return;
   if(event.key==='Escape'){event.preventDefault();closePalette();return}
   if(event.key==='Tab'){
    const focusables=[close,search,...results.querySelectorAll('.ae-palette-result')];
    const first=focusables[0],last=focusables[focusables.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   }
  });
  const observer=new MutationObserver(update);
  document.querySelectorAll('.screen').forEach(screen=>observer.observe(screen,{attributes:true,attributeFilter:['class']}));
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
