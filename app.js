'use strict';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithRedirect, GoogleAuthProvider, signOut, updateProfile, reload, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocFromServer, onSnapshot, query, where, setDoc, deleteDoc, writeBatch, runTransaction, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const firebaseConfig = {apiKey:'AIzaSyB33B6zHMBbQyfvRlo9M_AkuXJV8_votME',authDomain:'project-controls-hub-8bb30.firebaseapp.com',projectId:'project-controls-hub-8bb30',storageBucket:'project-controls-hub-8bb30.firebasestorage.app',messagingSenderId:'867802858246',appId:'1:867802858246:web:5715422679339e5934d487'};
const firebaseApp=initializeApp(firebaseConfig),auth=getAuth(firebaseApp),db=getFirestore(firebaseApp),googleProvider=new GoogleAuthProvider();
const copy=x=>JSON.parse(JSON.stringify(x));
const APP={user:null,profile:null,adminAccess:null,request:null,role:null,approved:false,loading:true,loadingWorkspace:false,authMode:'login',authError:'',syncError:'',status:'loading',readOnlyPreview:false,subscriptions:[],sources:{},remotePaths:{},expectedReads:0,readyReads:0,readyReadSet:new Set(),sourceServerReady:new Set(),readsReady:false,generationStarted:false,authVersion:0,pendingWrites:0};
const KEY='pch-vosough-clean-workspace-v4';
const PCH_RELEASE='v22-role-duty-directory-personal-status-dashboard';
const THEME_KEY='pch-pmo-theme-preference';
function readTheme(){try{return localStorage.getItem(THEME_KEY)==='dark'?'dark':'light'}catch(e){return 'light'}}
function readPalette(){return 'classic'} // Deprecated palette schemes are no longer selectable.
function applyTheme(){const mode=readTheme();document.documentElement.setAttribute('data-theme',mode);document.documentElement.removeAttribute('data-palette');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#111112':'#f5f3ee')}
function setThemeMode(value){if(!['dark','light'].includes(value))return;try{localStorage.setItem(THEME_KEY,value)}catch(e){}applyTheme();render()}
applyTheme();
const MANAGER_ID='__manager_private__'; // فقط مقدار داخلی فرم؛ UID واقعی از Firebase می‌آید
const managerTask=t=>!!t&&['manager_private','owner_private'].includes(t.visibility);
const managerRecurring=r=>!!r&&['manager_private','owner_private'].includes(r.visibility);
const teamTasks=()=>D.tasks.filter(t=>!managerTask(t));
const myManagerTasks=()=>D.tasks.filter(t=>managerTask(t)&&t.assignee===APP.user?.uid&&(t.visibility===(isSystemOwner()?'owner_private':'manager_private')));
const creatorOfTask=t=>{if(!t)return null;if(t.seriesId){const source=D.recurrences.find(r=>r.id===t.seriesId);return source?.createdBy||null}return t.createdBy};
const isMyCreatedTask=t=>!!t&&!managerTask(t)&&APP.user?.uid===creatorOfTask(t);
const canEditTask=t=>!!t&&(isAdmin()?canSeeTask(t):canSeeTask(t)&&isMyCreatedTask(t));
const canDeleteTask=t=>!!t&&(isAdmin()?canSeeTask(t):canSeeTask(t)&&isMyCreatedTask(t));

const roles={supervisor:'سرپرست',senior:'کارشناس ارشد',expert:'کارشناس',intern:'کارآموز'};
const OWNER_EMAIL='arashlavasani891@gmail.com', MANAGER_EMAIL='behrooz73.vosough@gmail.com';
const isOwnerDirectoryUser=u=>String(u?.email||'').toLowerCase()===OWNER_EMAIL;
const statuses={todo:'شروع نشده',doing:'در حال انجام',blocked:'متوقف',review:'در انتظار تایید یا پاسخ دیگران',done:'خاتمه یافته'};
const statusColor={todo:'gray',doing:'blue',blocked:'red',review:'amber',done:'green'};
const priorities={normal:'عادی',high:'بالا',urgent:'فوری'};
const freqNames={daily:'روزانه',weekly:'هفتگی',monthly:'ماهانه',interval:'هر چند روز یک‌بار'};

// Read-only job descriptions. These are not selectable task templates and do not
// create tasks or change any document in Firestore. All 47 duties are included.
const ROLE_DUTIES={"supervisor":[["مسئولیت‌های عمومی (بدون تکرار خودکار)",["همکاری تخصصی با کارشناسان سایر بلوک‌ها، بدون انتقال مسئولیت اصلی بلوک خود و با مدیریت سرپرست","شناسایی و ارزیابی ریسک‌ها و پیشنهاد اقدامات پاسخ","آموزش، توانمندسازی و ارزیابی عملکرد کارشناسان"]],["روزانه",["بررسی و کنترل کیفیت گزارش روزانه کارفرما","بررسی استقرار (کارگاهی، پیمانکاری، موردی، کلی) و اعلام هشدار در گروه"]],["هر ۳ روز یک‌بار",["کنترل صحت، انسجام و کامل‌بودن دیتابیس کتیبه","بررسی ورود و خروج و گزارشات","دریافت و بررسی گزارشات اجرایی","بازدید از سایت","پیگیری برنامه‌ها"]],["هفتگی",["کنترل، تجمیع و تأیید خروجی واحد گزارش هفتگی","پیگیری صورتجلسات","بررسی، تأیید و تحلیل تجمیعی چک‌لیست‌ها","مدیریت جلسات و کنترل اقدامات اصلاحی پیمانکاری","بررسی دیتابیس","رصد فعالیت‌های بحرانی و هشدار درباره پیش‌نیازهای مهندسی، تدارکات و اجرا","پایش مستندات تأخیرات و نامه‌نگاری درخصوص عوامل تأخیر"]],["هر ۲ هفته",["گزارش انحراف / تأخیر نسبت به برنامه","تجمیع، اولویت‌بندی و پیگیری مدیریتی مشکلات و موانع"]],["ماهانه",["ثبت درس‌آموخته‌ها و پیشنهاد بهبود فرآیندها","همکاری در کنترل بودجه و احجام کارهای باقیمانده","کنترل برنامه‌ها و مدیریت اولویت‌های برنامه کارفرمایی","کنترل، تجمیع و تأیید خروجی واحد گزارش ماهانه","اولویت‌بندی و کنترل تحقق اقدامات Action Plan"]]],"expert":[["مسئولیت‌های عمومی (بدون تکرار خودکار)",["نگهداری منظم سوابق، مکاتبات، صورتجلسات و مستندات کنترلی بلوک","شناسایی ریسک‌ها و اعلام به سرپرست"]],["روزانه",["تهیه و کنترل اولیه اطلاعات و ثبت گزارش روزانه کارفرما","بررسی استقرار (کارگاهی، پیمانکاری، موردی، کلی)","ثبت و به‌روزرسانی اطلاعات دیتابیس کتیبه","بررسی ورود و خروج و گزارشات روزمزدی","دریافت و بررسی گزارشات اجرایی","بازدید از سایت","برگزاری جلسه کوتاه روزانه با سرپرست اجرا"]],["هر ۳ روز یک‌بار",["پیگیری برنامه‌ها"]],["هفتگی",["گزارش هفتگی","پیگیری صورتجلسات","تکمیل و مستندسازی چک‌لیست‌ها","تحلیل چک‌لیست‌ها","پایش عملکرد و پیگیری و جلسات پیمانکاری","بررسی دیتابیس","مستندسازی عوامل تأخیر و نگهداری سوابق قابل استناد"]],["هر ۲ هفته",["گزارش انحراف / تأخیر نسبت به اکشن‌پلن","شناسایی و مستندسازی مشکلات و موانع"]],["ماهانه",["ثبت درس‌آموخته‌ها و پیشنهاد بهبود فرآیندها","گزارش ماهانه","تهیه Action Plan","پایش و اعلام انحراف برنامه کارفرمایی"]]]};
const permLabels={assign:'واگذاری کار به دیگران',review:'تأیید کار دیگران',report:'گزارش‌گیری پروژه‌ها'};
const PERMS=()=>({supervisor:{assign:true,review:true,team:false,report:true},senior:{assign:false,review:false,team:false,report:false},expert:{assign:false,review:false,team:false,report:false},intern:{assign:false,review:false,team:false,report:false}});
const blank=()=>({version:4,projects:[],users:[],requests:[],deletionRequests:[],tasks:[],recurrences:[],evaluations:[],events:[],permissions:PERMS()});
let remoteD=blank();
function load(){return blank()}
let D=load();
let installPromptEvent=null;
const pwaInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const U={page:'dashboard',preview:null,actor:null,modal:null,edit:null,filterProject:'all',filterStatus:'all',filterText:'',perfProject:'all',perfRole:'all',selectedPerson:'all',monthShift:0,calendarOffset:0,calendarSelect:null,roleTab:'home',mobileNav:false,projectFilter:'all',taskCreateMode:'team',recurringCreateMode:'team',taskView:'team',dutyRole:'supervisor',showAllOverdue:false,taskFilterOpen:false,taskPerson:'all',taskSort:'default',taskGroup:'none',taskQuick:'all',expandedTasks:[],taskDrafts:{},taskNotice:''};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toFa=s=>String(s??'').replace(/[0-9]/g,c=>'۰۱۲۳۴۵۶۷۸۹'[+c]);
const toEn=s=>String(s??'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
const num=v=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(v??0);
const pad=n=>String(n).padStart(2,'0');
const tehranDateParts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
const tehranHourParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function tehranMoment(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return null;const parts=tehranDateParts.formatToParts(d),f=k=>parts.find(p=>p.type===k)?.value;return {date:`${f('year')}-${f('month')}-${f('day')}`,time:tehranHourParts.format(d)}}
const isoToday=()=>tehranMoment(new Date()).date;
const addDays=(iso,amount)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10)};
const nthDay=(iso)=>new Date(iso+'T12:00:00Z').getUTCDay();
const jd=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
const cachedJ=new Map(),cachedISO=new Map();
function jparts(iso){if(!iso)return null;if(cachedJ.has(iso))return cachedJ.get(iso);const z=jd.formatToParts(new Date(iso+'T12:00:00Z'));const f=k=>Number(z.find(x=>x.type===k)?.value);const o={y:f('year'),m:f('month'),d:f('day')};cachedJ.set(iso,o);return o}
function fromJ(y,m,d){y=+y;m=+m;d=+d;if(y<1300||y>1600||m<1||m>12||d<1||d>31)return null;const key=`${y}/${m}/${d}`;if(cachedISO.has(key))return cachedISO.get(key);let lo=Math.floor(Date.UTC(y+620,0,1)/86400000),hi=Math.floor(Date.UTC(y+623,11,31)/86400000),found=null;const tar=y*10000+m*100+d;while(lo<=hi){const mid=Math.floor((lo+hi)/2),iso=new Date(mid*86400000).toISOString().slice(0,10),v=jparts(iso),x=v.y*10000+v.m*100+v.d;if(x===tar){found=iso;break}if(x<tar)lo=mid+1;else hi=mid-1}cachedISO.set(key,found);return found}
const jstr=iso=>{if(!iso)return '—';const p=jparts(iso);return p?toFa(`${p.y}/${pad(p.m)}/${pad(p.d)}`):'—'};
const jparse=v=>{const m=toEn(v).trim().replace(/[-.]/g,'/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);return m?fromJ(+m[1],+m[2],+m[3]):null};
const M=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const DW=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const wd=iso=>(nthDay(iso)+1)%7;
const daysInMonth=(y,m)=>{const a=fromJ(y,m,1),b=m===12?fromJ(y+1,1,1):fromJ(y,m+1,1);return a&&b?Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000):30};
const jyMonth=iso=>{const p=jparts(iso);return `${p.y}/${pad(p.m)}`};
const monthLabel=k=>{const [y,m]=k.split('/').map(Number);return `${M[m-1]} ${toFa(y)}`};
function shiftedJMonth(offset=0){let {y,m}=jparts(isoToday());m+=offset;while(m>12){m-=12;y++}while(m<1){m+=12;y--}return {y,m,key:`${y}/${pad(m)}`}}
const id=p=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const proj=x=>D.projects.find(p=>p.id===x);
const person=x=>D.users.find(p=>p.id===x);
const userRole=x=>x===APP.user?.uid&&APP.role?APP.role:person(x)?.role||'expert';
const actorName=x=>x===APP.user?.uid?(APP.adminAccess?.name||APP.profile?.name||APP.user?.displayName||(APP.role==='projectControlsManager'?'آقای وثوق':APP.role==='systemOwner'?'مالک سیستم':'کاربر')):person(x)?.name||'نامشخص';
const roleIcon={supervisor:'shield',senior:'medal',expert:'user',intern:'graduation'};
const unassignedText='بدون پروژه';
const projectName=x=>x?proj(x)?.name||'پروژه حذف‌شده':unassignedText;
const roleColor={supervisor:'blue',senior:'purple',expert:'green',intern:'amber'};
const isAdmin=()=>!!APP.approved&&!APP.readOnlyPreview&&['projectControlsManager','systemOwner'].includes(APP.role);
const isProjectControlsManager=()=>!!APP.approved&&!APP.readOnlyPreview&&APP.role==='projectControlsManager';
const isSystemOwner=()=>!!APP.approved&&!APP.readOnlyPreview&&APP.role==='systemOwner';
const currentRole=()=>isAdmin()?'admin':APP.role||userRole(U.actor);
const permission=k=>isAdmin();
const actorProjects=()=>isAdmin()?D.projects.map(p=>p.id):(APP.profile?.projects||[]);
const availableProject=id=>!id||isAdmin()||actorProjects().includes(id);
const canSeeTask=t=>!t?false:t.visibility==='manager_private'?(isProjectControlsManager()&&t.assignee===APP.user?.uid):t.visibility==='owner_private'?(isSystemOwner()&&t.assignee===APP.user?.uid):(isAdmin()||(t.assignee===APP.user?.uid||t.createdBy===APP.user?.uid));
const taskStatus=t=>statuses[t.status]||'نامشخص';
const dueLate=t=>t.status!=='done'&&!!t.due&&t.due<isoToday();
const taskScore=t=>{const e=D.evaluations.find(e=>e.id===t.evalId);return e?.score??null};
const countStatuses=ts=>Object.fromEntries(Object.keys(statuses).map(k=>[k,ts.filter(t=>t.status===k).length]));
const pct=(a,b)=>b?Math.round(100*a/b):0;
const avatar=name=>`<span class="actor-circle">${esc(String(name||'؟').trim().slice(0,1))}</span>`;
const pill=(txt,c='gray')=>`<span class="tag ${c}">${esc(txt)}</span>`;
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',tasks:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',users:'<circle cx="9" cy="7" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',chart:'<path d="M3 3v18h18M7 16l4-4 3 2 6-7"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',medal:'<circle cx="12" cy="8" r="6"/><path d="m8.2 13.5-1 8 4.8-3 4.8 3-1-8"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',graduation:'<path d="m2 10 10-5 10 5-10 5-10-5ZM6 12v5c4 3 8 3 12 0v-5M22 10v7"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',check:'<path d="m20 6-11 11-5-5"/>',close:'<path d="M18 6 6 18M6 6l12 12"/>',back:'<path d="M19 12H5m7-7-7 7 7 7"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',alert:'<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',refresh:'<path d="M3 12a9 9 0 1 0 3-7M3 3v6h6"/>',layers:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',play:'<path d="m8 5 12 7-12 7z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z"/>',dots:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',moon:'<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'})[name]||'<circle cx="12" cy="12" r="9"/>'}</svg>`;
function record(kind,text,entity=''){if(!APP.user?.uid)return;const task=D.tasks.find(t=>t.id===entity),recurrence=D.recurrences.find(r=>r.id===entity),target=task||recurrence,privateRecord=managerTask(target),eventId=id('evt');D.events.push({id:eventId,kind,text,entity:entity||eventId,taskId:entity||eventId,actorUid:APP.user.uid,createdByUid:target?.createdBy||APP.user.uid,by:actorName(APP.user.uid),visibility:privateRecord?target.visibility:'team',ownerUid:privateRecord?(target.assignee||APP.user.uid):'',assigneeUid:target?.assignee||APP.user.uid,at:new Date().toISOString()});if(D.events.length>3000)D.events=D.events.slice(-3000)}
function normalizeDocument(key,snap){const x=snap.data()||{},idValue=snap.id,dt=x.createdAt?.toDate?x.createdAt.toDate().toISOString().slice(0,10):String(x.createdAt||'').slice(0,10);if(key==='users')return {...x,id:idValue,projects:x.projectIds||[],active:x.status==='active'};if(key==='requests')return {...x,id:idValue,date:dt||x.date||isoToday()};if(key==='tasks'||key==='instances')return {...x,id:idValue,assignee:x.assigneeUid||x.assignee,createdBy:x.createdByUid||x.createdBy};if(key==='recurrences')return {...x,id:idValue,assignee:x.assigneeUid||x.assignee,createdBy:x.createdByUid||x.createdBy,excluded:x.excluded||[]};if(key==='evaluations')return {...x,id:idValue,assignee:x.assigneeUid||x.assignee};if(key==='events')return {...x,id:idValue,at:x.at?.toDate?x.at.toDate().toISOString():x.at,entity:x.taskId||x.entity};return {...x,id:idValue}}
const KEY_TO_COLLECTION={projects:'projects',users:'users',requests:'membershipRequests',recurrences:'recurrences',evaluations:'evaluations',events:'activityHistory'};
function toast(message,bad=false){const node=document.createElement('div');node.className='toast'+(bad?' error':'');node.textContent=message;$('#toasts').append(node);setTimeout(()=>node.remove(),3800)}
function pushModal(type,edit=''){U.modal=type;U.edit=edit;renderModal()}
function closeModal(){U.modal=null;U.edit=null;renderModal();if(liveViewRefreshPending)refreshFromFirestore()}
const B=(label,action,cls='',extra='')=>`<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const empty=(title,desc='',action='',actionLabel='')=>`<div class="empty-state"><div class="empty-icon">${icon('file',26)}</div><strong>${title}</strong>${desc?`<p>${desc}</p>`:''}${action?B(icon('plus',15)+actionLabel,action,'primary'):''}</div>`;
function render(){if(APP.loading){$('#app').innerHTML='<main class="auth-shell"><section class="auth-card"><img class="brand-logo-img" src="./pch-logo.png" alt="Project Controls Hub"><h1>Project Controls Hub</h1><p>در حال اتصال امن به سامانه…</p><div class="progress"><span style="width:72%"></span></div></section></main>';return}if(!APP.user){$('#app').innerHTML=renderAuthGate();renderModal();document.title='ورود | Project Controls Hub';return}if(!APP.approved){$('#app').innerHTML=['connectionError','authError'].includes(APP.status)?renderConnectionGate():renderPendingGate();renderModal();document.title='حساب کاربری | Project Controls Hub';return}ensureActor();let a=U.preview?roleShell():adminShell();$('#app').innerHTML=a;renderModal();$('#app').setAttribute('data-mode',U.preview?'role':'admin');document.title=`${U.preview?'پنل '+(roles[U.preview]||'کاربر'):APP.role==='systemOwner'?'مالک سیستم':'مدیر کنترل پروژه'} | Project Controls Hub`}
function ensureActor(){if(!APP.user)return;U.actor=APP.user.uid;if(!APP.readOnlyPreview)U.preview=isAdmin()?null:APP.role}
function renderAuthGate(){const signup=APP.authMode==='signup';return `<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><img class="brand-logo-img" src="./pch-logo.png" alt="Project Controls Hub"><div><b>Project Controls Hub</b><small>مرکز مدیریت کنترل پروژه</small></div></div><h1>${signup?'درخواست عضویت':'ورود به سامانه'}</h1><p class="auth-intro">${signup?'با ایمیل و رمز عبور درخواست عضویت ثبت کن؛ مدیران مجاز پس از ورود به‌صورت خودکار شناسایی می‌شوند.':'با ایمیل و رمز عبور یا حساب Google وارد شو.'}</p><form id="auth-form" class="auth-form">${signup?`<label>نام و نام خانوادگی<input class="field" name="name" maxlength="80" required autocomplete="name"></label>`:''}<label>ایمیل<input class="field" name="email" type="email" dir="ltr" autocomplete="email" value="${esc(APP.authMode==='login'?readRememberedEmail():'')}" required></label><label>رمز عبور<input class="field" name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required></label>${signup?'':`<label class="remember-login"><input type="checkbox" name="remember" ${rememberLoginEnabled()?'checked':''}><span>مرا به خاطر بسپار (ورود ماندگار)</span></label>`}<button class="btn primary full" type="submit">${signup?'ساخت حساب و ثبت درخواست':'ورود'}</button></form><button class="btn full google-auth" type="button" data-action="google-auth">ادامه با حساب Google</button>${APP.authError?`<div class="notice warm auth-error" role="alert">${esc(APP.authError)}</div>`:''}<button class="link-button auth-switch" type="button" data-action="toggle-auth-mode">${signup?'حساب داری؟ ورود':'حساب نداری؟ درخواست عضویت'}</button><p class="auth-security">حساب‌های کارکنان تا تأیید مدیر فقط به درخواست عضویت خود دسترسی دارند. دسترسی مدیریت فقط برای دو حساب مشخص‌شده و UID ثبت‌شده در سامانه فعال است.</p></section></main>`}
function renderConnectionGate(){return `<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><img class="brand-logo-img" src="./pch-logo.png" alt="Project Controls Hub"><div><b>Project Controls Hub</b><small>مرکز مدیریت کنترل پروژه</small></div></div><h1>اتصال به سرور برقرار نیست</h1><p class="auth-intro">دسترسی حساب شما لغو نشده است؛ در حال حاضر تأیید آنلاین دسترسی ممکن نیست.</p><div class="notice warm" role="alert">${esc(APP.authError||'اینترنت و دسترسی Firebase را بررسی کنید.')}</div><div class="auth-actions">${B('تلاش مجدد','retry-auth','primary')}${B('خروج از حساب','sign-out','sm')}</div></section></main>`}
function renderPendingGate(){const rejected=APP.request?.status==='rejected',disabled=APP.status==='disabled';return `<main class="auth-shell"><section class="auth-card"><div class="auth-brand"><img class="brand-logo-img" src="./pch-logo.png" alt="Project Controls Hub"><div><b>Project Controls Hub</b><small>مرکز مدیریت کنترل پروژه</small></div></div><h1>${disabled?'دسترسی غیرفعال است':rejected?'درخواست عضویت رد شد':'در انتظار تأیید مدیر'}</h1><p class="auth-intro" dir="ltr">${esc(APP.user?.email||'')}</p><div class="notice">${disabled?'دسترسی این حساب به سامانه توسط مدیر لغو شده است. برای فعال‌سازی دوباره با مدیر سامانه تماس بگیر.':rejected?'برای پیگیری با مدیر کنترل پروژه تماس بگیر.':'درخواست با شناسهٔ حساب Firebase ثبت شده است. پس از تعیین سمت و پروژه‌های مجاز توسط مدیر، دسترسی فعال می‌شود.'}</div>${APP.authError?`<div class="notice warm" role="alert">${esc(APP.authError)}</div>`:''}<div class="auth-actions">${B('خروج از حساب','sign-out','sm')}</div></section></main>`}
async function createMembershipRequest(user){if(!user?.uid)return;const ref=doc(db,'membershipRequests',user.uid),snap=await getDoc(ref);if(!snap.exists()){await setDoc(ref,{uid:user.uid,email:(user.email||'').toLowerCase(),name:user.displayName||'',status:'pending',createdAt:serverTimestamp()})}return (await getDoc(ref)).data()}
async function handleAuthUser(user,version){
 APP.user=user||null;APP.profile=null;APP.adminAccess=null;APP.request=null;APP.approved=false;APP.syncError='';APP.readOnlyPreview=false;U.preview=null;
 if(!user){clearSubscriptions();APP.role=null;APP.loading=false;APP.loadingWorkspace=false;APP.status='signedOut';render();return}
 try{
  await reload(user);if(version!==APP.authVersion)return;APP.user=auth.currentUser||user;const uid=APP.user.uid;
  const loginEmail=String(APP.user.email||'').toLowerCase();const specialRole=loginEmail===MANAGER_EMAIL?'projectControlsManager':loginEmail===OWNER_EMAIL?'systemOwner':null;
  const trustedRole=specialRole;
  const [a,u,r]=await Promise.all([getDocFromServer(doc(db,'adminAccess',uid)),getDocFromServer(doc(db,'users',uid)),getDocFromServer(doc(db,'membershipRequests',uid))]);if(version!==APP.authVersion)return;
  if(trustedRole&&!a.exists()){await APP.user.getIdToken(true);await setDoc(doc(db,'adminAccess',uid),{uid,email:APP.user.email.toLowerCase(),name:APP.user.displayName||'',role:trustedRole,active:true,createdAt:serverTimestamp()});return handleAuthUser(auth.currentUser,version)}
  if(a.exists()&&a.data().active===true&&['projectControlsManager','systemOwner'].includes(a.data().role)){APP.adminAccess={...a.data(),id:uid};APP.role=a.data().role;APP.approved=true;APP.profile=null;
    if(r.exists()&&r.data().status==='pending'){try{await updateDoc(doc(db,'membershipRequests',uid),{status:'approved',reviewedByUid:uid,reviewedAt:serverTimestamp()})}catch(pendingError){console.warn('Unable to clear obsolete manager membership request',pendingError)}}
    if(APP.role==='systemOwner'){try{const ownerRef=doc(db,'users',uid);if(!u.exists())await setDoc(ownerRef,{uid,email:OWNER_EMAIL,name:APP.user.displayName||'آرش لواسانی',role:'supervisor',status:'active',projectIds:[],createdAt:serverTimestamp()});else if(u.data().role!=='supervisor'||u.data().status!=='active')await updateDoc(ownerRef,{role:'supervisor',status:'active'});APP.profile={id:uid,role:'supervisor'};}catch(profileError){console.warn('Unable to create owner supervisor directory profile',profileError)}}
    APP.status='active';APP.loading=false;U.page='dashboard';U.preview=null;U.actor=uid;startWorkspace();return}
  if(u.exists()&&u.data().status==='disabled'){APP.profile={...u.data(),id:uid,projects:u.data().projectIds||[]};APP.status='disabled';APP.loading=false;APP.loadingWorkspace=false;clearSubscriptions();render();return}
  if(u.exists()&&u.data().status==='active'&&roles[u.data().role]){APP.profile={...u.data(),id:uid,projects:u.data().projectIds||[]};APP.role= u.data().role;APP.approved=true;APP.status='active';APP.loading=false;U.preview=APP.role;U.actor=uid;U.roleTab='home';startWorkspace();return}
  APP.request=r.exists()?{...r.data(),id:uid}:null;if(!r.exists())APP.request={...await createMembershipRequest(APP.user),id:uid};APP.status=APP.request?.status==='rejected'?'rejected':'pending';APP.loading=false;APP.loadingWorkspace=false;clearSubscriptions();render()
 }catch(err){if(version!==APP.authVersion)return;APP.loading=false;APP.loadingWorkspace=false;APP.authError=authMessage(err);APP.status=/offline|unavailable|network|failed to get document|deadline-exceeded/i.test((err?.code||'')+' '+(err?.message||''))?'connectionError':'authError';console.error('PCH authentication bootstrap failed',err);render()}
}
function authMessage(e){const c=e?.code||'';return ({'auth/invalid-credential':'ایمیل یا رمز عبور درست نیست.','auth/operation-not-allowed':'ورود با Google هنوز در Firebase فعال نشده است.','auth/email-already-in-use':'برای این ایمیل قبلاً حساب ساخته شده است.','auth/weak-password':'رمز عبور باید حداقل ۸ نویسه باشد.','auth/invalid-email':'نشانی ایمیل معتبر نیست.','auth/too-many-requests':'تلاش‌های ورود زیاد بوده؛ کمی بعد دوباره امتحان کن.','auth/network-request-failed':'اتصال اینترنت برقرار نیست.','permission-denied':'قواعد امنیتی Firebase اجازهٔ این عملیات را نداد.'})[c]||e?.message||'عملیات انجام نشد.'}
const REMEMBER_EMAIL_KEY='pch-saved-login-email';
const REMEMBER_LOGIN_KEY='pch-remember-login';
function rememberLoginEnabled(){try{return localStorage.getItem(REMEMBER_LOGIN_KEY)!=='no'}catch{return true}}
function readRememberedEmail(){try{return rememberLoginEnabled()?localStorage.getItem(REMEMBER_EMAIL_KEY)||'':''}catch{return ''}}
async function authSubmit(form){APP.authError='';const fd=new FormData(form),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||'');try{if(APP.authMode==='login'){const remember=fd.has('remember');await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);try{localStorage.setItem(REMEMBER_LOGIN_KEY,remember?'yes':'no');if(remember)localStorage.setItem(REMEMBER_EMAIL_KEY,email);else localStorage.removeItem(REMEMBER_EMAIL_KEY)}catch{}}if(APP.authMode==='signup'){const name=String(fd.get('name')||'').trim();if(!name)throw new Error('نام و نام خانوادگی را وارد کن.');const cred=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(cred.user,{displayName:name});APP.user=cred.user;APP.status='pending';APP.authError='';toast('حساب ساخته شد؛ درخواست عضویت به فهرست مدیر ارسال می‌شود.')}else await signInWithEmailAndPassword(auth,email,password)}catch(e){APP.authError=authMessage(e);render()}}
async function startApp(){try{onAuthStateChanged(auth,user=>{APP.authVersion++;const version=APP.authVersion;APP.loading=true;APP.authError='';render();handleAuthUser(user,version)}); }catch(e){APP.loading=false;APP.authError=authMessage(e);render()}}
let writeQueue=Promise.resolve(),pendingOps=new Map(),pendingSeq=0,outboxStorageError='',lastWriteFailures=[];
const pendingStoreKey=()=>`pch-unsynced-v1:${APP.user?.uid||'anonymous'}`;
const pendingOpKey=(collectionName,docId)=>`${collectionName}/${docId}`;
// Never silently discard an edit rejected because its task was deleted elsewhere.
const conflictStoreKey=()=>`pch-conflicts-v15:${APP.user?.uid||'anonymous'}`;
function archiveRejectedTask(op,reason){
 try{
  const saved=JSON.parse(localStorage.getItem(conflictStoreKey())||'[]');
  saved.push({at:new Date().toISOString(),reason,op:copy(op)});
  localStorage.setItem(conflictStoreKey(),JSON.stringify(saved.slice(-250)));
  return true;
 }catch(e){console.error('Could not back up a deleted-task conflict',e);return false}
}
function knownTaskPaths(id){
 const paths=new Set();
 for(const [source,entries] of Object.entries(APP.sources.tasks||{})){
  if((entries||[]).some(x=>x.id===id))paths.add(source.startsWith('recurrenceInstances-')?'recurrenceInstances':'tasks');
 }
 return [...paths];
}
function queueExplicitDelete(key,item){
 if(!item?.id)return;
 // A historical bug could put one logical ID in BOTH physical collections.
 // A delete from the manager must remove both, not leave a phantom in another panel.
 const paths=key==='tasks'?knownTaskPaths(item.id):[];
 for(const cname of (paths.length?paths:[collectionFor(key,item,item.id)]))
  stageOperation({type:'delete',key,cname,id:item.id});
}


