// Modifica qui i piatti, i prezzi e gli allergeni del locale.
const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
const menu = [
  {id:'antipasti',name:'Antipasti',title:'Per cominciare',dishes:[
    {name:'Burrata dell’orto',price:12,description:'Burrata cremosa, pomodorini di stagione, basilico fresco e un filo del nostro olio buono.',image:'photo-1608897013039-887f21d8c804',badge:'Il nostro preferito',tags:['Vegetariano'],allergens:'Latte e derivati.'},
    {name:'Bruschette di casa',price:8,description:'Pane rustico tostato, pomodori maturi, aglio e basilico. La semplicità, fatta bene.',image:'photo-1572449043416-55f4685c9bb7',tags:['Vegano'],allergens:'Glutine (frumento).'},
    {name:'Il tagliere di Oliva',price:16,description:'Una selezione di salumi e formaggi italiani, confettura artigianale e pane caldo.',image:'photo-1452195100486-9cc805987862',tags:['Da condividere'],allergens:'Latte e derivati, glutine (frumento), frutta a guscio.'}
  ]},
  {id:'primi',name:'Primi',title:'Il cuore della tavola',dishes:[
    {name:'Spaghetto al pomodoro',price:13,description:'Spaghetti di Gragnano, pomodoro dolce e basilico appena colto. Il nostro grande classico.',image:'photo-1551183053-bf91a1d81141',badge:'Un classico',tags:['Vegano'],allergens:'Glutine (frumento).'},
    {name:'Tagliatelle al ragù',price:15,description:'Pasta fresca all’uovo e ragù di manzo cotto lentamente, con una spolverata di Parmigiano.',image:'photo-1555949258-eb67b1ef0ceb',tags:['Pasta fresca'],allergens:'Glutine (frumento), uova, latte, sedano, solfiti.'},
    {name:'Risotto di stagione',price:16,description:'Riso Carnaroli mantecato al Parmigiano, funghi e timo. Cremoso, profumato, avvolgente.',image:'photo-1473093295043-cdd812d0e601',tags:['Vegetariano'],allergens:'Latte e derivati, sedano, solfiti.'}
  ]},
  {id:'secondi',name:'Secondi',title:'I sapori che restano',dishes:[
    {name:'Tagliata al rosmarino',price:23,description:'Manzo alla griglia, patate dorate al forno e rosmarino fresco. Servita con olio extravergine.',image:'photo-1546833999-b9f581a1996d',tags:[],allergens:'Chiedere al personale per le preparazioni e i condimenti del giorno.'},
    {name:'Il pescato del giorno',price:24,description:'Filetto di pesce al forno con verdure di stagione, limone e olio alle erbe aromatiche.',image:'photo-1467003909585-2f8a72700288',badge:'Secondo il mercato',tags:[],allergens:'Pesce.'},
    {name:'L’orto nel piatto',price:15,description:'Verdure arrosto, hummus di ceci, semi tostati e una fresca salsa al limone.',image:'photo-1512621776951-a57141f2eefd',tags:['Vegano'],allergens:'Sesamo.'}
  ]},
  {id:'dolci',name:'Dolci',title:'Un finale felice',dishes:[
    {name:'Il nostro tiramisù',price:7,description:'Savoiardi al caffè, crema al mascarpone e cacao amaro. Preparato ogni giorno, come a casa.',image:'photo-1571877227200-a0d98ea607e9',badge:'Fatto in casa',tags:['Vegetariano'],allergens:'Glutine (frumento), uova, latte e derivati.'},
    {name:'Una fetta di felicità',price:7,description:'Cheesecake cremosa con composta di frutti rossi su una base di biscotto croccante.',image:'photo-1533134242443-d4fd215305ad',tags:['Vegetariano'],allergens:'Glutine (frumento), uova, latte e derivati.'}
  ]},
  {id:'bevande',name:'Da bere',title:'Un brindisi alle cose belle',dishes:[
    {name:'Un calice, per favore',price:6,description:'Bianco o rosso della casa, selezionato da piccole cantine italiane. Chiedici l’etichetta del giorno.',image:'photo-1510812431401-41d2bd2722f3',tags:['Al calice'],allergens:'Solfiti.'},
    {name:'Limonata della casa',price:5,description:'Limoni, acqua frizzante e menta fresca. Preparata al momento, naturalmente dissetante.',image:'photo-1513558161293-cdaf765edfd7',tags:['Analcolico'],allergens:'Nessun allergene previsto nella ricetta; verificare con il personale.'},
    {name:'Caffè, e poi con calma',price:2,description:'Il nostro espresso italiano. Il piccolo rito che conclude ogni buon pranzo.',image:'photo-1510707577719-ae7c14805e3a',tags:[],allergens:'Nessun allergene previsto nella ricetta; latte se richiesto.'}
  ]}
];
const money = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const categories = document.querySelector('#categories');
const dishes = document.querySelector('#dishes');
const dialog = document.querySelector('#dish-dialog');
let selectedCategory = menu[0];
let lastTrigger;
function renderCategory(category){
  selectedCategory = category;
  categories.querySelectorAll('button').forEach(button=>{const active=button.dataset.category===category.id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelector('#category-title').textContent=category.title;
  document.querySelector('#category-number').textContent=`0${menu.indexOf(category)+1} / LA CARTA`;
  document.querySelector('#dish-count').textContent=`${category.dishes.length} proposte`;
  dishes.replaceChildren();
  category.dishes.forEach((dish,index)=>{
    const card=document.createElement('button');card.className='dish-card';card.style.setProperty('--i',index);card.setAttribute('aria-label',`${dish.name}, ${money(dish.price)}. Scopri ingredienti e allergeni`);
    card.innerHTML=`<span class="dish-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="dish-content">${dish.badge?`<span class="dish-badge">✳ ${dish.badge}</span>`:''}<div class="dish-heading"><h4>${dish.name}</h4><span class="price-leader" aria-hidden="true"></span><span class="dish-price">${money(dish.price)}</span></div><p class="dish-description">${dish.description}</p><div class="tags">${dish.tags.map(tag=>`<span class="tag">${tag==='Vegetariano'||tag==='Vegano'?'❧ ':''}${tag}</span>`).join('')}</div></div><div class="dish-photo"><img src="${photo(dish.image)}" alt="" loading="lazy"><span class="dish-arrow" aria-hidden="true">↗</span></div>`;
    card.addEventListener('click',()=>openDish(dish,card));dishes.append(card);
  });
}
menu.forEach((category,index)=>{const button=document.createElement('button');button.className='category-button';button.innerHTML=`<span class="category-index" aria-hidden="true">0${index+1}</span><span>${category.name}</span><span class="category-arrow" aria-hidden="true">↗</span>`;button.dataset.category=category.id;button.addEventListener('click',()=>{renderCategory(category);button.scrollIntoView({block:'nearest',inline:'nearest'});});categories.append(button);});
function openDish(dish,trigger){
  lastTrigger=trigger;
  const img=document.querySelector('#detail-image');img.src=photo(dish.image);img.alt=dish.name;
  document.querySelector('#detail-label').textContent=selectedCategory.name;
  document.querySelector('#detail-title').textContent=dish.name;
  document.querySelector('#detail-price').textContent=money(dish.price);
  document.querySelector('#detail-description').textContent=dish.description;
  document.querySelector('#detail-allergens').textContent=dish.allergens;
  document.querySelector('#detail-tags').replaceChildren(...dish.tags.map(tag=>{const el=document.createElement('span');el.className='tag';el.textContent=tag;return el;}));
  dialog.setAttribute('aria-labelledby','detail-title');dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';
}
document.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.style.overflow='';lastTrigger?.focus({preventScroll:true});});
renderCategory(menu[0]);
