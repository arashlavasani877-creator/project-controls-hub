const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=__dirname,js=fs.readFileSync(root+'/app.js','utf8'),html=fs.readFileSync(root+'/index.html','utf8'),rules=fs.readFileSync(root+'/firestore.rules','utf8');
const pick=(a,b)=>{const x=js.indexOf(a);assert(x>=0,'missing '+a);const y=js.indexOf(b,x+a.length);assert(y>x,'missing end '+b);return js.slice(x,y)};
assert(!js.includes('templateChooser')&&!js.includes('import-task-library')&&!js.includes('templateEntries'));
assert(!js.includes('data-nav="mine"'));
assert(html.includes('v22-duty-directory-dashboard'));
assert(rules.includes('match /tasks/{id}'));
const duties=pick('const ROLE_DUTIES=','const permLabels=');
const ctx={};vm.createContext(ctx);vm.runInContext(duties+'\nthis.duties=ROLE_DUTIES;',ctx);
assert.equal(ctx.duties.supervisor.reduce((a,b)=>a+b[1].length,0),24);
assert.equal(ctx.duties.expert.reduce((a,b)=>a+b[1].length,0),23);
const common={heading:(a,b='')=>`<h1>${a}</h1>${b}`,esc:x=>String(x),num:x=>String(x),icon:x=>x,B:(a,b)=>`[${a}:${b}]`,pill:(x)=>String(x),stat:(a,b)=>`[${a}:${b}]`,empty:(a,b)=>`${a} ${b||''}`,jstr:x=>x,calendarDiff:(a,b)=>Math.round((new Date(b)-new Date(a))/86400000),isoToday:()=> '2026-11-24',statuses:{todo:'شروع نشده',doing:'در حال انجام',blocked:'متوقف',review:'در انتظار',done:'خاتمه یافته'},statusColor:{doing:'blue',done:'green'},priorities:{normal:'عادی'},projectName:x=>x==='p1'?'راسپینا':'بدون پروژه',actorName:x=>x==='staff1'?'کارشناس نمونه':'مالک سیستم',taskSummary:x=>x.title,taskStatus:x=>x.status,donut:()=>'donut',pct:(a,b)=>b?Math.round(100*a/b):0,U:{preview:null,dutyRole:'supervisor',showAllOverdue:false,taskView:'team',filterProject:'all',filterStatus:'all',filterText:''},isAdmin:()=>true,isSystemOwner:()=>true,APP:{user:{uid:'owner'},remotePaths:{},pendingWrites:0},D:{users:[],projects:[{id:'p1',name:'راسپینا'}],recurrences:[],deletionRequests:[],evaluations:[],events:[],tasks:[{id:'a',title:'وظیفه عقب افتاده',visibility:'team',assignee:'staff1',projectId:'p1',due:'2026-11-20',status:'doing',updatedAt:'2026-11-22'}, {id:'b',title:'وظیفه تمام شده',visibility:'team',assignee:'staff1',projectId:'p1',due:'2026-11-10',status:'done',updatedAt:'2026-11-23'},{id:'c',title:'کار خصوصی',visibility:'owner_private',assignee:'owner',due:'2026-11-22',status:'todo',updatedAt:'2026-11-23'}]}};
const ui=vm.createContext({...common,
 teamTasks(){return this.D.tasks.filter(x=>x.visibility==='team')},
 myManagerTasks(){return this.D.tasks.filter(x=>x.visibility==='owner_private')},
 dueLate:t=>t.status!=='done'&&t.due<'2026-11-24',
 countStatuses:tasks=>({todo:tasks.filter(t=>t.status==='todo').length,doing:tasks.filter(t=>t.status==='doing').length,blocked:tasks.filter(t=>t.status==='blocked').length,review:tasks.filter(t=>t.status==='review').length,done:tasks.filter(t=>t.status==='done').length})});
