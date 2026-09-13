const { randomBytes, createHash, createHmac, timingSafeEqual, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { HttpError, redis, key } = require('./menu-store');
const derive = promisify(scrypt);
const COOKIE = '__Host-andrea_admin';
const TTL = 8 * 60 * 60;
function authConfig() {
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) || secret.length < 32) throw new HttpError(503, 'Accesso amministratore non ancora configurato.');
  return { hash, secret };
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function sign(value) { const { hash, secret } = authConfig(); return createHmac('sha256', secret).update(`${hash}:${value}`).digest('base64url'); }
function cookieName() { return process.env.NODE_ENV === 'development' && !process.env.VERCEL ? 'andrea_admin_dev' : COOKIE; }
function setCookie(res, value, maxAge) {
  const secure = cookieName() === COOKIE ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName()}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}
function session(req) {
  authConfig();
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName()}=`))?.slice(cookieName().length + 1);
  if (!value || value.length > 1000) return null;
  const [payload, signature, extra] = value.split('.');
  if (extra || !signature || !equal(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Number.isFinite(data.exp) || data.exp < Date.now() || typeof data.nonce !== 'string' || !/^[a-f0-9]{48}$/.test(data.nonce)) return null;
    return data;
  } catch { return null; }
}
async function requireSession(req) {
  const data = session(req);
  if (!data || await redis('GET', key(`revoked:${data.nonce}`))) throw new HttpError(401, 'Sessione scaduta. Accedi di nuovo: le modifiche aperte restano nella pagina.');
  return data;
}
function checkOrigin(req) {
  const expected = process.env.ADMIN_ORIGIN || `${process.env.NODE_ENV === 'development' && !process.env.VERCEL ? 'http' : 'https'}://${req.headers.host}`;
  if (req.headers.origin !== expected || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) throw new HttpError(403, 'Richiesta non consentita. Ricarica la pagina.');
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Formato non consentito.');
}
const RATE = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end
return n`;
async function login(req, res, password) {
  const { hash } = authConfig();
  if (typeof password !== 'string' || password.length > 256) throw new HttpError(400, 'Password non valida.');
  // Vercel overwrites x-vercel-forwarded-for; never trust arbitrary forwarded headers.
  const ip = process.env.VERCEL ? (req.headers['x-vercel-forwarded-for'] || 'unknown') : (req.socket?.remoteAddress || 'local');
  const attempts = await redis('EVAL', RATE, 1, key(`login:${digest(ip)}`));
  if (attempts > 10) { res.setHeader('Retry-After', '900'); throw new HttpError(429, 'Troppi tentativi. Riprova tra 15 minuti.'); }
  const [, salt, expected] = hash.split(':');
  const actual = (await derive(password, salt, 64)).toString('hex');
  if (!equal(actual, expected)) throw new HttpError(401, 'Password errata.');
  const data = { exp: Date.now() + TTL * 1000, nonce: randomBytes(24).toString('hex') };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  setCookie(res, `${payload}.${sign(payload)}`, TTL);
  return data;
}
async function logout(req, res) {
  const data = session(req);
  if (data) await redis('SET', key(`revoked:${data.nonce}`), '1', 'EX', TTL);
  setCookie(res, '', 0);
}
module.exports = { session, requireSession, checkOrigin, login, logout, RATE };
