"""Read-only checks against the running local demo."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1512,'height':1080})
    errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:4317', wait_until='networkidle')
    expect(page.locator('.brand b')).to_have_text('买汰烧')
    assert page.locator('.brand-mark').evaluate('(img)=>img.complete && img.naturalWidth > 0')
    page.screenshot(path=str(OUT/'maitaishao-home.png'),full_page=True)
    page.evaluate('''() => {window.cookingStages=[];new MutationObserver(ms=>ms.forEach(m=>{if(m.target.tagName==='COOKING-SCENE') window.cookingStages.push(m.target.dataset.stage)})).observe(document.querySelector('dialog'),{subtree:true,attributes:true,attributeFilter:['data-stage']})}''')
    page.locator('.dish-name').first.click()
    scene=page.locator('cooking-scene')
    expect(scene).to_have_attribute('data-stage','2',timeout=4000)
    assert page.locator('.cooking-stove').bounding_box()['height'] > 130
    page.screenshot(path=str(OUT/'maitaishao-cooking.png'))
    expect(scene).to_have_attribute('data-stage','4',timeout=4000)
    assert set(['0','1','2','3','4']).issubset(set(page.evaluate('cookingStages')))
    page.get_by_role('button',name='再做一次').click()
    expect(scene).to_have_attribute('data-stage','0')
    page.keyboard.press('Escape')
    expect(page.locator('dialog')).not_to_be_visible()
    page.locator('.dish-name').first.click()
    page.emulate_media(reduced_motion='reduce')
    expect(scene).to_have_attribute('data-stage','4')
    assert scene.evaluate('(e)=>e.getAnimations({subtree:true}).filter(a=>a.playState==="running").length') == 0
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('.dish-name').first.click()
    expect(scene).to_have_attribute('data-stage','4')
    assert page.evaluate('document.body.scrollWidth') <= 390
    assert page.locator('dialog').evaluate('(e)=>e.scrollWidth <= e.clientWidth')
    assert page.locator('.cooking-replay').bounding_box()['height'] >= 44
    page.screenshot(path=str(OUT/'maitaishao-cooking-mobile.png'))
    assert errors == [], errors
    (OUT/'animation-results.json').write_text(json.dumps({'stages':[0,1,2,3,4],'replay':True,'escape':True,'reducedMotion':True,'mobileOverflow':False,'jsErrors':errors}),encoding='utf-8')
    print('PASS brand, four animation stages, replay, close, reduced motion, mobile width, console')
    browser.close()
