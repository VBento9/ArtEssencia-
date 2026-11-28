'use strict';
// Local synthetic Cloud fixture; external network and model endpoints are blocked.
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {fixture}=require('./test_intelligence_meetings_sql.cjs');
(async()=>{
 const {db,login}=await fixture();let browser;
 const requests=[],executions=[];let configured=false;
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/intelligence/central-ui.css"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><button id="open" onclick="document.dispatchEvent(new CustomEvent('ae-intelligence-navigation',{detail:{page:'intelligence'}}))">Abrir Intelligence</button><section id="intelligence" class="screen active"></section><script>let unlocked=true;const cloudClient={supabaseUrl:'https://ihtsonqnnlrxvorfrarl.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'synthetic-local-only'}}})},rpc:async(name,args)=>(await fetch('/rpc',{method:'POST',body:JSON.stringify({name,...args})})).json()};</script><script src="/intelligence/meeting-room.js"></script><script src="/intelligence/central-ui.js"></script>`;
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html);}
  if(['/intelligence/central-ui.js','/intelligence/meeting-room.js','/intelligence/central-ui.css'].includes(req.url)){
   res.setHeader('content-type',req.url.endsWith('.css')?'text/css':'application/javascript');return res.end(fs.readFileSync('.'+req.url));
  }
  if(req.url==='/api/intelligence-worker'&&req.method==='POST'){
   try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const args=JSON.parse(Buffer.concat(chunks));
    assert.equal(req.headers.authorization,'Bearer synthetic-local-only');
    res.setHeader('content-type','application/json');
    if(args.operation==='availability')return res.end(JSON.stringify(configured?{status:'configured',mode:'paid',maximumMicroeur:100}:{status:'disabled'}));
    assert.equal(configured,true);assert.deepEqual(Object.keys(args).sort(),['missionId','revision']);
    await db.exec('RESET ROLE');
    try{
     const changed=await db.query("UPDATE artessencia_intelligence_private.team_missions SET status='working',revision=revision+1 WHERE mission_id=$1 AND revision=$2 AND status='approved' RETURNING mission_id",[args.missionId,args.revision]);
     assert.equal(changed.rows.length,1);executions.push(args);
    }finally{await login();}
    res.writeHead(202);return res.end(JSON.stringify({status:'accepted'}));
   }catch(error){res.writeHead(503);return res.end(JSON.stringify({error:String(error)}));}
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
   // On subsequent viewports the old meeting selector already exists. Wait for the
   // newly created meeting to be selected and the Cloud render to finish.
   await page.waitForFunction(title=>{
    const selector=document.querySelector('select[aria-label="Reunião guardada"]');
    const question=document.querySelector('textarea[aria-label="Pergunta na reunião"]');
    return selector?.selectedOptions[0]?.textContent===title+' · Aberta'&&!!question&&!question.closest('[inert]');
   },'Reunião '+width);
   const selectedMeeting=await page.getByRole('combobox',{name:'Reunião guardada',exact:true}).inputValue();
   const query='Pergunta sintética '+width+' <img src=x onerror=alert(1)>';
   await page.getByRole('textbox',{name:'Pergunta na reunião',exact:true}).fill(query);
   await page.getByRole('button',{name:'Guardar pergunta',exact:true}).click();
   await page.getByText(query,{exact:true}).waitFor();assert.equal(await page.locator('.ae-meeting-thread img').count(),0);
   const meeting=(await admin('SELECT meeting_id FROM artessencia_intelligence_private.meetings WHERE title=$1',['Reunião '+width])).rows[0].meeting_id;
   assert.equal(selectedMeeting,meeting,'The new meeting must be selected before saving its question');
   const stored=(await admin('SELECT message_id,content FROM artessencia_intelligence_private.meeting_messages WHERE meeting_id=$1 AND author=$2',[meeting,'owner'])).rows;
   assert.equal(stored.length,1);assert.equal(stored[0].content,query);
   const message=stored[0].message_id;
   assert.equal(await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).isDisabled(),true);
   await admin("UPDATE artessencia_intelligence_private.team_controls SET enabled=true,modes=jsonb_set(modes,'{stock}','\"manual\"')");
   await page.getByRole('button',{name:'Atualizar',exact:true}).click();
   await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).waitFor();
   await page.getByRole('button',{name:'Solicitar intervenção de Tomás',exact:true}).click();
   await page.getByText('Sem intervenção concluída. Não foi inventada uma resposta.',{exact:true}).waitFor();
   const mission=(await admin('SELECT mission_id FROM artessencia_intelligence_private.meeting_turns WHERE meeting_id=$1 AND message_id=$2',[meeting,message])).rows[0].mission_id;
   await page.getByRole('button',{name:'Aprovar intervenção de Tomás',exact:true}).click();
   await page.getByText(/Execução indisponível: confirma o estado da reunião/).waitFor();
   assert.equal((await admin("SELECT status FROM artessencia_intelligence_private.team_missions WHERE mission_id=$1",[mission])).rows[0].status,'approved');
   assert.equal(executions.length,[390,820,1440].indexOf(width));
   configured=true;
   await admin("UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=false,release_enabled=true,monthly_limit_microeur=1000000");
   await page.getByRole('button',{name:'Atualizar',exact:true}).click();
   await page.getByText(/Execução indisponível: confirma o estado da reunião/).waitFor();
   assert.equal(await page.getByRole('button',{name:'Executar intervenção de Tomás',exact:true}).count(),0);
   const setCap=async(value)=>{
    await page.getByText('Controlo financeiro da reunião',{exact:true}).click();
    await page.getByRole('spinbutton',{name:'Teto da reunião em euros',exact:true}).fill(value);
    await page.getByRole('button',{name:'Aprovar teto da reunião',exact:true}).click();
    await page.waitForFunction(expected=>{
     const field=document.querySelector('input[aria-label="Teto da reunião em euros"]');
     return !!field&&!field.closest('[inert]')&&!field.closest('details').open&&Number(field.value)===Number(expected);
    },value);
   };
   await setCap('0.00005');
   await page.getByText(/Execução indisponível: confirma o estado da reunião/).waitFor();
   assert.equal(await page.getByRole('button',{name:'Executar intervenção de Tomás',exact:true}).count(),0);
   await setCap('0.001');
   const execute=page.getByRole('button',{name:'Executar intervenção de Tomás',exact:true});
   await execute.waitFor();
   await page.getByRole('button',{name:'Suspender reunião',exact:true}).click();
   await page.getByRole('button',{name:'Retomar reunião',exact:true}).waitFor();
   assert.equal(await execute.count(),0);
   await page.getByRole('button',{name:'Retomar reunião',exact:true}).click();
   await execute.click();
   await page.getByRole('button',{name:'Atualizar intervenção de Tomás',exact:true}).waitFor();
   assert.equal(executions.at(-1).missionId,mission);
   assert.equal(executions.length,[390,820,1440].indexOf(width)+1);
   assert.equal(await execute.count(),0);
   configured=false;
   await admin("UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=true,release_enabled=false,monthly_limit_microeur=0");
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
   await page.waitForFunction(id=>document.querySelector('select[aria-label="Reunião guardada"]')?.value===id,meeting);
   await page.getByText(query,{exact:true}).waitFor();await page.getByText(/Planeamento: pendente/).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+5),false);
   await admin("UPDATE artessencia_intelligence_private.team_controls SET enabled=false,modes=jsonb_set(modes,'{stock}','\"off\"')");
   console.log('PASS: meeting browser fixture at '+width+'px, inline approval, synthetic hosted execution, cap and pause guards, persisted question and original Planning task');
   await page.close();
  }
  assert.ok(requests.some(r=>r.name==='artessencia_intelligence_meetings_v1'&&r.p_action==='plan'));
  console.log('PASS: existing Central meeting UI with actual SQL, three sizes, cloud reload, safe rendering, disabled employee, pending intervention, provenance, minutes, decision approval and original Planning; no model endpoints');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
