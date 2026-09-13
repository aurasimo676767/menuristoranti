// Mobile launch checks over HTTP, including a slow connection and unavailable fonts.
const {chromium, devices} = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const {createServer} = require('./dev-server.cjs');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.argv[3] ? {executablePath:process.argv[3]} : {})});
    for (const name of ['iPhone 13', 'Pixel 7']) {
      const context = await browser.newContext({...devices[name], reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/menu', route => route.fulfill({json:{menu:null}}));
      await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
      const session = await context.newCDPSession(page);
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', {
        offline:false, latency:150, downloadThroughput:750 * 1024 / 8,
        uploadThroughput:250 * 1024 / 8, connectionType:'cellular3g'
      });
      const started = Date.now();
      await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil:'domcontentloaded', timeout:60000});
      await page.locator('.dish-card').first().waitFor({timeout:30000});
      const readyMs = Date.now() - started;
      assert.ok(readyMs < 30000, `Menu troppo lento: ${readyMs} ms`);
      assert.ok(await page.evaluate(width=>document.documentElement.scrollWidth<=width,devices[name].viewport.width),'Overflow con font di sistema');
      await page.locator('.dish-card').first().click();
      assert.equal(await page.locator('#dish-dialog').evaluate(el=>el.open),true);
      assert.ok(await page.locator('#dish-dialog').evaluate((el,width)=>el.getBoundingClientRect().right<=width,devices[name].viewport.width),'Dettagli fuori schermo');
      assert.ok((await page.locator('.supplement-note').innerText()).includes('si aggiungono'));
      try {
        await page.locator('.close-dialog').click({timeout:5000});
      } catch (error) {
        await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'andrea-launch-error.png')});
        console.log(await page.evaluate(()=>{
          const button = document.querySelector('.close-dialog');
          const rect = button.getBoundingClientRect();
          return {rect:rect.toJSON(), viewport:{width:innerWidth,height:innerHeight,offset:visualViewport.offsetTop,scale:visualViewport.scale}, hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.outerHTML.slice(0,200)};
        }));
        throw error;
      }
      await page.locator('#menu-search').fill('chianina');
      assert.ok(await page.locator('.dish-card').count()>0);
      await page.locator('#informazioni').scrollIntoViewIfNeeded();
      assert.ok((await page.locator('#informazioni').innerText()).includes('Via Adua 298'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${name} (emulazione Chromium): menu utilizzabile in ${readyMs} ms, 750 kbit/s, font esterni bloccati, ricerca e dettagli funzionanti.`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
