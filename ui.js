export const qs=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export function el(tag,attrs={},...children){
  const n=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs)){
    if(k==='class')n.className=v;
    else if(k==='html')n.innerHTML=v;
    else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);
    else if(v!==undefined&&v!==null&&v!==false)n.setAttribute(k,v===true?'':v);
  }
  for(const c of children.flat()){if(c===null||c===undefined)continue;n.append(c?.nodeType?c:document.createTextNode(String(c)))}
  return n;
}
export function button(text,onClick,kind='secondary',extra={}){return el('button',{class:`btn ${kind}`,type:'button',onclick:onClick,...extra},text)}
export function badge(text,kind='neutral'){return `<span class="badge ${kind}">${esc(text)}</span>`}
export function table(headers,rows){
  const wrap=el('div',{class:'table-wrap'}),t=el('table',{class:'table'});
  t.innerHTML=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty">Sem registos.</td></tr>`}</tbody>`;
  wrap.append(t);return wrap;
}
export function field(label,control,span2=false,help=''){const f=el('div',{class:`field${span2?' span2':''}`},el('label',{},label),control);if(help)f.append(el('div',{class:'field-help'},help));return f}
export const input=(name,value='',type='text',extra={})=>el('input',{name,value,type,...extra});
export const textarea=(name,value='',extra={})=>{const t=el('textarea',{name,...extra});t.value=value??'';return t};
export function select(name,options,value='',extra={}){const s=el('select',{name,...extra});for(const [v,l]of options){const o=el('option',{value:v},l);if(String(v)===String(value))o.selected=true;s.append(o)}return s}
export function modal(title,body,{saveText='Guardar',onSave,onClose,wide=false}={}){
  const root=qs('#modalRoot');root.innerHTML='';
  const back=el('div',{class:'modal-backdrop'}),box=el('div',{class:`modal${wide?' wide':''}`});
  const close=()=>{root.innerHTML='';onClose?.()};
  const x=el('button',{class:'xbtn',type:'button',onclick:close},'×');
  const head=el('div',{class:'modal-head'},el('strong',{},title),x);
  const content=el('div',{class:'modal-body'},body);
  const foot=el('div',{class:'modal-foot'},button('Cancelar',close,'ghost'));
  if(onSave)foot.append(button(saveText,async()=>{const ok=await onSave();if(ok!==false)close()},'primary'));
  box.append(head,content,foot);back.append(box);back.addEventListener('click',e=>{if(e.target===back)close()});root.append(back);
}
export function toast(msg){const r=qs('#toastRoot'),t=el('div',{class:'toast'},msg);r.append(t);setTimeout(()=>t.remove(),2600)}
export function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)}
export function kpi(label,value,hint='',icon=''){return el('div',{class:'card kpi-card'},el('div',{class:'label'},label),el('div',{class:'value'},value),hint?el('div',{class:'hint'},hint):null,icon?el('div',{class:'kpi-icon'},icon):null)}
export function section(title,sub='',actions=[]){return el('div',{class:'section-head'},el('div',{},el('h3',{},title),sub?el('div',{class:'card-sub'},sub):null),el('div',{class:'actions'},...actions))}
