/* Isolated real DOM interactions; routes never reach Cloud or real records. */
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const index=fs.readFileSync('index.html','utf8'),section=index.match(/<section id="technicalLibrary"[\s\S]*?<\/section>/)[0];
const compressImage=index.match(/^async function compressImageFile\(.*$/m)[0];
const pdfHelpers=['loadCanvasImage','drawArtEssenciaHeader','wrapCanvasText','jpegBlobToPDF','downloadPdfBlob'].map(name=>
 index.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('))
).concat(
 index.slice(index.indexOf('function createCatalogPrintCanvas('),index.indexOf('async function drawArtEssenciaHeader(')),
 index.slice(index.indexOf('async function jpegBlobsToPDF('),index.indexOf('async function jpegBlobToPDF('))
).join('\n');
const seed={settings:{},stock:[{name:'untouched',qty:7}],orders:[{id:'old',price:20}],products:[{price:25}],productionRuns:[]};
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:16px sans-serif;margin:12px}button,input,select{font:inherit;min-height:40px}*{box-sizing:border-box}.card{max-width:1200px;margin:auto}</style><link rel="stylesheet" href="/fragrance-library.css"></head><body>${section}<script>${compressImage}\n${pdfHelpers}
const KEY='synthetic-library';let db=JSON.parse(localStorage.getItem(KEY)||'null')||${JSON.stringify(seed)};let fail=false;function cloudMeta(){return {conflict:false}}function save(){if(fail)return false;localStorage.setItem(KEY,JSON.stringify(db));return true}function toast(message){window.lastMessage=message}</script><script src="/fragrance-ledger.js"></script><script src="/fragrance-library.js"></script></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{} )});try{for(const width of [390,800,1366]){
const context=await browser.newContext({viewport:{width,height:950}});await context.route('**/*',r=>{const p=new URL(r.request().url()).pathname;if(p==='/brand-artessencia-transparente.svg')return r.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(p.slice(1),'utf8')});if(p==='/')return r.fulfill({contentType:'text/html',body:fixture});if(['/fragrance-ledger.js','/fragrance-library.js','/fragrance-library.css'].includes(p))return r.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(p.slice(1),'utf8')});return r.abort()});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fixture.invalid/');
await page.getByRole('button',{name:'Nova fragrância',exact:true}).click();await page.locator('[name=name]').fill('Coco & Baunilha');assert.equal(await page.locator('[name=photoUrl]').isVisible(),false);await page.getByText('Descrição, fotografia e documentos',{exact:true}).click();await page.locator('[name=description]').fill('Uma descrição opcional de teste.');assert.equal(await page.locator('[name=photoUrl]').isVisible(),true);await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();assert.match(await page.locator('#aeFlCardsV1').innerText(),/Capacidade por definir/);
async function openCardOptions(){const menu=page.locator('.fl-card-more').first();if(await menu.getAttribute('open')===null)await menu.locator('summary').click()}
async function historyAction(name){await openCardOptions();await page.getByRole('button',{name:'Histórico',exact:true}).click();await page.getByRole('button',{name,exact:true}).click()}
async function confirm(quantity,note=''){await page.locator('[name=quantity]').fill(quantity);await page.locator('[name=note]').fill(note);if(quantity==='12'){await page.locator('dialog form').evaluate(f=>{f.requestSubmit();f.requestSubmit()})}else await page.getByRole('button',{name:'Confirmar',exact:true}).click()}
await historyAction('Corrigir saldo');await confirm('100','Contagem inicial');await openCardOptions();await page.getByRole('button',{name:'Definir capacidade',exact:true}).click();await confirm('100','Frasco 100 ml');
await openCardOptions();await page.getByRole('button',{name:'Registo com data e observação',exact:true}).click();
const beforePreview=await page.evaluate(()=>localStorage.getItem(KEY));await page.locator('[name=quantity]').fill('12');assert.match(await page.locator('.fl-movement-preview').innerText(),/100 ml → 88 ml/);assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforePreview);assert.equal(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);await confirm('12');assert.match(await page.locator('#aeFlCardsV1').innerText(),/88 ml/);assert.match(await page.locator('#aeFlCardsV1').innerText(),/88.0%/);
await page.getByRole('button',{name:'Adicionar fragrância',exact:true}).click();await confirm('50');assert.match(await page.locator('#aeFlCardsV1').innerText(),/138 ml/);await historyAction('Ajustar capacidade');await confirm('200','Mais capacidade');assert.match(await page.locator('#aeFlCardsV1').innerText(),/69.0%/);
await openCardOptions();await page.getByRole('button',{name:'Registo com data e observação',exact:true}).click();await page.locator('[name=quantity]').fill('999');assert.match(await page.locator('.fl-movement-preview').innerText(),/superior/);await confirm('999');assert.match(await page.locator('[role=alert]').innerText(),/superior/);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
await page.evaluate(()=>{fail=true});await openCardOptions();await page.getByRole('button',{name:'Registo com data e observação',exact:true}).click();await confirm('1');assert.match(await page.locator('[role=alert]').innerText(),/não foi confirmada/);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
await page.reload();assert.match(await page.locator('#aeFlCardsV1').innerText(),/138 ml/);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));for(const key of ['stock','orders','products','productionRuns'])assert.deepEqual(saved[key],seed[key]);assert.equal(saved.settings.manualFragranceLibraryV1[0].movements.length,5);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);page.on('dialog',d=>d.accept());await page.locator('.fl-library-tools > summary').click();await page.getByRole('button',{name:'Importar recibo 67827',exact:true}).click();assert.equal(await page.locator('.ae-fl-card-v1').count(),16);await page.getByRole('button',{name:'Importar recibo 67827',exact:true}).click();assert.equal(await page.locator('.ae-fl-card-v1').count(),16);assert.equal(await page.evaluate(()=>db.settings.manualFragranceLibraryV1.filter(x=>x.id.startsWith('receipt-')).every(x=>FragranceLedger.balance(x)===0&&FragranceLedger.tank(x).percent===null)),true);await page.locator('#aeFlSearchV1').fill('Coco & Baunilha');await historyAction('Corrigir saldo');await confirm('5','Contagem de teste');assert.equal(await page.locator('.fl-gauge').getAttribute('data-level'),'critical');assert.match(await page.locator('#aeFlCardsV1').innerText(),/Nível crítico/);
await page.locator('#aeFlSearchV1').fill('');
await page.getByRole('button',{name:'Preencher quantidades em conjunto',exact:true}).click();
await page.locator('[name=quantity0]').fill('0');
await page.locator('[name=capacity0]').fill('100');
await page.locator('[name=quantity1]').fill('-1');
await page.getByRole('button',{name:'Guardar quantidades'}).click();
assert.match(await page.locator('dialog [role=alert]').innerText(),/quantidade/i);
assert.equal(await page.evaluate(()=>db.settings.manualFragranceLibraryV1[1].movements?.length||0),0);
await page.locator('[name=quantity1]').fill('');
await page.getByRole('button',{name:'Guardar quantidades'}).click();
await page.locator('#aeFlStatusV1').selectOption('empty');
assert.equal(await page.locator('.ae-fl-card-v1').count(),1);
await page.locator('#aeFlStatusV1').selectOption('pending');
assert.equal(await page.locator('.ae-fl-card-v1').count(),14);
await page.locator('#aeFlStatusV1').selectOption('active');
assert.equal(await page.locator('#aeFlSummaryV2 [data-filter=active] strong').innerText(),'16');
assert.equal(await page.locator('#aeFlSummaryV2 [data-filter=available] strong').innerText(),'1');
await page.getByRole('button',{name:'Filtrar: Por registar'}).click();
assert.equal(await page.locator('.ae-fl-card-v1').count(),14);
await page.getByRole('button',{name:'Filtrar: Disponíveis'}).click();
assert.equal(await page.locator('.ae-fl-card-v1').count(),1);
await page.getByRole('button',{name:'Lista compacta'}).click();
assert.equal(await page.locator('#aeFlCardsV1').getAttribute('data-view'),'list');
await page.getByRole('button',{name:'Cartões',exact:true}).click();
assert.equal(await page.locator('#aeFlCardsV1').getAttribute('data-view'),'cards');
await page.locator('#aeFlSearchV1').fill('Fragrância inexistente');
assert.match(await page.locator('.fl-library-empty').innerText(),/Nenhuma fragrância/);
await page.locator('.fl-library-empty').getByRole('button',{name:'Limpar filtros'}).click();
assert.equal(await page.locator('#aeFlStatusV1').inputValue(),'active');
await page.getByRole('button',{name:'Nova fragrância',exact:true}).click();
await page.locator('[name=name]').fill('Ficha preparada');
await page.locator('[name=initialQuantity]').fill('100');
await page.locator('[name=initialCapacity]').fill('100');
await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();
await page.locator('#aeFlSearchV1').fill('Ficha preparada');
assert.match(await page.locator('#aeFlCardsV1').innerText(),/100 ml/);
await openCardOptions();await page.getByRole('button',{name:'Gerir fragrância'}).click();
await confirm('12');
assert.match(await page.locator('.fl-work-panel .fl-gauge').innerText(),/88 ml/);
await page.locator('.fl-work-panel').getByRole('button',{name:'Adicionar fragrância',exact:true}).click();
await confirm('50');
assert.match(await page.locator('.fl-work-panel .fl-gauge').innerText(),/138 ml/);
await page.getByText('Últimos movimentos',{exact:true}).click();
assert.match(await page.locator('.fl-work-panel details').innerText(),/138 ml/);
await page.getByRole('button',{name:'Cancelar',exact:true}).click();
// Inline daily consumption must preview without saving, reject invalid/stale inputs,
// roll back save failures and never duplicate a rapid double submission.
const quick=page.locator('.fl-quick-use');
const quickInput=quick.locator('[name=quickQuantity]');
const beforeQuick=await page.evaluate(()=>localStorage.getItem(KEY));
await quickInput.fill('4');
assert.match(await quick.locator('.fl-quick-preview').innerText(),/138 ml → 134 ml/);
assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforeQuick);
await quickInput.fill('999');
assert.match(await quick.locator('.fl-quick-preview').innerText(),/superior/);
await quick.getByRole('button',{name:'Registar utilização',exact:true}).click();
assert.match(await quick.locator('.fl-quick-error').innerText(),/superior/);
assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforeQuick);
await quickInput.fill('4');
await page.evaluate(()=>{fail=true});
await quick.getByRole('button',{name:'Registar utilização',exact:true}).click();
assert.match(await quick.locator('.fl-quick-error').innerText(),/Não foi possível guardar/);
assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforeQuick);
await page.evaluate(()=>{fail=false});
const beforeMoves=await page.evaluate(()=>db.settings.manualFragranceLibraryV1.find(x=>x.name==='Ficha preparada').movements.length);
await quick.evaluate(form=>{form.requestSubmit();form.requestSubmit()});
assert.match(await page.locator('#aeFlCardsV1').innerText(),/134 ml/);
assert.equal(await page.evaluate(()=>db.settings.manualFragranceLibraryV1.find(x=>x.name==='Ficha preparada').movements.length),beforeMoves+1);
await page.locator('.fl-quick-use [name=quickQuantity]').fill('1');
await page.evaluate(()=>{db.settings.manualFragranceLibraryV1.find(x=>x.name==='Ficha preparada').updatedAt='simulated-concurrent-change'});
await page.locator('.fl-quick-use button[type=submit]').click();
assert.match(await page.locator('.fl-quick-error').innerText(),/ficha foi alterada/);
await page.reload();
await page.locator('#aeFlSearchV1').fill('Ficha preparada');
assert.match(await page.locator('#aeFlCardsV1').innerText(),/134 ml/);
// History reports only immutable ledger consumption; manual corrections do not inflate use.
const beforeHistory=await page.evaluate(()=>localStorage.getItem(KEY));
await openCardOptions();
await page.getByRole('button',{name:'Histórico',exact:true}).click();
const history=page.locator('dialog.fl-history-dialog');
assert.match(await history.locator('.fl-history-current').innerText(),/134 ml/);
assert.equal(await history.locator('[data-stat=consumption] strong').innerText(),'16 ml');
assert.equal(await history.locator('[data-stat=refill] strong').innerText(),'50 ml');
assert.equal(await history.locator('[data-stat=moves] strong').innerText(),'5');
assert.equal(await history.locator('[data-stat=adjust] strong').innerText(),'1');
await history.locator('[name=type]').selectOption('consumption');
assert.equal(await history.locator('.fl-history-item').count(),2);
assert.match(await history.locator('.fl-history-item').first().innerText(),/4 ml/);
await history.locator('[name=period]').selectOption('custom');
await history.locator('[name=from]').fill('2001-01-01');
await history.locator('[name=until]').fill('2001-01-31');
assert.match(await history.locator('.fl-history-empty').innerText(),/Sem movimentos/);
assert.equal(await history.locator('[data-stat=consumption] strong').innerText(),'0 ml');
await history.locator('[name=from]').fill('2002-01-01');
assert.match(await history.locator('.fl-history-empty').innerText(),/data inicial/);
await history.locator('[name=period]').selectOption('all');
assert.equal(await history.locator('.fl-history-item').count(),2);
assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforeHistory);
await history.getByRole('button',{name:'Fechar',exact:true}).click();
assert.equal(await page.locator('dialog.fl-history-dialog').count(),0);

