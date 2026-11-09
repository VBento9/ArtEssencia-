const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const sql=readFileSync('sql/artessencia_analytics_ingestion_guard_v2.sql','utf8');
const config=JSON.parse(readFileSync('vercel.json','utf8'));

test('Contrato de analitica anonimo e limites de contencao',()=>{
 assert.match(sql,/create or replace function public\.artessencia_analytics_track_v1\(/i);
 assert.match(sql,/grant execute on function public\.artessencia_analytics_track_v1\(text,text,uuid,uuid,text,text,text,text,jsonb\) to anon/i);
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock/);
 assert.match(sql,/visitor_id = p_visitor_id/);
 assert.match(sql,/limit 181[\s\S]*>= 180/);
 assert.match(sql,/limit 121[\s\S]*>= 120/);
 assert.match(sql,/limit 6001[\s\S]*>= 6000/);
});
test('O SQL nao elimina registos nem desativa RLS',()=>{
 assert.match(sql,/create index if not exists/i);
 assert.doesNotMatch(sql,/\b(drop table|truncate table|delete from|disable row level security)\b/i);
});
test('Todas as APIs ficam sem cache e com isolamento de conteudos',()=>{
 const rule=config.headers.find(x=>x.source==='/api/(.*)');
 assert.ok(rule);
 const h=Object.fromEntries(rule.headers.map(x=>[x.key.toLowerCase(),x.value]));
 assert.match(h['cache-control'],/no-store/);
 assert.match(h['content-security-policy'],/frame-ancestors 'none'/);
 assert.ok(config.headers.find(x=>x.source==='/sw.js').headers.some(x=>x.key==='Service-Worker-Allowed'));
});
