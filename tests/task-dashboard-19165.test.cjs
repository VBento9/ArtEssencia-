/* Teste de integração estática: extração de tarefas, resumo e PWA. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
test('Gestor de tarefas tem módulo separado sem duplicar tabela Cloud',()=>{
 const src=read('task-manager-v2.js');
 assert.match(src,/screenId='taskPlanning'/);
 assert.match(src,/dash\.after\(taskScreen\)/);
 assert.match(src,/pages\.splice\(1,0,\[screenId,'Planeamento de Tarefas'\]\)/);
 assert.doesNotMatch(src,/dash\.prepend\(shell\)/);
 assert.match(src,/ENTITY='operational_tasks_v1',TABLE='artessencia_cloud_records'/);
});
test('Dashboard mostra atrasadas e exclui encomendas entregues ou anuladas',()=>{
 const src=read('dashboard-delivery-focus-v19165.js');
 assert.match(src,/o\.status!=='Entregue'/);
 assert.match(src,/!o\.voidedAt/);
 assert.match(src,/o\.delivery<today\?'late'/);
 assert.match(src,/slice\(0,6\)/);
 assert.match(src,/data-dashboard-order/);
 assert.doesNotMatch(src,/\.from\('artessencia_cloud_records'\)/);
});
test('Ficheiros novos são carregados e cache PWA renovada',()=>{
 assert.match(read('dashboard-compact-ui.js'),/dashboard-delivery-focus-v19165\.js/);
 const sw=read('sw.js'),manifest=JSON.parse(read('version.json')),html=read('index.html');
 assert.match(sw,/artessencia-backoffice-1\.9\.165/);
 assert.match(sw,/dashboard-delivery-focus-v19165\.css/);
 assert.equal(manifest.app,'1.9.165');
 assert.match(html,/name="artessencia-version" content="1\.9\.165"/);
});
