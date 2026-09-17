// node scripts/check-offers-browser.cjs [playwright module] [chromium executable]
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { startTestApp } = require('./test-store.cjs');
(async () => {
  const fixture = await startTestApp();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${fixture.origin}/admin/offerte`);
    await page.locator('#password').fill(fixture.password);
    await page.locator('#login-form button').click();
    await page.locator('#editor').waitFor({ state: 'visible' });
    await page.locator('#add-offer').click();
    await page.locator('#offer-title').fill('Combo della settimana');
    await page.locator('#offer-description').fill('Panino, patatine e bibita. Valida tutti i giorni.');
    await page.locator('#offer-price').fill('9.90');
    await page.locator('#offer-image').setInputFiles(path.resolve(__dirname, '../assets/andrea-bbq-banner.png'));
    await page.waitForFunction(() => document.querySelector('#form-status').textContent === 'Foto pronta.');
    assert.match(await page.locator('#image-preview').getAttribute('src'), /^data:image\/jpeg;base64,/);
    await page.locator('#offer-form button[type=submit]').click();
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Bozza salvata'));
    const customer = await context.newPage(); customer.on('pageerror', error => errors.push(error.message));
    await customer.goto(fixture.origin); await customer.locator('.dish-card').first().waitFor();
    assert.equal(await customer.locator('#offers-fab').isVisible(), false);
    await page.reload(); await page.locator('#editor').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.admin-offer-row h3').innerText(), 'Combo della settimana');
    await page.locator('#preview').click(); await page.locator('#preview-content .offer-card').waitFor();
    assert.match(await page.locator('#preview-content').innerText(), /9,90/);
    await page.keyboard.press('Escape');
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Offerte pubblicate'));
    await customer.reload(); await customer.locator('#offer-popup-dialog[open]').waitFor();
    assert.match(await customer.locator('#offer-popup-title').innerText(), /1 offerta per te/);
    assert.equal(await customer.locator('.offer-card').count(), 0);
    await customer.evaluate(async () => {
      const { offers } = await (await fetch('/api/menu')).json();
      window.dispatchEvent(new CustomEvent('offers-loaded', { detail: [offers[0], { ...offers[0], id: 'second-offer' }] }));
    });
    assert.match(await customer.locator('#offer-popup-title').innerText(), /2 offerte per te/);
    assert.equal(await customer.locator('#offers-fab-count').innerText(), '2');
    await customer.locator('#close-offer-popup').click();
    await customer.reload(); await customer.locator('#offers-fab').waitFor();
    assert.equal(await customer.locator('#offer-popup-dialog').isVisible(), false);
    await customer.locator('#offers-fab').click();
    await customer.locator('#offers-grid .offer-card').waitFor();
    assert.equal(new URL(customer.url()).pathname, '/offerte');
    assert.equal(await customer.locator('#offers-grid .offer-card').count(), 1);
    await customer.evaluate(async () => {
      const { offers } = await (await fetch('/api/menu')).json();
      window.dispatchEvent(new CustomEvent('offers-loaded', { detail: [offers[0], { ...offers[0], id: 'second-offer' }] }));
    });
    assert.equal(await customer.locator('#offers-grid .offer-card').count(), 2);
    const screenshots = path.resolve(__dirname, '../test-results'); fs.mkdirSync(screenshots, { recursive: true });
    for (const width of [360, 390, 768, 1440]) {
      for (const target of [page, customer]) {
        await target.setViewportSize({ width, height: 900 });
        assert.ok(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
      }
      if ([390, 1440].includes(width)) {
        await page.screenshot({ path: path.join(screenshots, `offers-admin-${width}.png`), fullPage: true });
        await customer.screenshot({ path: path.join(screenshots, `offers-public-${width}.png`) });
      }
    }
    await page.getByRole('button', { name: 'Duplica', exact: true }).click();
    assert.equal(await page.locator('#offer-enabled').isChecked(), false);
    await page.locator('#offer-title').fill('<img src=x onerror=alert(1)>');
    await page.locator('#offer-start').fill('2099-01-01'); await page.locator('[data-duration=week]').click();
    assert.equal(await page.locator('#offer-end').inputValue(), '2099-01-07');
    await page.locator('#offer-enabled').check();
    await page.locator('#offer-form button[type=submit]').click();
    assert.equal(await page.locator('.admin-offer-row h3 img').count(), 0);
    assert.equal(await page.locator('.admin-offer-row').count(), 2);
    await page.getByRole('button', { name: 'Disattiva', exact: true }).first().click();
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Offerte pubblicate'));
    await customer.goto(fixture.origin); await customer.locator('.dish-card').first().waitFor();
    assert.equal(await customer.locator('#offers-fab').isVisible(), false);
    await page.getByRole('button', { name: 'Modifica', exact: true }).first().click();
    await page.locator('#offer-title').fill('Lavoro conservato'); await page.locator('#offer-form button[type=submit]').click();
    await context.clearCookies(); await page.locator('#save').click(); await page.locator('#login-panel').waitFor({ state: 'visible' });
    await page.locator('#password').fill(fixture.password); await page.locator('#login-form button').click();
    await page.locator('#editor').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.admin-offer-row h3').first().innerText(), 'Lavoro conservato');
    await page.locator('#save').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Bozza salvata'));
    assert.deepEqual(errors, []);
    console.log('PASS: offers login, photo compression, draft, preview, publication, scheduling, popup once per session, duplication, disabling, session recovery and responsive layout.');
  } finally { if (browser) await browser.close(); await fixture.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
