const {readFileSync}=require('node:fs');
const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync('index.html','utf8'),sw=readFileSync('sw.js','utf8'),updater=readFileSync('pwa-update.js','utf8');
(async()=>{
 const version=JSON.parse(readFileSync('version.json'));assert(html.includes(`const APP_VERSION='${version.app}'`));assert(html.includes('<script src="pwa-update.js"></script>'));assert(!html.includes('artessencia_runtime_reset_v12_3_1'));assert(!/localStorage|indexedDB|sessionStorage|caches\.delete/.test(updater));
 const ids=['clients','orders','stock','products','production','visualCatalogs','delivery','cloud','backup'];for(const id of ids)assert(html.includes(`id="${id}"`));
 const elements=new Map();function element(){return {style:{},textContent:'',value:'',disabled:true,children:[],append(...x){this.children.push(...x)},replaceChildren(){this.children=[]}}}function get(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}
 let calls=[],fail=false;const rows=[{locality:'Castelejo',fee_cents:200,active:true,postal_codes:['6230-152']},{locality:'Fundão',fee_cents:300,active:false,postal_codes:[]}];
 const context={document:{getElementById:get,createElement:element},cloudUser:{id:'fixture-owner'},cloudClient:{rpc:async(name,args)=>{calls.push({name,args});return fail?{error:new Error('denied')}:{data:name.includes('list')?rows:{ok:true}}}},ensureCloudSession:async()=>null,euro:x=>x.toFixed(2)+' €',renderDeliveryOverview:()=>{},toast:()=>{}};vm.createContext(context);
 const start=html.indexOf('let deliveryZonesV197='),end=html.indexOf('// ArtEssencia V1.9.2',start);vm.runInContext(html.slice(start,end),context);
 await vm.runInContext('loadDeliveryZonesV197()',context);assert.equal(get('zoneSaveV197').disabled,false);assert.equal(get('deliveryZonesRowsV197').children.length,2);
 get('zoneLocalityV197').value='Castelejo';get('zoneFeeV197').value='2.50';get('zoneActiveV197').value='true';await vm.runInContext('saveDeliveryZoneV197()',context);
 const write=calls.find(x=>x.name.includes('update'));assert(write);assert.equal(write.args.p_zones.find(x=>x.locality==='Castelejo').fee_cents,250);assert.deepEqual(JSON.parse(JSON.stringify(write.args.p_zones.find(x=>x.locality==='Castelejo').postal_codes)),['6230-152']);assert.equal(write.args.p_zones.find(x=>x.locality==='Fundão').active,false);assert(calls.every(x=>['artessencia_list_delivery_zones_v1','artessencia_update_delivery_zones_v2'].includes(x.name)));
 calls=[];get('zoneFeeV197').value='-1';await vm.runInContext('saveDeliveryZoneV197()',context);assert.equal(calls.length,0);
 fail=true;await vm.runInContext('loadDeliveryZonesV197()',context);assert.equal(get('zoneSaveV197').disabled,true);calls=[];await vm.runInContext('saveDeliveryZoneV197()',context);assert.equal(calls.length,0);
 console.log('PASS: runtime version, real entrypoint, existing module anchors, zone read/edit, postal restrictions, inactive zones, invalid fees, failed read blocks writes; no shop-state RPC or storage reset.');
 const handlers={},deleted=[];let failFetch=false;const storage=new Map([['/index.html',new Response('<html>fixture</html>')]]);
 const cache={addAll:async()=>{},put:async(k,v)=>storage.set(k,v),match:async k=>storage.get(typeof k==='string'?k:k.url)};
 const c={URL,Response,self:{location:{origin:'https://fixture.test'},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(n,h)=>handlers[n]=h},caches:{open:async()=>cache,keys:async()=>['unrelated-cache','artessencia-backoffice-old','artessencia-backoffice-1.9.8'],delete:async k=>deleted.push(k),match:cache.match},fetch:async()=>{if(failFetch)throw new Error('offline');return new Response('fresh')}};vm.createContext(c);vm.runInContext(sw,c);
 let task;handlers.activate({waitUntil:p=>task=p});await task;assert.deepEqual(deleted,['artessencia-backoffice-old']);
 failFetch=true;let result;handlers.fetch({request:{method:'GET',url:'https://fixture.test/unknown.png',mode:'no-cors'},respondWith:p=>result=p});assert.equal((await result).type,'error');
 handlers.fetch({request:{method:'GET',url:'https://fixture.test/',mode:'navigate'},respondWith:p=>result=p});assert.match(await(await result).text(),/fixture/);
 assert(handlers.push&&handlers.notificationclick);console.log('PASS: scoped cache cleanup, offline navigation, no HTML fallback for image requests, notification handlers retained.');
})().catch(e=>{console.error(e);process.exitCode=1});
