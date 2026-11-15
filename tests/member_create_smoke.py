"""Create and edit members through the browser using an isolated database."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
BASE = 'http://127.0.0.1:4318'
with tempfile.TemporaryDirectory(prefix='kitchen-new-member-') as directory:
    log = open(Path(directory) / 'server.log', 'w', encoding='utf-8')
    env = dict(os.environ, PORT='4318', KITCHEN_DB=str(Path(directory) / 'test.sqlite'))
    process = subprocess.Popen(['node','server/index.mjs'], cwd=ROOT, env=env, stdout=log, stderr=log,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(BASE + '/api/health', timeout=1)
                break
            except Exception:
                time.sleep(.2)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width':1280,'height':950})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE, wait_until='networkidle')
            original = page.request.get(BASE + '/api/state').json()
            page.locator('nav [data-page="family"]').click()
            page.get_by_role('button', name='添加成员', exact=True).click()
            expect(page.locator('#member-form')).to_be_visible()
            page.locator('#f-name').fill('测试家人')
            page.locator('#f-age').fill('62')
            page.locator('[data-tag="控糖"]').click()
            page.locator('#custom-tag').fill('喜欢南瓜')
            page.locator('[data-action="add-tag"]').click()
            page.locator('[name="schedule-0-lunch"]').uncheck()
            page.get_by_role('button', name='保存档案', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible(timeout=10000)
            state = page.request.get(BASE + '/api/state').json()
            assert len(state['members']) == len(original['members']) + 1
            member = next(m for m in state['members'] if m['name'] == '测试家人')
            assert member['id'] and member['age'] == 62 and member['portion'] == 1
            assert set(['控糖','喜欢南瓜']).issubset(member['profileTags'])
            assert member['schedule'][0]['lunch'] is False
            assert state['menus'] == original['menus']
            page.reload(wait_until='networkidle')
            page.locator('nav [data-page="family"]').click()
            expect(page.locator('.member-card')).to_have_count(4)
            page.locator(f'[data-action="member"][data-id="{member["id"]}"]').click()
            expect(page.locator('#f-name')).to_have_value('测试家人')
            page.get_by_role('button', name='关闭', exact=True).click()
            page.set_viewport_size({'width':390,'height':844})
            page.get_by_role('button', name='添加成员', exact=True).click()
            expect(page.locator('#f-name')).to_have_value('')
            page.locator('#f-name').fill('第二位测试家人')
            page.locator('#f-age').fill('0')
            page.locator('#f-portion').fill('0.3')
            page.get_by_role('button', name='保存档案', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible(timeout=10000)
            assert len(page.request.get(BASE + '/api/state').json()['members']) == 5
            assert page.evaluate('document.body.scrollWidth') <= 390
            assert errors == [], errors
            page.screenshot(path=str(OUT / 'member-create-mobile.png'), full_page=True)
            (OUT / 'member-create-results.json').write_text(json.dumps({'created':2,'persistent':True,'menusPreserved':True,'jsErrors':errors}),encoding='utf-8')
            print('PASS create member, tags/schedule, save/reload/edit, mobile second member, preserved menus')
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=15)
        log.close()
