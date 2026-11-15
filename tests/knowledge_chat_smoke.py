"""Real browser + MCP; optional real Pi calls, always against an isolated database."""
import json
import os
from pathlib import Path
import subprocess
import socket
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
BASE = 'http://127.0.0.1:4318'
with socket.socket() as check:
    if check.connect_ex(('127.0.0.1', 4318)) == 0:
        raise RuntimeError('Test port 4318 is occupied; finish the other isolated test first.')
with tempfile.TemporaryDirectory(prefix='kitchen-knowledge-browser-') as directory:
    log = open(Path(directory) / 'server.log', 'w', encoding='utf-8')
    process = subprocess.Popen(['node', 'server/index.mjs'], cwd=ROOT,
        env=dict(os.environ, PORT='4318', KITCHEN_DB=str(Path(directory) / 'test.sqlite')),
        stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        for _ in range(50):
            if process.poll() is not None:
                log.flush()
                raise RuntimeError(Path(directory, 'server.log').read_text(encoding='utf-8'))
            try:
                urllib.request.urlopen(BASE + '/api/health', timeout=1)
                break
            except Exception:
                time.sleep(.2)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width':1440, 'height':1000})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE, wait_until='networkidle')
            state = lambda: page.request.get(BASE + '/api/state').json()
            original = state()
            assert original['knowledge']['connected']
            page.locator('nav [data-page="recipes"]').click()
            page.locator('#recipe-search').fill('鲈鱼')
            page.locator('.recipe-card').click()
            page.get_by_role('button', name='编辑知识', exact=True).click()
            page.locator('#f-source').fill('组员维护测试，仅隔离数据库')
            page.locator('#f-tags').fill('家常，清淡，知识库验收标记')
            page.get_by_role('button', name='确认更新知识库', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible()
            edited = next(r for r in state()['recipes'] if r['name'] == '清蒸鲈鱼')
            assert edited['knowledgeVersion'] == 2
            assert state()['menus'] == original['menus']
            result = page.request.get(BASE + '/api/knowledge/search?q=知识库验收标记&status=confirmed').json()
            assert [r['id'] for r in result['recipes']] == [edited['id']]
            page.locator('.recipe-card').click()
            page.get_by_role('button', name='历史版本', exact=True).click()
            expect(page.locator('.compare-row')).to_have_count(2)
            expect(page.get_by_text('组员维护测试，仅隔离数据库', exact=True)).to_be_visible()
            page.screenshot(path=str(OUT / 'knowledge-history.png'), full_page=True)
            page.get_by_role('button', name='关闭', exact=True).click()
            page.get_by_role('button', name='手动添加', exact=True).click()
            page.locator('#f-name').fill('知识库测试青菜')
            page.locator('#f-category').select_option('vegetable')
            page.locator('#f-ingredients').fill('青菜,150,g')
            page.locator('#f-steps').fill('洗净青菜。\n加水煮至熟透。')
            page.locator('#f-tags').fill('清淡')
            page.locator('#f-source').fill('人工录入测试')
            page.get_by_role('button', name='保存草稿', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible()
            draft = next(r for r in state()['recipes'] if r['name'] == '知识库测试青菜')
            assert draft['status'] == 'draft'
            page.locator('#recipe-search').fill('知识库测试青菜')
            page.locator('.recipe-card').click()
            page.get_by_role('button', name='核对完成，确认入库', exact=True).click()
            expect(page.locator('dialog')).not_to_be_visible()
            assert next(r for r in state()['recipes'] if r['id'] == draft['id'])['status'] == 'confirmed'
            page.reload(wait_until='networkidle')
            assert next(r for r in state()['recipes'] if r['id'] == draft['id'])['knowledgeVersion'] == 2
            print('PASS browser knowledge edit, source/tag MCP retrieval, history, manual draft/confirmation, persistence', flush=True)
            runs = []
            if os.environ.get('KITCHEN_LIVE_AGENT') == '1':
                def chat(message):
                    page.locator('#chat-input').fill(message)
                    with page.expect_response(lambda r: r.url.endswith('/api/chat'), timeout=130000) as pending:
                        page.get_by_role('button', name='发送消息', exact=True).click()
                    response = pending.value
                    body = response.json()
                    assert response.ok, body
                    runs.append(body['state']['agentLastRun'])
                    return body
                before = state()
                output = chat('给妈妈新增控糖标签；宝宝新增虾过敏，保留其他过敏记录；爸爸新增喜欢南瓜，每周三晚餐固定不在家，默认饭量改成0.8份；自动排菜时间改成每周日19:30。请一起列出修改供我确认。')
                assert 'proposal' in output, output['reply']
                assert output['proposal']['kind'] == 'kitchen_update'
                assert state()['members'] == before['members']
                assert state()['settings'] == before['settings']
                assert any(t['name'] == 'preview_kitchen_update' and t['ok'] for t in runs[-1]['toolCalls'])
                page.locator('.pending-card').last.get_by_role('button', name='查看并确认').click()
                expect(page.get_by_role('heading', name='核对这次资料修改')).to_be_visible()
                page.screenshot(path=str(OUT / 'chat-profile-preview.png'), full_page=True)
                page.get_by_role('button', name='确认修改', exact=True).click()
                expect(page.locator('dialog')).not_to_be_visible()
                updated = state()
                mom = next(m for m in updated['members'] if m['id'] == 'mom')
                dad = next(m for m in updated['members'] if m['id'] == 'dad')
                child = next(m for m in updated['members'] if m['id'] == 'child')
                assert '控糖' in mom['profileTags'] and '虾' in child['allergies'] and '南瓜' in dad['likes']
                assert dad['schedule'][2]['dinner'] is False and dad['portion'] == .8
                assert updated['settings']['scheduleTime'] == '19:30'
                assert updated['menus'] == before['menus']
                page.locator('nav [data-page="family"]').click()
                page.locator('[data-action="member"][data-id="child"]').click()
                expect(page.locator('#f-allergies')).to_have_value('虾')
                page.get_by_role('button', name='关闭', exact=True).click()
                output = chat('把宝宝档案里的虾过敏移除，只移除这一项，先让我确认。')
                assert 'proposal' in output, output['reply']
                page.locator('.pending-card').last.get_by_role('button', name='查看并确认').click()
                page.get_by_role('button', name='暂不修改', exact=True).click()
                expect(page.locator('dialog')).not_to_be_visible()
                assert '虾' in next(m for m in state()['members'] if m['id'] == 'child')['allergies']
                output = chat('给妈妈的喜欢列表新增西兰花，并给清蒸鲈鱼的口味标签新增“自动执行标记”。直接修改。')
                assert output.get('proposal', {}).get('automatic') is True, output['reply']
                assert output['proposal']['status'] == 'confirmed'
                assert '西兰花' in next(m for m in state()['members'] if m['id'] == 'mom')['likes']
                assert '自动执行标记' in next(r for r in state()['recipes'] if r['id'] == edited['id'])['tags']
                expect(page.locator('.pending-card')).to_have_count(0)
                output = chat('按现在的家庭档案重新安排选定周全部七天三餐，直接更新菜单。')
                assert output.get('proposal', {}).get('automatic') is True, output['reply']
                assert output['proposal']['status'] == 'confirmed'
                assert output['state']['checks'][original['defaultWeek']] == []
                before_one_meal = state()['menus'][original['defaultWeek']]['meals']
                output = chat('周三晚餐只做两道菜，直接修改。')
                assert output.get('proposal', {}).get('automatic') is True, output['reply']
                changed = [m for m in output['state']['menus'][original['defaultWeek']]['meals'] if m not in before_one_meal]
                assert len(changed) == 1 and changed[0]['kind'] == 'dinner' and len(changed[0]['dishes']) == 3
                expect(page.locator('.pending-card')).to_have_count(0)
                output = chat('查询知识库中带有“知识库验收标记”的菜谱，告诉我菜名和来源说明，只查询，不修改。')
                assert '清蒸鲈鱼' in output['reply'] and '隔离数据库' in output['reply'], output['reply']
                assert any(t['name'] == 'find_recipes' and t['ok'] for t in runs[-1]['toolCalls'])
                print('PASS real Pi opt-in preview/cancel, direct mixed profile/knowledge updates, direct whole-week/one-meal menus, MCP retrieval', flush=True)
            page.set_viewport_size({'width':390, 'height':844})
            page.locator('nav [data-page="recipes"]').click()
            assert page.evaluate('document.body.scrollWidth') <= 390
            page.screenshot(path=str(OUT / 'knowledge-mobile.png'), full_page=True)
            assert errors == [], errors
            (OUT / 'knowledge-chat-results.json').write_text(json.dumps({'knowledge':True,'livePi':bool(runs),'runs':runs,'jsErrors':errors}, ensure_ascii=False),encoding='utf-8')
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=15)
        log.close()
