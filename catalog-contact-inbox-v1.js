/* ArtEssencia — Inbox de pedidos diretos do catálogo.
   Não escreve no estado operacional e não cria encomendas automaticamente. */
(()=>{
 'use strict';
 const root=document.getElementById('catalogDirectInboxV1');
 const state=document.getElementById('catalogDirectInboxStateV1');
 const count=document.getElementById('catalogDirectInboxCountV1');
 const button=document.getElementById('catalogDirectInboxRefreshV1');
 if(!root||!state||!button)return;
 let pending=false,records=[];
 function element(tag,text,css){
  const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);
  if(css)node.style.cssText=css;return node;
 }
 function line(parent,title,value){
  const p=element('p',undefined,'margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.45');
  const label=element('strong',title+' ');p.append(label,document.createTextNode(String(value||'—')));parent.append(p);
 }
 function message(kind){
  return kind==='order'?'Interesse em encomendar':kind==='favorites'?'Informações sobre favoritos':kind==='general'?'Contacto geral':'Pedido de informação';
 }
 function render(){
  root.replaceChildren();
  const active=records.filter(r=>['new','reviewing'].includes(r.status));
  count.textContent=active.length?active.length+' por tratar':'0 por tratar';
  if(!records.length){root.append(element('p','Não existem contactos diretos recebidos do catálogo.','color:#735f50;padding:10px 0'));return}
  for(const r of records){
   const card=element('article',undefined,'padding:12px;border:1px solid #d8cbbd;border-radius:10px;margin:9px 0;background:#fffaf5');
   const summary=element('div',undefined,'display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px');
   const kind=String(r.personalization?.intent||'information');
   const header=element('strong',(r.customer_name||'Cliente')+' · '+message(kind));
   const date=element('small',r.created_at?new Date(r.created_at).toLocaleString('pt-PT'):'');
   summary.append(header,date);card.append(summary);
   line(card,'Estado:',r.status==='new'?'Novo':r.status==='reviewing'?'Em análise':r.status==='dismissed'?'Arquivado':r.status);
   line(card,'Referência:',String(r.request_id||'').slice(0,8).toUpperCase());
   line(card,'Produto(s):',Array.isArray(r.products)&&r.products.length?r.products.join(', '):'Pedido geral');
   line(card,'Mensagem:',r.notes||'');
   line(card,'Contacto:',r.phone||'');
   if(r.email)line(card,'Email:',r.email);
   const actions=element('div',undefined,'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px');
   if(r.phone){
    const num=String(r.phone).replace(/[^0-9]/g,'');
    if(num.length>=9&&num.length<=15){
     const link=element('a','Responder por WhatsApp');
     link.className='btn';link.target='_blank';link.rel='noopener noreferrer';
     link.href='https://wa.me/'+(num.length===9?'351'+num:num)+'?text='+encodeURIComponent('Olá '+(r.customer_name||'')+'! Recebemos o teu pedido ArtEssencia (ref. '+String(r.request_id||'').slice(0,8).toUpperCase()+'). Obrigado pelo contacto.');
     actions.append(link);
    }
   }
   for(const [status,label] of [['reviewing','Em análise'],['dismissed','Arquivar']]){
    if(status===r.status)continue;
    const b=element('button',label);b.className='btn';b.type='button';
    b.onclick=()=>changeStatus(r,status);
    actions.append(b);
   }
   card.append(actions);root.append(card);
  }
 }
 async function client(){
  if(typeof cloudClient==='undefined'||!cloudClient)throw Error('Cloud desligada');
  const {data,error}=await cloudClient.auth.getUser();
  if(error||!data?.user)throw Error('Inicia sessão na Cloud');
  return {c:cloudClient,user:data.user};
 }
 async function load(){
  if(pending)return;
  pending=true;button.disabled=true;state.textContent='A carregar contactos do catálogo…';
  try{
   const {c,user}=await client();
   const {data,error}=await c.from('artessencia_shop_event_requests')
    .select('request_id,user_id,customer_name,phone,email,products,personalization,notes,status,created_at')
    .eq('user_id',user.id)
    .eq('personalization->>request_kind','catalog_contact')
    .order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   records=Array.isArray(data)?data:[];render();
   state.textContent='Pedidos enviados diretamente pelo formulário do Catálogo Digital. Não são encomendas.';
  }catch(e){state.textContent='Não foi possível consultar contactos: '+String(e?.message||e)}
  finally{pending=false;button.disabled=false}
 }
 async function changeStatus(row,status){
  if(!['reviewing','dismissed'].includes(status))return;
  try{
   const {c,user}=await client();
   const {data,error}=await c.from('artessencia_shop_event_requests')
    .update({status,updated_at:new Date().toISOString()})
    .eq('user_id',user.id).eq('request_id',row.request_id)
    .eq('personalization->>request_kind','catalog_contact')
    .select('request_id,status').single();
   if(error||!data)throw error||Error('Sem confirmação da Cloud');
   row.status=status;render();state.textContent='Estado guardado na Cloud.';
  }catch(e){state.textContent='Não foi possível guardar: '+String(e?.message||e)}
 }
 let lastRefresh=0;
 const quotes=document.getElementById('quotes');
 function refreshIfVisible(){
  if(!quotes||document.visibilityState==='hidden'||quotes.classList.contains('hidden')||!quotes.getClientRects().length)return;
  if(pending||Date.now()-lastRefresh<90000)return;
  lastRefresh=Date.now();
  void load();
 }
 button.addEventListener('click',()=>{
  lastRefresh=Date.now();
  void load();
 });
 // Atualizar ao entrar no módulo; a verificação periódica é apenas uma salvaguarda.
 if(quotes&&typeof MutationObserver!=='undefined'){
  const observer=new MutationObserver(refreshIfVisible);
  observer.observe(quotes,{attributes:true,attributeFilter:['class','hidden','style']});
 }
 document.addEventListener('visibilitychange',refreshIfVisible);
 setInterval(refreshIfVisible,30000);
 refreshIfVisible();
})();
