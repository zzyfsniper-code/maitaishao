import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initialState } from './seed.mjs';
export function createStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO app_state VALUES (1,0,?)').run(JSON.stringify(initialState()));
  return {
    load: () => JSON.parse(db.prepare('SELECT payload FROM app_state WHERE id=1').get().payload),
    save(state, expected = state.revision) {
      const next = { ...state, revision: expected + 1 };
      const result = db.prepare('UPDATE app_state SET revision=?, payload=? WHERE id=1 AND revision=?').run(next.revision, JSON.stringify(next), expected);
      if (!result.changes) throw Object.assign(new Error('数据已被另一项操作更新，请刷新后重试。'), { status: 409 });
      return next;
    }, close: () => db.close()
  };
}
