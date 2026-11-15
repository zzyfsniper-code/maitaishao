import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initialState } from './seed.mjs';
export function createStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)');
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS recipe_knowledge (id TEXT PRIMARY KEY, version INTEGER NOT NULL, updated_at TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recipe_knowledge_history (id TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id, version)); CREATE TABLE IF NOT EXISTS knowledge_migration (id INTEGER PRIMARY KEY, original_payload TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO app_state VALUES (1,0,?)').run(JSON.stringify(initialState()));
  const unpack = row => ({ ...JSON.parse(row.payload), knowledgeVersion: row.version, knowledgeUpdatedAt: row.updated_at });
  const content = ({ knowledgeVersion, knowledgeUpdatedAt, ...recipe }) => JSON.stringify(recipe);
  const writeRecipe = (recipe, version) => {
    const updated = new Date().toISOString(), payload = content(recipe);
    db.prepare('INSERT INTO recipe_knowledge VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, updated_at=excluded.updated_at, payload=excluded.payload').run(recipe.id, version, updated, payload);
    db.prepare('INSERT INTO recipe_knowledge_history VALUES (?,?,?,?)').run(recipe.id, version, updated, payload);
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT id FROM knowledge_migration WHERE id=1').get()) {
      const original = db.prepare('SELECT payload FROM app_state WHERE id=1').get().payload;
      for (const recipe of JSON.parse(original).recipes) writeRecipe(recipe, 1);
      db.prepare('INSERT INTO knowledge_migration VALUES (1,?)').run(original);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const recipes = () => db.prepare('SELECT * FROM recipe_knowledge ORDER BY rowid').all().map(unpack);
  return {
    load: () => ({ ...JSON.parse(db.prepare('SELECT payload FROM app_state WHERE id=1').get().payload), recipes: recipes() }),
    recipeHistory: id => db.prepare('SELECT * FROM recipe_knowledge_history WHERE id=? ORDER BY version DESC').all(id).map(unpack),
    save(state, expected = state.revision, { recipeWrites = false } = {}) {
      const next = { ...state, revision: expected + 1 };
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT revision FROM app_state WHERE id=1').get().revision !== expected) throw Object.assign(new Error('数据已被另一项操作更新，请刷新后重试。'), { status: 409 });
        const current = recipes(), changed = state.recipes.filter(r => { const old = current.find(x => x.id === r.id); return !old || content(old) !== content(r); });
        if (current.some(r => !state.recipes.some(x => x.id === r.id))) throw new Error('不能删除被菜单引用的菜谱知识。');
        if (changed.length && !recipeWrites) throw new Error('菜谱修改请通过知识库 MCP 提交。');
        for (const recipe of changed) writeRecipe(recipe, (current.find(r => r.id === recipe.id)?.knowledgeVersion || 0) + 1);
        const { recipes: unusedRecipes, ...payload } = next;
        db.prepare('UPDATE app_state SET revision=?, payload=? WHERE id=1').run(next.revision, JSON.stringify(payload));
        db.exec('COMMIT');
        return { ...next, recipes: recipes() };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close: () => db.close()
  };
}
