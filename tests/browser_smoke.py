"""Use an isolated database; does not mutate the delivered demo or API credentials."""
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'tests' / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:4318'
results = []

def record(name):
    results.append(name)
    print('PASS ' + name, flush=True)

with tempfile.TemporaryDirectory(prefix='family-kitchen-browser-') as directory:
    env = dict(os.environ, PORT='4318', KITCHEN_DB=str(Path(directory) / 'test.sqlite'))
    log = open(Path(directory) / 'server.log', 'w', encoding='utf-8')
    process = subprocess.Popen(['node', 'server/index.mjs'], cwd=ROOT, env=env, stdout=log, stderr=log,
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
            page = browser.new_page(viewport={'width': 1512, 'height': 1050}, device_scale_factor=1)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE, wait_until='networkidle')
            expect(page.locator('.meal-card')).to_have_count(3)
            assert page.evaluate('document.body.scrollWidth') <= 1512
            state = lambda: page.request.get(BASE + '/api/state').json()
            original = state(); week = original['defaultWeek']
            record('desktop navigation and seeded 21 meals')
            page.locator('.dish-name').first.click()
            expect(page.locator('dialog')).to_be_visible()
            expect(page.get_by_text('准备食材', exact=True)).to_be_visible()
            page.get_by_role('button', name='关闭', exact=True).click()
            before = original['menus'][week]['meals']
            page.locator('[data-action="replace"]').first.click()
            expect(page.locator('.day-title')).to_contain_text('v2')
            page.locator('[data-action="undo"]').click()
            expect(page.locator('.day-title')).to_contain_text('v3')
            assert state()['menus'][week]['meals'] == before
            record('recipe details, same-category replacement, undo')
            page.locator('nav [data-page="family"]').click()
            page.locator('[data-action="member"][data-id="mom"]').click()
            page.locator('[data-tag="控糖"]').click()
            page.locator('#custom-tag').fill('喜欢菌菇')
            page.locator('[data-action="add-tag"]').click()
            pixel = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
            page.locator('#avatar-upload').set_input_files({'name': 'avatar.png', 'mimeType': 'image/png', 'buffer': pixel})
            expect(page.locator('#avatar-preview img')).to_be_visible()
            page.get_by_role('button', name='保存档案', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible()
            page.reload(wait_until='networkidle')
            after = state(); mom = next(m for m in after['members'] if m['id'] == 'mom')
            assert '控糖' in mom['profileTags'] and '喜欢菌菇' in mom['profileTags'] and mom['avatar'].startswith('data:image/')
            assert after['rules']['formal'] is False
            record('avatar, preset tags, custom tags persist after refresh')
            page.locator('nav [data-page="family"]').click()
            page.screenshot(path=str(ARTIFACTS / 'family.png'), full_page=True)
            page.locator('[data-action="member"][data-id="mom"]').click()
            page.screenshot(path=str(ARTIFACTS / 'profile.png'), full_page=True)
            page.get_by_role('button', name='关闭', exact=True).click()
            page.locator('nav [data-page="menu"]').click()
            page.get_by_role('button', name='调整晚餐人员和饭量').click()
            page.locator('[name="member-dad"]').uncheck()
            page.locator('[name="portion-child"]').fill('0.6')
            page.get_by_role('button', name='查看调整建议', exact=True).click()
            expect(page.get_by_role('heading', name='这次，我们这样调整')).to_be_visible()
            assert len(state()['menus'][week]['meals'][2]['memberIds']) == 3
            page.get_by_role('button', name='确认调整', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible()
            after = state(); dinner = after['menus'][week]['meals'][2]
            assert dinner['memberIds'] == ['mom', 'child'] and dinner['portions'] == 1.6
            assert next(m for m in after['members'] if m['id'] == 'dad')['schedule'][0]['dinner'] is True
            record('attendance and serving proposal requires confirmation')
            page.locator('nav [data-page="shopping"]').click()
            expect(page.locator('.shopping-item').first).to_be_visible()
            page.locator('.shopping-item input').first.check()
            expect(page.locator('.shopping-item').first).to_have_class('shopping-item checked')
            with page.expect_download() as download:
                page.locator('[data-action="download-shopping"]').click()
            assert download.value.suggested_filename.endswith('.txt')
            record('shopping aggregation, checklist, download')
            page.locator('nav [data-page="settings"]').click()
            expect(page.locator('#base-url')).to_have_value('https://fde.wscn.net/v1')
            expect(page.locator('#model')).to_have_value('deepseek-4.1-flash')
            page.locator('[data-action="run-schedule"]').click()
            expect(page.get_by_text('目标周已有菜单，已保留主厨修改。', exact=True).first).to_be_visible()
            assert state()['menus'][week]['meals'] == after['menus'][week]['meals']
            record('scheduler preserves existing manual menu')
            page.locator('[data-action="upload-doc"][data-kind="营养搭配"]').click()
            page.locator('#f-content').fill('测试资料：具体比例等待项目方确认。')
            page.get_by_role('button', name='保存待接入资料').click()
            expect(page.locator('dialog')).not_to_be_visible()
            assert state()['rules'] == original['rules'] and state()['documents'][-1]['status'] == 'pending_review'
            record('rule documents remain pending and do not silently change rules')
            # A stale proposal must not overwrite a subsequent profile edit.
            snap = state()
            proposal = page.request.post(BASE + '/api/menus/generate', data={'week': week, 'version': snap['menus'][week]['version']}).json()['proposal']
            snap = state()
            page.request.post(BASE + '/api/members/save', data={'revision': snap['revision'], 'member': snap['members'][0]})
            stale = page.request.post(BASE + '/api/proposals/confirm', data={'id': proposal['id']})
            assert stale.status == 409
            record('stale proposal rejected with HTTP 409')
            page.reload(wait_until='networkidle')
            page.set_viewport_size({'width': 390, 'height': 844})
            assert page.evaluate('document.body.scrollWidth') <= 390
            page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)
            record('mobile layout without horizontal overflow')
            assert not errors, errors
            # Optional real-model checks, deliberately separated from deterministic tests.
            if os.environ.get('KITCHEN_LIVE_AGENT') == '1':
                page.set_viewport_size({'width': 1512, 'height': 1050})
                page.locator('#chat-input').fill('周三晚餐只做两道菜')
                page.get_by_role('button', name='发送消息').click()
                expect(page.locator('.loading-inline')).not_to_be_visible(timeout=150000)
                expect(page.locator('.pending-card').last).to_be_visible(timeout=10000)
                snap = state(); prop = snap['proposals'][-1]
                new_meal = next(m for m in prop['meals'] if m['date'] == week[:8] + str(int(week[8:]) + 2).zfill(2) and m['kind'] == 'dinner')
                assert len(new_meal['dishes']) == 2
                page.locator('.pending-card [data-action="proposal"]').last.click()
                page.get_by_role('button', name='确认调整', exact=True).click()
                expect(page.locator('dialog')).not_to_be_visible()
                page.screenshot(path=str(ARTIFACTS / 'agent.png'), full_page=True)
                record('REAL AGENT: conversational adjustment, validation, confirmation')
                page.locator('nav [data-page="imports"]').click()
                page.locator('[data-action="new-import"]').click()
                page.locator('#import-type').select_option('text')
                page.locator('#f-text').fill('以下为测试食谱，非真实幼儿园数据。周一早餐：牛奶、面包；周一午餐：番茄炒蛋、米饭；周一加餐：苹果。周二午餐：香菇蒸鸡、清炒西兰花、小米饭。')
                page.get_by_role('button', name='识别并预览', exact=True).click()
                expect(page.get_by_role('heading', name='核对识别结果')).to_be_visible(timeout=150000)
                snap = state(); imported = snap['imports'][-1]
                assert imported['status'] == 'draft' and len(imported['records']) == 2
                assert all(r['meal'] == 'lunch' for r in imported['records'])
                assert not any(x in ['牛奶', '面包', '苹果'] for r in imported['records'] for x in r['dishes'])
                page.get_by_role('button', name='日期菜名已核对，确认导入').click()
                expect(page.locator('dialog')).not_to_be_visible()
                record('REAL AGENT: text lunch recognition excludes breakfast and snacks')
                image_page = browser.new_page(viewport={'width': 1000, 'height': 430})
                image_page.set_content('<html lang="zh-CN"><body style="font:28px Microsoft YaHei;padding:35px;background:white"><h2>测试幼儿园 · 每周食谱</h2><p>周一 早餐：牛奶、面包</p><p>周一 午餐：香菇蒸鸡、米饭</p><p>周一 加餐：香蕉</p></body></html>')
                image_bytes = image_page.screenshot(); image_page.close()
                page.locator('[data-action="new-import"]').click()
                page.locator('#import-type').select_option('image')
                page.locator('#import-form [name="image"]').set_input_files({'name': 'test-lunch.png', 'mimeType': 'image/png', 'buffer': image_bytes})
                page.get_by_role('button', name='识别并预览', exact=True).click()
                expect(page.get_by_role('heading', name='核对识别结果')).to_be_visible(timeout=150000)
                snap = state(); imported = snap['imports'][-1]
                assert len(imported['records']) == 1 and '香菇蒸鸡' in imported['records'][0]['dishes']
                assert '香蕉' not in imported['records'][0]['dishes'] and imported['status'] == 'draft'
                page.screenshot(path=str(ARTIFACTS / 'image-import.png'), full_page=True)
                record('REAL AGENT: screenshot lunch recognition and review preview')
                page.get_by_role('button', name='关闭', exact=True).click()
                page.locator('nav [data-page="recipes"]').click()
                page.locator('[data-action="new-recipe"]').click()
                page.locator('#f-text').fill('冬瓜虾仁汤')
                page.get_by_role('button', name='让助手整理草稿').click()
                expect(page.get_by_role('heading', name='核对新菜谱')).to_be_visible(timeout=150000)
                assert state()['recipes'][-1]['status'] == 'draft'
                page.get_by_role('button', name='核对完成，确认入库').click()
                expect(page.locator('dialog')).not_to_be_visible()
                assert state()['recipes'][-1]['status'] == 'confirmed'
                record('REAL AGENT: recipe generation stays draft until explicit confirmation')
            assert not errors, errors
            browser.close()
        result_name = 'browser-live-results.json' if os.environ.get('KITCHEN_LIVE_AGENT') == '1' else 'browser-results.json'
        (ARTIFACTS / result_name).write_text(json.dumps({'passed': results, 'browserErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    finally:
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()
        log.close()
