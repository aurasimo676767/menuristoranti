const { HttpError, redis, key, COMMIT } = require('./menu-store');

function validateOffers(input) {
  if (!Array.isArray(input) || input.length > 12) throw new HttpError(400, 'Puoi conservare al massimo 12 offerte.');
  const ids = new Set();
  const text = (value, max, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, 'Titolo o descrizione offerta non validi.');
    return value.trim();
  };
  const date = value => {
    if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Date offerta non valide.');
    return value;
  };
  const offers = input.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || ids.has(item.id)) throw new HttpError(400, 'Identificativo offerta non valido o duplicato.');
    ids.add(item.id);
    const start = date(item.start), end = date(item.end);
    if (end < start) throw new HttpError(400, 'La scadenza deve essere uguale o successiva alla data di inizio.');
    const price = item.price ?? null;
    if (price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001)) throw new HttpError(400, 'Prezzo offerta non valido.');
    const image = item.image ?? '';
    if (typeof image !== 'string' || image.length > 130000 || (image && !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image))) throw new HttpError(400, 'Foto non valida o troppo grande. Caricala nuovamente.');
    return { id: item.id, title: text(item.title, 100, true), description: text(item.description ?? '', 1000), start, end, price, image, enabled: item.enabled !== false, popup: item.popup === true };
  });
  if (Buffer.byteLength(JSON.stringify(offers)) > 1200000) throw new HttpError(400, 'Le offerte occupano troppo spazio. Rimuovi alcune foto o offerte scadute.');
  return offers;
}
function romeDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function activeOffers(offers, now = new Date()) {
  const day = romeDay(now);
  return offers.filter(offer => offer.enabled && offer.start <= day && offer.end >= day);
}
async function readOffers() {
  const raw = await redis('GET', key('offers-state'));
  return raw ? JSON.parse(raw) : { revision: 0, draft: [], published: [], publishedAt: null };
}
async function mutateOffers(action, body) {
  const state = await readOffers();
  if (!Number.isSafeInteger(body.revision) || body.revision !== state.revision) throw new HttpError(409, 'Le offerte sono cambiate in un’altra sessione. Scarica la bozza e ricarica dal server.');
  const draft = validateOffers(body.offers);
  const next = { ...state, draft, revision: state.revision + 1 };
  if (action === 'offers-publish') { next.published = draft; next.publishedAt = new Date().toISOString(); }
  const ok = await redis('EVAL', COMMIT, 2, key('offers-state'), key('offers-history'), state.revision, JSON.stringify(next), '');
  if (ok !== 1) throw new HttpError(409, 'Le offerte sono cambiate in un’altra sessione. Scarica la bozza e ricarica dal server.');
  return next;
}
module.exports = { validateOffers, activeOffers, readOffers, mutateOffers };