function persistPendingOps(){if(!APP.user?.uid)return false;try{localStorage.setItem(pendingStoreKey(),JSON.stringify([...pendingOps.values()]));outboxStorageError='';return true}catch(e){console.warn('PCH local outbox storage failed',e);outboxStorageError=`پشتیبان محلی ذخیره نشد (${e?.name||'storage'})`;return false}}
function loadPendingOps(){
 pendingOps=new Map();pendingSeq=0;outboxStorageError='';
 try{
  const raw=localStorage.getItem(pendingStoreKey())||'[]',saved=JSON.parse(raw);
  if(saved.length&&!localStorage.getItem(`pch-pre-v15-outbox:${APP.user?.uid}`))
   localStorage.setItem(`pch-pre-v15-outbox:${APP.user?.uid}`,raw);
  for(const op of saved){if(!op?.cname||!op.id||!op.key)continue;op.rev=++pendingSeq;pendingOps.set(pendingOpKey(op.cname,op.id),op)}
 }catch(e){console.warn('PCH local outbox could not be read',e);outboxStorageError='خواندن صف ذخیرهٔ محلی ممکن نشد'}
}
function applyPendingOverlay(key,rows){const map=new Map(rows.map(x=>[x.id,copy(x)]));for(const op of pendingOps.values()){if(op.key!==key)continue;if(op.type==='delete')map.delete(op.id);else map.set(op.id,copy(op.value))}return [...map.values()]}
const collectionFor=(key,value,docId)=>{
 if(key!=='tasks')return KEY_TO_COLLECTION[key];
 const sources=knownTaskPaths(docId);
 if(sources.length===1)return sources[0];
 if(sources.includes('recurrenceInstances')&&value?.seriesId)return 'recurrenceInstances';
 return value?.seriesId?'recurrenceInstances':(sources[0]||APP.remotePaths[docId]||'tasks');
};
function stageOperation(op){
 // One logical task must never be sent to both Firestore collections.
 if(op.key==='tasks')for(const [key,prior] of [...pendingOps]){
  if(prior.key==='tasks'&&prior.id===op.id&&key!==pendingOpKey(op.cname,op.id)){
   if(prior.type==='delete'&&op.type==='delete')continue;
   if(prior.type==='set'){
    // Preserve unsaved work before replacing its path or deleting the task.
    if(!archiveRejectedTask(prior,op.type==='delete'?'Superseded by explicit manager delete':'Duplicate queued path resolved to '+op.cname))continue;
   }
   pendingOps.delete(key);
  }
 }
 const key=pendingOpKey(op.cname,op.id),old=pendingOps.get(key);
 // Re-scheduling an unchanged optimistic operation must not increment its revision:
 // that caused successful in-flight writes to stay in the local queue and retry.
 if(old&&old.type===op.type&&old.createOnly===op.createOnly&&
    JSON.stringify(old.value??null)===JSON.stringify(op.value??null))return;
 op.rev=++pendingSeq;pendingOps.set(key,op)
}
function applyRemoteOperation(op){const list=remoteD[op.key]||[],ix=list.findIndex(x=>x.id===op.id);if(op.type==='delete'){if(ix>=0)list.splice(ix,1)}else if(ix>=0)list[ix]=copy(op.value);else list.push(copy(op.value));remoteD[op.key]=list}
function firestorePayload(op){
 const model=op.cname==='recurrenceInstances'?'instances':({projects:'projects',users:'users',membershipRequests:'requests',activityHistory:'events',recurrences:'recurrences',evaluations:'evaluations'}[op.cname]||'tasks');
 // Normalize old unsent occurrences from the persistent outbox. Their former
 // default weight (3) was not necessarily the template's actual weight (0).
 if(op.cname==='recurrenceInstances'&&op.createOnly&&op.value?.seriesId){
  const source=D.recurrences.find(r=>r.id===op.value.seriesId);
  if(source){
   op.value.weight=managerRecurring(source)?0:(source.weight??0);op.value.createdBy=source.createdBy;op.value.materializedByUid=APP.user.uid;
   // Older clients sometimes queued the wrong assignee / project / visibility.
   // Do not silently reassign a worker's task; reject with a useful diagnostic.
   if(op.value.assignee!==source.assignee || op.value.projectId!==(source.projectId||'') ||
      op.value.visibility!==(managerRecurring(source)?source.visibility:'team')){
      const problem=new Error('اطلاعات مسئول یا پروژهٔ این نوبت نسبت به برنامه تکراری تغییر کرده است؛ بازبینی مدیر لازم است.');
      problem.code='source-changed';throw problem;
   }
  }
 }
 return toFirestore(model,op.value);
}
// Staff only patches their editable fields; replacing the complete document would erase
// the manager-controlled weight and violate Firestore's immutable-weight constraint.
const STAFF_EDITABLE_FIELDS=['title','projectId','due','priority','description','status','blockReason','notes','submittedAt','updatedAt'];
async function writeOne(op){
 const ref=doc(db,op.cname,op.id);
 if(op.type==='delete'){
  // A deletion is idempotent. Record an immutable tombstone for task IDs so an
  // old queued update on another phone cannot recreate the same task.
  if(op.key==='tasks'){
   const marker=doc(db,'deletedTasks',op.id);
   await runTransaction(db,async tx=>{
    const dead=await tx.get(marker),existing=await tx.get(ref);
    if(!dead.exists()&&(existing.exists()||isAdmin()))tx.set(marker,{deleted:true,deletedAt:serverTimestamp()});
    if(existing.exists())tx.delete(ref);
   });
   return {written:true};
  }
  // Some old outboxes retry a delete after it already succeeded. Do not
  // attempt a second delete against a missing Firestore resource.
  const existing=await getDoc(ref);
  if(existing.exists())await deleteDoc(ref);
  return {written:existing.exists(),alreadyExists:!existing.exists()};
 }
 if(op.key==='tasks'){
  const tombstone=await getDoc(doc(db,'deletedTasks',op.id));
  if(tombstone.exists()){
   const e=new Error('این فعالیت در دستگاه دیگر توسط مدیر حذف شده و نباید دوباره ساخته شود.');
   e.code='deleted-remotely';throw e;
  }
 }
 if(op.cname==='activityHistory'){
  // Immutable audit entries can already have been created before a callback
  // reported an unrelated failure. Retrying setDoc would be an illegal update.
  const existing=await getDoc(ref);
  if(existing.exists())return {written:false,alreadyExists:true};
  await setDoc(ref,firestorePayload(op));
  return {written:true};
 }
 if(op.cname==='recurrenceInstances'&&op.createOnly){
  let created=false,updated=false;
  await runTransaction(db,async tx=>{
   created=false;updated=false;
   const existing=await tx.get(ref),desired=firestorePayload(op);
   if(!existing.exists()){tx.set(ref,desired);created=true;return}
 // Another device already materialized this exact date: NEVER reset its status or notes.
 });
  return {written:created||updated,alreadyExists:!created&&!updated};
 }
 if(op.cname==='tasks'||op.cname==='recurrenceInstances'||op.cname==='recurrences'){
  const prior=op.key==='tasks'?(remoteD.tasks||[]).find(x=>x.id===op.id):
    (remoteD.recurrences||[]).find(x=>x.id===op.id);
  if(op.key==='tasks'&&!prior&&!op.createOnly){
   const e=new Error('سند این فعالیت دیگر در فهرست مجاز سرور وجود ندارد؛ از ایجاد دوباره آن جلوگیری شد.');
   e.code='deleted-remotely';throw e;
  }
  if(prior){
   const model=op.cname==='recurrenceInstances'?'instances':op.cname==='recurrences'?'recurrences':'tasks';
   const oldPayload=toFirestore(model,prior),newPayload=firestorePayload(op),patch={};
   const keys=op.cname==='recurrences'?Object.keys(newPayload):isAdmin()?Object.keys(newPayload):STAFF_EDITABLE_FIELDS;
   for(const field of keys)if(Object.prototype.hasOwnProperty.call(newPayload,field)&&
       JSON.stringify(oldPayload[field])!==JSON.stringify(newPayload[field]))patch[field]=newPayload[field];
   if(Object.keys(patch).length)await updateDoc(ref,patch);
   return {written:!!Object.keys(patch).length};
  }
 }
 await setDoc(ref,firestorePayload(op));
 return {written:true};
}
function syncWritePhase(op){if(op.cname==='recurrenceInstances')return 1;if(op.cname==='evaluations')return 2;if(op.cname==='activityHistory')return 3;return 0}
function syncWriteLabel(op){const names={recurrences:'برنامه تکراری',recurrenceInstances:'نوبت تکراری',evaluations:'ارزیابی',activityHistory:'گزارش فعالیت',tasks:'فعالیت',projects:'پروژه',users:'کاربر',membershipRequests:'درخواست عضویت'};return (names[op.cname]||op.cname)+' · '+String(op.id||'').slice(-6)}
async function flushPendingOps(){
const list=[...pendingOps.values()].sort((a,b)=>syncWritePhase(a)-syncWritePhase(b)),failed=[],failedKeys=new Set();
for(let phase=0;phase<=3;phase++){let cursor=0;const phaseOps=list.filter(op=>syncWritePhase(op)===phase);
const worker=async()=>{while(cursor<phaseOps.length){const op=phaseOps[cursor++],key=pendingOpKey(op.cname,op.id);let pre=null;
if(op.cname==='recurrenceInstances'&&op.type!=='delete'&&op.value?.seriesId)pre=pendingOpKey('recurrences',op.value.seriesId);
if(op.cname==='evaluations'&&op.type!=='delete'&&op.value?.taskId){const linked=list.find(x=>x.id===op.value.taskId&&(x.cname==='tasks'||x.cname==='recurrenceInstances'));if(linked)pre=pendingOpKey(linked.cname,linked.id)}
if(pre&&failedKeys.has(pre)){const error=new Error('ذخیره پیش‌نیاز ناموفق بود؛ این مورد برای جلوگیری از ثبت ناسازگار در صف ماند.');error.code='dependency-failed';failed.push({op,error});failedKeys.add(key);continue}
try{const result=await writeOne(op);const current=pendingOps.get(key);if(current&&current.rev===op.rev){pendingOps.delete(key);if(!result?.alreadyExists)applyRemoteOperation(op);else if(op.key==='tasks')D.tasks=applyPendingOverlay('tasks',remoteD.tasks||[])}}catch(error){
  if(error?.code==='deleted-remotely'&&archiveRejectedTask(op,error.message)){
   const current=pendingOps.get(key);
   if(current&&current.rev===op.rev){pendingOps.delete(key);D.tasks=D.tasks.filter(t=>t.id!==op.id)}
   // The rejected edit is in a separate local recovery archive; do not
   // reinsert a task the manager explicitly deleted.
   continue;
  }
  failed.push({op,error});failedKeys.add(key)
 }}};
await Promise.all(Array.from({length:Math.min(6,phaseOps.length)},worker))}
persistPendingOps();
lastWriteFailures=failed.map(({op,error})=>({collection:op.cname,documentId:op.id,kind:op.type,createOnly:!!op.createOnly,seriesId:op.value?.seriesId||null,status:op.value?.status||null,code:error?.code||error?.name||'unknown',message:String(error?.message||'').slice(0,300)}));
if(failed.length){const first=failed[0].error,code=first.code||first.name||'unknown';const err=new Error(failed.length+' مورد هنوز ذخیره نشده؛ '+syncWriteLabel(failed[0].op)+'. کد: '+code+' — '+(first.message||'علت نامشخص'));err.code=code;err.failures=failed;throw err}
APP.syncError='';return true}
function persist(){
 if(!APP.user||!APP.approved||APP.readOnlyPreview)return Promise.reject(new Error('حساب فعال برای نوشتن لازم است.'));
 const snapshot=copy(D);APP.pendingWrites++;APP.syncError='';
 const arrays=['projects','users','requests','tasks','recurrences','evaluations','events'];
 for(const key of arrays){const before=new Map((remoteD[key]||[]).map(x=>[x.id,x])),after=new Map((snapshot[key]||[]).map(x=>[x.id,x]));
  // A partial query snapshot or reassignment must never be interpreted as a
  // user-requested delete. Task and recurrence deletion is staged explicitly.
  for(const [docId,old] of before)if(!after.has(docId)){
   if(key==='events'||key==='tasks'||key==='recurrences')continue;
   const cname=collectionFor(key,old,docId);stageOperation({type:'delete',key,cname,id:docId})
  }
  for(const [docId,value] of after){const old=before.get(docId);if(old&&JSON.stringify(old)===JSON.stringify(value))continue;const cname=collectionFor(key,value,docId),createOnly=key==='tasks'&&!old;stageOperation({type:'set',key,cname,id:docId,value:copy(value),createOnly:!!createOnly})}
  for(const [opKey,op] of [...pendingOps])if(op.type!=='delete'&&op.key===key&&!after.has(op.id)&&!before.has(op.id))pendingOps.delete(opKey)
 }
 persistPendingOps();render();
 if(APP.sourceServerReady.size<APP.expectedReads||APP.workspaceReadError){APP.pendingWrites=Math.max(0,APP.pendingWrites-1);const e=new Error('در حال حاضر اتصال تأییدشده به Firestore برقرار نیست؛ تغییرات برای ارسال بعدی در این دستگاه نگهداری شدند.');e.code='unavailable';return Promise.reject(e)}
 const job=()=>flushPendingOps();const run=writeQueue.then(job,job);writeQueue=run.catch(()=>{});
 return run.finally(()=>{APP.pendingWrites=Math.max(0,APP.pendingWrites-1);render()})
}
function save(message='تغییرات ذخیره شد.'){render();persist().catch(showSyncFailure)}
function startWorkspace(){taskTrashSources.clear();taskTrashRecords=[];clearSubscriptions();loadPendingOps();APP.loadingWorkspace=true;APP.workspaceReadError=false;APP.syncError='';const admin=isAdmin(),uid=APP.user.uid;APP.readsReady=true;
 if(admin)listenQuery('projects','projects',collection(db,'projects'),'projects');else if(APP.profile.projects.length){for(const pid of APP.profile.projects)listenDocument('projects','project-'+pid,doc(db,'projects',pid),'projects')}else{syncSource('projects','projects',[],'projects')}
 if(admin)listenQuery('users','users',collection(db,'users'),'users');else listenDocument('users','users-self',doc(db,'users',uid),'users');
 if(admin)listenQuery('requests','requests',query(collection(db,'membershipRequests'),where('status','==','pending')),'membershipRequests');else listenDocument('requests','request-self',doc(db,'membershipRequests',uid),'membershipRequests');
 taskQueries('tasks');taskQueries('recurrenceInstances');
 if(admin){listenQuery('recurrences','recurrences-team',query(collection(db,'recurrences'),where('visibility','==','team')),'recurrences');if(isAdmin())listenQuery('recurrences','recurrences-private',query(collection(db,'recurrences'),where('visibility','==',isSystemOwner()?'owner_private':'manager_private'),where('assigneeUid','==',uid)),'recurrences');listenQuery('evaluations','evaluations',collection(db,'evaluations'),'evaluations')}
 else{listenQuery('recurrences','recurrences-assigned',query(collection(db,'recurrences'),where('visibility','==','team'),where('assigneeUid','==',uid)),'recurrences');listenQuery('recurrences','recurrences-created',query(collection(db,'recurrences'),where('visibility','==','team'),where('createdByUid','==',uid)),'recurrences')}
 if(admin)listenQuery('deletionRequests','deletion-requests-all',collection(db,'taskDeletionRequests'),'taskDeletionRequests');
 else listenQuery('deletionRequests','deletion-requests-self',query(collection(db,'taskDeletionRequests'),where('requesterUid','==',uid)),'taskDeletionRequests');
 const hist=collection(db,'activityHistory');if(admin){listenQuery('events','history-team',query(hist,where('visibility','==','team')),'activityHistory');if(isAdmin())listenQuery('events','history-private',query(hist,where('visibility','==',isSystemOwner()?'owner_private':'manager_private'),where('ownerUid','==',uid)),'activityHistory')}
 APP.expectedReads=APP.subscriptions.length;if(admin)listenTrash();APP.readsReady=true;if(APP.expectedReads===0){APP.loadingWorkspace=false;render()}}
