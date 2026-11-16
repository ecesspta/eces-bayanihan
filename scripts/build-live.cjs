'use strict';
/* Builds the hosted app into live/. It is the same app, pointed at the Supabase function.
   Usage: node scripts/build-live.cjs https://<project>.supabase.co/functions/v1/eces [anon-public-key]
   Only connection.js carries the address, so it can be changed later without rebuilding. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'live');
const api = (process.argv[2] || process.env.ECES_API || '').replace(/\/$/, '');
const key = process.argv[3] || process.env.ECES_KEY || '';
if (api && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/[a-z0-9-]+$/.test(api)) throw Error('The address should look like https://<project>.supabase.co/functions/v1/eces');
fs.rmSync(out, {
  recursive: true,
  force: true
});
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
.note{background:#fff7dd;border:1px solid #e6c766;border-radius:8px;padding:10px;font-size:14px}</style></head><body>
<h1>ECES Bayanihan · Admin</h1>
<p class="note">For the SPTA chairperson or the person who runs the app. The admin key is typed here and sent only to your own server. Never share it or save it in a file.</p>
<label for="key">Admin key</label><input id="key" type="password" autocomplete="off">
<button id="setup">Set up rehearsal data</button><button id="backup" class="alt">Download backup</button>
<h2 style="font-size:18px;margin-top:28px">Start the real record</h2>
<p class="note">This replaces the fictional rehearsal with an empty school record and the officers below. It is refused once real data exists. One officer per line, as <b>role: Full Name</b>. Roles: head, chair, vice, secretary, treasurer, collector.</p>
<textarea id="officers" rows="6" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box" placeholder="chair: Full Name"></textarea>
<button id="start">Start real record</button>
<h2 style="font-size:18px;margin-top:28px">Add the HPTA presidents</h2>
<p class="note">One section per line, as <b>Grade · Section | President's name</b>, for example <b>Grade 1 · Ramos | Full Name</b>. For kindergarten write <b>Kindergarten · Biala A.M. | Full Name</b>. Running it again only adds sections that are missing.</p>
<textarea id="seats" rows="8" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box" placeholder="Grade 1 · Ramos | Full Name"></textarea>
<button id="addseats">Add presidents</button>
<h2 style="font-size:18px;margin-top:28px">Opening balance and finished project</h2>
<p class="note">Use the treasurer's paper. The balance is one figure on one date and can only be set before any money is recorded in the app. The finished project is shown as Completed, with no vote, no signatures and no SPTA money used. Fill in only what you need.</p>
<label for="obal">Balance (pesos)</label><input id="obal" inputmode="decimal" placeholder="12345.67"><label for="odate">Balance as of (date)</label><input id="odate" type="date">
<label for="ptitle">Finished project: title</label><input id="ptitle"><label for="ptext">What was done</label><textarea id="ptext" rows="3" style="width:100%;padding:10px;font-size:16px;border:1px solid #9aa9c4;border-radius:8px;box-sizing:border-box"></textarea>
<label for="psponsor">Paid for by</label><input id="psponsor"><label for="pdate">Completed on</label><input id="pdate" type="date">
<button id="opening">Save</button>
<h2 style="font-size:18px;margin-top:28px">New code for one officer</h2>
<p class="note">For a lost phone or forgotten sign-in, or to add the collecting officer later. Add the name only for a new officer.</p>
<label for="orole">Role</label><input id="orole" placeholder="collector"><label for="oname">Name (new officer only)</label><input id="oname">
<button id="reissue" class="alt">Make a new code</button>
<p id="msg"></p><pre id="out" hidden></pre>
<script>
var api=(document.querySelector('meta[name="eces-api"]')||{}).content||'';
var msg=document.getElementById('msg'),out=document.getElementById('out');
function say(t){msg.textContent=t}
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
document.getElementById('backup').onclick=function(){say('Working…');call('GET','/api/admin/export').then(function(d){save('eces-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d));say('Backup downloaded. Keep it somewhere private.')}).catch(function(e){if(e)say(e.message)})};
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
html = html.replace('<head>', '<head>\n    ' + cspTag + '\n    <script src="connection.js"></script>\n    <link rel="manifest" href="manifest.webmanifest" />\n    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />');
fs.writeFileSync(index, html);
console.log('live/ built' + (api ? ' for ' + api : ' (no server address yet: edit live/connection.js or rebuild with the address)'));
