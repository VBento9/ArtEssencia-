'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const inboxSource=fs.readFileSync('catalog-contact-inbox-v1.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const sql=fs.readFileSync('migrations/catalog_contact_requests_v1.sql','utf8');
test('Backoffice inbox script parses and its view is mounted in Orçamentos',()=>{
 new vm.Script(inboxSource,{filename:'catalog-contact-inbox-v1.js'});
 assert.match(html,/id="catalogContactInboxSectionV1"/);
 assert.match(html,/src="\.\/catalog-contact-inbox-v1\.js"/);
 assert.match(sw,/catalog-contact-inbox-v1\.js/);
});
test('Owner identity must be verified before reading or updating requests',()=>{
 assert.match(inboxSource,/cloudClient\.auth\.getUser/);
 assert.match(inboxSource,/\.eq\('user_id',user\.id\)/);
 assert.match(inboxSource,/\.eq\('personalization->>request_kind','catalog_contact'\)/);
 assert.doesNotMatch(inboxSource,/localStorage\.clear\(/);
});
test('Client names and notes are rendered as text not HTML',()=>{
 assert.match(inboxSource,/\.textContent=String\(text\)/);
 assert.doesNotMatch(inboxSource,/innerHTML/);
});
test('Migration limits anonymous to a narrow, non-read RPC',()=>{
 assert.match(sql,/security definer/);
 assert.match(sql,/set search_path = ''/);
 assert.match(sql,/grant execute on function public\.catalog_submit_contact_request_v1\(jsonb\) to anon/);
 assert.doesNotMatch(sql,/grant select.+ to anon/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/privacy_consent/);
 assert.match(sql,/pg_catalog\.octet_length\(p_payload::text\)>5000/);
 assert.match(sql,/already received recently|Já recebemos um pedido/);
});

test('Inbox refreshes on entering Orçamentos without excessive polling',()=>{
 assert.match(inboxSource,/new MutationObserver\(refreshIfVisible\)/);
 assert.match(inboxSource,/attributeFilter:\['class','hidden','style'\]/);
 assert.match(inboxSource,/document\.addEventListener\('visibilitychange',refreshIfVisible\)/);
 assert.match(inboxSource,/Date\.now\(\)-lastRefresh<90000/);
 assert.match(inboxSource,/refreshIfVisible\(\);/);
});
