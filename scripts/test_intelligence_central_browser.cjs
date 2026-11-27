'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dependencyRoot = require('node:path').dirname(require.resolve(process.env.PLAYWRIGHT_MODULE || 'playwright'));
const {PGlite} = require(process.env.PGLITE_MODULE || require.resolve('@electric-sql/pglite',{paths:[dependencyRoot]}));

async function run() {
  const app=fs.readFileSync('index.html','utf8'), sw=fs.readFileSync('sw.js','utf8'), version=JSON.parse(fs.readFileSync('version.json','utf8')).app;
  assert.ok(app.includes('id="intelligence" class="screen"')&&app.includes("['intelligence','ArtEssencia Intelligence']")&&app.includes('src="/intelligence/central-ui.js"')&&app.includes('href="/intelligence/central-ui.css"'));
  assert.ok(app.includes("const APP_VERSION='"+version+"'")&&sw.includes('artessencia-backoffice-'+version)&&sw.includes('/intelligence/central-ui.js')&&sw.includes('/intelligence/central-ui.css'));
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${owner}'::uuid$$;
    CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
    CREATE TABLE public.artessencia_v1_state(user_id uuid PRIMARY KEY,data jsonb,revision bigint,updated_at timestamptz,device_id text,app_version text);
    CREATE TABLE public.artessencia_v1_products(user_id uuid,id uuid PRIMARY KEY,data jsonb,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.artessencia_v1_orders(user_id uuid,id uuid PRIMARY KEY,status text,total numeric,data jsonb);
    CREATE TABLE public.artessencia_v1_quotes(user_id uuid,id uuid PRIMARY KEY,status text,valid_until date,data jsonb);
    CREATE TABLE public.artessencia_shop_event_requests(user_id uuid,request_id uuid PRIMARY KEY,status text,created_at timestamptz);
    CREATE TABLE public.artessencia_cloud_records(user_id uuid,entity text,record_id text,data jsonb,client_updated_at timestamptz,device_id text,deleted_at timestamptz,PRIMARY KEY(user_id,entity,record_id));`);
  await db.query('INSERT INTO public.artessencia_v1_state(user_id,data,revision) VALUES($1,$2,7)',[owner,JSON.stringify({stock:[{name:'Material de ensaio',qty:12,unit:'g',unitCost:.02}],productRecipes:{TEST:[{item:'Material de ensaio',qty:2,unit:'g'}]},stockMoves:[],purchases:[],productionRuns:[]})]);
  for (const name of ['team-draft','ai-budget-draft','run-draft','owner-console']) {
    await db.exec(fs.readFileSync('sql/intelligence-'+name+'-v1.sql','utf8'));
  }
  await db.exec('SET ROLE authenticated');
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><nav><button id="openIntelligence" onclick="document.dispatchEvent(new CustomEvent('ae-intelligence-navigation',{detail:{page:'intelligence'}}))">ArtEssencia Intelligence</button></nav><main><section id="intelligence" class="screen active"></section></main>
    <script>let unlocked=true;const cloudClient={rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',body:JSON.stringify(args)})).json()};</script><script src="/central.js"></script>`;
  const server = http.createServer(async (req,res)=>{
    if(req.url==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html);}
    if(req.url==='/central.js'){res.setHeader('content-type','application/javascript');return res.end(fs.readFileSync('intelligence/central-ui.js'));}
    if(req.url!=='/rpc'||req.method!=='POST'){res.writeHead(404);return res.end();}
    try {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const {p_action,p_args}=JSON.parse(Buffer.concat(chunks));
      const result=await db.query('select public.artessencia_intelligence_console_v1($1,$2) as data',[p_action,p_args]);
      res.end(JSON.stringify(result.rows[0]));
    } catch {res.end(JSON.stringify({error:true}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
    const origin='http://127.0.0.1:'+server.address().port;
    for(const width of [390,820,1440]){
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin);
      await page.getByRole('button',{name:'ArtEssencia Intelligence',exact:true}).click();
      await page.getByText('9 funcionários ·', {exact:false}).waitFor();
      const nav=page.getByLabel('Área de trabalho');assert.equal(await nav.locator('option').count(),16);
      if(width===390){
        await nav.selectOption('Funcionários');
        await page.getByRole('button',{name:'Ligar equipa'}).click();
        await page.getByRole('button',{name:'Desligar equipa'}).waitFor();
        await page.getByLabel('Modo de Stock',{exact:true}).selectOption('manual');
        await page.waitForFunction(()=>!document.querySelector('#aeIntelligenceCentral [inert]'));
        await nav.selectOption('Comunicação');
        await page.getByLabel('Funcionário',{exact:true}).selectOption('stock');
        await page.getByLabel('Instrução',{exact:true}).fill('Inventário de teste');
        await page.getByRole('button',{name:'Enviar missão'}).click();
        await page.getByText('Inventário de teste · A aguardar aprovação').waitFor();
      }
      await nav.selectOption('Missões');await page.getByText('Inventário de teste',{exact:true}).waitFor();
      if(width===820){await page.getByRole('button',{name:'Aprovar',exact:true}).click();await page.getByText('Aprovada',{exact:true}).waitFor();}
      if(width===1440){await page.getByRole('button',{name:'Cancelar missão'}).click();await page.getByText('Cancelada',{exact:true}).waitFor();}
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(()=>{unlocked=false;document.getElementById('lockScreen').classList.remove('hidden');});
      await page.getByRole('button',{name:'Abrir central de agentes'}).waitFor();
      assert.equal(await page.getByText('Inventário de teste',{exact:true}).count(),0);
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('PASS: owner console with SQL, nine modes, persistent mission, approval, cancellation, lock and three device sizes');
    // A completed synthetic mission is seeded solely for testing the browser approval surface.
    await db.exec('RESET ROLE');
    const completedId='00000000-0000-0000-0000-000000000020';
    await db.query("INSERT INTO artessencia_intelligence_private.team_missions(user_id,mission_id,agent,kind,instruction,revision,control_revision,status) SELECT user_id,$1,'stock','inventory_audit','Auditoria fictícia concluída',3,revision,'review_ready' FROM artessencia_intelligence_private.team_controls WHERE user_id=$2",[completedId,owner]);
    await db.query("INSERT INTO artessencia_intelligence_private.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status,outcome,ended_at) VALUES($1,$2,gen_random_uuid(),gen_random_uuid(),2,'review_ready',$3,now())",[owner,completedId,JSON.stringify({reasoning:'Documento fictício de Stock',report:{tasks:[]}})]);
    const before=(await db.query('SELECT data,revision FROM public.artessencia_v1_state WHERE user_id=$1',[owner])).rows[0];
    await db.exec('SET ROLE authenticated');
    const page=await browser.newPage({viewport:{width:820,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);
    await page.getByRole('button',{name:'Abrir central de agentes'}).click();
    await page.getByText('9 funcionários ·',{exact:false}).waitFor();
    await page.getByLabel('Área de trabalho').selectOption('Documentos produzidos');
    await page.getByText('Documento fictício de Stock',{exact:true}).waitFor();
    await page.getByLabel('Material de origem',{exact:true}).fill('Material de ensaio');
    await page.getByLabel('Material de destino',{exact:true}).fill('Material de ensaio normalizado');
    await page.getByRole('button',{name:'Analisar impacto sem alterar stock'}).click();
    await page.getByText('Execução desligada até validação técnica.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Confirmar e gravar renomeação'}).count(),0);
    assert.deepEqual(errors,[]);
    await page.close();
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT data,revision FROM public.artessencia_v1_state WHERE user_id=$1',[owner])).rows[0],before);
    console.log('PASS: central browser stock preview uses SQL, release gate disabled, no write to canonical stock');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await db.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
