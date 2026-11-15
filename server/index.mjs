import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStore } from './store.mjs';
import { dateInZone, nextWeek, addDays, MEALS } from './seed.mjs';
import { fail, validDate, validWeek, buildMeals, commitMenu, replaceDish, validateMeals, shopping, makeProposal, contextFor, normalize, validateRecipe, allMeals } from './domain.mjs';
import { agentInfo, saveAgentConfiguration, runAgent, intentSchema, importSchema, recipeSchema } from './agent.mjs';
import { readSource } from './wechat-source.mjs';
import { kitchenTools } from './kitchen-tools.mjs';
import { nutritionSummary, POSITIVE_RULE_VERSION } from './nutrition.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const store = createStore(process.env.KITCHEN_DB || path.join(root, 'data/kitchen.sqlite'));
const port = Number(process.env.PORT || 4317);
const seed = store.load();
if (seed.revision === 0 && !Object.keys(seed.menus).length) {
  const week = nextWeek(dateInZone(new Date(), seed.settings.timezone));
  commitMenu(seed, week, buildMeals(seed, week), 0, '首次启动的示例周菜单');
  store.save(seed);
}
const ruleState = store.load();
if (ruleState.rules.positiveVersion !== POSITIVE_RULE_VERSION) {
  ruleState.rules.positiveVersion = POSITIVE_RULE_VERSION;
  ruleState.rules.nutrition = '保留早餐主食与蛋白质、午晚餐荤素搭配；优先增加成员本周家庭食材种类。成分和实际摄入不全，营养暂不评价。';
  store.save(ruleState);
}
const json = (res, data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
async function body(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) fail('请使用 JSON 请求。', 415);
  let total = 0; const chunks = [];
  for await (const chunk of req) { total += chunk.length; if (total > 9_000_000) fail('文件过大，请使用小于 6MB 的截图。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('请求内容不是有效 JSON。'); }
}
function expected(state, value) { if (state.revision !== value) fail('数据已变化，请刷新后重试。', 409); }
function stateView(state) {
  const checks = {};
  for (const [week, menu] of Object.entries(state.menus)) checks[week] = validateMeals(state, menu.meals, allMeals(state).filter(m => m.date < week || m.date > addDays(week, 6)));
  return { ...state, nutrition: Object.fromEntries(Object.keys(state.menus).map(week => [week, nutritionSummary(state, week)])), today: dateInZone(new Date(), state.settings.timezone), defaultWeek: nextWeek(dateInZone(new Date(), state.settings.timezone)), agent: agentInfo(), checks };
}
function validateImport(state, draft) {
  validWeek(draft.week);
  if (!state.members.some(m => m.id === draft.memberId)) fail('请选择适用成员。');
  if (!draft.records?.length || draft.records.length > 7) fail('请填写本周 1–7 天的午餐。');
  const dates = new Set();
  for (const r of draft.records) {
    validDate(r.date);
    if (r.date < draft.week || r.date > addDays(draft.week, 6) || r.meal !== 'lunch' || dates.has(r.date)) fail('日期必须在选定周内，每天只保留一条午餐记录。');
    dates.add(r.date);
    if (!Array.isArray(r.dishes) || !r.dishes.length || r.dishes.some(d => typeof d !== 'string' || !d.trim() || d.length > 80)) fail('请填写午餐菜名。');
  }
}
async function handleApi(req, res, url) {
  const route = url.pathname;
  if (req.method === 'GET') {
    if (route === '/api/state') return json(res, stateView(store.load()));
    if (route === '/api/health') return json(res, { ok: true, app: 'family-kitchen', agent: agentInfo() });
    if (route === '/api/shopping') return json(res, shopping(store.load(), url.searchParams.get('start'), url.searchParams.get('end')));
    fail('接口不存在。', 404);
  }
  if (req.method !== 'POST') fail('不支持此请求。', 405);
  const data = await body(req);
  let state = store.load(), result = {};
  if (route === '/api/menus/generate') {
    validWeek(data.week);
    if ((state.menus[data.week]?.version || 0) !== data.version) fail('菜单版本已变化。', 409);
    if (state.menus[data.week]) result.proposal = makeProposal(state, data.week, {}, '已重新安排这一周。请核对变更后确认。');
    else { commitMenu(state, data.week, buildMeals(state, data.week), 0, '按示例规则生成'); result.message = '已生成一周菜单，使用示例搭配规则。'; }
  } else if (route === '/api/menus/replace') {
    replaceDish(state, data.week, data.date, data.kind, data.recipeId, data.version);
    result.message = '已替换为符合规则的同类菜，可撤销。';
  } else if (route === '/api/menus/undo') {
    const current = state.menus[data.week];
    if (!current || current.version !== data.version) fail('菜单版本已变化。', 409);
    const old = state.undo[data.week]?.pop(); if (!old) fail('没有可撤销的修改。');
    const issues = validateMeals(state, old.meals, allMeals(state).filter(m => m.date < data.week || m.date > addDays(data.week, 6)));
    if (issues.length) fail('当前档案或规则已变化，无法直接撤销：' + issues.join('；'), 422);
    state.menus[data.week] = { ...old, version: current.version + 1, reason: '撤销上次修改', updatedAt: new Date().toISOString() };
    result.message = '已恢复上一版菜单。';
  } else if (route === '/api/proposals/confirm') {
    const proposal = state.proposals.find(p => p.id === data.id && p.status === 'pending');
    if (!proposal) fail('建议不存在或已处理。');
    expected(state, proposal.baseRevision);
    Object.assign(state.overrides, proposal.overrides);
    const issues = validateMeals(state, proposal.meals, allMeals(state).filter(m => m.date < proposal.week || m.date > addDays(proposal.week, 6)));
    if (issues.length) fail(issues.join('；'), 422);
    commitMenu(state, proposal.week, proposal.meals, proposal.menuVersion, '确认调整建议');
    proposal.status = 'confirmed'; result.message = '调整已确认，采购清单将按新菜单计算。';
  } else if (route === '/api/proposals/cancel') {
    const proposal = state.proposals.find(p => p.id === data.id); if (proposal) proposal.status = 'cancelled';
  } else if (route === '/api/members/save') {
    expected(state, data.revision);
    const member = data.member, index = state.members.findIndex(m => m.id === member.id);
    if (!member.name?.trim() || !Number.isFinite(member.age) || member.age < 0 || member.age > 120 || !Number.isFinite(member.portion) || member.portion <= 0 || member.portion > 5) fail('请核对姓名、年龄和默认饭量（0–5 份）。');
    for (const key of ['likes', 'dislikes', 'allergies', 'restrictions']) if (!Array.isArray(member[key]) || member[key].some(x => typeof x !== 'string' || x.length > 60)) fail('档案标签格式无效。');
    if (!Array.isArray(member.profileTags) || member.profileTags.length > 30 || member.profileTags.some(x => typeof x !== 'string' || !x.trim() || x.length > 30)) fail('成员标签最多 30 个，每个不超过 30 字。');
    if (member.avatar && (typeof member.avatar !== 'string' || member.avatar.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(member.avatar))) fail('成员形象需为有效图片，请使用小于 1MB 的 PNG、JPEG 或 WebP。');
    if (!Array.isArray(member.schedule) || member.schedule.length !== 7 || member.schedule.some(s => MEALS.some(k => typeof s[k] !== 'boolean'))) fail('请填写完整的每周用餐规律。');
    if (index < 0) { if (state.members.length >= 12) fail('Demo 最多支持 12 名成员。'); state.members.push({ ...member, id: randomUUID(), color: 'peach' }); }
    else state.members[index] = { ...member, id: state.members[index].id };
    result.message = '档案已保存。已生成菜单保留原样，变化会提示待重新核对。';
  } else if (route === '/api/attendance') {
    expected(state, data.revision); validWeek(data.week); validDate(data.date);
    if (!MEALS.includes(data.kind) || !Array.isArray(data.memberIds) || data.memberIds.some(id => !state.members.some(m => m.id === id))) fail('用餐人员无效。');
    const portions = data.portions || {};
    if (Object.entries(portions).some(([id, p]) => !data.memberIds.includes(id) || !Number.isFinite(p) || p <= 0 || p > 5)) fail('饭量应为 0–5 之间的正数。');
    result.proposal = makeProposal(state, data.week, { start: data.date, end: data.date, meal: data.kind }, '只调整这一天这一餐的人员和菜量，固定规律保持不变。', { [`${data.date}:${data.kind}`]: { memberIds: data.memberIds, portions } });
  } else if (route === '/api/chat') {
    validWeek(data.week);
    const text = String(data.text || '').trim(); if (!text || text.length > 3000) fail('请输入 1–3000 字的消息。');
    const snapshotRevision = state.revision;
    let preview;
    const context = { today: dateInZone(new Date(), state.settings.timezone), selectedWeek: data.week, weekEnd: addDays(data.week, 6), members: state.members.map(({ avatar, ...member }) => member),
      recipes: state.recipes.filter(r => r.status === 'confirmed').map(r => ({ id: r.id, name: r.name, category: r.category, tags: r.tags })), rules: state.rules,
      menu: state.menus[data.week] || null, history: state.messages.slice(-10).map(m => ({ role: m.role, text: m.text })) };
    const output = await runAgent(`把用户指令转换为厨房操作。只有明确要求调整菜单时 action=adjust_menu；明确某成员出席或缺席时 attendance；家人用餐感受或以后别做等反馈为 feedback。否则 answer。有歧义先提问，不能猜。日期语义：周三等未指明周次的星期在 selectedWeek 内；今天/明天基于 today，超出选定周时 answer 提醒切换。调整一餐不能扩大到全周。生成一周是 adjust_menu 且全周/all。同一条含多项不支持的复杂操作先澄清。份量数字未明确为道数时不要猜 dishCount。默认 dishCount=0、requestedRecipeName=""、style=""、memberId=""、present=true、feedbackScope=temporary、avoidFood=""。清淡=light。不支持的营养精确数值不要承诺。requestedRecipeName 必须使用用户指定的菜名。feedback 仅明确“以后不吃/别做”才 long_term 且 avoidFood 为食材或菜名；一次感受为 temporary，无法确定为 unclear。start/end 都必须 YYYY-MM-DD。解释将提出建议，不能说已经修改。\n上下文：${JSON.stringify(context)}\n用户消息：${text}`, intentSchema, undefined, { customTools: kitchenTools(state, data.week, value => { preview = value; }) });
    state = store.load(); expected(state, snapshotRevision);
    const intent = output.data;
    let reply = intent.reply;
    state.agentLastRun = { provider: output.provider, durationMs: output.durationMs, completedAt: output.completedAt, toolCalls: output.toolCalls, ok: true };
    if (intent.action === 'adjust_menu' || intent.action === 'attendance') {
      try {
        let overrides;
        if (intent.action === 'attendance') {
          if (!state.members.some(m => m.id === intent.memberId)) fail('请明确是哪位家庭成员。');
          validDate(intent.start); validDate(intent.end);
          if (intent.start < data.week || intent.end > addDays(data.week, 6) || intent.start > intent.end) fail('请切换到对应周后调整。');
          overrides = {};
          for (let date = intent.start; date <= intent.end; date = addDays(date, 1)) for (const kind of MEALS.filter(k => intent.meal === 'all' || k === intent.meal)) {
            const key = `${date}:${kind}`, ctx = contextFor(state, date, kind), ids = new Set(ctx.members.map(m => m.id));
            intent.present ? ids.add(intent.memberId) : ids.delete(intent.memberId);
            const previous = state.overrides[key]?.portions || {};
            overrides[key] = { memberIds: [...ids], portions: Object.fromEntries(Object.entries(previous).filter(([id]) => ids.has(id))) };
          }
        }
        result.proposal = makeProposal(state, data.week, { start: intent.start, end: intent.end, meal: intent.meal, style: intent.style, dishCount: intent.dishCount, requestedRecipeName: intent.requestedRecipeName }, reply, overrides, intent.action === 'adjust_menu' && preview && Object.keys(preview.options).every(key => preview.options[key] === intent[key]) ? preview.meals : undefined);
        reply += '\n调整建议已准备好，确认后才会修改菜单。';
      } catch (error) { reply = `这次调整没有执行：${error.message}`; result.blocked = true; }
    } else if (intent.action === 'feedback') {
      if (!state.members.some(m => m.id === intent.memberId)) reply = '请明确这条反馈对应哪位家庭成员，我再帮你记录。';
      else {
        validDate(intent.start);
        const feedback = { id: randomUUID(), memberId: intent.memberId, date: intent.start, meal: intent.meal, text, scope: intent.feedbackScope, avoidFood: intent.avoidFood, applied: false, createdAt: new Date().toISOString() };
        state.feedback.push(feedback); result.feedback = feedback;
        reply = '已保存这条反馈。' + (intent.feedbackScope === 'long_term' ? '长期禁用建议需在「家庭档案 → 用餐反馈」确认后生效。' : '这次记录不会自动改变长期偏好或默认饭量。');
      }
    }
    state.messages.push({ id: randomUUID(), role: 'user', text, createdAt: new Date().toISOString() }, { id: randomUUID(), role: 'assistant', text: reply, provider: output.provider, durationMs: output.durationMs, toolCalls: output.toolCalls, proposalId: result.proposal?.id, createdAt: new Date().toISOString() });
    state.messages = state.messages.slice(-80); result.reply = reply;
  } else if (route === '/api/agent/config') {
    saveAgentConfiguration(data);
    state.agentLastRun = null;
    result.message = '后台连接配置已保存，请点击测试连接。';
  } else if (route === '/api/agent/test') {
    const output = await runAgent('这是厨房应用连接测试。只回复「厨房助手已连接」。', { type: 'object', additionalProperties: false, properties: { reply: { type: 'string' } }, required: ['reply'] });
    state = store.load(); state.agentLastRun = { provider: output.provider, durationMs: output.durationMs, completedAt: output.completedAt, toolCalls: output.toolCalls, ok: true }; result.message = output.data.reply;
  } else if (route === '/api/recipes/draft') {
    const source = await readSource(data), raw = source.text;
    if (source.customTools.length && agentInfo().provider !== 'pi') fail('公众号图片识别请在厨房设置中选择 Pi Agent；也可以直接上传截图。', 422);
    const output = await runAgent(`根据菜名或资料整理一份待主厨确认的家常菜草稿。只使用普通食材。基础份数 1；列出主材生重或包装量、调味料；给出充分熟制的步骤；过敏标签如鸡蛋、牛奶、大豆、小麦、花生、鱼、虾、贝类要完整。未知用量可以给示例估算，草稿需用户核对，不宣称精确营养。菜谱资料：${raw}`, recipeSchema, data.image, { customTools: source.customTools });
    validateRecipe(output.data);
    state = store.load();
    const recipe = { ...output.data, id: randomUUID(), repeatExempt: false, status: 'draft', source: 'Agent 生成草稿，食材、用量和过敏标签需核对', demo: false };
    state.recipes.push(recipe); result.recipe = recipe;
  } else if (route === '/api/recipes/save') {
    expected(state, data.revision); validateRecipe(data.recipe);
    const index = state.recipes.findIndex(r => r.id === data.recipe.id);
    if (index < 0 || state.recipes[index].status !== 'draft') fail('只能编辑尚未确认的菜谱草稿。');
    if (data.confirm && state.recipes.some(r => r.id !== data.recipe.id && r.status === 'confirmed' && normalize(r.name) === normalize(data.recipe.name))) fail('已存在同名已确认菜谱，请避免重复身份。');
    state.recipes[index] = { ...data.recipe, status: data.confirm ? 'confirmed' : 'draft', repeatExempt: false };
    result.message = data.confirm ? '菜谱已确认，可以参与后续排菜。' : '草稿已保存。';
  } else if (route === '/api/imports/draft') {
    validWeek(data.week);
    if (!state.members.some(m => m.id === data.memberId)) fail('请选择适用孩子。');
    const schoolGroup = data.schoolGroup || '';
    if (!['', '托小', '中大'].includes(schoolGroup)) fail('班级组无效。');
    const source = await readSource(data), raw = source.text;
    if (source.customTools.length && agentInfo().provider !== 'pi') fail('公众号图片识别请在厨房设置中选择 Pi Agent；也可以直接上传截图。', 422);
    const output = await runAgent(`识别幼儿园午餐，仅提取午餐菜名，不将克数、原料配方放入 dishes，早餐和加餐排除。适用班级组为「${schoolGroup || "未指定"}」，如表格按班级分行，只取对应班级及共用单元格；不混入另一组的不同主食或荤菜。必须按原文字形逐字抄录，不用常见菜名补全模糊小字；疑似字或遗漏明确写入 note 并标记 uncertain。选定周为 ${data.week} 至 ${addDays(data.week, 6)}。若文章含多周内容，只提取选定周的菜单表，忽略其他周的餐食回顾；仅记录普通午餐主食、荤素菜和汤，不混入早点、水果、午点、特殊菜过敏替餐、营养不良/肥胖儿替餐及建议晚餐。不同学段的普通午餐不同且无法确定适用班级时标记 uncertain 并列出差异。所选周内只有周一至周五的工作日菜单完全正常，不视为与整周日期不一致，不因周末缺数据标记 uncertain。只有星期没有日期时按选定周映射并 note 提示核对；图片或正文有不一致的日期不要自行改写，标记 uncertain。不确定项必须 uncertain=true；没有可读食谱时 records=[] 并 note 说明，禁止编造。原文：${raw}`, importSchema, data.image, { customTools: source.customTools });
    if (!output.data.records.length) fail(output.data.note || '没有识别出午餐，请更换清晰截图或粘贴文字。', 422);
    state = store.load();
    const draft = { id: randomUUID(), week: data.week, memberId: data.memberId, type: data.type, schoolGroup, source: String(data.text || '上传截图').slice(0, 24000), image: data.image || null, sourceImages: source.readImages, provider: output.provider, toolCalls: output.toolCalls, ...output.data, status: 'draft', createdAt: new Date().toISOString() };
    state.imports.push(draft); result.draft = draft;
  } else if (route === '/api/imports/confirm') {
    expected(state, data.revision);
    const draft = state.imports.find(i => i.id === data.id && i.status === 'draft'); if (!draft) fail('导入草稿不存在。');
    draft.records = data.records; validateImport(state, draft);
    for (const entry of state.imports.filter(i => i.status === 'confirmed' && i.memberId === draft.memberId)) entry.records = entry.records.filter(r => !draft.records.some(n => n.date === r.date));
    draft.status = 'confirmed'; draft.records.forEach(r => { r.uncertain = false; });
    result.message = '午餐已确认。家庭菜单保留不变，如有重复可查看调整建议。';
  } else if (route === '/api/imports/resolve') {
    const entry = state.imports.find(i => i.id === data.id && i.status === 'confirmed'); if (!entry) fail('请先确认午餐。');
    const view = structuredClone(state), current = view.menus[entry.week]; if (!current) fail('请先生成这一周家庭菜单。');
    let count = 0;
    for (const record of entry.records) {
      const meal = current.meals.find(m => m.date === record.date && m.kind === 'dinner');
      if (!meal?.memberIds.includes(entry.memberId) || !meal.dishes.some(d => record.dishes.some(n => normalize(n) === normalize(view.recipes.find(r => r.id === d.recipeId).name)))) continue;
      current.meals = buildMeals(view, entry.week, { start: record.date, end: record.date, meal: 'dinner' }); count++;
    }
    if (!count) fail('当前家庭晚餐没有与这份午餐重复的菜。');
    const proposal = { id: randomUUID(), week: entry.week, baseRevision: state.revision + 1, menuVersion: current.version, meals: current.meals, overrides: {}, reply: `只调整 ${count} 顿与幼儿园午餐重复的晚餐。`, status: 'pending', createdAt: new Date().toISOString() };
    state.proposals.push(proposal); result.proposal = proposal;
  } else if (route === '/api/feedback') {
    if (!state.members.some(m => m.id === data.memberId) || !String(data.text || '').trim()) fail('请选择成员并填写反馈。');
    validDate(data.date);
    state.feedback.push({ id: randomUUID(), memberId: data.memberId, date: data.date, meal: data.meal, text: String(data.text).slice(0, 3000), scope: 'temporary', applied: false, createdAt: new Date().toISOString() });
    result.message = '反馈已保存，不会自动改变长期偏好。';
  } else if (route === '/api/feedback/confirm') {
    expected(state, data.revision);
    const feedback = state.feedback.find(f => f.id === data.id && f.scope === 'long_term' && !f.applied);
    if (!feedback?.avoidFood) fail('没有可确认的长期禁用建议。');
    const member = state.members.find(m => m.id === feedback.memberId);
    member.restrictions = [...new Set([...member.restrictions, feedback.avoidFood])]; feedback.applied = true;
    result.message = '长期禁用已确认。请核对已有菜单的冲突提示。';
  } else if (route === '/api/settings') {
    expected(state, data.revision);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.scheduleTime)) fail('请选择有效时间。');
    try { dateInZone(new Date(), data.timezone); } catch { fail('时区无效。'); }
    state.settings = { scheduleTime: data.scheduleTime, timezone: data.timezone, scheduleEnabled: !!data.scheduleEnabled };
    result.message = '后台排程已保存，运行电脑需要保持开机。';
  } else if (route === '/api/documents') {
    if (!['禁忌规则', '菜单池', '营养搭配'].includes(data.kind) || !String(data.content || '').trim() || data.content.length > 200000) fail('请选择资料类型并提供有效文本。');
    state.documents.push({ id: randomUUID(), kind: data.kind, name: String(data.name || data.kind).slice(0, 150), content: data.content, status: 'pending_review', createdAt: new Date().toISOString() });
    result.message = '资料已保存为待接入；尚未修改当前执行规则。';
  } else if (route === '/api/schedule/run') {
    return json(res, { ...runSchedule(true), state: stateView(store.load()) });
  } else fail('接口不存在。', 404);
  state = store.save(state);
  return json(res, { ...result, state: stateView(state) });
}
export function runSchedule(manual = false, now = new Date()) {
  const state = store.load(), settings = state.settings;
  const date = dateInZone(now, settings.timezone);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const sunday = new Date(date + 'T12:00:00Z').getUTCDay() === 0;
  const week = nextWeek(date), jobKey = `weekly:${week}`;
  if (!manual && (!settings.scheduleEnabled || !sunday || clock < settings.scheduleTime || state.jobs.some(j => j.key === jobKey))) return {};
  const job = { id: randomUUID(), key: jobKey, week, startedAt: now.toISOString(), status: 'running', message: '' };
  try {
    if (state.menus[week]) { job.status = 'skipped'; job.message = '目标周已有菜单，已保留主厨修改。'; }
    else { commitMenu(state, week, buildMeals(state, week), 0, '后台定时生成'); job.status = 'completed'; job.message = '已按规则生成下周菜单。'; }
  } catch (error) { job.status = 'failed'; job.message = error.message; }
  job.finishedAt = new Date().toISOString(); state.jobs = [...state.jobs.slice(-29), job]; store.save(state);
  return { job, message: job.message };
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  try {
    if (!['127.0.0.1', 'localhost'].includes((req.headers.host || '').split(':')[0])) fail('只接受本机访问。', 403);
    if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) fail('不接受跨站请求。', 403);
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const pathname = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    const file = path.resolve(root, 'public', pathname), publicRoot = path.join(root, 'public') + path.sep;
    if (!file.startsWith(publicRoot)) fail('路径无效。', 403);
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(bytes);
  } catch (error) {
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    if (status >= 500) console.error(new Date().toISOString(), error.message);
    json(res, { error: status === 404 ? '没有找到这个页面。' : error.message || '服务出错，请重试。' }, status);
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Family Kitchen: http://127.0.0.1:${port}`));
const timer = setInterval(() => runSchedule(), 30000);
timer.unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close(() => { store.close(); process.exit(0); }); });
