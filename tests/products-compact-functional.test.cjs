const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');
const code=fs.readFileSync(path.join(__dirname,'../products-compact-ui.js'),'utf8');
function fixture(){
 const dom=new JSDOM(`<!doctype html><section id="products">
 <div class="products-hero"><div class="products-filter-group-v1853"><select id="productCategoryFilter"><option value="all">Todos</option></select></div><div class="products-filter-group-v1853"><select id="productShopFilter"><option value="all">Todos</option><option value="published">Publicados</option></select></div></div>
 <div id="productsSummary"></div>
 <div class="products-form-card"><input id="prodName" value="Rascunho"><button id="productCancelEditBtnV145" class="hidden" onclick="cancelProductEditV145()">Cancelar edição</button><div class="product-editor-nav-v1762"><button data-product-panel-btn="identity">Essencial</button><button data-product-panel-btn="pricing">Preço</button><button data-product-panel-btn="production">Produção</button><button data-product-panel-btn="public">Publicação</button></div></div>
 <div class="products-list-card"><button onclick="window.editProduct(5)">Editar</button></div></section>`,{runScripts:'dangerously',url:'https://example.test'});
 dom.window.editProduct=(n)=>{dom.window.edited=n};
 dom.window.cancelProductEditV145=()=>{dom.window.cancelled=true};
 dom.window.eval(code);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));return {dom,d:dom.window.document};
}
test('catálogo inicial e editor reversíveis, sem perder conteúdo',()=>{const {dom,d}=fixture();const buttons=d.querySelectorAll('#aeProductsCompact button'),form=d.querySelector('.products-form-card'),list=d.querySelector('.products-list-card');assert.equal(form.hidden,true);assert.equal(list.hidden,false);buttons[1].click();assert.equal(form.hidden,false);d.querySelector('#prodName').value='Rascunho alterado';buttons[0].click();buttons[1].click();assert.equal(d.querySelector('#prodName').value,'Rascunho alterado');assert.equal(d.querySelectorAll('.product-editor-nav-v1762 button').length,4);dom.window.close()});
test('botão Editar abre editor original e preserva identificador',()=>{const {dom,d}=fixture();d.querySelector('.products-list-card button').click();assert.equal(d.querySelector('.products-form-card').hidden,false);assert.equal(dom.window.edited,5);dom.window.close()});
test('cancelar edição mantém handler original e volta à lista',()=>{const {dom,d}=fixture();d.querySelector('#aeProductsCompact button:nth-child(2)').click();d.querySelector('#productCancelEditBtnV145').click();assert.equal(dom.window.cancelled,true);assert.equal(d.querySelector('.products-list-card').hidden,false);dom.window.close()});
test('filtros recolhíveis não perdem valor selecionado',()=>{const {dom,d}=fixture(),filter=d.querySelector('#productShopFilter'),button=d.querySelector('#aeProductsCompact button:nth-child(3)');filter.value='published';button.click();button.click();assert.equal(filter.value,'published');dom.window.close()});
test('apresentação não contém chamadas de escrita a dados',()=>{for(const term of ['db.products','supabase','localStorage.setItem','saveProduct(','deleteProduct(','fetch('])assert.equal(code.includes(term),false)});
