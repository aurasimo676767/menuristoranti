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
function revealOnScroll(node, className) {
  node.classList.remove('scroll-pending');
  node.classList.add(className);
}
const dishReveals = new IntersectionObserver(entries => {
  let stagger = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.style.setProperty('--reveal-delay', `${Math.min(stagger++, 3) * 110}ms`);
    revealOnScroll(entry.target, 'dish-arrived');
    dishReveals.unobserve(entry.target);
  }
}, {threshold: 0.08, rootMargin: '0px 0px -45px 0px'});
dishes.addEventListener('focusin', event => {
  const card = event.target.closest('.dish-card');
  if (card) {
    revealOnScroll(card, 'dish-arrived');
    dishReveals.unobserve(card);
  }
});
reduceMotion.addEventListener('change', () => {
  if (reduceMotion.matches) {
    document.querySelectorAll('.scroll-pending').forEach(node => node.classList.remove('scroll-pending'));
  }
});
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
function renderSupplements(category) {
  document.querySelector('#supplements').hidden = ['bevande', 'birre', 'extra'].includes(category.id);
}
function categoryIcon(id) {
  if (['panini','baby','menu8','panini-dolci'].includes(id)) return 'burger';
  if (id === 'ufficiali') return 'flame';
  if (['pizze','maxi','pizze-dolci'].includes(id)) return 'pizza';
  if (['crepes','wrap','piadine'].includes(id)) return 'wrap';
  if (['crepes-dolci','dessert'].includes(id)) return 'sweet';
  if (['bevande','birre'].includes(id)) return 'drink';
  if (id === 'fritti') return 'fries';
  return 'grid';
}
function renderDishes(entries) {
  dishReveals.disconnect();
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
    if (!reduceMotion.matches) {
      card.classList.add('scroll-pending');
      dishReveals.observe(card);
    }
  });
}
function updateMenu() {
  if (!selectedCategory) {
    document.querySelector('#category-title').textContent = 'Menu momentaneamente non disponibile';
    document.querySelector('#category-subtitle').textContent = 'Riprova tra poco oppure contatta il locale.';
    document.querySelector('#category-number').textContent = '';
    document.querySelector('.menu-toolbar').hidden = true;
    document.querySelector('.menu-end').hidden = true;
    document.querySelector('.list-guide').hidden = true;
    dishes.replaceChildren();
    return;
  }
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
  document.querySelector('#search-status').textContent = `${entries.length} ${entries.length === 1 ? 'proposta trovata' : 'proposte trovate'}`;
  renderDishes(entries);
}
function selectCategory(category, navigate = false) {
  selectedCategory = category; search.value = ''; updateMenu();
  if (navigate) document.querySelector('.menu-content').scrollIntoView({block:'start', behavior:reduceMotion.matches ? 'instant' : 'smooth'});
}
menu.forEach(category => {
  const button = element('button', 'category-button'); button.type = 'button'; button.dataset.category = category.id;
  button.append(icon(categoryIcon(category.id)),element('span','',category.name));
  button.addEventListener('click', () => selectCategory(category, true)); categories.append(button);
  const tile = element('button', 'drawer-category'); tile.type='button'; tile.dataset.category=category.id;
  tile.append(icon(categoryIcon(category.id)),element('strong','',category.name));
  tile.addEventListener('click',()=>{categoryDialog.close();selectCategory(category,true);});
  document.querySelector('#drawer-categories').append(tile);
});
for(const id of ['panini','baby','piadine','ufficiali','pizze','fritti']) {
  const category=menu.find(item=>item.id===id);
  if (!category) continue;
  const tile=element('button','quick-category'); tile.type='button';tile.dataset.category=id;
  tile.append(icon(categoryIcon(id)),element('strong','',category.name));
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
document.querySelector('.officials-promo').hidden = !menu.some(category => category.id === 'ufficiali');
search.addEventListener('input', updateMenu);
function openDish(dish, category, trigger) {
  lastTrigger = trigger;
  document.querySelector('#detail-label').textContent = category.name;
  document.querySelector('#detail-title').textContent = dish.name;
  document.querySelector('#detail-price').textContent = money(dish.price);
  const description = document.querySelector('#detail-description');
  const ingredientLabel = document.querySelector('#detail-ingredients-label');
  description.textContent = dish.description;
  description.hidden = !dish.description;
  ingredientLabel.hidden = !dish.description;
  document.querySelector('#detail-allergens').textContent = 'Per conoscere gli allergeni presenti in questo prodotto, consulta il registro allergeni disponibile presso il personale.';
  const tags = document.querySelector('#detail-tags'); tags.replaceChildren();
  if (dish.variant) tags.append(element('span', 'tag', dish.variant));
  renderSupplements(category);
  document.querySelector('#source-text').textContent = `${dish.sourceName}${dish.sourceDescription ? ' — ' + dish.sourceDescription : ''}`;
  document.querySelector('#source-details').open = false;
  document.querySelector('#source-details').hidden = !dish.sourceName;
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

// Banner: layers keep the photograph readable while the embers move independently.
const banner = document.querySelector('.hero-visual');
const bannerImage = banner.querySelector('img');
const bannerFrame = element('div', 'banner-frame');
const bannerFloat = element('div', 'banner-float');
bannerImage.before(bannerFrame);
bannerFrame.append(bannerFloat);
bannerFloat.append(bannerImage);
const embers = element('div', 'banner-embers');
embers.setAttribute('aria-hidden', 'true');
for (let i = 0; i < 12; i++) {
  const ember = element('i');
  ember.style.setProperty('--x', `${8 + (i * 19) % 85}%`);
  ember.style.setProperty('--delay', `${-i * 0.63}s`);
  ember.style.setProperty('--duration', `${3.5 + (i % 4) * 0.7}s`);
  embers.append(ember);
}
bannerFloat.append(embers);
let bannerVisible = true;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
function resetBannerTilt() {
  bannerFrame.style.removeProperty('--rx');
  bannerFrame.style.removeProperty('--ry');
}
function syncBannerMotion() {
  banner.classList.toggle('motion-paused', !bannerVisible || document.hidden || reduceMotion.matches);
  resetBannerTilt();
}
banner.addEventListener('pointermove', event => {
  if (!finePointer.matches || reduceMotion.matches) return;
  const bounds = banner.getBoundingClientRect();
  bannerFrame.style.setProperty('--rx', `${(0.5 - (event.clientY - bounds.top) / bounds.height) * 5}deg`);
  bannerFrame.style.setProperty('--ry', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 6}deg`);
});
banner.addEventListener('pointerleave', resetBannerTilt);
reduceMotion.addEventListener('change', syncBannerMotion);
document.addEventListener('visibilitychange', syncBannerMotion);
new IntersectionObserver(([entry]) => {
  bannerVisible = entry.isIntersecting;
  syncBannerMotion();
}).observe(banner);
syncBannerMotion();

// Arm entrances only with JavaScript and reveal them when they reach the screen.
const sectionReveals = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealOnScroll(entry.target, 'section-arrived');
    sectionReveals.unobserve(entry.target);
  }
}, {threshold: 0.08, rootMargin: '0px 0px -35px 0px'});
document.querySelectorAll('.menu-intro, .quick-categories, .officials-promo, .info-heading, .info-cards article, footer').forEach((section, index) => {
  section.style.setProperty('--reveal-delay', `${index % 3 * 65}ms`);
  if (!reduceMotion.matches) {
    section.classList.add('scroll-pending');
    sectionReveals.observe(section);
  }
});
document.addEventListener('focusin', event => {
  const section = event.target.closest('.scroll-pending');
  if (section) {
    revealOnScroll(section, 'section-arrived');
    sectionReveals.unobserve(section);
  }
});
