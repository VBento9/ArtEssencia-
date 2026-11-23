'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
function extract(name){
  const marker = 'function ' + name + '(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, name + ' must exist in the actual Backoffice');
  const tail = source.slice(start);
  const end = tail.indexOf('\n}\n');
  assert.ok(end > 0, name + ' function end must be found');
  return tail.slice(0, end + 2);
}
function stableStringify(v){
  if(v === null || typeof v !== 'object') return JSON.stringify(v);
  if(Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
const clone = value => JSON.parse(JSON.stringify(value));
const funcSource = extract('mergeOperationalProductRecipesV19186') + '\n' +
                   extract('trySafeOperationalRebaseV19102');
function fixture({baseRecipes, localRecipes, remoteRecipes, localSettings = {}, remoteSettings = {}, baseSettings = {}, hasShadow = true}){
  const storage = new Map();
  const messages = [];
  const metadata = [];
  const context = {
    stableStringify,
    relClone: clone,
    CLOUD_OPERATIONAL_KEYS_V139: ['productRecipes', 'settings'],
    CLOUD_SHADOW: 'shadow',
    KEY: 'db',
    REL_DIRTY: 'dirty',
    db: {productRecipes: clone(localRecipes), settings: clone(localSettings)},
    parseLocal: () => hasShadow ? {revision:1,data:{productRecipes:clone(baseRecipes),settings:clone(baseSettings)}} : null,
    operationalCloudSnapshotV139: () => clone(context.db),
    operationalCloudRowSnapshotV1858: row => clone(row.data),
    localStorage: {setItem: (key,val) => storage.set(key,val)},
    assertManualFragranceHistoryV1: () => {},
    cloudLogMsg: message => messages.push(message),
    cloudErrText: error => String(error.message || error),
    cloudMeta: () => ({dirty:false}),
    saveConfirmedShadow: row => storage.set('confirmedShadow',JSON.stringify(row)),
    setCloudMeta: value => metadata.push(value),
    cloudConflict: null
  };
  vm.runInNewContext(funcSource, context, {timeout:1000});
  const remote = {data:{productRecipes:clone(remoteRecipes),settings:clone(remoteSettings)},revision:2,updated_at:'2026-11-23T22:07:55Z'};
  return {run: () => context.trySafeOperationalRebaseV19102(remote,1),context,storage,messages,metadata};
}

test('independent product recipe edits merge without losing either device', () => {
  const f=fixture({
    baseRecipes:{P1:[]},
    localRecipes:{P1:[{item:'cera',qty:1}]},
    remoteRecipes:{P1:[],P2:[{item:'frasco',qty:2}]}
  });
  assert.equal(f.run(),true);
  assert.equal(f.context.db.productRecipes.P1[0].item,'cera');
  assert.equal(f.context.db.productRecipes.P2[0].item,'frasco');
  assert.equal(f.storage.get('dirty'),'1');
  assert.equal(f.metadata.at(-1).dirty,true);
});
test('same product modified differently on both devices stays blocked', () => {
  const f=fixture({
    baseRecipes:{P1:[]},
    localRecipes:{P1:[{item:'cera',qty:1}]},
    remoteRecipes:{P1:[{item:'cera',qty:2}]}
  });
  assert.equal(f.run(),false);
  assert.equal(f.context.db.productRecipes.P1[0].qty,1);
  assert.match(f.messages.join(' '),/produto P1/);
});
test('outdated local data without confirmed base is not overwritten', () => {
  const f=fixture({
    baseRecipes:{P1:[]},localRecipes:{P1:[]},
    remoteRecipes:{P1:[{item:'cera',qty:1}]},hasShadow:false
  });
  assert.equal(f.run(),false);
  assert.deepEqual(Array.from(f.context.db.productRecipes.P1),[]);
  assert.match(f.messages.join(' '),/sem base confirmada/);
});
test('remote-only technical additions are accepted without local pending flag', () => {
  const f=fixture({
    baseRecipes:{P1:[]},localRecipes:{P1:[]},
    remoteRecipes:{P1:[{item:'cera',qty:1}]}
  });
  assert.equal(f.run(),true);
  assert.equal(f.context.db.productRecipes.P1.length,1);
  assert.equal(f.storage.has('dirty'),false);
});
test('concurrent configuration edits remain blocked', () => {
  const f=fixture({
    baseRecipes:{P1:[]},localRecipes:{P1:[]},remoteRecipes:{P1:[]},
    localSettings:{locale:'A'},remoteSettings:{locale:'B'},baseSettings:{locale:'base'}
  });
  assert.equal(f.run(),false);
  assert.equal(f.context.db.settings.locale,'A');
  assert.match(f.messages.join(' '),/chave settings/);
});
test('deleting and changing the same recipe remain a conflict', () => {
  const f=fixture({
    baseRecipes:{P1:[{item:'cera',qty:1}]},localRecipes:{},
    remoteRecipes:{P1:[{item:'cera',qty:2}]}
  });
  assert.equal(f.run(),false);
});
