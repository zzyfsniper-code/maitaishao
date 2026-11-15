"""Check the published site and shared Pi; adds one chat message but never changes menus."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
config = json.loads((ROOT / 'data/share-config.json').read_text(encoding='utf-8-sig'))
SITE = 'https://zzyfsniper-code.github.io/maitaishao/'
API = config['apiBase']
passed = []

def record(name):
    passed.append(name)
    print('PASS ' + name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1512, 'height':1080})
    request = context.request
    headers = {'Authorization':'Bearer ' + config['passcode'], 'Origin':'https://zzyfsniper-code.github.io'}
    assert request.get(API + '/api/state').status == 401
    assert request.get(API + '/api/state', headers={**headers, 'Origin':'https://untrusted.example'}).status == 403
    assert request.post(API + '/api/agent/config', headers=headers, data={}).status == 403
    assert request.post(API + '/api/x/../agent/config', headers=headers, data={}).status == 403
    preflight = request.fetch(API + '/api/state', method='OPTIONS', headers={'Origin':headers['Origin'], 'Access-Control-Request-Method':'GET', 'Access-Control-Request-Headers':'authorization'})
    assert preflight.status == 204 and preflight.headers['access-control-allow-origin'] == headers['Origin']
    before = request.get(API + '/api/state', headers=headers).json()
    record('authentication, exact origin, preflight and remote configuration restriction')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(SITE, wait_until='networkidle', timeout=60000)
    expect(page.get_by_role('heading', name='欢迎来到买汰烧')).to_be_visible()
    expect(page.locator('.meal-card')).to_have_count(0)
    assert page.locator('.access-card img').evaluate('(e)=>e.complete && e.naturalWidth > 0')
    page.screenshot(path=str(OUT / 'online-login.png'))
    page.locator('#group-passcode').fill('wrong-test-passcode')
    page.get_by_role('button', name='进入厨房', exact=True).click()
    expect(page.locator('.access-error')).to_contain_text('正确', timeout=20000)
    page.locator('#group-passcode').fill(config['passcode'])
    page.get_by_role('button', name='进入厨房', exact=True).click()
    expect(page.locator('.meal-card')).to_have_count(3, timeout=30000)
    expect(page.locator('.brand b')).to_have_text('买汰烧')
    assert page.locator('.brand-mark').evaluate('(e)=>e.complete && e.naturalWidth > 0')
    record('GitHub Pages login, incorrect passcode feedback, brand and menu assets')
    page.locator('.dish-name').first.click()
    expect(page.locator('cooking-scene')).to_have_attribute('data-stage', '4', timeout=6000)
    page.get_by_role('button', name='再做一次').click()
    expect(page.locator('cooking-scene')).to_have_attribute('data-stage', '0')
    page.keyboard.press('Escape')
    page.locator('nav [data-page="settings"]').click()
    expect(page.locator('#agent-settings')).not_to_be_visible()
    page.locator('nav [data-page="menu"]').click()
    record('published recipe animation and local-only model settings')
    page.locator('#chat-input').fill('请调用 get_kitchen_context 查询家里有几位成员，简短回复姓名和人数。只查询，不要调整任何菜单。')
    with page.expect_response(lambda r: r.url.endswith('/api/chat') and r.request.method == 'POST', timeout=150000) as event:
        page.get_by_role('button', name='发送消息').click()
    response = event.value
    assert response.ok, response.status
    result = response.json()
    assert result['state']['menus'] == before['menus']
    run = result['state']['agentLastRun']
    assert run['ok'] and result['state']['agent']['provider'] == 'pi', run
    assert any(t['name'] == 'get_kitchen_context' and t['ok'] for t in run['toolCalls']), run
    page.screenshot(path=str(OUT / 'online-agent.png'), full_page=True)
    record('real Pi tool call through GitHub Pages and tunnel, menus preserved')
    page.reload(wait_until='domcontentloaded', timeout=60000)
    expect(page.locator('.meal-card')).to_have_count(3, timeout=30000)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.body.scrollWidth') <= 390
    page.locator('[data-action="lock-session"]').click()
    expect(page.locator('.access-card')).to_be_visible(timeout=20000)
    assert page.evaluate('document.body.scrollWidth') <= 390
    assert page.evaluate('sessionStorage.getItem("maitaishao-access")') is None
    page.screenshot(path=str(OUT / 'online-login-mobile.png'))
    assert errors == [], errors
    record('session reload, logout and mobile layout, no JavaScript errors')
    (OUT / 'online-results.json').write_text(json.dumps({'url':SITE,'passed':passed,'browserErrors':errors,'agent':run}, ensure_ascii=False, indent=2),encoding='utf-8')
    browser.close()
