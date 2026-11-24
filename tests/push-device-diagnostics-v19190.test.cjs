'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const worker=fs.readFileSync('sw.js','utf8'),page=fs.readFileSync('index.html','utf8'),diag=fs.readFileSync('push-device-diagnostics-v19190.js','utf8');
test('local diagnostics is loaded and available from Cloud settings',()=>{
 new vm.Script(diag);
 assert.match(page,/onclick="testPushDeviceV19190\(\)"/);
 assert.match(page,/src="push-device-diagnostics-v19190\.js"/);
 assert.match(worker,/\/push-device-diagnostics-v19190\.js/);
 assert.match(diag,/reg\.showNotification/);
 assert.match(diag,/\.eq\('user_id',cloudUser\.id\)\.eq\('endpoint',sub\.endpoint\)/);
 assert.doesNotMatch(diag,/\.update\(|\.upsert\(|\.delete\(|unsubscribe\(/);
});
test('push displays independently, records success and failure and notifies open clients',async()=>{
 for(const fail of [false,true]){
  const handlers={},records=[],messages=[],notifications=[];
  const ctx={self:{addEventListener:(n,fn)=>handlers[n]=fn,registration:{showNotification:async(t,o)=>{notifications.push({t,o});if(fail)throw Error('blocked')}},clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}]}},caches:{open:async()=>({put:async(k,r)=>records.push(await r.json())})},Response,console:{warn:()=>{}},Date,encodeURIComponent};
  vm.runInNewContext(worker,ctx);let done;
  handlers.push({data:{json:()=>({type:'event_request',request_id:'id-1',title:'Novo contacto'})},waitUntil:p=>done=p});
  await done;
  assert.equal(notifications[0].o.tag,'artessencia-event-id-1');
  assert.equal(records[0].shown,!fail);
  assert.equal(messages[0].type,'ArtEssencia_PUSH_EVENT_REQUEST');
  assert.deepEqual(Object.keys(records[0]).sort(),['at','shown']);
 }
});
