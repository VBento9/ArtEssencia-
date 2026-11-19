'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const specs=[
 ['sale-tablet-ux-v19165.css',['sale-customer-card-v1727{container-type:inline-size','sale-products-browser-v1754{container-type:inline-size','@container (max-width: 620px)','@container (max-width: 480px)']],
 ['fragrance-library.css',['fl-library-shell{container-type:inline-size','fl-library-summary','@container (max-width: 1000px)','@container (max-width: 395px)']],
 ['special-editions-compact-v1962.css',['#specialEditions{container-type:inline-size','specialEditionProducts','@container (max-width: 950px)','@container (max-width: 490px)']],
 ['special-editions-overview-v1964.css',['special-editions-grid-pro','@container (max-width: 1050px)','@container (max-width: 460px)']],
 ['backoffice-visual.css',['.app #costs,.app #catalogs,.app #visualCatalogs{container-type:inline-size','catalog-documents-stack-v1731','visual-catalog-layout','@container (max-width: 1150px)']]
];
for(const [file,tokens] of specs)test(file+' possui regras por largura útil',()=>{
 const css=read(file);
 for(const token of tokens)assert.ok(css.includes(token),token);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
 assert.ok(!css.includes('word-break:break-all'));
});
test('IDs e scripts críticos de negócio mantêm-se intactos',()=>{
 const html=read('index.html'),sw=read('sw.js');
 for(const id of ['sale','costs','technicalLibrary','catalogs','visualCatalogs','specialEditions'])assert.ok(html.includes('id="'+id+'"'));
 for(const css of ['sale-tablet-ux-v19165.css','fragrance-library.css','special-editions-compact-v1962.css','special-editions-overview-v1964.css','backoffice-visual.css'])assert.ok(sw.includes('/'+css));
});
