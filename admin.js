const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
const date = value => value ? new Date(value).toLocaleString('it-IT') : 'Menu iniziale';
const copy = value => structuredClone(value);
let state, draft, selectedId, csrf, dirty = false, busy = false, editingDish, editingCategory;
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const button = (text, action, className) => { const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node; };
function message(text = '', type = '') { $('#status').textContent = text; $('#status').className = type; }
function changed() { dirty = true; updateStatus(); }
function updateStatus() {
  $('#save-status').textContent = dirty ? '● Modifiche da salvare' : state && JSON.stringify(state.draft) !== JSON.stringify(state.published) ? 'Bozza salvata · da pubblicare' : 'Menu aggiornato';
  $('#publication-info').textContent = state?.publishedAt ? `Ultima pubblicazione: ${date(state.publishedAt)}` : 'Il menu attuale è pronto da modificare.';
  $('#save').disabled = busy || !dirty;
  $('#publish').disabled = busy;
}
async function request(action, data) {
  const response = await fetch(`/api/admin${data ? '' : action ? `?action=${action}` : ''}`, {
    method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: data ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } : {},
    ...(data ? { body: JSON.stringify({ ...data, action }) } : {})
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Area amministratore non disponibile. Verifica che il sito sia stato pubblicato con le nuove funzioni.'); }
  if (!response.ok) {
    if (response.status === 401 && action !== 'login') { $('#login-panel').hidden = false; $('#editor').hidden = true; $('#password').focus(); }
    throw new Error(result.error || 'Operazione non riuscita.');
  }
  return result;
}
async function run(task) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('button, input, textarea, select')].map(node => [node, node.disabled]);
  controls.forEach(([node]) => { node.disabled = true; });
  message();
  try { await task(); } catch (error) {
    message(error.name === 'TimeoutError' || error.name === 'TypeError' ? 'Connessione interrotta. Le modifiche restano nella pagina: ricarica dal server per verificare se il salvataggio è riuscito.' : error.message, 'error');
  } finally { busy = false; controls.forEach(([node, disabled]) => { node.disabled = disabled; }); updateStatus(); }
}
function accept(next) {
  state = next; draft = copy(state.draft); dirty = false;
  if (!draft.categories.some(category => category.id === selectedId)) selectedId = draft.categories[0].id;
  render();
}
function current() { return draft.categories.find(category => category.id === selectedId); }
function move(array, index, delta) {
  if (index + delta < 0 || index + delta >= array.length) return;
  [array[index], array[index + delta]] = [array[index + delta], array[index]];
  changed(); render();
}
function arrows(array, index, label) {
  const group = el('div', undefined, 'arrows');
  for (const [text, delta, verb] of [['↑', -1, 'Sposta su'], ['↓', 1, 'Sposta giù']]) {
    const control = button(text, () => move(array, index, delta));
    control.setAttribute('aria-label', `${verb} ${label}`);
    control.disabled = index + delta < 0 || index + delta >= array.length;
    group.append(control);
  }
  return group;
}
function render() {
  $('#admin-categories').replaceChildren();
  draft.categories.forEach((category, index) => {
    const row = el('div', undefined, 'category-row');
    const select = button(category.name, () => { selectedId = category.id; $('#dish-search').value = ''; render(); });
    select.append(el('small', `${category.dishes.length} piatti`));
    select.setAttribute('aria-current', String(category.id === selectedId));
    row.append(select, arrows(draft.categories, index, category.name));
    $('#admin-categories').append(row);
  });
  $('#active-category').textContent = current().name;
  renderDishes(); updateStatus();
  const nav = $('#admin-categories'), active = nav.querySelector('[aria-current="true"]');
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
}
function renderDishes() {
  const category = current(), query = $('#dish-search').value.trim().toLocaleLowerCase('it');
  $('#admin-dishes').replaceChildren();
  category.dishes.forEach((dish, index) => {
    if (!`${dish.name} ${dish.description}`.toLocaleLowerCase('it').includes(query)) return;
    const row = el('article', undefined, `dish-row${dish.available === false ? ' unavailable' : ''}`);
    const details = el('div'); details.append(el('h3', dish.name), el('p', dish.description || 'Nessuna descrizione'));
    if (dish.available === false) details.append(el('span', 'Non disponibile · nascosto ai clienti', 'badge'));
    const edit = button('Modifica', () => openDish(dish)); edit.setAttribute('aria-label', `Modifica ${dish.name}`);
    row.append(details, el('span', money(dish.price), 'price'), arrows(category.dishes, index, dish.name), edit);
    $('#admin-dishes').append(row);
  });
  if (!$('#admin-dishes').children.length) $('#admin-dishes').append(el('p', query ? 'Nessun piatto trovato.' : 'Questa categoria è vuota. Aggiungi il primo piatto.', 'empty'));
}
function openDish(dish) {
  editingDish = dish ? { id: dish.id, categoryId: selectedId } : null;
  $('#dish-modal-title').textContent = dish ? 'Modifica piatto' : 'Nuovo piatto';
  $('#dish-name').value = dish?.name || '';
  $('#dish-price').value = dish?.price ?? '';
  $('#dish-description').value = dish?.description || '';
  $('#dish-variant').value = dish?.variant || '';
  $('#dish-available').checked = dish?.available !== false;
  $('#dish-category').replaceChildren(...draft.categories.map(category => { const option = el('option', category.name); option.value = category.id; return option; }));
  $('#dish-category').value = selectedId;
  $('#delete-dish').hidden = !dish;
  $('#dish-modal').showModal(); $('#dish-name').focus();
}
$('#dish-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('#dish-name').value.trim()) { $('#dish-name').focus(); return; }
  const origin = editingDish ? draft.categories.find(category => category.id === editingDish.categoryId) : null;
  const old = origin?.dishes.find(dish => dish.id === editingDish.id);
  const dish = { ...old, id: old?.id || `dish-${crypto.randomUUID()}`, name: $('#dish-name').value.trim(), price: Number($('#dish-price').value), description: $('#dish-description').value.trim(), variant: $('#dish-variant').value.trim(), available: $('#dish-available').checked };
  const destination = draft.categories.find(category => category.id === $('#dish-category').value);
  if (origin === destination) origin.dishes[origin.dishes.indexOf(old)] = dish;
  else { if (origin) origin.dishes.splice(origin.dishes.indexOf(old), 1); destination.dishes.push(dish); }
  selectedId = destination.id; $('#dish-search').value = ''; changed(); render(); $('#dish-modal').close();
});
$('#delete-dish').addEventListener('click', () => {
  if (!confirm(`Eliminare “${$('#dish-name').value}” dalla bozza?`)) return;
  const category = draft.categories.find(item => item.id === editingDish.categoryId);
  category.dishes = category.dishes.filter(item => item.id !== editingDish.id);
  changed(); render(); $('#dish-modal').close();
});
function openCategory(category) {
  editingCategory = category?.id;
  $('#category-modal-title').textContent = category ? 'Modifica categoria' : 'Nuova categoria';
  $('#category-name').value = category?.name || '';
  $('#category-subtitle').value = category?.subtitle || '';
  $('#category-supplements').checked = category?.supplements ?? false;
  $('#delete-category').hidden = !category || draft.categories.length === 1;
  $('#category-modal').showModal(); $('#category-name').focus();
}
$('#category-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#category-name').value.trim();
  if (!name) { $('#category-name').focus(); return; }
  const category = editingCategory ? draft.categories.find(item => item.id === editingCategory) : { id: `category-${crypto.randomUUID()}`, dishes: [] };
  Object.assign(category, { name, title: name, subtitle: $('#category-subtitle').value.trim(), supplements: $('#category-supplements').checked });
  if (!editingCategory) draft.categories.push(category);
  selectedId = category.id; changed(); render(); $('#category-modal').close();
});
$('#delete-category').addEventListener('click', () => {
  const category = draft.categories.find(item => item.id === editingCategory);
  if (!confirm(`Eliminare “${category.name}” e tutti i suoi ${category.dishes.length} piatti dalla bozza?`)) return;
  draft.categories = draft.categories.filter(item => item.id !== category.id); selectedId = draft.categories[0].id;
  changed(); render(); $('#category-modal').close();
});
async function history() {
  const result = await request('history');
  $('#history-list').replaceChildren();
  for (const entry of result.history) {
    const row = el('div', undefined, 'history-row');
    row.append(el('p', date(entry.publishedAt)), button('Ripristina in bozza', () => {
      if (!confirm('Sostituire la bozza con questa versione? Il menu pubblico cambia solo quando premi Pubblica.')) return;
      run(async () => { accept((await request('restore', { id: entry.id, revision: state.revision })).state); message('Versione recuperata nella bozza. Controllala prima di pubblicare.', 'success'); });
    }));
    $('#history-list').append(row);
  }
  if (!result.history.length) $('#history-list').append(el('p', 'Le versioni precedenti compariranno dopo la prima pubblicazione.'));
}
$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  const password = $('#password').value; $('#password').value = '';
  run(async () => {
    const result = await request('login', { password }); csrf = result.csrf;
    const loaded = await request(); csrf = loaded.csrf;
    if (draft) {
      // Preserve work across session expiry; keep its revision so conflicts are detected.
      message('Accesso effettuato. Le modifiche aperte sono state conservate.', 'success');
      render();
    } else accept(loaded.state);
    $('#login-panel').hidden = true; $('#editor').hidden = false; await history();
  });
});
$('#show-password').addEventListener('click', () => { const show = $('#password').type === 'password'; $('#password').type = show ? 'text' : 'password'; $('#show-password').textContent = show ? 'Nascondi' : 'Mostra'; $('#show-password').setAttribute('aria-pressed', String(show)); });
$('#save').addEventListener('click', () => run(async () => { accept((await request('save', { menu: draft, revision: state.revision })).state); message('Bozza salvata. Il menu pubblico resta alla precedente pubblicazione.', 'success'); }));
$('#publish').addEventListener('click', () => {
  const count = draft.categories.reduce((total, category) => total + category.dishes.filter(dish => dish.available !== false).length, 0);
  if (!confirm(`Pubblicare ${draft.categories.length} categorie e ${count} piatti disponibili? Il menu dei clienti verrà aggiornato.`)) return;
  run(async () => { accept((await request('publish', { menu: draft, revision: state.revision })).state); message('Menu pubblicato. Le modifiche sono online.', 'success'); await history(); });
});
$('#logout').addEventListener('click', () => {
  if (dirty && !confirm('Uscire senza salvare le modifiche?')) return;
  run(async () => { await request('logout', {}); dirty = false; draft = null; state = null; csrf = null; $('#editor').hidden = true; $('#login-panel').hidden = false; $('#password').focus(); message('Sei uscito dall’area riservata.'); });
});
$('#reload').addEventListener('click', () => {
  if (dirty && !confirm('Scartare le modifiche aperte e ricaricare la bozza salvata?')) return;
  run(async () => { const result = await request(); csrf = result.csrf; accept(result.state); message('Bozza ricaricata dal server.', 'success'); await history(); });
});
$('#refresh-history').addEventListener('click', () => run(history));
$('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = `menu-andrea-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#preview').addEventListener('click', () => {
  $('#preview-content').replaceChildren();
  for (const category of draft.categories) {
    const section = el('section', undefined, 'preview-category'); section.append(el('h3', category.name), el('p', category.subtitle));
    for (const dish of category.dishes.filter(item => item.available !== false)) {
      const row = el('div', undefined, 'preview-dish'), detail = el('div');
      detail.append(el('strong', dish.name), el('p', dish.description), el('p', dish.variant)); row.append(detail, el('b', money(dish.price))); section.append(row);
    }
    $('#preview-content').append(section);
  }
  $('#preview-modal').showModal();
});
$('#add-dish').addEventListener('click', () => openDish());
$('#add-category').addEventListener('click', () => openCategory());
$('#edit-category').addEventListener('click', () => openCategory(current()));
$('#dish-search').addEventListener('input', renderDishes);
document.querySelectorAll('[data-close]').forEach(control => control.addEventListener('click', () => {
  if (formDirty && !confirm('Chiudere senza applicare le modifiche di questa scheda?')) return;
  control.closest('dialog').close();
}));
// Warn for both applied draft changes and text still open in a dialog.
let formDirty = false;
document.querySelectorAll('dialog form').forEach(form => form.addEventListener('input', () => { formDirty = true; }));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', event => { if (formDirty && !confirm('Chiudere senza applicare le modifiche di questa scheda?')) event.preventDefault(); });
  dialog.addEventListener('close', () => { formDirty = false; });
});
window.addEventListener('beforeunload', event => { if (dirty || formDirty) { event.preventDefault(); event.returnValue = ''; } });
run(async () => {
  try { const result = await request(); csrf = result.csrf; accept(result.state); $('#login-panel').hidden = true; $('#editor').hidden = false; await history(); }
  catch (error) { if (!error.message.startsWith('Sessione scaduta')) throw error; }
});
