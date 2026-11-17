(function () {
  'use strict';

  const E = ECES,
    S = ECESStore,
    {
      esc,
      icon
    } = ECESDesign;
  // A guest can read every public page. Sending a proposal, suggestion or concern needs a signed-in account.
  const guest = {
    id: '',
    role: 'parent',
    name: 'Guest',
    active: true,
    guest: true
  };
  const db = () => S.db,
    me = () => E.account(db(), S.me) || (db() ? guest : null);
  const isGuest = (a = me()) => !!a?.guest;
  const guestOnly = ['dlg:proposal', 'dlg:suggestion', 'dlg:concern', 'dlg:inspection', 'support'];
  const labels = E.labels;
  const color = {
    screened: 'recommended',
    voting: 'in_progress',
    awaiting_head: 'under_review',
    signing: 'in_progress',
    filed: 'approved',
    posted: 'approved',
    returned: 'declined',
    resolved: 'completed',
    not_adopted: 'declined',
    withdrawn: 'closed'
  };
  const roleName = a => isGuest(a) ? 'Guest · Public view' : E.roles[a?.role] || 'Guest';
  const cash = c => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format((c || 0) / 100);
  const date = d => d ? new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila'
  }).format(new Date(d.length === 10 ? d + 'T04:00:00Z' : d)) : '';
  const n = name => db().accounts.find(x => x.id === name)?.name || E.roles[name] || name;
  const badge = s => '<span class="badge ' + esc(color[s] || s) + '">' + esc(labels[s] || s) + '</span>';
  const badgeText = s => '<span class="badge">' + esc(s) + '</span>';
  const t = () => E.today();
  // The real school record carries a flag; the fictional rehearsal does not. Wording and the practice reader follow it.
  const isLive = () => !!db()?.settings?.live;
  const onRole = roles => roles.includes(me()?.role);
  const canChair = () => E.isChair(db(), me());
  const canPrint = () => onRole(E.printers);
  // True for the officer who holds a role, and for the chairperson while standing in for that officer.
  const holds = role => E.holds(db(), me(), role);
  const standIn = () => !isGuest() && me() ? E.covering(db(), me()) : '';
  const canPost = d => d.status === 'pending' && E.mayPost(db(), me(), d);
  const publisher = () => !isGuest() && E.canAnnounce(db(), me());
  const ended = x => !!x.until && x.until < t();
  const mask = login => /^\d{8,}$/.test(login.replace(/\D/g, '')) ? '•••• ' + login.replace(/\D/g, '').slice(-4) : login;
  const seal = '<span class="seal-crop"><img src="assets/east-central-seal.webp" alt="East Central Elementary School seal"></span>';
  const ui = {
    tab: 'home',
    dialog: null,
    id: null,
    message: '',
    busy: false,
    rows: 1,
    reviewed: new Set(),
    attachment: null,
    photoUrls: new Map(),
    printId: null,
    reviseId: null,
    scan: null,
    prefill: '',
    queue: false,
    back: '',
    avatarUrl: '',
    avatarFor: '',
    avatarBusy: false
  };
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'with']);
  // Headings and sub-headings use title case. A word that already has a capital (SPTA, iPad) is left alone.
  function titleCase(text) {
    const parts = String(text ?? '').split(/(\s+|-)/);
    const wordAt = parts.map((x, i) => /[A-Za-z\u00C0-\u024F]/.test(x) ? i : -1).filter(i => i >= 0);
    return parts.map((word, i) => {
      const m = word.match(/^([^A-Za-z\u00C0-\u024F]*)(.*)$/);
      if (!m[2] || m[2] !== m[2].toLowerCase()) return word;
      const edge = i === wordAt[0] || i === wordAt.at(-1) || parts[i - 1] === '-' && parts[i + 1] !== '-';
      // "Sign in" and "sign up" are verbs, so the second word takes a capital.
      const verb = /^(sign|log)$/i.test(parts[i - 2] || '');
      if (!edge && !verb && smallWords.has(m[2].replace(/[^a-z]+$/, ''))) return word;
      return m[1] + m[2][0].toUpperCase() + m[2].slice(1);
    }).join('');
  }
  // Announcement pop-ups. An announcement published after this device first opened the app pops up once
  // for each person who uses the app here, until they tap Got it. Its author does not get the pop-up.
  const seenStore = {
    memory: {},
    read(key) {
      try {
        const v = localStorage.getItem('eces-announce-' + key);
        if (v) return JSON.parse(v);
      } catch {}
      return this.memory[key] || null;
    },
    write(key, ids) {
      this.memory[key] = ids;
      try {
        localStorage.setItem('eces-announce-' + key, JSON.stringify(ids));
      } catch {}
    }
  };
  function announceBaseline(force = false) {
    if (force || !seenStore.read('base')) seenStore.write('base', (db()?.announcements || []).map(x => x.id));
  }
  function unseenAnnouncements() {
    if (!me()) return [];
    const base = seenStore.read('base') || [],
      seen = seenStore.read('seen-' + (S.me || 'guest')) || [];
    return notices().filter(x => !base.includes(x.id) && !seen.includes(x.id) && x.author !== S.me && !ended(x));
  }
  function announcementPopup() {
    const waiting = unseenAnnouncements();
    if (!waiting.length || ui.dialog) return '';
    const x = waiting[0],
      from = E.recipients[x.role] || E.roles[x.role] || E.roles[E.account(db(), x.author)?.role] || 'SPTA';
    return '<div class="portal-overlay announce-overlay"><section class="portal-modal announce-pop" role="alertdialog" aria-modal="true" aria-labelledby="announce-title"><div class="announce-head"><span class="notice-symbol">' + icon('megaphone') + '</span><div><small>SPTA Announcement' + (waiting.length > 1 ? ' · 1 of ' + waiting.length : '') + '</small><h2 id="announce-title">' + esc(titleCase(x.title)) + '</h2></div></div><div class="modal-inner"><div class="entry-meta">' + esc(date(x.date)) + ' · From the ' + esc(from) + (x.audience === 'officers' ? ' · Officers only' : '') + '</div>' + para(x.body) + '<div class="form-end">' + btn(waiting.length > 1 ? 'Next' : 'Got it', 'announceSeen', x.id, 'primary') + '</div></div></section></div>';
  }
  const oldView = new URLSearchParams(location.search).get('view');
  function btn(label, action, id = '', style = 'light', ic = '') {
    return '<button type="button" class="btn ' + style + '" data-do="' + esc(action) + '" data-id="' + esc(id) + '">' + (ic ? icon(ic, 'sm') : '') + esc(label) + '</button>';
  }
  const empty = s => '<div class="portal-empty">' + esc(s) + '</div>';
  const notice = s => '<div class="portal-note">' + esc(s) + '</div>';
  const section = (title, body) => '<section class="portal-section"><h2>' + esc(titleCase(title)) + '</h2>' + body + '</section>';
  function card(title, body, meta = '', status = '', actions = '', sentence = false) {
    return '<article class="entry"><div class="entry-top"><span class="entry-meta">' + esc(meta) + '</span>' + (status ? badge(status) : '') + '</div><h3>' + esc(sentence ? title : titleCase(title)) + '</h3>' + body + (actions ? '<div class="entry-actions">' + actions + '</div>' : '') + '</article>';
  }
  const para = s => s ? '<p class="wrap-lines">' + esc(s) + '</p>' : '';
  const actionCard = (label, act, ic, id = '') => '<button class="action-tile" data-do="' + esc(act) + '" data-id="' + esc(id) + '">' + icon(ic) + '<span>' + esc(titleCase(label)) + '</span>' + icon('chevron', 'sm') + '</button>';
  const input = (name, title, value = '', type = 'text', attrs = 'required') => {
    const field = '<input type="' + type + '" name="' + esc(name) + '" value="' + esc(value) + '" ' + attrs + '>';
    // A password field has an eye button to show or hide what was typed.
    return '<label>' + esc(title) + (type === 'password' ? '<span class="pw-field">' + field + '<button type="button" class="pw-eye" data-do="pwToggle" aria-label="Show password" aria-pressed="false">' + icon('eye') + '</button></span>' : field) + '</label>';
  };
  const area = (name, title, value = '', attrs = 'required') => '<label>' + esc(title) + '<textarea name="' + name + '" ' + attrs + '>' + esc(value) + '</textarea></label>';
  const opts = (pairs, selected = '') => pairs.map(item => {
    const [v, l] = Array.isArray(item) ? item : [item, item];
    return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('');
  // Grade and section are always two fields. Stored together as "Grade 3 · Sampaguita".
  const GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
  const splitGrade = v => {
    const [g = '', ...r] = String(v || '').split(' · ');
    return [g.trim(), r.join(' · ').trim()];
  };
  const joinGrade = (g, sec) => g && sec ? g + ' · ' + sec.trim() : '';
  // Another student is kept as "Name · Grade · Section". An older entry without a name still reads as "Grade · Section".
  const joinChild = (name, g, sec) => name && g && sec ? name.trim() + ' · ' + g + ' · ' + sec.trim() : '';
  const splitChild = v => {
    const parts = String(v || '').split(' · ');
    return parts.length >= 3 ? [parts[0].trim(), ...splitGrade(parts.slice(1).join(' · '))] : ['', ...splitGrade(v)];
  };
  const gradeSelect = (name, grade = '', required = true) => '<label>Grade<select name="' + name + '"' + (required ? ' required' : '') + '><option value="">Choose grade</option>' + (grade && !GRADES.includes(grade) ? '<option selected>' + esc(grade) + '</option>' : '') + GRADES.map(g => '<option' + (g === grade ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label>';
  const gradePair = (name, value = '', title = '') => {
    const [g, sec] = splitGrade(value);
    return (title ? '<div class="field-title">' + esc(title) + '</div>' : '') + '<div class="grade-pair">' + gradeSelect(name + 'Grade', g) + input(name + 'Section', 'Section', sec, 'text', 'required maxlength="40" placeholder="Sampaguita"') + '</div>';
  };
  const studentRow = (name = '', g = '', sec = '') => '<div class="student-row">' + input('childName', 'Student’s full name', name, 'text', 'maxlength="80" autocomplete="off"') + '<div class="grade-pair">' + gradeSelect('childGrade', g, false) + input('childSection', 'Section', sec, 'text', 'maxlength="40" placeholder="Narra"') + '</div>' + btn('Remove', 'removeStudent', '', 'text') + '</div>';
  const select = (name, title, options, selected = '', attrs = '') => '<label>' + esc(title) + '<select name="' + name + '" ' + attrs + '>' + opts(options, selected) + '</select></label>';
  const ck = (name, label, required = false, checked = false) => '<label class="tick"><input type="checkbox" name="' + name + '" ' + (required ? 'required ' : '') + (checked ? 'checked' : '') + '><span>' + esc(label) + '</span></label>';
  const upload = (label, required = true) => '<label>' + esc(label) + '<input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf" ' + (required ? 'required' : '') + '></label>';
  const imageUpload = label => '<label>' + esc(label) + '<input type="file" name="attachment" accept="image/jpeg,image/png,image/webp" required></label>';
  const submit = lbl => '<button type="submit" class="btn primary">' + esc(lbl) + '</button>';
  const form = (action, body, label, id = '') => '<form class="portal-form" data-form="' + action + '" data-id="' + esc(id) + '">' + body + '<div class="form-end">' + submit(label) + '</div></form>';
  // Funding check against the SPTA pool: green when available funds cover it, red when fundraising is needed.
  function fundCheck(cents, short, label = 'Covered by available SPTA funds') {
    return short > 0 ? '<div class="fund-check short">' + icon('alert', 'sm') + '<span><b>Needs fundraising · short by ' + cash(short) + '</b>' + esc('SPTA funds available now cover ' + cash(Math.max(0, cents - short)) + ' of ' + cash(cents) + '.') + '</span></div>' : '<div class="fund-check ok">' + icon('check', 'sm') + '<span><b>' + esc(label) + '</b></span></div>';
  }
  // A change to an approved project only needs funds for the increase. A new proposal needs funds for all of it.
  const extraFor = p => p ? E.extraNeeded(db(), p) : 0;
  const proposalFund = p => p.budget > 0 && ['screened', 'voting', 'awaiting_head'].includes(p.status) && extraFor(p) > 0 ? fundCheck(extraFor(p), E.funding(db()).shortFor(extraFor(p))) : '';
  const ballotFund = b => {
    const q = db().proposals.find(x => x.id === b.proposal),
      x = q ? extraFor(q) : b.budget;
    return x > 0 ? fundCheck(x, E.funding(db()).shortFor(x)) : '';
  };
  // Status tracker for something a parent sent.
  function tracker(item) {
    let steps, at, stop = '';
    if (item.kind) {
      steps = ['Received', 'Reviewed', 'Resolved'];
      at = {received: 0, assigned: 1, resolved: 2}[item.status] ?? 0;
      if (item.status === 'withdrawn') stop = labels.withdrawn;
    } else {
      steps = item.direct ? ['Added by chairperson', 'School Head', 'Approved'] : ['Received', 'Reviewed', 'Officer vote', 'School Head', 'Approved'];
      at = item.direct ? {awaiting_head: 0, returned: 1, declined: 1}[item.status] ?? 2 : {received: 0, screened: 1, voting: 1, awaiting_head: 2, approved: 4, in_progress: 4, completed: 4, cancelled: 4, returned: 1, declined: 1, not_adopted: 2}[item.status] ?? 0;
      if (['returned', 'declined', 'not_adopted', 'withdrawn'].includes(item.status)) stop = labels[item.status];
    }
    const list = steps.map((name, i) => '<li class="' + (i < at || i === at && !stop ? 'done' : i === at ? 'stop' : i === at + 1 && !stop ? 'next' : '') + '"><i></i><span>' + esc(i === at && stop ? stop : name) + '</span></li>').join('');
    const who = item.replyBy ? E.recipients[item.replyBy] || E.roles[item.replyBy] : 'reviewer';
    return '<ol class="tracker" aria-label="Status: ' + esc(stop || steps[at]) + '">' + list + '</ol><div class="auto-reply"><small>Automated response</small>' + para(E.autoReply(item)) + '</div>' + (item.reply ? '<div class="portal-note personal"><b>Personal Reply from the ' + esc(titleCase(who)) + '</b>' + para(item.reply) + (item.replyAt ? '<small>' + esc(date(item.replyAt)) + '</small>' : '') + '</div>' : '');
  }
  const signInPrompt = text => '<div class="sign-prompt">' + para(text) + '<div class="entry-actions">' + btn('Sign in', 'dlg:login', '', 'primary') + btn('Create account', 'dlg:register') + (S.shared ? btn('I am an officer with an invite code', 'dlg:join', '', 'text') : '') + '</div></div>';
  const fromLine = x => x.sender?.name ? '<div class="entry-meta">From ' + esc(x.sender.name) + (x.sender.homeroom ? ' · ' + esc(x.sender.homeroom) : '') + '</div>' : '';
  function ownCases() {
    return db().cases.filter(c => E.canSeeCase(me(), c) || standIn() && c.assigned === standIn());
  }
  // May this person change the status of, or reply to, a case? And may they add an internal note?
  const caseHandler = c => E.caseHandler(db(), me(), c);
  const caseNoter = c => E.caseNoter(db(), me(), c);
  // Suggestions and concerns that the chairperson and Vice-Chairperson passed on, as the School Head and secretary see them.
  const passedOn = () => ownCases().filter(c => E.onDesk(c) && c.forwarded && c.owner !== S.me);
  // SPTA Projects page: a short summary, then projects grouped by where they stand.
  // Each card shows the few things people look for first; the rest opens under Details.
  // What changed on an approved project, in plain words.
  function changeLog(p) {
    const lines = (p.history || []).map(h => {
      const when = date(h.at.slice(0, 10));
      if (h.kind === 'wording') return 'Wording corrected on ' + when + '. ' + h.reason;
      if (h.kind === 'lower') return 'Allocation lowered from ' + cash(h.from) + ' to ' + cash(h.to) + ' on ' + when + '. ' + h.reason;
      if (h.kind === 'raise') return 'Allocation raised from ' + cash(h.from) + ' to ' + cash(h.to) + ' on ' + when + ', after a new officer vote and the School Head’s approval. ' + h.reason;
      if (h.kind === 'restore') return 'Allocation put back from ' + cash(h.from) + ' to ' + cash(h.to) + ' on ' + when + ', an amount the officers had already approved. ' + h.reason;
      if (h.kind === 'reopen') return 'Reopened on ' + when + ' after it was marked completed. ' + h.reason;
      return 'Purpose changed from “' + h.before + '” on ' + when + ', after a new officer vote and the School Head’s approval. Allocation ' + cash(h.to) + '. ' + h.reason;
    });
    return lines.length ? '<div class="change-log"><b>Changes</b>' + lines.map(x => '<p>' + esc(x) + '</p>').join('') + '</div>' : '';
  }
  // Privacy Notice. DRAFT until the school's Data Protection Officer confirms the wording. Set PRIVACY_DRAFT to false after that.
  const PRIVACY_DRAFT = true;
  const PRIVACY_VERSION = '2026-11';
  const PRIVACY = [
    ['Who we are', ['This app is run by the East Central Elementary School SPTA in San Fabian, Pangasinan, with the approval of the School Head. For any privacy question, ask the SPTA chairperson or the School Head’s office.']],
    ['What we collect', ['Your name, mobile number, and your child’s grade and section. You may also list the name, grade and section of your other children. Only you can see that list.', 'What you send us: proposals, suggestions, private concerns and requests.', 'If you are an SPTA officer: your drawn signature, votes counted as results only, finance records, meeting minutes and photos of project work.', 'A code that identifies your phone, so one phone cannot create many accounts, and a sign-in cookie.', 'If you choose to add one, a profile picture. Only you can see it, and you can remove it at any time.']],
    ['Why we collect it', ['To run SPTA proposals, officer voting and fund reports openly, to answer what you send, and to keep records of officer decisions.']],
    ['Who can see it', ['Everyone can see approved projects, fund entries, announcements and signed resolutions. They do not show receipts, contributors’ names or your private messages.', 'Your private concern or suggestion goes first only to the SPTA chairperson and Vice-Chairperson. They decide whether to share it with the School Head. Officers see only what their role needs.']],
    ['Children’s information', ['We ask only for the name, grade and section of your own children. Please do not upload photos that show pupils’ faces, names or uniforms.']],
    ['How long we keep it', ['As long as needed for the purposes above and as the school’s record rules require. Official records such as published fund entries and filed resolutions are kept.']],
    ['Your rights', ['Under the Data Privacy Act of 2012 you may ask to see, correct, or delete your information, object to its use, and ask for a copy. Ask the SPTA chairperson. You may also complain to the National Privacy Commission at privacy.gov.ph.']],
    ['Your choice', ['Agreeing is voluntary. You can browse projects, funds and announcements without an account. To withdraw your consent, ask the SPTA chairperson. Your account will then be closed.']]
  ];
  const privacyBody = () => PRIVACY.map(([h, ps]) => '<h4>' + esc(h) + '</h4>' + ps.map(p => '<p>' + esc(p) + '</p>').join('')).join('') + (PRIVACY_DRAFT ? '<div class="portal-note">Draft wording. The school’s Data Protection Officer confirms the final text before the real launch.</div>' : '');
  // Public project photos. The picture itself loads after the page is drawn, then stays ready for later redraws.
  const photoState = ph => ph.status || 'approved';
  const shownPhotos = p => (p.photos || []).filter(x => photoState(x) === 'approved' || onRole(E.leaders));
  const findPhoto = key => db().projects.flatMap(p => p.photos || []).find(x => x.file.key === key);
  const photoImg = (ph, alt, cls = '') => '<img class="' + cls + '" alt="' + esc(alt) + '" data-photo="' + esc(ph.file.key) + '"' + (ui.photoUrls.get(ph.file.key) ? ' src="' + esc(ui.photoUrls.get(ph.file.key)) + '"' : '') + '>';
  function goBack() {
    ui.tab = ui.back || 'more';
    ui.back = '';
    ui.dialog = null;
    ui.message = '';
    render();
    window.scrollTo(0, 0);
  }
  function clearAvatar() {
    if (ui.avatarUrl) URL.revokeObjectURL(ui.avatarUrl);
    ui.avatarUrl = '';
    ui.avatarFor = '';
  }
  // The profile picture is fetched with the person's own sign-in, then kept as a local address for the header and account page.
  async function loadAvatar() {
    const a = me();
    if (!S.shared || !a || a.guest || !a.avatar) {
      if (ui.avatarUrl && (!a || a.guest || !a.avatar)) {
        clearAvatar();
        render();
      }
      return;
    }
    const want = a.id + ':' + a.avatar;
    if (ui.avatarFor === want || ui.avatarLoading === want) return;
    ui.avatarLoading = want;
    try {
      const url = await S.fileURL({ key: 'avatar-' + a.id });
      clearAvatar();
      ui.avatarUrl = url;
      ui.avatarFor = want;
    } catch (e) {
      /* the icon stays */
    } finally {
      ui.avatarLoading = '';
    }
    if (ui.avatarFor === want) render();
  }
  // Crop to a centred square and shrink, so every picture is small and loads fast.
  async function squarePicture(file, size = 320) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) throw Error('Choose a JPG, PNG or WEBP picture.');
    if (file.size > 15 * 1024 * 1024) throw Error('Choose a smaller picture.');
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height),
      canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.86));
    if (!blob) throw Error('That picture could not be read. Try another one.');
    return blob;
  }
  async function loadPhotos(scope = document) {
    if (typeof scope.querySelectorAll !== 'function') return;
    const imgs = [...scope.querySelectorAll('img[data-photo]:not([src])')],
      pending = ui.photoPending || (ui.photoPending = new Map());
    // One request per photo, even if it is on screen twice, and a few at a time instead of one after another.
    const fetchOne = ph => {
      const k = ph.file.key;
      if (ui.photoUrls.has(k)) return Promise.resolve(ui.photoUrls.get(k));
      if (!pending.has(k)) pending.set(k, S.fileURL(ph.file, true).then(u => {
        ui.photoUrls.set(k, u);
        return u;
      }).finally(() => pending.delete(k)));
      return pending.get(k);
    };
    let next = 0;
    const worker = async () => {
      while (next < imgs.length) {
        const img = imgs[next++],
          ph = findPhoto(img.dataset.photo);
        if (!ph) continue;
        try {
          img.src = await fetchOne(ph);
        } catch (e) {
          img.alt = 'This photo could not be loaded.';
          img.classList.add('failed');
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }
  // Wait for a step, but never forever. A step that stalls ends with a message instead of a silent button.
  const within = (promise, ms, message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(message)), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
  // Re-draw the photo as a JPEG of at most 1600 pixels. This also drops any location or camera details stored inside the original.
  // If the browser cannot re-draw it, the original is used as it is.
  async function shrinkImage(file) {
    const draw = async () => {
      let bmp;
      try {
        bmp = await createImageBitmap(file, {imageOrientation: 'from-image'});
      } catch (e) {
        bmp = await createImageBitmap(file);
      }
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.85));
      return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg'}) : file;
    };
    try {
      return await within(draw(), 15000, 'Photo took too long to prepare.');
    } catch (e) {
      return file;
    }
  }
  function photoStrip(p) {
    const list = shownPhotos(p);
    if (!list.length) return '';
    const shown = list.slice(0, 3);
    return '<div class="proj-photos" aria-label="Photos of this project">' + shown.map((ph, i) => '<button type="button" class="proj-photo" data-do="dlg:photo" data-id="' + esc(p.id + '|' + ph.id) + '" aria-label="' + esc('Open photo: ' + ph.caption) + '">' + photoImg(ph, ph.caption) + (photoState(ph) !== 'approved' ? '<span class="wait">' + (photoState(ph) === 'pending' ? 'Waiting' : 'Returned') + '</span>' : '') + (i === 2 && list.length > 3 ? '<span class="more">+' + (list.length - 3) + '</span>' : '') + '</button>').join('') + '</div>';
  }
  function photoDialog(id) {
    const [pid, phid] = String(id).split('|'),
      proj = db().projects.find(x => x.id === pid),
      list = proj ? shownPhotos(proj) : [],
      at = list.findIndex(x => x.id === phid),
      ph = list[at];
    if (!ph) return ['Project photo', empty('This photo is no longer available.')];
    const step = (label, to) => to ? btn(label, 'dlg:photo', pid + '|' + to.id) : '';
    const manage = onRole(E.leaders) ? form('projectPhotoRemove', hidden('photo', ph.id), 'Remove photo', pid) : '';
    const state = photoState(ph);
    const review = state === 'pending' ? (canChair() && ph.by !== S.me ? notice('Added by ' + n(ph.by) + '. It is public once you approve it.') + form('projectPhotoReview', hidden('photo', ph.id) + select('decision', 'Decision', [['approve', 'Approve for the public'], ['return', 'Return with a reason']]) + '<div data-when="decision" data-values="return">' + area('reason', 'Reason for return', '', 'minlength="4" maxlength="300"') + '</div>', 'Save decision', pid) : notice('Waiting for the chairperson’s approval. Only the School Head, chairperson and Vice-Chairperson can see it until then.')) : state === 'returned' ? notice('Returned by the chairperson. ' + (ph.reason || '')) : '';
    return [proj.title, photoImg(ph, ph.caption, 'attachment-image') + '<p class="photo-caption"><b>' + esc(ph.caption) + '</b></p><div class="entry-meta">' + esc((ph.stage === 'completed' ? 'Completed project' : 'In progress') + ' · ' + date(ph.date)) + (list.length > 1 ? ' · Photo ' + (at + 1) + ' of ' + list.length : '') + '</div>' + (list.length > 1 ? '<div class="entry-actions">' + step('Previous', list[at - 1]) + step('Next', list[at + 1]) + '</div>' : '') + review + manage];
  }
  function photoAddDialog(id) {
    const proj = db().projects.find(x => x.id === id);
    if (!proj) return ['Add a photo', empty('This project is no longer available.')];
    return ['Add a photo', para(proj.title) + notice('Everyone who opens the app can see this photo. Show the work, such as the shelves, the paint or the garden. Please keep pupils’ faces, names and uniforms out of the picture.') + form('projectPhoto', imageUpload('Photo (JPG, PNG or WEBP)') + input('caption', 'What does the photo show?', '', 'text', 'required minlength="3" maxlength="140" placeholder="Books on the new shelves"'), 'Publish photo', id)];
  }
  function projectCard(p, fund) {
    const spent = E.projectSpend(db(), p.id),
      done = Math.max(0, Math.min(100, Number(p.progress) || 0)),
      active = ['approved', 'in_progress'].includes(p.status),
      cancelled = p.status === 'cancelled',
      f = fund.projects[p.id];
    const row = (k, v) => '<div class="proj-row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
    let buttons = '';
    if (onRole(E.leaders) && active) buttons += btn('Update progress', 'dlg:project', p.id);
    if (onRole(E.leaders) && (active || p.status === 'completed')) buttons += btn('Add photo', 'dlg:photoAdd', p.id);
    if (onRole(E.leaders) && p.status === 'completed' && !p.past) buttons += btn('Reopen project', 'dlg:reopen', p.id);
    if (canChair() && active) buttons += btn('Change project', 'dlg:amend', p.id);
    if (me().role === 'head' && active) buttons += btn('Cancel project', 'dlg:cancel', p.id, 'danger');
    const top = '<div class="proj-top"><span class="project-symbol">' + icon(p.icon || 'sprout') + '</span><div><h3>' + esc(titleCase(p.title)) + '</h3><small>' + esc(cancelled ? 'Cancelled' : p.phase || labels[p.status]) + '</small></div>' + badge(p.status) + '</div>';
    const progress = p.past ? '<div class="proj-nums"><span><b>Completed</b> before this app</span><span>No SPTA funds used</span></div>' : cancelled ? '' : '<div class="proj-bar" role="img" aria-label="' + done + '% done"><div style="width:' + done + '%"></div></div><div class="proj-nums"><span><b>' + done + '%</b> done</span><span><b>' + cash(spent) + '</b> of ' + cash(p.budget) + ' spent</span></div>';
    const cancel = cancelled ? '<div class="cancel-note"><b>Why It Was Cancelled</b>' + para(p.reason) + '<b>Unused Funds</b>' + para(p.remainder) + '</div>' : '';
    const flag = f?.short > 0 ? fundCheck(f.need, f.short) : '';
    const details = '<details class="proj-details"><summary>Details</summary>' + para(p.text) + row('Project lead', n(p.owner)) + (p.past ? (p.sponsor ? row('Paid for by', p.sponsor) : '') + row('Completed on', date(p.changed)) + row('SPTA funds used', cash(0)) : row('SPTA allocation', cash(p.budget)) + row(cancelled ? 'Spent by cancellation' : 'Spent so far', cash(cancelled ? p.spentAtCancellation ?? spent : spent)) + (cancelled ? '' : row('Not yet spent', cash(p.budget - spent)))) + (f && !f.short ? row('Funding', 'Covered by SPTA funds') : '') + changeLog(p) + (E.amendOpen(db(), p.id) ? '<div class="entry-meta">' + icon('info', 'sm') + 'A change to this project is waiting for a new officer vote or the School Head’s decision. The allocation stays ' + esc(cash(p.budget)) + ' until then.</div>' : '') + row('Reference', p.id + ' · updated ' + date(p.changed)) + (buttons ? '<div class="entry-actions">' + buttons + '</div>' : '') + '</details>';
    return '<article class="proj is-' + esc(p.status) + '">' + top + progress + photoStrip(p) + flag + cancel + details + '</article>';
  }
  function projects() {
    const all = db().projects,
      fund = E.funding(db());
    if (!all.length) return empty('Approved SPTA projects will appear here.');
    const groups = [['Ongoing', all.filter(p => ['approved', 'in_progress'].includes(p.status))], ['Completed', all.filter(p => p.status === 'completed')], ['Cancelled', all.filter(p => p.status === 'cancelled')]];
    const spent = all.reduce((sum, p) => sum + E.projectSpend(db(), p.id), 0);
    const summary = '<div class="proj-summary"><div><b>' + groups[0][1].length + '</b><span>Ongoing</span></div><div><b>' + groups[1][1].length + '</b><span>Completed</span></div><div><b>' + cash(spent) + '</b><span>Spent so far</span></div></div>';
    return summary + groups.filter(g => g[1].length).map(([name, list]) => section(name + ' (' + list.length + ')', list.map(p => projectCard(p, fund)).join(''))).join('');
  }
  const proposalName = p => p.publicTitle || p.title;
  const lead = () => onRole(E.leaders);
  function tabs() {
    const arr = [['home', 'Home', 'home'], ['proposals', 'Proposals', 'lightbulb'], ['projects', 'Projects', 'sprout'], ['funds', 'Funds', 'chart']];
    if (lead()) arr.push(['cases', me().role === 'head' ? 'Passed-on feedback' : 'Assigned feedback', 'shield'], ['insights', 'School pulse', 'chart']);
    else if (holds('secretary')) arr.push(['cases', 'Passed-on feedback', 'shield']);
    if (onRole(E.boardRoles) || lead()) arr.push(['board', 'Officer voting', 'users'], ['resolutions', 'Resolutions', 'file']);
    if (onRole(['secretary', 'head', 'chair', 'vice'])) arr.push(['records', 'Minutes & notices', 'clipboard']);
    if (onRole(['head', 'chair'])) arr.push(['roster', 'BOD requests', 'users']);
    if (onRole(['head', 'chair', 'vice'])) arr.push(['history', 'Change history', 'clipboard']);
    if (onRole(['collector', 'treasurer']) || canChair() || db().batches.some(canPost)) arr.push(['finance', 'Finance desk', 'clipboard']);
    arr.push(['updates', 'My updates', 'bell'], ['account', isGuest() ? 'Sign in' : 'My account', 'settings'], ['more','More','layout']);
    return arr;
  }
  function notices() {
    return db().announcements.filter(a => (a.audience === 'everyone' || me().role !== 'parent') && (publisher() || !ended(a)));
  }
  const primaryTabs = ['home','projects','funds','more'];
  // A screen opened from More, or from the account icon, has a Back button and can be left with a swipe.
  const isSub = t => t !== 'more' && !primaryTabs.includes(t);
  function mobileNav(choices) {
    const selected = primaryTabs.includes(ui.tab) ? ui.tab : 'more';
    return '<nav class="mobile-dock" aria-label="Main navigation">'+primaryTabs.map(key=>{
      const [,label,shape] = choices.find(t=>t[0]===key);
      return '<button type="button" data-do="tab:'+key+'"'+(key===selected?' aria-current="page"':'')+'><span>'+icon(shape)+'</span>'+esc(label)+'</button>';
    }).join('')+'</nav>';
  }
  function more() {
    // The account page opens from the icon in the top bar on every screen.
    const links=tabs().filter(([key])=>!primaryTabs.includes(key)&&key!=='account');
    return '<div class="mobile-menu">'+links.map(([key,label,shape])=>actionCard(label,'tab:'+key,shape)).join('')+'</div>';
  }
  function practiceSelector() {
    if(S.shared)return '';
    const names={parent:'Parent · Signed In',bod:'HPTA President (BOD)',collector:'Collecting Officer'};
    const profiles=[['guest','Guest · Not Signed In'],...S.practiceProfiles.map(id=>E.account(db(),id)).filter(x=>x?.demo&&x.active).map(x=>[x.id,names[x.role]||E.roles[x.role]])];
    const listed=profiles.some(x=>x[0]===(S.me||'guest'));
    return '<label class="mobile-profile-select">Practice as<select id="practice-profile" aria-label="Choose fictional profile">'+(!listed?'<option selected disabled>'+esc(me().name)+'</option>':'')+opts(profiles,S.me||'guest')+'</select></label>'+para('Demo shortcut: one fictional profile for each role. In the live app, everyone signs in with their own account.');
  }
  function spotlight() {
    const role=me().role;
    if(role==='secretary')return ['Minutes and notices','Keep minutes, announcements and meeting records together.','Open records','tab:records','file'];
    if(role==='treasurer')return ['Treasury records','Scan sheets and receipts, and approve handovers from the collecting officer.','Open finance desk','tab:finance','clipboard'];
    if(role==='collector')return ['Collection handovers','Scan the collection sheet for the money you hand over. The treasurer and chairperson approve it.','Open handovers','tab:finance','clipboard'];
    if(role==='bod')return ['Officer voting','Read each proposal and vote on whether it should proceed.','Open voting','tab:board','users'];
    return ['Propose an SPTA project','What would make school better for our children?','Start a proposal','dlg:proposal','lightbulb'];
  }
  // What is waiting for the School Head, chairperson or Vice-Chairperson to approve or screen.
  // Each entry: icon, what to do, name, action, id, kind of item. The kind is shown as a label so nobody has to guess.
  function approvals() {
    const role=me().role, chair=canChair(), list=[];
    if(role==='head')db().proposals.filter(p=>p.status==='awaiting_head').forEach(p=>list.push(['check','For your approval · '+cash(p.budget),proposalName(p),'dlg:head',p.id,'Project Proposal']));
    if(role==='head')passedOn().filter(c=>c.status==='received').forEach(c=>list.push(['message','Passed on by the chairperson',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
    if(chair||role==='vice')db().batches.filter(canPost).forEach(d=>list.push(['clipboard','To publish · Money '+d.direction+' · '+cash(d.cents),d.purpose,'dlg:post',d.id,'Fund Posting']));
    db().minutes.filter(m=>chair&&m.state==='for_chair'||role==='head'&&m.state==='for_head').forEach(m=>list.push(['file',(m.state==='for_chair'?'To approve':'To note and file')+' · Meeting of '+date(m.date),m.title,'dlg:minute',m.id,'Minutes of the Meeting']));
    if(chair)db().projects.forEach(p=>(p.photos||[]).filter(x=>photoState(x)==='pending'&&x.by!==me().id).forEach(x=>list.push(['camera','To approve · Photo',p.title+' · '+x.caption,'dlg:photo',p.id+'|'+x.id,'Project Photo'])));
    if(onRole(['head','chair']))db().requests.filter(q=>q.status==='pending').forEach(q=>list.push(['users','To review · '+q.homeroom,q.name||n(q.user),'dlg:roster',q.id,'Officer Access Request']));
    db().proposals.filter(p=>p.status==='received').forEach(p=>list.push(['lightbulb','To screen · '+p.category,p.title,'dlg:screen',p.id,'Project Proposal']));
    return list;
  }
  // Everything waiting for the signed-in officer, in the order the work flows: approve, review, vote, sign.
  function todo() {
    const role=me().role, list=lead()?approvals():[];
    if(holds('secretary')){
      db().resolutions.filter(r=>r.state==='draft').forEach(r=>list.push(['file','To review and publish · Version '+r.version,r.title,'dlg:freeze',r.id,'Resolution']));
      db().resolutions.filter(r=>r.state==='signing'&&E.signaturesPending(r).length===0).forEach(r=>list.push(['check','Fully signed · Ready to file',r.title,'dlg:fileResolution',r.id,'Resolution']));
      ownCases().filter(c=>c.kind==='inspection'&&c.assigned==='secretary'&&!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.push(['search','To answer',c.subject,'dlg:reply',c.id,'Records Request']));
      passedOn().filter(c=>!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.push(['message','Passed to the School Head · follow up',c.subject,'dlg:caseNote',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
    }
    if(holds('treasurer'))db().batches.filter(d=>d.status==='for_treasurer'&&d.owner!==S.me).forEach(d=>list.push(['clipboard','To approve · '+cash(d.cents),d.purpose,'dlg:check',d.id,'Collection Handover']));
    if(holds('treasurer')||holds('collector'))db().batches.filter(d=>d.status==='returned'&&d.owner===S.me).forEach(d=>list.push(['alert','Returned for correction · '+cash(d.cents),d.purpose,'dlg:finance',d.id,'Fund Record']));
    if(onRole(E.boardRoles)){
      db().ballots.filter(b=>b.status==='open'&&b.present.includes(S.me)&&!b.participated.includes(S.me)).forEach(b=>list.push(['users','To vote on · '+cash(b.budget),b.title,'dlg:vote',b.id,'Project Proposal']));
      db().resolutions.filter(r=>r.state==='signing'&&r.signers?.some(x=>x.id===S.me)&&!r.signatures[S.me]).forEach(r=>list.push(['file','To sign · '+r.id,r.title,'dlg:sign',r.id,'Resolution']));
    }
    return list;
  }
  const kindSlug=kind=>kind.toLowerCase().split(' ')[0];
  const kindChip=kind=>'<b class="kind-chip kind-'+kindSlug(kind)+'">'+esc(kind)+'</b>';
  // The kind of item an open window is about, and where it sits among the items still waiting.
  function dialogKind() {
    if(!ui.dialog||!me()||isGuest())return null;
    const list=todo(), at=list.findIndex(x=>x[3]==='dlg:'+ui.dialog&&x[4]===ui.id);
    if(at>=0)return {kind:list[at][5],at,list};
    const c=['reply','forward','caseNote'].includes(ui.dialog)&&db().cases.find(x=>x.id===ui.id);
    const kind=c?(c.kind==='inspection'?'Records Request':c.kind==='concern'?'Private Concern':'Suggestion'):{head:'Project Proposal',screen:'Project Proposal',vote:'Project Proposal',proposalReply:'Project Proposal',resubmit:'Project Proposal',post:'Fund Posting',check:'Collection Handover',freeze:'Resolution',sign:'Resolution',fileResolution:'Resolution',reviseResolution:'Resolution',resolution:'Resolution',minute:'Minutes of the Meeting',roster:'Officer Access Request'}[ui.dialog];
    return kind?{kind,at:-1,list}:null;
  }
  const openCases=kind=>ownCases().filter(c=>c.kind===kind&&c.owner!==S.me&&caseHandler(c)&&!['resolved','withdrawn'].includes(c.status)).length;
  function waitingSummary(list) {
    const count={};
    list.forEach(x=>count[x[5]]=(count[x[5]]||0)+1);
    const plural=k=>k==='Minutes of the Meeting'?k:k.endsWith('y')?k.slice(0,-1)+'ies':k+'s';
    const word=(k,n)=>k==='Minutes of the Meeting'?(n===1?'set':'sets')+' of minutes':(n===1?k:plural(k)).toLowerCase();
    return Object.keys(count).map(k=>count[k]+' '+word(k,count[k])).join(' · ')+'.'+(list.length>1?' You can skip one and come back to it.':'');
  }
  // Every role gets the same home layout: a banner, two shortcuts, then lists. Only the contents differ.
  function home() {
    const leader=lead(), officer=leader||onRole([...E.boardRoles,'collector']), waiting=officer?todo():[];
    const [title,description,cta,action,shape,actionId='']=waiting.length?[waiting.length+(waiting.length===1?' item needs':' items need')+' your action',waitingSummary(waiting),'Open the first one',waiting[0][3],'check',waiting[0][4]]:leader?['All caught up','Nothing is waiting for you right now.','View proposals','tab:proposals','check']:spotlight();
    const hero='<section class="mobile-feature"><div class="feature-copy"><h2>'+esc(titleCase(title))+'</h2><p>'+esc(description)+'</p><button class="feature-cta" data-do="'+esc(action)+'" data-id="'+esc(actionId)+'"'+(waiting.length?' data-queue="1"':'')+'>'+esc(cta)+icon('arrow','sm')+'</button></div><span class="feature-art" aria-hidden="true"><i></i><b>'+icon(shape)+'</b></span></section>';
    const feedback='<div class="mobile-shortcuts">'+(leader?actionCard('Suggestions ('+openCases('suggestion')+')','tab:cases','message','suggestion')+actionCard('Private concerns ('+openCases('concern')+')','tab:cases','shield','concern'):actionCard('Make a suggestion','dlg:suggestion','message')+actionCard('Private concern','dlg:concern','shield'))+'</div>';
    const approvalList=officer&&(leader||waiting.length)?section('Needs your action',waiting.map(([shape,kicker,name,act,id,kind])=>'<button class="notice-row" data-do="'+esc(act)+'" data-id="'+esc(id)+'" data-queue="1"><span class="notice-symbol">'+icon(shape)+'</span><span>'+kindChip(kind)+'<strong>'+esc(titleCase(name))+'</strong><small>'+esc(kicker)+'</small></span>'+icon('chevron','sm')+'</button>').join('')||empty('Nothing is waiting for you.')):'';
    const latest=notices()[0];
    const announcement=latest?'<button class="notice-row" data-do="tab:updates"><span class="notice-symbol">'+icon('megaphone')+'</span><span><small>'+esc(date(latest.date))+'</small><strong>'+esc(titleCase(latest.title))+'</strong></span>'+icon('chevron','sm')+'</button>':empty('No announcements yet.');
    const projectsList=db().projects.slice(0,2).map(p=>'<button class="project-row" data-do="tab:projects"><span class="project-symbol">'+icon(p.icon||'sprout')+'</span><span><strong>'+esc(titleCase(p.title))+'</strong>'+badge(p.status)+'</span>'+icon('chevron','sm')+'</button>').join('');
    const join=isGuest()?'<div class="join-bod"><strong>Parent or SPTA Officer?</strong>'+btn('Sign in','tab:account')+'</div>':'';
    const cover=standIn()?notice('You are standing in for the '+E.roles[standIn()]+' until '+date(db().cover.until)+'. Their tasks appear in your list.'):'';
    return hero+cover+feedback+approvalList+section('Latest announcement',announcement)+section('SPTA projects',projectsList||empty('Approved SPTA projects will appear here.'))+join;
  }
  // A sender may take back a proposal until the School Head approves it, and a suggestion or concern until it is resolved.
  const canWithdraw = x => x.owner === S.me && (x.kind ? ['received', 'assigned'] : ['received', 'returned', 'screened', 'voting', 'awaiting_head']).includes(x.status);
  function proposals() {
    const all = db().proposals.filter(p => E.readableProposal(p, me()));
    if (me().role === 'head') all.sort((a, b) => (b.status === 'awaiting_head') - (a.status === 'awaiting_head'));
    return (me().role === 'parent' ? '' : '<div class="entry-actions">' + btn('Propose a project', 'dlg:proposal', '', 'primary', 'plus') + (canChair() ? btn('Add for School-Head approval (' + E.directUsed(db()) + ' of ' + E.directPerYear + ' used)', 'dlg:chairProposal', '', 'light', 'plus') : '') + '</div>') + (all.length ? '' : empty('Screened proposals will appear here.')) + '<div class="entry-list">' + all.map(p => {
      const own = p.owner === S.me;
      let actions = '';
      if (lead() && p.status === 'received') actions += btn('Screen proposal', 'dlg:screen', p.id, 'primary');
      if (own && p.status === 'returned') actions += btn('Revise proposal', 'dlg:resubmit', p.id);
      if (own && canWithdraw(p)) actions += btn('Withdraw', 'dlg:withdraw', p.id);
      if (p.status === 'awaiting_head' && me().role === 'head') actions += btn('Record decision', 'dlg:head', p.id, 'primary');
      if (E.publicProposal(p)) actions += btn(p.supporters?.includes(S.me) ? 'Supported' : 'Support idea', 'support', p.id, 'light', 'heart');
      if (me().role === 'head' || canChair()) actions += btn(p.reply ? 'Edit personal reply' : 'Send personal reply', 'dlg:proposalReply', p.id);
      return card(proposalName(p), para(p.publicText || p.details) + (lead() && !own ? fromLine(p) : '') + (own || lead() ? para(p.reason) : '') + (p.direct ? '<div class="entry-meta direct-note">' + icon('info', 'sm') + 'Added by the chairperson · No officer vote</div>' : '') + (p.budget > 0 ? '<div class="entry-meta">Proposed SPTA allocation ' + cash(p.budget) + '</div>' : '') + proposalFund(p) + (lead() && p.reply ? '<div class="portal-note personal"><b>Personal Reply Sent</b>' + para(p.reply) + '</div>' : '') + (E.publicProposal(p) ? '<div class="entry-meta">' + Number(p.supports || 0) + ' parent supporters</div>' : ''), p.id + ' · ' + p.category, p.status, actions);
    }).join('') + '</div>';
  }
  function updates() {
    const mine = db().proposals.filter(p => p.owner === S.me),
      cases = ownCases().filter(c => c.owner === S.me);
    const announcements = section('SPTA announcements', notices().map(x => card(x.title, para(x.body) + (x.edited ? '<div class="entry-meta">Edited ' + esc(date(x.edited)) + '</div>' : '') + (publisher() && x.until ? '<div class="entry-meta">' + (ended(x) ? 'Ended ' + esc(date(x.until)) + ' · No longer shown to others' : 'Shown until ' + esc(date(x.until))) + '</div>' : ''), date(x.date) + (me().role === 'parent' ? '' : ' · ' + (x.audience === 'everyone' ? 'School community' : 'Officers only')), ended(x) ? 'closed' : '', publisher() ? btn('Edit', 'dlg:announceEdit', x.id) + btn('Remove', 'dlg:announceRemove', x.id) : '')).join('') || empty('No announcements yet.'));
    if (isGuest()) return section('My submissions', signInPrompt('Sign in to send a proposal, suggestion or concern and to follow its status here.')) + announcements;
    return section('My submissions', mine.map(p => card(proposalName(p), tracker(p) + (p.reason ? '<div class="portal-note"><b>Note from the Reviewer</b>' + para(p.reason) + '</div>' : ''), p.id + ' · Project proposal', p.status, (p.status === 'returned' ? btn('Revise', 'dlg:resubmit', p.id) : '') + (canWithdraw(p) ? btn('Withdraw', 'dlg:withdraw', p.id) : ''))).join('') + cases.map(caseCard).join('') || empty('You have no submissions yet.')) + section('Notifications', db().notes.filter(x => x.owner === S.me).slice(0, 20).map(x => card(x.text, '', date(x.at), '', '', true)).join('') || empty('Updates will appear here.')) + announcements;
  }
  function caseCard(c) {
    const gone = c.status === 'withdrawn',
      assigned = caseHandler(c),
      mine = c.owner === S.me,
      desk = E.onDesk(c),
      noter = caseNoter(c) && !(mine && !assigned);
    const late = assigned && db().settings.reminders && !gone && c.status !== 'resolved' && c.due < t();
    const to = desk ? E.deskName : E.recipients[c.assigned] || E.roles[c.assigned];
    const notes = (c.notes || []).map(x => '<div class="portal-note' + (x.followUp ? ' personal' : '') + '"><b>' + esc((x.followUp ? 'Follow-up · ' : x.toHead ? 'Note for the School Head · ' : 'Note · ') + (E.roles[x.role] || x.role)) + '</b>' + para(x.text) + '<small>' + esc(date(x.at.slice(0, 10))) + '</small></div>').join('');
    const body = para(c.body) + (c.hidden ? '<div class="entry-meta hidden-name">' + icon('lock', 'sm') + esc(mine ? 'You hid your name from the reviewer.' : 'Name hidden by the sender. Reply here in the app.') + '</div>' : (assigned || noter) && !mine ? fromLine(c) : '') + (mine ? tracker(c) : c.reply ? '<div class="portal-note personal"><b>Personal Reply Sent</b>' + para(c.reply) + '</div>' : '') + (!mine || noter ? notes : '') + '<div class="entry-meta">Sent to the ' + esc(to) + (c.forwarded ? ' · Passed on to the School Head' + (c.forwarded.role && noter ? ' by the ' + esc(E.roles[c.forwarded.role] || '') : '') + ' ' + esc(date(c.forwarded.at.slice(0, 10))) : '') + (assigned && !gone ? ' · Next update by ' + esc(date(c.due)) : '') + (late ? ' · <b class="overdue">Overdue</b>' : '') + '</div>';
    const canForward = desk && !c.forwarded && ['chair', 'vice'].includes(me().role) && ['received', 'assigned'].includes(c.status);
    const actions = (assigned && !gone ? btn(c.status === 'received' ? 'Mark reviewed or reply' : 'Update or reply', 'dlg:reply', c.id) : '') + (canForward ? btn('Pass on to the School Head', 'dlg:forward', c.id, 'primary') : '') + (noter && !gone && desk ? btn(holds('secretary') && !assigned ? 'Record follow-up' : c.forwarded ? 'Add a note' : 'Add a private note', 'dlg:caseNote', c.id) : '') + (canWithdraw(c) ? btn('Withdraw', 'dlg:withdraw', c.id) : '');
    return card(c.subject, body, c.id + ' · ' + (c.kind === 'inspection' ? 'Records inspection request' : c.kind === 'concern' ? 'Private concern' : 'Private suggestion'), c.status, actions);
  }
  function pulse() {
    const tally = db().trends || {};
    if (!S.shared) db().cases.forEach(c => tally[c.category] = (tally[c.category] || 0) + 1);
    const topics = {
      ...tally
    };
    db().proposals.forEach(p => topics[p.category] = (topics[p.category] || 0) + 1);
    return section('Topics raised', para('Counts reflect submissions. One family may send more than one.') + Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<div class="list-line"><b>' + esc(k) + '</b><span>' + v + ' submission' + (v === 1 ? '' : 's') + '</span></div>').join('')) + btn('Export screened proposals', 'export', '', 'light', 'download');
  }
  function board() {
    const ballots = db().ballots.filter(b => b.roster.includes(S.me) || lead() || holds('secretary')).slice().reverse();
    return para('Every SPTA officer can vote on a screened proposal. It proceeds to the School Head once yes votes reach 50% of all officers.') + section('Proposals for officer vote', ballots.map(b => {
      const open = b.status === 'open',
        member = b.present.includes(S.me),
        voted = b.participated.includes(S.me),
        turnout = b.turnout ?? b.participated.length,
        need = E.yesNeeded(b);
      const text = para(b.body) + '<div class="entry-meta">Secret ballot · ' + b.present.length + ' officers · ' + need + ' yes votes needed (50%) · SPTA allocation ' + cash(b.budget) + '</div>' + (open ? ballotFund(b) : '') + (open ? para(turnout + ' of ' + b.present.length + ' officers have voted.' + (voted ? ' Your vote was received.' : '')) + '<div class="entry-meta vote-closes">' + icon('info', 'sm') + 'Voting closes on ' + esc(date(E.voteCloses(b))) + '</div>' : '<div class="vote-summary"><b>' + b.counts.yes + ' Yes</b><b>' + b.counts.no + ' No</b><b>' + b.counts.abstain + ' Abstain</b></div>' + para(b.withdrawn ? 'The proposer withdrew this proposal, so the vote was closed.' : b.passed ? 'Reached 50% of all officers. Sent to the School Head for approval.' : 'Yes votes did not reach 50% of all officers' + (b.expired ? ' by the closing date.' : '.')));
      let buttons = '';
      if (open && member && !voted) buttons += btn('Cast vote', 'dlg:vote', b.id, 'primary');
      if (open && canChair() && !S.shared && b.present.some(m => !b.participated.includes(m) && !S.practiceProfiles.includes(m))) buttons += btn('Add practice ballots', 'practiceBallots', b.id);
      if (open && canChair()) buttons += btn('Change closing date', 'dlg:deadline', b.id) + btn('Close voting', 'dlg:close', b.id);
      return card(b.title, text, b.proposal + ' · ' + (open ? 'Opened ' : 'Closed ') + date(b.date), open ? 'voting' : b.withdrawn ? 'withdrawn' : b.passed ? 'approved' : 'closed', buttons);
    }).join('') || empty('No proposals are open for voting.'));
  }
  const officers = () => onRole(E.boardRoles) || me().role === 'head';
  const signerLine = s => s.role && s.role !== 'bod' ? E.roles[s.role] : s.homeroom || E.roles.bod;
  function markSvg(mark) {
    return /^[ML\d ]+$/.test(mark || '') ? '<svg class="sig-mark" viewBox="0 0 300 100" role="img" aria-label="Drawn signature"><path d="' + mark + '"/></svg>' : '';
  }
  function resCard(r) {
    const canSign = r.state === 'signing' && r.signers?.some(x => x.id === S.me) && !r.signatures[S.me];
    let acts = btn('Read resolution', 'dlg:resolution', r.id);
    if (canSign) acts += btn('Sign resolution', 'dlg:sign', r.id, 'primary');
    if (r.state === 'signing' && r.signatures[S.me] && onRole(E.boardRoles)) acts += btn('Take back my response', 'dlg:unsign', r.id);
    if (holds('secretary')) {
      if (r.state === 'draft') acts += btn('Edit and publish', 'dlg:freeze', r.id, 'primary');else {
        if (r.state === 'signing') acts += btn('File signed record', 'dlg:fileResolution', r.id);
        acts += btn('Correct document', 'dlg:reviseResolution', r.id);
      }
    }
    if (canPrint() && r.state !== 'draft') acts += btn('Print / save PDF', 'print', r.id, 'light', 'file');
    const signed = r.signers ? Object.values(r.signatures || {}).filter(x => x.status === 'acknowledged').length : 0;
    return card(r.title, para(r.clause || 'The secretary is reviewing the draft.') + (r.state !== 'draft' && r.signers ? '<div class="entry-meta">' + signed + ' of ' + r.signers.length + ' officers have signed</div>' : ''), r.id + ' · Version ' + r.version, r.state, acts);
  }
  function resolutionPaper(r, signatures = true) {
    const demo = '<div class="paper-mark">' + (isLive() ? '' : 'FICTIONAL REHEARSAL COPY · ') + esc(labels[r.state] || r.state).toUpperCase() + '</div>';
    const fact = (k, v) => v ? '<div class="paper-fact"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : '';
    let body = demo + '<div class="paper-head">' + seal + '<div><b>East Central Elementary School</b><div>School Parent-Teacher Association</div></div></div><h2>Resolution ' + esc(r.id) + '</h2>' + '<div class="entry-meta">Version ' + r.version + ' · ' + esc(labels[r.state] || r.state) + '</div><h3>' + esc(titleCase(r.title)) + '</h3>' + para(r.text);
    if (r.meeting) body += '<h3>Project Details</h3><div class="paper-facts">' + fact('Proposal', r.proposal) + fact('Project', r.project) + fact('Category', r.category) + fact('Approved allocation', cash(r.budget)) + fact('Voluntary contributions', r.fundraising ? 'Yes · ' + r.ga : '') + (r.tally ? fact('Officer vote', r.tally.yes + ' yes, ' + r.tally.no + ' no, ' + r.tally.abstain + ' abstain' + (r.officers ? ' of ' + r.officers + ' officers' : '')) + fact('Vote closed', date(r.date)) : fact('Officer vote', 'Not held · Added by the chairperson')) + fact('School-Head approval', date(r.approved)) + '</div>';
    body += '<h3>Resolution</h3>' + para(r.clause || 'Draft text awaiting secretary review.') + (r.supersededBy ? notice('Replaced by resolution ' + r.supersededBy + ' after the project’s allocation changed. This one records what was approved at the time.') : '');
    if (signatures && r.signers && r.state !== 'draft' && officers()) {
      const done = r.signers.filter(s => r.signatures[s.id]?.status === 'acknowledged').length;
      body += '<h3>Signatures</h3>' + para(done + ' of ' + r.signers.length + ' officers have signed this version. ' + (r.signerPolicy || 'All officers') + ' · ' + E.signaturesPending(r).length + ' required signatures pending.') + '<div class="sig-grid">' + r.signers.map(s => {
        const sig = r.signatures[s.id],
          ok = sig?.status === 'acknowledged';
        return '<div class="sig-block' + (ok ? ' signed' : '') + '">' + (ok ? markSvg(sig.mark) : '<span class="sig-empty">' + esc(sig ? 'Declined to sign' : 'Not yet signed') + '</span>') + '<b>' + esc(sig?.name || s.name) + '</b><span>' + esc(signerLine(sig || s)) + '</span><span>' + esc(sig ? date(sig.at) : '') + '</span></div>';
      }).join('') + '</div>' + para(r.filing);
    }
    return '<article class="resolution-sheet">' + body + '</article>';
  }
  const has = key => tabs().some(x => x[0] === key);
  // SPTA Funds page. Sarah prefers this layout; its section headings carry a tinted band.
  function funds() {
    const rows = db().ledger.slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = d => rows.filter(x => x.direction === d).reduce((s, x) => s + x.cents, 0);
    const fund = E.funding(db()),
      name = id => db().projects.find(p => p.id === id)?.title;
    const active = db().projects.filter(p => fund.projects[p.id]),
      waiting = db().proposals.filter(p => E.publicProposal(p) && p.budget > 0 && ['screened', 'voting', 'awaiting_head'].includes(p.status));
    const projectLines = active.map(p => {
      const spent = E.projectSpend(db(), p.id),
        f = fund.projects[p.id];
      return '<article class="fund-project"><h3>' + esc(titleCase(p.title)) + '</h3><div class="fund-bar"><div style="width:' + Math.max(0, Math.min(100, p.budget ? spent / p.budget * 100 : 0)) + '%"></div></div><div class="money-inline"><span>Allocation <b>' + cash(p.budget) + '</b></span><span>Spent <b>' + cash(spent) + '</b></span><span>Still to pay <b>' + cash(f.need) + '</b></span></div>' + fundCheck(f.need, f.short, 'Covered by SPTA funds') + '</article>';
    }).join('');
    const proposalLines = waiting.map(p => '<article class="fund-project"><h3>' + esc(titleCase(proposalName(p))) + '</h3><div class="entry-meta">' + esc(labels[p.status]) + ' · Proposed allocation ' + cash(p.budget) + '</div>' + proposalFund(p) + '</article>').join('');
    const movements = rows.map(entry => {
      const incoming = entry.direction === 'in';
      const project = entry.project && name(entry.project);
      const direction = incoming ? 'Money In' : 'Money Out';
      const explain = E.correctionNote(rows, entry);
      return '<li class="movement-row' + (explain ? ' corrected' : '') + '"><div class="movement-heading"><strong>' + esc(entry.purpose) +
        '</strong><b class="' + (incoming ? 'cash-in' : 'cash-out') + '">' +
        (incoming ? '+' : '−') + cash(entry.cents) + '</b></div><div class="movement-meta">' +
        direction + ' · ' + esc(date(entry.date)) + (project ? ' · ' + esc(project) : '') + '</div>' + (explain ? '<p class="correction-note">' + esc(explain) + '</p>' : '') + '</li>';
    }).join('');
    const summary = '<section class="balance-card" aria-label="SPTA Cash Balance"><h2>SPTA Cash Balance</h2><strong>' + cash(fund.balance) +
      '</strong>' + (db().opening > 0 ? '<small class="balance-carry">Includes ' + cash(db().opening) + ' carried over from earlier this school year, as of ' + esc(date(db().openingAsOf)) + '.</small>' : '') + '<div class="balance-flows"><div>Money In<b>' + cash(total('in')) + '</b></div><div>Money Out<b>' +
      cash(total('out')) + '</b></div></div></section>';
    const allocations = '<div class="fund-split"><div><span>Set Aside for Approved Projects</span><b>' + cash(fund.committed) +
      '</b></div><div class="' + (fund.available > 0 ? 'ok' : 'short') + '"><span>Available for New Proposals</span><b>' + cash(fund.available) + '</b></div></div>';
    return '<div class="funds-page">' + summary + '<p class="balance-note">SPTA officers manage these voluntary contributions and fundraising proceeds. They are not the school’s funds.</p>' +
      section('Approved Transactions', movements ? '<ul class="movement-list">' + movements + '</ul>' : empty('No approved transactions yet.')) +
      section('Project Funding', allocations + (projectLines || empty('No approved SPTA projects are waiting for funds.'))) +
      (proposalLines ? section('Proposals Waiting for a Decision', proposalLines) : '') + section('SPTA records', btn('Request records inspection', 'dlg:inspection') + (has('resolutions') ? '' : db().resolutions.filter(r => r.published).map(r => card(r.title, para(r.parentSummary), r.id + ' · Version ' + r.version, r.state)).join('')) + (has('records') ? '' : db().minutes.filter(m => m.state === 'filed').map(m => card(m.title, para(m.summary), 'Meeting · ' + date(m.date), 'filed')).join(''))) + '</div>';
  }
  function finance() {
    const role = me().role,
      treas = holds('treasurer'),
      officer = role === 'collector',
      collects = holds('collector'),
      review = canChair() || role === 'vice';
    const steps = d => d.handover ? '<div class="entry-meta">Collecting officer → Treasurer' + (d.checkedBy ? ' (approved ' + esc(date(d.checkedAt)) + ')' : '') + ' → Chairperson</div>' : '';
    const cardOf = d => {
      let actions = d.file ? btn('Inspect original', 'evidence', d.id) : '';
      if (treas && d.status === 'for_treasurer' && d.owner !== S.me) actions += btn('Review handover', 'dlg:check', d.id, 'primary');
      if (canPost(d)) actions += btn('Review for posting', 'dlg:post', d.id, 'primary');
      else if (canChair() && d.status === 'pending') actions += '<span class="entry-meta">Final approval by the Vice-Chairperson, because you sent or checked this record.</span>';
      if (d.owner === S.me && d.status === 'returned') actions += btn('Correct and resubmit', 'dlg:finance', d.id);
      if (treas && d.status === 'posted') actions += btn('Record correction', 'dlg:adjust', d.id);
      if (d.owner === S.me && (d.handover ? ['for_treasurer', 'returned'] : ['pending', 'returned']).includes(d.status)) actions += btn('Withdraw', 'dlg:withdrawFinance', d.id, 'danger');
      if (d.status === 'withdrawn') actions += '<span class="entry-meta">Withdrawn ' + esc(date(d.withdrawn.at.slice(0, 10))) + '. ' + esc(d.withdrawn.reason) + '</span>';
      const list = (d.items || []).map(x => '<div class="list-line"><span>' + esc(x.description) + '</span><b>' + cash(x.cents) + '</b></div>').join('');
      return card(d.purpose, para((d.direction === 'in' ? 'Money in · ' : 'Money out · ') + cash(d.cents)) + steps(d) + list + para(d.reason) + (d.history.length ? para(d.history.length + ' earlier submission version(s) retained.') : '') + para(d.noPaper ? 'No paper original · ' + d.noPaper : d.file?.name || 'Original file required'), d.id + ' · ' + d.receipt, d.status, actions);
    };
    const all = db().batches.filter(d => !officer || d.owner === S.me),
      waiting = treas ? all.filter(d => d.status === 'for_treasurer') : [],
      rest = all.filter(d => !waiting.includes(d) && (!review || treas || d.status !== 'for_treasurer'));
    return (treas || collects ? btn(isLive() ? (collects ? 'Record a collection handover' : 'Submit finance evidence') : collects ? 'Scan a collection handover' : 'Scan a sheet or receipt', 'dlg:finance', '', 'primary', 'camera') : '') + (collects ? para('Scan the collection sheet for the money you are handing over. The treasurer approves it first, then the chairperson gives final approval before it shows in SPTA funds.') : '') + (treas ? section('Handovers for your approval', waiting.map(cardOf).join('') || empty('No handovers are waiting for you.')) : '') + section(officer ? 'My handovers' : 'Finance submissions', rest.map(cardOf).join('') || empty(officer ? 'You have not recorded a handover yet.' : 'There are no finance submissions.'));
  }
  function records() {
    const sec = holds('secretary');
    return (sec || E.canAnnounce(db(), me()) ? '<div class="entry-actions">' + (sec ? btn('Upload meeting minutes', 'dlg:minutes', '', 'primary') : '') + (E.canAnnounce(db(), me()) ? btn('Publish announcement', 'dlg:announce', '', sec ? 'light' : 'primary', 'megaphone') : '') + '</div>' : '') + section('Meeting minutes', db().minutes.map(m => {
      let acts = btn('Read original', 'minuteFile', m.id);
      if (m.state === 'for_chair' && canChair()) acts += btn('Approve minutes', 'minutesReview', m.id, 'primary');
      if (m.state === 'for_head' && me().role === 'head') acts += btn('Note and file', 'minutesReview', m.id, 'primary');
      if (['for_chair', 'for_head'].includes(m.state) && (m.secretary === S.me || holds('secretary'))) acts += btn('Withdraw', 'dlg:withdrawMinutes', m.id, 'danger');
      return card(m.title, para(m.summary) + para('Due ' + date(m.due) + (!['filed', 'withdrawn'].includes(m.state) && m.due < t() ? ' · Overdue' : '')) + (m.state === 'withdrawn' ? para('Withdrawn. ' + m.withdrawn.reason) : ''), m.id + ' · ' + date(m.date), m.state, acts);
    }).join('') || empty('No minutes uploaded.')) + (sec ? section('Records inspection requests', ownCases().filter(c => c.kind === 'inspection' && c.assigned === 'secretary').map(caseCard).join('') || empty('No inspection requests.')) : '');
  }
  function roster() {
    const requests = db().requests.filter(q => q.status === 'pending');
    return section('BOD account requests', requests.map(q => card(q.name || n(q.user), para(q.homeroom), q.id, 'pending', btn('Review request', 'dlg:roster', q.id, 'primary'))).join('') || empty('No BOD requests awaiting review.')) + section('Current board roster', para('All verified HPTA presidents can review screened proposals. Voting seats are recorded per person. New votes use the current roster.') + db().accounts.filter(a => a.active && !a.vacant && E.boardRoles.includes(a.role)).map(a => '<div class="list-line"><span><b>' + esc(a.name) + '</b><small>' + esc(a.homeroom || roleName(a)) + ' · ' + (a.boardSeat ? 'Voting seat' : 'Review access') + '</small></span>' + btn('Edit', 'dlg:seat', a.id) + '</div>').join('')) + (me().role === 'head' ? section('Acting chairperson', para(E.hasDelegation(db()) ? 'Acting Vice-Chairperson through ' + date(db().actingUntil) + ' · ' + db().actingReference : 'Chairperson holds posting and meeting authority.') + btn(E.hasDelegation(db()) ? 'End assignment' : 'Assign Vice-Chairperson', 'dlg:acting')) : '');
  }
  function accountView() {
    const a = me(),
      requests = a.guest ? [] : db().requests.filter(q => q.user === a.id);
    const signIn = section('Sign in or create an account', signInPrompt('ECES Bayanihan is an East Central Elementary SPTA initiative. You are browsing as a guest. You can read projects, funds and announcements. Sign in to send a proposal, suggestion or private concern, or to work as an SPTA officer.'));
    const profile = section('My profile', card(a.name, (a.childName ? para('Student: ' + a.childName + ' · ' + a.homeroom) : para(a.homeroom)) + (a.role === 'bod' ? para(a.boardSeat ? 'Verified voting seat.' : 'Verified BOD review access.') : ''), E.roles[a.role], '', a.role === 'parent' && !a.demo && !requests.some(q => q.status === 'pending') ? btn('Request BOD role', 'dlg:requestRole') : '') + requests.map(q => card('BOD role request', para(q.homeroom) + para(q.reason), q.id, q.status, q.status === 'pending' ? btn('Withdraw request', 'dlg:withdrawRequest', q.id, 'danger') : '')).join('') + btn('Sign out', 'logout'));
    const initials = String(a.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    const havePic = a.avatar && ui.avatarUrl && ui.avatarFor === a.id + ':' + a.avatar;
    const picture = a.guest || !S.shared ? '' : section('Profile picture', '<div class="avatar-row"><span class="avatar-big">' + (havePic ? '<img alt="Your profile picture" src="' + esc(ui.avatarUrl) + '">' : '<b>' + esc(initials) + '</b>') + '</span><div>' + para('Only you can see this picture. Please do not use a photo of a child.') + '<div class="entry-actions"><label class="btn primary file-btn' + (ui.avatarBusy ? ' disabled' : '') + '">' + icon('camera', 'sm') + (ui.avatarBusy ? 'Saving…' : a.avatar ? 'Change picture' : 'Choose a picture') + '<input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp" hidden' + (ui.avatarBusy ? ' disabled' : '') + '></label>' + (a.avatar ? btn('Remove picture', 'avatarRemove', '', 'danger') : '') + '</div></div></div>');
    const others = a.guest || a.demo ? [] : S.known().filter(x => x.id !== a.id);
    const kid = x => { const [nm, g, sec] = splitChild(x); return '<div class="list-line"><span>' + (nm ? '<b>' + esc(nm) + '</b><br>' : '') + esc(joinGrade(g, sec) || g || x) + '</span></div>'; };
    const children = a.guest ? '' : section(a.childName ? 'Other students' : 'My students', para(a.childName ? 'List your other students’ names, grades and sections. Only you can see this list.' : 'List your students’ names, grades and sections. Only you can see this list.') + ((a.children || []).map(kid).join('') || empty('None listed.')) + btn((a.children || []).length ? 'Edit list' : 'Add a student', 'dlg:children'));
    const phone = a.guest || a.demo ? '' : section('Switch account', others.map(x => '<div class="list-line"><span><b>' + esc(x.name) + '</b><small>' + esc(mask(x.login)) + '</small></span>' + btn('Switch', 'switchTo', x.login) + '</div>').join('') + (S.known().length < E.accountsPerDevice ? btn('Add another account', 'dlg:register') : ''));
    const cover = canChair() ? section('Stand in for an absent officer', para(standIn() ? 'You are standing in for the ' + E.roles[standIn()] + ' until ' + date(db().cover.until) + '. Reason: ' + db().cover.reason : 'When the secretary, treasurer or Collecting and Disbursing Officer is away, you can do their tasks for a set period. It is recorded in the audit trail.') + btn(standIn() ? 'Change or end' : 'Stand in for an officer', 'dlg:cover')) : '';
    const practice = S.shared ? '' : section('Practice mode', (db().legacy ? notice('Earlier fictional records are loaded. Reset demo starts the sample meeting and finance review.') : '') + practiceSelector() + btn('Reset demo', 'dlg:reset', '', 'danger'));
    return (a.guest ? signIn : profile + picture + children + phone + cover) + practice;
  }
  function assignedCases() {
    const late = c => db().settings.reminders && c.status !== 'resolved' && c.due < t();
    const kind = ui.caseFilter;
    const mine = ownCases().filter(c => c.kind !== 'inspection' && c.owner !== S.me && (caseHandler(c) || caseNoter(c)) && (!kind || c.kind === kind)).sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || late(b) - late(a));
    const others = kind ? btn('Show all assigned feedback', 'tab:cases') : '';
    const settings = me().role === 'head' ? section('Follow-up settings', ['ack', 'reminders'].map(k => '<div class="list-line"><span>' + esc(k === 'ack' ? 'In-app submission acknowledgements' : 'Flag overdue feedback first') + '</span>' + btn(db().settings[k] ? 'Turn off' : 'Turn on', 'setting', k) + '</div>').join('')) : '';
    const passed = !['chair', 'vice'].includes(me().role);
    const intro = passed ? para('The chairperson and Vice-Chairperson read every suggestion and private concern first. They pass on the ones worth your attention, with a note when they need more from you.') : para('Only you and the ' + (me().role === 'chair' ? 'Vice-Chairperson' : 'chairperson') + ' can read what parents send. Pass an item on to the School Head if it is worth their time. You can leave a note for the School Head, and the secretary follows up with them.');
    return intro + section(kind === 'suggestion' ? (passed ? 'Suggestions passed on' : 'Suggestions sent to you') : kind === 'concern' ? (passed ? 'Concerns passed on' : 'Concerns sent to you') : passed ? 'Passed on to the School Head' : 'Sent to you', mine.map(caseCard).join('') || empty(kind ? 'Nothing here yet.' : passed ? 'Nothing has been passed on yet.' : 'No private cases sent to you.')) + others + (kind ? '' : settings);
  }
  // Change history: who acted, in which role, on what, what was decided and why. Only the School Head, chairperson and Vice-Chairperson see it.
  const HISTORY_AREAS = {
    money: ['financeSubmit', 'financeCheck', 'financeReview'],
    projects: ['projectUpdate', 'projectPhoto', 'projectPhotoRemove', 'projectReopen', 'amendProject'],
    proposals: ['screen', 'chairProposal', 'resubmit', 'withdraw', 'headDecision', 'closeBallot', 'voteDeadline', 'proposalReply'],
    records: ['minutesUpload', 'minutesReview', 'freeze', 'reviseResolution', 'sign', 'unsign', 'finalizeResolution', 'announce', 'announceEdit', 'announceRemove'],
    people: ['rosterReview', 'setSeat', 'endBod', 'acting', 'cover']
  };
  const RETRACTED = ['withdraw', 'withdrawRecord', 'unsign', 'projectPhotoRemove', 'announceRemove', 'projectReopen'];
  const DECISIONS = {post: 'Approved for posting', approve: 'Approved', return: 'Returned', decline: 'Declined', screen: 'Screened', acknowledged: 'Signed', not_signed: 'Did not sign'};
  const isRetraction = x => RETRACTED.includes(x.action) || ['return', 'decline', 'not_signed'].includes(x.decision);
  function history() {
    const f = ui.historyFilter || 'all',
      all = (db().audit || []).slice().reverse(),
      shown = all.filter(x => f === 'all' || (f === 'retracted' ? isRetraction(x) : (HISTORY_AREAS[f] || []).includes(x.action)));
    const chips = [['all', 'All'], ['money', 'Money'], ['projects', 'Projects'], ['proposals', 'Proposals'], ['records', 'Resolutions and minutes'], ['people', 'People and access'], ['retracted', 'Withdrawn or returned']].map(([key, label]) => '<button type="button" class="chip' + (f === key ? ' on' : '') + '" data-do="histfilter" data-id="' + key + '"' + (f === key ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(label) + '</button>').join('');
    const when = at => {
      try {
        return new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(at));
      } catch (e) {
        return at;
      }
    };
    const entry = x => {
      const acct = db().accounts.find(a => a.id === x.who),
        role = x.role || acct?.role,
        by = x.who === 'system' ? 'Done automatically' : (acct?.name || x.who) + (role ? ' · ' + (E.roles[role] || role) : '') + (x.cover ? ' · standing in for the ' + (E.roles[x.cover] || x.cover) : '');
      const lines = [];
      if (x.what || x.ref) lines.push((x.what ? x.what + ' · ' : '') + x.ref);
      if (x.cents) lines.push(cash(x.cents));
      if (x.decision && DECISIONS[x.decision]) lines.push(DECISIONS[x.decision]);
      return '<article class="entry audit-entry' + (isRetraction(x) ? ' is-retracted' : '') + '"><div class="entry-top"><span class="entry-meta">' + esc(when(x.at)) + '</span>' + (x.outcome && labels[x.outcome] ? badge(x.outcome) : '') + '</div><h3>' + esc(x.event) + '</h3><p class="audit-who"><b>' + esc(by) + '</b></p>' + lines.map(para).join('') + (x.reason ? '<p class="audit-reason">' + esc(x.reason) + '</p>' : '') + '</article>';
    };
    return '<p class="page-lead">Every major change is recorded here: who did it, in which role, and what was decided. Entries are added automatically. The app has no way to edit or remove them.</p><div class="chips" role="group" aria-label="Filter the history">' + chips + '</div>' + (shown.length ? shown.slice(0, 100).map(entry).join('') + (shown.length > 100 ? para('Showing the latest 100 of ' + shown.length + '.') : '') : empty('Nothing recorded for this filter yet.'));
  }
  const sections = {
    home,
    more,
    proposals,
    projects: () => '<p class="page-lead">Proposed by parents and paid for from SPTA funds. These are separate from the school’s own budget.</p>' + projects(),
    funds,
    updates,
    cases: assignedCases,
    insights: pulse,
    board,
    resolutions: () => section('Resolution register', db().resolutions.map(resCard).join('') || empty('A resolution is drafted automatically when a proposal passes the officer vote and the School Head approves it.')),
    records,
    history,
    roster,
    finance,
    account: accountView
  };
  function hidden(k, v) {
    return '<input type="hidden" name="' + k + '" value="' + esc(v ?? '') + '">';
  }
  const lineSum = items => items.reduce((sum, x) => sum + (x.cents || 0), 0);
  function totalLine(cents, written) {
    return '<div class="line-total" id="line-total"' + (written == null ? '' : ' data-written="' + written + '"') + '><span>Total of Lines</span><b id="line-sum">' + cash(cents) + '</b><small id="line-match">' + esc(matchText(cents, written)) + '</small></div>';
  }
  function matchText(cents, written) {
    if (written == null) return '';
    return cents === written ? 'Matches the total written on the paper.' : 'The paper says ' + cash(written) + '. Check the lines again.';
  }
  function refreshTotal() {
    const box = document.getElementById('line-total');
    if (!box) return;
    const cents = [...document.querySelectorAll('#item-rows [name=itemAmount]')].reduce((sum, x) => sum + Math.round((Number(x.value) || 0) * 100), 0);
    const written = box.dataset.written === undefined ? null : Number(box.dataset.written);
    document.getElementById('line-sum').textContent = cash(cents);
    document.getElementById('line-match').textContent = matchText(cents, written);
    box.classList.toggle('mismatch', written != null && cents !== written);
  }
  function scanPreview(scan, moving) {
    const inner = scan.image ? '<img alt="Photo of the paper being scanned" src="' + esc(scan.url) + '">' : '<span class="scan-doc">' + icon('file') + '<small>' + esc(scan.file.name) + '</small></span>';
    return '<div class="scan-preview' + (moving ? ' reading' : '') + '">' + inner + (moving ? '<i aria-hidden="true"></i>' : '') + '</div>';
  }
  function scanStart() {
    return '<div class="scan-start">' + para('Take a clear photo of the collection sheet or receipt. The app reads each amount and what it is for, then fills in the record for you to check.') + '<label class="scan-drop">' + icon('camera') + '<strong>Take a Photo or Choose a File</strong><small>JPG, PNG, WEBP or PDF · up to 8 MB</small><input type="file" id="scan-file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>' + '<div class="scan-samples"><span>No paper with you? Try a fictional one.</span>' + Object.entries(ECESScan.samples).filter(([, x]) => me().role !== 'collector' || x.direction === 'in').map(([key, x]) => btn(x.label, 'scanSample', key, 'light', 'file')).join('') + '</div>' + btn('Type the amounts in instead', 'scanManual', '', 'text') + '</div>';
  }
  function scanReading(scan) {
    return scanPreview(scan, true) + '<div class="scan-status" role="status">' + icon('spark', 'sm') + '<span><b>Reading the Amounts</b>Finding each line, what it is for and the total.</span></div>';
  }
  function financeForm(kind, id) {
    const prior = kind === 'finance' && id ? db().batches.find(d => d.id === id) : null;
    const orig = db().batches.find(d => d.id === (kind === 'adjust' ? id : prior?.adjustment)),
      officer = holds('collector');
    const scan = kind === 'finance' && !id && ui.scan?.stage === 'done' ? ui.scan : null,
      read = scan?.reading;
    const initItems = read?.items || prior?.items || [{
      description: '',
      cents: 0
    }];
    const row = x => '<div class="line-item' + (x.check ? ' needs-check' : '') + '">' + input('itemDescription', 'What it is for', x.description, 'text', 'required maxlength="120"') + input('itemAmount', 'Amount (₱)', x.cents ? (x.cents / 100).toFixed(2) : '', 'number', 'required min="0.01" step="0.01"') + btn('Remove', 'removeItem', '', 'light') + (x.check ? '<small class="line-flag">' + icon('alert', 'sm') + esc(x.check) + '</small>' : '') + '</div>';
    const dir = officer ? 'in' : read?.direction || (orig ? orig.direction === 'in' ? 'out' : 'in' : prior?.direction || 'in');
    let source = (prior ? para('Existing original: ' + (prior.file?.name || 'missing')) : '') + upload('Original receipt or contribution sheet');
    if (prior?.file) source = para('Current file: ' + prior.file.name) + upload('Replace original (optional)', false);
    // Only the treasurer may record without a paper original, and must say why. The chairperson sees the reason before approving.
    if (!scan && !officer && holds('treasurer')) source = select('paper', 'Supporting document', [['yes', 'I have the original (photo or PDF)'], ['no', 'There is no paper original']], prior && !prior.file ? 'no' : 'yes') + '<div data-when="paper" data-values="yes">' + source + '</div><div data-when="paper" data-values="no">' + area('noPaperReason', 'Why is there no paper original?', prior?.noPaper || '', 'required minlength="6" maxlength="200" placeholder="For example: a parent gave cash and asked for no receipt"') + notice('The chairperson reads this reason before approving. Write the receipt reference above as something you can find again, such as “Cash gift Nov 17”.') + '</div>';
    let intro = '';
    if (scan) {
      const flagged = read.items.filter(x => x.check).length;
      source = '<div class="scan-attached">' + scanPreview(scan, false) + '<div><b>Scanned Original</b>' + para(scan.file.name + ' is attached for the chairperson.') + btn('Scan a different photo', 'scanAgain', '', 'light', 'camera') + '</div></div>';
      intro = '<div class="scan-result">' + icon('check', 'sm') + '<span><b>' + read.items.length + ' Lines Filled In for You</b>' + esc(flagged ? flagged + ' line' + (flagged === 1 ? ' is' : 's are') + ' marked in gold because the writing was hard to read.' : 'Every line was read clearly.') + ' Compare each one with the paper and fix anything that is wrong.</span></div>' + (read.matchesImage ? '' : notice('Practice mode: this demo cannot read a real photo yet, so it filled in the fictional sample collection amounts. The live app will read the photo you took.'));
    } else if (kind === 'finance' && !id && !isLive()) intro = btn('Scan a photo instead', 'scanAgain', '', 'light', 'camera');
    return intro + form('financeSubmit', (officer || orig ? hidden('direction', dir) + notice(officer ? 'Collection handover · Money in' : 'Linked correction for ' + orig.id + ' · Money ' + dir) : select('direction', 'Movement', [['in', 'Money in'], ['out', 'Money out']], dir)) + hidden('adjustment', orig?.id || prior?.adjustment || '') + input('date', officer ? 'Collection date' : 'Transaction date', read?.date || prior?.date || t(), 'date') + input('receipt', 'Receipt / batch reference', read?.receipt || prior?.receipt || '') + input('purpose', 'Purpose shown to parents', read?.purpose || prior?.purpose || (orig ? 'Correction · ' + orig.purpose : ''), 'text', 'required maxlength="140"') + (orig || officer ? hidden('project', '') : select('project', 'Expense allocation', [['', 'General fund (not for a project)'], ...db().projects.filter(x => x.status !== 'cancelled').map(x => [x.id, x.title])], prior?.project || '')) + '<fieldset><legend>' + (scan ? 'Scanned Line Items' : 'Private Line Items') + '</legend><div id="item-rows">' + initItems.map(row).join('') + '</div>' + btn(scan ? 'Add a missed line' : 'Add item', 'addItem', '', 'light', 'plus') + totalLine(lineSum(initItems), read ? read.writtenTotal : null) + '</fieldset>' + source + ck('verifiedItems', scan ? 'I compared every scanned line with the paper original and corrected anything that was wrong.' : 'I checked the amounts and item descriptions against the supporting document.', true), officer ? 'Submit to treasurer' : 'Submit to chairperson', prior?.id || '');
  }
  function cleanScan() {
    if (ui.scan?.url) URL.revokeObjectURL(ui.scan.url);
    ui.scan = null;
  }
  async function startScan(file) {
    if (!ECESScan.allowed.includes(file.type)) throw Error('Choose a JPG, PNG, WEBP or PDF.');
    cleanScan();
    const scan = ui.scan = {
      stage: 'reading',
      file,
      image: file.type !== 'application/pdf',
      url: URL.createObjectURL(file)
    };
    ui.message = '';
    render();
    try {
      const reading = await ECESScan.read(file, {
        today: t(),
        usedReferences: db().batches.map(x => x.receipt)
      });
      if (ui.scan !== scan) return;
      scan.reading = reading;
      scan.stage = 'done';
      render();
      document.querySelector('.portal-modal [name=itemDescription]')?.focus();
    } catch (e) {
      if (ui.scan !== scan) return;
      cleanScan();
      render();
      showMessage(e.message + ' You can try another photo or type the amounts in.');
    }
  }
  function financeDialog(kind, id) {
    if (kind === 'adjust') return ['Record a linked correction', financeForm(kind, id)];
    const officer = holds('collector');
    if (kind !== 'finance' || id || ui.scan?.stage === 'manual' || isLive()) return [officer ? 'Record a collection handover' : 'Submit finance evidence', financeForm(kind, id)];
    if (!ui.scan) return [officer ? 'Scan a collection handover' : 'Scan a sheet or receipt', scanStart()];
    if (ui.scan.stage === 'reading') return ['Reading the paper', scanReading(ui.scan)];
    return ['Check the scanned amounts', financeForm(kind, id)];
  }
  const weekAhead = () => new Date(Date.parse(t() + 'T12:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  function dialogContents() {
    const kind = ui.dialog,
      id = ui.id,
      a = me();
    const p = db()?.proposals?.find(i => i.id === id),
      r = db()?.resolutions?.find(i => i.id === id),
      b = db()?.ballots?.find(i => i.id === id),
      d = db()?.batches?.find(i => i.id === id);
    if (kind === 'needAccount') return ['Sign in to send', signInPrompt('Guests can read everything here. To send a proposal, suggestion or private concern, sign in with your mobile number so the SPTA knows it comes from an ECES parent.') + btn('Keep browsing as a guest', 'close', '', 'text')];
    if (kind === 'login') return ['Sign in', (S.known().length ? '<div class="known-accounts"><small>Accounts on this phone</small>' + S.known().map(x => '<button type="button" class="known-account" data-do="switchTo" data-id="' + esc(x.login) + '"><b>' + esc(x.name) + '</b><span>' + esc(mask(x.login)) + '</span></button>').join('') + '</div>' : '') + form('login', input('login', 'Mobile number', ui.prefill || '', 'tel', 'required autocomplete="username" placeholder="09171234567"') + input('password', 'Password', '', 'password', 'required autocomplete="current-password"'), 'Sign in') + '<div class="entry-actions">' + btn('Forgot password?', 'dlg:forgot', '', 'text') + btn('Create account', 'dlg:register', '', 'text') + '</div>'];
    if (kind === 'forgot') return ['Reset your password', notice('This works on a phone you have signed in on before. On a new phone, ask an SPTA officer for help.') + form('reset', input('mobile', 'Mobile number', ui.prefill || '', 'tel', 'required autocomplete="username" placeholder="09171234567"') + input('lastName', 'Last name', '', 'text', 'required maxlength="40" autocomplete="family-name"') + gradePair('homeroom', '', 'Your child’s grade and section, as you registered it') + input('password', 'New password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"'), 'Save new password') + btn('Back to sign in', 'dlg:login', '', 'text')];
    if (kind === 'children') return [me().childName ? 'Other students' : 'My students', form('profileUpdate', '<div id="student-rows">' + (a.children || []).concat((a.children || []).length ? [] : ['']).map(x => studentRow(...splitChild(x))).join('') + '</div>' + btn('Add another student', 'addStudent', '', 'light', 'plus'), 'Save list')];
    if (kind === 'cover') return ['Stand in for an absent officer', notice('You do that officer’s tasks until the date you set. A fund record you send or check while standing in gets its final approval from the Vice-Chairperson, so two people still check every record.') + form('cover', select('enabled', 'What would you like to do?', [['yes', 'Stand in for an officer'], ['no', 'Stop standing in']], 'yes') + '<div data-when="enabled" data-values="yes">' + select('role', 'Officer who is away', E.coverRoles.map(r => [r, E.roles[r]]), standIn()) + input('until', 'Until', db().cover?.until || weekAhead(), 'date', 'required min="' + t() + '"') + input('reason', 'Reason', db().cover?.reason || '', 'text', 'required minlength="3" maxlength="150" placeholder="On leave"') + '</div>', 'Save')];
    if (kind === 'withdraw') {
      const item = p || db().cases.find(x => x.id === id);
      if (!item) return ['Withdraw', empty('This is no longer available.')];
      return ['Withdraw ' + (p ? 'proposal' : item.kind === 'concern' ? 'concern' : item.kind === 'inspection' ? 'request' : 'suggestion'), '<h3>' + esc(titleCase(p ? proposalName(p) : item.subject)) + '</h3>' + notice(p ? 'Withdrawing stops the proposal where it is. If the officers are voting on it, the vote is closed. You cannot withdraw it once the School Head has approved it.' : 'Withdrawing tells the reviewer you no longer need a response. It cannot be undone.') + form('withdraw', hidden('kind', p ? 'proposal' : 'case') + ck('confirm', 'Yes, withdraw this.', true), 'Withdraw', id)];
    }
    if (kind === 'deadline') return ['Change closing date', para(b.title) + notice('When this date passes, the vote closes by itself and the result is recorded with the votes received.') + form('voteDeadline', input('closes', 'Voting closes on', E.voteCloses(b), 'date', 'required min="' + t() + '"'), 'Save date', id)];
    if (kind === 'announceEdit' || kind === 'announceRemove') {
      const x = db().announcements.find(i => i.id === id);
      if (!x) return ['Announcement', empty('This announcement was removed.')];
      if (kind === 'announceRemove') return ['Remove announcement', '<h3>' + esc(titleCase(x.title)) + '</h3>' + notice('Removing takes it off every phone. It cannot be undone.') + form('announceRemove', ck('confirm', 'Yes, remove this announcement.', true), 'Remove', id)];
      return ['Edit announcement', form('announceEdit', input('title', 'Announcement title', x.title) + area('body', 'Complete message', x.body, 'required minlength="6" maxlength="1600"') + select('audience', 'Audience', [['everyone', 'All parents and officers'], ['officers', 'Officers only']], x.audience) + input('until', 'Show until (optional)', x.until || '', 'date', ''), 'Save changes', id)];
    }
    if (kind === 'join') return ['Officer sign-up', para('Use the invite code the chairperson gave you. Choose your own mobile number and password. Nobody else will know your password.') + form('join', input('code', 'Invite code', '', 'text', 'required autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX"') + input('mobile', 'Mobile number', '', 'tel', 'required autocomplete="tel" placeholder="09171234567"') + input('password', 'Password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"') + '<details class="privacy-notice"><summary>Read the Privacy Notice</summary>' + privacyBody() + '</details>' + ck('consent', 'I have read the Privacy Notice. I agree that the SPTA may collect and use my information as described.', true), 'Set up my account')];
    if (kind === 'register') return ['Create an account', (isLive() ? '' : notice('Use fictional details for this rehearsal.')) + form('register', '<div class="name-pair">' + input('firstName', 'First name', '', 'text', 'required maxlength="40" autocomplete="given-name"') + input('lastName', 'Last name', '', 'text', 'required maxlength="40" autocomplete="family-name"') + '</div>' + input('mobile', 'Mobile number', '', 'tel', 'required autocomplete="tel" placeholder="09171234567"') + input('childName', 'Your child’s full name', '', 'text', 'required maxlength="80" autocomplete="off"') + gradePair('homeroom', '', 'Your child’s grade and section') + input('password', 'Password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"') + ck('officer', 'I am the HPTA president of this section and I am requesting officer access.') + '<div class="entry-meta">Officer access starts after the School Head or chairperson checks the roster.</div><details class="privacy-notice"><summary>Read the Privacy Notice</summary>' + privacyBody() + '</details>' + ck('consent', 'I have read the Privacy Notice. I agree that the SPTA may collect and use my information, and my child’s grade and section, as described.', true), 'Create account')];
    if (kind === 'privacy') return ['Privacy Notice', privacyBody()];
    if (!a) return ['Sign in', empty('Sign in to continue.')];
    if (kind === 'acting') {
      const active = E.hasDelegation(db());
      return [active ? 'End acting assignment' : 'Assign acting chairperson', form('acting', hidden('enabled', active ? 'no' : 'yes') + (active ? para(db().actingReference) : input('reference', 'School assignment reference') + input('until', 'Last day of assignment', t(), 'date', 'required min="' + t() + '"')), active ? 'End assignment' : 'Save assignment')];
    }
    if (kind === 'inspection') return ['Request records inspection', form('caseSubmit', hidden('kind', 'inspection') + hidden('category', 'Other') + input('subject', 'Record or period requested') + area('body', 'Describe the records you wish to inspect') + para('The secretary receives this request privately. Track the reply in My updates.'), 'Send to secretary')];
    if (kind === 'requestRole') return ['Request BOD access', form('requestRole', gradePair('homeroom', a.homeroom || '', 'Grade and section') + para('The chairperson or School Head will verify your HPTA presidency.'), 'Send request')];
    if (kind === 'roster') {
      const q = db().requests.find(x => x.id === id);
      return ['Verify BOD request', para((q.name || n(q.user)) + ' · ' + q.homeroom) + form('rosterReview', select('decision', 'Decision', [['approve', 'Approve BOD access'], ['return', 'Return with a reason']]) + '<div data-when="decision" data-values="approve">' + select('slot', 'Match the board seat', [['', 'Choose the matching seat'], ...E.availableSeats(db()).map(x => [x.id, x.homeroom + ' · ' + (x.endedAt ? 'Vacant' : x.name)]), ['additional', 'Additional seat confirmed on the roster']], E.availableSeats(db()).find(x => E.homeroomKey(x.homeroom) === E.homeroomKey(q.homeroom))?.id || '', 'required') + ck('verified', 'I matched this person and homeroom to the school roster.', true) + ck('voting', 'This person has a voting seat on the verified roster.', false, true) + '</div><div data-when="decision" data-values="return">' + area('reason', 'Reason') + '</div>', 'Save review', id)];
    }
    if (kind === 'seat') {
      const user = E.account(db(), id);
      return ['Voting seat', para(user.name) + form('setSeat', ck('voting', 'Include this officer in future votes.', false, user.boardSeat) + ck('verified', 'I checked the current school roster.', true), 'Save seat', id) + (user.role === 'bod' ? form('endBod', ck('confirm', 'This HPTA presidency has ended. Remove officer access and retain the parent profile.', true), 'End BOD term', id) : '')];
    }
    if (kind === 'proposal' || kind === 'resubmit') return [kind === 'proposal' ? 'Propose a project' : 'Revise proposal', form(kind === 'proposal' ? 'submitProposal' : 'resubmit', input('title', 'Project title', p?.title || '', 'text', 'required minlength="4" maxlength="100"') + (p ? '' : select('category', 'Category', E.categories)) + area('details', 'What does the school need?', p?.details || '', 'required minlength="8" maxlength="700"') + para('Leave out children’s names and private concerns. The review team checks proposals before sharing them.'), p ? 'Resubmit' : 'Send proposal', p?.id || '')];
    if (['concern', 'suggestion'].includes(kind)) return [kind === 'concern' ? 'Report a private concern' : 'Make a suggestion', form('caseSubmit', hidden('kind', kind) + input('subject', 'Subject', '', 'text', 'required minlength="3" maxlength="100"') + select('category', 'Category', E.categories) + area('body', kind === 'concern' ? 'What happened?' : 'What would you like to improve?', '', 'required minlength="6" maxlength="700"') + hidden('assigned', 'chair') + notice('Only the SPTA chairperson and Vice-Chairperson can read this. They decide whether to share it with the School Head.') + ck('hideName', 'Hide my name from the reviewer') + '<div class="entry-meta">The officer will not see your name or section and will reply here in the app. You can do this ' + E.hiddenPerMonth + ' times a month.</div>' + notice('For an urgent child-safety matter, contact the school’s designated safeguarding staff directly.'), 'Send privately')];
    if (kind === 'screen') return [p.title, '<div class="entry-meta step-line">For screening</div>' + para(p.details) + form('screen', select('decision', 'Next step', [['screen', 'Publish and open the officers’ vote'], ['return', 'Return for revision'], ['decline', 'Decline']]) + '<div data-when="decision" data-values="screen">' + input('title', 'Reviewed title', p.publicTitle || p.title) + area('text', 'Description safe to share', p.publicText || p.details) + input('budget', 'Proposed SPTA allocation (₱)', p.budget / 100, 'number', 'required min="0" step="0.01"') + '<div class="fund-check ok" id="screen-fund" data-available="' + E.funding(db()).available + '">' + icon('info', 'sm') + '<span><b>SPTA funds available now: ' + cash(E.funding(db()).available) + '</b><span id="screen-fund-note">An allocation above this amount will be marked as needing fundraising.</span></span></div>' + ck('fundraising', 'This proposal seeks voluntary contributions.', false, !!p.fundraising) + input('closes', 'Voting closes on', E.voteCloses({date: t()}), 'date', 'required min="' + t() + '"') + '<div class="entry-meta">Officers have one month to vote unless you change this date.</div></div><div data-when="decision" data-values="return decline">' + area('reason', 'Feedback for the parent') + '</div>', 'Save screening', id)];
    if (kind === 'vote') return [b.title, '<div class="entry-meta step-line">For your vote</div>' + para(b.body) + '<div class="entry-meta">Proposed SPTA allocation ' + cash(b.budget) + '</div>' + ballotFund(b) + notice('Voting closes on ' + date(E.voteCloses(b)) + '.') + form('vote', select('vote', 'Your vote', [['', 'Choose a response'], ['yes', 'Proceed'], ['no', 'Do not proceed'], ['abstain', 'Abstain']], '', 'required'), 'Submit once', id)];
    if (kind === 'close') return ['Close voting', para(b.title) + notice('Voting closes by itself once the result is decided. Closing early records the result with the votes received so far.') + form('closeBallot', ck('confirm', 'The voting period has ended. Record the result.', true), 'Close and record', id)];
    if (kind === 'chairProposal' && E.directUsed(db()) >= E.directPerYear) return ['Add for School-Head approval', notice('All ' + E.directPerYear + ' direct proposals for this school year have been used. Send this one through the officers’ vote with “Propose a Project”.') + btn('Propose a project', 'dlg:proposal', '', 'primary', 'plus')];
    if (kind === 'chairProposal') return ['Add for School-Head approval', notice('Direct proposal ' + (E.directUsed(db()) + 1) + ' of ' + E.directPerYear + ' for this school year.') + notice('This proposal skips screening and the officers’ vote and goes straight to the School Head. It will be marked “Added by the chairperson · No officer vote”, including on the resolution.') + form('chairProposal', input('title', 'Project title', '', 'text', 'required minlength="4" maxlength="100"') + select('category', 'Category', E.categories) + area('details', 'Project details', '', 'required minlength="8" maxlength="700"') + input('budget', 'Proposed SPTA allocation (₱)', '', 'number', 'required min="0" step="0.01"') + '<div class="fund-check ok" id="screen-fund" data-available="' + E.funding(db()).available + '">' + icon('info', 'sm') + '<span><b>SPTA funds available now: ' + cash(E.funding(db()).available) + '</b><span id="screen-fund-note">An allocation above this amount will be marked as needing fundraising.</span></span></div>' + ck('fundraising', 'This proposal seeks voluntary contributions.'), 'Send to the School Head')];
    if (kind === 'head') return [p.publicTitle, '<div class="entry-meta step-line">For the School Head’s decision</div>' + para(p.publicText) + (p.direct ? notice('Added by the chairperson. No officer vote was held on this proposal.') : '') + '<div class="entry-meta">Proposed SPTA allocation ' + cash(p.budget) + '</div>' + proposalFund(p) + form('headDecision', select('decision', 'Decision', [['approve', 'Approve project'], ['return', 'Return for revised proposal and new vote'], ['decline', 'Decline']]) + (p.fundraising ? '<div data-when="decision" data-values="approve">' + input('ga', 'General Assembly agreement reference') + ck('concur', 'I record School-Head concurrence for the voluntary contributions.', true) + '</div>' : '') + '<div data-when="decision" data-values="return decline">' + area('reason', 'Reason for the parent') + '</div>', 'Record decision', id)];
    if (kind === 'project' || kind === 'cancel') {
      const proj = db().projects.find(x => x.id === id);
      return [kind === 'cancel' ? 'Cancel project' : 'Update project', para(proj.title) + form('projectUpdate', kind === 'cancel' ? hidden('status', 'cancelled') + area('reason', 'Public cancellation reason') + area('remainder', 'What happened to the remaining ' + cash(proj.budget - E.projectSpend(db(), id)) + '?') : select('status', 'Status', [['in_progress', 'In progress'], ['completed', 'Completed']]) + select('owner', 'Project lead', db().accounts.filter(x => x.active && E.leaders.includes(x.role)).map(x => [x.id, x.name]), proj.owner) + area('phase', 'Public progress update', proj.phase) + input('progress', 'Progress (%)', proj.progress, 'number', 'required min="0" max="100" step="1"'), kind === 'cancel' ? 'Publish cancellation' : 'Publish progress', id)];
    }
    if (kind === 'amend') {
      const proj = db().projects.find(x => x.id === id),
        spent = E.projectSpend(db(), id);
      return ['Change project', para(proj.title + ' · allocation ' + cash(proj.budget) + ' · spent ' + cash(spent)) + notice('The officers’ vote and the signatures cover what was approved, nothing more. A wording fix or a lower amount is recorded and shown to families right away. A higher amount, or a different purpose, goes to a new officer vote and then to the School Head. Putting back an amount the officers already approved needs no new vote.') + form('amendProject', select('kind', 'What is changing?', [['wording', 'Fix the wording (same purpose, same amount)'], ['lower', 'Lower the amount'], ['raise', 'Raise the amount · new vote needed'], ['purpose', 'Change what the money is for · new vote needed']], 'wording') + '<div data-when="kind" data-values="wording purpose">' + input('title', 'Project title', proj.title, 'text', 'required minlength="4" maxlength="100"') + area('text', 'Project details', proj.text, 'required minlength="8" maxlength="700"') + '</div><div data-when="kind" data-values="wording">' + ck('sameMeaning', 'This does not change what the money is for.', true) + '</div><div data-when="kind" data-values="lower raise purpose">' + input('budget', 'Allocation (₱)', '', 'number', 'required min="0.01" step="0.01"') + '</div><div data-when="kind" data-values="raise purpose">' + input('closes', 'Voting closes on (optional)', '', 'date', '') + '</div>' + area('reason', 'Reason for the change, shown to families', '', 'required minlength="8" maxlength="350"'), 'Record change', id)];
    }
    if (kind === 'reply') {
      const c = db().cases.find(x => x.id === id);
      return ['Update status or reply', para(c.subject) + notice('The sender receives an automated response for each status. A personal reply is optional.') + form('caseReply', select('status', 'Status', [['assigned', 'Reviewed'], ['resolved', 'Resolved']], c.status === 'resolved' ? 'resolved' : 'assigned') + area('reply', 'Personal reply (optional)', '', 'maxlength="600"') + input('due', 'Next update by', c.due, 'date') + (c.hidden ? ck('block', 'This was a false or abusive report. Stop this sender from hiding their name again. Their name stays hidden.') : ''), 'Save', id)];
    }
    if (kind === 'forward') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Pass on to the School Head', empty('This is no longer here.')];
      return ['Pass on to the School Head', para(c.subject) + notice('The School Head and the secretary will be able to read this. ' + (c.hidden ? 'The sender’s name stays hidden. ' : '') + 'The sender is told it was passed on, but never sees your note.') + form('caseForward', area('note', 'Note for the School Head (optional)', '', 'maxlength="500" placeholder="What you need from the School Head, or what more you want to know"'), 'Pass on', id)];
    }
    if (kind === 'caseNote') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Note', empty('This is no longer here.')];
      const follow = holds('secretary') && !caseHandler(c);
      return [follow ? 'Record follow-up' : 'Add a note', para(c.subject) + notice(follow ? 'Write what you asked the School Head and what they answered. The chairperson and Vice-Chairperson can read it. The sender cannot.' : 'Seen by the chairperson, the Vice-Chairperson' + (c.forwarded ? ', the School Head and the secretary' : '') + '. The sender cannot read it.') + form('caseNote', area('note', follow ? 'Follow-up' : 'Note', '', 'required minlength="3" maxlength="500"'), 'Save note', id)];
    }
    if (kind === 'proposalReply') return ['Personal reply', para(p.title) + notice('Optional. The person who proposed already receives an automated response at each status. Only they see this reply.') + form('proposalReply', area('reply', 'Your reply as ' + roleName(a), p.reply || '', 'required minlength="3" maxlength="600"'), 'Send personal reply', id)];
    if (kind === 'resolution') return ['Read resolution', resolutionPaper(r, true)];
    if (kind === 'freeze') return ['Edit and publish version ' + r.version, notice('This draft was created automatically from the approved proposal. Adjust the wording if needed. The allocation of ' + cash(r.budget) + ' stays as voted.') + form('freeze', hidden('version', r.version) + input('title', 'Project title', r.title, 'text', 'required minlength="4" maxlength="100"') + area('text', 'Project details', r.text, 'required minlength="8" maxlength="700"') + area('clause', 'Resolution wording', r.clause || E.resolutionText(r.title, r.budget, r.direct)) + select('signerRule', 'Required signatures', [['all', 'All officers'], ['policy', 'Named signers under a documented school rule']]) + '<div data-when="signerRule" data-values="policy">' + input('signerPolicy', 'School signer policy or resolution reference') + '<fieldset><legend>Designated Required Signers</legend><div class="roster-picker">' + r.signers.map(s => '<label class="tick"><input type="checkbox" name="requiredSigners" value="' + esc(s.id) + '"><span>' + esc(s.name) + '</span></label>').join('') + '</div></fieldset></div>' + ck('confirm', 'I verified the wording and required signers against the school record.', true), 'Publish for signatures', id)];
    if (kind === 'sign') return ['Sign resolution', resolutionPaper(r, false) + form('sign', hidden('version', r.version) + select('response', 'My response', [['acknowledged', 'Sign this resolution'], ['not_signed', 'Decline to sign']]) + '<div data-when="response" data-values="acknowledged"><div class="sign-field"><span>Draw your signature</span><canvas class="sign-pad" width="600" height="200" aria-label="Signature box. Draw with your finger or mouse."></canvas><input type="hidden" name="signature" value="">' + btn('Clear', 'signClear', '', 'light') + '</div>' + para('It will appear on the resolution as: ' + a.name + ' · ' + signerLine(a) + ' · ' + date(E.today())) + '</div>' + ck('consent', 'I reviewed this exact version and this is my own response.', true), 'Record my response', id)];
    if (kind === 'fileResolution') return ['File resolution', notice(E.signaturesPending(r).length + ' required signature(s) outstanding. Unanswered and declined responses keep their actual status on the printout.') + form('finalizeResolution', hidden('version', r.version) + area('parentSummary', 'Privacy-reviewed summary for families', r.text) + area('reason', 'Record the applicable signer policy, exceptions and filing reference') + ck('confirm', 'I checked that the required signers have signed under the applicable school procedure.', true), 'File and publish parent summary', id)];
    if (kind === 'reviseResolution') return ['Correct resolution wording', notice('Starting a new version reopens secretary review and requires fresh signatures. Scope or budget changes need a new proposal and vote.') + form('reviseResolution', hidden('version', r.version) + area('reason', 'Reason for a document correction'), 'Start new version', id)];
    if (kind === 'minute') {
      const m = db().minutes.find(x => x.id === id);
      if (!m) return ['Minutes of the meeting', empty('These minutes are no longer waiting.')];
      const mine = m.state === 'for_chair' && canChair() || m.state === 'for_head' && a.role === 'head';
      return [m.state === 'for_chair' ? 'Approve minutes' : m.state === 'for_head' ? 'Note and file minutes' : 'Minutes of the meeting', '<div class="entry-meta">' + esc(m.id + ' · Meeting of ' + date(m.date)) + '</div><h3>' + esc(titleCase(m.title)) + '</h3>' + para(m.summary) + para('Due ' + date(m.due) + (m.state !== 'filed' && m.due < t() ? ' · Overdue' : '')) + '<div class="entry-actions">' + btn('Read original', 'minuteFile', m.id) + (mine ? btn(m.state === 'for_chair' ? 'Approve minutes' : 'Note and file', 'minutesReview', m.id, 'primary') : '') + '</div>'];
    }
    if (kind === 'minutes') return ['Upload meeting minutes', form('minutesUpload', input('title', 'Meeting title') + input('date', 'Meeting date', t(), 'date', 'required max="' + t() + '"') + upload('Signed minutes (photo or PDF)') + area('summary', 'Privacy-reviewed summary for families') + ck('confirm', 'I sign these minutes as secretary and submit them for chair approval.', true), 'Submit minutes')];
    if (kind === 'announce') return ['Publish announcement', form('announce', input('title', 'Announcement title') + area('body', 'Complete message', '', 'required minlength="6" maxlength="1600"') + select('audience', 'Audience', [['everyone', 'All parents and officers'], ['officers', 'Officers only']]) + input('until', 'Show until (optional)', '', 'date', 'min="' + t() + '"'), 'Publish announcement')];
    if (kind === 'finance' || kind === 'adjust') return financeDialog(kind, id);
    if (kind === 'check') return ['Review handover', para(d.purpose + ' · ' + cash(d.cents)) + (d.items || []).map(x => '<div class="list-line"><span>' + esc(x.description) + '</span><b>' + cash(x.cents) + '</b></div>').join('') + btn('Open scanned original', 'evidence', d.id) + form('financeCheck', select('decision', 'Decision', [['approve', 'Approve and send to the chairperson'], ['return', 'Return to the collecting officer']]) + '<div data-when="decision" data-values="approve">' + ck('received', 'I received ' + cash(d.cents) + ' and checked the lines against the scanned original.', true) + '</div><div data-when="decision" data-values="return">' + area('reason', 'What needs correcting?') + '</div>' + para('After your approval, the chairperson gives final approval before it shows in SPTA funds.'), 'Record review', id)];
    if (kind === 'post') return ['Review for posting', para(d.purpose + ' · ' + cash(d.cents)) + (d.noPaper ? notice('There is no paper original for this entry. The treasurer wrote: ' + d.noPaper) : btn('Open supporting original', 'evidence', d.id)) + form('financeReview', select('decision', 'Decision', [['post', 'Approve for posting'], ['return', 'Return for correction']]) + '<div data-when="decision" data-values="post">' + ck('reviewed', d.noPaper ? 'I read why there is no paper original and checked the entries.' : 'I opened the supporting original and checked the entries.', true) + ck('publicSafe', 'The published purpose contains no identifying or bank details.', true) + '</div><div data-when="decision" data-values="return">' + area('reason', 'What needs correcting?') + '</div>' + para('Posting updates the parent fund view. Spending authorization is recorded in the school’s financial process.'), 'Record review', id)];
    if (kind === 'attachment') {
      const f = ui.attachment,
        url = f?.url || '';
      return ['Supporting original', para(f?.name || '') + (f?.type === 'application/pdf' ? '<object class="attachment-pdf" data="' + esc(url) + '" type="application/pdf"><p>Use the file link below to open this PDF.</p></object>' : '<img class="attachment-image" alt="Uploaded supporting document" src="' + esc(url) + '">') + '<a class="btn light" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open file in a new tab</a>'];
    }
    if (kind === 'withdrawFinance' || kind === 'withdrawMinutes' || kind === 'withdrawRequest') {
      const what = kind === 'withdrawFinance' ? 'finance' : kind === 'withdrawMinutes' ? 'minutes' : 'request',
        item = (what === 'finance' ? db().batches : what === 'minutes' ? db().minutes : db().requests).find(x => x.id === id);
      if (!item) return ['Withdraw', empty('This is no longer available.')];
      const label = what === 'finance' ? item.purpose + ' · ' + cash(item.cents) : what === 'minutes' ? item.title : 'BOD access request';
      const rule = what === 'finance' ? 'You can withdraw a record until it is published in SPTA funds. After that, the treasurer records a correction. A withdrawn record stays in the history with your reason, and it never shows in the public funds.' : what === 'minutes' ? 'You can withdraw minutes until the School Head files them. They stay in the history with your reason. Then upload the corrected minutes.' : 'You can withdraw a request until it is reviewed.';
      return ['Withdraw ' + (what === 'finance' ? 'record' : what === 'minutes' ? 'minutes' : 'request'), '<h3>' + esc(label) + '</h3>' + notice(rule) + form('withdrawRecord', hidden('kind', what) + area('reason', 'Why are you withdrawing it?', '', 'required minlength="4" maxlength="300"') + ck('confirm', 'Yes, withdraw this.', true), 'Withdraw', id)];
    }
    if (kind === 'unsign') {
      const r = db().resolutions.find(x => x.id === id);
      if (!r || r.state !== 'signing') return ['Take back my response', empty('This resolution is no longer open for signatures.')];
      return ['Take back my response', '<h3>' + esc(r.title) + '</h3>' + notice('Your signature or your “not signed” answer is removed, and you can respond again. You can do this until the secretary files the record.') + form('unsign', hidden('version', r.version) + ck('confirm', 'Yes, take back my response.', true), 'Take back', id)];
    }
    if (kind === 'reopen') {
      const proj = db().projects.find(x => x.id === id);
      if (!proj) return ['Reopen project', empty('This project is no longer available.')];
      return ['Reopen project', para(proj.title) + notice('Use this if the project was marked completed by mistake. It returns to Ongoing, and the reason is shown in its Changes list.') + form('projectReopen', area('reason', 'Why is it being reopened?', '', 'required minlength="8" maxlength="350"') + input('progress', 'Progress now (%)', 90, 'number', 'required min="0" max="99" step="1"'), 'Reopen project', id)];
    }
    if (kind === 'photo') return photoDialog(id);
    if (kind === 'photoAdd') return photoAddDialog(id);
    if (kind === 'reset') return ['Reset fictional records', notice('This clears the profiles, documents, votes and finance posts in this browser rehearsal.') + btn('Reset fictional demo', 'resetNow', '', 'danger')];
    return ['Account', empty('This action is unavailable.')];
  }
  function cleanAttachment() {
    if (ui.attachment?.url?.startsWith('blob:')) URL.revokeObjectURL(ui.attachment.url);
    ui.attachment = null;
  }
  function openDialog(kind, id) {
    if (kind !== 'attachment') cleanAttachment();
    cleanScan();
    ui.dialog = kind;
    ui.id = id || '';
    ui.message = '';
    render();
    document.querySelector('.portal-modal button')?.focus();
  }
  function closeDialog() {
    cleanAttachment();
    if (ui.dialog === 'attachment' && ui.back) {
      const prev = ui.back;
      ui.back = null;
      return openDialog(prev.kind, prev.id);
    }
    cleanScan();
    ui.dialog = null;
    ui.id = null;
    ui.queue = false;
    ui.prefill = '';
    ui.message = '';
    render();
  }
  function showMessage(s) {
    ui.message = s;
    const el = document.querySelector('#feedback');
    if (el) {
      el.hidden = false;
      el.textContent = s;
      el.scrollIntoView?.({block: 'nearest'});
    } else render();
  }
  function renderFeedback() {
    return '<div id="feedback" class="portal-feedback" role="status" ' + (ui.message ? '' : 'hidden') + '>' + esc(ui.message) + '</div>';
  }
  function updateConditions(scope = document) {
    scope.querySelectorAll('[data-when]').forEach(el => {
      const f = el.closest('form');
      const active = el.dataset.values.split(' ').includes(f?.elements[el.dataset.when]?.value);
      el.hidden = !active;
      el.querySelectorAll('input,select,textarea').forEach(inp => {
        inp.disabled = !active;
      });
    });
  }
  function header() {
    const pic=me()&&!isGuest()&&me().avatar&&ui.avatarUrl&&ui.avatarFor===me().id+':'+me().avatar;
    const accountButton=me()?'<button class="app-icon'+(pic?' has-photo':'')+'" data-do="tab:account" aria-label="'+(isGuest()?'Sign in':'My account')+'">'+(pic?'<img alt="" src="'+esc(ui.avatarUrl)+'">':icon('users'))+'</button>':'';
    const fil=ECESLang.lang==='fil';
    const language='<button type="button" class="lang-toggle" data-do="lang" aria-label="Change language"><span'+(fil?'':' class="on"')+'>EN</span><span'+(fil?' class="on"':'')+'>FIL</span></button>';
    return '<header class="mobile-bar"><div class="mobile-wordmark">'+seal+'<div><b>ECES Bayanihan</b><small><span class="tag-full">An East Central Elementary SPTA Initiative</span><span class="tag-short">An SPTA Initiative</span></small></div></div><div class="header-tools">'+language+accountButton+'</div></header>';
  }
  function render() {
    const root=document.getElementById('app'), a=me();
    let html=header();
    if(!a) {
      html+='<main class="school-launch"><h1>ECES Bayanihan</h1><p role="status">Loading…</p></main>';
    } else {
      const choices=tabs();
      if(!choices.some(x=>x[0]===ui.tab))ui.tab='home';
      const title={home:'SPTA community',cases:{suggestion:'Suggestions raised',concern:'Private concerns'}[ui.caseFilter],projects:'SPTA projects',funds:'SPTA funds'}[ui.tab]||choices.find(x=>x[0]===ui.tab)[1];
      const topAction='';
      const backButton=isSub(ui.tab)?'<button type="button" class="back-btn" data-do="back" aria-label="Back">'+icon('chevron','sm')+'<span>Back</span></button>':'';
      const sectionHead=backButton+'<div class="mobile-heading"><div><span>'+esc(roleName(a))+'</span><h1>'+esc(titleCase(title))+'</h1></div>'+topAction+'</div>';
      html+='<main class="mobile-main">'+sectionHead+(!ui.dialog?renderFeedback():'')+'<div id="desk-content">'+sections[ui.tab]()+'</div></main>';
      html+=mobileNav(choices);
    }
    html+='<footer class="portal-foot">East Central Elementary School SPTA · '+(isLive()?'':(S.shared?'Shared rehearsal · Fictional data':S.sessionOnly?'Session-only demo · Changes last until this page closes.':'Practice mode · Fictional records on this device')+' · ')+'<button type="button" class="link-btn" data-do="dlg:privacy">Privacy Notice</button></footer>';
    if (ui.dialog) {
      const parts = dialogContents(), about = dialogKind(), inQueue = ui.queue && about && about.at >= 0, more = inQueue && about.at < about.list.length - 1;
      const queueBar = inQueue ? '<div class="queue-bar"><span>' + (about.at + 1) + ' of ' + about.list.length + ' waiting for you</span>' + (more ? '<button class="queue-skip" data-do="queue:next">Skip for Now' + icon('arrow', 'sm') + '</button>' : '<button class="queue-skip" data-do="close">Back to the List</button>') + '</div>' : '';
      html += '<div class="portal-overlay"><section class="portal-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div class="dialog-title">' + (about ? kindChip(about.kind) : '') + '<h2 id="dialog-title">' + esc(titleCase(parts[0])) + '</h2></div>' + btn('Close', 'close') + '</header>' + queueBar + renderFeedback() + '<div class="modal-inner">' + parts[1] + '</div></section></div>';
    }
    const popup = announcementPopup();
    html += popup;
    if (ui.printId && a && E.printers.includes(a.role)) {
      const r = ui.printRecord;
      if (r && r.id === ui.printId) html += '<div class="print-only">' + resolutionPaper(r, true) + '</div>';
    }
    root.innerHTML = html;
    updateConditions();
    ECESLang.apply(root);
    loadPhotos(root);
    loadAvatar();
    document.body.classList.toggle('modal-open', !!ui.dialog || !!popup);
  }
  const success = {
    register: 'Account created. You are signed in.',
    join: 'Your officer account is ready. You are signed in.',
    login: 'Signed in.',
    requestRole: 'BOD request sent for verification.',
    rosterReview: 'Roster decision saved.',
    screen: 'Screening saved. A published proposal is now open for the officers’ vote.',
    closeBallot: 'Voting closed and the result recorded.',
    vote: 'Your vote was recorded once.',
    headDecision: 'Decision recorded. An approved project now goes to the secretary, who reviews the resolution.',
    freeze: 'Published. Every officer now sees it on their home page to sign.',
    sign: 'Your response was recorded on the resolution.',
    financeSubmit: 'Submitted for approval.',
    financeCheck: 'Handover review recorded.',
    financeReview: 'Finance decision recorded.',
    announce: 'Published. It will pop up on screen for its audience.',
    minutesUpload: 'Minutes sent to the chairperson.',
    minutesReview: 'Minutes updated.',
    caseReply: 'Saved. The sender was told the new status.',
    caseForward: 'Passed on. The School Head and the secretary can read it now.',
    caseNote: 'Note saved.',
    proposalReply: 'Personal reply sent.',
    chairProposal: 'Sent to the School Head for approval.',
    projectUpdate: 'Project status published.',
    withdrawRecord: 'Withdrawn. It stays in the history with your reason.',
    unsign: 'Your response was taken back. You can respond again.',
    projectReopen: 'The project is open again.',
    projectPhoto: 'Photo added. It shows to the public once the chairperson approves it.',
    projectPhotoReview: 'Decision saved.',
    projectPhotoRemove: 'Photo removed.',
    amendProject: 'Change recorded. If it needs a new officer vote, the vote is now open.',
    withdraw: 'Withdrawn.',
    voteDeadline: 'Closing date saved.',
    cover: 'Saved.',
    profileUpdate: 'List saved.',
    announceEdit: 'Announcement updated.',
    announceRemove: 'Announcement removed.'
  };
  async function change(action, payload, requestId) {
    const id = await S.run(action, payload, requestId);
    cleanScan();
    ui.dialog = null;
    ui.back = null;
    ui.queue = false;
    ui.message = (success[action] || 'Saved.') + (id ? ' ' + id : '');
    render();
    return id;
  }
  async function attachment(type, id) {
    const item = type === 'evidence' ? db().batches.find(x => x.id === id) : db().minutes.find(x => x.id === id);
    if (!item || !(type === 'evidence' ? canChair() || holds('treasurer') || canPost(item) || item.owner === S.me : canPrint())) throw Error('You do not have access to this document.');
    if (!item.file) throw Error('This record needs a new original.');
    const url = await S.fileURL(item.file);
    cleanAttachment();
    ui.attachment = {
      ...item.file,
      url
    };
    if (ui.dialog) ui.back = {
      kind: ui.dialog,
      id: ui.id
    };
    if (type === 'evidence') ui.reviewed.add(S.me + '|' + E.openStamp(item));
    openDialog('attachment', id);
  }
  function csvExport() {
    const rows = [['Reference', 'Title', 'Status'], ...db().proposals.filter(E.publicProposal).map(p => [p.id, p.publicTitle, labels[p.status] || p.status])];
    const safe = v => {
      let s = String(v ?? '');
      if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(x => x.map(safe).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eces-screened-proposals.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  // A tap anywhere outside an open window closes it. The tap must start outside too, so selecting
  // text inside a form and releasing outside does not close it, and the tap that opens a window does not close it.
  let outsideTap = '';
  document.addEventListener('pointerdown', ev => {
    const inside = !!ev.target.closest('.portal-modal');
    outsideTap = inside ? '' : ui.dialog ? 'dialog' : document.querySelector('.announce-pop') ? 'announcement' : '';
  }, true);
  document.addEventListener('click', ev => {
    const kind = outsideTap;
    outsideTap = '';
    if (!kind || ui.busy) return;
    if (kind === 'announcement') document.querySelector('.announce-pop [data-do="announceSeen"]')?.click();
    else closeDialog();
  });
  document.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-do]');
    if (!el || ui.busy) return;
    const act = el.dataset.do,
      id = el.dataset.id || '';
    try {
      if (act === 'lang') return ECESLang.toggle();
      if (act === 'back') return goBack();
      if (act === 'pwToggle') {
        const box = el.closest('.pw-field'),
          field = box && box.querySelector('input');
        if (!field) return;
        const show = field.type === 'password';
        field.type = show ? 'text' : 'password';
        el.innerHTML = icon(show ? 'eyeOff' : 'eye');
        el.setAttribute('aria-pressed', show ? 'true' : 'false');
        el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        return;
      }
      if (act === 'avatarRemove') {
        ui.avatarBusy = true;
        render();
        try {
          await S.removeAvatar();
          clearAvatar();
          showMessage('Profile picture removed.');
        } finally {
          ui.avatarBusy = false;
          render();
        }
        return;
      }
      if (act === 'histfilter') {
        ui.historyFilter = id;
        return render();
      }
      if (act === 'queue:next') {
        const next = todo()[(dialogKind()?.at ?? -1) + 1];
        if (!next) return closeDialog();
        ui.queue = true;
        return openDialog(next[3].slice(4), next[4]);
      }
      if (act.startsWith('tab:')) {
        ui.queue = false;
        const next = act.slice(4);
        if (!isSub(next)) ui.back = '';
        else if (next === 'account' || !isSub(ui.tab)) ui.back = ui.tab;
        else ui.back = ui.back || 'more';
        ui.tab = next;
        ui.caseFilter = ui.tab === 'cases' ? id : '';
        ui.dialog = null;
        ui.printId = null;
        ui.message = '';
        render();
        window.scrollTo(0, 0);
        return;
      }
      if (guestOnly.includes(act) && isGuest()) return openDialog('needAccount', '');
      if (act.startsWith('dlg:')) {
        ui.queue = !!el.dataset.queue;
        return openDialog(act.slice(4), id);
      }
      if (act === 'close') return closeDialog();
      if (act === 'addItem') {
        const rows = document.getElementById('item-rows');
        if (rows.children.length >= 60) return;
        const node = rows.firstElementChild.cloneNode(true);
        node.querySelectorAll('input').forEach(x => {
          x.value = '';
        });
        node.classList.remove('needs-check');
        node.querySelector('.line-flag')?.remove();
        rows.appendChild(node);
        node.querySelector('input').focus();
        return;
      }
      if (act === 'addStudent') {
        const rows = document.getElementById('student-rows');
        if (rows.children.length >= 8) return;
        const node = rows.firstElementChild.cloneNode(true);
        node.querySelectorAll('input').forEach(x => {
          x.value = '';
        });
        node.querySelectorAll('select').forEach(x => {
          x.value = '';
        });
        rows.appendChild(node);
        node.querySelector('input').focus();
        return;
      }
      if (act === 'removeStudent') {
        const row = el.closest('.student-row');
        if (row.parentNode.children.length > 1) row.remove();
        else row.querySelectorAll('input,select').forEach(x => {
          x.value = '';
        });
        return;
      }
      if (act === 'removeItem') {
        const row = el.closest('.line-item');
        if (row.parentNode.children.length > 1) row.remove();
        refreshTotal();
        return;
      }
      if (act === 'announceSeen') {
        const key = 'seen-' + (S.me || 'guest');
        seenStore.write(key, [...new Set([...(seenStore.read(key) || []), id])]);
        render();
        document.querySelector('.announce-pop button')?.focus();
        return;
      }
      if (act === 'signClear') {
        const pad = el.parentNode.querySelector('.sign-pad');
        pad.strokes = [];
        drawPad(pad, pad.strokes);
        return;
      }
      if (act === 'scanManual' || act === 'scanAgain') {
        cleanScan();
        if (act === 'scanManual') ui.scan = {
          stage: 'manual'
        };
        ui.message = '';
        render();
        return;
      }
      if (act === 'scanSample') {
        ui.busy = true;
        const file = await ECESScan.sampleFile(id, {
          today: t(),
          usedReferences: db().batches.map(x => x.receipt)
        });
        ui.busy = false;
        return void startScan(file).catch(e => showMessage(e.message));
      }
      ui.busy = true;
      if (act === 'print') {
        if (!canPrint() || !db().resolutions.some(x => x.id === id && x.state !== 'draft')) throw Error('Printing this version is restricted.');
        ui.printRecord = await S.printRecord(id);
        ui.printId = id;
        render();
        window.print();
        return;
      }
      if (act === 'evidence' || act === 'minuteFile') return await attachment(act, id);
      if (act === 'support' || act === 'minutesReview') return await change(act, {
        id
      }, S.random());
      if (act === 'setting') return await change('automationSetting', {
        setting: id,
        enabled: !db().settings[id]
      }, S.random());
      if (act === 'practiceBallots') {
        await S.practiceBallots(id);
        ui.message = 'Practice only: the other fictional members cast sample ballots.';
        render();
        return;
      }
      if (act === 'export') {
        csvExport();
        return;
      }
      if (act === 'switchTo') {
        // Another account on this phone: the sign-in window opens with its number filled in.
        ui.prefill = id;
        ui.queue = false;
        return openDialog('login', '');
      }
      if (act === 'logout') {
        await S.logout();
        ui.tab = 'home';
        ui.reviewed.clear();
        ui.message = '';
        render();
        return;
      }
      if (act === 'resetNow') {
        await S.reset();
        announceBaseline(true);
        ui.dialog = null;
        ui.reviewed.clear();
        ui.tab = 'home';
        ui.message = 'Fresh fictional records restored.';
        render();
      }
    } catch (e) {
      showMessage(e.message);
    } finally {
      ui.busy = false;
    }
  });
  // Signature pad: the officer's own strokes become short line paths in a 300 by 100 box.
  let pen = null;
  function penPoint(ev, pad) {
    const box = pad.getBoundingClientRect();
    return [Math.max(0, Math.min(300, Math.round((ev.clientX - box.left) / box.width * 300))), Math.max(0, Math.min(100, Math.round((ev.clientY - box.top) / box.height * 100)))];
  }
  function drawPad(pad, strokes) {
    const c = pad.getContext('2d');
    c.clearRect(0, 0, pad.width, pad.height);
    c.lineWidth = 4;
    c.lineCap = c.lineJoin = 'round';
    c.strokeStyle = '#102b59';
    strokes.forEach(line => {
      c.beginPath();
      line.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x * 2, y * 2));
      c.stroke();
    });
    const field = pad.parentNode.querySelector('[name=signature]');
    const kept = strokes.filter(line => line.length > 1);
    field.value = kept.map(line => line.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ')).join(' ');
  }
  document.addEventListener('pointerdown', ev => {
    const pad = ev.target.closest?.('.sign-pad');
    if (!pad) return;
    ev.preventDefault();
    pad.strokes ||= [];
    if (pad.strokes.reduce((sum, line) => sum + line.length, 0) > 700) return;
    pen = pad;
    pad.setPointerCapture?.(ev.pointerId);
    pad.strokes.push([penPoint(ev, pad)]);
  });
  document.addEventListener('pointermove', ev => {
    if (!pen) return;
    const line = pen.strokes.at(-1),
      point = penPoint(ev, pen),
      last = line.at(-1);
    if (Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) < 2 || pen.strokes.reduce((sum, l) => sum + l.length, 0) > 700) return;
    line.push(point);
    drawPad(pen, pen.strokes);
  });
  const penUp = () => {
    if (pen) drawPad(pen, pen.strokes);
    pen = null;
  };
  document.addEventListener('pointerup', penUp);
  document.addEventListener('pointercancel', penUp);
  document.addEventListener('input', ev => {
    if (ev.target.name === 'itemAmount') refreshTotal();
    const box = ev.target.name === 'budget' && document.getElementById('screen-fund');
    if (box) {
      const short = Math.round((Number(ev.target.value) || 0) * 100) - Number(box.dataset.available);
      box.className = 'fund-check ' + (short > 0 ? 'short' : 'ok');
      document.getElementById('screen-fund-note').textContent = short > 0 ? 'Needs fundraising · short by ' + cash(short) + '.' : 'Covered by available SPTA funds.';
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'avatar-file') {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      ui.avatarBusy = true;
      render();
      squarePicture(file).then(blob => S.setAvatar(blob)).then(() => {
        clearAvatar();
        showMessage('Profile picture saved.');
      }).catch(e => showMessage(e.message)).finally(() => {
        ui.avatarBusy = false;
        render();
      });
      return;
    }
    if (ev.target.id === 'scan-file') {
      const file = ev.target.files?.[0];
      if (file) startScan(file).catch(e => showMessage(e.message));
      return;
    }
    if (ev.target.id === 'practice-profile') {
      try {
        if (ev.target.value === 'guest') S.logout();else S.sample(ev.target.value);
        ui.tab = 'home';
        ui.reviewed.clear();
        ui.printId = null;
        ui.message = '';
        render();
      } catch (e) {
        showMessage(e.message);
      }
      return;
    }
    if (ev.target.closest('form')) updateConditions(ev.target.closest('form'));
  });
  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    if (ui.busy) return;
    ui.busy = true;
    const submitButton = f.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const idleLabel = submitButton.textContent;
    if (f.dataset.form === 'projectPhoto') submitButton.textContent = 'Publishing…';
    const action = f.dataset.form,
      data = new FormData(f),
      payload = {};
    data.forEach((val, key) => {
      if (typeof val === 'string') payload[key] = val;
    });
    f.querySelectorAll('input[type=checkbox]:not([disabled])').forEach(box => {
      if (!['present', 'requiredSigners'].includes(box.name)) payload[box.name] = box.checked;
    });
    payload.id = f.dataset.id;
    let token = f.dataset.token;
    if (!token) {
      token = S.random();
      f.dataset.token = token;
    }
    try {
      if ('homeroomGrade' in payload) {
        payload.homeroom = joinGrade(payload.homeroomGrade, payload.homeroomSection || '');
        delete payload.homeroomGrade;
        delete payload.homeroomSection;
      }
      if (action === 'login' || action === 'register' || action === 'join') {
        if (action === 'register') {
          payload.role = payload.officer ? 'bod' : 'parent';
          delete payload.officer;
        }
        await S[action](payload);
        ui.prefill = '';
        ui.tab = action === 'register' ? 'account' : 'home';
        cleanScan();
        ui.dialog = null;
        ui.reviewed.clear();
        ui.message = success[action];
        render();
        return;
      }
      if (action === 'reset') {
        await S.resetPassword(payload);
        ui.tab = 'home';
        ui.dialog = null;
        ui.prefill = '';
        ui.reviewed.clear();
        ui.message = 'Password changed. You are signed in.';
        render();
        return;
      }
      if (action === 'acting' || action === 'cover') payload.enabled = payload.enabled === 'yes';
      if (action === 'profileUpdate') {
        const names = data.getAll('childName'),
          grades = data.getAll('childGrade'),
          sections = data.getAll('childSection');
        payload.children = [];
        grades.forEach((g, i) => {
          const sec = String(sections[i] || '').trim(),
            nm = String(names[i] || '').trim();
          if (!g && !sec && !nm) return;
          if (!g || !sec || !nm) throw Error('Type the name, choose a grade and type a section for each student.');
          payload.children.push(joinChild(nm, g, sec));
        });
      }
      if (action === 'freeze' && payload.signerRule === 'policy') payload.requiredSigners = data.getAll('requiredSigners');
      if (action === 'financeSubmit') {
        const descriptions = data.getAll('itemDescription'),
          amounts = data.getAll('itemAmount');
        payload.items = descriptions.map((description, i) => ({
          description,
          amount: amounts[i]
        }));
        delete payload.itemDescription;
        delete payload.itemAmount;
        if (payload.direction === 'in') payload.project = '';
        if (payload.paper === 'no') payload.noPaper = true;
        delete payload.paper;
      }
      if (action === 'sign' && payload.response === 'acknowledged' && !payload.signature) throw Error('Draw your signature in the box first.');
      if (action === 'financeReview') {
        const batch = db().batches.find(x => x.id === payload.id);
        payload.stamp = E.openStamp(batch);
        if (payload.decision === 'post' && !batch.noPaper && !ui.reviewed.has(S.me + '|' + payload.stamp)) throw Error('Open the supporting original before approving this post.');
      }
      let file = data.get('attachment');
      if (file?.size && action === 'projectPhoto') file = await shrinkImage(file);
      if (file?.size) payload.file = await within(S.fileMeta(file), 30000, 'Saving the file took too long. Check your connection and try again.');else if (action === 'financeSubmit' && ui.scan?.stage === 'done') payload.file = ui.scan.meta ||= await S.fileMeta(ui.scan.file);
      if (['submitProposal', 'caseSubmit', 'resubmit'].includes(action)) ui.tab = 'updates';
      if (action === 'headDecision' && payload.decision === 'approve') ui.tab = 'projects';
      await change(action, payload, token);
    } catch (e) {
      showMessage(e.message);
    } finally {
      ui.busy = false;
      submitButton.disabled = false;
      submitButton.textContent = idleLabel;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.dialog && !ui.busy) closeDialog();
    if (e.key === 'Tab' && ui.dialog) {
      const all = [...document.querySelectorAll('.portal-modal button,.portal-modal input,.portal-modal select,.portal-modal textarea,.portal-modal a')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!all.length) return;
      const edge = e.shiftKey ? all[0] : all.at(-1);
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? all.at(-1) : all[0]).focus();
      }
    }
  });
  window.addEventListener('afterprint', () => {
    ui.printId = null;
    ui.printRecord = null;
    render();
  });
  async function refresh() {
    if (ui.busy || ui.dialog || !S.db) return;
    try {
      const rev = db().revision;
      await S.refresh();
      if (rev !== db()?.revision || !me()) render();
    } catch (e) {
      showMessage(e.message);
    }
  }
  // A quick sideways swipe on a screen opened from More goes back. It ignores forms, sliders, photo strips and open dialogs.
  if (typeof document.addEventListener === 'function') {
    let swipe = null;
    document.addEventListener('touchstart', ev => {
      swipe = null;
      if (ui.dialog || !me() || !isSub(ui.tab) || !ev.touches || ev.touches.length !== 1) return;
      const t = ev.target;
      if (t && t.closest && t.closest('input,textarea,select,[data-noswipe],.proj-photos,.portal-overlay')) return;
      swipe = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, at: Date.now() };
    }, { passive: true });
    document.addEventListener('touchmove', ev => {
      if (swipe && ev.touches && ev.touches[0]) {
        swipe.lx = ev.touches[0].clientX;
        swipe.ly = ev.touches[0].clientY;
      }
    }, { passive: true });
    document.addEventListener('touchend', ev => {
      if (!swipe) return;
      const end = ev.changedTouches && ev.changedTouches[0] ? { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY } : { x: swipe.lx ?? swipe.x, y: swipe.ly ?? swipe.y };
      const dx = end.x - swipe.x,
        dy = end.y - swipe.y,
        fast = Date.now() - swipe.at < 700;
      swipe = null;
      if (fast && Math.abs(dx) >= 90 && Math.abs(dy) <= 45 && Math.abs(dx) > 2.2 * Math.abs(dy)) goBack();
    }, { passive: true });
  }
  S.notice.addEventListener('message', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => showMessage(S.shared ? 'Connection lost. Keep this page open and retry when connected.' : 'Your fictional rehearsal is stored on this device.'));
  S.init().then(() => {
    if (!S.shared && oldView) {
      const route = {
        head: ['head', 'insights'],
        spta: ['chair', 'proposals'],
        bod: ['bod-1', 'board'],
        treasurer: ['treasurer', 'finance'],
        parent: ['parent', 'home'],
        automation: ['head', 'cases']
      }[oldView];
      if (route) {
        S.sample(route[0]);
        ui.tab = route[1];
      }
    }
    announceBaseline();
    ECESLang.start(render);
    render();
    if (location.hash === '#privacy') openDialog('privacy', '');
    if (S.shared) setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
  }).catch(e => {
    document.getElementById('app').innerHTML = '<main class="login-shell"><h1>Open ECES Bayanihan</h1>' + para('The rehearsal could not open its local storage. Use localhost and allow this site to save data, or start the shared rehearsal server.') + para(e.message) + '</main>';
  });
})();
