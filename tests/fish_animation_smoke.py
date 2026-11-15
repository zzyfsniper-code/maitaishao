"""Read-only visual checks for the fish recipe and compact menu introduction."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1512,'height':1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:4317', wait_until='networkidle')
    assert page.locator('.menu-intro').bounding_box()['height'] <= 90
    expect(page.locator('.hero')).to_have_count(0)
    expect(page.locator('.menu-intro')).to_contain_text('位家人')
    page.screenshot(path=str(OUT / 'compact-menu-desktop.png'), full_page=True)
    page.locator('nav [data-page="recipes"]').click()
    page.locator('#recipe-search').fill('清蒸鲈鱼')
    page.locator('[data-action="recipe"]').first.click()
    scene = page.locator('cooking-scene')
    expect(scene).to_have_attribute('data-recipe','steamed-fish')
    expect(scene.locator('.cooking-pan')).to_have_count(0)
    assert scene.locator('.cooking-step-label').evaluate_all('(items)=>items.map(e=>e.firstChild.textContent)') == ['洗净','姜葱','清蒸','上桌']
    assert scene.locator('.cooking-step-label small').all_text_contents() == ['约 3 分钟','约 1 分钟','约 8 分钟','约 3 分钟']
    expect(scene.locator('.cooking-chef')).to_have_attribute('href','/assets/fish-chef-dad.png')
    scene.get_by_role('button', name='妈妈', exact=True).click()
    expect(scene.locator('.cooking-chef')).to_have_attribute('href','/assets/fish-chef-mom.png')
    expect(scene.locator('.cooking-chef-name')).to_have_text('妈妈掌勺')
    expect(scene).to_have_attribute('data-stage','1',timeout=3000)
    page.screenshot(path=str(OUT / 'fish-ginger.png'))
    expect(scene).to_have_attribute('data-stage','2',timeout=3000)
    page.wait_for_timeout(800)
    assert float(scene.locator('.fish-lid').evaluate('(e)=>getComputedStyle(e).opacity')) > .9
    page.screenshot(path=str(OUT / 'fish-steaming.png'))
    expect(scene).to_have_attribute('data-stage','3',timeout=3000)
    expect(scene).to_have_attribute('data-stage','4',timeout=3000)
    assert float(scene.locator('.fish-pot-front').evaluate('(e)=>getComputedStyle(e).opacity')) == 0
    page.screenshot(path=str(OUT / 'fish-served.png'))
    page.get_by_role('button', name='再做一次').click()
    expect(scene).to_have_attribute('data-stage','0')
    page.emulate_media(reduced_motion='reduce')
    expect(scene).to_have_attribute('data-stage','4')
    assert scene.evaluate('(e)=>e.getAnimations({subtree:true}).filter(a=>a.playState==="running").length') == 0
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-action="recipe"]').first.click()
    expect(scene).to_have_attribute('data-stage','4')
    assert page.locator('dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    assert scene.locator('.cooking-replay').bounding_box()['height'] >= 44
    page.screenshot(path=str(OUT / 'fish-served-mobile.png'))
    page.keyboard.press('Escape')
    page.locator('nav [data-page="menu"]').click()
    assert page.locator('.menu-intro').bounding_box()['height'] <= 90
    assert page.evaluate('document.body.scrollWidth') <= 390
    page.screenshot(path=str(OUT / 'compact-menu-mobile.png'), full_page=True)
    assert not errors, errors
    (OUT / 'fish-animation-results.json').write_text(json.dumps({'stages':[0,1,2,3,4],'specificTo':'清蒸鲈鱼','reducedMotion':True,'mobileOverflow':False,'compactHeader':True,'jsErrors':errors}),encoding='utf-8')
    print('PASS fish-specific steaming, garnish/serve, replay, reduced motion, mobile, compact menu strip')
    browser.close()
