'use strict';

/* Supabase (Postgres) storage. `sql` is a postgres.js client. One record, many small tables, same shape as the local rehearsal. */
function postgresStore(sql) {
  const ops = (q, locking) => ({
    async hasSchool() {
      return (await q`select 1 from school where id = 1`).length > 0;
    },
    async load() {
      const rows = locking ? await q`select body from school where id = 1 for update` : await q`select body from school where id = 1`;
      if (!rows.length) return null;
      const b = rows[0].body;
      return typeof b === 'string' ? JSON.parse(b) : b;
    },
    async save(db) {
      const text = JSON.stringify(db);
      await q`insert into school (id, body) values (1, ${text}::jsonb) on conflict (id) do update set body = excluded.body, updated_at = now()`;
    },
    async getSession(hash, now) {
      const r = await q`select id from sessions where hash = ${hash} and expires > ${now}`;
      return r[0] || null;
    },
    async putSession(hash, id, expires) {
      await q`insert into sessions (hash, id, expires) values (${hash}, ${id}, ${expires}) on conflict (hash) do update set id = excluded.id, expires = excluded.expires`;
      const old = Date.now() - 86400000;
      await q`delete from sessions where expires < ${old}`;
      await q`delete from rate_hits where window_end < ${old}`;
    },
    async delSession(hash) {
      await q`delete from sessions where hash = ${hash}`;
    },
    async delSessionsOf(id) {
      await q`delete from sessions where id = ${id}`;
    },
    async getAuth(id) {
      const r = await q`select salt, digest from auth where id = ${id}`;
      return r[0] ? {
        salt: Buffer.from(r[0].salt),
        digest: Buffer.from(r[0].digest)
      } : null;
    },
    async putAuth(id, salt, digest) {
      await q`insert into auth (id, salt, digest) values (${id}, ${salt}, ${digest})`;
    },
    async delAuth(id) {
      await q`delete from auth where id = ${id}`;
    },
    async getFile(id) {
      const r = await q`select mime, data from files where id = ${id}`;
      return r[0] ? {
        mime: r[0].mime,
        data: Buffer.from(r[0].data)
      } : null;
    },
    async fileMeta(id) {
      const r = await q`select owner, name, mime, octet_length(data) as size from files where id = ${id}`;
      return r[0] ? {
        owner: r[0].owner,
        name: r[0].name,
        mime: r[0].mime,
        size: Number(r[0].size)
      } : null;
    },
    async putFile(id, owner, name, mime, data) {
      await q`insert into files (id, owner, name, mime, data) values (${id}, ${owner}, ${name}, ${mime}, ${data})`;
    },
    async seen(hash, stamp) {
      return (await q`select 1 from evidence_views where session_hash = ${hash} and stamp = ${stamp}`).length > 0;
    },
    async markSeen(hash, stamp) {
      await q`insert into evidence_views (session_hash, stamp) values (${hash}, ${stamp}) on conflict do nothing`;
    },
    async delSeen(hash) {
      await q`delete from evidence_views where session_hash = ${hash}`;
    },
    async hit(key, limit, ms) {
      const now = Date.now(),
        end = now + ms;
      const r = await q`insert into rate_hits (key, n, window_end) values (${key}, 1, ${end})
        on conflict (key) do update set
          n = case when rate_hits.window_end < ${now} then 1 else rate_hits.n + 1 end,
          window_end = case when rate_hits.window_end < ${now} then ${end} else rate_hits.window_end end
        returning n`;
      return Number(r[0].n) <= limit;
    }
  });
  const base = ops(sql, false);
  // Inside a transaction the school record is locked, so two phones changing it at once take turns.
  base.atomic = fn => sql.begin(async tx => {
    const o = ops(tx, true);
    o.atomic = f => f(o);
    return fn(o);
  });
  return base;
}
module.exports = {
  postgresStore
};
