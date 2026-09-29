/* Failed serial checklist edits in Preview keep every edit as a draft.
   N37 retired the "Add a task" box whose captures this suite used to follow;
   the same guarantee now covers task text edited in Preview. */
import * as H from './harness.mjs';
const t=H.suite('capture-recovery');await H.start();
const edit=async(p,from,to)=>{await H.taskAction(p, 'Edit task: '+from);await p.locator('.task-edit').fill(to);await p.locator('.task-edit').press('Enter');};
for (const status of [0,503,429]) {
  const gh=H.fakeGitHub({files:{'todo.md':'- [ ] one\n- [ ] two\n','inbox.md':'hi\n'}});const ctx=await H.context(gh);const p=await H.page(ctx);await H.signIn(p);await H.settle(p,500);
  await H.preview(p,'todo.md');
  let release,seen;const sent=new Promise(r=>seen=r);const gate=new Promise(r=>release=r);let fail=true;
  await ctx.route('https://api.github.com/**/contents/todo.md',async r=>{
    if(r.request().method()!=='PUT'||!fail)return r.fallback();
    seen();await gate;
    // Keep the rate limit active through failure recovery; reset explicitly below.
    return status?r.fulfill({status,headers:status===429?{'Retry-After':'60'}:{},body:'{}'}):r.abort();
  });
  await edit(p,'one','ALPHA');await sent;
  await edit(p,'two','BETA');
  release();await p.evaluate(()=>pinWriting);await p.waitForFunction(()=>!Object.keys(pinReloading).length);
  const draft=await p.evaluate(()=>localStorage.getItem(draftKey('todo.md'))||'');
  t.check(`${status}: both edits survive as a draft`,draft.includes('ALPHA')&&draft.includes('BETA'),draft);
  t.check(`${status}: and nothing reached GitHub`,gh.files['todo.md']==='- [ ] one\n- [ ] two\n');
  fail=false;await p.evaluate(()=>apiRetryAt=0);
  await p.evaluate(()=>openFile('inbox.md'));await p.waitForFunction(()=>current?.path==='inbox.md');
  await p.evaluate(()=>openFile('todo.md'));await p.waitForFunction(()=>current?.path==='todo.md');
  t.check(`${status}: reopening restores both edits`,await H.editorValue(p)==='- [ ] ALPHA\n- [ ] BETA\n',await H.editorValue(p));
  await p.click('#btn-save');await p.waitForFunction(()=>!saving);
  t.check(`${status}: and Save keeps them`,gh.files['todo.md']==='- [ ] ALPHA\n- [ ] BETA\n',gh.files['todo.md']);
  await ctx.close();
}
await H.stop();t.finish();
