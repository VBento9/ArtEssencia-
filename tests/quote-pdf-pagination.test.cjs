const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('async function buildQuotePdfBlob(q)'),html.indexOf('async function jpegBlobsToPDF('));
let pages=[];
const db={settings:{businessName:'ArtEssencia',businessPhone:'900000000',iban:'PT50 TESTE',paymentNote:''}};
const env={db,loadQuoteLogo:async()=>null,todayISO:()=> '2026-11-04',euro:n=>Number(n).toFixed(2)+' EUR',
  quoteCalc:q=>({sub:q.items.reduce((s,i)=>s+i.qty*i.price,0),disc:5,total:q.items.reduce((s,i)=>s+i.qty*i.price,0)-5}),
  quoteDepositRequired:()=>10,quoteBalanceDueDate:()=> '2026-12-01',quotePaymentLabel:()=> '50% na reserva',
  createCatalogPrintCanvas(){
    const entries=[];pages.push(entries);
    const ctx={font:'',textAlign:'left',measureText:s=>({width:Array.from(String(s)).length*11}),
      fillText(text,x,y,maxWidth){
        const width=Math.min(this.measureText(text).width,maxWidth??Infinity);
        const left=this.textAlign==='right'?x-width:this.textAlign==='center'?x-width/2:x;
        assert(left>=65&&left+width<=1170,'horizontal overflow: '+text);
        assert(y<=1510||y>=1560,'content overlaps footer gap: '+text);
        assert(y>=55&&y<=1710,'vertical overflow: '+text);
        entries.push({text:String(text),x,y});
      },fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
    return {width:2480,height:3508,getContext:()=>ctx,toBlob(cb,mime,quality){assert.equal(quality,.98);cb({});}};
  },jpegBlobsToPDF:async(blobs,w,h)=>{assert.equal(w,2480);assert.equal(h,3508);return blobs.length;}};
vm.createContext(env);vm.runInContext(source,env);
async function run(q){pages=[];const snapshot=JSON.stringify({q,db});const count=await env.buildQuotePdfBlob(q);assert.equal(JSON.stringify({q,db}),snapshot);assert.equal(count,pages.length);return pages.flat().map(e=>e.text);}
(async()=>{
  const short={id:'TEST-SHORT',client:'Cliente',contact:'900000000',created:'2026-11-04',items:[{name:'Vela de exemplo',qty:2,price:12}],notes:'Nota final'};
  const shortText=await run(short);assert.equal(pages.length,1);assert(shortText.includes('Nota final'));
  db.settings.paymentNote=Array.from({length:90},(_,i)=>'PAGAMENTO-'+i).join('\n');
  const long={...short,id:'TEST-LONG',items:Array.from({length:80},(_,i)=>({name:'ARTIGO-'+i,qty:i+1,price:3})),notes:Array.from({length:100},(_,i)=>'NOTA-'+i).join('\n')};
  const text=await run(long);assert(pages.length>3);
  for(let i=0;i<80;i++)assert.equal(text.filter(s=>s==='ARTIGO-'+i).length,1);
  for(let i=0;i<90;i++)assert(text.includes('PAGAMENTO-'+i));
  for(let i=0;i<100;i++)assert(text.includes('NOTA-'+i));
  assert.equal(text.filter(s=>s===env.euro(env.quoteCalc(long).total)).length,1);
  assert.equal(text.filter(s=>s==='Subtotal').length,1);
  for(const [i,page] of pages.entries())assert(page.some(e=>e.text==='Página '+(i+1)));
  const huge={...short,items:[{name:'X'.repeat(6000)+'FIM',qty:2,price:10}],notes:'ULTIMA NOTA'};
  const hugeText=await run(huge);
  assert.equal(hugeText.filter(s=>/^X+(FIM)?$/.test(s)).join(''),huge.items[0].name);
  assert(hugeText.includes('ULTIMA NOTA'));
  console.log('PASS: short quote stays on one page; 80 items, 90 payment lines, 100 notes and long unbroken description preserved; totals once; page numbers; margins; read-only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