const photoSlot=page.getByRole('button',{name:'Fotografia de Ficha preparada',exact:true});
assert.match(await photoSlot.innerText(),/Sem fotografia/);
await photoSlot.click();
await page.locator('.fl-photo-editor input[type=file]').setInputFiles({
 name:'fixture.png',mimeType:'image/png',
 buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgAAAAABJRU5ErkJggg==','base64')
});
await page.getByText('Fotografia pronta para guardar.',{exact:true}).waitFor();
await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();
await page.reload();
await page.locator('#aeFlSearchV1').fill('Ficha preparada');
await photoSlot.locator('img').waitFor();
assert.match(await photoSlot.locator('img').getAttribute('src'),/^data:image\/jpeg/);
await photoSlot.click();
await page.getByRole('button',{name:'Remover fotografia',exact:true}).click();
await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();
assert.match(await photoSlot.innerText(),/Sem fotografia/);
if(width===390){
 await page.evaluate(()=>{
  db.settings.businessEmail='cliente@example.test';
  db.settings.businessPhone='912345678';
  const row=db.settings.manualFragranceLibraryV1.find(item=>item.name==='Ficha preparada');
  for(let i=0;i<18;i++)db.settings.manualFragranceLibraryV1.push({...row,id:'pdf-'+i,name:'Aroma '+i});
  db.settings.manualFragranceLibraryV1.push({...row,id:'pdf-archived',name:'Aroma arquivado',archived:true});
  row.photoData=document.createElement('canvas').toDataURL('image/jpeg');
  window.pdfImages=0;
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   if(image.src?.startsWith('data:image/jpeg'))window.pdfImages++;
   return draw.call(this,image,...args);
  };
  row.family='Gourmand';
  window.pdfText=[];window.pdfStyles=[];window.pdfPaper=[];
  const originalRect=CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){
   if(x===0&&y===0&&w===1240&&h===1754)window.pdfPaper.push(String(this.fillStyle));
   return originalRect.call(this,x,y,w,h);
  };
  const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){
   window.pdfText.push(value);window.pdfStyles.push({value,font:this.font});return original.call(this,value,...args)
  };
 });
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'PDF para clientes',exact:true}).click();
 const download=await downloadEvent;
 assert.equal(download.suggestedFilename(),'ArtEssencia_Catalogo_Fragrancias.pdf');
 const pdf=fs.readFileSync(await download.path()).toString('latin1');
 assert.match(pdf,/^%PDF-1\.4/);
 const totalPages=Number(pdf.match(/\/Count (\d+)\b/)?.[1]||0);
 assert.ok(totalPages>=2&&totalPages<=6,'O catálogo não tem a paginação esperada');
 assert.match(pdf,/\/Width 1240 \/Height 1754/);
 assert.ok(pdf.length<400000,'O folheto sintético excedeu 400 kB');
 console.log('PDF folheto: '+pdf.length+' bytes');
 const drawn=await page.evaluate(()=>window.pdfText.join('\n'));
 assert.match(drawn,/cliente@example.test\n912345678/);
 assert.match(drawn,/Ficha preparada/);
 assert.match(drawn,/Escolhe\no teu aroma\./);
 assert.match(drawn,/Explora por famílias/);
 assert.match(drawn,/Outras fragrâncias/);
 assert.match(drawn,/Doces & gourmand/);
 assert.match(drawn,/Uma descrição opcional de teste/);
 assert.match(drawn,/DOCES & GOURMAND/);
 const visual=await page.evaluate(()=>({styles:window.pdfStyles,paper:window.pdfPaper}));
 assert.ok(visual.paper.length>=2&&visual.paper.every(color=>color==='#e6d1ad'),'Todas as páginas devem ter fundo kraft');
 const familyStyle=visual.styles.find(item=>item.value==='DOCES & GOURMAND');
 const nameStyle=visual.styles.find(item=>item.value==='Ficha preparada');
 assert.match(familyStyle?.font||'',/bold 22px Arial/i,'Família deve ser sans-serif em negrito');
 assert.match(nameStyle?.font||'',/34px Georgia/i,'Nome deve ser serifado e maior');
 assert.doesNotMatch(nameStyle?.font||'',/bold/i,'Nome não deve ter o mesmo negrito da família');
 assert.match(drawn,/Escolhe as tuas favoritas e indica os nomes quando fizeres o pedido/);
 assert.equal(await page.evaluate(()=>window.pdfImages),0);
 assert.doesNotMatch(drawn,/Aroma arquivado|Baunilha da Polinésia Francesa|Maçã & Canela|138 ml/);
}
assert.deepEqual(errors,[]);console.log('PASS interactions, persistence, save failure, isolation, layout '+width);await context.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
