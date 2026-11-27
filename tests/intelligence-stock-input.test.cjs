'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const convert=require('../intelligence/stock-input.cjs');
test('Stock evidence preserves bounded text and verifies file signatures',()=>{
 const csv='Material;Quantidade comprada\nCera;500';
 assert.equal(convert({mime:'text/csv',content:Buffer.from(csv).toString('base64')}).text,csv);
 const pdf=Buffer.from('%PDF-1.4 fixture').toString('base64');
 assert.equal(convert({mime:'application/pdf',content:pdf}).type,'input_file');
 assert.throws(()=>convert({mime:'image/png',content:pdf}));
 assert.throws(()=>convert({mime:'text/csv',content:Buffer.alloc(60001,65).toString('base64')}));
 assert.throws(()=>convert({mime:'text/html',content:pdf}));
});
