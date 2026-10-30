import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return html.slice(start,end)};
test('all canonical bulk writers use CAS',()=>{
 const s=section('async function relationalSyncCore(showToast=false){','async function relationalHydrateCore');
 assert.ok(s.includes('syncGuardedV1950'));assert.doesNotMatch(s,/\.upsert\((clientRows|productRows|orderRows|quoteRows)/);
});
test('individual client and order writers use CAS',()=>{
 const s=section('async function syncSingleOrderToCloud(order){','async function syncOrderBusinessStateV1757');
 assert.equal((s.match(/writeRelationalRowsCasV1950\(/g)||[]).length,2);assert.doesNotMatch(s,/\.upsert\(/);
});
test('hydration is guarded and rolls back after conflicts',()=>{
 const s=section('async function relationalHydrateCore(initial=false){',"document.addEventListener('input',");
 assert.ok(s.includes('assertCanHydrateV1950(target,base'));assert.ok(s.includes('if(hydrationBackupV1950)db=hydrationBackupV1950'));
});
test('push stops if pending orders fail and honours conflict latch',()=>{
 const s=section('async function cloudPushNow(showToast=true){','function hasMeaningfulLocalData()');
 assert.ok(s.includes('if(!await syncPendingOrdersOnly(false))return false;'));assert.ok(s.includes('cloudMeta().conflict'));
});

test('hydration cannot clear dirty flag when local-only clients, products or quotes exist',()=>{
 const s=section('async function relationalHydrateCore(initial=false){',"document.addEventListener('input',");
 assert.ok(s.includes('hasUnsentLocalRowsV1950(localClients,clients'));
 assert.ok(s.includes('hasUnsentLocalRowsV1950(localProducts,products'));
 assert.ok(s.includes('hasUnsentLocalRowsV1950(localQuotes,quotes'));
 assert.ok(s.includes('if(pendingAfterHydrationV1950)localStorage.setItem(REL_DIRTY'));
});
test('failed hydration restores pending orders, dirty flag and backup snapshot',()=>{
 const s=section('async function relationalHydrateCore(initial=false){',"document.addEventListener('input',");
 assert.ok(s.includes('hydrationLocalStorageBackupV1950'));
 assert.ok(s.includes('[REL_ORDER_PENDING]:localStorage.getItem(REL_ORDER_PENDING)'));
 assert.ok(s.includes('for(const [key,value] of Object.entries(hydrationLocalStorageBackupV1950))'));
});
