// node scripts/check-browser.cjs [percorso modulo playwright] [eseguibile chromium]
const {chromium} = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const os = require('node:os');
(async()=>{
  const browser = await chromium.launch({headless:true, ...(process.argv[3] ? {executablePath:process.argv[3]} : {})});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'load',timeout:30000});
    assert.equal(await page.locator('.dish-card').count(),53);
    assert.equal(await page.locator('#drawer-categories button').count(),15);
    assert.equal(await page.locator('#quick-categories button').count(),6);
    assert.equal(await page.locator('.quick-category > span').count(),0);
    assert.equal(await page.locator('.category-button small').count(),0);
    assert.equal(await page.locator('.drawer-category small').count(),0);
    assert.equal(await page.locator('[data-dish-id="278"], [data-dish-id="471"], [data-dish-id="472"], [data-dish-id="569"], [data-dish-id="575"], [data-dish-id="586"], [data-dish-id="587"], [data-dish-id="594"]').count(),0);
    for(const category of await page.evaluate(()=>window.MENU_DATA.categories.map(c=>({id:c.id,count:c.dishes.length})))){
      await page.locator('.mobile-nav [data-open-categories]').click();
      await page.locator(`#drawer-categories [data-category="${category.id}"]`).click();
      assert.equal(await page.locator('.dish-card').count(), category.count);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow nella categoria ${category.id}`);
    }
    await page.evaluate(()=>selectCategory(window.MENU_DATA.categories.find(category=>category.id==='fritti')));
    assert.ok((await page.locator('[data-dish-id="258"] .dish-price').innerText()).includes('6,00'));
    await page.evaluate(()=>selectCategory(window.MENU_DATA.categories.find(category=>category.id==='extra')));
    assert.ok((await page.locator('[data-dish-id="615"] .dish-price').innerText()).includes('0,50'));
    await page.locator('[data-dish-id="615"]').click();
    assert.equal(await page.locator('#dish-dialog').evaluate(el=>el.open),true);
    assert.ok((await page.locator('#detail-price').innerText()).includes('0,50'));
    assert.equal(await page.locator('#detail-description').isHidden(),true);
    assert.equal(await page.locator('#detail-ingredients-label').isHidden(),true);
    assert.equal(await page.locator('#supplements').isHidden(),true);
    assert.equal(await page.locator('#dish-dialog').innerText().then(text=>text.includes('Gli ingredienti non sono indicati nel menu originale')),false);
    assert.ok((await page.locator('#detail-allergens').innerText()).includes('registro allergeni disponibile presso il personale'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dish-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.dishId),'615');
    await page.evaluate(()=>selectCategory(window.MENU_DATA.categories.find(category=>category.id==='panini')));
    await page.locator('[data-dish-id="1"]').click();
    assert.equal(await page.locator('#supplements').isVisible(),true);
    assert.ok((await page.locator('.supplement-spotlight').innerText()).includes('PATATINE A PARTE'));
    assert.equal(await page.locator('.supplement-group').count(),5);
    await page.locator('.supplement-group').first().locator('summary').click();
    assert.ok(await page.locator('.supplement-item').count()>0);
    await page.keyboard.press('Escape');
    await page.locator('#menu-search').fill('chianina');
    assert.ok(await page.locator('.dish-card').count()>1);
    await page.locator('#menu-search').fill('zzzinesistente');
    assert.equal(await page.locator('.dish-card').count(),0);
    await page.locator('.reset-search').click();
    await page.locator('.mobile-nav [data-open-categories]').click();
    await page.locator('#drawer-categories [data-category="ufficiali"]').click();
    assert.equal(await page.locator('#category-title').textContent(),'Ufficiali');
    await page.locator('.mobile-nav [data-open-categories]').click();
    await page.locator('#drawer-categories [data-category="panini"]').click();
    // Prima e ultima scheda di ogni categoria: il dettaglio deve restare legato al prodotto selezionato.
    const checked = await page.evaluate(()=>{
      let count=0;
      for(const category of window.MENU_DATA.categories){
        selectCategory(category);
        const buttons=[...document.querySelectorAll('.dish-card')];
        for(const i of new Set([0,buttons.length-1])){
          buttons[i].click();const dish=category.dishes[i];
          if(document.querySelector('#detail-title').textContent!==dish.name)throw new Error('Titolo '+dish.id);
          if(document.querySelector('#detail-price').textContent!==money(dish.price))throw new Error('Prezzo '+dish.id);
          document.querySelector('#dish-dialog').close();count++;
        }
      }
      selectCategory(window.MENU_DATA.categories[0]);return count;
    });
    assert.equal(checked, await page.evaluate(()=>window.MENU_DATA.categories.length*2));
    for(const width of [320,390,768,1366]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow a ${width}px`);
    }
    await page.setViewportSize({width:390,height:900});
    await page.evaluate(()=>document.querySelector('.menu-content').scrollIntoView({block:'start'}));
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-menu-mobile.png')});
    await page.locator('.mobile-nav [data-open-categories]').click();
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-menu-categories.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#category-dialog').evaluate(el=>el.open),false);
    await page.locator('.dish-card').first().click();
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-menu-detail.png')});
    await page.locator('.close-dialog').click();
    await page.setViewportSize({width:1366,height:950});
    await page.evaluate(()=>document.querySelector('.menu-content').scrollIntoView({block:'start'}));
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-menu-desktop.png')});
    await page.locator('.menu-sidebar [data-category="ufficiali"]').click();
    assert.equal(await page.locator('#category-title').textContent(),'Ufficiali');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-home-desktop.png')});
    await page.setViewportSize({width:390,height:900});
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-home-mobile.png')});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('.banner-motion').click();
    assert.equal(await page.locator('.banner-motion').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.banner-float').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
    await page.locator('.banner-motion').click();
    assert.equal(await page.locator('.banner-float').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
    for(const width of [320,390,1366]){
      await page.setViewportSize({width,height:950});
      await page.locator('.hero-visual').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow banner animato a ${width}px`);
    }
    const bannerBounds=await page.locator('.hero-visual').boundingBox();
    await page.mouse.move(bannerBounds.x+bannerBounds.width*.8,bannerBounds.y+bannerBounds.height*.4);
    assert.notEqual(await page.locator('.banner-frame').evaluate(el=>el.style.getPropertyValue('--ry')),'');
    await page.screenshot({path:path.join(os.tmpdir(),'andrea-banner-animated.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.banner-motion').waitFor({state:'hidden'});
    assert.equal(await page.locator('.banner-motion').isHidden(),true);
    assert.equal(await page.locator('.banner-float').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.deepEqual(errors,[]);
    const categoryCount = await page.evaluate(()=>window.MENU_DATA.categories.length);
    console.log(`PASS browser: ${categoryCount} categorie, ${checked} dettagli campionati, ricerca e stato vuoto, prezzi decimali, Escape e focus, nessun overflow a 320/390/768/1366 px, nessun errore JavaScript.`);
    console.log('Screenshot in '+os.tmpdir()+'/andrea-menu-{mobile,detail,desktop}.png');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
