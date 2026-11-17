/* Shared rules for the browser and local server rehearsals. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./examples.js'));else root.ECES = factory(root.ECESExamples);
})(globalThis, function (examples) {
  'use strict';

  const roles = {
    parent: 'Parent / Guardian',
    bod: 'BOD · HPTA President',
    chair: 'Chairperson',
    vice: 'Vice-Chairperson',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
    head: 'School Head',
    collector: 'Collecting and Disbursing Officer'
  };
  // Sarah's rule: the Collecting and Disbursing Officer is an officer too, and votes and signs with the rest.
  const boardRoles = ['chair', 'vice', 'secretary', 'treasurer', 'collector', 'bod'];
  const leaders = ['head', 'chair', 'vice'];
  const printers = ['head', 'chair', 'vice', 'secretary'];
  const labels = {
    received: 'Received',
    returned: 'Needs revision',
    declined: 'Declined',
    screened: 'Screened',
    voting: 'Voting open',
    awaiting_head: 'For School-Head approval',
    not_adopted: 'Board did not adopt',
    withdrawn: 'Withdrawn',
    approved: 'Approved',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Awaiting review',
    for_treasurer: 'For treasurer approval',
    posted: 'Posted',
    draft: 'Secretary draft',
    signing: 'Open for signatures',
    signed: 'Signed',
    closed: 'Closed',
    assigned: 'Reviewed',
    resolved: 'Resolved',
    for_chair: 'For chair approval',
    for_head: 'For head notation',
    filed: 'Filed',
    approved_bod: 'Verified BOD',
    parent: 'Parent',
    rejected: 'Returned',
    absent: 'Absent',
    acknowledged: 'Signed',
    not_signed: 'Declined to sign',
    withdrawn: 'Withdrawn',
    received_funds: 'Received by treasurer'
  };
  const categories = ['Facilities', 'Learning', 'Health & Safety', 'Environment', 'Community', 'Accessibility', 'Communication', 'Other'];
  const recipients = {
    head: 'School Head',
    chair: 'SPTA chairperson',
    vice: 'SPTA Vice-Chairperson'
  };
  // Suggestions and private concerns go to the chairperson and the Vice-Chairperson only.
  // They decide whether it is worth passing on to the School Head.
  const deskName = 'SPTA chairperson and Vice-Chairperson';
  const duplicate = s => structuredClone(s);
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const at = () => new Date().toISOString();
  const plusDays = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  function check(value, message) {
    if (!value) throw new Error(message);
    return value;
  }
  function words(value, name, min = 1, max = 450) {
    const s = String(value ?? '').trim();
    check(s.length >= min && s.length <= max, name + ' must be ' + min + '–' + max + ' characters.');
    return s;
  }
  function choice(v, list, name) {
    check(list.includes(v), 'Choose a valid ' + name + '.');
    return v;
  }
  function amount(v, zero = false) {
    const raw = String(v ?? '').trim();
    check(/^\d{1,8}(\.\d{1,2})?$/.test(raw), 'Enter a peso amount with up to two decimal places.');
    const cents = Math.round(Number(raw) * 100);
    check(zero ? cents >= 0 : cents > 0, 'Enter an amount above zero.');
    return cents;
  }
  function dateValue(v) {
    const s = String(v ?? '');
    check(/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Enter a valid date.');
    return s;
  }
  // Parents sign in with a Philippine mobile number, stored as 09XXXXXXXXX.
  function mobileNumber(value) {
    const digits = String(value ?? '').replace(/[\s().-]/g, '');
    const m = /^(?:\+?63|0)(9\d{9})$/.exec(digits);
    check(m, 'Enter a mobile number such as 09171234567.');
    return '0' + m[1];
  }
  // What a person types in the sign-in box: a mobile number, or an officer handle from the rehearsal.
  function loginKey(value) {
    const s = String(value ?? '').trim();
    if (/^\+?\d[\d\s().-]{8,}$/.test(s)) try {
      return mobileNumber(s);
    } catch (_) {}
    return s.toLowerCase();
  }
  // Sarah's rules: two accounts a phone, a month to vote unless the date is changed,
  // four direct chairperson proposals a school year, and the chairperson may stand in for three officers.
  const hiddenPerMonth = 2,
    accountsPerDevice = 2,
    voteDays = 30,
    directPerYear = 4,
    coverRoles = ['secretary', 'treasurer', 'collector'];
  // The school year is taken to start in June.
  const schoolYear = d => Number(d.slice(0, 4)) - (Number(d.slice(5, 7)) >= 6 ? 0 : 1);
  const directUsed = db => db.proposals.filter(x => x.direct && x.status !== 'withdrawn' && schoolYear(x.created) === schoolYear(today())).length;
  const voteCloses = b => b.closes || plusDays(b.date, voteDays);
  // Notes each device an account signs in from, newest last. The first entry is where the account was created.
  function seenOn(db, id, device) {
    const a = account(db, id);
    if (!a || a.demo || !device || !/^[A-Za-z0-9-]{8,80}$/.test(device) || a.devices?.includes(device)) return false;
    a.devices = [...(a.devices || []), device].slice(-10);
    return true;
  }
  const sender = a => ({
    name: a.name,
    homeroom: a.homeroom || ''
  });
  // Forgotten password, without text messages: the details must match an account that this phone has signed in to before.
  function resetCheck(db, v, device) {
    const fold = x => String(x ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    let login = '';
    try {
      login = mobileNumber(v.mobile);
    } catch (_) {}
    const a = db.accounts.find(x => !x.demo && x.active && x.login === login);
    check(a && device && a.devices?.includes(device) && fold(v.lastName) && fold(a.name).endsWith(' ' + fold(v.lastName)) && fold(a.homeroom) === fold(v.homeroom), 'Those details do not match an account used on this phone. Ask the SPTA secretary for help.');
    return a.id;
  }
  function account(db, id) {
    return db.accounts.find(x => x.id === id);
  }
  function get(list, id) {
    const row = list.find(x => x.id === id);
    check(row, 'That record is no longer available.');
    return row;
  }
  function allows(actor, allowed) {
    check(actor?.active && allowed.includes(actor.role), 'Your current profile cannot perform this action.');
  }
  function availableSeats(db) {
    return db.accounts.filter(x => x.active && x.demo && x.role === 'bod' && !x.claimed || x.active && x.role === 'parent' && x.endedAt && !x.claimed);
  }
  function eligible(db) {
    return db.accounts.filter(a => a.active && (a.boardSeat || a.role === 'collector') && boardRoles.includes(a.role));
  }
  function newId(db, prefix) {
    const count = (db.seq[prefix] || 0) + 1;
    db.seq[prefix] = count;
    return prefix + '-' + String(count).padStart(4, '0');
  }
  const majority = n => Math.floor(n / 2) + 1;
  function requiredYes(n) {
    return majority(n);
  }
  // Sarah's rule: a proposal proceeds when yes votes reach 50% of all officers on the roster.
  const halfOf = n => Math.ceil(n / 2);
  const yesNeeded = b => b.minimumYes || requiredYes(b.present.length);
  // Opens the in-app officer vote for a screened proposal.
  function openVote(db, p, closes) {
    const roster = eligible(db).map(x => x.id);
    check(roster.length > 0, 'Add officers to the roster before opening a vote.');
    const b = {
      minimumYes: halfOf(roster.length),
      rule: '50% of all officers',
      id: newId(db, 'B'),
      proposal: p.id,
      rev: p.rev,
      title: p.publicTitle,
      body: p.publicText,
      budget: p.budget,
      roster,
      present: roster,
      participated: [],
      counts: {
        yes: 0,
        no: 0,
        abstain: 0
      },
      named: [],
      method: 'secret',
      date: today(),
      closes: closes || plusDays(today(), voteDays),
      meeting: 'In-app officer vote',
      mode: 'In app',
      status: 'open',
      opened: at()
    };
    db.ballots.push(b);
    p.status = 'voting';
    p.ballot = b.id;
    return b;
  }
  function settleVote(db, b, force = false) {
    const need = yesNeeded(b),
      left = b.present.length - b.participated.length;
    if (b.status !== 'open' || !force && b.counts.yes < need && b.counts.yes + left >= need) return false;
    const p = get(db.proposals, b.proposal);
    check(p.status === 'voting' && p.ballot === b.id, 'The proposal is no longer on this ballot.');
    b.status = 'closed';
    b.closed = at();
    b.date = today();
    b.passed = b.counts.yes >= need;
    p.status = b.passed ? 'awaiting_head' : 'not_adopted';
    tell(db, p);
    return true;
  }
  // Records the result of every vote whose closing date has passed. Returns how many were closed.
  function expire(db) {
    let closed = 0;
    for (const b of db.ballots || []) if (b.status === 'open' && voteCloses(b) < today()) try {
      if (settleVote(db, b, true)) {
        b.expired = true;
        db.audit.push({
          who: 'system',
          event: 'Officer vote closed on its closing date',
          ref: b.id,
          at: at()
        });
        closed++;
      }
    } catch (_) {}
    return closed;
  }
  // A drawn signature is stored as short line strokes inside a 300 by 100 box.
  function signatureMark(value) {
    const mark = String(value ?? '').trim();
    check(mark.length >= 20 && mark.length <= 9000 && /^(M\d{1,3} \d{1,3}( L\d{1,3} \d{1,3})+ ?)+$/.test(mark), 'Draw your signature in the box.');
    return mark;
  }
  function openStamp(batch) {
    return batch.id + '|' + (batch.submitted || '') + '|' + batch.history.length + '|' + (batch.file?.key || 'missing');
  }
  function requiredSigners(r) {
    return r.requiredSigners || r.signers.map(s => s.id);
  }
  function signaturesPending(r) {
    return requiredSigners(r).filter(id => r.signatures[id]?.status !== 'acknowledged');
  }
  function homeroomKey(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }
  function resolutionText(title, budget, direct = false) {
    return 'The SPTA records ' + (direct ? 'the chairperson’s proposal “' + title + '”, added without an officer vote,' : 'the board decision on “' + title + '”') + ' and School-Head approval for the project with an allocation of ₱' + (budget / 100).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + '.';
  }
  const peso = cents => '₱' + (cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  // A resolution may only state the amount the officers voted. Any other peso figure in its wording is refused.
  function sameAmount(clause, budget) {
    const found = String(clause).match(/₱\s?[\d,]+(?:\.\d+)?/g) || [];
    return found.length > 0 && found.every(x => Math.round(Number(x.replace(/[₱\s,]/g, '')) * 100) === budget);
  }
  // Plain-language explanation of a corrected fund entry, built only from public ledger fields.
  // Works on both the original entry and the correction. Returns '' for an entry that was never corrected.
  function correctionNote(rows, entry) {
    const orig = entry.corrects ? rows.find(x => x.id === entry.corrects) : entry;
    if (!orig) return '';
    const fixes = rows.filter(x => x.corrects === orig.id);
    if (!fixes.length) return '';
    const moved = fixes.reduce((n, x) => n + (x.direction === orig.direction ? -x.cents : x.cents), 0),
      right = orig.cents - moved,
      back = orig.direction === 'out' ? 'returned to the SPTA funds' : 'taken back out of the SPTA funds';
    const who = entry.corrects && entry.approver ? ' Approved by the ' + (roles[entry.approver] || 'chairperson') + '.' : '';
    if (entry.corrects) return 'Correction to “' + orig.purpose + '”. It was first recorded as ' + peso(orig.cents) + ', but the correct amount is ' + peso(right) + '. The ' + peso(moved) + ' difference is ' + back + '.' + who;
    return 'This entry was corrected. The correct amount is ' + peso(right) + ', not ' + peso(orig.cents) + '. The ' + peso(moved) + ' difference is ' + back + ' (see the correction).';
  }
  // A change to an approved project that is waiting for a fresh officer vote and School-Head decision.
  const amendOpen = (db, projectId) => db.proposals.find(x => x.amends === projectId && ['voting', 'awaiting_head'].includes(x.status));
  // What a proposal would add on top of money already set aside. A change to a project adds only the increase.
  function extraNeeded(db, p) {
    const base = p.amends ? db.projects.find(x => x.id === p.amends)?.budget || 0 : 0;
    return Math.max(0, (Number(p.budget) || 0) - base);
  }
  const projectSpend = (db, id) => db.ledger.filter(x => x.project === id).reduce((n, x) => n + (x.direction === 'out' ? x.cents : -x.cents), 0);
  const fundBalance = db => db.opening + db.ledger.reduce((n, x) => n + (x.direction === 'in' ? x.cents : -x.cents), 0);
  // SPTA funds are one pool. Money still owed to approved projects is committed, oldest project first.
  // What is left is available for new proposals. A project or proposal that the pool cannot cover needs fundraising.
  function funding(db) {
    const balance = fundBalance(db);
    let cash = Math.max(balance, 0),
      committed = 0;
    const projects = {};
    db.projects.map((p, i) => [p, i]).filter(([p]) => ['approved', 'in_progress'].includes(p.status)).sort((a, b) => (a[0].created || '').localeCompare(b[0].created || '') || a[1] - b[1]).forEach(([p]) => {
      const need = Math.max(0, p.budget - projectSpend(db, p.id)),
        covered = Math.min(need, cash);
      cash -= covered;
      committed += need;
      projects[p.id] = {
        need,
        short: need - covered
      };
    });
    const available = Math.max(0, balance - committed);
    return {
      balance,
      committed,
      available,
      projects,
      shortFor: cents => Math.max(0, (Number(cents) || 0) - available)
    };
  }
  // The automated response a sender sees for the current status of what they sent.
  const proposalReplies = {
    received: 'Thank you. Your proposal was received and is waiting for review by the SPTA officers.',
    screened: 'Your proposal was reviewed and will open for the SPTA officers’ vote.',
    voting: 'Your proposal was reviewed and is now with the SPTA officers for a vote.',
    awaiting_head: 'The SPTA officers voted to proceed. Your proposal is now with the School Head for approval.',
    approved: 'Approved. Your proposal is now an SPTA project. Follow it under Projects.',
    in_progress: 'Your proposal is now an SPTA project in progress. Follow it under Projects.',
    completed: 'The SPTA project from your proposal is complete. Thank you.',
    cancelled: 'The SPTA project from your proposal was cancelled. The reason is posted under Projects.',
    returned: 'Your proposal was reviewed and needs a revision. Read the note, then revise and resubmit.',
    declined: 'Your proposal was reviewed and will not proceed. Read the note for the reason.',
    not_adopted: 'The SPTA officers’ vote did not reach 50%, so the proposal will not proceed for now.',
    withdrawn: 'You withdrew this proposal. Nothing more will happen with it.'
  };
  function autoReply(item) {
    if (item.kind) {
      const what = item.kind === 'inspection' ? 'request' : item.kind,
        // A parent is only told it went to the SPTA, never which officers read it.
        who = onDesk(item) ? 'SPTA' : recipients[item.assigned] || roles[item.assigned] || 'reviewer';
      if (item.status === 'withdrawn') return 'You withdrew this ' + what + '. Nothing more will happen with it.';
      if (item.status === 'resolved') return 'Your ' + what + ' was marked resolved by the ' + who + '.';
      if (item.status === 'assigned') return 'Your ' + what + ' was reviewed by the ' + who + '.';
      return 'Thank you. Your ' + what + ' was received privately by the ' + who + '.';
    }
    if (item.direct && item.status === 'awaiting_head') return 'Added by the chairperson. It is now with the School Head for approval.';
    return proposalReplies[item.status] || '';
  }
  // Tells the sender about a status change with the automated response.
  function tell(db, item) {
    if (db.settings.ack) note(db, item.owner, item.id + ' · ' + autoReply(item));
  }
  function hasDelegation(db) {
    return !!(db.actingVice && db.actingUntil && db.actingUntil >= today());
  }
  function isChair(db, a) {
    return a?.role === 'chair' || a?.role === 'vice' && hasDelegation(db);
  }
  // The chairperson may stand in for an absent secretary, treasurer or collecting officer, one at a time, until a set date.
  function covering(db, a) {
    const c = db.cover;
    return c && c.until >= today() && isChair(db, a) ? c.role : '';
  }
  const holds = (db, a, role) => !!a?.active && (a.role === role || covering(db, a) === role);
  // The final approval of a fund record comes from someone who neither sent nor checked it.
  // When the chairperson handled it while standing in, that falls to the Vice-Chairperson.
  function mayPost(db, a, d) {
    const untouched = d.owner !== a?.id && d.checkedBy !== a?.id;
    if (isChair(db, a)) return untouched;
    return a?.role === 'vice' && a.active && untouched && [d.owner, d.checkedBy].some(x => account(db, x)?.role === 'chair');
  }
  const canAnnounce = (db, a) => !!a?.active && (a.role === 'head' || a.role === 'secretary' || isChair(db, a));
  function financeReview(db, a) {
    check(isChair(db, a), 'Chairperson posting authority is required.');
  }
  // The change history. Every entry says who acted, in which role (and who they stood in for), what the record was,
  // what was decided and why. Entries are only ever added. Private case details and sender names never go in.
  function audit(db, a, event, ref, extra = {}) {
    db.audit.push({
      who: a.id,
      role: a.role,
      ...(covering(db, a) ? {
        cover: covering(db, a)
      } : {}),
      event,
      ref,
      ...extra,
      at: at()
    });
  }
  function note(db, id, text) {
    db.notes.unshift({
      owner: id,
      text,
      at: at()
    });
  }
  function photo(meta) {
    check(meta && typeof meta.key === 'string' && /^[a-zA-Z0-9_-]{3,120}$/.test(meta.key), 'Attach and save the supporting file first.');
    check(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(meta.type), 'Choose a JPG, PNG, WEBP or PDF.');
    const bytes = Number(meta.size);
    check(Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 8 * 1024 * 1024, 'Each file must be 8 MB or smaller.');
    return {
      key: meta.key,
      name: words(meta.name, 'Filename', 1, 160),
      type: meta.type,
      size: bytes
    };
  }
  const onDesk = c => c.kind !== 'inspection' && ['chair', 'vice'].includes(c.assigned);
  // Who may read a case. The sender always can. Records requests go to the secretary.
  // A suggestion or concern is read by the chairperson and Vice-Chairperson, and by the School Head and secretary only once it is passed on.
  function canSeeCase(actor, c) {
    if (actor.id === c.owner || actor.role === c.assigned) return true;
    return onDesk(c) && (['chair', 'vice'].includes(actor.role) || !!c.forwarded && ['head', 'secretary'].includes(actor.role));
  }
  // Who may change the status or reply to the sender: the desk, and the School Head once it has been passed on.
  function caseHandler(db, a, c) {
    if (!a?.active) return false;
    if (!onDesk(c)) return holds(db, a, c.assigned);
    return ['chair', 'vice'].includes(a.role) || !!c.forwarded && a.role === 'head';
  }
  // Who may add an internal note. The secretary joins once it has been passed on, to follow up with the School Head.
  const caseNoter = (db, a, c) => !!a?.active && onDesk(c) && (caseHandler(db, a, c) || !!c.forwarded && holds(db, a, 'secretary'));
  function publicProposal(p) {
    return Boolean(p.published && p.publicTitle);
  }
  function readableProposal(p, a) {
    return leaders.includes(a.role) || p.owner === a.id || publicProposal(p);
  }
  // The school's list of HPTA presidents, one seat per section. A seat waits, vacant, until that president registers and is matched to it
  // by the School Head or chairperson. A vacant seat never votes, signs or counts toward a quorum.
  function addSeats(db, list) {
    check(Array.isArray(list) && list.length && list.length <= 80, 'Send between 1 and 80 seats.');
    let n = db.accounts.filter(x => /^bod-\d+$/.test(x.id)).length;
    const have = new Set(db.accounts.filter(x => x.role === 'bod').map(x => homeroomKey(x.homeroom)));
    let added = 0;
    for (const o of list) {
      const homeroom = words(o.homeroom, 'Grade and section', 3, 80),
        name = words(o.name, 'President name', 2, 75);
      if (have.has(homeroomKey(homeroom))) continue;
      have.add(homeroomKey(homeroom));
      n++;
      db.accounts.push({
        id: 'bod-' + n,
        role: 'bod',
        name,
        homeroom,
        seatKey: 'bod-' + n,
        login: 'seat-' + n,
        active: true,
        boardSeat: false,
        vacant: true,
        demo: true
      });
      added++;
    }
    return added;
  }
  // Money already held before the app was used. One figure from the treasurer's paper, set once and before any money is recorded here.
  function setOpening(db, v) {
    check(!db.ledger.length, 'The opening balance cannot change once money has been recorded in the app.');
    const cents = Math.round(Number(v.amount) * 100);
    check(Number.isFinite(cents) && cents >= 0 && cents <= 100000000000, 'Enter the balance in pesos.');
    const asOf = String(v.date || '');
    check(/^\d{4}-\d{2}-\d{2}$/.test(asOf) && !Number.isNaN(Date.parse(asOf)), 'Enter the date the balance applies to.');
    db.opening = cents;
    db.openingAsOf = asOf;
    return cents;
  }
  // A project finished before the app, shown as completed. It carries no vote, no signature and no SPTA allocation.
  function addPastProject(db, v) {
    const title = words(v.title, 'Project title', 4, 100),
      text = words(v.text, 'Project description', 8, 700),
      sponsor = words(v.sponsor, 'Who paid for it', 0, 75),
      done = String(v.date || '');
    check(/^\d{4}-\d{2}-\d{2}$/.test(done) && !Number.isNaN(Date.parse(done)), 'Enter the date it was completed.');
    const id = newId(db, 'PR');
    db.projects.unshift({
      id,
      title,
      text,
      budget: 0,
      owner: 'chair',
      phase: 'Completed before ECES Bayanihan',
      status: 'completed',
      progress: 100,
      changed: done,
      created: done,
      icon: 'sprout',
      past: true,
      sponsor
    });
    return id;
  }
  // The real school record: no sample content, only the officers, each waiting for a one-time invite.
  const liveRoles = ['head', 'chair', 'vice', 'secretary', 'treasurer', 'collector'];
  function createLive(officers) {
    const seen = new Set();
    const accounts = officers.map(o => {
      check(liveRoles.includes(o.role), 'Choose an officer role.');
      check(!seen.has(o.role), 'Each officer role can be used once.');
      seen.add(o.role);
      return {
        id: o.role,
        role: o.role,
        name: words(o.name, 'Officer name', 2, 75),
        active: true,
        boardSeat: boardRoles.includes(o.role),
        login: 'pending-' + o.role,
        demo: false,
        invite: o.invite,
        inviteAt: o.inviteAt || Date.now()
      };
    });
    return {
      version: 3,
      revision: 0,
      seq: {
        P: 100,
        C: 100,
        S: 100,
        F: 100,
        R: 100,
        A: 100,
        M: 100,
        B: 100,
        H: 100
      },
      accounts,
      requests: [],
      proposals: [],
      projects: [],
      ledger: [],
      opening: 0,
      ballots: [],
      resolutions: [],
      cases: [],
      announcements: [{
        id: 'A-1',
        title: 'Welcome to ECES Bayanihan',
        body: 'Parents and guardians can submit a project proposal, share a suggestion or report a concern privately from the parent desk.',
        author: 'secretary',
        audience: 'everyone',
        date: today()
      }],
      minutes: [],
      batches: [],
      remittances: [],
      notes: [],
      audit: [],
      actingVice: false,
      settings: {
        ack: true,
        reminders: true,
        live: true
      },
      legacy: null,
      receipts: []
    };
  }
  // An officer opens the app with the invite code and sets up their own sign-in.
  function officerJoin(db, v, device) {
    const a = db.accounts.find(x => x.invite && x.invite === v.invite);
    check(a, 'That invite code is not valid. Ask the chairperson for a new one.');
    check(!a.inviteAt || Date.now() - a.inviteAt < 14 * 86400000, 'That invite code has expired. Ask the chairperson for a new one.');
    check(v.consent === true, 'Please read the Privacy Notice and tick the box to agree.');
    const login = mobileNumber(v.mobile);
    check(!db.accounts.some(x => x.login === login && x !== a), 'An account already uses this mobile number.');
    a.login = login;
    delete a.invite;
    delete a.inviteAt;
    a.consent = {
      at: at(),
      version: '2026-11'
    };
    seenOn(db, a.id, device);
    audit(db, a, 'Officer account set up', a.id);
    db.revision = (db.revision || 0) + 1;
    return a.id;
  }
  function create(old = null) {
    const b = old && Array.isArray(old.proposals) && Array.isArray(old.projects) ? old : duplicate(examples);
    const profile = (id, role, name, extra = {}) => ({
      id,
      role,
      name,
      active: true,
      boardSeat: boardRoles.includes(role),
      login: id,
      demo: true,
      ...extra
    });
    const accounts = [profile('parent', 'parent', 'Sample Parent', {
      homeroom: 'Grade 1 · Sample A'
    }), profile('parent-2', 'parent', 'Sample Parent B', {
      homeroom: 'Grade 4 · Sample C'
    }), profile('head', 'head', 'Sample School Head'), ...['chair', 'vice', 'secretary', 'treasurer'].map(k => profile(k, k, 'Sample ' + roles[k])), profile('collector', 'collector', 'Sample Collecting Officer'), ...Array.from({
      length: 44
    }, (_, i) => profile('bod-' + (i + 1), 'bod', 'Sample HPTA President ' + (i + 1), {
      homeroom: (i % 7 === 0 ? 'Kindergarten' : 'Grade ' + i % 7) + ' · Sample ' + String.fromCharCode(65 + Math.floor(i / 7)),
      seatKey: 'bod-' + (i + 1)
    }))];
    const proposals = b.proposals.map(p => {
      const shown = ['recommended', 'approved', 'in_progress', 'completed'].includes(p.status);
      const status = p.status === 'recommended' ? 'screened' : p.status === 'not_recommended' ? 'declined' : p.status === 'under_review' ? 'received' : p.status;
      return {
        id: p.id,
        title: p.title,
        details: p.description,
        category: p.category,
        owner: p.mine ? 'parent' : 'parent-2',
        created: p.date,
        status,
        published: shown,
        publicTitle: shown ? p.title : '',
        publicText: shown ? p.description : '',
        supports: Number(p.supports) || 0,
        supporters: [],
        budget: 0,
        rev: 1,
        history: [],
        legacy: !!old
      };
    });
    const projects = b.projects.map(p => ({
      id: p.id,
      title: p.name,
      text: p.description,
      budget: Math.round(p.budget * 100),
      status: p.status,
      phase: p.phase,
      progress: p.progress,
      icon: p.icon || 'book',
      owner: 'chair',
      reason: p.cancelReason || '',
      remainder: p.status === 'cancelled' ? p.cancelReason || 'See the original project record.' : '',
      changed: p.date || '2026-11-07'
    }));
    // Practice version only (the pictures are carried inside the demo page): the completed sample project, and the reading corner, each show an illustrated picture.
    if (!old && globalThis.ECESSamplePhotos) {
      const pic = (key, caption, stage, by) => ({
        id: 'PH-1',
        file: {
          key,
          name: key + '.jpg',
          type: 'image/jpeg',
          size: 45000
        },
        caption,
        stage,
        by,
        date: '2026-10-20',
        status: 'approved',
        approvedBy: 'chair'
      });
      const done = projects.find(p => p.id === 'PR-02'),
        reading = projects.find(p => p.id === 'PR-01');
      if (done) done.photos = [pic('sample-photo-1', 'The refreshed handwashing station, ready for use', 'completed', 'chair')];
      if (reading) reading.photos = [pic('sample-photo-2', 'Shelves and floor mats in place for the reading corner', 'in_progress', 'chair')];
    }
    if (!old) {
      const mural = projects.find(p => p.id === 'PR-04');
      if (mural) {
        mural.reason = 'The wall needs repair before the mural can be painted.';
        mural.remainder = 'The ₱5,000 allocation remains unspent in the general fund.';
        mural.spentAtCancellation = 0;
      }
    }
    const ledger = [...(b.collections || []).map(x => ({
      id: x.id,
      date: x.date,
      direction: 'in',
      purpose: x.description,
      cents: Math.round(x.amount * 100),
      project: '',
      batch: x.id
    })), ...(b.ledger || []).map(x => ({
      id: x.id,
      date: x.date,
      direction: 'out',
      purpose: x.description,
      cents: Math.round(x.amount * 100),
      project: x.projectId,
      batch: x.id
    }))];
    const db = {
      version: 3,
      revision: 0,
      seq: {
        P: 100,
        C: 100,
        S: 100,
        F: 100,
        R: 100,
        A: 100,
        M: 100,
        B: 100,
        H: 100
      },
      accounts,
      requests: [],
      proposals,
      projects,
      ledger,
      opening: 0,
      ballots: [],
      resolutions: [],
      cases: (b.concerns || []).map(c => ({
        id: c.id,
        kind: 'concern',
        subject: c.subject,
        body: c.description,
        category: c.category,
        owner: c.owner === 'Demo Parent' ? 'parent' : 'parent-2',
        assigned: 'chair',
        forwarded: null,
        notes: [],
        status: c.status === 'completed' ? 'resolved' : 'received',
        created: c.date,
        due: plusDays(c.date, 5),
        reply: '',
        history: []
      })),
      announcements: [{
        id: 'A-1',
        title: 'Suggestions for the school',
        body: 'Parents and guardians can submit a project proposal, share a suggestion or report a concern privately from the parent desk.',
        audience: 'everyone',
        author: 'secretary',
        date: '2026-11-10'
      }],
      minutes: [],
      batches: [],
      remittances: [],
      notes: [],
      audit: [],
      actingVice: false,
      settings: {
        ack: true,
        reminders: true
      },
      legacy: old ? {
        note: 'Prior demonstration retained in its original browser storage. Historical ballots and acknowledgements are unverified and do not grant permissions.'
      } : null,
      receipts: []
    };
    if (!old) {
      db.batches.push({
        id: 'F-0100',
        direction: 'in',
        date: '2026-11-10',
        purpose: 'Voluntary PTA contributions',
        receipt: 'DEMO-COL-001',
        items: [{
          description: 'Sample collection sheet',
          cents: 500000
        }],
        cents: 500000,
        project: '',
        file: {
          key: 'sample-sheet',
          name: 'sample-collection-sheet.pdf',
          type: 'application/pdf',
          size: 1
        },
        owner: 'treasurer',
        status: 'pending',
        history: [],
        submitted: at()
      });
      const p = proposals.find(x => x.status === 'screened');
      if (p) {
        p.budget = 1200000;
        const roster = eligible(db).map(a => a.id);
        const present = roster;
        const ballots = present.filter(x => x !== 'bod-1').slice(0, 28);
        p.status = 'voting';
        const id = 'B-0100';
        p.ballot = id;
        db.ballots.push({
          id,
          proposal: p.id,
          rev: p.rev,
          title: p.publicTitle,
          body: p.publicText,
          budget: p.budget,
          roster,
          present,
          participated: ballots,
          counts: {
            yes: 24,
            no: 2,
            abstain: 2
          },
          minimumYes: halfOf(roster.length),
          rule: '50% of all officers',
          named: [],
          method: 'secret',
          status: 'open',
          date: today(),
          closes: plusDays(today(), voteDays),
          meeting: 'In-app officer vote',
          mode: 'In app',
          ga: '',
          opened: at()
        });
      }
    }
    if (old) {
      db.legacy.ballots = Object.keys(old.boardClosures || {}).length;
      db.legacy.resolutions = Object.keys(old.resolutions || {}).length;
      const existing = new Set(db.batches.map(d => d.id));
      for (const d of old.financialDrafts || []) {
        if (d.status === 'approved' || existing.has(d.id)) continue;
        const items = (d.items || []).map(row => ({
          description: String(row.description || 'Imported item'),
          cents: Math.round(Number(row.amount || 0) * 100)
        }));
        const cents = items.reduce((sum, row) => sum + row.cents, 0);
        db.batches.push({
          id: d.id,
          direction: d.type === 'collection' ? 'in' : 'out',
          date: today(),
          purpose: 'Imported finance submission',
          receipt: 'LEGACY-' + d.id,
          items,
          cents,
          project: d.projectId === 'GENERAL' ? '' : d.projectId || '',
          file: null,
          owner: 'treasurer',
          status: 'returned',
          reason: 'Attach the original supporting file and verify the public purpose before resubmitting. ' + (d.reason || ''),
          history: [],
          submitted: '',
          legacy: true
        });
        existing.add(d.id);
      }
      for (const p of db.proposals) {
        if ((old.supported || []).includes(p.id)) p.supporters = ['parent'];
      }
    }
    // Officers' practice copy: the School Head, chairperson and Vice-Chairperson profiles are switched off, so nobody can sign in as them.
    if (globalThis.ECES_OFFICERS_ONLY === true) db.accounts.filter(x => ['head', 'chair', 'vice'].includes(x.id)).forEach(x => {
      x.active = false;
    });
    return db;
  }
  // context.device is the device the app recognised. The server and the browser store supply it; it never comes from a form.
  function transition(original, actorId, action, v = {}, requestId = '', context = {}) {
    const db = duplicate(original);
    const device = typeof context.device === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(context.device) ? context.device : '';
    // A new parent has no account yet. Registration is the one action that runs for someone who is not signed in.
    const a = account(db, actorId) || (action === 'register' ? {
      id: 'new-parent',
      role: 'parent',
      name: 'New parent',
      active: true
    } : null);
    check(a?.active, 'Sign in to continue.');
    expire(db);
    const key = requestId ? actorId + '|' + action + '|' + requestId : '';
    if (key && db.receipts.some(r => r.key === key)) return {
      db: original,
      id: db.receipts.find(r => r.key === key).id,
      replay: true
    };
    let id = String(v.id || '');
    // What the entry says about the record, in plain words. Titles and amounts here are already public to the officers.
    function trace() {
      const t = {
        action
      };
      const decision = v.decision || v.response;
      if (typeof decision === 'string' && decision) t.decision = decision;
      if (['withdrawRecord', 'amendProject'].includes(action) && typeof v.kind === 'string') t.kind = v.kind;
      const why = v.reason || v.why;
      if (typeof why === 'string' && why.trim() && !['caseReply', 'proposalReply'].includes(action)) t.reason = why.trim().slice(0, 350);
      const rec = [['projects', 'title'], ['proposals', 'publicTitle'], ['batches', 'purpose'], ['minutes', 'title'], ['resolutions', 'title'], ['announcements', 'title']].map(([list, field]) => {
        const x = (db[list] || []).find(i => i.id === id);
        return x && {
          list,
          x,
          label: x[field] || x.title
        };
      }).find(Boolean);
      if (rec) {
        t.what = String(rec.label || '').slice(0, 140);
        const outcome = rec.x.status || rec.x.state;
        if (outcome) t.outcome = outcome;
        if (rec.list === 'batches') t.cents = rec.x.cents;
        if (rec.list === 'proposals' && rec.x.budget) t.cents = rec.x.budget;
        if (rec.list === 'projects' && ['amendProject', 'projectUpdate'].includes(action)) t.cents = rec.x.budget;
      }
      return t;
    }
    function changed(event) {
      audit(db, a, event, id, /Private case|Hidden-name|Personal reply/.test(event) ? {
        action,
        private: true
      } : trace());
    }
    switch (action) {
      case 'register':
        {
          const wanted = choice(v.role, ['parent', 'bod'], 'role');
          let login, name, homeroom = '', childName = '';
          if (v.mobile !== undefined) {
            // Parent or officer account, the same details MyNaga asks for with grade and section in place of barangay.
            login = mobileNumber(v.mobile);
            check(!db.accounts.some(x => x.login === login), 'An account already uses this mobile number. Sign in instead.');
            check(!device || db.accounts.filter(x => x.devices?.[0] === device).length < accountsPerDevice, 'This phone already has two accounts. Sign in instead.');
            name = words(v.firstName, 'First name', 1, 40) + ' ' + words(v.lastName, 'Last name', 1, 40);
            homeroom = words(v.homeroom, 'Grade and section', 2, 80);
            if (v.childName !== undefined) childName = words(v.childName, 'Child’s full name', 2, 80);
            check(v.consent === true, 'Please read the Privacy Notice and tick the box to agree.');
          } else {
            login = words(v.login, 'Profile handle', 3, 40).toLowerCase();
            check(/^[a-z0-9._-]+$/.test(login), 'Use letters, numbers, dots, underscores or hyphens in the handle.');
            check(!db.accounts.some(x => x.login === login), 'That profile handle already exists.');
            name = words(v.name, 'Sample name', 2, 75);
            if (wanted === 'bod') homeroom = words(v.homeroom, 'Grade and section', 2, 80);
          }
          id = newId(db, 'U');
          const user = {
            id,
            name,
            login,
            role: 'parent',
            active: true,
            boardSeat: false,
            demo: false
          };
          if (homeroom) user.homeroom = homeroom;
          if (childName) user.childName = childName;
          // Proof that the person agreed, and to which version of the notice.
          if (v.consent === true) user.consent = {
            at: at(),
            version: '2026-11'
          };
          if (device) user.devices = [device];
          db.accounts.push(user);
          if (wanted === 'bod') db.requests.push({
            id: newId(db, 'Q'),
            user: id,
            homeroom,
            status: 'pending',
            at: at()
          });
          break;
        }
      case 'requestRole':
        {
          allows(a, ['parent']);
          check(!db.requests.some(r => r.user === a.id && r.status === 'pending'), 'A request is already pending.');
          const homeroom = words(v.homeroom, 'Grade and section', 2, 80);
          id = newId(db, 'Q');
          db.requests.push({
            id,
            user: a.id,
            homeroom,
            status: 'pending',
            at: at()
          });
          break;
        }
      case 'rosterReview':
        {
          allows(a, ['head', 'chair']);
          const q = get(db.requests, id);
          check(q.status === 'pending', 'This request was reviewed already.');
          const member = get(db.accounts, q.user);
          check(member.id !== a.id, 'Use an independent reviewer.');
          if (v.decision === 'approve') {
            check(v.verified === true, 'Check the school roster before confirming.');
            check(!db.accounts.some(x => x.active && x.role === 'bod' && x.id !== member.id && homeroomKey(x.homeroom) === homeroomKey(q.homeroom) && !x.demo), 'That homeroom already has a verified president.');
            check(typeof v.slot === 'string' && v.slot.length > 0, 'Choose a matching seat or a confirmed additional seat.');
            const available = availableSeats(db),
              slot = available.find(x => x.id === v.slot);
            const match = available.find(x => homeroomKey(x.homeroom) === homeroomKey(q.homeroom));
            if (match) check(match.id === v.slot, 'Choose the existing seat for this homeroom.');
            if (v.slot !== 'additional') {
              check(slot, 'This seat was already assigned.');
              if (slot.id !== member.id) {
                if (slot.demo && slot.role === 'bod') slot.active = false;
                slot.claimed = member.id;
              }
            }
            member.seatKey = slot?.seatKey || slot?.id || member.id;
            delete member.endedAt;
            delete member.claimed;
            member.role = 'bod';
            member.boardSeat = v.voting === true;
            member.homeroom = q.homeroom;
            q.status = 'approved_bod';
          } else {
            choice(v.decision, ['return'], 'decision');
            q.status = 'rejected';
            q.reason = words(v.reason, 'Reason', 3, 230);
          }
          q.reviewedBy = a.id;
          q.reviewedAt = at();
          note(db, member.id, 'BOD request ' + (q.status === 'approved_bod' ? 'confirmed.' : 'returned. ' + q.reason));
          changed('Roster request reviewed');
          break;
        }
      case 'setSeat':
        {
          allows(a, ['head', 'chair']);
          const user = get(db.accounts, id);
          check(user.active && boardRoles.includes(user.role), 'Choose a current board officer.');
          check(v.verified === true, 'Confirm the roster entry.');
          user.boardSeat = v.voting === true;
          changed('Meeting eligibility updated for future ballots');
          break;
        }
      case 'endBod':
        {
          allows(a, ['head', 'chair']);
          const user = get(db.accounts, id);
          check(user.active && user.role === 'bod', 'Choose a current HPTA president.');
          check(v.confirm === true, 'Confirm that this officer’s term ended.');
          user.role = 'parent';
          user.boardSeat = false;
          user.endedAt = at();
          note(db, id, 'Your BOD term ended. Your parent profile remains available.');
          changed('BOD term ended');
          break;
        }
      case 'acting':
        {
          allows(a, ['head']);
          const enabled = v.enabled === true;
          if (enabled) {
            const until = dateValue(v.until);
            check(until >= today(), 'Choose a current or future end date.');
            db.actingReference = words(v.reference, 'School assignment reference', 3, 150);
            db.actingUntil = until;
          }
          db.actingVice = enabled;
          db.audit.push({
            who: a.id,
            event: enabled ? 'Acting chair assigned' : 'Acting chair assignment ended',
            ref: db.actingReference || '',
            until: db.actingUntil,
            at: at()
          });
          break;
        }
      case 'submitProposal':
        {
          const p = {
            id: newId(db, 'P'),
            title: words(v.title, 'Title', 4, 100),
            details: words(v.details, 'Project description', 8, 700),
            category: choice(v.category, categories, 'category'),
            owner: a.id,
            sender: sender(a),
            device,
            created: today(),
            budget: 0,
            status: 'received',
            published: false,
            supports: 0,
            supporters: [],
            rev: 1,
            history: []
          };
          db.proposals.unshift(p);
          id = p.id;
          tell(db, p);
          break;
        }
      case 'screen':
        {
          allows(a, leaders);
          const p = get(db.proposals, id);
          check(p.status === 'received', 'Only proposals awaiting screening can advance.');
          if (v.decision === 'screen') {
            p.publicTitle = words(v.title, 'Reviewed title', 4, 100);
            p.publicText = words(v.text, 'Reviewed description', 8, 700);
            p.budget = amount(v.budget, true);
            p.fundraising = v.fundraising === true;
            p.published = true;
            p.status = 'screened';
            p.reason = '';
            const closes = v.closes ? dateValue(v.closes) : '';
            check(!closes || closes >= today(), 'Choose today or a later date for the vote to close.');
            openVote(db, p, closes);
          } else {
            choice(v.decision, ['return', 'decline'], 'decision');
            p.status = v.decision === 'return' ? 'returned' : 'declined';
            p.published = false;
            p.reason = words(v.reason, 'Feedback', 3, 350);
          }
          p.history.push({
            status: p.status,
            at: at(),
            who: a.id
          });
          tell(db, p);
          changed('Proposal screened');
          break;
        }
      case 'chairProposal':
        {
          // Sarah's rule: the chairperson may add a proposal that skips screening and the officers' vote
          // and goes straight to the School Head. It is marked as such everywhere, including the resolution.
          financeReview(db, a);
          check(directUsed(db) < directPerYear, 'The chairperson can add up to ' + directPerYear + ' direct proposals each school year. Send this one through the officers’ vote.');
          const p = {
            id: newId(db, 'P'),
            title: words(v.title, 'Title', 4, 100),
            details: words(v.details, 'Project description', 8, 700),
            category: choice(v.category, categories, 'category'),
            owner: a.id,
            sender: sender(a),
            device,
            created: today(),
            budget: amount(v.budget, true),
            fundraising: v.fundraising === true,
            status: 'awaiting_head',
            direct: true,
            published: true,
            supports: 0,
            supporters: [],
            rev: 1,
            history: []
          };
          p.publicTitle = p.title;
          p.publicText = p.details;
          db.proposals.unshift(p);
          id = p.id;
          changed('Chairperson added a proposal for School-Head approval without an officer vote');
          break;
        }
      case 'resubmit':
        {
          const p = get(db.proposals, id);
          check(a.id === p.owner && p.status === 'returned', 'Only the submitter may revise a returned proposal.');
          p.title = words(v.title, 'Title', 4, 100);
          p.details = words(v.details, 'Description', 8, 700);
          p.rev++;
          p.status = 'received';
          p.published = false;
          p.reason = '';
          if (p.direct) {
            // A chairperson's direct proposal returns to the School Head after revision.
            p.publicTitle = p.title;
            p.publicText = p.details;
            p.status = 'awaiting_head';
            p.published = true;
          }
          changed('Revised proposal submitted');
          break;
        }
      case 'support':
        {
          const p = get(db.proposals, id);
          check(publicProposal(p), 'This proposal has not been screened.');
          if (!p.supporters.includes(a.id)) {
            p.supporters.push(a.id);
            p.supports++;
          }
          break;
        }
      case 'vote':
        {
          const b = get(db.ballots, id);
          allows(a, boardRoles);
          check(b.status === 'open' && b.present.includes(a.id), 'Only officers on the roster for this open vote may vote.');
          check(!b.participated.includes(a.id), 'A vote has already been received from this account.');
          const vote = choice(v.vote, ['yes', 'no', 'abstain'], 'choice');
          b.participated.push(a.id);
          b.counts[vote]++;
          // The result is recorded as soon as it is decided either way.
          if (settleVote(db, b)) audit(db, a, 'Officer vote result recorded', b.id);
          break;
        }
      case 'closeBallot':
        {
          financeReview(db, a);
          const b = get(db.ballots, id);
          check(b.status === 'open', 'This ballot is closed.');
          check(v.confirm === true, 'Confirm the voting period has ended.');
          settleVote(db, b, true);
          changed('Officer vote closed by the chairperson');
          break;
        }
      case 'voteDeadline':
        {
          // The chairperson may move the closing date of an open vote.
          financeReview(db, a);
          const b = get(db.ballots, id);
          check(b.status === 'open', 'This ballot is closed.');
          const closes = dateValue(v.closes);
          check(closes >= today(), 'Choose today or a later date for the vote to close.');
          b.closes = closes;
          changed('Closing date of an officer vote changed');
          break;
        }
      case 'withdraw':
        {
          // The sender may take back a submission. A proposal can be withdrawn until the School Head approves it.
          const kind = choice(v.kind, ['proposal', 'case'], 'submission type');
          check(v.confirm === true, 'Confirm that you want to withdraw this.');
          const item = get(kind === 'proposal' ? db.proposals : db.cases, id);
          check(item.owner === a.id, 'Only the sender can withdraw this.');
          if (kind === 'proposal') {
            check(['received', 'returned', 'screened', 'voting', 'awaiting_head'].includes(item.status), 'This proposal was already decided and can no longer be withdrawn.');
            const b = item.ballot && db.ballots.find(x => x.id === item.ballot);
            if (b && b.status === 'open') {
              b.status = 'closed';
              b.closed = at();
              b.passed = false;
              b.withdrawn = true;
            }
            item.published = false;
          } else check(['received', 'assigned'].includes(item.status), 'This was already resolved and can no longer be withdrawn.');
          item.status = 'withdrawn';
          item.history.push({
            status: 'withdrawn',
            at: at(),
            who: a.id
          });
          tell(db, item);
          changed('Submission withdrawn by its sender');
          break;
        }
      case 'profileUpdate':
        {
          // Optional, for documentation only: the name, grade and section of the parent's other children.
          const list = Array.isArray(v.children) ? v.children.map(x => String(x ?? '').trim()).filter(Boolean) : [];
          check(list.length <= 8, 'List up to eight other children.');
          a.children = list.map(x => words(x, 'Student name, grade and section', 2, 160));
          id = a.id;
          break;
        }
      case 'cover':
        {
          financeReview(db, a);
          if (v.enabled === true) {
            const until = dateValue(v.until);
            check(until >= today() && until <= plusDays(today(), 60), 'Choose an end date within the next 60 days.');
            db.cover = {
              role: choice(v.role, coverRoles, 'officer'),
              until,
              reason: words(v.reason, 'Reason', 3, 150),
              by: a.id,
              since: at()
            };
          } else db.cover = null;
          db.audit.push({
            who: a.id,
            event: db.cover ? 'Chairperson is standing in for the absent ' + roles[db.cover.role] : 'Chairperson stopped standing in for an officer',
            ref: db.cover?.reason || '',
            until: db.cover?.until,
            at: at()
          });
          break;
        }
      case 'announceEdit':
        {
          check(canAnnounce(db, a), 'The School Head, chairperson or secretary publishes announcements.');
          const n = get(db.announcements, id);
          n.title = words(v.title, 'Title', 3, 100);
          n.body = words(v.body, 'Message', 6, 1600);
          n.audience = choice(v.audience, ['everyone', 'officers'], 'audience');
          n.until = v.until ? dateValue(v.until) : '';
          n.edited = at();
          n.editedBy = a.id;
          changed('Announcement edited');
          break;
        }
      case 'announceRemove':
        {
          check(canAnnounce(db, a), 'The School Head, chairperson or secretary publishes announcements.');
          check(v.confirm === true, 'Confirm that you want to remove this announcement.');
          const n = get(db.announcements, id);
          db.announcements = db.announcements.filter(x => x.id !== id);
          audit(db, a, 'Announcement removed: ' + n.title, id);
          break;
        }
      case 'headDecision':
        {
          allows(a, ['head']);
          const p = get(db.proposals, id);
          if (v.decision === 'approve' && db.projects.some(x => x.proposal === p.id)) {
            break;
          }
          const vote = p.direct ? null : get(db.ballots, p.ballot);
          if (vote) check(p.status === 'awaiting_head' && vote.status === 'closed' && vote.passed && vote.rev === p.rev, 'A closed passing vote on this version is required.');else check(p.status === 'awaiting_head', 'This proposal is not waiting for the School Head.');
          // Without a vote, the details come from the chairperson's proposal.
          const b = vote || {
            id: '',
            title: p.publicTitle,
            body: p.publicText,
            budget: p.budget,
            meeting: 'Added by the chairperson',
            date: p.created,
            present: [],
            counts: null
          };
          if (v.decision === 'approve') {
            if (p.fundraising) {
              p.ga = words(v.ga, 'General Assembly agreement reference', 3, 150);
              check(v.concur === true, 'Record School-Head concurrence for voluntary contributions.');
            }
            p.status = 'approved';
            p.approved = at();
            let project, replaces = [];
            if (p.amends) {
              // A change to an approved project: the same project continues with the new amount or purpose.
              project = get(db.projects, p.amends);
              check(['approved', 'in_progress'].includes(project.status), 'This project has ended.');
              check(b.budget >= projectSpend(db, project.id), 'The new allocation is below what has already been spent.');
              project.history = project.history || [];
              project.history.push({
                at: at(),
                kind: p.change,
                from: project.budget,
                to: b.budget,
                before: p.change === 'purpose' ? project.title : '',
                reason: p.why || '',
                proposal: p.id
              });
              project.budget = b.budget;
              if (p.change === 'purpose') {
                project.title = p.newTitle;
                project.text = p.newText;
              }
              project.changed = today();
              replaces = db.resolutions.filter(x => x.project === project.id && !x.supersededBy).map(x => x.id);
            } else {
              project = {
                id: newId(db, 'PR'),
                proposal: p.id,
                title: b.title,
                text: b.body,
                budget: b.budget,
                owner: 'chair',
                phase: 'Awaiting project start',
                status: 'approved',
                progress: 0,
                changed: today(),
                created: at(),
                icon: 'sprout'
              };
              db.projects.unshift(project);
            }
            const res = {
              id: newId(db, 'R'),
              proposal: p.id,
              project: project.id,
              version: 1,
              state: 'draft',
              title: p.amends ? project.title : b.title,
              text: p.amends ? project.text : b.body,
              budget: b.budget,
              category: p.category,
              fundraising: !!p.fundraising,
              ga: p.ga || '',
              ballot: b.id,
              meeting: b.meeting,
              date: b.date,
              officers: b.present.length,
              direct: !!p.direct,
              tally: b.counts ? {
                ...b.counts
              } : null,
              approved: p.approved,
              created: at(),
              signers: db.accounts.filter(x => x.active && !x.vacant && boardRoles.includes(x.role)).map(x => ({
                id: x.id,
                name: x.name,
                role: x.role,
                homeroom: x.homeroom || ''
              })),
              signatures: {},
              archive: [],
              clause: resolutionText(p.amends ? project.title : b.title, b.budget, !!p.direct) + (replaces.length ? ' This replaces the earlier resolution ' + replaces.join(', ') + ', which authorized a different allocation.' : ''),
              supersedes: replaces,
              published: false
            };
            db.resolutions.unshift(res);
            db.resolutions.filter(x => replaces.includes(x.id)).forEach(x => {
              x.supersededBy = res.id;
            });
            // The secretary is told that a draft resolution is waiting for review.
            db.accounts.filter(x => x.active && x.role === 'secretary').forEach(x => note(db, x.id, res.id + ' · A resolution for “' + res.title + '” was drafted. Review and publish it for signatures.'));
          } else {
            choice(v.decision, ['return', 'decline'], 'decision');
            p.reason = words(v.reason, 'Decision reason', 3, 350);
            p.status = v.decision === 'return' ? 'returned' : 'declined';
            if (p.status === 'returned') p.published = false;
          }
          tell(db, p);
          changed('School-Head decision recorded');
          break;
        }
      case 'projectUpdate':
        {
          allows(a, leaders);
          const p = get(db.projects, id);
          check(!['cancelled', 'completed'].includes(p.status), 'This project has ended.');
          choice(v.status, ['in_progress', 'completed', 'cancelled'], 'project status');
          if (v.status === 'cancelled') {
            allows(a, ['head']);
            p.reason = words(v.reason, 'Public cancellation reason', 6, 350);
            p.remainder = words(v.remainder, 'Disposition of unused funds', 3, 300);
            p.spentAtCancellation = projectSpend(db, p.id);
            p.phase = 'Cancelled';
          } else {
            if (v.owner) {
              const owner = get(db.accounts, v.owner);
              check(owner.active && leaders.includes(owner.role), 'Select a current project lead.');
              p.owner = owner.id;
            }
            p.phase = words(v.phase, 'Public progress update', 3, 240);
            p.progress = v.status === 'completed' ? 100 : Number(v.progress);
            check(Number.isInteger(p.progress) && p.progress >= 0 && p.progress <= 100, 'Progress must be between 0 and 100.');
          }
          p.status = v.status;
          p.changed = today();
          if (p.proposal) {
            const prop = get(db.proposals, p.proposal);
            prop.status = p.status;
            tell(db, prop);
          }
          changed('Project update published');
          break;
        }
      case 'projectPhoto':
        {
          // Officers show parents the real work. Photos are public, so only images are accepted, never PDFs.
          allows(a, leaders);
          const p = get(db.projects, id);
          check(['approved', 'in_progress', 'completed'].includes(p.status), 'Photos can be added to ongoing or completed projects.');
          p.photos = p.photos || [];
          check(p.photos.length < 8, 'A project can show up to 8 photos. Remove one first.');
          const file = photo(v.file);
          check(file.type !== 'application/pdf', 'Choose a JPG, PNG or WEBP photo.');
          const n = p.photos.reduce((m, x) => Math.max(m, Number(String(x.id).slice(3)) || 0), 0) + 1;
          p.photos.push({
            id: 'PH-' + n,
            file,
            caption: words(v.caption, 'Photo caption', 3, 140),
            stage: p.status === 'completed' ? 'completed' : 'in_progress',
            by: a.id,
            date: today(),
            // The chairperson has the final say on what the public sees. Her own photos need no second approval.
            status: isChair(db, a) ? 'approved' : 'pending',
            ...(isChair(db, a) ? {
              approvedBy: a.id
            } : {})
          });
          p.changed = today();
          changed('Project photo added');
          break;
        }
      case 'projectPhotoReview':
        {
          financeReview(db, a);
          const p = get(db.projects, id);
          const ph = (p.photos || []).find(x => x.id === v.photo);
          check(ph, 'That photo is no longer on this project.');
          check(ph.status === 'pending', 'This photo was already reviewed.');
          check(ph.by !== a.id, 'A photo you added needs no approval.');
          const decision = choice(v.decision, ['approve', 'return'], 'decision');
          if (decision === 'return') ph.reason = words(v.reason, 'Reason for return', 4, 300);
          ph.status = decision === 'approve' ? 'approved' : 'returned';
          ph.reviewedBy = a.id;
          ph.reviewedAt = at();
          p.changed = today();
          changed(decision === 'approve' ? 'Project photo approved for the public' : 'Project photo returned');
          break;
        }
      case 'projectPhotoRemove':
        {
          allows(a, leaders);
          const p = get(db.projects, id);
          const before = (p.photos || []).length;
          p.photos = (p.photos || []).filter(x => x.id !== v.photo);
          check(p.photos.length < before, 'That photo is no longer on this project.');
          p.changed = today();
          changed('Project photo removed');
          break;
        }
      case 'withdrawRecord':
        {
          // The person who sent a record can take it back until it is posted, filed or decided. It stays in the history with the reason.
          const kind = choice(v.kind, ['finance', 'minutes', 'request'], 'record type');
          check(v.confirm === true, 'Confirm that you want to withdraw this.');
          const reason = words(v.reason, 'Reason for withdrawing', 4, 300),
            mark = {
              by: a.id,
              at: at(),
              reason
            };
          if (kind === 'finance') {
            const d = get(db.batches, id);
            check(d.owner === a.id, 'Only the person who sent this record can withdraw it.');
            check(d.status !== 'posted', 'This entry is already published. Record a correction instead.');
            check(d.status !== 'withdrawn', 'This record was already withdrawn.');
            check(!(d.handover && d.status === 'pending'), 'The treasurer already received this handover. Ask the treasurer or chairperson to return it.');
            d.status = 'withdrawn';
            d.withdrawn = mark;
            changed('Finance record withdrawn by its sender');
          } else if (kind === 'minutes') {
            const m = get(db.minutes, id);
            check(m.secretary === a.id || holds(db, a, 'secretary'), 'Only the secretary who uploaded these minutes can withdraw them.');
            check(['for_chair', 'for_head'].includes(m.state), 'These minutes were already filed or withdrawn.');
            m.state = 'withdrawn';
            m.withdrawn = mark;
            changed('Minutes withdrawn by the secretary');
          } else {
            const q = get(db.requests, id);
            check(q.user === a.id, 'Only the person who sent this request can withdraw it.');
            check(q.status === 'pending', 'This request was already reviewed.');
            q.status = 'withdrawn';
            q.withdrawn = mark;
            changed('BOD access request withdrawn');
          }
          break;
        }
      case 'unsign':
        {
          // An officer can take back their own response until the resolution is filed, then respond again.
          const r = get(db.resolutions, id);
          allows(a, boardRoles);
          check(r.state === 'signing' && r.version === Number(v.version), 'This version is no longer open for signatures.');
          check(r.signatures[a.id], 'You have not responded to this version.');
          check(v.confirm === true, 'Confirm that you want to take back your response.');
          delete r.signatures[a.id];
          changed('Personal resolution response taken back');
          break;
        }
      case 'projectReopen':
        {
          allows(a, leaders);
          const p = get(db.projects, id);
          check(p.status === 'completed' && !p.past, 'Only a project marked completed in this app can be reopened.');
          const reason = words(v.reason, 'Reason for reopening', 8, 350);
          const progress = Number(v.progress);
          check(Number.isInteger(progress) && progress >= 0 && progress <= 99, 'Progress must be between 0 and 99 while the project is open.');
          p.history = p.history || [];
          p.history.push({
            at: at(),
            kind: 'reopen',
            reason
          });
          p.status = 'in_progress';
          p.progress = progress;
          p.phase = 'Reopened';
          p.changed = today();
          if (p.proposal) {
            const prop = get(db.proposals, p.proposal);
            prop.status = 'in_progress';
            tell(db, prop);
          }
          changed('Completed project reopened');
          break;
        }
      case 'amendProject':
        {
          // A change to an approved project. What the officers voted on stays fixed unless they vote again.
          //   Wording only, or a lower amount: the chairperson records it openly. No new vote.
          //   A higher amount, or a different purpose: a new officer vote and a new School-Head decision.
          financeReview(db, a);
          const proj = get(db.projects, id);
          check(['approved', 'in_progress'].includes(proj.status), 'Only a project that has not ended can be changed.');
          check(!amendOpen(db, proj.id), 'A change to this project is already waiting for a vote or decision.');
          const kind = choice(v.kind, ['wording', 'lower', 'raise', 'purpose'], 'kind of change');
          const why = words(v.reason, 'Reason for the change', 8, 350);
          proj.history = proj.history || [];
          if (kind === 'wording') {
            check(v.sameMeaning === true, 'Confirm that this wording change does not change what the money is for.');
            proj.history.push({
              at: at(),
              kind,
              from: proj.budget,
              to: proj.budget,
              before: proj.title,
              reason: why
            });
            proj.title = words(v.title, 'Title', 4, 100);
            proj.text = words(v.text, 'Project details', 8, 700);
            proj.changed = today();
            changed('Project wording corrected');
            break;
          }
          const cents = amount(v.budget);
          if (kind === 'lower') {
            check(cents < proj.budget, 'A lower allocation must be below ' + peso(proj.budget) + '.');
            check(cents >= projectSpend(db, proj.id), 'The allocation cannot go below ' + peso(projectSpend(db, proj.id)) + ', which is already spent.');
            proj.history.push({
              at: at(),
              kind,
              from: proj.budget,
              to: cents,
              reason: why
            });
            proj.budget = cents;
            proj.changed = today();
            changed('Project allocation lowered');
            break;
          }
          if (kind === 'raise') check(cents > proj.budget, 'A higher allocation must be above ' + peso(proj.budget) + '.');
          // Putting back an amount the officers already approved needs no new vote, for example after a typing slip.
          const approvedMax = Math.max(proj.budget, ...proj.history.filter(h => h.kind === 'lower').map(h => h.from));
          if (kind === 'raise' && cents <= approvedMax) {
            proj.history.push({
              at: at(),
              kind: 'restore',
              from: proj.budget,
              to: cents,
              reason: why
            });
            proj.budget = cents;
            proj.changed = today();
            changed('Project allocation restored to an amount the officers approved');
            break;
          }
          check(cents >= projectSpend(db, proj.id), 'The allocation cannot go below ' + peso(projectSpend(db, proj.id)) + ', which is already spent.');
          const newTitle = kind === 'purpose' ? words(v.title, 'New title', 4, 100) : proj.title,
            newText = kind === 'purpose' ? words(v.text, 'New project details', 8, 700) : proj.text;
          const closes = v.closes ? dateValue(v.closes) : '';
          check(!closes || closes >= today(), 'Choose today or a later date for the vote to close.');
          const p = {
            id: newId(db, 'P'),
            title: 'Change to ' + proj.title,
            details: why,
            category: 'Change to a project',
            owner: a.id,
            sender: sender(a),
            device,
            created: today(),
            budget: cents,
            fundraising: false,
            status: 'screened',
            published: true,
            supports: 0,
            supporters: [],
            rev: 1,
            history: [],
            amends: proj.id,
            change: kind,
            why,
            newTitle,
            newText
          };
          p.publicTitle = ('Change to ' + proj.title).slice(0, 100);
          p.publicText = (kind === 'raise' ? 'The allocation for this approved project would rise from ' + peso(proj.budget) + ' to ' + peso(cents) + '. ' : 'This approved project would change its purpose to “' + newTitle + '”: ' + newText + ' The allocation would be ' + peso(cents) + ' (now ' + peso(proj.budget) + '). ') + 'Reason: ' + why;
          p.publicText = p.publicText.slice(0, 700);
          db.proposals.unshift(p);
          openVote(db, p, closes);
          id = p.id;
          changed('Change to an approved project sent for a new officer vote');
          break;
        }
      case 'freeze':
        {
          check(holds(db, a, 'secretary'), 'The secretary does this. The chairperson may stand in while the secretary is away.');
          const r = get(db.resolutions, id);
          check(r.state === 'draft' && r.version === Number(v.version), 'Reopen the current draft version.');
          check(v.confirm === true, 'Review the exact resolution before releasing it.');
          const invited = r.signers.map(s => s.id);
          const required = Array.isArray(v.requiredSigners) ? [...new Set(v.requiredSigners)] : invited;
          check(required.length > 0 && required.every(id => invited.includes(id)), 'Choose required signers from the invited board members.');
          r.signerPolicy = required.length === invited.length ? 'All officers' : words(v.signerPolicy, 'School signer policy reference', 5, 200);
          r.requiredSigners = required;
          r.clause = words(v.clause, 'Resolution text', 12, 1200);
          check(sameAmount(r.clause, r.budget), 'The resolution must state the amount the officers voted (' + peso(r.budget) + '), and no other amount. A different amount needs a new officer vote through “Change project”.');
          // The secretary may adjust the wording. The allocation stays as voted.
          if (v.title !== undefined) r.title = words(v.title, 'Project title', 4, 100);
          if (v.text !== undefined) r.text = words(v.text, 'Project details', 8, 700);
          r.state = 'signing';
          r.frozen = at();
          r.releasedBy = a.id;
          // Every invited officer is told that the resolution is ready to sign.
          r.signers.forEach(x => note(db, x.id, r.id + ' · The resolution for “' + r.title + '” is ready for your signature.'));
          changed('Resolution released for signatures');
          break;
        }
      case 'reviseResolution':
        {
          check(holds(db, a, 'secretary'), 'The secretary does this. The chairperson may stand in while the secretary is away.');
          const r = get(db.resolutions, id);
          check(r.state !== 'draft' && r.version === Number(v.version), 'Reopen the current released version.');
          const reason = words(v.reason, 'Version correction reason', 5, 300);
          r.archive.push({
            version: r.version,
            clause: r.clause,
            frozen: r.frozen,
            state: r.state,
            signatures: duplicate(r.signatures),
            requiredSigners: requiredSigners(r),
            signerPolicy: r.signerPolicy,
            filing: r.filing,
            parentSummary: r.parentSummary,
            reason
          });
          r.version++;
          r.state = 'draft';
          r.signatures = {};
          r.published = false;
          r.frozen = null;
          r.filed = null;
          r.filing = '';
          r.parentSummary = '';
          changed('New resolution version created');
          break;
        }
      case 'sign':
        {
          const r = get(db.resolutions, id);
          allows(a, boardRoles);
          check(r.state === 'signing' && r.version === Number(v.version), 'Reopen the current resolution version.');
          check(r.signers.some(s => s.id === a.id), 'This profile is not on the signer list.');
          check(!r.signatures[a.id], 'You have already responded to this version.');
          check(v.consent === true, 'Confirm that you reviewed this version and that this is your own response.');
          const status = choice(v.response, ['acknowledged', 'not_signed'], 'response');
          r.signatures[a.id] = {
            status,
            at: at(),
            version: r.version,
            name: a.name,
            role: a.role,
            homeroom: a.homeroom || ''
          };
          // Only the officer's own drawing is stored. Nothing is attached for anyone else.
          if (status === 'acknowledged') r.signatures[a.id].mark = signatureMark(v.signature);
          changed('Personal resolution response recorded');
          break;
        }
      case 'finalizeResolution':
        {
          check(holds(db, a, 'secretary'), 'The secretary does this. The chairperson may stand in while the secretary is away.');
          const r = get(db.resolutions, id);
          check(r.state === 'signing' && Number(v.version) === r.version, 'This version is not open for filing.');
          check(v.confirm === true, 'Confirm that school-required signatures were checked.');
          check(signaturesPending(r).length === 0, 'Every required signer must personally acknowledge this version before filing.');
          r.parentSummary = words(v.parentSummary, 'Summary safe to share with families', 6, 700);
          r.filing = words(v.reason, 'Signer policy / exceptions and filing reference', 5, 350);
          r.filed = at();
          r.state = 'filed';
          r.published = true;
          changed('Resolution filed with actual response statuses');
          break;
        }
      case 'caseSubmit':
        {
          const kind = choice(v.kind, ['suggestion', 'concern', 'inspection'], 'submission type');
          id = newId(db, kind === 'concern' ? 'C' : kind === 'inspection' ? 'I' : 'S');
          const assigned = kind === 'inspection' ? 'secretary' : 'chair';
          // A signed-in parent may hide their name from the reviewer. The record keeps the account for the IT administrator only.
          const hidden = v.hideName === true;
          if (hidden) {
            check(kind !== 'inspection', 'A records inspection request needs your name.');
            check(!a.noHide && !(device && db.blockedDevices?.includes(device)), 'Hidden-name sending is turned off for this account. Send it with your name.');
            // Counted for the account and for the device, so a second account on the same phone does not add more.
            check(db.cases.filter(c => (c.owner === a.id || device && c.device === device) && c.hidden && c.created.slice(0, 7) === today().slice(0, 7)).length < hiddenPerMonth, 'You can hide your name on ' + hiddenPerMonth + ' submissions a month. Send this one with your name.');
          }
          db.cases.unshift({
            id,
            kind,
            assigned,
            subject: words(v.subject, 'Subject', 3, 100),
            body: words(v.body, 'Details', 6, 700),
            category: choice(v.category, categories, 'category'),
            owner: a.id,
            sender: sender(a),
            device,
            hidden,
            created: today(),
            due: plusDays(today(), 5),
            status: 'received',
            reply: '',
            forwarded: null,
            notes: [],
            history: []
          });
          tell(db, db.cases[0]);
          break;
        }
      case 'caseReply':
        {
          const c = get(db.cases, id);
          check(caseHandler(db, a, c), 'Only the assigned reviewer may update this case.');
          const next = choice(v.status, ['assigned', 'resolved'], 'status');
          // A personal reply is optional. The automated response always tells the sender the new status.
          const reply = String(v.reply ?? '').trim() ? words(v.reply, 'Personal reply', 3, 600) : '';
          const moved = c.status !== next;
          c.status = next;
          if (reply) {
            c.reply = reply;
            c.replyBy = a.role;
            c.replyAt = at();
          }
          c.history.push({
            status: next,
            reply,
            at: at(),
            who: a.id
          });
          if (v.due) c.due = dateValue(v.due);
          // Abuse is handled by ending the sender's hidden-name option. The name itself stays hidden from the reviewer.
          if (v.block === true && c.hidden) {
            const owner = account(db, c.owner);
            if (owner) owner.noHide = true;
            if (c.device) db.blockedDevices = [...new Set([...(db.blockedDevices || []), c.device])];
            audit(db, a, 'Hidden-name sending turned off for the sender of a case', c.id);
          }
          if (moved) tell(db, c);
          if (reply) note(db, c.owner, c.id + ' · A personal reply from the ' + (onDesk(c) ? 'SPTA' : recipients[a.role] || roles[a.role]) + ' is ready.');
          changed('Private case updated');
          break;
        }
      case 'caseForward':
        {
          // The chairperson or Vice-Chairperson decides a suggestion or concern is worth the School Head's time.
          const c = get(db.cases, id);
          check(onDesk(c) && ['chair', 'vice'].includes(a.role) && a.active, 'The chairperson or Vice-Chairperson passes this on to the School Head.');
          check(!c.forwarded, 'This was already passed on to the School Head.');
          check(['received', 'assigned'].includes(c.status), 'Only an open suggestion or concern can be passed on.');
          const text = String(v.note ?? '').trim() ? words(v.note, 'Note for the School Head', 3, 500) : '';
          c.forwarded = {
            at: at(),
            by: a.id,
            role: a.role
          };
          c.notes = c.notes || [];
          if (text) c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text,
            toHead: true
          });
          // The School Head and the secretary see it from now on.
          db.accounts.filter(x => x.active && ['head', 'secretary'].includes(x.role)).forEach(x => note(db, x.id, c.id + ' · A ' + c.kind + ' was passed on to the School Head by the ' + (roles[a.role] || a.role) + '.' + (text ? ' A note is attached.' : '')));
          changed('Private case passed on to the School Head');
          break;
        }
      case 'caseNote':
        {
          // Internal notes between the desk, the School Head and the secretary. The sender never sees them.
          const c = get(db.cases, id);
          check(caseNoter(db, a, c), 'You cannot add a note to this case.');
          check(c.status !== 'withdrawn', 'The sender withdrew this.');
          const text = words(v.note, 'Note', 3, 500);
          c.notes = c.notes || [];
          c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text,
            ...(a.role === 'secretary' ? {
              followUp: true
            } : {}),
            ...(c.forwarded && ['chair', 'vice'].includes(a.role) ? {
              toHead: true
            } : {})
          });
          // Tell the other people who can read it that there is something new.
          const to = ['chair', 'vice'];
          if (c.forwarded) to.push('head', 'secretary');
          db.accounts.filter(x => x.active && to.includes(x.role) && x.id !== a.id).forEach(x => note(db, x.id, c.id + ' · A new note from the ' + (roles[a.role] || a.role) + '.'));
          changed('Private case note added');
          break;
        }
      case 'proposalReply':
        {
          // Optional personal reply to the person who proposed, from the School Head or the chairperson.
          check(a.role === 'head' || isChair(db, a), 'The School Head or the chairperson sends a personal reply.');
          const p = get(db.proposals, id);
          p.reply = words(v.reply, 'Personal reply', 3, 600);
          p.replyBy = a.role;
          p.replyAt = at();
          note(db, p.owner, p.id + ' · A personal reply from the ' + (recipients[a.role] || roles[a.role]) + ' is ready.');
          changed('Personal reply sent on a proposal');
          break;
        }
      case 'announce':
        {
          // The School Head, the chairperson and the secretary publish SPTA announcements.
          check(canAnnounce(db, a), 'The School Head, chairperson or secretary publishes announcements.');
          id = newId(db, 'A');
          db.announcements.unshift({
            id,
            title: words(v.title, 'Title', 3, 100),
            body: words(v.body, 'Message', 6, 1600),
            audience: choice(v.audience, ['everyone', 'officers'], 'audience'),
            date: today(),
            until: v.until ? dateValue(v.until) : '',
            author: a.id,
            role: a.role
          });
          check(!db.announcements[0].until || db.announcements[0].until >= today(), 'Choose today or a later date to show it until.');
          changed('Announcement published');
          break;
        }
      case 'minutesUpload':
        {
          check(holds(db, a, 'secretary'), 'The secretary does this. The chairperson may stand in while the secretary is away.');
          check(v.confirm === true, 'Confirm your signature on the minutes.');
          const date = dateValue(v.date);
          check(date <= today(), 'Meeting date cannot be in the future.');
          id = newId(db, 'M');
          db.minutes.unshift({
            id,
            title: words(v.title, 'Meeting title', 3, 120),
            date,
            summary: words(v.summary, 'Community summary', 6, 700),
            file: photo(v.file),
            due: plusDays(date, 7),
            state: 'for_chair',
            secretary: a.id,
            signed: at()
          });
          if (a.role !== 'secretary') {
            // Uploaded by the chairperson standing in, so it goes straight to the School Head.
            Object.assign(db.minutes[0], {
              state: 'for_head',
              chair: a.id,
              chairAt: at(),
              covered: true
            });
          }
          changed('Minutes submitted');
          break;
        }
      case 'minutesReview':
        {
          const m = get(db.minutes, id);
          check(['for_chair', 'for_head'].includes(m.state), 'These minutes were withdrawn or are already filed.');
          if (m.state === 'for_chair') {
            financeReview(db, a);
            m.chair = a.id;
            m.chairAt = at();
            m.state = 'for_head';
          } else {
            allows(a, ['head']);
            check(m.state === 'for_head', 'Chair approval is required first.');
            m.head = a.id;
            m.noted = at();
            m.state = 'filed';
          }
          changed('Minutes reviewed');
          break;
        }
      case 'financeSubmit':
        {
          // The treasurer and the Collecting and Disbursing Officer both record from a scanned original.
          // The officer's record goes to the treasurer first, then to the chairperson.
          check(holds(db, a, 'treasurer') || holds(db, a, 'collector'), 'Your current profile cannot perform this action.');
          const collecting = a.role === 'collector' || covering(db, a) === 'collector';
          const prior = id ? get(db.batches, id) : null;
          check(!prior || prior.status === 'returned' && prior.owner === a.id, 'Only the person who sent a returned record can revise it.');
          check(v.verifiedItems === true, 'Confirm that you checked the line items against the original.');
          const direction = choice(v.direction, ['in', 'out'], 'direction'),
            purpose = words(v.purpose, 'Public purpose', 3, 140),
            receipt = words(v.receipt, 'Receipt / batch reference', 2, 90);
          check(!db.batches.some(x => x.id !== id && x.status !== 'withdrawn' && x.receipt.toLowerCase() === receipt.toLowerCase()), 'This receipt reference is already recorded.');
          const items = (Array.isArray(v.items) ? v.items : []).map(x => ({
            description: words(x.description, 'Private item description', 2, 120),
            cents: amount(x.amount)
          }));
          check(items.length > 0 && items.length <= 60, 'Add 1 to 60 checked items.');
          const cents = items.reduce((n, x) => n + x.cents, 0);
          const project = v.project || '';
          if (project) {
            const p = get(db.projects, project);
            check(direction === 'out' && p.status !== 'cancelled', 'Choose an active expense project.');
            check(cents <= p.budget - projectSpend(db, p.id), 'This exceeds the remaining project allocation.');
          }
          if (collecting) check(direction === 'in' && !project && !v.adjustment, 'The collecting officer records collections handed over to the treasurer.');
          if (v.adjustment) {
            check(!project, 'Use the allocation on the original entry for a correction.');
            const orig = get(db.batches, v.adjustment);
            check(orig.status === 'posted' && orig.direction !== direction && orig.cents >= cents, 'Choose a posted entry with the opposite direction.');
            const booked = db.batches.filter(x => x.id !== id && x.adjustment === orig.id && !['returned', 'withdrawn'].includes(x.status)).reduce((sum, x) => sum + x.cents, 0);
            check(booked + cents <= orig.cents, 'Corrections exceed the original entry.');
          }
          // The treasurer may record money that has no paper, such as a cash gift. She gives the reason and the chairperson sees it before posting.
          const noPaper = v.noPaper === true;
          if (noPaper) check(!collecting && holds(db, a, 'treasurer'), 'Only the treasurer can record an entry that has no paper original.');
          const noPaperReason = noPaper ? words(v.noPaperReason, 'Why there is no paper original', 6, 200) : '';
          const file = noPaper ? null : photo(v.file || prior?.file);
          id = prior?.id || newId(db, 'F');
          const history = prior ? [...prior.history, {
            reason: prior.reason,
            at: at(),
            receipt: prior.receipt,
            cents: prior.cents,
            file: prior.file,
            items: prior.items
          }] : [];
          const d = {
            id,
            direction,
            date: dateValue(v.date),
            purpose,
            receipt,
            cents,
            items,
            project: project || (v.adjustment ? get(db.batches, v.adjustment).project : ''),
            file,
            noPaper: noPaperReason,
            owner: a.id,
            status: collecting ? 'for_treasurer' : 'pending',
            handover: collecting,
            checkedBy: '',
            checkedAt: '',
            history,
            submitted: at(),
            adjustment: v.adjustment || ''
          };
          if (prior && prior.adjustment) check(prior.adjustment === d.adjustment, 'Retain the original adjustment reference.');
          if (prior) Object.assign(prior, d, {
            reason: ''
          });else db.batches.unshift(d);
          changed(collecting ? 'Collection handover sent to the treasurer' : 'Finance evidence submitted');
          break;
        }
      case 'financeCheck':
        {
          // Treasurer's approval of a collecting officer's handover, before the chairperson's final approval.
          check(holds(db, a, 'treasurer'), 'The treasurer does this. The chairperson may stand in while the treasurer is away.');
          const d = get(db.batches, id);
          check(d.status === 'for_treasurer' && d.owner !== a.id, 'This record is not waiting for the treasurer.');
          if (v.decision === 'return') {
            d.reason = words(v.reason, 'Reason for return', 4, 300);
            d.status = 'returned';
          } else {
            choice(v.decision, ['approve'], 'decision');
            check(v.received === true, 'Confirm that you received this amount and checked it against the original.');
            d.status = 'pending';
            d.reason = '';
            d.checkedBy = a.id;
            d.checkedAt = at();
          }
          changed(d.status === 'pending' ? 'Treasurer approved a collection handover' : 'Treasurer returned a collection handover');
          break;
        }
      case 'financeReview':
        {
          check(isChair(db, a) || a.role === 'vice', 'Chairperson posting authority is required.');
          const d = get(db.batches, id);
          if (d.status === 'posted' && v.decision === 'post') break;
          check(d.status === 'pending' && mayPost(db, a, d), 'An independently submitted pending batch is required. The Vice-Chairperson gives the final approval on records the chairperson sent or checked.');
          check(v.stamp === openStamp(d), 'This finance submission changed. Open its latest version before reviewing.');
          if (v.decision === 'return') {
            d.reason = words(v.reason, 'Reason for return', 4, 300);
            d.status = 'returned';
          } else {
            choice(v.decision, ['post'], 'decision');
            check(v.reviewed === true, d.noPaper ? 'Confirm that you read why there is no paper original.' : 'Open the supporting file and confirm your review.');
            check(v.publicSafe === true, 'Confirm the purpose is safe to publish.');
            if (d.direction === 'out' && d.project) {
              const p = get(db.projects, d.project);
              check(p.status !== 'cancelled' && d.cents <= p.budget - projectSpend(db, p.id), 'The project allocation no longer permits this expense.');
            }
            if (d.direction === 'out') check(d.cents <= fundBalance(db), 'The verified cash balance is insufficient.');
            d.status = 'posted';
            const earlier = d.adjustment ? db.ledger.find(x => x.batch === d.adjustment) : null;
            db.ledger.unshift({
              id: newId(db, 'L'),
              batch: d.id,
              date: d.date,
              purpose: d.purpose,
              direction: d.direction,
              cents: d.cents,
              project: d.project,
              // A correction points to the public entry it corrects, and says who approved it.
              ...(earlier ? {
                corrects: earlier.id,
                approver: a.role
              } : {})
            });
          }
          d.reviewedBy = a.id;
          d.reviewedAt = at();
          changed('Finance posting reviewed');
          break;
        }
      case 'automationSetting':
        allows(a, ['head']);
        db.settings[choice(v.setting, ['ack', 'reminders'], 'setting')] = v.enabled === true;
        break;
      default:
        throw new Error('Unknown action.');
    }
    db.revision++;
    if (key) db.receipts.push({
      key,
      id
    });
    return {
      db,
      id
    };
  }
  return {
    create,
    transition,
    availableSeats,
    homeroomKey,
    openStamp,
    requiredSigners,
    signaturesPending,
    resolutionText,
    roles,
    leaders,
    printers,
    boardRoles,
    categories,
    labels,
    recipients,
    account,
    hiddenPerMonth,
    accountsPerDevice,
    voteDays,
    voteCloses,
    directPerYear,
    directUsed,
    coverRoles,
    covering,
    holds,
    mayPost,
    expire,
    resetCheck,
    seenOn,
    createLive,
    addSeats,
    setOpening,
    addPastProject,
    officerJoin,
    liveRoles,
    loginKey,
    eligible,
    publicProposal,
    readableProposal,
    canSeeCase,
    caseHandler,
    caseNoter,
    onDesk,
    deskName,
    isChair,
    canAnnounce,
    hasDelegation,
    projectSpend,
    peso,
    correctionNote,
    amendOpen,
    extraNeeded,
    fundBalance,
    funding,
    autoReply,
    majority,
    requiredYes,
    yesNeeded,
    halfOf,
    today,
    plusDays,
    photo
  };
});
