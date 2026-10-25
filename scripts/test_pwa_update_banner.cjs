const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const elements=new Map(),handlers={},swHandlers={};let reloads=0,updated=0,failUpdate=false;
 const el=()=>({style:{},children:[],setAttribute(){},append(...items){this.children.push(...items)}});
 const body=el();body.append=x=>elements.set(x.id,x);
 const reg={update:async()=>{updated++;if(failUpdate)throw new Error('offline worker')}};
 const c={URL,APP_VERSION:'1.9.24',navigator:{onLine:true,serviceWorker:{addEventListener:(n,h)=>swHandlers[n]=h,register:async()=>reg}},location:{href:'https://fixture.test/?existing=1#stock',protocol:'https:',replace(url){assert.equal(new URL(url).hash,'#stock');assert.equal(new URL(url).searchParams.get('existing'),'1');reloads++}},document:{querySelector:()=>null,visibilityState:'visible',getElementById:id=>elements.get(id),createElement:el,body,addEventListener:(n,h)=>handlers[n]=h},window:{addEventListener:(n,h)=>handlers[n]=h},fetch:async()=>({ok:true,json:async()=>({app:'1.9.30',channel:'artessencia-backoffice-stable'})}),setInterval:()=>{},console:{warn(){}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('pwa-update.js','utf8'),c);
 await new Promise(r=>setImmediate(r));assert.equal(reloads,0);assert(elements.has('ae-update-available'));
 await handlers.online();await swHandlers.controllerchange();await handlers.visibilitychange();await new Promise(r=>setImmediate(r));
 assert.equal(reloads,0);assert.equal(elements.size,1);assert(updated>=1);
 elements.get('ae-update-available').children[1].onclick();assert.equal(reloads,1);
 elements.clear();failUpdate=true;await handlers.online();assert(elements.has('ae-update-available'));
 assert.equal(reloads,1);
 console.log('PASS: no automatic reload on activation/reconnect/resume, single update banner, explicit refresh retains URL state, worker failure does not block recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
