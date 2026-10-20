/* ArtEssencia: separadores de detalhe de encomenda, sem alterar dados nem handlers. */
(function(){
'use strict';
const groups=[['overview','Resumo'],['items','Artigos'],['production','Produção'],['finance','Pagamentos'],['history','Histórico e ações']];
function classify(title){
 const t=(title||'').toLowerCase();
 if(/hist[oó]rico|registo de altera|atividade|a[cç][oõ]es/.test(t))return 'history';
 if(/pagamento|financeir|saldo|valor pago|fatura/.test(t))return 'finance';
 if(/produ[cç][aã]o|materiais necess[aá]rios|ordem de fabrico/.test(t))return 'production';
 if(/artigos|produtos|conjuntos tem[aá]ticos|personaliza|itens da encomenda/.test(t))return 'items';
 return 'overview';
}
function enhance(root){
 if(!root||!root.children.length||root.querySelector(':scope > .ae-order-tabs'))return;
 const original=Array.from(root.children);
 const panels={},bar=document.createElement('div');bar.className='ae-order-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Secções da encomenda');
 for(const [key]of groups){const panel=document.createElement('section');panel.className='ae-order-tab-panel';panel.dataset.group=key;panel.setAttribute('role','tabpanel');panels[key]=panel}
 let current='overview';
 for(const node of original){
  if(node.classList?.contains('section-title'))current=classify(node.textContent);
  panels[current].appendChild(node);
 }
 const visible=groups.filter(([key])=>panels[key].children.length);
 if(visible.length<2){for(const node of original)root.appendChild(node);return}
 function select(key,focus){
  for(const [k]of visible){panels[k].hidden=k!==key;const b=bar.querySelector('[data-key="'+k+'"]');b.setAttribute('aria-selected',String(k===key));b.tabIndex=k===key?0:-1}
  if(focus)bar.querySelector('[data-key="'+key+'"]').focus();
 }
 for(const [key,name]of visible){
  const b=document.createElement('button');b.type='button';b.dataset.key=key;b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');
  b.addEventListener('click',()=>select(key,false));
  b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const idx=visible.findIndex(([k])=>k===key);const next=e.key==='Home'?0:e.key==='End'?visible.length-1:(idx+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;select(visible[next][0],true)});
  bar.appendChild(b);
 }
 root.appendChild(bar);for(const [key]of visible)root.appendChild(panels[key]);select(visible[0][0],false);
}
function init(){
 if(!document.getElementById('ae-order-tabs-css')){
  const style=document.createElement('style');style.id='ae-order-tabs-css';
  style.textContent='#orderDialog{max-height:95dvh;overflow:auto}.ae-order-tabs{display:flex;gap:6px;overflow-x:auto;position:sticky;top:0;background:var(--card,#fff);padding:8px 0;z-index:5;border-bottom:1px solid #ded2c1;scrollbar-width:thin}.ae-order-tabs button{padding:9px 12px;min-height:42px;border:1px solid #d6c7ba;border-radius:10px;background:#fff;color:#4f3222;white-space:nowrap;font-weight:600}.ae-order-tabs button[aria-selected="true"]{background:#553726;color:white}.ae-order-tabs button:focus-visible{outline:2px solid #80512b;outline-offset:2px}.ae-order-tab-panel[hidden]{display:none!important}.ae-order-tab-panel{padding-top:8px}';
  document.head.appendChild(style);
 }
 const root=document.getElementById('orderDetail');if(!root)return;
 let queued=false;
 const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(!root.querySelector(':scope > .ae-order-tabs'))enhance(root)})});
 observer.observe(root,{childList:true});
 enhance(root);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();