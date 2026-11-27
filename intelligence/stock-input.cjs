'use strict';
module.exports=function stockInput({mime,content}){
  if(typeof content!=='string'||content.length>1398104||!/^[a-zA-Z0-9+/]+={0,2}$/.test(content))throw Error('Anexo inválido.');
  const bytes=Buffer.from(content,'base64');
  if(!bytes.length||bytes.length>1048576||bytes.toString('base64')!==content)throw Error('Anexo inválido.');
  if(mime==='text/plain'||mime==='text/csv'){
    if(bytes.length>60000)throw Error('Texto demasiado longo.');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(text.includes('\u0000'))throw Error('Texto inválido.');
    return {type:'input_text',text};
  }
  const signatures={'application/pdf':'255044462d','image/png':'89504e470d0a1a0a','image/jpeg':'ffd8ff'};
  const signature=Object.hasOwn(signatures,mime)&&signatures[mime];
  if(!signature||!bytes.subarray(0,signature.length/2).equals(Buffer.from(signature,'hex')))throw Error('Formato inválido.');
  const url='data:'+mime+';base64,'+content;
  return mime==='application/pdf'?{type:'input_file',filename:'inventario.pdf',file_data:url}:{type:'input_image',image_url:url};
};

// Only an explicit physical-count template is interpreted automatically.
// Invoices, free text and images are evidence for review, not balance data.
module.exports.countPlan=function countPlan(attachment,stock,core){
 if(attachment?.type!=='input_text'||typeof attachment.text!=='string')return null;
 const lines=attachment.text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
 if(lines[0]?.trim().toLowerCase()!=='nome;quantidade contada;unidade')return null;
 if(lines.length<2||lines.length>101)throw Error('A lista de contagem deve ter 1 a 100 materiais.');
 const rows=lines.slice(1).map((line,i)=>{
  const parts=line.split(';').map(v=>v.trim());
  const [name,qty,unit]=parts;
  if(parts.length!==3||!name||name.length>200||/[\u0000-\u001f\u007f]/.test(name)||
     !/^\d+(?:[.,]\d+)?$/.test(qty)||!Number.isFinite(Number(qty.replace(',','.')))||
     Number(qty.replace(',','.'))>1e9||!['g','kg','ml','l','cm','m','un'].includes(unit.toLowerCase()))
   throw Error('Linha de contagem inválida: '+(i+2));
  return {name,qty:qty.replace(',','.'),unit:unit.toLowerCase()};
 });
 const proposals=core.inventoryPlan(rows,stock);
 return {mode:'physical_count_proposal_only',requiresApproval:true,proposals};
};
