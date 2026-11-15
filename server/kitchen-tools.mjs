import { allMeals, buildMeals, shopping, validateMeals } from './domain.mjs';
import { addDays, dateInZone } from './seed.mjs';
import { nutritionSummary } from './nutrition.mjs';

const str = { type: 'string' };
const parameters = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
function tool(name, description, properties, read) {
  return { name, label: description, description, parameters: parameters(properties), async execute(_id, args) {
    return { content: [{ type: 'text', text: JSON.stringify(read(args)) }], details: {} };
  } };
}
export function kitchenTools(state, week, onPreview = () => {}) {
  const snapshot = structuredClone(state);
  const named = meals => meals.map(m => ({ ...m, dishes: m.dishes.map(d => ({ ...d, name: snapshot.recipes.find(r => r.id === d.recipeId)?.name })) }));
  return [
    tool('get_kitchen_context', '查询当前家庭档案、规则、选定周菜单和已确认幼儿园午餐。回答厨房问题前先调用。', {}, () => ({
      today: dateInZone(new Date(), snapshot.settings.timezone), selectedWeek: week, revision: snapshot.revision,
      members: snapshot.members.map(({ avatar, ...m }) => m), rules: snapshot.rules,
      menu: named(snapshot.menus[week]?.meals || []), nutrition: nutritionSummary(snapshot, week), kindergarten: snapshot.imports.filter(i => i.status === 'confirmed').map(({ memberId, week, records }) => ({ memberId, week, records }))
    })),
    tool('find_recipes', '查询已确认菜谱及食材、过敏标签、做法。query 为空时列出全部。', { query: str }, ({ query }) => snapshot.recipes.filter(r => r.status === 'confirmed' && (!query || [r.name, ...r.tags, ...r.ingredients.map(i => i.name)].some(s => s.includes(query))))),
    tool('preview_menu_adjustment', '按现有规则试排菜单并校验。返回候选，不写数据库；最终需输出调整意图并由用户确认。', {
      start: str, end: str, meal: { type: 'string', enum: ['all', 'breakfast', 'lunch', 'dinner'] }, style: { type: 'string', enum: ['', 'light'] }, dishCount: { type: 'integer' }, requestedRecipeName: str
    }, options => {
      const meals = buildMeals(snapshot, week, options);
      onPreview({ options: structuredClone(options), meals: structuredClone(meals) });
      return { previewOnly: true, meals: named(meals), issues: validateMeals(snapshot, meals, allMeals(snapshot).filter(m => m.date < week || m.date > addDays(week, 6))) };
    }),
    tool('get_shopping_list', '根据已保存菜单、份量和日期计算采购清单，不包含待确认建议或幼儿园午餐。', { start: str, end: str }, ({ start, end }) => shopping(snapshot, start, end))
  ];
}
