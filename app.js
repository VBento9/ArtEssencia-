import {views} from './views.js';
import {qs,el} from './ui.js';
import {openDB} from './db.js';

const nav=[
 {group:'Hoje',items:[['today','Hoje','🏠']]},
 {group:'Atelier',items:[['atelier','Atelier','🕯️'],['orders','Encomendas','🧾']]},
 {group:'Gestão',items:[['catalog','Catálogo','✨'],['materials','Materiais','📦'],['clients','Clientes','👥'],['finance','Finanças','€'],['reports','Relatórios','📊']]},
 {group:'Loja',items:[['shop','Loja futura','🛍️']]},
 {group:'Sistema',items:[['audit','Auditoria 360º','🛡️'],['settings','Configuração','⚙️']]}
];
const titles={today:['Hoje','O que precisa da tua atenção no atelier.'],atelier:['Atelier','Produção artesanal e acompanhamento por etapas.'],orders:['Encomendas','Orçamentos, pedidos, personalizações e entregas.'],catalog:['Catálogo','Produtos, fichas técnicas, custos e preços.'],materials:['Materiais & Stock','Matérias-primas, custos médios e compras.'],clients:['Clientes','Histórico e informação dos teus clientes.'],finance:['Finanças','Visão financeira separada dos custos de produção.'],reports:['Relatórios','Indicadores do negócio e vendas.'],shop:['Loja','Preparação da futura loja online ArtEssencia.'],audit:['Auditoria 360º','Verifica integridade, custos, stock e relações.'],settings:['Configuração','Versões, backups e base ArtEssencia.']};
let state={view:'today',version:null,opts:{}};
async function loadVersion(){try{state.version=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())}catch{state.version={app:'1.0.0',schema:'1.0.0'}}qs('#appVersion').textContent=`v${state.version.app}`}
function buildNav(){const side=qs('#sidebarNav');side.innerHTML='';for(const g of nav){side.append(el('div',{class:'nav-group'},g.group));for(const [id,label,icon] of g.items){side.append(el('button',{class:`nav-btn ${state.view===id?'active':''}`,type:'button',onclick:()=>go(id)},icon,el('span',{},label)))}}const mobile=qs('#mobileNav');mobile.innerHTML='';for(const [id,label,icon] of [['today','Hoje','🏠'],['atelier','Atelier','🕯️'],['orders','Encomendas','🧾'],['catalog','Catálogo','✨'],['settings','Mais','☰']])mobile.append(el('button',{class:state.view===id?'active':'',type:'button',onclick:()=>go(id)},el('div',{},icon),label));}
async function render(){buildNav();const [title,sub]=titles[state.view]||titles.today;qs('#pageTitle').textContent=title;qs('#pageSubtitle').textContent=sub;const view=qs('#view');view.innerHTML='<div class="empty">A carregar…</div>';const ctx={go,refresh:render,version:state.version};try{view.innerHTML='';view.append(await views[state.view](ctx,state.opts||{}));state.opts={};}catch(e){console.error(e);view.innerHTML=`<div class="card"><h3>Erro</h3><p>${String(e.message||e)}</p></div>`}}
function go(view,opts={}){state.view=view;state.opts=opts;history.replaceState(null,'',`#${view}`);render()}
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views[v]){state.view=v;render()}});
qs('#quickAdd').addEventListener('click',()=>go(state.view==='catalog'?'catalog':state.view==='materials'?'materials':'orders',{create:true}));
qs('#auditTop').addEventListener('click',()=>go('audit'));
(async()=>{await openDB();await loadVersion();const h=location.hash.slice(1);if(views[h])state.view=h;await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);})();
