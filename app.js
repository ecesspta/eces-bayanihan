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
  const longDate = d => d ? new Intl.DateTimeFormat('en-US', {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila'}).format(new Date(d)) : '';
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
    return '<div class="portal-overlay announce-overlay"><section class="portal-modal announce-pop" role="alertdialog" aria-modal="true" aria-labelledby="announce-title"><div class="announce-head"><span class="notice-symbol">' + icon('megaphone') + '</span><div><small>SPTA Announcement' + (waiting.length > 1 ? ' · 1 of ' + waiting.length : '') + '</small><h2 id="announce-title">' + ut(titleCase(x.title)) + '</h2></div></div><div class="modal-inner"><div class="entry-meta">' + esc(date(x.date)) + ' · From the ' + esc(from) + (x.audience === 'officers' ? ' · Officers only' : '') + '</div>' + upara(x.body) + '<div class="form-end">' + btn(waiting.length > 1 ? 'Next' : 'Got it', 'announceSeen', x.id, 'primary') + '</div></div></section></div>';
  }
  const oldView = new URLSearchParams(location.search).get('view');
  function btn(label, action, id = '', style = 'light', ic = '') {
    return '<button type="button" class="btn ' + style + '" data-do="' + esc(action) + '" data-id="' + esc(id) + '">' + (ic ? icon(ic, 'sm') : '') + esc(label) + '</button>';
  }
  const empty = s => '<div class="portal-empty">' + esc(s) + '</div>';
  const notice = s => '<div class="portal-note">' + esc(s) + '</div>';
  const section = (title, body) => '<section class="portal-section"><h2>' + esc(titleCase(title)) + '</h2>' + body + '</section>';
  function card(title, body, meta = '', status = '', actions = '', sentence = false, user = false) {
    return '<article class="entry"><div class="entry-top"><span class="entry-meta">' + esc(meta) + '</span>' + (status ? badge(status) : '') + '</div><h3' + (user ? ' class="ut"' : '') + '>' + esc(sentence ? title : titleCase(title)) + '</h3>' + body + (actions ? '<div class="entry-actions">' + actions + '</div>' : '') + '</article>';
  }
  const para = s => s ? '<p class="wrap-lines">' + esc(s) + '</p>' : '';
  // Text that officers typed for the community. With Filipino chosen and the server able to translate, it is translated.
  // Private suggestions and concerns, names and contact details are never marked.
  const upara = s => s ? '<p class="wrap-lines ut">' + esc(s) + '</p>' : '';
  const ut = s => '<span class="ut">' + esc(s) + '</span>';
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
      steps = item.urgent ? ['Received', 'Referred to School', 'Confirmed by School', 'School Handling', 'Closed'] : item.kind === 'inspection' ? ['Received', 'Reviewed', 'Resolved'] : ['Received', 'Reviewed', 'Action Taken', 'Resolved'];
      at = item.urgent ? (item.status === 'resolved' ? 4 : item.schoolHandling ? 3 : item.schoolAck ? 2 : 1) : item.kind === 'inspection' ? {received: 0, assigned: 1, resolved: 2}[item.status] ?? 0 : {received: 0, assigned: 1, action_taken: 2, resolved: 3}[item.status] ?? 0;
      if (item.status === 'withdrawn') stop = labels.withdrawn;
    } else {
      steps = item.direct ? ['Added by chairperson', 'School Head', 'Approved'] : item.noVote ? ['Received', 'Reviewed', 'School Head', 'Approved'] : ['Received', 'Reviewed', 'Officer vote', 'School Head', 'Approved'];
      at = item.direct ? {awaiting_head: 0, returned: 1, declined: 1}[item.status] ?? 2 : item.noVote ? {received: 0, awaiting_head: 2, returned: 1, declined: 2}[item.status] ?? 3 : {received: 0, screened: 1, voting: 1, awaiting_head: 2, approved: 4, in_progress: 4, completed: 4, cancelled: 4, returned: 1, declined: 1, not_adopted: 2}[item.status] ?? 0;
      if (['returned', 'declined', 'not_adopted', 'withdrawn'].includes(item.status)) stop = labels[item.status];
    }
    const list = steps.map((name, i) => '<li class="' + (i < at || i === at && !stop ? 'done' : i === at ? 'stop' : i === at + 1 && !stop ? 'next' : '') + '"><i></i><span>' + esc(i === at && stop ? stop : name) + '</span></li>').join('');
    const who = item.kind && E.onDesk(item) ? 'SPTA' : item.replyBy ? E.recipients[item.replyBy] || E.roles[item.replyBy] : 'reviewer';
    return '<ol class="tracker" aria-label="Status: ' + esc(stop || steps[at]) + '">' + list + '</ol><div class="auto-reply"><small>Automated response</small>' + para(E.autoReply(item)) + '</div>' + (item.reply ? '<div class="portal-note personal"><b>Personal Reply from the ' + esc(titleCase(who)) + '</b>' + para(item.reply) + (item.replyAt ? '<small>' + esc(date(item.replyAt)) + '</small>' : '') + '</div>' : '');
  }
  const signInPrompt = text => '<div class="sign-prompt">' + para(text) + '<div class="entry-actions">' + btn('Sign in', 'dlg:login', '', 'primary') + btn('Create account', 'dlg:register') + (S.shared ? btn('I am an officer with an invite code', 'dlg:join', '', 'text') : '') + '</div></div>';
  const fromLine = x => x.endorsed?.to === S.me && !lead() ? (x.sender?.homeroom ? '<div class="entry-meta">From a parent in ' + esc(x.sender.homeroom) + '</div>' : '') : x.sender?.name ? '<div class="entry-meta">From ' + esc(x.sender.name) + (x.sender.homeroom ? ' · ' + esc(x.sender.homeroom) : '') + '</div>' : '';
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
  // Privacy Notice (November 2026). Three facts can be added once the school confirms them; each line shows only when filled in.
  const PRIVACY_FACTS = {
    controller: '', // Responsible organization or Personal Information Controller
    contact: '', // Official privacy contact
    providers: '' // Verified service providers and storage locations
  };
  const PRIVACY_DRAFT = false;
  const PRIVACY_VERSION = '2026-11c';
  const PRIVACY = [
    ['1. About ECES Bayanihan', ['ECES Bayanihan is a digital platform developed to support the activities of the East Central Elementary School SPTA and its coordination with the school administration.', 'The application helps parents and authorized officers participate in SPTA activities, submit proposals and suggestions, review approved projects, access financial reports, and communicate concerns.', 'Certain concerns involving school operations or children’s safety may be referred to authorized school personnel for appropriate handling.', 'ECES Bayanihan is a coordination and communication platform. It does not replace official school procedures, emergency services, or formal disciplinary processes.', () => PRIVACY_FACTS.controller && '**Responsible organization or Personal Information Controller:** ' + PRIVACY_FACTS.controller, () => PRIVACY_FACTS.contact && '**Official privacy contact:** ' + PRIVACY_FACTS.contact]],
    ['2. Information We Collect', ['Depending on how you use the application, we may collect:', '**Account information**', ['Your name and mobile number.', 'Your child’s name, grade, and section.', 'Information about additional children you voluntarily register.', 'Your account role and applicable officer designation.', 'Your optional profile picture.'], '**SPTA participation records**', ['Proposals, suggestions, and requests.', 'Voting records, meeting minutes, and resolutions.', 'Authorized electronic signatures.', 'Project updates, financial documents, receipts, and photographs.'], '**Private concerns and referrals**', ['Information you submit about a concern.', 'Supporting photographs or documents.', 'Questions, replies, follow-up messages, and case updates.', 'Referral details and actions recorded by authorized personnel.'], '**Technical and security information**', ['Device identifiers used for account security.', 'Sign-in and session information stored on your device.', 'Relevant account activity and security logs.', 'Records of important administrative actions.'], 'Please provide only information reasonably necessary for the purpose of your submission.']],
    ['3. How We Use Your Information', ['We use the information collected to:', ['Create and manage user accounts.', 'Verify SPTA officer roles and access permissions.', 'Facilitate proposals, voting, resolutions, and approved SPTA projects.', 'Publish approved announcements and financial information.', 'Review suggestions and respond to ordinary private concerns.', 'Coordinate school-related matters with authorized school personnel.', 'Refer possible child-protection concerns to the school.', 'Maintain records needed for accountability and appropriate recordkeeping.', 'Protect the application against unauthorized access and misuse.'], 'Personal information will not be used for unrelated activities without an appropriate lawful basis.']],
    ['4. Who Can Access Your Information', ['Access depends on the type of information and the user’s authorized role.', '**Public information**', 'Visitors may view announcements, approved projects, published financial reports, and other information approved for public release.', '**Ordinary suggestions and private concerns**', 'The SPTA Chairperson and Vice-Chairperson review ordinary suggestions and private concerns.', 'When appropriate, they may assign an SPTA-related matter to an authorized officer, including a section president serving on the Board of Directors.', 'Only information needed for the assigned responsibility should be shared.', '**School-related concerns**', 'Concerns requiring school action may be forwarded to the School Head.', 'The SPTA Secretary, who also serves as the School Head’s acting secretary, may access forwarded school-related concerns according to her authorized responsibilities.', 'The School Head retains oversight and may take action directly.', '**Possible child-protection concerns**', 'Reports submitted directly through the child-safety reporting option are intended to be accessible only to the School Head and school personnel specifically authorized for child-protection intake.', 'The SPTA Secretary may access these reports in her authorized school capacity only when the School Head has expressly designated her to receive them.', 'Her position as SPTA Secretary does not automatically grant access to child-protection reports.', 'Ordinary SPTA officers and Board members are not authorized to investigate or independently access directly submitted child-protection reports.', 'If an ordinary concern is subsequently identified as a possible child-protection matter, the officers who originally received it may already have seen its contents. The report must then be referred to authorized school personnel for further handling.', 'Information contained in a child-protection report must not be disclosed to ordinary SPTA officers merely because the school later determines that it does not require child-protection handling.', 'Any later referral for ordinary SPTA action must be limited to the information reasonably necessary for that action.']],
    ['5. Child Safety and Protection', ['Reports involving possible bullying, abuse, violence, or other threats to a child’s safety are referred to the school for appropriate assessment and action under its child-protection procedures.', 'The SPTA does not investigate allegations, interview children, contact other families to verify reports, or impose disciplinary measures through this application.', 'Only authorized school personnel are responsible for official assessment, investigation, and intervention.', 'Please avoid uploading unnecessary photographs showing children’s faces or documents containing unrelated personal information.', 'If a child is in immediate danger, contact the child’s class adviser, school administration, or appropriate emergency authorities directly.', '**ECES Bayanihan is not an emergency reporting channel.**']],
    ['6. Hidden-Name Submissions', ['The application provides an option to hide your name from the reviewer of an ordinary private concern.', 'Selecting this option limits how your identity is displayed in the review interface.', 'However, **hidden-name submissions are not completely anonymous**.', 'Your account may remain associated with your submission for security, authorized administration, recordkeeping, and other lawful purposes.', 'Information included in your message or photographs may also reveal your identity.', 'For child-protection reports, authorized school personnel may need relevant identifying information to assess and respond to the concern. The application must clearly explain any difference in identity visibility before submission.']],
    ['7. Account Security and Password Recovery', ['The application uses account authentication, role-based access restrictions, and security records to help protect user information.', 'A device identifier and sign-in information may be stored on your device to support account security and maintain your session.', 'If you forget your password, an authorized officer may issue a one-time recovery code after verifying your identity in person through an approved process.', 'You must choose your new password yourself.', 'Never share your password with SPTA officers, teachers, or other individuals.']],
    ['8. Information Storage and Third-Party Services', ['The application uses authorized hosting, database, and storage services to operate and safeguard its records.', 'Some information may be stored or processed outside the Philippines, depending on the service providers used.', () => PRIVACY_FACTS.providers && '**Verified service providers and storage locations:** ' + PRIVACY_FACTS.providers, 'Access to private records is restricted according to authorized responsibilities.', 'Protected system backups may be maintained for recovery and continuity. Backup copies must be secured and managed under the approved retention and disposal procedures.', 'Any external service that processes personal information must be identified and assessed for appropriate privacy and security safeguards.']],
    ['9. Information Retention and Deletion', ['Personal information will be retained according to its purpose, applicable legal requirements, and the approved recordkeeping schedule.', 'Different periods may apply to:', ['Parent and officer accounts.', 'Profile photographs.', 'Ordinary suggestions and resolved concerns.', 'School referrals and child-protection records.', 'Financial documents and receipts.', 'Meeting minutes, resolutions, signatures, and voting records.', 'Security logs and backup copies.'], 'Records may need to be retained longer when required for unresolved concerns, school procedures, audits, investigations, or legal obligations.', 'Information no longer required will be securely deleted, anonymized, or appropriately archived under the approved records-management procedure.', 'The applicable retention periods must be documented and verified before this notice is finalized.']],
    ['10. Your Privacy Rights', ['Under the Philippine Data Privacy Act of 2012, you may exercise applicable rights concerning your personal information, including:', ['The right to be informed about its collection and use.', 'The right to request access.', 'The right to request corrections.', 'The right to object to certain processing.', 'The right to request deletion or blocking when legally applicable.', 'Other rights recognized under applicable law.'], 'You may contact the designated privacy contact to request assistance.', 'You may also raise a complaint with the National Privacy Commission at **privacy.gov.ph**.']],
    ['11. Your Choices', ['Creating an account is voluntary.', 'You may view publicly available announcements, approved projects, and published financial reports without registering.', 'You may request account closure or withdraw consent for processing that relies on your consent.', 'However, account closure or withdrawal of consent does not automatically require the deletion of records that the school or SPTA must lawfully retain.', '**Child-protection reports**', 'If a child-protection report has already reached the school, selecting “Stop follow-ups” stops the applicable SPTA follow-up communications through the application.', 'It does not withdraw the report from the school’s records or prevent the school from carrying out its responsibilities.']],
    ['12. Changes to This Notice', ['This Privacy Notice may be updated when the application’s features, data-handling practices, or applicable requirements change.', 'Important changes will be communicated through the application.', 'When legally appropriate, users will be asked to review the updated notice and provide renewed consent.']]
  ];
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const privacyPart = p => typeof p === 'function' ? (p() ? privacyPart(p()) : '') : Array.isArray(p) ? '<ul>' + p.map(i => '<li>' + bold(i) + '</li>').join('') + '</ul>' : '<p>' + bold(p) + '</p>';
  const privacyBody = () => PRIVACY.map(([h, ps]) => '<h4>' + esc(h) + '</h4>' + ps.map(privacyPart).filter(Boolean).join('')).join('');
  // Public project photos. The picture itself loads after the page is drawn, then stays ready for later redraws.
  const photoState = ph => ph.status || 'approved';
  const shownPhotos = p => (p.photos || []).filter(x => photoState(x) === 'approved' || onRole(E.leaders));
  const findPhoto = key => db().projects.flatMap(p => p.photos || []).find(x => x.file.key === key) || (db().cases || []).flatMap(c => (c.photos || []).map(file => ({file}))).find(x => x.file.key === key);
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
    return [proj.title, photoImg(ph, ph.caption, 'attachment-image') + '<p class="photo-caption"><b class="ut">' + esc(ph.caption) + '</b></p><div class="entry-meta">' + esc((ph.stage === 'completed' ? 'Completed project' : 'In progress') + ' · ' + date(ph.date)) + (list.length > 1 ? ' · Photo ' + (at + 1) + ' of ' + list.length : '') + '</div>' + (list.length > 1 ? '<div class="entry-actions">' + step('Previous', list[at - 1]) + step('Next', list[at + 1]) + '</div>' : '') + review + manage];
  }
  function photoAddDialog(id) {
    const proj = db().projects.find(x => x.id === id);
    if (!proj) return ['Add a photo', empty('This project is no longer available.')];
    return ['Add a photo', para(proj.title) + notice('Everyone who opens the app can see this photo. Show the work, such as the shelves, the paint or the garden. Please keep pupils’ faces, names and uniforms out of the picture.') + form('projectPhoto', imageUpload('Photo (JPG, PNG or WEBP)') + input('caption', 'What does the photo show?', '', 'text', 'required minlength="3" maxlength="140" placeholder="Books on the new shelves"'), 'Publish photo', id)];
  }
  // Receipts and spending posted for a project, folded inside its Details. Finance officers can open each original.
  function projectReceipts(p) {
    const rows = db().ledger.filter(x => x.project === p.id);
    const chairCan = me().role === 'chair' && !p.past && ['approved', 'in_progress', 'completed'].includes(p.status);
    if (!rows.length && !chairCan) return '';
    const lines = rows.map(x => {
      return '<div class="list-line"><span>' + esc(date(x.date)) + (x.direction === 'in' ? ' · correction' : '') + '</span><b>' + (x.direction === 'in' ? '−' : '') + cash(x.cents) + '</b>' + (x.receipt ? btn('View receipt', 'receipt', x.id) : '') + '</div>';
    }).join('');
    return '<details class="proj-details"><summary>Receipts (' + rows.length + ')</summary>' + (lines || '<div class="entry-meta">No receipts yet.</div>') + (chairCan && rows.length ? btn('Correct amount spent', 'dlg:spent', p.id) : '') + '</details>';
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
    if (me().role === 'chair' && !p.past && (active || p.status === 'completed')) buttons += btn('Add receipt', 'dlg:receipt', p.id);
    if (me().role === 'head' && active) buttons += btn('Cancel project', 'dlg:cancel', p.id, 'danger');
    const top = '<div class="proj-top"><span class="project-symbol">' + icon(p.icon || 'sprout') + '</span><div><h3>' + ut(titleCase(p.title)) + '</h3><small>' + esc(cancelled ? 'Cancelled' : p.phase || labels[p.status]) + '</small></div>' + badge(p.status) + '</div>';
    const progress = p.past ? '<div class="proj-nums"><span><b>Completed</b> before this app</span><span>No SPTA funds used</span></div>' : cancelled ? '' : '<div class="proj-bar" role="img" aria-label="' + done + '% done"><div style="width:' + done + '%"></div></div><div class="proj-nums"><span><b>' + done + '%</b> done</span><span><b>' + cash(spent) + '</b> of ' + cash(p.budget) + ' spent</span></div>' + (p.status === 'completed' || spent > p.budget ? '<div class="proj-nums cost-compare"><span>Budget <b>' + cash(p.budget) + '</b></span><span>' + (p.status === 'completed' ? 'Actual cost' : 'Spent so far') + ' <b>' + cash(spent) + '</b></span><span class="' + (spent > p.budget ? 'over' : 'under') + '">' + (spent > p.budget ? 'Over by ' : spent < p.budget ? 'Under by ' : 'On budget') + (spent === p.budget ? '' : '<b>' + cash(Math.abs(p.budget - spent)) + '</b>') + '</span></div>' : '');
    const cancel = cancelled ? '<div class="cancel-note"><b>Why It Was Cancelled</b>' + upara(p.reason) + '<b>Unused Funds</b>' + upara(p.remainder) + '</div>' : '';
    const flag = f?.short > 0 ? fundCheck(f.need, f.short) : '';
    const details = '<details class="proj-details"><summary>Details</summary>' + cancel + upara(p.text) + row('Project lead', n(p.owner)) + (p.approval ? row('Approved by the School Head', date(p.approval.headAt.slice(0, 10))) + (p.approval.recordedBy ? row('Approval recorded by', 'The chairperson') : '') : '') + (p.past ? (p.sponsor ? row('Paid for by', p.sponsor) : '') + row('Completed on', date(p.changed)) + row('SPTA funds used', cash(0)) : row('SPTA allocation', cash(p.budget)) + row(cancelled ? 'Spent by cancellation' : 'Spent so far', cash(cancelled ? p.spentAtCancellation ?? spent : spent)) + (cancelled ? '' : (spent > p.budget ? row('Over budget by', cash(spent - p.budget)) : row(p.status === 'completed' ? 'Saved' : 'Not yet spent', cash(p.budget - spent))))) + (f && !f.short ? row('Funding', 'Covered by SPTA funds') : '') + projectReceipts(p) + changeLog(p) + (E.amendOpen(db(), p.id) ? '<div class="entry-meta">' + icon('info', 'sm') + 'A change to this project is waiting for a new officer vote or the School Head’s decision. The allocation stays ' + esc(cash(p.budget)) + ' until then.</div>' : '') + row('Reference', p.id + ' · updated ' + date(p.changed)) + (buttons ? '<div class="entry-actions">' + buttons + '</div>' : '') + '</details>';
    return '<article class="proj is-' + esc(p.status) + '">' + top + progress + photoStrip(p) + flag + details + '</article>';
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
    const arr = [['home', 'Home', 'home'], ['proposals', 'Proposals', 'lightbulb'], ['projects', 'Projects', 'sprout'], ['funds', 'Funds', 'chart'], ['activities', 'Activities', 'calendar']];
    if (lead()) arr.push(['cases', me().role === 'head' ? 'Passed-on feedback' : 'Assigned feedback', 'shield'], ['insights', 'School pulse', 'chart']);
    else if (holds('secretary')) arr.push(['cases', 'Passed-on feedback', 'shield']);
    else if (db().cases.some(c => c.endorsed?.to === S.me)) arr.push(['cases', 'Assigned feedback', 'shield']);
    if (onRole(E.boardRoles) || lead()) arr.push(['board', 'Officer voting', 'users'], ['resolutions', 'Resolutions', 'file']);
    if (onRole(E.minuteReaders)) arr.push(['records', 'Minutes & notices', 'clipboard']);
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
    if(role==='head')passedOn().filter(c=>c.protection&&!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.unshift(c.protection.ack?['alert','Child-protection referral · open',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']:['alert','URGENT · Acknowledge child-protection referral',c.subject,'dlg:caseAck',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
    if(role==='head')passedOn().filter(c=>c.status==='received'&&!c.protection).forEach(c=>list.push(['message','Passed on by the chairperson',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
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
      passedOn().filter(c=>c.protection&&!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.unshift(c.protection.ack?['alert','Child-protection referral · open',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']:['alert','URGENT · Acknowledge child-protection referral',c.subject,'dlg:caseAck',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
      passedOn().filter(c=>!c.protection&&!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.push(['message','Passed to the School Head · reply or follow up',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
    }
    if(['chair','vice'].includes(role))ownCases().filter(c=>c.status==='action_taken'&&E.onDesk(c)&&!c.protection).forEach(c=>list.push(['check','To verify · Action taken',c.subject,'dlg:caseVerify',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
    ownCases().filter(c=>c.endorsed?.to===S.me&&!['resolved','withdrawn'].includes(c.status)).forEach(c=>list.push(['message','Endorsed to you',c.subject,'dlg:reply',c.id,c.kind==='concern'?'Private Concern':'Suggestion']));
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
    const c=['reply','forward','caseNote','endorse','protect','caseAsk','caseAnswer','caseReturn','caseAck','caseVerify'].includes(ui.dialog)&&db().cases.find(x=>x.id===ui.id);
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
    const announcement=latest?'<button class="notice-row" data-do="tab:updates"><span class="notice-symbol">'+icon('megaphone')+'</span><span><small>'+esc(date(latest.date))+'</small><strong>'+ut(titleCase(latest.title))+'</strong></span>'+icon('chevron','sm')+'</button>':empty('No announcements yet.');
    const soon=allActivities().filter(isUpcoming).sort((x,y)=>x.date.localeCompare(y.date)).slice(0,2).map(x=>'<button class="project-row" data-do="tab:activities"><span class="project-symbol">'+icon('calendar')+'</span><span><strong>'+ut(titleCase(x.title))+'</strong><small>'+esc(whenLine(x)+(x.audience==='officers'?' · Officers only':''))+'</small></span>'+icon('chevron','sm')+'</button>').join('');
    const projectsList=db().projects.slice(0,2).map(p=>'<button class="project-row" data-do="tab:projects"><span class="project-symbol">'+icon(p.icon||'sprout')+'</span><span><strong>'+ut(titleCase(p.title))+'</strong>'+badge(p.status)+'</span>'+icon('chevron','sm')+'</button>').join('');
    const join=isGuest()?'<div class="join-bod"><strong>Parent or SPTA Officer?</strong>'+btn('Sign in','tab:account')+'</div>':'';
    const cover=standIn()?notice('You are standing in for the '+E.roles[standIn()]+' until '+date(db().cover.until)+'. Their tasks appear in your list.'):'';
    return hero+cover+feedback+approvalList+section('Latest announcement',announcement)+section('Upcoming activities',soon||empty('No activities are planned yet.'))+section('SPTA projects',projectsList||empty('Approved SPTA projects will appear here.'))+join;
  }
  // A sender may take back a proposal until the School Head approves it, and a suggestion or concern until it is resolved.
  const canWithdraw = x => x.owner === S.me && !x.senderStopped && (x.kind ? ['received', 'assigned'] : ['received', 'returned', 'screened', 'voting', 'awaiting_head']).includes(x.status);
  function proposals() {
    const all = db().proposals.filter(p => E.readableProposal(p, me()));
    if (me().role === 'head') all.sort((a, b) => (b.status === 'awaiting_head') - (a.status === 'awaiting_head'));
    return (me().role === 'parent' ? '' : '<div class="entry-actions">' + btn('Propose a project', 'dlg:proposal', '', 'primary', 'plus') + (canChair() ? btn('Add for School-Head approval', 'dlg:chairProposal', '', 'light', 'plus') : '') + '</div>') + (all.length ? '' : empty('Screened proposals will appear here.')) + '<div class="entry-list">' + all.map(p => {
      const own = p.owner === S.me;
      let actions = '';
      if (lead() && p.status === 'received') actions += btn('Screen proposal', 'dlg:screen', p.id, 'primary');
      if (own && p.status === 'returned') actions += btn('Revise proposal', 'dlg:resubmit', p.id);
      if (own && canWithdraw(p)) actions += btn('Withdraw', 'dlg:withdraw', p.id);
      if (p.status === 'awaiting_head' && me().role === 'head') actions += btn('Record decision', 'dlg:head', p.id, 'primary');
      if (p.status === 'awaiting_head' && canChair()) actions += btn('School Head already approved', 'dlg:headApproved', p.id, 'primary');
      if (E.publicProposal(p)) actions += btn(p.supporters?.includes(S.me) ? 'Supported' : 'Support idea', 'support', p.id, 'light', 'heart');
      if (me().role === 'head' || canChair()) actions += btn(p.reply ? 'Edit personal reply' : 'Send personal reply', 'dlg:proposalReply', p.id);
      return card(proposalName(p), (p.publicText ? upara(p.publicText) : para(p.details)) + (lead() && !own ? fromLine(p) : '') + (own || lead() ? para(p.reason) : '') + (p.direct ? '<div class="entry-meta direct-note">' + icon('info', 'sm') + 'Added by the chairperson</div>' : '') + (p.budget > 0 ? '<div class="entry-meta">Proposed SPTA allocation ' + cash(p.budget) + '</div>' : '') + proposalFund(p) + (lead() && p.reply ? '<div class="portal-note personal"><b>Personal Reply Sent</b>' + para(p.reply) + '</div>' : '') + (E.publicProposal(p) ? '<div class="entry-meta">' + Number(p.supports || 0) + ' parent supporters</div>' : ''), p.id + ' · ' + p.category, p.status, actions, false, !!p.publicTitle);
    }).join('') + '</div>';
  }
  function updates() {
    const mine = db().proposals.filter(p => p.owner === S.me),
      cases = ownCases().filter(c => c.owner === S.me);
    const announcements = section('SPTA announcements', notices().map(x => card(x.title, upara(x.body) + (x.edited ? '<div class="entry-meta">Edited ' + esc(date(x.edited)) + '</div>' : '') + (publisher() && x.until ? '<div class="entry-meta">' + (ended(x) ? 'Ended ' + esc(date(x.until)) + ' · No longer shown to others' : 'Shown until ' + esc(date(x.until))) + '</div>' : ''), date(x.date) + (me().role === 'parent' ? '' : ' · ' + (x.audience === 'everyone' ? 'School community' : 'Officers only')), ended(x) ? 'closed' : '', publisher() ? btn('Edit', 'dlg:announceEdit', x.id) + btn('Remove', 'dlg:announceRemove', x.id) : '', false, true)).join('') || empty('No announcements yet.'));
    if (isGuest()) return section('My submissions', signInPrompt('Sign in to send a proposal, suggestion or concern and to follow its status here.')) + announcements;
    return section('My submissions', mine.map(p => card(proposalName(p), tracker(p) + (p.reason ? '<div class="portal-note"><b>Note from the Reviewer</b>' + para(p.reason) + '</div>' : ''), p.id + ' · Project proposal', p.status, (p.status === 'returned' ? btn('Revise', 'dlg:resubmit', p.id) : '') + (canWithdraw(p) ? btn('Withdraw', 'dlg:withdraw', p.id) : ''))).join('') + cases.map(caseCard).join('') || empty('You have no submissions yet.')) + section('Notifications', db().notes.filter(x => x.owner === S.me).slice(0, 20).map(x => card(x.text, '', date(x.at), '', '', true)).join('') || empty('Updates will appear here.')) + announcements;
  }
  // What officers read at the top of a child-protection referral. Each line is backed by a recorded event.
  function cpBanner(c) {
    const p = c.protection,
      school = E.caseHandler(db(), me(), c),
      late = !p.ack && Date.now() - Date.parse(p.at) > 86400000 && c.status !== 'resolved';
    return '<div class="portal-note urgent"><b>' + icon('shield', 'sm') + 'Possible Child Protection Concern</b>' + para((p.direct ? 'Sent to the school by the parent on ' : 'Referred to the school on ') + longDate(p.at) + '.') + (p.ack ? badgeText('Acknowledged by the school · ' + date(p.ack.at.slice(0, 10))) : '<span class="badge await">' + esc(late ? 'Not yet acknowledged · Overdue' : 'Awaiting School Acknowledgment') + '</span>') + para('The school is responsible for assessing and addressing this concern.') + (p.direct ? '' : para('The SPTA may request additional information from the reporting parent to assist with the referral. All investigations, interviews, and appropriate interventions will be handled by authorized school personnel.')) + (c.senderStopped ? para('The parent asked the SPTA to stop following up. The school keeps the report.') : '') + (school ? para('Alerts appear only inside this app. There are no text messages or emails, so open the app every school day.') : '') + '</div>';
  }
  function caseCard(c) {
    const gone = c.status === 'withdrawn',
      assigned = caseHandler(c),
      mine = c.owner === S.me,
      desk = E.onDesk(c),
      noter = caseNoter(c) && !(mine && !assigned);
    const late = assigned && db().settings.reminders && !gone && c.status !== 'resolved' && c.due < t();
    // A parent only reads that it went to the SPTA. Officers see who can read it.
    const to = desk ? mine && !noter ? 'SPTA' : E.deskName : E.recipients[c.assigned] || E.roles[c.assigned];
    const notes = (c.notes || []).map(x => '<div class="portal-note' + (x.followUp ? ' personal' : '') + '"><b>' + esc((x.followUp ? 'Follow-up · ' : x.toHead ? 'Note for the School Head · ' : 'Note · ') + (E.roles[x.role] || x.role)) + '</b>' + para(x.text) + '<small>' + esc(date(x.at.slice(0, 10))) + '</small></div>').join('');
    const body = para(c.body) + (c.hidden ? '<div class="entry-meta hidden-name">' + icon('lock', 'sm') + esc(mine ? 'You hid your name from the reviewer.' : 'Name hidden by the sender. Reply here in the app.') + '</div>' : (assigned || noter) && !mine ? fromLine(c) : '') + (mine ? tracker(c) : c.reply ? '<div class="portal-note personal"><b>' + (c.replyFor === 'head' ? 'Personal Reply Sent by the Secretary for the School Head' : 'Personal Reply Sent') + '</b>' + para(c.reply) + '</div>' : '') + (!mine || noter ? notes : '') + '<div class="entry-meta">Sent to the ' + esc(mine && c.toSchool ? 'school' : to) + (c.forwarded && !mine && !c.protection ? ' · Passed on to the School Head' + (c.forwarded.role && noter ? ' by the ' + esc(E.roles[c.forwarded.role] || '') : '') + ' ' + esc(date(c.forwarded.at.slice(0, 10))) : '') + (assigned && !gone ? ' · Next update by ' + esc(date(c.due)) : '') + (late ? ' · <b class="overdue">Overdue</b>' : '') + '</div>';
    const stopped = mine && c.senderStopped ? '<div class="entry-meta">' + icon('info', 'sm') + 'You asked the SPTA to stop following up. The school keeps the report it already received.</div>' : '';
    const thread = stopped + (c.messages || []).map(m => '<div class="portal-note' + (m.from === 'sender' ? '' : ' personal') + '"><b>' + esc(mine ? (m.from === 'sender' ? 'Your answer' : 'The SPTA asked') : (m.from === 'sender' ? 'Answer from the sender' : 'Question to the sender')) + '</b>' + para(m.text) + '<small>' + esc(date(m.at.slice(0, 10))) + '</small></div>').join('') + (c.awaiting && !gone ? '<div class="entry-meta">' + icon('info', 'sm') + esc(mine ? 'Please answer so the SPTA can help.' : 'Waiting for the sender to answer.') + '</div>' : '');
    const evidence = (c.photos || []).length ? '<div class="proj-photos case-photos" aria-label="Photo evidence">' + c.photos.map((ph, i) => '<button type="button" class="proj-photo" data-do="dlg:casePhoto" data-id="' + esc(c.id + '|' + i) + '" aria-label="' + esc('Open photo ' + (i + 1)) + '">' + photoImg({file: ph}, 'Photo evidence ' + (i + 1)) + '</button>').join('') + '</div>' : '';
    const desk2 = desk && ['chair', 'vice'].includes(me().role) && ['received', 'assigned'].includes(c.status) && !c.protection;
    const canForward = desk2 && !c.forwarded;
    const officerView = !mine && (assigned || noter || desk2);
    const asker = !mine && E.caseAsker(db(), me(), c);
    const track = !officerView ? '' : c.protection ? cpBanner(c) : c.safety ? '<div class="portal-note urgent"><b>' + icon('shield', 'sm') + 'Possible Child Protection Concern</b>' + para('The parent marked this as a child-safety concern, but no school account could receive it. The parent was told to contact the school directly. Refer it as soon as the School Head’s account is set up.') + '</div>' : c.track === 'grievance' ? '<div class="entry-meta">' + icon('info', 'sm') + 'PTA dispute · Formal grievance route. The School Head sets up the proper committee. No informal sanctions.</div>' : c.track === 'school' ? '<div class="entry-meta">' + icon('info', 'sm') + 'School matter · The School Head leads the action.</div>' : c.endorsed ? '<div class="entry-meta">' + icon('users', 'sm') + (c.endorsed.to === S.me ? 'Endorsed to you by the ' + esc(E.roles[c.endorsed.role] || '') + ' · ' + esc(date(c.endorsed.at.slice(0, 10))) : 'SPTA matter · Endorsed to ' + esc(n(c.endorsed.to)) + ' · ' + esc(date(c.endorsed.at.slice(0, 10)))) + '</div>' : '';
    const actions = (mine && c.awaiting && !gone ? btn('Answer', 'dlg:caseAnswer', c.id, 'primary') : '') + (c.status === 'action_taken' && desk && !c.protection && ['chair', 'vice'].includes(me().role) ? btn('Verify outcome', 'dlg:caseVerify', c.id, 'primary') : '') + (assigned && !gone && (!c.protection || c.protection.ack) ? btn(c.protection ? 'Update or close' : c.status === 'received' ? 'Mark reviewed or reply' : 'Update or reply', 'dlg:reply', c.id) : '') + (c.protection && assigned && !c.protection.ack && !gone ? btn('Acknowledge referral', 'dlg:caseAck', c.id, 'primary') : '') + (asker && !gone && !c.awaiting && c.status !== 'resolved' ? btn('Ask for more details', 'dlg:caseAsk', c.id) : '') + (c.protection && assigned && me().role === 'head' && !mine && !gone && c.status !== 'resolved' ? btn('Not a child-protection concern', 'dlg:caseReturn', c.id) : '') + (desk2 && !c.forwarded ? (c.endorsed ? btn('Take back', 'caseTakeBack', c.id) : btn('Endorse to an officer', 'dlg:endorse', c.id)) : '') + (canForward ? btn('Pass on to the School Head', 'dlg:forward', c.id, 'primary') : '') + (desk2 && !gone ? btn('Child-protection concern', 'dlg:protect', c.id, 'danger') : '') + (noter && !gone && desk ? btn(!assigned && (holds('secretary') || c.protection) ? 'Record follow-up' : c.forwarded ? 'Add a note' : 'Add a private note', 'dlg:caseNote', c.id) : '') + (canWithdraw(c) ? btn(mine && c.urgent ? 'Stop follow-ups' : 'Withdraw', 'dlg:withdraw', c.id) : '');
    const shown = (c.urgent || c.protection) && !gone ? (c.status === 'resolved' ? 'cp_closed' : c.schoolHandling ? 'cp_handling' : c.schoolAck || c.protection?.ack ? 'cp_ack' : 'cp_referred') : c.status;
    return card(c.subject, track + body + thread + evidence, c.id + ' · ' + (c.kind === 'inspection' ? 'Records inspection request' : c.kind === 'concern' ? 'Private concern' : 'Private suggestion'), shown, actions);
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
    return para('Every SPTA officer can vote on a screened proposal. It proceeds to the School Head once yes votes reach 51% of all officers.') + section('Proposals for officer vote', ballots.map(b => {
      const open = b.status === 'open',
        member = b.present.includes(S.me),
        voted = b.participated.includes(S.me),
        turnout = b.turnout ?? b.participated.length,
        need = E.yesNeeded(b);
      const text = upara(b.body) + '<div class="entry-meta">Secret ballot · ' + b.present.length + ' officers · ' + need + ' yes votes needed (51%) · SPTA allocation ' + cash(b.budget) + '</div>' + (open ? ballotFund(b) : '') + (open ? para(turnout + ' of ' + b.present.length + ' officers have voted.' + (voted ? ' Your vote was received.' : '')) + '<div class="entry-meta vote-closes">' + icon('info', 'sm') + 'Voting closes on ' + esc(date(E.voteCloses(b))) + '</div>' : '<div class="vote-summary"><b>' + b.counts.yes + ' Yes</b><b>' + b.counts.no + ' No</b><b>' + b.counts.abstain + ' Abstain</b></div>' + para(b.withdrawn ? 'The proposer withdrew this proposal, so the vote was closed.' : b.passed ? 'Reached 51% of all officers. Sent to the School Head for approval.' : 'Yes votes did not reach 51% of all officers' + (b.expired ? ' by the closing date.' : '.')));
      let buttons = '';
      if (open && member && !voted) buttons += btn('Cast vote', 'dlg:vote', b.id, 'primary');
      if (open && canChair() && !S.shared && b.present.some(m => !b.participated.includes(m) && !S.practiceProfiles.includes(m))) buttons += btn('Add practice ballots', 'practiceBallots', b.id);
      if (open && canChair()) buttons += btn('Change closing date', 'dlg:deadline', b.id) + btn('Close voting', 'dlg:close', b.id);
      return card(b.title, text, b.proposal + ' · ' + (open ? 'Opened ' : 'Closed ') + date(b.date), open ? 'voting' : b.withdrawn ? 'withdrawn' : b.passed ? 'approved' : 'closed', buttons, false, true);
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
    return card(r.title, para(r.clause || 'The secretary is reviewing the draft.') + (r.state !== 'draft' && r.signers ? '<div class="entry-meta">' + signed + ' of ' + r.signers.length + ' officers have signed</div>' : ''), r.id + ' · Version ' + r.version, r.state, acts, false, true);
  }
  // The resolution paper follows the school's own format (see SPTA Resolution No. 2, s. 2026): heading, title, the text,
  // the officers' signatures, the members present with their signatures, and the witnesses.
  const paperTitle = {
    chair: 'SPTA President',
    vice: 'SPTA Vice-President',
    secretary: 'SPTA Secretary',
    treasurer: 'SPTA Treasurer',
    collector: 'SPTA Collecting and Disbursing Officer'
  };
  function resolutionPaper(r, signatures = true) {
    const mark = '<div class="paper-mark">' + (isLive() ? '' : 'FICTIONAL REHEARSAL COPY · ') + esc(labels[r.state] || r.state).toUpperCase() + ' · VERSION ' + r.version + '</div>';
    const no = r.no ? 'SPTA RESOLUTION NO. ' + r.no + ', S. ' + (r.sy || String(r.created || E.today()).slice(0, 4)) : 'SPTA RESOLUTION ' + r.id;
    let body = mark + '<div class="rs-head">' + '<img class="rs-seal" src="assets/deped-seal.png" alt="" width="72" height="72">' + '<p class="rs-gothic">Republic of the Philippines</p><p class="rs-gothic">Department of Education</p><p>REGION 1</p><p>Schools Division Office of Pangasinan II</p><p><b>EAST CENTRAL ELEMENTARY SCHOOL</b></p><p>Caballero Street, Poblacion, San Fabian, Pangasinan</p></div><p class="rs-no">' + esc(no) + '</p><p class="rs-title">' + esc(E.resolutionHeading(r)) + '</p>';
    if (r.supersededBy) body += notice('Replaced by resolution ' + r.supersededBy + ' after the project’s allocation changed. This one records what was approved at the time.');
    const text = String(r.clause || 'Draft text awaiting secretary review.').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
    body += '<div class="rs-text">' + text.map(x => '<p' + (/^SEKSYON \d/.test(x) ? ' class="rs-sec"' : '') + '>' + esc(x) + '</p>').join('') + '</div>';
    if (signatures && r.signers && r.state !== 'draft' && officers()) {
      const sigOf = s => r.signatures[s.id];
      const sign = s => {
        const sig = sigOf(s);
        return sig?.status === 'acknowledged' ? markSvg(sig.mark) : sig ? '<span class="sig-empty">Declined to sign</span>' : '';
      };
      const order = Object.keys(paperTitle);
      const officersList = r.signers.filter(s => order.includes(s.role)).sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
      const members = r.signers.filter(s => s.role === 'bod');
      const head = db().accounts.find(x => x.role === 'head' && x.active);
      const done = r.signers.filter(s => sigOf(s)?.status === 'acknowledged').length;
      body += '<p class="rs-label">Pinagtibay ng SPTA Officers:</p><div class="rs-officers">' + officersList.map(s => '<div class="rs-sign">' + '<div class="rs-mark">' + sign(s) + '</div><b>' + esc((sigOf(s)?.name || s.name).toUpperCase()) + '</b><span>' + esc(paperTitle[s.role]) + '</span></div>').join('') + '</div>';
      if (members.length) body += '<p class="rs-label">Mga Dumalong Miyembro ng SPTA (Lagda ng Pagpayag):</p><table class="rs-table"><thead><tr><th>No.</th><th>Name</th><th>Grade / Class</th><th>Signature</th></tr></thead><tbody>' + members.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc((sigOf(s)?.name || s.name).toUpperCase()) + '</td><td>' + esc(s.homeroom || '') + '</td><td>' + sign(s) + '</td></tr>').join('') + '</tbody></table>';
      body += '<p class="rs-label">Mga saksi:</p><div class="rs-witness"><div class="rs-sign"><div class="rs-mark"></div><b>' + esc(head?.name ? head.name.toUpperCase() : '') + '</b><span>School Head</span></div></div>';
      body += '<div class="entry-meta rs-count">' + done + ' of ' + r.signers.length + ' officers have signed this version. ' + esc(r.signerPolicy || 'All officers') + ' · ' + E.signaturesPending(r).length + ' required signatures pending.</div>' + (r.filing ? para(r.filing) : '');
    }
    return '<article class="resolution-sheet">' + body + '</article>';
  }
  document.addEventListener('error', ev => {
    if (ev.target && ev.target.classList && ev.target.classList.contains('rs-seal')) ev.target.remove();
  }, true);
  const has = key => tabs().some(x => x[0] === key);
  // SPTA Funds page. Sarah prefers this layout; its section headings carry a tinted band.
  function funds() {
    const rows = db().ledger.slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = d => rows.filter(x => x.direction === d).reduce((s, x) => s + x.cents, 0);
    const fund = E.funding(db()),
      name = id => db().projects.find(p => p.id === id)?.title || (db().activities || []).find(x => x.id === id)?.title;
    const active = db().projects.filter(p => fund.projects[p.id]),
      waiting = db().proposals.filter(p => E.publicProposal(p) && E.readableProposal(p, me()) && p.budget > 0 && ['screened', 'voting', 'awaiting_head'].includes(p.status));
    const projectLines = active.map(p => {
      const spent = E.projectSpend(db(), p.id),
        f = fund.projects[p.id];
      return '<article class="fund-project"><h3>' + ut(titleCase(p.title)) + '</h3><div class="fund-bar"><div style="width:' + Math.max(0, Math.min(100, p.budget ? spent / p.budget * 100 : 0)) + '%"></div></div><div class="money-inline"><span>Allocation <b>' + cash(p.budget) + '</b></span><span>Spent <b>' + cash(spent) + '</b></span><span>Still to pay <b>' + cash(f.need) + '</b></span></div>' + fundCheck(f.need, f.short, 'Covered by SPTA funds') + '</article>';
    }).join('');
    const activityLines = allActivities().filter(x => x.status === 'scheduled' && x.budget > 0).map(x => {
      const spent = E.projectSpend(db(), x.id),
        f = fund.activities?.[x.id] || {need: 0, short: 0};
      return '<article class="fund-project"><h3>' + ut(titleCase(x.title)) + '</h3><div class="entry-meta">Activity · ' + esc(whenLine(x)) + (x.audience === 'officers' ? ' · Officers only' : '') + '</div><div class="fund-bar"><div style="width:' + Math.max(0, Math.min(100, spent / x.budget * 100)) + '%"></div></div><div class="money-inline"><span>Budget <b>' + cash(x.budget) + '</b></span><span>Spent <b>' + cash(spent) + '</b></span><span>Still to pay <b>' + cash(f.need) + '</b></span></div>' + fundCheck(f.need, f.short, 'Covered by SPTA funds') + '</article>';
    }).join('');
    const proposalLines = waiting.map(p => '<article class="fund-project"><h3>' + ut(titleCase(proposalName(p))) + '</h3><div class="entry-meta">' + esc(labels[p.status]) + ' · Proposed allocation ' + cash(p.budget) + '</div>' + proposalFund(p) + '</article>').join('');
    const movements = rows.map(entry => {
      const incoming = entry.direction === 'in';
      const project = entry.project && name(entry.project);
      const direction = incoming ? 'Money In' : 'Money Out';
      const explain = E.correctionNote(rows, entry);
      return '<li class="movement-row' + (explain ? ' corrected' : '') + '"><div class="movement-heading"><strong>' + esc(entry.purpose) +
        '</strong><b class="' + (incoming ? 'cash-in' : 'cash-out') + '">' +
        (incoming ? '+' : '−') + cash(entry.cents) + '</b></div><div class="movement-meta">' +
        direction + ' · ' + esc(date(entry.date)) + (project ? ' · ' + esc(project) : '') + '</div>' + (entry.receipt ? '<button type="button" class="receipt-link" data-do="receipt" data-id="' + esc(entry.id) + '">' + icon('file', 'sm') + '<span>View receipt</span></button>' : '') + (explain ? '<p class="correction-note">' + esc(explain) + '</p>' : '') + '</li>';
    }).join('');
    const summary = '<section class="balance-card" aria-label="SPTA Cash Balance"><h2>SPTA Cash Balance</h2><strong>' + cash(fund.balance) +
      '</strong>' + (db().opening > 0 ? '<small class="balance-carry">Includes ' + cash(db().opening) + ' carried over from earlier this school year, as of ' + esc(date(db().openingAsOf)) + '.</small>' : '') + '<div class="balance-flows"><div>Money In<b>' + cash(total('in')) + '</b></div><div>Money Out<b>' +
      cash(total('out')) + '</b></div></div></section>';
    const allocations = '<div class="fund-split"><div><span>Set Aside for Projects and Activities</span><b>' + cash(fund.committed) +
      '</b></div><div class="' + (fund.available > 0 ? 'ok' : 'short') + '"><span>Available for New Proposals</span><b>' + cash(fund.available) + '</b></div></div>';
    return '<div class="funds-page">' + summary + '<p class="balance-note">SPTA officers manage these voluntary contributions and fundraising proceeds. They are not the school’s funds.</p>' +
      section('Approved Transactions', movements ? '<ul class="movement-list">' + movements + '</ul>' : empty('No approved transactions yet.')) +
      section('Project Funding', allocations + (projectLines || empty('No approved SPTA projects are waiting for funds.'))) + (activityLines ? section('Activity Budgets', activityLines) : '') +
      (proposalLines ? section('Proposals Waiting for a Decision', proposalLines) : '') + section('SPTA records', btn('Request records inspection', 'dlg:inspection') + (has('resolutions') ? '' : db().resolutions.filter(r => r.published).map(r => card(r.title, upara(r.parentSummary), r.id + ' · Version ' + r.version, r.state, '', false, true)).join(''))) + '</div>';
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
  // Activities: dated events for everyone, or for the officers only. The treasurer sets a budget aside for an activity.
  const officerLike = () => onRole([...E.boardRoles, 'head']) && !isGuest();
  const planner = () => onRole(E.planners) && !isGuest();
  const allActivities = () => (db().activities || []).filter(x => x.audience === 'everyone' || officerLike());
  const isUpcoming = x => x.status === 'scheduled' && x.date >= t();
  const whenLine = x => date(x.date) + (x.time ? ' · ' + x.time : '');
  function activityCard(x) {
    const spent = E.projectSpend(db(), x.id),
      mine = x.by === S.me || canChair() || onRole(['head', 'vice']);
    let body = (x.place ? '<div class="entry-meta">' + icon('info', 'sm') + '<span class="ut">' + esc(x.place) + '</span></div>' : '') + upara(x.details);
    if (x.budget > 0) body += '<div class="money-inline"><span>Budget <b>' + cash(x.budget) + '</b></span><span>Spent <b>' + cash(spent) + '</b></span><span>Left <b>' + cash(Math.max(0, x.budget - spent)) + '</b></span></div>';
    else if (officerLike() && x.status === 'scheduled') body += '<div class="entry-meta">No budget set aside yet</div>';
    if (x.status === 'cancelled' && x.reason) body += para('Cancelled. ' + x.reason);
    let acts = '';
    if (holds('treasurer') && x.status === 'scheduled') acts += btn(x.budget > 0 ? 'Change budget' : 'Set budget', 'dlg:activityBudget', x.id, 'primary');
    if (planner() && x.status === 'scheduled' && mine) acts += btn('Edit', 'dlg:activity', x.id) + btn('Cancel activity', 'dlg:activityCancel', x.id, 'danger');
    return card(x.title, body, whenLine(x) + (x.audience === 'officers' ? ' · Officers only' : ''), x.status === 'cancelled' ? 'cancelled' : '', acts, false, true);
  }
  function activitiesView() {
    const list = allActivities(),
      soon = list.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date)),
      past = list.filter(x => !isUpcoming(x)).sort((a, b) => b.date.localeCompare(a.date));
    return (planner() ? '<div class="entry-actions">' + btn('Add an activity', 'dlg:activity', '', 'primary', 'plus') + '</div>' : '') + para(officerLike() ? 'Activities for everyone are shown to all parents. Officers-only activities, such as an officers’ party, are visible only to the officers and the School Head.' : 'Dates for SPTA activities that parents and guardians are invited to.') + section('Coming up', soon.map(activityCard).join('') || empty('No activities are planned yet.')) + (past.length ? section('Past and cancelled', past.map(activityCard).join('')) : '');
  }
  function records() {
    const sec = holds('secretary');
    const needSec = !sec && canChair() && !standIn();
    const standCard = needSec ? notice('The secretary uploads the meeting minutes. If the secretary has not joined the app yet or is away, you can stand in for the secretary and upload them yourself.') + '<div class="entry-actions">' + btn('Stand in for the Secretary', 'dlg:cover', 'secretary', 'primary') + '</div>' : '';
    return standCard + (sec || E.canAnnounce(db(), me()) ? '<div class="entry-actions">' + (sec ? btn('Upload meeting minutes', 'dlg:minutes', '', 'primary') : '') + (E.canAnnounce(db(), me()) ? btn('Publish announcement', 'dlg:announce', '', sec ? 'light' : 'primary', 'megaphone') : '') + '</div>' : '') + section('Meeting minutes', db().minutes.map(m => {
      let acts = btn('Read original', 'minuteFile', m.id);
      if (m.state === 'for_chair' && canChair()) acts += btn('Approve minutes', 'minutesReview', m.id, 'primary');
      if (m.state === 'for_head' && me().role === 'head') acts += btn('Note and file', 'minutesReview', m.id, 'primary');
      if (['for_chair', 'for_head'].includes(m.state) && (m.secretary === S.me || holds('secretary'))) acts += btn('Edit', 'dlg:minutesEdit', m.id, 'light') + btn('Withdraw', 'dlg:withdrawMinutes', m.id, 'danger');
      return card(m.title, upara(m.summary) + para('Due ' + date(m.due) + (!['filed', 'withdrawn'].includes(m.state) && m.due < t() ? ' · Overdue' : '')) + (m.state === 'withdrawn' ? para('Withdrawn. ' + m.withdrawn.reason) : ''), m.id + ' · ' + date(m.date), m.state, acts, false, true);
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
    const helpReset = S.shared && (me().role === 'head' || canChair()) ? section('Forgotten passwords', para('A parent who forgot their password gets a one-time code from you, after you check who they are in person.') + btn('Help a parent reset their password', 'dlg:recovery')) : '';
    const everywhere = S.shared && !a.guest ? section('Lost or shared phone', para('Sign out of this account on every phone, including this one. Then sign in again on your own phone.') + btn('Sign out on all phones', 'logoutAll', '', 'danger')) : '';
    return (a.guest ? signIn : profile + picture + children + phone + cover + helpReset + everywhere) + practice;
  }
  function assignedCases() {
    const late = c => db().settings.reminders && c.status !== 'resolved' && c.due < t();
    const kind = ui.caseFilter;
    const mine = ownCases().filter(c => c.kind !== 'inspection' && c.owner !== S.me && (caseHandler(c) || caseNoter(c) || c.protection && ['chair', 'vice'].includes(me().role)) && (!kind || c.kind === kind)).sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || late(b) - late(a));
    const others = kind ? btn('Show all assigned feedback', 'tab:cases') : '';
    const intake = db().settings.intake || {};
    const intakeBox = me().role === 'head' ? section('Child-protection intake', para('You receive child-protection reports. You can also let the secretary receive and follow them up.') + para(intake.secretary ? 'The secretary is designated' + (intake.reference ? ' (' + intake.reference + ')' : '') + ' since ' + date(intake.at.slice(0, 10)) + '.' : 'Only you receive them now.') + btn(intake.secretary ? 'End the secretary’s designation' : 'Designate the secretary', 'dlg:intake')) : '';
    const settings = intakeBox + (me().role === 'head' ? section('Follow-up settings', ['ack', 'reminders'].map(k => '<div class="list-line"><span>' + esc(k === 'ack' ? 'In-app submission acknowledgements' : 'Flag overdue feedback first') + '</span>' + btn(db().settings[k] ? 'Turn off' : 'Turn on', 'setting', k) + '</div>').join('')) : '');
    const passed = !['chair', 'vice'].includes(me().role);
    const endorsedOnly = passed && !lead() && !holds('secretary');
    const intro = endorsedOnly ? para('The chairperson or Vice-Chairperson endorsed these to you. Please act on them, reply to the sender here in the app, and mark each one “Action taken” with what was done. The chairperson or Vice-Chairperson then verifies it and closes it.') : me().role === 'head' ? para('The chairperson and Vice-Chairperson read every suggestion and private concern first. They pass on school matters and PTA disputes. Possible child-protection concerns are referred to the school right away. You, or the secretary if you designate her, acknowledge each one; the school assesses and handles it under its child protection procedure. On other matters the secretary can reply to the sender for you. When the action is done, mark it “Action taken”; the chairperson or Vice-Chairperson verifies it and closes it.') : holds('secretary') && passed ? para('These were passed on to the School Head. You can reply to the sender for the School Head and record follow-ups. If the School Head has designated you, you also receive, acknowledge, coordinate and monitor child-protection referrals. Formal assessment, investigation and intervention remain the responsibility of authorized school personnel. When the action on an ordinary concern is done, mark it “Action taken”; the chairperson or Vice-Chairperson verifies it and closes it.') : passed ? para('The chairperson and Vice-Chairperson read every suggestion and private concern first. They pass on the ones worth your attention, with a note when they need more from you.') : para('Only you and the ' + (me().role === 'chair' ? 'Vice-Chairperson' : 'chairperson') + ' can read what parents send. For each one: if a child may be in danger, refer it as a child-protection concern right away. Handle an SPTA matter yourselves or endorse it to an officer. Pass a school matter or a PTA dispute on to the School Head. When someone marks one “Action taken”, verify the outcome before closing it.');
    return intro + section(kind === 'suggestion' ? (passed ? 'Suggestions passed on' : 'Suggestions sent to you') : kind === 'concern' ? (passed ? 'Concerns passed on' : 'Concerns sent to you') : endorsedOnly ? 'Endorsed to you' : passed ? 'Passed on to the School Head' : 'Sent to you', mine.map(caseCard).join('') || empty(kind ? 'Nothing here yet.' : passed ? 'Nothing has been passed on yet.' : 'No private cases sent to you.')) + others + (kind ? '' : settings);
  }
  // Change history: who acted, in which role, on what, what was decided and why. Only the School Head, chairperson and Vice-Chairperson see it.
  const HISTORY_AREAS = {
    money: ['financeSubmit', 'financeCheck', 'financeReview', 'recordSpent', 'projectReceipt'],
    projects: ['activitySave', 'activityBudget', 'activityCancel', 'projectUpdate', 'projectPhoto', 'projectPhotoRemove', 'projectReopen', 'amendProject'],
    proposals: ['screen', 'chairProposal', 'resubmit', 'withdraw', 'headDecision', 'headApproved', 'closeBallot', 'voteDeadline', 'proposalReply'],
    records: ['minutesUpload', 'minutesEdit', 'minutesReview', 'freeze', 'reviseResolution', 'sign', 'unsign', 'finalizeResolution', 'announce', 'announceEdit', 'announceRemove'],
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
        const d = new Date(at);
        return new Intl.DateTimeFormat('en-PH', d.getFullYear() === new Date().getFullYear() ? {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'} : {dateStyle: 'medium', timeStyle: 'short'}).format(d);
      } catch (e) {
        return at;
      }
    };
    const entry = x => {
      const acct = db().accounts.find(a => a.id === x.who),
        role = x.role || acct?.role,
        by = x.who === 'system' ? 'Done automatically' : (acct?.name || x.who) + (role ? ' · ' + (E.roles[role] || role) : '') + (x.cover ? ' · standing in for the ' + (E.roles[x.cover] || x.cover) : ''),
        bits = [when(x.at), by];
      if (x.what || x.ref) bits.push((x.what ? x.what + ' · ' : '') + x.ref);
      if (x.cents) bits.push(cash(x.cents));
      if (x.decision && DECISIONS[x.decision]) bits.push(DECISIONS[x.decision]);
      const title = String(x.event || '').replace(/,? without an officer vote$/i, '');
      return '<article class="entry audit-entry audit-compact' + (isRetraction(x) ? ' is-retracted' : '') + '"><div class="audit-row"><h3>' + esc(title) + '</h3>' + (x.outcome && labels[x.outcome] ? badge(x.outcome) : '') + '</div><p class="audit-sub">' + bits.map(esc).join(' · ') + '</p>' + (x.reason ? '<p class="audit-reason">' + esc(x.reason) + '</p>' : '') + '</article>';
    };
    const limit = ui.historyLimit || 20;
    return '<p class="page-lead">Every major change is recorded here: who did it, in which role, and what was decided. Entries are added automatically. The app has no way to edit or remove them.</p><div class="chips" role="group" aria-label="Filter the history">' + chips + '</div>' + (shown.length ? shown.slice(0, limit).map(entry).join('') + (shown.length > limit ? '<div class="entry-actions">' + btn('Show 20 more', 'histmore', '', 'light') + '</div>' + para('Showing the latest ' + limit + ' of ' + shown.length + '.') : '') : empty('Nothing recorded for this filter yet.'));
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
    activities: activitiesView,
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
    return intro + form('financeSubmit', (officer || orig ? hidden('direction', dir) + notice(officer ? 'Collection handover · Money in' : 'Linked correction for ' + orig.id + ' · Money ' + dir) : select('direction', 'Movement', [['in', 'Money in'], ['out', 'Money out']], dir)) + hidden('adjustment', orig?.id || prior?.adjustment || '') + input('date', officer ? 'Collection date' : 'Transaction date', read?.date || prior?.date || t(), 'date') + input('receipt', 'Receipt / batch reference', read?.receipt || prior?.receipt || '') + '<div class="entry-meta">Parents can read this once it is posted. Do not write a parent’s or pupil’s name.</div>' + input('purpose', 'Purpose shown to parents', read?.purpose || prior?.purpose || (orig ? 'Correction · ' + orig.purpose : ''), 'text', 'required maxlength="140"') + (orig || officer ? hidden('project', '') : select('project', 'Expense allocation', [['', 'General fund (not for a project)'], ...db().projects.filter(x => x.status !== 'cancelled').map(x => [x.id, x.title]), ...allActivities().filter(x => x.status === 'scheduled').map(x => [x.id, 'Activity: ' + x.title])], prior?.project || '') + area('overReason', 'Why it is over budget (only if this goes over the budget)', prior?.overWhy || '', 'maxlength="300" rows="2"')) + '<fieldset><legend>' + (scan ? 'Scanned Line Items' : 'Private Line Items') + '</legend><div id="item-rows">' + initItems.map(row).join('') + '</div>' + btn(scan ? 'Add a missed line' : 'Add item', 'addItem', '', 'light', 'plus') + totalLine(lineSum(initItems), read ? read.writtenTotal : null) + '</fieldset>' + source + ck('verifiedItems', scan ? 'I compared every scanned line with the paper original and corrected anything that was wrong.' : 'I checked the amounts and item descriptions against the supporting document.', true), officer ? 'Submit to treasurer' : 'Submit to chairperson', prior?.id || '');
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
    if (kind === 'forgot' && S.shared) return ['Reset your password', notice('Ask the SPTA chairperson or the School Head for a one-time code. They will check who you are in person first. The code works once, within 30 minutes. Choose your new password yourself; never tell it to anyone.') + form('reset', input('mobile', 'Mobile number', ui.prefill || '', 'tel', 'required autocomplete="username" placeholder="09171234567"') + input('code', 'One-time code', '', 'text', 'required minlength="12" maxlength="16" autocomplete="one-time-code" autocapitalize="characters" placeholder="ABCD-EFGH-JKLM"') + input('password', 'New password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"'), 'Save new password') + btn('Back to sign in', 'dlg:login', '', 'text')];
    if (kind === 'forgot') return ['Reset your password', notice('This works on a phone you have signed in on before. On a new phone, ask an SPTA officer for help.') + form('reset', input('mobile', 'Mobile number', ui.prefill || '', 'tel', 'required autocomplete="username" placeholder="09171234567"') + input('lastName', 'Last name', '', 'text', 'required maxlength="40" autocomplete="family-name"') + gradePair('homeroom', '', 'Your child’s grade and section, as you registered it') + input('password', 'New password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"'), 'Save new password') + btn('Back to sign in', 'dlg:login', '', 'text')];
    if (kind === 'children') return [me().childName ? 'Other students' : 'My students', form('profileUpdate', '<div id="student-rows">' + (a.children || []).concat((a.children || []).length ? [] : ['']).map(x => studentRow(...splitChild(x))).join('') + '</div>' + btn('Add another student', 'addStudent', '', 'light', 'plus'), 'Save list')];
    if (kind === 'cover') return ['Stand in for an absent officer', notice('You do that officer’s tasks until the date you set. A fund record you send or check while standing in gets its final approval from the Vice-Chairperson, so two people still check every record.') + form('cover', select('enabled', 'What would you like to do?', [['yes', 'Stand in for an officer'], ['no', 'Stop standing in']], 'yes') + '<div data-when="enabled" data-values="yes">' + select('role', 'Officer who is away', E.coverRoles.map(r => [r, E.roles[r]]), E.coverRoles.includes(id) ? id : standIn()) + input('until', 'Until', db().cover?.until || weekAhead(), 'date', 'required min="' + t() + '"') + input('reason', 'Reason', db().cover?.reason || '', 'text', 'required minlength="3" maxlength="150" placeholder="On leave or has not joined the app yet"') + '</div>', 'Save')];
    if (kind === 'withdraw') {
      const item = p || db().cases.find(x => x.id === id);
      if (!item) return ['Withdraw', empty('This is no longer available.')];
      if (!p && item.protection) return ['Stop follow-ups', '<h3>' + esc(titleCase(item.subject)) + '</h3>' + notice('The school already received this report, so it stays with the school. It cannot be taken back, because the school must look after every child’s safety. If you continue, the SPTA will stop following up with you here. You can still talk to your child’s class adviser or the school administration at any time.') + form('withdraw', hidden('kind', 'case') + ck('confirm', 'Stop follow-ups from the SPTA.', true), 'Stop follow-ups', id)];
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
    if (kind === 'register') return ['Create an account', (isLive() ? '' : notice('Use fictional details for this rehearsal.')) + (PRIVACY_DRAFT && isLive() ? notice('Pilot version. The school’s Data Protection Officer is still reviewing the Privacy Notice below.') : '') + form('register', '<div class="name-pair">' + input('firstName', 'First name', '', 'text', 'required maxlength="40" autocomplete="given-name"') + input('lastName', 'Last name', '', 'text', 'required maxlength="40" autocomplete="family-name"') + '</div>' + input('mobile', 'Mobile number', '', 'tel', 'required autocomplete="tel" placeholder="09171234567"') + input('childName', 'Your child’s full name', '', 'text', 'required maxlength="80" autocomplete="off"') + gradePair('homeroom', '', 'Your child’s grade and section') + input('password', 'Password (10 or more characters)', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"') + ck('officer', 'I am the HPTA president of this section and I am requesting officer access.') + '<div class="entry-meta">Officer access starts after the School Head or chairperson checks the roster.</div><details class="privacy-notice"><summary>Read the Privacy Notice</summary>' + privacyBody() + '</details>' + ck('consent', 'I have read the Privacy Notice. I agree that the SPTA may collect and use my information, and my child’s grade and section, as described.', true), 'Create account')];
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
    if (['concern', 'suggestion'].includes(kind)) return [kind === 'concern' ? 'Report a private concern' : 'Make a suggestion', form('caseSubmit', hidden('kind', kind) + input('subject', 'Subject', '', 'text', 'required minlength="3" maxlength="100"') + select('category', 'Category', E.categories) + area('body', kind === 'concern' ? 'What happened?' : 'What would you like to improve?', '', 'required minlength="6" maxlength="700"') + '<fieldset class="evidence"><legend>Photo evidence (optional, up to ' + E.photosPerCase + ')</legend><label>Photo 1<input type="file" name="evidence1" accept="image/jpeg,image/png,image/webp"></label><label>Photo 2<input type="file" name="evidence2" accept="image/jpeg,image/png,image/webp"></label><div class="entry-meta">Please do not photograph children’s faces. A photo can show who you are, so if you hide your name, choose photos that do not.</div></fieldset>' + hidden('assigned', 'chair') + (kind === 'concern' ? ck('safety', 'This is about a child’s safety (bullying, harm or abuse)') + '<div class="entry-meta" data-when="safety" data-values="yes">It goes straight to the school. Write what happened, when and where, and whether the child is safe now. You may name the pupils involved if you know them.</div>' : '') + (kind === 'concern' ? '<div data-when="safety" data-values="yes">' + notice('This goes privately to the school. Only the school staff who handle child-protection reports can read it. The SPTA officers cannot.') + '</div><div data-when="safety" data-values="no">' + notice('This goes privately to the SPTA. Only the officers who handle feedback can read it.') + '</div>' : notice('This goes privately to the SPTA. Only the officers who handle feedback can read it.')) + ck('hideName', 'Hide my name from the reviewer') + (kind === 'concern' ? '<div class="entry-meta" data-when="safety" data-values="yes">The school will not see your name or section and will reply here in the app. The school may need to reach you to keep a child safe, so leave your name on if you can. You can hide it ' + E.hiddenPerMonth + ' times a month.</div><div class="entry-meta" data-when="safety" data-values="no">' : '<div class="entry-meta">') + 'The officer will not see your name or section and will reply here in the app. You can do this ' + E.hiddenPerMonth + ' times a month.</div>' + notice('If a child is in immediate danger, contact their class adviser or the school administration directly now. This app is not an emergency channel.'), 'Send privately')];
    if (kind === 'screen') return [p.title, '<div class="entry-meta step-line">For screening</div>' + para(p.details) + form('screen', select('decision', 'Next step', [['screen', 'Publish and open the officers’ vote'], ['return', 'Return for revision'], ['decline', 'Decline']]) + '<div data-when="decision" data-values="screen">' + input('title', 'Reviewed title', p.publicTitle || p.title) + area('text', 'Description safe to share', p.publicText || p.details) + input('budget', 'Proposed SPTA allocation (₱)', p.budget / 100, 'number', 'required min="0" step="0.01"') + '<div class="fund-check ok" id="screen-fund" data-available="' + E.funding(db()).available + '">' + icon('info', 'sm') + '<span><b>SPTA funds available now: ' + cash(E.funding(db()).available) + '</b><span id="screen-fund-note">An allocation above this amount will be marked as needing fundraising.</span></span></div>' + ck('fundraising', 'This proposal seeks voluntary contributions.', false, !!p.fundraising) + (canChair() ? ck('noVote', 'This project does not need an officers’ vote or a resolution. Send it straight to the School Head for approval.') : '') + (canChair() ? '<div data-when="noVote" data-values="no">' : '<div>') + input('closes', 'Voting closes on', E.voteCloses({date: t()}), 'date', 'min="' + t() + '"') + '<div class="entry-meta">Officers have one month to vote unless you change this date.</div></div></div><div data-when="decision" data-values="return decline">' + area('reason', 'Feedback for the parent') + '</div>', 'Save screening', id)];
    if (kind === 'vote') return [b.title, '<div class="entry-meta step-line">For your vote</div>' + upara(b.body) + '<div class="entry-meta">Proposed SPTA allocation ' + cash(b.budget) + '</div>' + ballotFund(b) + notice('Voting closes on ' + date(E.voteCloses(b)) + '.') + form('vote', select('vote', 'Your vote', [['', 'Choose a response'], ['yes', 'Proceed'], ['no', 'Do not proceed'], ['abstain', 'Abstain']], '', 'required'), 'Submit once', id)];
    if (kind === 'close') return ['Close voting', para(b.title) + notice('Voting closes by itself once the result is decided. Closing early records the result with the votes received so far.') + form('closeBallot', ck('confirm', 'The voting period has ended. Record the result.', true), 'Close and record', id)];
    if (kind === 'chairProposal') {
      return ['Add for School-Head approval', notice('Use this for a project the officers have already agreed on, or one that you decide needs no vote or resolution. It skips screening and the officers’ vote and goes straight to the School Head. On the resolution, everyone who signs counts as agreeing.') + form('chairProposal', input('title', 'Project title', '', 'text', 'required minlength="4" maxlength="100"') + select('category', 'Category', E.categories) + area('details', 'Project details', '', 'required minlength="8" maxlength="700"') + input('budget', 'Proposed SPTA allocation (₱)', '', 'number', 'required min="0" step="0.01"') + '<div class="fund-check ok" id="screen-fund" data-available="' + E.funding(db()).available + '">' + icon('info', 'sm') + '<span><b>SPTA funds available now: ' + cash(E.funding(db()).available) + '</b><span id="screen-fund-note">An allocation above this amount will be marked as needing fundraising.</span></span></div>' + ck('fundraising', 'This proposal seeks voluntary contributions.') + ck('noVote', 'This project does not need an officers’ vote or a resolution (for example a repair or renovation).') + ck('headApproved', 'The School Head already approved this project.') + '<div data-when="headApproved" data-values="yes">' + notice('The School Head already approved it, so it is posted as an approved project right away.') + input('date', 'Date the School Head approved', t(), 'date', 'max="' + t() + '"') + input('ga', 'General Assembly agreement reference (only if this seeks voluntary contributions)', '', 'text', '') + ck('concur', 'The School Head agreed to the voluntary contributions (only if this seeks voluntary contributions).') + '</div>', 'Send to the School Head').replace('>Send to the School Head</button>', '><span data-when="headApproved" data-values="no">Send to the School Head</span><span data-when="headApproved" data-values="yes">Post approved project</span></button>')];
    }
    if (kind === 'headApproved') return [p.publicTitle || p.title, '<div class="entry-meta step-line">Record the School Head’s approval</div>' + upara(p.publicText || p.details) + '<div class="entry-meta">Proposed SPTA allocation ' + cash(p.budget) + '</div>' + notice('Use this when the School Head has already approved this project, for example at a meeting or by message. It is recorded in the Change History under your name, and the School Head is told.') + (p.noVote ? notice('This project needs no officers’ vote or resolution, so it becomes an approved project right away.') : notice('The secretary gets the draft resolution right away.')) + form('headApproved', ck('approved', 'The School Head already approved this project.', true) + input('date', 'Date the School Head approved', t(), 'date', 'required max="' + t() + '" min="' + p.created + '"') + (p.fundraising ? input('ga', 'General Assembly agreement reference') + ck('concur', 'The School Head agreed to the voluntary contributions.', true) : ''), 'Record approval', id)];
    if (kind === 'head') return [p.publicTitle, '<div class="entry-meta step-line">For the School Head’s decision</div>' + upara(p.publicText) + (p.direct ? notice('Added by the chairperson.') : '') + (p.noVote ? notice('The chairperson marked this as not needing an officers’ vote or a resolution. Your approval is the final step.') : '') + '<div class="entry-meta">Proposed SPTA allocation ' + cash(p.budget) + '</div>' + proposalFund(p) + form('headDecision', select('decision', 'Decision', [['approve', 'Approve project'], ['return', p.noVote ? 'Return for a revised proposal' : 'Return for revised proposal and new vote'], ['decline', 'Decline']]) + (p.fundraising ? '<div data-when="decision" data-values="approve">' + input('ga', 'General Assembly agreement reference') + ck('concur', 'I record School-Head concurrence for the voluntary contributions.', true) + '</div>' : '') + '<div data-when="decision" data-values="return decline">' + area('reason', 'Reason for the parent') + '</div>', 'Record decision', id)];
    if (kind === 'project' || kind === 'cancel') {
      const proj = db().projects.find(x => x.id === id);
      return [kind === 'cancel' ? 'Cancel project' : 'Update project', para(proj.title) + form('projectUpdate', kind === 'cancel' ? hidden('status', 'cancelled') + area('reason', 'Public cancellation reason') + area('remainder', 'What happened to the remaining ' + cash(proj.budget - E.projectSpend(db(), id)) + '?') : select('status', 'Status', [['in_progress', 'In progress'], ['completed', 'Completed']]) + select('owner', 'Project lead', db().accounts.filter(x => x.active && E.leaders.includes(x.role)).map(x => [x.id, x.name]), proj.owner) + area('phase', 'Public progress update', proj.phase) + input('progress', 'Progress (%)', proj.progress, 'number', 'required min="0" max="100" step="1"'), kind === 'cancel' ? 'Publish cancellation' : 'Publish progress', id)];
    }
    if (kind === 'receipt') {
      const proj = db().projects.find(x => x.id === id),
        spent = E.projectSpend(db(), id);
      return ['Add receipt', para(proj.title + ' · spent so far ' + cash(spent) + ' of ' + cash(proj.budget)) + form('projectReceipt', '<label>Receipt photo or PDF<input type="file" name="attachment" accept="image/*,application/pdf" required></label>' + input('amount', 'Amount on the receipt (₱)', '', 'number', 'required min="0.01" step="0.01"') + input('date', 'Date on the receipt', t(), 'date', 'required max="' + t() + '"') + '<details class="more-fields"><summary>Add a note or an over-allocation reason</summary>' + input('note', 'Note shown to families (optional)', '', 'text', 'maxlength="140"') + area('overReason', 'Why it is over the allocation (only if needed)', '', 'maxlength="300"') + '</details>', 'Post receipt', id)];
    }
    if (kind === 'spent') {
      const proj = db().projects.find(x => x.id === id),
        spent = E.projectSpend(db(), id),
        bal = E.fundBalance(db());
      return ['Correct amount spent', para(proj.title + ' · allocation ' + cash(proj.budget) + ' · spent so far ' + cash(spent)) + notice('Use this only to fix a mistake. Enter the correct total spent so far. The difference is posted to the SPTA funds and shows in the funds log under your name.') + form('recordSpent', input('spent', 'Total amount spent so far (₱)', (spent / 100).toFixed(2), 'number', 'required min="0" step="0.01"') + input('purpose', 'Reason for the correction (optional)', '', 'text', 'maxlength="140"') + input('date', 'Date spent', t(), 'date', 'required max="' + t() + '"') + area('overReason', 'Why it is over the allocation (only if the total is above ' + cash(proj.budget) + ')', '', 'maxlength="300"') + '<div class="entry-meta">SPTA cash balance now: ' + cash(bal) + '</div>', 'Post correction', id)];
    }
    if (kind === 'amend') {
      const proj = db().projects.find(x => x.id === id),
        spent = E.projectSpend(db(), id);
      return ['Change project', para(proj.title + ' · allocation ' + cash(proj.budget) + ' · spent ' + cash(spent)) + notice('The officers’ vote and the signatures cover what was approved, nothing more. A wording fix or a lower amount is recorded and shown to families right away. A higher amount, or a different purpose, goes to a new officer vote and then to the School Head. Putting back an amount the officers already approved needs no new vote.') + form('amendProject', select('kind', 'What is changing?', [['wording', 'Fix the wording (same purpose, same amount)'], ['lower', 'Lower the amount'], ['raise', 'Raise the amount · new vote needed'], ['purpose', 'Change what the money is for · new vote needed']], 'wording') + '<div data-when="kind" data-values="wording purpose">' + input('title', 'Project title', proj.title, 'text', 'required minlength="4" maxlength="100"') + area('text', 'Project details', proj.text, 'required minlength="8" maxlength="700"') + '</div><div data-when="kind" data-values="wording">' + ck('sameMeaning', 'This does not change what the money is for.', true) + '</div><div data-when="kind" data-values="lower raise purpose">' + input('budget', 'Allocation (₱)', '', 'number', 'required min="0.01" step="0.01"') + '</div><div data-when="kind" data-values="raise purpose">' + input('closes', 'Voting closes on (optional)', '', 'date', '') + '</div>' + area('reason', 'Reason for the change, shown to families', '', 'required minlength="8" maxlength="350"'), 'Record change', id)];
    }
    if (kind === 'reply') {
      const c = db().cases.find(x => x.id === id);
      const verifyFirst = !!c && E.onDesk(c) && !c.protection && !['chair', 'vice'].includes(me().role);
      return ['Update status or reply', para(c.subject) + notice('The sender receives an automated response for each status. ' + (verifyFirst ? 'When the action is done, choose “Action taken” and write what was done. The chairperson or Vice-Chairperson then verifies it and closes it.' : 'To mark it resolved, write what was done, or explain why no action is needed.') + (c.forwarded && !lead() && !c.endorsed && !c.protection ? ' The sender reads your reply as coming from the SPTA, for the School Head.' : '')) + form('caseReply', select('status', 'Status', verifyFirst ? [['assigned', 'Reviewed'], ['action_taken', 'Action taken']] : c.protection ? [['assigned', 'School handling'], ['resolved', 'Closed']] : [['assigned', 'Reviewed'], ['resolved', 'Resolved']], verifyFirst ? (c.status === 'action_taken' ? 'action_taken' : 'assigned') : c.status === 'resolved' ? 'resolved' : 'assigned') + area('reply', verifyFirst ? 'Personal reply (needed for Action taken)' : 'Personal reply (needed to resolve)', '', 'maxlength="600"') + input('due', 'Next update by', c.due, 'date') + (c.hidden ? ck('block', 'This was a false or abusive report. Stop this sender from hiding their name again. Their name stays hidden.') : ''), 'Save', id)];
    }
    if (kind === 'forward') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Pass on to the School Head', empty('This is no longer here.')];
      return ['Pass on to the School Head', para(c.subject) + notice('The School Head and the secretary will be able to read this. The secretary can reply to the sender for the School Head. ' + (c.hidden ? 'The sender’s name stays hidden. ' : '') + 'The sender never sees your note.') + form('caseForward', select('track', 'What kind of matter is it?', [['school', 'School matter · The School Head leads the action'], ['grievance', 'PTA dispute · Formal grievance route']], 'school') + '<div data-when="track" data-values="grievance">' + notice('A dispute between PTA members or officers goes through a formal grievance. The School Head sets up the proper committee. Do not settle it informally or impose sanctions.') + '</div>' + area('note', 'Note for the School Head (optional)', '', 'maxlength="500" placeholder="What you need from the School Head, or what more you want to know"'), 'Pass on', id)];
    }
    if (kind === 'endorse') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Endorse to an officer', empty('This is no longer here.')];
      const people = db().accounts.filter(x => x.active && !x.vacant && E.boardRoles.includes(x.role) && !['chair', 'vice'].includes(x.role) && x.id !== c.owner).map(x => [x.id, x.name + ' · ' + (x.role === 'bod' ? x.homeroom || 'Section president' : E.roles[x.role])]);
      if (!people.length) return ['Endorse to an officer', empty('No other officers have joined the app yet.')];
      return ['Endorse to an officer', para(c.subject) + notice('For an SPTA matter, such as a routine task for a section president. Only that officer can read this case. ' + (c.hidden ? 'The sender’s name stays hidden. ' : 'They see the sender’s grade and section, not their name. ') + 'They can reply and mark it resolved. The sender reads it as a reply from the SPTA. You can take it back at any time.') + form('caseEndorse', select('to', 'Endorse to', [['', 'Choose an officer'], ...people], '', 'required') + area('note', 'What you need done (optional)', '', 'maxlength="500"'), 'Endorse', id)];
    }
    if (kind === 'protect') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Possible child-protection concern', empty('This is no longer here.')];
      return ['Possible child-protection concern', para(c.subject) + notice('Use this if a child may be hurt, abused, bullied or in danger. Refer it now; do not wait for the parent to answer a question. The school assesses and handles it. If a child is in danger now, also call the school directly.') + form('caseProtect', ck('confirm', 'Refer this now.', true), 'Refer now', id)];
    }
    if (kind === 'caseAsk') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Ask for more details', empty('This is no longer here.')];
      return ['Ask for more details', para(c.subject) + notice('The sender gets a notification and answers here in the app. They read your question as coming from the SPTA.') + (c.protection && me().role !== 'head' ? notice('Ask only what the parent already knows: when and where it happened, and whether the child is safe right now. Do not ask the parent to find out more. The school handles the rest.') : !c.protection && ['chair', 'vice'].includes(me().role) ? notice('If a child may be in danger, refer it as a child-protection concern now. Do not wait for the answer. You can still ask after referring.') : '') + form('caseAsk', area('question', 'Your question', '', 'required minlength="3" maxlength="500" placeholder="Example: When and where did this happen? Is your child safe right now?"'), 'Send question', id)];
    }
    if (kind === 'caseAnswer') {
      const c = db().cases.find(x => x.id === id && x.owner === S.me);
      if (!c) return ['Answer', empty('This is no longer here.')];
      const q = (c.messages || []).filter(m => m.from !== 'sender').slice(-1)[0];
      return ['Answer the SPTA', para(c.subject) + (q ? '<div class="portal-note personal"><b>The SPTA asked</b>' + para(q.text) + '</div>' : '') + form('caseAnswer', area('answer', 'Your answer', '', 'required minlength="3" maxlength="700" rows="6"'), 'Send answer', id)];
    }
    if (kind === 'caseVerify') {
      const c = db().cases.find(x => x.id === id);
      if (!c || c.status !== 'action_taken') return ['Verify outcome', empty('Nothing is waiting to be verified.')];
      return ['Verify outcome', '<h3>' + esc(titleCase(c.subject)) + '</h3>' + para(c.body) + (c.reply ? '<div class="portal-note personal"><b>What was done</b>' + para(c.reply) + '</div>' : '') + form('caseVerify', select('decision', 'Outcome', [['close', 'Verified · Close it'], ['more', 'Needs more action']], 'close') + area('note', 'Note (needed if more action is needed)', '', 'maxlength="500"'), 'Save', id)];
    }
    if (kind === 'recovery') return ['Help a parent reset their password', notice('Only do this with the parent in front of you. Check who they are against the school’s records first, the way the school has approved. A child’s name, grade or section alone is not proof. The parent types the code and chooses a new password on their own phone. Never ask for their password.') + form('recoveryCode', input('mobile', 'The parent’s mobile number', '', 'tel', 'required placeholder="09171234567"') + ck('confirm', 'I checked this parent’s identity in person.', true), 'Make a one-time code')];
    if (kind === 'recoveryShown') {
      const r = ui.recovery || {};
      return ['One-time code', '<p class="recovery-code">' + esc(r.code || '') + '</p>' + para('For ' + (r.name || '') + (r.homeroom ? ' · ' + r.homeroom : '') + '. It works once, within ' + (r.minutes || 30) + ' minutes.') + notice('Show it to the parent only. It is not shown again. The parent opens Sign in, taps Forgot password, and enters their mobile number, this code and a new password.') + btn('Done', 'closeRecovery', '', 'primary')];
    }
    if (kind === 'intake') {
      const on = !!db().settings.intake?.secretary;
      return [on ? 'End the secretary’s designation' : 'Designate the secretary', para(on ? 'Only you will receive child-protection reports.' : 'The secretary will receive and follow up child-protection reports with you. The school still assesses each case.') + form('intakeSetting', hidden('secretary', on ? 'no' : 'yes') + (on ? '' : ck('confirm', 'The school has authorized the secretary to receive these reports.', true) + input('reference', 'Memo or reference (optional)', '', 'text', 'maxlength="120" placeholder="e.g. School Memo No. 12, s. 2026"')), on ? 'End designation' : 'Designate')];
    }
    if (kind === 'caseAck') {
      const c = db().cases.find(x => x.id === id);
      if (!c || !c.protection) return ['Acknowledge referral', empty('This is no longer here.')];
      return ['Acknowledge referral', '<h3>' + esc(titleCase(c.subject)) + '</h3>' + para(c.body) + fromLine(c) + notice('Acknowledging tells the SPTA officers that the school received this referral. They see only that it was acknowledged. Handle the case under the school’s child protection procedure.') + form('caseAcknowledge', ck('confirm', 'The school received this referral.', true), 'Acknowledge', id)];
    }
    if (kind === 'caseReturn') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Not a child-protection concern', empty('This is no longer here.')];
      return ['Not a child-protection concern', para(c.subject) + notice('Use this if the school’s assessment finds this is not a child-protection matter, for example a mistaken or false report. It goes back to the chairperson and Vice-Chairperson to handle as an ordinary concern.') + form('caseReturn', area('reason', 'What you found', '', 'required minlength="6" maxlength="350"'), 'Return', id)];
    }
    if (kind === 'caseNote') {
      const c = db().cases.find(x => x.id === id);
      if (!c) return ['Note', empty('This is no longer here.')];
      const follow = holds('secretary') && !caseHandler(c);
      return [follow ? 'Record follow-up' : 'Add a note', para(c.subject) + notice(c.protection ? 'The sender cannot read it.' : 'Seen by the chairperson, the Vice-Chairperson' + (c.endorsed ? ', the endorsed officer' : '') + (c.forwarded ? ', the School Head and the secretary' : '') + '. The sender cannot read it.') + form('caseNote', area('note', follow ? 'Follow-up' : 'Note', '', 'required minlength="3" maxlength="500"'), 'Save note', id)];
    }
    if (kind === 'proposalReply') return ['Personal reply', para(p.title) + notice('Optional. The person who proposed already receives an automated response at each status. Only they see this reply.') + form('proposalReply', area('reply', 'Your reply as ' + roleName(a), p.reply || '', 'required minlength="3" maxlength="600"'), 'Send personal reply', id)];
    if (kind === 'resolution') return ['Read resolution', resolutionPaper(r, true)];
    if (kind === 'freeze') return ['Edit and publish version ' + r.version, notice('This draft was created automatically from the approved proposal. Adjust the wording if needed. The allocation of ' + cash(r.budget) + ' stays as voted.') + form('freeze', hidden('version', r.version) + input('title', 'Project title', r.title, 'text', 'required minlength="4" maxlength="100"') + area('text', 'Project details', r.text, 'required minlength="8" maxlength="700"') + input('no', 'Resolution number', r.no || E.nextResolutionNumber(db(), r.sy || Number(E.today().slice(0, 4))), 'number', 'required min="1" max="999" step="1"') + area('clause', 'Resolution wording (as it will be printed)', r.clause || E.resolutionText(r.title, r.budget, r.direct), 'required minlength="12" maxlength="4000" rows="14"') + select('signerRule', 'Required signatures', [['all', 'All officers'], ['policy', 'Named signers under a documented school rule']]) + '<div data-when="signerRule" data-values="policy">' + input('signerPolicy', 'School signer policy or resolution reference') + '<fieldset><legend>Designated Required Signers</legend><div class="roster-picker">' + r.signers.map(s => '<label class="tick"><input type="checkbox" name="requiredSigners" value="' + esc(s.id) + '"><span>' + esc(s.name) + '</span></label>').join('') + '</div></fieldset></div>' + ck('confirm', 'I verified the wording and required signers against the school record.', true), 'Publish for signatures', id)];
    if (kind === 'sign') return ['Sign resolution', resolutionPaper(r, false) + form('sign', hidden('version', r.version) + select('response', 'My response', [['acknowledged', 'Sign this resolution'], ['not_signed', 'Decline to sign']]) + '<div data-when="response" data-values="acknowledged"><div class="sign-field"><span>Draw your signature</span><canvas class="sign-pad" width="600" height="200" aria-label="Signature box. Draw with your finger or mouse."></canvas><input type="hidden" name="signature" value="">' + btn('Clear', 'signClear', '', 'light') + '</div>' + para('It will appear on the resolution as: ' + a.name + ' · ' + signerLine(a) + ' · ' + date(E.today())) + '</div>' + ck('consent', 'I reviewed this exact version and this is my own response.', true), 'Record my response', id)];
    if (kind === 'fileResolution') return ['File resolution', notice(E.signaturesPending(r).length + ' required signature(s) outstanding. Unanswered and declined responses keep their actual status on the printout.') + form('finalizeResolution', hidden('version', r.version) + area('parentSummary', 'Privacy-reviewed summary for families', r.text) + area('reason', 'Record the applicable signer policy, exceptions and filing reference') + ck('confirm', 'I checked that the required signers have signed under the applicable school procedure.', true), 'File and publish parent summary', id)];
    if (kind === 'reviseResolution') return ['Correct resolution wording', notice('Starting a new version reopens secretary review and requires fresh signatures. Scope or budget changes need a new proposal and vote.') + form('reviseResolution', hidden('version', r.version) + area('reason', 'Reason for a document correction'), 'Start new version', id)];
    if (kind === 'minute') {
      const m = db().minutes.find(x => x.id === id);
      if (!m) return ['Minutes of the meeting', empty('These minutes are no longer waiting.')];
      const mine = m.state === 'for_chair' && canChair() || m.state === 'for_head' && a.role === 'head';
      return [m.state === 'for_chair' ? 'Approve minutes' : m.state === 'for_head' ? 'Note and file minutes' : 'Minutes of the meeting', '<div class="entry-meta">' + esc(m.id + ' · Meeting of ' + date(m.date)) + '</div><h3 class="ut">' + esc(titleCase(m.title)) + '</h3>' + upara(m.summary) + para('Due ' + date(m.due) + (m.state !== 'filed' && m.due < t() ? ' · Overdue' : '')) + '<div class="entry-actions">' + btn('Read original', 'minuteFile', m.id) + (mine ? btn(m.state === 'for_chair' ? 'Approve minutes' : 'Note and file', 'minutesReview', m.id, 'primary') : '') + '</div>'];
    }
    if (kind === 'minutesEdit') {
      const m = db().minutes.find(x => x.id === id);
      if (!m || !['for_chair', 'for_head'].includes(m.state)) return ['Correct minutes', empty('These minutes can no longer be edited.')];
      return ['Correct minutes', form('minutesEdit', input('title', 'Meeting title', m.title, 'text', 'required minlength="3" maxlength="120"') + input('date', 'Meeting date', m.date, 'date', 'required max="' + t() + '"') + area('summary', 'Summary of the meeting', m.summary, 'required rows="7" minlength="6" maxlength="700"') + notice(m.covered ? 'The signed file stays the same. The corrected minutes go to the School Head.' : 'The signed file stays the same. The corrected minutes go back to the chairperson for approval. To change the signed file, withdraw these minutes and upload them again.'), 'Save correction', id)];
    }
    if (kind === 'minutes') return ['Upload meeting minutes', form('minutesUpload', input('title', 'Meeting title', '', 'text', 'required minlength="3" maxlength="120" placeholder="Example: SPTA General Meeting"') + input('date', 'Meeting date', t(), 'date', 'required max="' + t() + '"') + upload('Signed minutes (photo or PDF)') + area('summary', 'Summary of the meeting', '', 'required rows="7" minlength="6" maxlength="700" placeholder="Example: On November 17, 2026, the SPTA officers met at the school. They talked about the year-end raffle and the new ECES Bayanihan app. They agreed to hold the General Assembly on December 7, 2026. The next officers’ meeting will be in January."') + ck('confirm', me().role === 'secretary' ? 'I sign these minutes as secretary and submit them for chair approval.' : 'I sign these minutes while standing in for the secretary and send them to the School Head to be noted and filed.', true), 'Submit minutes')];
    if (kind === 'activity') {
      const act = (db().activities || []).find(i => i.id === id);
      return [act ? 'Edit activity' : 'Add an activity', form('activitySave', input('title', 'Activity name', act?.title || '', 'text', 'required minlength="3" maxlength="100"') + input('date', 'Date', act?.date || '', 'date', 'required' + (act ? '' : ' min="' + t() + '"')) + input('time', 'Time (optional)', act?.time || '', 'text', 'maxlength="30" placeholder="4:00 PM"') + input('place', 'Place (optional)', act?.place || '', 'text', 'maxlength="100"') + area('details', 'Details (optional)', act?.details || '', 'maxlength="600"') + select('audience', 'Who is it for?', [['everyone', 'All parents and officers'], ['officers', 'Officers only']], act?.audience || 'everyone') + para('The treasurer sets the budget after the activity is added. Please do not include children’s names or photos.'), act ? 'Save changes' : 'Add activity', id)];
    }
    if (kind === 'activityBudget') {
      const act = (db().activities || []).find(i => i.id === id);
      if (!act) return ['Set a budget', empty('This activity is no longer available.')];
      const spent = E.projectSpend(db(), act.id),
        before = Math.max(0, (act.budget || 0) - spent);
      return ['Set a budget', '<h3>' + ut(titleCase(act.title)) + '</h3>' + para('Already spent: ' + cash(spent)) + notice('The budget is set aside from SPTA funds that are not already committed to projects. Available for this activity: ' + cash(E.funding(db()).available + before) + '.') + form('activityBudget', input('budget', 'Budget (pesos)', act.budget ? String(act.budget / 100) : '', 'text', 'required inputmode="decimal" placeholder="3000"'), 'Save budget', id)];
    }
    if (kind === 'activityCancel') {
      const act = (db().activities || []).find(i => i.id === id);
      if (!act) return ['Cancel activity', empty('This activity is no longer available.')];
      return ['Cancel activity', '<h3>' + esc(titleCase(act.title)) + '</h3>' + notice('Cancelling removes it from the calendar and releases any budget that is not spent.') + form('activityCancel', area('reason', 'Why is it cancelled?', '', 'required minlength="4" maxlength="200"'), 'Cancel activity', id)];
    }
    if (kind === 'casePhoto') {
      const [cid, at] = String(id).split('|'),
        c = (db().cases || []).find(x => x.id === cid),
        ph = c?.photos?.[Number(at)];
      if (!ph) return ['Photo evidence', empty('This photo is no longer available.')];
      return ['Photo evidence', photoImg({file: ph}, 'Photo evidence', 'attachment-image') + '<div class="entry-meta">' + esc(c.subject) + ' · Photo ' + (Number(at) + 1) + ' of ' + c.photos.length + '</div>'];
    }
    if (kind === 'announce') return ['Publish announcement', form('announce', input('title', 'Announcement title') + area('body', 'Complete message', '', 'required minlength="6" maxlength="1600"') + select('audience', 'Audience', [['everyone', 'All parents and officers'], ['officers', 'Officers only']]) + input('until', 'Show until (optional)', '', 'date', 'min="' + t() + '"'), 'Publish announcement')];
    if (kind === 'finance' || kind === 'adjust') return financeDialog(kind, id);
    if (kind === 'check') return ['Review handover', para(d.purpose + ' · ' + cash(d.cents)) + (d.items || []).map(x => '<div class="list-line"><span>' + esc(x.description) + '</span><b>' + cash(x.cents) + '</b></div>').join('') + btn('Open scanned original', 'evidence', d.id) + form('financeCheck', select('decision', 'Decision', [['approve', 'Approve and send to the chairperson'], ['return', 'Return to the collecting officer']]) + '<div data-when="decision" data-values="approve">' + ck('received', 'I received ' + cash(d.cents) + ' and checked the lines against the scanned original.', true) + '</div><div data-when="decision" data-values="return">' + area('reason', 'What needs correcting?') + '</div>' + para('After your approval, the chairperson gives final approval before it shows in SPTA funds.'), 'Record review', id)];
    if (kind === 'post') return ['Review for posting', para(d.purpose + ' · ' + cash(d.cents)) + (d.over ? notice('This goes ' + cash(d.over) + ' over the budget. The treasurer wrote: ' + d.overWhy) : '') + (d.noPaper ? notice('There is no paper original for this entry. The treasurer wrote: ' + d.noPaper) : btn('Open supporting original', 'evidence', d.id)) + form('financeReview', select('decision', 'Decision', [['post', 'Approve for posting'], ['return', 'Return for correction']]) + '<div data-when="decision" data-values="post">' + ck('reviewed', d.noPaper ? 'I read why there is no paper original and checked the entries.' : 'I opened the supporting original and checked the entries.', true) + ck('publicSafe', 'The published purpose contains no identifying or bank details.', true) + '</div><div data-when="decision" data-values="return">' + area('reason', 'What needs correcting?') + '</div>' + para('Posting updates the parent fund view. Spending authorization is recorded in the school’s financial process.'), 'Record review', id)];
    if (kind === 'attachment') {
      const f = ui.attachment,
        url = f?.url || '';
      return [f?.title || 'Supporting original', para(f?.title ? '' : f?.name || '') + (f?.type === 'application/pdf' ? '<object class="attachment-pdf" data="' + esc(url) + '" type="application/pdf"><p>Use the file link below to open this PDF.</p></object>' : '<img class="attachment-image" alt="Uploaded supporting document" src="' + esc(url) + '">') + '<a class="btn light" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open file in a new tab</a>'];
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
      const field = f?.elements[el.dataset.when];
      // A tick box counts as "yes" or "no".
      const active = el.dataset.values.split(' ').includes(field?.type === 'checkbox' ? (field.checked ? 'yes' : 'no') : field?.value);
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
    screen: 'Screening saved.',
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
    minutesEdit: 'Minutes corrected.',
    caseReply: 'Saved. The sender was told the new status.',
    caseForward: 'Passed on. The School Head and the secretary can read it now.',
    caseEndorse: 'Endorsement saved.',
    caseAsk: 'Question sent.',
    caseVerify: 'Saved.',
    intakeSetting: 'Child-protection intake updated.',
    caseAcknowledge: 'Referral acknowledged.',
    caseAnswer: 'Answer sent. Thank you.',
    caseReturn: 'Returned to the chairperson and Vice-Chairperson.',
    caseProtect: 'Referred to the school.',
    caseNote: 'Note saved.',
    proposalReply: 'Personal reply sent.',
    chairProposal: 'Added. If you ticked that the School Head already approved it, it is now an approved project.',
    headApproved: 'School Head approval recorded under your name. The project is now approved.',
    projectUpdate: 'Project status published.',
    withdrawRecord: 'Withdrawn. It stays in the history with your reason.',
    unsign: 'Your response was taken back. You can respond again.',
    projectReopen: 'The project is open again.',
    projectPhoto: 'Photo added. It shows to the public once the chairperson approves it.',
    projectPhotoReview: 'Decision saved.',
    projectPhotoRemove: 'Photo removed.',
    projectReceipt: 'Receipt posted. It now shows in the SPTA funds as an approved transaction.',
    recordSpent: 'Amount spent posted. It now shows in the SPTA funds as an approved transaction.',
    amendProject: 'Change recorded. If it needs a new officer vote, the vote is now open.',
    withdraw: 'Withdrawn.',
    voteDeadline: 'Closing date saved.',
    cover: 'Saved.',
    profileUpdate: 'List saved.',
    announceEdit: 'Announcement updated.',
    announceRemove: 'Announcement removed.',
    activitySave: 'Activity saved.',
    activityBudget: 'Budget saved.',
    activityCancel: 'Activity cancelled.'
  };
  async function change(action, payload, requestId) {
    const id = await S.run(action, payload, requestId);
    cleanScan();
    ui.dialog = null;
    ui.back = null;
    ui.queue = false;
    ui.message = (action === 'minutesUpload' && me()?.role !== 'secretary' ? 'Minutes sent to the School Head.' : success[action] || 'Saved.') + (id ? ' ' + id : '');
    render();
    return id;
  }
  // A project receipt, opened by anyone from the funds log or the project's Details.
  async function receiptFile(id) {
    const line = db().ledger.find(x => x.id === id);
    if (!line?.receipt) throw Error('This receipt is not available.');
    const url = await S.fileURL(line.receipt);
    cleanAttachment();
    ui.attachment = {
      ...line.receipt,
      url,
      title: 'Receipt'
    };
    if (ui.dialog) ui.back = {
      kind: ui.dialog,
      id: ui.id
    };
    openDialog('attachment', id);
  }
  async function attachment(type, id) {
    const item = type === 'evidence' ? db().batches.find(x => x.id === id) : db().minutes.find(x => x.id === id);
    if (!item || !(type === 'evidence' ? canChair() || holds('treasurer') || canPost(item) || item.owner === S.me : onRole(E.minuteReaders))) throw Error('You do not have access to this document.');
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
    const rows = [['Reference', 'Title', 'Status'], ...db().proposals.filter(p => E.publicProposal(p) && E.readableProposal(p, me())).map(p => [p.id, p.publicTitle, labels[p.status] || p.status])];
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
      if (act === 'histmore') {
        ui.historyLimit = (ui.historyLimit || 20) + 20;
        return render();
      }
      if (act === 'histfilter') {
        ui.historyFilter = id;
        ui.historyLimit = 20;
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
      if (act === 'receipt') return await receiptFile(id);
      if (act === 'logoutAll') {
        await S.logoutAll();
        ui.tab = 'home';
        ui.message = 'Signed out on all phones.';
        return render();
      }
      if (act === 'closeRecovery') {
        ui.recovery = null;
        ui.dialog = null;
        return render();
      }
      if (act === 'caseTakeBack') return await change('caseEndorse', {
        id,
        back: true
      }, S.random());
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
    const idleLabel = submitButton.innerHTML;
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
      if (action === 'recoveryCode') {
        if (!payload.confirm) throw Error('Confirm that you checked the parent’s identity in person.');
        ui.recovery = await S.recoveryCode(payload.mobile);
        ui.dialog = 'recoveryShown';
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
      if (action === 'intakeSetting') payload.secretary = payload.secretary === 'yes';
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
      if (action === 'caseSubmit') {
        const shots = ['evidence1', 'evidence2'].map(k => data.get(k)).filter(x => x && x.size);
        delete payload.evidence1;
        delete payload.evidence2;
        if (shots.some(x => !/^image\/(jpeg|png|webp)$/.test(x.type))) throw Error('Photos must be JPG, PNG or WEBP.');
        payload.photos = [];
        for (const shot of shots) payload.photos.push(await within(S.fileMeta(await shrinkImage(shot)), 45000, 'Saving the photo took too long. Check your connection and try again.'));
      }
      let file = data.get('attachment');
      if (file?.size && (action === 'projectPhoto' || action === 'projectReceipt' && file.type !== 'application/pdf')) file = await shrinkImage(file);
      if (file?.size) payload.file = await within(S.fileMeta(file), 30000, 'Saving the file took too long. Check your connection and try again.');else if (action === 'financeSubmit' && ui.scan?.stage === 'done') payload.file = ui.scan.meta ||= await S.fileMeta(ui.scan.file);
      if (['submitProposal', 'caseSubmit', 'resubmit'].includes(action)) ui.tab = 'updates';
      if (action === 'headDecision' && payload.decision === 'approve' || action === 'headApproved') ui.tab = 'projects';
      await change(action, payload, token);
    } catch (e) {
      showMessage(e.message);
    } finally {
      ui.busy = false;
      submitButton.disabled = false;
      submitButton.innerHTML = idleLabel;
      updateConditions(f);
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
  // A thin bar above the app tells people when the phone cannot reach the server. It lives outside #app so redrawing never removes it.
  function setLink(down, why) {
    let bar = document.getElementById('link-banner');
    if (!down) {
      if (bar) bar.hidden = true;
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'link-banner';
      bar.className = 'link-banner';
      bar.setAttribute('role', 'status');
      bar.innerHTML = '<span></span><button type="button">Try again</button>';
      bar.querySelector('button').addEventListener('click', () => {
        bar.querySelector('button').disabled = true;
        refresh(true).finally(() => {
          bar.querySelector('button').disabled = false;
        });
      });
      document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.querySelector('span').textContent = why || 'You are offline. What you see may be out of date, and changes cannot be saved until you are back online.';
    bar.hidden = false;
  }
  async function refresh(force) {
    if (!S.db || !force && (ui.busy || ui.dialog)) return;
    try {
      const rev = db().revision;
      await S.refresh();
      setLink(false);
      if (rev !== db()?.revision || !me()) render();
    } catch (e) {
      if (e.network) setLink(true, e.network === 'server' ? 'The SPTA server is having a problem. What you see may be out of date. The app will keep trying.' : e.network === 'slow' ? 'The connection is slow. What you see may be out of date. The app will keep trying.' : '');
      else if (force) showMessage(e.message);
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
  window.addEventListener('offline', () => {
    if (S.shared) setLink(true);
  });
  ECESLang.start(render);
  S.init().then(() => {
    // Only the live app has a server that can translate typed text.
    if (S.shared) ECESLang.setRemote(texts => S.translateTexts(texts));
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
  }).catch(function failed(e) {
    const root = document.getElementById('app');
    if (!S.shared) {
      root.innerHTML = '<main class="login-shell"><h1>Open ECES Bayanihan</h1>' + para('The practice version could not open its saved data. Allow this site to save data in your browser settings, then reload the page.') + '<div class="entry-actions"><button type="button" class="btn primary" id="boot-retry">Reload</button></div></main>';
      document.getElementById('boot-retry').addEventListener('click', () => location.reload());
      return;
    }
    const off = e.network === 'offline',
      server = e.network === 'server' || e.network === 'reply';
    root.innerHTML = '<main class="login-shell boot-error" role="alert"><img class="boot-seal" src="assets/favicon-48.png" alt="" width="48" height="48"><h1>' + (off ? 'You are offline' : 'ECES Bayanihan could not open') + '</h1>' + para(off ? 'The app needs the internet to show the latest SPTA information. Connect to Wi-Fi or mobile data, then try again.' : server ? 'The SPTA server is having a problem right now. Your information is safe. Please try again in a few minutes.' : e.network === 'slow' ? 'The connection is too slow. Move to a place with better signal, then try again.' : 'The app could not reach the SPTA server. Check your internet connection, then try again.') + '<div class="entry-actions"><button type="button" class="btn primary" id="boot-retry">Try again</button></div>' + para('If this keeps happening, please tell an SPTA officer.') + '</main>';
    const again = document.getElementById('boot-retry');
    again.addEventListener('click', () => {
      again.disabled = true;
      again.textContent = 'Trying…';
      S.init().then(() => location.reload(), err => {
        failed(err);
      });
    });
    window.addEventListener('online', () => again.isConnected && again.click(), { once: true });
  });
})();
