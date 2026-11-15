import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initialState, addDays } from '../server/seed.mjs';
import { buildMeals, commitMenu, validateMeals, shopping, dietaryConflict, replaceDish, makeProposal, contextFor, validDate } from '../server/domain.mjs';
import { createStore } from '../server/store.mjs';
import { publicAddress } from '../server/source.mjs';
const week = '2026-11-16';
function prepared() { const s = initialState(); commitMenu(s, week, buildMeals(s, week), 0, 'test'); return s; }
test('seven days / three meals, weekday kindergarten attendance and servings', () => {
  const s = prepared(), meals = s.menus[week].meals;
  assert.equal(meals.length, 21); assert.deepEqual(validateMeals(s, meals), []);
  assert.equal(meals.find(m => m.date === week && m.kind === 'lunch').memberIds.includes('child'), false);
  assert.equal(meals.find(m => m.date === addDays(week, 5) && m.kind === 'lunch').memberIds.includes('child'), true);
  assert.equal(meals.find(m => m.date === week && m.kind === 'dinner').portions, 2.7);
});
test('repeat interval holds across the week boundary', () => {
  const s = prepared(), next = addDays(week, 7), earlier = s.menus[week].meals;
  const meals = buildMeals(s, next); assert.deepEqual(validateMeals(s, meals, earlier), []);
});

test('main meals contain five distinct dishes plus a separate staple, breakfast stays unchanged', () => {
  const s = prepared();
  for (const meal of s.menus[week].meals) {
    const recipes = meal.dishes.map(d => s.recipes.find(r => r.id === d.recipeId));
    assert.equal(new Set(meal.dishes.map(d => d.recipeId)).size, meal.dishes.length);
    if (meal.kind === 'breakfast') assert.deepEqual(recipes.map(r => r.category), ['breakfast_staple', 'breakfast_protein']);
    else {
      assert.equal(recipes.filter(r => r.category !== 'staple').length, 5);
      assert.equal(recipes.filter(r => r.category === 'staple').length, 1);
    }
  }
});

test('same dish is rejected on the next day and allowed after one full intervening day', () => {
  const s = initialState(), fish = s.recipes.find(r => r.name === '清蒸鲈鱼');
  const ctx = contextFor(s, week, 'dinner');
  const old = { date: week, kind: 'dinner', memberIds: ctx.members.map(m => m.id), portions: ctx.portions, dishes: [{ recipeId: fish.id, servings: ctx.portions }] };
  const nextDay = { ...old, date: addDays(week, 1) }, dayAfter = { ...old, date: addDays(week, 2) };
  assert.ok(validateMeals(s, [nextDay], [old]).some(e => e.includes('未间隔 1 个完整自然日')));
  assert.deepEqual(validateMeals(s, [dayAfter], [old]), []);
});

