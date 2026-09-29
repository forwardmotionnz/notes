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
 // N37: a pinned note is a shortcut; it opens in the editor like any note.
 t.check(`${width}: pinned note opens like any note and closes Files`,await p.locator('#editor-pane').isVisible()&&await p.evaluate(()=>!document.body.classList.contains('tree-open')));
 t.check(`${width}: its shortcut is marked as the open note`,await p.getAttribute('#pin-tabs button >> nth=0','aria-current')==='true');
 await H.preview(p);
 await p.locator('#pin-list input').first().check();
 await p.waitForFunction(()=>!pinBusy['todo.md']);
 t.check(`${width}: task tick commits the right note`,gh.files['todo.md'].includes('[x] One'));
 await p.click('#btn-preview');
 t.check(`${width}: Edit exposes Markdown`,await p.locator('#editor-pane').isVisible());
 await p.click('#btn-pin');
 t.check(`${width}: unpin removes only the local pin`,await p.locator('#pin-tabs button').count()===0 && gh.files['todo.md'].includes('[x] One'));
 await p.click('#btn-pin');
 // Since N15 a Markdown note is pinned by a property in the note itself (the
 // owner's request), no longer only in this browser's settings.
 await p.waitForFunction(()=>!saving);
 t.check(`${width}: pin toggle is pressed and persisted`,await p.getAttribute('#btn-pin','aria-pressed')==='true' && /^---\npinned: true\n---\n/.test(gh.files['todo.md']));
 t.check(`${width}: pin location is explained`,/every device/i.test(await p.textContent('#pin-help')));
 const commits=gh.commits.length;
 await p.reload();await p.waitForFunction(()=>current?.path==='todo.md');
 t.check(`${width}: pin survives reload without further repository writes`,await p.locator('#pin-tabs button').count()===1 && gh.commits.length===commits);
 await ctx.close();
}
{
 // N37 review: the shortcut is marked only while its note is open.
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await H.setPins(p,'todo.md');await p.locator('#pin-tabs button').first().click();await p.waitForFunction(()=>current?.path==='todo.md');
 t.check('open pinned note: its shortcut is marked',await p.locator('#pin-tabs button.active[aria-current="true"]').count()===1);
 await p.evaluate(()=>closeNoteTab('todo.md'));await p.waitForFunction(()=>current===null);
 t.check('closed: no shortcut is marked',await p.locator('#pin-tabs button.active, #pin-tabs button[aria-current]').count()===0);
 p.removeAllListeners('dialog');p.on('dialog',d=>d.type()==='prompt'?d.accept('fresh'):d.accept());
 await p.locator('#pin-tabs button').first().click();await p.waitForFunction(()=>current?.path==='todo.md');
 await H.newNote(p, 'fresh');await p.waitForFunction(()=>current?.path==='fresh.md');
 t.check('a new note: the shortcut is no longer marked',await p.locator('#pin-tabs button.active, #pin-tabs button[aria-current]').count()===0);
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
 t.check('failed pin selection keeps the open note and its shortcut',await p.evaluate(()=>current.path==='todo.md' && document.querySelector('#crumb').textContent.includes('todo.md') && document.querySelector('#pin-tabs .active')?.textContent==='todo.md'));
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
// N37 retired the Tasks switch (showTasks) and its save-before-switching
// race; Preview is the one checklist view, so the same guarantees are
// checked there: unsaved edits lock the checklist rather than hide, and a
// slow checklist save never replaces a newer selection.
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.evaluate(()=>openFile('todo.md'));await H.setEditor(p,'- [ ] A\nMY UNSAVED WORDS');
 await p.route('**/contents/todo.md',r=>r.request().method()==='PUT'?r.fulfill({status:503,body:'{}'}):r.fallback());
 await p.click('#btn-save');await p.waitForFunction(()=>!saving);
 await H.preview(p);
 t.check('after a failed save Preview shows the edits but locks the checklist',(await p.textContent('#preview')).includes('MY UNSAVED WORDS') && await p.locator('#pin-list input:enabled').count()===0 && /Save or resolve/.test(await p.textContent('#preview')));
 await p.click('#btn-preview');
 t.check('and Edit still has them',await p.locator('#editor-pane').isVisible() && (await H.editorValue(p)).includes('MY UNSAVED WORDS'));
 await ctx.close();
}
{
 const gh=H.fakeGitHub({files:{'todo.md':'- [ ] A\n'}});
 const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await H.preview(p,'todo.md');
 let release,entered;const gate=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await p.route('**/contents/todo.md',async r=>{if(r.request().method()==='PUT'){entered();await gate;}await r.fallback();});
 gh.files['Elsewhere.md']='A different note';
 await H.tick(p,'A');await requested;
 await p.evaluate(()=>openFile('Elsewhere.md'));await p.waitForFunction(()=>current?.path==='Elsewhere.md');
 release();await p.waitForFunction(()=>!Object.keys(pinBusy).length);
 t.check('a slow checklist save cannot replace a newer selection',await p.evaluate(()=>current.path==='Elsewhere.md'&&!document.body.classList.contains('preview-view')&&editor.getValue()==='A different note') && gh.files['todo.md']==='- [x] A\n');
 await ctx.close();
}
await H.stop();t.finish();
