'use strict';
/* Builds the hosted app at the top level of the site (the main address). It is the same app, pointed at the Supabase function.
   The fictional practice version lives separately in demo/ and is never touched by this build.
   Usage: node scripts/build-live.cjs https://<project>.supabase.co/functions/v1/eces [anon-public-key]
   Only connection.js carries the address, so it can be changed later without rebuilding. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = root;
const api = (process.argv[2] || process.env.ECES_API || '').replace(/\/$/, '');
const key = process.argv[3] || process.env.ECES_KEY || '';
if (api && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/[a-z0-9-]+$/.test(api)) throw Error('The address should look like https://<project>.supabase.co/functions/v1/eces');
// Replace only the files this build makes. Never touch the practice version, the server code or the git folder.
const keep = new Set(['.git', 'demo', 'officers-demo', 'supabase', 'scripts', 'backend', 'loading-preview.html', 'dist', 'phone', 'node_modules']);
const made = new Set([...fs.readdirSync(path.join(root, 'dist')), 'icons', 'manifest.webmanifest', 'connection.js', 'admin.html', 'admin.js', 'index.html', 'sw.js']);
for (const name of made) {
  if (keep.has(name)) throw Error('The build would overwrite ' + name + ', which must be kept. Stopping.');
  fs.rmSync(path.join(out, name), {
    recursive: true,
    force: true
  });
}
fs.cpSync(path.join(root, 'dist'), out, {
  recursive: true
});
fs.mkdirSync(path.join(out, 'icons'), {
  recursive: true
});
for (const f of fs.readdirSync(path.join(root, 'phone/icons'))) fs.copyFileSync(path.join(root, 'phone/icons', f), path.join(out, 'icons', f));
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'ECES Bayanihan',
  short_name: 'ECES Bayanihan',
  description: 'An East Central Elementary SPTA Initiative.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f6f8fc',
  theme_color: '#102b59',
  icons: [{
    src: 'icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png'
  }, {
    src: 'icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png'
  }, {
    src: 'icons/icon-maskable-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable'
  }]
}, null, 2));
fs.writeFileSync(path.join(out, 'connection.js'), `/* Where this app finds its server. The key is the public "anon" key, which is safe to publish. */
(function () {
  // Refuse to be shown inside another website's frame.
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location; } catch (e) {}
  }
  var c = ${JSON.stringify({ api, key }, null, 2)};
  [['eces-api', c.api], ['eces-key', c.key]].forEach(function (p) {
    if (!p[1]) return;
    var m = document.createElement('meta');
    m.name = p[0];
    m.content = p[1];
    document.head.appendChild(m);
  });
})();
`);

fs.writeFileSync(path.join(out, 'admin.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>ECES Bayanihan · Admin</title>
<script src="connection.js"></script>
<style>body{font:16px system-ui,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#102b59;background:#f6f8fc}
h1{font-size:22px}label{display:block;margin:14px 0 4px;font-weight:600}input{width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box}
button{margin:10px 8px 0 0;padding:11px 16px;font-size:16px;border:0;border-radius:8px;background:#102b59;color:#fff}
button.alt{background:#fff;color:#102b59;border:1px solid #102b59}pre{white-space:pre-wrap;word-break:break-all;background:#fff;border:1px solid #cdd6e6;border-radius:8px;padding:10px;font-size:13px}
.note{background:#fff7dd;border:1px solid #e6c766;border-radius:8px;padding:10px;font-size:14px}
#bar{position:sticky;top:0;z-index:5;background:#f6f8fc;padding:4px 0}
#msg{margin:0;padding:10px 12px;border-radius:8px;font-weight:600;font-size:15px;border:1px solid #9aa9c4;background:#fff}#msg:empty{display:none}
#msg.ok{background:#e6f5ec;border-color:#2e9b5f;color:#0b5a30}#msg.err{background:#fde9e9;border-color:#d04a4a;color:#8a1c1c}#msg.busy{background:#eef2fa}
#bar pre{max-height:38vh;overflow:auto;margin:6px 0 0}
details.sec{scroll-margin-top:70px;background:#fff;border:1px solid #cdd6e6;border-radius:10px;margin-top:10px}
details.sec>summary{cursor:pointer;padding:14px;font-size:17px;font-weight:700;list-style:none;display:flex;justify-content:space-between;align-items:center}
details.sec>summary::-webkit-details-marker{display:none}
details.sec>summary::after{content:"+";font-size:22px;line-height:1}details.sec[open]>summary::after{content:"\\2212"}
.secbody{padding:0 14px 14px}.secbody>.note:first-child{margin-top:0}
.top{background:#fff;border:1px solid #cdd6e6;border-radius:10px;padding:0 14px 14px;margin-top:10px}</style></head><body>
<h1>ECES Bayanihan · Admin</h1>
<div id="bar"><p id="msg" role="status" aria-live="polite"></p><pre id="out" hidden></pre></div>
<div class="top"><p class="note" style="margin-bottom:0">For the SPTA chairperson or the person who runs the app. The admin key is typed here and sent only to your own server. Never share it or save it in a file.</p>
<label for="key">Admin key</label><input id="key" type="password" autocomplete="off">
<button id="setup">Set up rehearsal data</button><button id="backup" class="alt">Download record (not a full backup)</button></div>
<details class="sec"><summary>Start the real record</summary><div class="secbody">
<p class="note">This replaces the fictional rehearsal with an empty school record and the officers below. It is refused once real data exists. One officer per line, as <b>role: Full Name</b>. Roles: head, chair, vice, secretary, treasurer, collector.</p>
<textarea id="officers" rows="6" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box" placeholder="chair: Full Name"></textarea>
<button id="start">Start real record</button>
</div></details>
<details class="sec"><summary>Add the HPTA presidents</summary><div class="secbody">
<p class="note">One section per line, as <b>Grade · Section | President's name</b>, for example <b>Grade 1 · Ramos | Full Name</b>. For kindergarten write <b>Kindergarten · Biala A.M. | Full Name</b>. Running it again only adds sections that are missing.</p>
<textarea id="seats" rows="8" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box" placeholder="Grade 1 · Ramos | Full Name"></textarea>
<button id="addseats">Add presidents</button>
</div></details>
<details class="sec"><summary>Opening balance and finished project</summary><div class="secbody">
<p class="note">Use the treasurer's paper. The balance is one figure on one date and can only be set before any money is recorded in the app. The finished project is shown as Completed, with no vote, no signatures and no SPTA money used. Fill in only what you need.</p>
<label for="obal">Balance (pesos)</label><input id="obal" inputmode="decimal" placeholder="12345.67"><label for="odate">Balance as of (date)</label><input id="odate" type="date">
<label for="ptitle">Finished project: title</label><input id="ptitle"><label for="ptext">What was done</label><textarea id="ptext" rows="3" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box"></textarea>
<label for="psponsor">Paid for by</label><input id="psponsor"><label for="pdate">Completed on</label><input id="pdate" type="date">
<button id="opening">Save</button>
</div></details>
<details class="sec"><summary>Project cancelled before the app</summary><div class="secbody">
<p class="note">For a project that was cancelled earlier, so parents can see it for transparency. It shows under Cancelled with the reason and what became of the money. It has no vote and no signatures, and it does not change the SPTA balance. Add one project at a time.</p>
<label for="ctitle">Project title</label><input id="ctitle"><label for="ctext">What the project was going to be</label><textarea id="ctext" rows="3" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box"></textarea>
<label for="creason">Why it was cancelled (shown to parents)</label><textarea id="creason" rows="3" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box"></textarea>
<label for="cbudget">Amount that had been set aside (pesos, leave empty if none)</label><input id="cbudget" inputmode="decimal" placeholder="0">
<label for="cspent">Amount already spent (pesos, leave empty if none)</label><input id="cspent" inputmode="decimal" placeholder="0">
<label for="cremainder">What happened to the money?</label><textarea id="cremainder" rows="2" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box" placeholder="Example: No money was spent. The funds stay in the general SPTA fund."></textarea>
<label for="cdate">Cancelled on</label><input id="cdate" type="date">
<button id="cancelled">Add cancelled project</button>
</div></details>
<details class="sec"><summary>New code for one officer</summary><div class="secbody">
<p class="note">For a lost phone or forgotten sign-in, or to add the collecting officer later. Add the name only for a new officer.</p>
<label for="orole">Role</label><input id="orole" placeholder="collector"><label for="oname">Name (new officer only)</label><input id="oname">
<button id="reissue" class="alt">Make a new code</button>
</div></details>
<details class="sec"><summary>Project already voted on</summary><div class="secbody">
<p class="note">For a project the officers already voted on and the School Head already approved on paper. It goes straight to a draft resolution, so the secretary can release it and the officers can sign in the app. The vote needs at least 51% yes. Add one project at a time.</p>
<label for="vtitle">Project title</label><input id="vtitle"><label for="vtext">What the project is</label><textarea id="vtext" rows="3" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box"></textarea>
<label for="vbudget">Amount voted (pesos)</label><input id="vbudget" inputmode="decimal" placeholder="12000">
<label for="vdate">Date of the vote</label><input id="vdate" type="date"><label for="vmeeting">Meeting (optional)</label><input id="vmeeting" placeholder="SPTA meeting">
<label for="voff">Officers on the roster</label><input id="voff" inputmode="numeric"><label for="vyes">Yes</label><input id="vyes" inputmode="numeric"><label for="vno">No</label><input id="vno" inputmode="numeric"><label for="vabs">Abstain</label><input id="vabs" inputmode="numeric">
<label for="vappr">Date the School Head approved</label><input id="vappr" type="date"><label for="vnum">Resolution number (optional, for example 3)</label><input id="vnum" inputmode="numeric">
<button id="voted">Add voted project</button>
</div></details>
<details class="sec"><summary>Who is on the app</summary><div class="secbody">
<p class="note">Everyone with an account, and whether they can sign in. It shows no passwords, invite codes or private messages. Mobile numbers are partly hidden.</p>
<button id="people">Show all users</button><button id="peoplecsv" class="alt">Download list</button>
<div id="peoplebox" hidden><div id="peoplesum" class="sum"></div>
<label for="pfind">Find a name, grade or role</label><input id="pfind" placeholder="Type to filter">
<label for="pstatus">Show</label><select id="pstatus" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px"><option value="">Everyone</option><option value="active">Can sign in</option><option value="invited">Invited, not joined yet</option><option value="vacant">Vacant HPTA seats</option><option value="waiting">Waiting for approval as an officer</option><option value="deactivated">Deactivated</option></select>
<div id="peoplelist"></div></div>
</div></details>

<script>
var api=(document.querySelector('meta[name="eces-api"]')||{}).content||'';
var msg=document.getElementById('msg'),out=document.getElementById('out');
function say(t){msg.textContent=t;msg.className=/^Working/.test(t)?'busy':/^(Done|Saved|Backup downloaded|List downloaded)/.test(t)?'ok':'err'}
var secs=document.querySelectorAll('details.sec');secs.forEach(function(d){d.addEventListener('toggle',function(){if(d.open){secs.forEach(function(o){if(o!==d)o.open=false});setTimeout(function(){d.scrollIntoView({block:'start',behavior:'smooth'})},50)}})});
function call(method,route,body){if(!api){say('No server address yet. connection.js is empty.');return Promise.reject()}
 return fetch(api+route,{method:method,headers:{'x-admin-key':document.getElementById('key').value.trim(),'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body||{}):undefined}).then(function(r){return r.json().then(function(d){if(!r.ok)throw Error(d.error||'Failed');return d})})}
function save(name,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=name;a.click()}
document.getElementById('setup').onclick=function(){say('Working…');call('POST','/api/admin/setup').then(function(d){
 var t=d.note+'\\n'+d.credentials.map(function(c){return c[0]+'  '+c[1]}).join('\\n');out.hidden=false;out.textContent=t;say('Done. Save the sign-ins now. They are shown only once.');save('eces-sample-signins.txt',t)}).catch(function(e){if(e)say(e.message)})};
function codes(d){var t=d.note+'\\n'+d.codes.map(function(c){return c[0]+'  '+c[1]}).join('\\n');out.hidden=false;out.textContent=t;save('eces-officer-invites.txt',t);say('Done. Give each officer only their own code. They are shown once.')}
document.getElementById('start').onclick=function(){var list=document.getElementById('officers').value.split('\\n').map(function(l){return l.trim()}).filter(Boolean).map(function(l){var i=l.indexOf(':');return{role:l.slice(0,i).trim().toLowerCase(),name:l.slice(i+1).trim()}});
 if(!list.length||list.some(function(o){return !o.role||!o.name})){say('Write one officer per line as role: Full Name.');return}
 if(!confirm('Replace the fictional rehearsal with the real record? This cannot be undone.'))return;say('Working…');call('POST','/api/admin/start-live',{officers:list}).then(codes).catch(function(e){if(e)say(e.message)})};
document.getElementById('reissue').onclick=function(){say('Working…');call('POST','/api/admin/officer',{role:document.getElementById('orole').value.trim().toLowerCase(),name:document.getElementById('oname').value.trim()}).then(function(d){var t=d.role+'  '+d.code;out.hidden=false;out.textContent=t;say('Done. Give this code only to that officer. It is shown once.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('addseats').onclick=function(){var seats=document.getElementById('seats').value.split('\\n').map(function(l){return l.trim()}).filter(Boolean).map(function(l){var i=l.lastIndexOf('|');return{homeroom:l.slice(0,i).trim(),name:l.slice(i+1).trim()}});
 if(!seats.length||seats.some(function(o){return !o.homeroom||!o.name})){say('Write one section per line as Grade · Section | Name.');return}
 say('Working…');call('POST','/api/admin/seats',{seats:seats}).then(function(d){say('Done. '+d.added+' seat'+(d.added===1?'':'s')+' added.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('opening').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()},body={};
 if(g('obal')){body.amount=g('obal').replace(/[,₱\\s]/g,'');body.date=g('odate');if(!body.date){say('Choose the date of the balance.');return}}
 if(g('ptitle')||g('ptext')||g('psponsor')||g('pdate')){body.project={title:g('ptitle'),text:g('ptext'),sponsor:g('psponsor'),date:g('pdate')}}
 if(!body.amount&&!body.project){say('Fill in the balance or the finished project.');return}
 say('Working…');call('POST','/api/admin/opening',body).then(function(){say('Saved.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('cancelled').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()},m=function(i){return g(i).replace(/[,₱\\s]/g,'')};
 say('Working…');call('POST','/api/admin/cancelled-project',{title:g('ctitle'),text:g('ctext'),reason:g('creason'),remainder:g('cremainder'),budget:m('cbudget'),spent:m('cspent'),date:g('cdate')}).then(function(){say('Saved. It now shows under Cancelled on the Projects page.')}).catch(function(e){if(e)say(e.message)})};
var allPeople=[];
var LABEL={active:'Can sign in',invited:'Invited, not joined yet',vacant:'Vacant seat',deactivated:'Deactivated',sample:'Sample profile',no_access:'No sign-in'};
var ROLE={parent:'Parent',head:'School Head',chair:'Chairperson',vice:'Vice-Chairperson',secretary:'Secretary',treasurer:'Treasurer',collector:'Collecting officer',bod:'HPTA president'};
function day(t){return t?String(t).slice(0,10):'-'}
function drawPeople(){var q=document.getElementById('pfind').value.trim().toLowerCase(),f=document.getElementById('pstatus').value,box=document.getElementById('peoplelist');box.textContent='';
 var list=allPeople.filter(function(p){if(f==='waiting'&&!p.waiting)return false;if(f&&f!=='waiting'&&p.status!==f)return false;return !q||(p.name+' '+p.seat+' '+(ROLE[p.role]||p.role)).toLowerCase().indexOf(q)>=0});
 if(!list.length){box.textContent='No one matches.';return}
 list.forEach(function(p){var d=document.createElement('div');d.style.cssText='background:#fff;border:1px solid #cdd6e6;border-radius:8px;padding:9px 11px;margin-top:8px;font-size:14px';
  var h=document.createElement('b');h.textContent=p.name;d.appendChild(h);
  var l1=document.createElement('div');l1.textContent=(ROLE[p.role]||p.role)+(p.seat?' · '+p.seat:'')+(p.mobile?' · '+p.mobile:'');d.appendChild(l1);
  var l2=document.createElement('div');l2.style.color=p.status==='active'?'#0b6b3a':p.status==='invited'||p.waiting?'#8a5a00':'#555';l2.textContent=(LABEL[p.status]||p.status)+(p.waiting?' · Waiting for officer approval':'')+' · Signed up '+day(p.joined)+' · Last sign-in '+day(p.last)+(p.phones?' · '+p.phones+' phone'+(p.phones===1?'':'s'):'');d.appendChild(l2);box.appendChild(d)})}
function csv(){var rows=[['Name','Role','Grade and section','Mobile','Status','Waiting for officer approval','Signed up','Last sign-in','Phones']].concat(allPeople.map(function(p){return [p.name,ROLE[p.role]||p.role,p.seat,p.mobile,LABEL[p.status]||p.status,p.waiting?'yes':'',day(p.joined),day(p.last),p.phones]}));
 return rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\\n')}
document.getElementById('people').onclick=function(){say('Working…');call('GET','/api/admin/users').then(function(d){allPeople=d.people;var c=d.count,w=d.people.filter(function(p){return p.waiting}).length;
 document.getElementById('peoplesum').textContent=d.total+' accounts · '+(c.active||0)+' can sign in · '+(c.invited||0)+' invited, not joined · '+(c.vacant||0)+' vacant HPTA seats · '+w+' waiting for approval'+(c.deactivated?' · '+c.deactivated+' deactivated':'')+(c.sample?' · '+c.sample+' sample profiles':'');
 document.getElementById('peoplebox').hidden=false;drawPeople();say('Done.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('pfind').oninput=drawPeople;document.getElementById('pstatus').onchange=drawPeople;
document.getElementById('peoplecsv').onclick=function(){if(!allPeople.length){say('Press Show all users first.');return}save('eces-users-'+new Date().toISOString().slice(0,10)+'.csv',csv());say('List downloaded. It holds personal details, so keep it private.')};
document.getElementById('voted').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()};
 var body={title:g('vtitle'),text:g('vtext'),budget:g('vbudget').replace(/[,₱\\s]/g,''),date:g('vdate'),meeting:g('vmeeting'),officers:g('voff'),yes:g('vyes'),no:g('vno')||'0',abstain:g('vabs')||'0',approved:g('vappr'),number:g('vnum')};
 if(!body.title||!body.text||!body.budget||!body.date||!body.officers||!body.yes||!body.approved){say('Fill in the title, description, amount, vote date, officers, yes votes and approval date.');return}
 say('Working…');call('POST','/api/admin/voted-project',body).then(function(d){say('Done. '+d.id+' is a draft resolution waiting for the secretary.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('backup').onclick=function(){say('Working…');call('GET','/api/admin/export').then(function(d){save('eces-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d));say('Backup downloaded. This is the main record only, without attachments. For a full backup see supabase/BACKUP.md. Keep it somewhere private.')}).catch(function(e){if(e)say(e.message)})};
</script></body></html>`);


