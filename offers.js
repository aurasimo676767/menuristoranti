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
  // Remove expired promotions and close their popup at the actual deadline.
  setInterval(() => { if (!document.hidden && latest.some(offer => offer.end < day())) render(latest.filter(offer => offer.end >= day())); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
