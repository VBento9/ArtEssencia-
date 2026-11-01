/* ArtEssencia — sugestões de preenchimento por ocasião (UI local, sem escrita Cloud). */
(()=>{'use strict';
const templates=[
{id:'natal',name:'Natal',keys:['natal','christmas','natividade'],type:'fixed',month:12,day:25,lead:54,cut:12,emoji:'🎄',badge:'COLEÇÃO DE NATAL',theme:'natal',subtitle:'O espírito do Natal em velas, aromas e peças artesanais para decorar ou oferecer.',hero:'O Natal ganha forma na ArtEssencia',cta:'Descobrir o Natal'},
{id:'valentim',name:'São Valentim',keys:['valentim','namorados','dia do amor'],type:'fixed',month:2,day:14,lead:27,cut:7,emoji:'❤️',badge:'ESPECIAL SÃO VALENTIM',theme:'namorados',subtitle:'Pequenos gestos, fragrâncias envolventes e criações feitas para celebrar o amor.',hero:'Um presente com significado para São Valentim',cta:'Descobrir a coleção'},
{id:'pai',name:'Dia do Pai',keys:['dia do pai'],type:'fixed',month:3,day:19,lead:25,cut:7,emoji:'🤎',badge:'DIA DO PAI',theme:'artessencia',subtitle:'Presentes artesanais para agradecer a quem está sempre presente, com simplicidade e personalidade.',hero:'Para o pai, uma lembrança com significado',cta:'Ver sugestões'},
{id:'pascoa',name:'Páscoa',keys:['páscoa','pascoa'],type:'easter',lead:27,cut:7,emoji:'🐣',badge:'EDIÇÃO DE PÁSCOA',theme:'pascoa',subtitle:'Uma Páscoa delicada, com aromas suaves, figuras e peças artesanais que celebram a renovação.',hero:'A Páscoa floresce na ArtEssencia',cta:'Explorar a Páscoa'},
{id:'mae',name:'Dia da Mãe',keys:['dia da mãe','dia da mae'],type:'mother',lead:27,cut:7,emoji:'🌷',badge:'DIA DA MÃE',theme:'primavera',subtitle:'Criações florais e presentes artesanais pensados para agradecer com carinho.',hero:'Para a mãe, algo feito com carinho',cta:'Encontrar um presente'},
{id:'primavera',name:'Primavera',keys:['primavera','spring'],type:'fixed',month:3,day:21,lead:7,cut:0,emoji:'🌼',badge:'COLEÇÃO PRIMAVERA',theme:'primavera',subtitle:'Flores, cores suaves e fragrâncias frescas para receber uma nova estação.',hero:'Deixa a primavera entrar',cta:'Ver coleção'},
{id:'mulher',name:'Dia da Mulher',keys:['dia da mulher'],type:'fixed',month:3,day:8,lead:21,cut:7,emoji:'🌺',badge:'DIA DA MULHER',theme:'primavera',subtitle:'Uma seleção de criações para reconhecer mulheres e histórias que inspiram.',hero:'Celebrar mulheres, valorizar histórias',cta:'Descobrir sugestões'},
{id:'crianca',name:'Dia da Criança',keys:['dia da criança','dia da crianca'],type:'fixed',month:6,day:1,lead:21,cut:7,emoji:'🌈',badge:'DIA DA CRIANÇA',theme:'primavera',subtitle:'Peças decorativas e lembranças criativas para assinalar a alegria de ser criança.',hero:'Um dia cheio de imaginação',cta:'Ver sugestões'},
{id:'verao',name:'Verão',keys:['verão','verao','summer'],type:'fixed',month:6,day:21,lead:14,cut:0,emoji:'☀️',badge:'AROMAS DE VERÃO',theme:'artessencia',subtitle:'Aromas leves, notas cítricas e peças luminosas para os dias de verão.',hero:'Essências para dias de sol',cta:'Explorar aromas'},
{id:'avos',name:'Dia dos Avós',keys:['dia dos avós','dia dos avos','avós','avos'],type:'fixed',month:7,day:26,lead:21,cut:7,emoji:'🌻',badge:'DIA DOS AVÓS',theme:'primavera',subtitle:'Lembranças artesanais para celebrar memórias, histórias e afetos de família.',hero:'Um mimo especial para os avós',cta:'Ver presentes'},
{id:'outono',name:'Outono / Colheita',keys:['outono','colheita','autumn'],type:'fixed',month:9,day:22,lead:16,cut:0,emoji:'🍂',badge:'COLEÇÃO DE OUTONO',theme:'outono',subtitle:'Tons quentes e aromas reconfortantes que acompanham a chegada dos dias mais frescos.',hero:'O aconchego do outono, peça a peça',cta:'Descobrir o outono'},
{id:'halloween',name:'Halloween',keys:['halloween','bruxas','fantasmas'],type:'fixed',month:10,day:31,lead:27,cut:7,emoji:'🎃',badge:'EDIÇÃO HALLOWEEN',theme:'halloween',subtitle:'Abóboras, figuras inesperadas e fragrâncias misteriosas para uma coleção cheia de carácter.',hero:'Uma dose de encanto e travessura',cta:'Entrar na coleção'},
{id:'martinho',name:'São Martinho',keys:['martinho','magusto'],type:'fixed',month:11,day:11,lead:18,cut:5,emoji:'🌰',badge:'SÃO MARTINHO',theme:'outono',subtitle:'Aromas acolhedores e peças com os tons quentes do magusto e do outono.',hero:'O calor das pequenas tradições',cta:'Ver coleção'},
{id:'santos',name:'Dia de Todos os Santos',keys:['todos os santos','fiéis defuntos','fieis defuntos'],type:'fixed',month:11,day:1,lead:21,cut:7,emoji:'🕯️',badge:'EDIÇÃO DE MEMÓRIA',theme:'artessencia',subtitle:'Peças de inspiração religiosa e velas para momentos de homenagem, memória e serenidade.',hero:'Luz, memória e significado',cta:'Conhecer a edição'},
{id:'inverno',name:'Inverno',keys:['inverno','winter'],type:'fixed',month:12,day:21,lead:21,cut:0,emoji:'❄️',badge:'COLEÇÃO DE INVERNO',theme:'artessencia',subtitle:'Aromas intensos e velas para criar um ambiente confortável nos dias frios.',hero:'O inverno pede aconchego',cta:'Descobrir aromas'},
{id:'luzia',name:'Santa Luzia',keys:['santa luzia','luzia'],type:'fixed',month:12,day:13,lead:30,cut:7,emoji:'🕯️',badge:'SANTA LUZIA',theme:'artessencia',subtitle:'Criações de inspiração devocional para assinalar a tradição de Santa Luzia.',hero:'Uma luz de tradição e fé',cta:'Ver edição'},
{id:'reis',name:'Dia de Reis',keys:['dia de reis','reis','epifania'],type:'fixed',month:1,day:6,lead:14,cut:3,emoji:'⭐',badge:'DIA DE REIS',theme:'natal',subtitle:'Uma seleção de peças e aromas para prolongar a magia das tradições natalícias.',hero:'A tradição continua no Dia de Reis',cta:'Descobrir edição'},
{id:'ano',name:'Ano Novo',keys:['ano novo','reveillon','réveillon'],type:'fixed',month:1,day:1,lead:21,cut:5,emoji:'✨',badge:'ANO NOVO',theme:'artessencia',subtitle:'Novos começos, ambientes renovados e fragrâncias para acolher o novo ano.',hero:'Novos começos, novas essências',cta:'Descobrir coleção'},
{id:'carnaval',name:'Carnaval',keys:['carnaval'],type:'carnival',lead:18,cut:5,emoji:'🎭',badge:'CARNAVAL',theme:'personalizado',subtitle:'Formas divertidas e detalhes coloridos numa coleção criativa de Carnaval.',hero:'Criatividade em festa',cta:'Ver coleção'},
{id:'santos-populares',name:'Santos Populares',keys:['santos populares','santo antónio','santo antonio','são joão','sao joao'],type:'fixed',month:6,day:13,lead:21,cut:6,emoji:'🎏',badge:'SANTOS POPULARES',theme:'artessencia',subtitle:'Criações inspiradas nas tradições e nas festas populares portuguesas.',hero:'Tradições que merecem ser celebradas',cta:'Explorar a edição'},
{id:'flores',name:'Flores e Arranjos',keys:['flores','arranjos florais','florais'],type:'none',emoji:'💐',badge:'ARRANJOS ARTESANAIS',theme:'primavera',subtitle:'Arranjos de velas florais criados para dar cor e delicadeza à decoração ou a um presente.',hero:'Flores que guardam uma essência',cta:'Ver arranjos'},
{id:'batizado',name:'Batizado',keys:['batizado','batismo'],type:'none',emoji:'🤍',badge:'LEMBRANÇAS DE BATIZADO',theme:'artessencia',subtitle:'Lembranças personalizadas para assinalar um momento especial com delicadeza.',hero:'Pequenos detalhes para um grande momento',cta:'Ver lembranças'},
{id:'comunhao',name:'Comunhão',keys:['comunhão','comunhao','crisma'],type:'none',emoji:'🕊️',badge:'CELEBRAÇÃO ESPECIAL',theme:'artessencia',subtitle:'Peças artesanais delicadas para uma celebração de fé e partilha.',hero:'Lembranças com significado',cta:'Conhecer opções'},
{id:'casamento',name:'Casamento',keys:['casamento','noivos','bodas'],type:'none',emoji:'💍',badge:'LEMBRANÇAS DE CASAMENTO',theme:'artessencia',subtitle:'Velas e lembranças personalizadas para acompanhar a celebração de uma história a dois.',hero:'Detalhes para um dia inesquecível',cta:'Ver ideias'},
{id:'aniversario',name:'Aniversário',keys:['aniversário','aniversario'],type:'none',emoji:'🎁',badge:'EDIÇÃO DE ANIVERSÁRIO',theme:'artessencia',subtitle:'Presentes e peças personalizadas para celebrar novas memórias e mais um ano de vida.',hero:'Um aniversário com essência própria',cta:'Descobrir presentes'},
{id:'colecao',name:'Coleção ArtEssencia',keys:['artessencia','coleção','colecao','edição','edicao'],type:'none',emoji:'🕯️',badge:'COLEÇÃO ARTESSENCIA',theme:'artessencia',subtitle:'Uma seleção de criações artesanais onde as formas, os aromas e os detalhes fazem a diferença.',hero:'Criações com a essência da ArtEssencia',cta:'Conhecer a coleção'}
];
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
const iso=(y,m,d)=>y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const add=(s,d)=>{const a=new Date(s+'T12:00:00Z');a.setUTCDate(a.getUTCDate()+d);return a.toISOString().slice(0,10)};
const easter=y=>{let a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return iso(y,Math.floor(n/31),n%31+1)};
const target=(t,y)=>t.type==='none'?null:t.type==='easter'?easter(y):t.type==='mother'?iso(y,5,1+(7-new Date(Date.UTC(y,4,1,12)).getUTCDay())%7):t.type==='carnival'?add(easter(y),-47):iso(y,t.month,t.day);
const fullDate=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('pt-PT',{timeZone:'UTC',day:'numeric',month:'long'}):'';
const field=id=>document.getElementById('specialEdition'+id);
const selected=()=>{const el=field('Name');const n=norm(el?.value||'');return templates.find(t=>t.id!=='colecao'&&t.keys.some(k=>n.includes(norm(k))))||templates.find(t=>t.id==='colecao')};
function start(){
 const root=document.getElementById('specialEditions'),form=root?.querySelector('.special-editor-card-v1734'),segment=Array.from(form?.querySelectorAll('.special-form-section-v1816')||[]).find(s=>!!s.querySelector('#specialEditionSubtitle'));
 if(!root||!form||!segment||document.getElementById('aeEditionHintsV193'))return;
 const panel=document.createElement('details');panel.id='aeEditionHintsV193';panel.className='ae-edition-hints-v193';
 const summary=document.createElement('summary');summary.textContent='✦ Sugestões de preenchimento por ocasião';panel.append(summary);
 const section=document.createElement('div');section.className='ae-edition-hints-body-v193';
 const controls=document.createElement('div');controls.className='ae-edition-hints-controls-v193';
 const typeLabel=document.createElement('label');typeLabel.textContent='Ocasião';const typeSelect=document.createElement('select');typeSelect.id='aeEditionTemplateV193';
 typeSelect.add(new Option('Detetar pelo nome da edição','auto'));templates.forEach(t=>typeSelect.add(new Option(t.name,t.id)));typeLabel.append(typeSelect);
 const yearLabel=document.createElement('label');yearLabel.textContent='Ano';const yearSelect=document.createElement('select');yearSelect.id='aeEditionYearV193';
 const yearNow=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric'}).format(new Date()));
 for(let y=yearNow-1;y<=yearNow+5;y++)yearSelect.add(new Option(String(y),String(y)));
 yearLabel.append(yearSelect);controls.append(typeLabel,yearLabel);section.append(controls);
 const preview=document.createElement('div');preview.className='ae-edition-hints-preview-v193';section.append(preview);
 const actions=document.createElement('div');actions.className='ae-edition-hints-buttons-v193';
 const blanks=document.createElement('button');blanks.type='button';blanks.className='btn primary';blanks.textContent='Preencher campos vazios';
 const overwrite=document.createElement('button');overwrite.type='button';overwrite.className='btn';overwrite.textContent='Substituir textos';
 const dates=document.createElement('button');dates.type='button';dates.className='btn';dates.textContent='Sugerir datas vazias';
 actions.append(blanks,overwrite,dates);section.append(actions);
 const feedback=document.createElement('p');feedback.className='ae-edition-hints-status-v193';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');section.append(feedback);
 const help=document.createElement('small');help.textContent='Sugestões editáveis. Não altera os produtos, as capas, os preços, o estado de publicação ou registos Cloud. Só ficam guardadas ao clicar em «Guardar edição». Confirma prazos conforme a tua capacidade de produção.';section.append(help);
 panel.append(section);
 const title=segment.querySelector('.special-form-section-head-v1816');if(title)title.after(panel);else segment.prepend(panel);
 function choose(){
  return templates.find(t=>t.id===typeSelect.value)||selected();
 }
 function derivedYear(t){
  const name=field('Name')?.value||'',match=name.match(/\b20\d{2}\b/);
  if(match)return Number(match[0]);
  const fromExisting=field('Starts')?.value?.slice(0,4);
  if(fromExisting&&Number(fromExisting)>2000)return Number(fromExisting);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return target(t,yearNow)&&target(t,yearNow)<today?yearNow+1:yearNow;
 }
 function updateYear(){
  const y=derivedYear(choose());if([...yearSelect.options].some(o=>Number(o.value)===y))yearSelect.value=String(y);
 }
 function data(){
  const t=choose(),y=Number(yearSelect.value)||yearNow,day=target(t,y),launch=day?add(day,-t.lead):null,cutoff=day&&t.cut?add(day,-t.cut):null;
  const name=field('Name')?.value?.trim()||t.name;
  return {t,y,day,launch,cutoff,
   items:{Subtitle:t.id==='colecao'&&!norm(name).includes('artessencia')?'A edição «'+name+'» reúne criações artesanais pensadas para esta ocasião.':t.subtitle,
   Note:cutoff?'Personalizações sujeitas a confirmação até '+fullDate(cutoff)+'.':'Personalizações e disponibilidade mediante confirmação.',
   HeroTitle:t.id==='colecao'&&!norm(name).includes('artessencia')?'Descobre '+name:t.hero,
   HeroCta:t.cta,Badge:t.badge,Emoji:t.emoji}};
 }
 function present(){
  const d=data();preview.replaceChildren();
  const lines=[
   ['Descrição',d.items.Subtitle],
   ['Título da homepage',d.items.HeroTitle],
   ['Nota',d.items.Note],
   ['Etiqueta',d.items.Badge],
   ['Botão',d.items.HeroCta],
   ['Tema',d.t.theme],
   ['Datas',d.day?fullDate(d.launch)+' a '+fullDate(d.day)+' de '+d.y:'Definir de acordo com a ocasião']
  ];
  for(const [label,value] of lines){const el=document.createElement('p');el.append(document.createElement('strong'),document.createTextNode(' '+value));el.querySelector('strong').textContent=label+':';preview.append(el)}
  dates.disabled=!d.day;
 }
 function dispatch(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
 function fill(mode){
  const d=data();let changed=0;
  for(const [key,value] of Object.entries(d.items)){
   const el=field(key);if(!el||(!value))continue;
   if(mode==='blank'&&String(el.value||'').trim())continue;
   if(el.value!==value){el.value=value;dispatch(el);changed++}
  }
  // Só seleciona o tema padrão em novas edições quando o utilizador aplica os campos vazios.
  if(mode==='blank'&&!field('Id')?.value){
   const th=field('Theme');if(th&&th.value==='artessencia'&&d.t.theme!=='artessencia'){
    th.value=d.t.theme;
    if(typeof window.applyCatalogThemePresetV1425==='function')window.applyCatalogThemePresetV1425();
   }
  }
  feedback.textContent=changed+' campo(s) atualizado(s) no formulário. Revê o conteúdo antes de guardar.';
 }
 function fillDates(){
  const d=data();if(!d.day)return;
  let changed=0;
  const values={Starts:d.launch+'T09:00',Ends:d.day+'T23:59'};
  for(const [key,v] of Object.entries(values)){const el=field(key);if(el&&!el.value){el.value=v;dispatch(el);changed++}}
  feedback.textContent=changed?changed+' data(s) sugerida(s). As datas já preenchidas foram preservadas.':'As datas existentes não foram alteradas.';
 }
 blanks.addEventListener('click',()=>fill('blank'));
 overwrite.addEventListener('click',()=>{
  if(!window.confirm('Substituir apenas os textos, a etiqueta e o emoji pelos sugeridos? As datas, produtos, capas e tema não serão alterados.'))return;
  fill('all');
 });
 dates.addEventListener('click',fillDates);
 typeSelect.addEventListener('change',()=>{updateYear();present()});
 yearSelect.addEventListener('change',present);
 field('Name')?.addEventListener('input',()=>{if(typeSelect.value==='auto'){updateYear();present()}});
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');const handler=b?.getAttribute('onclick')||'';
  if(handler.includes('editSpecialEdition(')||handler.includes('clearSpecialEditionForm(')){
   typeSelect.value='auto';
   // O editor original preenche os campos durante o clique. Atualização visual após esse preenchimento.
   queueMicrotask(()=>{updateYear();present();feedback.textContent=''});
  }
 });
 panel.addEventListener('toggle',()=>{if(panel.open){updateYear();present()}});
 updateYear();present();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
