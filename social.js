import * as db from './db.js';
import * as cloud from './cloud.js';
import {el,kpi,section,badge,table,esc} from './ui.js';

const TABS=[
  ['today','Hoje'],
  ['calendar','Calendário'],
  ['create','Criar com IA'],
  ['publications','Publicações'],
  ['settings','Definições']
];

function tabs(ctx,active){
  const bar=el('div',{class:'tabs'});
  for(const [id,label] of TABS){
    bar.append(el('button',{
      class:`tab ${active===id?'active':''}`,
      type:'button',
      onclick:()=>ctx.go('social',{tab:id})
    },label));
  }
  return bar;
}

function placeholder(title,description){
  return el('div',{class:'card'},
    section(title,description),
    el('div',{class:'notice'},'Estrutura V1 preparada. IA, Meta e persistência ainda não estão ativas.')
  );
}

function isActiveCollection(c,now=new Date()){
  if(c?.active===false)return false;
  const start=c?.startDate||c?.start||null;
  const end=c?.endDate||c?.end||null;
  if(start&&new Date(start)>now)return false;
  if(end&&new Date(end)<now)return false;
  return true;
}

function productImage(p){
  return p?.image_url||p?.imageUrl||p?.image||'';
}

function metricForProduct(product,analytics){
  const refs=new Set([product.id,product.sku,product.code,product.backoffice_product_id].filter(Boolean).map(String));
  return (analytics?.top_products||[]).find(m=>refs.has(String(m.product_id||'')))||null;
}

function editorialOpportunity(product,activeCollections,analytics){
  const memberships=activeCollections.filter(c=>(c.productIds||[]).includes(product.id));
  const featured=memberships.some(c=>c.featured);
  const metrics=metricForProduct(product,analytics);
  let score=10;
  const reasons=['Produto publicado e ativo'];
  let objective='Descoberta';

  if(productImage(product)){
    score+=15;
    reasons.push('Tem fotografia disponível');
  }
  if(memberships.length){
    score+=30;
    objective='Campanha';
    reasons.push(`Integra ${memberships.length} edição(ões) ativa(s)`);
  }
  if(featured){
    score+=25;
    objective='Campanha';
    reasons.push('Pertence a uma edição em destaque');
  }
  if(metrics){
    const views=Number(metrics.views||0),favorites=Number(metrics.favorites||0),shares=Number(metrics.shares||0),contacts=Number(metrics.contacts||0);
    const interest=Math.min(30,Math.round(Math.log2(views+1)*4)+favorites*3+shares*2+contacts*4);
    score+=interest;
    if(favorites||shares||contacts){objective='Conversão';reasons.push(`Interesse real: ${favorites} favorito(s), ${shares} partilha(s), ${contacts} contacto(s)`)}
    else if(views){reasons.push(`${views} visualização(ões) no Catálogo`)}
  }

  return {
    product,
    score:Math.min(score,100),
    objective,
    collections:memberships.map(c=>c.name).filter(Boolean),
    reasons,
    metrics
  };
}

async function readEditorialContext(){
  const [products,collections]=await Promise.all([
    db.all('products'),
    db.all('collections')
  ]);
  const eligible=products.filter(p=>p&&p.active!==false&&p.published===true);
  const withImage=eligible.filter(p=>Boolean(productImage(p)));
  const activeCollections=collections.filter(c=>isActiveCollection(c));
  let analytics=null,analyticsError='';
  try{analytics=await cloud.analyticsSummary('catalog',null,null)}catch(e){analyticsError=String(e?.message||e||'Estatísticas indisponíveis')}
  const opportunities=eligible
    .map(p=>editorialOpportunity(p,activeCollections,analytics))
    .sort((a,b)=>b.score-a.score||String(a.product.name||'').localeCompare(String(b.product.name||''),'pt'));
  return {eligible,withImage,activeCollections,opportunities,analytics,analyticsError};
}

function opportunityPanel(items){
  const card=el('div',{class:'card'},
    section('Oportunidades editoriais','Ranking local baseado apenas em dados já existentes no Backoffice.')
  );
  if(!items.length){
    card.append(el('div',{class:'empty'},'Não existem produtos publicados e ativos elegíveis.'));
    return card;
  }
  card.append(table(
    ['Produto','Objetivo','Prioridade','Sinais 30 dias','Contexto','Motivo'],
    items.slice(0,10).map(x=>[
      esc(x.product.name||x.product.sku||'Produto'),
      badge(x.objective,x.objective==='Campanha'?'warn':'info'),
      `${x.score}/100`,
      x.metrics?esc(`${Number(x.metrics.views||0)} vistas · ${Number(x.metrics.favorites||0)} fav. · ${Number(x.metrics.contacts||0)} contactos`):'—',
      esc(x.collections.join(', ')||'Catálogo geral'),
      esc(x.reasons.slice(-2).join(' · '))
    ])
  ));
  card.append(el('p',{class:'small muted',style:'margin-top:10px'},
    'Os sinais apresentados vêm do resumo agregado e autenticado do Catálogo. Produtos fora do Top 15 aparecem sem métricas; isso não significa que tenham zero visualizações.'
  ));
  return card;
}

export async function socialView(ctx,opts={}){
  const active=opts.tab||'today';
  const root=el('div',{class:'grid'});
  root.append(tabs(ctx,active));

  if(active==='today'){
    const editorial=await readEditorialContext();
    root.append(
      el('div',{class:'grid cols-4'},
        kpi('Produtos elegíveis',editorial.eligible.length,'Publicados e ativos','✨'),
        kpi('Com fotografia',editorial.withImage.length,'Prontos para conteúdo visual','📷'),
        kpi('Coleções ativas',editorial.activeCollections.length,'Contexto sazonal disponível','✦'),
        kpi('Custo IA','€0,00','IA ainda desligada','€')
      ),
      editorial.analyticsError?el('div',{class:'notice warn'},`Estatísticas do Catálogo indisponíveis: ${editorial.analyticsError}. O ranking continua apenas com dados editoriais locais.`):null,
      opportunityPanel(editorial.opportunities),
      el('div',{class:'card'},
        section('Assistente de Marketing','Leitura editorial preparada sem alterar os dados existentes.'),
        el('p',{class:'muted'},'O módulo consulta produtos e coleções apenas para identificar conteúdo elegível. Não grava produtos, não altera publicação e não participa no Cloud Sync.'),
        el('div',{class:'notice'},'As métricas do Catálogo entram apenas de forma agregada. O histórico de publicações sociais ainda não existe, por isso o sistema continua sem afirmar que um produto já foi promovido.')
      )
    );
  }else if(active==='calendar'){
    root.append(placeholder('Calendário editorial','Planeamento semanal de Posts, Stories e Reels.'));
  }else if(active==='create'){
    root.append(placeholder('Criar com IA','Geração assistida de conteúdo a partir dos dados públicos dos produtos.'));
  }else if(active==='publications'){
    root.append(placeholder('Publicações','Rascunhos, conteúdos em aprovação e histórico editorial.'));
  }else{
    root.append(placeholder('Definições','Frequência, distribuição editorial, aprovação e limite de utilização da IA.'));
  }
  return root;
}
