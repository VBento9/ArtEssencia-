'use strict';
const d=require('../intelligence/delegation.cjs');
function delegationChecks(d){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=f=>{let x=false;try{f()}catch{x=true}check(x,'reject')};
 const settings={enabled:true,agents:{director:'auto',stock:'auto',financeiro:'manual',marketing:'off'}};
 const root={id:'root',agent:'director'},p={id:'child',agent:'stock',kind:'inventory_audit',instruction:'Rever inventário'};
 const input={root,settings,proposals:[p]};
 const plan=d.plan(input);check(plan.children.length===1&&plan.children[0].requiresApproval,'proposal');
 const child=plan.children[0];check(!d.permit(child,settings,0),'approval');check(d.permit({...child,status:'approved'},settings,0),'approved');check(!d.permit({...child,status:'approved'},settings,2),'call cap');
 check(!d.permit({...child,status:'approved'},{...settings,agents:{...settings.agents,stock:'off'}},0),'off');
 reject(()=>d.plan({...input,proposals:[{...p,agent:'director'}]}));
 reject(()=>d.plan({...input,proposals:[{...p,agent:'marketing',kind:'marketing_plan'}]}));
 reject(()=>d.plan({...input,proposals:[{...p,kind:'finance_review'}]}));
 reject(()=>d.plan({...input,proposals:[p,{...p,id:'child2'}]}));
 reject(()=>d.plan({...input,proposals:[{...p,id:'root'}]}));
 reject(()=>d.plan({...input,existing:[child]}));
 reject(()=>d.plan({...input,root:{id:'root',agent:'stock'}}));
 return n;
}
console.log('Verificações concluídas:',delegationChecks(d));
