import * as db from './db.js';
import {families,materialCategories,orderStatuses,paymentMethods,deliveryMethods,euro,uid,nextSku,calcProduct,stockNeed,dateISO} from './domain.js';
import {el,button,badge,table,modal,field,input,select,textarea,kpi,section,toast,download,esc} from './ui.js';
import {runAudit} from './audit.js';
import * as cloud from './cloud.js';

const fmt=v=>v?new Intl.DateTimeFormat('pt-PT').format(new Date(v)):'—';
const familyOptions=()=>Object.entries(families).map(([k,v])=>[k,`${v.icon} ${v.label}`]);
const statusKind=s=>/Entregue|Pronta|Pago|Conclu|Pronto/i.test(s)?'ok':/Cancel|Recus/i.test(s)?'danger':/produção|Produzir|Verter/i.test(s)?'violet':/Orçamento|Aguard/i.test(s)?'warn':'info';
const sum=(a,fn)=>a.reduce((s,x)=>s+Number(fn(x)||0),0);
function quick(icon,title,desc,on){return el('button',{class:'quick-card',type:'button',onclick:on},el('div',{class:'quick-icon'},icon),el('strong',{},title),el('small',{},desc))}
function findProduct(products,id){return products.find(x=>x.id===id)}
function findClient(clients,id){return clients.find(x=>x.id===id)}
function familyName(key){return families[key]?.label||'Outros'}

export async function todayView(ctx){
  const [orders,items,products,materials,batches,payments]=await Promise.all(['orders','orderItems','products','materials','productionBatches','payments'].map(db.all));
  const openOrders=orders.filter(o=>!['Entregue','Cancelada'].includes(o.status));
  const today=dateISO(),due=openOrders.filter(o=>o.dueDate===today),late=openOrders.filter(o=>o.dueDate&&o.dueDate<today);
  const production=batches.filter(b=>b.status!=='Pronto');
  const critical=materials.filter(m=>Number(m.stock)<=Number(m.minStock||0));
  const receivable=openOrders.reduce((s,o)=>{const total=sum(items.filter(i=>i.orderId===o.id),i=>Number(i.qty||0)*Number(i.unitPrice||0));const paid=sum(payments.filter(p=>p.orderId===o.id),p=>p.amount);return s+Math.max(0,total-paid)},0);
  const root=el('div',{class:'grid'});
  root.append(el('div',{class:'quick-grid'},
    quick('🧾','Nova encomenda','Pedido, orçamento ou evento',()=>ctx.go('orders',{create:true})),
    quick('🕯️','Iniciar produção','Abrir trabalho no Atelier',()=>ctx.go('atelier',{create:true})),
    quick('📦','Registar compra','Entrada de matéria e custo médio',()=>ctx.go('purchases',{create:true})),
    quick('✨','Novo produto','Produto + ficha técnica',()=>ctx.go('products',{create:true}))
  ));
  root.append(el('div',{class:'grid cols-4'},
    kpi('Encomendas abertas',openOrders.length,late.length?`${late.length} atrasada(s)`:'Dentro do planeado','🧾'),
    kpi('Em produção',production.length,'Trabalhos ativos','🕯️'),
    kpi('Stock crítico',critical.length,'Materiais a rever','📦'),
    kpi('A receber',euro(receivable),'Encomendas não liquidadas','€')
  ));
  const agenda=el('div',{class:'card'},section('Prioridades do atelier','Entregas, produção e alertas mais próximos',[button('Atualizar',()=>ctx.refresh(),'ghost small')]));
  const priorities=[];
  late.slice(0,4).forEach(o=>priorities.push({t:`${o.number||'Encomenda'} em atraso`,s:`Entrega ${fmt(o.dueDate)}`,b:'Atraso',k:'danger'}));
  due.slice(0,4).forEach(o=>priorities.push({t:`${o.number||'Encomenda'} para hoje`,s:o.status,b:o.status,k:statusKind(o.status)}));
  production.slice(0,4).forEach(b=>{const p=findProduct(products,b.productId);priorities.push({t:`${p?.name||'Produção'} × ${b.qty||1}`,s:b.status,b:'Atelier',k:'violet'})});
  critical.slice(0,4).forEach(m=>priorities.push({t:m.name,s:`${m.stock||0} ${m.unit||''} · mínimo ${m.minStock||0}`,b:'Stock',k:'warn'}));
  if(!priorities.length)agenda.append(el('div',{class:'empty'},'Nada urgente neste momento.'));
  for(const x of priorities.slice(0,9))agenda.append(el('div',{class:'metric'},el('div',{class:'meta'},el('strong',{},x.t),el('small',{},x.s)),el('span',{html:badge(x.b,x.k)})));
  const overview=el('div',{class:'card'},section('Estado do negócio','Resumo rápido do que está ativo'));
  const activeProducts=products.filter(p=>p.active!==false).length,published=products.filter(p=>p.published).length;
  overview.append(el('div',{class:'metric-list'},
    metric('Produtos ativos',activeProducts,badge(`${published} online`,'info')),
    metric('Matérias em stock',materials.filter(m=>Number(m.stock)>0).length,badge(`${critical.length} críticas`,critical.length?'warn':'ok')),
    metric('Encomendas hoje',due.length,badge(late.length?`${late.length} atrasadas`:'Sem atrasos',late.length?'danger':'ok')),
    metric('Produções abertas',production.length,badge(production.length?'Em curso':'Livre',production.length?'violet':'ok'))
  ));
  root.append(el('div',{class:'split'},agenda,overview));
  return root;
}
function metric(label,value,right=''){return el('div',{class:'metric'},el('div',{class:'meta'},el('strong',{},label),el('small',{},String(value))),el('span',{html:right}))}

export async function atelierView(ctx,opts={}){
  const [batches,products,materials,orders]=await Promise.all(['productionBatches','products','materials','orders'].map(db.all));
  const root=el('div');
  root.append(el('div',{class:'toolbar'},button('+ Iniciar produção',()=>productionModal(ctx,products,orders),'primary'),button('Encomendas a produzir',()=>ctx.go('orders',{filter:'Confirmada'}),'ghost')));
  const groups={};
  for(const b of batches.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))))(groups[b.status==='Pronto'?'Pronto':'Ativo']??=[]).push(b);
  const cards=el('div',{class:'grid cols-2'});
  const active=(groups.Ativo||[]);
  if(!active.length)cards.append(el('div',{class:'card empty'},'Sem trabalhos ativos no Atelier.'));
  for(const b of active){
    const p=findProduct(products,b.productId),fam=families[p?.family]||families.other,stages=fam.stages,idx=Math.max(0,stages.indexOf(b.status||stages[0]));
    const card=el('div',{class:'card work-card'});
    card.append(section(`${fam.icon} ${p?.name||'Produto'}`,`${b.qty||1} un. · iniciado ${fmt(b.createdAt)}`,[el('span',{html:badge(b.status||stages[0],statusKind(b.status))})]));
    const track=el('div',{class:'stage-track'});
    stages.forEach((s,i)=>track.append(el('div',{class:`stage-pill ${i<idx?'done':i===idx?'current':''}`},s)));card.append(track);
    const econ=p?calcProduct(p,materials,[],products):null;
    if(econ)card.append(el('div',{class:'metric-list'},metric('Custo estimado lote',euro(econ.trueCost*Number(b.qty||1))),metric('Prazo / nota',b.note||'—')));
    const acts=el('div',{class:'toolbar'});
    if(idx<stages.length-1)acts.append(button('Avançar etapa',async()=>{b.status=stages[idx+1];b.updatedAt=new Date().toISOString();if(b.status==='Pronto'&&!b.stockPosted){const ok=await consumeStock(p,b.qty||1,materials);if(!ok)return;b.stockPosted=true}await db.put('productionBatches',b);toast('Produção atualizada.');ctx.refresh()},'primary'));
    acts.append(button('Editar',()=>productionModal(ctx,products,orders,b),'ghost small'));
    card.append(acts);cards.append(card);
  }
  root.append(cards);
  const ready=groups.Pronto||[];if(ready.length){const recent=el('div',{class:'card'},section('Concluídas recentemente','Histórico rápido'));recent.append(table(['Produto','Qtd.','Concluída'],ready.slice(0,12).map(b=>[esc(findProduct(products,b.productId)?.name||'Produto'),b.qty||1,fmt(b.updatedAt||b.createdAt)])));root.append(recent)}
  if(opts.create)setTimeout(()=>productionModal(ctx,products,orders),0);
  return root;
}
async function consumeStock(product,qty,materials){
  if(!product)return true;
  const needs=stockNeed(product,qty);
  for(const n of needs){const m=materials.find(x=>x.id===n.materialId);if(!m||Number(m.stock||0)<n.qty){alert(`Stock insuficiente: ${m?.name||'matéria em falta'}`);return false}}
  for(const n of needs){const m=materials.find(x=>x.id===n.materialId);m.stock=Number(m.stock||0)-n.qty;m.updatedAt=new Date().toISOString();await db.put('materials',m);await db.put('stockMovements',{id:uid('sm'),materialId:m.id,type:'out',qty:n.qty,note:`Produção: ${product.name}`,createdAt:new Date().toISOString()})}
  return true;
}
function productionModal(ctx,products,orders,existing={}){
  const form=el('div',{class:'form-grid'});
  const product=select('productId',[['','Selecionar produto'],...products.filter(p=>p.active!==false).map(p=>[p.id,p.name])],existing.productId||'');
  const qty=input('qty',existing.qty||1,'number',{min:1,step:1});
  const order=select('orderId',[['','Sem encomenda'],...orders.filter(o=>!['Entregue','Cancelada'].includes(o.status)).map(o=>[o.id,`${o.number||''} · ${o.dueDate||''}`])],existing.orderId||'');
  const note=input('note',existing.note||'');
  form.append(field('Produto',product),field('Quantidade',qty),field('Encomenda associada',order),field('Nota / prazo',note,true));
  modal(existing.id?'Editar produção':'Iniciar produção',form,{onSave:async()=>{const p=findProduct(products,product.value);if(!p)return false;await db.put('productionBatches',{...existing,id:existing.id||uid('pb'),productId:p.id,qty:Number(qty.value||1),orderId:order.value||'',status:existing.status||families[p.family]?.stages?.[0]||'Preparar',note:note.value,stockPosted:existing.stockPosted||false,createdAt:existing.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});ctx.refresh();return true}})
}

