import { randomUUID } from 'node:crypto';
import { fail, validDate, validWeek, validateRecipe, validateMeals, allMeals } from './domain.mjs';
import { addDays, dateInZone, MEALS } from './seed.mjs';

const fields = {
  member: { name: '姓名', age: '年龄', sex: '性别', portion: '默认饭量', spice: '辣度', profileTags: '成员标签', likes: '喜欢', dislikes: '不喜欢', allergies: '过敏', restrictions: '明确忌口', diseaseNotes: '健康备注', avatar: '成员形象', schedule: '固定用餐规律' },
  settings: { scheduleTime: '每周日排菜时间', scheduleEnabled: '自动排菜', timezone: '时区' },
  recipe: { name: '菜名', category: '分类', baseServings: '基础份数', ingredients: '食材用量', allergens: '过敏来源', steps: '做法', tags: '口味标签', source: '来源说明' },
  import: { memberId: '适用成员', week: '适用周', schoolGroup: '班级组', records: '午餐记录' },
  document: { kind: '资料类型', name: '资料名称', content: '资料正文' }
};
const collections = { member: 'members', recipe: 'recipes', import: 'imports', document: 'documents' };
export const kitchenChangesSchema = { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
  properties: { target: { type: 'string', enum: Object.keys(fields) }, id: { type: 'string' }, field: { type: 'string' },
    operation: { type: 'string', enum: ['set', 'add', 'remove'] }, valueJson: { type: 'string' } }, required: ['target', 'id', 'field', 'operation', 'valueJson'] } };
export const updateInstructions = `档案和表单修改使用 action=update_kitchen 与 changes，先调用 preview_kitchen_update。
每项 {target,id,field,operation,valueJson}。id 使用真实 ID；settings 的 id 为空；新增记录 id="new"（每种类型一次最多新增一条）。
可编辑字段：${JSON.stringify(fields)}。固定规律也支持 schedule.0.lunch 这样的单格字段（0周一到6周日）。
valueJson 是 JSON 编码的值，例如 ["控糖"]、["虾"]、0.8、false、"不辣"。标签/喜欢/不喜欢/过敏/忌口/做法等字符串数组可 add/remove；其他值用 set。
说“对虾过敏”是 allergies add ["虾"]，保留其他过敏；只有明确移除才 remove，明确全部替换才 set。喜欢/不喜欢不要写成过敏或硬忌口。控糖、疾病只按用户原话记标签/备注，不推导禁食或营养阈值。
成员资料可同时修改多位成员多项字段。新增成员必须明确姓名和年龄，其他未指定字段使用表单默认值并在预览展示。永久/每周规律用 member.schedule；某天临时不在家仍用 attendance，不覆盖固定规律。
recipe 新增为草稿，也可修改知识库中已有菜谱；已确认菜谱更新会保留历史版本和稳定 ID（类别 meat/vegetable/staple/soup/breakfast_staple/breakfast_protein），食材为 {name,amount,unit}，调味和用量估算需说明，新增菜谱确认保存后仍需核对入库，已有确认菜谱更新后保持确认状态。
import 只新增或修改午餐草稿，records 为 [{date,meal:"lunch",dishes:[菜名],uncertain:布尔}]，必须有文字依据，不能编造链接或图片内容；确认保存后仍需核对导入。
document 仅保存用户提供的文字为待接入资料，kind 为禁忌规则/菜单池/营养搭配，不能启用或更改执行规则。
头像只能通过文字恢复默认（avatar set ""）；上传图片/链接识别请使用对应页面入口。API Key、模型连接和共享口令仍在本机设置，不得通过此工具修改或索要密钥。
模糊的“孩子/他”、同名成员、临时还是永久不明先询问。修改档案与重排菜单同句时先按 execution 保存或预览档案，说明需要再提出排菜指令。预览失败必须说明错误，不能声称已保存。无修改时 changes=[]。`;

