import {views} from './views.js';
import {qs,el,modal,input,field} from './ui.js';
import * as db from './db.js';
import * as cloud from './cloud.js';

const NAV=[
  {group:'Hoje',items:[['today','Hoje','⌂'],['sale','Nova venda','＋']]},
  {group:'Atelier',items:[['atelier','Atelier','🕯️'],['orders','Encomendas','🧾'],['quotes','Orçamentos','📄']]},
  {group:'Produtos & custos',items:[['products','Produtos','✨'],['costs','Custos & preços','€'],['stock','Stock','📦'],['purchases','Compras','🛒']]},
  {group:'Negócio',items:[['clients','Clientes','👥'],['cash','Caixa & pagamentos','💶'],['reports','Relatórios','📊']]},
  {group:'Loja futura',items:[['catalogs','Catálogos & Criador','🎁'],['specialEditions','Edições Especiais','✦'],['homepage','Homepage','🏠'],['campaigns','Campanhas','🔔'],['delivery','Entregas Loja','📅']]},
  {group:'Sistema',items:[['settings','Configuração','⚙️'],['cloud','Cloud Sync','☁️'],['backup','Backup','⬇️'],['audit','Auditoria 360º','✓']]}
]
const META={
 today:['ATELIER','Hoje','O que precisa da tua atenção no atelier.'],sale:['COMERCIAL','Nova venda','Regista rapidamente uma encomenda presencial ou direta.'],atelier:['PRODUÇÃO','Atelier','Produção artesanal organizada por etapas.'],orders:['COMERCIAL','Encomendas','Pedidos, pagamentos, personalizações e entregas.'],quotes:['COMERCIAL','Orçamentos','Cria, acompanha e converte propostas em encomendas.'],products:['CATÁLOGO','Produtos','Produtos, fichas técnicas, publicação e preços.'],costs:['RENTABILIDADE','Custos & preços','Motor de custos e margem real por produto.'],stock:['STOCK','Stock','Níveis, movimentos, alertas e histórico.'],purchases:['STOCK','Compras','Entradas de matéria e atualização automática do custo médio.'],clients:['CLIENTES','Clientes','Histórico comercial e contactos.'],cash:['FINANÇAS','Caixa & pagamentos','Entradas, pagamentos, despesas, investimentos e transferências.'],reports:['ANÁLISE','Relatórios','Vendas, contribuição, meios de pagamento e valor em stock.'],catalogs:['LOJA','Catálogos & Criador','Temas, ocasiões, cores, personalizações e preços do criador.'],specialEditions:['LOJA','Edições Especiais','Coleções sazonais com datas, produtos e destaque.'],homepage:['LOJA','Homepage','Conteúdo e pré-visualização da futura loja.'],campaigns:['LOJA','Campanhas','Marketing e notificações preparadas para a Cloud.'],delivery:['LOJA','Entregas Loja','Métodos, capacidade, antecedência e dias indisponíveis.'],settings:['SISTEMA','Configuração','Parâmetros editáveis do atelier e da operação.'],cloud:['SISTEMA','Cloud Sync','Sincronização ArtEssencia entre dispositivos.'],backup:['SISTEMA','Backup','Exportação, importação e segurança dos dados.'],audit:['SISTEMA','Auditoria 360º','Verificação completa da integridade da aplicação.']
}
let state={view:'today',opts:{},version:{app:'2.0.0',schema:'1.0.0'}};

async function loadVersion(){try{state.version=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())}catch{}qs('#appVersion').textContent=`v${state.version.app}`}
function buildNav(){
  const side=qs('#sidebarNav');side.innerHTML='';
  for(const g of NAV){side.append(el('div',{class:'nav-section'},g.group));for(const [id,label,icon] of g.items)side.append(el('button',{class:`nav-btn ${state.view===id?'active':''}`,type:'button',onclick:()=>go(id)},el('span',{class:'nav-icon'},icon),el('span',{},label)))}
  const mobile=qs('#mobileNav');mobile.innerHTML='';for(const [id,label,icon]of[['today','Hoje','⌂'],['atelier','Atelier','🕯️'],['orders','Pedidos','🧾'],['products','Produtos','✨'],['settings','Mais','☰']])mobile.append(el('button',{class:state.view===id?'active':'',type:'button',onclick:()=>go(id)},el('span',{},icon),label));
}
async function updateCloudPill(){try{const s=await cloud.status();const b=qs('#cloudMini');if(!b)return;b.querySelector('span:last-child').textContent=s.loggedIn?'Cloud ligada':s.configured?'Cloud pronta':'Base local';}catch{}}
async function render(){
  buildNav();const [context,title,sub]=META[state.view]||META.today;qs('#pageContext').textContent=context;qs('#pageTitle').textContent=title;qs('#pageSubtitle').textContent=sub;
  updateCloudPill();
  const view=qs('#view');view.innerHTML='<div class="empty">A carregar…</div>';try{view.innerHTML='';view.append(await views[state.view]({go,refresh:render,version:state.version},state.opts||{}));state.opts={}}catch(e){console.error(e);view.innerHTML=`<div class="card"><h3>Erro ao abrir módulo</h3><p>${String(e.message||e)}</p></div>`}
}
export function go(view,opts={}){if(!views[view])return;state.view=view;state.opts=opts;history.replaceState(null,'',`#${view}`);render()}
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views[v]){state.view=v;render()}});
qs('#quickAdd').onclick=()=>go(state.view==='products'?'products':state.view==='materials'?'purchases':'orders',{create:true});
qs('#auditTop').onclick=()=>go('audit');
qs('#cloudMini').onclick=()=>go('cloud');
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
