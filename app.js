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
const supplementCategoryIds = new Set(['panini','piadine','ufficiali','crepes','wrap']);
const supplementGroups = [
  {name:'Carni e salumi',items:[['Asino',7],['Bacon',3],['Braciola',6],['Bresaola',3],['Carne di cavallo',6],['Cotoletta',6],['Cotoletta della casa',6.5],['Filetto di scottona',8.5],['Filetto di suino',7],['Hamburger',6],['Hamburger di cervo',10],['Hamburger di Chianina',10],['Hamburger di scottona',7.5],['Kebab',6],['Pancetta di suino',5],['Pollo',6],['Polpetta di cavallo',7],['Porchetta',2.5],['Porchetta artigianale',4],['Prosciutto',2],['Prosciutto crudo',3],['Pulled pork',6],['Salsiccia',5],['Speck',3],['Tonno',3],['Ventricina piccante',2.5],['Vitello',6],['Würstel',2]]},
  {name:'Formaggi e uova',items:[['Cheddar',2.5],['Emmental',2.5],['Gorgonzola',2.5],['Grana',2.5],['Mozzarella',2],['Mozzarella di bufala',3],['Mozzarella senza lattosio',3],['Philadelphia',3],['Ricotta',2.5],['Uovo fritto piccante',1],['Uovo sodo',1]]},
  {name:'Verdure e extra',items:[['Acciughe',2],['Cipolla agrodolce',0.5],['Cipolla croccante',0.5],['Cipolla cruda',0.5],['Crocchette di patate',3],['Funghi',0.5],['Funghi piccanti',0.5],['Funghi porcini',3],['Lattuga',0.5],['Mais',1],['Melanzane',1],['Olive',0.5],['Patatine',2.5],['Patatine a parte',1],['Patatine crispy',3],['Peperoncino piccante',0.5],['Peperoni',1],['Pomodoro',0.5],['Rucola',0.5],['Zucchine',1]]},
  {name:'Salse',items:[['Ketchup',0.5],['Maionese',0.5],['Salsa algerina',0.5],['Salsa bacon',0.5],['Salsa barbecue',0.5],['Salsa boscaiola',0.5],['Salsa burger',0.5],['Salsa hamburger',0.5],['Salsa harissa',0.5],['Salsa sweet chili',0.5],['Salsa tartara',0.5],['Salsa yogurt',0.5],['Tabasco',0.5]]},
  {name:'Impasti e condimenti',items:[['Panino senza glutine',3],['Crêpe senza glutine',1],['Schiacciatina',1],['Aceto',0],['Aromi misti',0],['Olio',0],['Sale',0]]}
];
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
  const section = document.querySelector('#supplements');
  const groups = document.querySelector('#supplement-groups');
  const available = supplementCategoryIds.has(category.id);
  section.hidden = !available;
  groups.replaceChildren();
  if (!available) return;
  for (const group of supplementGroups) {
    const block = element('details', 'supplement-group');
    const summary = element('summary');
    summary.append(element('strong', '', group.name), element('span', '', `${group.items.length} AGGIUNTE`));
    const list = element('div', 'supplement-list');
    for (const [name, price] of group.items) {
      const item = element('div', 'supplement-item');
      item.append(element('span', '', name), element('b', '', price ? money(price) : 'INCLUSO'));
      list.append(item);
    }
    block.append(summary, list); groups.append(block);
  }
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
