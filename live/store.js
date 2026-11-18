/* Browser storage for the fictional rehearsal, or a scoped HTTP session in shared mode. */
(function (root) {
  'use strict';

  const E = root.ECES;
  let handle,
    current = null,
    actorId = '',
    shared = false;
  const key = globalThis.ECES_OFFICERS_ONLY === true ? 'eces-bayanihan-officers-v3' : 'eces-bayanihan-v3';
  const memoryFiles = new Map(),
    memoryPins = new Map();
  let notice;
  try {
    notice = new BroadcastChannel('eces-bayanihan-rehearsal-v3');
  } catch {
    notice = new EventTarget();
  }
  const broadcast = () => notice.postMessage?.(1);
  function rememberSample(id) {
    try {
      if (id) sessionStorage.setItem('eces-demo-actor', id);else sessionStorage.removeItem('eces-demo-actor');
    } catch {}
  }
  function savedSample() {
    try {
      return sessionStorage.getItem('eces-demo-actor');
    } catch {
      return null;
    }
  }
  // The app recognises a device by an ID it creates once and keeps in that browser.
  let deviceId = '';
  function device() {
    if (deviceId) return deviceId;
    try {
      deviceId = localStorage.getItem('eces-device') || '';
      if (!deviceId) localStorage.setItem('eces-device', deviceId = random());
    } catch {
      deviceId = random();
    }
    return deviceId;
  }
  // A parent who signed in stays signed in on this device until they sign out.
  function rememberAccount(id) {
    try {
      if (id) localStorage.setItem('eces-account', id);else localStorage.removeItem('eces-account');
    } catch {}
  }
  function savedAccount() {
    try {
      return localStorage.getItem('eces-account');
    } catch {
      return null;
    }
  }
  const random = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  function request(req) {
    return new Promise((ok, no) => {
      req.onsuccess = () => ok(req.result);
      req.onerror = () => no(req.error);
    });
  }
  function done(tx) {
    return new Promise((ok, no) => {
      tx.oncomplete = ok;
      tx.onerror = () => no(tx.error);
      tx.onabort = () => no(tx.error || Error('Changes could not be saved.'));
    });
  }
  // Hosted mode: the page names the server (and its public key) in two meta tags, and the sign-in token lives on this phone.
  const tag = n => document.querySelector('meta[name="' + n + '"]')?.content || '';
  let apiBase = '';
  const keep = {
    get(k) {
      try {
        return localStorage.getItem(k) || '';
      } catch (_) {
        return '';
      }
    },
    set(k, v) {
      try {
        v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
      } catch (_) {}
    }
  };
  function liveDevice() {
    let d = keep.get('eces-live-device');
    if (!/^[a-f0-9]{32}$/.test(d)) {
      d = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      keep.set('eces-live-device', d);
    }
    return d;
  }
  function liveHeaders(extra = {}) {
    if (!apiBase) return extra;
    const h = {
      ...extra,
      'x-eces-device': liveDevice()
    };
    const key = tag('eces-key');
    if (key) {
      h.apikey = key;
      h.Authorization = 'Bearer ' + key;
    }
    const t = keep.get('eces-live-token');
    if (t) h['x-eces-token'] = t;
    return h;
  }
  const endpoint = p => (apiBase || '') + '/api/' + p;
  // Network trouble is explained in plain words, never as "Failed to fetch" or a stray JSON error.
  const WAIT = 30000, WAIT_FILE = 120000;
  let down = false,
    translateOff = false;
  function trouble(kind, status) {
    const e = Error(kind === 'offline' ? 'You are offline. Check your phone’s internet connection, then try again.' : kind === 'slow' ? 'The connection is too slow and the request timed out. Try again when your signal is better.' : kind === 'server' ? 'The SPTA server had a problem. Please try again in a few minutes.' : kind === 'reply' ? 'The server sent a reply the app could not read. Please try again in a few minutes.' : 'The app could not reach the SPTA server. Check your internet connection, then try again.');
    e.network = kind;
    e.status = status || 0;
    return e;
  }
  async function reach(url, options, wait = WAIT) {
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = control ? setTimeout(() => control.abort(), wait) : 0;
    try {
      const r = await fetch(url, control ? { ...options, signal: control.signal } : options);
      down = false;
      return r;
    } catch (e) {
      down = true;
      throw trouble(e && e.name === 'AbortError' ? 'slow' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
  async function reply(response, fallback) {
    let data = null;
    try {
      data = await response.json();
    } catch (_) {}
    if (response.ok && data) return data;
    if (data && data.error) throw Error(data.error);
    if (response.status >= 500) throw trouble('server', response.status);
    if (response.status === 404 || response.status === 405) throw Error('The app could not find its server. Please tell an SPTA officer.');
    if (response.status === 429) throw Error('Too many tries. Please wait a minute, then try again.');
    throw response.ok ? trouble('reply', response.status) : Error(fallback || 'The request could not be completed. Please try again.');
  }
  // Reading and saving an action are safe to repeat once: the server remembers the request number, so nothing is saved twice.
  async function api(path, body, again = false) {
    const go = () => reach(endpoint(path), {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      credentials: apiBase ? 'omit' : 'same-origin',
      headers: liveHeaders(body ? {
        'Content-Type': 'application/json'
      } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    let response;
    try {
      response = await go();
    } catch (e) {
      if (!again || e.network === 'offline') throw e;
      await new Promise(r => setTimeout(r, 1500));
      response = await go();
    }
    if (again && response.status >= 502 && response.status <= 504) {
      await new Promise(r => setTimeout(r, 1500));
      response = await go();
    }
    return reply(response);
  }
  function session(v) {
    if (apiBase && v.token) keep.set('eces-live-token', v.token);
    current = v.db;
    actorId = v.me || '';
    return current;
  }
  async function init() {
    apiBase = tag('eces-api').replace(/\/$/, '');
    shared = tag('eces-mode') === 'shared' || !!apiBase;
    if (shared) {
      await refresh();
      return;
    }
    try {
      const req = indexedDB.open(key, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('state');
        req.result.createObjectStore('files');
        req.result.createObjectStore('pins');
      };
      handle = await request(req);
    } catch {
      current = E.create();
      return;
    }
    const tx = handle.transaction('state', 'readwrite'),
      finished = done(tx),
      store = tx.objectStore('state');
    current = await request(store.get('school'));
    if (!current) {
      let old = null;
      try {
        old = JSON.parse(localStorage.getItem('schoolhub_bayanihan_demo_v1'));
      } catch (_) {}
      current = E.create(old);
      store.put(current, 'school');
    }
    await finished;
    const sample = savedSample();
    if (sample && E.account(current, sample)?.active && E.account(current, sample)?.demo) actorId = sample;else {
      const kept = savedAccount(),
        a = kept && E.account(current, kept);
      if (a?.active && !a.demo && a.devices?.includes(device())) actorId = kept;
    }
  }
  // Records the result of any officer vote whose closing date has passed.
  async function sweep() {
    if (shared || !current) return;
    const copy = JSON.parse(JSON.stringify(current));
    if (!E.expire(copy)) return;
    if (!handle) {
      current = copy;
      return;
    }
    const tx = handle.transaction('state', 'readwrite'),
      finished = done(tx),
      store = tx.objectStore('state');
    const base = await request(store.get('school'));
    if (E.expire(base)) store.put(base, 'school');
    await finished;
    current = base;
  }
  async function refresh() {
    if (shared) return session(await api('state', undefined, true));
    if (handle) current = await request(handle.transaction('state').objectStore('state').get('school'));
    await sweep().catch(() => {});
    if (!E.account(current, actorId)?.active) actorId = '';
    return current;
  }
  async function run(action, payload, requestId = random()) {
    if (shared) {
      const res = await api('action', {
        action,
        payload,
        requestId
      }, true);
      session(res);
      return res.id;
    }
    if (!handle) {
      const result = E.transition(current, actorId, action, payload, requestId, {
        device: device(),
        practice: true
      });
      current = result.db;
      return result.id;
    }
    const tx = handle.transaction('state', 'readwrite'),
      finished = done(tx),
      store = tx.objectStore('state');
    try {
      const base = await request(store.get('school'));
      const res = E.transition(base, actorId, action, payload, requestId, {
        device: device(),
        practice: true
      });
      store.put(res.db, 'school');
      await finished;
      current = res.db;
      broadcast();
      return res.id;
    } catch (e) {
      try {
        tx.abort();
      } catch (_) {}
      await finished.catch(() => {});
      throw e;
    }
  }
  async function digest(pass, salt) {
    if (!crypto.subtle) throw Error('Open the downloaded demo in Chrome or Edge, or use localhost, to create a practice password.');
    const enc = new TextEncoder();
    const raw = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 180000,
      hash: 'SHA-256'
    }, raw, 256);
    return Array.from(new Uint8Array(hash)).join('.');
  }
  function password(p) {
    if (typeof p !== 'string' || p.length < 10 || p.length > 128) throw Error('Use a practice password of 10–128 characters.');
  }
  async function register(v) {
    password(v.password);
    if (shared) {
      session(await api('register', v));
      return;
    }
    const salt = random(),
      hash = await digest(v.password, salt);
    if (!handle) {
      const result = E.transition(current, 'parent', 'register', v, '', {
        device: device()
      });
      memoryPins.set(result.id, {
        salt,
        hash
      });
      current = result.db;
      actorId = result.id;
      rememberSample();
      rememberAccount(actorId);
      return;
    }
    const tx = handle.transaction(['state', 'pins'], 'readwrite'),
      finished = done(tx);
    try {
      const store = tx.objectStore('state');
      const base = await request(store.get('school'));
      const res = E.transition(base, 'parent', 'register', v, '', {
        device: device()
      });
      store.put(res.db, 'school');
      tx.objectStore('pins').put({
        salt,
        hash
      }, res.id);
      await finished;
      current = res.db;
      actorId = res.id;
      rememberSample();
      rememberAccount(actorId);
      broadcast();
    } catch (e) {
      try {
        tx.abort();
      } catch (_) {}
      await finished.catch(() => {});
      throw e;
    }
  }
  // An officer's first sign-in: the one-time invite code the chairperson gave them, their own mobile number and password.
  async function join(v) {
    password(v.password);
    if (!shared) throw Error('Officer invite codes work only on the school’s live app.');
    session(await api('join', v));
  }
  async function login(v) {
    if (shared) {
      session(await api('login', v));
      return;
    }
    await refresh();
    const a = current.accounts.find(x => !x.demo && x.active && x.login === E.loginKey(v.login));
    const record = a && (handle ? await request(handle.transaction('pins').objectStore('pins').get(a.id)) : memoryPins.get(a.id));
    if (!record || (await digest(v.password, record.salt)) !== record.hash) throw Error('The mobile number or password is incorrect.');
    actorId = a.id;
    rememberSample();
    rememberAccount(a.id);
    // Note this device against the account.
    if (!handle) E.seenOn(current, a.id, device());else {
      const tx = handle.transaction('state', 'readwrite'),
        finished = done(tx),
        store = tx.objectStore('state');
      const base = await request(store.get('school'));
      if (E.seenOn(base, a.id, device())) store.put(base, 'school');
      await finished;
      current = base;
    }
  }
  // Forgotten password. Without text messages, the app accepts a new password only on a phone
  // that account has signed in on before, after the last name and grade and section are matched.
  async function resetPassword(v) {
    password(v.password);
    if (shared) {
      session(await api('reset', v));
      return;
    }
    await refresh();
    const id = E.resetCheck(current, v, device());
    const salt = random(),
      record = {
        salt,
        hash: await digest(v.password, salt)
      };
    if (handle) {
      const tx = handle.transaction('pins', 'readwrite'),
        finished = done(tx);
      tx.objectStore('pins').put(record, id);
      await finished;
    } else memoryPins.set(id, record);
    actorId = id;
    rememberSample();
    rememberAccount(id);
  }
  // The accounts that have signed in on this phone, so two parents sharing it can switch.
  function known() {
    if (shared || !current) return [];
    return current.accounts.filter(a => !a.demo && a.active && a.devices?.includes(device())).map(a => ({
      id: a.id,
      name: a.name,
      login: a.login
    }));
  }
  // One practice profile per role. The other fictional presidents stay on the board roster.
  const practiceProfiles = ['parent', 'bod-1', 'head', 'chair', 'vice', 'secretary', 'treasurer', 'collector'].filter(x => globalThis.ECES_OFFICERS_ONLY !== true || !['head', 'chair', 'vice'].includes(x));
  // Practice only: each remaining fictional attendee casts a ballot through the ordinary vote rule.
  async function practiceBallots(id) {
    if (shared) throw Error('Practice ballots are unavailable in the shared rehearsal.');
    const fill = base => {
      if (!E.isChair(base, E.account(base, actorId))) throw Error('The chairperson adds practice ballots.');
      const b = base.ballots.find(x => x.id === id && x.status === 'open');
      if (!b) throw Error('This ballot is closed.');
      let db = base;
      b.present.filter(m => !b.participated.includes(m) && !practiceProfiles.includes(m) && E.account(base, m)?.demo).forEach((m, i) => {
        if (db.ballots.find(x => x.id === id).status !== 'open') return;
        db = E.transition(db, m, 'vote', {
          id,
          vote: i % 6 === 4 ? 'no' : i % 9 === 7 ? 'abstain' : 'yes'
        }).db;
      });
      return db;
    };
    if (!handle) {
      current = fill(current);
      return;
    }
    const tx = handle.transaction('state', 'readwrite'),
      finished = done(tx),
      store = tx.objectStore('state');
    try {
      const next = fill(await request(store.get('school')));
      store.put(next, 'school');
      await finished;
      current = next;
      broadcast();
    } catch (e) {
      try {
        tx.abort();
      } catch (_) {}
      await finished.catch(() => {});
      throw e;
    }
  }
  // Live only: the chairperson or the School Head makes a one-time password code for a parent they checked in person.
  async function recoveryCode(mobile) {
    if (!shared) throw Error('This works in the live app only.');
    return await api('recovery-code', {
      mobile
    });
  }
  // Live only: end this account's sign-in on every phone.
  async function logoutAll() {
    if (!shared) throw Error('This works in the live app only.');
    try {
      session(await api('logout-all', {}));
    } finally {
      if (apiBase) keep.set('eces-live-token', '');
    }
  }
  async function logout() {
    if (shared) {
      try {
        session(await api('logout', {}));
      } finally {
        if (apiBase) keep.set('eces-live-token', '');
      }
      return;
    }
    actorId = '';
    rememberSample();
    rememberAccount();
  }
  function sample(id) {
    if (shared || !E.account(current, id)?.demo || !E.account(current, id)?.active) throw Error('Choose an available sample profile.');
    actorId = id;
    rememberSample(id);
  }
  async function fileMeta(f) {
    if (!f || !f.size) throw Error('Choose a supporting image or PDF.');
    const meta = E.photo({
      key: random(),
      name: f.name,
      type: f.type,
      size: f.size
    });
    const s = new Uint8Array(await f.slice(0, 12).arrayBuffer());
    const starts = bytes => bytes.every((b, i) => s[i] === b);
    const valid = meta.type === 'image/jpeg' ? starts([255, 216, 255]) : meta.type === 'image/png' ? starts([137, 80, 78, 71, 13, 10, 26, 10]) : meta.type === 'application/pdf' ? starts([37, 80, 68, 70, 45]) : starts([82, 73, 70, 70]) && String.fromCharCode(...s.slice(8, 12)) === 'WEBP';
    if (!valid) throw Error('The file contents do not match its type.');
    if (shared) {
      const res = await reach(endpoint('files'), {
        method: 'POST',
        credentials: apiBase ? 'omit' : 'same-origin',
        headers: liveHeaders({
          'Content-Type': meta.type,
          'X-Filename': encodeURIComponent(meta.name)
        }),
        body: f
      }, WAIT_FILE);
      return reply(res, 'The file could not be uploaded. Please try again.');
    }
    if (!handle) {
      memoryFiles.set(meta.key, f);
      return meta;
    }
    const tx = handle.transaction('files', 'readwrite'),
      finished = done(tx);
    tx.objectStore('files').put(f, meta.key);
    await finished;
    return meta;
  }
  // A profile picture, already cropped and shrunk to a small JPEG. Only the owner can read it back.
  async function setAvatar(blob) {
    if (!shared) throw Error('Profile pictures are available in the live app.');
    const res = await reach(endpoint('avatar'), {
      method: 'POST',
      credentials: apiBase ? 'omit' : 'same-origin',
      headers: liveHeaders({
        'Content-Type': blob.type
      }),
      body: blob
    }, WAIT_FILE);
    const data = await reply(res, 'The picture could not be saved. Please try again.');
    await refresh();
    return data;
  }
  async function removeAvatar() {
    const res = await reach(endpoint('avatar-remove'), {
      method: 'POST',
      credentials: apiBase ? 'omit' : 'same-origin',
      headers: liveHeaders({}),
      body: ''
    });
    const data = await reply(res, 'The picture could not be removed. Please try again.');
    await refresh();
    return data;
  }
  // keep: a public project photo may be remembered by the phone, because each photo has its own one-time key.
  async function fileURL(meta, keep = false) {
    if (shared) {
      const r = await reach(endpoint('files/' + encodeURIComponent(meta.key)), {
        cache: keep ? 'default' : 'no-store',
        credentials: apiBase ? 'omit' : 'same-origin',
        headers: liveHeaders()
      }, WAIT_FILE);
      if (!r.ok) throw r.status >= 500 ? trouble('server', r.status) : Error('Access to this attachment is unavailable.');
      return URL.createObjectURL(await r.blob());
    }
    // Practice version: the fictional pictures on the sample projects are carried inside the page.
    if (/^sample-photo-\d+$/.test(meta.key) && globalThis.ECESSamplePhotos?.[meta.key]) return globalThis.ECESSamplePhotos[meta.key];
    if (meta.key === 'sample-sheet') {
      const sample = document.getElementById('embedded-school-example');
      if (!sample) return 'assets/sample-collection-sheet.pdf';
      const bytes = Uint8Array.from(atob(sample.textContent.trim()), c => c.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], {
        type: 'application/pdf'
      }));
    }
    const f = handle ? await request(handle.transaction('files').objectStore('files').get(meta.key)) : memoryFiles.get(meta.key);
    if (!f) throw Error('The original file is unavailable. Return the record for correction.');
    return URL.createObjectURL(f);
  }
  async function printRecord(id) {
    if (shared) return api('resolutions/' + encodeURIComponent(id) + '/print');
    const record = current.resolutions.find(r => r.id === id && r.state !== 'draft');
    if (!record || !E.printers.includes(E.account(current, actorId)?.role)) throw Error('Printing this version is restricted.');
    return record;
  }
  async function reset() {
    if (shared) throw Error('Demo reset is unavailable in shared mode.');
    if (!handle) {
      memoryFiles.clear();
      memoryPins.clear();
      current = E.create();
      actorId = '';
      rememberSample();
      return;
    }
    const tx = handle.transaction(['state', 'pins', 'files'], 'readwrite'),
      finished = done(tx);
    const db = E.create();
    tx.objectStore('state').put(db, 'school');
    tx.objectStore('pins').clear();
    tx.objectStore('files').clear();
    await finished;
    current = db;
    actorId = '';
    rememberSample();
    broadcast();
  }
  root.ECESStore = {
    init,
    refresh,
    run,
    register,
    join,
    login,
    logout,
    logoutAll,
    recoveryCode,
    resetPassword,
    known,
    sample,
    practiceProfiles,
    practiceBallots,
    fileMeta,
    fileURL,
    setAvatar,
    removeAvatar,
    printRecord,
    reset,
    random,
    notice,
    get sessionOnly() {
      return !shared && !handle;
    },
    get db() {
      return current;
    },
    get me() {
      return actorId;
    },
    get device() {
      return device();
    },
    get unreachable() {
      return down;
    },
    // Filipino for text that officers typed. Returns the translations, undefined when nobody is signed in yet,
    // or null when the server cannot translate (not turned on, limit reached, or no connection).
    async translateTexts(texts) {
      if (!shared || translateOff) return null;
      if (!actorId) return undefined;
      try {
        const r = await api('translate', {
          texts
        });
        return Array.isArray(r.translations) ? r.translations : null;
      } catch (e) {
        if (/not turned on/i.test(String(e && e.message))) translateOff = true;
        return null;
      }
    },
    get shared() {
      return shared;
    }
  };
})(globalThis);
