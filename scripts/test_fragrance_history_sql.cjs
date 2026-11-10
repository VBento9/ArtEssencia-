const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec('create role anon; create role authenticated; create table public.artessencia_v1_state(id int primary key, data jsonb);');
await db.exec(fs.readFileSync('sql/manual-fragrance-history-guard-v1.sql','utf8'));
const initial={settings:{manualFragranceLibraryV1:[{id:'coco',movements:[{id:'start',delta:100000}]}]},stock:[{qty:7}],orders:[{price:20}]};
await db.query('insert into public.artessencia_v1_state values (1,$1)',[initial]);
async function write(data){return db.query('update public.artessencia_v1_state set data=$1 where id=1',[data])}
let checks=0;for(const bad of [{settings:{}},{...initial,settings:{manualFragranceLibraryV1:[]}},{...initial,settings:{manualFragranceLibraryV1:[{id:'coco',movements:[]}]}},{...initial,settings:{manualFragranceLibraryV1:[{id:'coco',movements:[{id:'start',delta:1}]}]}}]){await assert.rejects(write(bad),/manual_fragrance_history_conflict/);checks++}
assert.deepEqual((await db.query('select data from public.artessencia_v1_state')).rows[0].data,initial);checks++;
const newer=structuredClone(initial);newer.settings.manualFragranceLibraryV1[0].movements.push({id:'use',delta:-12000});await write(newer);await write(newer);checks++;
await assert.rejects(write(initial),/manual_fragrance_history_conflict/);checks++;
const unrelated=structuredClone(newer);unrelated.stock[0].qty=6;await write(unrelated);assert.deepEqual((await db.query('select data from public.artessencia_v1_state')).rows[0].data,unrelated);checks++;
await db.exec('insert into public.artessencia_v1_state values (2,\'{"stock":[]}\'); update public.artessencia_v1_state set data=\'{"stock":[1]}\' where id=2;');checks++;
console.log('PASS PostgreSQL: '+checks+' checks; stale/forced overwrite rejected, immutable history, idempotent replay, other fields and legacy states preserved.');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
