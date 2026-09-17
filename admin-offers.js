(() => {
  const $ = selector => document.querySelector(selector);
  const { node, day, date, status, card } = window.Offers;
  let state, draft, csrf, dirty = false, formDirty = false, busy = false, imageBusy = false, editingId, image = '', imageVersion = 0;
  const message = (text = '', error = false) => { $('#status').textContent = text; $('#status').className = error ? 'error' : 'success'; };
  const button = (text, action) => { const control = node('button', text); control.type = 'button'; control.addEventListener('click', action); return control; };
  function update() {
    $('#save-status').textContent = dirty ? '● Modifiche da salvare' : state && JSON.stringify(state.draft) !== JSON.stringify(state.published) ? 'Bozza salvata · da pubblicare' : 'Offerte aggiornate';
    $('#publication-info').textContent = state?.publishedAt ? `Ultima pubblicazione: ${new Date(state.publishedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : 'Prepara la tua prima promozione.';
    $('#save').disabled = busy || !dirty;
    $('#publish').disabled = busy;
    $('#add-offer').disabled = busy || (draft?.length ?? 0) >= 12;
  }
  async function request(action = 'offers', data) {
    const response = await fetch(`/api/admin${data ? '' : `?action=${action}`}`, {
      method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: data ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } : {},
      ...(data ? { body: JSON.stringify({ ...data, action }) } : {})
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) { $('#editor').hidden = true; $('#login-panel').hidden = false; }
      const error = new Error(result.error || 'Operazione non riuscita.'); error.status = response.status; throw error;
    }
    return result;
  }
  async function run(task) {
    if (busy) return;
    busy = true; message();
    const controls = [...document.querySelectorAll('button,input,textarea,select')].map(control => [control, control.disabled]);
    controls.forEach(([control]) => { control.disabled = true; });
    try { await task(); } catch (error) { message(['TypeError', 'TimeoutError', 'SyntaxError'].includes(error.name) ? 'Connessione interrotta. La bozza resta nella pagina: scaricane una copia e ricarica dal server per verificare il salvataggio.' : error.message, true); }
    finally { busy = false; controls.forEach(([control, disabled]) => { control.disabled = disabled; }); update(); }
  }
  function accept(next) { state = next; draft = structuredClone(next.draft); dirty = false; render(); }
  function changed() { dirty = true; render(); }
  function render() {
    $('#offers-list').replaceChildren();
    for (const [index, offer] of draft.entries()) {
      const row = node('article', undefined, 'admin-offer-row');
      row.append(node('span', status(offer), 'offer-state'), node('h3', offer.title), node('p', `${date(offer.start)} – ${date(offer.end)}${offer.popup ? ' · Popup attivo' : ''}`));
      const actions = node('div', undefined, 'bottom-tools');
      actions.append(button('Modifica', () => open(offer)), button('Duplica', () => {
        if (draft.length >= 12) { message('Hai raggiunto il limite di 12 offerte. Elimina quelle che non servono più.', true); return; }
        open({ ...offer, id: null, title: `${offer.title} (copia)`.slice(0, 100), enabled: false });
      }), button(offer.enabled ? 'Disattiva' : 'Abilita', () => { offer.enabled = !offer.enabled; changed(); }));
      for (const [label, delta] of [['↑', -1], ['↓', 1]]) {
        const control = button(label, () => { [draft[index], draft[index + delta]] = [draft[index + delta], draft[index]]; changed(); });
        control.setAttribute('aria-label', `${delta < 0 ? 'Sposta su' : 'Sposta giù'} ${offer.title}`); control.disabled = index + delta < 0 || index + delta >= draft.length; actions.append(control);
      }
      row.append(actions); $('#offers-list').append(row);
    }
    if (!draft.length) $('#offers-list').append(node('p', 'Nessuna offerta. Crea una promozione, scegli le date e pubblicala quando è pronta.', 'empty'));
    update();
  }
  function showImage() {
    $('#image-preview').hidden = !image; $('#remove-image').hidden = !image;
    if (image) $('#image-preview').src = image; else $('#image-preview').removeAttribute('src');
  }
  function duration(kind) {
    const start = $('#offer-start').value;
    if (!start) return;
    const end = new Date(`${start}T12:00:00Z`);
    if (kind === 'week') end.setUTCDate(end.getUTCDate() + 6);
    else {
      const originalDay = end.getUTCDate();
      end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1);
      const days = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
      end.setUTCDate(Math.min(originalDay, days)); end.setUTCDate(end.getUTCDate() - 1);
    }
    $('#offer-end').value = end.toISOString().slice(0, 10); $('#offer-end').setCustomValidity('');
  }
  function open(offer) {
    editingId = offer?.id || null; imageVersion++; image = offer?.image || ''; formDirty = false;
    $('#offer-form').reset(); $('#offer-modal-title').textContent = editingId ? 'Modifica offerta' : 'Nuova offerta';
    $('#offer-title').value = offer?.title || ''; $('#offer-description').value = offer?.description || ''; $('#offer-price').value = offer?.price ?? '';
    $('#offer-start').value = offer?.start || day(); $('#offer-end').value = offer?.end || ''; if (!offer) duration('week');
    $('#offer-end').setCustomValidity(''); $('#offer-enabled').checked = offer?.enabled !== false; $('#offer-popup').checked = offer?.popup === true;
    $('#delete-offer').hidden = !editingId; $('#form-status').textContent = ''; showImage();
    $('#offer-modal').showModal(); $('#offer-title').focus();
  }
  async function compress(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Scegli una foto JPG, PNG o WebP fino a 15 MB.');
    const url = URL.createObjectURL(file), photo = new Image();
    try {
      photo.src = url; await photo.decode();
      let width = Math.min(960, photo.naturalWidth);
      for (let attempt = 0; attempt < 5; attempt++) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.max(1, Math.round(photo.naturalHeight * width / photo.naturalWidth));
        // Bound portrait panoramas as well as landscape photos.
        if (canvas.height > 960) { canvas.width = Math.max(1, Math.round(canvas.width * 960 / canvas.height)); canvas.height = 960; }
        const context = canvas.getContext('2d'); context.fillStyle = '#1b1b18'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        const encoded = canvas.toDataURL('image/jpeg', 0.76 - attempt * 0.09);
        if (encoded.length <= 130000) return encoded;
        width = Math.max(240, Math.floor(width * 0.8));
      }
      throw new Error('Foto troppo complessa. Prova una foto più piccola.');
    } finally { URL.revokeObjectURL(url); }
  }
  $('#offer-image').addEventListener('change', async () => {
    const file = $('#offer-image').files[0]; if (!file) return;
    const version = ++imageVersion; imageBusy = true; $('#form-status').textContent = 'Preparazione della foto…';
    $('#offer-form button[type=submit]').disabled = true;
    try { const result = await compress(file); if (version === imageVersion) { image = result; formDirty = true; showImage(); $('#form-status').textContent = 'Foto pronta.'; } }
    catch (error) { if (version === imageVersion) $('#form-status').textContent = error.message || 'Impossibile leggere la foto. Prova un altro file.'; }
    finally { if (version === imageVersion) { imageBusy = false; $('#offer-form button[type=submit]').disabled = false; $('#offer-image').value = ''; } }
  });
  $('#remove-image').addEventListener('click', () => { imageVersion++; imageBusy = false; image = ''; $('#offer-form button[type=submit]').disabled = false; formDirty = true; $('#form-status').textContent = ''; showImage(); });
  $('#offer-form').addEventListener('input', () => { formDirty = true; $('#offer-end').setCustomValidity(''); });
  document.querySelectorAll('[data-duration]').forEach(control => control.addEventListener('click', () => { duration(control.dataset.duration); formDirty = true; }));
  $('#offer-form').addEventListener('submit', event => {
    event.preventDefault(); if (imageBusy) return;
    if (!$('#offer-title').value.trim()) { $('#offer-title').focus(); return; }
    if ($('#offer-end').value < $('#offer-start').value) { $('#offer-end').setCustomValidity('La scadenza non può precedere l’inizio.'); $('#offer-end').reportValidity(); return; }
    const offer = { id: editingId || `offer-${crypto.randomUUID()}`, title: $('#offer-title').value.trim(), description: $('#offer-description').value.trim(), price: $('#offer-price').value === '' ? null : Number($('#offer-price').value), start: $('#offer-start').value, end: $('#offer-end').value, image, enabled: $('#offer-enabled').checked, popup: $('#offer-popup').checked };
    const next = draft.map(item => item.id === editingId ? offer : item); if (!editingId) next.push(offer);
    if (new Blob([JSON.stringify(next)]).size > 1200000) { $('#form-status').textContent = 'Spazio esaurito. Rimuovi alcune foto o offerte scadute.'; return; }
    draft = next; changed(); formDirty = false; $('#offer-modal').close();
  });
  $('#delete-offer').addEventListener('click', () => { if (confirm('Eliminare questa offerta dalla bozza?')) { draft = draft.filter(item => item.id !== editingId); changed(); formDirty = false; $('#offer-modal').close(); } });
  $('#add-offer').addEventListener('click', () => open());
  $('#save').addEventListener('click', () => run(async () => { accept((await request('offers-save', { offers: draft, revision: state.revision })).state); message('Bozza salvata. Premi Pubblica offerte per mostrarle ai clienti.'); }));
  $('#publish').addEventListener('click', () => {
    if (!confirm('Pubblicare le offerte? Quelle abilitate saranno visibili nelle date scelte.')) return;
    run(async () => { accept((await request('offers-publish', { offers: draft, revision: state.revision })).state); message('Offerte pubblicate. La programmazione è attiva.'); });
  });
  $('#login-form').addEventListener('submit', event => {
    event.preventDefault(); const password = $('#password').value; $('#password').value = '';
    run(async () => {
      csrf = (await request('login', { password })).csrf;
      const result = await request(); csrf = result.csrf;
      if (!draft) accept(result.state); else { render(); message('Accesso effettuato. Le modifiche aperte sono state conservate.'); }
      $('#login-panel').hidden = true; $('#editor').hidden = false;
    });
  });
  $('#reload').addEventListener('click', () => {
    if (dirty && !confirm('Scartare le modifiche non salvate e ricaricare dal server?')) return;
    run(async () => { const result = await request(); csrf = result.csrf; accept(result.state); message('Bozza ricaricata.'); });
  });
  $('#logout').addEventListener('click', () => {
    if (dirty && !confirm('Uscire senza salvare?')) return;
    run(async () => { await request('logout', {}); draft = null; state = null; dirty = false; csrf = null; $('#editor').hidden = true; $('#login-panel').hidden = false; message('Sei uscito dall’area riservata.'); });
  });
  $('#export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = `offerte-andrea-${day()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#preview').addEventListener('click', () => { $('#preview-content').replaceChildren(...draft.map(card)); if (!draft.length) $('#preview-content').append(node('p', 'Nessuna offerta da mostrare.')); $('#preview-modal').showModal(); });
  document.querySelectorAll('[data-close]').forEach(control => control.addEventListener('click', () => { if (!formDirty || confirm('Chiudere senza applicare le modifiche?')) control.closest('dialog').close(); }));
  $('#offer-modal').addEventListener('cancel', event => { if (formDirty && !confirm('Chiudere senza applicare le modifiche?')) event.preventDefault(); });
  $('#offer-modal').addEventListener('close', () => { formDirty = false; imageVersion++; imageBusy = false; $('#offer-form button[type=submit]').disabled = false; });
  window.addEventListener('beforeunload', event => { if (dirty || formDirty) { event.preventDefault(); event.returnValue = ''; } });
  run(async () => {
    try { const result = await request(); csrf = result.csrf; accept(result.state); $('#login-panel').hidden = true; $('#editor').hidden = false; }
    catch (error) { if (error.status !== 401) throw error; }
  });
})();
