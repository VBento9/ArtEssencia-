/* ArtEssencia 1.9.67: comparação de períodos, apenas leitura Cloud. */
(()=>{'use strict';
const el=id=>document.getElementById(id);
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const fmt=v=>num(v).toLocaleString('pt-PT');
const iso=d=>d.toISOString().slice(0,10);
let seq=0,source='',range=null;
function render(st,prior){
 const box=el('digitalCompareResultV1967');if(!box)return;
 const a=st?.data?.totals,b=prior?.totals;
 if(!a||!b){box.textContent='Não existem totais suficientes para uma comparação válida.';return}
 const metrics=source==='shop'?[['Sessões','sessions'],['Produtos vistos','product_views'],['Carrinhos','add_to_cart'],['Pedidos enviados','order_submitted']]:[['Sessões','sessions'],['Produtos vistos','product_views'],['Favoritos','favorite_adds'],['Contactos','contact_clicks']];
 box.replaceChildren();
 for(const [label,key] of metrics){
   const current=num(a[key]),old=num(b[key]),card=document.createElement('div');
   card.className='ae-compare-metric-v1967';
   const title=document.createElement('span');title.textContent=label;
   const value=document.createElement('strong');value.textContent=fmt(current);
   const note=document.createElement('small');note.textContent='Anterior: '+fmt(old)+' · '+(old?((100*(current-old)/old).toLocaleString('pt-PT',{maximumFractionDigits:1})+'%'):'Sem base percentual');
   card.append(title,value,note);box.append(card)
 }
 const note=document.createElement('p');note.className='ae-compare-note-v1967';
 note.textContent='Intervalos com igual duração. As variações são eventos registados, não vendas atribuídas a uma campanha.';
 box.append(note);
}
async function update(){
 const st=typeof digitalStatsStateV1795==='undefined'?null:digitalStatsStateV1795;
 const box=el('digitalCompareResultV1967');if(!box)return;
 const id=++seq;
 if(!st?.data||typeof digitalStatsRangeV1795!=='function'){box.textContent='Seleciona um período com dados válidos para comparar.';return}
 range=digitalStatsRangeV1795();source=st.source;
 const from=new Date(range.from+'T00:00:00Z'),to=new Date(range.to+'T00:00:00Z');
 const len=Math.round((to-from)/86400000)+1;
 if(!Number.isFinite(len)||len<1||len>366){box.textContent='Intervalo não comparável.';return}
 const previousEnd=new Date(from.getTime()-86400000),previousStart=new Date(from.getTime()-len*86400000);
 box.textContent='A consultar o período anterior ('+iso(previousStart)+' a '+iso(previousEnd)+')…';
 try{
  if(typeof cloudClient==='undefined'||!cloudClient)throw Error('Cloud indisponível');
  const {data,error}=await cloudClient.rpc('artessencia_analytics_summary_v1',{p_source:source,p_from:iso(previousStart),p_to:iso(previousEnd)});
  if(id!==seq)return;
  if(error)throw Error('Consulta ao período anterior sem sucesso');
  render(st,data);
 }catch(e){if(id===seq)box.textContent=e.message||'Falha na comparação'}
}
function init(){
 const root=el('digitalStats'),nav=el('dsNavigationV1966');
 if(!root||!nav||el('digitalCompareResultV1967'))return;
 const pane=root.querySelector('[data-ds-panel="resumo"]');if(!pane)return;
 const block=document.createElement('section');block.className='ae-compare-v1967';
 const heading=document.createElement('div');heading.className='ae-compare-head-v1967';
 const title=document.createElement('strong');title.textContent='Comparação com o período anterior';
 const refresh=document.createElement('button');refresh.type='button';refresh.className='btn';refresh.textContent='Recalcular';refresh.addEventListener('click',update);
 heading.append(title,refresh);const result=document.createElement('div');result.id='digitalCompareResultV1967';result.className='ae-compare-grid-v1967';result.textContent='Atualiza as estatísticas para comparar.';
 block.append(heading,result);pane.prepend(block);
 document.addEventListener('ae:digital-stats-loaded',update);
 document.addEventListener('ae:digital-stats-start',()=>{seq++;result.textContent='A atualizar os dados…'});
 if(typeof digitalStatsStateV1795!=='undefined'&&digitalStatsStateV1795.data)update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();