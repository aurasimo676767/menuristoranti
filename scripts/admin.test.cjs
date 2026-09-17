const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./test-store.cjs');
const { validateMenu } = require('../server/menu-store');
const { validateOffers, activeOffers } = require('../server/offers-store');
let fixture;
before(async () => { fixture = await startTestApp(); });
after(async () => { await fixture.close(); });
beforeEach(() => fixture.storage.reset());
async function call(path = '/api/admin', body, headers = {}) {
  const response = await fetch(fixture.origin + path, { method: body ? 'POST' : 'GET', headers: { Origin: fixture.origin, 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function auth() {
  const result = await call('/api/admin', { action: 'login', password: fixture.password });
  assert.equal(result.status, 200);
  return { Cookie: result.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': result.body.csrf };
}
const smallMenu = () => ({ categories: [{ id: 'new-category', name: 'Nuovi piatti', dishes: [{ id: 'new-dish', name: 'Speciale', description: 'Ingredienti', price: 8.5 }, { id: 'hidden', name: 'Nascosto', price: 5, available: false }] }] });
const offer = (extra = {}) => ({ id: 'combo', title: 'Combo della settimana', description: 'Panino e bibita', price: 9.90, start: '2020-01-01', end: '2099-12-31', enabled: true, popup: false, image: '', ...extra });
test('offers route is available and protected with admin headers', async () => {
  for (const path of ['/admin/offerte', '/admin/offerte/', '/admin-offers.html']) {
    const response = await fetch(fixture.origin + path);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    // Upload compression decodes a local blob URL before producing a JPEG data URL.
    const policy = response.headers.get('content-security-policy');
    assert.match(policy, /img-src 'self' data: blob:(?:;|$)/);
    assert.match(policy, /script-src 'self';/);
    assert.match(await response.text(), /id="offer-form"/);
  }
  assert.equal((await call('/api/admin?action=offers')).status, 401);
  assert.equal((await call('/api/admin', { action: 'offers-publish', offers: [offer()], revision: 0 })).status, 401);
});
test('offers drafts are private; publication filters dates and leaves menu drafts untouched', async () => {
  const headers = await auth();
  await call('/api/admin', { action: 'save', menu: smallMenu(), revision: 0 }, headers);
  const menuBefore = (await call('/api/menu')).body.menu;
  const offers = [offer(), offer({ id: 'future', start: '2099-01-01' }), offer({ id: 'expired', end: '2021-01-01' }), offer({ id: 'disabled', enabled: false })];
  assert.equal((await call('/api/admin', { action: 'offers-save', offers, revision: 0 }, headers)).status, 200);
  assert.deepEqual((await call('/api/menu')).body.offers, []);
  assert.equal((await call('/api/admin', { action: 'offers-publish', offers, revision: 1 }, headers)).status, 200);
  const published = (await call('/api/menu')).body;
  assert.deepEqual(published.offers.map(item => item.id), ['combo']); assert.deepEqual(published.menu, menuBefore);
  assert.equal((await call('/api/admin', undefined, headers)).body.state.revision, 1);
  assert.equal((await call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 1 }, headers)).status, 200);
  assert.deepEqual((await call('/api/menu')).body.offers.map(item => item.id), ['combo']);
  assert.equal((await call('/api/admin', { action: 'offers-publish', offers: [], revision: 2 }, headers)).status, 200);
  assert.deepEqual((await call('/api/menu')).body.offers, []);
});
test('offers use Italian calendar days including DST and inclusive expiry', () => {
  const offers = [offer({ start: '2026-03-29', end: '2026-03-29' })];
  assert.equal(activeOffers(offers, new Date('2026-03-28T22:59:59Z')).length, 0);
  assert.equal(activeOffers(offers, new Date('2026-03-28T23:00:00Z')).length, 1);
  assert.equal(activeOffers(offers, new Date('2026-03-29T21:59:59Z')).length, 1);
  assert.equal(activeOffers(offers, new Date('2026-03-29T22:00:00Z')).length, 0);
});
test('invalid offers, image payloads and forged requests do not change state', async () => {
  const headers = await auth();
  for (const invalid of [null, [null], [offer(), offer()], [offer({ start: '2026-02-30' })], [offer({ start: '2026-10-10', end: '2026-10-09' })], [offer({ price: -1 })], [offer({ price: '9' })], [offer({ price: 1.001 })], [offer({ title: ' ' })], [offer({ image: 'data:image/svg+xml;base64,abc' })], [offer({ image: 'https://example.com/photo.jpg' })], Array.from({ length: 13 }, (_, i) => offer({ id: `offer-${i}` }))]) {
    assert.equal((await call('/api/admin', { action: 'offers-publish', offers: invalid, revision: 0 }, headers)).status, 400);
  }
  assert.throws(() => validateOffers([offer({ price: Infinity })]), /Prezzo/);
  assert.equal((await call('/api/admin', { action: 'offers-save', offers: [offer()], revision: 0 }, { ...headers, 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await call('/api/admin', { action: 'offers-save', offers: [offer()], revision: 0 }, { ...headers, Origin: 'https://example.com' })).status, 403);
  assert.equal((await call('/api/admin?action=offers', undefined, headers)).body.state.revision, 0);
});
test('concurrent offer edits detect conflicts', async () => {
  const headers = await auth();
  const results = await Promise.all(['offers-save', 'offers-publish'].map(action => call('/api/admin', { action, offers: [offer()], revision: 0 }, headers)));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
});
test('offer photo survives saving and publishing; aggregate image size is bounded', async () => {
  const headers = await auth();
  const image = 'data:image/jpeg;base64,/9j/AA==';
  assert.equal((await call('/api/admin', { action: 'offers-publish', offers: [offer({ image })], revision: 0 }, headers)).status, 200);
  assert.equal((await call('/api/menu')).body.offers[0].image, image);
  assert.equal((await call('/api/admin?action=offers', undefined, headers)).body.state.draft[0].image, image);
  assert.throws(() => validateOffers([offer({ image: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(130000) })]), /Foto/);
  const large = Array.from({ length: 12 }, (_, i) => offer({ id: `photo-${i}`, image: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(120000) }));
  assert.throws(() => validateOffers(large), /spazio/);
});
test('private endpoints deny anonymous reads, writes and history', async () => {
  for (const path of ['/api/admin', '/api/admin?action=history']) assert.equal((await call(path)).status, 401);
  assert.equal((await call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 0 })).status, 401);
  assert.equal(fixture.storage.values.size, 0);
});
test('login checks password; cookie is HttpOnly and production uses Secure host cookie', async () => {
  assert.equal((await call('/api/admin', { action: 'login', password: 'wrong' })).status, 401);
  const result = await call('/api/admin', { action: 'login', password: fixture.password });
  assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  process.env.NODE_ENV = 'production';
  try {
    const secure = await call('/api/admin', { action: 'login', password: fixture.password }, { Origin: fixture.origin.replace('http:', 'https:') });
    assert.equal(secure.status, 200); assert.match(secure.headers.get('set-cookie'), /^__Host-andrea_admin=.*; Secure$/);
  } finally { process.env.NODE_ENV = 'development'; }
});
test('same-origin and CSRF protections reject forged writes', async () => {
  const headers = await auth();
  assert.equal((await call('/api/admin', { action: 'save', menu: smallMenu(), revision: 0 }, { ...headers, Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await call('/api/admin', { action: 'save', menu: smallMenu(), revision: 0 }, { ...headers, 'X-CSRF-Token': 'fake' })).status, 403);
  assert.equal((await call('/api/admin', { action: 'login', password: fixture.password }, { 'Content-Type': 'text/plain' })).status, 415);
});
test('draft stays private, publication updates public data and excludes unavailable dishes', async () => {
  const headers = await auth();
  const initial = (await call('/api/menu')).body.menu;
  const saved = await call('/api/admin', { action: 'save', menu: smallMenu(), revision: 0 }, headers);
  assert.equal(saved.status, 200); assert.equal(saved.body.state.revision, 1);
  assert.deepEqual((await call('/api/menu')).body.menu, initial);
  assert.equal((await call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 1 }, headers)).status, 200);
  const publicResult = await call('/api/menu');
  assert.equal(publicResult.body.menu.categories.length, 1);
  assert.equal(publicResult.body.menu.categories[0].dishes.length, 1);
  assert.equal(publicResult.body.menu.categories[0].dishes[0].price, 8.5);
  assert.equal(publicResult.headers.get('cache-control'), 'no-store');
  assert.equal(publicResult.body.state, undefined);
});
test('simultaneous updates cannot overwrite each other', async () => {
  const headers = await auth();
  const results = await Promise.all([call('/api/admin', { action: 'save', menu: smallMenu(), revision: 0 }, headers), call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 0 }, headers)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await call('/api/admin', undefined, headers)).body.state.revision, 1);
});
test('backup restores original menu into draft without publishing it', async () => {
  const headers = await auth();
  const initial = (await call('/api/admin', undefined, headers)).body.state.draft;
  await call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 0 }, headers);
  const history = (await call('/api/admin?action=history', undefined, headers)).body.history;
  assert.equal(history.length, 1); assert.equal(history[0].menu, undefined);
  const restored = await call('/api/admin', { action: 'restore', id: history[0].id, revision: 1 }, headers);
  assert.deepEqual(restored.body.state.draft, initial);
  assert.equal((await call('/api/menu')).body.menu.categories[0].id, 'new-category');
  assert.equal((await call('/api/admin', { action: 'restore', id: 'missing', revision: 2 }, headers)).status, 404);
});
test('invalid menus, duplicate IDs and invalid prices are rejected without changing stored state', async () => {
  const headers = await auth();
  for (const invalid of [null, { categories: [] }, { categories: [null] }]) assert.equal((await call('/api/admin', { action: 'save', menu: invalid, revision: 0 }, headers)).status, 400);
  for (const price of [-1, 1.111, '2', 10001]) {
    const menu = smallMenu(); menu.categories[0].dishes[0].price = price;
    assert.equal((await call('/api/admin', { action: 'publish', menu, revision: 0 }, headers)).status, 400);
  }
  const duplicate = smallMenu(); duplicate.categories[0].dishes[1].id = 'new-dish';
  assert.throws(() => validateMenu(duplicate), /duplicato/);
  assert.equal((await call('/api/admin', undefined, headers)).body.state.revision, 0);
});
test('logout revokes the session, including a replayed cookie', async () => {
  const headers = await auth();
  assert.equal((await call('/api/admin', { action: 'logout' }, headers)).status, 200);
  assert.equal((await call('/api/admin', undefined, headers)).status, 401);
});
test('password rotation and forged signatures invalidate sessions', async () => {
  const headers = await auth();
  assert.equal((await call('/api/admin', undefined, { ...headers, Cookie: headers.Cookie + 'x' })).status, 401);
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET += 'rotation';
  try { assert.equal((await call('/api/admin', undefined, headers)).status, 401); } finally { process.env.ADMIN_SESSION_SECRET = secret; }
});
test('login attempts are limited and spoofed forwarding headers do not bypass limit', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/admin', { action: 'login', password: 'wrong' }, { 'x-forwarded-for': `fake-${i}` })).status, 401);
  const blocked = await call('/api/admin', { action: 'login', password: fixture.password });
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('retry-after'), '900');
});
test('Vercel KV variable names support login and publication without renaming', async () => {
  const names = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
  process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const headers = await auth();
    assert.equal((await call('/api/admin', { action: 'publish', menu: smallMenu(), revision: 0 }, headers)).status, 200);
    assert.equal((await call('/api/menu')).body.menu.categories[0].id, 'new-category');
    // An incomplete alternative pair must not mix credentials from two databases.
    process.env.UPSTASH_REDIS_REST_URL = 'http://invalid.example';
    assert.equal((await call('/api/menu')).status, 200);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
test('missing configuration fails closed, outages do not return obsolete public prices', async () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try { assert.equal((await call('/api/admin')).status, 503); } finally { process.env.ADMIN_SESSION_SECRET = secret; }
  fixture.storage.setOffline(true);
  assert.equal((await call('/api/menu')).status, 503);
  assert.equal((await call('/api/admin', { action: 'login', password: fixture.password })).status, 503);
});
