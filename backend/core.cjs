'use strict';

/* The school's rules and API, free of any web server or database.
   The local rehearsal (shared-server.cjs, SQLite) and the Supabase function (Postgres) both run this file.
   A "store" supplies the saving; everything about who may do what lives here. */
const {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual
} = require('node:crypto');
const E = require('../dist/workflows.js');
const sampleId = ['head', 'chair', 'vice', 'secretary', 'treasurer', 'collector', 'parent', 'parent-2', ...Array.from({
  length: 44
}, (_, i) => 'bod-' + (i + 1))];
const safeAccount = a => ({
  id: a.id,
  name: a.name,
  role: a.role,
  active: a.active,
  boardSeat: a.boardSeat,
  demo: a.demo,
  homeroom: a.homeroom,
  endedAt: a.endedAt,
  claimed: a.claimed,
  seatKey: a.seatKey
});
// A guest reads the public pages. Sending anything needs a signed-in account.
const guest = {
  id: '',
  role: 'parent',
  guest: true
};
const tokenHash = s => createHash('sha256').update(s).digest('hex');
function visible(db, me) {
  if (!me) me = guest;
  const lead = E.leaders.includes(me.role),
    board = E.boardRoles.includes(me.role),
    printer = E.printers.includes(me.role),
    secretary = E.holds(db, me, 'secretary'),
    finance = E.isChair(db, me) || me.role === 'treasurer' || me.role === 'vice' && db.batches.some(d => d.status === 'pending' && E.mayPost(db, me, d)),
    covers = E.covering(db, me),
    publisher = E.canAnnounce(db, me);
  const own = p => p.owner === me.id;
  const out = {
    version: 3,
    revision: db.revision,
    settings: db.settings,
    opening: db.opening,
    actingVice: E.hasDelegation(db),
    actingUntil: db.actingUntil,
    actingReference: lead ? db.actingReference : undefined,
    cover: db.cover && db.cover.until >= E.today() ? db.cover : null,
    legacy: null
  };
  const governance = board || me.role === 'head';
  const verifier = ['head', 'chair'].includes(me.role);
  out.accounts = (governance ? db.accounts.filter(x => x.active && (E.boardRoles.includes(x.role) || lead && x.role === 'head' || x.id === me.id || verifier && x.endedAt && !x.claimed)) : []).map(safeAccount);
  if (!me.guest && !out.accounts.some(x => x.id === me.id)) out.accounts.push({
    ...safeAccount(me),
    login: me.login
  });
  // A parent's note of their other children's grade and section is shown only to that parent.
  if (!me.guest && me.children) out.accounts = out.accounts.map(x => x.id === me.id ? {
    ...x,
    children: me.children
  } : x);
  out.requests = db.requests.filter(q => verifier || q.user === me.id).map(q => ({
    ...q,
    name: E.account(db, q.user)?.name
  }));
  // Device IDs stay in the database. No user receives them.
  out.proposals = db.proposals.filter(p => E.readableProposal(p, me)).map(p => lead ? {
    ...p,
    device: undefined
  } : own(p) ? {
    ...p,
    device: undefined,
    supporters: p.supporters.includes(me.id) ? [me.id] : []
  } : {
    id: p.id,
    title: p.publicTitle,
    details: p.publicText,
    publicTitle: p.publicTitle,
    publicText: p.publicText,
    published: true,
    status: p.status,
    supports: p.supports,
    supporters: p.supporters.includes(me.id) ? [me.id] : [],
    category: p.category,
    budget: p.budget,
    direct: p.direct,
    amends: p.amends,
    change: p.change,
    rev: p.rev,
    ballot: p.ballot,
    created: p.created
  });
  // Photos waiting for the chairperson's approval, or returned, are seen only by the School Head, chairperson and Vice-Chairperson.
  out.projects = db.projects.map(p => p.photos ? {
    ...p,
    photos: lead ? p.photos : p.photos.filter(x => (x.status || 'approved') === 'approved')
  } : p);
  out.ledger = db.ledger.map(({
    id,
    date,
    direction,
    purpose,
    cents,
    project,
    corrects,
    approver
  }) => ({
    id,
    date,
    direction,
    purpose,
    cents,
    project,
    corrects,
    approver
  }));
  // A hidden-name case reaches its reviewer without the sender's account or name. Only the database holds them.
  out.cases = db.cases.filter(c => E.canSeeCase(me, c) || covers && c.assigned === covers).map(c => ({
    ...c,
    device: undefined
  })).map(c => c.hidden && c.owner !== me.id ? {
    ...c,
    owner: '',
    sender: undefined,
    history: c.history.map(h => ({
      ...h
    }))
  } : c);
  out.trends = {};
  if (lead) for (const c of db.cases) out.trends[c.category] = (out.trends[c.category] || 0) + 1;
  out.announcements = db.announcements.filter(n => (n.audience === 'everyone' || me.role !== 'parent') && (publisher || !n.until || n.until >= E.today()));
  out.minutes = db.minutes.filter(m => m.state === 'filed' || printer).map(m => printer ? m : {
    id: m.id,
    title: m.title,
    date: m.date,
    state: m.state,
    summary: m.summary
  });
  out.batches = finance ? db.batches : me.role === 'collector' ? db.batches.filter(d => d.owner === me.id) : [];
  out.remittances = ['collector', 'treasurer'].includes(me.role) ? db.remittances : [];
  out.ballots = governance ? db.ballots.filter(b => b.roster.includes(me.id) || lead || secretary).map(b => {
    const x = {
      ...b,
      participated: b.participated.includes(me.id) ? [me.id] : [],
      turnout: b.participated.length
    };
    if (b.status === 'open') {
      delete x.counts;
      delete x.named;
    }
    return x;
  }) : [];
  out.resolutions = db.resolutions.filter(r => governance || r.published).map(r => {
    if (printer) return r;
    const summary = {
      id: r.id,
      proposal: r.proposal,
      project: r.project,
      version: r.version,
      title: r.title,
      state: r.state,
      published: r.published,
      approved: r.approved,
      parentSummary: r.parentSummary
    };
    if (!board) return summary;
    return {
      ...summary,
      clause: r.clause,
      text: r.text,
      meeting: r.meeting,
      date: r.date,
      budget: r.budget,
      tally: r.tally,
      direct: r.direct,
      officers: r.officers,
      category: r.category,
      fundraising: r.fundraising,
      ga: r.ga,
      requiredSigners: r.requiredSigners,
      signerPolicy: r.signerPolicy,
      signers: r.signers,
      signatures: r.signatures
    };
  });
  out.notes = db.notes.filter(n => n.owner === me.id);
  // The School Head, chairperson and Vice-Chairperson can trace every major change. Private case entries never leave the database.
  out.audit = lead ? db.audit.filter(x => !x.private && !/Private case|Hidden-name/.test(x.event)).slice(-400) : [];
  return out;
}

