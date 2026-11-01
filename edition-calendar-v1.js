/* ArtEssencia — calendário anual editorial. Sugestões locais, sem escrever na Cloud. */
(()=>{
 'use strict';
 let selectedYear=null,showSecondary=false;
 const pad=n=>String(n).padStart(2,'0');
 const fixed=(year,month,day)=>year+'-'+pad(month)+'-'+pad(day);
 const easter=year=>{
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);
  const value=h+l-7*m+114;return fixed(year,Math.floor(value/31),value%31+1);
 };
 const firstSundayMay=year=>fixed(year,5,1+(7-new Date(Date.UTC(year,4,1,12)).getUTCDay())%7);
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
 const proposals=(y,shift)=>{
  const p=(name,type,target,days,aliases)=>({name,type,target,launch:shift(target,-days),aliases});
  return [
   p('São Valentim','Principal',fixed(y,2,14),27,['sao valentim','valentim','amor']),
   p('Dia do Pai','Complementar',fixed(y,3,19),25,['dia do pai']),
   p('Páscoa','Principal',easter(y),27,['pascoa']),
   p('Primavera & Flores','Complementar',fixed(y,3,21),7,['primavera']),
   p('Dia da Mãe','Principal',firstSundayMay(y),27,['dia da mae']),
   p('Verão & Aromas Frescos','Principal',fixed(y,6,21),14,['verao','summer']),
   p('Dia dos Avós','Complementar',fixed(y,7,26),21,['avos']),
   p('Outono — Colheita','Complementar',fixed(y,9,22),16,['outono','colheita']),
   p('Halloween','Principal',fixed(y,10,31),27,['halloween']),
   p('Natal','Principal',fixed(y,12,25),y===2026?46:54,['natal','natividade'])
  ].sort((a,b)=>a.launch.localeCompare(b.launch));
 };
 function matchEdition(item,ed,year){
  const name=key(ed.name);
  if(!item.aliases.some(a=>name.includes(a)))return false;
  const edYear=String(ed.start||ed.end||'').slice(0,4);
  if(edYear)return Number(edYear)===year;
  const inName=String(ed.name).match(/20\d{2}/);
  return !!inName&&Number(inName[0])===year;
 }
 window.aeSeasonalCalendarV1=ctx=>{
  const {body,editions,tasks,today,shift,pretty,node,button,createEditionPlan,updateEditions,renderEditionPlanning,render}=ctx;
  const currentYear=Number(today().slice(0,4));
  if(selectedYear===null)selectedYear=currentYear;
  selectedYear=Math.max(currentYear,Math.min(currentYear+4,selectedYear));
  const heading=node('div','ae-season-heading');
  const headingText=node('div');
  headingText.append(node('h3','','Calendário anual das edições'),node('p','ae-tm-subtext','Sugestões de datas para planear coleções. Não criam edições, tarefas ou publicações automaticamente.'));
  heading.append(headingText);
  heading.append(button('Abrir Edições Especiais',()=>{if(typeof go==='function')go('specialEditions')},'primary'));
  body.append(heading);
  const bar=node('div','ae-season-tools');
  const prev=button('‹ '+(selectedYear-1),()=>{selectedYear--;render()});prev.disabled=selectedYear<=currentYear;
  const next=button((selectedYear+1)+' ›',()=>{selectedYear++;render()});next.disabled=selectedYear>=currentYear+4;
  bar.append(prev,node('strong','',String(selectedYear)),next,
   button(showSecondary?'Apenas principais':'Ver todas',()=>{showSecondary=!showSecondary;render()}));
  body.append(bar);
  if(selectedYear===currentYear)body.append(node('p','ae-season-notice','As datas passadas ficam visíveis no histórico de '+selectedYear+'. Para planeares o ano seguinte, seleciona '+(selectedYear+1)+'.'));
  const proposalsForYear=proposals(selectedYear,shift).filter(p=>showSecondary||p.type==='Principal');
  const grid=node('div','ae-season-grid');
  for(const item of proposalsForYear){
   const actual=editions.find(ed=>matchEdition(item,ed,selectedYear))||null;
   const card=node('article','ae-season-card'+(actual?' is-linked':''));
   const header=node('div','ae-season-card-head');
   header.append(node('strong','',item.name+' '+selectedYear),node('span','ae-season-type',item.type));
   card.append(header);
   const launch=actual?.start||item.launch;
   card.append(node('p','','Lançamento '+(actual?'definido':'sugerido')+': '+pretty(launch)+' · Data a celebrar: '+pretty(item.target)));
   if(actual?.start&&actual.start!==item.launch)card.append(node('small','','Sugestão inicial: '+pretty(item.launch)+'. A data guardada na edição prevalece.'));
   const related=actual?tasks.filter(t=>String(t.edition_id||'')===actual.id):[];
   card.append(node('small','',actual?'Edição existente · '+related.filter(t=>t.status!=='concluida').length+' tarefas pendentes ligadas':'Sugestão · sem edição guardada'));
   if(actual?.start){
    card.append(button('Preparar tarefas',()=>createEditionPlan(actual)));
   }else{
    card.append(button('Abrir edições',()=>{if(typeof go==='function')go('specialEditions')}));
   }
   grid.append(card);
  }
  body.append(grid);
  body.append(node('p','ae-tm-subtext','Prioriza seis lançamentos principais. As datas complementares podem ser trabalhadas com mini-coleções ou boxes, sem criar uma campanha grande para cada ocasião.'));
  renderEditionPlanning();
 };
})();
