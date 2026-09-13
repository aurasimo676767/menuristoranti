const { configured, readState } = require('../server/menu-store');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Metodo non consentito.' }); }
  if (!configured()) return res.status(200).json({ menu: null });
  try {
    const state = await readState();
    const menu = { ...state.published, categories: state.published.categories.map(category => ({ ...category, dishes: category.dishes.filter(dish => dish.available !== false) })) };
    return res.status(200).json({ menu, publishedAt: state.publishedAt });
  } catch { return res.status(503).json({ error: 'Menu momentaneamente non disponibile.' }); }
};
