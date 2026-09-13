// Importazione riproducibile: ogni voce conserva ID, prezzo e testo di origine.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/menu-source.json'), 'utf8')).data;
const definitions = [
  ['panini','Panini','I nostri panini'],
  ['baby','Panini baby','Tutto il gusto, in formato baby'],
  ['piadine','Piadine','Le farciture dei Panini baby, in versione piadina.'],
  ['ufficiali','Ufficiali','Panini più grandi, preparati con impasto della pizza.'],
  ['crepes','Crêpes salate','Le nostre farciture in una crêpe'],
  ['wrap','Wrap','Le nostre proposte in versione wrap'],
  ['pizze','Pizze','Le pizze al piatto'],
  ['maxi','Pizze maxi','Le pizze in formato maxi'],
  ['fritti','Friggitoria','Uno sfizio da aggiungere'],
  ['crepes-dolci','Crêpes dolci','Per chiudere in dolcezza'],
  ['pizze-dolci','Pizze dolci','Le nostre pizze da dessert'],
  ['dessert','Waffle e dolci','Waffle, krapfen e altri dolci'],
  ['bevande','Bevande','Acqua e bevande analcoliche'],
  ['birre','Birre','La selezione di birre'],
  ['extra','Supplementi e coperto','Aggiunte, coperto e posate']
];
// Voci rimosse su richiesta del locale: non vengono pubblicate nel menu.
const excludedCategoryIds = new Set([2517]);
const excludedItemIds = new Set([278,428,471,472,569,575,586,587,594]);
const menu = definitions.map(([id,name,subtitle])=>({id,name,title:name,subtitle,dishes:[]}));
const categoryMap={2500:'panini',2501:'crepes',2502:'wrap',2503:'baby',2504:'pizze',2505:'pizze-dolci',2506:'maxi',2508:'fritti',2509:'bevande',2516:'ufficiali',609:'extra',2520:'dessert'};
const sweetCrepes=new Set([473,468,535,467,469,470,570,262,358,357,362,359,360,364,361,363,588,591,589,590,584,583,577,578,585,582,366,576,596]);
const sweetPizzas=new Set([558,567,573,282,574,352]);
const beers=new Set([274,268,273,269,275,276,270,272]);
const friedItemsAtSixEuro = new Set([258,442,264,437,447,452,434,263,261,260,446,453]);
const nameOverrides={
  31:'Bocconcini di cavallo',422:'Bocconcini di cavallo',321:'Cotoletta della casa',460:'Hamburger di Chianina',570:'Kinder Cereali',
  20:'Cordon bleu della casa*',68:'Cordon bleu della casa*',116:'Cordon bleu della casa*',
  79:'Bocconcini di cavallo',78:'Carne di cavallo',80:'Polpetta di cavallo',127:'Bocconcini di cavallo',128:'Polpetta di cavallo',
  2:'Spizzicagnolo della casa',50:'Spizzicagnolo della casa',51:'Spizzicagnolo',98:'Spizzicagnolo della casa',160:'Spizzicagnolo',441:'Spizzicagnolo della casa',
  96:'Fantasia di Andrea',144:'Fantasia di Andrea',137:'Porchetta della casa',443:'Cordon bleu della casa',
  15:'Petto di pollo',16:'Rustico',63:'Petto di pollo',64:'Rustico',
  421:'Bufalo Billy',431:'Extra Large',440:'Marco',
  162:'Faccia di vecchia',203:'Faccia di vecchia maxi',178:'007',219:'007',187:'Cocktail di gamberi',228:'Cocktail di gamberi',
  566:'Sapori gourmet',
  258:'Anelli di cipolla in pastella',442:'Bastoncini di pollo',264:'Crocchette di patate',437:'Camembert',447:'Cheese wedges',452:'Crispy',434:'Jalapeños',263:'Mini fagottini al formaggio',261:'Mozzarelle impanate',260:'Nachos al formaggio',446:'Nuggets',
  279:'Acqua naturale',466:'Coca-Cola in bottiglia',277:'Coca-Cola grande',458:'Estathé alla pesca',459:'Estathé al limone',454:'Coca-Cola in lattina',455:'Coca-Cola Zero in lattina',456:'Pepsi in lattina',465:'Lemonsoda',451:'Pepsi grande',461:'Red Bull',267:'Fanta in lattina',
  343:'A modo mio',336:'Cotoletta della casa',410:'Cordon bleu',405:'Polpetta di cavallo',385:'Pata',367:'Vuoto',607:'Bocconcini di cavallo',610:'Cordon bleu della casa',611:'Cotoletta della casa',605:'Cicciuzzo',354:'Deer',375:'Tsunami',383:'Superbomber',
  262:'Banana',358:'Banatella DOC',357:'Bianca e nera',362:'Colorata',359:'Croccante',360:'Deliziosa',364:'Fantasia dello chef',361:'Nutella bis',363:'Raffaello',
  473:'Cioccolato bianco',588:'Cioccolato bianco',591:'Crema di fragola',589:'Crema pasticcera',590:'Crema di vaniglia',584:'Kinder Cereali',
  468:'Nutella e noccioline',577:'Nutella e noccioline',535:'Nutella e mascarpone',583:'Nutella e mascarpone',467:'Nutella',576:'Nutella',
  469:'Nutella e ricotta',585:'Nutella e ricotta',470:'Ricotta e pistacchio',582:'Ricotta e pistacchio',578:'Crema al pistacchio',366:'Nutella e panna',596:'Pistacchiosa',
  579:'Waffle alla Nutella',580:'Waffle al pistacchio*',558:'Nutella e noccioline',567:'Kinder Cereali',573:'Nutella e ricotta',282:'Nutella',574:'Ricotta e pistacchio',352:'Nutella maxi',199:'Nutella, ricotta e cannella',593:'Kiko maxi'
};
function cleanName(raw,id){
  if(nameOverrides[id])return nameOverrides[id];
  let s=raw.trim().toLowerCase().replace(/\s+/g,' ')
    .replace(/^(?:crep(?:es?)?|wrap|ufficiale|ufficciale|uffic\.?|uff\.?|ufficial)\s+/,'')
    .replace(/\btsunamy\b/g,'tsunami').replace(/\bexstra\b/g,'extra')
    .replace(/\bpolp\./g,'polpetta').replace(/\bcavall\b/g,'cavallo')
    .replace(/\bcordonbleu\b/g,'cordon bleu').replace(/\bsuper big\b/g,'superbig')
    .replace(/\bsuper bomber\b/g,'superbomber').replace(/\bpetto pollo\b/g,'petto di pollo')
    .replace(/\bcarne cavallo\b/g,'carne di cavallo').replace(/\bpolpette cavallo\b/g,'polpette di cavallo')
    .replace(/^4 /,'Quattro ').replace(/\bmax\b/g,'maxi')
    .replace(/\b(andrea|marco|bruno|giuvanni|bill)\b/g,word=>word[0].toUpperCase()+word.slice(1));
  return s.charAt(0).toUpperCase()+s.slice(1);
}
// Correzioni puntuali delle descrizioni meno strutturate.
const descriptionOverrides={
  15:'Petto di pollo, lattuga, patatine, sale, olio, origano, K, M.',
  271:'Porchetta, mozzarella, patatine*, K, M.',
  11:'Hamburger, derivati del latte, porchetta, lattuga, mozzarella, patatine, sale, olio, origano, K, M, aromi naturali.',
  321:'Pollo, uova, pangrattato, aromi naturali, patatine*, K, M.',
  6033:'Scottona, polpetta di cavallo, bacon, pollo, pomodoro, funghi dolci, cheddar, fontina, mozzarella, lattuga, patatine*, K, M.',
  46:'Hamburger di scottona polacca, pomodoro, cheddar, rucola, aceto balsamico, patatine, K, M, olio, sale, aromi, derivati del latte.',
  48:'Condimenti a fantasia, patatine* e salse varie.',
  460:'Hamburger* di Chianina, pomodoro, lattuga, mozzarella, patatine*, ketchup, maionese, olio extravergine di oliva, origano e aromi misti contenenti paprika.',
  1:'Polpetta di cavallo, porchetta artigianale, cipolla, mozzarella, aglio, aromi, patatine*, K, M, aromi naturali.',
  47:'Pulled pork di suino, cipolla croccante, salsa barbecue, M, aromi naturali, origano, olio extravergine di oliva, sale, patatine fritte e cheddar.',
  570:'Nutella alla nocciola, crema bianca e cereali soffiati.',
  414:'Ventricina piccante, mozzarella, emmental, funghi dolci, patatine, Tabasco, K, M, harissa, olio e origano.',
  21:'Coscia di pollo disossata, derivati del latte, hamburger, porchetta, mozzarella, olive, lattuga, patatine, sale, olio, origano, K, M.',
  426:'Prosciutto cotto, würstel, mozzarella, emmental, patatine, K, M.',
  59:'Hamburger, derivati del latte, porchetta, lattuga, mozzarella, patatine, sale, olio, origano, K, M, aromi naturali.',
  49:'Polpetta di cavallo*, derivati del latte, porchetta artigianale, cipolla, mozzarella, aglio, aromi naturali, patatine, origano, K, M.',
  55:'Hamburger, derivati del latte, aromi naturali, lattuga, patatine, sale, olio, origano, ketchup e maionese.',
  69:'Coscia di pollo disossata, hamburger, derivati del latte, porchetta, mozzarella, pomodoro, olive, lattuga, patatine, sale, olio, origano, K, M.',
  349:'Pulled pork, cipolla, cheddar, salsa barbecue, maionese e patatine*.',
  350:'Pulled pork, cheddar, cipolla, salsa barbecue, maionese e patatine*.',
  559:'Porchetta, würstel, patatine*, cipolla, mozzarella, K, M.',560:'Porchetta, würstel, cipolla, mozzarella, patatine*, K, M.',
  424:'Carne di cavallo*, porchetta, cipolla, lattuga, mozzarella, patatine, sale, olio extravergine di oliva e aromi naturali.',
  430:'Carne di Angus, pomodoro, lattuga, patatine, K, M, sale, olio extravergine di oliva e aromi naturali.',
  422:'Carne di cavallo*, peperoni, cipolla, mozzarella, patatine, K, M, sale, olio extravergine di oliva e aromi naturali.',
  565:'Hamburger, porchetta, lattuga, mozzarella, patatine*, sale, olio, origano, K, M.',
  421:'Carne di bufalo, emmental, cipolla, lattuga, patatine, K, M, olio extravergine di oliva, sale e aromi naturali.',
  420:'Carne di asina, mozzarella, cipolla, lattuga, patatine, K, M, sale, olio extravergine di oliva e aromi naturali.',
  443:'Cotoletta di pollo, prosciutto, mozzarella, olive, patatine, sale, olio, origano, K, M.',
  436:'Hamburger di cervo, cipolla, patatine, sale, olio, origano, K, M.',
  431:'Pancetta di maiale, porchetta, mozzarella, olive, patatine, sale, olio extravergine di oliva, aromi naturali, K, M.',
  450:'Hamburger di scottona polacca, pomodoro, cheddar, mozzarella, rucola, aceto balsamico, patatine, sale, olio extravergine di oliva, origano, K, M.',
  429:'Mix di carne e formaggi, cipolla, sottoli, patatine, K e M oppure salsa barbecue, olio extravergine di oliva e aromi naturali.',
  439:'Hamburger di Chianina, pomodoro, cheddar, lattuga, patatine, sale, olio extravergine di oliva, origano, K, M.',
  419:'Polpetta di cavallo*, cipolla, prosciutto, mozzarella, grana, patatine, K, M, aromi naturali.',
  563:'Salsiccia, porchetta, mozzarella, cipolla, patatine*, sale, olio, origano, K, M.',
  449:'Ventricina piccante, prosciutto, würstel, mozzarella, cipolla, patatine, harissa, M.',
  416:'Kebab, pomodoro, lattuga, mozzarella, yogurt e harissa.',
  440:'Polpetta di cavallo*, porchetta artigianale, cipolla, mozzarella, aglio, aromi naturali, patatine, origano, K, M.',
  413:'Polpetta di cavallo*, ventricina piccante, mozzarella, olive, patatine, K e M.',
  412:'Polpetta, mozzarella, olive, funghi, patatine, K e M, aglio e aromi naturali.',
  561:'Porchetta, würstel, mozzarella, cipolla, patatine*, K, M.',
  435:'Petto di pollo, prosciutto, mozzarella, patatine, sale, olio extravergine di oliva, origano, K, M.',
  432:'Petto di pollo, speck, mozzarella, lattuga, patatine, K, M, sale, olio extravergine di oliva e aromi naturali.',
  441:'Prosciutto, lattuga, mozzarella, pomodoro, olive, sale, olio extravergine di oliva e origano.',
  448:'Carne di Angus, vitello, pomodoro, cheddar o mozzarella, lattuga, salsa barbecue, M, carota, cipolla, sedano, patatine, sale, olio extravergine di oliva e origano.',
  427:'Braciola di pollo, hamburger, porchetta, mozzarella, pomodoro, lattuga, olive, patatine, K, M, olio extravergine di oliva e aromi naturali.',
  423:'Braciola di pollo, porchetta, mozzarella, pomodoro, olive, lattuga, patatine, sale, olio extravergine di oliva, aromi naturali, K, M.',
  425:'Prosciutto cotto, würstel, mozzarella, emmental, patatine, K, M.',
  417:'Cavallo*, ventricina piccante, mozzarella, emmental, cipolla, patatine, K, M.',
  438:'Porchetta, prosciutto, ventricina piccante, mozzarella, funghi, patatine, sale, olio extravergine di oliva, K, M.',
  418:'Braciola di pollo, mozzarella, pomodoro, olive, lattuga, patatine, K, M.',
  568:'Mozzarella, pistacchio, mortadella, burrata, aromi naturali e olio extravergine di oliva.',
  195:'Mozzarella, crema di carciofi, speck, olio extravergine di oliva e origano.',
  557:'Base bianca, mozzarella, cheddar, pulled pork, maionese e salsa barbecue.',
  571:'Salsa, mozzarella, salsa yogurt, harissa e patatine*.',
  567:'Nutella alla nocciola, crema bianca alla nocciola e cereali soffiati.',
  566:'Mozzarella, porcini, filetto di vitello e pesto di mandorle.',
  572:'Mozzarella, pistacchio, mortadella, burrata, aromi naturali, crema di pistacchio, origano e olio extravergine di oliva.',
  415:'Kebab, mozzarella, salsa di pomodoro, yogurt e harissa.',
  593:'Base bianca, mozzarella, cheddar, pulled pork, cipolla croccante, salsa barbecue e maionese.',
  352:'Pizza alla Nutella Ferrero.',451:'Pepsi in bottiglia.',
  343:'Cavallo, porchetta, mozzarella, cipolla, lattuga, K, M, patatine*, aromi misti, olio e sale.',
  403:'Porchetta, mozzarella, patatine*, K, M.',
  602:'Ventricina, emmental, mozzarella, patatine*, K, M, harissa e funghi.',
  562:'Porchetta, würstel, cipolla, mozzarella, patatine*, K, M.',
  605:'Carne di asina, cipolla, mozzarella, lattuga, patatine*, K, M, aromi naturali, olio e origano.',
  354:'Hamburger di cervo, cipolla, patatine, sale, origano, K, M.',
  598:'Ventricina piccante, mozzarella, patatine*, K, M.',
  377:'Porchetta artigianale, mozzarella, patatine*, K, M, sale e aromi misti.',
  375:'Porchetta, ventricina, prosciutto, mozzarella, funghi, patatine*, K, M, sale, olio e origano.',
  284:'Salsiccia, patatine*, K, M, sale.',
  382:'Braciola di pollo, porchetta, mozzarella, pomodoro, lattuga, olive, patatine*, K, M, origano, sale, aromi misti e olio.',
  383:'Braciola di pollo, hamburger, porchetta, pomodoro, lattuga, olive, mozzarella, patatine*, K, M, olio, sale, origano, aromi misti e derivati del latte.',
  376:'Prosciutto, würstel, mozzarella, emmental, patatine*, K, M, sale.',
  372:'Angus, lattuga, pomodoro, patatine*, K, M, aromi misti, sale, olio e origano.',
  373:'Cavallo, ventricina piccante, cipolla, mozzarella, emmental, patatine*, K, M, sale, olio, aromi misti e origano.',
  368:'Kebab*, pomodoro, lattuga, mozzarella, salsa harissa, yogurt, olio, sale, origano e patatine*.',
  365:'Pulled pork di suino, cheddar, patatine*, cipolla croccante, salsa barbecue e maionese.',
  266:'Polpetta di cavallo, mollica di pane, cipolla, mozzarella, derivati del latte, patatine*, K, M.',
  378:'Pollo, speck, mozzarella, lattuga, patatine*, sale, olio, origano e aromi misti.',
  362:'Nutella, panna e Smarties.',575:'Farcito con crema.',596:'Crema al pistacchio, crema bianca e granella di pistacchio.'
};
// Descrizioni dell'originale separate da virgole: espansioni lessicali, non ricette nuove.
const rules=[
  [/carne c\*avallo/gi,'carne di cavallo*'],[/carne cavallo/gi,'carne di cavallo'],[/carne bufala/gi,'carne di bufala'],[/carne asina/gi,'carne di asina'],[/carne vitello/gi,'carne di vitello'],
  [/cosc\.pol[l]?o dissos/gi,'coscia di pollo disossata'],[/petto pollo imp/gi,'petto di pollo impanato'],[/petto pollo/gi,'petto di pollo'],
  [/cotol\*pollo/gi,'cotoletta* di pollo'],[/cotol\.pollo/gi,'cotoletta di pollo'],[/panc\.maiale/gi,'pancetta di maiale'],
  [/polp\.\s*(?:di\s+)?cavall(?:o)?/gi,'polpetta di cavallo'],[/pol\.cavallo/gi,'polpetta di cavallo'],
  [/hamb\.scottona polacc/gi,'hamburger di scottona polacca'],[/hamb\.chianina/gi,'hamburger di Chianina'],[/hamb\.cervo/gi,'hamburger di cervo'],
  [/prosc?\.\s*(?:di\s+)?spalla/gi,'prosciutto di spalla'],[/prosc\.cotto/gi,'prosciutto cotto'],[/prosc\.crudo/gi,'prosciutto crudo'],
  [/ventr\.picc/gi,'ventricina piccante'],[/ventricina picc\b\.?/gi,'ventricina piccante'],[/funghi picc/gi,'funghi piccanti'],[/olive snocc/gi,'olive snocciolate'],
  [/aceto bals\b/gi,'aceto balsamico'],[/aromi nat\b/gi,'aromi naturali'],[/scamorza aff\b/gi,'scamorza affumicata'],[/melanz\.fritta/gi,'melanzana fritta'],
  [/funghi champ\b/gi,'funghi champignon'],[/crema zucca/gi,'crema di zucca'],[/pesto pistacchio/gi,'pesto di pistacchio'],[/petali grana/gi,'petali di grana'],[/coscia pollo/gi,'coscia di pollo'],
  [/mozz\.bufala/gi,'mozzarella di bufala'],[/porch\.?\s*al forno/gi,'porchetta al forno'],[/porch\.\s*artigianale/gi,'porchetta artigianale'],
  [/\bporch\b\.?/gi,'porchetta'],[/\bmozz\b\.?/gi,'mozzarella'],[/\bprosc\b\.?/gi,'prosciutto'],[/\bpatat\b/gi,'patatine'],[/\bpata\b/gi,'patatine'],[/\bpat\b/gi,'patatine'],
  [/orig\.k\.m/gi,'origano, K, M'],[/\borig\b\.?/gi,'origano'],[/\bemmenthal\b/gi,'emmental'],[/\bpom(?:od)?\b\.?/gi,'pomodoro'],[/\blatt(?:ug)?\b/gi,'lattuga'],[/\bsalsicc\b/gi,'salsiccia'],
  [/\bhamb\b/gi,'hamburger'],[/\bvitel\b/gi,'vitello'],[/\bsedan\b/gi,'sedano'],[/\bpeperonc\b/gi,'peperoncino'],[/\btacch\b/gi,'tacchino'],
  [/\bsal\b/gi,'sale'],[/\bkatchup\b/gi,'ketchup'],[/\bmayo\b/gi,'maionese'],[/\bwurstel\b/gi,'würstel'],[/\bbbq\b/gi,'salsa barbecue'],[/\bphiladelphia\b/gi,'Philadelphia'],
  [/\bk\.?\s*[, .]\s*m\.?\b/gi,'K, M'],[/\bk\b\.?/gi,'K'],[/\bm\b\.?/gi,'M'],[/olio evo/gi,'olio extravergine di oliva'],
  [/\*t\b/g,'*'],[/\*(?=[a-z])/gi,'*, '],[/origano(?=K)/g,'origano, '],[/patatine\.origano/g,'patatine, origano'],
  [/ricotta spinaci/g,'ricotta, spinaci'],[/sale aromi/g,'sale, aromi'],[/\btabasco\b/gi,'Tabasco'],
];
function cleanDescription(raw,id,category){
  if(descriptionOverrides[id])return descriptionOverrides[id];
  let s=(raw||'').trim();if(!s)return '';
  for(const [pattern,replacement] of rules)s=s.replace(pattern,replacement);
  s=s.replace(/\s*,\s*/g,', ').replace(/(?:,\s*){2,}/g,', ').replace(/\s+/g,' ').replace(/[,.\s]+$/,'').trim();
  return s.charAt(0).toUpperCase()+s.slice(1)+'.';
}
const changes=[];
for(const category of source.menu.categories){
  if(excludedCategoryIds.has(category.id)) continue;
  for(const p of category.plus){
    if(excludedItemIds.has(p.id)) continue;
    let target=categoryMap[category.id];
    if(sweetCrepes.has(p.id))target='crepes-dolci';
    if(sweetPizzas.has(p.id))target='pizze-dolci';
    if(beers.has(p.id))target='birre';
    const dish={id:String(p.id),name:cleanName(p.name,p.id),price:friedItemsAtSixEuro.has(p.id)?6:Number(p.price),description:cleanDescription(p.description,p.id,category.id),tags:[],image:null,sourceCategory:category.name,sourceName:p.name,sourceDescription:p.description||'',sourcePrice:p.price};
    if(category.id===2501&&target==='crepes-dolci')dish.variant='Carta crêpes';
    if(category.id===2520&&target==='crepes-dolci')dish.variant='Carta dessert';
    if(category.id===2504&&target==='pizze-dolci')dish.variant='Carta pizze';
    if(category.id===2505)dish.variant='Carta pizze dolci';
    if(p.id===352)dish.variant='Formato maxi';
    dish.hasSourceAsterisk=(p.name+(p.description||'')).includes('*');
    dish.hasSourceAbbreviations=/\b[KM]\b/.test(dish.description);
    dish.needsReview=[361,47,569,570,567,578,596].includes(p.id);
    menu.find(c=>c.id===target).dishes.push(dish);
    changes.push({id:dish.id,sourceCategory:category.name,category:target,oldName:p.name,name:dish.name,oldDescription:p.description||'',description:dish.description,price:p.price});
  }
}
const baby = menu.find(category=>category.id==='baby');
const piadine = menu.find(category=>category.id==='piadine');
piadine.dishes = baby.dishes.map(dish=>({...dish,id:`piadina-${dish.id}`}));
const drinks = menu.find(category=>category.id==='bevande');
const naturalWater = drinks.dishes.find(dish=>dish.id==='279');
drinks.dishes.push({...naturalWater,id:'acqua-frizzante',name:'Acqua frizzante'});
const drinkOrder=['279','acqua-frizzante','277','466','454','455','267','457','461'];
drinks.dishes.sort((a,b)=>{
  const left=drinkOrder.indexOf(a.id),right=drinkOrder.indexOf(b.id);
  return (left===-1?drinkOrder.length:left)-(right===-1?drinkOrder.length:right);
});
const output={restaurantName:'Panineria Andrea',currency:source.currency,categories:menu};
fs.writeFileSync(path.join(root,'menu-data.js'),'// Menu importato: modificare i dati sorgente o lo script di importazione.\nconst initialMenuData = '+JSON.stringify(output,null,2)+';\nif (typeof window !== \'undefined\') window.MENU_DATA = initialMenuData;\nif (typeof module !== \'undefined\' && module.exports) module.exports = initialMenuData;\n');
fs.writeFileSync(path.join(root,'data/menu-changes.json'),JSON.stringify(changes,null,2)+'\n');
console.log(`${changes.length} voci importate più ${piadine.dishes.length} piadine in ${menu.length} categorie.`);
console.log(menu.map(c=>`${c.name}: ${c.dishes.length}`).join('\n'));