// A strict content policy: only this site's own scripts run, and the app may talk only to its own server.
const connect = process.env.ECES_CSP_CONNECT || (api ? new URL(api).origin : '');
const csp = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "object-src blob:", "connect-src 'self' " + connect, "base-uri 'none'", "form-action 'none'"].join('; ');
const cspTag = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">';
{
  const adminFile = path.join(out, 'admin.html');
  let a = fs.readFileSync(adminFile, 'utf8');
  const m = /<script>([\s\S]*?)<\/script>\s*<\/body>/.exec(a);
  fs.writeFileSync(path.join(out, 'admin.js'), m[1]);
  a = a.replace(m[0], '<script src="admin.js"></script></body>').replace('<head>', '<head>' + cspTag);
  fs.writeFileSync(adminFile, a);
}
const index = path.join(out, 'index.html');
let html = fs.readFileSync(index, 'utf8');
html = html.replace('<head>', '<head>\n    ' + cspTag + (api ? '\n    <meta name="eces-mode" content="shared" />' : '') + '\n    <script src="connection.js"></script>\n    <link rel="manifest" href="manifest.webmanifest" />\n    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />');
html = html.replace('</head>', '  <script src="sw-register.js" defer></script>\n  </head>');
fs.writeFileSync(index, html);
// Offline shell. After the first visit the app's own pages and pictures open without a connection, so a parent with no signal
// sees a calm "you are offline" screen instead of the browser's error page. The server is never cached: no private record is stored here.
{
  const files = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files.push(path.relative(out, full).split(path.sep).join('/'));
    }
  };
  walk(out);
  const shell = files.filter(f => !/^admin\.(html|js)$/.test(f) && f !== 'sw.js' && !/\.pdf$/.test(f));
  const version = require('node:crypto').createHash('sha256').update(shell.map(f => f + fs.readFileSync(path.join(out, f)).length).join('|') + fs.readFileSync(path.join(out, 'app.js'))).digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(out, 'sw.js'), `const CACHE = 'eces-live-${version}';
const SHELL = ${JSON.stringify(['./'].concat(shell.filter(f => f !== 'index.html')))};
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || /\\/admin\\.(html|js)$/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : undefined) || Response.error())));
});
`);
  fs.writeFileSync(path.join(out, 'sw-register.js'), `if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {});\n`);
}
console.log('site built' + (api ? ' for ' + api : ' (no server address yet: edit connection.js or rebuild with the address)'));
