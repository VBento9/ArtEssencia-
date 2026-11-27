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