// Firestore listener callbacks must update the visible dashboard AFTER the first load.
// Coalesce bursts of snapshots and never wipe an active form while the user is typing.
let liveViewRefreshQueued=false,liveViewRefreshPending=false;
function cardHasPendingDraft(){return [...document.querySelectorAll('[data-task-card]')].some(card=>{const id=card.dataset.taskCard,t=D.tasks.find(x=>x.id===id);if(!t)return false;return [...card.querySelectorAll('[data-inline-field]')].some(f=>f.dataset.inlineField==='note'?!!f.value.trim():f.dataset.inlineField==='status'&&f.value!==t.status)})}
function refreshFromFirestore(){
 if(!APP.approved||APP.loadingWorkspace)return;
 if(cardHasPendingDraft()){
  const notice=document.querySelector('.v23-command');
  if(notice&&!notice.querySelector('.v23-remote-notice'))notice.insertAdjacentHTML('afterbegin','<div class="v23-remote-notice" role="status">اطلاعات جدید از Firebase دریافت شد. تغییرات نوشته‌شده تو حفظ می‌شوند؛ قبل از ذخیره، تعارض احتمالی بررسی خواهد شد.</div>');
  liveViewRefreshPending=true;return;
 }
 liveViewRefreshPending=true;
 if(liveViewRefreshQueued)return;
 liveViewRefreshQueued=true;
 requestAnimationFrame(()=>{
  liveViewRefreshQueued=false;
  if(!liveViewRefreshPending||APP.loadingWorkspace||!APP.approved||U.modal)return;
  const focused=document.activeElement;
  if(focused&&focused.matches?.('input,textarea,select,[contenteditable="true"]'))return;
  liveViewRefreshPending=false;
  render();
 });
}
document.addEventListener('focusout',()=>{if(liveViewRefreshPending&&!U.modal){requestAnimationFrame(()=>{if(liveViewRefreshPending&&!U.modal)refreshFromFirestore()})}});
function clearSubscriptions(){for(const stop of APP.subscriptions){try{stop()}catch{}}APP.workspaceReadError=false;APP.subscriptions=[];APP.sources={};APP.remotePaths={};APP.expectedReads=0;APP.readyReads=0;APP.readyReadSet=new Set();APP.sourceServerReady=new Set();APP.readsReady=false;APP.generationStarted=false;D=blank();remoteD=blank()}
function listenQuery(key,source,ref,collectionName){APP.expectedReads++;const unsub=onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache)APP.sourceServerReady.add(source);const rows=snap.docs.map(d=>normalizeDocument(key,d));syncSource(key,source,rows,collectionName);noteReadReady(source);refreshFromFirestore()},err=>{APP.workspaceReadError=true;APP.syncError=err.message||'خطای همگام‌سازی';noteReadReady(source);render()});APP.subscriptions.push(unsub)}
function listenDocument(key,source,ref,collectionName){APP.expectedReads++;const unsub=onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache)APP.sourceServerReady.add(source);syncSource(key,source,snap.exists()?[normalizeDocument(key,snap)]:[],collectionName);noteReadReady(source);refreshFromFirestore()},err=>{APP.workspaceReadError=true;APP.syncError=err.message||'خطای همگام‌سازی';noteReadReady(source);render()});APP.subscriptions.push(unsub)}
function reconcilePendingTaskPaths(){
 if(!APP.readsReady||APP.readyReads<APP.expectedReads||APP.sourceServerReady.size<APP.expectedReads||APP.workspaceReadError)return;
 let changed=false;
 const byId=new Map();
 for(const op of pendingOps.values())if(op.key==='tasks'){
  if(!byId.has(op.id))byId.set(op.id,[]);
  byId.get(op.id).push(op);
 }
 for(const [id,ops] of byId){
  const sources=knownTaskPaths(id),remote=(remoteD.tasks||[]).find(x=>x.id===id);
  const sets=ops.filter(op=>op.type==='set').sort((a,b)=>a.rev-b.rev);
  const deletes=ops.filter(op=>op.type==='delete');
  if(deletes.length){
   // Explicit manager deletion wins over an older pending local edit.
   for(const op of sets){
    if(archiveRejectedTask(op,'Queued edit superseded by a manager delete')){
     pendingOps.delete(pendingOpKey(op.cname,id));changed=true;
    }
   }
   // Keep one delete for every physical document that still exists.
   for(const path of sources){
    if(!deletes.some(op=>op.cname===path)){
     stageOperation({type:'delete',key:'tasks',cname:path,id});changed=true;
    }
   }
   continue;
  }
  if(!sets.length)continue;
  const newest=sets[sets.length-1];
  // A queued occurrence is not a valid task after its parent series is gone.
  // This was a primary cause of orphaned calendar items after deletion elsewhere.
  if(newest.value?.seriesId&&!sources.length&&!remoteD.recurrences.some(r=>r.id===newest.value.seriesId)&&
     !pendingOps.has(pendingOpKey('recurrences',newest.value.seriesId))){
   for(const op of sets){
    if(archiveRejectedTask(op,'Deleted recurrence: discarded uncommitted orphaned occurrence')){
     pendingOps.delete(pendingOpKey(op.cname,id));changed=true;
    }
   }
   continue;
  }
  for(const op of sets.slice(0,-1)){
   if(op.cname===newest.cname)continue;
   if(archiveRejectedTask(op,'Duplicate queued task path')){
    pendingOps.delete(pendingOpKey(op.cname,id));changed=true;
   }
  }
  if(!sources.length&&!newest.createOnly){
   if(archiveRejectedTask(newest,'Old edit whose task is no longer present on the server')){
    pendingOps.delete(pendingOpKey(newest.cname,id));changed=true;
   }
   continue;
  }
  const canonical=sources.length===1?sources[0]:
   (sources.includes('recurrenceInstances')&&(remote?.seriesId||newest.value?.seriesId)?'recurrenceInstances':sources[0]);
  if(canonical&&newest.cname!==canonical){
   if(archiveRejectedTask(newest,'Corrected stale physical collection from '+newest.cname+' to '+canonical)){
    pendingOps.delete(pendingOpKey(newest.cname,id));
    stageOperation({...newest,cname:canonical,createOnly:false});changed=true;
   }
  }
 }
 if(changed){persistPendingOps();D.tasks=applyPendingOverlay('tasks',remoteD.tasks||[])}
}
function syncSource(key,source,rows,collectionName){
 APP.sources[key]||={};APP.sources[key][source]=rows;
 const all=Object.values(APP.sources[key]).flat(),map=new Map(all.map(x=>[x.id,x]));
 const merged=[...map.values()];
 if(key==='tasks'){
  for(const old of remoteD.tasks||[])delete APP.remotePaths[old.id];
  // Previously this assigned the most recent listener's collection to ALL
  // merged tasks. That caused the same ID to be written to two collections.
  for(const [listener,entries] of Object.entries(APP.sources.tasks)){
   const physical=listener.startsWith('recurrenceInstances-')?'recurrenceInstances':'tasks';
   for(const entry of entries){
    const current=APP.remotePaths[entry.id];
    if(!current||current===physical||physical==='recurrenceInstances'&&entry.seriesId)
     APP.remotePaths[entry.id]=physical;
   }
  }
  remoteD.tasks=copy(merged);
  const resolved=new Set((D.deletionRequests||[]).filter(r=>r.status==='resolved'&&r.requesterUid===APP.user?.uid).map(r=>r.taskId));
  D.tasks=applyPendingOverlay('tasks',merged.filter(t=>!resolved.has(t.id)));
  if(resolved.size)D.tasks=D.tasks.filter(t=>!resolved.has(t.id));
  reconcilePendingTaskPaths();
 }else if(key==='permissions'){
  D.permissions=rows[0]?.permissions||PERMS();remoteD.permissions=copy(D.permissions)
 }else{
  remoteD[key]=copy(merged);D[key]=applyPendingOverlay(key,merged)
 }
 if(key!=='tasks'&&collectionName)for(const x of merged)APP.remotePaths[x.id]=collectionName;
 if(key==='deletionRequests'&&!isAdmin()){
  const resolved=new Set(merged.filter(r=>r.status==='resolved'&&r.requesterUid===APP.user?.uid).map(r=>r.taskId));
  if(resolved.size){
   let changed=false;
   for(const [key,op] of [...pendingOps])if(op.key==='tasks'&&resolved.has(op.id)){
    archiveRejectedTask(op,'Administrator approved permanent removal');
    pendingOps.delete(key);changed=true;
   }
   if(changed)persistPendingOps();
   D.tasks=applyPendingOverlay('tasks',(remoteD.tasks||[]).filter(t=>!resolved.has(t.id))).filter(t=>!resolved.has(t.id));
  }
 }
 if(key==='users'&&!isAdmin()){
  const mine=merged.find(x=>x.id===APP.user?.uid);
  if(mine&&mine.status==='disabled'){
   APP.status='disabled';APP.approved=false;APP.profile=mine;clearSubscriptions();
   APP.loading=false;APP.loadingWorkspace=false;render()
  }
 }
}
function noteReadReady(name){
 APP.readyReadSet||=new Set();
 if(!APP.readyReadSet.has(name)){APP.readyReadSet.add(name);APP.readyReads=APP.readyReadSet.size}
 if(APP.readsReady&&APP.readyReads>=APP.expectedReads){
  const wasLoading=APP.loadingWorkspace;APP.loadingWorkspace=false;
  if(wasLoading&&!APP.workspaceReadError)APP.syncError='';
  if(wasLoading){reconcilePendingTaskPaths();render()}
  if(!APP.generationStarted&&!APP.workspaceReadError&&APP.sourceServerReady.size===APP.expectedReads){
   APP.generationStarted=true;const n=generateDue();
   if(n||pendingOps.size)persist().catch(reportBackgroundSyncFailure)
  }
 }
}
function taskQueries(collectionName){const col=collection(db,collectionName),uid=APP.user.uid;if(isAdmin()){listenQuery('tasks',collectionName+'-team',query(col,where('visibility','==','team')),collectionName);if(isAdmin())listenQuery('tasks',collectionName+'-private',query(col,where('visibility','==',isSystemOwner()?'owner_private':'manager_private'),where('assigneeUid','==',uid)),collectionName)}else{listenQuery('tasks',collectionName+'-assigned',query(col,where('visibility','==','team'),where('assigneeUid','==',uid)),collectionName);listenQuery('tasks',collectionName+'-created',query(col,where('visibility','==','team'),where('createdByUid','==',uid)),collectionName)}}
function toFirestore(key,value){const {id,...x}=value,p={...x};if(key==='users'){p.uid=id;p.projectIds=p.projects||[];delete p.projects;p.status=p.active?'active':'disabled';delete p.active}
 if(key==='requests'){p.uid=id;p.status=p.status||'pending';p.createdAt=p.createdAt||serverTimestamp();delete p.date}
 if(key==='tasks'||key==='instances'){p.assigneeUid=p.assignee||p.assigneeUid;p.createdByUid=p.createdBy||p.createdByUid;delete p.assignee;delete p.createdBy;if(key==='tasks'&&!isProjectControlsManager()&&!isSystemOwner())delete p.weight;if(!p.visibility)p.visibility='team'}
 if(key==='recurrences'){p.assigneeUid=p.assignee||p.assigneeUid;p.createdByUid=p.createdBy||p.createdByUid;delete p.assignee;delete p.createdBy;if(!isProjectControlsManager()&&!isSystemOwner())delete p.weight;if(!p.visibility)p.visibility='team'}
 if(key==='evaluations'){p.assigneeUid=p.assignee||p.assigneeUid;delete p.assignee}
 if(key==='events'){p.actorUid=p.actorUid||APP.user?.uid;p.by=p.by||actorName(APP.user?.uid);p.at=serverTimestamp()}
 return p}
function reportBackgroundSyncFailure(err){
 APP.syncError=err?.message||'ذخیره در Firebase انجام نشد';
 persistPendingOps();
 console.warn('PCH pending writes need attention; Firestore rejected a write',
  err?.failures?.map(f=>({path:`${f.op.cname}/${f.op.id}`,type:f.op.type,code:f.error?.code,message:f.error?.message}))||err);
 render();
}
function showSyncFailure(err){
 reportBackgroundSyncFailure(err);
 const count=pendingOps.size;
 // Do not obscure page content with a wall of internal Firebase errors.
 toast(`ذخیره آنلاین ناموفق: ${lastWriteFailures[0]?.collection||'Firestore'} (${lastWriteFailures[0]?.code||'خطای نامشخص'}). ${num(count)} تغییر محفوظ است؛ گزارش خطا در «بیشتر».`,true);
}

function syncStatusPill(){const text=!navigator.onLine?'بدون اینترنت':APP.syncError?'ذخیره ناموفق · تلاش دوباره':APP.pendingWrites?'در حال ذخیره':APP.loadingWorkspace||APP.sourceServerReady?.size<APP.expectedReads?'در انتظار اتصال سرور':'همگام';const cls=!navigator.onLine||APP.syncError?'sync-bad':APP.pendingWrites||APP.loadingWorkspace||APP.sourceServerReady?.size<APP.expectedReads?'sync-wait':'sync-ok';return `<button type="button" class="sync-status ${cls}" ${APP.syncError?'data-action="retry-sync"':''} role="status" aria-live="polite" title="${esc(APP.syncError||text)}"><i></i><span>${text}</span></button>`}
const adminNav=[['dashboard','grid','نمای کلی'],['mine','lock','کارهای من'],['projects','briefcase','پروژه‌ها'],['tasks','tasks','وظایف تیم'],['recurring','refresh','تعهدات دوره‌ای'],['performance','chart','ارزیابی عملکرد'],['users','users','کاربران و درخواست‌ها'],['panels','layers','پنل‌ها'],['reports','file','گزارش‌ها و پشتیبان'],['more','dots','بیشتر']];
const adminPages={systemLog:'لاگ سیستم',dashboard:'نمای کلی',mine:'کارهای شخصی من',projects:'پروژه‌ها',tasks:'وظایف تیم',recurring:'تعهدات دوره‌ای',performance:'ارزیابی عملکرد',users:'کاربران و درخواست‌ها',panels:'پنل‌ها',reports:'گزارش‌ها',more:'بیشتر'};
const roleNav=[['home','grid','خانه'],['tasks','tasks','کارهای من'],['recurring','refresh','کارهای تکراری'],['profile','user','حساب کاربری'],['more','dots','بیشتر']];
function sidebar(){let isRole=!!U.preview,list=isRole?roleNav:adminNav,sel=isRole?U.roleTab:U.page;
 const adminTitle=isSystemOwner()?'ادمین سیستم':'مدیر کنترل پروژه';const displayName=actorName(APP.user?.uid);
 return `<aside class="sidebar ${U.mobileNav?'open':''}"><div class="brand"><img class="brand-logo-img" src="./pch-logo.png" alt="Project Controls Hub"><div><div class="brand-title">Project Controls Hub <small>PCH</small></div><div class="brand-sub">مرکز مدیریت کنترل پروژه</div></div></div><div class="nav-label">${isRole?'پنل کاربری':adminTitle}</div><div class="nav-list">${list.map(([k,ic,txt])=>`<button class="nav-item ${sel===k?'active':''}" data-nav="${k}">${icon(ic,18)}<span>${txt}</span>${!isRole&&k==='users'&&D.requests.length?`<span class="nav-badge">${num(D.requests.length)}</span>`:''}</button>`).join('')}</div><div class="side-bottom"><div class="side-profile">${avatar(isRole?actorName(U.actor):displayName)}<div><strong>${isRole?esc(actorName(U.actor)):esc(displayName)}</strong><small>${isRole?roles[U.preview]:adminTitle}</small></div></div>${B('خروج از حساب','sign-out','sm')}</div></aside>`}

function topbar(){const mode=readPalette()==='classic'?readTheme():'dark',nextMode=mode==='dark'?'light':'dark';return `<header class="topbar"><div class="pch-header-brand"><img class="header-logo" src="./pch-logo.png" alt="Project Controls Hub"><div class="pch-header-copy"><strong>Project Controls Hub</strong><small>مرکز مدیریت کنترل پروژه</small></div></div><div class="top-actions"><button type="button" class="theme-switch" data-action="toggle-theme-mode" aria-label="تغییر به حالت ${nextMode==='dark'?'تیره':'روشن'}" title="تغییر به حالت ${nextMode==='dark'?'تیره':'روشن'}">${icon(nextMode==='dark'?'moon':'sun',16)}<span>${nextMode==='dark'?'تیره':'روشن'}</span></button>${B('خروج','sign-out','sm')}</div></header>`}
function mobileBottomNav(){const isRole=!!U.preview,active=isRole?U.roleTab:U.page;
 const entries=isRole?[
 ['home','home','خانه','nav'],['tasks','tasks','کارهای من','nav'],['recurring','calendar','تعهدات','nav'],['more','dots','بیشتر','nav']]:[
 ['dashboard','home','خانه','nav'],['tasks','tasks','وظایف','nav'],['recurring','calendar','تعهدات دوره‌ای','nav'],['performance','chart','ارزیابی','nav'],['more','dots','بیشتر','nav']];
 return `<nav class="pch-bottom-nav" aria-label="نوار اصلی برنامه">${entries.map(([key,ic,name,mode])=>`<button type="button" class="pch-bottom-item ${active===key?'active':''} ${mode==='action'?'bottom-create':''}" ${mode==='action'?'data-action="new-task"':`data-nav="${key}"`} aria-label="${name}" ${active===key?'aria-current="page"':''}>${icon(ic,21)}<span>${name}</span></button>`).join('')}</nav>`;
}
function adminShell(){return `<div class="shell">${sidebar()}${U.mobileNav?'<div class="mobile-overlay" data-action="toggle-menu"></div>':''}<div class="main-shell">${topbar()}<main class="content">${renderAdmin()}</main>${mobileBottomNav()}</div></div>`}
function roleShell(){return `<div class="shell">${sidebar()}${U.mobileNav?'<div class="mobile-overlay" data-action="toggle-menu"></div>':''}<div class="main-shell">${topbar()}<main class="content">${renderRole()}</main>${mobileBottomNav()}</div></div>`}
const heading=(title,subtitle,actions='')=>`<div class="page-heading"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div><div class="heading-actions">${actions}</div></div>`;
const stat=(label,value,ic,kind,desc='')=>`<div class="kpi ${kind}"><div class="ki">${icon(ic,20)}</div><div class="num">${num(value)}</div><div class="kt">${label}</div><div class="subnote">${desc}</div></div>`;
function themeChooser(){
 const palette=readPalette(),mode=readTheme();
 const options=[
  ['classic','تم فعلی','سبز کلاسیک، با حالت روشن و تیره'],
  ['navy','مشکی ـ سرمه‌ای','تیره با جزئیات آبی سرمه‌ای'],
  ['gold','مشکی ـ طلایی','تیره با جزئیات طلایی']
 ];
 const cards=options.map(([id,title,desc])=>`<button type="button" data-action="set-palette" data-id="${id}" class="theme-option ${palette===id?'selected':''}" aria-pressed="${palette===id}"><span class="theme-swatch theme-swatch-${id}"><i></i><i></i><i></i></span><span class="theme-option-text"><strong>${title}</strong><small>${desc}</small></span><span class="theme-choice-state">${palette===id?icon('check',18):''}</span></button>`).join('');
 return `<section class="panel theme-settings" aria-label="انتخاب ظاهر برنامه"><div class="panel-title"><h2>ظاهر و تم برنامه</h2><small>انتخاب شما در همین مرورگر ذخیره می‌شود</small></div><div class="theme-options">${cards}</div>${palette==='classic'?`<div class="theme-mode-wrap"><span>حالت نمایش تم فعلی</span><div class="theme-mode-buttons"><button type="button" class="btn ${mode==='light'?'mode-selected':''}" data-action="set-theme-mode" data-id="light" aria-pressed="${mode==='light'}">${icon('sun',15)} روشن</button><button type="button" class="btn ${mode==='dark'?'mode-selected':''}" data-action="set-theme-mode" data-id="dark" aria-pressed="${mode==='dark'}">${icon('moon',15)} تیره</button></div></div>`:''}</section>`;
}
function installAppRow(){return pwaInstalled()?'':`<button class="more-menu-row" data-action="install-app"><span class="more-menu-icon">${icon('download',21)}</span><span class="more-menu-copy"><b>نصب اپلیکیشن</b><small>افزودن برنامه به صفحهٔ اصلی گوشی</small></span>${icon('back',18)}</button>`}
function recoverySyncRow(){
 let conflicts=0;try{conflicts=JSON.parse(localStorage.getItem(conflictStoreKey())||'[]').length}catch{}
 if(!pendingOps.size&&!APP.syncError&&!conflicts)return '';
 const text=pendingOps.size?`${num(pendingOps.size)} تغییر در انتظار ذخیره`:'بررسی اتصال به Firebase';
 return `${pendingOps.size||APP.syncError?`<button class="more-menu-row" data-action="retry-sync"><span class="more-menu-icon">${icon('refresh',20)}</span><span class="more-menu-copy"><b>تلاش دوباره برای ذخیره آنلاین</b><small>${text}؛ اطلاعات حذف نشده‌اند</small></span>${icon('back',18)}</button>
 <button class="more-menu-row" data-action="export-sync-report"><span class="more-menu-icon">${icon('file',20)}</span><span class="more-menu-copy"><b>دریافت گزارش خطای ذخیره</b><small>مسیر، نوع عملیات و کد خطا؛ بدون رمز عبور</small></span>${icon('back',18)}</button>`:''}
 <button class="more-menu-row" data-action="backup-sync-recovery"><span class="more-menu-icon">${icon('download',20)}</span><span class="more-menu-copy"><b>دریافت پشتیبان تغییرات و تعارض‌ها</b><small>فایل بازیابی برای بررسی موارد ذخیره‌نشده یا حذف‌شده در دستگاه دیگر</small></span>${icon('back',18)}</button>`;
}
function exportSyncReport(){
 const report={app:'PCH',clientVersion:'2026-11-24-v22',firebaseProject:firebaseConfig.projectId,
  role:APP.role||'unknown',generatedAt:new Date().toISOString(),online:navigator.onLine,
  pending:[...pendingOps.values()].map(op=>({collection:op.cname,documentId:op.id,kind:op.type,createOnly:!!op.createOnly,seriesId:op.value?.seriesId||null,status:op.value?.status||null,knownCollections:op.key==='tasks'?knownTaskPaths(op.id):[],hasCreatedBy:typeof op.value?.createdBy==='string'||typeof op.value?.createdByUid==='string',hasAssignee:typeof op.value?.assignee==='string'||typeof op.value?.assigneeUid==='string'})),
  archivedConflictCount:(()=>{try{return JSON.parse(localStorage.getItem(conflictStoreKey())||'[]').length}catch{return 0}})(),
  readError:!!APP.workspaceReadError,failures:lastWriteFailures,syncError:APP.syncError||null};
 download('pch-sync-diagnostics-v22.json',JSON.stringify(report,null,2),'application/json;charset=utf-8');
}
function adminMorePage(){const items=[
 ['duties','file','شرح وظایف کنترل پروژه','مشاهده فهرست کامل سرپرست و کارشناس (فقط خواندنی)'],
 ['projects','briefcase','مدیریت پروژه‌ها','ثبت پروژه و تخصیص نیرو'],
 ['users','users','کاربران و دسترسی‌ها','تأیید درخواست عضویت و تعیین سمت'],
 ['panels','layers','پنل‌ها','کارکردن با محیط سرپرست، ارشد، کارشناس و کارآموز'],
 ['trash','trash','سطل زباله','بازیابی و حذف دائمی وظایف'],
 ['reports','download','گزارش‌ها و پشتیبان','خروجی و حفاظت از سوابق محلی'],
 ['systemLog','file','لاگ سیستم','تاریخچه ثبت و تغییر اطلاعات در سامانه']
 ];return `${heading('بیشتر','سایر امکانات و تنظیمات حساب مدیریتی شما')}<div class="panel more-menu">${items.map(([page,ic,name,desc])=>`<button class="more-menu-row" data-nav="${page}"><span class="more-menu-icon">${icon(ic,21)}</span><span class="more-menu-copy"><b>${name}</b><small>${desc}</small></span>${icon('back',18)}</button>`).join('')}${installAppRow()}${recoverySyncRow()}</div>`}
function roleMorePage(){const accessToDutyList=['supervisor','expert'].includes(U.preview);
 return `${heading('بیشتر','')}<div class="panel more-menu"><button class="more-menu-row" data-nav="profile"><span class="more-menu-icon">${icon('user',21)}</span><span class="more-menu-copy"><b>حساب کاربری</b><small>سمت و پروژه‌های قابل دسترس</small></span>${icon('back',18)}</button>${accessToDutyList?`<button class="more-menu-row" data-nav="duties"><span class="more-menu-icon">${icon('file',21)}</span><span class="more-menu-copy"><b>شرح وظایف ${roles[U.preview]}</b><small>فهرست کامل مسئولیت‌ها و تناوب‌ها؛ فقط برای مطالعه</small></span>${icon('back',18)}</button>`:''}${installAppRow()}${recoverySyncRow()}</div>`}
