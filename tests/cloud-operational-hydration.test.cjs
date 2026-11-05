const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function operationalLocalPendingV1949(){');
const end=html.indexOf('function applyOperationalCloudRowSafelyV1949(',start);
assert.ok(start>=0&&end>start,'Localizar o guard de receção operacional');

function setup(overrides={}){
 const flags={
  meta:{dirty:false,conflict:false},
  cloudConflict:null,cloudPushPending:false,cloudPushRunning:false,
  cloudHydrating:true,localDirty:false,productPending:false,restorePending:false,
  ...overrides
 };
 const context={
  cloudMeta:()=>flags.meta,
  cloudConflict:flags.cloudConflict,
  cloudPushPending:flags.cloudPushPending,
  cloudPushRunning:flags.cloudPushRunning,
  cloudHydrating:flags.cloudHydrating,
  REL_DIRTY:'rel-dirty',
  localStorage:{getItem:()=>flags.localDirty?'1':null},
  hasPendingProductEditsV19102:()=>flags.productPending,
  hasRestorePendingV12645:()=>flags.restorePending
 };
 vm.runInNewContext(html.slice(start,end),context);
 return context.operationalLocalPendingV1949();
}

test('Arranque a receber da Cloud nao equivale a edicao local pendente',()=>{
 assert.equal(setup({cloudHydrating:true}),false);
});
test('Sem receber tambem nao existe bloqueio artificial',()=>{
 assert.equal(setup({cloudHydrating:false}),false);
});
for(const [reason,flags] of [
 ['alteracao local',{meta:{dirty:true,conflict:false}}],
 ['conflito local',{meta:{dirty:false,conflict:true}}],
 ['conflito de revisao',{cloudConflict:{type:'revision'}}],
 ['fila relacional',{localDirty:true}],
 ['edicao de produto',{productPending:true}],
 ['envio agendado',{cloudPushPending:true}],
 ['envio ativo',{cloudPushRunning:true}],
 ['restauro nao reconciliado',{restorePending:true}]
]){
 test('Continua a proteger dados: '+reason,()=>{
  assert.equal(setup(flags),true);
 });
}
