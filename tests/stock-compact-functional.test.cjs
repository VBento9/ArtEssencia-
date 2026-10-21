const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(__dirname,'../stock-compact-ui.js'),'utf8');
function fixture(n){
 const html=`<!doctype html><html><body><section id="stock">
 <div class="stock-stack-v1721"><section class="stock-create-section-v1736"><button id="stockCancelBtnV145" class="hidden">Cancelar edição</button></section><section class="stock-move-section-v1721"></section></div>
 <div class="stock-list-card"><div class="tablewrap"><table><tbody id="stockBody">
 ${Array.from({length:n},(_,i)=>`<tr><td><div class="stock-actions"><button onclick="window.edited=${i}">Editar</button><button onclick="window.historyId=${i}">Histórico</button></div></td><td>${i}</td></tr>`).join('')}
 </tbody></table></div></div></section></body></html>`;
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'dangerously'});
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 dom.window.eval(source);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 const d=dom.window.document;
 return {dom,d,body:d.getElementById('stockBody'),buttons:d.querySelectorAll('#aeStockCompactControls button')};
}
function visible(body){return [...body.rows].filter(x=>!x.hidden)}
test('0, 1 e 20 materiais cabem numa página sem botões de paginação',()=>{
 for(const n of [0,1,20]){const f=fixture(n);assert.equal(visible(f.body).length,n);assert.equal(f.buttons[2].disabled,true);assert.equal(f.buttons[3].disabled,true);f.dom.window.close();}
});
test('21 materiais: segunda página mantém o último artigo e o índice original',()=>{
 const f=fixture(21);assert.equal(visible(f.body).length,20);
 f.buttons[3].click();assert.equal(visible(f.body).length,1);
 assert.equal(visible(f.body)[0].cells[1].textContent,'20');
 visible(f.body)[0].querySelector('button').click();assert.equal(f.dom.window.edited,20);
 f.buttons[2].click();assert.equal(visible(f.body).length,20);f.dom.window.close();
});
test('61 materiais: paginação em ambos os extremos',()=>{
 const f=fixture(61);f.buttons[3].click();f.buttons[3].click();f.buttons[3].click();
 assert.equal(visible(f.body).length,1);assert.equal(visible(f.body)[0].cells[1].textContent,'60');
 f.buttons[2].click();assert.equal(visible(f.body).length,20);f.dom.window.close();
});
test('formulários recolhidos; editar abre criação; cancelar fecha',()=>{
 const f=fixture(2),form=f.d.querySelector('.stock-create-section-v1736'),movement=f.d.querySelector('.stock-move-section-v1721');
 assert.equal(form.hidden,true);assert.equal(movement.hidden,true);
 f.buttons[0].click();assert.equal(form.hidden,false);
 f.buttons[1].click();assert.equal(form.hidden,true);assert.equal(movement.hidden,false);
 f.body.rows[0].querySelector('button').click();assert.equal(form.hidden,false);assert.equal(movement.hidden,true);
 f.d.getElementById('stockCancelBtnV145').click();assert.equal(form.hidden,true);f.dom.window.close();
});
test('após render original substituir linhas, paginação reinicia',async()=>{
 const f=fixture(21);f.buttons[3].click();
 f.body.innerHTML='<tr><td>Artigo único</td></tr>';
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(visible(f.body).length,1);assert.equal(f.buttons[3].disabled,true);f.dom.window.close();
});