export async function ordersView(ctx,opts={}){
  const [orders,items,clients,products,payments]=await Promise.all(['orders','orderItems','clients','products','payments'].map(db.all));
  let filter=opts.filter||'Todos';
  const root=el('div'),tabs=el('div',{class:'tabs'});
  ['Todos','Orçamento','Confirmada','Em produção','Pronta','Entregue'].forEach(s=>tabs.append(el('button',{class:`tab ${filter===s?'active':''}`,type:'button',onclick:()=>{ctx.go('orders',{filter:s})}},s)));
  root.append(tabs);
  const toolbar=el('div',{class:'toolbar'},button('+ Nova encomenda',()=>orderModal(ctx,clients,products),'primary'),button('+ Novo orçamento',()=>orderModal(ctx,clients,products,{status:'Orçamento'}),'secondary'));
  const search=input('search','','search',{placeholder:'Pesquisar cliente, número, produto…',class:'search'});toolbar.append(el('span',{class:'spacer'}),search);root.append(toolbar);
  const list=el('div',{class:'grid cols-2'});
  function renderList(){
    list.innerHTML='';const q=search.value.trim().toLowerCase();
    const shown=orders.filter(o=>(filter==='Todos'||o.status===filter)).filter(o=>{const c=findClient(clients,o.clientId);const its=items.filter(i=>i.orderId===o.id);return !q||[o.number,c?.name,...its.map(i=>i.productName)].join(' ').toLowerCase().includes(q)}).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(!shown.length)list.append(el('div',{class:'card empty'},'Sem encomendas neste filtro.'));
    for(const o of shown){
      const c=findClient(clients,o.clientId),its=items.filter(i=>i.orderId===o.id),total=sum(its,i=>i.qty*i.unitPrice),paid=sum(payments.filter(p=>p.orderId===o.id),p=>p.amount),balance=Math.max(0,total-paid);
      const card=el('div',{class:'card order-card'});
      const main=el('div',{class:'order-main'},el('div',{class:'order-number'},o.number||'SEM NÚMERO'),el('strong',{},c?.name||'Sem cliente'),el('div',{class:'small muted'},`${its.reduce((s,i)=>s+Number(i.qty||0),0)} un. · entrega ${fmt(o.dueDate)}`),el('div',{class:'small'},`Total ${euro(total)} · Falta ${euro(balance)}`));
      const actions=el('div',{class:'grid'},el('span',{html:badge(o.status,statusKind(o.status))}),button('Abrir',()=>orderModal(ctx,clients,products,o,its),'ghost small'));
      card.append(main,actions);list.append(card);
    }
  }
  search.addEventListener('input',renderList);renderList();root.append(list);
  if(opts.create)setTimeout(()=>orderModal(ctx,clients,products,opts.status?{status:opts.status}:{}),0);
  return root;
}
function orderModal(ctx,clients,products,existing={},existingItems=[]){
  const form=el('div',{class:'form-grid'});
  const client=select('clientId',[['','Sem cliente'],...clients.map(c=>[c.id,c.name])],existing.clientId||'');
  const status=select('status',orderStatuses.map(s=>[s,s]),existing.status||'Orçamento');
  const due=input('dueDate',existing.dueDate||'','date');const delivery=select('delivery',deliveryMethods.map(x=>[x,x]),existing.delivery||'Levantamento');
  const personalization=textarea('personalization',existing.personalization||'',{placeholder:'Cor, fragrância, fita, texto, evento, notas…'});
  form.append(field('Cliente',client),field('Estado',status),field('Data pretendida',due),field('Entrega',delivery),field('Personalização / notas',personalization,true));
  const lines=existingItems.map(x=>({...x})),list=el('div',{class:'grid'}),box=el('div',{class:'field span2'},el('label',{},'Artigos'));
  const render=()=>{list.innerHTML='';lines.forEach((it,i)=>{
    const row=el('div',{class:'grid cols-3'}),p=select('p',[['','Produto'],...products.filter(x=>x.active!==false).map(x=>[x.id,x.name])],it.productId),q=input('q',it.qty||1,'number',{min:1}),price=input('price',it.unitPrice||0,'number',{step:.01,min:0});
    p.onchange=()=>{it.productId=p.value;const pr=findProduct(products,p.value);it.productName=pr?.name||'';it.unitPrice=Number(pr?.price||0);price.value=it.unitPrice};q.oninput=()=>it.qty=Number(q.value||1);price.oninput=()=>it.unitPrice=Number(price.value||0);
    row.append(p,q,el('div',{class:'toolbar'},price,button('×',()=>{lines.splice(i,1);render()},'danger small')));list.append(row)
  })};render();box.append(list,button('+ Adicionar produto',()=>{lines.push({id:uid('oi'),productId:'',qty:1,unitPrice:0});render()},'ghost small'));form.append(box);
  modal(existing.id?`${existing.status==='Orçamento'?'Orçamento':'Encomenda'} ${existing.number||''}`:'Nova encomenda / orçamento',form,{wide:true,onSave:async()=>{
    if(!lines.some(x=>x.productId)){alert('Adiciona pelo menos um produto.');return false}
    const id=existing.id||uid('o'),number=existing.number||`AE-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    await db.put('orders',{...existing,id,number,clientId:client.value,status:status.value,dueDate:due.value,delivery:delivery.value,personalization:personalization.value,createdAt:existing.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
    for(const old of existingItems)await db.del('orderItems',old.id);
    for(const it of lines.filter(x=>x.productId)){const p=findProduct(products,it.productId),econ=p?calcProduct(p,[],[],products):null;await db.put('orderItems',{...it,id:it.id||uid('oi'),orderId:id,productName:p?.name||it.productName,unitPrice:Number(it.unitPrice||p?.price||0),costSnapshot:Number(p?.lastTrueCost||econ?.trueCost||0)})}
    toast('Encomenda guardada.');ctx.refresh();return true
  }})
}

export async function productsView(ctx,opts={}){
  const [products,materials,kitItems]=await Promise.all(['products','materials','kitItems'].map(db.all));
  const root=el('div');
  const tabs=el('div',{class:'family-grid'});
  for(const [key,f] of Object.entries(families)){const count=products.filter(p=>p.family===key).length;tabs.append(el('button',{class:'family-card',type:'button',onclick:()=>ctx.go('products',{family:key})},el('div',{class:'emoji'},f.icon),el('strong',{},f.label),el('small',{},`${count} produto(s)`)))}
  root.append(tabs);
  const toolbar=el('div',{class:'toolbar',style:'margin-top:14px'},button('+ Novo produto',()=>productModal(ctx,products,materials),'primary'),button('Ver rentabilidade',()=>ctx.go('costs'),'ghost'));
  const search=input('search','','search',{placeholder:'Pesquisar produto / SKU…',class:'search'});toolbar.append(el('span',{class:'spacer'}),search);root.append(toolbar);
  const box=el('div');root.append(box);
  const render=()=>{const q=search.value.toLowerCase(),family=opts.family||'';const shown=products.filter(p=>(!family||p.family===family)&&(!q||`${p.name} ${p.sku}`.toLowerCase().includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));const rows=shown.map(p=>{const e=calcProduct(p,materials,kitItems,products);return [esc(p.sku||''),`${families[p.family]?.icon||'✨'} ${esc(p.name)}`,esc(p.subtype||''),euro(p.price),euro(e.trueCost),euro(e.recommended),badge(`${e.margin.toFixed(1)}%`,e.margin<Number(p.alertMarginPct??40)?'danger':e.margin<Number(p.targetMarginPct??60)?'warn':'ok'),p.published?badge('Online','info'):badge('Privado','neutral'),`<button class="btn ghost small" data-edit="${p.id}">Editar</button>`]});box.innerHTML='';const t=table(['SKU','Produto','Tipo','PVP','Custo real','PVP rec.','Margem','Loja',''],rows);t.addEventListener('click',e=>{const id=e.target.dataset.edit;if(id)productModal(ctx,products,materials,products.find(p=>p.id===id))});box.append(t)};
  search.oninput=render;render();if(opts.create)setTimeout(()=>productModal(ctx,products,materials),0);return root;
}
async function productModal(ctx,products,materials,existing={}){
  const defaults={
    laborRate:Number(await db.getSetting('atelier.laborRate',5.8)),
    extrasPct:Number(await db.getSetting('atelier.extrasPct',5)),
    wastePct:Number(await db.getSetting('atelier.wastePct',10)),
    targetMarginPct:Number(await db.getSetting('atelier.targetMarginPct',60)),
    alertMarginPct:Number(await db.getSetting('atelier.alertMarginPct',40)),
    paymentFeePct:Number(await db.getSetting('atelier.paymentFeePct',0)),
    packagingCost:Number(await db.getSetting('atelier.packagingCost',0)),
    equipmentRate:Number(await db.getSetting('atelier.equipmentRate',0)),
    batchUnits:Number(await db.getSetting('atelier.batchUnits',1))
  };
  const form=el('div',{class:'form-grid'}),family=select('family',familyOptions(),existing.family||'candle'),sku=input('sku',existing.sku||nextSku(products,existing.family||'candle')),name=input('name',existing.name||''),subtype=select('subtype',(families[existing.family||'candle']?.subtypes||[]).map(x=>[x,x]),existing.subtype||'');
  const price=input('price',existing.price||0,'number',{step:.01,min:0}),wholesale=input('wholesalePrice',existing.wholesalePrice||0,'number',{step:.01,min:0}),batch=input('batchUnits',existing.batchUnits??defaults.batchUnits,'number',{min:1}),labor=input('laborMinutes',existing.laborMinutes||0,'number',{min:0}),rate=input('laborRate',existing.laborRate??defaults.laborRate,'number',{step:.01,min:0}),pack=input('packagingCost',existing.packagingCost??defaults.packagingCost,'number',{step:.01,min:0});
  const extras=input('extrasPct',existing.extrasPct??defaults.extrasPct,'number',{step:.1,min:0}),waste=input('wastePct',existing.wastePct??defaults.wastePct,'number',{step:.1,min:0}),target=input('targetMarginPct',existing.targetMarginPct??defaults.targetMarginPct,'number',{step:.1,min:0,max:95}),alertMargin=input('alertMarginPct',existing.alertMarginPct??defaults.alertMarginPct,'number',{step:.1,min:0,max:95}),fee=input('paymentFeePct',existing.paymentFeePct??defaults.paymentFeePct,'number',{step:.1,min:0});
  const moldName=input('moldName',existing.moldName||''),moldCost=input('moldCost',existing.moldCost||0,'number',{step:.01,min:0}),moldLife=input('moldLife',existing.moldLife||0,'number',{min:0}),equipMin=input('equipmentMinutes',existing.equipmentMinutes||0,'number',{min:0}),equipRate=input('equipmentRate',existing.equipmentRate??defaults.equipmentRate,'number',{step:.01,min:0});
  const published=select('published',[['false','Não'],['true','Sim']],String(!!existing.published)),active=select('active',[['true','Ativo'],['false','Inativo']],String(existing.active!==false));
  const desc=textarea('onlineDescription',existing.onlineDescription||'',{placeholder:'Descrição para catálogo / futura loja'});
  form.append(field('Família',family),field('SKU',sku),field('Nome do produto',name),field('Subtipo',subtype),field('PVP praticado (€)',price),field('PVP grossista (€)',wholesale),field('Unidades por lote',batch),field('Tempo de trabalho / lote (min)',labor),field('Valor hora (€)',rate),field('Embalagem / un. (€)',pack),field('Consumíveis / extras (%)',extras),field('Desperdício / defeito (%)',waste),field('Margem alvo (%)',target),field('Alerta de margem (%)',alertMargin),field('Taxa pagamento (%)',fee),field('Molde / recipiente',moldName),field('Custo molde (€)',moldCost),field('Vida útil molde (un.)',moldLife),field('Equipamento / lote (min)',equipMin),field('Custo equipamento/h (€)',equipRate),field('Publicado na loja',published),field('Estado',active),field('Descrição online',desc,true));
  const recipe=existing.recipe?existing.recipe.map(x=>({...x})):[];
  const recipeBox=el('div',{class:'field span2'},el('label',{},'Ficha técnica · matérias e quantidades por lote')),recipeList=el('div',{class:'grid'});
  const renderRecipe=()=>{recipeList.innerHTML='';recipe.forEach((r,i)=>{const row=el('div',{class:'grid cols-3'}),ms=select('m',[['','Matéria'],...materials.map(m=>[m.id,`${m.name} (${m.unit||''})`])],r.materialId),q=input('q',r.qty||0,'number',{step:.001,min:0});ms.onchange=()=>r.materialId=ms.value;q.oninput=()=>r.qty=Number(q.value||0);row.append(ms,q,button('Remover',()=>{recipe.splice(i,1);renderRecipe()},'danger small'));recipeList.append(row)})};
  recipeBox.append(recipeList,button('+ Adicionar matéria',()=>{recipe.push({materialId:'',qty:0});renderRecipe()},'ghost small'));renderRecipe();form.append(recipeBox);
  const refreshSubtype=()=>{const old=subtype.value;subtype.innerHTML='';for(const st of families[family.value]?.subtypes||[]){const o=document.createElement('option');o.value=o.textContent=st;subtype.append(o)}if([...subtype.options].some(o=>o.value===old))subtype.value=old;if(!existing.id||!sku.value.trim())sku.value=nextSku(products,family.value)};
  family.onchange=refreshSubtype;
  modal(existing.id?'Editar produto':'Novo produto',form,{wide:true,onSave:async()=>{
    if(!name.value.trim()){alert('Indica o nome.');return false}
    const duplicate=products.some(p=>p.id!==existing.id&&String(p.sku||'').toUpperCase()===sku.value.trim().toUpperCase());if(duplicate){alert('Este SKU já existe.');return false}
    const p={...existing,id:existing.id||uid('p'),family:family.value,sku:sku.value.trim(),name:name.value.trim(),subtype:subtype.value,price:Number(price.value||0),wholesalePrice:Number(wholesale.value||0),batchUnits:Number(batch.value||1),laborMinutes:Number(labor.value||0),laborRate:Number(rate.value||0),packagingCost:Number(pack.value||0),extrasPct:Number(extras.value||0),wastePct:Number(waste.value||0),targetMarginPct:Number(target.value||0),alertMarginPct:Number(alertMargin.value||0),paymentFeePct:Number(fee.value||0),moldName:moldName.value,moldCost:Number(moldCost.value||0),moldLife:Number(moldLife.value||0),equipmentMinutes:Number(equipMin.value||0),equipmentRate:Number(equipRate.value||0),published:published.value==='true',active:active.value==='true',onlineDescription:desc.value,recipe:recipe.filter(x=>x.materialId&&Number(x.qty)>=0),updatedAt:new Date().toISOString(),createdAt:existing.createdAt||new Date().toISOString()};
    const econ=calcProduct(p,materials,[],products);p.lastTrueCost=econ.trueCost;p.lastProductionCost=econ.production;await db.put('products',p);toast('Produto guardado.');ctx.refresh();return true
  }})
}

export async function costsView(){
  const [products,materials,kitItems]=await Promise.all(['products','materials','kitItems'].map(db.all));
  const root=el('div',{class:'grid'});const evaluated=products.map(p=>({p,e:calcProduct(p,materials,kitItems,products)}));
  root.append(el('div',{class:'grid cols-4'},kpi('Produtos',products.length,'Com motor de custos','✨'),kpi('Margem média',`${(evaluated.length?sum(evaluated,x=>x.e.margin)/evaluated.length:0).toFixed(1)}%`,'Margem real','%'),kpi('Margens em alerta',evaluated.filter(x=>x.e.margin<Number(x.p.alertMarginPct??40)).length,'Rever preço/custo','⚠'),kpi('Matérias com custo',materials.filter(m=>Number(m.unitCost)>0).length,'Custos médios registados','€')));
  const rows=evaluated.sort((a,b)=>a.e.margin-b.e.margin).map(({p,e})=>[esc(p.sku),esc(p.name),euro(e.materialUnit),euro(e.labor),euro(e.mold),euro(e.energy),euro(e.production),euro(e.trueCost),euro(e.recommended),badge(`${e.margin.toFixed(1)}%`,e.margin<Number(p.alertMarginPct??40)?'danger':e.margin<Number(p.targetMarginPct??60)?'warn':'ok')]);
  root.append(el('div',{class:'card'},section('Rentabilidade por produto','Custos automáticos da ficha técnica'),table(['SKU','Produto','Materiais','Mão obra','Molde','Energia','Produção','Real','PVP rec.','Margem'],rows)));return root;
}

export async function materialsView(ctx){
  const materials=await db.all('materials');const root=el('div');
  root.append(el('div',{class:'toolbar'},button('+ Nova matéria',()=>materialModal(ctx),'primary'),button('Registar compra',()=>ctx.go('purchases',{create:true}),'secondary')));
  const rows=materials.sort((a,b)=>String(a.category).localeCompare(String(b.category))||String(a.name).localeCompare(String(b.name))).map(m=>[esc(m.name),esc(m.category||''),esc(m.unit||''),Number(m.stock||0).toFixed(2),Number(m.minStock||0).toFixed(2),euro(m.unitCost),badge(Number(m.stock)<=Number(m.minStock||0)?'Comprar':'OK',Number(m.stock)<=Number(m.minStock||0)?'warn':'ok'),`<button class="btn ghost small" data-edit="${m.id}">Editar</button>`]);
  const t=table(['Matéria','Família','Unid.','Stock','Mínimo','Custo/un.','Estado',''],rows);t.addEventListener('click',e=>{const id=e.target.dataset.edit;if(id)materialModal(ctx,materials.find(m=>m.id===id))});root.append(t);return root;
}
function materialModal(ctx,existing={}){
  const form=el('div',{class:'form-grid'}),name=input('name',existing.name||''),cat=select('category',materialCategories.map(x=>[x,x]),existing.category||materialCategories[0]),unit=select('unit',[['g','g'],['ml','ml'],['un','un'],['m','m'],['kg','kg'],['l','l']],existing.unit||'g'),stock=input('stock',existing.stock||0,'number',{step:.001}),min=input('min',existing.minStock||0,'number',{step:.001}),cost=input('cost',existing.unitCost||0,'number',{step:.0001,min:0}),supplier=input('supplier',existing.supplier||'');
  form.append(field('Nome',name),field('Categoria',cat),field('Unidade',unit),field('Stock atual',stock),field('Stock mínimo',min),field('Custo médio/unidade (€)',cost),field('Fornecedor / nota',supplier,true));
  modal(existing.id?'Editar matéria':'Nova matéria',form,{onSave:async()=>{if(!name.value.trim())return false;await db.put('materials',{...existing,id:existing.id||uid('m'),name:name.value.trim(),category:cat.value,unit:unit.value,stock:Number(stock.value||0),minStock:Number(min.value||0),unitCost:Number(cost.value||0),supplier:supplier.value,updatedAt:new Date().toISOString()});ctx.refresh();return true}})
}

export async function purchasesView(ctx,opts={}){
  const [purchases,materials]=await Promise.all(['purchases','materials'].map(db.all));const root=el('div');
  root.append(el('div',{class:'toolbar'},button('+ Registar compra',()=>purchaseModal(ctx,materials),'primary'),button('Materiais & Stock',()=>ctx.go('materials'),'ghost')));
  const rows=purchases.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(p=>[fmt(p.date),esc(materials.find(m=>m.id===p.materialId)?.name||p.materialName||''),`${p.qty||0} ${p.unit||''}`,euro(p.total),euro(p.unitCost),esc(p.supplier||''),esc(p.note||'')]);root.append(table(['Data','Matéria','Quantidade','Total','Custo/un.','Fornecedor','Nota'],rows));if(opts.create)setTimeout(()=>purchaseModal(ctx,materials),0);return root;
}
function purchaseModal(ctx,materials){
  const form=el('div',{class:'form-grid'}),mat=select('materialId',[['','Selecionar'],...materials.map(m=>[m.id,`${m.name} (${m.unit})`])]),qty=input('qty',0,'number',{step:.001,min:.001}),total=input('total',0,'number',{step:.01,min:0}),supplier=input('supplier',''),date=input('date',dateISO(),'date'),note=input('note','');
  const preview=el('div',{class:'notice info span2'},'Seleciona a matéria e introduz quantidade/valor. O custo médio será recalculado.');
  form.append(field('Matéria',mat),field('Quantidade',qty),field('Valor total pago (€)',total),field('Data',date),field('Fornecedor',supplier),field('Nota',note),preview);
  modal('Registar compra',form,{onSave:async()=>{const m=materials.find(x=>x.id===mat.value),q=Number(qty.value||0),paid=Number(total.value||0);if(!m||q<=0)return false;const oldStock=Number(m.stock||0),oldCost=Number(m.unitCost||0),newCost=(oldStock*oldCost+paid)/(oldStock+q);m.stock=oldStock+q;m.unitCost=newCost;m.updatedAt=new Date().toISOString();await db.put('materials',m);await db.put('purchases',{id:uid('pu'),materialId:m.id,materialName:m.name,qty:q,unit:m.unit,total:paid,unitCost:newCost,supplier:supplier.value,date:date.value,note:note.value,createdAt:new Date().toISOString()});await db.put('cashMovements',{id:uid('cm'),date:date.value,type:'out',category:'Compra de stock',amount:paid,note:`Compra: ${m.name}`,linkedType:'purchase',createdAt:new Date().toISOString()});toast('Compra e custo médio atualizados.');ctx.refresh();return true}})
}

export async function clientsView(ctx){
  const [clients,orders,items]=await Promise.all(['clients','orders','orderItems'].map(db.all));const root=el('div');root.append(el('div',{class:'toolbar'},button('+ Novo cliente',()=>clientModal(ctx),'primary')));
  const rows=clients.map(c=>{const os=orders.filter(o=>o.clientId===c.id),spent=sum(os.flatMap(o=>items.filter(i=>i.orderId===o.id)),i=>i.qty*i.unitPrice);return [esc(c.name),esc(c.phone||''),esc(c.email||''),os.length,euro(spent),esc(c.notes||''),`<button class="btn ghost small" data-edit="${c.id}">Editar</button>`]});const t=table(['Cliente','Telefone','Email','Encomendas','Vendas','Notas',''],rows);t.addEventListener('click',e=>{const id=e.target.dataset.edit;if(id)clientModal(ctx,clients.find(c=>c.id===id))});root.append(t);return root;
}
function clientModal(ctx,existing={}){
  const form=el('div',{class:'form-grid'}),name=input('name',existing.name||''),phone=input('phone',existing.phone||''),email=input('email',existing.email||'','email'),address=input('address',existing.address||''),notes=textarea('notes',existing.notes||'');
  form.append(field('Nome',name),field('Telefone',phone),field('Email',email),field('Morada / zona',address),field('Notas',notes,true));
  modal(existing.id?'Editar cliente':'Novo cliente',form,{onSave:async()=>{if(!name.value.trim())return false;await db.put('clients',{...existing,id:existing.id||uid('c'),name:name.value.trim(),phone:phone.value,email:email.value,address:address.value,notes:notes.value,updatedAt:new Date().toISOString()});ctx.refresh();return true}})
}

export async function cashView(ctx){
  const rows=await db.all('cashMovements'),expenses=await db.all('expenses'),investments=await db.all('investments');
  const incoming=sum(rows.filter(x=>x.type==='in'),x=>x.amount),out=sum(rows.filter(x=>x.type==='out'),x=>x.amount),balance=incoming-out;
  const root=el('div',{class:'grid'});root.append(el('div',{class:'grid cols-4'},kpi('Entradas',euro(incoming),'Movimentos registados','↗'),kpi('Saídas',euro(out),'Caixa e compras','↘'),kpi('Saldo',euro(balance),'Movimentos líquidos','€'),kpi('Investimentos',euro(sum(investments,x=>x.amount)),'Separado das despesas','◇')));
  root.append(el('div',{class:'toolbar'},button('+ Movimento manual',()=>cashModal(ctx),'primary'),button('+ Despesa',()=>expenseModal(ctx),'secondary'),button('+ Investimento',()=>investmentModal(ctx),'ghost')));
  root.append(table(['Data','Tipo','Categoria','Valor','Nota'],rows.sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt))).map(x=>[fmt(x.date||x.createdAt),badge(x.type==='in'?'Entrada':'Saída',x.type==='in'?'ok':'warn'),esc(x.category||''),euro(x.amount),esc(x.note||'')])));return root;
}
function cashModal(ctx){const form=el('div',{class:'form-grid'}),type=select('type',[['in','Entrada'],['out','Saída']]),cat=input('category',''),amount=input('amount',0,'number',{step:.01,min:0}),date=input('date',dateISO(),'date'),note=input('note','');form.append(field('Tipo',type),field('Categoria',cat),field('Valor (€)',amount),field('Data',date),field('Nota',note,true));modal('Movimento manual',form,{onSave:async()=>{await db.put('cashMovements',{id:uid('cm'),type:type.value,category:cat.value,amount:Number(amount.value||0),date:date.value,note:note.value,createdAt:new Date().toISOString()});ctx.refresh();return true}})}
function expenseModal(ctx){const form=el('div',{class:'form-grid'}),cat=input('cat',''),amount=input('amount',0,'number',{step:.01,min:0}),date=input('date',dateISO(),'date'),note=input('note','');form.append(field('Categoria',cat),field('Valor (€)',amount),field('Data',date),field('Nota',note,true));modal('Registar despesa',form,{onSave:async()=>{const a=Number(amount.value||0);await db.put('expenses',{id:uid('ex'),category:cat.value,amount:a,date:date.value,note:note.value});await db.put('cashMovements',{id:uid('cm'),type:'out',category:cat.value||'Despesa',amount:a,date:date.value,note:note.value,linkedType:'expense'});ctx.refresh();return true}})}
function investmentModal(ctx){const form=el('div',{class:'form-grid'}),name=input('name',''),amount=input('amount',0,'number',{step:.01,min:0}),date=input('date',dateISO(),'date'),note=input('note','');form.append(field('Investimento',name),field('Valor (€)',amount),field('Data',date),field('Nota',note,true));modal('Registar investimento',form,{onSave:async()=>{const a=Number(amount.value||0);await db.put('investments',{id:uid('iv'),name:name.value,amount:a,date:date.value,note:note.value});await db.put('cashMovements',{id:uid('cm'),type:'out',category:'Investimento',amount:a,date:date.value,note:name.value,linkedType:'investment'});ctx.refresh();return true}})}

export async function reportsView(){
  const [orders,items,products,materials,purchases,cash]=await Promise.all(['orders','orderItems','products','materials','purchases','cashMovements'].map(db.all));
  const valid=new Set(orders.filter(o=>o.status!=='Cancelada').map(o=>o.id)),sales=items.filter(i=>valid.has(i.orderId)),revenue=sum(sales,i=>i.qty*i.unitPrice),profit=sum(sales,i=>Number(i.qty||0)*(Number(i.unitPrice||0)-Number(i.costSnapshot||0)));
  const stockValue=sum(materials,m=>m.stock*m.unitCost),purchaseValue=sum(purchases,p=>p.total);
  const root=el('div',{class:'grid'});root.append(el('div',{class:'grid cols-4'},kpi('Receita',euro(revenue),'Encomendas válidas','€'),kpi('Margem contribuição',euro(profit),'Snapshots de custo','↗'),kpi('Valor em stock',euro(stockValue),'Matérias-primas','📦'),kpi('Compras acumuladas',euro(purchaseValue),'Histórico de compras','🧾')));
  const by={};for(const i of sales){const k=i.productName||i.productId;(by[k]??={qty:0,revenue:0,profit:0});by[k].qty+=Number(i.qty||0);by[k].revenue+=Number(i.qty||0)*Number(i.unitPrice||0);by[k].profit+=Number(i.qty||0)*(Number(i.unitPrice||0)-Number(i.costSnapshot||0))}
  root.append(el('div',{class:'card'},section('Produtos vendidos','Ranking por receita e contribuição'),table(['Produto','Unidades','Receita','Contribuição'],Object.entries(by).sort((a,b)=>b[1].revenue-a[1].revenue).map(([k,v])=>[esc(k),v.qty,euro(v.revenue),euro(v.profit)]))));
  return root;
}

export async function shopView(ctx,opts={}){
  const [products,collections,catalogs,homepage,campaigns]=await Promise.all(['products','collections','catalogs','homepage','campaigns'].map(db.all));const tab=opts.tab||'overview',root=el('div');
  const tabs=el('div',{class:'tabs'});[['overview','Visão geral'],['collections','Coleções'],['catalogs','Catálogos & Kits'],['homepage','Homepage'],['campaigns','Campanhas'],['delivery','Entregas']].forEach(([id,l])=>tabs.append(el('button',{class:`tab ${tab===id?'active':''}`,type:'button',onclick:()=>ctx.go('shop',{tab:id})},l)));root.append(tabs);
  if(tab==='overview'){const published=products.filter(p=>p.published);root.append(el('div',{class:'grid cols-4'},kpi('Produtos online',published.length,'Preparados para loja','🛍️'),kpi('Coleções',collections.length,'Sazonais e permanentes','✦'),kpi('Catálogos',catalogs.length,'Kits e seleções','🎁'),kpi('Campanhas',campaigns.length,'Marketing futuro','🔔')));root.append(el('div',{class:'card'},section('Preparação da loja online','A mesma base ArtEssencia alimentará o backoffice e a loja'),el('div',{class:'notice info'},'Custos internos, margens, fornecedores e movimentos financeiros nunca devem ser expostos à loja pública.')))}
  if(tab==='collections')root.append(await collectionsPanel(ctx,collections));
  if(tab==='catalogs')root.append(await catalogsPanel(ctx,catalogs,products));
  if(tab==='homepage')root.append(await homepagePanel(ctx,homepage));
  if(tab==='campaigns')root.append(await campaignsPanel(ctx,campaigns));
  if(tab==='delivery')root.append(await deliveryPanel(ctx));
  return root;
}
async function collectionsPanel(ctx,collections){
  const card=el('div',{class:'card'},section('Coleções','Natal, Páscoa, Dia da Mãe, eventos…',[button('+ Nova coleção',()=>collectionModal(ctx),'primary small')]));
  const rows=collections.map(c=>[esc(c.name),fmt(c.startDate),fmt(c.endDate),badge(c.active?'Ativa':'Inativa',c.active?'ok':'neutral'),esc(c.note||''),`<button class="btn ghost small" data-edit="${c.id}">Editar</button>`]);const t=table(['Coleção','Início','Fim','Estado','Nota',''],rows);t.onclick=e=>{const id=e.target.dataset.edit;if(id)collectionModal(ctx,collections.find(x=>x.id===id))};card.append(t);return card;
}
function collectionModal(ctx,existing={}){const f=el('div',{class:'form-grid'}),name=input('name',existing.name||''),start=input('start',existing.startDate||'','date'),end=input('end',existing.endDate||'','date'),active=select('active',[['true','Ativa'],['false','Inativa']],String(existing.active!==false)),note=input('note',existing.note||'');f.append(field('Nome',name),field('Estado',active),field('Data início',start),field('Data fim',end),field('Nota',note,true));modal(existing.id?'Editar coleção':'Nova coleção',f,{onSave:async()=>{await db.put('collections',{...existing,id:existing.id||uid('col'),name:name.value,startDate:start.value,endDate:end.value,active:active.value==='true',note:note.value});ctx.refresh();return true}})}
async function catalogsPanel(ctx,catalogs,products){
  const card=el('div',{class:'card'},section('Catálogos & Kits','Seleções para presentes, eventos e futura loja',[button('+ Novo catálogo',()=>catalogModal(ctx),'primary small')]));
  card.append(table(['Nome','Tipo','Descrição','Estado'],catalogs.map(c=>[esc(c.name),esc(c.type||'Catálogo'),esc(c.description||''),badge(c.active?'Ativo':'Inativo',c.active?'ok':'neutral')])));
  card.append(el('div',{class:'notice',style:'margin-top:12px'},'Os Kits reais são produtos da família “Kits & Presentes” e podem usar componentes de outros produtos. Esta área gere apresentações e seleções comerciais.'));return card;
}
function catalogModal(ctx){const f=el('div',{class:'form-grid'}),name=input('name',''),type=select('type',[['Catálogo','Catálogo'],['Kit temático','Kit temático'],['Evento','Evento']]),desc=textarea('desc',''),active=select('active',[['true','Ativo'],['false','Inativo']],'true');f.append(field('Nome',name),field('Tipo',type),field('Descrição',desc,true),field('Estado',active));modal('Novo catálogo',f,{onSave:async()=>{await db.put('catalogs',{id:uid('cat'),name:name.value,type:type.value,description:desc.value,active:active.value==='true'});ctx.refresh();return true}})}
async function homepagePanel(ctx,rows){
  const cfg=rows[0]||{id:'main',heroTitle:'Peças feitas à mão, com aroma e significado.',heroSubtitle:'Velas, Jesmonite e presentes personalizados.',featured:'Velas,Jesmonite,Kits & Presentes'};
  const f=el('div',{class:'form-grid'}),title=input('title',cfg.heroTitle),sub=textarea('sub',cfg.heroSubtitle),featured=input('featured',cfg.featured),notice=input('notice',cfg.notice||'');
  f.append(field('Título principal',title,true),field('Subtítulo',sub,true),field('Famílias em destaque',featured,true,'Ex.: Velas, Jesmonite, Kits & Presentes'),field('Aviso / faixa promocional',notice,true));
  const card=el('div',{class:'card'},section('Homepage futura','Conteúdo editorial da loja'));card.append(f,el('div',{class:'toolbar',style:'margin-top:12px'},button('Guardar homepage',async()=>{await db.put('homepage',{id:'main',heroTitle:title.value,heroSubtitle:sub.value,featured:featured.value,notice:notice.value,updatedAt:new Date().toISOString()});toast('Homepage guardada.')},'primary')));return card;
}
async function campaignsPanel(ctx,campaigns){
  const card=el('div',{class:'card'},section('Campanhas','Preparação para push / novidades / coleções',[button('+ Nova campanha',()=>campaignModal(ctx),'primary small')]));
  card.append(table(['Título','Destino','Estado','Criada'],campaigns.map(c=>[esc(c.title),esc(c.destination||'Loja'),badge(c.status||'Rascunho',c.status==='Enviada'?'ok':'neutral'),fmt(c.createdAt)])));return card;
}
function campaignModal(ctx){const f=el('div',{class:'form-grid'}),title=input('title',''),msg=textarea('msg',''),dest=select('dest',[['Início','Início'],['Coleção','Coleção'],['Catálogo','Catálogo'],['Produto','Produto']]),status=select('status',[['Rascunho','Rascunho'],['Agendada','Agendada']]);f.append(field('Título',title),field('Destino',dest),field('Mensagem',msg,true),field('Estado',status));modal('Nova campanha',f,{onSave:async()=>{await db.put('campaigns',{id:uid('camp'),title:title.value,message:msg.value,destination:dest.value,status:status.value,createdAt:new Date().toISOString()});ctx.refresh();return true}})}
async function deliveryPanel(ctx){
  const rows=await db.all('deliverySettings'),cfg=rows[0]||{id:'main',pickup:true,local:true,shipping:false,leadDays:3,localFee:0,radiusKm:0,notes:''};
  const f=el('div',{class:'form-grid'}),pickup=select('pickup',[['true','Disponível'],['false','Indisponível']],String(cfg.pickup)),local=select('local',[['true','Disponível'],['false','Indisponível']],String(cfg.local)),shipping=select('shipping',[['true','Disponível'],['false','Indisponível']],String(cfg.shipping)),lead=input('lead',cfg.leadDays||3,'number',{min:0}),fee=input('fee',cfg.localFee||0,'number',{step:.01,min:0}),radius=input('radius',cfg.radiusKm||0,'number',{min:0}),notes=textarea('notes',cfg.notes||'');
  f.append(field('Levantamento',pickup),field('Entrega local',local),field('Envio',shipping),field('Antecedência mínima (dias)',lead),field('Taxa entrega local (€)',fee),field('Raio local (km)',radius),field('Notas / horários',notes,true));
  const card=el('div',{class:'card'},section('Entregas & capacidade','Regras para a futura loja'));card.append(f,el('div',{class:'toolbar',style:'margin-top:12px'},button('Guardar entrega',async()=>{await db.put('deliverySettings',{id:'main',pickup:pickup.value==='true',local:local.value==='true',shipping:shipping.value==='true',leadDays:Number(lead.value||0),localFee:Number(fee.value||0),radiusKm:Number(radius.value||0),notes:notes.value});toast('Configuração guardada.')},'primary')));return card;
}

export async function auditView(){
  const root=el('div',{class:'grid'}),result=el('div',{class:'card'},el('div',{class:'empty'},'Executa a auditoria para verificar a estrutura completa.'));
  const run=async()=>{const r=await runAudit();result.innerHTML='';result.append(el('div',{class:'grid cols-3'},kpi('Erros',r.counts.error,'Integridade','!'),kpi('Atenções',r.counts.warn,'A rever','⚠'),kpi('Verificações OK',r.counts.ok,'Estrutura','✓')));const list=el('div',{style:'margin-top:12px'});for(const x of r.issues)list.append(el('div',{class:'audit-item'},el('span',{html:badge(x.level==='error'?'Erro':x.level==='warn'?'Atenção':'OK',x.level==='error'?'danger':x.level==='warn'?'warn':'ok')}),el('div',{},el('strong',{},x.area),el('div',{class:'small muted'},x.message)),el('span',{})));result.append(list)};
  root.append(el('div',{class:'card'},section('Auditoria 360º','Uma verificação global de catálogo, custos, stock, encomendas e relações',[button('Executar auditoria completa',run,'primary')]),el('div',{class:'notice info'},'Usa esta função depois de atualizações importantes ou antes de começares uma nova campanha/coleção.')),result);return root;
}

export async function settingsView(ctx){
  const root=el('div',{class:'settings-grid'});
  const app=el('div',{class:'setting-block'},el('h3',{},'Aplicação'),el('p',{},'Um único repositório GitHub e um único projeto Vercel. As próximas versões substituem estes mesmos ficheiros.'),metric('Versão',ctx.version?.app||'2.0.0'),metric('Schema alvo',ctx.version?.schema||'1.0.0'));
  const backup=el('div',{class:'setting-block'},el('h3',{},'Backup & recuperação'),el('p',{},'Cria uma cópia completa dos dados locais antes de mudanças importantes.'),button('Criar backup agora',async()=>download(`ArtEssencia_Backup_${dateISO()}.json`,JSON.stringify(await db.exportAll(),null,2)),'primary'),el('br'),el('br'),button('Importar backup',()=>importBackup(ctx),'ghost'));
  const cloud=el('div',{class:'setting-block'},el('h3',{},'Base ArtEssencia'),el('p',{},'Projeto Supabase próprio, separado da DONART. A ligação real será feita após fecharmos a estrutura desta app.'),el('div',{class:'notice info'},'Backoffice ArtEssencia ↔ Supabase ArtEssencia ↔ futura Loja.'));
  const paramValues={
    laborRate:Number(await db.getSetting('atelier.laborRate',5.8)),
    extrasPct:Number(await db.getSetting('atelier.extrasPct',5)),
    wastePct:Number(await db.getSetting('atelier.wastePct',10)),
    targetMarginPct:Number(await db.getSetting('atelier.targetMarginPct',60)),
    alertMarginPct:Number(await db.getSetting('atelier.alertMarginPct',40)),
    paymentFeePct:Number(await db.getSetting('atelier.paymentFeePct',0)),
    packagingCost:Number(await db.getSetting('atelier.packagingCost',0)),
    equipmentRate:Number(await db.getSetting('atelier.equipmentRate',0)),
    batchUnits:Number(await db.getSetting('atelier.batchUnits',1))
  };
  const defaults=el('div',{class:'setting-block'},el('h3',{},'Parâmetros do atelier'),el('p',{},'Todos estes valores são editáveis manualmente. Funcionam apenas como valores iniciais para novos produtos; cada produto pode depois ter parâmetros próprios.'));
  const pf=el('div',{class:'form-grid'});
  const laborRate=input('laborRate',paramValues.laborRate,'number',{step:.01,min:0});
  const extrasPct=input('extrasPct',paramValues.extrasPct,'number',{step:.1,min:0});
  const wastePct=input('wastePct',paramValues.wastePct,'number',{step:.1,min:0});
  const targetMarginPct=input('targetMarginPct',paramValues.targetMarginPct,'number',{step:.1,min:0,max:95});
  const alertMarginPct=input('alertMarginPct',paramValues.alertMarginPct,'number',{step:.1,min:0,max:95});
  const paymentFeePct=input('paymentFeePct',paramValues.paymentFeePct,'number',{step:.1,min:0});
  const packagingCost=input('packagingCost',paramValues.packagingCost,'number',{step:.01,min:0});
  const equipmentRate=input('equipmentRate',paramValues.equipmentRate,'number',{step:.01,min:0});
  const batchUnits=input('batchUnits',paramValues.batchUnits,'number',{step:1,min:1});
  pf.append(
    field('Mão de obra (€ / hora)',laborRate),
    field('Consumíveis / extras (%)',extrasPct),
    field('Desperdício / defeito (%)',wastePct),
    field('Margem alvo (%)',targetMarginPct),
    field('Alerta de margem (%)',alertMarginPct),
    field('Taxa de pagamento padrão (%)',paymentFeePct),
    field('Embalagem padrão / unidade (€)',packagingCost),
    field('Custo equipamento / hora (€)',equipmentRate),
    field('Unidades padrão por lote',batchUnits)
  );
  const saveParams=button('Guardar parâmetros',async()=>{
    await db.setSetting('atelier.laborRate',Number(laborRate.value||0));
    await db.setSetting('atelier.extrasPct',Number(extrasPct.value||0));
    await db.setSetting('atelier.wastePct',Number(wastePct.value||0));
    await db.setSetting('atelier.targetMarginPct',Number(targetMarginPct.value||0));
    await db.setSetting('atelier.alertMarginPct',Number(alertMarginPct.value||0));
    await db.setSetting('atelier.paymentFeePct',Number(paymentFeePct.value||0));
    await db.setSetting('atelier.packagingCost',Number(packagingCost.value||0));
    await db.setSetting('atelier.equipmentRate',Number(equipmentRate.value||0));
    await db.setSetting('atelier.batchUnits',Math.max(1,Number(batchUnits.value||1)));
    toast('Parâmetros do atelier guardados.');
  },'primary');
  const resetParams=button('Repor valores recomendados',async()=>{
    laborRate.value=5.8;extrasPct.value=5;wastePct.value=10;targetMarginPct.value=60;alertMarginPct.value=40;
    paymentFeePct.value=0;packagingCost.value=0;equipmentRate.value=0;batchUnits.value=1;
  },'ghost');
  defaults.append(pf,el('div',{class:'toolbar',style:'margin-top:12px'},saveParams,resetParams),el('div',{class:'notice info'},'Alterar estes parâmetros não modifica automaticamente produtos antigos. Isso preserva os custos históricos e permite afinar cada produto manualmente.'));
  root.append(app,backup,cloud,defaults);return root;
}
function importBackup(ctx){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const f=i.files?.[0];if(!f)return;await db.importAll(JSON.parse(await f.text()));toast('Backup importado.');ctx.refresh()}catch(e){alert(`Erro: ${e.message}`)}};i.click()}



export async function saleView(ctx){
  const [clients,products]=await Promise.all(['clients','products'].map(db.all));
  const root=el('div',{class:'split'}),form=el('div',{class:'card'}),summary=el('div',{class:'card'});
  form.append(section('Venda rápida','Ideal para encomendas por mensagem, presencial ou redes sociais'));
  const fg=el('div',{class:'form-grid'}),client=select('client',[['','Cliente ocasional'],...clients.map(c=>[c.id,c.name])]),product=select('product',[['','Selecionar produto'],...products.filter(p=>p.active!==false).map(p=>[p.id,p.name])]),qty=input('qty',1,'number',{min:1}),due=input('due',dateISO(),'date'),payment=select('payment',paymentMethods.map(x=>[x,x])) ,paid=input('paid',0,'number',{step:.01,min:0}),note=textarea('note','',{placeholder:'Fragrância, cor, personalização, evento, texto…'});
  fg.append(field('Cliente',client),field('Produto',product),field('Quantidade',qty),field('Data pretendida',due),field('Pagamento',payment),field('Valor já pago (€)',paid),field('Personalização / notas',note,true));form.append(fg);
  const total=el('strong',{},euro(0));const refresh=()=>{const p=findProduct(products,product.value);total.textContent=euro(Number(p?.price||0)*Number(qty.value||0))};product.onchange=qty.oninput=refresh;
  form.append(el('div',{class:'toolbar',style:'margin-top:12px'},button('Criar encomenda',async()=>{const p=findProduct(products,product.value);if(!p)return alert('Seleciona um produto.');const oid=uid('o'),number=`AE-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;const econ=calcProduct(p,await db.all('materials'),await db.all('kitItems'),products);await db.put('orders',{id:oid,number,clientId:client.value,status:'Confirmada',dueDate:due.value,delivery:'Levantamento',personalization:note.value,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});await db.put('orderItems',{id:uid('oi'),orderId:oid,productId:p.id,productName:p.name,qty:Number(qty.value||1),unitPrice:Number(p.price||0),costSnapshot:econ.trueCost});if(Number(paid.value)>0){await db.put('payments',{id:uid('pay'),orderId:oid,date:dateISO(),amount:Number(paid.value),method:payment.value,account:'',note:'Venda rápida',createdAt:new Date().toISOString()});await db.put('cashMovements',{id:uid('cm'),date:dateISO(),type:'in',category:'Pagamento cliente',amount:Number(paid.value),note:number,linkedType:'payment',linkedId:oid,createdAt:new Date().toISOString()})}toast('Encomenda criada.');ctx.go('orders')},'primary')));
  summary.append(section('Resumo da venda','O valor é calculado pelo PVP atual'),metric('Total previsto','',total.outerHTML),el('div',{class:'notice info'},'O custo do produto é guardado como snapshot na encomenda, para que alterações futuras aos custos não reescrevam o histórico.'));
  root.append(form,summary);return root;
}

