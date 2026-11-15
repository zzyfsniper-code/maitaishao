import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../server/seed.mjs';
import { buildMeals, commitMenu, dietaryConflict } from '../server/domain.mjs';
import { previewKitchenUpdate, makeKitchenUpdateProposal, applyKitchenUpdate } from '../server/kitchen-updates.mjs';
import { kitchenTools } from '../server/kitchen-tools.mjs';

const week = '2026-11-16';
const change = (id, field, value, operation = 'set', target = 'member') => ({ target, id, field, operation, valueJson: JSON.stringify(value) });
function prepared() { const state = initialState(); commitMenu(state, week, buildMeals(state, week), 0, 'test'); return state; }
test('profile preview is read-only, retains other fields, and confirmed allergies affect subsequent planning', () => {
  const state = prepared(); state.members[2].allergies = ['花生'];
  state.menus[week].meals.find(m => m.kind === 'dinner').dishes[0] = { recipeId: state.recipes.find(r => r.name === '虾仁炒蛋').id, servings: 2.7 };
  const before = structuredClone(state);
  const changes = [change('child', 'allergies', ['虾'], 'add'), change('mom', 'profileTags', ['控糖'], 'add'), change('dad', 'likes', ['南瓜'], 'add')];
  const { diffs, warnings } = previewKitchenUpdate(state, week, changes);
  assert.deepEqual(state, before); assert.equal(diffs.length, 3); assert.ok(warnings.some(w => w.includes('虾')));
  const proposal = makeKitchenUpdateProposal(state, week, changes, '待确认');
  assert.deepEqual(state.members, before.members); state.revision++;
  applyKitchenUpdate(state, proposal);
  assert.deepEqual(state.members[2].allergies, ['花生', '虾']); assert.ok(state.members[0].profileTags.includes('控糖'));
  assert.deepEqual(state.members[0].restrictions, []); assert.deepEqual(state.menus, before.menus);
  assert.deepEqual(state.members[1].likes, ['牛肉', '南瓜']);
  for (const meal of buildMeals(state, week).filter(m => m.memberIds.includes('child'))) for (const dish of meal.dishes) assert.equal(dietaryConflict(state.recipes.find(r => r.id === dish.recipeId), [state.members[2]]), '');
});
test('remove versus replace and fixed schedule edits are limited to requested fields', () => {
  const state = prepared(); state.members[0].allergies = ['虾', '牛奶'];
  const { view } = previewKitchenUpdate(state, week, [change('mom', 'allergies', ['虾'], 'remove'), change('dad', 'schedule.2.dinner', false), change('dad', 'portion', .8)]);
  assert.deepEqual(view.members[0].allergies, ['牛奶']); assert.equal(view.members[1].schedule[2].dinner, false);
  assert.deepEqual(view.members[1].schedule[1], state.members[1].schedule[1]); assert.deepEqual(view.overrides, state.overrides);
  assert.deepEqual(previewKitchenUpdate(state, week, [change('mom', 'allergies', [])]).view.members[0].allergies, []);
});
test('invalid edits are atomic and arbitrary fields cannot be written', () => {
  const state = prepared(), before = structuredClone(state);
  for (const bad of [change('mom', 'portion', -1), change('mom', '__proto__', {}), change('missing', 'name', '爸爸'), change('mom', 'avatar', 'https://example.com/avatar.png'), change('mom', 'profileTags', ['不吃辣', '喜欢辣']), change('', 'apiKey', 'secret', 'set', 'settings'), change('mom', 'schedule.7.dinner', false), change('', 'scheduleTime', '25:60', 'set', 'settings')]) assert.throws(() => previewKitchenUpdate(state, week, [change('mom', 'likes', ['南瓜'], 'add'), bad]));
  assert.deepEqual(state, before);
});
test('stale, cancelled and confirmed proposals cannot be applied again', () => {
  for (const status of ['pending', 'cancelled', 'confirmed']) {
    const state = prepared(), proposal = makeKitchenUpdateProposal(state, week, [change('mom', 'profileTags', ['控糖'], 'add')], 'test');
    state.revision += status === 'pending' ? 2 : 1; proposal.status = status;
    assert.throws(() => applyKitchenUpdate(state, proposal), e => e.status === 409);
    assert.ok(!state.members[0].profileTags.includes('控糖'));
  }
});
test('new members require stated name and age; default values are included in the preview', () => {
  const state = prepared(); assert.throws(() => previewKitchenUpdate(state, week, [change('new', 'name', '奶奶')]));
  const result = previewKitchenUpdate(state, week, [change('new', 'name', '奶奶'), change('new', 'age', 70)]);
  assert.equal(result.view.members.length, 4); assert.ok(result.diffs.some(d => d.field === 'portion' && d.after === '1'));
});
test('recipe/import drafts and rule documents stay inactive; settings preserve untouched fields', () => {
  const state = prepared(); state.recipes.push({ ...structuredClone(state.recipes[0]), id: 'draft1', name: '草稿测试菜', status: 'draft' });
  const changes = [change('draft1', 'tags', ['少油'], 'add', 'recipe'), change('', 'scheduleTime', '19:30', 'set', 'settings'),
    change('new', 'memberId', 'child', 'set', 'import'), change('new', 'records', [{ date: week, meal: 'lunch', dishes: ['清蒸鲈鱼'], uncertain: true }], 'set', 'import'),
    ...Object.entries({ kind: '禁忌规则', name: '新增资料', content: '这里是待确认的规则原文。' }).map(([key, value]) => change('new', key, value, 'set', 'document'))];
  const { view } = previewKitchenUpdate(state, week, changes);
  assert.equal(view.recipes.at(-1).status, 'draft'); assert.equal(view.imports.at(-1).status, 'draft'); assert.equal(view.documents.at(-1).status, 'pending_review');
  assert.deepEqual(view.rules, state.rules); assert.deepEqual(view.settings, { ...state.settings, scheduleTime: '19:30' });
});
test('Pi tool produces the same field diffs without granting write tools or returning uploaded avatars', async () => {
  const state = prepared(); state.members[0].avatar = 'private-image'; let captured;
  const tools = kitchenTools(state, week, () => {}, changes => { captured = changes; });
  const changes = [change('child', 'allergies', ['虾'], 'add')];
  const output = await tools.find(t => t.name === 'preview_kitchen_update').execute('', { changes });
  assert.deepEqual(captured, changes); assert.equal(JSON.parse(output.content[0].text).previewOnly, true);
  assert.ok(!output.content[0].text.includes('private-image')); assert.deepEqual(state.members[2].allergies, []);
  assert.ok(tools.every(t => !t.name.includes('save') && !t.name.includes('confirm')));
});
