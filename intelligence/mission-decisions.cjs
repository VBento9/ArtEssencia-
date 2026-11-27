'use strict';
const departments=['stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'];
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const schema=object({document:{type:'string'},tasks:{type:'array',items:object({title:{type:'string'},evidenceId:{type:'string'},priority:{type:'integer',enum:[1,2,3]}})},
  delegations:{type:'array',items:object({agent:{type:'string',enum:departments},instruction:{type:'string'}})}});
const bounded=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
function parse(text,{agent,evidenceIds}){
  const data=JSON.parse(text);
  if(!data||Object.keys(data).sort().join(',')!=='delegations,document,tasks'||!bounded(data.document,14000)||
      !Array.isArray(data.tasks)||data.tasks.length>6||!Array.isArray(data.delegations)||data.delegations.length>8)throw Error('Decisão inválida.');
  const recipients=new Set(),titles=new Set();
  for(const task of data.tasks){
    if(!task||Object.keys(task).sort().join(',')!=='evidenceId,priority,title'||!bounded(task.title,160)||!evidenceIds.includes(task.evidenceId)||
        ![1,2,3].includes(task.priority)||titles.has(task.title.trim()))throw Error('Tarefa sem evidência.');
    titles.add(task.title.trim());
  }
  for(const child of data.delegations){
    if(agent!=='director'||!child||Object.keys(child).sort().join(',')!=='agent,instruction'||!departments.includes(child.agent)||
        !bounded(child.instruction,1000)||recipients.has(child.agent))throw Error('Delegação fora da competência.');
    recipients.add(child.agent);
  }
  return data;
}
module.exports={schema,parse};
