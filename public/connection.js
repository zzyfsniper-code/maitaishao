let apiBase = '', passcode = '';
export let isShared = false;
export async function apiFetch(route, options = {}) {
  const headers = new Headers(options.headers);
  if (isShared) headers.set('Authorization', 'Bearer ' + passcode);
  const response = await fetch(apiBase + route, { ...options, headers, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (isShared && response.status === 401) sessionStorage.removeItem('maitaishao-access');
  return response;
}
export async function initializeConnection(app) {
  const config = await (await fetch(new URL('./deployment.json', import.meta.url), { cache: 'no-store' })).json();
  apiBase = String(config.apiBase || '').replace(/\/$/, '');
  isShared = !!apiBase;
  if (!isShared) return;
  if (new URL(apiBase).protocol !== 'https:') throw new Error('共享厨房地址必须为 HTTPS。');
  passcode = sessionStorage.getItem('maitaishao-access') || '';
  if (passcode) {
    try { if ((await apiFetch('/api/health')).ok) return; } catch { /* Let the user retry from the sign-in screen. */ }
    passcode = '';
  }
  app.innerHTML = `<main class="access-page"><form class="access-card"><img src="./assets/maitaishao-icon.jpg" alt="买汰烧品牌形象"><div class="eyebrow">我们一起，好好吃饭</div><h1>欢迎来到买汰烧</h1><p>输入组员口令，进入我们共同的厨房。</p><label for="group-passcode">组员访问口令</label><input id="group-passcode" type="password" autocomplete="current-password" required autofocus><button class="button primary" type="submit">进入厨房</button><p class="access-error" role="alert"></p><small>主厨电脑保持在线时，可一起使用厨房助手。</small></form></main>`;
  await new Promise(resolve => {
    app.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation();
      const button = app.querySelector('button'), error = app.querySelector('.access-error');
      button.disabled = true; button.textContent = '正在连接…'; error.textContent = '';
      passcode = app.querySelector('input').value;
      try {
        const response = await apiFetch('/api/health');
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || '暂时无法连接厨房。'); }
        sessionStorage.setItem('maitaishao-access', passcode); resolve();
      } catch (e) { error.textContent = e instanceof TypeError ? '主厨电脑暂未连接，请稍后重试。' : e.message; }
      finally { button.disabled = false; button.textContent = '进入厨房'; }
    });
  });
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-action="lock-session"]')) {
    event.stopPropagation(); sessionStorage.removeItem('maitaishao-access'); location.reload();
  }
}, true);
