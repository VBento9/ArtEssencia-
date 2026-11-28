'use strict';
const departments=['stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'];
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const schema=object({document:{type:'string'},tasks:{type:'array',items:object({title:{type:'string'},evidenceId:{type:'string'},priority:{type:'integer',enum:[1,2,3]}})},
  delegations:{type:'array',items:object({agent:{type:'string',enum:departments},instruction:{type:'string'}})}});
// Encode evidence and role limits in the provider schema, not only in prose.
function schemaFor(agent,evidenceIds){
 if(!['director',...departments].includes(agent)||!Array.isArray(evidenceIds)||evidenceIds.length>20||
  evidenceIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)))throw Error('Contexto de decisão inválido.');
 const ids=[...new Set(evidenceIds)];
 return object({
  document:{type:'string',description:'Relatório conciso; distingue factos, lacunas e próximos passos.',minLength:1,maxLength:14000},
  tasks:{type:'array',maxItems:ids.length?6:0,items:object({
   title:{type:'string',minLength:1,maxLength:160},evidenceId:ids.length?{type:'string',enum:ids}:{type:'string'},priority:{type:'integer',enum:[1,2,3]}
  })},
  delegations:{type:'array',maxItems:agent==='director'?8:0,items:object({agent:{type:'string',enum:departments},instruction:{type:'string',minLength:1,maxLength:1000}})}
 });
}
function reject(code){const e=Error('Decisão inválida.');e.decisionCode=code;throw e;}
const bounded=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
function parse(text,{agent,evidenceIds}){
  let data;try{data=JSON.parse(text);}catch{reject('decision_json');}
  if(!data||Object.keys(data).sort().join(',')!=='delegations,document,tasks'||!bounded(data.document,14000)||
      !Array.isArray(data.tasks)||data.tasks.length>6||!Array.isArray(data.delegations)||data.delegations.length>8)reject('decision_shape');
  const recipients=new Set(),titles=new Set();
  for(const task of data.tasks){
    if(!task||Object.keys(task).sort().join(',')!=='evidenceId,priority,title'||!bounded(task.title,160)||!evidenceIds.includes(task.evidenceId)||
        ![1,2,3].includes(task.priority)||titles.has(task.title.trim()))reject('decision_task');
    titles.add(task.title.trim());
  }
  for(const child of data.delegations){
    if(agent!=='director'||!child||Object.keys(child).sort().join(',')!=='agent,instruction'||!departments.includes(child.agent)||
        !bounded(child.instruction,1000)||recipients.has(child.agent))reject('decision_delegation');
    recipients.add(child.agent);
  }
  return data;
}
module.exports={schema,schemaFor,parse};
