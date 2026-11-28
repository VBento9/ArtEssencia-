'use strict';
// Local synthetic Cloud fixture; external network and model endpoints are blocked.
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {fixture}=require('./test_intelligence_meetings_sql.cjs');
(async()=>{
 const {db,login}=await fixture();let browser;
 const requests=[];
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/intelligence/central-ui.css"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><button id="open" onclick="document.dispatchEvent(new CustomEvent('ae-intelligence-navigation',{detail:{page:'intelligence'}}))">Abrir Intelligence</button><section id="intelligence" class="screen active"></section><script>let unlocked=true;const cloudClient={supabaseUrl:'https://thqhyetvxledlgjdtmzp.supabase.co',rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',body:JSON.stringify({name,...args})})).json()};</script><script src="/intelligence/meeting-room.js"></script><script src="/intelligence/central-ui.js"></script>`;
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html);}
  if(['/intelligence/central-ui.js','/intelligence/meeting-room.js','/intelligence/central-ui.css'].includes(req.url)){
   res.setHeader('content-type',req.url.endsWith('.css')?'text/css':'application/javascript');return res.end(fs.readFileSync('.'+req.url));
  }
  if(req.url!=='/rpc'||req.method!=='POST'){res.writeHead(404);return res.end();}
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const {name,p_action,p_args}=JSON.parse(Buffer.concat(chunks));requests.push({name,p_action,p_args});
   let result;
   if(name==='artessencia_intelligence_console_v1')result=await db.query('SELECT public.artessencia_intelligence_console_v1($1,$2) data',[p_action,JSON.stringify(p_args)]);
   else if(name==='artessencia_intelligence_meetings_v1')result=await db.query('SELECT public.artessencia_intelligence_meetings_v1($1,$2) data',[p_action,JSON.stringify(p_args)]);
   else result={rows:[{data:{eligible:[],history:[]}}]};
   res.end(JSON.stringify(result.rows[0]));
  }catch(error){res.end(JSON.stringify({error:true,code:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const admin=async(sql,args)=>{await db.exec('RESET ROLE');try{return await db.query(sql,args);}finally{await login();}};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  for(const width of [390,820,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});page.on('dialog',dialog=>dialog.accept());
   await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
   await page.goto(origin);await page.getByRole('button',{name:'Abrir Intelligence',exact:true}).click();
   await page.getByRole('combobox',{name:'Área de trabalho'}).selectOption('Sala de Reuniões');
   const create=page.locator('details').filter({has:page.getByText('Convocar reunião',{exact:true})}).first();
   if(!await create.evaluate(n=>n.open))await create.locator('summary').click();
   await page.getByRole('textbox',{name:'Título da reunião',exact:true}).fill('Reunião '+width);
   await page.getByRole('button',{name:'Guardar convocatória',exact:true}).click();
   await page.getByRole('combobox',{name:'Reunião guardada',exact:true}).waitFor();
   const query='Pergunta sintética '+width+' <img src=x onerror=alert(1)>';
   await page.getByRole('textbox',{name:'Pergunta na reunião',exact:true}).fill(query);
   await page.getByRole('button',{name:'Guardar pergunta',exact:true}).click();
   await page.getByText(query,{exact:true}).waitFor();assert.equal(await page.locator('.ae-meeting-thread img').count(),0);
   const meeting=(await admin('SELECT meeting_id FROM artessencia_intelligence_private.meetings WHERE title=$1',['Reunião '+width])).rows[0].meeting_id;
   const message=(await admin('SELECT message_id FROM artessencia_intelligence_private.meeting_messages WHERE meeting_id=$1 AND author=$2',[meeting,'owner'])).rows[0].message_id;
   assert.equal(await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).isDisabled(),true);
   await admin("UPDATE artessencia_intelligence_private.team_controls SET enabled=true,modes=jsonb_set(modes,'{stock}','\"manual\"')");
   await page.getByRole('button',{name:'Atualizar',exact:true}).click();
   await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).waitFor();
   await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).click();
   await page.getByText('Sem intervenção concluída. Não foi inventada uma resposta.',{exact:true}).waitFor();
   const mission=(await admin('SELECT mission_id FROM artessencia_intelligence_private.meeting_turns WHERE meeting_id=$1 AND message_id=$2',[meeting,message])).rows[0].mission_id;
   await admin("UPDATE artessencia_intelligence_private.team_missions SET status='review_ready' WHERE mission_id=$1",[mission]);
   await admin("INSERT INTO artessencia_intelligence_private.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status,outcome,ended_at) VALUES('00000000-0000-0000-0000-000000000001',$1,gen_random_uuid(),gen_random_uuid(),1,'review_ready',$2,now())",[mission,JSON.stringify({reasoning:'[SINTÉTICO] Conferir a cera antes de confirmar o inventário.',report:{provenance:{sourceRevision:7,evidenceIds:['synthetic-stock'],capturedAt:'2026-11-28T00:00:00Z'}}})]);
   await page.getByRole('button',{name:'Atualizar',exact:true}).click();
   await page.getByText('[SINTÉTICO] Conferir a cera antes de confirmar o inventário.',{exact:true}).waitFor();
   assert.ok((await page.getByRole('region',{name:'Conversa da reunião'}).textContent()).includes('por reconciliar'));
   await page.getByRole('button',{name:'Preparar ata dos relatórios concluídos',exact:true}).click();
   await page.getByRole('textbox',{name:'Texto da ata',exact:true}).waitFor();
   await page.getByRole('button',{name:'Aprovar esta versão da ata',exact:true}).click();
   await page.getByRole('textbox',{name:'Decisão proposta',exact:true}).fill('Conferência '+width);
   await page.getByRole('combobox',{name:'Responsável pela decisão',exact:true}).selectOption('stock');
   await page.getByRole('textbox',{name:'Critério de conclusão',exact:true}).fill('Registar o inventário físico confirmado.');
   await page.getByRole('button',{name:'Registar proposta de decisão',exact:true}).click();
   await page.getByRole('button',{name:'Aprovar decisão',exact:true}).click();
   await page.getByRole('button',{name:'Criar tarefa no Planeamento',exact:true}).click();
   await page.getByText(/Planeamento: pendente/).waitFor();
   await page.reload();await page.getByRole('button',{name:'Abrir Intelligence',exact:true}).click();
   await page.getByRole('combobox',{name:'Área de trabalho'}).selectOption('Sala de Reuniões');
   await page.getByText(query,{exact:true}).waitFor();await page.getByText(/Planeamento: pendente/).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+5),false);
   await admin("UPDATE artessencia_intelligence_private.team_controls SET enabled=false,modes=jsonb_set(modes,'{stock}','\"off\"')");
   await page.close();
  }
  assert.ok(requests.some(r=>r.name==='artessencia_intelligence_meetings_v1'&&r.p_action==='plan'));
  console.log('PASS: existing Central meeting UI with actual SQL, three sizes, cloud reload, safe rendering, disabled employee, pending intervention, provenance, minutes, decision approval and original Planning; no model endpoints');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
