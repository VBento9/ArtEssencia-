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

test('Structured physical counts are proposals, never inferred from invoices',()=>{
 const core=require('../intelligence/control-core.js');
 const text=t=>({type:'input_text',text:t});
 const stock=[{name:'Cera',qty:1000,unit:'g'},{name:'Pavio',qty:2,unit:'un'},{name:'Fragrância',qty:10,unit:'ml'}];
 const before=JSON.stringify(stock);
 assert.equal(convert.countPlan(text('Material;Quantidade comprada\nCera;500'),stock,core),null);
 assert.equal(convert.countPlan({type:'input_image'},stock,core),null);
 const plan=convert.countPlan(text('nome;quantidade contada;unidade\nCera;1,5;kg\nPavio;2;un\nFragrancia;20;ml\nCaixa;3;un'),stock,core);
 assert.equal(plan.mode,'physical_count_proposal_only');
 assert.equal(plan.requiresApproval,true);
 assert.deepEqual(plan.proposals.map(r=>r.status),['balance_review','balance_review','name_review','new_material_review']);
 assert.equal(plan.proposals[0].delta,500);
 assert.equal(plan.proposals[1].delta,0);
 assert.equal(plan.proposals[2].candidate,'Fragrância');
 assert.equal(JSON.stringify(stock),before);
 assert.equal(convert.countPlan(text('nome;quantidade contada;unidade\nCera;1;kg\ncera;2;kg'),stock,core).proposals[0].status,'ambiguous');
 for(const bad of ['Cera;-1;g','Cera;1;litros','Cera;1e9;g','Cera;1;g;extra','Cera;1000000001;g'])assert.throws(()=>convert.countPlan(text('nome;quantidade contada;unidade\n'+bad),stock,core));
 assert.throws(()=>convert.countPlan(text('nome;quantidade contada;unidade\n'+Array(101).fill('Cera;1;g').join('\n')),stock,core));
});
