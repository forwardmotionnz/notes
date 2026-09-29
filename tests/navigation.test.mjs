import * as H from './harness.mjs';
const t=H.suite('navigation');await H.start();
const gh=H.fakeGitHub({files:{'a.md':'alpha','folder/b #%.md':'beta','c.md':'gamma'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');
// N36: no ← → in the header; the browser's own back and forward move between notes.
t.check('no back or forward buttons in the header',await p.locator('#btn-back, #btn-forward').count()===0);
{
 await p.evaluate(()=>openFile('a.md'));await H.setEditor(p,'kept on leaving');await p.evaluate(()=>openFile('folder/b #%.md'));await p.waitForFunction(()=>!saving);
 const link=p.url();t.check('address encodes note and repository',decodeURIComponent(new URL(link).hash).includes('folder/b #%.md')&&decodeURIComponent(new URL(link).hash).includes('obsidian-vault'));
 t.check('leaving saves edits',gh.files['a.md']==='kept on leaving');
 await p.goBack();await p.waitForFunction(()=>current?.path==='a.md');t.check('back opens prior note',await H.editorValue(p)==='kept on leaving');
 await p.goForward();await p.waitForFunction(()=>current?.path==='folder/b #%.md');t.check('forward opens next note',await H.editorValue(p)==='beta');
 await p.reload();await p.waitForFunction(()=>current?.path==='folder/b #%.md');t.check('reload retains encoded path',await H.editorValue(p)==='beta');
 await p.goBack();const back=await p.waitForFunction(()=>current?.path==='a.md',null,{timeout:5000}).then(()=>true,()=>false);
 await p.goForward();await p.waitForFunction(()=>current?.path==='folder/b #%.md');
 t.check('history survives reload',back);
 await p.evaluate(()=>openFile('c.md'));await p.goBack();await p.waitForFunction(()=>current?.path==='folder/b #%.md');await p.reload();await p.waitForFunction(()=>current?.path==='folder/b #%.md');
 await p.goForward();const fwd=await p.waitForFunction(()=>current?.path==='c.md',null,{timeout:5000}).then(()=>true,()=>false);
 await p.goBack();const bk=await p.waitForFunction(()=>current?.path==='folder/b #%.md',null,{timeout:5000}).then(()=>true,()=>false);
 t.check('both directions survive reload in middle',fwd&&bk);
 await p.evaluate(()=>openFile('c.md'));await p.goto(link);await p.waitForFunction(()=>current?.path==='folder/b #%.md');t.check('bookmark overrides last note',await H.editorValue(p)==='beta');
 await p.evaluate(()=>{location.hash='note='+encodeURIComponent(JSON.stringify(['someone','else','main','a.md']));});await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('repository'));
 t.check('foreign repository link never reads same path in current repo',await p.evaluate(()=>current.path)==='folder/b #%.md');
 await p.evaluate(()=>{location.hash='note='+encodeURIComponent(JSON.stringify([cfg.owner,cfg.repo,cfg.branch,'.secret.md']));});
 await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Invalid'));t.check('hidden route rejected',await p.evaluate(()=>current.path)==='folder/b #%.md');
 const signed=await H.context(gh),q=await H.page(signed);await q.goto(link);await H.signIn(q);await q.waitForFunction(()=>current?.path==='folder/b #%.md');
 t.check('bookmark survives sign-in and repository selection',await H.editorValue(q)==='beta');await signed.close();
 const retry=await H.context(gh),r=await H.page(retry);await r.goto(link);
 await r.route('https://broker.test/',route=>route.fulfill({status:502,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"error":"github_unreachable"}'}));
 await H.signIn(r);t.check('failed sign-in retains bookmark',new URL(r.url()).hash===new URL(link).hash);
 await r.unroute('https://broker.test/');await H.signIn(r);await r.waitForFunction(()=>current?.path==='folder/b #%.md');t.check('retry opens bookmarked note',await H.editorValue(r)==='beta');await retry.close();
}
await c.close();await H.stop();t.finish();
