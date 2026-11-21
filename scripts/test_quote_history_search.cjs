'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 800, 1280, 1440]) {
      const page = await browser.newPage({viewport: {width, height: width === 800 ? 1280 : 900}, reducedMotion: 'reduce', serviceWorkers: 'block'});
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://app.test' || url.pathname.startsWith('/api/')) return route.abort();
        return route.fulfill({path: path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname)});
      });
      await page.goto('http://app.test/');
      await page.evaluate(() => {
        document.getElementById('authGateV1880')?.remove();
        finishAppUnlockV19135();
        db.packaging = [{name:'Kraft', cost:2}];
        db.quotes = Array.from({length: 10}, (_, i) => ({
          id: 'Q-' + i, client: i ? 'Teste ' + i : 'Inês Simões',
          contact: i ? '' : '+351 912 345 678', email: i ? '' : 'ines@example.test',
          eventDate: '2027-01-12', validUntil:'2027-01-10', status: i ? 'Rascunho' : 'Aceite',
          items: [{type:'free', code:'FREE', name:'Peça de ensaio', qty:2, price:12, cost:3}],
          discount:4, box:'', boxes:0, boxCostSnapshot:0
        }));
        go('quotes');
        renderQuotes();
      });
      const search = page.getByRole('searchbox', {name: 'Pesquisar orçamentos'});
      const counter = page.locator('#quotes .qh-counter-1965');
      const visible = page.locator('#quotesBody tr:visible');
      await search.fill('Q-');
      await page.locator('#quotes .qh-nav-1965').getByText('Seguinte').click();
      assert.equal(await visible.count(), 2);
      const original = await page.evaluate(() => JSON.stringify(db.quotes));
      await visible.last().getByRole('button', {name: 'Editar', exact: true}).click();
      const heading = page.getByRole('heading', {name: 'Editar orçamento Q-0', exact: true});
      await heading.waitFor();
      assert.ok(await heading.evaluate(el => el === document.activeElement));
      await page.waitForFunction(() => {
        const top = document.getElementById('quoteEditorTitle').getBoundingClientRect().top;
        return top >= 0 && top < innerHeight / 2;
      });
      assert.equal(await page.locator('#quoteClient').inputValue(), 'Inês Simões');
      assert.equal(await search.inputValue(), 'Q-');
      assert.equal(await visible.count(), 2);
      await page.evaluate(() => clearQuoteForm());
      assert.equal(await page.locator('#quoteEditorTitle').textContent(), 'Criar orçamento');
      assert.equal(await page.evaluate(() => JSON.stringify(db.quotes)), original);
      // Reabrir e guardar apenas uma nota, incluindo o formato antigo de desconto.
      await visible.last().getByRole('button', {name:'Editar', exact:true}).click();
      await page.locator('#quoteNotes').fill('Confirmar entrega');
      await page.locator('#quoteSaveBtnV1279').click();
      const readSaved = () => page.evaluate(() => {
        const quotes = JSON.parse(localStorage.getItem(KEY)).quotes;
        const q = quotes.find(item => item.id === 'Q-0');
        return [quotes.length, q.notes, q.box, q.boxes, q.boxCostSnapshot, quoteCalc(q).total, q.items];
      });
      const items = JSON.parse(original)[0].items;
      assert.deepEqual(await readSaved(), [10,'Confirmar entrega','',0,0,20,items]);
      await visible.last().getByRole('button', {name:'Editar', exact:true}).click();
      assert.equal(await page.locator('#quoteNotes').inputValue(), 'Confirmar entrega');
      await page.evaluate(() => clearQuoteForm());
      await page.evaluate(() => {
        const q = db.quotes.find(item => item.id === 'Q-0');
        Object.assign(q, {box:'Caixa antiga', boxes:3, boxCostSnapshot:0.75});
      });
      const edit = visible.last().getByRole('button', {name:'Editar', exact:true});
      await edit.click();
      assert.equal(await page.locator('#quoteBox').inputValue(), 'Caixa antiga');
      await page.locator('#quoteSaveBtnV1279').click();
      assert.deepEqual(await readSaved(), [10,'Confirmar entrega','Caixa antiga',3,0.75,20,items]);
      await edit.click();
      await page.locator('#quoteBox').selectOption('Kraft');
      await page.locator('#quoteSaveBtnV1279').click();
      assert.deepEqual(await readSaved(), [10,'Confirmar entrega','Kraft',3,2,20,items]);
      for (const term of ['ines simoes', '912345678', '912-345-678', 'INES@EXAMPLE.TEST', 'Q-0']) {
        await search.fill(term);
        assert.equal(await visible.count(), 1);
        assert.equal(await visible.locator('td').first().textContent(), 'Q-0');
        assert.match(await counter.textContent(), /1–1 de 1 orçamento$/);
      }
      await page.getByLabel('Filtrar estado').selectOption('Rascunho');
      assert.equal(await visible.count(), 0);
      assert.match(await counter.textContent(), /Sem orçamentos para estes filtros/);
      await search.fill('');
      await page.getByLabel('Filtrar estado').selectOption('');
      await page.evaluate(() => { db.quotes = []; renderQuotes(); });
      await page.waitForFunction(() => document.querySelector('#quotes .qh-counter-1965').textContent === '');
      assert.equal(await visible.innerText(), 'Sem orçamentos');
      if (width === 800) {
        page.on('dialog', dialog => dialog.accept());
        const converted = await page.evaluate(async () => {
          const quote = {
            id:'Q-CONVERTER', status:'Aceite', client:'Cliente de teste', eventDate:'2027-02-01',
            items:[{type:'free',name:'Vela',qty:2,price:12,cost:3}], discount:4,
            depositPaid:10, paymentTerms:'50_50', depositPct:50, box:'', boxes:0,
            paymentHistory:[{id:'P-SINAL', amount:10, method:'MB Way'}]
          };
          db.quotes=[quote]; db.orders=[]; db.cash=[];
          addQuotePaymentCash(quote,quote.paymentHistory[0]);
          cloudUser={id:'local-test'};
          cloudClient={rpc:async (name,{p_quote,p_order})=>{
            assertRpcName(name);
            return {data:{order:{...p_order,_rid:'order-test'},quote:{...p_quote,orderId:p_order.id,status:'Convertido'},reused:false}};
          }};
          function assertRpcName(name){if(name!=='artessencia_convert_quote_once_v1')throw Error(name)}
          let release, calls=0;
          const gate=new Promise(resolve => { release=resolve; });
          nextManualOrderId=async () => { const number=++calls; await gate; return 'TEST-'+number; };
          const first=convertQuoteToOrder(quote.id);
          const second=convertQuoteToOrder(quote.id);
          release();
          await Promise.all([first,second]);
          await convertQuoteToOrder(quote.id);
          const order=db.orders[0];
          return [calls,db.orders.length,quote.orderId,order.sourceQuoteId,order.boxes,
            calcOrder(order).total,order.paid,db.cash.length,db.cash[0].value];
        });
        assert.deepEqual(converted,[1,1,'TEST-1','Q-CONVERTER',0,20,10,1,10]);
        const skipped = await page.evaluate(async () => {
          const previous=db.quotes[0];
          const q={...previous,id:'Q-ARTIGO',orderId:null,status:'Aceite',
            items:[...previous.items,{code:'REMOVIDO',name:'Artigo antigo',qty:1,price:9}],depositPaid:20};
          db.quotes.push(q);
          await convertQuoteToOrder(q.id);
          return [db.orders.length,db.cash.length,q.orderId,q.status];
        });
        assert.deepEqual(skipped,[1,1,null,'Aceite']);
      }
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
