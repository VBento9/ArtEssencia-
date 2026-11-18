const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../dashboard-compact-ui.js'),'utf8');
function start(){
 const html=`<section id="dashboard"><div id="kpis">
 <button><span class="label">Encomendas</span></button><button><span class="label">Pendentes</span></button><button><span class="label">Por receber</span></button><button><span class="label">Stock baixo</span></button><button><span class="label">Margem real</span></button></div>
 <div class="section-title">Encomendas pendentes</div><div class="tablewrap"><table><tbody id="pendingOrders"><tr><td>A</td></tr></tbody></table></div>
 <div class="section-title">Valores a receber</div><div class="tablewrap"><table><tbody id="receivablesBody"><tr><td>B</td></tr></tbody></table></div>
 <div class="section-title">Orçamentos a acompanhar</div><div class="tablewrap"><table><tbody id="quotePipelineBody"><tr><td>C</td></tr></tbody></table></div>
 <div class="section-title">Evolução dos últimos 12 meses</div><div class="card"><div id="trendChart"></div></div></section>`;
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://example.test'});
 dom.window.eval(source);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 return {dom,d:dom.window.document};
}
test('preserva todas as linhas e alterna listagens sem eliminar dados',()=>{
 const {dom,d}=start();const tabs=[...d.querySelectorAll('[role=tab]')];
 assert.equal(tabs.length,3);assert.equal(d.querySelectorAll('tbody tr').length,3);
 tabs[1].click();assert.equal(d.querySelector('#receivablesBody').closest('.tablewrap').hidden,false);
 assert.equal(d.querySelector('#pendingOrders').closest('.tablewrap').hidden,true);
 tabs[2].click();assert.equal(d.querySelector('#quotePipelineBody').closest('.tablewrap').hidden,false);
 assert.equal(d.querySelectorAll('tbody tr').length,3);dom.window.close();
});
test('indicadores importantes visíveis e finanças expansíveis',()=>{
 const {dom,d}=start();const cards=[...d.querySelector('#kpis').children];
 assert.deepEqual(cards.map(x=>x.hidden),[false,false,false,false,true]);
 const button=d.querySelector('.ae-dash-compact-kpis button');button.click();
 assert.equal(cards.every(x=>!x.hidden),true);dom.window.close();
});
test('gráfico permanece no DOM ao abrir e recolher',()=>{
 const {dom,d}=start();const chart=d.querySelector('#trendChart'),card=chart.closest('.card');
 assert.equal(card.hidden,true);
 d.querySelector('.ae-dash-analysis-toggle').click();assert.equal(card.hidden,false);
 assert.equal(d.querySelector('#trendChart'),chart);dom.window.close();
});

test('abre a encomenda exata após redesenhar a lista, sem handlers inline',()=>{
 const {dom,d}=start(),calls=[];
 dom.window.showOrder=id=>calls.push(['detail',id]);dom.window.dashboardDailyOpen=id=>calls.push(['daily',id]);dom.window.dashboardGoProduction=id=>calls.push(['production',id]);
 const id="AE'\"<&";
 const add=(parent,key)=>{const button=d.createElement('button');button.dataset[key]=id;const child=d.createElement('span');child.textContent='Abrir';button.append(child);parent.replaceChildren(button);child.click()};
 add(d.querySelector('#pendingOrders'),'dashboardOrder');add(d.querySelector('#pendingOrders'),'dashboardOrder');
 const daily=d.createElement('div');daily.id='dashboardTodayList';d.querySelector('#dashboard').append(daily);
 add(daily,'dashboardOrder');add(daily,'dashboardProduction');
 assert.deepEqual(calls,[['detail',id],['detail',id],['daily',id],['production',id]]);dom.window.close();
});

test('o Planeamento só lê a Cloud e gera as rotinas quando se abre o módulo',async t=>{
 const dom=new JSDOM('<section id="dashboard" class="active"></section>',{runScripts:'outside-only'});
 const w=dom.window;
 t.after(()=>w.close());
 const records=new Map();
 const calls={sessions:0,editions:0};
 w.loadSpecialEditionsAdmin=async()=>{calls.editions++};
 w.cloudClient={
  auth:{async getSession(){calls.sessions++;return {data:{session:{user:{id:'teste'}}}}}},
  from(){
   return {
    select(){return this},eq(){return this},is(){return this},order(){return this},
    async limit(){return {data:[]}},
    async range(){return {data:[...records.values()]}},
    upsert(record){
     assert.ok(!records.has(record.record_id),'cada rotina ou ocorrência deve ser criada uma só vez');
     records.set(record.record_id,record);
     return {select:async()=>({data:[{record_id:record.record_id}]})};
    }
   };
  }
 };
 const manager=fs.readFileSync(require('node:path').resolve(__dirname,'../task-manager-v2.js'),'utf8');
 w.eval(manager);
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 await tick();
 const screen=w.document.getElementById('taskPlanning');
 assert.ok(screen);
 w.dispatchEvent(new w.Event('focus'));
 await tick();
 assert.deepEqual(calls,{sessions:0,editions:0});
 assert.equal(records.size,0);
 screen.classList.add('active');
 await tick();
 assert.deepEqual(calls,{sessions:1,editions:1});
 assert.equal([...records.values()].filter(r=>r.data.kind==='recurring_rule').length,2);
 assert.equal([...records.values()].filter(r=>r.data.origin_rule_id).length,2);
 screen.classList.remove('active');
 await tick();
 screen.classList.add('active');
 await tick();
 assert.deepEqual(calls,{sessions:1,editions:1});
 assert.equal(records.size,4);
});
