import { apiFetch, initializeConnection, isShared } from './connection.js';
import './cooking-scene.js';
const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0112 0v3m1-16a3 3 0 010 6m3 10v-3a6 6 0 00-3-5"/>',
  book: '<path d="M12 5v16m0-15C8 3 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2z"/>',
  import: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 6v9m-3-3 3 3 3-3M7 18h10"/>',
  basket: '<path d="M3 10h18l-2 11H5L3 10zm4 0 5-8 5 8M9 14v3m6-3v3"/>',
  settings: '<path d="m9 3 6 0 .5 3 2 1 3-.8 2 5-2.5 2v2l2 2-3 4-3-1-2 1-.5 3H9l-.5-3-2-1-3 1-2-4 2-2v-2l-2-2 2-5 3 .8 2-1L9 3z" transform="translate(1 -1) scale(.9)"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM20 2v4m-2-2h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  refresh: '<path d="M20 6v6h-6M4 18v-6h6m9-3a7 7 0 00-12-4L4 8m16 8-3 3a7 7 0 01-12-4"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 017 7v3"/>', send: '<path d="m5 12 7-7 7 7M12 5v15"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  sunrise: '<path d="M3 18h18M5 21h14M6 15a6 6 0 0112 0M12 2v4M3 8l3 2m15-2-3 2"/>',
  moon: '<path d="M20 14A8 8 0 0110 4a8 8 0 1010 10z"/>',
  leaf: '<path d="M20 3C4 2 2 9 5 16s17 7 15-13zM5 20 15 9"/>',
  shield: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6l9-4z"/><path d="m8 12 3 3 5-6"/>',
  heart: '<path d="M12 21 3 12a6 6 0 019-8 6 6 0 019 8l-9 9z"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7a3 3 0 00-4-4L5 15l-1 5z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 5 5 3-3 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', file: '<path d="M14 2H5v20h14V7l-5-5zm0 0v6h5M8 12h8m-8 4h8"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', chat: '<path d="M21 15a3 3 0 01-3 3H8l-5 4V5a3 3 0 013-3h12a3 3 0 013 3v10zM7 8h10m-10 4h7"/>'
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name] || icons.leaf}</svg>`;
const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
const categories = { meat: '荤菜', vegetable: '素菜', staple: '主食', soup: '汤羹', breakfast_staple: '早餐主食', breakfast_protein: '早餐蛋白' };
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const pages = [['menu', 'calendar', '本周菜单'], ['family', 'people', '家庭档案'], ['recipes', 'book', '菜谱知识库'], ['imports', 'import', '幼儿园午餐'], ['shopping', 'basket', '采购清单'], ['settings', 'settings', '厨房设置']];
const tagGroups = { '饮食目标': ['均衡饮食', '控糖', '控脂', '高蛋白', '少盐'], '口味喜好': ['喜欢辣', '不吃辣', '清淡', '爱吃肉', '爱吃鱼', '爱吃蔬菜', '喜欢汤'], '用餐习惯': ['饭量小', '饭量大', '偏软烂', '不爱香菜'] };
const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const displayDate = date => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
const shortDate = date => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
const fmt = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const splitTags = s => String(s || '').split(/[,，、;；\n]/).map(x => x.trim()).filter(Boolean);
let S, week, day, page = 'menu', busy = false, pendingText = '', chatError = '', lastError = '', search = '', category = 'all', shoppingData, shoppingStart, shoppingEnd, checkedItems = new Set();
let editingMember, editingTags = [], editingAvatar = '', activeRecipe, activeImport;
const app = $('#app'), dialog = $('#dialog');
const loadingMarkup = app.innerHTML;
let toastTimer;
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = 'show' + (error ? ' error' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = '', error ? 9000 : 4500); }
async function request(url, data) {
  const response = await apiFetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || '请求失败。');
  if (result.state) S = result.state;
  return result;
}
function avatarSource(member) {
  if (member?.avatar) return member.avatar;
  if (!member) return '';
  const name = member.name || '';
  let role;
  if (member.age < 12) role = 'child';
  else if (/爷爷|外公|祖父/.test(name) || (member.age >= 60 && member.sex === '男')) role = 'grandpa';
  else if (/奶奶|外婆|姥姥|祖母/.test(name) || (member.age >= 60 && member.sex === '女')) role = 'grandma';
  else if (/爸爸|父亲/.test(name) || member.sex === '男') role = 'dad';
  else if (/妈妈|母亲/.test(name) || member.sex === '女') role = 'mom';
  return role ? `/assets/avatar-${role}.png` : '';
}
function avatar(member, mini = false) { const src = avatarSource(member); return `<span class="avatar ${esc(member?.color || '')} ${mini ? 'mini' : ''}" title="${esc(member?.name || '')}">${src ? `<img alt="${esc(member.name)}的形象" src="${esc(src)}">` : esc(member?.name?.slice(0, 1) || '家')}</span>`; }
function portrait(m) { const src = avatarSource(m); return `<div class="portrait">${src ? `<img src="${esc(src)}" alt="${esc(m.name)}的专属形象">` : avatar(m)}</div>`; }
function recipe(id) { return S.recipes.find(r => r.id === id); }
function food(r) { if (!r) return '🍽️'; if (/鱼/.test(r.name)) return '🐟'; if (/鸡蛋|蒸蛋|炒蛋|水煮蛋/.test(r.name)) return '🥚'; if (/牛奶|酸奶/.test(r.name)) return '🥛'; if (/豆浆/.test(r.name)) return '🫘'; if (/面包|馒头/.test(r.name)) return '🍞'; if (/南瓜/.test(r.name)) return '🎃'; if (/虾/.test(r.name)) return '🦐'; return { meat: '🍲', vegetable: '🥬', staple: '🍚', soup: '🥣', breakfast_staple: '🥣', breakfast_protein: '🥚' }[r.category]; }
function button(text, action, extra = '', style = '', ico) { return `<button class="button ${style}" data-action="${action}" ${extra}>${ico ? icon(ico) : ''}${text}</button>`; }
function badge(text, color = '') { return `<span class="badge ${color}">${text}</span>`; }
function avatarStack(ids) { return `<span class="avatar-stack">${ids.map(id => avatar(S.members.find(m => m.id === id), true)).join('')}</span>`; }
function render() {
  const draft = $('#chat-input')?.value || '';
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><img class="brand-mark" src="/assets/maitaishao-icon-v2.png" alt="买汰烧品牌图标"><div><b>买汰烧</b><small>MAI TAI SHAO</small></div></div><div class="nav-label">我 家 的 厨 房</div><nav class="nav" aria-label="主导航">${pages.map(([key, ico, text]) => `<button data-action="page" data-page="${key}" class="${page === key ? 'active' : ''}" ${page === key ? 'aria-current="page"' : ''}>${icon(ico)}<span>${text}</span>${key === 'recipes' ? `<span class="nav-count">${S.recipes.filter(r => r.status === 'confirmed').length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-note">${icon('leaf')}<p>认真吃饭，慢慢生活。<br>把每一餐，留给在乎的人。</p></div><div class="sidebar-foot">${avatar(S.members[0])}<div>我们的小家<br><small class="muted">${S.members.length} 位家庭成员</small></div><span class="online"></span></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">家庭厨房 ${icon('right')} <b>${pages.find(p => p[0] === page)[2]}</b></div><div class="top-actions">${isShared ? button('退出厨房', 'lock-session', '', 'small') : ''}<span class="muted">${displayDate(S.today)} · ${weekdays[(new Date(S.today + 'T12:00Z').getUTCDay() + 6) % 7]}</span>${badge('搭配规则已融合 · 营养待核实', 'amber')}</div></header><div class="body-layout"><main class="main">${lastError ? `<div class="notice error" role="alert">${esc(lastError)}</div>` : ''}${({ menu: menuPage, family: familyPage, recipes: recipesPage, imports: importsPage, shopping: shoppingPage, settings: settingsPage })[page]()}</main>${assistant()}</div></div></div>`;
  if ($('#chat-input')) $('#chat-input').value = draft;
  const messages = $('.chat-messages'); if (messages && (S.messages.length || busy)) messages.scrollTop = messages.scrollHeight;
}
function weekControl() { return `<div class="week-control"><button class="icon-button" data-action="week" data-offset="-7" aria-label="上一周">${icon('left')}</button><b>${shortDate(week)} — ${shortDate(addDays(week, 6))}</b><button class="icon-button" data-action="week" data-offset="7" aria-label="下一周">${icon('right')}</button>${button('下周', 'next-week', '', 'small soft')}</div>`; }
function menuPage() {
  const menu = S.menus[week], meals = menu?.meals.filter(m => m.date === day) || [], issues = S.checks[week] || [];
  const pending = S.proposals.findLast(p => p.kind !== 'kitchen_update' && p.week === week && p.status === 'pending' && p.baseRevision === S.revision);
  return `<section class="menu-intro" aria-label="本周菜单概览"><div class="menu-intro-copy"><h1>这一周，好好吃饭。</h1><div class="menu-intro-meta">${avatarStack(S.members.map(m => m.id))}<span>${S.members.length} 位家人</span><span>${menu ? menu.meals.filter(m => m.dishes.length).length : 0} 餐已安排</span></div></div><div class="menu-intro-art" aria-hidden="true"><img src="/assets/family-story.png" alt=""><img src="/assets/family-together.png" alt=""></div></section><div class="week-toolbar">${weekControl()}<div class="week-controls-actions">${menu ? button('撤销', 'undo', '', 'small', 'undo') : ''}${button(menu ? '重新安排' : '生成一周菜单', 'generate', '', 'primary small', 'spark')}</div></div>${issues.length ? `<div class="notice error">有 ${issues.length} 项需要重新核对：${esc(issues.slice(0, 3).join('；'))}${issues.length > 3 ? '…' : ''}</div>` : ''}${pending ? `<div class="notice">有一份待确认的菜单调整。${button('查看变更', 'proposal', `data-id="${pending.id}"`, 'small soft')}</div>` : ''}${menu && S.nutrition?.[week] ? `<p class="nutrition-note">本周家庭菜单已记录 <b>${S.nutrition[week].foodCount}</b> 种食材 · 营养参考：暂不评价<small>仅统计家庭菜单，尚未计入完整的在外用餐与实际摄入。</small></p>` : ''}<div class="date-tabs" role="group" aria-label="选择日期">${weekdays.map((label, index) => { const date = addDays(week, index); return `<button class="day-tab ${date === day ? 'active' : ''}" data-action="day" data-date="${date}" aria-pressed="${date === day}"><span class="weekday">${label}</span><b>${Number(date.slice(8))}</b><span class="dot"></span></button>`; }).join('')}</div><div class="day-title"><h2>${displayDate(day)}的三餐</h2><span>${menu ? `菜单 v${menu.version} · 按实际用餐人数安排` : '先生成菜单，再一起慢慢调整'}</span></div>${menu ? `<div class="meal-grid">${['breakfast', 'lunch', 'dinner'].map(kind => mealCard(meals.find(m => m.kind === kind), kind)).join('')}</div>` : `<div class="no-menu">${icon('calendar')}<h3>这一周，还等你安排</h3><p>从已确认菜谱中选择，照顾家人的用餐规律与饮食限制。</p>${button('生成一周菜单', 'generate', '', 'primary', 'spark')}</div>`}<div class="rule-strip"><span>${icon('shield')}过敏与明确忌口校验</span><span>${icon('calendar')}同菜间隔 ${S.rules.repeatGapDays} 个完整日</span><span>${icon('leaf')}暂行搭配 · 不计算热量</span></div><div class="bottom-grid"><section class="info-card"><div class="info-head">${icon('import')}<h3>宝宝的幼儿园午餐</h3></div><p>${S.imports.some(i => i.week === week && i.status === 'confirmed') ? '本周已有确认记录，晚餐会避开当天重复菜。' : '本周还没有确认食谱。导入后，帮宝宝避开晚餐的重复菜。'}</p><button class="link" data-action="page" data-page="imports">${S.imports.some(i => i.week === week && i.status === 'confirmed') ? '查看午餐记录' : '导入本周食谱'}${icon('arrow')}</button></section><section class="info-card"><div class="info-head">${icon('basket')}<h3>把计划，变成一篮食材</h3></div><p>按菜单和实际份量汇总。修改菜单后，采购数量也会随之更新。</p><button class="link" data-action="page" data-page="shopping">查看采购清单${icon('arrow')}</button></section></div><p class="footer-note">一日三餐，四季有味。</p>`;
}
function mealCard(meal, kind) {
  const members = meal?.memberIds || [], hasChildrenAway = kind === 'lunch' && S.members.some(m => m.age < 7 && !members.includes(m.id));
  const mainCount = meal?.dishes.filter(d => recipe(d.recipeId).category !== 'staple').length || 0, hasStaple = meal?.dishes.some(d => recipe(d.recipeId).category === 'staple');
  return `<article class="meal-card ${kind}"><div class="meal-card-top"><div class="meal-kind"><span class="meal-icon">${icon({ breakfast: 'sunrise', lunch: 'sun', dinner: 'moon' }[kind])}</span><div><b>${mealNames[kind]}</b><small>${kind.toUpperCase()}</small></div></div><button class="icon-button" data-action="attendance" data-kind="${kind}" aria-label="调整${mealNames[kind]}人员和饭量">${icon('edit')}</button></div><div class="meal-attendance">${avatarStack(members)}<small>${members.length} 人用餐</small></div><div class="dish-list">${meal?.dishes.length ? meal.dishes.map(d => { const r = recipe(d.recipeId); return `<div class="dish-row"><span class="dish-emoji" aria-hidden="true">${food(r)}</span><button class="dish-name" data-action="recipe" data-id="${r.id}" data-servings="${d.servings}"><b>${esc(r.name)}</b><small>${categories[r.category]}</small></button><button class="icon-button replace" data-action="replace" data-kind="${kind}" data-id="${r.id}" aria-label="替换${esc(r.name)}" title="替换同类菜">${icon('refresh')}</button></div>`; }).join('') : '<div class="empty-meal">这一餐不在家吃<br>把时间留给别的美好。</div>'}</div><div class="meal-footer"><span>${icon(hasChildrenAway ? 'people' : 'heart')} ${hasChildrenAway ? '宝宝在幼儿园用餐' : '一桌共享，照顾每个人'}</span><span>${kind === 'breakfast' ? `${meal?.dishes.length || 0} 道` : `${mainCount} 道菜${hasStaple ? '＋主食' : ''}`}</span></div></article>`;
}
function assistant() {
  const welcome = '嗨，我是你家的厨房小助手。\n\n菜单安排、家人的标签、过敏和喜好，都可以直接告诉我。明确的修改会直接保存，并告诉你结果。想先看看方案，可以加一句“先预览”。\n\n比如，给妈妈加上控糖标签，或记录宝宝对虾过敏。也可以修改固定用餐规律、排菜设置和草稿内容。';
  return `<aside class="assistant" aria-label="厨房 Agent 助手"><div class="assistant-head"><span class="assistant-logo">${icon('spark')}</span><div><h3>厨房小助手</h3><small><span class="online"></span> ${S.agentLastRun?.ok ? '已验证连接' : S.agent.available ? '已就绪' : '待配置'} · ${esc(S.agent.label)}</small></div><button class="icon-button dots" data-action="page" data-page="settings" aria-label="助手连接设置">${icon('settings')}</button></div><div class="chat-messages" aria-live="polite"><div class="chat-date">让每一餐，都多一点心意</div><div class="chat-message"><span class="chat-icon">${icon('spark')}</span><div><div class="chat-bubble">${esc(welcome)}</div></div></div>${!S.messages.length ? `<div class="chat-suggestions">${['给妈妈加上控糖标签', '宝宝喜欢南瓜，不喜欢香菜', '周三晚餐只做两道菜'].map(t => `<button data-action="suggest" data-text="${esc(t)}">${esc(t)}${icon('arrow')}</button>`).join('')}</div>` : ''}${S.messages.map(m => `<div class="chat-message ${m.role === 'user' ? 'user' : 'assistant-message'}">${m.role === 'assistant' ? `<span class="chat-icon">${icon('spark')}</span>` : ''}<div><div class="chat-bubble">${esc(m.text)}</div>${m.role === 'assistant' ? `<div class="chat-source">${esc(m.provider || '厨房助手')} · ${Math.round((m.durationMs || 0) / 1000)} 秒</div>` : ''}${m.proposalId ? proposalCard(m.proposalId) : ''}</div></div>`).join('')}${busy ? `<div class="chat-message user"><div class="chat-bubble">${esc(pendingText)}</div></div><div class="loading-inline"><span class="spinner"></span>正在理解需求并核对资料…</div><div class="progress-note">正在校验并处理，完成后会显示实际修改结果。</div>` : ''}${chatError ? `<div class="error-box">${esc(chatError)}<br>${button('重试上一条', 'retry-chat', '', 'small')}</div>` : ''}</div><div class="assistant-context">${icon('book')}已了解 ${S.members.length} 位家人 · ${S.recipes.filter(r => r.status === 'confirmed').length} 道菜谱 · ${shortDate(week)}起的一周</div><form id="chat-form" class="chat-form"><label class="visually-hidden" for="chat-input">对厨房助手说</label><textarea id="chat-input" placeholder="安排菜单，或修改家人的标签、过敏、喜好…" ${busy ? 'disabled' : ''}></textarea><div class="chat-form-bottom"><span>Enter 发送 · Shift + Enter 换行</span><button class="send-button" type="submit" aria-label="发送消息" ${busy ? 'disabled' : ''}>${icon('send')}</button></div></form><p class="assistant-disclaimer">明确指令直接执行；说“先预览”可只看建议。</p></aside>`;
}
function proposalCard(id) {
  const p = S.proposals.find(p => p.id === id); if (!p) return '';
  if (p.status !== 'pending') return `<div class="chat-source">${p.status === 'confirmed' ? (p.automatic ? '✓ 已执行' : '✓ 已确认执行') : '已取消'}</div>`;
  if (p.baseRevision !== S.revision) return '<div class="chat-source">数据已变化，此建议已过期，请重新提出需求。</div>';
  return `<div class="pending-card"><b>${icon(p.kind === 'kitchen_update' ? 'edit' : 'calendar')} ${p.kind === 'kitchen_update' ? '资料修改建议' : '菜单调整建议'}</b><p>查看修改前后差异，确认后生效。</p>${button('查看并确认', 'proposal', `data-id="${p.id}"`, 'soft small')}</div>`;
}
function heading(english, title, desc, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${english}</div><h1>${title}</h1><p class="sub">${desc}</p></div>${action}</div>`; }
function familyPage() {
  return `${heading('EVERYONE HAS A PLACE', '家人的小档案', '记住每个人的口味，也记住一起吃饭的时间。', button('添加成员', 'member', '', 'primary small', 'plus'))}<div class="family-grid">${S.members.map(m => `<article class="member-card">${portrait(m)}<h3>${esc(m.name)} <small class="muted">${m.age} 岁</small></h3><p>默认饭量 ${fmt(m.portion)} 份 · ${esc(m.spice)}</p><div class="tags">${(m.profileTags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${m.allergies.map(t => `<span class="tag peach">${esc(t)}过敏</span>`).join('')}</div><p>${m.avatar ? '专属形象已设置' : avatarSource(m) ? '家庭角色形象 · 可上传替换' : '可上传专属形象'}</p>${button('编辑档案', 'member', `data-id="${m.id}"`, 'small', 'edit')}</article>`).join('')}</div><section class="panel"><div class="panel-header"><h2>固定用餐规律</h2>${badge('临时安排不会覆盖固定规律')}</div><div class="table-wrap"><table><thead><tr><th>成员 / 在家吃饭</th>${weekdays.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${S.members.map(m => `<tr><td>${esc(m.name)}</td>${m.schedule.map(s => `<td>${['breakfast', 'lunch', 'dinner'].filter(k => s[k]).map(k => mealNames[k][0]).join(' · ') || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="sub">需要临时调整某一餐？在菜单卡片右上角修改人员和饭量，核对建议后确认。</p></section><section class="panel"><div class="panel-header"><h2>用餐反馈</h2>${button('记一笔', 'feedback', '', 'small soft', 'plus')}</div>${S.feedback.length ? S.feedback.slice().reverse().map(f => `<div class="list-row"><div><h3>${esc(S.members.find(m => m.id === f.memberId)?.name || '家人')} · ${displayDate(f.date)}</h3><p>${esc(f.text)}</p><span class="tag">${f.applied ? '已确认长期禁用' : f.scope === 'long_term' ? '长期建议，待确认' : '本次反馈'}</span></div>${f.scope === 'long_term' && !f.applied && f.avoidFood ? button(`确认不再安排「${esc(f.avoidFood)}」`, 'confirm-feedback', `data-id="${f.id}"`, 'small') : ''}</div>`).join('') : '<div class="empty">今天吃得怎么样？<br>记下家人的感受，让下一餐更合心意。</div>'}</section>`;
}
function recipesPage() {
  const list = S.recipes.filter(r => (category === 'all' || r.category === category || category === 'draft' && r.status === 'draft') && [r.name, ...r.tags, ...r.allergens, ...r.ingredients.map(i => i.name), ...r.steps, r.source || ''].some(text => text.includes(search)));
  return `<div class="knowledge-heading">${heading('THE FAMILY RECIPE KNOWLEDGE', '家里的菜谱知识库', `${S.recipes.filter(r => r.status === 'confirmed').length} 道已确认菜谱 · 新菜先核对，再端上餐桌。`, button('手动添加', 'manual-recipe', '', 'small', 'plus') + button('助手整理菜谱', 'new-recipe', '', 'primary small', 'spark'))}</div>${S.knowledge?.connected ? '<p class="sub">知识库已连接 · 修改会保留历史版本</p>' : ''}<div class="search-row"><div class="search-box"><label for="recipe-search" class="visually-hidden">搜索菜谱</label><input class="text-input" id="recipe-search" placeholder="搜索菜名、食材、过敏标签或做法…" value="${esc(search)}"></div></div><div class="chips" style="margin-bottom:20px">${[['all', '全部'], ...Object.entries(categories), ['draft', '待确认']].map(([key, label]) => `<button class="chip ${category === key ? 'active' : ''}" data-action="category" data-category="${key}">${label}</button>`).join('')}</div><div class="recipe-grid">${list.map(r => `<button class="recipe-card" data-action="recipe" data-id="${r.id}"><div class="recipe-visual ${r.category}"><span class="food" aria-hidden="true">${food(r)}</span>${r.status === 'draft' ? badge('待确认', 'amber') : ''}</div><div class="recipe-card-content"><b>${esc(r.name)}</b><p>${categories[r.category]} · 知识 v${r.knowledgeVersion || 1} · ${r.ingredients.length} 种主材${r.repeatExempt ? ' · 早餐例外' : ''}</p><div class="tags">${r.tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></button>`).join('')}</div>${!list.length ? '<div class="empty">没有找到对应知识，试试其他关键词，或添加菜谱。</div>' : ''}<p class="footer-note">新增内容先核对再入库，过敏与禁忌仍由家庭规则校验。</p>`;
}
function importsPage() {
  return `${heading('A LITTLE LOOK AT LUNCH', '幼儿园今天吃什么', '先核对宝宝的午餐，再安排家里的晚餐。')}${weekControl()}<section class="panel section-gap"><div class="panel-header"><h2>导入本周午餐</h2>${badge('确认后才参与排菜')}</div><p class="sub" style="margin-bottom:18px">可以粘贴食谱文字、提供网页链接，或者上传截图。识别后还能修改。</p>${button('开始导入', 'new-import', '', 'primary', 'import')}<p class="screen-reader-note">受登录、反爬或图片清晰度影响的内容，会提示失败；不会编造识别结果。</p></section><section class="panel"><div class="panel-header"><h2>导入记录</h2></div>${S.imports.filter(i => i.week === week).length ? S.imports.filter(i => i.week === week).slice().reverse().map(i => `<div class="list-row"><div><h3>${esc(S.members.find(m => m.id === i.memberId)?.name || '宝宝')} · ${shortDate(i.week)}这周</h3><p>${i.records.length} 天午餐 · ${esc(i.type === 'image' ? '截图识别' : i.type === 'link' ? '链接提取' : '文字识别')}</p>${badge(i.status === 'confirmed' ? '已确认' : '待核对', i.status === 'confirmed' ? '' : 'amber')}</div><div class="actions">${button('查看', 'import-detail', `data-id="${i.id}"`, 'small')}${i.status === 'confirmed' ? button('检查重复并建议调整', 'resolve-import', `data-id="${i.id}"`, 'small soft') : ''}</div></div>`).join('') : '<div class="empty">还没有本周午餐记录。<br>家庭菜单可以先生成，导入后再检查重复。</div>'}</section>`;
}
function shoppingPage() {
  const d = shoppingData;
  return `${heading('FROM PLAN TO BASKET', '买得刚刚好', '按实际菜谱份量汇总，给忙碌的一周少一点惦记。', button('导出清单', 'download-shopping', '', 'small', 'download'))}<section class="panel"><form id="shopping-form"><div class="form-grid"><div class="field"><label for="shopping-start">开始日期</label><input id="shopping-start" type="date" name="start" value="${shoppingStart}" required></div><div class="field"><label for="shopping-end">结束日期</label><input id="shopping-end" type="date" name="end" value="${shoppingEnd}" required></div></div><button class="button primary" type="submit">${icon('basket')}重新汇总</button></form></section>${d ? `<div class="shopping-summary"><b>${d.items.length}</b><div><h3>种食材，心里有数</h3><p>${displayDate(d.start)} — ${displayDate(d.end)} · ${Object.entries(d.versions).map(([w, v]) => `${shortDate(w)}周菜单 v${v}`).join('，') || '暂无菜单'}</p></div></div><section class="panel">${d.items.length ? d.items.map((item, index) => `<label class="shopping-item ${checkedItems.has(index) ? 'checked' : ''}"><input type="checkbox" data-check="${index}" ${checkedItems.has(index) ? 'checked' : ''}><span><b>${esc(item.name)}</b><p>${item.dishes.map(esc).join('、')}</p></span><span class="quantity">${fmt(item.amount)} <small class="muted">${({ g: '克', ml: '毫升' })[item.unit] || esc(item.unit)}</small></span></label>`).join('') : '<div class="empty">这个日期范围还没有菜单，先去安排几餐吧。</div>'}</section><p class="sub">${esc(d.basis)}<br>幼儿园午餐不计入。不扣除库存；勾选仅用于当前页面核对。按“个”汇总的数量可在购买时向上取整。</p>${d.warnings.length ? `<div class="notice">${d.warnings.map(esc).join('；')}</div>` : ''}` : '<div class="loading-inline"><div class="spinner"></div>正在汇总食材…</div>'}`;
}
function openDialog(title, html) { dialog.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body">${html}</div>`; if (!dialog.open) dialog.showModal(); }
function field(label, name, value = '', type = 'text', extra = '') { return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`; }
function textarea(label, name, value = '', help = '') { return `<div class="field"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}">${esc(value)}</textarea>${help ? `<small>${help}</small>` : ''}</div>`; }
function tagPicker() {
  return `<div class="tag-groups">${Object.entries(tagGroups).map(([title, tags]) => `<div class="tag-group"><span>${title}</span><div class="chips">${tags.map(t => `<button type="button" class="chip ${editingTags.includes(t) ? 'active' : ''}" aria-pressed="${editingTags.includes(t)}" data-action="toggle-tag" data-tag="${esc(t)}">${esc(t)}${editingTags.includes(t) ? ' ✓' : ''}</button>`).join('')}</div></div>`).join('')}<div class="tag-group"><span>自定义标签</span><div class="custom-tag-input"><input class="text-input" id="custom-tag" maxlength="30" placeholder="如：喜欢菌菇、周末在家吃饭"><button type="button" class="button small" data-action="add-tag">添加</button></div><div class="chips" style="margin-top:9px">${editingTags.filter(t => !Object.values(tagGroups).flat().includes(t)).map(t => `<button type="button" class="chip active" data-action="toggle-tag" data-tag="${esc(t)}" aria-label="删除标签${esc(t)}">${esc(t)} ×</button>`).join('')}</div></div></div>`;
}
function memberDialog(id) {
  editingMember = structuredClone(S.members.find(m => m.id === id) || { id: '', name: '', age: 30, sex: '未设置', portion: 1, spice: '不辣', likes: [], dislikes: [], allergies: [], restrictions: [], profileTags: [], avatar: '', diseaseNotes: '', schedule: weekdays.map(() => ({ breakfast: true, lunch: true, dinner: true })) });
  editingTags = [...(editingMember.profileTags || [])]; editingAvatar = editingMember.avatar || '';
  const m = editingMember;
  openDialog(id ? `编辑${esc(m.name)}的档案` : '认识一位新家人', `<form id="member-form"><div class="avatar-editor"><div id="avatar-preview">${avatar(m)}</div><div><b>专属成员形象</b><p>预留给你们的角色图，也可以先上传一张照片。</p><label class="button small" for="avatar-upload">${icon('image')}上传 / 替换形象</label><input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden">${button('恢复默认', 'clear-avatar', 'type="button"', 'small')}</div></div><div class="form-grid">${field('姓名或称呼', 'name', m.name, 'text', 'required maxlength="30"')}${field('年龄', 'age', m.age, 'number', 'required min="0" max="120"')}<div class="field"><label for="f-sex">性别</label><select id="f-sex" name="sex">${['女', '男', '未设置'].map(s => `<option ${m.sex === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${field('默认饭量（参考份数）', 'portion', m.portion, 'number', 'min="0.1" max="5" step="0.1" required')}</div><div class="field"><label>选几个属于 Ta 的标签</label><div id="tag-picker">${tagPicker()}</div><small>饮食目标先保存，控糖、控脂等具体标准待正式规则确认。用餐习惯以逐餐规律为准。</small></div><div class="form-grid">${field('喜欢吃（逗号分隔）', 'likes', m.likes.join('，'))}${field('不喜欢（逗号分隔）', 'dislikes', m.dislikes.join('，'))}${field('过敏食材（整餐排除）', 'allergies', m.allergies.join('，'))}${field('明确禁用食材 / 菜名', 'restrictions', m.restrictions.join('，'))}<div class="field"><label for="f-spice">辣度接受程度</label><select id="f-spice" name="spice">${['不辣', '微辣', '中辣', '喜欢辣'].map(s => `<option ${m.spice === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${field('疾病或饮食备注', 'diseaseNotes', m.diseaseNotes || '')}</div><p class="screen-reader-note">疾病名称只保存为备注；明确填写的过敏和禁用食材作为约束。</p><div class="divider"></div><h3>每周固定在家用餐</h3><div class="table-wrap"><table class="schedule-table"><thead><tr><th>餐次</th>${weekdays.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${Object.entries(mealNames).map(([kind, label]) => `<tr><td>${label}</td>${m.schedule.map((s, index) => `<td><input type="checkbox" name="schedule-${index}-${kind}" aria-label="${weekdays[index]}${label}在家吃" ${s[kind] ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="form-actions"><button type="button" class="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">保存档案</button></div></form>`);
}
function recipeDialog(id, servings) {
  activeRecipe = recipe(id); const r = activeRecipe; if (!r) return;
  if (r.status === 'draft') return recipeEditDialog();
  const count = Number(servings) || r.baseServings;
  openDialog(esc(r.name), `<cooking-scene recipe-name="${esc(r.name)}"></cooking-scene><div class="tags">${badge(categories[r.category])}${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}${r.repeatExempt ? badge('基础早餐可重复') : ''}</div><p class="sub">${esc(r.source)}</p><div class="actions">${button('编辑知识', 'edit-knowledge', `data-id="${r.id}"`, 'small', 'edit')}${button('历史版本', 'knowledge-history', `data-id="${r.id}"`, 'small', 'clock')}${badge(`知识 v${r.knowledgeVersion || 1}`)}</div><div class="divider"></div><div class="panel-header"><h3>准备食材</h3><span class="muted">${fmt(count)} 份</span></div><table><tbody>${r.ingredients.map(i => `<tr><td>${esc(i.name)}</td><td style="text-align:right">${fmt(i.amount * count / r.baseServings)} ${esc(i.unit)}</td></tr>`).join('')}</tbody></table><p class="sub">过敏及蛋白来源标签：${r.allergens.length ? r.allergens.map(esc).join('、') : '未标注常见过敏来源，请核对实际配料'}</p><div class="divider"></div><h3>慢慢做，一步一步来</h3><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><a class="button soft" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(r.name + ' 家常做法')}" target="_blank" rel="noopener noreferrer">${icon('book')}在 B 站搜索做法</a><p class="screen-reader-note">这是菜名搜索入口，未核验具体视频。</p>`);
}
function recipeEditDialog() {
  const r = activeRecipe;
  openDialog(r.status === 'confirmed' ? '编辑菜谱知识' : '核对新菜谱', `<div class="notice">${r.status === 'confirmed' ? '更新会用于菜谱详情、后续排菜和采购计算；菜单安排保持不变，旧知识版本保留可查。请核对食材、用量和过敏标签。' : '先保存草稿，再核对食材、用量、过敏标签和做法，确认入库后才参与排菜。'}</div><form id="recipe-edit-form"><div class="form-grid">${field('菜名', 'name', r.name, 'text', 'required')}<div class="field"><label for="f-category">分类</label><select id="f-category" name="category">${Object.entries(categories).map(([key, text]) => `<option value="${key}" ${r.category === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div>${field('基础份数', 'baseServings', r.baseServings, 'number', 'min="0.1" step="0.1" required')}${field('过敏 / 蛋白来源标签', 'allergens', r.allergens.join('，'))}</div>${textarea('食材用量（一行一项：名称,数量,单位）', 'ingredients', r.ingredients.map(i => `${i.name},${i.amount},${i.unit}`).join('\n'), '单位支持 g、ml、个。示例：鸡蛋,2,个')}${textarea('制作步骤（一行一步）', 'steps', r.steps.join('\n'))}${field('口味标签（逗号分隔）', 'tags', r.tags.join('，'))}${textarea('来源说明', 'source', r.source || '')}<div class="form-actions">${r.status !== 'confirmed' ? '<button type="submit" name="mode" value="draft" class="button">保存草稿</button>' : ''}${r.id ? `<button type="submit" name="mode" value="confirm" class="button primary">${r.status === 'confirmed' ? '确认更新知识库' : '核对完成，确认入库'}</button>` : ''}</div></form>`);
}
function newRecipeDialog() {
  openDialog('给餐桌添一道新菜', `<form id="new-recipe-form"><p class="sub" style="margin-bottom:18px">输入菜名、链接或做法文字，也可以附一张食谱图。助手会整理成可编辑草稿。</p><div class="field"><label for="recipe-source-type">输入方式</label><select id="recipe-source-type" name="type"><option value="text">菜名 / 做法文字</option><option value="link">网页链接</option><option value="image">食谱截图</option></select></div>${textarea('菜名、链接或文字', 'text', '', '例如：冬瓜虾仁汤')}<div class="field"><label for="recipe-image">附加截图（可选）</label><input id="recipe-image" name="image" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="form-actions"><button class="button primary" type="submit">${icon('spark')}让助手整理草稿</button></div><div class="form-progress"></div></form>`);
}
function attendanceDialog(kind) {
  const meal = S.menus[week]?.meals.find(m => m.date === day && m.kind === kind);
  const ids = meal?.memberIds || S.members.filter(m => m.schedule[(new Date(day + 'T12:00Z').getUTCDay() + 6) % 7][kind]).map(m => m.id);
  const amounts = S.overrides[`${day}:${kind}`]?.portions || {};
  openDialog(`${displayDate(day)} · ${mealNames[kind]}谁在家`, `<form id="attendance-form" data-kind="${kind}"><div class="notice">只修改这一天这一餐，不覆盖固定规律。新菜单会先供你核对。</div>${S.members.map(m => `<div class="attendance-row"><label class="check-row"><input type="checkbox" name="member-${m.id}" ${ids.includes(m.id) ? 'checked' : ''}>${avatar(m)}${esc(m.name)}</label><label>参考份数 <input type="number" name="portion-${m.id}" value="${amounts[m.id] ?? m.portion}" min="0.1" max="5" step="0.1" required></label></div>`).join('')}<div class="form-actions"><button type="submit" class="button primary">查看调整建议</button></div></form>`);
}
function proposalDialog(id) {
  const proposal = S.proposals.find(p => p.id === id); if (!proposal) return;
  if (proposal.kind === 'kitchen_update') {
    const stale = proposal.baseRevision !== S.revision || proposal.status !== 'pending';
    const targets = new Set(proposal.changes.map(c => c.target));
    const notes = [targets.has('member') ? '确认后更新家庭档案，后续排菜使用新信息。已有菜单保留，冲突会提示核对。' : '', targets.has('settings') ? '确认后更新自动排菜设置。' : '', targets.has('recipe') ? '新菜谱保存为草稿，核对入库后才参与排菜；已确认菜谱更新保留历史版本。' : '', targets.has('import') ? '午餐保存为草稿，在幼儿园午餐核对导入后才参与避重。' : '', targets.has('document') ? '资料仍为待接入，不会自动修改执行规则。' : ''].filter(Boolean);
    return openDialog('核对这次资料修改', `<p class="sub">${esc(proposal.reply)}</p><div class="notice">${notes.map(esc).join('<br>')}</div>${stale ? '<div class="notice error">这份建议已过期或已处理，请重新提出需求。</div>' : ''}${proposal.diffs.map(d => `<div class="compare-row"><h3>${esc(d.name)} · ${esc(d.label)}</h3><div class="compare-before">原来　${esc(d.before)}</div><div class="compare-after">改为　${esc(d.after)}</div></div>`).join('')}${proposal.warnings.length ? `<div class="notice error"><b>已有菜单需要核对</b><ul>${proposal.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}<div class="form-actions">${button('暂不修改', 'cancel-proposal', `data-id="${id}"`)}${button('确认修改', 'confirm-proposal', `data-id="${id}" ${stale ? 'disabled' : ''}`, 'primary', 'check')}</div>`);
  }
  const old = S.menus[proposal.week]?.meals || [];
  const changed = proposal.meals.filter(m => JSON.stringify(m) !== JSON.stringify(old.find(o => o.date === m.date && o.kind === m.kind)));
  const dishText = meal => meal?.dishes.map(d => `${recipe(d.recipeId)?.name} ${fmt(d.servings)}份`).join('、') || '不在家用餐 / 尚未安排';
  const peopleText = meal => meal?.memberIds.map(id => S.members.find(m => m.id === id)?.name).join('、') || '无人';
  const stale = proposal.baseRevision !== S.revision || proposal.status !== 'pending';
  openDialog('这次，我们这样调整', `<p class="sub">${esc(proposal.reply)}</p><div class="tags">${badge(`${changed.length} 餐有变化`)}${badge('确认后同步采购数量')}</div>${stale ? '<div class="notice error">这份建议已过期或已处理，请重新提出需求。</div>' : ''}${changed.map(m => { const before = old.find(o => o.date === m.date && o.kind === m.kind); return `<div class="compare-row"><h3>${displayDate(m.date)} · ${mealNames[m.kind]}</h3><div class="compare-before">原来　${esc(dishText(before))}<br><small>用餐：${esc(peopleText(before))}</small></div><div class="compare-after">调整　${esc(dishText(m))}<br><small>用餐：${esc(peopleText(m))}</small></div></div>`; }).join('') || '<div class="empty">没有需要修改的餐次。</div>'}<div class="form-actions">${button('暂不调整', 'cancel-proposal', `data-id="${id}"`)}${button('确认调整', 'confirm-proposal', `data-id="${id}" ${stale ? 'disabled' : ''}`, 'primary', 'check')}</div>`);
}
const kindergartenLink = 'https://mp.weixin.qq.com/s/S58hzju3Y5f13cIgwNsZsg';
function importDialog() {
  openDialog('导入幼儿园午餐', `<form id="import-form"><div class="form-grid"><div class="field"><label for="import-member">适用成员</label><select id="import-member" name="memberId">${S.members.map(m => `<option value="${m.id}" ${m.age < 7 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>${field('适用周的周一', 'week', week, 'date', 'required')}<div class="field"><label for="school-group">班级组</label><select id="school-group" name="schoolGroup"><option value="托小" selected>托小班</option><option value="中大">中大班</option><option value="">暂不确定，先核对</option></select></div></div><div class="field"><label for="import-type">来源方式</label><select id="import-type" name="type"><option value="link">网页链接</option><option value="image">上传截图</option><option value="text">粘贴文字</option></select></div>${textarea('食谱链接 / 原文', 'text', kindergartenLink, '已预填更正后的公众号文章。会读取正文及菜单图片；请核对适用周次。')}<div class="upload-zone">${icon('image')}<p>也可以直接上传食谱截图<br>PNG、JPG、WebP，最大 6MB</p><input name="image" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传食谱截图"></div><p class="sub">只提取午餐；只有星期没有日期时，将使用你选择的周次，确认前请核对。</p><div class="form-actions"><button type="submit" class="button primary">${icon('spark')}识别并预览</button></div><div class="form-progress"></div></form>`);
}
function importDetail(id) {
  activeImport = S.imports.find(i => i.id === id); const entry = activeImport; if (!entry) return;
  const confirmed = entry.status === 'confirmed';
  openDialog(confirmed ? '已确认的幼儿园午餐' : '核对识别结果', `<div class="notice">${esc(entry.note || '请核对日期和菜名。')}${confirmed ? '' : ' 修改后点击确认，才参与排菜。'}</div>${entry.image ? `<img class="import-source-image" src="${esc(entry.image)}" alt="上传的原始食谱">` : ''}${(entry.sourceImages || []).map(img => `<details><summary>查看识别依据 · 原文图片 ${img.index}</summary><img class="import-source-image" src="${esc(img.image)}" alt="公众号原始菜单图片 ${img.index}"></details>`).join('')}<form id="import-confirm-form"><div class="table-wrap"><table><thead><tr><th>日期</th><th>午餐菜品（逗号分隔）</th></tr></thead><tbody>${entry.records.map((r, index) => `<tr><td><input class="text-input" type="date" name="date-${index}" value="${esc(r.date)}" required ${confirmed ? 'readonly' : ''}>${r.uncertain ? '<small class="uncertain">请重点核对</small>' : ''}</td><td><input class="text-input" name="dishes-${index}" value="${esc(r.dishes.join('，'))}" required ${confirmed ? 'readonly' : ''}></td></tr>`).join('')}</tbody></table></div><p class="sub">外部午餐仅用于避重，不计入家庭采购。</p>${!confirmed ? '<div class="form-actions"><button class="button primary" type="submit">日期菜名已核对，确认导入</button></div>' : ''}</form><details style="margin-top:20px"><summary class="muted">查看原始来源</summary><div class="doc-text" style="margin-top:10px">${esc(entry.source)}</div></details>`);
}
function feedbackDialog() {
  openDialog('记下这一餐的感受', `<form id="feedback-form"><div class="form-grid"><div class="field"><label for="feedback-member">哪位家人</label><select id="feedback-member" name="memberId">${S.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>${field('日期', 'date', day, 'date', 'required')}<div class="field"><label for="feedback-meal">餐次</label><select id="feedback-meal" name="meal">${Object.entries(mealNames).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>${textarea('吃得怎么样？', 'text', '', '例如：宝宝觉得南瓜很好吃，今天剩了一点米饭。')}<p class="sub">这里保存本次反馈。长期调整可以对右侧助手说“以后不要再做…”，再确认建议。</p><div class="form-actions"><button class="button primary" type="submit">保存反馈</button></div></form>`);
}
function documentDialog(kind) {
  openDialog('上传' + esc(kind), `<form id="document-form" data-kind="${esc(kind)}"><div class="notice">资料先作为待接入文档保存。后续核对规则和字段后再启用，当前菜单不受影响。</div>${field('资料名称', 'name', kind + '待确认版', 'text', 'required')}<div class="field"><label for="document-file">读取 Markdown / 纯文本文件</label><input id="document-file" type="file" accept=".md,.txt,.json" name="file"></div>${textarea('资料正文', 'content')}<div class="form-actions"><button class="button primary" type="submit">保存待接入资料</button></div></form>`);
}
async function loadShopping() { shoppingStart ||= week; shoppingEnd ||= addDays(week, 6); shoppingData = await request(`/api/shopping?start=${shoppingStart}&end=${shoppingEnd}`); checkedItems.clear(); }
async function changePage(name) { page = name; lastError = ''; if (page === 'shopping') await loadShopping(); render(); }
async function action(event) {
  const btn = event.target.closest('[data-action]'); if (!btn) return;
  event.preventDefault(); const a = btn.dataset.action;
  if (btn.disabled) return;
  try {
    lastError = '';
    if (a === 'page') return await changePage(btn.dataset.page);
    if (a === 'close-dialog') return dialog.close();
    if (a === 'day') { day = btn.dataset.date; return render(); }
    if (a === 'week' || a === 'next-week') { week = a === 'next-week' ? S.defaultWeek : addDays(week, Number(btn.dataset.offset)); day = week; shoppingStart = week; shoppingEnd = addDays(week, 6); return render(); }
    if (a === 'member') return memberDialog(btn.dataset.id);
    if (a === 'recipe') return recipeDialog(btn.dataset.id, btn.dataset.servings);
    if (a === 'new-recipe') return newRecipeDialog();
    if (a === 'manual-recipe') { activeRecipe = { id: '', status: 'draft', name: '', category: 'meat', baseServings: 1, ingredients: [], allergens: [], steps: [], tags: [], source: '手动添加' }; return recipeEditDialog(); }
    if (a === 'edit-knowledge') { activeRecipe = structuredClone(recipe(btn.dataset.id)); return recipeEditDialog(); }
    if (a === 'knowledge-history') {
      openDialog('菜谱历史版本', '<div class="loading-inline"><span class="spinner"></span>正在读取知识版本…</div>');
      const history = await request(`/api/knowledge/history?id=${encodeURIComponent(btn.dataset.id)}`);
      return openDialog('菜谱历史版本', history.versions.map(r => `<section class="compare-row"><h3>${esc(r.name)} · v${r.knowledgeVersion}</h3><p class="sub">${esc(new Date(r.knowledgeUpdatedAt).toLocaleString('zh-CN'))} · ${r.status === 'confirmed' ? '已确认' : '草稿'}</p><p>食材：${esc(r.ingredients.map(i => `${i.name} ${i.amount}${i.unit}`).join('、'))}</p><p>过敏来源：${esc(r.allergens.join('、') || '未标注')}</p><ol>${r.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol><p class="sub">${esc(r.source)}</p></section>`).join('') || '<p>暂无版本记录。</p>');
    }
    if (a === 'attendance') return attendanceDialog(btn.dataset.kind);
    if (a === 'new-import') return importDialog();
    if (a === 'import-detail') return importDetail(btn.dataset.id);
    if (a === 'feedback') return feedbackDialog();
    if (a === 'proposal') return proposalDialog(btn.dataset.id);
    if (a === 'upload-doc') return documentDialog(btn.dataset.kind);
    if (a === 'view-doc') { const d = S.documents.find(d => d.id === btn.dataset.id); return openDialog(esc(d.name), `<div class="notice">待接入资料，尚未改变规则。</div><div class="doc-text">${esc(d.content)}</div>`); }
    if (a === 'category') { category = btn.dataset.category; return render(); }
    if (a === 'toggle-tag') {
      const tag = btn.dataset.tag, selecting = !editingTags.includes(tag);
      editingTags = selecting ? [...editingTags, tag] : editingTags.filter(t => t !== tag);
      if (selecting && ['喜欢辣', '不吃辣'].includes(tag)) {
        editingTags = editingTags.filter(t => t !== (tag === '喜欢辣' ? '不吃辣' : '喜欢辣'));
        $('#f-spice').value = tag === '不吃辣' ? '不辣' : '喜欢辣';
      }
      $('#tag-picker').innerHTML = tagPicker(); return;
    }
    if (a === 'add-tag') { const tag = $('#custom-tag').value.trim(); if (tag && !editingTags.includes(tag)) editingTags.push(tag); $('#tag-picker').innerHTML = tagPicker(); $('#custom-tag').focus(); return; }
    if (a === 'clear-avatar') { editingAvatar = ''; $('#avatar-preview').innerHTML = avatar({ ...editingMember, avatar: '' }); return; }
    if (a === 'suggest') { $('#chat-input').value = btn.dataset.text; $('#chat-input').focus(); return; }
    if (a === 'retry-chat') return sendChat(pendingText);
    if (a === 'download-shopping') { if (!shoppingData) return; const lines = [`采购清单 ${shoppingData.start} 至 ${shoppingData.end}`, shoppingData.basis, ...shoppingData.items.map(i => `${i.name}：${i.amount} ${i.unit}`)]; const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = '家庭采购清单.txt'; link.click(); URL.revokeObjectURL(url); return; }
    btn.disabled = true;
    let result;
    if (a === 'generate') result = await request('/api/menus/generate', { week, version: S.menus[week]?.version || 0 });
    else if (a === 'replace') result = await request('/api/menus/replace', { week, date: day, kind: btn.dataset.kind, recipeId: btn.dataset.id, version: S.menus[week].version });
    else if (a === 'undo') result = await request('/api/menus/undo', { week, version: S.menus[week]?.version });
    else if (a === 'confirm-proposal') { result = await request('/api/proposals/confirm', { id: btn.dataset.id }); dialog.close(); }
    else if (a === 'cancel-proposal') { result = await request('/api/proposals/cancel', { id: btn.dataset.id }); dialog.close(); }
    else if (a === 'resolve-import') result = await request('/api/imports/resolve', { id: btn.dataset.id });
    else if (a === 'confirm-feedback') result = await request('/api/feedback/confirm', { id: btn.dataset.id, revision: S.revision });
    else if (a === 'test-agent') { $('#agent-test-status').innerHTML = '<div class="loading-inline"><span class="spinner"></span>正在发起真实模型请求，通常需要几十秒…</div>'; result = await request('/api/agent/test', {}); }
    else if (a === 'run-schedule') result = await request('/api/schedule/run', {});
    if (result) { if (page === 'shopping') await loadShopping(); render(); if (result.proposal) proposalDialog(result.proposal.id); if (result.message) toast(result.message); }
  } catch (error) { showError(error); } finally { btn.disabled = false; }
}
function showError(error) {
  toast(error.message, true);
  if (dialog.open) { $('.dialog-error', dialog)?.remove(); const box = document.createElement('div'); box.className = 'error-box dialog-error'; box.setAttribute('role', 'alert'); box.textContent = error.message; $('.dialog-body', dialog).prepend(box); box.scrollIntoView({ block: 'nearest' }); }
  else { lastError = error.message; render(); }
}
async function sendChat(text) {
  text = text.trim(); if (!text || busy) return;
  pendingText = text; chatError = ''; busy = true; if ($('#chat-input')) $('#chat-input').value = ''; render();
  try { await request('/api/chat', { text, week }); lastError = ''; if (page === 'shopping') await loadShopping(); }
  catch (error) { chatError = error.message; }
  finally { busy = false; render(); }
}
async function fileData(file) { if (!file || !file.size) return undefined; if (file.size > 6_000_000) throw new Error('图片需小于 6MB。'); if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片。'); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function submit(event) {
  const form = event.target; if (!(form instanceof HTMLFormElement)) return; event.preventDefault();
  if (form.id === 'chat-form') return sendChat($('#chat-input').value);
  const buttons = [...form.querySelectorAll('button[type="submit"]')]; if (buttons.some(b => b.disabled)) return;
  const data = new FormData(form); let result;
  buttons.forEach(b => b.disabled = true); $('.dialog-error', dialog)?.remove();
  try {
    if (form.id === 'member-form') {
      const m = { ...editingMember, name: data.get('name').trim(), age: Number(data.get('age')), sex: data.get('sex'), portion: Number(data.get('portion')), spice: data.get('spice'), diseaseNotes: data.get('diseaseNotes'), profileTags: editingTags, avatar: editingAvatar };
      for (const k of ['likes', 'dislikes', 'allergies', 'restrictions']) m[k] = splitTags(data.get(k));
      m.schedule = weekdays.map((_, index) => Object.fromEntries(Object.keys(mealNames).map(kind => [kind, data.has(`schedule-${index}-${kind}`)])));
      result = await request('/api/members/save', { revision: S.revision, member: m }); dialog.close();
    } else if (form.id === 'attendance-form') {
      const memberIds = S.members.filter(m => data.has('member-' + m.id)).map(m => m.id);
      result = await request('/api/attendance', { revision: S.revision, week, date: day, kind: form.dataset.kind, memberIds, portions: Object.fromEntries(memberIds.map(id => [id, Number(data.get('portion-' + id))])) });
    } else if (form.id === 'agent-settings') { result = await request('/api/agent/config', Object.fromEntries(data)); $('#api-key').value = ''; }
    else if (form.id === 'schedule-settings') result = await request('/api/settings', { ...Object.fromEntries(data), revision: S.revision, scheduleEnabled: data.has('scheduleEnabled') });
    else if (form.id === 'shopping-form') { shoppingStart = data.get('start'); shoppingEnd = data.get('end'); await loadShopping(); render(); return; }
    else if (form.id === 'feedback-form') { result = await request('/api/feedback', Object.fromEntries(data)); dialog.close(); }
    else if (form.id === 'document-form') { result = await request('/api/documents', { kind: form.dataset.kind, name: data.get('name'), content: data.get('content') }); dialog.close(); }
    else if (form.id === 'new-recipe-form') {
      const image = await fileData(data.get('image'));
      if (!data.get('text').trim() && !image) throw new Error('请填写菜名、做法或选择截图。');
      $('.form-progress', form).innerHTML = '<div class="loading-inline"><span class="spinner"></span>助手正在整理菜谱，完成后请核对…</div>';
      result = await request('/api/recipes/draft', { type: data.get('type'), text: data.get('text'), image }); render(); activeRecipe = result.recipe; recipeEditDialog(); return;
    } else if (form.id === 'recipe-edit-form') {
      const r = { ...activeRecipe, name: data.get('name').trim(), source: data.get('source').trim(), category: data.get('category'), baseServings: Number(data.get('baseServings')), allergens: splitTags(data.get('allergens')), tags: splitTags(data.get('tags')), steps: data.get('steps').split('\n').map(s => s.trim()).filter(Boolean), ingredients: data.get('ingredients').split('\n').filter(s => s.trim()).map(s => { const [name, amount, unit] = s.split(/[,，]/).map(x => x.trim()); return { name, amount: Number(amount), unit }; }) };
      result = await request('/api/recipes/save', { revision: S.revision, recipe: r, confirm: event.submitter?.value === 'confirm' }); dialog.close();
    } else if (form.id === 'import-form') {
      const image = await fileData(data.get('image')), type = image ? 'image' : data.get('type');
      if (type === 'image' && !image) throw new Error('请先选择食谱截图。');
      if (type !== 'image' && !data.get('text').trim()) throw new Error('请填写链接或食谱文字。');
      $('.form-progress', form).innerHTML = '<div class="loading-inline"><span class="spinner"></span>正在读取来源并识别午餐，请稍候…</div>';
      result = await request('/api/imports/draft', { memberId: data.get('memberId'), week: data.get('week'), schoolGroup: data.get('schoolGroup'), type, text: type === 'image' ? '' : data.get('text'), image }); render(); importDetail(result.draft.id); return;
    } else if (form.id === 'import-confirm-form') {
      const records = activeImport.records.map((r, index) => ({ ...r, date: data.get('date-' + index), meal: 'lunch', dishes: splitTags(data.get('dishes-' + index)), uncertain: false }));
      result = await request('/api/imports/confirm', { revision: S.revision, id: activeImport.id, records }); dialog.close();
    }
    if (result) { if (page === 'shopping') await loadShopping(); render(); if (result.proposal) proposalDialog(result.proposal.id); if (result.message) toast(result.message); }
  } catch (error) { showError(error); const progress = $('.form-progress', form); if (progress) progress.innerHTML = ''; }
  finally { buttons.forEach(b => b.disabled = false); }
}
document.addEventListener('click', action);
document.addEventListener('submit', submit);
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target.id === 'chat-input') { event.preventDefault(); sendChat(event.target.value); }
  if (event.key === 'Enter' && event.target.id === 'custom-tag') { event.preventDefault(); $('[data-action="add-tag"]').click(); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'recipe-search') { search = event.target.value; const position = event.target.selectionStart; render(); $('#recipe-search').focus(); $('#recipe-search').setSelectionRange(position, position); }
});
document.addEventListener('change', async event => {
  try {
    const target = event.target;
    if (target.id === 'f-spice') {
      editingTags = editingTags.filter(t => !['喜欢辣', '不吃辣'].includes(t));
      if (target.value === '不辣') editingTags.push('不吃辣');
      if (target.value === '喜欢辣') editingTags.push('喜欢辣');
      $('#tag-picker').innerHTML = tagPicker();
    }
    if (target.dataset.check !== undefined) { const i = Number(target.dataset.check); target.checked ? checkedItems.add(i) : checkedItems.delete(i); target.closest('.shopping-item').classList.toggle('checked', target.checked); }
    if (target.id === 'document-file' && target.files[0]) { if (target.files[0].size > 200000) throw new Error('资料文件应小于 200KB。'); $('#f-content').value = await target.files[0].text(); $('#f-name').value = target.files[0].name; }
    if (target.id === 'avatar-upload' && target.files[0]) {
      const source = await fileData(target.files[0]); const image = new Image(); image.src = source; await image.decode();
      const scale = Math.min(1, 512 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = image.width * scale; canvas.height = image.height * scale; canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      editingAvatar = canvas.toDataURL('image/png'); if (editingAvatar.length > 1500000) editingAvatar = canvas.toDataURL('image/jpeg', .85);
      $('#avatar-preview').innerHTML = avatar({ ...editingMember, avatar: editingAvatar });
    }
    if (target.id === 'import-type') { $('#f-text').value = target.value === 'link' ? kindergartenLink : ''; $('#f-text').placeholder = target.value === 'text' ? '例如：周一午餐：番茄炒蛋、米饭…' : ''; }
  } catch (error) { showError(error); }
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
async function boot() { try { await initializeConnection(app); if (!$('.kitchen-loading', app)) app.innerHTML = loadingMarkup; S = await request('/api/state'); week = S.defaultWeek; day = week; shoppingStart = week; shoppingEnd = addDays(week, 6); render(); } catch (error) { app.innerHTML = `<div class="boot"><p>厨房服务暂时没有连接上。<br>${esc(error.message)}<br><a href="/">重新加载</a></p></div>`; } }
boot();
function settingsPage() {
  return `${heading('A WELL-KEPT KITCHEN', '把厨房安排妥当', '连接助手、安排每周计划，让规则有据可依。')}<section class="panel"><div class="panel-header"><h2>Agent 连接</h2>${badge(S.agentLastRun?.ok ? '已通过真实调用验证' : '待测试', S.agentLastRun?.ok ? '' : 'amber')}</div>${isShared ? `<p class="sub">组内共享 Pi 助手已连接。模型连接由主厨电脑管理。</p>` : ''}<form id="agent-settings" ${isShared ? 'hidden' : ''}><div class="field"><label for="provider">连接方式</label><select id="provider" name="provider"><option value="pi" ${S.agent.provider === 'pi' ? 'selected' : ''}>Pi Agent（复用 Pi Web 的模型连接）</option><option value="codex" ${S.agent.provider === 'codex' ? 'selected' : ''}>本机已登录的 Codex</option><option value="openai-compatible" ${S.agent.provider === 'openai-compatible' ? 'selected' : ''}>兼容 OpenAI 的模型 API</option></select><small>Pi 使用本机 Pi Web 的默认模型与凭据，下面三项仅用于直接 API 连接。${S.agent.piModel ? `当前 Pi 模型：${esc(S.agent.piModel)}` : ''}</small></div><div class="field"><label for="base-url">API 基础地址</label><input id="base-url" name="baseUrl" type="url" value="${esc(S.agent.baseUrl)}" required></div><div class="field"><label for="model">模型名</label><input id="model" name="model" value="${esc(S.agent.model)}" required></div><div class="field"><label for="api-key">API Key</label><input id="api-key" name="apiKey" type="password" autocomplete="new-password" placeholder="${S.agent.keyConfigured ? '已保存；留空保留现有 Key' : '填入后可切换 API 模式'}"><small>只保存在本机后台，不回传、不写入浏览器存储。</small></div><div class="form-actions"><button class="button primary" type="submit">保存连接配置</button>${button('测试当前连接', 'test-agent', '', '', 'spark')}</div></form><p class="status-line">当前使用：${esc(S.agent.label)}${S.agentLastRun?.ok ? ` · 最近调用耗时 ${(S.agentLastRun.durationMs / 1000).toFixed(1)} 秒` : ''}</p><div id="agent-test-status"></div></section><section class="panel"><div class="panel-header"><h2>每周自动安排</h2>${badge('后台运行')}</div><form id="schedule-settings"><div class="form-grid"><div class="field"><label for="schedule-time">每周日生成时间</label><input id="schedule-time" name="scheduleTime" type="time" value="${esc(S.settings.scheduleTime)}" required></div><div class="field"><label for="timezone">时区</label><select id="timezone" name="timezone">${['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York'].map(z => `<option ${z === S.settings.timezone ? 'selected' : ''}>${z}</option>`).join('')}</select></div></div><label class="check-row"><input type="checkbox" name="scheduleEnabled" ${S.settings.scheduleEnabled ? 'checked' : ''}>开启每周自动生成下周菜单</label><p class="sub">关闭网页后仍由后台执行，电脑需要开机且服务运行。已有菜单会跳过，避免覆盖手动修改；失败后可手动重试。</p><div class="form-actions">${button('立即验证一次', 'run-schedule', '', 'small')}<button type="submit" class="button primary small">保存排程</button></div></form>${S.jobs.length ? `<div class="divider"></div>${S.jobs.slice(-3).reverse().map(j => `<div class="list-row"><div><h3>${shortDate(j.week)}这周 · ${({ completed: '完成', skipped: '已跳过', failed: '失败' })[j.status] || j.status}</h3><p>${esc(j.message)}</p></div></div>`).join('')}` : ''}</section><section class="panel"><div class="panel-header"><h2>规则与资料</h2>${badge(`搭配 positive-v1 · 菜单 ${S.rules.version}`, 'amber')}</div><div class="notice">已融合食材多样性与缺数据不评价的正向规则。详细禁忌规范已整理；正式菜谱成分表、完整调味料与人群参考值仍待核实。上传资料不会自动启用其中的数值。</div><p class="sub">${esc(S.rules.nutrition)}<br>过敏与明确忌口优先；午晚餐默认 ${S.rules.mainDishCount || 5} 道菜＋主食；同菜中间至少隔 ${S.rules.repeatGapDays} 个完整自然日；基础早餐按例外名单处理。</p><div class="document-buttons">${['禁忌规则', '菜单池', '营养搭配'].map(k => button('上传' + k, 'upload-doc', `data-kind="${k}"`, 'small', 'file')).join('')}</div>${S.documents.map(d => `<div class="list-row"><div><h3>${esc(d.kind)} · ${esc(d.name)}</h3><p>已保存，待解释规则并确认接入</p></div>${button('查看', 'view-doc', `data-id="${d.id}"`, 'small')}</div>`).join('')}</section>`;
}
