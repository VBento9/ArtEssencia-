'use strict';
const fs=require('node:fs');
module.exports=async function initialize(db){
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
};