const SAMPLE_IDS = sampleId;
// One-time invite codes for real officers. Only a hash is stored.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => {
  const b = randomBytes(12);
  const c = Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join('');
  return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12);
};
const inviteHash = code => createHash('sha256').update('invite:' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
const enc = s => Buffer.from(s);
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const hex = n => randomBytes(n).toString('hex');

/* store: async methods (see backend/sqlite-store.cjs and backend/postgres-store.cjs).
   config: { originOk(req) -> bool, cookies: bool, secure: bool, adminKey: string, sampleSheet: () -> Buffer|null } */
function createApi(store, config = {}) {
  const cfg = {
    originOk: () => true,
    cookies: false,
    secure: false,
    adminKey: '',
    sampleSheet: () => null,
    ...config
  };
  const stay = a => a.role === 'parent' ? 24 * 30 : 8;
  const state = (db, me) => ({
    me: me?.id || '',
    db: visible(db, me)
  });

  async function addCredential(tx, id, pass) {
    const salt = randomBytes(16);
    await tx.putAuth(id, salt, scryptSync(pass, salt, 32));
  }

  /* Fictional starting data with sample sign-ins. Used by the local rehearsal and, once, by the Supabase set-up step. */
  async function seedSample() {
    return store.atomic(async tx => {
      if (await tx.hasSchool()) return null;
      await tx.save(E.create());
      const credentials = [];
      for (const id of sampleId) {
        const pass = randomBytes(12).toString('base64url');
        await addCredential(tx, id, pass);
        credentials.push([id, pass]);
      }
      return credentials;
    });
  }
  async function canReadFile(db, me, key, tx) {
    if (db.projects.some(p => (p.photos || []).some(x => x.file.key === key && (x.status || 'approved') === 'approved'))) return true;
    if (!me) return false;
    if (E.leaders.includes(me.role) && db.projects.some(p => (p.photos || []).some(x => x.file.key === key))) return true;
    const finance = E.isChair(db, me) || me.role === 'treasurer';
    const holds = d => d.file?.key === key || d.history.some(h => h.file?.key === key);
    return finance && db.batches.some(holds) || me.role === 'collector' && db.batches.some(d => d.owner === me.id && holds(d)) || E.printers.includes(me.role) && db.minutes.some(m => m.file.key === key);
  }
  const header = (req, n) => {
    const v = req.headers[n];
    return Array.isArray(v) ? v[0] : v || '';
  };
  const cookieOf = (req, name, re) => re.exec(header(req, 'cookie'))?.[1] || '';

  /* handle(req) -> { status, headers, cookies, body }
     req: { method, path, headers (lower-case names), ip, body: Buffer } */
  async function handle(req) {
    const out = {
      status: 200,
      headers: {},
      cookies: [],
      body: ''
    };
    let deviceCookie = '';
    const send = (status, obj) => {
      if (deviceCookie) out.cookies.push(deviceCookie);
      deviceCookie = '';
      out.status = status;
      out.headers['Content-Type'] = 'application/json; charset=utf-8';
      out.body = JSON.stringify(obj);
      return out;
    };
    try {
      const route = req.path;
      if (route === '/api/health') return send(200, {
        ok: true
      });
      // Sign-in token: a bearer header (the hosted app) or a cookie (the local rehearsal).
      const bearer = /^[a-f0-9]{64}$/.exec(header(req, 'x-eces-token'))?.[0] || /^Bearer ([a-f0-9]{64})$/.exec(header(req, 'authorization'))?.[1];
      const token = bearer || cookieOf(req, 'eces_session', /(?:^|; )eces_session=([a-f0-9]{64})(?:;|$)/);
      const tokenH = token ? tokenHash(token) : '';
      // A device is recognised by a long random id the app keeps (header) or a cookie.
      const deviceHdr = /^[a-f0-9]{32}$/.test(header(req, 'x-eces-device')) ? header(req, 'x-eces-device') : '';
      let device = deviceHdr || cookieOf(req, 'eces_device', /(?:^|; )eces_device=([a-f0-9]{32})(?:;|$)/);
      if (!device) {
        device = hex(16);
        if (cfg.cookies) deviceCookie = ('eces_device=' + device + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=63072000' + (cfg.secure ? '; Secure' : ''));
      }
      const limit = async () => {
        if (!(await store.hit('login:' + (req.ip || 'unknown'), 35, 60000))) throw new HttpError(429, 'Too many attempts. Try again in one minute.');
      };
      // Admin routes use a long secret key, never a sign-in.
      if (route.startsWith('/api/admin/')) {
        const given = header(req, 'x-admin-key');
        const ok = cfg.adminKey && given.length === cfg.adminKey.length && timingSafeEqual(enc(given), enc(cfg.adminKey));
        if (!ok) {
          await limit();
          throw new HttpError(403, 'Admin key required.');
        }
        if (route === '/api/admin/setup' && req.method === 'POST') {
          const credentials = await seedSample();
          if (!credentials) throw new HttpError(409, 'Already set up.');
          return send(201, {
            note: 'Fictional rehearsal data. Keep these sample sign-ins private.',
            credentials
          });
        }
        if (route === '/api/admin/start-live' && req.method === 'POST') {
          // Replaces the fictional rehearsal record with an empty school record and the real officers. Refused once real data exists.
          const v = JSON.parse((req.body || Buffer.alloc(0)).toString() || '{}');
          if (!Array.isArray(v.officers) || !v.officers.length || v.officers.length > 6) throw new HttpError(400, 'Send between one and six officers.');
          const codes = [];
          const officers = v.officers.map(o => {
            const code = newCode();
            codes.push([o.role, code]);
            return {
              role: o.role,
              name: o.name,
              invite: inviteHash(code)
            };
          });
          await store.atomic(async tx => {
            const cur = await tx.load();
            if (cur && cur.accounts.some(a => !a.demo)) throw new HttpError(409, 'Real data already exists. Nothing was changed.');
            const fresh = E.createLive(officers);
            await tx.wipe();
            await tx.save(fresh);
          });
          return send(201, {
            note: 'One-time invite codes. Give each officer their own code privately.',
            codes
          });
        }
        if (route === '/api/admin/officer' && req.method === 'POST') {
          // Adds an officer, or gives an existing officer a fresh code (a lost phone or forgotten sign-in).
          const v = JSON.parse((req.body || Buffer.alloc(0)).toString() || '{}');
          const code = newCode();
          await store.atomic(async tx => {
            const fresh = await tx.load();
            if (!fresh || fresh.accounts.every(a => a.demo)) throw new HttpError(409, 'Start the real record first.');
            let a = fresh.accounts.find(x => x.role === v.role && !x.demo);
            if (!a) {
              if (!E.liveRoles.includes(v.role)) throw new HttpError(400, 'Choose an officer role.');
              const next = E.createLive([{
                role: v.role,
                name: v.name,
                invite: inviteHash(code)
              }]).accounts[0];
              fresh.accounts.push(next);
            } else {
              a.invite = inviteHash(code);
              a.login = 'pending-' + a.role;
              await tx.delAuth(a.id);
              await tx.delSessionsOf(a.id);
            }
            await tx.save(fresh);
          });
          return send(201, {
            role: v.role,
            code
          });
        }
        if (route === '/api/admin/export' && req.method === 'GET') {
          return send(200, await store.load());
        }
        throw new HttpError(404, 'Unknown route.');
      }
      let db = await store.load();
      if (!db) throw new HttpError(503, 'The school record has not been set up yet.');
      // Record the result of any officer vote whose closing date has passed.
      if (E.expire(db)) {
        await store.atomic(async tx => {
          const fresh = await tx.load();
          if (E.expire(fresh)) await tx.save(fresh);
        });
        db = await store.load();
      }
      const session = tokenH ? await store.getSession(tokenH, Date.now()) : null;
      const a = session && E.account(db, session.id);
      const me = a?.active ? a : null;
      async function setLogin(tx, id, hours) {
        if (tokenH) {
          await tx.delSession(tokenH);
          await tx.delSeen(tokenH);
        }
        const t = hex(32);
        await tx.putSession(tokenHash(t), id, Date.now() + hours * 3600000);
        if (cfg.cookies) out.cookies.push('eces_session=' + t + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + hours * 3600 + (cfg.secure ? '; Secure' : ''));
        return t;
      }
      if (req.method === 'GET') {
        if (route === '/api/mode') return send(200, {
          mode: 'shared'
        });
        if (route === '/api/state') return send(200, state(db, me));
        const printMatch = /^\/api\/resolutions\/([A-Za-z0-9-]+)\/print$/.exec(route);
        if (printMatch) {
          if (!me || !E.printers.includes(me.role)) throw new HttpError(403, 'Official printing is restricted to the School Head, chairperson, Vice-Chairperson and secretary.');
          const record = db.resolutions.find(r => r.id === printMatch[1]);
          if (!record || record.state === 'draft') throw new HttpError(409, 'Release the reviewed version before printing.');
          return send(200, record);
        }
        if (route.startsWith('/api/files/')) {
          const key = decodeURIComponent(route.slice(11));
          if (!(await canReadFile(db, me, key))) throw new HttpError(403, 'Private attachment.');
          const f = key === 'sample-sheet' ? (cfg.sampleSheet() ? {
            mime: 'application/pdf',
            data: cfg.sampleSheet()
          } : null) : await store.getFile(key);
          if (!f) throw new HttpError(404, 'Attachment unavailable.');
          if (E.isChair(db, me) && tokenH) {
            for (const batch of db.batches.filter(d => d.file?.key === key && d.status === 'pending')) await store.markSeen(tokenH, E.openStamp(batch));
          }
          out.headers['Content-Security-Policy'] = "sandbox; default-src 'none'";
          out.headers['Content-Type'] = f.mime;
          out.body = Buffer.from(f.data);
          return out;
        }
        throw new HttpError(404, 'Unknown route.');
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
      if (!cfg.originOk(req)) throw new HttpError(403, 'Cross-site request denied.');
      const body = req.body || Buffer.alloc(0);
      if (route === '/api/files') {
        if (!me || !['secretary', 'treasurer', 'collector', ...E.leaders].includes(me.role)) throw new HttpError(403, 'This role cannot upload records.');
        if (body.length > 8 * 1024 * 1024) throw new HttpError(413, 'File or request too large.');
        const buf = body;
        const sig = h => buf.subarray(0, h.length / 2).equals(Buffer.from(h, 'hex'));
        const type = sig('255044462d') ? 'application/pdf' : sig('89504e470d0a1a0a') ? 'image/png' : sig('ffd8ff') ? 'image/jpeg' : sig('52494646') && buf.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : '';
        if (!type || header(req, 'content-type') !== type) throw new HttpError(400, 'Invalid document type or contents.');
        const f = E.photo({
          key: hex(20),
          name: decodeURIComponent(header(req, 'x-filename')),
          type,
          size: buf.length
        });
        await store.putFile(f.key, me.id, f.name, type, buf);
        return send(201, f);
      }
      if (!/^application\/json(?:;|$)/.test(header(req, 'content-type'))) throw new HttpError(415, 'JSON required.');
      if (body.length > 96000) throw new HttpError(413, 'File or request too large.');
      const v = JSON.parse(body.toString() || '{}');
      const passOk = p => typeof p === 'string' && p.length >= 10 && p.length <= 128;
      if (route === '/api/reset') {
        await limit();
        if (!passOk(v.password)) throw new HttpError(400, 'Use a password of 10–128 characters.');
        const id = E.resetCheck(db, v, device);
        const t = await store.atomic(async tx => {
          await tx.delAuth(id);
          await addCredential(tx, id, v.password);
          await tx.delSessionsOf(id);
          return setLogin(tx, id, stay(E.account(db, id)));
        });
        return send(200, {
          ...state(db, E.account(db, id)),
          token: t,
          device
        });
      }
      if (route === '/api/join') {
        await limit();
        if (!passOk(v.password)) throw new HttpError(400, 'Use a password of 10–128 characters.');
        const result = await store.atomic(async tx => {
          const fresh = await tx.load();
          const id = E.officerJoin(fresh, {
            invite: inviteHash(v.code),
            mobile: v.mobile,
            consent: v.consent
          }, device);
          await tx.save(fresh);
          await tx.delAuth(id);
          await addCredential(tx, id, v.password);
          const t = await setLogin(tx, id, 8);
          return {
            fresh,
            id,
            t
          };
        });
        return send(201, {
          ...state(result.fresh, E.account(result.fresh, result.id)),
          token: result.t,
          device
        });
      }
      if (route === '/api/login' || route === '/api/register') {
        await limit();
        if (!passOk(v.password)) throw new HttpError(400, 'Use a password of 10–128 characters.');
        if (route === '/api/register') {
          const result = await store.atomic(async tx => {
            const fresh = await tx.load();
            const x = E.transition(fresh, 'parent', 'register', v, '', {
              device
            });
            await tx.save(x.db);
            await addCredential(tx, x.id, v.password);
            const t = await setLogin(tx, x.id, stay(E.account(x.db, x.id)));
            return {
              x,
              t
            };
          });
          return send(201, {
            ...state(result.x.db, E.account(result.x.db, result.x.id)),
            token: result.t,
            device
          });
        }
        const u = db.accounts.find(x => x.active && x.login === E.loginKey(v.login));
        const record = u && await store.getAuth(u.id);
        const digest = scryptSync(v.password, record?.salt || Buffer.alloc(16), 32);
        if (!record || !timingSafeEqual(digest, Buffer.from(record.digest))) throw new HttpError(401, 'The mobile number or password is incorrect.');
        const t = await store.atomic(async tx => {
          const tok = await setLogin(tx, u.id, stay(u));
          const fresh = await tx.load();
          if (E.seenOn(fresh, u.id, device)) await tx.save(fresh);
          return tok;
        });
        return send(200, {
          ...state(db, u),
          token: t,
          device
        });
      }
      if (!me) throw new HttpError(401, 'Sign in to continue.');
      if (route === '/api/logout') {
        await store.delSeen(tokenH);
        await store.delSession(tokenH);
        if (cfg.cookies) out.cookies.push('eces_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
        return send(200, state(db, null));
      }
      if (route === '/api/action') {
        if (v.action === 'register') throw new HttpError(403, 'Use the registration form.');
        if (!v.payload || typeof v.payload !== 'object' || typeof v.requestId !== 'string' || v.requestId.length > 100 || !v.requestId.length) throw new HttpError(400, 'Invalid action.');
        const result = await store.atomic(async tx => {
          const fresh = await tx.load();
          const active = await tx.getSession(tokenH, Date.now());
          if (!active || active.id !== me.id) throw new HttpError(400, 'Sign in again to continue.');
          if (v.action === 'financeReview' && v.payload.decision === 'post') {
            const batch = fresh.batches.find(d => d.id === v.payload.id);
            if (batch?.status === 'pending' && !(await tx.seen(tokenH, E.openStamp(batch)))) throw new HttpError(400, 'Open the current supporting original with the chairperson’s own sign-in before posting.');
          }
          if (v.payload.file) {
            const f = await tx.fileMeta(v.payload.file.key);
            if (!f || f.owner !== me.id) throw new HttpError(400, 'Attach a document uploaded by this profile.');
            v.payload.file = E.photo({
              key: v.payload.file.key,
              name: f.name,
              type: f.mime,
              size: f.size
            });
          }
          const x = E.transition(fresh, me.id, v.action, v.payload, v.requestId, {
            device
          });
          if (!x.replay) await tx.save(x.db);
          return x;
        });
        return send(200, {
          ...state(result.db, E.account(result.db, me.id)),
          id: result.id
        });
      }
      throw new HttpError(404, 'Unknown operation.');
    } catch (err) {
      return send(err.status || 400, {
        error: err.message
      });
    }
  }
  return {
    handle,
    seedSample
  };
}
module.exports = {
  createApi,
  visible,
  tokenHash,
  SAMPLE_IDS
};
