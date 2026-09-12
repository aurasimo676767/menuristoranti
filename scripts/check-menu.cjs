const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/menu-source.json'), 'utf8')).data;
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'menu-data.js'), 'utf8'), context);
const categories = context.window.MENU_DATA.categories;
const imported = categories.flatMap(category => category.dishes);
const sourceItems = imported.filter(dish=>!dish.id.startsWith('piadina-'));
const excludedCategoryIds = new Set([2517]);
const excludedItemIds = new Set([428,471,472,569,575,586,587,594]);
const originals = source.menu.categories
  .filter(category=>!excludedCategoryIds.has(category.id))
  .flatMap(category => category.plus)
  .filter(dish=>!excludedItemIds.has(dish.id));
assert.equal(sourceItems.length, originals.length);
assert.equal(new Set(sourceItems.map(dish=>dish.id)).size, originals.length);
for(const id of excludedItemIds) assert.equal(imported.some(dish=>dish.id===String(id)), false, `Voce rimossa ancora pubblicata: ${id}`);
assert.equal(categories.some(category=>category.id==='menu8'), false, 'Menu da 8 € ancora pubblicato');
assert.equal(categories.some(category=>category.id==='panini-dolci'), false, 'Panini dolci ancora pubblicato');
for(const original of originals){
  const dish = sourceItems.find(item=>item.id === String(original.id));
  assert.ok(dish, `Voce mancante: ${original.id}`);
  assert.equal(dish.price, Number(original.price), `Prezzo modificato: ${original.id}`);
  assert.equal(dish.sourceDescription, original.description || '');
  assert.ok(dish.name.trim());
  assert.equal(dish.hasSourceAsterisk, (original.name+(original.description||'')).includes('*'));
  if (!original.description.trim()) assert.equal(dish.description, '', `Descrizione inventata: ${original.id}`);
}
assert.equal(categories.find(c=>c.id==='baby').name, 'Panini baby');
const baby = categories.find(c=>c.id==='baby');
const piadine = categories.find(c=>c.id==='piadine');
assert.equal(piadine.name, 'Piadine');
assert.equal(piadine.dishes.length, baby.dishes.length);
for(const babyDish of baby.dishes){
  const piadina = piadine.dishes.find(dish=>dish.id===`piadina-${babyDish.id}`);
  assert.ok(piadina, `Piadina mancante: ${babyDish.name}`);
  assert.equal(piadina.price, babyDish.price, `Prezzo piadina errato: ${babyDish.name}`);
  assert.equal(piadina.name, babyDish.name, `Nome piadina errato: ${babyDish.name}`);
  assert.equal(piadina.description, babyDish.description, `Descrizione piadina errata: ${babyDish.name}`);
}
assert.equal(categories.find(c=>c.id==='ufficiali').name, 'Ufficiali');
assert.ok(categories.find(c=>c.id==='ufficiali').subtitle.includes('impasto della pizza'));
assert.equal(imported.find(d=>d.id==='615').price, 0.5);
assert.equal(imported.find(d=>d.id==='8').price, 6.5);
const originalMissing = originals.filter(d=>!d.description.trim()).length;
console.log(`PASS: tutte le ${originals.length} voci sorgente presenti una volta, ${piadine.dishes.length} piadine con gli stessi prezzi dei Panini baby, ${originalMissing} descrizioni mancanti non inventate e asterischi originali conservati; ${categories.length} categorie.`);
