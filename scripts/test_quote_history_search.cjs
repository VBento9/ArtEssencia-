'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 800, 1280, 1440]) {
      const page = await browser.newPage({viewport: {width, height: width === 800 ? 1280 : 900}, serviceWorkers: 'block'});
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://app.test' || url.pathname.startsWith('/api/')) return route.abort();
        return route.fulfill({path: path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname)});
      });
      await page.goto('http://app.test/');
      await page.evaluate(() => {
        document.getElementById('authGateV1880')?.remove();
        finishAppUnlockV19135();
        db.quotes = Array.from({length: 10}, (_, i) => ({
          id: 'Q-' + i, client: i ? 'Teste ' + i : 'Inês Simões',
          contact: i ? '' : '+351 912 345 678', email: i ? '' : 'ines@example.test',
          eventDate: '2027-01-12', status: i ? 'Rascunho' : 'Aceite', items: []
        }));
        go('quotes');
        renderQuotes();
      });
      const search = page.getByRole('searchbox', {name: 'Pesquisar orçamentos'});
      const counter = page.locator('#quotes .qh-counter-1965');
      const visible = page.locator('#quotesBody tr:visible');
      await page.locator('#quotes .qh-nav-1965').getByText('Seguinte').click();
      assert.equal(await visible.count(), 2);
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
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
