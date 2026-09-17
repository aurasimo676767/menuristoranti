(() => {
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = value => new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const status = offer => !offer.enabled ? 'Disattivata' : offer.start > day() ? 'Programmata' : offer.end < day() ? 'Scaduta' : 'In corso';
  // Find midnight after the final day in Rome, independently of the visitor's timezone.
  function deadline(end) {
    const target = Date.parse(`${end}T00:00:00Z`) + 86400000;
    let instant = target;
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
      const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      instant += target - local;
    }
    return instant;
  }
  function updateTimer(timer, now = Date.now()) {
    const seconds = Math.max(0, Math.ceil((Number(timer.dataset.deadline) - now) / 1000));
    const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    timer.querySelector('.offer-countdown-label').textContent = !seconds ? 'OFFERTA TERMINATA' : seconds < 3600 ? 'ULTIMI MINUTI. APPROFITTANE!' : seconds < 86400 ? 'ULTIME ORE. NON PERDERTELA!' : 'IL TEMPO STRINGE. APPROFITTANE!';
    timer.classList.toggle('is-urgent', seconds > 0 && seconds < 3600);
    timer.querySelectorAll('.offer-countdown-value').forEach((part, index) => { part.textContent = String(values[index]).padStart(2, '0'); });
  }
  function countdown(offer) {
    const timer = node('div', undefined, 'offer-countdown');
    timer.dataset.deadline = deadline(offer.end);
    timer.setAttribute('role', 'timer'); timer.setAttribute('aria-live', 'off');
    timer.append(node('span', undefined, 'offer-countdown-label'));
    const digits = node('div', undefined, 'offer-countdown-digits');
    for (const label of ['GIORNI', 'ORE', 'MIN', 'SEC']) {
      const unit = node('div', undefined, 'offer-countdown-unit');
      unit.append(node('strong', '00', 'offer-countdown-value'), node('span', label)); digits.append(unit);
    }
    timer.append(digits); updateTimer(timer); return timer;
  }
  function card(offer) {
    const article = node('article', undefined, 'offer-card');
    if (offer.image) { const image = node('img'); image.src = offer.image; image.alt = offer.title; image.loading = 'lazy'; image.className = 'offer-photo'; article.append(image); }
    const content = node('div', undefined, 'offer-copy');
    content.append(node('span', 'DA ANDREA CON PIÙ GUSTO', 'offer-eyebrow'), node('h3', offer.title));
    if (offer.description) content.append(node('p', offer.description, 'offer-description'));
    if (offer.price !== null && offer.price !== undefined) content.append(node('strong', new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(offer.price), 'offer-price'));
    content.append(node('p', `${offer.start > day() ? `Dal ${date(offer.start)} · ` : ''}Fino al ${date(offer.end)}`, 'offer-expiry'));
    if (status(offer) === 'In corso') content.append(countdown(offer));
    article.append(content); return article;
  }
  window.Offers = { node, day, date, status, card, deadline };
  setInterval(() => {
    if (document.hidden) return;
    document.querySelectorAll('.offer-countdown').forEach(timer => updateTimer(timer));
  }, 1000);
  const page = document.querySelector('[data-offers-page]');
  const popup = document.querySelector('#offer-popup-dialog');
  if (!page && !popup) return;
  const grid = document.querySelector('#offers-grid');
  const message = document.querySelector('#offers-message');
  const sessionKey = 'andrea-offers-welcome';
  let latest = [], shown = false, signature = '', loaded = false;
  const seen = () => { try { return sessionStorage.getItem(sessionKey) === '1'; } catch { return shown; } };
  function render(offers) {
    loaded = true;
    latest = offers;
    const active = offers.filter(offer => status(offer) === 'In corso');
    const count = active.length;
    const next = JSON.stringify(active);
    if (grid && next !== signature) {
      grid.replaceChildren(...active.map((offer, index) => {
        const item = card(offer);
        item.style.setProperty('--offer-delay', Math.min(index, 5) * 80 + 'ms');
        return item;
      }));
    }
    signature = next;
    if (message) {
      message.textContent = count ? (count === 1 ? '1 offerta da prendere al volo.' : count + ' offerte da prendere al volo.') : 'Stiamo preparando le prossime offerte. Intanto, scopri il menu!';
    }
    for (const id of ['offers-link', 'offers-fab']) {
      const link = document.getElementById(id);
      if (link) link.hidden = !count;
    }
    const badge = document.querySelector('#offers-fab-count');
    if (badge) badge.textContent = count;
    if (!popup) return;
    document.querySelector('#offer-popup-title').textContent = count === 1 ? 'C’è 1 offerta per te!' : 'Ci sono ' + count + ' offerte per te!';
    if (!count) { if (popup.open) popup.close(); return; }
    if (shown || seen() || document.hidden || document.querySelector('dialog[open]')) return;
    popup.showModal(); shown = true;
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Keep the in-memory fallback. */ }
  }
  for (const id of ['close-offer-popup', 'skip-offers']) {
    document.getElementById(id)?.addEventListener('click', () => popup.close());
  }
  popup?.addEventListener('click', event => { if (event.target === popup) {
    const rect = popup.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) popup.close();
  } });
  window.addEventListener('offers-loaded', event => render(event.detail));
  async function refresh() {
    if (document.hidden) return;
    try {
      const response = await fetch('/api/menu', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Unavailable');
      render((await response.json()).offers || []);
    } catch {
      render([]);
      if (message) message.textContent = 'Non riusciamo a caricare le offerte. Riprova tra poco oppure chiamaci al 366 746 0906.';
    }
  }
  if (page) refresh();
  setInterval(refresh, 60000);
  setInterval(() => {
    if (!document.hidden && loaded && latest.some(offer => status(offer) !== 'In corso')) render(latest.filter(offer => status(offer) === 'In corso'));
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { popup?.close(); refresh(); } });
})();
