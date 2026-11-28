'use strict';
const core=require('../intelligence/control-core.js');
const b=require('../intelligence/batch-review.js');
function testBatch(b,core){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++;};const throws=(f,m)=>{let bad=false;try{f()}catch{bad=true}check(bad,m);};
 const stock=[{name:'Cera',qty:500,unit:'g',unitCost:.01},{name:'Pavio',qty:8,unit:'un'}];
 const args={id:'m1',text:'Cera;1;kg\nPavio;0;un\nNova;2;ml',stock,owner:'owner-a',revision:7,core,at:'2026-11-26T22:00:00Z'};
 const before=JSON.stringify(stock),m=b.create(args),dec={selected:[0,1],stock,owner:'owner-a',revision:7,core,at:args.at,allowed:true};
 check(m.plan[0].delta===500&&m.plan[1].delta===-8,'count');
 check(m.plan[2].status==='new_material_review','new');
 check(b.parse('Cera;0,5;kg')[0].qty==='0.5','decimal');
 throws(()=>b.parse('Cera;1e3;g'),'scientific');
 throws(()=>b.parse('Cera;1;g;extra'),'columns');
 const a=b.decide(m,dec);
 check(a.status==='approved_preview'&&a.approved.length===2&&a.history.length===2,'approval');
 check(b.exportDecision(a).mode==='preview_only'&&!('owner'in b.exportDecision(a)),'export');
 check(JSON.stringify(stock)===before,'no mutation');
 throws(()=>b.decide(m,{...dec,allowed:false}),'off');
 throws(()=>b.decide(m,{...dec,owner:'other'}),'owner');
 throws(()=>b.decide(m,{...dec,revision:8}),'revision');
 throws(()=>b.decide(m,{...dec,stock:[{...stock[0],qty:501},stock[1]]}),'stale');
 throws(()=>b.decide(m,{...dec,selected:[2]}),'unresolved');
 throws(()=>b.decide(m,{...dec,selected:[0,0]}),'duplicate');
 throws(()=>b.decide(a,dec),'repeat');
 check(b.cancel(a,args.at).status==='cancelled','cancel');
 throws(()=>b.exportDecision(m),'not approved');
 return n;
}
console.log('Verificações concluídas:',testBatch(b,core));
