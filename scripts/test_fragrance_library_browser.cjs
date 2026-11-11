/* Isolated real DOM interactions; routes never reach Cloud or real records. */
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const index=fs.readFileSync('index.html','utf8'),section=index.match(/<section id="technicalLibrary"[\s\S]*?<\/section>/)[0];
const compressImage=index.match(/^async function compressImageFile\(.*$/m)[0];
const seed={settings:{},stock:[{name:'untouched',qty:7}],orders:[{id:'old',price:20}],products:[{price:25}],productionRuns:[]};
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:16px sans-serif;margin:12px}button,input,select{font:inherit;min-height:40px}*{box-sizing:border-box}.card{max-width:1200px;margin:auto}</style><link rel="stylesheet" href="/fragrance-library.css"></head><body>${section}<script>${compressImage}
const KEY='synthetic-library';let db=JSON.parse(localStorage.getItem(KEY)||'null')||${JSON.stringify(seed)};let fail=false;function cloudMeta(){return {conflict:false}}function save(){if(fail)return false;localStorage.setItem(KEY,JSON.stringify(db));return true}function toast(message){window.lastMessage=message}</script><script src="/fragrance-ledger.js"></script><script src="/fragrance-library.js"></script></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{} )});try{for(const width of [390,800,1366]){
const context=await browser.newContext({viewport:{width,height:950}});await context.route('**/*',r=>{const p=new URL(r.request().url()).pathname;if(p==='/')return r.fulfill({contentType:'text/html',body:fixture});if(['/fragrance-ledger.js','/fragrance-library.js','/fragrance-library.css'].includes(p))return r.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(p.slice(1),'utf8')});return r.abort()});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://fixture.invalid/');
await page.getByRole('button',{name:'Nova fragrância',exact:true}).click();await page.locator('[name=name]').fill('Coco & Baunilha');assert.equal(await page.locator('[name=photoUrl]').isVisible(),false);await page.getByText('Descrição, fotografia e documentos',{exact:true}).click();await page.locator('[name=description]').fill('Uma descrição opcional de teste.');assert.equal(await page.locator('[name=photoUrl]').isVisible(),true);await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();assert.match(await page.locator('#aeFlCardsV1').innerText(),/Capacidade por definir/);
async function historyAction(name){await page.getByRole('button',{name:'Histórico',exact:true}).click();await page.getByRole('button',{name,exact:true}).click()}
async function confirm(quantity,note=''){await page.locator('[name=quantity]').fill(quantity);await page.locator('[name=note]').fill(note);if(quantity==='12'){await page.locator('dialog form').evaluate(f=>{f.requestSubmit();f.requestSubmit()})}else await page.getByRole('button',{name:'Confirmar',exact:true}).click()}
await historyAction('Corrigir saldo');await confirm('100','Contagem inicial');await page.getByRole('button',{name:'Definir capacidade',exact:true}).click();await confirm('100','Frasco 100 ml');
await page.getByRole('button',{name:'Registar utilização',exact:true}).click();
const beforePreview=await page.evaluate(()=>localStorage.getItem(KEY));await page.locator('[name=quantity]').fill('12');assert.match(await page.locator('.fl-movement-preview').innerText(),/100 ml → 88 ml/);assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),beforePreview);assert.equal(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);await confirm('12');assert.match(await page.locator('#aeFlCardsV1').innerText(),/88 ml/);assert.match(await page.locator('#aeFlCardsV1').innerText(),/88.0%/);
await page.getByRole('button',{name:'Adicionar fragrância',exact:true}).click();await confirm('50');assert.match(await page.locator('#aeFlCardsV1').innerText(),/138 ml/);await historyAction('Ajustar capacidade');await confirm('200','Mais capacidade');assert.match(await page.locator('#aeFlCardsV1').innerText(),/69.0%/);
await page.getByRole('button',{name:'Registar utilização',exact:true}).click();await page.locator('[name=quantity]').fill('999');assert.match(await page.locator('.fl-movement-preview').innerText(),/superior/);await confirm('999');assert.match(await page.locator('[role=alert]').innerText(),/superior/);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
await page.evaluate(()=>{fail=true});await page.getByRole('button',{name:'Registar utilização',exact:true}).click();await confirm('1');assert.match(await page.locator('[role=alert]').innerText(),/não foi confirmada/);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
await page.reload();assert.match(await page.locator('#aeFlCardsV1').innerText(),/138 ml/);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));for(const key of ['stock','orders','products','productionRuns'])assert.deepEqual(saved[key],seed[key]);assert.equal(saved.settings.manualFragranceLibraryV1[0].movements.length,5);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Importar recibo 67827',exact:true}).click();assert.equal(await page.locator('.ae-fl-card-v1').count(),16);await page.getByRole('button',{name:'Importar recibo 67827',exact:true}).click();assert.equal(await page.locator('.ae-fl-card-v1').count(),16);assert.equal(await page.evaluate(()=>db.settings.manualFragranceLibraryV1.filter(x=>x.id.startsWith('receipt-')).every(x=>FragranceLedger.balance(x)===0&&FragranceLedger.tank(x).percent===null)),true);await page.locator('#aeFlSearchV1').fill('Coco & Baunilha');await historyAction('Corrigir saldo');await confirm('5','Contagem de teste');assert.equal(await page.locator('.fl-gauge').getAttribute('data-level'),'critical');assert.match(await page.locator('#aeFlCardsV1').innerText(),/Nível crítico/);
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
await page.getByRole('button',{name:'Nova fragrância',exact:true}).click();
await page.locator('[name=name]').fill('Ficha preparada');
await page.locator('[name=initialQuantity]').fill('100');
await page.locator('[name=initialCapacity]').fill('100');
await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();
await page.locator('#aeFlSearchV1').fill('Ficha preparada');
assert.match(await page.locator('#aeFlCardsV1').innerText(),/100 ml/);
await page.getByRole('button',{name:'Gerir fragrância'}).click();
await confirm('12');
assert.match(await page.locator('.fl-work-panel .fl-gauge').innerText(),/88 ml/);
await page.locator('.fl-work-panel').getByRole('button',{name:'Adicionar fragrância',exact:true}).click();
await confirm('50');
assert.match(await page.locator('.fl-work-panel .fl-gauge').innerText(),/138 ml/);
await page.getByText('Últimos movimentos',{exact:true}).click();
assert.match(await page.locator('.fl-work-panel details').innerText(),/138 ml/);
await page.getByRole('button',{name:'Cancelar',exact:true}).click();

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
assert.deepEqual(errors,[]);console.log('PASS interactions, persistence, save failure, isolation, layout '+width);await context.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
