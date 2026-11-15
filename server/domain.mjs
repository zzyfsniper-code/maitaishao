import { randomUUID } from 'node:crypto';
import { addDays, monday, MEALS, MEAL_NAMES } from './seed.mjs';
import { diversityBonus, POSITIVE_RULE_VERSION } from './nutrition.mjs';
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail('日期格式无效。');
  return date;
}
export function validWeek(week) { validDate(week); if (monday(week) !== week) fail('周起始日期应为周一。'); return week; }
export function normalize(s) { return String(s).trim().replaceAll('西红柿', '番茄').replaceAll('虾仁', '虾').replaceAll('乳制品', '牛奶').replaceAll('花生仁', '花生').replaceAll('鸡蛋羹', '蒸蛋羹').replace(/\s/g, ''); }
function tokens(term) {
  const map = { 海鲜: ['鱼', '虾', '蟹', '贝', '蚝油'], 小麦: ['小麦', '面条', '馒头', '面包', '荞麦面'], 大豆: ['大豆', '黄豆', '豆腐', '豆浆'], 牛奶: ['牛奶', '酸奶', '奶酪', '乳'], 坚果: ['花生', '核桃', '杏仁', '腰果'], 蛋: ['鸡蛋'] };
  return map[normalize(term)] || [normalize(term)];
}
export function contextFor(state, date, kind) {
  const day = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const override = state.overrides[`${date}:${kind}`];
  const members = state.members.filter(m => override ? override.memberIds.includes(m.id) : m.schedule[day][kind]);
  return { members, portions: +members.reduce((sum, m) => sum + (override?.portions?.[m.id] ?? m.portion), 0).toFixed(2) };
}
export function dietaryConflict(recipe, members) {
  const haystack = normalize([recipe.name, ...recipe.allergens, ...recipe.ingredients.map(i => i.name)].join('|'));
  if (members.some(m => m.spice === '不辣' || m.profileTags?.includes('不吃辣')) && (recipe.tags.some(t => /辣/.test(t) && !/不辣|无辣/.test(t)) || /辣椒|辣酱|辣油/.test(haystack))) return '用餐成员不吃辣';
  for (const member of members) for (const term of [...member.allergies, ...member.restrictions]) {
    if (tokens(term).some(t => t && haystack.includes(t))) return `${member.name}限制「${term}」`;
  }
  return '';
}
function externalConflict(state, recipe, date, kind, members) {
  if (kind !== 'dinner') return false;
  return state.imports.some(entry => entry.status === 'confirmed' && members.some(m => m.id === entry.memberId) && entry.records.some(r => r.date === date && r.meal === 'lunch' && r.dishes.some(d => normalize(d) === normalize(recipe.name))));
}
function dateDistance(a, b) { return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000); }
export function allMeals(state) { return Object.values(state.menus).flatMap(m => m.meals); }
function repeated(state, recipe, date, kind, otherMeals) {
  return otherMeals.some(meal => !(recipe.repeatExempt && kind === 'breakfast' && meal.kind === 'breakfast') && dateDistance(date, meal.date) <= state.rules.repeatGapDays && meal.dishes.some(d => d.recipeId === recipe.id));
}
function eligible(state, recipe, date, kind, members, others, style) {
  return recipe.status === 'confirmed' && !dietaryConflict(recipe, members) && !externalConflict(state, recipe, date, kind, members) && !repeated(state, recipe, date, kind, others) && (style !== 'light' || recipe.tags.includes('清淡'));
}
export function validateMeals(state, meals, otherMeals = []) {
  const errors = [];
  for (let index = 0; index < meals.length; index++) {
    const meal = meals[index], ctx = contextFor(state, meal.date, meal.kind);
    if ([...meal.memberIds].sort().join() !== ctx.members.map(m => m.id).sort().join()) errors.push(`${meal.date} ${MEAL_NAMES[meal.kind]}：用餐成员发生变化，待重新安排`);
    if (Math.abs(meal.portions - ctx.portions) > .001) errors.push(`${meal.date} ${MEAL_NAMES[meal.kind]}：默认饭量发生变化，待核对菜量`);
    if (!ctx.members.length && meal.dishes.length) errors.push(`${meal.date}：无人用餐却仍有菜品`);
    if (ctx.members.length && !meal.dishes.length) errors.push(`${meal.date}：尚未安排菜品`);
    const seen = new Set();
    for (const dish of meal.dishes) {
      const recipe = state.recipes.find(r => r.id === dish.recipeId);
      if (!recipe || recipe.status !== 'confirmed') { errors.push('菜单包含未确认或不存在的菜谱'); continue; }
      if (!Number.isFinite(dish.servings) || dish.servings <= 0) errors.push('菜谱份数无效');
      if (seen.has(recipe.id)) errors.push(`${meal.date}：同餐重复菜品`);
      seen.add(recipe.id);
      const reason = dietaryConflict(recipe, ctx.members);
      if (reason) errors.push(`${meal.date} ${recipe.name}：${reason}`);
      if (externalConflict(state, recipe, meal.date, meal.kind, ctx.members)) errors.push(`${meal.date} ${recipe.name}：与幼儿园午餐重复`);
      if (repeated(state, recipe, meal.date, meal.kind, [...otherMeals, ...meals.filter((_, i) => i !== index)])) errors.push(`${meal.date} ${recipe.name}：未间隔 ${state.rules.repeatGapDays} 个完整自然日`);
    }
  }
  return [...new Set(errors)];
}
function recipeScore(recipe, members, prior, date) {
  const preference = members.reduce((v, m) => {
    const tags = m.profileTags || [];
    const matched = (tags.includes('清淡') && recipe.tags.includes('清淡')) || (tags.includes('爱吃鱼') && recipe.allergens.includes('鱼')) || (tags.includes('爱吃肉') && recipe.category === 'meat');
    return v + (matched ? 1 : 0) + m.likes.filter(x => normalize(recipe.name + recipe.tags.join()).includes(normalize(x))).length * 2 - m.dislikes.filter(x => normalize(recipe.name).includes(normalize(x))).length * 5;
  }, 0);
  const used = prior.filter(m => m.dishes.some(d => d.recipeId === recipe.id)).length;
  const protein = recipe.allergens.find(x => ['牛肉', '鸡肉', '猪肉', '鱼', '虾', '鸭肉'].includes(x));
  const recentSameProtein = protein ? prior.slice(-6).filter(m => m.dishes.some(d => recipe.id !== d.recipeId && m._recipes?.[d.recipeId]?.allergens.includes(protein))).length : 0;
  return preference - used * 2 - recentSameProtein + diversityBonus(recipe, members, prior, date) + Math.random() * 2;
}
export function buildMeals(state, week, options = {}) {
  validWeek(week);
  const start = options.start || week, end = options.end || addDays(week, 6), kind = options.meal || 'all';
  validDate(start); validDate(end);
  if (start < week || end > addDays(week, 6) || start > end) fail('调整日期不在当前周，请先切换到对应周。');
  if (!['all', ...MEALS].includes(kind)) fail('无法识别餐次，请明确早餐、午餐或晚餐。');
  const affected = meal => meal.date >= start && meal.date <= end && (kind === 'all' || meal.kind === kind);
  const prior = allMeals(state).filter(m => !affected(m));
  const generated = [];
  const recipeMap = Object.fromEntries(state.recipes.map(r => [r.id, r]));
  for (let date = start; date <= end; date = addDays(date, 1)) for (const mealKind of MEALS) {
    if (kind !== 'all' && kind !== mealKind) continue;
    const { members, portions } = contextFor(state, date, mealKind);
    const meal = { date, kind: mealKind, memberIds: members.map(m => m.id), portions, dishes: [], warnings: [] };
    if (!members.length) { generated.push(meal); continue; }
    const breakfast = mealKind === 'breakfast';
    const count = (breakfast && kind === 'all' ? 0 : options.dishCount) || (breakfast ? 2 : state.rules.mainDishCount || 5);
    if (!Number.isInteger(count) || count < 1 || count > (breakfast ? 2 : 5)) fail(breakfast ? '早餐支持 1–2 项。' : '午晚餐支持 1–5 道菜，主食另算。');
    const categories = breakfast ? ['breakfast_staple', 'breakfast_protein'].slice(0, count) : [...['meat', 'vegetable', 'meat', 'vegetable', 'side'].slice(0, count), 'staple'];
    let desired;
    if (options.requestedRecipeName) {
      desired = state.recipes.find(r => normalize(r.name) === normalize(options.requestedRecipeName) && r.status === 'confirmed');
      if (!desired) fail(`「${options.requestedRecipeName}」尚未在已确认菜谱库中，请先新增并确认。`);
      if (!categories.includes(desired.category)) categories[breakfast ? categories.length - 1 : categories.length - 2] = desired.category;
    }
    for (const category of categories) {
      const others = [...prior, ...generated];
      let candidates = state.recipes.filter(r => (category === 'side' ? ['meat', 'vegetable'].includes(r.category) : r.category === category) && !meal.dishes.some(d => d.recipeId === r.id) && eligible(state, r, date, mealKind, members, others, options.style));
      if (desired?.category === category && !meal.dishes.some(d => d.recipeId === desired.id)) candidates = candidates.filter(r => r.id === desired.id);
      if (!candidates.length) fail(`${date} ${MEAL_NAMES[mealKind]}没有符合${desired?.category === category ? `「${desired.name}」和` : ''}饮食限制、重复间隔的${({ meat: '荤菜', vegetable: '素菜', side: '第五道荤菜或素菜', staple: '主食', soup: '汤', breakfast_staple: '早餐主食', breakfast_protein: '早餐蛋白质' })[category]}。请补充菜谱或调整要求；未放宽硬约束。`, 422);
      const scored = candidates.map(r => ({ recipe: r, score: recipeScore(r, members, others.map(m => ({ ...m, _recipes: recipeMap })), date) })).sort((a, b) => b.score - a.score);
      meal.dishes.push({ recipeId: scored[0].recipe.id, servings: portions });
    }
    if (members.some(m => m.age < 7) && !state.imports.some(i => i.status === 'confirmed' && i.records.some(r => r.date === date))) meal.warnings.push('待核对幼儿园午餐');
    if (mealKind !== 'breakfast' && !['meat', 'vegetable'].every(c => meal.dishes.some(d => recipeMap[d.recipeId].category === c))) meal.warnings.push('本餐按指定菜数安排，暂行荤素搭配目标未完全满足');
    generated.push(meal);
  }
  const errors = validateMeals(state, generated, prior);
  if (errors.length) fail(errors.join('；'), 422);
  const existing = state.menus[week]?.meals || [];
  return [...existing.filter(m => !affected(m)), ...generated].sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.kind) - MEALS.indexOf(b.kind));
}
export function commitMenu(state, week, meals, expectedVersion, reason) {
  const current = state.menus[week];
  if ((current?.version || 0) !== expectedVersion) fail('菜单已更新，这个建议已过期，请重新生成。', 409);
  state.undo[week] ||= [];
  if (current) state.undo[week] = [...state.undo[week].slice(-9), structuredClone(current)];
  state.menus[week] = { week, version: expectedVersion + 1, meals, updatedAt: new Date().toISOString(), reason, ruleVersion: state.rules.version, positiveRuleVersion: POSITIVE_RULE_VERSION };
}
export function replaceDish(state, week, date, kind, recipeId, version) {
  const current = state.menus[week];
  if (!current || current.version !== version) fail('菜单版本已变化，请刷新后替换。', 409);
  const meals = structuredClone(current.meals), meal = meals.find(m => m.date === date && m.kind === kind);
  const dish = meal?.dishes.find(d => d.recipeId === recipeId), recipe = state.recipes.find(r => r.id === recipeId);
  if (!dish || !recipe) fail('没有找到这道菜。');
  const ctx = contextFor(state, date, kind);
  const others = allMeals(state).map(m => m.date === date && m.kind === kind ? { ...m, dishes: m.dishes.filter(d => d.recipeId !== recipeId) } : m);
  const candidates = state.recipes.filter(r => r.id !== recipeId && r.category === recipe.category && eligible(state, r, date, kind, ctx.members, others));
  if (!candidates.length) fail('没有符合当前约束的同类菜，请补充菜谱。', 422);
  dish.recipeId = candidates[Math.floor(Math.random() * candidates.length)].id;
  const issues = validateMeals(state, meals, allMeals(state).filter(m => m.date < week || m.date > addDays(week, 6)));
  if (issues.length) fail(issues.join('；'), 422);
  commitMenu(state, week, meals, version, '替换单菜');
}
export function shopping(state, start, end) {
  validDate(start); validDate(end);
  if (start > end) fail('结束日期应不早于开始日期。');
  const rows = new Map(), warnings = [], versions = {};
  for (const menu of Object.values(state.menus)) for (const meal of menu.meals.filter(m => m.date >= start && m.date <= end)) {
    versions[menu.week] = menu.version;
    for (const dish of meal.dishes) {
      const recipe = state.recipes.find(r => r.id === dish.recipeId);
      for (const ingredient of recipe.ingredients) {
        if (!Number.isFinite(ingredient.amount)) { warnings.push(`${recipe.name}的${ingredient.name}缺少用量`); continue; }
        const unit = { kg: 'g', l: 'ml', L: 'ml', 克: 'g', 毫升: 'ml' }[ingredient.unit] || ingredient.unit;
        const multiplier = ['kg', 'l', 'L'].includes(ingredient.unit) ? 1000 : 1;
        const name = normalize(ingredient.name), key = `${name}:${unit}`;
        const row = rows.get(key) || { name, unit, amount: 0, dishes: [] };
        row.amount += ingredient.amount * multiplier * dish.servings / recipe.baseServings;
        if (!row.dishes.includes(recipe.name)) row.dishes.push(recipe.name);
        rows.set(key, row);
      }
    }
  }
  return { start, end, versions, warnings, items: [...rows.values()].map(r => ({ ...r, amount: +r.amount.toFixed(1) })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), basis: state.rules.quantityBasis };
}
export function makeProposal(state, week, options, reply, overrides, preparedMeals) {
  const view = structuredClone(state);
  if (overrides) Object.assign(view.overrides, overrides);
  const meals = preparedMeals ? structuredClone(preparedMeals) : buildMeals(view, week, options);
  const issues = validateMeals(view, meals, allMeals(view).filter(m => m.date < week || m.date > addDays(week, 6)));
  if (issues.length) fail(issues.join('；'), 422);
  const proposal = { id: randomUUID(), week, baseRevision: state.revision + 1, menuVersion: state.menus[week]?.version || 0, meals, overrides: overrides || {}, reply, status: 'pending', createdAt: new Date().toISOString() };
  state.proposals = [...state.proposals.slice(-9), proposal];
  return proposal;
}
export function validateRecipe(recipe) {
  if (!recipe.name?.trim() || recipe.name.length > 80 || !['meat', 'vegetable', 'staple', 'soup', 'breakfast_staple', 'breakfast_protein'].includes(recipe.category)) fail('请填写菜名和有效分类。');
  if (!Number.isFinite(recipe.baseServings) || recipe.baseServings <= 0 || recipe.baseServings > 50) fail('基础份数应为 0–50 之间的正数。');
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.some(i => !i.name?.trim() || !Number.isFinite(i.amount) || i.amount <= 0 || !['g', 'ml', '个', 'kg', 'l', '克', '毫升'].includes(i.unit))) fail('食材需填写名称、正数用量和单位（g、ml、个、kg、l、克、毫升）。');
  if (!Array.isArray(recipe.steps) || !recipe.steps.length || recipe.steps.some(x => typeof x !== 'string' || !x.trim())) fail('请填写做法步骤。');
  if (!Array.isArray(recipe.allergens) || !Array.isArray(recipe.tags)) fail('过敏标签与口味标签需为列表。');
}
