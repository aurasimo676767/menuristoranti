const { randomUUID } = require('node:crypto');
const seed = require('../menu-data.js');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const key = suffix => `${process.env.MENU_STORE_PREFIX || 'andrea-menu'}:${suffix}`;
function storageConfig() {
  // Keep URL/token pairs together; the Vercel integration may use KV_* names.
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  }
  return null;
}
const configured = () => Boolean(storageConfig());
async function redis(...command) {
  const config = storageConfig();
  if (!config) throw new HttpError(503, 'Archivio non ancora collegato. Completa la configurazione su Vercel.');
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error('Storage error');
    return data.result;
  } catch { throw new HttpError(503, 'Archivio momentaneamente non disponibile. Riprova senza chiudere la pagina.'); }
}
function cleanText(value, label, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new HttpError(400, `${label}: valore non valido (massimo ${max} caratteri).`);
  }
  return value.trim();
}
function validateMenu(input) {
  if (!input || !Array.isArray(input.categories) || !input.categories.length || input.categories.length > 60) {
    throw new HttpError(400, 'Il menu deve contenere da 1 a 60 categorie.');
  }
  const categoryIds = new Set(), dishIds = new Set();
  const id = (value, seen) => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value) || seen.has(value)) throw new HttpError(400, 'Identificativo mancante o duplicato.');
    seen.add(value); return value;
  };
  const categories = input.categories.map(category => {
    if (!category || !Array.isArray(category.dishes) || category.dishes.length > 500) throw new HttpError(400, 'Categoria non valida.');
    return {
      id: id(category.id, categoryIds),
      name: cleanText(category.name, 'Nome categoria', 100, true),
      title: cleanText(category.title ?? category.name, 'Titolo categoria', 100, true),
      subtitle: cleanText(category.subtitle ?? '', 'Descrizione categoria', 500),
      supplements: category.supplements === undefined ? ['panini', 'piadine', 'ufficiali', 'crepes', 'wrap'].includes(category.id) : category.supplements === true,
      dishes: category.dishes.map(dish => {
        if (!dish || typeof dish.price !== 'number' || !Number.isFinite(dish.price) || dish.price < 0 || dish.price > 10000 || Math.abs(dish.price * 100 - Math.round(dish.price * 100)) > 0.00001) {
          throw new HttpError(400, 'Il prezzo deve essere tra 0 e 10.000 €, con massimo due decimali.');
        }
        return {
          id: id(dish.id, dishIds), name: cleanText(dish.name, 'Nome piatto', 150, true), price: dish.price,
          description: cleanText(dish.description ?? '', 'Ingredienti', 3000),
          variant: cleanText(dish.variant ?? '', 'Variante', 150),
          available: dish.available !== false,
          sourceName: cleanText(dish.sourceName ?? '', 'Nome originale', 300),
          sourceDescription: cleanText(dish.sourceDescription ?? '', 'Descrizione originale', 5000)
        };
      })
    };
  });
  if (dishIds.size > 2000) throw new HttpError(400, 'Il menu può contenere al massimo 2.000 piatti.');
  return { currency: 'EUR', categories };
}
const initial = () => ({ revision: 0, draft: validateMenu(seed), published: validateMenu(seed), publishedAt: null, savedAt: null });
async function readState() {
  const raw = await redis('GET', key('state'));
  return raw ? JSON.parse(raw) : initial();
}
// The revision comparison, backup and write happen atomically, including first publication.
const COMMIT = `
local current = redis.call('GET', KEYS[1])
local revision = 0
if current then revision = cjson.decode(current).revision end
if revision ~= tonumber(ARGV[1]) then return 0 end
if ARGV[3] ~= '' then
  redis.call('LPUSH', KEYS[2], ARGV[3])
  redis.call('LTRIM', KEYS[2], 0, 19)
end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;
async function commit(state, expected, backup) {
  if (!Number.isSafeInteger(expected) || state.revision !== expected) throw new HttpError(409, 'Il menu è cambiato in un’altra sessione. Esporta le tue modifiche e ricarica prima di continuare.');
  const next = { ...state, revision: expected + 1 };
  const ok = await redis('EVAL', COMMIT, 2, key('state'), key('history'), expected, JSON.stringify(next), backup ? JSON.stringify(backup) : '');
  if (ok !== 1) throw new HttpError(409, 'Il menu è cambiato in un’altra sessione. Esporta le tue modifiche e ricarica prima di continuare.');
  return next;
}
async function mutate(action, body) {
  const state = await readState();
  if (action === 'restore') {
    const history = await readHistory();
    const version = history.find(item => item.id === body.id);
    if (!version) throw new HttpError(404, 'Versione non più disponibile.');
    state.draft = validateMenu(version.menu);
  } else state.draft = validateMenu(body.menu);
  state.savedAt = new Date().toISOString();
  let backup;
  if (action === 'publish') {
    backup = { id: randomUUID(), publishedAt: state.publishedAt, archivedAt: state.savedAt, menu: state.published };
    state.published = state.draft;
    state.publishedAt = state.savedAt;
  }
  return commit(state, body.revision, backup);
}
async function readHistory() { return (await redis('LRANGE', key('history'), 0, 19)).map(value => JSON.parse(value)); }
module.exports = { HttpError, redis, key, configured, validateMenu, initial, readState, readHistory, mutate, COMMIT };
