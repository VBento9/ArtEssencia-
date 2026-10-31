'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const version=JSON.parse(fs.readFileSync('version.json','utf8'));
function one(text,re,label){
 const matches=[...text.matchAll(re)];
 assert.equal(matches.length,1,label+' deve existir exatamente uma vez');
 return matches[0][1];
}
const script=one(html,/const APP_VERSION=['"]([\d.]+)['"]/g,'APP_VERSION');
const meta=one(html,/<meta\s+name="artessencia-version"\s+content="([\d.]+)"/g,'meta da versão');
const cache=one(worker,/const CACHE=['"]artessencia-backoffice-([\d.]+)-[^'"]+['"]/g,'cache PWA');
assert.equal(script,version.app,'APP_VERSION deve corresponder a version.json');
assert.equal(meta,version.app,'meta do HTML deve corresponder a version.json');
assert.equal(cache,version.app,'cache PWA deve corresponder a version.json');
assert.match(html,/<script src="pwa-update\.js"><\/script>/,'atualizador PWA carregado');
console.log('PASS: versões consistentes entre HTML, version.json e Service Worker ('+version.app+')');
