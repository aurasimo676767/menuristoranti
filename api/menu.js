const { configured, readState } = require('../server/menu-store');
const { readOffers, activeOffers } = require('../server/offers-store');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Metodo non consentito.' }); }
  if (!configured()) return res.status(200).json({ menu: null });
  try {
    // Promotions load independently; their outage must not hide the menu.
    const [state, offerState] = await Promise.all([readState(), readOffers().catch(() => null)]);
    const menu = { ...state.published, categories: state.published.categories.map(category => ({ ...category, dishes: category.dishes.filter(dish => dish.available !== false) })) };
    const offers = offerState ? activeOffers(offerState.published) : [];
    return res.status(200).json({ menu, offers, publishedAt: state.publishedAt });
  } catch { return res.status(503).json({ error: 'Menu momentaneamente non disponibile.' }); }
};
