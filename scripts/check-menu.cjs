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
const originals = source.menu.categories.flatMap(category => category.plus);
assert.equal(imported.length, originals.length);
assert.equal(new Set(imported.map(dish=>dish.id)).size, originals.length);
for(const original of originals){
  const dish = imported.find(item=>item.id === String(original.id));
  assert.ok(dish, `Voce mancante: ${original.id}`);
  assert.equal(dish.price, Number(original.price), `Prezzo modificato: ${original.id}`);
  assert.equal(dish.sourceDescription, original.description || '');
  assert.ok(dish.name.trim());
  assert.equal(dish.hasSourceAsterisk, (original.name+(original.description||'')).includes('*'));
  if (!original.description.trim()) assert.equal(dish.description, '', `Descrizione inventata: ${original.id}`);
}
assert.equal(categories.find(c=>c.id==='baby').name, 'Panini baby');
assert.equal(categories.find(c=>c.id==='ufficiali').name, 'Ufficiali');
assert.ok(categories.find(c=>c.id==='ufficiali').subtitle.includes('impasto della pizza'));
assert.equal(imported.find(d=>d.id==='615').price, 0.5);
assert.equal(imported.find(d=>d.id==='8').price, 6.5);
const originalMissing = originals.filter(d=>!d.description.trim()).length;
console.log(`PASS: tutte le ${originals.length} voci presenti una volta, prezzi identici, ${originalMissing} descrizioni mancanti non inventate e asterischi originali conservati; ${categories.length} categorie.`);
