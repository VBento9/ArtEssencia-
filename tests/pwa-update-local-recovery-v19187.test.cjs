'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('pwa-update.js','utf8');
const start=src.indexOf(' function pwaDurableSnapshotV19187(){');
const end=src.indexOf(' function reloadFresh(){',start);
assert.ok(start>0&&end>start,'O fluxo de recuperação deve existir');
const definitions=src.slice(start,end);
function makeFixture({initial,live,saveResult=true,backupAvailable=true,busy=false}={}){
 const storage=new Map([['data',JSON.stringify(initial??{})]]);
 const messages=[];
 const downloads=[];
 let saves=0,reloads=0,confirmed=0;
 const context={
   KEY:'data',db:live??{}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
   backupBlob:backupAvailable?()=>({size:42}):undefined,
   backupFileName:()=> 'recuperacao.json',
   downloadBlob:(blob,name)=>downloads.push(name),
   confirm:()=>{confirmed++;return true},
   save:()=>{saves++;if(saveResult)storage.set('data',JSON.stringify(context.db));return saveResult},
   cloudBusy:busy,cloudPushRunning:false,productSyncBusyV19104:false,cloudHydrating:false,
   hasRestorePendingV12645:()=>false,
   bannerMessage:msg=>messages.push(msg),
   reloadFresh:()=>{reloads++}
 };
 const names=Object.keys(context),values=Object.values(context);
 const get=new Function(...names,definitions+'\nreturn {durable:pwaDurableSnapshotV19187,backup:pwaExportBeforeUpdateV19187,persist:pwaPersistBeforeUpdateV19187};')(...values);
 return {get,storage,messages,downloads,stats:()=>({saves,reloads,confirmed})};
}
test('estado diferente exige backup antes de guardar',()=>{
 const f=makeFixture({initial:{a:1},live:{a:2}});
 assert.equal(f.get.durable(),false);
 assert.equal(f.get.persist(),false);
 assert.equal(f.stats().saves,0);
});
test('backup e gravação local permitem atualizar sem limpar o armazenamento',()=>{
 const f=makeFixture({initial:{a:1},live:{a:2}});
 assert.equal(f.get.backup(),true);
 assert.equal(f.downloads.length,1);
 assert.equal(f.get.persist(),true);
 assert.equal(f.get.durable(),true);
 assert.equal(f.stats().reloads,1);
});
test('falha de gravação não permite atualizar',()=>{
 const f=makeFixture({initial:{a:1},live:{a:2},saveResult:false});
 assert.equal(f.get.backup(),true);
 assert.equal(f.get.persist(),false);
 assert.equal(f.stats().reloads,0);
});
test('operação Cloud em curso bloqueia recuperação',()=>{
 const f=makeFixture({initial:{a:1},live:{a:2},busy:true});
 assert.equal(f.get.backup(),true);
 assert.equal(f.get.persist(),false);
 assert.equal(f.stats().saves,0);
});
test('backup indisponível impede recuperação',()=>{
 const f=makeFixture({initial:{a:1},live:{a:2},backupAvailable:false});
 assert.equal(f.get.backup(),false);
 assert.equal(f.get.persist(),false);
 assert.equal(f.stats().reloads,0);
});
