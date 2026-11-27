'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dependencyRoot = require('node:path').dirname(require.resolve(process.env.PLAYWRIGHT_MODULE || 'playwright'));
const {PGlite} = require(process.env.PGLITE_MODULE || require.resolve('@electric-sql/pglite',{paths:[dependencyRoot]}));

async function run() {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${owner}'::uuid$$;
    CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;`);
  for (const name of ['team-draft','ai-budget-draft','run-draft','owner-console']) {
    await db.exec(fs.readFileSync('sql/intelligence-'+name+'-v1.sql','utf8'));
  }
  await db.exec('SET ROLE authenticated');
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><main id="dashboard"><div class="dashboard-hero"></div></main>
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
      await page.getByRole('button',{name:'Abrir central de agentes'}).click();
      await page.getByRole('button',{name:'Enviar missão'}).waitFor();
      const nav=page.getByLabel('Área de trabalho');assert.equal(await nav.locator('option').count(),14);
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
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await db.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
