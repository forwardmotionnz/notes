/* N48: Look around first. Sample notes held only in this tab: nothing reaches GitHub or the broker,
   and nothing a real sign-in keeps (settings, drafts, pins) is read, changed or removed. */
import * as H from './harness.mjs';
const t=H.suite('demo');
await H.start();
// What a real person already has in this browser: a sign-in, a repository and an unsaved draft.
const REAL={'notes.config.v2':JSON.stringify({token:'ghu_real',refresh:'ghr_real',expires:Date.now()+3600e3,login:'roldaof',avatar:'',owner:'roldaof',repo:'obsidian-vault',branch:'main',pins:['todo.md']}),
  'notes.ui.v1':JSON.stringify({open:{},last:'todo.md',pin:0}),
  'notes.draft.v1:roldaof/obsidian-vault@main:todo.md':JSON.stringify({text:'my unsaved words',sha:null,at:1})};
async function demo(opts={}) {
  const gh=H.fakeGitHub();
  const ctx=await H.context(gh,{viewport:opts.viewport||{width:1280,height:820}});
  if (opts.real) await ctx.addInitScript(real=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');for(const k in real)localStorage.setItem(k,real[k]);}},REAL);
  // The page's own libraries come from cdnjs, as always (pinned by hash); anything else leaving is a leak.
  const away=[]; ctx.on('request',r=>{const u=new URL(r.url());if(u.hostname!=='127.0.0.1'&&u.hostname!=='cdnjs.cloudflare.com')away.push(r.method()+' '+u.href);});
  const p=await H.page(ctx,H.APP()+'?demo');
  p.setDefaultTimeout(5000);
  await p.waitForFunction(()=>treeState==='ok'&&current?.path==='Welcome.md');
  return {gh,ctx,p,away};
}
const stored=p=>p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^notes\.(config|ui|draft)/.test(k))o[k]=localStorage.getItem(k);}return o;});
{
  const gh=H.fakeGitHub(), ctx=await H.context(gh,{noCdn:true}), p=await H.page(ctx);
  await p.waitForSelector('#f-signin:not([disabled])');
  const href=await p.getAttribute('#f-demo','href');
  t.check('the sign-in screen offers Look around first',await p.locator('#f-demo').isVisible()&&/Look around first/.test(await p.textContent('#f-demo'))&&href==='?demo',href);
  t.check('just below Sign in',await p.evaluate(()=>!!(document.getElementById('f-signin').compareDocumentPosition(document.getElementById('f-demo'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  await p.click('#f-demo'); await p.waitForURL(/\?demo/); await p.waitForFunction(()=>typeof current!=='undefined'&&current?.path==='Welcome.md');
  t.check('pressing it opens the sample notes',/\?demo$/.test(p.url().split('#')[0]));
  await ctx.close();
}
{
  const {p,ctx,away}=await demo({real:true});
  const before=await stored(p);
  t.check('a real sign-in and draft are there to protect',Object.keys(before).length===3,JSON.stringify(Object.keys(before)));
  t.check('the demo opens on Welcome, with no sign-in and no dialog',!(await H.dialogOpen(p))&&/Welcome/.test(await p.textContent('#crumb')));
  const bar=await p.textContent('#demo-bar');
  t.check('a banner says it is a demo and nothing is saved',await p.locator('#demo-bar').isVisible()&&/demo/i.test(bar)&&/nothing is saved/i.test(bar),bar);
  t.check('the sample notes are listed',await p.evaluate(()=>['Welcome.md','For GitHub users.md','Garden/Plan.md','Garden/Seeds.md'].every(f=>files.some(x=>x.path===f))));
  // Use it as anyone would: tick, edit and save, make a note, open Today, Recent, History, Settings.
  await H.preview(p,'Garden/Plan.md');
  await p.locator('#preview input[type=checkbox]:enabled').nth(1).check(); await p.waitForFunction(()=>!Object.keys(pinBusy).length&&!saving);
  t.check('a checklist ticks in Preview, kept in this tab',await p.evaluate(async()=>(await readFile('Garden/Plan.md')).text.includes('- [x] Tomatoes')));
  await H.saveNote(p,'Welcome.md','# Welcome\n\nchanged in the demo\n'); await p.waitForFunction(()=>!saving&&!dirty());
  t.check('saving works, in this tab',await H.editorValue(p)==='# Welcome\n\nchanged in the demo\n'&&/Saved/.test(await H.status(p)),await H.status(p));
  await p.evaluate(()=>startNote('Mine.md','# Mine\n')); await H.setEditor(p,'# Mine\n\nhello\n'); await p.click('#btn-save'); await p.waitForFunction(()=>!saving&&!dirty());
  t.check('a new note is kept too',await p.evaluate(()=>files.some(f=>f.path==='Mine.md')));
  await H.setEditor(p,'# Mine\n\nnot saved yet\n'); await H.settle(p,200);
  t.check('unsaved typing in the demo is kept in the tab, not in the browser',await p.evaluate(()=>dirty()&&[localStorage,sessionStorage].every(s=>{for(let i=0;i<s.length;i++)if(/padgit\/demo/.test(s.key(i)))return false;return true;})));
  await p.evaluate(()=>todayNote()); await p.waitForFunction(()=>/^Daily\//.test(current?.path||''));
  await p.evaluate(()=>{const d=document.getElementById('recent-notes');d.open=true;}); await H.settle(p,300);
  await p.evaluate(()=>openFile('Welcome.md')); await p.waitForFunction(()=>current?.path==='Welcome.md'&&current.sha);
  await H.noteAction(p,'#btn-history'); await p.waitForFunction(()=>!/Loading/.test(document.querySelector('#history-status').textContent)); await p.evaluate(()=>document.getElementById('history').close());
  await p.click('#btn-settings'); await H.settle(p,300); await p.keyboard.press('Escape');
  await H.settle(p,400);
  t.check('nothing reached GitHub, the broker or anywhere else',away.length===0,away.join(' | '));
  t.check('the real sign-in, settings and draft are untouched',JSON.stringify(await stored(p))===JSON.stringify(before),JSON.stringify(await stored(p)));
  t.check('nor the demo\'s place in its history',await p.evaluate(()=>sessionStorage.getItem('notes.navigation')===null));
  t.check('no demo draft was written to the browser',await p.evaluate(()=>{for(const s of [localStorage,sessionStorage])for(let i=0;i<s.length;i++)if(/padgit\/demo/.test(s.key(i)))return false;return true;}));
  // Sign out in the demo only leaves it: the real drafts must survive.
  p.on('dialog',d=>d.accept());
  await p.click('#btn-settings'); await p.click('#f-forget'); await p.waitForURL(u=>!/demo/.test(u.href));
  t.check('Sign out in the demo leaves it and keeps the real sign-in and drafts',JSON.stringify(await stored(p))===JSON.stringify(before));
  await ctx.close();
}
{
  const {p,ctx}=await demo();
  await H.saveNote(p,'Welcome.md','# Welcome\n\nchanged\n'); await p.waitForFunction(()=>!saving&&!dirty());
  await p.reload(); await p.waitForFunction(()=>treeState==='ok'&&current?.path==='Welcome.md');
  t.check('a reload starts the sample notes afresh',!/changed/.test(await H.editorValue(p)));
  const link=await p.getAttribute('#demo-bar a','href');
  await p.click('#demo-bar a'); await p.waitForSelector('#f-signin:not([disabled])');
  t.check('the banner\'s Sign in leaves the demo for the sign-in screen',!/demo/.test(p.url())&&link&&!/demo/.test(link),p.url());
  await ctx.close();
}
{
  const {p,ctx}=await demo();
  await p.evaluate(()=>openFile('Garden/Seeds.md')); await p.waitForFunction(()=>current?.path==='Garden/Seeds.md'&&current.sha);
  await H.noteAction(p,'#btn-rename'); await H.settle(p,200);
  const said=await p.evaluate(()=>moveFile('Garden/Seeds.md','Seeds.md',current.sha).then(()=>'moved',e=>e.message));
  t.check('what the demo cannot do is said plainly',/not available in the demo/i.test(said),said);
  await ctx.close();
}
{
  const {p,ctx,away}=await demo({viewport:{width:390,height:844}});
  t.check('phone: the banner fits',await p.evaluate(()=>{const b=document.getElementById('demo-bar').getBoundingClientRect();return b.height>0&&b.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth;}));
  t.check('phone: no page errors',p.errors.length===0,p.errors.join(' | '));
  await ctx.close();
}
{
  // Another tab of the real app signs out: the demo carries on, unaffected.
  const {p,ctx}=await demo({real:true});
  const other=await ctx.newPage(); await other.goto(H.APP()); await other.evaluate(()=>localStorage.removeItem('notes.config.v2')); await H.settle(p,300);
  t.check('another tab signing out does not end the demo',await p.evaluate(()=>cfg.token==='demo'&&!document.getElementById('settings').open));
  await ctx.close();
}
await H.stop();
t.finish();