test('requesting a recipe in a five-dish meal includes it once and retains a staple', () => {
  const s = initialState(), meals = buildMeals(s, week, { start: week, end: week, meal: 'dinner', dishCount: 5, requestedRecipeName: '清蒸鲈鱼' });
  const dishIds = meals[0].dishes.map(d => d.recipeId), fish = s.recipes.find(r => r.name === '清蒸鲈鱼');
  assert.equal(dishIds.length, 6);
  assert.equal(dishIds.filter(id => id === fish.id).length, 1);
  assert.equal(dishIds.filter(id => s.recipes.find(r => r.id === id).category === 'staple').length, 1);
});
test('allergy exclusions cover shared meal and ingredient aliases', () => {
  const s = initialState(); s.members[2].allergies = ['海鲜', '乳制品'];
  const meals = buildMeals(s, week);
  for (const m of meals.filter(m => m.memberIds.includes('child'))) for (const d of m.dishes) assert.equal(dietaryConflict(s.recipes.find(r => r.id === d.recipeId), [s.members[2]]), '');
  assert.match(dietaryConflict(s.recipes.find(r => r.name === '虾仁炒蛋'), [s.members[2]]), /海鲜/);
});
test('draft recipes never enter the plan', () => {
  const s = initialState(); s.recipes.forEach(r => r.status = 'draft'); assert.throws(() => buildMeals(s, week), /没有符合/);
});
test('one meal proposal retains every unaffected meal and does not mutate menu', () => {
  const s = prepared(), before = JSON.stringify(s.menus[week]);
  const p = makeProposal(s, week, { start: week, end: week, meal: 'dinner', dishCount: 2 }, 'test');
  assert.equal(JSON.stringify(s.menus[week]), before);
  assert.equal(p.meals.find(m => m.date === week && m.kind === 'dinner').dishes.length, 3);
  for (const m of s.menus[week].meals.filter(m => !(m.date === week && m.kind === 'dinner'))) assert.deepEqual(p.meals.find(n => n.date === m.date && n.kind === m.kind), m);
});
test('temporary attendance does not overwrite fixed schedule', () => {
  const s = prepared(); const schedule = structuredClone(s.members[1].schedule);
  const p = makeProposal(s, week, { start: week, end: week, meal: 'dinner' }, 'test', { [`${week}:dinner`]: { memberIds: ['mom', 'child'], portions: { child: .6 } } });
  assert.deepEqual(s.members[1].schedule, schedule);
  assert.deepEqual(p.meals.find(m => m.date === week && m.kind === 'dinner').memberIds, ['mom', 'child']);
  assert.equal(p.meals.find(m => m.date === week && m.kind === 'dinner').portions, 1.6);
  assert.equal(contextFor(s, week, 'dinner').members.length, 3);
});
test('stale menu operations are rejected', () => {
  const s = prepared(); assert.throws(() => commitMenu(s, week, [], 0, 'stale'), /已更新/);
  assert.throws(() => replaceDish(s, week, week, 'breakfast', s.menus[week].meals[0].dishes[0].recipeId, 0), /版本/);
});
test('shopping scales quantities and never includes external lunch', () => {
  const s = initialState(); s.recipes = [
    { id: 'x', name: '测试餐', baseServings: 2, ingredients: [{ name: '番茄', amount: .2, unit: 'kg' }, { name: '牛奶', amount: 100, unit: 'ml' }, { name: '鸡蛋', amount: 1, unit: '个' }] },
    { id: 'y', name: '另一餐', baseServings: 1, ingredients: [{ name: '西红柿', amount: 150, unit: 'g' }, { name: '牛奶', amount: 30, unit: 'g' }] }
  ]; s.menus[week] = { week, version: 1, meals: [{ date: week, kind: 'dinner', dishes: [{ recipeId: 'x', servings: 3 }, { recipeId: 'y', servings: 1 }] }] };
  s.imports = [{ status: 'confirmed', records: [{ date: week, meal: 'lunch', dishes: ['园内食材'] }] }];
  const list = shopping(s, week, week).items;
  assert.equal(list.find(i => i.name === '番茄').amount, 450); assert.equal(list.find(i => i.name === '鸡蛋').amount, 1.5);
  assert.equal(list.filter(i => i.name === '牛奶').length, 2); assert.equal(list.some(i => i.name.includes('园内')), false);
});
test('same-day kindergarten lunch excludes matching dinner recipe', () => {
  const s = initialState(); s.imports.push({ status: 'confirmed', memberId: 'child', records: [{ date: week, meal: 'lunch', dishes: ['锅包肉'] }] });
  assert.throws(() => buildMeals(s, week, { start: week, end: week, meal: 'dinner', requestedRecipeName: '锅包肉' }), /没有符合/);
});
test('SQLite survives reopening; compare-and-save prevents lost writes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kitchen-store-test-')), file = path.join(dir, 'test.sqlite'); let store = createStore(file);
  try { const a = store.load(), b = store.load(); a.members[0].profileTags.push('控糖'); store.save(a); assert.throws(() => store.save(b), /另一项操作/); store.close(); store = createStore(file); assert.ok(store.load().members[0].profileTags.includes('控糖')); }
  finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('unattended meals are empty and invalid calendar dates are rejected', () => {
  const s = initialState(); s.members.forEach(m => m.schedule[0].dinner = false);
  const meal = buildMeals(s, week).find(m => m.date === week && m.kind === 'dinner'); assert.deepEqual(meal.dishes, []);
  assert.throws(() => validDate('2026-02-30'), /日期格式/);
});
test('public IPv6 works; local, private and mapped loopback remain excluded', () => {
  assert.equal(publicAddress({ family: 6, address: '2408:80f1:21:c120::9e' }), true);
  assert.equal(publicAddress({ family: 4, address: '140.207.176.25' }), true);
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.2', '169.254.169.254', '198.18.0.1']) assert.equal(publicAddress({ family: 4, address }), false);
  for (const address of ['::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1']) assert.equal(publicAddress({ family: 6, address }), false);
});
test('changed default portions surface a warning on existing menu', () => {
  const s = prepared(); s.members[0].portion = .8;
  assert.ok(validateMeals(s, s.menus[week].meals).some(issue => issue.includes('饭量发生变化')));
});
