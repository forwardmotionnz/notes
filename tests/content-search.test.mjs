import * as H from './harness.mjs';
const t=H.suite('content-search');await H.start();
const gh=H.fakeGitHub({files:{'alpha.md':'Hidden needle in content','needle.md':'path match','draft.md':'old text','no.md':'unrelated','.hidden.md':'needle','photo.png':'needle','broken.md':'needle'}});
const ctx=await H.context(gh),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);await p.waitForFunction(()=>treeState==='ok'&&files.length);
const present=await p.locator('#btn-search').count();t.check('explicit content search offered',present===1);
if(present){
 await p.evaluate(()=>openFile('draft.md'));await H.setEditor(p,'unsaved NEEDLE');
 await p.fill('#filter','needle');t.check('typing keeps fast path filter',(await H.rows(p)).includes('needle.md')&&!(await H.rows(p)).includes('alpha.md'));
 await p.route('**/contents/broken.md?*',r=>r.fulfill({status:503,body:'{}'}));
 await p.click('#btn-search');await p.waitForFunction(()=>!searchRunning);
 const rows=await H.rows(p);
 t.check('contents, paths and current draft match', ['alpha.md','needle.md','draft.md'].every(x=>rows.includes(x)));
 t.check('hidden and binary files excluded',!rows.includes('.hidden.md')&&!rows.includes('photo.png'));
 t.check('read errors expose incomplete results',/incomplete/i.test(await p.textContent('#search-status')));
 t.check('search does not write notes',gh.commits.length===0);
 await p.evaluate(()=>openFile('alpha.md'));
 t.check('opening a result keeps other content results available',(await H.rows(p)).includes('alpha.md')&&(await H.rows(p)).includes('draft.md'));
 await p.unroute('**/contents/broken.md?*');
 let release,entered;const gate=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await p.route('**/contents/no.md?*',async r=>{entered();await gate;await r.fallback();});
 await p.click('#btn-search');await requested;await p.fill('#filter','unrelated');release();
 await p.waitForFunction(()=>!searchRunning);await H.settle(p,200);
 t.check('late search cannot replace a newer query',!(await H.rows(p)).includes('alpha.md'));
 await p.unroute('**/contents/no.md?*');await p.fill('#filter','nothinghere');await p.press('#filter','Enter');await p.waitForFunction(()=>!searchRunning);
 t.check('empty result clearly says no matches',/No matches/.test(await p.textContent('#search-status')));
}
await ctx.close();
{
 const gh=H.fakeGitHub({files:{'a.md':'needle','b.md':'needle'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);
 p.setDefaultTimeout(5000);await p.waitForFunction(()=>treeState==='ok'&&files.length);await p.fill('#filter','needle');
 await p.evaluate(()=>{readFile=async function(){cfg.token='';cfg.refresh='';throw signedOutError();};});
 await p.click('#btn-search');await p.waitForFunction(()=>!searchRunning);
 t.check('expired sign-in ends search and offers sign-in',await H.dialogOpen(p)&&!(await p.textContent('#search-status')).includes('Searching'));
 await c.close();
}
{
 const gh=H.fakeGitHub({files:{'a.md':'private needle'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.waitForFunction(()=>treeState==='ok'&&files.length);await p.fill('#filter','needle');
 let release,entered;const gate=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await p.route('**/contents/a.md?*',async r=>{entered();await gate;await r.fallback();});
 await p.click('#btn-search');await requested;
 await p.evaluate(()=>{pointAt('another','vault','main',[]);files=[];renderTree();});release();await H.settle(p,300);
 t.check('late old-repository response cannot leak into new results',!(await H.rows(p)).includes('a.md'));
 await c.close();
}
{
 const files=Object.fromEntries(Array.from({length:305},(_,i)=>['n'+i+'.md','needle']));
 const gh=H.fakeGitHub({files}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(10000);
 await p.waitForFunction(()=>treeState==='ok'&&files.length===305);await p.fill('#filter','needle');
 let active=0,max=0,reads=0;
 await p.route('**/contents/n*.md?*',async r=>{reads++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,10));await r.fallback();active--;});
 await p.click('#btn-search');await p.waitForFunction(()=>!searchRunning);
 t.check('large vault search bounds reads and concurrency',reads===300&&max<=4);
 t.check('scan limit is visible instead of claiming complete results',/incomplete.*5 skipped/i.test(await p.textContent('#search-status')));
 await c.close();
}
await H.stop();t.finish();
