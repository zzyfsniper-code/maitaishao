"""Exercise chat rendering with intercepted responses; never writes family data."""
import copy
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).parent / 'artifacts'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1512,'height':1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    state = page.request.get('http://127.0.0.1:4317/api/state').json()
    state['messages'] = []
    page.route('**/api/state', lambda route: route.fulfill(json=state))
    pending = []
    page.route('**/api/chat', lambda route: pending.append(route))
    page.goto('http://127.0.0.1:4317', wait_until='networkidle')
    expect(page.locator('.chat-suggestions')).to_be_visible()

    reply = '需要先确认：薯饼不在已确认菜谱里，而且菜单里有两次早餐南瓜粥（11-16 和 11-21）。请问要换哪一天？可以先新增薯饼菜谱，核对后再安排。'
    for i in range(6):
        state['messages'] += [{'role':'user','text':f'历史消息 {i}'}, {'role':'assistant','text':'这是之前的回复。','provider':'测试响应'}]
    state['messages'] += [{'role':'user','text':'帮我把早上的南瓜粥换成薯饼'}, {'role':'assistant','text':reply,'provider':'测试响应'}]
    page.reload(wait_until='networkidle')

    def assert_latest_visible():
        expect(page.locator('aside.assistant')).to_have_count(1)
        expect(page.locator('.chat-message.assistant')).to_have_count(0)
        message = page.locator('.assistant-message').last
        assert message.evaluate('(e)=>getComputedStyle(e).position') == 'static'
        assert message.bounding_box()['height'] < 320
        assert message.evaluate('''e => {
            const box=e.querySelector('.chat-bubble').getBoundingClientRect();
            const area=e.closest('.chat-messages').getBoundingClientRect();
            return box.top >= area.top && box.bottom <= area.bottom;
        }''')

    assert_latest_visible()
    page.locator('aside.assistant').screenshot(path=str(OUT / 'chat-fixed-desktop.png'))
    for width in (390, 1280, 1512):
        page.set_viewport_size({'width':width, 'height':900})
        page.reload(wait_until='networkidle')
        assert_latest_visible()
        assert page.evaluate('document.body.scrollWidth') <= width
        if width == 390:
            page.locator('aside.assistant').screenshot(path=str(OUT / 'chat-fixed-mobile.png'))

    # Hold a response to verify pending feedback before the reply arrives.
    page.locator('#chat-input').fill('请查询家庭成员')
    page.locator('#chat-input').press('Enter')
    expect(page.locator('.loading-inline')).to_be_visible()
    expect(page.get_by_role('button', name='发送消息')).to_be_disabled()
    expect(page.locator('.chat-message.user').last).to_contain_text('请查询家庭成员')
    assert len(pending) == 1
    sent = copy.deepcopy(state)
    sent['messages'] += [{'role':'user','text':'请查询家庭成员'}, {'role':'assistant','text':'家里有妈妈、爸爸和宝宝，共三位。','provider':'测试响应'}]
    pending.pop().fulfill(json={'state':sent,'reply':sent['messages'][-1]['text']})
    expect(page.locator('.loading-inline')).to_have_count(0)
    expect(page.locator('.assistant-message').last).to_contain_text('共三位')
    assert_latest_visible()

    page.locator('#chat-input').fill('模拟连接错误')
    page.get_by_role('button', name='发送消息').click()
    expect(page.locator('.loading-inline')).to_be_visible()
    assert len(pending) == 1
    pending.pop().fulfill(status=502, json={'error':'测试连接暂不可用'})
    expect(page.locator('.error-box')).to_contain_text('测试连接暂不可用')
    expect(page.get_by_role('button', name='重试上一条')).to_be_visible()
    expect(page.get_by_role('button', name='发送消息')).to_be_enabled()
    assert not errors, errors
    (OUT / 'chat-display-results.json').write_text(json.dumps({'historyVisible':True,'viewports':[390,1280,1512],'pending':True,'reply':True,'errorFeedback':True,'jsErrors':errors}),encoding='utf-8')
    print('PASS long history, latest reply visibility, desktop/mobile, pending/reply/error, keyboard sending')
    browser.close()
