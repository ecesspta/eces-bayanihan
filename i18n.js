'use strict';
// Language switch. The app is written in English. When Filipino is chosen, text on the screen is
// translated after it is drawn, using the word list in fil.js. Anything without a translation stays in English,
// which includes text that people typed themselves (names, proposal titles, minutes).
(function (root) {
  const KEY = 'eces-language';
  let lang = 'en', onChange = () => {}, observer = null;
  try {
    lang = root.localStorage && root.localStorage.getItem(KEY) === 'fil' ? 'fil' : 'en';
  } catch (e) {}
  const misses = new Set();
  const months = {
    Jan: 'Ene',
    Feb: 'Peb',
    Mar: 'Mar',
    Apr: 'Abr',
    May: 'May',
    Jun: 'Hun',
    Jul: 'Hul',
    Aug: 'Ago',
    Sep: 'Set',
    Oct: 'Okt',
    Nov: 'Nob',
    Dec: 'Dis'
  };
  const monthName = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.? (\d{1,2}), (\d{4})/g;
  const words = () => root.ECESFil || {
    exact: {},
    rules: []
  };
  const fixDates = text => text.replace(monthName, (_, m, d, y) => months[m] + ' ' + d + ', ' + y);
  const hasWords = text => /[A-Za-z]{3,}/.test(text);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  let lower = null, patterns = null;
  const prepared = () => {
    const w = words();
    if (!lower) {
      lower = {};
      for (const k of Object.keys(w.exact)) lower[k.toLowerCase()] = w.exact[k];
      patterns = w.rules.map(([re, make]) => [new RegExp(re.source, 'i'), make]);
    }
  };
  // "Sign In to Send" is written in title case, so its translation is too.
  const small = ['ng', 'sa', 'at', 'ang', 'mga', 'na', 'ay', 'para', 'o', 'ni', 'kay', 'mula', 'hanggang', 'pa', 'ba', 'nang', 'sina', 'si'];
  const titleCase = text => {
    const w = text.split(/\s+/).filter(x => /[A-Za-z]/.test(x) && x.length > 3);
    return w.length > 1 && w.every(x => /^[A-Z“"(]/.test(x));
  };
  const toTitle = text => text.replace(/(^|\s)([a-zà-ÿ])([^\s]*)/g, (m, sp, c, rest) => small.includes((c + rest).toLowerCase().replace(/[^a-zà-ÿ]/g, '')) && sp ? m : sp + c.toUpperCase() + rest);
  const fit = (source, out) => titleCase(source) ? toTitle(out) : out;
  // A line the word list keeps as it is (a brand name, "Password") is not counted as missing.
  const known = core => {
    prepared();
    return own(lower, core.toLowerCase());
  };
  // Exact text first, then patterns, then sentence by sentence, then piece by piece around " · ".
  function lookup(core, depth = 0) {
    const w = words();
    prepared();
    if (own(w.exact, core)) return w.exact[core];
    const low = core.toLowerCase();
    if (own(lower, low)) return fit(core, lower[low]);
    for (const [pattern, make] of patterns) {
      const m = core.match(pattern);
      if (m) {
        const out = typeof make === 'function' ? make(...m.slice(1).map(x => x === undefined ? x : lookup(x, depth + 1))) : make.replace(/\{(\d)\}/g, (_, i) => m[i] === undefined ? '' : lookup(m[i], depth + 1));
        return fit(core, out);
      }
    }
    if (depth > 4) return core;
    const pieces = core.split(' · ');
    if (pieces.length > 1) return pieces.map(x => lookup(x, depth + 1)).join(' · ');
    const sentences = core.split(/(?<=[.!?])\s+(?=[A-Z“"‘(])/);
    if (sentences.length > 1) return sentences.map(x => lookup(x, depth + 1)).join(' ');
    return core;
  }
  function translate(text) {
    const lead = text.match(/^\s*/)[0],
      trail = text.match(/\s*$/)[0],
      core = text.trim().replace(/\s+/g, ' ');
    if (!core || !hasWords(core)) return text;
    const out = fixDates(lookup(core));
    if (out === core && !known(core)) misses.add(core);
    return out === core ? text : lead + out + trail;
  }
  const skip = el => el && el.closest && el.closest('script,style,textarea,[data-keep-language],.print-only'),
    skipTag = el => el && el.closest && el.closest('script,style,[data-keep-language],.print-only');
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  // Text that officers typed for the community (marked class="ut") is translated by the server when it is available.
  // Private suggestions and concerns, names and contact details are never marked, so they are never sent.
  const UT_KEY = 'eces-ut-fil',
    UT_LIMIT = 300;
  let utCache = {},
    utRemote = null,
    utTimer = 0,
    utOffUntil = 0;
  try {
    utCache = JSON.parse(root.localStorage.getItem(UT_KEY) || '{}') || {};
  } catch (e) {}
  const utDone = new Set(),
    utWait = new Map();
  const inUser = el => el && el.closest && el.closest('.ut');
  const squeeze = v => v.trim().replace(/\s+/g, ' ');
  function utApply(n, hit) {
    const v = n.nodeValue;
    utDone.add(hit);
    n.nodeValue = v.match(/^\s*/)[0] + hit + v.match(/\s*$/)[0];
  }
  function utSave() {
    const keys = Object.keys(utCache);
    for (const k of keys.slice(0, Math.max(0, keys.length - UT_LIMIT))) delete utCache[k];
    try {
      root.localStorage.setItem(UT_KEY, JSON.stringify(utCache));
    } catch (e) {}
  }
  function userText(n) {
    const core = squeeze(n.nodeValue);
    if (!core || !hasWords(core) || utDone.has(core)) return;
    const hit = utCache[core];
    if (hit) return utApply(n, hit);
    if (!utRemote || Date.now() < utOffUntil) return;
    let nodes = utWait.get(core);
    if (!nodes) utWait.set(core, nodes = new Set());
    nodes.add(n);
    if (!utTimer) utTimer = setTimeout(utFlush, 250);
  }
  async function utFlush() {
    utTimer = 0;
    const batch = [...utWait.keys()].slice(0, 20);
    if (!batch.length) return;
    const nodes = new Map(batch.map(k => [k, utWait.get(k)]));
    batch.forEach(k => utWait.delete(k));
    let res = null;
    try {
      res = await utRemote(batch);
    } catch (e) {
      res = null;
    }
    // undefined means "not signed in yet": try again after the next screen is drawn, without waiting.
    if (res !== undefined && (!Array.isArray(res) || res.length !== batch.length)) {
      utOffUntil = Date.now() + 5 * 60 * 1000;
      utWait.clear();
      return;
    }
    if (Array.isArray(res)) {
      batch.forEach((k, i) => {
        const t = res[i];
        if (typeof t !== 'string' || !t.trim()) return;
        delete utCache[k];
        utCache[k] = t.trim();
        nodes.get(k).forEach(n => {
          if (lang === 'fil' && n.isConnected && squeeze(n.nodeValue) === k) utApply(n, t.trim());
        });
      });
      utSave();
      if (observer) observer.takeRecords();
    }
    if (utWait.size) utTimer = setTimeout(utFlush, 50);
  }
  function node(n) {
    if (n.nodeType === 3) {
      if (!skip(n.parentNode)) {
        const out = translate(n.nodeValue);
        if (out !== n.nodeValue) n.nodeValue = out;else if (inUser(n.parentNode)) userText(n);
      }
    } else if (n.nodeType === 1) {
      if (skipTag(n)) return;
      for (const a of ATTRS) if (n.hasAttribute(a)) {
        const v = n.getAttribute(a),
          out = translate(v);
        if (out !== v) n.setAttribute(a, out);
      }
      if (n.tagName !== 'TEXTAREA') for (let c = n.firstChild; c; c = c.nextSibling) node(c);
    }
  }
  function apply(scope) {
    if (lang !== 'fil' || !root.document) return;
    node(scope || root.document.body);
    if (root.document.title) root.document.title = translate(root.document.title);
    if (observer) observer.takeRecords();
  }
  function watch() {
    if (observer || !root.MutationObserver || !root.document || !root.document.body) return;
    observer = new root.MutationObserver(records => {
      if (lang !== 'fil') return;
      for (const r of records) {
        if (r.type === 'characterData') node(r.target);
        else if (r.type === 'attributes') node(r.target);
        else r.addedNodes.forEach(node);
      }
      observer.takeRecords();
    });
    observer.observe(root.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }
  function set(next) {
    lang = next === 'fil' ? 'fil' : 'en';
    try {
      root.localStorage.setItem(KEY, lang);
    } catch (e) {}
    if (root.document && root.document.documentElement) root.document.documentElement.lang = lang === 'fil' ? 'fil' : 'en';
    onChange();
    apply();
  }
  root.ECESLang = {
    get lang() {
      return lang;
    },
    set,
    toggle: () => set(lang === 'fil' ? 'en' : 'fil'),
    t: text => lang === 'fil' ? translate(text) : text,
    apply,
    setRemote: fn => {
      utRemote = typeof fn === 'function' ? fn : null;
    },
    start(rerender) {
      onChange = rerender || onChange;
      if (root.document && root.document.documentElement) root.document.documentElement.lang = lang === 'fil' ? 'fil' : 'en';
      watch();
    },
    misses
  };
})(globalThis);