function dutiesPage(){
 const managerial=isAdmin();const activeRole=managerial?U.dutyRole:(U.preview==='supervisor'?'supervisor':'expert');
 const groups=ROLE_DUTIES[activeRole]||[],count=groups.reduce((n,group)=>n+group[1].length,0);
 return `${heading('شرح وظایف کنترل پروژه','فهرست مرجع، فقط قابل مشاهده؛ برای ثبت وظیفه به بخش «وظایف» مراجعه کنید.')}
 ${managerial?`<div class="duty-role-tabs"><button type="button" data-action="duty-show-supervisor" class="btn ${activeRole==='supervisor'?'primary':''}">وظایف سرپرست</button><button type="button" data-action="duty-show-expert" class="btn ${activeRole==='expert'?'primary':''}">وظایف کارشناس</button></div>`:''}
 <div class="panel duty-directory"><div class="panel-title"><h2>وظایف ${activeRole==='supervisor'?'سرپرست':'کارشناس'} کنترل پروژه</h2><small>${num(count)} شرح وظیفه</small></div>
 ${groups.map(([period,items])=>`<section class="duty-group"><h3>${esc(period)} <span>${num(items.length)} مورد</span></h3><ol>${items.map(title=>`<li>${esc(title)}</li>`).join('')}</ol></section>`).join('')}</div>`
}
function renderAdmin(){if(U.page==='settings')U.page='dashboard';return ({systemLog:systemLogPage,dashboard:dashboardPage,mine:managerTasksPage,projects:projectsPage,tasks:tasksHubPage,recurring:recurringPage,performance:performancePage,users:usersPage,panels:panelsPage,reports:reportsPage,trash:trashPage,more:adminMorePage,duties:dutiesPage})[U.page]()}
function adminTasks(){return D.tasks}
function actorTasks(){return D.tasks.filter(t=>canSeeTask(t))}
function dashboardPage(){
 const all=teamTasks(),mine=myManagerTasks(),overdue=all.filter(dueLate).sort((a,b)=>a.due.localeCompare(b.due)),cs=countStatuses(all);
 const stoppedOrOverdue=all.filter(t=>t.status==='blocked'||dueLate(t)).length;
 const bars=D.projects.map(p=>({p,t:all.filter(t=>t.projectId===p.id)}));
 const lateRows=U.showAllOverdue?overdue:overdue.slice(0,8);
 return `${heading(isSystemOwner()?'داشبورد ادمین سیستم':'داشبورد مدیر کنترل پروژه','')}
 <div class="kpi-grid pch-dash-kpis">
 ${stat('وظایف کارکنان',all.length,'tasks','blue','کل وظایف تیم')}
 ${stat('در انتظار پاسخ دیگران',cs.review,'clock','amber','نیازمند پیگیری')}
 ${stat('کارهای خاتمه‌یافته تیم',cs.done,'check','green','انجام‌شده')}
 ${stat('متوقف یا تأخیردار',stoppedOrOverdue,'alert','red','موارد نیازمند اقدام')}
 ${stat('کارهای به تأخیر افتاده کارکنان',overdue.length,'alert','red','دارای موعد گذشته')}
 ${stat('کارهای در حال انجام',cs.doing,'refresh','blue','در حال پیگیری')}
 </div>
 <section class="panel overdue-management"><div class="panel-title"><h2>${icon('clock',18)} کارهای عقب‌افتاده</h2>${pill(num(overdue.length)+' مورد','red')}</div>
 ${overdue.length?`<div class="overdue-list">${lateRows.map(t=>`<article class="overdue-item"><div class="overdue-main"><strong>${esc(t.title)}</strong><span>${esc(projectName(t.projectId))} · مسئول: ${esc(actorName(t.assignee))}</span><small>سررسید: ${jstr(t.due)}</small></div><div class="overdue-meta"><b>${num(calendarDiff(t.due,isoToday()))} روز تأخیر</b>${B('جزئیات','task-detail','sm',`data-id="${esc(t.id)}"`)}</div></article>`).join('')}</div>${overdue.length>8?`<button class="btn overdue-toggle" data-action="toggle-overdue">${U.showAllOverdue?'نمایش کمتر':`نمایش همه ${num(overdue.length)} مورد`}</button>`:''}`:empty('کار عقب‌افتاده‌ای وجود ندارد','همه وظایف موعدرسیده انجام شده‌اند یا هنوز به سررسید نرسیده‌اند.')}</section>
 <div class="two-col"><section class="panel"><div class="panel-title"><h2>آخرین فعالیت‌های کارکنان</h2><button class="link-button" data-nav="tasks">نمایش همه</button></div>${all.length?all.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,7).map(taskSummary).join(''):empty('فعالیتی از کارکنان ثبت نشده','برای تعریف فعالیت به بخش «وظایف» مراجعه کن.')}</section><div class="stack"><section class="panel"><div class="panel-title"><h2>وضعیت کارهای تیم</h2></div>${donut(cs,all.length)}</section><section class="panel"><div class="panel-title"><h2>پیشرفت وظایف پروژه‌ها</h2></div>${bars.length?bars.map(o=>`<div class="project-list-item"><div class="row-flex between"><b>${esc(o.p.name)}</b><span class="hint">${num(o.t.filter(t=>t.status==='done').length)} از ${num(o.t.length)} فعالیت</span></div><div class="progress" style="margin-top:8px"><span style="width:${pct(o.t.filter(t=>t.status==='done').length,o.t.length)}%"></span></div></div>`).join(''):empty('پروژه‌ای تعریف نشده','برای مدیریت پروژه‌محور، پروژه تعریف کن.','new-project','افزودن پروژه')}</section></div></div>
 <section class="panel" style="margin-top:18px"><div class="panel-title"><h2>${icon('lock',18)} کارهای شخصی من</h2><button class="link-button" data-action="show-private-tasks">مشاهده در وظایف</button></div><p class="hint">${num(mine.length)} فعالیت خصوصی · ${num(mine.filter(t=>t.status!=='done').length)} باز · خارج از ارزیابی تیم</p>${mine.length?`<div style="margin-top:14px">${mine.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,4).map(t=>`<div class="task-row"><div class="task-icon blue">${icon('lock',16)}</div><div class="grow"><div class="task-title">${esc(t.title)}</div><div class="task-meta">موعد ${jstr(t.due)} · ${esc(projectName(t.projectId))}</div></div>${pill(taskStatus(t),statusColor[t.status])}</div>`).join('')}</div>`:''}</section>`;
}
function donut(cs,total){const parts=[['done','#15a98c'],['doing','#3973e6'],['review','#ecac43'],['blocked','#e96675'],['todo','#afbac9']];let accum=0,segments=[];for(const [key,c] of parts){const x=total?cs[key]/total*100:0;if(x){segments.push(`${c} ${accum}% ${accum+x}%`);accum+=x}}return `<div class="status-summary"><div class="donut" style="background:${total?`conic-gradient(${segments.join(',')})`:'#e9eef5'}"><div class="donut-core"><strong>${num(total)}</strong><span>فعالیت</span></div></div><div class="legend-stack">${parts.map(([k,c])=>`<div><span style="background:${c}" class="legend-swatch"></span>${statuses[k]} <b>${num(cs[k])}</b></div>`).join('')}</div></div>`}
function taskSummary(t){return `<div class="task-row"><div class="task-icon ${t.status==='blocked'?'red':'blue'}">${icon('tasks',16)}</div><div class="grow"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(actorName(t.assignee))} · ${esc(projectName(t.projectId))} · موعد ${jstr(t.due)}</div></div>${pill(taskStatus(t),statusColor[t.status])}</div>`}
function projectsPage(){return `${heading('پروژه‌ها','تعریف پروژه و استفاده از آن هنگام ثبت وظایف',B(icon('plus',15)+' پروژه جدید','new-project','primary'))}${D.projects.length?`<div class="section-tiles">${D.projects.map(p=>{const ts=teamTasks().filter(t=>t.projectId===p.id),done=ts.filter(t=>t.status==='done').length,people=D.users.filter(u=>u.projects.includes(p.id));return `<div class="project-card"><div class="project-head"><div class="project-main"><div class="project-mini-icon">${icon('briefcase',22)}</div><div><h3>${esc(p.name)}</h3><p>${esc(p.code||'بدون کد')} · ${esc(p.location||'مکان نامشخص')}</p></div></div></div><div class="row-flex between"><span class="hint">${num(ts.length)} فعالیت · ${num(people.length)} کاربر</span><b>${num(pct(done,ts.length))}٪</b></div><div class="progress" style="margin:12px 0"><span style="width:${pct(done,ts.length)}%"></span></div><div class="row-flex between"><button class="btn sm" data-action="show-project-tasks" data-id="${p.id}">وظایف پروژه</button><div class="row-flex"><button class="btn sm" data-action="edit-project" data-id="${p.id}">${icon('edit',14)} ویرایش</button><button class="btn sm danger" data-action="delete-project" data-id="${p.id}" title="حذف پروژه">${icon('trash',14)}</button></div></div></div>`}).join('')}</div>`:empty('هنوز پروژه‌ای وجود ندارد','ثبت فعالیت بدون پروژه هم امکان‌پذیر است.','new-project','افزودن پروژه')}`}
// V23 task command center: view state is intentionally not persisted.
let taskTrashRecords=[];
const taskDraftKey=t=>String(t?.id||'');
function taskPriorityRank(t){if(dueLate(t))return 0;return ({blocked:1,review:1,doing:2,todo:3,done:4})[t.status]??5}
function taskDefaultSort(a,b){return taskPriorityRank(a)-taskPriorityRank(b)||String(a.due||'').localeCompare(String(b.due||''))||String(a.title||'').localeCompare(String(b.title||''))}
function taskFilteredList(rows,privateView=false){
 let arr=rows.filter(t=>(U.filterProject==='all'||t.projectId===U.filterProject)&&(U.filterStatus==='all'||t.status===U.filterStatus)&&(privateView||U.taskPerson==='all'||t.assignee===U.taskPerson)&&(!U.filterText||[t.title,t.description,actorName(t.assignee),projectName(t.projectId)].join(' ').includes(U.filterText)));
 arr=arr.filter(t=>U.taskQuick==='all'||(U.taskQuick==='late'?dueLate(t):t.status===U.taskQuick));
 if(U.taskSort==='new')arr.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
 else if(U.taskSort==='due')arr.sort((a,b)=>String(a.due||'').localeCompare(String(b.due||'')));
 else if(U.taskSort==='late')arr.sort((a,b)=>(dueLate(b)?calendarDiff(b.due,isoToday()):0)-(dueLate(a)?calendarDiff(a.due,isoToday()):0));
 else arr.sort(taskDefaultSort);return arr;
}
function taskStatsBar(all){const figures=[['all','کل وظایف',all.length],['doing','در حال انجام',all.filter(t=>t.status==='doing').length],['late','عقب‌افتاده',all.filter(dueLate).length],['done','خاتمه‌یافته',all.filter(t=>t.status==='done').length]];return `<div class="v23-statbar">${figures.map(([key,name,n])=>`<button type="button" data-action="task-quick" data-id="${key}" class="v23-stat ${U.taskQuick===key?'selected':''}"><b>${num(n)}</b><span>${name}</span></button>`).join('')}</div>`}
function taskFilterPanel(rows,privateView=false){return `<div class="v23-filter-head"><div class="v23-search-wrap">${icon('search',17)}<input id="task-query" class="field" value="${esc(U.filterText)}" placeholder="جستجوی وظیفه، پروژه یا مسئول..." aria-label="جستجوی وظایف"></div>${B(icon('settings',16)+' فیلترها','toggle-task-filter','v23-filter-btn')}</div>${U.taskFilterOpen?`<div class="v23-filter-body"><label>پروژه<select class="field" data-filter="project"><option value="all">تمام پروژه‌ها</option><option value="">بدون پروژه</option>${D.projects.map(p=>`<option value="${esc(p.id)}" ${U.filterProject===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>وضعیت<select class="field" data-filter="status"><option value="all">تمام وضعیت‌ها</option>${Object.entries(statuses).map(([key,val])=>`<option value="${key}" ${U.filterStatus===key?'selected':''}>${esc(val)}</option>`).join('')}</select></label>${!privateView?`<label>مسئول<select class="field" data-task-person><option value="all">تمام کارکنان</option>${D.users.filter(u=>u.active).map(u=>`<option value="${esc(u.id)}" ${U.taskPerson===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>`:''}<label>مرتب‌سازی<select class="field" data-task-sort>${[['default','اولویت خودکار'],['new','جدیدترین'],['due','نزدیک‌ترین موعد'],['late','بیشترین تأخیر']].map(([v,l])=>`<option value="${v}" ${U.taskSort===v?'selected':''}>${l}</option>`).join('')}</select></label><label>گروه‌بندی<select class="field" data-task-group>${[['none','بدون گروه‌بندی'],['project','بر اساس پروژه'],['person','بر اساس مسئول'],['status','بر اساس وضعیت']].filter(([v])=>!privateView||v!=='person').map(([v,l])=>`<option value="${v}" ${U.taskGroup===v?'selected':''}>${l}</option>`).join('')}</select></label>${B('پاک‌کردن فیلترها','clear-filter','sm')}</div>`:''}`}
function taskGroupName(t,privateView=false){return U.taskGroup==='project'?projectName(t.projectId):U.taskGroup==='person'&&!privateView?actorName(t.assignee):U.taskGroup==='status'?taskStatus(t):'همه'}
function taskCardsMarkup(rows,privateView=false){if(!rows.length)return empty('وظیفه‌ای با این شرایط وجود ندارد','فیلترها را بررسی کن یا یک فعالیت جدید ثبت کن.');if(U.taskGroup==='none'||privateView&&U.taskGroup==='person')return `<div class="v23-cards">${rows.map(t=>taskCommandCard(t,privateView)).join('')}</div>`;const keys=[...new Set(rows.map(t=>taskGroupName(t,privateView)))];return keys.map(name=>{const group=rows.filter(t=>taskGroupName(t,privateView)===name),late=group.filter(dueLate).length;return `<details class="v23-group" open><summary><strong>${esc(name)}</strong><span>${num(group.length)} وظیفه${late?' · '+num(late)+' عقب‌افتاده':''}</span></summary><div class="v23-cards">${group.map(t=>taskCommandCard(t,privateView)).join('')}</div></details>`}).join('')}
function taskRelatedHistory(t){const ids=[t.id,t.restoredFromId].filter(Boolean);return D.events.filter(e=>ids.includes(e.entity||e.taskId)&&(!managerTask(t)||e.visibility===t.visibility)).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))}
function taskCommandCard(t,privateView=false){const expanded=U.expandedTasks.includes(t.id),late=dueLate(t),delta=late?calendarDiff(t.due,isoToday()):0,soon=t.status!=='done'&&t.due>=isoToday()&&calendarDiff(isoToday(),t.due)<=2;const history=taskRelatedHistory(t),last=history[0],canStatus=canSeeTask(t),editable=canEditTask(t),removable=canDeleteTask(t);return `<article class="v23-task ${late?'v23-late':soon?'v23-soon':''}" dir="rtl" data-task-card="${esc(t.id)}"><button class="v23-task-trigger" type="button" data-action="toggle-task-card" data-id="${esc(t.id)}" aria-expanded="${expanded}"><div class="v23-task-main"><strong>${esc(t.title)}</strong><small>${esc(projectName(t.projectId))}${privateView?'':' · '+esc(actorName(t.assignee))}</small></div><div class="v23-task-side">${late?`<span class="v23-delay">${num(delta)} روز تأخیر</span>`:soon?'<span class="v23-near">موعد نزدیک</span>':''}<span class="v23-status ${esc(t.status)}">${esc(taskStatus(t))}</span></div></button><div class="v23-task-bottom"><span>${icon('calendar',14)} ${jstr(t.due)} ${t.seriesId?icon('refresh',13):''}</span><span>${expanded?'بستن جزئیات ▲':'جزئیات و عملیات ▼'}</span></div>${expanded?`<div class="v23-expanded"><div class="v23-description"><b>شرح فعالیت</b><p>${esc(t.description||'شرحی ثبت نشده است.')}</p>${t.seriesId?`<small>نوبت تکراری · ${esc(recurrenceLabel(D.recurrences.find(r=>r.id===t.seriesId)||{frequency:'interval',intervalDays:1}))}</small>`:''}</div>${t.blockReason?`<div class="v23-stop"><b>دلیل توقف:</b> ${esc(t.blockReason)}</div>`:''}${last?`<div class="v23-last"><b>آخرین تغییر:</b> ${esc(last.by||'کاربر')} · ${esc(last.text||'تغییر فعالیت')} · ${esc(tehranMoment(last.at)?.time||'')} ${jstr(tehranMoment(last.at)?.date||'')}</div>`:''}${canStatus?`<div class="v23-edit-fields"><label>وضعیت<select class="field" data-inline-field="status" data-id="${esc(t.id)}">${Object.entries(statuses).map(([key,val])=>`<option value="${key}" ${t.status===key?'selected':''}>${val}</option>`).join('')}</select></label><label>یادداشت<textarea class="field" data-inline-field="note" data-id="${esc(t.id)}" rows="2" maxlength="1200" placeholder="یادداشت این نوبت..."></textarea></label></div>${B('ذخیره تغییرات','save-inline-task','primary v23-save',`data-id="${esc(t.id)}"`)}`:''}<details class="v23-history"><summary>تاریخچه فعالیت (${num(history.length)})</summary>${history.length?history.map(e=>`<p><strong>${esc(e.by||'کاربر')}:</strong> ${esc(e.text||'تغییر')} <small>${jstr(tehranMoment(e.at)?.date||'')} · ${esc(tehranMoment(e.at)?.time||'')}</small></p>`).join(''):'<p>سابقه‌ای ثبت نشده است.</p>'}</details><div class="v23-actions">${editable?B(icon('edit',15)+' ویرایش','edit-task','sm',`data-id="${esc(t.id)}"`):''}${removable?B(icon('trash',15)+' حذف','delete-task','sm danger',`data-id="${esc(t.id)}"`):!isAdmin()?B('درخواست حذف','request-delete-task','sm',`data-id="${esc(t.id)}"`):''}</div></div>`:''}</article>`}
function taskCommandCenter(rows,privateView=false){const filtered=taskFilteredList(rows,privateView);return `<div class="v23-command" dir="rtl">${taskStatsBar(rows)}${taskFilterPanel(rows,privateView)}<div class="v23-count">${num(filtered.length)} وظیفه نمایش داده می‌شود</div>${taskCardsMarkup(filtered,privateView)}</div>`}
async function saveInlineTask(id){const t=D.tasks.find(x=>x.id===id);if(!t||!canSeeTask(t))return toast('مجوز این فعالیت وجود ندارد.',true);const card=[...document.querySelectorAll('[data-task-card]')].find(el=>el.dataset.taskCard===id);if(!card)return;const next=card.querySelector('[data-inline-field="status"]')?.value||t.status,note=card.querySelector('[data-inline-field="note"]')?.value.trim()||'';if(next===t.status&&!note)return toast('تغییری برای ثبت وجود ندارد.');let reason='';if(next==='blocked'){reason=prompt('دلیل توقف را وارد کن:',t.blockReason||'');if(reason===null)return;if(!reason.trim())return toast('دلیل توقف الزامی است.',true)}if(!navigator.onLine)return toast('برای تأیید ذخیره به اتصال اینترنت نیاز است.',true);
 const previous=copy(t),ref=doc(db,APP.remotePaths[id]||(t.seriesId?'recurrenceInstances':'tasks'),id),btn=card.querySelector('[data-action="save-inline-task"]');if(btn)btn.disabled=true;
 try{await writeQueue;if([...pendingOps.values()].some(op=>op.key==='tasks'&&op.id===id))throw new Error('تغییر ذخیره‌نشده قبلی وجود دارد.');await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('سند روی سرور حذف شده است.');const current=snap.data();if(current.status!==previous.status||String(current.updatedAt||'')!==String(previous.updatedAt||''))throw new Error('این فعالیت در دستگاه دیگری تغییر کرده است؛ جزئیات را دوباره بازبینی کن.');const nextNotes=[...(current.notes||[])];if(note)nextNotes.push({text:note,by:actorName(APP.user.uid),date:isoToday()});if(next==='blocked')nextNotes.push({text:'دلیل توقف: '+reason.trim(),by:actorName(APP.user.uid),date:isoToday()});tx.update(ref,{status:next,updatedAt:new Date().toISOString(),submittedAt:['done','review'].includes(next)?isoToday():null,...(next==='blocked'?{blockReason:reason.trim()}:{}),...(note||next==='blocked'?{notes:nextNotes}:{})});});
 const confirmed=await getDocFromServer(ref);if(!confirmed.exists()||confirmed.data().status!==next)throw new Error('ثبت روی سرور تأیید نشد.');Object.assign(t,{status:next,updatedAt:confirmed.data().updatedAt,submittedAt:confirmed.data().submittedAt,notes:confirmed.data().notes||t.notes,...(next==='blocked'?{blockReason:reason.trim()}:{})});record('status',`تغییر وضعیت ${statuses[previous.status]} ← ${statuses[next]}${note?'؛ یادداشت ثبت شد':''}`,id);const e=D.events.at(-1);if(e)try{await setDoc(doc(db,'activityHistory',e.id),toFirestore('events',e))}catch(error){console.warn('Audit write failed',error)}toast('تغییرات روی Firebase تأیید شد.');render();
 }catch(error){toast('ذخیره انجام نشد: '+String(error.message||error),true);render()}finally{if(btn)btn.disabled=false}}
function taskRow(t){const e=D.evaluations.find(e=>e.id===t.evalId);return `<tr><td><div class="cell-task"><b>${esc(t.title)}</b>${t.seriesId?pill('دوره‌ای','purple'):''}<small>${esc(t.description||'بدون توضیحات')}</small></div></td><td>${esc(projectName(t.projectId))}</td><td>${esc(actorName(t.assignee))}</td><td>${jstr(t.due)}${dueLate(t)?` ${pill('تأخیر','red')}`:''}</td><td>${pill(taskStatus(t),statusColor[t.status])}</td><td>${e?pill(num(e.score)+' / ۱۰۰','green'):'—'}</td><td><div class="tiny-actions">${B('جزئیات','task-detail','sm',`data-id="${t.id}"`)}${B(icon('edit',14)+' ویرایش','edit-task','sm',`data-id="${t.id}"`)}${B(icon('trash',14)+' حذف','delete-task','sm danger',`data-id="${t.id}"`)}${(t.status==='review'||t.status==='done')?B(t.status==='done'?'ثبت ارزیابی':'خاتمه و ارزیابی','grade-task','sm primary',`data-id="${t.id}"`):''}</div></td></tr>`}
function deletionRequestsPanel(){
 const pending=(D.deletionRequests||[]).filter(r=>r.status==='pending');
 if(!pending.length)return '';
 return `<section class="panel" style="margin-bottom:18px"><div class="panel-title"><h2>درخواست‌های پاک‌سازی نوبت</h2>${pill(num(pending.length)+' درخواست','amber')}</div>
 <p class="hint">اگر نوبتی در پنل کارمند باقی مانده ولی در فهرست مدیریت دیده نمی‌شود، از اینجا براساس شناسهٔ همان نوبت در سرور بررسی و حذف قطعی می‌شود.</p>
 ${pending.map(r=>`<div class="request-card"><div class="request-details"><div><strong>${esc(r.title||'نوبت بدون عنوان')}</strong><p>${esc(actorName(r.requesterUid))} · ${jstr(r.due)}</p><small class="hint" dir="ltr">${esc(r.taskId)}</small></div></div><div class="row-flex">${B('حذف قطعی نوبت','resolve-deletion-request','sm danger',`data-id="${esc(r.id)}"`)}${B('رد درخواست','reject-deletion-request','sm',`data-id="${esc(r.id)}"`)}</div></div>`).join('')}
 </section>`;
}
async function requestRemovalOfTask(taskId){
 const t=D.tasks.find(x=>x.id===taskId);
 if(!t||!canSeeTask(t)||isAdmin())return toast('درخواست پاک‌سازی این مورد مجاز نیست.',true);
 if(!navigator.onLine)return toast('برای ارسال درخواست حذف به مدیر، اتصال اینترنت لازم است.',true);
 const requestId=`${APP.user.uid}_${t.id}`;
 try{
  const ref=doc(db,'taskDeletionRequests',requestId),prior=await getDocFromServer(ref);
  if(prior.exists())return toast(prior.data().status==='pending'?'درخواست این نوبت قبلاً برای مدیر ارسال شده است.':'این درخواست قبلاً تعیین تکلیف شده است.');
  await setDoc(ref,{taskId:t.id,requesterUid:APP.user.uid,assigneeUid:APP.user.uid,
   title:String(t.title||'').slice(0,130),seriesId:String(t.seriesId||''),occurrenceKey:String(t.occurrenceKey||t.due||''),
   due:String(t.due||''),status:'pending',createdAt:serverTimestamp()});
  toast('درخواست پاک‌سازی به مدیر ارسال شد.');
 }catch(err){toast('درخواست ثبت نشد: '+authMessage(err),true)}
}
async function resolveTaskRemoval(requestId,reject=false){
 if(!isAdmin())return;
 const req=(D.deletionRequests||[]).find(x=>x.id===requestId&&x.status==='pending');
 if(!req)return toast('درخواست دیگر در وضعیت انتظار نیست.',true);
 if(!reject&&!confirm(`نوبت «${req.title}» برای ${actorName(req.requesterUid)} از Firestore حذف قطعی شود؟\nدر صورت وجود دو نسخهٔ قدیمی، هر دو حذف می‌شوند و شناسه مسدود می‌شود.`))return;
 try{
  await runTransaction(db,async tx=>{
   const requestRef=doc(db,'taskDeletionRequests',requestId),taskRef=doc(db,'tasks',req.taskId),instanceRef=doc(db,'recurrenceInstances',req.taskId),deadRef=doc(db,'deletedTasks',req.taskId);
   const recurRef=req.seriesId?doc(db,'recurrences',req.seriesId):null;
   // All reads must precede any transaction writes.
   const requestSnap=await tx.get(requestRef);
   const taskSnap=reject?null:await tx.get(taskRef);
   const instanceSnap=reject?null:await tx.get(instanceRef);
   const deadSnap=reject?null:await tx.get(deadRef);
   const recurSnap=!reject&&recurRef?await tx.get(recurRef):null;
   if(!requestSnap.exists()||requestSnap.data().status!=='pending')return;
   if(!reject){
    for(const snap of [taskSnap,instanceSnap])if(snap?.exists()&&(snap.data().visibility!=='team'||(snap.data().assigneeUid!==req.requesterUid&&snap.data().createdByUid!==req.requesterUid)))throw new Error('مالک یا مسئول این فعالیت با درخواست‌کننده مطابقت ندارد.');
    const existingSource=taskSnap?.exists()?taskSnap:instanceSnap;
    if(existingSource?.exists()){
     const raw=existingSource.data();
     tx.set(doc(db,'taskTrash',req.taskId),{originalId:req.taskId,archivedAt:serverTimestamp(),deletedByUid:APP.user.uid,
      task:raw,collection:taskSnap?.exists()?'tasks':'recurrenceInstances',visibility:raw.visibility,assigneeUid:raw.assigneeUid});
    }
    if(taskSnap?.exists())tx.delete(taskRef);
    if(instanceSnap?.exists())tx.delete(instanceRef);
    if(!deadSnap.exists())tx.set(deadRef,{deleted:true,deletedAt:serverTimestamp()});
    if(recurSnap?.exists()&&recurSnap.data().visibility==='team'&&recurSnap.data().assigneeUid===req.requesterUid&&req.occurrenceKey){
     const excludes=recurSnap.data().excluded||[];
     if(!excludes.includes(req.occurrenceKey))tx.update(recurRef,{excluded:[...excludes,req.occurrenceKey]});
    }
   }
   tx.update(requestRef,{status:reject?'rejected':'resolved',reviewedByUid:APP.user.uid,reviewedAt:serverTimestamp()});
  });
  toast(reject?'درخواست رد شد.':'حذف نوبت روی سرور تأیید شد.');
 }catch(err){toast('پاک‌سازی ناموفق بود: '+authMessage(err),true)}
}
// Firestore-backed recycle bin. Tombstones are immutable, so restored tasks use a fresh ID
// and keep restoredFromId for tracing audit history and existing evaluation references.
const taskTrashSources=new Map();
function refreshTaskTrash(){const byId=new Map();for(const list of taskTrashSources.values())for(const x of list)byId.set(x.id,x);taskTrashRecords=[...byId.values()].sort((a,b)=>String(b.archivedAt?.seconds||b.archivedAt||'').localeCompare(String(a.archivedAt?.seconds||a.archivedAt||'')));if(isAdmin()&&U.page==='trash')refreshFromFirestore()}
function listenTrash(){if(!isAdmin())return;const roleVisibility=isSystemOwner()?'owner_private':'manager_private';for(const [name,q] of [['team',query(collection(db,'taskTrash'),where('visibility','==','team'))],['private',query(collection(db,'taskTrash'),where('visibility','==',roleVisibility),where('assigneeUid','==',APP.user.uid))]]){const unsub=onSnapshot(q,snap=>{taskTrashSources.set(name,snap.docs.map(d=>({...d.data(),id:d.id})));refreshTaskTrash()},err=>{console.warn('Trash listener failed',err);APP.syncError='خطا در خواندن سطل زباله: '+err.message;render()});APP.subscriptions.push(unsub)}}
async function archiveTask(taskId,quiet=false){const t=D.tasks.find(v=>v.id===taskId);if(!t||!canDeleteTask(t))return toast('مجوز حذف وجود ندارد.',true);if(!navigator.onLine)return toast('حذف فقط پس از اتصال و تأیید Firebase انجام می‌شود.',true);const taskRef=doc(db,'tasks',taskId),instanceRef=doc(db,'recurrenceInstances',taskId),marker=doc(db,'deletedTasks',taskId),archive=doc(db,'taskTrash',taskId),recRef=t.seriesId?doc(db,'recurrences',t.seriesId):null;
 try{await writeQueue;await runTransaction(db,async tx=>{const taskSnap=await tx.get(taskRef),instanceSnap=await tx.get(instanceRef),dead=await tx.get(marker),recSnap=recRef?await tx.get(recRef):null;const source=taskSnap.exists()?taskSnap:instanceSnap;if(!source.exists())throw new Error('فعالیت روی سرور پیدا نشد.');const raw=source.data();tx.set(archive,{originalId:taskId,archivedAt:serverTimestamp(),deletedByUid:APP.user.uid,task:raw,collection:source===taskSnap?'tasks':'recurrenceInstances',visibility:raw.visibility,assigneeUid:raw.assigneeUid});if(!dead.exists())tx.set(marker,{deleted:true,deletedAt:serverTimestamp()});if(taskSnap.exists())tx.delete(taskRef);if(instanceSnap.exists())tx.delete(instanceRef);if(recSnap?.exists()&&t.occurrenceKey){const excluded=recSnap.data().excluded||[];if(!excluded.includes(t.occurrenceKey))tx.update(recRef,{excluded:[...excluded,t.occurrenceKey]})}});D.tasks=D.tasks.filter(t=>t.id!==taskId);for(const [k,op] of [...pendingOps])if(op.id===taskId&&op.key==='tasks')pendingOps.delete(k);persistPendingOps();if(U.modal)closeModal();render();if(!quiet)toast('فعالیت به سطل زباله منتقل شد و حذف روی سرور تأیید شد.');return true}catch(err){toast('حذف انجام نشد: '+String(err.message||err),true);return false}}