export async function quotesView(ctx,opts={}){
  const [orders,items,clients,products,payments]=await Promise.all(['orders','orderItems','clients','products','payments'].map(db.all));
  const quotes=orders.filter(o=>['Orçamento','Aceite','Recusado'].includes(o.status)||o.isQuote);
  const root=el('div',{class:'grid'}),summary=el('div',{class:'quote-summary'});
  summary.append(kpi('Em aberto',quotes.filter(q=>q.status==='Orçamento').length,'A acompanhar','📄'),kpi('Aceites',quotes.filter(q=>q.status==='Aceite').length,'Prontos a converter','✓'),kpi('Recusados',quotes.filter(q=>q.status==='Recusado').length,'Histórico','×'),kpi('Valor proposto',euro(sum(quotes.filter(q=>q.status!=='Recusado'),q=>sum(items.filter(i=>i.orderId===q.id),i=>i.qty*i.unitPrice))),'Total em proposta','€'));root.append(summary);
  root.append(el('div',{class:'toolbar'},button('+ Novo orçamento',()=>orderModal(ctx,clients,products,{status:'Orçamento',isQuote:true}),'primary')));
  const box=el('div');const rows=quotes.map(q=>{const total=sum(items.filter(i=>i.orderId===q.id),i=>i.qty*i.unitPrice),dep=Number(q.depositPct??50)/100*total;return [esc(q.number||''),esc(findClient(clients,q.clientId)?.name||'—'),fmt(q.dueDate),euro(total),euro(dep),badge(q.status||'Orçamento',q.status==='Aceite'?'ok':q.status==='Recusado'?'danger':'warn'),`<button class="btn ghost small" data-act="edit" data-id="${q.id}">Abrir</button> <button class="btn ok small" data-act="convert" data-id="${q.id}">Converter</button> <button class="btn ghost small" data-act="print" data-id="${q.id}">PDF/Imprimir</button>`]});const t=table(['N.º','Cliente','Data','Total','Sinal 50%','Estado','Ações'],rows);t.onclick=async e=>{const id=e.target.dataset.id,act=e.target.dataset.act;if(!id)return;const q=quotes.find(x=>x.id===id);if(act==='edit')orderModal(ctx,clients,products,q,items.filter(i=>i.orderId===id));if(act==='convert'){q.status='Confirmada';q.isQuote=false;q.updatedAt=new Date().toISOString();await db.put('orders',q);await db.put('quoteHistory',{id:uid('qh'),quoteId:q.id,action:'converted',at:new Date().toISOString()});toast('Orçamento convertido em encomenda.');ctx.refresh()}if(act==='print')printQuote(q,items.filter(i=>i.orderId===id),findClient(clients,q.clientId))};box.append(t);root.append(box);if(opts.create)setTimeout(()=>orderModal(ctx,clients,products,{status:'Orçamento',isQuote:true}),0);return root;
}
function printQuote(q,its,client){const total=sum(its,i=>i.qty*i.unitPrice),dep=total*Number(q.depositPct??50)/100;const w=window.open('','_blank');w.document.write(`<html><head><title>${q.number}</title><style>body{font-family:Arial;padding:38px;color:#2f2722}h1{color:#795746}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}.tot{font-size:20px;font-weight:bold;text-align:right;margin-top:20px}</style></head><body><h1>ArtEssencia · Orçamento</h1><p><b>${esc(q.number||'')}</b><br>Cliente: ${esc(client?.name||'—')}<br>Validade/Entrega: ${esc(q.dueDate||'—')}</p><table><tr><th>Produto</th><th>Qtd.</th><th>PVP</th><th>Total</th></tr>${its.map(i=>`<tr><td>${esc(i.productName)}</td><td>${i.qty}</td><td>${euro(i.unitPrice)}</td><td>${euro(i.qty*i.unitPrice)}</td></tr>`).join('')}</table><div class="tot">Total: ${euro(total)}</div><p>Sinal recomendado para confirmação: <b>${euro(dep)}</b> (${q.depositPct??50}%).</p><p>${esc(q.personalization||'')}</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}

export async function stockView(ctx,opts={}){
 const [materials,moves]=await Promise.all(['materials','stockMovements'].map(db.all));const tab=opts.tab||'stock',root=el('div');const nav=el('div',{class:'subnav'});[['stock','Stock'],['movements','Movimentos'],['alerts','Alertas']].forEach(([id,l])=>nav.append(el('button',{class:tab===id?'active':'',onclick:()=>ctx.go('stock',{tab:id})},l)));root.append(nav);
 if(tab==='stock'){root.append(el('div',{class:'toolbar'},button('+ Nova matéria',()=>materialModal(ctx),'primary'),button('Movimento manual',()=>stockMoveModal(ctx,materials),'secondary'),button('Registar compra',()=>ctx.go('purchases',{create:true}),'ghost')));const rows=materials.map(m=>[esc(m.name),esc(m.category),`${Number(m.stock||0).toFixed(2)} ${esc(m.unit||'')}`,`${Number(m.minStock||0).toFixed(2)} ${esc(m.unit||'')}`,euro(m.unitCost),euro(Number(m.stock||0)*Number(m.unitCost||0)),badge(Number(m.stock)<=Number(m.minStock||0)?'Comprar':'OK',Number(m.stock)<=Number(m.minStock||0)?'warn':'ok'),`<button class="btn ghost small" data-id="${m.id}">Editar</button>`]);const t=table(['Artigo','Categoria','Stock','Mínimo','Custo/un.','Valor stock','Estado',''],rows);t.onclick=e=>{const id=e.target.dataset.id;if(id)materialModal(ctx,materials.find(m=>m.id===id))};root.append(t)}
 if(tab==='movements'){root.append(el('div',{class:'toolbar'},button('+ Movimento manual',()=>stockMoveModal(ctx,materials),'primary')));root.append(table(['Data','Artigo','Tipo','Quantidade','Motivo'],moves.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(m=>[fmt(m.createdAt),esc(materials.find(x=>x.id===m.materialId)?.name||m.materialId),badge(m.type,m.type==='in'?'ok':m.type==='waste'?'danger':'warn'),Number(m.qty||0).toFixed(3),esc(m.note||'')])))}
 if(tab==='alerts'){const crit=materials.filter(m=>Number(m.stock)<=Number(m.minStock||0));root.append(el('div',{class:'card'},section('Lista de compras sugerida','Materiais abaixo ou no mínimo'),table(['Matéria','Atual','Mínimo','Sugestão'],crit.map(m=>[esc(m.name),`${m.stock} ${m.unit}`,`${m.minStock} ${m.unit}`,`${Math.max(0,Number(m.minStock||0)*2-Number(m.stock||0)).toFixed(2)} ${m.unit}`]))))}return root;
}
function stockMoveModal(ctx,materials){const f=el('div',{class:'form-grid'}),mat=select('m',[['','Selecionar'],...materials.map(m=>[m.id,m.name])]),type=select('type',[['in','Entrada'],['out','Saída'],['waste','Desperdício'],['adjust','Acerto para valor']]),qty=input('qty',0,'number',{step:.001}),note=input('note','');f.append(field('Artigo',mat),field('Tipo',type),field('Quantidade / novo valor',qty),field('Motivo',note));modal('Movimento de stock',f,{onSave:async()=>{const m=materials.find(x=>x.id===mat.value);if(!m)return false;const q=Number(qty.value||0),before=Number(m.stock||0);m.stock=type.value==='adjust'?q:type.value==='in'?before+q:before-q;m.updatedAt=new Date().toISOString();await db.put('materials',m);await db.put('stockMovements',{id:uid('sm'),materialId:m.id,type:type.value,qty:q,before,after:m.stock,note:note.value,createdAt:new Date().toISOString()});ctx.refresh();return true}})}

export async function cashAdvancedView(ctx,opts={}){
 const [cash,payments,orders,items,clients,expenses,investments,transfers]=await Promise.all(['cashMovements','payments','orders','orderItems','clients','expenses','investments','transfers'].map(db.all));const tab=opts.tab||'cash',root=el('div'),nav=el('div',{class:'subnav'});[['cash','Caixa'],['receivable','Por receber'],['expenses','Despesas'],['investments','Investimentos'],['transfers','Transferências']].forEach(([id,l])=>nav.append(el('button',{class:tab===id?'active':'',onclick:()=>ctx.go('cash',{tab:id})},l)));root.append(nav);
 if(tab==='cash'){const incoming=sum(cash.filter(x=>x.type==='in'),x=>x.amount),out=sum(cash.filter(x=>x.type==='out'),x=>x.amount);root.append(el('div',{class:'grid cols-3'},kpi('Entradas',euro(incoming),'Caixa registado','↗'),kpi('Saídas',euro(out),'Compras e despesas','↘'),kpi('Saldo',euro(incoming-out),'Sem transferências internas','€')),el('div',{class:'toolbar'},button('+ Movimento',()=>cashModal(ctx),'primary'),button('+ Pagamento cliente',()=>paymentModal(ctx,orders,clients),'secondary')),table(['Data','Tipo','Categoria','Valor','Nota'],cash.sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt))).map(x=>[fmt(x.date||x.createdAt),badge(x.type==='in'?'Entrada':'Saída',x.type==='in'?'ok':'warn'),esc(x.category||''),euro(x.amount),esc(x.note||'')])))}
 if(tab==='receivable'){const rows=[];for(const o of orders.filter(o=>!['Entregue','Cancelada','Recusado'].includes(o.status))){const total=sum(items.filter(i=>i.orderId===o.id),i=>i.qty*i.unitPrice),paid=sum(payments.filter(p=>p.orderId===o.id),p=>p.amount),due=Math.max(0,total-paid);if(due>.001)rows.push([esc(o.number),esc(findClient(clients,o.clientId)?.name||'—'),euro(total),euro(paid),euro(due),`<button class="btn primary small" data-id="${o.id}">Receber</button>`])}const t=table(['Encomenda','Cliente','Total','Pago','Falta',''],rows);t.onclick=e=>{if(e.target.dataset.id)paymentModal(ctx,orders,clients,e.target.dataset.id)};root.append(t)}
 if(tab==='expenses'){root.append(el('div',{class:'toolbar'},button('+ Despesa',()=>expenseModal(ctx),'primary')),table(['Data','Categoria','Valor','Nota'],expenses.map(x=>[fmt(x.date),esc(x.category||''),euro(x.amount),esc(x.note||'')])))}
 if(tab==='investments'){root.append(el('div',{class:'toolbar'},button('+ Investimento',()=>investmentModal(ctx),'primary')),table(['Data','Investimento','Valor','Nota'],investments.map(x=>[fmt(x.date),esc(x.name||''),euro(x.amount),esc(x.note||'')])))}
 if(tab==='transfers'){root.append(el('div',{class:'toolbar'},button('+ Transferência interna',()=>transferModal(ctx),'primary')),el('div',{class:'notice info'},'Transferências entre contas não contam como receita nem despesa.'),table(['Data','Origem','Destino','Valor','Nota'],transfers.map(x=>[fmt(x.date),esc(x.fromAccount||''),esc(x.toAccount||''),euro(x.amount),esc(x.note||'')])))}return root;
}
function paymentModal(ctx,orders,clients,pre=''){const f=el('div',{class:'form-grid'}),order=select('order',[['','Selecionar'],...orders.filter(o=>!['Cancelada','Recusado'].includes(o.status)).map(o=>[o.id,`${o.number} · ${findClient(clients,o.clientId)?.name||''}`])],pre),amount=input('amount',0,'number',{step:.01,min:.01}),method=select('method',paymentMethods.map(x=>[x,x])),account=input('account','',{placeholder:'Ex.: MB Way pessoal, conta negócio, caixa'}),date=input('date',dateISO(),'date'),note=input('note','');f.append(field('Encomenda',order),field('Valor (€)',amount),field('Meio de pagamento',method),field('Conta destino',account),field('Data',date),field('Nota',note));modal('Registar pagamento',f,{onSave:async()=>{if(!order.value||Number(amount.value)<=0)return false;const p={id:uid('pay'),orderId:order.value,amount:Number(amount.value),method:method.value,account:account.value,date:date.value,note:note.value,createdAt:new Date().toISOString()};await db.put('payments',p);await db.put('cashMovements',{id:uid('cm'),type:'in',category:'Pagamento cliente',amount:p.amount,date:p.date,note:`${orders.find(o=>o.id===p.orderId)?.number||''} · ${p.method}`,linkedType:'payment',linkedId:p.id,createdAt:new Date().toISOString()});ctx.refresh();return true}})}
function transferModal(ctx){const f=el('div',{class:'form-grid'}),from=input('from',''),to=input('to',''),amount=input('amount',0,'number',{step:.01,min:0}),date=input('date',dateISO(),'date'),note=input('note','');f.append(field('Conta origem',from),field('Conta destino',to),field('Valor (€)',amount),field('Data',date),field('Nota',note,true));modal('Transferência interna',f,{onSave:async()=>{await db.put('transfers',{id:uid('tr'),fromAccount:from.value,toAccount:to.value,amount:Number(amount.value),date:date.value,note:note.value,createdAt:new Date().toISOString()});ctx.refresh();return true}})}

async function managerCard(ctx,store,title,subtitle,fieldsDef){const rows=await db.all(store),card=el('div',{class:'card'},section(title,subtitle,[button('+ Adicionar',()=>creatorEntityModal(ctx,store,title,fieldsDef),'primary small')])),grid=el('div',{class:'creator-grid'});if(!rows.length)grid.append(el('div',{class:'empty'},'Ainda sem registos.'));for(const x of rows){const it=el('div',{class:'creator-item'}),head=el('div',{class:'creator-item-head'},el('div',{},el('strong',{},x.name||x.label||'Sem nome'),el('div',{class:'small muted'},x.description||x.note||'')),el('span',{html:badge(x.active!==false?'Ativo':'Inativo',x.active!==false?'ok':'neutral')}));it.append(head,el('div',{class:'toolbar',style:'margin-top:8px'},button('Editar',()=>creatorEntityModal(ctx,store,title,fieldsDef,x),'ghost small'),button(x.active!==false?'Desativar':'Ativar',async()=>{x.active=x.active===false; x.updatedAt=new Date().toISOString();await db.put(store,x);ctx.refresh()},'secondary small'),button('Eliminar',async()=>{if(confirm('Eliminar este registo?')){await db.del(store,x.id);ctx.refresh()}},'danger small')));grid.append(it)}card.append(grid);return card}
function creatorEntityModal(ctx,store,title,defs,existing={}){const f=el('div',{class:'form-grid'}),controls={};for(const d of defs){let c;if(d.type==='select')c=select(d.key,d.options,existing[d.key]??d.default??'');else if(d.type==='textarea')c=textarea(d.key,existing[d.key]??d.default??'');else c=input(d.key,existing[d.key]??d.default??'',d.type||'text',d.attrs||{});controls[d.key]=c;f.append(field(d.label,c,!!d.span2,d.help||''))}modal(existing.id?`Editar ${title}`:`Adicionar · ${title}`,f,{onSave:async()=>{const row={...existing,id:existing.id||uid(store.slice(0,3)),active:existing.active!==false,updatedAt:new Date().toISOString()};for(const d of defs)row[d.key]=d.numeric?Number(controls[d.key].value||0):controls[d.key].value;await db.put(store,row);ctx.refresh();return true}})}

export async function catalogsView(ctx,opts={}){const tab=opts.tab||'catalogs',root=el('div'),nav=el('div',{class:'subnav'});[['catalogs','Catálogos'],['themes','Temas'],['occasions','Ocasiões'],['colors','Cores'],['personalizations','Personalizações'],['pricing','Preços do Criador']].forEach(([id,l])=>nav.append(el('button',{class:tab===id?'active':'',onclick:()=>ctx.go('catalogs',{tab:id})},l)));root.append(nav);
 if(tab==='catalogs'){const products=await db.all('products'),catalogs=await db.all('catalogs');root.append(await catalogsPanel(ctx,catalogs,products))}
 if(tab==='themes')root.append(await managerCard(ctx,'themes','Temas','Ex.: Batizado, Comunhão, Natal, Botânico',[{key:'name',label:'Nome'},{key:'description',label:'Descrição',span2:true},{key:'image',label:'Imagem / URL',span2:true}]));
 if(tab==='occasions')root.append(await managerCard(ctx,'occasions','Ocasiões','Eventos e momentos em que o cliente poderá usar o criador',[{key:'name',label:'Nome'},{key:'description',label:'Descrição',span2:true}]));
 if(tab==='colors')root.append(await managerCard(ctx,'colors','Cores','Paleta disponível para peças, fitas, pigmentação e acabamento',[{key:'name',label:'Nome'},{key:'hex',label:'Cor HEX',default:'#c8a58d'},{key:'description',label:'Aplicação / notas',span2:true}]));
 if(tab==='personalizations')root.append(await managerCard(ctx,'personalizations','Personalizações adicionais','Fita, etiqueta, cartão, gravação, nome ou outra opção',[{key:'name',label:'Nome'},{key:'type',label:'Tipo',type:'select',options:[['text','Texto'],['select','Seleção'],['boolean','Sim/Não']]},{key:'extraPrice',label:'Custo extra (€)',type:'number',numeric:true,attrs:{step:.01,min:0}},{key:'charLimit',label:'Limite caracteres',type:'number',numeric:true,attrs:{min:0}},{key:'description',label:'Descrição',span2:true}]));
 if(tab==='pricing')root.append(await managerCard(ctx,'creatorPricing','Preços do Criador','Regras de preço por quantidade/tipo de trabalho',[{key:'name',label:'Regra'},{key:'minQty',label:'Qtd. mínima',type:'number',numeric:true,attrs:{min:1}},{key:'basePrice',label:'Preço base (€)',type:'number',numeric:true,attrs:{step:.01,min:0}},{key:'extraUnit',label:'Extra por unidade (€)',type:'number',numeric:true,attrs:{step:.01,min:0}},{key:'description',label:'Notas',span2:true}]));return root}

export async function specialEditionsView(ctx){const [collections,products]=await Promise.all(['collections','products'].map(db.all));const root=el('div',{class:'grid'});root.append(el('div',{class:'toolbar'},button('+ Nova edição especial',()=>specialEditionModal(ctx,products),'primary')));const grid=el('div',{class:'creator-grid'});for(const c of collections){const count=(c.productIds||[]).length;grid.append(el('div',{class:'creator-item'},el('div',{class:'creator-item-head'},el('div',{},el('strong',{},c.name),el('div',{class:'small muted'},`${fmt(c.startDate)} → ${fmt(c.endDate)} · ${count} produto(s)`)),el('span',{html:badge(c.active!==false?'Ativa':'Inativa',c.active!==false?'ok':'neutral')})),c.featured?el('div',{class:'notice warn',style:'margin-top:8px'},'Destaque principal da homepage'):null,el('div',{class:'toolbar',style:'margin-top:8px'},button('Editar',()=>specialEditionModal(ctx,products,c),'ghost small'),button('Eliminar',async()=>{if(confirm('Eliminar edição?')){await db.del('collections',c.id);ctx.refresh()}},'danger small'))))}if(!collections.length)grid.append(el('div',{class:'empty'},'Ainda sem edições especiais.'));root.append(grid);return root}
function specialEditionModal(ctx,products,existing={}){const f=el('div',{class:'form-grid'}),name=input('name',existing.name||''),start=input('start',existing.startDate||'','date'),end=input('end',existing.endDate||'','date'),active=select('active',[['true','Ativa'],['false','Inativa']],String(existing.active!==false)),featured=select('featured',[['false','Não'],['true','Sim — topo da homepage']],String(!!existing.featured)),heroTitle=input('heroTitle',existing.heroTitle||''),heroText=textarea('heroText',existing.heroText||''),heroImage=input('heroImage',existing.heroImage||'');const picks=el('div',{class:'chip-row'}),selected=new Set(existing.productIds||[]);for(const p of products.filter(p=>p.active!==false)){const cb=el('input',{type:'checkbox',value:p.id});cb.checked=selected.has(p.id);cb.onchange=()=>cb.checked?selected.add(p.id):selected.delete(p.id);picks.append(el('label',{class:'chip'},cb,' ',p.name))}f.append(field('Nome da edição',name),field('Estado',active),field('Data início',start),field('Data fim',end),field('Topo homepage',featured),field('Título do hero',heroTitle),field('Texto hero',heroText,true),field('Imagem / URL',heroImage,true),field('Produtos da edição',picks,true));modal(existing.id?'Editar edição':'Nova edição especial',f,{wide:true,onSave:async()=>{await db.put('collections',{...existing,id:existing.id||uid('col'),name:name.value,startDate:start.value,endDate:end.value,active:active.value==='true',featured:featured.value==='true',heroTitle:heroTitle.value,heroText:heroText.value,heroImage:heroImage.value,productIds:[...selected],updatedAt:new Date().toISOString()});ctx.refresh();return true}})}

export async function homepageView(ctx){const rows=await db.all('homepage'),cfg=rows[0]||{id:'main',eyebrow:'FEITO À MÃO NO NOSSO ATELIER',heroTitle:'Peças com aroma, textura e significado.',heroSubtitle:'Velas, Jesmonite, sabonetes e presentes personalizados.',cta1:'Ver coleção',cta2:'Criar presente',benefits:['Feito à mão','Personalização','Produção por encomenda'],categories:['Velas','Jesmonite','Sabonetes','Kits & Presentes']};const root=el('div',{class:'split'}),editor=el('div',{class:'card'}),preview=el('div',{class:'card'});const f=el('div',{class:'form-grid'}),ey=input('ey',cfg.eyebrow),title=input('title',cfg.heroTitle),sub=textarea('sub',cfg.heroSubtitle),cta1=input('cta1',cfg.cta1),cta2=input('cta2',cfg.cta2),img=input('img',cfg.heroImage||''),b1=input('b1',cfg.benefits?.[0]||''),b2=input('b2',cfg.benefits?.[1]||''),b3=input('b3',cfg.benefits?.[2]||''),cats=input('cats',(cfg.categories||[]).join(', '));f.append(field('Eyebrow',ey,true),field('Título',title,true),field('Subtítulo',sub,true),field('CTA principal',cta1),field('CTA secundário',cta2),field('Imagem hero / URL',img,true),field('Destaque 1',b1),field('Destaque 2',b2),field('Destaque 3',b3),field('Categorias em destaque',cats,true));editor.append(section('Conteúdo da homepage','A edição especial em destaque terá prioridade quando ativa.'),f,el('div',{class:'toolbar',style:'margin-top:12px'},button('Guardar homepage',async()=>{await db.put('homepage',{id:'main',eyebrow:ey.value,heroTitle:title.value,heroSubtitle:sub.value,cta1:cta1.value,cta2:cta2.value,heroImage:img.value,benefits:[b1.value,b2.value,b3.value],categories:cats.value.split(',').map(x=>x.trim()).filter(Boolean),updatedAt:new Date().toISOString()});toast('Homepage guardada.');ctx.refresh()},'primary')));const p=el('div',{class:'preview-panel'},el('small',{},cfg.eyebrow),el('h2',{},cfg.heroTitle),el('p',{},cfg.heroSubtitle));preview.append(section('Pré-visualização','Estrutura editorial principal'),p);root.append(editor,preview);return root}

export async function campaignsView(ctx){const campaigns=await db.all('campaigns'),root=el('div',{class:'grid'});root.append(el('div',{class:'card'},section('Campanhas & Push','As campanhas ficam preparadas localmente; o envio real usa a Cloud quando configurada.',[button('+ Nova campanha',()=>campaignModal(ctx),'primary small')]),table(['Criada','Título','Destino','Estado'],campaigns.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(c=>[fmt(c.createdAt),esc(c.title),esc(c.destination||'Loja'),badge(c.status||'Rascunho',c.status==='Enviada'?'ok':c.status==='Agendada'?'warn':'neutral')]))));return root}

export async function deliveryView(ctx,opts={}){const rows=await db.all('deliverySettings'),cfg=rows[0]||{id:'main',pickup:true,local:true,shipping:false,leadDays:3,localFee:0,radiusKm:0,weekdays:['1','2','3','4','5','6'],dailyCapacity:10,notes:''},closed=await db.all('unavailableDates'),root=el('div',{class:'grid'});const card=el('div',{class:'card'},section('Métodos & capacidade','Regras que a futura loja utiliza para validar datas'));const f=el('div',{class:'form-grid'}),pickup=select('pickup',[['true','Disponível'],['false','Indisponível']],String(cfg.pickup)),local=select('local',[['true','Disponível'],['false','Indisponível']],String(cfg.local)),shipping=select('shipping',[['true','Disponível'],['false','Indisponível']],String(cfg.shipping)),lead=input('lead',cfg.leadDays||0,'number',{min:0}),fee=input('fee',cfg.localFee||0,'number',{step:.01,min:0}),radius=input('radius',cfg.radiusKm||0,'number',{min:0}),cap=input('cap',cfg.dailyCapacity||0,'number',{min:0}),days=input('days',(cfg.weekdays||[]).join(','), 'text',{placeholder:'1,2,3,4,5,6 (Seg=1 ... Dom=0)'}),notes=textarea('notes',cfg.notes||'');f.append(field('Levantamento',pickup),field('Entrega local',local),field('Envio',shipping),field('Antecedência mínima (dias)',lead),field('Taxa local (€)',fee),field('Raio local (km)',radius),field('Capacidade diária (un./encomendas)',cap),field('Dias disponíveis',days),field('Notas',notes,true));card.append(f,el('div',{class:'toolbar',style:'margin-top:12px'},button('Guardar regras',async()=>{await db.put('deliverySettings',{id:'main',pickup:pickup.value==='true',local:local.value==='true',shipping:shipping.value==='true',leadDays:Number(lead.value),localFee:Number(fee.value),radiusKm:Number(radius.value),dailyCapacity:Number(cap.value),weekdays:days.value.split(',').map(x=>x.trim()).filter(Boolean),notes:notes.value,updatedAt:new Date().toISOString()});toast('Entregas atualizadas.')},'primary')));root.append(card,deliveryCalendar(ctx,closed));return root}
function deliveryCalendar(ctx,closed){const card=el('div',{class:'card'},section('Dias indisponíveis','Toca num dia para fechar/abrir a produção e entregas')),now=new Date(),year=now.getFullYear(),month=now.getMonth(),title=el('strong',{},now.toLocaleDateString('pt-PT',{month:'long',year:'numeric'}));card.append(title);const grid=el('div',{class:'calendar-grid',style:'margin-top:10px'});['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].forEach(d=>grid.append(el('div',{class:'calendar-head'},d)));let first=new Date(year,month,1).getDay();first=(first+6)%7;for(let i=0;i<first;i++)grid.append(el('div',{class:'calendar-day empty'}));const n=new Date(year,month+1,0).getDate();for(let d=1;d<=n;d++){const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,isClosed=closed.some(x=>x.id===iso);grid.append(el('button',{class:`calendar-day ${isClosed?'closed':''}`,type:'button',onclick:async()=>{if(isClosed)await db.del('unavailableDates',iso);else await db.put('unavailableDates',{id:iso,date:iso,reason:'Indisponível',updatedAt:new Date().toISOString()});ctx.refresh()}},String(d),isClosed?el('small',{},'Fechado'):null))}card.append(grid);return card}

export async function cloudView(ctx){const st=await cloud.status(),root=el('div',{class:'grid'}),cfg=el('div',{class:'card'}),url=input('url',await db.getSetting('cloud.url',''), 'url',{placeholder:'https://xxxx.supabase.co'}),key=input('key',await db.getSetting('cloud.key',''), 'password',{placeholder:'Publishable / anon key'}),email=input('email',st.email||'','email'),password=input('password','','password');const f=el('div',{class:'form-grid'});f.append(field('Project URL',url,true),field('Publishable / anon key',key,true,'Nunca usar service_role no browser.'),field('Email',email),field('Password',password));cfg.append(section('Supabase ArtEssencia','Projeto exclusivo da ArtEssencia; nunca usar DONART.'),f,el('div',{class:'toolbar',style:'margin-top:12px'},button('Guardar ligação',async()=>{await cloud.configure(url.value,key.value);toast('Ligação guardada.');ctx.refresh()},'ghost'),button('Iniciar sessão',async()=>{try{await cloud.configure(url.value,key.value);await cloud.login(email.value,password.value);toast('Sessão iniciada.');ctx.refresh()}catch(e){alert(e.message)}},'primary'),button('Terminar sessão',()=>{cloud.logout();ctx.refresh()},'danger')));const sync=el('div',{class:'card'},section('Sincronização por registo','Não substitui a base inteira: envia e recebe cada registo separadamente.'));sync.append(el('div',{class:'grid cols-4'},kpi('Configuração',st.configured?'Pronta':'Em falta','URL + chave','☁️'),kpi('Sessão',st.loggedIn?'Ligada':'Desligada',st.email||'','👤'),kpi('Último envio',st.lastPush?fmt(st.lastPush):'—','Este dispositivo','↗'),kpi('Última receção',st.lastPull?fmt(st.lastPull):'—','Este dispositivo','↘')),el('div',{class:'toolbar'},button('Testar ligação',async()=>{try{const r=await cloud.testConnection();toast(`Cloud OK · schema ${r.schema}`)}catch(e){alert(e.message)}},'ghost'),button('Enviar para Cloud',async()=>{try{const n=await cloud.pushAll();toast(`${n} registos enviados.`);ctx.refresh()}catch(e){alert(e.message)}},'primary'),button('Receber da Cloud',async()=>{try{const r=await cloud.pullAll();toast(`${r.applied} atualizados · ${r.skipped} locais mais recentes.`);ctx.refresh()}catch(e){alert(e.message)}},'secondary')));root.append(cfg,sync);return root}

export async function backupView(ctx){const root=el('div',{class:'grid cols-2'}),exp=el('div',{class:'card'},section('Criar backup','Cópia completa de todos os módulos'),el('p',{class:'muted'},'Guarda este ficheiro antes de atualizações importantes, migrações ou alterações de estrutura.'),button('Exportar backup JSON',async()=>download(`ArtEssencia_Backup_${dateISO()}.json`,JSON.stringify(await db.exportAll(),null,2)),'primary')),imp=el('div',{class:'card'},section('Restaurar backup','Substitui os dados locais deste dispositivo'),el('div',{class:'notice warn'},'Importar um backup substitui os dados locais atuais. Faz primeiro uma exportação.'),el('div',{style:'margin-top:12px'},button('Importar backup',()=>importBackup(ctx),'ghost')));root.append(exp,imp);return root}
export const views={
 today:todayView,sale:saleView,atelier:atelierView,orders:ordersView,quotes:quotesView,products:productsView,costs:costsView,
 stock:stockView,materials:stockView,purchases:purchasesView,clients:clientsView,cash:cashAdvancedView,reports:reportsView,
 catalogs:catalogsView,specialEditions:specialEditionsView,homepage:homepageView,campaigns:campaignsView,delivery:deliveryView,
 shop:shopView,settings:settingsView,cloud:cloudView,backup:backupView,audit:auditView
};
