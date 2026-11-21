'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {Client} = require('pg');
const {chromium} = require('playwright');

// Only the disposable loopback database started by the test workflow.
const connect = async () => {
  const db = new Client({host:'127.0.0.1',port:55338,user:'postgres',password:'local',database:'quote_conversion_test'});
  await db.connect();
  return db;
};
const account = 'aaaaaaaa-0000-0000-0000-000000000001';
const quote = {id:'Q-TEST',client:'Cliente de ensaio',status:'Aceite',eventDate:'2027-02-01',
  items:[{type:'free',name:'Vela',qty:2,price:12,cost:3}],discount:4,depositPaid:10,
  paymentTerms:'50_50',depositPct:50,paymentHistory:[{id:'SINAL',amount:10,method:'MB Way'}]};
(async()=>{
  const admin=await connect(), sessions=[];
  let browser;
  try {
    await admin.query(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
      grant usage on schema auth to authenticated;
      create table artessencia_v1_quotes(id uuid primary key,user_id uuid,client_id uuid,status text,total numeric,data jsonb,updated_at timestamptz);
      create table artessencia_v1_orders(id uuid primary key,user_id uuid,client_id uuid,status text,order_date date,due_at timestamptz,subtotal numeric,total numeric,notes text,data jsonb);
      alter table artessencia_v1_quotes enable row level security;
      alter table artessencia_v1_orders enable row level security;
      create policy own_quotes on artessencia_v1_quotes to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      create policy own_orders on artessencia_v1_orders to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      grant select,insert,update on artessencia_v1_quotes,artessencia_v1_orders to authenticated;
    `);
    await admin.query(fs.readFileSync('sql/quote_conversion_once_v1.sql','utf8'));
    await admin.query("insert into artessencia_v1_quotes values(gen_random_uuid(),$1,null,'Aceite',20,$2,now())",[account,quote]);
    browser=await chromium.launch();
    const pages=[];
    let rpcCount=0, letFirstCommit;
    const secondStarted=new Promise(resolve=>{letFirstCommit=resolve});
    for(const number of [1,2]){
      const db=await connect(); sessions.push(db);
      await db.query('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[account]);
      const page=await browser.newPage({serviceWorkers:'block'}); pages.push(page);
      await page.route('**/*',r=>{
        const url=new URL(r.request().url());
        return url.origin==='http://app.test'&&!url.pathname.startsWith('/api/')
          ? r.fulfill({path:path.join(process.cwd(),url.pathname==='/'?'index.html':url.pathname)})
          : r.abort();
      });
      page.on('dialog',d=>d.accept());
      await page.exposeFunction('callConversion',async(name,args)=>{
        assert.equal(name,'artessencia_convert_quote_once_v1');
        const call=++rpcCount;
        await db.query('begin');
        try{
          if(call===2)letFirstCommit();
          const result=await db.query('select artessencia_convert_quote_once_v1($1,$2,$3) as reply',
            [args.p_account,args.p_quote,args.p_order]);
          if(call===1)await secondStarted;
          await db.query('commit');
          if(call===1)return {error:{message:'Resposta perdida em trânsito'}};
          return {data:result.rows[0].reply};
        }catch(e){await db.query('rollback');throw e}
      });
      await page.goto('http://app.test/');
      await page.evaluate(({account,quote,number})=>{
        document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
        db.orders=[];db.cash=[];db.quotes=[quote];addQuotePaymentCash(quote,quote.paymentHistory[0]);
        cloudUser={id:account};cloudClient={rpc:window.callConversion};
        nextManualOrderId=async()=> 'TEST-'+number;
      },{account,quote,number});
    }
    await Promise.all(pages.map(p=>p.evaluate(()=>convertQuoteToOrder('Q-TEST'))));
    const counts=await Promise.all(pages.map(p=>p.evaluate(()=>db.orders.length)));
    assert.deepEqual(counts.slice().sort(),[0,1]);
    await pages[counts.indexOf(0)].evaluate(()=>convertQuoteToOrder('Q-TEST'));
    const results=await Promise.all(pages.map(p=>p.evaluate(()=>{
      const o=db.orders[0];
      return [db.orders.length,o.id,o._rid,db.quotes[0].orderId,calcOrder(o).total,o.paid,db.cash.length,db.cash[0].value,orderDialog.open,orderDetail.dataset.orderId];
    })));
    assert.deepEqual(results[0],results[1]);
    const [,id,rid]=results[0];
    assert.deepEqual(results[0],[1,id,rid,id,20,10,1,10,true,id]);
    const stored=await admin.query("select o.data->>'id' as id, q.data->>'orderId' as link,jsonb_array_length(q.data->'statusHistory') as events from artessencia_v1_orders o join artessencia_v1_quotes q on q.data->>'id'=o.data->>'sourceQuoteId'");
    assert.deepEqual(stored.rows,[{id,link:id,events:1}]);
    await assert.rejects(admin.query("insert into artessencia_v1_orders(id,user_id,data) values(gen_random_uuid(),$1,$2)",[account,{id:'OUTRA',sourceQuoteId:quote.id}]),{code:'23505'});
    await assert.rejects(sessions[0].query('select artessencia_convert_quote_once_v1($1,$2,$3)',['aaaaaaaa-0000-0000-0000-000000000002',quote,{}]),/conta/);
    console.log('PASS: duas sessões, duas ligações PostgreSQL, resposta perdida, repetição, uma encomenda e um sinal.');
  }finally{
    if(browser)await browser.close();
    await Promise.all(sessions.map(s=>s.end()));await admin.end();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
