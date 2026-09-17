(() => {
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = value => new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const status = offer => !offer.enabled ? 'Disattivata' : offer.start > day() ? 'Programmata' : offer.end < day() ? 'Scaduta' : 'In corso';
  function card(offer) {
    const article = node('article', undefined, 'offer-card');
    if (offer.image) { const image = node('img'); image.src = offer.image; image.alt = offer.title; image.loading = 'lazy'; image.className = 'offer-photo'; article.append(image); }
    const content = node('div', undefined, 'offer-copy');
    content.append(node('span', 'DA ANDREA CON PIÙ GUSTO', 'offer-eyebrow'), node('h3', offer.title));
    if (offer.description) content.append(node('p', offer.description, 'offer-description'));
    if (offer.price !== null && offer.price !== undefined) content.append(node('strong', new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(offer.price), 'offer-price'));
    content.append(node('p', `${offer.start > day() ? `Dal ${date(offer.start)} · ` : ''}Fino al ${date(offer.end)}`, 'offer-expiry'));
    article.append(content); return article;
  }
  window.Offers = { node, day, date, status, card };
  const section = document.querySelector('#offers');
  if (!section) return;
  let latest = [], shown = false, signature = '';
  const popup = document.querySelector('#offer-popup-dialog');
  const seen = key => { try { return sessionStorage.getItem(key) === '1'; } catch { return shown; } };
  function render(offers) {
    latest = offers;
    const active = offers.filter(offer => status(offer) === 'In corso');
    const next = JSON.stringify(active);
    if (next !== signature) {
      signature = next;
      document.querySelector('#offers-grid').replaceChildren(...active.map(card));
    }
    section.hidden = !active.length;
    document.querySelector('#offers-link').hidden = !active.length;
    if (popup.open && !active.some(offer => offer.id === popup.dataset.offer)) popup.close();
    const featured = active.find(offer => offer.popup);
    if (!featured || shown || document.querySelector('dialog[open]')) return;
    const key = `andrea-offer-${featured.id}-${featured.start}-${featured.end}`;
    if (seen(key)) return;
    document.querySelector('#offer-popup-content').replaceChildren(card(featured));
    popup.dataset.offer = featured.id;
    popup.showModal(); shown = true;
    try { sessionStorage.setItem(key, '1'); } catch { /* In-memory fallback for blocked storage. */ }
  }
  document.querySelector('#close-offer-popup').addEventListener('click', () => popup.close());
  document.querySelector('#view-offers').addEventListener('click', () => { popup.close(); section.scrollIntoView({ behavior: 'smooth' }); });
  window.addEventListener('offers-loaded', event => render(event.detail));
  async function refresh() {
    if (document.hidden || location.protocol === 'file:') return;
    render(latest);
    try {
      const response = await fetch('/api/menu', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Unavailable');
      render((await response.json()).offers || []);
    } catch { render([]); }
  }
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
