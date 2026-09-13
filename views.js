import * as db from './db.js';
import {families,materialCategories,orderStatuses,paymentMethods,deliveryMethods,euro,uid,nextSku,calcProduct,stockNeed,dateISO} from './domain.js';
import {el,button,badge,table,modal,field,input,select,textarea,kpi,section,toast,download,esc} from './ui.js';
import {runAudit} from './audit.js';

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
  const render=()=>{const q=search.value.toLowerCase(),family=opts.family||'';const shown=products.filter(p=>(!family||p.family===family)&&(!q||`${p.name} ${p.sku}`.toLowerCase().includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));const rows=shown.map(p=>{const e=calcProduct(p,materials,kitItems,products);return [esc(p.sku||''),`${families[p.family]?.icon||'✨'} ${esc(p.name)}`,esc(p.subtype||''),euro(p.price),euro(e.trueCost),euro(e.recommended),badge(`${e.margin.toFixed(1)}%`,e.margin<40?'danger':e.margin<60?'warn':'ok'),p.published?badge('Online','info'):badge('Privado','neutral'),`<button class="btn ghost small" data-edit="${p.id}">Editar</button>`]});box.innerHTML='';const t=table(['SKU','Produto','Tipo','PVP','Custo real','PVP rec.','Margem','Loja',''],rows);t.addEventListener('click',e=>{const id=e.target.dataset.edit;if(id)productModal(ctx,products,materials,products.find(p=>p.id===id))});box.append(t)};
  search.oninput=render;render();if(opts.create)setTimeout(()=>productModal(ctx,products,materials),0);return root;
}
function productModal(ctx,products,materials,existing={}){
  const form=el('div',{class:'form-grid'}),family=select('family',familyOptions(),existing.family||'candle'),sku=input('sku',existing.sku||nextSku(products,existing.family||'candle')),name=input('name',existing.name||''),subtype=select('subtype',(families[existing.family||'candle']?.subtypes||[]).map(x=>[x,x]),existing.subtype||'');
  const price=input('price',existing.price||0,'number',{step:.01,min:0}),wholesale=input('wholesalePrice',existing.wholesalePrice||0,'number',{step:.01,min:0}),batch=input('batchUnits',existing.batchUnits||1,'number',{min:1}),labor=input('laborMinutes',existing.laborMinutes||0,'number',{min:0}),rate=input('laborRate',existing.laborRate??5.8,'number',{step:.01,min:0}),pack=input('packagingCost',existing.packagingCost||0,'number',{step:.01,min:0});
  const extras=input('extrasPct',existing.extrasPct??5,'number',{step:.1,min:0}),waste=input('wastePct',existing.wastePct??10,'number',{step:.1,min:0}),target=input('targetMarginPct',existing.targetMarginPct??60,'number',{step:.1,min:0,max:95}),fee=input('paymentFeePct',existing.paymentFeePct||0,'number',{step:.1,min:0});
  const moldName=input('moldName',existing.moldName||''),moldCost=input('moldCost',existing.moldCost||0,'number',{step:.01,min:0}),moldLife=input('moldLife',existing.moldLife||0,'number',{min:0}),equipMin=input('equipmentMinutes',existing.equipmentMinutes||0,'number',{min:0}),equipRate=input('equipmentRate',existing.equipmentRate||0,'number',{step:.01,min:0});
  const published=select('published',[['false','Não'],['true','Sim']],String(!!existing.published)),active=select('active',[['true','Ativo'],['false','Inativo']],String(existing.active!==false));
  const desc=textarea('onlineDescription',existing.onlineDescription||'',{placeholder:'Descrição para catálogo / futura loja'});
  form.append(field('Família',family),field('SKU',sku),field('Nome do produto',name),field('Subtipo',subtype),field('PVP praticado (€)',price),field('PVP grossista (€)',wholesale),field('Unidades por lote',batch),field('Tempo de trabalho / lote (min)',labor),field('Valor hora (€)',rate),field('Embalagem / un. (€)',pack),field('Consumíveis / extras (%)',extras),field('Desperdício / defeito (%)',waste),field('Margem alvo (%)',target),field('Taxa pagamento (%)',fee),field('Molde / recipiente',moldName),field('Custo molde (€)',moldCost),field('Vida útil molde (un.)',moldLife),field('Equipamento / lote (min)',equipMin),field('Custo equipamento/h (€)',equipRate),field('Publicado na loja',published),field('Estado',active),field('Descrição online',desc,true));
  const recipe=existing.recipe?existing.recipe.map(x=>({...x})):[];
  const recipeBox=el('div',{class:'field span2'},el('label',{},'Ficha técnica · matérias e quantidades por lote')),recipeList=el('div',{class:'grid'});
  const renderRecipe=()=>{recipeList.innerHTML='';recipe.forEach((r,i)=>{const row=el('div',{class:'grid cols-3'}),ms=select('m',[['','Matéria'],...materials.map(m=>[m.id,`${m.name} (${m.unit||''})`])],r.materialId),q=input('q',r.qty||0,'number',{step:.001,min:0});ms.onchange=()=>r.materialId=ms.value;q.oninput=()=>r.qty=Number(q.value||0);row.append(ms,q,button('Remover',()=>{recipe.splice(i,1);renderRecipe()},'danger small'));recipeList.append(row)})};
  recipeBox.append(recipeList,button('+ Adicionar matéria',()=>{recipe.push({materialId:'',qty:0});renderRecipe()},'ghost small'));renderRecipe();form.append(recipeBox);
  const refreshSubtype=()=>{const old=subtype.value;subtype.innerHTML='';for(const st of families[family.value]?.subtypes||[]){const o=document.createElement('option');o.value=o.textContent=st;subtype.append(o)}if([...subtype.options].some(o=>o.value===old))subtype.value=old;if(!existing.id||!sku.value.trim())sku.value=nextSku(products,family.value)};
  family.onchange=refreshSubtype;
  modal(existing.id?'Editar produto':'Novo produto',form,{wide:true,onSave:async()=>{
    if(!name.value.trim()){alert('Indica o nome.');return false}
    const duplicate=products.some(p=>p.id!==existing.id&&String(p.sku||'').toUpperCase()===sku.value.trim().toUpperCase());if(duplicate){alert('Este SKU já existe.');return false}
    const p={...existing,id:existing.id||uid('p'),family:family.value,sku:sku.value.trim(),name:name.value.trim(),subtype:subtype.value,price:Number(price.value||0),wholesalePrice:Number(wholesale.value||0),batchUnits:Number(batch.value||1),laborMinutes:Number(labor.value||0),laborRate:Number(rate.value||0),packagingCost:Number(pack.value||0),extrasPct:Number(extras.value||0),wastePct:Number(waste.value||0),targetMarginPct:Number(target.value||0),paymentFeePct:Number(fee.value||0),moldName:moldName.value,moldCost:Number(moldCost.value||0),moldLife:Number(moldLife.value||0),equipmentMinutes:Number(equipMin.value||0),equipmentRate:Number(equipRate.value||0),published:published.value==='true',active:active.value==='true',onlineDescription:desc.value,recipe:recipe.filter(x=>x.materialId&&Number(x.qty)>=0),updatedAt:new Date().toISOString(),createdAt:existing.createdAt||new Date().toISOString()};
    const econ=calcProduct(p,materials,[],products);p.lastTrueCost=econ.trueCost;p.lastProductionCost=econ.production;await db.put('products',p);toast('Produto guardado.');ctx.refresh();return true
  }})
}

