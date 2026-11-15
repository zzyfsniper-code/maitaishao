import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { fail, normalize, validateRecipe } from './domain.mjs';
import { applyKitchenUpdate, applyDirectKitchenUpdate, recordChat, kitchenChangesSchema } from './kitchen-updates.mjs';

const store = createStore(process.argv[2] || fileURLToPath(new URL('../data/kitchen.sqlite', import.meta.url)));
const server = new Server({ name: 'maitaishao-recipe-knowledge', version: '1.0.0' }, { capabilities: { tools: {} } });
const str = { type: 'string' }, integer = { type: 'integer' };
const schema = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const definitions = [
  { name: 'knowledge_search_recipes', description: '查询菜谱知识库。query 匹配菜名、食材、标签、做法和来源；status 为 all/draft/confirmed。', inputSchema: schema({ query: str, status: { type: 'string', enum: ['all', 'draft', 'confirmed'] } }), annotations: { readOnlyHint: true } },
  { name: 'knowledge_recipe_history', description: '读取菜谱所有历史版本。', inputSchema: schema({ id: str }), annotations: { readOnlyHint: true } },
  { name: 'knowledge_save_recipe', description: '网页核对后保存菜谱，检查数据和知识版本。空 id 新增草稿，已有确认菜谱更新保持确认。', inputSchema: schema({ revision: integer, id: str, knowledgeVersion: integer, recipe: { type: 'object' }, confirm: { type: 'boolean' } }), annotations: { readOnlyHint: false } },
  { name: 'knowledge_confirm_proposal', description: '用户确认已有菜谱变更建议后提交；原子保存关联的档案字段和知识版本。', inputSchema: schema({ revision: integer, id: str }), annotations: { readOnlyHint: false } },
  { name: 'knowledge_apply_chat_update', description: '按用户明确指令原子提交知识与关联资料修改、执行记录。仅供厨房后台调用。', inputSchema: schema({ revision: integer, week: str, changes: kitchenChangesSchema, text: str, run: { type: 'object' } }), annotations: { readOnlyHint: false } }
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: definitions }));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  try {
    const args = params.arguments || {}, state = store.load();
    let output;
    if (params.name === 'knowledge_search_recipes') {
      if (typeof args.query !== 'string' || args.query.length > 1000 || !['all', 'draft', 'confirmed'].includes(args.status)) fail('查询条件无效。');
      const query = normalize(args.query);
      output = { revision: state.revision, recipes: state.recipes.filter(r => (args.status === 'all' || r.status === args.status) && (!query || normalize([r.name, ...r.tags, ...r.allergens, ...r.ingredients.map(i => i.name), ...r.steps, r.source || ''].join('|')).includes(query))) };
    } else if (params.name === 'knowledge_recipe_history') {
      if (typeof args.id !== 'string') fail('请提供菜谱 ID。');
      output = { id: args.id, versions: store.recipeHistory(args.id) };
    } else if (['knowledge_save_recipe', 'knowledge_confirm_proposal', 'knowledge_apply_chat_update'].includes(params.name)) {
      if (args.revision !== state.revision) fail('知识库或家庭数据已变化，请刷新后重试。', 409);
      if (params.name === 'knowledge_apply_chat_update') {
        if (typeof args.text !== 'string' || !args.text.trim() || args.text.length > 3000 || !args.run || typeof args.run !== 'object') fail('对话修改记录无效。');
        output = applyDirectKitchenUpdate(state, args.week, args.changes);
        for (const recipe of state.recipes) validateKnowledgeRecipe(state, recipe);
        recordChat(state, args.text, output.reply, args.run, output.proposal.id);
      } else if (params.name === 'knowledge_confirm_proposal') {
        const proposal = state.proposals.find(p => p.id === args.id && p.kind === 'kitchen_update');
        if (!proposal?.changes.some(c => c.target === 'recipe')) fail('找不到待确认的菜谱修改建议。');
        applyKitchenUpdate(state, proposal);
        for (const recipe of state.recipes) validateKnowledgeRecipe(state, recipe);
        output = { proposalId: proposal.id };
      } else {
        const old = state.recipes.find(r => r.id === args.id);
        if ((args.id && !old) || (old?.knowledgeVersion || 0) !== args.knowledgeVersion) fail('菜谱版本已变化，请重新打开后修改。', 409);
        if (!args.recipe || typeof args.recipe !== 'object' || typeof args.confirm !== 'boolean') fail('菜谱格式无效。');
        if (!old && args.confirm) fail('新菜谱请先保存为草稿，再核对入库。');
        const editable = ['name', 'category', 'baseServings', 'ingredients', 'allergens', 'steps', 'tags', 'source'];
        const recipe = { ...(old || { id: randomUUID(), status: 'draft', repeatExempt: false, seasonal: '通用', demo: false, source: '手动添加的菜谱草稿' }), ...Object.fromEntries(editable.filter(k => Object.hasOwn(args.recipe, k)).map(k => [k, args.recipe[k]])), status: old?.status === 'confirmed' || args.confirm ? 'confirmed' : 'draft' };
        validateKnowledgeRecipe(state, recipe);
        if (old) state.recipes[state.recipes.indexOf(old)] = recipe; else state.recipes.push(recipe);
        output = { recipeId: recipe.id };
      }
      const saved = store.save(state, state.revision, { recipeWrites: true });
      output.revision = saved.revision;
      if (output.recipeId) output.recipe = saved.recipes.find(r => r.id === output.recipeId);
    } else fail('未知知识库工具。', 404);
    return { content: [{ type: 'text', text: JSON.stringify(output) }] };
  } catch (error) { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.message, status: error.status || 400 }) }] }; }
});
function validateKnowledgeRecipe(state, recipe) {
  validateRecipe(recipe);
  if (![recipe.tags, recipe.allergens].every(list => list.length <= 100 && list.every(t => typeof t === 'string' && t.trim() && t.length <= 60)) || typeof recipe.source !== 'string' || recipe.source.length > 3000) fail('请核对菜谱标签和来源说明。');
  if (recipe.status === 'confirmed' && state.recipes.some(r => r.id !== recipe.id && r.status === 'confirmed' && normalize(r.name) === normalize(recipe.name))) fail('已存在同名已确认菜谱，请避免重复身份。');
}
server.onclose = () => store.close();
await server.connect(new StdioServerTransport());
