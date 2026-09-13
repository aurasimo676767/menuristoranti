const { HttpError, readState, readHistory, mutate } = require('../server/menu-store');
const { requireSession, checkOrigin, login, logout } = require('../server/admin-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Metodo non consentito.'); }
    if (req.method === 'GET') {
      const user = await requireSession(req);
      const action = req.query?.action || new URL(req.url, 'http://local').searchParams.get('action');
      if (action === 'history') return res.status(200).json({ history: (await readHistory()).map(({ menu, ...entry }) => entry) });
      return res.status(200).json({ state: await readState(), csrf: user.nonce });
    }
    checkOrigin(req);
    if (Number(req.headers['content-length']) > 1500000) throw new HttpError(413, 'Menu troppo grande.');
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Dati non validi.'); } }
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Dati mancanti.');
    if (Buffer.byteLength(JSON.stringify(body)) > 1500000) throw new HttpError(413, 'Menu troppo grande.');
    if (body.action === 'login') {
      const user = await login(req, res, body.password);
      return res.status(200).json({ csrf: user.nonce });
    }
    const user = await requireSession(req);
    if (req.headers['x-csrf-token'] !== user.nonce) throw new HttpError(403, 'Sessione non valida. Ricarica la pagina.');
    if (body.action === 'logout') { await logout(req, res); return res.status(200).json({ ok: true }); }
    if (!['save', 'publish', 'restore'].includes(body.action)) throw new HttpError(400, 'Operazione sconosciuta.');
    return res.status(200).json({ state: await mutate(body.action, body) });
  } catch (error) {
    res.status(error instanceof HttpError ? error.status : 500).json({ error: error instanceof HttpError ? error.message : 'Operazione non riuscita. Riprova senza chiudere la pagina.' });
  }
};
