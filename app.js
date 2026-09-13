import {views} from './views.js';
import {qs,el,modal,input,field} from './ui.js';
import * as db from './db.js';

const NAV=[
  {group:'Hoje',items:[['today','Hoje','⌂']]},
  {group:'Atelier',items:[['atelier','Atelier','🕯️'],['orders','Encomendas','🧾']]},
  {group:'Produtos & custos',items:[['products','Produtos','✨'],['costs','Custos & preços','€'],['materials','Materiais & Stock','📦'],['purchases','Compras','🛒']]},
  {group:'Negócio',items:[['clients','Clientes','👥'],['cash','Caixa & despesas','💶'],['reports','Relatórios','📊']]},
  {group:'Loja futura',items:[['shop','Loja & coleções','🛍️']]},
  {group:'Sistema',items:[['audit','Auditoria 360º','✓'],['settings','Configuração','⚙️']]}
];
const META={
 today:['ATELIER','Hoje','O que precisa da tua atenção no atelier.'],
 atelier:['PRODUÇÃO','Atelier','Produção artesanal organizada por etapas.'],
 orders:['COMERCIAL','Encomendas','Orçamentos, pedidos, personalizações e entregas.'],
 products:['CATÁLOGO','Produtos','Produtos, fichas técnicas, publicação e preços.'],
 costs:['RENTABILIDADE','Custos & preços','Motor de custos e margem real por produto.'],
 materials:['STOCK','Materiais & Stock','Matérias-primas, níveis, custos médios e alertas.'],
 purchases:['STOCK','Compras','Entradas de matéria e atualização automática do custo médio.'],
 clients:['CLIENTES','Clientes','Histórico comercial e contactos.'],
 cash:['FINANÇAS','Caixa & despesas','Entradas, saídas, despesas e investimentos.'],
 reports:['ANÁLISE','Relatórios','Vendas, contribuição e valor em stock.'],
 shop:['LOJA','Loja & coleções','Preparação do catálogo público e operação online.'],
 audit:['SISTEMA','Auditoria 360º','Verificação completa da integridade da aplicação.'],
 settings:['SISTEMA','Configuração','Versões, backups e futura base Supabase.']
};
let state={view:'today',opts:{},version:{app:'2.0.0',schema:'1.0.0'}};

async function loadVersion(){try{state.version=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())}catch{}qs('#appVersion').textContent=`v${state.version.app}`}
function buildNav(){
  const side=qs('#sidebarNav');side.innerHTML='';
  for(const g of NAV){side.append(el('div',{class:'nav-section'},g.group));for(const [id,label,icon] of g.items)side.append(el('button',{class:`nav-btn ${state.view===id?'active':''}`,type:'button',onclick:()=>go(id)},el('span',{class:'nav-icon'},icon),el('span',{},label)))}
  const mobile=qs('#mobileNav');mobile.innerHTML='';for(const [id,label,icon]of[['today','Hoje','⌂'],['atelier','Atelier','🕯️'],['orders','Pedidos','🧾'],['products','Produtos','✨'],['settings','Mais','☰']])mobile.append(el('button',{class:state.view===id?'active':'',type:'button',onclick:()=>go(id)},el('span',{},icon),label));
}
async function render(){
  buildNav();const [context,title,sub]=META[state.view]||META.today;qs('#pageContext').textContent=context;qs('#pageTitle').textContent=title;qs('#pageSubtitle').textContent=sub;
  const view=qs('#view');view.innerHTML='<div class="empty">A carregar…</div>';try{view.innerHTML='';view.append(await views[state.view]({go,refresh:render,version:state.version},state.opts||{}));state.opts={}}catch(e){console.error(e);view.innerHTML=`<div class="card"><h3>Erro ao abrir módulo</h3><p>${String(e.message||e)}</p></div>`}
}
export function go(view,opts={}){if(!views[view])return;state.view=view;state.opts=opts;history.replaceState(null,'',`#${view}`);render()}
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views[v]){state.view=v;render()}});
qs('#quickAdd').onclick=()=>go(state.view==='products'?'products':state.view==='materials'?'purchases':'orders',{create:true});
qs('#auditTop').onclick=()=>go('audit');
qs('#cloudMini').onclick=()=>go('settings');
qs('#searchBtn').onclick=async()=>globalSearch();

async function globalSearch(){
  const box=el('div',{class:'grid'}),q=input('q','','search',{placeholder:'Produto, cliente, encomenda, matéria…'}),results=el('div',{class:'grid'});box.append(field('Pesquisa',q,true),results);
  const search=async()=>{results.innerHTML='';const term=q.value.trim().toLowerCase();if(term.length<2){results.append(el('div',{class:'empty'},'Escreve pelo menos 2 caracteres.'));return}
    const sets=await Promise.all(['products','clients','orders','materials'].map(db.all));const found=[];
    sets[0].filter(x=>`${x.name} ${x.sku}`.toLowerCase().includes(term)).forEach(x=>found.push(['products',`✨ ${x.name}`,x.sku||'Produto']));
    sets[1].filter(x=>`${x.name} ${x.phone} ${x.email}`.toLowerCase().includes(term)).forEach(x=>found.push(['clients',`👥 ${x.name}`,x.phone||x.email||'Cliente']));
    sets[2].filter(x=>`${x.number} ${x.status}`.toLowerCase().includes(term)).forEach(x=>found.push(['orders',`🧾 ${x.number}`,x.status]));
    sets[3].filter(x=>`${x.name} ${x.category}`.toLowerCase().includes(term)).forEach(x=>found.push(['materials',`📦 ${x.name}`,x.category||'Matéria']));
    if(!found.length)results.append(el('div',{class:'empty'},'Sem resultados.'));for(const [v,t,s]of found.slice(0,20))results.append(el('button',{class:'quick-card',type:'button',onclick:()=>{document.querySelector('#modalRoot').innerHTML='';go(v)}},el('strong',{},t),el('small',{},s)));
  };q.oninput=search;modal('Pesquisa rápida',box,{wide:true});setTimeout(()=>q.focus(),50)
}
(async()=>{await db.openDB();await loadVersion();const h=location.hash.slice(1);if(views[h])state.view=h;await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn)})();
