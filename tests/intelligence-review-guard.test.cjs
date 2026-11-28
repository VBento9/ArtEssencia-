'use strict';
const guard=require('../intelligence/review-guard.js');
function testGuard(g){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++;};
 const good={unlocked:true,authHidden:true,lockHidden:true,online:true,cloudReady:true,verified:true,dirty:false,conflict:false,busy:false,owner:true};
 check(g.allowed(good),'owner');
 for(const k of Object.keys(good))check(!g.allowed({...good,[k]:!good[k]}),'deny '+k);
 check(!g.allowed({...good,owner:undefined}),'missing owner');
 const data={stock:[{name:'Cera',unit:'g',qty:2,unitCost:1,secret:'hidden'}],products:[{code:'A',name:'Produto',client:'secret'}],productRecipes:{A:[{item:'Cera',qty:1,notes:'secret'}]},clients:[{name:'private'}]};
 const s=g.snapshot(data);check(!JSON.stringify(s).includes('secret')&&!('clients'in s),'projection');
 s.stock[0].qty=99;check(data.stock[0].qty===2,'detached');
 let denied=false;try{g.snapshot({stock:[]})}catch{denied=true;}check(denied,'invalid snapshot');
 return n;
}
console.log('Verificações concluídas:',testGuard(guard));