export async function costsView(){
  const [products,materials,kitItems]=await Promise.all(['products','materials','kitItems'].map(db.all));
  const root=el('div',{class:'grid'});const evaluated=products.map(p=>({p,e:calcProduct(p,materials,kitItems,products)}));
  root.append(el('div',{class:'grid cols-4'},kpi('Produtos',products.length,'Com motor de custos','✨'),kpi('Margem média',`${(evaluated.length?sum(evaluated,x=>x.e.margin)/evaluated.length:0).toFixed(1)}%`,'Margem real','%'),kpi('Abaixo de 40%',evaluated.filter(x=>x.e.margin<40).length,'Rever preço/custo','⚠'),kpi('Matérias com custo',materials.filter(m=>Number(m.unitCost)>0).length,'Custos médios registados','€')));
  const rows=evaluated.sort((a,b)=>a.e.margin-b.e.margin).map(({p,e})=>[esc(p.sku),esc(p.name),euro(e.materialUnit),euro(e.labor),euro(e.mold),euro(e.energy),euro(e.production),euro(e.trueCost),euro(e.recommended),badge(`${e.margin.toFixed(1)}%`,e.margin<40?'danger':e.margin<60?'warn':'ok')]);
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
  const defaults=el('div',{class:'setting-block'},el('h3',{},'Parâmetros do atelier'),el('p',{},'Valores base para novos produtos: mão de obra 5,80 €/h, extras 5%, desperdício 10%, margem alvo 60% e alerta aos 40%.'));
  root.append(app,backup,cloud,defaults);return root;
}
function importBackup(ctx){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const f=i.files?.[0];if(!f)return;await db.importAll(JSON.parse(await f.text()));toast('Backup importado.');ctx.refresh()}catch(e){alert(`Erro: ${e.message}`)}};i.click()}

export const views={
 today:todayView,atelier:atelierView,orders:ordersView,products:productsView,costs:costsView,
 materials:materialsView,purchases:purchasesView,clients:clientsView,cash:cashView,reports:reportsView,
 shop:shopView,audit:auditView,settings:settingsView
};
