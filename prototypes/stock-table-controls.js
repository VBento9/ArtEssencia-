// Componente visual puro para tabelas do Stock ArtEssencia.
// Não escreve em IndexedDB, Cloud ou Supabase; não cria nem altera movimentos.
// Uso previsto: aplicar apenas à tabela já renderizada pelos handlers existentes.
export function attachStockTableControls(tableElement, {pageSize=20,searchPlaceholder='Pesquisar materiais…'}={}) {
  if (!(tableElement instanceof HTMLTableElement)) throw new TypeError('É necessária uma tabela HTML.');
  const tbody=tableElement.tBodies[0];
  if(!tbody)throw new Error('A tabela não contém tbody.');
  const rows=Array.from(tbody.rows);
  const toolbar=document.createElement('div');
  toolbar.className='ae-stock-controls';
  const search=document.createElement('input');
  search.type='search';
  search.placeholder=searchPlaceholder;
  search.setAttribute('aria-label',searchPlaceholder);
  const counter=document.createElement('span');counter.setAttribute('aria-live','polite');
  const nav=document.createElement('div');nav.className='ae-stock-pagination';
  const prev=document.createElement('button');prev.type='button';prev.textContent='Anterior';
  const next=document.createElement('button');next.type='button';next.textContent='Seguinte';
  const pageLabel=document.createElement('span');
  toolbar.append(search,counter);
  nav.append(prev,pageLabel,next);
  tableElement.parentElement.insertBefore(toolbar,tableElement);
  tableElement.parentElement.insertBefore(nav,tableElement.nextSibling);
  let page=0;
  const size=Math.max(1,Math.floor(Number(pageSize)||20));
  function update(){
    const q=search.value.trim().toLocaleLowerCase('pt-PT');
    const matched=rows.filter(row=>row.textContent.toLocaleLowerCase('pt-PT').includes(q));
    const pages=Math.max(1,Math.ceil(matched.length/size));
    page=Math.min(page,pages-1);
    const visible=new Set(matched.slice(page*size,(page+1)*size));
    rows.forEach(row=>{row.hidden=!visible.has(row);row.style.display=visible.has(row)?'':'none'});
    counter.textContent=`${matched.length} de ${rows.length} registos`;
    pageLabel.textContent=`${page+1} / ${pages}`;
    prev.disabled=page===0;next.disabled=page>=pages-1;
  }
  search.addEventListener('input',()=>{page=0;update()});
  prev.addEventListener('click',()=>{page--;update()});
  next.addEventListener('click',()=>{page++;update()});
  update();
  return {refresh:update,destroy(){rows.forEach(row=>{row.hidden=false;row.style.display=''});toolbar.remove();nav.remove()}};
}
