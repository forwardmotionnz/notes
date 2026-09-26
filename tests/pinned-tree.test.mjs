import * as H from './harness.mjs';
const t=H.suite('pinned-tree');
await H.start();
for (const width of [1280,390]) {
 const gh=H.fakeGitHub({files:{'todo.md':'# Tasks\n- [ ] One\n','notes.md':'# Notes\n'}});
 const ctx=await H.context(gh,{viewport:{width,height:844}}),p=await H.page(ctx);
 await H.signIn(p);p.setDefaultTimeout(5000);
 t.check(`${width}: old sheet button and Settings field removed`,await p.locator('#btn-pins, #f-pins').count()===0);
 t.check(`${width}: pinned entries live above the file tree`,await p.evaluate(()=>document.querySelector('#sidebar #pin-tabs')!==null));
 if (!await p.locator('#sidebar #pin-tabs').count()) {await ctx.close();continue;}
 if(width===390)await p.click('#btn-tree');
 await p.locator('#pin-tabs button').first().click();
 await p.waitForFunction(()=>current?.path==='todo.md');
 t.check(`${width}: checklist occupies main area and closes Files`,await p.evaluate(()=>document.body.classList.contains('task-view')&&!document.body.classList.contains('tree-open')));
 await p.locator('#pin-list input').first().check();
 await p.waitForFunction(()=>!pinBusy['todo.md']);
 t.check(`${width}: task tick commits the right note`,gh.files['todo.md'].includes('[x] One'));
 await p.click('#btn-source');
 t.check(`${width}: Edit note exposes Markdown`,await p.locator('#editor-pane').isVisible());
 await p.click('#btn-pin');
 t.check(`${width}: unpin removes only the local pin`,await p.locator('#pin-tabs button').count()===0 && gh.files['todo.md'].includes('[x] One'));
 await p.click('#btn-pin');
 t.check(`${width}: pin toggle is pressed and persisted`,await p.getAttribute('#btn-pin','aria-pressed')==='true' && await p.evaluate(()=>JSON.parse(localStorage.getItem('notes.config.v2')).pins.includes('todo.md')));
 t.check(`${width}: pin location is explained`,/this browser/i.test(await p.textContent('#pin-help')));
 const commits=gh.commits.length;
 await p.reload();await p.waitForFunction(()=>current?.path==='todo.md');
 t.check(`${width}: pin survives reload without repository writes`,await p.locator('#pin-tabs button').count()===1 && gh.commits.length===commits);
 await ctx.close();
}
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n','other.md':'- [ ] B\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await H.setPins(p,'todo.md, other.md');
 await p.evaluate(()=>openFile('other.md'));await p.evaluate(()=>openFile('todo.md'));
 await p.route('**/contents/other.md?*',r=>r.fulfill({status:503,body:'{}'}));
 await p.locator('#pin-tabs button').nth(1).click();
 await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('temporarily unavailable'));
 t.check('failed pin selection keeps header and checklist on the same file',await p.evaluate(()=>current.path===activePin() && document.querySelector('#task-title').textContent===current.path));
 await ctx.close();
}
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.evaluate(()=>openFile('todo.md'));await H.setEditor(p,'MY RECOVERABLE WORDS');
 gh.files['todo.md']='x'.repeat(1100*1024);await p.reload();
 await p.waitForFunction(()=>current?.path==='todo (unsaved copy).md');
 t.check('rescued draft is visible in source after reload',await p.locator('#editor-pane').isVisible() && (await H.editorValue(p))==='MY RECOVERABLE WORDS');
 await ctx.close();
}
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.evaluate(()=>openFile('todo.md'));await H.setEditor(p,'- [ ] A\nMY UNSAVED WORDS');
 await p.route('**/contents/todo.md',r=>r.request().method()==='PUT'?r.fulfill({status:503,body:'{}'}):r.fallback());
 await p.click('#btn-tasks');
 await p.waitForFunction(()=>!saving);
 t.check('Tasks cannot hide edits after a failed save',await p.locator('#editor-pane').isVisible() && (await H.editorValue(p)).includes('MY UNSAVED WORDS'));
 await p.unroute('**/contents/todo.md');await p.click('#btn-tasks');
 await p.waitForFunction(()=>document.body.classList.contains('task-view'));
 t.check('Tasks saves source edits before changing views',gh.files['todo.md'].includes('MY UNSAVED WORDS'));
 await ctx.close();
}
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.evaluate(()=>openFile('todo.md'));await H.setEditor(p,'- [ ] A\nChanged');
 let release,entered;const gate=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await p.route('**/contents/todo.md',async r=>{if(r.request().method()==='PUT'){entered();await gate;}await r.fallback();});
 gh.files['Elsewhere.md']='A different note';
 const switchView=p.evaluate(()=>showTasks());await requested;
 await p.evaluate(()=>openFile('Elsewhere.md'));release();await switchView;
 t.check('a slow Tasks save cannot replace a newer selection',await p.evaluate(()=>current.path==='Elsewhere.md'&&!document.body.classList.contains('task-view')&&editor.getValue()==='A different note'));
 await ctx.close();
}
await H.stop();t.finish();
