/* Pure manual ledger. Quantities are integer microlitres, displayed in ml. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function units(value){
 if(value===null||value===undefined||String(value).trim()===''||!/^\d+(?:[.,]\d{1,3})?$/.test(String(value)))throw Error('Indica uma quantidade válida, até três casas decimais.');
 const n=Number(String(value).replace(',','.'))*1000;
 if(!Number.isSafeInteger(Math.round(n))||n>1e12)throw Error('Quantidade inválida.');
 return Math.round(n);
}
function balance(row){return (row.movements||[]).reduce((n,m)=>n+m.delta,0)}
function tank(row){const available=balance(row)/1000,capacity=row.capacityUnits/1000;return {available,capacity:capacity||null,percent:capacity>0?Math.min(100,available/capacity*100):null}}
function apply(row,op){
 if(!op.id)throw Error('Operação sem identificador.');
 const old=(row.movements||[]).find(m=>m.id===op.id);
 if(old){if(old.request!==JSON.stringify(op))throw Error('Identificador repetido com dados diferentes.');return clone(row)}
 if(row.archived)throw Error('Reativa a fragrância antes de registar movimentos.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(op.date)||new Date(op.date+'T12:00:00Z').toISOString().slice(0,10)!==op.date)throw Error('Data inválida.');
 const n=units(op.quantity),before=balance(row),next=clone(row);
 let delta=0;
 if(op.type==='consumption'||op.type==='refill'){if(n<=0)throw Error('A quantidade deve ser superior a zero.');delta=op.type==='consumption'?-n:n}
 else if(op.type==='correction'){if(!String(op.note||'').trim())throw Error('Justifica a correção.');delta=n-before}
 else if(op.type==='capacity'){if(!String(op.note||'').trim())throw Error('Justifica a alteração de capacidade.');next.capacityUnits=n}
 else throw Error('Tipo de movimento inválido.');
 if(before+delta<0)throw Error('Quantidade superior à disponibilidade.');
 next.movements=[...(next.movements||[]),{id:op.id,type:op.type,date:op.date,note:op.note||'',delta,before,after:before+delta,capacityBefore:row.capacityUnits||null,capacityAfter:next.capacityUnits||null,request:JSON.stringify(op)}];
 return next;
}
const api={units,balance,tank,apply};if(typeof module!=='undefined')module.exports=api;else root.FragranceLedger=api;
})(typeof window!=='undefined'?window:globalThis);
