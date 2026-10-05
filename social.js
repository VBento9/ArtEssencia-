import {el,button,kpi,section} from './ui.js';

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

export async function socialView(ctx,opts={}){
  const active=opts.tab||'today';
  const root=el('div',{class:'grid'});
  root.append(tabs(ctx,active));

  if(active==='today'){
    root.append(
      el('div',{class:'grid cols-4'},
        kpi('A aguardar aprovação','0','Conteúdos preparados','✓'),
        kpi('Planeados esta semana','0','Calendário editorial','📅'),
        kpi('Publicados','0','Nesta versão','↗'),
        kpi('Custo IA','€0,00','Limite ainda não configurado','✦')
      ),
      el('div',{class:'card'},
        section('Assistente de Marketing','O módulo social fica isolado do funcionamento operacional da ArtEssencia.'),
        el('p',{class:'muted'},'Na V1, o assistente irá analisar produtos, coleções e sinais do Catálogo apenas em leitura para propor conteúdos que continuam sujeitos a aprovação.')
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
