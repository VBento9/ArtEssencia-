'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const { buildOrder, refundOrder } = require('../direct-sale-pos');
const { inventory } = require('../ready-stock');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artessencia-ready-'));
  const postgres = process.argv.includes('--postgres');
  async function connect() {
    if (!postgres) return new PGlite(dir);
    const { Client } = require('pg');
    const client = new Client({host:'127.0.0.1',port:55432,user:'postgres',password:'fixture',database:'ready_fixture'});
    await client.connect();
    return {query:client.query.bind(client),exec:client.query.bind(client),close:client.end.bind(client)};
  }
  let db = await connect();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const productId = '00000000-0000-4000-8000-000000000011';
  const date = '2026-11-24';
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const state = async () => (await query('select data from artessencia_v1_state'))[0].data;
  const login = async user => {
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
  };
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create table artessencia_v1_state(user_id uuid primary key,data jsonb,revision bigint,updated_at timestamptz,device_id text,app_version text);
      create table artessencia_v1_products(id uuid primary key,user_id uuid,data jsonb,updated_at timestamptz);
      create table artessencia_v1_orders(id uuid primary key,user_id uuid,client_id uuid,status text,order_date date,due_at timestamptz,subtotal numeric,total numeric,notes text,data jsonb,created_at timestamptz,updated_at timestamptz);
      grant select,insert,update on all tables in schema public to authenticated;
    `);
    for (const table of ['state','products','orders']) {
      await db.exec(`alter table artessencia_v1_${table} enable row level security;
        create policy owner on artessencia_v1_${table} to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())`);
    }
    for (const file of ['register-ready-stock-v1','commit-ready-sale-v1','ready-stock-write-guards-v1']) {
      await db.exec(fs.readFileSync('sql/' + file + '.sql','utf8'));
    }
    const initial = {stock:[{name:'Cera',qty:100}], productRecipes:{A:[{item:'Cera',qty:10}]}, productionRuns:[], stockMoves:[], cash:[]};
    await query('insert into artessencia_v1_state(user_id,data,revision) values($1,$2,0)', [owner, JSON.stringify(initial)]);
    await query('insert into artessencia_v1_products values($1,$2,$3,now())', [productId,owner,JSON.stringify({code:'A',name:'Vela'})]);
    await login(owner);
    const product = (await query('select * from artessencia_v1_products'))[0];
    const run = {id:'lote-A',kind:'ready_stock',mode:'consume',date:'2020-01-01',products:[{code:'A',qty:1}],materials:{Cera:10}};
    const register = async (revision, lot=run) => (await query('select artessencia_register_ready_stock_v1($1,$2,$3,$4) as value',[revision,JSON.stringify(lot),JSON.stringify(product),'fixture']))[0].value;
    const commit = async (revision, sale) => (await query('select artessencia_commit_ready_sale_v1($1,$2,$3) as value',[revision,JSON.stringify(sale),'fixture']))[0].value;
    const makeSale = rid => buildOrder([{code:'A',name:'Vela',qty:1,price:8,cost:2,readyStockTracked:true}], 'Dinheiro',{id:'VD-'+rid,rid},date,date+'T12:00:00Z','PAY-'+rid+'-SALE');
    const sale = makeSale('00000000-0000-4000-8000-000000000021');
    const second = makeSale('00000000-0000-4000-8000-000000000022');
    assert.equal((await register(0)).state.data.stock[0].qty,90);
    assert.equal((await register(0)).replayed,true);
    assert.deepEqual((await state()).cash,[]);
    assert.equal((await query('select * from artessencia_v1_orders')).length,0);
    if (postgres) {
      const device = await connect();
      try {
        await device.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
        await device.exec("set role authenticated;set lock_timeout='8s'");
        const pid = (await device.query('select pg_backend_pid() as id')).rows[0].id;
        await db.exec('begin');
        await commit(1,sale);
        const competing = assert.rejects(device.query('select artessencia_commit_ready_sale_v1($1,$2,$3)',[1,JSON.stringify(second),'device-B']),/cloud_revision_conflict/);
        let waiting=false;
        for(let i=0;i<100 && !waiting;i++){
          waiting=(await query('select cardinality(pg_blocking_pids($1))>0 as waiting',[pid]))[0].waiting;
          if(!waiting)await new Promise(resolve=>setTimeout(resolve,20));
        }
        await db.exec('commit');
        await competing;
        assert.ok(waiting,'segundo dispositivo deve aguardar o bloqueio da primeira transação');
      } finally {await device.close();}
    } else {
      await commit(1,sale);
      await assert.rejects(commit(1,second),/cloud_revision_conflict/);
    }
    await assert.rejects(commit(2,second),/INSUFFICIENT_READY_STOCK/);
    assert.equal((await state()).cash.length,1);
    await db.close();
    db = await connect();
    await login(owner);
    assert.equal((await commit(1,sale)).replayed,true);
    const refund = restock => ({...refundOrder(sale,date+'T14:00:00Z','PAY-'+sale._rid+'-REFUND',date),readyRestocked:restock});
    assert.equal((await commit(2,refund(true))).state.data.cash.length,2);
    assert.equal((await commit(2,refund(true))).replayed,true);
    await db.exec(`reset role; create function fail_late() returns trigger language plpgsql as $$ begin raise exception 'TEST_INTERRUPTION'; end $$;
      create trigger fail_late before update on artessencia_v1_state for each row execute function fail_late();set role authenticated`);
    await assert.rejects(commit(3,second),/TEST_INTERRUPTION/);
    assert.equal((await query('select * from artessencia_v1_orders')).length,1);
    assert.equal((await state()).cash.length,2);
    await db.exec('reset role; drop trigger fail_late on artessencia_v1_state;set role authenticated');
    await commit(3,second);
    const damaged = {...refundOrder(second,date+'T15:00:00Z','PAY-'+second._rid+'-REFUND',date),readyRestocked:false};
    await commit(4,damaged);
    const orders = (await query('select data from artessencia_v1_orders')).map(row=>row.data);
    assert.equal(inventory((await state()).productionRuns,orders).get('A').available,0);
    const already = {...run,id:'lote-B',mode:'already',materials:{}};
    await assert.rejects(register(4,already),/cloud_revision_conflict/);
    const done = (await register(5,already)).state.data;
    assert.equal(done.stock[0].qty,90);
    assert.equal(done.stockMoves.length,1);
    assert.equal(done.cash.reduce((sum,m)=>sum+(m.type==='Entrada'?m.value:-m.value),0),0);
    const lost={...already,id:'ajuste-1',mode:'damage',reason:'Quebra na feira'};
    await assert.rejects(register(6,{...lost,reason:''}),/ADJUSTMENT_REASON_REQUIRED/);
    await assert.rejects(register(6,{...lost,products:[{code:'A',qty:2}]}),/INSUFFICIENT_READY_STOCK/);
    const adjusted=(await register(6,lost)).state.data;
    assert.equal(inventory(adjusted.productionRuns,orders).get('A').available,0);
    assert.deepEqual(adjusted.cash,done.cash);
    await assert.rejects(query("update artessencia_v1_state set data=data-'productionRuns'"),/READY_HISTORY_PROTECTED/);
    await assert.rejects(query("update artessencia_v1_state set data=data-'cash'"),/READY_CASH_HISTORY_PROTECTED/);
    await assert.rejects(query("update artessencia_v1_orders set status='Confirmado'"),/READY_SALE_REQUIRES_CLOUD_TRANSACTION/);
    await login(other);
    await assert.rejects(register(6),/CANONICAL_STATE_REQUIRED/);
    await assert.rejects(commit(6,sale),/CANONICAL_STATE_REQUIRED/);
    await db.exec('reset role;set role anon');
    await assert.rejects(register(6),/permission denied/);
    await assert.rejects(commit(6,sale),/permission denied/);
    console.log('PASS: produção, última unidade na mesma revisão, repetição após reinício, devoluções, interrupção, Caixa, revisão e isolamento.');
  } finally {
    await db.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