function text(value, max = 3000) { return typeof value === 'string' && value.length <= max; }
function tags(value, max = 60) { return Array.isArray(value) && value.length <= 100 && value.every(v => text(v, max) && v.trim()); }
export function validateMember(member) {
  if (!member || !text(member.name, 30) || !member.name.trim() || !Number.isFinite(member.age) || member.age < 0 || member.age > 120 || !Number.isFinite(member.portion) || member.portion <= 0 || member.portion > 5) fail('请核对姓名、年龄和默认饭量（0–5 份）。');
  if (!['男', '女', '未设置'].includes(member.sex) || !['不辣', '微辣', '中辣', '喜欢辣'].includes(member.spice) || !text(member.diseaseNotes)) fail('请核对性别、辣度和健康备注。');
  for (const key of ['likes', 'dislikes', 'allergies', 'restrictions']) if (!tags(member[key])) fail('档案标签格式无效。');
  if (!tags(member.profileTags, 30) || member.profileTags.length > 30) fail('成员标签最多 30 个，每个不超过 30 字。');
  if (member.avatar && (!text(member.avatar, 1500000) || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(member.avatar))) fail('成员形象需为有效图片，请使用小于 1MB 的 PNG、JPEG 或 WebP。');
  if (!Array.isArray(member.schedule) || member.schedule.length !== 7 || member.schedule.some(s => !s || MEALS.some(k => typeof s[k] !== 'boolean'))) fail('请填写完整的每周用餐规律。');
}
export function validateSettings(settings) {
  if (typeof settings.scheduleEnabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.scheduleTime)) fail('请选择有效时间和排程开关。');
  if (!text(settings.timezone, 100) || !settings.timezone) fail('时区无效。');
  try { dateInZone(new Date(), settings.timezone); } catch { fail('时区无效。'); }
}
export function validateImport(state, draft) {
  validWeek(draft.week);
  if (!state.members.some(m => m.id === draft.memberId)) fail('请选择适用成员。');
  if (!['', '托小', '中大'].includes(draft.schoolGroup || '')) fail('班级组无效。');
  if (!Array.isArray(draft.records) || !draft.records.length || draft.records.length > 7) fail('请填写本周 1–7 天的午餐。');
  const dates = new Set();
  for (const r of draft.records) {
    validDate(r.date);
    if (r.date < draft.week || r.date > addDays(draft.week, 6) || r.meal !== 'lunch' || dates.has(r.date)) fail('日期必须在选定周内，每天只保留一条午餐记录。');
    dates.add(r.date);
    if (!tags(r.dishes, 80) || !r.dishes.length || typeof r.uncertain !== 'boolean') fail('请填写午餐菜名并核对识别状态。');
  }
}
export function validateDocument(doc) {
  if (!['禁忌规则', '菜单池', '营养搭配'].includes(doc.kind) || !text(doc.name, 150) || !doc.name.trim() || !text(doc.content, 200000) || !doc.content.trim()) fail('请选择资料类型并提供名称和有效文本。');
}
export function editableContext(state) {
  return { settings: state.settings, recipeDrafts: state.recipes.filter(r => r.status === 'draft'),
    importDrafts: state.imports.filter(i => i.status === 'draft').map(({ id, memberId, week, schoolGroup, records }) => ({ id, memberId, week, schoolGroup, records })),
    documents: state.documents.filter(d => d.status === 'pending_review').map(({ id, name, kind }) => ({ id, name, kind })) };
}
function newRecord(target, week) {
  const record = { id: randomUUID(), createdAt: new Date().toISOString() };
  if (target === 'member') return { ...record, name: '', age: null, sex: '未设置', portion: 1, spice: '不辣', likes: [], dislikes: [], allergies: [], restrictions: [], profileTags: [], avatar: '', diseaseNotes: '', color: 'peach', schedule: Array.from({ length: 7 }, () => ({ breakfast: true, lunch: true, dinner: true })) };
  if (target === 'recipe') return { ...record, name: '', category: 'meat', baseServings: 1, ingredients: [], allergens: [], steps: [], tags: [], seasonal: '通用', status: 'draft', repeatExempt: false, demo: false, source: '对话整理的草稿，食材、用量和过敏标签需核对' };
  if (target === 'import') return { ...record, week, memberId: '', schoolGroup: '', records: [], type: 'text', source: '对话提供的午餐文字', note: '请核对原始文字、日期和菜名。', status: 'draft' };
  return { ...record, kind: '', name: '', content: '', status: 'pending_review' };
}
function format(value, field, state) {
  if (field === 'avatar') return value ? '已上传的专属形象' : '默认角色形象';
  if (field === 'memberId') return state.members.find(m => m.id === value)?.name || value;
  if (field === 'category') return ({ meat: '荤菜', vegetable: '素菜', staple: '主食', soup: '汤羹', breakfast_staple: '早餐主食', breakfast_protein: '早餐蛋白' })[value] || value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (field === 'schedule') return value.map((s, i) => `${['周一','周二','周三','周四','周五','周六','周日'][i]}：${MEALS.filter(k => s[k]).map(k => ({ breakfast: '早', lunch: '午', dinner: '晚' })[k]).join('、') || '不在家'}`).join('；');
  if (field === 'ingredients') return value.map(i => `${i.name} ${i.amount}${i.unit}`).join('；');
  if (field === 'records') return value.map(r => `${r.date}：${r.dishes.join('、')}${r.uncertain ? '（待核对）' : ''}`).join('；');
  return Array.isArray(value) ? value.join('、') || '无' : String(value ?? '') || '未填写';
}
export function previewKitchenUpdate(state, week, changes) {
  validWeek(week);
  if (!Array.isArray(changes) || !changes.length || changes.length > 40) fail('请提供 1–40 项明确修改。');
  const view = structuredClone(state), touched = new Map();
  for (const change of changes) {
    if (!change || !Object.hasOwn(fields, change.target) || !text(change.id, 100) || !text(change.field, 80) || !['set', 'add', 'remove'].includes(change.operation) || !text(change.valueJson, 200000)) fail('修改字段格式无效。');
    const { target, id, field, operation } = change;
    const cell = target === 'member' && /^schedule\.([0-6])\.(breakfast|lunch|dinner)$/.exec(field);
    if (!Object.hasOwn(fields[target], field) && !cell) fail('此字段不能通过助手修改。');
    if (target === 'settings' && id !== '') fail('排程设置不需要记录 ID。');
    const key = `${target}:${id}`;
    let entry = touched.get(key);
    if (!entry) {
      const isNew = target !== 'settings' && id === 'new';
      const record = target === 'settings' ? view.settings : isNew ? newRecord(target, week) : view[collections[target]].find(r => r.id === id);
      if (!record) fail('找不到要修改的记录，请明确名称或成员。');
      if (target === 'import' && record.status !== 'draft') fail('已确认记录不能直接覆盖，请先新增草稿。');
      if (target === 'document' && record.status !== 'pending_review') fail('只能修改待接入资料。');
      entry = { target, record, before: isNew ? null : structuredClone(record) };
      touched.set(key, entry);
      if (isNew) view[collections[target]].push(record);
    }
    let value; try { value = JSON.parse(change.valueJson); } catch { fail('修改值不是有效 JSON。'); }
    if (field === 'avatar' && value !== '') fail('新头像请在家庭档案中上传，文字只能恢复默认形象。');
    if (cell) {
      if (operation !== 'set' || typeof value !== 'boolean') fail('用餐规律请明确是否在家用餐。');
      if (!Array.isArray(entry.record.schedule) || !entry.record.schedule[Number(cell[1])]) fail('请先提供完整的用餐规律。');
      entry.record.schedule[Number(cell[1])][cell[2]] = value;
    } else if (operation === 'set') entry.record[field] = value;
    else {
      const current = entry.record[field];
      if (!tags(value) || !tags(current)) fail('只有文字标签或列表支持新增、移除。');
      entry.record[field] = operation === 'add' ? [...new Set([...current, ...value])] : current.filter(v => !value.includes(v));
    }
    // Match the member form: selecting an explicit spicy preference updates its paired tag.
    if (target === 'member' && field === 'spice' && ['不辣', '微辣', '中辣', '喜欢辣'].includes(value)) {
      if (!Array.isArray(entry.record.profileTags)) fail('成员标签需为列表。');
      entry.record.profileTags = entry.record.profileTags.filter(t => !['不吃辣', '喜欢辣'].includes(t));
      if (['不辣', '喜欢辣'].includes(value)) entry.record.profileTags.push(value === '不辣' ? '不吃辣' : '喜欢辣');
    }
    if (target === 'member' && field === 'profileTags' && operation !== 'remove' && Array.isArray(value)) {
      const selected = value.filter(t => ['不吃辣', '喜欢辣'].includes(t));
      if (selected.length > 1) fail('喜欢辣与不吃辣互相冲突，请明确辣度。');
      if (selected.length) { entry.record.spice = selected[0] === '不吃辣' ? '不辣' : '喜欢辣'; entry.record.profileTags = entry.record.profileTags.filter(t => !['不吃辣', '喜欢辣'].includes(t) || t === selected[0]); }
    }
  }
  if (view.members.length > 12) fail('Demo 最多支持 12 名成员。');
  const diffs = [];
  for (const { target, record, before } of touched.values()) {
    if (target === 'member') validateMember(record);
    if (target === 'settings') validateSettings(record);
    if (target === 'recipe') {
      validateRecipe(record);
      if (!tags(record.tags) || !tags(record.allergens) || !text(record.source)) fail('请核对菜谱标签和来源说明。');
      if (record.status === 'confirmed' && view.recipes.some(r => r.id !== record.id && r.status === 'confirmed' && r.name.trim() === record.name.trim())) fail('已存在同名已确认菜谱，请避免重复身份。');
    }
    if (target === 'import') validateImport(view, record);
    if (target === 'document') validateDocument(record);
    for (const [field, label] of Object.entries(fields[target])) if (!before || JSON.stringify(before[field]) !== JSON.stringify(record[field])) {
      diffs.push({ target, id: record.id || '', name: record.name || ({ settings: '厨房设置', import: '幼儿园午餐' })[target], field, label,
        before: before ? format(before[field], field, state) : '新增记录', after: format(record[field], field, view) });
    }
  }
  if (!diffs.length) fail('这些信息与当前记录一致，无需修改。');
  const warnings = [];
  for (const [menuWeek, menu] of Object.entries(view.menus)) {
    const prior = allMeals(view).filter(m => m.date < menuWeek || m.date > addDays(menuWeek, 6));
    const old = new Set(validateMeals(state, state.menus[menuWeek].meals, prior));
    warnings.push(...validateMeals(view, menu.meals, prior).filter(issue => !old.has(issue)));
  }
  return { view, diffs, warnings: [...new Set(warnings)] };
}
export function makeKitchenUpdateProposal(state, week, changes, reply) {
  const { diffs, warnings } = previewKitchenUpdate(state, week, changes);
  const proposal = { id: randomUUID(), kind: 'kitchen_update', week, baseRevision: state.revision + 1, changes: structuredClone(changes), diffs, warnings, reply, status: 'pending', createdAt: new Date().toISOString() };
  state.proposals = [...state.proposals.slice(-9), proposal];
  return proposal;
}
export function applyKitchenUpdate(state, proposal) {
  if (proposal.status !== 'pending' || proposal.baseRevision !== state.revision) fail('数据已变化或建议已处理，请重新提出修改。', 409);
  const { view } = previewKitchenUpdate(state, proposal.week, proposal.changes);
  for (const key of new Set(proposal.changes.map(c => c.target === 'settings' ? 'settings' : collections[c.target]))) state[key] = view[key];
  proposal.status = 'confirmed';
}
export function applyDirectKitchenUpdate(state, week, changes) {
  const proposal = makeKitchenUpdateProposal(state, week, changes, '按明确指令直接执行');
  proposal.baseRevision = state.revision;
  applyKitchenUpdate(state, proposal);
  proposal.automatic = true;
  const lines = proposal.diffs.map(d => `${d.name} · ${d.label}：${d.field === 'content' ? '正文已更新' : d.after}`);
  const targets = new Set(changes.map(c => c.target));
  const notes = [targets.has('member') ? '后续排菜将使用新档案。' : '', targets.has('recipe') ? '菜谱历史版本已保留；新增菜谱仍为草稿，核对入库后参与排菜。' : '', targets.has('import') ? '午餐草稿已保存，请在幼儿园午餐核对后导入。' : '', targets.has('document') ? '资料已保存为待接入，执行规则保持不变。' : '', proposal.warnings.length ? `已有菜单有 ${proposal.warnings.length} 项需要重新核对，可在本周菜单查看。` : ''].filter(Boolean);
  return { proposal, reply: '已更新：\n' + lines.join('\n') + (notes.length ? '\n\n' + notes.join('') : '') };
}
export function recordChat(state, text, reply, run, proposalId) {
  state.agentLastRun = run;
  state.messages.push({ id: randomUUID(), role: 'user', text, createdAt: new Date().toISOString() }, { id: randomUUID(), role: 'assistant', text: reply, provider: run.provider, durationMs: run.durationMs, toolCalls: run.toolCalls, proposalId, createdAt: new Date().toISOString() });
  state.messages = state.messages.slice(-80);
}
