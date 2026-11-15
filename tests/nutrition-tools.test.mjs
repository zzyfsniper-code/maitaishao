import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../server/seed.mjs';
import { buildMeals, commitMenu, makeProposal } from '../server/domain.mjs';
import { diversityBonus, foodNames, nutritionSummary } from '../server/nutrition.mjs';
import { kitchenTools } from '../server/kitchen-tools.mjs';

test('food variety excludes seasonings and deduplicates aliases and repeated meals', () => {
  const dish = { ingredients: ['番茄', '西红柿', '盐', '油', '鸡蛋'].map(name => ({ name })) };
  assert.deepEqual(foodNames(dish), ['番茄', '鸡蛋']);
  const state = { recipes: [{ ...dish, id: 'r' }], members: [{ id: 'a' }, { id: 'b' }], menus: { '2026-11-16': { meals: [0, 1].map(() => ({ memberIds: ['a'], dishes: [{ recipeId: 'r' }] })) } } };
  const summary = nutritionSummary(state, '2026-11-16');
  assert.equal(summary.foodCount, 2);
  assert.deepEqual(summary.members.map(m => m.foodCount), [2, 0]);
  assert.equal(summary.nutrients.status, 'unavailable');
});
test('variety bonus uses only meals attended by each member in the selected week', () => {
  const recipe = { ingredients: [{ name: '番茄' }] };
  const prior = [{ date: '2026-11-16', memberIds: ['a'], dishes: [{ recipeId: 'r' }], _recipes: { r: recipe } }];
  assert.equal(diversityBonus(recipe, [{ id: 'a' }], prior, '2026-11-17'), 0);
  assert.equal(diversityBonus(recipe, [{ id: 'b' }], prior, '2026-11-17'), 1);
  assert.equal(diversityBonus(recipe, [{ id: 'a' }], prior, '2026-11-23'), 1);
});
test('Pi kitchen tools preview valid menus without changing stored data or exposing avatars', async () => {
  const state = initialState(), week = '2026-11-16';
  commitMenu(state, week, buildMeals(state, week), 0, 'test');
  state.members[0].avatar = 'private-image-data';
  let captured;
  const before = structuredClone(state), tools = kitchenTools(state, week, preview => { captured = preview; });
  const context = await tools.find(t => t.name === 'get_kitchen_context').execute('', {});
  assert.ok(!context.content[0].text.includes('private-image-data'));
  const output = await tools.find(t => t.name === 'preview_menu_adjustment').execute('', { start: '2026-11-18', end: '2026-11-18', meal: 'dinner', style: '', dishCount: 2, requestedRecipeName: '' });
  const preview = JSON.parse(output.content[0].text);
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.meals.find(m => m.date === '2026-11-18' && m.kind === 'dinner').dishes.length, 2);
  assert.deepEqual(state, before);
  assert.ok(tools.every(t => !['bash', 'read', 'write', 'edit'].includes(t.name)));
  const proposal = makeProposal(state, week, captured.options, '待确认', undefined, captured.meals);
  assert.deepEqual(proposal.meals, captured.meals);
  assert.notEqual(proposal.meals, captured.meals);
  assert.deepEqual(state.menus, before.menus);
});
