// node scripts/check-admin-browser.cjs [playwright module] [chromium executable]
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
    const screenshots = path.resolve(__dirname, '../test-results'); fs.mkdirSync(screenshots, { recursive: true });
    await page.goto(`${fixture.origin}/admin`);
    await page.locator('#password').fill('wrong-password');
    await page.locator('#login-form button[type=submit]').click();
    await page.getByText('Password errata.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(screenshots, 'admin-login-mobile.png') });
    await page.locator('#password').fill(fixture.password);
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('#editor').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#publish').disabled);
    assert.equal(await page.locator('.category-row').count(), 15);
    await page.locator('#add-category').click();
    await page.locator('#category-name').fill('Speciali del giorno');
    await page.locator('#category-subtitle').fill('Direttamente dalla cucina');
    await page.locator('#category-form button[type=submit]').click();
    await page.locator('#add-dish').click();
    await page.locator('#dish-name').fill('Panino di prova');
    await page.locator('#dish-price').fill('12.50');
    await page.locator('#dish-description').fill('Hamburger, cheddar e cipolla');
    await page.locator('#dish-form button[type=submit]').click();
    assert.equal(await page.locator('.dish-row').count(), 1);
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Bozza salvata'));
    const customer = await context.newPage();
    await customer.goto(fixture.origin);
    await customer.waitForFunction(() => typeof selectCategory === 'function');
    assert.equal(await customer.locator('#categories').getByText('Speciali del giorno', { exact: true }).count(), 0);
    await page.reload(); await page.locator('#editor').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#publish').disabled);
    await page.locator('.category-row > button').filter({ hasText: 'Speciali del giorno' }).click();
    assert.equal(await page.locator('.dish-row h3').innerText(), 'Panino di prova');
    await page.locator('#preview').click();
    assert.ok((await page.locator('#preview-content').innerText()).includes('Panino di prova'));
    await page.keyboard.press('Escape');
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Menu pubblicato'));
    await customer.reload(); await customer.waitForFunction(() => typeof selectCategory === 'function');
    await customer.locator('#menu-search').fill('Panino di prova');
    assert.equal(await customer.locator('.dish-card').count(), 1);
    assert.ok((await customer.locator('.dish-price').innerText()).includes('12,50'));
    // Text is inserted safely, and hiding a dish removes it from search too.
    await page.getByRole('button', { name: 'Modifica Panino di prova', exact: true }).click();
    await page.locator('#dish-name').fill('<img src=x onerror=alert(1)>');
    await page.locator('#dish-available').uncheck();
    await page.locator('#dish-form button[type=submit]').click();
    assert.equal(await page.locator('.dish-row img').count(), 0);
    await page.locator('#publish').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Menu pubblicato'));
    await customer.reload(); await customer.waitForFunction(() => typeof selectCategory === 'function');
    await customer.locator('#menu-search').fill('onerror'); assert.equal(await customer.locator('.dish-card').count(), 0);
    await page.waitForFunction(() => !document.querySelector('#publish').disabled);
    // Restore into draft only.
    await page.locator('.history-row button').first().click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Versione recuperata'));
    await page.locator('.category-row > button').filter({ hasText: 'Speciali del giorno' }).click();
    assert.equal(await page.locator('.dish-row h3').innerText(), 'Panino di prova');
    // Session expiry keeps local work; signing in again keeps it reviewable.
    await page.getByRole('button', { name: 'Modifica Panino di prova', exact: true }).click();
    await page.locator('#dish-price').fill('14'); await page.locator('#dish-form button[type=submit]').click();
    await context.clearCookies(); await page.locator('#save').click();
    await page.locator('#login-panel').waitFor({ state: 'visible' });
    await page.locator('#password').fill(fixture.password); await page.locator('#login-form button[type=submit]').click();
    await page.locator('#editor').waitFor({ state: 'visible' });
    assert.ok((await page.locator('.dish-row .price').innerText()).includes('14,00'));
    await page.waitForFunction(() => !document.querySelector('#publish').disabled);
    // Concurrent editor gets a conflict instead of overwriting.
    const second = await context.newPage(); second.on('dialog', dialog => dialog.accept());
    await second.goto(`${fixture.origin}/admin`); await second.locator('#editor').waitFor({ state: 'visible' });
    await second.waitForFunction(() => !document.querySelector('#publish').disabled);
    await page.locator('#save').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Bozza salvata'));
    await second.locator('#publish').click(); await second.waitForFunction(() => document.querySelector('#status').textContent.includes('altra sessione'));
    await second.close();
    // CRUD deletion works, including originally featured categories.
    await page.getByRole('button', { name: 'Modifica Panino di prova', exact: true }).click();
    await page.locator('#delete-dish').click(); assert.equal(await page.locator('.dish-row').count(), 0);
    await page.locator('#edit-category').click(); await page.locator('#delete-category').click();
    assert.equal(await page.locator('.category-row').count(), 15);
    await page.locator('.category-row > button').filter({ hasText: /^Panini53 piatti$/ }).click();
    await page.locator('#edit-category').click(); await page.locator('#delete-category').click();
    await page.locator('#publish').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Menu pubblicato'));
    await customer.reload(); await customer.waitForFunction(() => typeof selectCategory === 'function');
    assert.equal(await customer.locator('#quick-categories [data-category="panini"]').count(), 0);
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Admin overflow ${width}`);
      assert.ok(await page.locator('#active-category').evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), `Category heading clipped at ${width}`);
      assert.ok(await page.locator('.dish-row h3').first().evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), `Dish name clipped at ${width}`);
      if (width === 390 || width === 1366) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(screenshots, `admin-${width}.png`) }); }
    }
    fixture.storage.setOffline(true);
    await customer.reload(); await customer.getByText('Menu momentaneamente non disponibile', { exact: true }).waitFor();
    assert.equal(await customer.locator('.dish-card').count(), 0);
    fixture.storage.setOffline(false);
    await page.locator('#logout').click(); await page.locator('#login-panel').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    console.log('PASS admin browser: login, CRUD, bozze persistenti, pubblicazione, disponibilità, storico, sessione scaduta, conflitti, testo sicuro e layout 320/390/768/1366 px.');
  } finally { if (browser) await browser.close(); await fixture.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
