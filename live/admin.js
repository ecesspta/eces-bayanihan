
var api=(document.querySelector('meta[name="eces-api"]')||{}).content||'';
var msg=document.getElementById('msg'),out=document.getElementById('out');
function say(t){msg.textContent=t}
function call(method,route,body){if(!api){say('No server address yet. connection.js is empty.');return Promise.reject()}
 return fetch(api+route,{method:method,headers:{'x-admin-key':document.getElementById('key').value.trim(),'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body||{}):undefined}).then(function(r){return r.json().then(function(d){if(!r.ok)throw Error(d.error||'Failed');return d})})}
function save(name,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=name;a.click()}
document.getElementById('setup').onclick=function(){say('Working…');call('POST','/api/admin/setup').then(function(d){
 var t=d.note+'\n'+d.credentials.map(function(c){return c[0]+'  '+c[1]}).join('\n');out.hidden=false;out.textContent=t;say('Done. Save the sign-ins now. They are shown only once.');save('eces-sample-signins.txt',t)}).catch(function(e){if(e)say(e.message)})};
function codes(d){var t=d.note+'\n'+d.codes.map(function(c){return c[0]+'  '+c[1]}).join('\n');out.hidden=false;out.textContent=t;save('eces-officer-invites.txt',t);say('Done. Give each officer only their own code. They are shown once.')}
document.getElementById('start').onclick=function(){var list=document.getElementById('officers').value.split('\n').map(function(l){return l.trim()}).filter(Boolean).map(function(l){var i=l.indexOf(':');return{role:l.slice(0,i).trim().toLowerCase(),name:l.slice(i+1).trim()}});
 if(!list.length||list.some(function(o){return !o.role||!o.name})){say('Write one officer per line as role: Full Name.');return}
 if(!confirm('Replace the fictional rehearsal with the real record? This cannot be undone.'))return;say('Working…');call('POST','/api/admin/start-live',{officers:list}).then(codes).catch(function(e){if(e)say(e.message)})};
document.getElementById('reissue').onclick=function(){say('Working…');call('POST','/api/admin/officer',{role:document.getElementById('orole').value.trim().toLowerCase(),name:document.getElementById('oname').value.trim()}).then(function(d){var t=d.role+'  '+d.code;out.hidden=false;out.textContent=t;say('Done. Give this code only to that officer. It is shown once.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('addseats').onclick=function(){var seats=document.getElementById('seats').value.split('\n').map(function(l){return l.trim()}).filter(Boolean).map(function(l){var i=l.lastIndexOf('|');return{homeroom:l.slice(0,i).trim(),name:l.slice(i+1).trim()}});
 if(!seats.length||seats.some(function(o){return !o.homeroom||!o.name})){say('Write one section per line as Grade · Section | Name.');return}
 say('Working…');call('POST','/api/admin/seats',{seats:seats}).then(function(d){say('Done. '+d.added+' seat'+(d.added===1?'':'s')+' added.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('backup').onclick=function(){say('Working…');call('GET','/api/admin/export').then(function(d){save('eces-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d));say('Backup downloaded. Keep it somewhere private.')}).catch(function(e){if(e)say(e.message)})};
