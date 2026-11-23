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
  const minuteReaders = ['head', ...boardRoles];
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
    for_treasurer: 'For Treasurer approval',
    posted: 'Posted',
    draft: 'Secretary draft',
    signing: 'Open for signatures',
    signed: 'Signed',
    closed: 'Closed',
    assigned: 'Reviewed',
    action_taken: 'Action taken',
    cp_referred: 'Referred to school',
    cp_ack: 'Acknowledged',
    cp_handling: 'School handling',
    cp_closed: 'Closed',
    resolved: 'Resolved',
    for_chair: 'For Chairperson approval',
    for_head: 'For School Head notation',
    filed: 'Filed',
    approved_bod: 'Verified BOD',
    parent: 'Parent',
    rejected: 'Returned',
    absent: 'Absent',
    acknowledged: 'Signed',
    not_signed: 'Declined to sign',
    received_funds: 'Received by the Treasurer'
  };
  const categories = ['Facilities', 'Learning', 'Health & Safety', 'Environment', 'Community', 'Accessibility', 'Communication', 'Other'];
  const recipients = {
    head: 'School Head',
    chair: 'SPTA Chairperson',
    vice: 'SPTA Vice-Chairperson'
  };
  // Suggestions and private concerns go to the Chairperson and the Vice-Chairperson only.
  // They decide whether it is worth passing on to the School Head.
  const deskName = 'SPTA Chairperson and Vice-Chairperson';
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
  // and the Chairperson may stand in for three officers.
  // Anti-spam: one phone may send only a few proposals, suggestions and concerns, however many accounts it uses.
  const submissionsPerDay = 2, submissionsPerWeek = 3, photosPerCase = 2;
  const hiddenPerMonth = 2,
    accountsPerDevice = 2,
    voteDays = 30,
    coverRoles = ['secretary', 'treasurer', 'collector'];
  // The school year is taken to start in June.
  // The Privacy Notice version a person agrees to when they register.
  const PRIVACY_VERSION = '2026-11c';
  const voteCloses = b => b.closes || plusDays(b.date, voteDays);
  // Notes each device an account signs in from, newest last. The first entry is where the account was created.
  function seenOn(db, id, device) {
    const a = account(db, id);
    if (!a || a.demo || !device || !/^[A-Za-z0-9-]{8,80}$/.test(device) || a.devices?.includes(device)) return false;
    a.devices = [...(a.devices || []), device].slice(-10);
    return true;
  }
  const PHONE_FULL = 'This phone already has two accounts. A third account cannot be used on it.';
  // Only two accounts may be used on one phone, whether they were created or signed in there.
  function deviceFull(db, id, device) {
    if (!device || !/^[A-Za-z0-9-]{8,80}$/.test(device)) return false;
    const a = account(db, id);
    if (!a || a.demo || a.devices?.includes(device)) return false;
    return db.accounts.filter(x => !x.demo && x.devices?.includes(device)).length >= accountsPerDevice;
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
    check(a && device && a.devices?.includes(device) && fold(v.lastName) && fold(a.name).endsWith(' ' + fold(v.lastName)) && fold(a.homeroom) === fold(v.homeroom), 'Those details do not match an account used on this phone. Ask the SPTA Secretary for help.');
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
  // Sarah's rule: a proposal proceeds when yes votes reach 51% of all officers on the roster, which is more than half.
  const halfOf = n => majority(n);
  const yesNeeded = b => b.minimumYes || requiredYes(b.present.length);
  // Opens the in-app officer vote for a screened proposal.
  function openVote(db, p, closes) {
    const roster = eligible(db).map(x => x.id);
    check(roster.length > 0, 'Add officers to the roster before opening a vote.');
    const b = {
      minimumYes: halfOf(roster.length),
      rule: '51% of all officers',
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
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longDate = iso => /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? monthNames[Number(iso.slice(5, 7)) - 1] + ' ' + Number(iso.slice(8, 10)) + ', ' + iso.slice(0, 4) : '';
  // The resolution follows the school's own format: a Filipino resolution with SAPAGKAT clauses and numbered SEKSYON.
  // info (all optional): date of the vote, how it was held, the count, the School Head's approval date, and the project details.
  function resolutionText(title, budget, direct = false, info = {}) {
    const money = '₱' + (budget / 100).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const on = longDate(info.date);
    const inApp = !info.meeting || info.meeting === 'In-app officer vote';
    // Project details are quoted only when they carry no peso figure that differs from the voted amount.
    const found = String(info.text || '').match(/₱\s?[\d,]+(?:\.\d+)?/g) || [];
    const detail = info.text && found.every(x => Math.round(Number(x.replace(/[₱\s,]/g, '')) * 100) === budget) ? ': ' + String(info.text).trim().replace(/\s+/g, ' ').replace(/[.;:]+$/, '') : '';
    const t = info.tally;
    const parts = [direct ? 'KAMI, mga opisyales at miyembro ng SPTA ng East Central Elementary School, ay nagpasiya na:' : 'KAMI, mga opisyales at miyembro ng SPTA ng East Central Elementary School, sa ' + (inApp ? 'isang botohan ng mga opisyal' : 'isang pagpupulong') + (on ? ' na ginanap noong ' + on : '') + ', ay nagpasiya na:', 'SAPAGKAT, ang proyektong “' + title + '” ay iminungkahi para sa ikabubuti ng mga mag-aaral ng East Central Elementary School' + detail + ';', direct ? 'SAPAGKAT, ang panukalang ito ay napagkasunduan ng mga opisyal ng SPTA, at ang bawat lumagda sa ibaba ay pumapayag dito;' : 'SAPAGKAT, sa botohan ng mga opisyal ng SPTA, ang panukala ay nakakuha ng ' + (t ? t.yes + ' pagsang-ayon, ' + t.no + ' pagtutol at ' + t.abstain + ' hindi pumanig' + (info.officers ? ' mula sa ' + info.officers + ' na opisyal' : '') + ', at umabot sa hinihinging 51% ng lahat ng opisyal' : 'sapat na pagsang-ayon ng mga opisyal') + ';', 'SAPAGKAT, inaprubahan ng School Head ang panukala' + (info.approved ? ' noong ' + longDate(info.approved) : '') + ';', 'SAPAGKAT, ang inilaang halaga para sa proyekto ay ' + money + ', mula sa mga boluntaryong kontribusyon at pondo ng SPTA na hiwalay sa badyet ng paaralan' + (info.fundraising ? ', at ang karagdagang kakailanganin ay malilikom sa pamamagitan ng boluntaryong fundraising' : '') + ';', 'KAYA’T, SA KAPASYAHAN NG NAKARARAMI, AY NAPAGKAYARIAN NA:', 'SEKSYON 1. Ang SPTA ay pumapayag at nagpapatibay sa proyektong “' + title + '” na may inilaang halagang ' + money + '.', 'SEKSYON 2. Ang pondo ay gagamitin lamang para sa nasabing proyekto. Ang bawat gastos ay itatala at ipapakita sa mga magulang, at magkakaroon ng maayos na liquidation.', 'SEKSYON 3. Ang pagbabago sa halaga o layunin ng proyekto ay mangangailangan ng bagong botohan ng mga opisyal at bagong pag-apruba ng School Head.', 'SEKSYON 4. Ang resolusyong ito ay kusang-loob naming pinagtibay.', 'Pinagtibay ngayong araw ng ' + longDate(info.signed || today()) + ' sa San Fabian, Pangasinan.'];
    return parts.join('\n\n');
  }
  // The title line of the resolution, in the school's format.
  const resolutionHeading = r => 'ISANG RESOLUSYON NA NAGPAPATIBAY SA PROYEKTONG “' + String(r.title || '').toUpperCase() + '” AT SA PAGLALAAN NG ' + ('₱' + (r.budget / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }));
  // Resolutions are numbered through the school year, as on the school's paper copies. The Secretary can change the number before release.
  const nextResolutionNumber = (db, year) => 1 + db.resolutions.filter(x => x.sy === year).reduce((n, x) => Math.max(n, x.no || 0), 0);
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
    const who = entry.corrects && entry.approver ? ' Approved by the ' + (roles[entry.approver] || 'Chairperson') + '.' : '';
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
    // An activity's budget is set aside the same way, after the projects.
    const activities = {};
    (db.activities || []).filter(x => x.status === 'scheduled' && x.budget > 0).forEach(x => {
      const need = Math.max(0, x.budget - projectSpend(db, x.id)),
        covered = Math.min(need, cash);
      cash -= covered;
      committed += need;
      activities[x.id] = {
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
      activities,
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
    not_adopted: 'The SPTA officers’ vote did not reach 51%, so the proposal will not proceed for now.',
    withdrawn: 'You withdrew this proposal. Nothing more will happen with it.'
  };
  function autoReply(item) {
    if (item.kind) {
      const what = item.kind === 'inspection' ? 'request' : item.kind,
        // A parent is only told it went to the SPTA, never which officers read it.
        who = onDesk(item) ? 'SPTA' : recipients[item.assigned] || roles[item.assigned] || 'reviewer';
      if (item.status === 'withdrawn') return 'You withdrew this ' + what + '. Nothing more will happen with it.';
      if (item.status === 'resolved') return 'Your ' + what + ' was marked resolved by the ' + who + '.';
      // A possible child-protection concern: the parent is told only that it is being handled, never how.
      if (item.safety && !item.urgent && item.status !== 'resolved') return 'Thank you for reporting this concern. This app could not send it to the school yet. If a child is in immediate danger, contact their class adviser or the school administration directly now.';
      if (item.urgent) return 'Thank you for reporting this concern. Because it involves a child’s safety, please inform your child’s class adviser or the School Head immediately. The school’s designated child-protection personnel should assess and address the report. Your child’s safety and privacy are important to us.';
      if (item.status === 'assigned') return 'Your ' + what + ' was reviewed by the ' + who + '.';
      if (item.status === 'action_taken') return 'Action was taken on your ' + what + '. The ' + who + ' will confirm the outcome before closing it.';
      return 'Thank you. Your ' + what + ' was received privately by the ' + who + '.';
    }
    if (item.direct && item.status === 'awaiting_head') return 'Added by the Chairperson. It is now with the School Head for approval.';
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
  // The Chairperson may stand in for an absent secretary, treasurer or collecting officer, one at a time, until a set date.
  function covering(db, a) {
    const c = db.cover;
    return c && c.until >= today() && isChair(db, a) ? c.role : '';
  }
  const holds = (db, a, role) => !!a?.active && (a.role === role || covering(db, a) === role);
  // The final approval of a fund record comes from someone who neither sent nor checked it.
  // When the Chairperson handled it while standing in, that falls to the Vice-Chairperson.
  function mayPost(db, a, d) {
    const untouched = d.owner !== a?.id && d.checkedBy !== a?.id;
    if (isChair(db, a)) return untouched;
    return a?.role === 'vice' && a.active && untouched && [d.owner, d.checkedBy].some(x => account(db, x)?.role === 'chair');
  }
  const planners = ['head', 'chair', 'vice', 'secretary', 'treasurer'];
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
  function throttle(db, a, device, context) {
    if (context.practice === true || !device || !['parent', 'bod'].includes(a.role)) return;
    const now = Date.now();
    const mine = [...db.cases, ...db.proposals].filter(x => x.sent && (x.owner === a.id || x.device === device));
    // The daily limit counts every send, even one the sender withdrew, so a slip can be fixed but not repeated without end.
    // The weekly limit counts only submissions that stayed sent.
    const stamp = x => Date.parse(x.sent);
    const inLast = (ms, list) => list.filter(x => Number.isFinite(stamp(x)) && now - stamp(x) < ms).length;
    check(inLast(86400000, mine) < submissionsPerDay, 'This phone has reached today’s limit of ' + submissionsPerDay + ' submissions. Please try again tomorrow.');
    check(inLast(7 * 86400000, mine.filter(x => x.status !== 'withdrawn')) < submissionsPerWeek, 'This phone has reached this week’s limit of ' + submissionsPerWeek + ' submissions. Please try again next week.');
  }
  const onDesk = c => c.kind !== 'inspection' && ['chair', 'vice'].includes(c.assigned);
  // Who may read a case. The sender always can. Records requests go to the Secretary.
  // A suggestion or concern is read by the Chairperson and Vice-Chairperson, and by the School Head and secretary only once it is passed on.
  // A possible child-protection concern is the school's to handle: the School Head and the Secretary, who is a teacher and the School Head's
  // acting secretary (authorized school personnel), own it. The Chairperson and Vice-Chairperson only coordinate.
  // An SPTA matter may be endorsed to one officer, who then sees that case only.
  function canSeeCase(actor, c) {
    if (actor.id === c.owner) return true;
    // A child-protection referral: only the school's intake roles, plus the Chairperson and Vice-Chairperson if they referred it themselves.
    if (c.protection) return intakeOf(c).includes(actor.role) || !c.protection.direct && ['chair', 'vice'].includes(actor.role);
    if (actor.role === c.assigned) return true;
    if (!onDesk(c)) return false;
    if (actor.id && c.endorsed?.to === actor.id) return true;
    if (['chair', 'vice'].includes(actor.role)) return true;
    return !!c.forwarded && ['head', 'secretary'].includes(actor.role);
  }
  // Who may change the status or reply to the sender: the desk, the endorsed officer, and once passed on the School Head and the Secretary for the School Head.
  function caseHandler(db, a, c) {
    if (!a?.active) return false;
    if (!onDesk(c)) return holds(db, a, c.assigned);
    // No stand-in here: a person covering for the Secretary in the SPTA is not school personnel.
    if (c.protection) return intakeOf(c).includes(a.role);
    if (c.endorsed?.to === a.id) return true;
    return ['chair', 'vice'].includes(a.role) || !!c.forwarded && (a.role === 'head' || holds(db, a, 'secretary'));
  }
  // The SPTA officers who coordinate a child-protection referral.
  const caseCoordinator = (db, a, c) => !!a?.active && !!c.protection && !c.protection.direct && ['chair', 'vice'].includes(a.role);
  // Who receives child-protection reports for the school. The School Head always does, once their account is set up.
  // The Secretary does only after the School Head designates her in the app (she is a teacher and the School Head's acting secretary).
  const intakeReady = x => !!x && x.active && !x.invite && !x.vacant;
  function intakeRoles(db) {
    const roles = [];
    if (db.accounts.some(x => x.role === 'head' && intakeReady(x))) roles.push('head');
    if (db.settings?.intake?.secretary && db.accounts.some(x => x.role === 'secretary' && intakeReady(x))) roles.push('secretary');
    return roles;
  }
  const intakeOf = c => c.protection?.to || ['head'];
  // Who may add an internal note, and who may ask the sender for more details.
  const caseNoter = (db, a, c) => !!a?.active && onDesk(c) && (caseHandler(db, a, c) || caseCoordinator(db, a, c));
  const caseAsker = caseNoter;
  function publicProposal(p) {
    return Boolean(p.published && p.publicTitle);
  }
  // A proposal that is still waiting for a decision is shown only to people who are signed in. One the Chairperson added for the School Head
  // is shown only to the officers, the School Head and its sender: parents and guests see it once it is approved and becomes a project.
  const undecided = ['screened', 'voting', 'awaiting_head'];
  function readableProposal(p, a) {
    if (leaders.includes(a.role) || p.owner === a.id) return true;
    if (!publicProposal(p)) return false;
    if (undecided.includes(p.status) && (a.guest || a.role === 'guest' || p.direct && a.role === 'parent')) return false;
    return true;
  }
  // The school's list of HPTA Presidents, one seat per section. A seat waits, vacant, until that president registers and is matched to it
  // by the School Head or Chairperson. A vacant seat never votes, signs or counts toward a quorum.
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
  // Money already held before the app was used. One figure from the Treasurer's paper, set once and before any money is recorded here.
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
  // A project that was set aside or cancelled before the app was in use. It appears under Cancelled with the public reason and what became of the money.
  function addCancelledProject(db, v) {
    const title = words(v.title, 'Project title', 4, 100),
      text = words(v.text, 'Project description', 8, 700),
      reason = words(v.reason, 'Public cancellation reason', 6, 350),
      remainder = words(v.remainder, 'What happened to the money', 3, 300),
      done = dateValue(v.date),
      budget = v.budget === undefined || v.budget === '' ? 0 : amount(v.budget, true),
      spent = v.spent === undefined || v.spent === '' ? 0 : amount(v.spent, true);
    check(done <= today(), 'The cancellation date cannot be in the future.');
    check(spent <= budget || budget === 0, 'The amount spent cannot be more than the amount that had been set aside.');
    const id = newId(db, 'PR');
    db.projects.unshift({
      id,
      title,
      text,
      budget,
      owner: 'chair',
      phase: 'Cancelled',
      status: 'cancelled',
      progress: 0,
      changed: done,
      created: done,
      icon: 'sprout',
      reason,
      remainder,
      spentAtCancellation: spent,
      recorded: true
    });
    return id;
  }
  // A project the officers already voted on, and the School Head already approved, before the app was in use.
  // It goes straight to a draft resolution, so the Secretary can release it and the officers can sign. Returns the new record.
  function importVoted(db, v) {
    const title = words(v.title, 'Project title', 4, 100),
      text = words(v.text, 'Project description', 8, 700),
      budget = amount(v.budget, true),
      voted = dateValue(v.date),
      approved = dateValue(v.approved),
      meeting = words(v.meeting || 'SPTA meeting', 'Meeting name', 3, 100),
      n = Number(v.officers),
      yes = Number(v.yes),
      no = Number(v.no || 0),
      abstain = Number(v.abstain || 0);
    check(Number.isInteger(n) && n >= 1 && n <= 200, 'Enter how many officers were on the roster for the vote.');
    check([yes, no, abstain].every(x => Number.isInteger(x) && x >= 0) && yes + no + abstain <= n, 'The votes cannot add up to more than the officers on the roster.');
    check(yes >= majority(n), 'Yes votes did not reach 51% of the officers (' + majority(n) + ' of ' + n + '), so this project was not adopted.');
    check(approved >= voted && approved <= today(), 'The School Head approval cannot be before the vote or in the future.');
    check(db.accounts.some(x => x.role === 'head' && x.active) && db.accounts.some(x => x.role === 'chair' && x.active), 'The School Head and Chairperson must be set up first.');
    const draft = duplicate(db);
    const proposal = {
      id: newId(draft, 'P'),
      title,
      details: text,
      category: 'Other',
      owner: 'chair',
      sender: sender(account(draft, 'chair')),
      device: '',
      created: voted,
      budget,
      fundraising: false,
      status: 'awaiting_head',
      published: true,
      supports: 0,
      supporters: [],
      rev: 1,
      history: [],
      publicTitle: title,
      publicText: text,
      imported: true
    };
    const ballot = {
      minimumYes: majority(n),
      rule: '51% of all officers',
      id: newId(draft, 'B'),
      proposal: proposal.id,
      rev: 1,
      title,
      body: text,
      budget,
      roster: [],
      present: Array.from({ length: n }, (_, i) => 'recorded-' + i),
      participated: [],
      counts: { yes, no, abstain },
      named: [],
      method: 'meeting',
      date: voted,
      closes: voted,
      meeting,
      mode: 'Recorded from paper',
      status: 'closed',
      passed: true,
      closed: voted + 'T00:00:00.000Z',
      opened: voted + 'T00:00:00.000Z'
    };
    draft.proposals.unshift(proposal);
    draft.ballots.push(ballot);
    proposal.status = 'awaiting_head';
    proposal.ballot = ballot.id;
    const x = transition(draft, 'head', 'headDecision', { id: proposal.id, decision: 'approve' }, 'import-' + proposal.id);
    const out = x.db,
      res = out.resolutions.find(r => r.proposal === proposal.id),
      p = out.proposals.find(r => r.id === proposal.id);
    p.approved = approved + 'T00:00:00.000Z';
    res.approved = p.approved;
    res.imported = true;
    if (v.no_ !== undefined && v.no_ !== '') {
      const num = Number(v.no_);
      check(Number.isInteger(num) && num >= 1 && num <= 999, 'Enter the resolution number, from 1 to 999.');
      check(!out.resolutions.some(r => r !== res && r.sy === res.sy && r.no === num), 'Another resolution already has number ' + num + ' this year.');
      res.no = num;
    }
    res.clause = resolutionText(title, budget, false, { date: voted, meeting, tally: { yes, no, abstain }, officers: n, approved, fundraising: false, text });
    out.audit.push({ who: 'IT administrator', role: '', event: 'Voted project recorded from paper', ref: res.id, at: at() });
    return { db: out, id: res.id, project: res.project };
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
      activities: [],
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
    check(a, 'That invite code is not valid. Ask the Chairperson for a new one.');
    check(!a.inviteAt || Date.now() - a.inviteAt < 14 * 86400000, 'That invite code has expired. Ask the Chairperson for a new one.');
    check(v.consent === true, 'Please read the Privacy Notice and tick the box to agree.');
    const login = mobileNumber(v.mobile);
    check(!db.accounts.some(x => x.login === login && x !== a), 'An account already uses this mobile number.');
    check(!deviceFull(db, a.id, device), PHONE_FULL);
    a.login = login;
    a.joinedAt = at();
    delete a.invite;
    delete a.inviteAt;
    a.consent = {
      at: at(),
      version: PRIVACY_VERSION
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
      activities: [],
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
          rule: '51% of all officers',
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
    // Officers' practice copy: the School Head, Chairperson and Vice-Chairperson profiles are switched off, so nobody can sign in as them.
    // Practice version only: a few sample activities, so the new Activities page is not empty.
    if (!old && globalThis.ECESSamplePhotos) {
      const ga = today() <= '2026-12-07' ? '2026-12-07' : plusDays(today(), 14);
      db.activities = [{
        id: 'AC-1',
        title: 'Year-end party for SPTA officers',
        date: plusDays(today(), 30),
        time: '4:00 PM',
        place: 'School covered court',
        details: 'A thank-you get-together for the officers. Bring a dish to share.',
        audience: 'officers',
        status: 'scheduled',
        budget: 0,
        by: 'secretary',
        role: 'secretary',
        created: at()
      }, {
        id: 'AC-2',
        title: 'SPTA General Assembly',
        date: ga,
        time: '2:00 PM',
        place: 'School grounds',
        details: 'All parents are invited. The officers will report on projects and SPTA funds.',
        audience: 'everyone',
        status: 'scheduled',
        budget: 0,
        by: 'chair',
        role: 'chair',
        created: at()
      }];
    }
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
    db.activities = db.activities || [];
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
      audit(db, a, event, id, /Private case|Hidden-name|Personal reply|child-protection/.test(event) ? {
        action,
        private: true
      } : trace());
    }
    // The Chairperson posts a project expense straight to the SPTA funds: a receipt, or a correction to the amount spent.
    // It becomes an approved transaction in the funds log, tied to the project, and changes the cash balance.
    function postProjectEntry(p, direction, cents, date, purpose, file, noPaper, over, overWhy) {
      if (direction === 'out') check(cents <= fundBalance(db), 'The SPTA cash balance (' + peso(fundBalance(db)) + ') is lower than this amount. Record the money received first.');
      const batch = newId(db, 'F');
      db.batches.unshift({
        id: batch,
        direction,
        date,
        purpose,
        receipt: (file ? 'Receipt' : 'Recorded by the Chairperson') + ' · ' + batch,
        cents,
        items: [{
          description: purpose,
          cents
        }],
        project: p.id,
        file,
        noPaper,
        over,
        overWhy,
        owner: a.id,
        status: 'posted',
        handover: false,
        checkedBy: '',
        checkedAt: '',
        history: [],
        submitted: at(),
        adjustment: '',
        chairRecord: true,
        reviewedBy: a.id,
        reviewedAt: at()
      });
      db.ledger.unshift({
        id: newId(db, 'L'),
        batch,
        date,
        purpose,
        direction,
        cents,
        project: p.id,
        chairRecord: true,
        // A project receipt is public: parents and guests can open it from this line of the funds log.
        ...(file ? {receipt: file} : {})
      });
      return batch;
    }
    function chairProject(p) {
      check(a.role === 'chair' && a.active, 'Only the Chairperson records project expenses here.');
      check(['approved', 'in_progress', 'completed'].includes(p.status) && !p.past, 'Choose an approved, ongoing or completed project.');
    }
    function pastDate(v) {
      const d = dateValue(v);
      check(d <= today(), 'The date cannot be in the future.');
      return d;
    }
    // Records the School Head's approval of a proposal: the project, and a draft resolution unless the project needs no vote or resolution.
    // The School Head approves in the app. The Chairperson may instead record that the School Head already approved (byChair).
    function approveProposal(p, w, byChair, addedNow) {
      const vote = p.direct || p.noVote ? null : get(db.ballots, p.ballot);
      if (vote) check(p.status === 'awaiting_head' && vote.status === 'closed' && vote.passed && vote.rev === p.rev, 'A closed passing vote on this version is required.');else check(p.status === 'awaiting_head', 'This proposal is not waiting for the School Head.');
      // Without a vote, the details come from the Chairperson's proposal.
      const b = vote || {
        id: '',
        title: p.publicTitle,
        body: p.publicText,
        budget: p.budget,
        meeting: p.noVote ? '' : 'Added by the Chairperson',
        date: p.created,
        present: [],
        counts: null
      };
      const head = db.accounts.find(x => x.role === 'head' && x.active);
      const approvedOn = byChair && w.date ? dateValue(w.date) : '';
      if (approvedOn) {
        check(approvedOn <= today(), 'The School Head approval cannot be in the future.');
        // A project the Chairperson adds now may have been approved by the School Head days earlier.
        if (!addedNow) check(approvedOn >= p.created, 'The School Head approval cannot be before the proposal was added.');
      }
      if (p.fundraising) {
        p.ga = words(w.ga, 'General Assembly agreement reference', 3, 150);
        check(w.concur === true, 'Record School-Head concurrence for voluntary contributions.');
      }
      p.status = 'approved';
      p.approved = approvedOn ? approvedOn + at().slice(10) : at();
      if (byChair) {
        // The Chairperson recorded that the School Head already approved. Who recorded it, and when, stays on the record.
        p.headVia = 'chair';
        p.headRecordedBy = a.id;
        p.headRecordedAt = at();
        if (head) note(db, head.id, p.id + ' · The Chairperson recorded that you approved “' + b.title + '”' + (approvedOn ? ' on ' + approvedOn : '') + '.');
      }
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
      if (p.noVote) {
        // No resolution: the project carries its own approval record instead.
        project.approval = {
          chair: p.noVoteBy,
          chairAt: p.noVoteAt,
          head: byChair ? head ? head.id : '' : a.id,
          headAt: p.approved,
          ...(byChair ? {
            recordedBy: a.id
          } : {})
        };
        project.noVote = true;
        tell(db, p);
        changed(byChair ? 'School-Head approval recorded by the Chairperson (no vote or resolution needed)' : 'School-Head approval recorded (no vote or resolution needed)');
        return;
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
        no: nextResolutionNumber(db, Number(today().slice(0, 4))),
        sy: Number(today().slice(0, 4)),
        clause: resolutionText(p.amends ? project.title : b.title, b.budget, !!p.direct, {
          date: b.date,
          meeting: b.meeting,
          tally: b.counts ? {
            ...b.counts
          } : null,
          officers: b.present?.length,
          approved: String(p.approved || at()).slice(0, 10),
          fundraising: !!p.fundraising,
          text: p.amends ? project.text : b.body
        }).replace(/\n\nPinagtibay ngayong araw/, replaces.length ? '\n\nPinapalitan ng resolusyong ito ang naunang resolusyon ' + replaces.join(', ') + ', na may ibang inilaang halaga.\n\nPinagtibay ngayong araw' : '\n\nPinagtibay ngayong araw'),
        supersedes: replaces,
        published: false
      };
      db.resolutions.unshift(res);
      db.resolutions.filter(x => replaces.includes(x.id)).forEach(x => {
        x.supersededBy = res.id;
      });
      // The Secretary is told that a draft resolution is waiting for review.
      db.accounts.filter(x => x.active && x.role === 'secretary').forEach(x => note(db, x.id, res.id + ' · A resolution for “' + res.title + '” was drafted. Review and publish it for signatures.'));
      tell(db, p);
      changed(byChair ? 'School-Head approval recorded by the Chairperson' : 'School-Head decision recorded');
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
            check(!device || db.accounts.filter(x => !x.demo && x.devices?.includes(device)).length < accountsPerDevice, 'This phone already has two accounts. Sign in instead.');
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
            demo: false,
            joinedAt: at()
          };
          if (homeroom) user.homeroom = homeroom;
          if (childName) user.childName = childName;
          // Proof that the person agreed, and to which version of the notice.
          if (v.consent === true) user.consent = {
            at: at(),
            version: PRIVACY_VERSION
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
          check(user.active && user.role === 'bod', 'Choose a current HPTA President.');
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
          throttle(db, a, device, context);
          const p = {
            id: newId(db, 'P'),
            title: words(v.title, 'Title', 4, 100),
            details: words(v.details, 'Project description', 8, 700),
            category: choice(v.category, categories, 'category'),
            owner: a.id,
            sender: sender(a),
            device,
            created: today(),
            sent: at(),
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
            if (v.noVote === true) {
              // The Chairperson judges whether a project needs the officers' vote and a resolution. Nobody else can decide that.
              check(isChair(db, a), 'Only the Chairperson decides that a project needs no officers’ vote or resolution.');
              // Sarah, Nov 2026: some projects (for example replacing toilet bowls) need documentation and approval, but no vote or resolution.
              // The Chairperson ticks this; it goes straight to the School Head. There is no limit on the amount.
              p.noVote = true;
              p.status = 'awaiting_head';
              p.noVoteBy = a.id;
              p.noVoteAt = at();
              db.accounts.filter(x => x.active && x.role === 'head').forEach(x => note(db, x.id, p.id + ' · “' + p.publicTitle + '” needs your approval. No officer vote or resolution is needed.'));
            } else {
              const closes = v.closes ? dateValue(v.closes) : '';
              check(!closes || closes >= today(), 'Choose today or a later date for the vote to close.');
              openVote(db, p, closes);
            }
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
          // Sarah's rule: the Chairperson may add a proposal that skips screening and the officers' vote
          // and goes straight to the School Head. It is marked as such everywhere, including the resolution.
          financeReview(db, a);
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
          if (v.noVote === true) {
            p.noVote = true;
            p.noVoteBy = a.id;
            p.noVoteAt = at();
          }
          db.proposals.unshift(p);
          id = p.id;
          changed('Chairperson added a proposal for School-Head approval');
          // The School Head already approved: record it now instead of waiting for the approval in the app.
          if (v.headApproved === true) approveProposal(p, {
            ...v,
            decision: 'approve'
          }, true, true);
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
            // A Chairperson's direct proposal returns to the School Head after revision.
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
          check(publicProposal(p) && readableProposal(p, a), 'This proposal has not been screened.');
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
          check(['yes', 'no', 'abstain'].includes(v.vote), 'Choose Proceed, Do not proceed or Abstain.');
          const vote = v.vote;
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
          changed('Officer vote closed by the Chairperson');
          break;
        }
      case 'voteDeadline':
        {
          // The Chairperson may move the closing date of an open vote.
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
          } else if (item.protection) {
            // Once the school has a child-protection report, the parent can stop the SPTA's follow-ups, but cannot take the report back from the school.
            check(item.status !== 'resolved' && !item.senderStopped, 'This was already closed or stopped.');
            item.senderStopped = {
              at: at()
            };
            item.awaiting = false;
            db.accounts.filter(x => x.active && intakeOf(item).includes(x.role)).forEach(x => note(db, x.id, item.id + ' · The parent asked to stop follow-ups on a child-protection report. The school keeps the report and decides what to do.'));
            changed('Sender stopped follow-ups on a child-protection referral');
            break;
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
          check(canAnnounce(db, a), 'The School Head, Chairperson or secretary publishes announcements.');
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
          check(canAnnounce(db, a), 'The School Head, Chairperson or secretary publishes announcements.');
          check(v.confirm === true, 'Confirm that you want to remove this announcement.');
          const n = get(db.announcements, id);
          db.announcements = db.announcements.filter(x => x.id !== id);
          audit(db, a, 'Announcement removed: ' + n.title, id);
          break;
        }
      case 'headDecision':
      case 'headApproved':
        {
          const byChair = action === 'headApproved';
          if (byChair) {
            // Sarah, Nov 2026: the Chairperson may tick that the School Head already approved, instead of waiting for the approval in the app.
            check(isChair(db, a), 'Only the Chairperson records that the School Head already approved.');
            check(v.approved === true, 'Tick the box to confirm that the School Head already approved this project.');
          } else allows(a, ['head']);
          const w = byChair ? {
            ...v,
            decision: 'approve'
          } : v;
          const p = get(db.proposals, id);
          if (w.decision === 'approve' && db.projects.some(x => x.proposal === p.id)) {
            break;
          }
          if (w.decision === 'approve') {
            approveProposal(p, w, byChair);
            break;
          }
          const vote = p.direct || p.noVote ? null : get(db.ballots, p.ballot);
          if (vote) check(p.status === 'awaiting_head' && vote.status === 'closed' && vote.passed && vote.rev === p.rev, 'A closed passing vote on this version is required.');else check(p.status === 'awaiting_head', 'This proposal is not waiting for the School Head.');
          choice(w.decision, ['return', 'decline'], 'decision');
          p.reason = words(w.reason, 'Decision reason', 3, 350);
          p.status = w.decision === 'return' ? 'returned' : 'declined';
          if (p.status === 'returned') p.published = false;
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
            // The Chairperson has the final say on what the public sees. Her own photos need no second approval.
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
            check(!(d.handover && d.status === 'pending'), 'The Treasurer already received this handover. Ask the Treasurer or Chairperson to return it.');
            d.status = 'withdrawn';
            d.withdrawn = mark;
            changed('Finance record withdrawn by its sender');
          } else if (kind === 'minutes') {
            const m = get(db.minutes, id);
            check(m.secretary === a.id || holds(db, a, 'secretary'), 'Only the Secretary who uploaded these minutes can withdraw them.');
            check(['for_chair', 'for_head'].includes(m.state), 'These minutes were already filed or withdrawn.');
            m.state = 'withdrawn';
            m.withdrawn = mark;
            changed('Minutes withdrawn by the Secretary');
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
          //   Wording only, or a lower amount: the Chairperson records it openly. No new vote.
          //   A higher amount, or a different purpose: a new officer vote and a new School-Head decision.
          financeReview(db, a);
          const proj = get(db.projects, id);
          check(['approved', 'in_progress'].includes(proj.status), 'Only a project that has not ended can be changed.');
          check(!amendOpen(db, proj.id), 'A change to this project is already waiting for a vote or decision.');
          const kind = choice(v.kind, ['wording', 'lower', 'raise', 'purpose'], 'kind of change');
          // A wording fix needs no reason. Every other change tells families why.
          const why = kind === 'wording' ? '' : words(v.reason, 'Reason for the change', 8, 350);
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
          id = p.id;
          if (proj.noVote) {
            // The Chairperson decided this project needs no officers' vote or resolution, so a change to it goes straight to the School Head too.
            Object.assign(p, {
              noVote: true,
              noVoteBy: a.id,
              noVoteAt: at(),
              status: 'awaiting_head'
            });
            tell(db, p);
            changed('Change to an approved project sent to the School Head (no vote or resolution needed)');
            break;
          }
          openVote(db, p, closes);
          changed('Change to an approved project sent for a new officer vote');
          break;
        }
      case 'freeze':
        {
          check(holds(db, a, 'secretary'), 'The Secretary does this. The Chairperson may stand in while the Secretary is away.');
          const r = get(db.resolutions, id);
          check(r.state === 'draft' && r.version === Number(v.version), 'Reopen the current draft version.');
          check(v.confirm === true, 'Review the exact resolution before releasing it.');
          const invited = r.signers.map(s => s.id);
          const required = Array.isArray(v.requiredSigners) ? [...new Set(v.requiredSigners)] : invited;
          check(required.length > 0 && required.every(id => invited.includes(id)), 'Choose required signers from the invited board members.');
          r.signerPolicy = required.length === invited.length ? 'All officers' : words(v.signerPolicy, 'School signer policy reference', 5, 200);
          r.requiredSigners = required;
          r.clause = words(v.clause, 'Resolution text', 12, 4000);
          if (v.no !== undefined && v.no !== '') {
            const no = Number(v.no);
            check(Number.isInteger(no) && no >= 1 && no <= 999, 'Enter the resolution number, from 1 to 999.');
            check(!db.resolutions.some(x => x.id !== r.id && x.sy === r.sy && x.no === no), 'Another resolution already has number ' + no + ' this year.');
            r.no = no;
          }
          check(sameAmount(r.clause, r.budget), 'The resolution must state the amount the officers voted (' + peso(r.budget) + '), and no other amount. A different amount needs a new officer vote through “Change project”.');
          // The Secretary may adjust the wording. The allocation stays as voted.
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
          check(holds(db, a, 'secretary'), 'The Secretary does this. The Chairperson may stand in while the Secretary is away.');
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
          check(holds(db, a, 'secretary'), 'The Secretary does this. The Chairperson may stand in while the Secretary is away.');
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
          // Up to two photos as evidence, only on a suggestion or concern. The original file name is never kept, because it could name the sender.
          const given = Array.isArray(v.photos) ? v.photos.filter(Boolean) : [];
          check(given.length <= photosPerCase, 'You can attach up to ' + photosPerCase + ' photos.');
          check(kind !== 'inspection' || !given.length, 'A records request does not take photos.');
          const photos = given.map((f, i) => {
            const x = photo(f);
            check(x.type !== 'application/pdf', 'Photos must be JPG, PNG or WEBP.');
            return {
              ...x,
              name: 'Photo ' + (i + 1)
            };
          });
          check(new Set(photos.map(x => x.key)).size === photos.length, 'Choose two different photos.');
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
          throttle(db, a, device, context);
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
            photos,
            created: today(),
            sent: at(),
            due: plusDays(today(), 5),
            status: 'received',
            reply: '',
            forwarded: null,
            notes: [],
            history: []
          });
          // A possible bullying or child-safety concern goes straight to the school's intake, without waiting for the SPTA.
          // If no school account can receive it yet, nothing claims it was sent: the parent is told to contact the school directly.
          if (v.safety === true) {
            check(kind === 'concern', 'Choose “Private concern” for a child-safety report.');
            const c = db.cases[0],
              to = intakeRoles(db);
            c.safety = true;
            if (to.length) {
              c.protection = {
                at: at(),
                by: a.id,
                role: 'sender',
                direct: true,
                wasForwarded: null,
                to
              };
              c.forwarded = {
                at: at(),
                by: a.id,
                role: 'sender'
              };
              c.track = 'protection';
              c.urgent = true;
              // The parent chose this, so telling them it went to the school reveals nothing new.
              c.toSchool = true;
              c.due = today();
              db.accounts.filter(x => x.active && to.includes(x.role)).forEach(x => note(db, x.id, c.id + ' · URGENT · A parent sent a possible child-safety concern to the school. Please acknowledge it and handle it under the school’s child protection procedure.'));
            }
          }
          tell(db, db.cases[0]);
          break;
        }
      case 'caseReply':
        {
          const c = get(db.cases, id);
          check(caseHandler(db, a, c), 'Only the assigned reviewer may update this case.');
          const next = choice(v.status, ['assigned', 'action_taken', 'resolved'], 'status');
          // Verify before closing: on an ordinary suggestion or concern, whoever acted marks it "Action taken" and the Chairperson or Vice-Chairperson checks it and closes it.
          // A child-protection case is closed by the school.
          check(next !== 'resolved' || !onDesk(c) || c.protection || ['chair', 'vice'].includes(a.role), 'Mark it “Action taken”. The Chairperson or Vice-Chairperson verifies the outcome and closes it.');
          check(next !== 'action_taken' || onDesk(c) && !c.protection, 'Choose Reviewed or Resolved.');
          check(!c.protection || c.protection.ack, 'Acknowledge the referral first.');
          if (c.protection) c.schoolHandling = true;
          // A personal reply is optional. The automated response always tells the sender the new status.
          const reply = String(v.reply ?? '').trim() ? words(v.reply, 'Personal reply', 3, 600) : '';
          // Close the loop: a case is resolved only with a recorded outcome or a clear explanation for the sender.
          check(!['resolved', 'action_taken'].includes(next) || reply || c.reply && ['resolved', 'action_taken'].includes(c.status), 'Write what was done, or explain why no action is needed.');
          const moved = c.status !== next;
          c.status = next;
          if (reply) {
            c.reply = reply;
            c.replyBy = a.role;
            c.replyAt = at();
            // The Secretary answers for the School Head once a case is passed on.
            c.replyFor = onDesk(c) && c.forwarded && !c.protection && !['chair', 'vice', 'head'].includes(a.role) && !(c.endorsed?.to === a.id) ? 'head' : undefined;
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
          // The Chairperson or Vice-Chairperson decides a suggestion or concern is worth the School Head's time.
          const c = get(db.cases, id);
          check(onDesk(c) && ['chair', 'vice'].includes(a.role) && a.active, 'The Chairperson or Vice-Chairperson passes this on to the School Head.');
          check(!c.forwarded, 'This was already passed on to the School Head.');
          const track = v.track === undefined || v.track === '' ? 'school' : choice(v.track, ['school', 'grievance'], 'kind of matter');
          check(['received', 'assigned'].includes(c.status), 'Only an open suggestion or concern can be passed on.');
          const text = String(v.note ?? '').trim() ? words(v.note, 'Note for the School Head', 3, 500) : '';
          c.forwarded = {
            at: at(),
            by: a.id,
            role: a.role
          };
          c.track = track;
          if (c.endorsed) c.endorsed = null;
          c.notes = c.notes || [];
          if (text) c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text,
            toHead: true
          });
          // The School Head and the Secretary see it from now on.
          db.accounts.filter(x => x.active && ['head', 'secretary'].includes(x.role)).forEach(x => note(db, x.id, c.id + ' · A ' + c.kind + (track === 'grievance' ? ' about a dispute between PTA members' : '') + ' was passed on to the School Head by the ' + (roles[a.role] || a.role) + '.' + (text ? ' A note is attached.' : '')));
          changed('Private case passed on to the School Head');
          break;
        }
      case 'caseEndorse':
        {
          // An SPTA matter: the Chairperson or Vice-Chairperson asks one officer, often a section president, to handle it.
          const c = get(db.cases, id);
          check(onDesk(c) && ['chair', 'vice'].includes(a.role) && a.active, 'The Chairperson or Vice-Chairperson endorses a suggestion or concern.');
          check(!c.forwarded && !c.protection, 'This was already passed on to the School Head.');
          check(['received', 'assigned'].includes(c.status), 'Only an open suggestion or concern can be endorsed.');
          if (v.back === true) {
            check(c.endorsed, 'This is not endorsed to anyone.');
            c.endorsed = null;
            changed('Private case taken back from the endorsed officer');
            break;
          }
          const to = account(db, v.to);
          check(to && to.active && boardRoles.includes(to.role) && !['chair', 'vice'].includes(to.role), 'Choose an active SPTA officer.');
          check(to.id !== c.owner, 'You cannot endorse this to the person who sent it.');
          const text = String(v.note ?? '').trim() ? words(v.note, 'What you need done', 3, 500) : '';
          c.endorsed = {
            to: to.id,
            at: at(),
            by: a.id,
            role: a.role
          };
          c.track = 'spta';
          c.notes = c.notes || [];
          if (text) c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text
          });
          note(db, to.id, c.id + ' · The ' + (roles[a.role] || a.role) + ' endorsed a ' + c.kind + ' to you. Open Assigned feedback to act on it.');
          changed('Private case endorsed to an officer');
          break;
        }
      case 'caseProtect':
        {
          // A possible child-protection concern leaves the ordinary queue at once and goes to the school's intake.
          const c = get(db.cases, id);
          check(onDesk(c) && ['chair', 'vice'].includes(a.role) && a.active, 'The Chairperson or Vice-Chairperson refers this.');
          check(!c.protection, 'This was already referred.');
          check(!['resolved', 'withdrawn'].includes(c.status), 'This is already closed.');
          const to = intakeRoles(db);
          check(to.length, 'No school account can receive this yet. Tell the parent to contact the class adviser or the school administration directly.');
          c.protection = {
            at: at(),
            by: a.id,
            role: a.role,
            wasForwarded: c.forwarded || null,
            to
          };
          c.track = 'protection';
          c.urgent = true;
          c.endorsed = null;
          c.forwarded = c.forwarded || {
            at: at(),
            by: a.id,
            role: a.role
          };
          c.due = today();
          db.accounts.filter(x => x.active && to.includes(x.role)).forEach(x => note(db, x.id, c.id + ' · URGENT · A possible child-protection concern was referred to the school. Please acknowledge it and handle it under the school’s child protection procedure.'));
          tell(db, c);
          changed('Possible child-protection concern referred');
          break;
        }
      case 'caseAsk':
        {
          // Whoever is handling a suggestion or concern can ask the sender for more details. The sender answers in the app.
          const c = get(db.cases, id);
          check(caseAsker(db, a, c), 'Only the person handling this can ask the sender.');
          check(!['resolved', 'withdrawn'].includes(c.status), 'This is already closed.');
          check(!c.awaiting, 'You already asked. Wait for the sender to answer.');
          check(!c.senderStopped, 'The sender asked to stop follow-ups.');
          c.messages = c.messages || [];
          c.messages.push({
            from: 'officer',
            role: a.role,
            by: a.id,
            text: words(v.question, 'Question', 3, 500),
            at: at()
          });
          c.awaiting = true;
          note(db, c.owner, c.id + ' · The SPTA would like more details about your ' + c.kind + '. Open it in My Updates to answer.');
          changed('Private case: more details asked');
          break;
        }
      case 'caseAnswer':
        {
          const c = get(db.cases, id);
          check(c.owner === a.id, 'Only the sender can answer.');
          check(c.awaiting, 'There is no question waiting for your answer.');
          check(!['resolved', 'withdrawn'].includes(c.status), 'This is already closed.');
          c.messages.push({
            from: 'sender',
            text: words(v.answer, 'Your answer', 3, 700),
            at: at()
          });
          c.awaiting = false;
          db.accounts.filter(x => x.active && x.id !== a.id && caseAsker(db, x, c)).forEach(x => note(db, x.id, c.id + ' · The sender answered your question.'));
          changed('Private case: sender answered');
          break;
        }
      case 'caseReturn':
        {
          // Not a child-protection matter after all (for example, a false or mistaken report): send it back to the Chairperson and Vice-Chairperson.
          const c = get(db.cases, id);
          // Deciding it is not a child-protection matter is an assessment, so only the School Head records it.
          check(c.protection && a.role === 'head' && caseHandler(db, a, c), 'Only the School Head can record that this is not a child-protection matter.');
          check(!['resolved', 'withdrawn'].includes(c.status), 'This is already closed.');
          const reason = words(v.reason, 'Reason', 6, 350);
          c.forwarded = c.protection.wasForwarded || null;
          c.track = c.forwarded ? 'school' : undefined;
          delete c.protection;
          delete c.urgent;
          delete c.safety;
          delete c.toSchool;
          delete c.schoolAck;
          delete c.schoolHandling;
          c.due = plusDays(today(), 3);
          c.notes = c.notes || [];
          c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text: 'Returned as not a child-protection concern: ' + reason
          });
          db.accounts.filter(x => x.active && ['chair', 'vice'].includes(x.role)).forEach(x => note(db, x.id, c.id + ' · A concern was returned to you as not a child-protection matter. Read the note.'));
          changed('Private case returned as not a child-protection concern');
          break;
        }
      case 'intakeSetting':
        {
          // The School Head may designate the Secretary, as authorized school personnel, to receive, acknowledge, coordinate and monitor
          // child-protection referrals. The School Head confirms the authorization; a memo reference is optional. Who and when are recorded.
          allows(a, ['head']);
          const on = v.secretary === true;
          check(!on || v.confirm === true, 'Confirm that the school has authorized the Secretary.');
          db.settings.intake = on ? {
            secretary: true,
            by: a.id,
            at: at(),
            reference: String(v.reference ?? '').trim() ? words(v.reference, 'Reference', 3, 120) : ''
          } : {
            secretary: false,
            by: a.id,
            at: at()
          };
          // Open referrals follow the new setting.
          for (const c of db.cases) if (c.protection && !['resolved', 'withdrawn'].includes(c.status)) c.protection.to = on ? [...new Set([...intakeOf(c), 'secretary'])] : intakeOf(c).filter(r => r !== 'secretary');
          db.accounts.filter(x => x.active && x.role === 'secretary').forEach(x => note(db, x.id, on ? 'The School Head designated you to receive, acknowledge, coordinate and monitor child-protection referrals for the school.' : 'The School Head ended your designation for child-protection referrals.'));
          changed(on ? 'Secretary designated for child-protection intake' : 'Secretary designation for child-protection intake ended');
          break;
        }
      case 'caseAcknowledge':
        {
          // The school confirms it has received the referral. The SPTA sees that it was acknowledged, nothing more.
          const c = get(db.cases, id);
          check(c.protection && caseHandler(db, a, c), 'The school acknowledges a child-protection referral.');
          check(!c.protection.ack, 'This was already acknowledged.');
          c.protection.ack = {
            at: at(),
            by: a.id
          };
          c.schoolAck = true;
          db.accounts.filter(x => x.active && x.id !== a.id && canSeeCase(x, c)).forEach(x => note(db, x.id, c.id + ' · The school acknowledged the child-protection referral.'));
          changed('Child-protection referral acknowledged by the school');
          break;
        }
      case 'caseVerify':
        {
          // The Chairperson or Vice-Chairperson checks the action taken: close it, or send it back for more action.
          const c = get(db.cases, id);
          check(onDesk(c) && !c.protection && ['chair', 'vice'].includes(a.role) && a.active, 'The Chairperson or Vice-Chairperson verifies the outcome.');
          check(c.status === 'action_taken', 'Nothing is waiting to be verified.');
          const ok = choice(v.decision, ['close', 'more'], 'decision') === 'close';
          const text = String(v.note ?? '').trim() ? words(v.note, 'Note', 3, 500) : '';
          check(ok || text, 'Say what more is needed.');
          c.status = ok ? 'resolved' : 'assigned';
          c.history.push({
            status: c.status,
            reply: '',
            at: at(),
            who: a.id
          });
          c.notes = c.notes || [];
          if (text) c.notes.push({
            at: at(),
            by: a.id,
            role: a.role,
            text: (ok ? 'Verified: ' : 'More action needed: ') + text
          });
          if (ok) tell(db, c);
          else db.accounts.filter(x => x.active && x.id !== a.id && caseHandler(db, x, c) && !['chair', 'vice'].includes(x.role)).forEach(x => note(db, x.id, c.id + ' · The ' + (roles[a.role] || a.role) + ' asked for more action before closing.'));
          changed(ok ? 'Private case verified and closed' : 'Private case sent back for more action');
          break;
        }
      case 'caseNote':
        {
          // Internal notes between the desk, the School Head and the Secretary. The sender never sees them.
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
          const to = c.protection ? ['head', 'secretary', 'chair', 'vice'] : ['chair', 'vice'];
          if (c.forwarded && !c.protection) to.push('head', 'secretary');
          db.accounts.filter(x => x.active && (to.includes(x.role) || c.endorsed?.to === x.id) && x.id !== a.id).forEach(x => note(db, x.id, c.id + ' · A new note from the ' + (roles[a.role] || a.role) + '.'));
          changed('Private case note added');
          break;
        }
      case 'proposalReply':
        {
          // Optional personal reply to the person who proposed, from the School Head or the Chairperson.
          check(a.role === 'head' || isChair(db, a), 'The School Head or the Chairperson sends a personal reply.');
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
          // The School Head, the Chairperson and the Secretary publish SPTA announcements.
          check(canAnnounce(db, a), 'The School Head, Chairperson or secretary publishes announcements.');
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
      case 'activitySave':
        {
          allows(a, planners);
          const edit = id ? get(db.activities, id) : null;
          if (edit) check(edit.status === 'scheduled' && (edit.by === a.id || isChair(db, a) || a.role === 'head' || a.role === 'vice'), 'Only the person who added it, the Chairperson, Vice-Chairperson or School Head can change an activity.');
          const day = dateValue(v.date);
          check(edit || day >= today(), 'Choose today or a later date.');
          const f = {
            title: words(v.title, 'Activity name', 3, 100),
            date: day,
            time: v.time ? words(v.time, 'Time', 1, 30) : '',
            place: v.place ? words(v.place, 'Place', 2, 100) : '',
            details: v.details ? words(v.details, 'Details', 6, 600) : '',
            audience: choice(v.audience, ['everyone', 'officers'], 'audience')
          };
          if (edit) {
            Object.assign(edit, f);
            edit.edited = at();
            changed('Activity updated');
          } else {
            id = newId(db, 'AC');
            db.activities.unshift({
              id,
              ...f,
              status: 'scheduled',
              budget: 0,
              by: a.id,
              role: a.role,
              created: at()
            });
            changed('Activity added');
          }
          break;
        }
      case 'activityBudget':
        {
          check(holds(db, a, 'treasurer'), 'The Treasurer sets an activity’s budget. The Chairperson may stand in while the Treasurer is away.');
          const act = get(db.activities, id);
          check(act.status === 'scheduled', 'This activity is no longer on the calendar.');
          const cents = amount(v.budget, true),
            spent = projectSpend(db, act.id),
            before = Math.max(0, (act.budget || 0) - spent);
          check(cents >= spent, 'The budget cannot go below ' + peso(spent) + ', which is already spent.');
          check(cents - spent <= funding(db).available + before, 'SPTA funds that are not already set aside come to ' + peso(funding(db).available + before) + '. Choose a smaller budget.');
          act.budget = cents;
          act.budgetBy = a.id;
          act.budgetAt = at();
          changed('Activity budget set');
          break;
        }
      case 'activityCancel':
        {
          allows(a, planners);
          const act = get(db.activities, id);
          check(act.status === 'scheduled', 'This activity is already cancelled.');
          check(act.by === a.id || isChair(db, a) || a.role === 'head' || a.role === 'vice', 'Only the person who added it, the Chairperson, Vice-Chairperson or School Head can cancel an activity.');
          act.reason = words(v.reason, 'Reason', 4, 200);
          act.status = 'cancelled';
          changed('Activity cancelled');
          break;
        }
      case 'minutesUpload':
        {
          check(holds(db, a, 'secretary'), 'The Secretary does this. The Chairperson may stand in while the Secretary is away.');
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
            // Uploaded by the Chairperson standing in, so it goes straight to the School Head.
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
      case 'minutesEdit':
        {
          const m = get(db.minutes, id);
          check(m.secretary === a.id || holds(db, a, 'secretary'), 'Only the Secretary who uploaded these minutes can correct them.');
          check(['for_chair', 'for_head'].includes(m.state), 'These minutes are already filed or withdrawn. Ask the School Head if a correction is still needed.');
          const date = dateValue(v.date);
          check(date <= today(), 'Meeting date cannot be in the future.');
          m.title = words(v.title, 'Meeting title', 3, 120);
          m.summary = words(v.summary, 'Community summary', 6, 700);
          m.date = date;
          m.due = plusDays(date, 7);
          m.corrected = at();
          if (m.state === 'for_head' && !m.covered) {
            // The Chairperson approved the earlier wording, so the corrected minutes go back for approval.
            m.state = 'for_chair';
            delete m.chair;
            delete m.chairAt;
          }
          changed('Minutes corrected');
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
          // The Treasurer and the Collecting and Disbursing Officer both record from a scanned original.
          // The officer's record goes to the Treasurer first, then to the Chairperson.
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
          // Actual costs can come in above the budget. An expense that goes over needs a reason, and the Chairperson sees it before posting.
          let over = 0;
          const overReason = String(v.overReason ?? '').trim();
          if (project && project.startsWith('AC-')) {
            const act = get(db.activities, project);
            check(direction === 'out' && act.status === 'scheduled', 'Choose an activity that is still on the calendar.');
            check(act.budget > 0, 'The Treasurer has not set aside a budget for this activity yet.');
            over = Math.max(0, cents - Math.max(0, act.budget - projectSpend(db, act.id)));
          } else if (project) {
            const p = get(db.projects, project);
            check(direction === 'out' && p.status !== 'cancelled', 'Choose an active expense project.');
            over = Math.max(0, cents - Math.max(0, p.budget - projectSpend(db, p.id)));
          }
          check(!over || overReason, 'This goes ' + peso(over) + ' over the budget. Explain why in “Why it is over budget”.');
          const overWhy = over ? words(overReason, 'Why it is over budget', 6, 300) : '';
          if (collecting) check(direction === 'in' && !project && !v.adjustment, 'The Collecting and Disbursing Officer records collections handed over to the Treasurer.');
          if (v.adjustment) {
            check(!project, 'Use the allocation on the original entry for a correction.');
            const orig = get(db.batches, v.adjustment);
            check(orig.status === 'posted' && orig.direction !== direction && orig.cents >= cents, 'Choose a posted entry with the opposite direction.');
            const booked = db.batches.filter(x => x.id !== id && x.adjustment === orig.id && !['returned', 'withdrawn'].includes(x.status)).reduce((sum, x) => sum + x.cents, 0);
            check(booked + cents <= orig.cents, 'Corrections exceed the original entry.');
          }
          // The Treasurer may record money that has no paper, such as a cash gift. She gives the reason and the Chairperson sees it before posting.
          const noPaper = v.noPaper === true;
          if (noPaper) check(!collecting && holds(db, a, 'treasurer'), 'Only the Treasurer can record an entry that has no paper original.');
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
            over,
            overWhy,
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
          changed(collecting ? 'Collection handover sent to the Treasurer' : 'Finance evidence submitted');
          break;
        }
      case 'financeCheck':
        {
          // Treasurer's approval of a Collecting and Disbursing Officer's handover, before the Chairperson's final approval.
          check(holds(db, a, 'treasurer'), 'The Treasurer does this. The Chairperson may stand in while the Treasurer is away.');
          const d = get(db.batches, id);
          check(d.status === 'for_treasurer' && d.owner !== a.id, 'This record is not waiting for the Treasurer.');
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
          check(d.status === 'pending' && mayPost(db, a, d), 'An independently submitted pending batch is required. The Vice-Chairperson gives the final approval on records the Chairperson sent or checked.');
          check(v.stamp === openStamp(d), 'This finance submission changed. Open its latest version before reviewing.');
          if (v.decision === 'return') {
            d.reason = words(v.reason, 'Reason for return', 4, 300);
            d.status = 'returned';
          } else {
            choice(v.decision, ['post'], 'decision');
            check(v.reviewed === true, d.noPaper ? 'Confirm that you read why there is no paper original.' : 'Open the supporting file and confirm your review.');
            check(v.publicSafe === true, 'Confirm the purpose is safe to publish.');
            if (d.direction === 'out' && d.project && d.project.startsWith('AC-')) {
              const act = get(db.activities, d.project);
              check(act.status === 'scheduled' && (d.overWhy || d.cents <= act.budget - projectSpend(db, act.id)), 'This now goes over the activity budget. Return it so the Treasurer can add the reason.');
            } else if (d.direction === 'out' && d.project) {
              const p = get(db.projects, d.project);
              check(p.status !== 'cancelled' && (d.overWhy || d.cents <= p.budget - projectSpend(db, p.id)), 'This now goes over the project budget. Return it so the Treasurer can add the reason.');
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
      case 'projectReceipt':
        {
          // A receipt for money already spent on a project: its photo or PDF, the amount on it, and its date.
          const p = get(db.projects, id);
          chairProject(p);
          const cents = amount(v.amount),
            date = pastDate(v.date),
            file = photo(v.file),
            note = String(v.note ?? '').trim(),
            purpose = note ? words(note, 'Note', 3, 140) : p.title + ' expenses',
            spent = projectSpend(db, p.id),
            over = Math.max(0, spent + cents - Math.max(spent, p.budget)),
            overReason = String(v.overReason ?? '').trim();
          check(!over || overReason, 'This takes the project ' + peso(spent + cents - p.budget) + ' over its allocation. Explain why in “Why it is over the allocation”.');
          postProjectEntry(p, 'out', cents, date, purpose, file, '', over, over ? words(overReason, 'Why it is over the allocation', 6, 300) : '');
          id = p.id;
          changed('Chairperson added a receipt to the project: ' + peso(cents));
          break;
        }
      case 'recordSpent':
        {
          // Correct the amount spent on a project. The difference is posted as an approved transaction.
          const p = get(db.projects, id);
          chairProject(p);
          const total = amount(v.spent, true),
            current = projectSpend(db, p.id),
            diff = total - current;
          check(diff !== 0, 'This is already the amount spent on this project.');
          const date = v.date ? pastDate(v.date) : today(),
            note = String(v.purpose ?? '').trim(),
            purpose = note ? words(note, 'What it was spent on', 3, 140) : 'Correction to the amount spent on ' + p.title,
            over = diff > 0 ? Math.max(0, total - Math.max(current, p.budget)) : 0,
            overReason = String(v.overReason ?? '').trim();
          check(!over || overReason, 'This goes ' + peso(total - p.budget) + ' over the project allocation. Explain why in “Why it is over the allocation”.');
          postProjectEntry(p, diff > 0 ? 'out' : 'in', Math.abs(diff), date, purpose, null, 'Correction to the amount spent, recorded by the Chairperson.', over, over ? words(overReason, 'Why it is over the allocation', 6, 300) : '');
          id = p.id;
          changed('Chairperson corrected the amount spent on the project: ' + peso(total) + ' (was ' + peso(current) + ')');
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
    resolutionHeading,
    longDate,
    nextResolutionNumber,
    roles,
    leaders,
    printers,
    minuteReaders,
    boardRoles,
    categories,
    labels,
    recipients,
    account,
    hiddenPerMonth,
    submissionsPerDay,
    submissionsPerWeek,
    photosPerCase,
    accountsPerDevice,
    voteDays,
    voteCloses,
    coverRoles,
    covering,
    holds,
    mayPost,
    expire,
    resetCheck,
    seenOn,
    deviceFull,
    PHONE_FULL,
    createLive,
    addSeats,
    setOpening,
    addPastProject,
    addCancelledProject,
    importVoted,
    planners,
    officerJoin,
    liveRoles,
    loginKey,
    eligible,
    publicProposal,
    readableProposal,
    canSeeCase,
    caseHandler,
    caseNoter,
    caseAsker,
    caseCoordinator,
    intakeRoles,
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
