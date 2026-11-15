"""Five dishes, a separate staple and real Pi instruction, using an isolated kitchen."""
import json, os, socket, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
BASE = 'http://127.0.0.1:4318'
with socket.socket() as check:
    assert check.connect_ex(('127.0.0.1',4318)) != 0, 'Test port already occupied'
with tempfile.TemporaryDirectory(prefix='five-dishes-') as directory:
    with open(Path(directory)/'server.log','w') as log:
        process = subprocess.Popen(['node','server/index.mjs'],cwd=ROOT,env=dict(os.environ,PORT='4318',KITCHEN_DB=str(Path(directory)/'test.sqlite')),stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            for _ in range(60):
                assert process.poll() is None, 'Test server stopped'
                try:
                    urllib.request.urlopen(BASE+'/api/health',timeout=1).close()
                    break
                except Exception: time.sleep(.2)
            with sync_playwright() as p:
                browser=p.chromium.launch(headless=True)
                page=browser.new_page(viewport={'width':1512,'height':1080})
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(BASE,wait_until='networkidle')
                initial=page.request.get(BASE+'/api/state').json()
                expect(page.locator('.meal-card.lunch .dish-row')).to_have_count(6)
                expect(page.locator('.meal-card.dinner .meal-footer')).to_contain_text('5 道菜＋主食')
                expect(page.locator('.meal-card.breakfast .dish-row')).to_have_count(2)
                page.locator('#chat-input').fill('把选定周七天的午晚餐都安排成五道菜，主食另算，早餐保持原搭配。直接执行。')
                with page.expect_response(lambda r:r.url.endswith('/api/chat'),timeout=150000) as pending:
                    page.get_by_role('button',name='发送消息',exact=True).click()
                result=pending.value.json()
                assert result.get('proposal',{}).get('automatic') is True, result
                state=result['state']
                assert state['checks'][initial['defaultWeek']]==[]
                for meal in state['menus'][initial['defaultWeek']]['meals']:
                    assert len(meal['dishes']) == (2 if meal['kind']=='breakfast' else 6)
                expect(page.locator('.loading-inline')).not_to_be_visible()
                page.screenshot(path=str(OUT/'five-dishes-desktop.png'),full_page=True)
                page.set_viewport_size({'width':390,'height':844})
                assert page.evaluate('document.body.scrollWidth') <= 390
                expect(page.locator('.meal-card.dinner .meal-footer')).to_contain_text('5 道菜＋主食')
                assert not errors,errors
                (OUT/'five-dishes-results.json').write_text(json.dumps({'mainDishes':5,'separateStaple':True,'repeatGapDays':state['rules']['repeatGapDays'],'livePi':state['agentLastRun'],'jsErrors':errors},ensure_ascii=False),encoding='utf-8')
                browser.close()
                print('PASS five dishes plus staple, unchanged breakfast pattern, real Pi direct update and mobile layout')
        finally:
            process.terminate()
            process.wait(timeout=15)
