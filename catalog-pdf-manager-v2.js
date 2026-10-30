/* ArtEssencia · Configurador independente do catálogo PDF de produtos.
   Lê produtos existentes; não altera registos nem estado de publicação. */
(function () {
  'use strict';
  const STORAGE_KEY='artessencia.catalog.pdf.prefs.v2';
  const PAGE_SIZE=36;
  let settings={scope:'published',selected:null,images:true};
  let filters={query:'',category:'',collection:'',onlySelected:false,page:0};
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(saved && typeof saved==='object'){
      settings.scope=saved.scope==='all'?'all':'published';
      settings.selected=Array.isArray(saved.selected)?[...new Set(saved.selected.map(String))]:null;
      settings.images=saved.images!==false;
      if(settings.scope==='all' && settings.selected===null)settings.selected=[];
    }
  }catch(_){}
  const $=id=>document.getElementById(id);
  const clean=v=>String(v==null?'':v).trim();
  const html=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const code=p=>clean(p&& (p.code||p.id));
  const category=p=>clean(p&&p.category)||'Outros produtos artesanais';
  const published=p=>!!p.shopVisible && p.publicReleasePendingV1803!==true;
  function eligible(){
    return (Array.isArray(db.products)?db.products:[]).filter(p=>p&&productUsableV1803(p)&&code(p)&&clean(p.name)&&(settings.scope==='all'||published(p)));
  }
  function selection(){
    const rows=eligible();
    return settings.selected===null && settings.scope==='published' ? rows : rows.filter(p=>settings.selected.includes(code(p)));
  }
  function selections(){return new Set(selection().map(code));}
  function store(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}
    catch(_){toast('Não foi possível guardar a seleção neste dispositivo');}
  }
  function collections(p){
    try{return typeof visualCollectionsV192==='function'?visualCollectionsV192(p):[];}
    catch(_){return [];}
  }
  function sorted(rows){
    return rows.slice().sort((a,b)=>category(a).localeCompare(category(b),'pt-PT')||clean(a.name).localeCompare(clean(b.name),'pt-PT'));
  }
  function matching(){
    const q=filters.query.toLocaleLowerCase('pt-PT');
    return sorted(eligible().filter(p=>
      (!filters.category||category(p)===filters.category)&&
      (!filters.collection||collections(p).includes(filters.collection))&&
      (!q||[p.name,p.code,category(p),collections(p).join(' ')].join(' ').toLocaleLowerCase('pt-PT').includes(q))&&
      (!filters.onlySelected||selections().has(code(p)))
    ));
  }
  const styles="\n#aeCatalogPdfV2[hidden]{display:none!important}\n#aeCatalogPdfV2{margin-top:14px;padding:14px;border:1px solid #ded2c1;border-radius:16px;background:#fffaf5;color:#44372b}\n#aeCatalogPdfV2 .ae-pdf-title{display:flex;justify-content:space-between;align-items:center;gap:12px}\n#aeCatalogPdfV2 .ae-pdf-title strong{font-size:16px}\n#aeCatalogPdfV2 .ae-pdf-controls,#aeCatalogPdfV2 .ae-pdf-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;margin:12px 0}\n#aeCatalogPdfV2 label{display:grid;gap:5px;font-size:13px}\n#aeCatalogPdfV2 input[type=\"search\"],#aeCatalogPdfV2 select{width:100%;min-height:44px;font-size:15px}\n#aeCatalogPdfV2 .ae-pdf-photo{display:flex;align-items:center;gap:9px}\n#aeCatalogPdfV2 .ae-pdf-tools,#aeCatalogPdfV2 .ae-pdf-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}\n#aeCatalogPdfV2 .ae-pdf-tools label{display:flex;align-items:center;gap:7px}\n#aeCatalogPdfV2 .ae-pdf-count{font-weight:700;font-size:13px}\n#aeCatalogPdfV2 .ae-pdf-rows{max-height:360px;overflow:auto;border:1px solid #ded2c1;border-radius:12px;background:#fff}\n#aeCatalogPdfV2 .ae-pdf-item{display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #eee7dd;cursor:pointer}\n#aeCatalogPdfV2 .ae-pdf-item:last-child{border-bottom:0}\n#aeCatalogPdfV2 .ae-pdf-item-name{flex:1;min-width:0;overflow-wrap:anywhere}\n#aeCatalogPdfV2 .ae-pdf-item-name small{display:block;color:#796b5f;margin-top:4px}\n#aeCatalogPdfV2 .ae-pdf-item-price{font-weight:700;white-space:nowrap}\n#aeCatalogPdfV2 .ae-pdf-pages{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px}\n#aeCatalogPdfV2 .ae-pdf-note{font-size:12px;line-height:1.5}\n#aeCatalogPdfV2 .btn{min-height:44px}\n@media(max-width:650px){\n #aeCatalogPdfV2{padding:10px}\n #aeCatalogPdfV2 .ae-pdf-controls,#aeCatalogPdfV2 .ae-pdf-filters{grid-template-columns:minmax(0,1fr)}\n #aeCatalogPdfV2 .ae-pdf-actions .btn{flex:1 1 100%}\n #aeCatalogPdfV2 .ae-pdf-item-price{white-space:normal;text-align:right}\n}\n";
  function addStyle(){
    if($('aeCatalogPdfV2Style'))return;
    const el=document.createElement('style');el.id='aeCatalogPdfV2Style';
    el.textContent=styles;document.head.appendChild(el);
  }
  function install(){
    if($('aeCatalogPdfV2'))return;
    const card=Array.from(document.querySelectorAll('#catalogs .catalog-document-card')).find(el=>el.textContent.includes('Produtos ArtEssencia'));
    if(!card)return;
    addStyle();
    const buttons=card.querySelector('.catalog-actions');
    if(!buttons)return;
    const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='Escolher artigos';open.setAttribute('aria-controls','aeCatalogPdfV2');
    open.addEventListener('click',()=>{
      const panel=$('aeCatalogPdfV2');panel.hidden=!panel.hidden;
      open.setAttribute('aria-expanded',String(!panel.hidden));
      if(!panel.hidden)render();
    });
    buttons.prepend(open);
    const panel=document.createElement('section');panel.id='aeCatalogPdfV2';panel.hidden=true;
    panel.setAttribute('aria-label','Personalizar catálogo PDF de produtos');
    panel.innerHTML=
      '<div class="ae-pdf-title"><strong>Personalizar catálogo PDF</strong><button type="button" class="btn" data-ae-action="close" aria-label="Fechar editor">Fechar</button></div>'+
      '<p class="muted">Escolhe os artigos que entram no documento. Esta seleção não publica nem altera produtos.</p>'+
      '<div class="ae-pdf-controls">'+
        '<label>Produtos disponíveis<select id="aePdfScope"><option value="published">Marcados como publicados</option><option value="all">Todos os ativos (seleção manual)</option></select></label>'+
        '<label class="ae-pdf-photo"><input id="aePdfImages" type="checkbox"> Incluir fotografias no PDF</label>'+
      '</div>'+
      '<div class="ae-pdf-filters">'+
        '<label>Pesquisar<input id="aePdfQuery" type="search" placeholder="Nome ou código"></label>'+
        '<label>Categoria<select id="aePdfCategory"><option value="">Todas as categorias</option></select></label>'+
        '<label>Coleção<select id="aePdfCollection"><option value="">Todas as coleções</option></select></label>'+
      '</div>'+
      '<div class="ae-pdf-tools">'+
        '<button class="btn" type="button" data-ae-action="selectFiltered">Selecionar filtrados</button>'+
        '<button class="btn" type="button" data-ae-action="clearFiltered">Retirar filtrados</button>'+
        '<button class="btn" type="button" data-ae-action="auto">Usar publicados automaticamente</button>'+
        '<label><input type="checkbox" id="aePdfOnlySelected"> Só selecionados</label>'+
      '</div>'+
      '<p id="aePdfCount" class="ae-pdf-count" role="status"></p>'+
      '<div id="aePdfRows" class="ae-pdf-rows"></div>'+
      '<div class="ae-pdf-pages"><button type="button" class="btn" data-ae-action="prev">Anterior</button><span id="aePdfPageLabel"></span><button type="button" class="btn" data-ae-action="next">Seguinte</button></div>'+
      '<p class="muted ae-pdf-note">Preferências guardadas neste dispositivo. Para manter a lista automaticamente atualizada, usa «Usar publicados automaticamente». O PDF é criado de novo sempre que o abres.</p>'+
      '<div class="ae-pdf-actions"><button type="button" class="btn" data-ae-action="preview">Ver PDF</button><button type="button" class="btn primary" data-ae-action="save">Guardar PDF</button><button type="button" class="btn" data-ae-action="share">Enviar PDF</button></div>';
    card.appendChild(panel);
    panel.addEventListener('input',event=>{
      if(event.target.id==='aePdfQuery'){filters.query=event.target.value;filters.page=0;renderList();}
    });
    panel.addEventListener('change',event=>{
      const el=event.target;
      if(el.id==='aePdfScope'){
        settings.scope=el.value==='all'?'all':'published';
        settings.selected=settings.scope==='published'?null:[];
        filters={query:'',category:'',collection:'',onlySelected:false,page:0};
        store();render();return;
      }
      if(el.id==='aePdfImages'){settings.images=el.checked;store();return;}
      if(el.id==='aePdfCategory'){filters.category=el.value;filters.page=0;renderList();return;}
      if(el.id==='aePdfCollection'){filters.collection=el.value;filters.page=0;renderList();return;}
      if(el.id==='aePdfOnlySelected'){filters.onlySelected=el.checked;filters.page=0;renderList();return;}
      if(el.matches('[data-ae-pdf-product]')){
        const selected=selections();
        if(el.checked)selected.add(el.dataset.aePdfProduct);else selected.delete(el.dataset.aePdfProduct);
        settings.selected=Array.from(selected);store();renderList();
      }
    });
    panel.addEventListener('click',event=>{
      const button=event.target.closest('[data-ae-action]');
      if(!button)return;
      const action=button.dataset.aeAction;
      if(action==='close'){panel.hidden=true;open.setAttribute('aria-expanded','false');return;}
      if(action==='prev'){filters.page=Math.max(0,filters.page-1);renderList();return;}
      if(action==='next'){filters.page++;renderList();return;}
      if(action==='auto'){
        settings.scope='published';settings.selected=null;
        filters={query:'',category:'',collection:'',onlySelected:false,page:0};
        store();render();return;
      }
      if(action==='selectFiltered'||action==='clearFiltered'){
        const chosen=selections();
        for(const p of matching()){
          if(action==='selectFiltered')chosen.add(code(p));else chosen.delete(code(p));
        }
        settings.selected=Array.from(chosen);store();renderList();return;
      }
      if(action==='preview')window.previewMenuPDF();
      if(action==='save')window.downloadMenuPDF();
      if(action==='share')window.shareMenuPDF();
    });
  }
  function options(select,values,first){
    const old=select.value;
    select.innerHTML='<option value="">'+html(first)+'</option>'+Array.from(new Set(values.filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-PT')).map(v=>'<option value="'+html(v)+'">'+html(v)+'</option>').join('');
    select.value=Array.from(select.options).some(o=>o.value===old)?old:'';
  }
  function render(){
    const root=$('aeCatalogPdfV2');if(!root)return;
    $('aePdfScope').value=settings.scope;
    $('aePdfImages').checked=settings.images;
    $('aePdfQuery').value=filters.query;
    $('aePdfOnlySelected').checked=filters.onlySelected;
    options($('aePdfCategory'),eligible().map(category),'Todas as categorias');
    options($('aePdfCollection'),eligible().flatMap(collections),'Todas as coleções');
    $('aePdfCategory').value=filters.category;
    $('aePdfCollection').value=filters.collection;
    renderList();
  }
  function renderList(){
    const rows=matching();
    const count=selection().length;
    const total=eligible().length;
    $('aePdfCount').textContent=count+' selecionado(s) de '+total+' disponíveis · '+(settings.selected===null?'seleção automática':'seleção manual')+'. '+rows.length+' correspondem aos filtros.';
    const maxPage=Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1);
    filters.page=Math.min(filters.page,maxPage);
    const chosen=selections();
    $('aePdfRows').innerHTML=rows.length?rows.slice(filters.page*PAGE_SIZE,(filters.page+1)*PAGE_SIZE).map(p=>
      '<label class="ae-pdf-item"><input type="checkbox" data-ae-pdf-product="'+html(code(p))+'" '+(chosen.has(code(p))?'checked':'')+'>'+
      '<span class="ae-pdf-item-name"><b>'+html(p.name)+'</b><small>'+html(code(p))+' · '+html(category(p))+(published(p)?' · Publicado':' · Não publicado')+'</small></span>'+
      '<span class="ae-pdf-item-price">'+html(priceText(p))+'</span></label>'
    ).join(''):'<p class="muted">Nenhum produto corresponde aos filtros.</p>';
    $('aePdfPageLabel').textContent='Página '+(filters.page+1)+' de '+(maxPage+1);
    rootButtons('prev').disabled=filters.page===0;
    rootButtons('next').disabled=filters.page===maxPage;
  }
  function rootButtons(action){return $('aeCatalogPdfV2').querySelector('[data-ae-action="'+action+'"]');}
  function priceText(p){
    if(p.publicPriceMode==='quote')return 'Sob consulta';
    const n=Number(p.onlinePrice)>0?Number(p.onlinePrice):Number(p.price)||0;
    return n>0?(p.publicPriceMode==='from'?'Desde ':'')+n.toLocaleString('pt-PT',{style:'currency',currency:'EUR'}):'Sob consulta';
  }
  function fit(ctx,text,maxWidth){
    let value=clean(text);
    while(value.length>2 && ctx.measureText(value).width>maxWidth)value=value.slice(0,-2);
    return value===clean(text)?value:value.trimEnd()+'…';
  }
  function loadPhoto(src){
    return new Promise(resolve=>{
      if(!src)return resolve(null);
      const im=new Image();let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);resolve(ok?im:null);};
      const timer=setTimeout(()=>finish(false),4000);
      im.crossOrigin='anonymous';
      im.onload=()=>finish(true);im.onerror=()=>finish(false);im.src=src;
    });
  }
  function drawPhoto(ctx,img,x,y,width,height){
    ctx.fillStyle='#f6f0e8';ctx.fillRect(x,y,width,height);
    ctx.strokeStyle='#e5d8cb';ctx.strokeRect(x,y,width,height);
    if(!img)return;
    const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,x+(width-w)/2,y+(height-h)/2,w,h);
  }
  async function buildPdf(){
    const rows=sorted(selection());
    if(!rows.length)throw new Error('Seleciona pelo menos um produto para o PDF');
    const pages=[];let canvas,ctx,y=235,currentCategory='';
    const pageHeight=1754,pageWidth=1240,limit=1570,rowHeight=settings.images?150:82;
    async function startPage(){
      canvas=document.createElement('canvas');canvas.width=pageWidth;canvas.height=pageHeight;
      ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Não foi possível preparar a página PDF');
      await drawArtEssenciaHeader(ctx,'CATÁLOGO','Produtos ArtEssencia · '+new Date().toLocaleDateString('pt-PT'));
      y=235;currentCategory='';
    }
    async function finishPage(){
      drawCatalogFooter(ctx);
      ctx.fillStyle='#806b62';ctx.textAlign='right';ctx.font='18px Arial';
      ctx.fillText('Página '+(pages.length+1),1150,1603);ctx.textAlign='left';
      const jpg=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar a página PDF')),'image/jpeg',0.88));
      pages.push(jpg);
    }
    await startPage();
    for(const p of rows){
      const cat=category(p);
      if(y+(cat!==currentCategory?58:0)+rowHeight>limit){
        await finishPage();await startPage();
      }
      if(cat!==currentCategory){
        ctx.fillStyle='#75614f';ctx.fillRect(70,y,1100,43);
        ctx.fillStyle='#fff';ctx.font='bold 21px Arial';
        ctx.fillText(fit(ctx,cat.toLocaleUpperCase('pt-PT'),1050),88,y+29);
        y+=57;currentCategory=cat;
      }
      const textX=settings.images?225:90;
      if(settings.images){
        const imageUrl=clean(p.shopImageUrl||p.imageUrl||p.image||p.photo);
        const img=await loadPhoto(imageUrl);
        try{drawPhoto(ctx,img,85,y,115,115);}catch(_){drawPhoto(ctx,null,85,y,115,115);}
      }
      ctx.fillStyle='#49382e';ctx.font='bold 26px Arial';
      ctx.fillText(fit(ctx,p.name,settings.images?670:790),textX,y+35);
      ctx.font='18px Arial';ctx.fillStyle='#806b62';
      ctx.fillText(fit(ctx,code(p),settings.images?670:790),textX,y+69);
      ctx.textAlign='right';ctx.fillStyle='#9a634c';ctx.font='bold 24px Arial';
      ctx.fillText(fit(ctx,priceText(p),250),1150,y+35);ctx.textAlign='left';
      ctx.strokeStyle='#e9dfd4';ctx.beginPath();ctx.moveTo(80,y+rowHeight-9);ctx.lineTo(1155,y+rowHeight-9);ctx.stroke();
      y+=rowHeight;
    }
    await finishPage();
    return jpegBlobsToPDF(pages,pageWidth,pageHeight);
  }
  // Substitui apenas o gerador do PDF Produtos ArtEssencia. Não toca no PDF das caixas.
  window.buildMenuPdfBlob=buildPdf;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
