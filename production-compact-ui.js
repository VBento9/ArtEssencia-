/* ArtEssencia Production UI: progressive display only; no production logic changes. */
(function(){'use strict';
function init(){
 const root=document.getElementById('production'),stack=root?.querySelector('.production-stack-v1729');
 if(!stack||document.getElementById('aeProductionTabs'))return;
 const sections=[...stack.querySelectorAll(':scope > .production-section-v1729')];
 const ids=['productionOrders','productionProducts','productionRecipe','productionStockCheck','productionPackaging','productionHistory'];
 if(sections.length!==ids.length||sections.some((s,i)=>!s.querySelector('#'+ids[i])))return;
 const tabbar=document.createElement('nav');tabbar.id='aeProductionTabs';tabbar.className='ae-production-tabs';tabbar.setAttribute('aria-label','Vistas da produção');
 const labels=['Encomendas','Por produto','Materiais','Stock','Embalagens','Concluídas'];
 const buttons=labels.map((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>show(i));tabbar.append(b);return b});
 stack.before(tabbar);
 function show(i){sections.forEach((s,j)=>{s.hidden=j!==i;buttons[j].setAttribute('aria-pressed',String(i===j))})}
 // O resumo operacional e os alertas acima desta navegação permanecem sempre visíveis.
 show(0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();