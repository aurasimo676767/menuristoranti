const menu = window.MENU_DATA.categories;
const money = value => new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(value);
const categories = document.querySelector('#categories');
const dishes = document.querySelector('#dishes');
const dialog = document.querySelector('#dish-dialog');
const search = document.querySelector('#menu-search');
const categoryDialog = document.querySelector('#category-dialog');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let selectedCategory = menu[0];
let lastTrigger;
let lastCategoryTrigger;
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#icon-${name}`); svg.append(use); return svg;
}
function categoryIcon(id) {
  if (['panini','baby','menu8','panini-dolci'].includes(id)) return 'burger';
  if (id === 'ufficiali') return 'flame';
  if (['pizze','maxi','pizze-dolci'].includes(id)) return 'pizza';
  if (['crepes','wrap'].includes(id)) return 'wrap';
  if (['crepes-dolci','dessert'].includes(id)) return 'sweet';
  if (['bevande','birre'].includes(id)) return 'drink';
  if (id === 'fritti') return 'fries';
  return 'grid';
}
function renderDishes(entries) {
  dishes.replaceChildren();
  if (!entries.length) {
    const empty = element('div', 'empty-menu');
    empty.append(element('h3', '', 'Nessun piatto trovato'), element('p', '', 'Prova con un altro nome o ingrediente.'));
    const reset = element('button', 'reset-search', 'Mostra il menu');
    reset.addEventListener('click', () => { selectCategory(selectedCategory); search.focus(); });
    empty.append(reset); dishes.append(empty); return;
  }
  entries.forEach(({dish, category}, index) => {
    const card = element('button', 'dish-card');
    card.type = 'button'; card.style.setProperty('--i', Math.min(index, 5));
    card.dataset.dishId = dish.id;
    card.setAttribute('aria-label', `${category.name}, ${dish.name}, ${money(dish.price)}. Apri dettagli`);
    const top = element('div', 'dish-topline');
    top.append(element('span', 'dish-index', `N° ${String(index+1).padStart(2,'0')}`));
    if (search.value.trim()) top.append(element('span', 'dish-badge', category.name));
    else top.append(element('span', 'dish-badge', 'DA ANDREA'));
    const heading = element('div', 'dish-heading');
    heading.append(element('h4', '', dish.name));
    card.append(top, heading);
    if (dish.description) card.append(element('p', 'dish-description', dish.description));
    if (dish.variant) card.append(element('span', 'variant-label', dish.variant));
    const bottom = element('div', 'dish-bottom');
    const action = element('span', 'dish-action', 'SCOPRI'); action.append(icon('arrow'));
    bottom.append(element('span', 'dish-price', money(dish.price)), action); card.append(bottom);
    card.addEventListener('click', () => openDish(dish, category, card));
    dishes.append(card);
  });
}
function updateMenu() {
  const query = normalize(search.value.trim());
  const entries = query
    ? menu.flatMap(category => category.dishes.filter(dish => normalize(`${dish.name} ${dish.description} ${category.name}`).includes(query)).map(dish => ({dish, category})))
    : selectedCategory.dishes.map(dish => ({dish, category: selectedCategory}));
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = !query && button.dataset.category === selectedCategory.id;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#category-title').textContent = query ? 'La tua ricerca' : selectedCategory.title;
  document.querySelector('#category-number').textContent = query ? 'IN TUTTO IL MENU' : `${String(menu.indexOf(selectedCategory)+1).padStart(2, '0')} / SCEGLI IL TUO PREFERITO`;
  document.querySelector('#category-subtitle').textContent = query ? `Risultati per “${search.value.trim()}”` : selectedCategory.subtitle;
  document.querySelector('#dish-count').textContent = `${entries.length} ${entries.length === 1 ? 'proposta' : 'proposte'}`;
  document.querySelector('#search-status').textContent = `${entries.length} ${entries.length === 1 ? 'proposta trovata' : 'proposte trovate'}`;
  renderDishes(entries);
}
function selectCategory(category, navigate = false) {
  selectedCategory = category; search.value = ''; updateMenu();
  if (navigate) document.querySelector('.menu-content').scrollIntoView({block:'start', behavior:reduceMotion.matches ? 'instant' : 'smooth'});
}
menu.forEach(category => {
  const button = element('button', 'category-button'); button.type = 'button'; button.dataset.category = category.id;
  button.append(icon(categoryIcon(category.id)),element('span','',category.name),element('small','',String(category.dishes.length)));
  button.addEventListener('click', () => selectCategory(category, true)); categories.append(button);
  const tile = element('button', 'drawer-category'); tile.type='button'; tile.dataset.category=category.id;
  tile.append(icon(categoryIcon(category.id)),element('strong','',category.name),element('small','',`${category.dishes.length} proposte`));
  tile.addEventListener('click',()=>{categoryDialog.close();selectCategory(category,true);});
  document.querySelector('#drawer-categories').append(tile);
});
for(const id of ['panini','baby','ufficiali','pizze','fritti','crepes-dolci']) {
  const category=menu.find(item=>item.id===id);
  const tile=element('button','quick-category'); tile.type='button';tile.dataset.category=id;
  tile.append(icon(categoryIcon(id)),element('strong','',id==='crepes-dolci'?'Crêpes dolci':category.name),element('span','',String(category.dishes.length)));
  tile.addEventListener('click',()=>selectCategory(category,true));document.querySelector('#quick-categories').append(tile);
}
document.querySelectorAll('[data-open-categories]').forEach(button=>button.addEventListener('click',()=>{
  lastCategoryTrigger=button;categoryDialog.showModal();categoryDialog.scrollTop=0;document.body.style.overflow='hidden';
}));
document.querySelector('.close-categories').addEventListener('click',()=>categoryDialog.close());
categoryDialog.addEventListener('close',()=>{document.body.style.overflow='';lastCategoryTrigger?.focus({preventScroll:true});});
categoryDialog.addEventListener('click',event=>{
  if(event.target!==categoryDialog)return;
  const r=categoryDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)categoryDialog.close();
});
document.querySelectorAll('[data-go-category]').forEach(button=>button.addEventListener('click',()=>{
  const category=menu.find(item=>item.id===button.dataset.goCategory);if(category)selectCategory(category,true);
}));
search.addEventListener('input', updateMenu);
function openDish(dish, category, trigger) {
  lastTrigger = trigger;
  document.querySelector('#detail-label').textContent = category.name;
  document.querySelector('#detail-title').textContent = dish.name;
  document.querySelector('#detail-price').textContent = money(dish.price);
  document.querySelector('#detail-description').textContent = dish.description || 'Gli ingredienti non sono indicati nel menu originale. Chiedi al personale prima di ordinare.';
  document.querySelector('#detail-allergens').textContent = 'L’elenco completo degli allergeni non è indicato nel menu originale. Rivolgiti al personale per informazioni su ingredienti e allergeni.';
  const tags = document.querySelector('#detail-tags'); tags.replaceChildren();
  if (dish.variant) tags.append(element('span', 'tag', dish.variant));
  document.querySelector('#source-text').textContent = `${dish.sourceName}${dish.sourceDescription ? ' — ' + dish.sourceDescription : ''}`;
  document.querySelector('#source-details').open = false;
  dialog.showModal(); dialog.scrollTop = 0; document.body.style.overflow = 'hidden';
}
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('.detail-back').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if(event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => { document.body.style.overflow = ''; lastTrigger?.focus({preventScroll:true}); });
updateMenu();
