import * as db from './db.js';
import {el,kpi,section} from './ui.js';

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

async function readEditorialContext(){
  const [products,collections]=await Promise.all([
    db.all('products'),
    db.all('collections')
  ]);
  const eligible=products.filter(p=>p&&p.active!==false&&p.published===true);
  const withImage=eligible.filter(p=>Boolean(p.image_url||p.imageUrl||p.image));
  const activeCollections=collections.filter(c=>isActiveCollection(c));
  return {eligible,withImage,activeCollections};
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
      el('div',{class:'card'},
        section('Assistente de Marketing','Leitura editorial preparada sem alterar os dados existentes.'),
        el('p',{class:'muted'},'O módulo consulta produtos e coleções apenas para identificar conteúdo elegível. Não grava produtos, não altera publicação e não participa no Cloud Sync.'),
        el('div',{class:'notice'},'Próxima fase: combinar estes produtos com os sinais agregados do Catálogo para sugerir oportunidades. Ainda não existe geração automática nem publicação na Meta.')
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
