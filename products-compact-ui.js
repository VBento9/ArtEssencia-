/* ArtEssencia — apresentação compacta de Produtos. Não altera dados nem handlers de negócio. */
(function(){
'use strict';
function init(){
 const root=document.getElementById('products');
 if(!root||document.getElementById('aeProductsCompact'))return;
 const hero=root.querySelector('.products-hero'),form=root.querySelector('.products-form-card'),list=root.querySelector('.products-list-card');
 const filters=root.querySelectorAll('.products-filter-group-v1853');
 if(!hero||!form||!list||filters.length<2)return;
 const bar=document.createElement('div');bar.id='aeProductsCompact';bar.className='ae-products-compact-bar';
 const make=(label)=>{const el=document.createElement('button');el.type='button';el.textContent=label;return el};
 const showList=make('Ver catálogo'),showForm=make('Abrir editor'),filterButton=make('Filtros avançados');
 bar.append(showList,showForm,filterButton);
 const summary=document.getElementById('productsSummary');
 (summary||hero).after(bar);
 let active='list',advanced=false;
 function select(which){
   active=which;form.hidden=which!=='editor';list.hidden=which!=='list';
   showList.setAttribute('aria-pressed',String(which==='list'));
   showForm.setAttribute('aria-pressed',String(which==='editor'));
 }
 function filtersApply(){
   // Nunca apaga valores de filtros já escolhidos.
   filters.forEach((group,i)=>{group.hidden=i>0&&!advanced});
   filterButton.setAttribute('aria-expanded',String(advanced));
   filterButton.textContent=advanced?'Recolher filtros':'Filtros avançados';
 }
 showList.addEventListener('click',()=>select('list'));
 showForm.addEventListener('click',()=>select('editor'));
 filterButton.addEventListener('click',()=>{advanced=!advanced;filtersApply()});
 // Editar é uma ação original da listagem: mostrar o editor antes de executar o handler.
 root.addEventListener('click',e=>{
   const action=e.target.closest?.('[onclick]');
   if(!action)return;
   const source=action.getAttribute('onclick')||'';
   if(source.includes('editProduct('))select('editor');
   if(source.includes('cancelProductEditV145('))select('list');
 },true);
 // Se um filtro avançado estiver ativo, mantê-lo visível no carregamento.
 const secondary=[...filters].slice(1).flatMap(g=>[...g.querySelectorAll('select')]);
 advanced=secondary.some(el=>el.value&&el.value!=='all'&&el.value!=='active');
 filtersApply();
 const cancel=document.getElementById('productCancelEditBtnV145');
 const editing=cancel&&!cancel.classList.contains('hidden');
 select(editing?'editor':'list');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
