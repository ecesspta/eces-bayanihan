'use strict';

/* Local rehearsal storage: one SQLite file, no outside services. */
const {
  DatabaseSync
} = require('node:sqlite');
function sqliteStore(file = ':memory:') {
  const sql = new DatabaseSync(file);
  sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS school(id INTEGER PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS auth(id TEXT PRIMARY KEY, salt BLOB NOT NULL, digest BLOB NOT NULL); CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, id TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL); CREATE TABLE IF NOT EXISTS evidence_views(session_hash TEXT NOT NULL,stamp TEXT NOT NULL,PRIMARY KEY(session_hash,stamp))');
  const rate = new Map();
  const ops = {
    async hasSchool() {
      return !!sql.prepare('SELECT id FROM school LIMIT 1').get();
    },
    async wipe() {
      sql.exec('DELETE FROM school; DELETE FROM auth; DELETE FROM sessions; DELETE FROM files; DELETE FROM evidence_views');
    },
    async load() {
      const r = sql.prepare('SELECT body FROM school WHERE id=1').get();
      return r ? JSON.parse(r.body) : null;
    },
    async save(db) {
      sql.prepare('INSERT OR REPLACE INTO school VALUES(1,?)').run(JSON.stringify(db));
    },
    async getSession(hash, now) {
      return sql.prepare('SELECT id FROM sessions WHERE hash=? AND expires>?').get(hash, now) || null;
    },
    async putSession(hash, id, expires) {
      sql.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?)').run(hash, id, expires);
    },
    async delSession(hash) {
      sql.prepare('DELETE FROM sessions WHERE hash=?').run(hash);
    },
    async delSessionsOf(id) {
      sql.prepare('DELETE FROM sessions WHERE id=?').run(id);
    },
    async getAuth(id) {
      return sql.prepare('SELECT salt,digest FROM auth WHERE id=?').get(id) || null;
    },
    async putAuth(id, salt, digest) {
      sql.prepare('INSERT INTO auth VALUES(?,?,?)').run(id, salt, digest);
    },
    async delAuth(id) {
      sql.prepare('DELETE FROM auth WHERE id=?').run(id);
    },
    async getFile(id) {
      return sql.prepare('SELECT mime,data FROM files WHERE id=?').get(id) || null;
    },
    async fileMeta(id) {
      return sql.prepare('SELECT owner,name,mime,length(data) AS size FROM files WHERE id=?').get(id) || null;
    },
    async putFile(id, owner, name, mime, data) {
      sql.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run(id, owner, name, mime, data);
    },
    async seen(hash, stamp) {
      return !!sql.prepare('SELECT 1 FROM evidence_views WHERE session_hash=? AND stamp=?').get(hash, stamp);
    },
    async markSeen(hash, stamp) {
      sql.prepare('INSERT OR IGNORE INTO evidence_views VALUES(?,?)').run(hash, stamp);
    },
    async delSeen(hash) {
      sql.prepare('DELETE FROM evidence_views WHERE session_hash=?').run(hash);
    },
    async hit(key, limit, ms) {
      const now = Date.now(),
        r = rate.get(key);
      if (!r || r.end < now) {
        rate.set(key, {
          n: 1,
          end: now + ms
        });
        return true;
      }
      return ++r.n <= limit;
    }
  };
  // One request at a time may change the record. node:sqlite is synchronous, so a queue keeps transactions from interleaving.
  let chain = Promise.resolve();
  ops.atomic = fn => {
    const run = chain.then(async () => {
      sql.exec('BEGIN IMMEDIATE');
      try {
        const r = await fn(ops);
        sql.exec('COMMIT');
        return r;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    });
    chain = run.catch(() => {});
    return run;
  };
  ops.close = () => sql.close();
  return ops;
}
module.exports = {
  sqliteStore
};
