// node scripts/check-seo.cjs [https://panineriadaandrea.it]
const assert = require('node:assert/strict');
const {createServer} = require('./dev-server.cjs');
const canonical = 'https://panineriadaandrea.it/';

(async () => {
  let server;
  let origin = process.argv[2];
  if (!origin) {
    server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  try {
    const results = await Promise.all(['/', '/robots.txt', '/sitemap.xml', '/admin'].map(async path => {
      const response = await fetch(new URL(path, origin), {signal:AbortSignal.timeout(20000)});
      assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
      return {body:await response.text(), headers:response.headers};
    }));
    const [home, robots, sitemap, admin] = results;
    assert.ok(!/noindex/i.test(home.headers.get('x-robots-tag') || ''));
    assert.match(home.body, /<title>Panineria da Andrea a Vittoria/);
    assert.ok(home.body.includes(`<link rel="canonical" href="${canonical}">`));
    assert.ok(!/<meta[^>]+name="robots"[^>]+noindex/i.test(home.body));
    const business = JSON.parse(home.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find(item=>item['@type']==='Restaurant');
    assert.equal(business.url, canonical);
    assert.equal(business.address.streetAddress, 'Via Adua 298');
    assert.equal(business.address.addressLocality, 'Vittoria');
    assert.equal(business.menu, `${canonical}#menu`);
    assert.ok(home.body.includes(`href="tel:${business.telephone}"`));
    assert.ok(business.hasMap.includes('0x1311a4fe7cee8cc1:0x4a5eee47940d04'));
    const hours = business.openingHoursSpecification;
    const days = hours.flatMap(item=>[].concat(item.dayOfWeek));
    assert.equal(new Set(days).size, 7);
    assert.equal(days.length, 7);
    assert.equal(hours.find(item=>item.dayOfWeek==='Saturday').closes, '06:00');
    assert.ok(hours.every(item=>item.opens==='17:00'));
    assert.match(robots.headers.get('content-type'), /text\/plain/);
    assert.ok(robots.body.includes(`Sitemap: ${canonical}sitemap.xml`));
    assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots.body));
    assert.match(sitemap.headers.get('content-type'), /xml/);
    assert.deepEqual([...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]), [canonical]);
    assert.match(admin.headers.get('x-robots-tag'), /noindex/);
    console.log(`PASS SEO ${origin}: pagina indicizzabile, canonical, dati Restaurant e orari, robots.txt, sitemap e admin escluso dall'indice.`);
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
