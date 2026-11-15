import { allMeals, buildMeals, shopping, validateMeals } from './domain.mjs';
import { addDays, dateInZone } from './seed.mjs';
import { nutritionSummary } from './nutrition.mjs';
import { editableContext, kitchenChangesSchema, previewKitchenUpdate } from './kitchen-updates.mjs';

const str = { type: 'string' };
const parameters = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
function tool(name, description, properties, read) {
  return { name, label: description, description, parameters: parameters(properties), async execute(_id, args) {
    return { content: [{ type: 'text', text: JSON.stringify(await read(args)) }], details: {} };
  } };
}
export function kitchenTools(state, week, onPreview = () => {}, onUpdatePreview = () => {}, knowledge) {
  const snapshot = structuredClone(state);
  const named = meals => meals.map(m => ({ ...m, dishes: m.dishes.map(d => ({ ...d, name: snapshot.recipes.find(r => r.id === d.recipeId)?.name })) }));
  return [
    tool('get_kitchen_context', '查询当前家庭档案、规则、选定周菜单和已确认幼儿园午餐。回答厨房问题前先调用。', {}, () => ({
      today: dateInZone(new Date(), snapshot.settings.timezone), selectedWeek: week, revision: snapshot.revision,
      members: snapshot.members.map(({ avatar, ...m }) => m), rules: snapshot.rules, editable: editableContext(snapshot),
      menu: named(snapshot.menus[week]?.meals || []), nutrition: nutritionSummary(snapshot, week), kindergarten: snapshot.imports.filter(i => i.status === 'confirmed').map(({ memberId, week, records }) => ({ memberId, week, records }))
    })),
    tool('find_recipes', '通过 MCP 查询已确认菜谱知识的食材、过敏标签、做法和版本。query 为空时列出全部。', { query: str }, async ({ query }) => knowledge ? (await knowledge.call('knowledge_search_recipes', { query, status: 'confirmed' })).recipes : snapshot.recipes.filter(r => r.status === 'confirmed' && (!query || [r.name, ...r.tags, ...r.ingredients.map(i => i.name)].some(s => s.includes(query))))),
    tool('preview_menu_adjustment', '按现有规则试排菜单并校验。返回候选供后台校验，不写数据库；后台根据 execution 直接保存或保留预览。', {
      start: str, end: str, meal: { type: 'string', enum: ['all', 'breakfast', 'lunch', 'dinner'] }, style: { type: 'string', enum: ['', 'light'] }, dishCount: { type: 'integer', minimum: 0, maximum: 5, description: '午晚餐菜数，不计另配的主食；0 使用默认五道菜。全周调整的早餐保持两项。' }, requestedRecipeName: str
    }, options => {
      const meals = buildMeals(snapshot, week, options);
      onPreview({ options: structuredClone(options), meals: structuredClone(meals) });
      return { previewOnly: true, meals: named(meals), issues: validateMeals(snapshot, meals, allMeals(snapshot).filter(m => m.date < week || m.date > addDays(week, 6))) };
    }),
    tool('get_shopping_list', '根据已保存菜单、份量和日期计算采购清单，不包含待确认建议或幼儿园午餐。', { start: str, end: str }, ({ start, end }) => shopping(snapshot, start, end)),
    tool('preview_kitchen_update', '预览成员档案、固定规律、排程设置、菜谱或午餐草稿、待接入资料的修改。只修改指定字段，返回前后对比与菜单影响，不保存。changes 必须与最终 update_kitchen 输出一致。', { changes: kitchenChangesSchema }, ({ changes }) => {
      const { diffs, warnings } = previewKitchenUpdate(snapshot, week, changes);
      onUpdatePreview(structuredClone(changes));
      return { previewOnly: true, diffs, warnings, note: '这是内部校验预览。明确指令默认 execution=apply，由后台直接保存；只有用户要求先预览时才等待确认。新增菜谱和午餐仍为草稿，规则资料仍待接入。' };
    })
  ];
}
