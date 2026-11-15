"""Hold data responses to verify loading animation, completion, failure and reduced motion."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts'
BASE = 'http://127.0.0.1:4317'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1512,'height':1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    state = page.request.get(BASE + '/api/state').json()
    pending = []
    page.route('**/api/state', lambda route: pending.append(route))
    page.goto(BASE, wait_until='domcontentloaded')
    scene = page.locator('.kitchen-loading cooking-scene')
    expect(scene).to_have_attribute('data-recipe','generic')
    expect(scene).to_have_attribute('data-stage','2',timeout=4000)
    page.screenshot(path=str(OUT / 'loading-desktop.png'))
    expect(scene).to_have_attribute('data-stage','4',timeout=4000)
    expect(scene).to_have_attribute('data-stage','0',timeout=2000)
    page.evaluate('window.previousLoader=document.querySelector("cooking-scene")')
    assert len(pending) == 1
    pending.pop().fulfill(json=state)
    expect(page.locator('.meal-card')).to_have_count(3)
    expect(page.locator('.kitchen-loading')).to_have_count(0)
    assert page.evaluate('!previousLoader.isConnected')
    expect(page.locator('.brand-mark')).to_have_attribute('src','/assets/maitaishao-icon-v2.png')
    page.locator('nav [data-page="family"]').click()
    for member in state['members']:
        card=page.locator('.member-card').filter(has=page.locator(f'[data-action="member"][data-id="{member["id"]}"]'))
        if member['name'] in ['妈妈','爸爸','宝宝','爷爷','奶奶'] or member.get('avatar'):
            image=card.locator('.portrait img')
            expect(image).to_be_visible()
            assert image.evaluate('(e)=>e.complete && e.naturalWidth>0')
    page.screenshot(path=str(OUT / 'family-avatars-desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844}, reduced_motion='reduce')
    mobile.on('pageerror',lambda e: errors.append(str(e)))
    waiting=[]
    mobile.route('**/api/state',lambda route: waiting.append(route))
    mobile.goto(BASE,wait_until='domcontentloaded')
    quiet=mobile.locator('.kitchen-loading cooking-scene')
    expect(quiet).to_have_attribute('data-stage','4')
    assert quiet.evaluate('(e)=>e.getAnimations({subtree:true}).filter(a=>a.playState==="running").length') == 0
    assert mobile.evaluate('document.body.scrollWidth') <= 390
    mobile.screenshot(path=str(OUT / 'loading-mobile.png'))
    expect(mobile.locator('.kitchen-loading-status')).to_contain_text('正在准备厨房')
    assert len(waiting) == 1
    waiting.pop().fulfill(status=503,json={'error':'测试：厨房连接暂不可用'})
    expect(mobile.get_by_role('link',name='重新加载')).to_be_visible()
    expect(mobile.locator('.kitchen-loading')).to_have_count(0)
    assert errors == [], errors
    (OUT / 'loading-results.json').write_text(json.dumps({'loopsWhilePending':True,'exitsWhenReady':True,'failureRetry':True,'reducedMotion':True,'avatarsLoaded':True,'jsErrors':errors}),encoding='utf-8')
    print('PASS loading loop, automatic exit, error/retry, reduced motion, mobile, icon and role avatars')
    browser.close()
