// HTTP test double for the Redis REST contract. Never used by production handlers.
const http = require('node:http');
const { COMMIT } = require('../server/menu-store');
const { RATE } = require('../server/admin-auth');
function createTestStore() {
  const values = new Map(), expiry = new Map(), lists = new Map();
  let offline = false;
  const get = key => { if (expiry.has(key) && expiry.get(key) <= Date.now()) { values.delete(key); expiry.delete(key); } return values.get(key) ?? null; };
  const server = http.createServer(async (req, res) => {
    if (offline) { res.writeHead(503); res.end('{}'); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    try {
      const [command, ...args] = JSON.parse(raw); let result;
      if (command === 'GET') result = get(args[0]);
      else if (command === 'SET') { values.set(args[0], args[1]); if (args[2] === 'EX') expiry.set(args[0], Date.now() + Number(args[3]) * 1000); result = 'OK'; }
      else if (command === 'LRANGE') result = (lists.get(args[0]) || []).slice(Number(args[1]), Number(args[2]) + 1);
      else if (command === 'EVAL' && args[0] === RATE) {
        const key = args[2]; result = Number(get(key) || 0) + 1; values.set(key, result); if (result === 1) expiry.set(key, Date.now() + 900000);
      } else if (command === 'EVAL' && args[0] === COMMIT) {
        const [, , key, historyKey, expected, next, backup] = args;
        const previous = get(key); const revision = previous ? JSON.parse(previous).revision : 0;
        if (revision !== expected) result = 0;
        else { if (backup) lists.set(historyKey, [backup, ...(lists.get(historyKey) || [])].slice(0, 20)); values.set(key, next); result = 1; }
      } else throw new Error('Unsupported test command');
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ result }));
    } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: error.message })); }
  });
  return { server, values, lists, setOffline(value) { offline = value; }, reset() { values.clear(); expiry.clear(); lists.clear(); offline = false; } };
}
async function startTestApp() {
  const { randomBytes, scryptSync } = require('node:crypto');
  const password = randomBytes(24).toString('hex'), salt = randomBytes(16).toString('hex');
  process.env.NODE_ENV = 'development'; delete process.env.VERCEL;
  process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  process.env.ADMIN_SESSION_SECRET = randomBytes(48).toString('hex');
  process.env.MENU_STORE_PREFIX = 'test-menu';
  const storage = createTestStore();
  await new Promise(resolve => storage.server.listen(0, '127.0.0.1', resolve));
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${storage.server.address().port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'local-test-token';
  const app = require('./dev-server.cjs').createServer();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.address().port}`;
  return { storage, app, origin, password, async close() { await Promise.all([new Promise(resolve => app.close(resolve)), new Promise(resolve => storage.server.close(resolve))]); } };
}
module.exports = { startTestApp };
