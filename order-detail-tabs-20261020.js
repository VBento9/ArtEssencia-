/* Separadores do detalhe de encomendas. Apenas reorganiza os nós visuais existentes. */
(function(){
const groups=[['overview','Resumo'],['details','Dados e artigos'],['finance','Pagamentos']];
const classify=t=>/pagamento|financeir|saldo/i.test(t)?'finance':/dados da encomenda|artigos|produtos|conjuntos temáticos|personaliza/i.test(t)?'details':'overview';
function enhance(root){
 if(!root||!root.children.length||root.querySelector('.ae-order-tabs'))return;
 const nodes=Array.from(root.children),panels={},bar=document.createElement('div');
 bar.className='ae-order-tabs';bar.setAttribute('role','tablist');
 for(const [key]of groups){let p=document.createElement('div');p.className='ae-order-tab-panel';p.dataset.group=key;p.setAttribute('role','tabpanel');panels[key]=p}
 let group='overview';
 for(const node of nodes){if(node.classList?.contains('section-title'))group=classify(node.textContent);panels[group].appendChild(node)}
 const visible=groups.filter(([key])=>panels[key].children.length);
 if(visible.length<2){for(const node of nodes)root.appendChild(node);return}
 const select=key=>{for(const [k]of visible)panels[k].hidden=k!==key;for(const b of bar.querySelectorAll('button'))b.setAttribute('aria-selected',String(b.dataset.key===key))};
 for(const [key,name]of visible){const b=document.createElement('button');b.type='button';b.dataset.key=key;b.textContent=name;b.setAttribute('role','tab');b.onclick=()=>select(key);bar.appendChild(b)}
 root.appendChild(bar);for(const [key]of visible)root.appendChild(panels[key]);select(visible[0][0]);
}
function init(){
 if(!document.getElementById('ae-order-tabs-css')){
 const style=document.createElement('style');style.id='ae-order-tabs-css';
 style.textContent='#orderDialog{max-height:95dvh;overflow:auto}.ae-order-tabs{display:flex;gap:6px;overflow-x:auto;position:sticky;top:0;background:var(--card,#fff);padding:8px 0;z-index:5;border-bottom:1px solid #ded2c1}.ae-order-tabs button{padding:9px 12px;min-height:42px;border:1px solid #d6c7ba;border-radius:10px;background:#fff;color:#4f3222;white-space:nowrap;font-weight:600}.ae-order-tabs button[aria-selected="true"]{background:#553726;color:white}.ae-order-tab-panel[hidden]{display:none!important}.ae-order-tab-panel{padding-top:8px}';
 document.head.appendChild(style)}
 const root=document.getElementById('orderDetail');if(!root)return;
 let queued=false;
 const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;if(!root.querySelector('.ae-order-tabs'))enhance(root)})});
 observer.observe(root,{childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