async function restoreTrashItem(itemId){if(!isAdmin())return;const entry=taskTrashRecords.find(x=>x.id===itemId);if(!entry||!confirm('این وظیفه از سطل زباله بازیابی شود؟'))return;const newId=id('t');try{await runTransaction(db,async tx=>{const ref=doc(db,'taskTrash',itemId),snap=await tx.get(ref);if(!snap.exists())throw new Error('مورد حذف‌شده یافت نشد.');const raw={...snap.data().task};delete raw.seriesId;delete raw.occurrenceKey;delete raw.materializedByUid;raw.createdByUid=APP.user.uid;raw.restoredFromId=itemId;raw.updatedAt=new Date().toISOString();tx.set(doc(db,'tasks',newId),raw);tx.delete(ref)});toast('فعالیت با شناسه جدید بازیابی شد؛ سوابق قبلی قابل ردیابی هستند.')}catch(err){toast('بازیابی انجام نشد: '+String(err.message||err),true)}}
async function purgeTrashItem(id){if(!isAdmin()||!confirm('این عملیات دائمی است. همه یادداشت‌های ذخیره‌شده در نسخه سطل زباله حذف خواهند شد. ادامه می‌دهی؟'))return;try{await deleteDoc(doc(db,'taskTrash',id));toast('نسخه بازیابی‌پذیر حذف شد. تاریخچه مدیریتی مستقل حفظ می‌شود.')}catch(err){toast('حذف دائمی انجام نشد: '+String(err.message||err),true)}}
function trashPage(){return `${heading('سطل زباله','بازیابی یا حذف دائمی وظایف حذف‌شده')}<div class="panel">${taskTrashRecords.length?taskTrashRecords.map(e=>`<div class="v23-trash-row"><div><strong>${esc(e.task?.title||'فعالیت حذف‌شده')}</strong><p>${esc(projectName(e.task?.projectId||''))} · ${esc(actorName(e.assigneeUid))}</p><small>شناسه قبلی: ${esc(e.id)}</small></div><div class="v23-actions">${B('بازیابی','restore-trash-task','sm primary',`data-id="${esc(e.id)}"`)}${B('حذف دائمی','purge-trash-task','sm danger',`data-id="${esc(e.id)}"`)}</div></div>`).join(''):empty('سطل زباله خالی است','پس از حذف فعالیت، نسخه قابل بازیابی آن اینجا نمایش داده می‌شود.')}</div>`}
function taskHubTabs(active){return `<div class="task-hub-tabs" role="group" aria-label="نوع وظایف"><button type="button" data-action="show-team-tasks" class="btn ${active==='team'?'primary':''}" aria-pressed="${active==='team'}">${icon('users',17)} وظایف کارکنان <small>${num(teamTasks().filter(t=>t.status!=='done').length)}</small></button><button type="button" data-action="show-private-tasks" class="btn ${active==='private'?'primary':''}" aria-pressed="${active==='private'}">${icon('lock',17)} وظایف شخصی <small>${num(myManagerTasks().filter(t=>t.status!=='done').length)}</small></button></div>`}
function tasksHubPage(){return U.taskView==='private'?managerTasksPage():tasksPage()}
function tasksPage(){const rows=teamTasks();return `${heading('وظایف','مدیریت و پیگیری کارهای تیم')}${taskHubTabs('team')}<div class="task-view-top"><h2>وظایف کارکنان</h2>${B(icon('plus',15)+' ثبت وظیفه برای کارکنان','new-task','primary')}</div>${deletionRequestsPanel()}${taskCommandCenter(rows,false)}`}
function managerTasksPage(){const rows=myManagerTasks();return `${heading('وظایف','مدیریت وظایف تیم و کارهای خصوصی خودم')}${taskHubTabs('private')}<div class="task-view-top"><h2>وظایف شخصی من</h2>${B(icon('plus',15)+' ثبت وظیفه شخصی','new-own-task','primary')}</div><p class="v23-private-note">${icon('lock',15)} این وظایف فقط برای حساب خودت قابل مشاهده هستند.</p>${taskCommandCenter(rows,true)}`}
function recurrenceLabel(r){if(r.frequency==='ongoing')return 'ثبت قدیمی (بدون تکرار)';if(r.frequency==='interval')return `هر ${num(r.intervalDays||1)} روز ${r.intervalBasis==='work'?'کاری':'تقویمی'}`;if(r.frequency==='daily')return r.workOnly?'روزانه، به‌جز جمعه':'روزانه، همه روزها';if(r.frequency==='weekly')return `هر ${DW[r.weekday]}`;return r.monthDay==='lastWork'?'آخرین روز کاری هر ماه شمسی':`روز ${toFa(r.monthDay)} هر ماه شمسی`}
function recurringPage(){const rows=D.recurrences.filter(r=>isAdmin()||(!managerRecurring(r)&&(r.assignee===U.actor||r.createdBy===U.actor)));return `${heading(isAdmin()?'تعهدات دوره‌ای':'کارهای تکراری من','برنامه‌ها و نوبت‌های روزانه، هفتگی و ماهانه؛ با سابقه مستقل هر اجرا',B(icon('plus',15)+(isAdmin()?'تعریف برنامه تکراری':'درخواست برنامه تکراری'),'new-recurring','primary')+(isAdmin()?B(icon('lock',15)+' برنامه خصوصی','new-own-recurring') :''))}<div class="mini-stat-row">${stat('برنامه فعال',rows.filter(r=>r.state==='active').length,'refresh','blue')}${stat('در انتظار تأیید',rows.filter(r=>r.state==='pending').length,'clock','amber')}${stat('نوبت ثبت‌شده',D.tasks.filter(t=>t.seriesId&&rows.some(r=>r.id===t.seriesId)).length,'tasks','green')}</div><div class="panel" style="margin-bottom:18px"><div class="panel-title"><h2>تقویم شمسی تعهدات</h2><div class="month-nav"><button class="btn sm" data-action="calendar-prev">${icon('back',14)} قبل</button><b>${monthLabel(shiftedJMonth(U.calendarOffset).key)}</b><button class="btn sm" data-action="calendar-next">بعد</button><button class="btn sm" data-action="calendar-today">امروز</button></div></div>${renderMonthGrid(rows)}</div><div class="panel"><div class="panel-title"><h2>برنامه‌های تعریف‌شده</h2><small>${num(rows.length)} برنامه</small></div>${rows.length?`<div class="repeat-grid">${rows.map(recurCard).join('')}</div>`:empty('برنامه تکراری وجود ندارد','اولین برنامه روزانه، هفتگی یا ماهانه را تعریف کن.','new-recurring','برنامه جدید')}</div>`}
function calendarAgendaForDay(rows,iso){
 // وظایف عادی و نوبت‌های ایجادشده هر دو در تقویم نشان داده می‌شوند.
 const items=D.tasks.filter(t=>t.due===iso&&canSeeTask(t)).map(t=>({kind:'saved',task:t}));
 for(const r of rows){
  if(!['active','pending'].includes(r.state)||iso<r.start||(r.end&&iso>r.end)||!rShould(r,iso))continue;
  // اگر وثوق یک نوبت را حذف کرده، تقویم آن را دوباره به‌صورت فرضی نمایش ندهد.
  if((r.excluded||[]).includes(iso))continue;
  // اگر برای همین برنامه و تاریخ نوبت ثبت شده، نمایش دوباره ممنوع است.
  if(items.some(a=>a.task?.seriesId===r.id))continue;
  items.push({kind:r.state==='pending'?'pending':'scheduled',recurrence:r});
 }
 return items;
}
function renderMonthGrid(rows){
 const {y,m}=shiftedJMonth(U.calendarOffset),key=`${y}/${pad(m)}`,last=daysInMonth(y,m),today=isoToday(),lead=wd(fromJ(y,m,1));
 const selected=U.calendarSelect&&jyMonth(U.calendarSelect)===key?U.calendarSelect:(jyMonth(today)===key?today:fromJ(y,m,1));
 const ts=Array.from({length:lead},()=>'<div class="month-empty"></div>');
 for(let d=1;d<=last;d++){
  const iso=fromJ(y,m,d),items=calendarAgendaForDay(rows,iso),amount=items.length;
  ts.push(`<button type="button" class="month-cell ${iso===today?'now':''} ${iso===selected?'chosen':''}" data-action="month-day" data-id="${iso}" aria-label="${jstr(iso)}، ${num(amount)} فعالیت" aria-pressed="${iso===selected}" title="${jstr(iso)} — ${num(amount)} فعالیت"><b>${toFa(d)}</b>${amount?`<div class="month-dot-row">${Array.from({length:Math.min(3,amount)},()=>'<i></i>').join('')}${amount>3?`<small>+${num(amount-3)}</small>`:''}</div>`:''}</button>`)
 }
 const agenda=calendarAgendaForDay(rows,selected);
 const agendaHtml=agenda.map(item=>{
  if(item.kind==='saved'){
   const t=item.task;
   return `<button type="button" class="day-agenda-item day-agenda-link" data-action="task-detail" data-id="${esc(t.id)}"><b>${esc(t.title)}</b><div class="hint">${esc(projectName(t.projectId))} · ${esc(actorName(t.assignee))}</div><div class="calendar-agenda-tags">${pill(taskStatus(t),statusColor[t.status]||'gray')}${pill(t.seriesId?'نوبت تکراری':'فعالیت عادی','blue')}</div></button>`;
  }
  const r=item.recurrence,pending=item.kind==='pending';
  return `<div class="day-agenda-item"><b>${esc(r.title)}</b><div class="hint">${esc(projectName(r.projectId))} · ${esc(actorName(r.assignee))}</div><div class="calendar-agenda-tags">${pill(pending?'در انتظار تأیید برنامه':'برنامه‌ریزی‌شده',pending?'amber':'blue')}${pill(recurrenceLabel(r),'gray')}</div><div class="hint">${pending?'پس از تأیید آقای وثوق، نوبت‌ها طبق برنامه ایجاد می‌شوند.':'این نوبت مربوط به برنامه تکراری است؛ در موعد مقرر به فهرست کارها اضافه می‌شود.'}</div></div>`;
 }).join('');
 return `<div class="month-layout"><div><div class="month-weekdays">${DW.map(x=>`<span>${x}</span>`).join('')}</div><div class="month-days">${ts.join('')}</div></div><div class="day-agenda" aria-live="polite"><div class="calendar-agenda-heading"><b>فعالیت‌های ${jstr(selected)}</b>${pill(num(agenda.length)+' مورد',agenda.length?'blue':'gray')}</div>${agenda.length?agendaHtml:'<div class="hint" style="margin-top:20px">هیچ فعالیت یا نوبت برنامه‌ریزی‌شده‌ای در این تاریخ وجود ندارد.</div>'}</div></div>`
}
function recurCard(r){const count=D.tasks.filter(t=>t.seriesId===r.id).length;return `<div class="repeat-card"><div class="row-flex between">${pill(recurrenceLabel(r),'blue')}${isAdmin()&&managerRecurring(r)?pill('خصوصی مدیر','purple'):''}${pill(r.state==='active'?'فعال':r.state==='pending'?'منتظر تأیید':'متوقف',r.state==='active'?'green':r.state==='pending'?'amber':'gray')}</div><h3>${esc(r.title)}</h3><div class="hint">${esc(projectName(r.projectId))} · ${esc(actorName(r.assignee))}</div><div class="hint">شروع ${jstr(r.start)} · ${num(count)} نوبت ثبت‌شده</div><div class="repeat-actions">${isAdmin()?`${r.state==='pending'?B('تأیید','approve-recurring','sm primary',`data-id="${r.id}"`):''}${B(icon('edit',13)+' ویرایش','edit-recurring','sm',`data-id="${r.id}"`)}${B('حذف','delete-recurring','sm danger',`data-id="${r.id}"`)}${r.state!=='pending'?B(r.state==='active'?'توقف':'فعال‌سازی','toggle-recurring','sm',`data-id="${r.id}"`):''}`:`${r.createdBy===U.actor&&r.state==='pending'?pill('در انتظار موافقت وثوق','amber'):''}`}</div></div>`}
function usersPage(){const members=D.users.filter(u=>!u.removed),archived=D.users.filter(u=>u.removed);const userRows=items=>items.map(u=>`<tr><td><b>${esc(u.name)}</b><div class="hint" dir="ltr">${esc(u.email)}</div></td><td>${pill(roles[u.role]||'بدون سمت',roleColor[u.role]||'gray')}</td><td>${u.projects.length?u.projects.map(x=>esc(projectName(x))).join('، '):'بدون پروژه'}</td><td>${pill(u.active?'فعال':'غیرفعال',u.active?'green':'red')}</td><td><div class="tiny-actions">${!u.removed&&!isOwnerDirectoryUser(u)?B('ویرایش سمت/پروژه','edit-user','sm',`data-id="${u.id}"`):''}${isOwnerDirectoryUser(u)?pill('ادمین اصلی · سرپرست','blue'):u.removed?B('بازگردانی به تیم','restore-user','sm primary',`data-id="${u.id}"`):u.active?`${B('لغو دسترسی','revoke-user','sm danger',`data-id="${u.id}"`)}${B('حذف از تیم','remove-user','sm danger',`data-id="${u.id}"`)}`:B('فعال‌سازی دسترسی','restore-user','sm primary',`data-id="${u.id}"`)}</div></td></tr>`).join('');return `${heading('کاربران و درخواست‌ها','درخواست‌های ثبت‌نام Firebase؛ تأیید بر اساس UID و تعیین سمت و پروژه‌های مجاز')}<div class="panel" style="margin-bottom:18px"><div class="panel-title"><h2>درخواست‌های در انتظار</h2>${pill(num(D.requests.length)+' درخواست','amber')}</div>${D.requests.length?D.requests.map(r=>`<div class="request-card"><div class="request-details">${avatar(r.name)}<div><strong>${esc(r.name)}</strong><p dir="ltr">${esc(r.email)}</p><p>${jstr(r.date)}</p></div></div><div class="row-flex"><button class="btn sm primary" data-action="approve-user" data-id="${r.id}">بررسی و تأیید</button><button class="btn sm danger" data-action="reject-user" data-id="${r.id}">رد</button></div></div>`).join(''):empty('درخواست عضویت جدیدی وجود ندارد')}</div><div class="panel"><div class="panel-title"><h2>افراد تیم</h2>${pill(num(members.length)+' نفر','blue')}</div>${members.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>کاربر</th><th>سمت</th><th>پروژه‌های مجاز</th><th>وضعیت</th><th>مدیریت</th></tr></thead><tbody>${userRows(members)}</tbody></table></div>`:empty('هنوز کاربری تأیید نشده','کاربر ابتدا باید خودش ثبت‌نام و ایمیلش را تأیید کند.')}</div>${archived.length?`<div class="panel" style="margin-top:18px"><div class="panel-title"><h2>اعضای حذف‌شده از تیم</h2>${pill(num(archived.length)+' نفر','gray')}</div><p class="hint">حساب و سابقه برای ممیزی حفظ شده؛ دسترسی ورود به اطلاعات برنامه لغو شده است.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>کاربر</th><th>سمت</th><th>پروژه‌های مجاز</th><th>وضعیت</th><th>مدیریت</th></tr></thead><tbody>${userRows(archived)}</tbody></table></div></div>`:''}`}

function panelsPage(){return `${heading('پنل‌ها','آقای وثوق می‌تواند برای آزمون هر نقش وارد شود. کارکنان فقط فعالیت‌های خودشان را می‌بینند.')}<div class="notice" style="margin-bottom:20px">${icon('lock',17)} شبیه‌ساز پنل‌ها فعال است، ولی هر نقش فقط کارهای ثبت‌شده توسط خودش یا ارجاع‌شده به خودش را می‌بیند؛ نه کار هم‌پروژه‌ای‌ها و نه کارهای خصوصی آقای وثوق.</div><div class="roles-grid">${Object.entries(roles).map(([k,name])=>{const users=D.users.filter(u=>u.active&&u.role===k);return `<div class="role-card"><div class="role-icon">${icon(roleIcon[k],25)}</div><h3>پنل ${name}</h3><p>${k==='supervisor'?'پیگیری فعالیت‌های خود و کارهای ارجاع‌شده':k==='senior'?'انجام کارهای تخصصی و گزارش‌دهی':k==='expert'?'ثبت فعالیت، تغییر وضعیت و ارسال خروجی':'ثبت کارهای آموزشی و گزارش فعالیت'}</p><div class="hint">${num(users.length)} کاربر فعال با این سمت</div><button class="btn primary full" data-action="open-role" data-id="${k}">${icon('eye',15)} ورود و کار با پنل</button></div>`}).join('')}</div>`}
function scoreOf(t){return D.evaluations.find(e=>e.id===t.evalId)||null}
function periodStats(personId,monthKey,projectKey='all'){const all=D.tasks.filter(t=>!managerTask(t)&&personId!==MANAGER_ID&&t.assignee===personId&&t.due&&jyMonth(t.due)===monthKey&&t.due<=isoToday()&&(projectKey==='all'||t.projectId===projectKey));const w=t=>Math.max(0,+t.weight||0)||1;const total=all.reduce((a,t)=>a+w(t),0),done=all.filter(t=>t.status==='done'),wDone=done.reduce((a,t)=>a+w(t),0);const graded=done.filter(t=>scoreOf(t));const wg=graded.reduce((a,t)=>a+w(t),0);const quality=wg?graded.reduce((a,t)=>a+scoreOf(t).quality*20*w(t),0)/wg:null;const time=wg?graded.reduce((a,t)=>a+scoreOf(t).timing*w(t),0)/wg:null;const volume=total?pct(wDone,total):null;const final=quality!==null&&time!==null&&volume!==null?Math.round(quality*.5+time*.3+volume*.2):null;return {count:all.length,done:done.length,total,weightDone:wDone,quality,time,volume,final}}
function performancePage(){const now=shiftedJMonth(U.monthShift),people=[...D.users].filter(u=>u.active&&(U.perfRole==='all'||u.role===U.perfRole));const scoped=people.map(u=>({...u,stats:periodStats(u.id,now.key,U.perfProject)})).filter(u=>u.stats.count>0);const score=scoped.filter(x=>x.stats.final!==null),mean=score.length?Math.round(score.reduce((a,x)=>a+x.stats.final,0)/score.length):null;const dueTasks=teamTasks().filter(t=>jyMonth(t.due)===now.key&&(U.perfProject==='all'||t.projectId===U.perfProject));const avgQuality=score.length?Math.round(score.reduce((a,x)=>a+x.stats.quality,0)/score.length):null;return `${heading('ارزیابی عملکرد تیم','ارزیابی فقط کارکنان؛ مدیر کنترل پروژه و کارهای شخصی ایشان مستثنا هستند',B(icon('tasks',15)+' وظایف منتظر بررسی','go-reviews'))}<div class="panel" style="margin-bottom:18px"><div class="toolbar"><div class="month-nav">${B('ماه قبل','perf-prev','sm')}<b>${monthLabel(now.key)}</b>${B('ماه بعد','perf-next','sm')}</div><select class="field" data-perf="project"><option value="all">تمام پروژه‌ها</option>${D.projects.map(p=>`<option value="${p.id}" ${U.perfProject===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><select class="field" data-perf="role"><option value="all">تمام سمت‌ها</option>${Object.entries(roles).map(([k,v])=>`<option value="${k}" ${U.perfRole===k?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="kpi-grid">${stat('میانگین امتیاز ماه',mean??0,'chart','blue',mean===null?'هنوز قابل محاسبه نیست':'از ۱۰۰ امتیاز')}${stat('میانگین کیفیت',avgQuality??0,'medal','green',avgQuality===null?'هنوز ارزیابی نشده':'از ۱۰۰ امتیاز')}${stat('تکمیل کارهای موعدرسیده',pct(dueTasks.filter(t=>t.status==='done').length,dueTasks.length),'check','amber','درصد از وظایف این ماه')}${stat('افراد دارای کار ثبت‌شده',scoped.length,'users','blue','در بازه انتخابی')}</div><div class="two-col"><section class="panel"><div class="panel-title"><h2>مقایسه عملکرد افراد</h2><small>امتیاز نهایی ماه</small></div>${scoped.length?scoped.map(u=>`<div class="person-chart-row"><div class="row-flex between"><b>${esc(u.name)}</b><span>${u.stats.final===null?'در انتظار ارزیابی':num(u.stats.final)+' / ۱۰۰'}</span></div><div class="progress"><span style="width:${u.stats.final??0}%;background:${u.stats.final>=80?'#13a48e':u.stats.final>=60?'#3675ed':'#e6a849'}"></span></div><div class="hint">${roles[u.role]} · ${num(u.stats.done)} از ${num(u.stats.count)} فعالیت</div><button class="link-button" data-action="person-detail" data-id="${u.id}">پرونده عملکرد</button></div>`).join(''):empty('هنوز داده عملکردی وجود ندارد','بعد از ثبت فعالیت در یکی از پنل‌ها، نتیجه اینجا نمایش داده می‌شود.')}</section><section class="panel"><div class="panel-title"><h2>وضعیت فعالیت‌ها</h2></div>${donut(countStatuses(dueTasks),dueTasks.length)}<div class="notice" style="margin-top:15px">امتیاز دوره‌ای = کیفیت ۵۰٪ + زمان ۳۰٪ + حجم کار تأییدشده ۲۰٪؛ محاسبه فقط پس از ثبت ارزیابی معتبر انجام می‌شود.</div></section></div><section class="panel" style="margin-top:18px"><div class="panel-title"><h2>گزارش نفر به نفر</h2></div>${scoped.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>نام</th><th>سمت</th><th>کار انجام‌شده / کل</th><th>کیفیت</th><th>زمان</th><th>حجم</th><th>امتیاز نهایی</th></tr></thead><tbody>${scoped.map(u=>`<tr><td>${esc(u.name)}</td><td>${roles[u.role]}</td><td>${num(u.stats.done)} / ${num(u.stats.count)}</td><td>${u.stats.quality===null?'—':num(Math.round(u.stats.quality))}</td><td>${u.stats.time===null?'—':num(Math.round(u.stats.time))}</td><td>${num(Math.round(u.stats.volume??0))}٪</td><td><strong>${u.stats.final===null?'—':num(u.stats.final)}</strong></td></tr>`).join('')}</tbody></table></div>`:empty('هیچ داده‌ای برای این ماه وجود ندارد')}</section>`}
function systemLogPage(){if(!isAdmin())return `${heading('لاگ سیستم','')}<div class="panel">${empty('دسترسی مجاز نیست')}</div>`;const rows=D.events.slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,500);return `${heading('لاگ سیستم','رویدادهای ثبت و تغییر اطلاعات؛ ساعت رسمی ایران (تهران) و به‌روزرسانی زنده',B(icon('refresh',15)+' بروزرسانی','refresh-log','sm'))}<section class="panel"><div class="panel-title"><h2>آخرین رویدادها</h2><small>${num(rows.length)} مورد اخیر</small></div>${rows.length?`<div class="system-log-list">${rows.map(e=>{const moment=tehranMoment(e.at),d=moment?.date||'',tm=moment?.time||'',task=D.tasks.find(t=>t.id===e.entity||t.id===e.taskId),title=task?.title||D.recurrences.find(r=>r.id===e.entity)?.title||'';return `<article class="system-log-row"><span class="system-log-icon">${icon(e.kind==='delete'?'trash':e.kind==='new'?'plus':e.kind==='grade'?'chart':'file',17)}</span><div class="system-log-copy"><b>${esc(e.text||'رویداد سامانه')}</b>${title?`<small>${esc(title)}</small>`:''}<small>${esc(e.by||actorName(e.actorUid))} · ${jstr(d)} ${toFa(tm)}</small></div>${pill(e.kind==='new'?'ثبت':e.kind==='edit'?'ویرایش':e.kind==='delete'?'حذف':e.kind==='grade'?'ارزیابی':'رویداد',e.kind==='delete'?'red':e.kind==='new'?'green':'blue')}</article>`}).join('')}</div>`:empty('هنوز رویدادی ثبت نشده','با ثبت یا تغییر فعالیت‌ها، رویدادها اینجا به‌صورت زنده نمایش داده می‌شوند.')}</section>`}
function reportsPage(){return `${heading('گزارش‌ها و پشتیبان','فایل خروجی واقعی از اطلاعات ثبت‌شده در همین مرورگر')}<div class="report-grid">${[['file','وظایف CSV','فهرست وظایف و تاریخ‌های شمسی','csv-tasks'],['users','کاربران CSV','نام، سمت و پروژه‌های مجاز','csv-users'],['chart','عملکرد CSV','فقط کارکنان؛ بدون کارهای خصوصی مدیر','csv-scores'],['download','پشتیبان JSON','تمام اطلاعات با قابلیت بازیابی','backup'],['refresh','بازیابی پشتیبان','جایگزینی داده‌های مرورگر با فایل پشتیبان','restore'],['file','چاپ / PDF','چاپ صفحه فعال از طریق مرورگر','print']].map(([ic,title,desc,act])=>`<div class="report-card"><div class="ri">${icon(ic,24)}</div><h3>${title}</h3><p>${desc}</p><button class="btn full" data-action="${act}">${icon('download',15)} ${act==='restore'?'انتخاب فایل':'دریافت / اجرا'}</button></div>`).join('')}</div><div class="notice warm" style="margin-top:18px">پشتیبان‌گیری منظم مهم است؛ پاک‌شدن داده مرورگر یا استفاده از دستگاه دیگر ممکن است اطلاعات محلی را در دسترس قرار ندهد.</div>`}function settingsPage(){return `${heading('تنظیمات دسترسی','قواعد دسترسی در Firestore Security Rules اعمال می‌شوند و از داخل اپ قابل تغییر نیستند.')}<div class="panel"><div class="notice">${icon('lock',17)} کارمندان فقط داده‌های ایجادشده یا واگذارشده به UID خود را می‌بینند. ارزیابی‌ها فقط برای مدیران مجاز است. کارهای شخصی وثوق فقط برای UID مدیر کنترل پروژه خواندنی‌اند؛ مالک سیستم به آن‌ها دسترسی اپلیکیشنی ندارد.</div><div class="table-wrap"><table class="data-table"><thead><tr><th>قابلیت</th><th>سرپرست</th><th>کارشناس ارشد</th><th>کارشناس</th><th>کارآموز</th><th>مدیران</th></tr></thead><tbody><tr><td>مشاهده کارهای خود/واگذارشده</td><td>بله</td><td>بله</td><td>بله</td><td>بله</td><td>بله</td></tr><tr><td>مشاهده فعالیت‌های همکاران</td><td>خیر</td><td>خیر</td><td>خیر</td><td>خیر</td><td>بله، به‌جز کار شخصی وثوق برای مالک سیستم</td></tr><tr><td>مشاهده امتیاز و ارزیابی</td><td>خیر</td><td>خیر</td><td>خیر</td><td>خیر</td><td>بله</td></tr><tr><td>تغییر سمت و مجوز</td><td>خیر</td><td>خیر</td><td>خیر</td><td>خیر</td><td>بله</td></tr></tbody></table></div><div class="notice">مدیر کنترل پروژه: وزن وظیفه و تأیید عضویت. نقش مدیریتی با ایمیل خودکار فعال نمی‌شود؛ فقط با UID ثبت‌شده در مجموعه adminAccess توسط مالک Firebase.</div></div>`}
function renderRole(){const items=actorTasks();if(U.roleTab==='tasks')return roleTaskPage(items);if(U.roleTab==='recurring')return recurringPage();if(U.roleTab==='profile')return roleProfile();if(U.roleTab==='duties')return dutiesPage();if(U.roleTab==='more')return roleMorePage();const done=items.filter(t=>t.status==='done').length;return `${heading('سلام، '+actorName(U.actor),'این‌ها فعالیت‌های قابل مشاهده در پنل شما هستند.',B(icon('plus',15)+' ثبت فعالیت','new-task','primary'))}<div class="kpi-grid">${stat('وظایف من',items.length,'tasks','blue')}${stat('در حال انجام',items.filter(t=>t.status==='doing').length,'clock','amber')}${stat('در انتظار تایید یا پاسخ دیگران',items.filter(t=>t.status==='review').length,'file','green')}${stat('متوقف / تأخیردار',items.filter(t=>t.status==='blocked'||dueLate(t)).length,'alert','red')}</div><div class="two-col"><div class="panel"><div class="panel-title"><h2>آخرین فعالیت‌ها</h2><button class="link-button" data-nav="tasks">همه کارها</button></div>${items.length?items.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8).map(taskSummary).join(''):empty('هنوز فعالیتی ندارید','یک فعالیت از همین پنل تعریف کنید.','new-task','ثبت فعالیت')}</div><div class="stack"><div class="panel"><div class="panel-title"><h2>وضعیت کاری من</h2></div>${donut(countStatuses(items),items.length)}</div><div class="panel"><div class="panel-title"><h2>وظایف تکراری</h2></div><p class="hint">تعهدات دوره‌ای به‌صورت روزانه، هفتگی، ماهانه یا هر چند روز یک‌بار قابل درخواست‌اند.</p>${B('درخواست تعهد تکراری','new-recurring','full')}</div></div></div>`}
function roleTaskCard(t,compact=false){return taskCommandCard(t,false)}
function isDailyOccurrence(t){return !!t.seriesId&&D.recurrences.some(r=>r.id===t.seriesId&&r.frequency==='daily')}
function roleTaskPage(items){
 const today=isoToday(),byDate=(a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title);
 const daily=items.filter(t=>t.due===today&&isDailyOccurrence(t)).sort(byDate);
 const todayOther=items.filter(t=>t.due===today&&!isDailyOccurrence(t)).sort(byDate);
 const overdue=items.filter(t=>t.due<today&&t.status!=='done').sort(byDate);
 const future=items.filter(t=>t.due>today).sort(byDate);
 const pastDone=items.filter(t=>t.due<today&&t.status==='done').sort((a,b)=>b.due.localeCompare(a.due));
 const done=daily.filter(t=>t.status==='done').length;
 const check=daily.length?`<section class="panel checklist-panel"><div class="panel-title"><h2>چک‌لیست روزانه</h2><small>${num(done)} از ${num(daily.length)} انجام‌شده</small></div><div class="progress" style="margin-bottom:15px"><span style="width:${pct(done,daily.length)}%"></span></div>${daily.map(t=>`<div class="daily-check-row"><label><input type="checkbox" data-daily-check="${esc(t.id)}" ${t.status==='done'?'checked':''}><span class="daily-check-title">${esc(t.title)}</span></label><button type="button" class="btn sm" data-action="task-detail" data-id="${esc(t.id)}">جزئیات</button></div>`).join('')}<p class="hint">هر روز یک سابقه مستقل دارد. اگر امروز تیک نخورد، فردا در «عقب‌افتاده» باقی می‌ماند.</p></section>`:'';
 return `${heading('کارهای من','وظایف امروز، کارهای عقب‌افتاده و برنامه‌های آینده',B(icon('plus',15)+' فعالیت جدید','new-task','primary'))}
 <div class="role-agenda-stack">
 ${check}
 ${todayOther.length?`<section class="panel"><div class="panel-title"><h2>سایر کارهای امروز</h2><small>${num(todayOther.length)} فعالیت</small></div>${todayOther.map(t=>roleTaskCard(t)).join('')}</section>`:''}
 <details class="panel task-accordion" ${overdue.length?'':'open'}><summary><span>کارهای عقب‌افتاده</span><span class="tag red">${num(overdue.length)} مورد</span></summary><div class="accordion-content">${overdue.length?overdue.map(t=>roleTaskCard(t,true)).join(''):'<p class="hint">کار عقب‌افتاده‌ای وجود ندارد.</p>'}</div></details>
 ${future.length?`<details class="panel task-accordion"><summary><span>کارهای موعد آینده</span><span class="tag blue">${num(future.length)}</span></summary><div class="accordion-content">${future.map(t=>roleTaskCard(t,true)).join('')}</div></details>`:''}
 ${pastDone.length?`<details class="panel task-accordion"><summary><span>سوابق انجام‌شده روزهای قبل</span><span class="tag green">${num(pastDone.length)}</span></summary><div class="accordion-content">${pastDone.map(t=>roleTaskCard(t,true)).join('')}</div></details>`:''}
 ${!items.length?`<section class="panel">${empty('هنوز وظیفه‌ای ثبت نشده','از بخش فعالیت جدید می‌توان یک کار تعریف کرد.','new-task','ثبت فعالیت')}</section>`:''}
 </div>`
}

function roleProfile(){return `${heading('پروفایل '+roles[U.preview],'هویت و سطح دسترسی فعلی در این پیش‌نمایش')}<div class="panel profile-card"><div class="row-flex">${avatar(actorName(U.actor))}<div><h2>${esc(actorName(U.actor))}</h2><p>${esc(APP.user?.email||'')}</p></div></div><div class="divider"></div><b>سمت: ${roles[U.preview]}</b><p>پروژه‌های قابل دسترس: ${actorProjects().length?actorProjects().map(projectName).join('، '):'بدون پروژه'}</p><div class="notice">سمت و دسترسی‌های واقعی فقط توسط آقای وثوق تعیین می‌شوند.</div></div>`}
function field(name,body,full=false){return `<div class="form-group ${full?'span2':''}"><label>${name}</label>${body}</div>`}
const inp=(name,value='',attrs='')=>`<input class="field" name="${name}" value="${esc(value)}" ${attrs}>`;
const txt=(name,value='',attrs='')=>`<textarea class="field" name="${name}" rows="3" ${attrs}>${esc(value)}</textarea>`;
const sel=(name,options,chosen='',attrs='')=>`<select class="field" name="${name}" ${attrs}>${options.map(([v,l])=>`<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
const dateField=(name,iso,required=false)=>`<div class="jalali-date">${inp(name,jstr(iso),'dir="ltr" inputmode="numeric" placeholder="۱۴۰۵/۰۹/۰۱" '+(required?'required':''))}<button class="calendar-trigger" type="button" data-datepicker="${name}" aria-label="تقویم هجری شمسی">${icon('calendar',16)}</button></div>`;
function projectOpts(includeBlank=true){return [...includeBlank?[['','بدون پروژه']]:[],...D.projects.filter(p=>isAdmin()||availableProject(p.id)).map(p=>[p.id,p.name])]}
function userOpts(projectId='',selected='',legacy=false){
 if(!isAdmin())return [[APP.user.uid,actorName(APP.user.uid)+' — خودم']];
 const staff=D.users.filter(u=>u.active&&(!projectId||(u.projects||[]).includes(projectId)||isOwnerDirectoryUser(u)))
  .map(u=>[u.id,u.name+' — '+(roles[u.role]||'کارمند')]);
 // Never offer the administrator's UID as a new team assignment. Existing
 // historical admin-to-self team tasks retain their assignee during edits.
 if(legacy&&selected===APP.user.uid)staff.unshift([APP.user.uid,'فعالیت تیمی قدیمی — حساب خودم']);
 if(selected&&!staff.some(u=>u[0]===selected)&&selected!==MANAGER_ID){
  const u=person(selected);
  if(u)staff.unshift([selected,(u.name||'کارمند')+' — '+(roles[u.role]||'حساب غیرفعال')]);
 }
 return staff.length?staff:[['','ابتدا یک کارمند فعال با دسترسی به این پروژه انتخاب کنید']];
}

function taskModal(){
 const old=D.tasks.find(t=>t.id===U.edit),edit=!!old;
 if(edit&&!canEditTask(old))return '';
 const pid=old?.projectId||'',privateMode=isAdmin()&&(edit?managerTask(old):U.taskCreateMode==='private');
 const available=userOpts(pid,old?.assignee||'',edit&&!managerTask(old));
 const who=privateMode?MANAGER_ID:(old?.assignee||(isAdmin()?available[0]?.[0]:APP.user.uid));
 const assigneeField=privateMode?
  `<div class="form-group"><label>مسئول فعالیت</label><div class="notice">کار شخصی و خصوصی — فقط برای همین حساب مدیریتی</div><input type="hidden" name="assignee" value="${MANAGER_ID}"></div>`:
  field('مسئول فعالیت',sel('assignee',available,who,isAdmin()||permission('assign')?'':'disabled')+(isAdmin()||permission('assign')?'':`<input type="hidden" name="assignee" value="${esc(who)}">`));
 return frame(edit?'ویرایش فعالیت':privateMode?'ثبت کار شخصی و خصوصی':'ثبت فعالیت جدید',`<form id="form-task" class="modal-body"><div class="form-grid">${field('عنوان فعالیت *',inp('title',old?.title,'required maxlength="130" placeholder="مثلاً بررسی انحرافات برنامه زمان‌بندی"'),true)}${field('پروژه',sel('projectId',projectOpts(),pid))}${assigneeField}${field('تاریخ سررسید (شمسی) *',dateField('dueJ',old?.due||isoToday(),true))}${field('اولویت',sel('priority',Object.entries(priorities),old?.priority||'normal'))}${isProjectControlsManager()&&!privateMode?`<div class="form-group" data-staff-weight><label>وزن کاری کارکنان</label>${sel('weight',[['1','سبک · ۱'],['3','متوسط · ۳'],['5','سنگین · ۵']],String(old?.weight||3))}</div>`:''}${edit&&isAdmin()?field('وضعیت',sel('status',Object.entries(statuses),old.status,'data-task-status-selector')):''}${edit&&isAdmin()?`<div id="admin-stop-reason" class="form-group span2" style="${old.status==='blocked'?'':'display:none'}"><label>دلیل توقف *</label><textarea class="field" name="blockReason" rows="2" maxlength="800" ${old.status==='blocked'?'required':''} placeholder="علت توقف فعالیت را بنویسید">${esc(old.blockReason||'')}</textarea></div>`:''}${field('شرح کار / خروجی مورد انتظار',txt('description',old?.description,'maxlength="1400"'),true)}${edit&&isAdmin()?field('علت اصلاح (اختیاری)',inp('editReason','','placeholder="تغییر مهلت یا مسئول و ..."'),true):''}</div><div class="feedback">تاریخ‌ها شمسی هستند. ${privateMode?'این فعالیت فقط برای حساب خودتان قابل مشاهده است و ارزیابی ندارد.':isAdmin()?'ثبت تیمی فقط برای کارکنان فعال است.':'فعالیت و وضعیت آن در پنل مدیریتی قابل پیگیری است.'} ${edit?'ویرایش در تاریخچه ثبت می‌شود.':''}</div></form>`,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn primary" type="submit" form="form-task">${edit?'ذخیره تغییرات':'ثبت فعالیت'}</button>`);
}

function projectModal(){const p=D.projects.find(x=>x.id===U.edit);return frame(p?'ویرایش پروژه':'افزودن پروژه',`<form id="form-project" class="modal-body"><div class="form-grid">${field('نام پروژه *',inp('name',p?.name,'required maxlength="90"'),true)}${field('کد پروژه',inp('code',p?.code,'maxlength="30"'))}${field('محل پروژه',inp('location',p?.location,'maxlength="65"'))}<div class="form-group span2"><label>روزهای تعطیل هفتگی پروژه (برای تناوب روز کاری)</label><div class="check-grid">${DW.map((name,i)=>`<label><input type="checkbox" name="offdays" value="${i}" ${(p?.workOffDays||[6]).includes(i)?'checked':''}> ${name}</label>`).join('')}</div></div>${field('تعطیلات خاص پروژه (تاریخ شمسی، جدا با ویرگول)',inp('holidaysJ',(p?.holidays||[]).map(jstr).join('، '),'placeholder="۱۴۰۵/۰۹/۱۰، ۱۴۰۵/۰۹/۲۰"'),true)}</div></form>`,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn primary" type="submit" form="form-project">ذخیره پروژه</button>`)}
function requestModal(){return frame('درخواست عضویت آزمایشی',`<form id="form-request" class="modal-body"><div class="form-grid">${field('نام و نام خانوادگی *',inp('name','','required maxlength="80"'),true)}${field('ایمیل *',inp('email','','type="email" dir="ltr" required maxlength="100"'),true)}</div><div class="feedback">این درخواست، صرفاً شبیه‌سازی ثبت‌نام ایمیلی است. هیچ ایمیلی ارسال نمی‌شود.</div></form>`,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn primary" type="submit" form="form-request">ارسال درخواست</button>`)}
function userModal(){const existing=person(U.edit),request=D.requests.find(r=>r.id===U.edit);if(isOwnerDirectoryUser(existing))return '';if(!existing&&!request)return '';const u=existing||request,create=!existing;return frame(request?'تأیید درخواست عضویت':'ویرایش کاربر',`<form id="form-user" class="modal-body"><div class="form-grid">${field('نام و نام خانوادگی *',inp('name',u?.name,'required maxlength="80"'),true)}${field('ایمیل *',inp('email',u?.email,'required type="email" dir="ltr" maxlength="100" '+(request?'readonly':'')),true)}${field('سمت',sel('role',Object.entries(roles),existing?.role||'expert'))}${field('وضعیت حساب',sel('active',[['yes','فعال'],['no','غیرفعال']],existing?.active===false?'no':'yes'))}<div class="form-group span2"><label>پروژه‌های مجاز</label><div class="check-grid">${D.projects.map(p=>`<label><input type="checkbox" name="projects" value="${p.id}" ${existing?.projects?.includes(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')||'<span class="hint">پروژه‌ای تعریف نشده؛ کاربر همچنان می‌تواند فعالیت بدون پروژه ثبت کند.</span>'}</div></div></div><div class="feedback">تأیید به UID ثبت‌نام Firebase متصل است؛ ایمیل به‌تنهایی هیچ نقشی ایجاد نمی‌کند.</div></form>`,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn primary" type="submit" form="form-user">${create?'تأیید حساب و تخصیص دسترسی':'ذخیره تغییرات'}</button>`)}
function repeatField(type,label,control,initial,full=false){return `<div class="form-group ${full?'span2':''} recurring-conditional" data-repeat-only="${type}" ${initial!==type?'hidden':''}><label>${label}</label>${control}</div>`}
function recurringModal(){
 const isPreview=APP.readOnlyPreview;
 const r=D.recurrences.find(x=>x.id===U.edit);
 const privateMode=isAdmin()&&(r?managerRecurring(r):U.recurringCreateMode==='private');
 const available=userOpts(r?.projectId||'',r?.assignee||'',!!r&&!managerRecurring(r));
 const who=privateMode?MANAGER_ID:(r?.assignee||(isAdmin()?available[0]?.[0]:APP.user.uid));
 const frequency=(r?.frequency==='ongoing'?'weekly':r?.frequency)||'weekly',check=r?.workOnly!==false?'checked':'';
 const fixedMonth=frequency==='monthly'&&r?.monthDay!=='lastWork';
 const body=`<form id="form-recurring" class="modal-body"><div class="form-grid">
 
 ${field('عنوان وظیفه *',inp('title',r?.title,'required maxlength="120"'),true)}
 ${field('پروژه',sel('projectId',projectOpts(),r?.projectId||''))}
 ${privateMode?`<div class="form-group"><label>مسئول</label><div class="notice">برنامه تکراری خصوصی همین حساب مدیریتی</div><input name="assignee" type="hidden" value="${MANAGER_ID}"></div>`:field('مسئول',sel('assignee',available,who,isAdmin()||permission('assign')?'':'disabled')+(isAdmin()||permission('assign')?'':`<input name="assignee" type="hidden" value="${esc(who)}">`))}
 ${field('نوع تکرار',sel('frequency',Object.entries(freqNames),frequency,'data-recurring-frequency'))}
 ${repeatField('daily','روزهای اجرای روزانه',`<label class="check-option"><input type="checkbox" name="dailyWorkOnly" ${check}> فقط روزهای کاری (به‌جز جمعه)</label>`,frequency)}
 ${repeatField('interval','فاصله تکرار (روز)',`<div class="repeat-interval-options"><label>هر <input class="field" type="number" name="intervalDays" min="1" max="365" step="1" value="${Number(r?.intervalDays||3)}" inputmode="numeric"> روز یک‌بار</label><label>مبنای شمارش ${sel('intervalBasis', [['calendar','روز تقویمی'],['work','روز کاری پروژه']], r?.intervalBasis||'calendar')}</label></div>`,frequency,true)}
 ${repeatField('weekly','روز اجرای هفتگی',sel('weekday',DW.map((v,i)=>[String(i),v]),String(r?.weekday??4)),frequency)}
 ${repeatField('monthly','روز اجرای ماهانه',sel('monthDay',[['lastWork','آخرین روز کاری ماه شمسی'],...Array.from({length:31},(_,i)=>[String(i+1),`روز ${toFa(i+1)}`])],String(r?.monthDay||'lastWork'),'data-recurring-monthday'),frequency)}
 <div class="form-group recurring-conditional" data-repeat-only="monthly-fixed" ${fixedMonth?'':'hidden'}><label>اگر روز تعیین‌شده جمعه بود</label><label class="check-option"><input type="checkbox" name="monthlyWorkOnly" ${check}> به پنجشنبه منتقل شود</label></div>
 ${field('شروع برنامه (شمسی) *',dateField('startJ',r?.start||isoToday(),true))}
 ${field('پایان برنامه (اختیاری)',dateField('endJ',r?.end||''))}
 ${isProjectControlsManager()&&!privateMode?`<div class="form-group" data-staff-weight><label>وزن هر نوبت برای کارکنان</label>${sel('weight',[['1','سبک · ۱'],['3','متوسط · ۳'],['5','سنگین · ۵']],String(r?.weight||3))}</div>`:''}
 ${field('توضیحات',txt('description',r?.description),true)}
 </div><div class="feedback">${isPreview?'درخواست پس از ثبت، برای تأیید آقای وثوق ارسال می‌شود.':'هر نوبت تکراری سابقه مستقل خواهد داشت.'} تنظیمات غیرمرتبط با نوع تکرار نمایش داده نمی‌شوند. ویرایش برنامه، نوبت‌های ثبت‌شده قبلی را تغییر نمی‌دهد.</div></form>`;
 return frame(r?'ویرایش برنامه تکراری':isPreview?'درخواست وظیفه تکرارشونده':'تعریف وظیفه تکرارشونده',body,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn primary" type="submit" form="form-recurring">${r?'ثبت تغییرات':isPreview?'ارسال درخواست':'ایجاد برنامه'}</button>`)
}
function syncRecurringFields(){
 const form=$('#form-recurring');if(!form)return;
 const frequency=form.elements.frequency?.value||'weekly';
 const monthDay=form.elements.monthDay?.value||'lastWork';
 form.querySelectorAll('[data-repeat-only]').forEach(group=>{
  const target=group.dataset.repeatOnly;
  const show=target===frequency||(target==='monthly-fixed'&&frequency==='monthly'&&monthDay!=='lastWork');
  group.hidden=!show;
  group.querySelectorAll('input,select,textarea,button').forEach(el=>{el.disabled=!show});
 });
}
function taskDetailsModal(){const t=D.tasks.find(x=>x.id===U.edit);if(!t||!canSeeTask(t))return '';const ev=D.evaluations.filter(e=>e.taskId===t.id||e.taskId===t.restoredFromId).sort((a,b)=>b.at.localeCompare(a.at));const notes=t.notes||[];return frame('جزئیات و سوابق فعالیت',`<div class="modal-body"><h2 class="detail-h2">${esc(t.title)}</h2><div class="detail-meta">${pill(taskStatus(t),statusColor[t.status])}${pill(esc(projectName(t.projectId)),'gray')}<span>مسئول: ${esc(actorName(t.assignee))}</span><span>موعد: ${jstr(t.due)}</span></div>${t.description?`<div class="feedback">${esc(t.description)}</div>`:''}${t.blockReason?`<div class="notice warm"><b>دلیل توقف ثبت‌شده:</b> ${esc(t.blockReason)}</div>`:''}<h3>یادداشت‌ها و خروجی کار</h3>${notes.length?notes.map(x=>`<div class="note-item"><div>${esc(x.text)}</div><small>${esc(x.by)} · ${jstr(x.date)}</small></div>`).join(''):'<div class="hint">یادداشتی ثبت نشده است.</div>'}<form id="form-note"><textarea class="field" name="note" rows="2" maxlength="1200" placeholder="توضیح یا لینک فایل (هر دو اختیاری)"></textarea><button class="btn sm primary" style="margin-top:8px" type="submit">ثبت یادداشت</button></form>${isAdmin()&&!managerTask(t)?`<h3>ارزیابی‌های ثبت‌شده</h3>${ev.length?ev.map(e=>`<div class="note-item"><strong>${num(e.score)} از ۱۰۰</strong> · کیفیت ${num(e.quality)} از ۵ · کامل بودن ${num(e.complete)} از ۵ <div class="hint">${jstr(e.date)} · ${esc(e.feedback||'بدون بازخورد')}</div></div>`).join(''):'<p class="hint">هنوز امتیازی ثبت نشده است.</p>'}`:''}<h3>تاریخچه تغییرات</h3>${D.events.filter(e=>e.entity===t.id&&(isAdmin()||e.kind!=='grade')).slice(-12).reverse().map(e=>`<div class="hint history-entry">${esc(e.by)}: ${esc(e.text)}</div>`).join('')||'<p class="hint">موردی ثبت نشده است.</p>'}</div>`,`<button class="btn" data-action="close-modal">بستن</button>${canEditTask(t)?`<button class="btn" data-action="edit-task" data-id="${t.id}">${icon('edit',14)} ویرایش</button>`:''}${canDeleteTask(t)?`<button class="btn danger" data-action="delete-task" data-id="${t.id}">${icon('trash',14)} حذف</button>`:''}${!isAdmin()&&!canDeleteTask(t)?`<button class="btn danger" data-action="request-delete-task" data-id="${t.id}">درخواست حذف از مدیر</button>`:''}${isAdmin()&&!managerTask(t)&&(t.status==='review'||t.status==='done')?`<button class="btn primary" data-action="grade-task" data-id="${t.id}">${t.status==='done'?'ثبت ارزیابی':'خاتمه و ارزیابی'}</button>`:''}`)}
function gradeModal(){if(!isAdmin())return '';const t=D.tasks.find(x=>x.id===U.edit);if(!t||managerTask(t))return '';const ev=scoreOf(t);return frame('تأیید و امتیازدهی فعالیت',`<form id="form-grade" class="modal-body"><div class="record-box"><b>${esc(t.title)}</b><div class="hint">${esc(actorName(t.assignee))} · وزن کاری ${num(t.weight)} · مهلت: ${jstr(t.due)}</div></div><div class="form-grid" style="margin-top:14px">${field('کیفیت خروجی (۵۰٪)',sel('quality',Array.from({length:5},(_,i)=>[String(i+1),`${toFa(i+1)} از ۵`]),String(ev?.quality||4)))}${field('کامل بودن (۲۰٪)',sel('complete',Array.from({length:5},(_,i)=>[String(i+1),`${toFa(i+1)} از ۵`]),String(ev?.complete||5)))}${field('تاریخ تحویل (شمسی)',dateField('deliveredJ',t.submittedAt||isoToday(),true),true)}${field('تأخیر موجه',`<label class="check-option"><input type="checkbox" name="excused" ${ev?.excused?'checked':''}> ناشی از عامل خارج از اختیار نیرو بوده است</label>`,true)}${field('بازخورد وثوق',txt('feedback',ev?.feedback,'maxlength="700"'),true)}</div><div class="feedback">زمان: ۳۰٪، کیفیت: ۵۰٪ و کامل‌بودن: ۲۰٪. هر روز تأخیر غیرموجه ۱۵ امتیاز از شاخص زمان کم می‌کند. بازنگری امتیاز، سوابق قبلی را حفظ می‌کند.</div></form>`,`<button class="btn" data-action="close-modal">انصراف</button><button type="submit" form="form-grade" class="btn primary">تأیید و ثبت امتیاز</button>`)}
function personModal(){if(!isAdmin()||U.edit===MANAGER_ID)return '';const key=U.edit,ts=D.tasks.filter(t=>t.assignee===key),all=ts.filter(t=>scoreOf(t));const months=Array.from({length:6},(_,i)=>shiftedMonthKey(-5+i));const points=months.map(k=>periodStats(key,k).final);return frame('پرونده عملکرد '+actorName(key),`<div class="modal-body"><div class="row-flex">${avatar(actorName(key))}<div><h3 style="margin:0">${esc(actorName(key))}</h3><span class="hint">${roles[userRole(key)]} · ${num(ts.length)} فعالیت</span></div></div><div class="mini-stat-row" style="margin:16px 0">${stat('امتیازهای ثبت‌شده',all.length,'medal','green')}${stat('کار تأییدشده',ts.filter(t=>t.status==='done').length,'check','blue')}</div><h3>روند شش ماه شمسی</h3>${trendSVG(months,points)}<h3>سوابق مستقل وظایف</h3>${all.length?all.map(t=>`<div class="history-row"><div><b>${esc(t.title)}</b><div class="hint">${jstr(t.due)}</div></div>${pill(num(taskScore(t))+' / ۱۰۰','green')}</div>`).join(''):'<p class="hint">هنوز امتیازی ثبت نشده است.</p>'}</div>`,`<button class="btn" data-action="close-modal">بستن</button>`)}
function shiftedMonthKey(o){let {y,m}=jparts(isoToday());m+=o;while(m<=0){m+=12;y--}while(m>12){m-=12;y++}return `${y}/${pad(m)}`}
function trendSVG(months,points){const ps=points.map((p,i)=>p==null?null:[35+i*70,145-(p*1.1)]),segments=[],labels=ps.map((p,i)=>p?`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#356fea"/><text x="${p[0]}" y="${p[1]-12}" font-size="10" text-anchor="middle" fill="#23549d">${toFa(points[i])}</text>`:'').join('');let line='';for(let i=0;i<ps.length;i++){if(!ps[i])continue;line+=(line?' ':'')+`${ps[i][0]},${ps[i][1]}`}return `<svg viewBox="0 0 420 180" style="width:100%;max-width:550px" role="img" aria-label="روند شش‌ماهه"><line x1="20" x2="410" y1="145" y2="145" stroke="#c5d0df"/>${ps.filter(Boolean).length>1?`<polyline points="${line}" fill="none" stroke="#3978e9" stroke-width="3"/>`:''}${labels}${months.map((k,i)=>`<text x="${35+i*70}" y="170" font-size="9" text-anchor="middle" fill="#64738e">${M[+k.split('/')[1]-1]}</text>`).join('')}</svg>`}
function frame(title,body,footer=''){return `<div class="modal-backdrop" data-action="close-outside"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-top"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="بستن">${icon('close')}</button></div>${body}<div class="modal-footer">${footer||B('بستن','close-modal')}</div></section></div>`}
function deleteChoiceModal(){const t=D.tasks.find(x=>x.id===U.edit);if(!t||!canDeleteTask(t))return '';const r=D.recurrences.find(x=>x.id===t.seriesId);return frame('انتخاب نوع حذف',`<div class="modal-body"><b>${esc(t.title)}</b><p class="hint">${jstr(t.due)} · ${esc(projectName(t.projectId))}</p><p>برای حذف این نوبت یا کل برنامه تکراری یکی از گزینه‌ها را انتخاب کن.</p></div>`,`<button class="btn" data-action="close-modal">انصراف</button><button class="btn danger" data-action="delete-single-occurrence" data-id="${esc(t.id)}">فقط همین نوبت</button>${r&&isAdmin()?`<button class="btn danger" data-action="delete-all-occurrences" data-id="${esc(r.id)}">کل برنامه و نوبت‌ها</button>`:''}`)}
function renderModal(){if(!U.modal){$('#modals').innerHTML='';return}const fn={task:taskModal,deleteChoice:deleteChoiceModal,project:projectModal,request:requestModal,user:userModal,recurring:recurringModal,details:taskDetailsModal,grade:gradeModal,person:personModal}[U.modal];$('#modals').innerHTML=fn?fn():'';if(U.modal==='recurring')syncRecurringFields();syncManagerAssignmentFields()}
function syncManagerAssignmentFields(){const f=$('#form-task')||$('#form-recurring');if(!f||!isAdmin())return;const self=f.elements.assignee?.value===MANAGER_ID;f.querySelectorAll('[data-staff-weight]').forEach(box=>{box.hidden=self;box.querySelectorAll('input,select').forEach(el=>el.disabled=self)})}
function isProjectWorkingDay(r,iso){const project=proj(r.projectId);const off=Array.isArray(project?.workOffDays)?project.workOffDays:[6];return !off.includes(wd(iso))&&!(project?.holidays||[]).includes(iso)}
function intervalAnchor(r){return r.scheduleAnchor||r.start}
function calendarDiff(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000)}
function rShould(r,iso){
 if(iso<(r.scheduleFrom||r.start))return false;
 if(r.frequency==='ongoing')return false; // legacy records remain visible, but no new automatic occurrence
 if(r.frequency==='interval'){
  const n=Number(r.intervalDays)||1,anchor=intervalAnchor(r);
  if(!Number.isInteger(n)||n<1||n>365||iso<anchor)return false;
  if(r.intervalBasis!=='work')return calendarDiff(anchor,iso)%n===0;
  if(!isProjectWorkingDay(r,iso))return false;
  let workingIndex=0;for(let day=anchor;day<=iso;day=addDays(day,1))if(isProjectWorkingDay(r,day))workingIndex++;
  return workingIndex>0&&(workingIndex-1)%n===0;
 }

 const j=jparts(iso);if(!j)return false;const weekday=wd(iso);
 if(r.frequency==='daily')return !r.workOnly||weekday!==6;
 if(r.frequency==='weekly')return weekday===Number(r.weekday); // روز انتخابی دقیقاً رعایت می‌شود
 if(r.frequency==='monthly'){
  let dt=r.monthDay==='lastWork'?daysInMonth(j.y,j.m):Math.min(daysInMonth(j.y,j.m),Number(r.monthDay)||1);
  if(r.workOnly||r.monthDay==='lastWork')while(dt>1&&wd(fromJ(j.y,j.m,dt))===6)dt--;
  return j.d===dt;
 }
 return false
}
function createInstance(r,iso,manual=false){const k=manual?'manual:'+id('x'):iso;if(D.tasks.some(t=>t.seriesId===r.id&&t.occurrenceKey===k)||(r.excluded||[]).includes(k))return null;const t={id:manual?id('t'):`occ_${r.id}_${iso}`,title:r.title,projectId:r.projectId||'',assignee:r.assignee,createdBy:r.createdBy,materializedByUid:APP.user.uid,createdAt:isoToday(),updatedAt:new Date().toISOString(),due:iso,priority:'normal',weight:managerRecurring(r)?0:(r.weight??0),visibility:managerRecurring(r)?r.visibility:'team',status:'todo',description:r.description||'',notes:[],seriesId:r.id,occurrenceKey:k,submittedAt:null,evalId:null};D.tasks.push(t);record('new','ایجاد نوبت تکراری: '+t.title,t.id);return t}
function generateDue(){let created=0,today=isoToday();for(const r of D.recurrences){if(r.state!=='active'||(!isAdmin()&&r.assignee!==APP.user?.uid)||(managerRecurring(r)&&!((r.visibility==='manager_private'&&isProjectControlsManager())||(r.visibility==='owner_private'&&isSystemOwner()))))continue;let cur=r.scheduleFrom||r.start,finish=r.end&&r.end<today?r.end:today;let checked=0;while(cur<=finish&&checked++<5000){if(rShould(r,cur)){const res=createInstance(r,cur);if(res)created++}cur=addDays(cur,1)}}return created}
function setPage(page){if(!isAdmin()||page==='settings')return;if(page==='mine'){page='tasks';U.taskView='private'}U.preview=null;U.actor=APP.user?.uid||null;APP.readOnlyPreview=false;U.page=page;U.mobileNav=false;U.modal=null;U.edit=null;render();window.scrollTo(0,0)}
function openRole(role){if(!isAdmin()||!roles[role])return;U.preview=role;U.actor=APP.user.uid;U.roleTab='home';U.modal=null;U.mobileNav=false;APP.readOnlyPreview=true;render();window.scrollTo(0,0)}
function setRoleTab(tab){U.roleTab=tab;U.mobileNav=false;U.modal=null;render();window.scrollTo(0,0)}

const privateStatusWrites=new Set();
async function changePrivateTaskStatus(taskId,newStatus){
 const t=D.tasks.find(x=>x.id===taskId);
 if(!t||!isAdmin()||!managerTask(t)||!canSeeTask(t)||!Object.hasOwn(statuses,newStatus))return;
 if(privateStatusWrites.has(taskId))return;
 if(newStatus===t.status)return;
 if(!navigator.onLine)return toast('برای تغییر وضعیت کار شخصی اتصال اینترنت لازم است.',true);
 let blockReason=String(t.blockReason||'');
 if(newStatus==='blocked'){
  const value=prompt('دلیل توقف کار شخصی را وارد کنید:',blockReason);
  if(value===null){render();return}
  if(!value.trim()){toast('دلیل توقف نمی‌تواند خالی باشد.',true);render();return}
  blockReason=value.trim();
 }
 privateStatusWrites.add(taskId);
 const previous=copy(t),ref=doc(db,APP.remotePaths[taskId]||(t.seriesId?'recurrenceInstances':'tasks'),taskId);
 const today=isoToday(),updatedAt=new Date().toISOString();
 const submittedAt=newStatus==='done'||newStatus==='review'?today:null;
 const patch={status:newStatus,updatedAt,submittedAt};
 if(newStatus==='blocked')patch.blockReason=blockReason;
 try{
  await writeQueue;
  const unsaved=[...pendingOps.values()].some(op=>op.key==='tasks'&&op.id===taskId);
  if(unsaved)throw new Error('این فعالیت هنوز تغییر ذخیره‌نشده دیگری دارد. ابتدا از «بیشتر» ذخیره ناموفق را بررسی کن.');
  const before=await getDocFromServer(ref);
  if(!before.exists())throw new Error('سند این فعالیت روی سرور پیدا نشد.');
  if(before.data().visibility!==t.visibility||before.data().assigneeUid!==APP.user.uid)throw new Error('دسترسی به این فعالیت شخصی تأیید نشد.');
  if(newStatus==='blocked')patch.notes=[...(Array.isArray(before.data().notes)?before.data().notes:[]),{text:'دلیل توقف: '+blockReason,by:actorName(APP.user.uid),date:today}];
  await updateDoc(ref,patch);
  const verified=await getDocFromServer(ref);
  if(!verified.exists()||verified.data().status!==newStatus)throw new Error('تغییر وضعیت از سرور تأیید نشد.');
  Object.assign(t,{...patch});
  record('status',`وضعیت کار شخصی به «${statuses[newStatus]}» تغییر کرد`,t.id);
  const event=D.events[D.events.length-1];
  // Status succeeds independently of the audit event; an audit error must not
  // roll back a confirmed Firestore status update.
  if(event){try{await setDoc(doc(db,'activityHistory',event.id),toFirestore('events',event))}catch(error){console.warn('Private task status saved, audit event not saved',error)}}
 }catch(err){
  Object.assign(t,previous);
  toast('وضعیت روی سرور ثبت نشد: '+authMessage(err),true);
 }finally{privateStatusWrites.delete(taskId);render()}
}
function changeTaskStatus(task,newStatus){const t=D.tasks.find(x=>x.id===task);if(!t||!canSeeTask(t)||(isAdmin()&&!managerTask(t)&&t.assignee!==APP.user?.uid)||!['todo','doing','blocked','review','done'].includes(newStatus))return;if(newStatus==='blocked'){const reason=prompt('دلیل توقف فعالیت را بنویسید (اجباری):',t.status==='blocked'?t.blockReason||'':'');if(reason===null){render();return}if(!reason.trim()){toast('برای انتخاب وضعیت متوقف، ثبت دلیل توقف ضروری است.',true);render();return}t.blockReason=reason.trim();(t.notes||=[]).push({text:'دلیل توقف: '+reason.trim(),by:actorName(U.actor),date:isoToday()})}if(newStatus==='review'){/* ثبت این وضعیت بدون الزام به فایل یا توضیح انجام می‌شود. یادداشت اختیاری از جزئیات فعالیت قابل افزودن است. */t.submittedAt=isoToday()}if(newStatus==='done')t.submittedAt=isoToday();if(t.status==='done'&&newStatus!=='done'&&newStatus!=='review')t.submittedAt=null;t.status=newStatus;t.updatedAt=new Date().toISOString();if(newStatus!=='blocked'){(t.notes||=[]).push({text:'وضعیت به «'+statuses[newStatus]+'» تغییر کرد',by:actorName(APP.user.uid),date:isoToday()})}record('status',`وضعیت به «${statuses[newStatus]}» تغییر کرد`,t.id);save('وضعیت کار ثبت شد و در پنل وثوق قابل مشاهده است.')}
function updateTask(fd){const old=D.tasks.find(t=>t.id===U.edit),edit=!!old,title=String(fd.get('title')||'').trim(),due=jparse(fd.get('dueJ'));if(!title||!due)return toast('عنوان و تاریخ شمسی معتبر وارد کنید.',true);const projectId=String(fd.get('projectId')||''),requested=String(fd.get('assignee')||(isAdmin()?'':APP.user.uid)),managerPrivate=isAdmin()&&(requested===MANAGER_ID||(edit&&managerTask(old)&&requested===APP.user.uid)),assignee=managerPrivate?APP.user.uid:requested;if(projectId&&!proj(projectId))return toast('پروژه انتخاب‌شده معتبر نیست.',true);if(isAdmin()&&!managerPrivate&&(!assignee||assignee===MANAGER_ID))return toast('برای فعالیت تیمی ابتدا یک کارمند فعال انتخاب کن.',true);if(!isAdmin()&&(managerPrivate||assignee!==APP.user.uid||!availableProject(projectId)))return toast('شما مجوز انتخاب این مسئول یا پروژه را ندارید.',true);if(assignee!==APP.user.uid&&!person(assignee)?.active)return toast('مسئول باید یک حساب تأییدشده باشد.',true);if(projectId&&assignee!==APP.user.uid&&!isOwnerDirectoryUser(person(assignee))&&!person(assignee)?.projects.includes(projectId))return toast('این مسئول به پروژه انتخاب‌شده دسترسی ندارد.',true);if(edit&&!canEditTask(old))return toast('امکان ویرایش این فعالیت وجود ندارد.',true);const desired=String(fd.get('status')||old?.status||'todo');if(!Object.hasOwn(statuses,desired))return toast('وضعیت نامعتبر است.',true);if(desired==='blocked'&&edit&&isAdmin()&&!String(fd.get('blockReason')||'').trim())return toast('برای وضعیت متوقف، دلیل توقف ضروری است.',true);if(edit){if(isAdmin()&&managerTask(old)&&!managerPrivate&&!confirm('این فعالیت خصوصی با واگذاری به کارمند، برای مسئول جدید قابل مشاهده می‌شود. ادامه می‌دهید؟'))return;Object.assign(old,{title,projectId,assignee,due,priority:String(fd.get('priority')||'normal'),weight:managerPrivate?0:isProjectControlsManager()?(+fd.get('weight')||3):(old.weight??0),visibility:managerPrivate?(isSystemOwner()?'owner_private':'manager_private'):'team',description:String(fd.get('description')||'').trim(),updatedAt:new Date().toISOString()});if(isAdmin()){if(desired==='blocked'){const reason=String(fd.get('blockReason')||'').trim();old.blockReason=reason;(old.notes||=[]).push({text:'دلیل توقف: '+reason,by:actorName(APP.user.uid),date:isoToday()})}old.status=desired}if(!isAdmin())(old.notes||=[]).push({text:'ویرایش فعالیت توسط '+actorName(APP.user.uid),by:actorName(APP.user.uid),date:isoToday()});record('edit','ویرایش فعالیت'+(fd.get('editReason')?'؛ علت: '+fd.get('editReason'):''),old.id)}else{const t={id:id('t'),title,projectId,assignee,due,priority:String(fd.get('priority')||'normal'),weight:managerPrivate?0:isProjectControlsManager()?(+fd.get('weight')||3):0,visibility:managerPrivate?(isSystemOwner()?'owner_private':'manager_private'):'team',description:String(fd.get('description')||'').trim(),status:'todo',createdBy:APP.user.uid,createdAt:isoToday(),updatedAt:new Date().toISOString(),notes:[],submittedAt:null,evalId:null};D.tasks.push(t);record('new','فعالیت جدید ثبت شد',t.id)}closeModal();save(edit?'فعالیت ویرایش شد.':'فعالیت ثبت شد.')}
function updateProject(fd){const p=proj(U.edit),name=String(fd.get('name')||'').trim();if(!name)return toast('نام پروژه ضروری است.',true);const workOffDays=fd.getAll('offdays').map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6),holidayLabels=String(fd.get('holidaysJ')||'').split(/[،,;\n]+/).map(x=>x.trim()).filter(Boolean),holidays=holidayLabels.map(jparse);if(holidays.some(x=>!x))return toast('تاریخ یکی از تعطیلات پروژه معتبر نیست.',true);if(p){Object.assign(p,{name,code:String(fd.get('code')||''),location:String(fd.get('location')||''),workOffDays,holidays});record('edit','ویرایش پروژه '+name,p.id)}else{const x={id:id('p'),name,code:String(fd.get('code')||''),location:String(fd.get('location')||''),workOffDays,holidays};D.projects.push(x);record('new','ایجاد پروژه '+name,x.id)}closeModal();save('پروژه ذخیره شد.')}
function updateUser(fd){if(!isAdmin())return;const existing=person(U.edit),req=D.requests.find(x=>x.id===U.edit),name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim().toLowerCase(),role=String(fd.get('role'));if(!name||!email.includes('@')||!roles[role])return toast('نام، ایمیل و سمت معتبر وارد کنید.',true);if(!existing&&!req)return toast('درخواست ثبت‌نام معتبر پیدا نشد.',true);const projects=fd.getAll('projects').map(String).filter(x=>!!proj(x));if(existing)Object.assign(existing,{name,role,projects,active:!existing.removed&&fd.get('active')==='yes'});else{D.users.push({id:req.id,uid:req.id,name,email,role,projects,active:fd.get('active')==='yes',status:fd.get('active')==='yes'?'active':'disabled'});req.status='approved';req.reviewedByUid=APP.user.uid;req.reviewedAt=new Date().toISOString()}record('user',(existing?'ویرایش':'تأیید')+' کاربر '+name,existing?.id||'');closeModal();save(existing?'اطلاعات کاربر ذخیره شد.':'حساب بر اساس UID ثبت‌نام‌شده تأیید شد.')}
function manageMember(action,uid){if(!isAdmin())return;const u=person(uid);if(!u||uid===APP.user?.uid||isOwnerDirectoryUser(u))return toast('این حساب قابل تغییر نیست.',true);if(action==='revoke'){if(!u.active||!confirm(`دسترسی ${u.name} فوراً لغو شود؟ حساب و سوابق حفظ می‌شوند.`))return;u.active=false;u.revokedAt=new Date().toISOString();u.revokedByUid=APP.user.uid;record('user','لغو دسترسی '+u.email,uid);save('دسترسی کاربر لغو شد.')}else if(action==='remove'){if(u.removed||!confirm(`${u.name} از فهرست اعضای تیم خارج شود؟ دسترسی فوراً بسته و سابقه برای بازگردانی حفظ می‌شود.`))return;u.active=false;u.removed=true;u.removedAt=new Date().toISOString();u.removedByUid=APP.user.uid;record('user','حذف از تیم و لغو دسترسی '+u.email,uid);save('کاربر از تیم خارج و دسترسی او لغو شد.')}else if(action==='restore'){if(!confirm(`دسترسی ${u.name} دوباره فعال شود؟`))return;u.active=true;u.removed=false;delete u.removedAt;delete u.removedByUid;delete u.revokedAt;delete u.revokedByUid;record('user','بازگردانی دسترسی '+u.email,uid);save('دسترسی کاربر فعال شد.')}}
function updateRecurring(fd){
 const r=D.recurrences.find(x=>x.id===U.edit),title=String(fd.get('title')||'').trim(),start=jparse(fd.get('startJ')),
 end=fd.get('endJ')&&String(fd.get('endJ')).trim()!=='—'?jparse(fd.get('endJ')):null,
 who=String(fd.get('assignee')||(isAdmin()?'':APP.user.uid));
 if(!title||!start)return toast('عنوان و تاریخ شروع شمسی معتبر وارد کنید.',true);
 if(fd.get('endJ')&&String(fd.get('endJ')).trim()!=='—'&&!end)return toast('تاریخ پایان شمسی معتبر نیست.',true);
 if(end&&end<start)return toast('پایان برنامه نباید قبل از شروع باشد.',true);
 const pid=String(fd.get('projectId')||'');
 if(pid&&!proj(pid))return toast('پروژه نامعتبر است.',true);
 if(!isAdmin()&&(who===MANAGER_ID||who!==APP.user.uid||!availableProject(pid)))return toast('دسترسی کافی برای این مورد ندارید.',true);
 const managerPrivate=isAdmin()&&(who===MANAGER_ID||(r&&managerRecurring(r)&&who===APP.user.uid));const assigned=managerPrivate?APP.user.uid:who;if(isAdmin()&&!managerPrivate&&(!assigned||assigned===MANAGER_ID))return toast('برای برنامه تیمی ابتدا یک کارمند فعال انتخاب کن.',true);if(pid&&assigned!==APP.user.uid&&!isOwnerDirectoryUser(person(assigned))&&!person(assigned)?.projects.includes(pid))return toast('این مسئول به پروژه انتخاب‌شده دسترسی ندارد.',true);
 const frequency=String(fd.get('frequency')||'weekly');
 if(!Object.hasOwn(freqNames,frequency))return toast('نوع تکرار نامعتبر است.',true);
 const intervalDays=frequency==='interval'?Number(fd.get('intervalDays')):1;
 if(frequency==='interval'&&(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>365))return toast('فاصله تکرار باید عدد صحیح بین ۱ تا ۳۶۵ روز باشد.',true);
 const intervalBasis=frequency==='interval'?String(fd.get('intervalBasis')||'calendar'):'calendar';
 if(!['calendar','work'].includes(intervalBasis))return toast('مبنای روزها نامعتبر است.',true);
 const weekday=frequency==='weekly'?Number(fd.get('weekday')):0;
 if(frequency==='weekly'&&(!Number.isInteger(weekday)||weekday<0||weekday>6))return toast('روز هفتگی نامعتبر است.',true);
 const monthDay=frequency==='monthly'?String(fd.get('monthDay')||'lastWork'):'lastWork';
 if(frequency==='monthly'&&monthDay!=='lastWork'&&(!/^\d+$/.test(monthDay)||+monthDay<1||+monthDay>31))return toast('روز ماهانه نامعتبر است.',true);
 // هر نوع تکرار فقط از کنترل‌های فعال همان نوع اطلاعات می‌گیرد.
 const workOnly=frequency==='daily'?fd.has('dailyWorkOnly'):frequency==='monthly'?(monthDay==='lastWork'||fd.has('monthlyWorkOnly')):false;
 const v={title,start,end,projectId:pid,assignee:assigned,frequency,weekday,monthDay,intervalDays,intervalBasis,
  weight:managerPrivate?0:isProjectControlsManager()?(+fd.get('weight')||3):(r?.weight??0),visibility:managerPrivate?(isSystemOwner()?'owner_private':'manager_private'):'team',workOnly,description:String(fd.get('description')||'').trim()};
 if(r){if(!isAdmin())return toast('ویرایش برنامه تکراری فقط توسط مدیر انجام می‌شود.',true);
  const changed=['start','frequency','weekday','monthDay','workOnly','intervalDays','intervalBasis'].some(k=>String(r[k]??'')!==String(v[k]??''));
  Object.assign(r,v);
  if(changed){const newStart=start>isoToday()?start:isoToday();r.scheduleFrom=newStart;r.scheduleAnchor=newStart}
  record('edit','ویرایش برنامه تکراری '+title,r.id)}
 else{const obj={id:id('rr'),...v,state:isAdmin()?'active':'pending',createdBy:APP.user.uid,excluded:[]};D.recurrences.push(obj);record('new','ثبت برنامه تکراری '+title,obj.id)}
 closeModal();if(!isAdmin())U.roleTab='recurring';generateDue();save(r?'برنامه ویرایش شد.':isAdmin()?'برنامه تکراری ایجاد شد.':'درخواست برنامه به وثوق ارسال شد.')
}
function updateGrade(fd){const t=D.tasks.find(t=>t.id===U.edit);if(!t||!isAdmin()||managerTask(t))return toast('کارهای شخصی مدیر کنترل پروژه مشمول ارزیابی نیستند.',true);const delivered=jparse(fd.get('deliveredJ'));if(!delivered)return toast('تاریخ تحویل شمسی معتبر نیست.',true);const qual=Math.max(1,Math.min(5,+fd.get('quality'))),complete=Math.max(1,Math.min(5,+fd.get('complete'))),excused=fd.has('excused');const late=Math.max(0,Math.round((Date.parse(delivered+'T12:00:00Z')-Date.parse(t.due+'T12:00:00Z'))/86400000));const timing=excused?100:Math.max(0,100-late*15);const score=Math.round(qual*10+complete*4+timing*.3);const workWeight=Math.max(1,+t.weight||1);const ev={id:id('ev'),taskId:t.id,weight:workWeight,assignee:t.assignee,projectId:t.projectId,quality:qual,complete,timing,score,excused,deliveredAt:delivered,date:isoToday(),at:new Date().toISOString(),feedback:String(fd.get('feedback')||''),previousId:t.evalId||null};D.evaluations.push(ev);t.evalId=ev.id;t.status='done';t.submittedAt=delivered;t.updatedAt=new Date().toISOString();/* امتیاز فقط در evaluations (قابل‌خواندن برای مدیر) ثبت می‌شود؛ در تاریخچه عمومی افشا نشود. */closeModal();save(`امتیاز ${num(score)} از ۱۰۰ ثبت شد.`)}
function download(name,data,mime){const u=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
const csv=rows=>'\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
function backup(){download('pch-vosough-backup-'+toEn(jstr(isoToday())).replaceAll('/','-')+'.json',JSON.stringify(D,null,2),'application/json;charset=utf-8');toast('فایل پشتیبان دریافت شد.')}
function backupSyncRecovery(){
 const output={version:'v18',date:new Date().toISOString(),firebaseProject:firebaseConfig.projectId,
  pending:[...pendingOps.values()],conflicts:JSON.parse(localStorage.getItem(conflictStoreKey())||'[]'),
  originalPending:JSON.parse(localStorage.getItem(`pch-pre-v15-outbox:${APP.user?.uid}`)||'[]')};
 download('pch-sync-recovery-'+Date.now()+'.json',JSON.stringify(output,null,2),'application/json;charset=utf-8');
}
function exportCsv(kind){let rows;if(kind==='csv-tasks')rows=[['عنوان','مسئول','پروژه','موعد شمسی','وضعیت','وزن','امتیاز'],...D.tasks.map(t=>[t.title,actorName(t.assignee),projectName(t.projectId),jstr(t.due),taskStatus(t),t.weight,taskScore(t)??''])];else if(kind==='csv-users')rows=[['نام','ایمیل','سمت','پروژه‌های مجاز','فعال'],...D.users.map(u=>[u.name,u.email,roles[u.role],u.projects.map(projectName).join('؛ '),u.active?'بله':'خیر'])];else rows=[['عنوان کار','نام نیرو','امتیاز','کیفیت','کامل بودن','زمان','تاریخ شمسی'],...D.evaluations.filter(e=>e.assignee!==MANAGER_ID&&!managerTask(D.tasks.find(t=>t.id===e.taskId))).map(e=>[D.tasks.find(t=>t.id===e.taskId)?.title||'فعالیت حذف‌شده',actorName(e.assignee),e.score,e.quality,e.complete,e.timing,jstr(e.date)])];download(kind+'-'+toEn(jstr(isoToday())).replaceAll('/','-')+'.csv',csv(rows),'text/csv;charset=utf-8')}
function handleAction(act,el){const x=el?.dataset.id||'';switch(act){case'delete-single-occurrence':{closeModal();archiveTask(x);break}case'delete-all-occurrences':{closeModal();handleAction('delete-recurring',{dataset:{id:x}});break}case'restore-trash-task':restoreTrashItem(x);break;case'purge-trash-task':purgeTrashItem(x);break;case'toggle-task-card':{if(U.expandedTasks.includes(x)){const el=document.querySelector(`[data-task-card="${CSS.escape(x)}"]`);if(el&&([...el.querySelectorAll('[data-inline-field]')].some(f=>f.dataset.inlineField==='note'&&f.value.trim()||f.dataset.inlineField==='status'&&f.value!==D.tasks.find(t=>t.id===x)?.status))&&!confirm('تغییرات ذخیره‌نشده از بین بروند؟')))return;U.expandedTasks=U.expandedTasks.filter(id=>id!==x)}else U.expandedTasks.push(x);render();break}case'toggle-task-filter':U.taskFilterOpen=!U.taskFilterOpen;render();break;case'task-quick':U.taskQuick=x;render();break;case'save-inline-task':saveInlineTask(x);break;case'toggle-auth-mode':APP.authMode=APP.authMode==='signup'?'login':'signup';APP.authError='';render();break;case'google-auth':signInWithRedirect(auth,googleProvider).catch(e=>{APP.authError=authMessage(e);render()});break;case'sign-out':signOut(auth);break;case'set-theme-mode':setThemeMode(x);break;case'toggle-theme-mode':{const next=readTheme()==='dark'?'light':'dark';setThemeMode(next);break}case'toggle-menu':U.mobileNav=!U.mobileNav;render();break;case'close-modal':closeModal();break;case'new-project':pushModal('project');break;case'edit-project':pushModal('project',x);break;case'show-team-tasks':if(!isAdmin())return;U.page='tasks';U.taskView='team';render();window.scrollTo(0,0);break;case'show-private-tasks':if(!isAdmin())return;U.page='tasks';U.taskView='private';render();window.scrollTo(0,0);break;case'duty-show-supervisor':if(!isAdmin())return;U.dutyRole='supervisor';render();break;case'duty-show-expert':if(!isAdmin())return;U.dutyRole='expert';render();break;case'toggle-overdue':U.showAllOverdue=!U.showAllOverdue;render();break;case'new-task':U.taskCreateMode='team';U.taskView='team';pushModal('task');break;case'new-own-task':if(!isAdmin())return;U.taskCreateMode='private';U.page='tasks';U.taskView='private';pushModal('task');break;case'edit-task':if(!canEditTask(D.tasks.find(t=>t.id===x)))return;U.taskCreateMode=managerTask(D.tasks.find(t=>t.id===x))?'private':'team';pushModal('task',x);break;case'task-detail':if(!isAdmin()&&!canSeeTask(D.tasks.find(t=>t.id===x)))return;pushModal('details',x);break;case'new-request':case'new-user':return toast('عضویت فقط از فرم ثبت‌نام Firebase انجام می‌شود.',true);case'approve-user':pushModal('user',x);break;case'edit-user':pushModal('user',x);break;case'revoke-user':manageMember('revoke',x);break;case'remove-user':manageMember('remove',x);break;case'restore-user':manageMember('restore',x);break;case'export-sync-report':exportSyncReport();break;case'retry-auth':{if(!APP.user)return;const version=++APP.authVersion;APP.loading=true;APP.authError='';render();handleAuthUser(APP.user,version);break}case'retry-sync':if(!APP.user||!APP.approved)return toast('برای همگام‌سازی باید با حساب فعال وارد شوی.',true);persist().then(()=>{if(!pendingOps.size)toast('تغییرات با Firebase ثبت شد.');}).catch(showSyncFailure);break;case'new-recurring':if(APP.readOnlyPreview)return toast('این پنل فقط برای مشاهده است؛ برای ثبت برنامه از حساب فعال همان سمت وارد شوید.',true);U.recurringCreateMode='team';pushModal('recurring');break;case'new-own-recurring':if(!isAdmin())return;U.recurringCreateMode='private';pushModal('recurring');break;case'edit-recurring':if(APP.readOnlyPreview)return toast('این پنل فقط برای مشاهده است.',true);U.recurringCreateMode=managerRecurring(D.recurrences.find(r=>r.id===x))?'private':'team';pushModal('recurring',x);break;case'request-delete-task':requestRemovalOfTask(x);break;case'resolve-deletion-request':resolveTaskRemoval(x);break;case'reject-deletion-request':resolveTaskRemoval(x,true);break;case'grade-task':if(isAdmin()&&!managerTask(D.tasks.find(t=>t.id===x)))pushModal('grade',x);break;case'person-detail':if(isAdmin())pushModal('person',x);break;case'back-admin':if(isAdmin())setPage('panels');break;case'install-app':installApplication();break;case'to-panels':setPage('panels');break;case'go-reviews':U.filterStatus='review';setPage('tasks');break;case'show-project-tasks':U.filterProject=x;setPage('tasks');break;case'clear-filter':U.filterProject='all';U.filterStatus='all';U.filterText='';U.taskPerson='all';U.taskSort='default';U.taskGroup='none';U.taskQuick='all';render();break;case'open-role':openRole(x);break;case'refresh-log':render();break;case'calendar-prev':U.calendarOffset--;U.calendarSelect=null;render();break;case'calendar-next':U.calendarOffset++;U.calendarSelect=null;render();break;case'calendar-today':U.calendarOffset=0;U.calendarSelect=null;render();break;case'month-day':U.calendarSelect=x;render();break;case'perf-prev':U.monthShift--;render();break;case'perf-next':U.monthShift++;render();break;case'backup':backup();break;case'backup-sync-recovery':backupSyncRecovery();break;case'restore':return toast('بازیابی فایل محلی به Firebase برای جلوگیری از انتقال ناخواسته داده غیرفعال است.',true);case'print':window.print();break;case'csv-tasks':case'csv-users':case'csv-scores':exportCsv(act);break;
case'delete-task':{const t=D.tasks.find(t=>t.id===x);if(!t||!canDeleteTask(t))return toast('مجوز حذف فعالیت وجود ندارد.',true);if(t.seriesId){pushModal('deleteChoice',x);return}if(!confirm(`فعالیت «${t.title}» به سطل زباله منتقل شود؟`))return;archiveTask(x);break}
case'delete-project':{if(!isAdmin())return;const p=proj(x);if(!p)return;const attached=D.tasks.filter(t=>t.projectId===x).length;if(!confirm(`پروژه «${p.name}» حذف شود؟\n${num(attached)} وظیفه موجود به «بدون پروژه» منتقل می‌شوند و خود وظایف حذف نخواهند شد.`))return;D.projects=D.projects.filter(q=>q.id!==x);D.tasks.forEach(t=>{if(t.projectId===x)t.projectId=''});D.recurrences.forEach(r=>{if(r.projectId===x)r.projectId=''});D.users.forEach(u=>u.projects=u.projects.filter(k=>k!==x));record('delete','حذف پروژه '+p.name,x);save('پروژه حذف شد؛ وظایف حفظ شدند.');break}
case'reject-user':{if(!isAdmin())return;const r=D.requests.find(q=>q.id===x);if(r&&confirm(`درخواست ${r.name} رد شود؟`)){r.status='rejected';r.reviewedByUid=APP.user.uid;r.reviewedAt=new Date().toISOString();record('user','رد درخواست '+r.email);save('درخواست رد شد.')}break}
case'approve-recurring':{if(!isAdmin())return;const r=D.recurrences.find(z=>z.id===x);if(!r)return;r.state='active';record('edit','تأیید برنامه تکراری '+r.title,r.id);generateDue();save('برنامه تأیید شد و نوبت‌های موعدرسیده ایجاد شدند.');break}
case'toggle-recurring':{if(!isAdmin())return;const r=D.recurrences.find(z=>z.id===x);if(!r)return;r.state=r.state==='active'?'paused':'active';record('edit',r.state==='paused'?'توقف برنامه':'فعال‌سازی برنامه',r.id);if(r.state==='active')generateDue();save('وضعیت تکرار تغییر کرد.');break}
case'delete-recurring':{if(!isAdmin())return;const r=D.recurrences.find(z=>z.id===x);if(!r)return;const related=D.tasks.filter(t=>t.seriesId===r.id);if(!confirm(`حذف کل برنامه «${r.title}»؟\n${num(related.length)} نوبت موجود به سطل زباله منتقل می‌شوند و نوبت آینده ساخته نخواهد شد.`))return;(async()=>{for(const t of related){const okay=await archiveTask(t.id,true);if(!okay)return toast('برخی نوبت‌ها حذف نشدند؛ برنامه مادر فعلاً حفظ شد.',true)}queueExplicitDelete('recurrences',r);D.recurrences=D.recurrences.filter(z=>z.id!==x);try{await persist();toast('حذف برنامه و نوبت‌های مرتبط تأیید شد.')}catch(err){showSyncFailure(err)}})();break}
case'reset-all':return toast('پاک‌سازی گروهی داده‌های Firebase از داخل اپ غیرفعال است.',true);}}
const modalForms=new Set(['form-task','form-project','form-request','form-user','form-recurring','form-grade','form-note']);
document.addEventListener('click',e=>{const cal=e.target.closest('[data-datepicker]');if(cal){openCalendar(cal.dataset.datepicker);return}if(e.target.closest('#date-popup'))return;const b=e.target.closest('[data-action],[data-nav]');if(!b){if($('#date-popup')?.style.display==='block')$('#date-popup').style.display='none';return}if(b.dataset.nav){if(U.preview)setRoleTab(b.dataset.nav);else setPage(b.dataset.nav);return}if(b.dataset.action==='close-outside'){if(e.target===b)closeModal();return}handleAction(b.dataset.action,b)});
document.addEventListener('change',e=>{
 const b=e.target;
 if(b.matches('#form-recurring [data-recurring-frequency],#form-recurring [data-recurring-monthday]')){syncRecurringFields();return}
 if(b.matches('#form-task [name="assignee"],#form-recurring [name="assignee"]')){syncManagerAssignmentFields();return}
 if(b.hasAttribute('data-actor')){U.actor=b.value;render();return}
 if(b.dataset.dailyCheck){changeTaskStatus(b.dataset.dailyCheck,b.checked?'done':'todo');return}
 if(b.dataset.myStatus){changePrivateTaskStatus(b.dataset.myStatus,b.value);return}
 if(b.hasAttribute('data-task-status-selector')){const box=$('#admin-stop-reason'),ta=box?.querySelector('textarea');if(box){box.style.display=b.value==='blocked'?'':'none';if(ta)ta.required=b.value==='blocked'}return}
 if(b.hasAttribute('data-task-person')){U.taskPerson=b.value;render();return}if(b.hasAttribute('data-task-sort')){U.taskSort=b.value;render();return}if(b.hasAttribute('data-task-group')){U.taskGroup=b.value;render();return}if(b.dataset.filter){if(b.dataset.filter==='project')U.filterProject=b.value;else U.filterStatus=b.value;render();return}
 if(b.dataset.perf){if(b.dataset.perf==='project')U.perfProject=b.value;else U.perfRole=b.value;render();return}
 if(b.dataset.permission){if(!isSystemOwner())return;const [r,k]=b.dataset.permission.split(':');D.permissions[r][k]=b.checked;save('مجوز تغییر کرد.');return}
});
document.addEventListener('focusout',()=>{if(liveViewRefreshPending)setTimeout(()=>refreshFromFirestore(),0)});
document.addEventListener('input',e=>{if(e.target.id==='task-query'){let text=e.target.value,pos=e.target.selectionStart;U.filterText=text;render();const target=$('#task-query');if(target){target.focus();target.setSelectionRange(pos,pos)}}});
document.addEventListener('submit',e=>{const f=e.target;if(f.id==='auth-form'){e.preventDefault();authSubmit(f);return}if(!modalForms.has(f.id))return;e.preventDefault();const fd=new FormData(f);if(f.id==='form-task')return updateTask(fd);if(f.id==='form-project')return updateProject(fd);if(f.id==='form-user')return updateUser(fd);if(f.id==='form-recurring')return updateRecurring(fd);if(f.id==='form-grade')return updateGrade(fd);if(f.id==='form-request'){const name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim().toLowerCase();if(!name||!email.includes('@'))return toast('نام و ایمیل معتبر ضروری است.',true);if([...D.users,...D.requests].some(u=>u.email===email))return toast('ایمیل تکراری است.',true);D.requests.push({id:id('req'),name,email,date:isoToday()});record('user','درخواست عضویت '+email);closeModal();save('درخواست ثبت شد و در بخش کاربران وثوق قابل مشاهده است.');return}if(f.id==='form-note'){const t=D.tasks.find(x=>x.id===U.edit),note=String(fd.get('note')||'').trim();if(!t||!note)return;if(!canSeeTask(t))return;if(!t.notes)t.notes=[];t.notes.push({text:note,by:actorName(APP.user.uid),date:isoToday()});record('note','افزودن یادداشت',t.id);persist().then(()=>{renderModal();toast('یادداشت ثبت شد.')}).catch(showSyncFailure);renderModal();return}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#date-popup')?.style.display==='block')$('#date-popup').style.display='none';else if(U.modal)closeModal()}});
let dpTarget=null,dpMonth=null;
function openCalendar(name){dpTarget=$(`[name="${name}"]`);if(!dpTarget)return;const selected=jparse(dpTarget.value)||isoToday();dpMonth=jparts(selected);paintDateCalendar();const box=$('#date-popup'),r=dpTarget.getBoundingClientRect(),left=Math.min(window.innerWidth-310,Math.max(8,r.left));box.style.left=left+'px';box.style.top=Math.min(window.innerHeight-365,Math.max(8,r.bottom+5))+'px';box.style.display='block'}
function paintDateCalendar(){const y=dpMonth.y,m=dpMonth.m,len=daysInMonth(y,m),start=wd(fromJ(y,m,1)),c=['<div class="datecal-week">'+DW.map(x=>`<span>${x.slice(0,1)}</span>`).join('')+'</div>','<div class="datecal-grid">'];for(let i=0;i<start;i++)c.push('<i></i>');for(let n=1;n<=len;n++)c.push(`<button data-pick="${fromJ(y,m,n)}">${toFa(n)}</button>`);c.push('</div>');$('#date-popup').innerHTML=`<div class="datecal-head"><button data-shift="-1">‹</button><b>${M[m-1]} ${toFa(y)}</b><button data-shift="1">›</button></div>${c.join('')}<button class="datecal-today" data-pick="${isoToday()}">امروز · ${jstr(isoToday())}</button>`}
$('#date-popup').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();if(b.dataset.shift){let m=dpMonth.m+(+b.dataset.shift);if(m<1){dpMonth.y--;m=12}if(m>12){dpMonth.y++;m=1}dpMonth.m=m;paintDateCalendar()}if(b.dataset.pick){if(dpTarget)dpTarget.value=jstr(b.dataset.pick);$('#date-popup').style.display='none'}});
async function installApplication(){if(pwaInstalled()){render();return}if(installPromptEvent){const promptEvent=installPromptEvent;installPromptEvent=null;try{await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice?.outcome==='accepted')toast('اپلیکیشن به صفحهٔ اصلی اضافه شد.');else toast('درخواست نصب لغو شد.');}catch(e){toast('نصب از این مرورگر در دسترس نیست.',true)}render();return}toast('از منوی مرورگر، «افزودن به صفحهٔ اصلی» یا «نصب برنامه» را انتخاب کن.')}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPromptEvent=e;if(U.page==='more'||U.roleTab==='more')render()});
window.addEventListener('appinstalled',()=>{installPromptEvent=null;render()});
window.addEventListener('online',()=>{if(APP.user&&!APP.approved){const version=++APP.authVersion;APP.loading=true;handleAuthUser(APP.user,version)}else if(APP.approved&&pendingOps.size)persist().catch(reportBackgroundSyncFailure);else{APP.syncError='';render()}});
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&APP.approved&&pendingOps.size&&!APP.pendingWrites)persist().catch(reportBackgroundSyncFailure)});
window.addEventListener('offline',()=>render());
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('PCH service worker registration failed',e)));
startApp();