// Functions defined in VM resolve global identifiers; ensure mock functions do not depend on JS 'this'.
ui.teamTasks=()=>ui.D.tasks.filter(x=>x.visibility==='team');
ui.myManagerTasks=()=>ui.D.tasks.filter(x=>x.visibility==='owner_private');
vm.runInContext(duties+pick('function dutiesPage(){','function renderAdmin(){')+pick('function dashboardPage(){','function donut(')+'\nthis.runDuties=dutiesPage;this.runDashboard=dashboardPage',ui);
let out=ui.runDuties();assert(out.includes('وظایف سرپرست کنترل پروژه'));assert(out.includes('کنترل صحت، انسجام'));
ui.U.dutyRole='expert';out=ui.runDuties();assert(out.includes('تهیه Action Plan'));
ui.U.preview='supervisor';ui.isAdmin=()=>false;out=ui.runDuties();assert(out.includes('وظایف سرپرست کنترل پروژه')&&!out.includes('data-action="duty-show-expert"'));
ui.U.preview='expert';out=ui.runDuties();assert(out.includes('وظایف کارشناس کنترل پروژه'));
ui.U.preview=null;ui.isAdmin=()=>true;
out=ui.runDashboard();fs.writeFileSync(root+'/preview-v22-dashboard.html',`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${html.split('<style>')[1].split('</style>')[0]}</style></head><body><div class="shell"><main class="content">${out}</main></div></body></html>`);for(const title of ['وظایف کارکنان','در انتظار پاسخ دیگران','کارهای خاتمه‌یافته تیم','متوقف یا تأخیردار','کارهای به تأخیر افتاده کارکنان','کارهای در حال انجام','کارهای عقب‌افتاده'])assert(out.includes(title),title);
assert(out.includes('وظیفه عقب افتاده')&&out.includes('راسپینا')&&out.includes('کارشناس نمونه')&&out.includes('4 روز تأخیر'));
assert(!out.includes('ثبت کار خصوصی')&&!out.includes('ایجاد کار خصوصی'));

const tab=vm.createContext({...common});vm.runInContext(pick('function taskHubTabs(active){','function tasksHubPage(){')+'\nthis.tabs=taskHubTabs',tab);
assert(tab.tabs('team').includes('وظایف کارکنان')&&tab.tabs('private').includes('وظایف شخصی'));
assert(js.includes('tasks:tasksHubPage')&&js.includes("if(U.roleTab==='duties')return dutiesPage()"));
assert(!js.includes('templateChooser')&&!js.includes('data-template-select'));

// A server-verified private status write, with a negative test for rejection.
(async()=>{
 let remote={visibility:'owner_private',assigneeUid:'owner',status:'todo',notes:[]},lastPatch=null;
 const priv={
 D:{tasks:[{id:'s1',visibility:'owner_private',assignee:'owner',createdBy:'owner',status:'todo',notes:[],seriesId:null}],events:[]},
 APP:{user:{uid:'owner'},remotePaths:{s1:'tasks'}},
 privateStatusWrites:new Set(),statuses:common.statuses,
 isAdmin:()=>true,managerTask:()=>true,canSeeTask:()=>true,
 navigator:{onLine:true},Object,Date,Set,Promise,
 doc:(_db,cname,id)=>({cname,id}),db:{},
 writeQueue:Promise.resolve(),pendingOps:new Map(),
 getDocFromServer:async()=>({exists:()=>true,data:()=>remote}),
 updateDoc:async(_ref,patch)=>{lastPatch=patch;remote={...remote,...patch}},
 serverTimestamp:()=>new Date(),
 setDoc:async()=>{},
 record:(kind,msg,id)=>{priv.D.events.push({id:'event1',kind,entity:id,msg})},
 toFirestore:(_key,value)=>value,
 actorName:()=> 'مالک سیستم',isoToday:()=> '2026-11-24',
 authMessage:e=>e.message,prompt:()=> 'کمبود اطلاعات',
 toast:msg=>{throw Error('Unexpected toast '+msg)},
 render:()=>{},copy:o=>JSON.parse(JSON.stringify(o)),
 };
 // compile the function with its own lexical privateStatusWrites binding; reuse mocks via globals.
 const c=vm.createContext(priv);
 vm.runInContext(pick('const privateStatusWrites=new Set();','function changeTaskStatus(task,newStatus){')+'\nthis.change=changePrivateTaskStatus;',c);
 await c.change('s1','doing');
 assert.equal(remote.status,'doing');assert.equal(lastPatch.status,'doing');assert.equal(c.D.tasks[0].status,'doing');
 let badMessage='';c.updateDoc=async()=>{throw Error('permission-denied')};c.toast=msg=>{badMessage=msg};
 await c.change('s1','done');
 assert.equal(c.D.tasks[0].status,'doing');assert(badMessage.includes('permission-denied'));
 console.log('PASS: 47 role descriptions; manager+staff duties visibility; six KPIs; overdue project/assignee/day count; no private dashboard create; two task tabs; private status server verify and rollback.');
})().catch(e=>{console.error(e);process.exit(1)});
