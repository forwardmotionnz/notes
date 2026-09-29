import * as H from './harness.mjs';
const t=H.suite('recent-notes');await H.start();
const gh=H.fakeGitHub({files:{'a.md':'# Alpha\n\nA useful preview','b.md':'# Beta\n\nChanged elsewhere','.secret.md':'private'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);
// REST commit summaries omit files; commit details provide names and statuses.
// https://docs.github.com/en/rest/commits/commits
const sha='a'.repeat(40);let historyReads=0;
await c.route('https://api.github.com/**/commits**',r=>{historyReads++;const detail=new URL(r.request().url()).pathname.endsWith('/'+sha);return r.fulfill({contentType:'application/json',body:JSON.stringify(detail?{files:[{filename:'b.md',status:'modified'},{filename:'.secret.md',status:'modified'}]}:[{sha,commit:{committer:{date:'2026-09-28T12:00:00Z'}}}])});});
const exists=await p.locator('#recent-notes').count();t.check('Recent section exists',exists===1);
if(exists){
 t.check('history loads only on demand',historyReads===0);await p.evaluate(()=>openFile('a.md'));await p.locator('#recent-notes summary').click();await p.waitForFunction(()=>!recentLoading&&document.querySelector('#recent-status').textContent.includes('10 commits'));
 const text=await p.textContent('#recent-list');t.check('recently opened and repository changes have titles and previews',text.includes('Alpha')&&text.includes('A useful preview')&&text.includes('Beta')&&text.includes('Changed elsewhere'));
 t.check('times and bounded history are described',/2026|202[7-9]/.test(text)&&/10 commits/.test(await p.textContent('#recent-status')));
 t.check('hidden notes never appear',!text.includes('private')&&!text.includes('.secret'));
 await p.locator('#recent-list button').filter({hasText:'Beta'}).click();await p.waitForFunction(()=>current?.path==='b.md');t.check('recent result opens note',await H.editorValue(p)==='# Beta\n\nChanged elsewhere');
 await H.setEditor(p,'# Local draft\n\nNewest words');await p.evaluate(()=>loadRecent());t.check('previews prefer local draft',/Local draft.*Newest words/s.test(await p.textContent('#recent-list')));
 await p.evaluate(()=>resetNoteReads());let reads=0;await c.route('**/contents/a.md?*',async r=>{reads++;await new Promise(x=>setTimeout(x,40));return r.fallback();});
 await p.evaluate(()=>Promise.all([sharedRead('a.md'),sharedRead('a.md'),sharedRead('a.md')]));t.check('shared reader deduplicates simultaneous blob reads',reads===1);
 await p.evaluate(()=>sharedRead('a.md'));t.check('unchanged blob is cached',reads===1);
 await c.unroute('**/contents/a.md?*');
 await p.evaluate(()=>resetNoteReads());let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 await c.route('**/contents/a.md?*',async r=>{entered();await gate;return r.fallback();});
 await p.evaluate(()=>{window.oldRead=sharedRead('a.md');});await started;
 await p.evaluate(()=>{resetNoteReads();window.newRead=sharedRead('a.md');});
 t.check('invalidation does not reuse an in-flight stale read',await p.evaluate(()=>noteReadPending.size===2));release();await p.evaluate(()=>Promise.all([oldRead,newRead]));await c.unroute('**/contents/a.md?*');
 await c.route('https://api.github.com/**/commits**',r=>r.fulfill({status:500,body:'unavailable'}));
 await p.evaluate(()=>loadRecent());t.check('history failure keeps opened notes with an honest notice',/Local draft/.test(await p.textContent('#recent-list'))&&/unavailable/i.test(await p.textContent('#recent-status')));
 await p.evaluate(()=>{showPointed(pointAt('another','vault','main',[]));});t.check('repository change clears old previews and cache',await p.textContent('#recent-list')===''&&await p.evaluate(()=>noteReadCache.size===0));
}
await c.close();
{
 const gh=H.fakeGitHub({files:Object.fromEntries(Array.from({length:70},(_,i)=>['n'+i+'.md','body '+i]))}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);await p.evaluate(()=>resetNoteReads());
 let release;const gate=new Promise(r=>release=r);let count=0;
 await c.route('**/contents/n*.md?*',async r=>{count++;await gate;return r.fallback();});
 await p.evaluate(()=>{window.readerLive=true;window.readerResults=Promise.all(Array.from({length:12},(_,i)=>sharedRead('n'+i+'.md',()=>readerLive).catch(e=>e)));});await p.waitForFunction(()=>noteReadActive===4&&noteReadQueue.length===8);
 await p.evaluate(()=>{readerLive=false;});release();const results=await p.evaluate(()=>readerResults);
 t.check('reader caps concurrency and cancels queued work',count===4&&results.every(r=>r.cancelled));await c.unroute('**/contents/n*.md?*');
 await p.evaluate(()=>Promise.all(files.filter(f=>f.type==='blob').map(f=>sharedRead(f.path))));t.check('cache is bounded by entries and bytes',await p.evaluate(()=>noteReadCache.size===64&&noteReadBytes<=2097152));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{ui.recent={scope:recentScope(),paths:files.slice(0,20).map(f=>f.path)};recentChanges=async()=>[];document.querySelector('#recent-notes').open=true;document.body.classList.add('tree-open');});await p.evaluate(()=>loadRecent());
 t.check('long Recent list scrolls within the phone screen',await p.locator('#recent-list').evaluate(el=>el.scrollHeight>el.clientHeight&&el.clientHeight<=innerHeight*.26&&getComputedStyle(el).overflowY==='auto'));
 await p.evaluate(()=>{recentChanges=async function(){cfg.token='';cfg.refresh='';throw signedOutError();};});await p.evaluate(()=>loadRecent());t.check('expired sign-in prompts again and ends loading',await H.dialogOpen(p)&&!(await p.textContent('#recent-status')).includes('Loading'));
 t.check('sign-in boundary clears cached private text',await p.evaluate(()=>noteReadCache.size===0));await c.close();
}
{
 const gh=H.fakeGitHub({files:{'a.md':'same','b.md':'same'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);await p.evaluate(()=>resetNoteReads());gh.files['a.md']='changed';
 const r=await p.evaluate(()=>Promise.all([sharedRead('a.md'),sharedRead('b.md')]));t.check('formerly identical notes cannot borrow a changed path response',r[0].text==='changed'&&r[1].text==='same');await c.close();
}
await H.stop();t.finish();
