const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const [file,required] of [
 ['stock-compact-ui.css',['min-width:1120px','table-layout:fixed','@container (max-width: 1000px)','font-variant-numeric:tabular-nums']],
 ['products-compact-ui.css',['products-list-card{container-type:inline-size','@container (max-width: 1000px)','word-break:normal','product-card-actions']],
 ['orders-compact-ui.css',['orders-list-card-v1728{container-type:inline-size','@container (max-width: 1100px)','@container (max-width: 520px)','data-ae-order-state="ready-unpaid"','order-card-actions{display:grid']]
])test(file+' é responsivo e preserva a estrutura',()=>{const css=read(file);for(const token of required)assert.ok(css.includes(token),token);assert.equal((css.match(/\\{/g)||[]).length,(css.match(/\\}/g)||[]).length);assert.ok(!css.includes('word-break:break-all'));});
