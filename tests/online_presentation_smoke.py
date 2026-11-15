"""Verify the published loading page, compact header, avatars and fish animation; read-only."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
config = json.loads((ROOT / 'data/share-config.json').read_text(encoding='utf-8-sig'))
SITE = 'https://zzyfsniper-code.github.io/maitaishao/'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1512,'height':1080})
    errors, pending, failed_assets = [], [], []
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('response',lambda r: failed_assets.append(r.url) if r.status>=400 and '/maitaishao/' in r.url else None)
    page.route(config['apiBase'] + '/api/state',lambda route: pending.append(route))
    page.goto(SITE,wait_until='domcontentloaded',timeout=60000)
    expect(page.locator('#group-passcode')).to_be_visible(timeout=30000)
    page.locator('#group-passcode').fill(config['passcode'])
    page.get_by_role('button',name='进入厨房',exact=True).click()
    loader = page.locator('.kitchen-loading cooking-scene')
    expect(loader).to_be_visible(timeout=30000)
    expect(loader).to_have_attribute('data-stage','2',timeout=5000)
    page.screenshot(path=str(OUT / 'online-loading.png'))
    assert len(pending)==1
    pending.pop().continue_()
    page.unroute(config['apiBase'] + '/api/state')
    expect(page.locator('.meal-card')).to_have_count(3,timeout=30000)
    expect(page.locator('.kitchen-loading')).to_have_count(0)
    assert page.locator('.menu-intro').bounding_box()['height'] <= 90
    expect(page.locator('.hero')).to_have_count(0)
    expect(page.locator('.brand-mark')).to_have_attribute('src','./assets/maitaishao-icon-v2.png')
    page.wait_for_function('Array.from(document.querySelectorAll(".brand-mark,.menu-intro img")).every(e=>e.complete && e.naturalWidth>0)',timeout=45000)
    page.screenshot(path=str(OUT / 'online-compact-header.png'),full_page=True)
    page.locator('nav [data-page="family"]').click()
    page.wait_for_function('Array.from(document.querySelectorAll(".portrait img")).every(e=>e.complete && e.naturalWidth>0)',timeout=45000)
    assert page.locator('.portrait img').count() >= 3
    page.screenshot(path=str(OUT / 'online-family-avatars.png'),full_page=True)
    page.locator('nav [data-page="recipes"]').click()
    page.locator('#recipe-search').fill('清蒸鲈鱼')
    page.locator('[data-action="recipe"]').first.click()
    fish=page.locator('dialog cooking-scene')
    expect(fish).to_have_attribute('data-recipe','steamed-fish')
    expect(fish).to_have_attribute('data-stage','2',timeout=4000)
    expect(fish).to_have_attribute('data-stage','4',timeout=5000)
    page.screenshot(path=str(OUT / 'online-fish-served.png'))
    page.keyboard.press('Escape')
    page.locator('nav [data-page="menu"]').click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.locator('.menu-intro').bounding_box()['height'] <= 90
    assert page.evaluate('document.body.scrollWidth') <= 390
    page.screenshot(path=str(OUT / 'online-compact-mobile.png'),full_page=True)
    assert not errors, errors
    assert not failed_assets, failed_assets
    (OUT / 'online-presentation-results.json').write_text(json.dumps({'url':SITE,'loginLoading':True,'automaticExit':True,'compactHeader':True,'avatarsLoaded':True,'fishAnimation':True,'mobileOverflow':False,'jsErrors':errors,'failedAssets':failed_assets}),encoding='utf-8')
    print('PASS online login loading, compact family strip, new logo/avatars, fish animation and mobile')
    browser.close()
