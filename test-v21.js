const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=__dirname;
const js=fs.readFileSync(dir+'/app.js','utf8');
const html=fs.readFileSync(dir+'/index.html','utf8');
const rules=fs.readFileSync(dir+'/firestore.rules','utf8');
const seed=JSON.parse(fs.readFileSync(dir+'/کتابخانه-وظایف-برای-بارگذاری-یکباره.json','utf8'));
assert.equal(seed.roles.supervisor.length,24);
assert.equal(seed.roles.expert.length,23);
assert(!js.includes('const TASK_LIBRARY='),'templates must not be in public JS');
assert(rules.includes("match /settings/{id}{allow get,list:if admin();allow create,update,delete:if owner();}"),'restricted Firestore settings');
assert(rules.includes('isProtectedOwnerDirectory'),'protection for owner personnel record');
assert(!js.includes('sendEmailVerification(APP.user)'));
assert(!js.includes('verifyManagerEmail'));
assert(rules.includes('allow create:if signed()&&request.auth.uid==uid'));
assert(!rules.includes('function verified()'));
assert(js.includes("const trustedRole=specialRole"));
assert(!js.includes("specialRole&&!APP.user.emailVerified"));
assert(js.includes("role:'supervisor',status:'active'"));
assert(js.includes('رنگی')===false,'obsolete palette UI labels must not appear');
assert(html.includes('--bg:#101012')&&html.includes('--paper:#1c1c1f'));
assert(html.includes('v21-no-email-verification'));
// Verify the nav across 4 employee roles uses shared roleNav and omits only the create action.
const nav=js.slice(js.indexOf('function mobileBottomNav()'),js.indexOf('function adminShell()'));
const ctxt={U:{preview:'expert',roleTab:'home',page:'dashboard'},icon:(x)=>`{${x}}`};vm.createContext(ctxt);
vm.runInContext(nav+'\nthis.nav=mobileBottomNav;',ctxt);
for(const role of ['supervisor','senior','expert','intern']){
 ctxt.U.preview=role; const markup=ctxt.nav();
 assert(!markup.includes('ثبت کار'),'create button remains for '+role);
 for(const title of ['خانه','کارهای من','تعهدات','بیشتر'])assert(markup.includes(title),role+' missing '+title);
}
ctxt.U.preview=null;assert(ctxt.nav().includes('وظایف'),'manager nav still present');
// Verify admin-only library returns no entries to staff regardless of data in D.
const templateLine=js.slice(js.indexOf('const templateEntries='),js.indexOf('\nfunction assigneeTemplateRole'));
let libraryAdmin=false;const libCtx={D:{library:[seed]},isAdmin:()=>libraryAdmin};vm.createContext(libCtx);
vm.runInContext(templateLine+'\nthis.templates=templateEntries;',libCtx);
assert.equal(libCtx.templates('expert').length,0);
libraryAdmin=true;
assert.equal(libCtx.templates('expert').length,23);
assert.equal(libCtx.templates('supervisor','recurring').length,21);
// Verify the interval recurrence engine behavior preserved.
const ri=js.indexOf('function isProjectWorkingDay(r,iso)'),re=js.indexOf('function createInstance(r,iso',ri);
assert(ri>=0&&re>ri);
const fromISO=d=>new Date(d+'T12:00:00Z');
const c2={Date,console,Math,Number,proj:()=>({workOffDays:[6],holidays:[]}),wd:iso=>(fromISO(iso).getUTCDay()+1)%7,addDays:(iso,n)=>{const d=fromISO(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)},jparts:()=>({y:1405,m:9,d:1})};vm.createContext(c2);vm.runInContext(js.slice(ri,re),c2);
for(const n of [2,3,5,10]){const r={frequency:'interval',intervalDays:n,intervalBasis:'calendar',start:'2026-11-22',scheduleFrom:'2026-11-22',scheduleAnchor:'2026-11-22',projectId:'a'};assert(c2.rShould(r,'2026-11-22'));assert(c2.rShould(r,c2.addDays('2026-11-22',n)));assert(!c2.rShould(r,'2026-11-23'))}
console.log('PASS: 47 standard templates in protected-import JSON; library permission; owner directory; no manager email verification; all 4 employee navs; matte-black mode; dynamic recurrence 2,3,5,10 days.');
