import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initialState } from '../server/seed.mjs';
import { createStore } from '../server/store.mjs';
import { createKnowledgeClient } from '../server/knowledge-client.mjs';
import { makeKitchenUpdateProposal } from '../server/kitchen-updates.mjs';
import { kitchenTools } from '../server/kitchen-tools.mjs';

test('legacy recipes migrate once; real MCP supports versioned CRUD, stale rejection and atomic mixed proposals', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kitchen-mcp-test-')), file = path.join(dir, 'test.sqlite');
  const legacy = initialState(); legacy.members[0].likes.push('保留偏好'); legacy.recipes[0].source = '保留原始来源';
  const old = new DatabaseSync(file); old.exec('CREATE TABLE app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)'); old.prepare('INSERT INTO app_state VALUES (1,0,?)').run(JSON.stringify(legacy)); old.close();
  let store = createStore(file); const client = createKnowledgeClient(file);
  try {
    let listed = await client.call('knowledge_search_recipes', { query: '', status: 'all' });
    assert.equal(listed.recipes.length, 50); assert.equal(listed.recipes[0].id, legacy.recipes[0].id); assert.equal(listed.recipes[0].source, '保留原始来源');
    assert.deepEqual(store.load().members, legacy.members);
    const recipe = listed.recipes[0];
    let saved = await client.call('knowledge_save_recipe', { revision: listed.revision, id: recipe.id, knowledgeVersion: 1, recipe: { ...recipe, tags: [...recipe.tags, '测试知识标记'] }, confirm: true });
    assert.equal(saved.recipe.knowledgeVersion, 2); assert.equal(saved.recipe.status, 'confirmed');
    assert.equal((await client.call('knowledge_search_recipes', { query: '测试知识标记', status: 'confirmed' })).recipes[0].id, recipe.id);
    const found = await kitchenTools(store.load(), '2026-11-16', undefined, undefined, client).find(t => t.name === 'find_recipes').execute('', { query: '测试知识标记' });
    assert.equal(JSON.parse(found.content[0].text)[0].knowledgeVersion, 2);
    await assert.rejects(client.call('knowledge_save_recipe', { revision: saved.revision, id: recipe.id, knowledgeVersion: 1, recipe, confirm: true }), e => e.status === 409);
    await assert.rejects(client.call('knowledge_save_recipe', { revision: 0, id: recipe.id, knowledgeVersion: 2, recipe, confirm: true }), e => e.status === 409);
    const history = await client.call('knowledge_recipe_history', { id: recipe.id });
    assert.deepEqual(history.versions.map(r => r.knowledgeVersion), [2, 1]); assert.ok(!history.versions[1].tags.includes('测试知识标记'));
    const state = store.load();
    const proposal = makeKitchenUpdateProposal(state, '2026-11-16', [
      { target: 'recipe', id: recipe.id, field: 'tags', operation: 'add', valueJson: '["对话知识标记"]' },
      { target: 'member', id: 'child', field: 'allergies', operation: 'add', valueJson: '["虾"]' }
    ], '确认前不保存');
    const pending = store.save(state);
    assert.deepEqual(pending.members[2].allergies, []);
    await client.call('knowledge_confirm_proposal', { revision: pending.revision, id: proposal.id });
    const updated = store.load(); assert.deepEqual(updated.members[2].allergies, ['虾']); assert.equal(updated.recipes[0].knowledgeVersion, 3); assert.equal(updated.proposals.at(-1).status, 'confirmed');
    saved = await client.call('knowledge_save_recipe', { revision: updated.revision, id: '', knowledgeVersion: 0, recipe: { ...recipe, name: '新增知识测试菜' }, confirm: false });
    assert.equal(saved.recipe.status, 'draft'); assert.equal((await client.call('knowledge_search_recipes', { query: '新增知识测试菜', status: 'confirmed' })).recipes.length, 0);
    await client.call('knowledge_save_recipe', { revision: saved.revision, id: saved.recipe.id, knowledgeVersion: 1, recipe: saved.recipe, confirm: true });
    assert.equal((await client.call('knowledge_search_recipes', { query: '新增知识测试菜', status: 'confirmed' })).recipes.length, 1);
    const direct = await client.call('knowledge_apply_chat_update', { revision: store.load().revision, week: '2026-11-16', text: '给菜谱增加标签，宝宝增加忌口', run: { provider: 'test', toolCalls: [], durationMs: 0, ok: true }, changes: [
      { target: 'recipe', id: recipe.id, field: 'tags', operation: 'add', valueJson: '["直接执行"]' },
      { target: 'member', id: 'child', field: 'restrictions', operation: 'add', valueJson: '["花生"]' }
    ] });
    assert.equal(direct.proposal.automatic, true); assert.equal(direct.proposal.status, 'confirmed');
    assert.ok(store.load().recipes[0].tags.includes('直接执行')); assert.deepEqual(store.load().members[2].restrictions, ['花生']);
    assert.equal(store.load().messages.at(-1).text, direct.reply);
    const finalRecipes = store.load().recipes; store.close(); store = createStore(file);
    assert.deepEqual(store.load().recipes, finalRecipes); assert.deepEqual(store.load().members[0].likes, legacy.members[0].likes);
    const changed = store.load(); changed.recipes[0].name = '绕过 MCP 修改'; assert.throws(() => store.save(changed), /MCP/);
  } finally { await client.close(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});
