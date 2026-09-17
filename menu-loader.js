// File previews use the bundled menu; online visitors read the last publication.
(async () => {
  if (location.protocol !== 'file:') {
    try {
      const response = await fetch('/api/menu', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      // A plain static preview has no API.
      if (response.status !== 404) {
        if (!response.ok) throw new Error('Menu unavailable');
        const result = await response.json();
        if (result.menu) window.MENU_DATA = result.menu;
        window.dispatchEvent(new CustomEvent('offers-loaded', { detail: result.offers || [] }));
      }
    } catch {
      // Do not show outdated prices or deleted dishes when the live archive is down.
      window.MENU_DATA = { categories: [] };
      window.menuUnavailable = true;
    }
  }
  const script = document.createElement('script');
  script.src = 'app.js';
  document.head.append(script);
})();
