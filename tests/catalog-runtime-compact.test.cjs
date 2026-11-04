'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('boxes-atelier-ui-v1.js','utf8');
const nodes=new Map();
class Element{
 constructor(id='',classes=''){this.id=id;this.classes=classes;this.children=[];this.style={};this.open=false;this.hidden=false;if(id)nodes.set(id,this)}
 append(...items){for(const item of items){if(item.parent)item.parent.children=item.parent.children.filter(x=>x!==item);item.parent=this;this.children.push(item)}}
 insertAdjacentElement(_,item){this.parent.append(item)}
 after(item){this.parent.append(item)}
 closest(){return this.parent?.classes.includes('catalog-fold')?this.parent:null}
 querySelector(selector){return this.children.find(x=>x.classes.includes(selector.slice(1)))||this.children.map(x=>x.querySelector(selector)).find(Boolean)||null}
 set innerHTML(value){this.html=value;if(value.includes('class="ae-hub-tabs"'))this.append(new Element('','ae-hub-tabs'))}
 focus(){this.focused=true}
}
const screen=new Element('catalogs');
for(const [id,cl,childId,childCl] of [['summaryFold','catalog-fold','catalogSummary','catalog-summary'],['catalogBoxEditor','catalog-fold','editor','catalog-editor-card'],['catalogCreatorSettings','catalog-fold','creator','catalog-creator-card'],['catalogSavedBoxes','catalog-fold','heading','catalog-saved-head']]){const fold=new Element(id,cl);fold.append(new Element(childId,childCl));screen.append(fold)}
nodes.get('catalogSavedBoxes').append(new Element('themedBoxesGrid','catalog-grid'));
screen.append(new Element('dashboard','catalog-dashboard'),new Element('pdf','catalog-documents-stack-v1731'));
const name=new Element('themeBoxName');nodes.get('editor').append(name);
let active;
const context=vm.createContext({document:{createElement:()=>new Element()},$:id=>nodes.get(id),ID:'aeBoxesHubV1',showTab:tab=>{active=tab}});
const start=source.indexOf('function install(){');const end=source.indexOf(" $('aeRefreshBoxRequests').addEventListener",start);
vm.runInContext(source.slice(start,end)+'}\ninstall();',context);
const hub=screen.children.find(x=>x.id==='aeBoxesHubV1');
assert(hub);assert.equal(nodes.get('summaryFold').parent,hub);
assert.equal(nodes.get('catalogBoxEditor').parent.id,'aeHubPanel_ready');
assert.equal(nodes.get('editor').parent.id,'catalogBoxEditor');
assert.equal(nodes.get('catalogBoxEditor').open,false);
assert.equal(nodes.get('catalogSavedBoxes').open,true);
assert.equal(nodes.get('catalogCreatorSettings').parent.id,'aeHubPanel_advanced');
assert.equal(nodes.get('creator').parent.id,'catalogCreatorSettings');
assert.equal(nodes.get('pdf').parent.id,'aeHubPanel_pdf');
assert(!screen.children.some(x=>x.classes.includes('catalog-fold')),'No empty disclosure wrappers left on screen');
const openStart=source.indexOf('function openBoxEditor(){');const openEnd=source.indexOf('function phone()',openStart);
vm.runInContext(source.slice(openStart,openEnd)+'openBoxEditor();',context);
assert.equal(active,'ready');assert.equal(nodes.get('catalogBoxEditor').open,true);assert(name.focused);
assert.match(source,/showTab\('pdf'\);\n}\n\nlet requestsCache/);
console.log('PASS: runtime moves complete disclosures, preserves collapsed editor, opens it with focus, and starts on PDFs.');
