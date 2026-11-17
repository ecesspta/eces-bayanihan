
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
document.getElementById('opening').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()},body={};
 if(g('obal')){body.amount=g('obal').replace(/[,₱\s]/g,'');body.date=g('odate');if(!body.date){say('Choose the date of the balance.');return}}
 if(g('ptitle')||g('ptext')||g('psponsor')||g('pdate')){body.project={title:g('ptitle'),text:g('ptext'),sponsor:g('psponsor'),date:g('pdate')}}
 if(!body.amount&&!body.project){say('Fill in the balance or the finished project.');return}
 say('Working…');call('POST','/api/admin/opening',body).then(function(){say('Saved.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('cancelled').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()},m=function(i){return g(i).replace(/[,₱\s]/g,'')};
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
 return rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\n')}
document.getElementById('people').onclick=function(){say('Working…');call('GET','/api/admin/users').then(function(d){allPeople=d.people;var c=d.count,w=d.people.filter(function(p){return p.waiting}).length;
 document.getElementById('peoplesum').textContent=d.total+' accounts · '+(c.active||0)+' can sign in · '+(c.invited||0)+' invited, not joined · '+(c.vacant||0)+' vacant HPTA seats · '+w+' waiting for approval'+(c.deactivated?' · '+c.deactivated+' deactivated':'')+(c.sample?' · '+c.sample+' sample profiles':'');
 document.getElementById('peoplebox').hidden=false;drawPeople();say('Done.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('pfind').oninput=drawPeople;document.getElementById('pstatus').onchange=drawPeople;
document.getElementById('peoplecsv').onclick=function(){if(!allPeople.length){say('Press Show all users first.');return}save('eces-users-'+new Date().toISOString().slice(0,10)+'.csv',csv());say('List downloaded. It holds personal details, so keep it private.')};
document.getElementById('voted').onclick=function(){var g=function(i){return document.getElementById(i).value.trim()};
 var body={title:g('vtitle'),text:g('vtext'),budget:g('vbudget').replace(/[,₱\s]/g,''),date:g('vdate'),meeting:g('vmeeting'),officers:g('voff'),yes:g('vyes'),no:g('vno')||'0',abstain:g('vabs')||'0',approved:g('vappr'),number:g('vnum')};
 if(!body.title||!body.text||!body.budget||!body.date||!body.officers||!body.yes||!body.approved){say('Fill in the title, description, amount, vote date, officers, yes votes and approval date.');return}
 say('Working…');call('POST','/api/admin/voted-project',body).then(function(d){say('Done. '+d.id+' is a draft resolution waiting for the secretary.')}).catch(function(e){if(e)say(e.message)})};
document.getElementById('backup').onclick=function(){say('Working…');call('GET','/api/admin/export').then(function(d){save('eces-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d));say('Backup downloaded. Keep it somewhere private.')}).catch(function(e){if(e)say(e.message)})};
