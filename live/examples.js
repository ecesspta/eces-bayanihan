(function (root) {
  'use strict';
  const seed = {
    proposals: [
      {id:'EC-0019',title:'Additional shaded seating near Grade 1',category:'Facilities',description:'A covered waiting area would help younger pupils and their parents during dismissal and rainy days.',status:'under_review',author:'Demo Parent A',supports:38,mine:true,date:'2026-11-05'},
      {id:'EC-0020',title:'Weekend reading and storytelling corner',category:'Learning',description:'A parent-supported reading nook with donated storybooks and occasional storytelling sessions.',status:'recommended',author:'Demo Parent B',supports:32,mine:false,date:'2026-11-06'},
      {id:'EC-0021',title:'Improve handwashing supplies at the school',category:'Health & Safety',description:'Create a volunteer-supported replenishment plan for soap and basic hygiene supplies.',status:'approved',author:'Demo Parent C',supports:26,mine:false,date:'2026-11-07'},
      {id:'EC-0022',title:'School garden for hands-on science activities',category:'Environment',description:'A small vegetable and native plant garden that pupils can explore with teachers.',status:'in_progress',author:'Demo Parent D',supports:45,mine:false,date:'2026-11-08'},
      {id:'EC-0023',title:'Parent orientation on digital school services',category:'Community',description:'Hold a beginner-friendly orientation with printed guides in Filipino and English.',status:'received',author:'Demo Parent E',supports:19,mine:false,date:'2026-11-09'},
      {id:'EC-0024',title:'More visible school safety signages',category:'Health & Safety',description:'Add simple, child-friendly direction and emergency reminder signs where needed.',status:'received',author:'Demo Parent F',supports:22,mine:false,date:'2026-11-10'}
    ],
    concerns: [
      {id:'CC-011',category:'Facilities',subject:'Leaking tap in a wash area',description:'Sample maintenance concern submitted for routing to the authorized school office.',status:'received',date:'2026-11-10',owner:'Demo Parent'},
      {id:'CC-012',category:'Communication',subject:'Clarify dismissal schedule announcement',description:'Sample question about a school-wide scheduling announcement.',status:'under_review',date:'2026-11-09',owner:'Demo Parent'},
      {id:'CC-013',category:'Facilities',subject:'Broken light near a covered corridor',description:'Sample safety and maintenance observation.',status:'under_review',date:'2026-11-08',owner:'Other Demo Parent'},
      {id:'CC-014',category:'Health & Safety',subject:'Water puddling after a heavy rain',description:'Sample report of a slippery area requiring attention.',status:'completed',date:'2026-11-05',owner:'Other Demo Parent'}
    ],
    projects: [
      {id:'PR-01',name:'Community Reading Corner',description:'An SPTA-supported learning space with books and accessible reading materials.',budget:24000,progress:68,status:'in_progress',icon:'book',phase:'Materials preparation'},
      {id:'PR-02',name:'Handwashing Station Refresh',description:'School-approved improvements to common handwashing spaces.',budget:18600,progress:100,status:'completed',icon:'droplets',phase:'Completed'},
      {id:'PR-03',name:'Learning Garden Pilot',description:'A small practical learning garden supported by volunteer families.',budget:12000,progress:30,status:'in_progress',icon:'sprout',phase:'Volunteer setup'},
      {id:'PR-04',name:'Weekend School Mural Day',description:'A sample student-and-parent mural activity for an unused school wall.',budget:5000,progress:0,status:'cancelled',icon:'sprout',phase:'Cancelled',cancelReason:'The proposed wall needs repair first. No materials were purchased, and the illustrative budget remains unspent.'}
    ],
    activities: [
      {text:'Safety signage proposal received',detail:'EC-0024 · Automated acknowledgement sent',date:'Today',icon:'lightbulb'},
      {text:'Reading corner proposal recommended',detail:'EC-0020 · Ready for School-Head review',date:'Yesterday',icon:'check-circle'},
      {text:'Sample facilities concern routed',detail:'CC-013 · Private · School office',date:'2 days ago',icon:'shield'},
      {text:'Learning garden progress updated',detail:'PR-03 · Volunteer setup',date:'3 days ago',icon:'sprout'}
    ],
    notifications: [
      {text:'Your proposal EC-0019 is now under review.',time:'2 days ago',icon:'lightbulb'},
      {text:'Thank you for participating in ECES Bayanihan.',time:'3 days ago',icon:'bell'}
    ],
    supported: [],
    boardVotes: {'EC-0020': {tally:{approve:22,reject:4,abstain:2},participated:['exec-1','exec-2','exec-3','exec-4',...Array.from({length:24},(_,i)=>'bod-'+(i+1))]}},
    boardClosures: {},
    resolutions: {},
    ledger: [{id:'EX-001',projectId:'PR-01',description:'Sample storybooks and reading materials',amount:4200,date:'2026-11-07',source:'Illustrative verified entry',reviewer:'Demo Treasurer'}],
    collections:[{id:'COL-001',description:'Illustrative SPTA collections',amount:40000,date:'2026-11-07',reviewer:'Demo Chairperson'}],
    financialDrafts:[{id:'FIN-001',type:'collection',projectId:'GENERAL',items:[{description:'Sample collection log for November',amount:5000}],total:5000,status:'pending',filename:'sample-paper-list.jpg',created:'Demo record',submittedBy:'Demo Treasurer'}],
    rules: {ack:true,routing:true,status:true,reminders:true,digest:true},
    next:25
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = seed;
  else root.ECESExamples = seed;
})(globalThis);
