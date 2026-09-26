import * as H from './harness.mjs';
const t=H.suite('daily-notes');
await H.start();
const date='2026-09-27', path='Daily/'+date+'.md';
async function setup(files={}) {
  const gh=H.fakeGitHub({files});
  const ctx=await H.context(gh,{noCdn:true,viewport:{width:390,height:844}});
  const p=await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(()=>!accessPending);
  await p.clock.setFixedTime(new Date('2026-09-27T12:00:00'));
  return {gh,ctx,p};
}
async function today(p) { await p.evaluate(()=>todayNote()); }
{
  const {p,ctx,gh}=await setup();
  t.check('Today is discoverable in Files',await p.locator('#btn-today').count()===1);
  if (!await p.locator('#btn-today').count()) { await ctx.close(); await H.stop(); t.finish(); process.exit(1); }
  await p.click('#btn-tree'); await p.click('#btn-today');
  await p.waitForFunction(path=>current?.path===path,path);
  t.check('default heading and local date',await H.editorValue(p)==='# '+date+'\n\n');
  t.check('opening Today makes no repository file',!gh.files[path]);
  t.check('opening status finishes when ready',!/Opening/.test(await H.status(p)));
  t.check('phone drawer closes',await p.evaluate(()=>!document.body.classList.contains('tree-open')));
  await H.setEditor(p,'My daily words'); await today(p);
  await p.waitForFunction(()=>editor.getValue()==='My daily words');
  t.check('second Today preserves unsaved words',await H.editorValue(p)==='My daily words');
  await ctx.close();
}
{
  const files={'.obsidian/daily-notes.json':JSON.stringify({folder:'Journal',format:'YYYY/MM/DD',template:'Templates/Daily'}),'Templates/Daily.md':'---\nkind: daily\n---\n# {{title}}\n{{date:dddd, D MMMM YYYY}}\n{{time:HH:mm}}\n'};
  files['Templates/Daily.md']='\uFEFF'+files['Templates/Daily.md'].replace(/\n/g,'\r\n');
  const {p,ctx,gh}=await setup(files);
  await today(p); await p.waitForFunction(()=>current?.path==='Journal/2026/09/27.md');
  t.check('template placeholders use the same date',/Sunday, 27 September 2026\n12:00/.test(await H.editorValue(p)));
  await today(p);
  await p.waitForFunction(()=>current?.path==='Journal/2026/09/27.md');
  t.check('Today twice keeps the untouched template',/Sunday, 27 September 2026/.test(await H.editorValue(p)));
  await p.click('#btn-save'); await p.waitForFunction(()=>current?.sha && !dirty());
  t.check('template frontmatter, BOM and line endings survive saving',gh.files['Journal/2026/09/27.md']==='\uFEFF---\r\nkind: daily\r\n---\r\n# 27\r\nSunday, 27 September 2026\r\n12:00\r\n');
  t.check('configuration remains unchanged',gh.files['.obsidian/daily-notes.json']===files['.obsidian/daily-notes.json']);
  await ctx.close();
}
{
  const {p,ctx}=await setup({[path]:'Already written'});
  await today(p); await p.waitForFunction(()=>editor?.getValue()==='Already written');
  t.check('existing note is opened unchanged',await H.editorValue(p)==='Already written');
  await ctx.close();
}
{
  const {p,ctx}=await setup({'.obsidian/daily-notes.json':JSON.stringify({format:'GGGG-[W]WW'})});
  await today(p); await p.waitForFunction(()=>current?.path==='2026-09-27.md');
  t.check('unsupported date format explains fallback',/unsupported.*YYYY-MM-DD/i.test(await H.status(p)));
  await ctx.close();
}
for (const config of ['{bad',JSON.stringify({folder:'../outside'}),JSON.stringify({template:'Missing'})]) {
  const {p,ctx}=await setup({'.obsidian/daily-notes.json':config});
  await today(p); await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Today'));
  t.check('bad configuration or missing template leaves editor alone',await p.evaluate(()=>!current));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  let release; const gate=new Promise(r=>release=r);
  let entered; const requested=new Promise(r=>entered=r);
  await p.route('**/contents/.obsidian/daily-notes.json?*',async route=>{entered();await gate;await route.fallback();});
  const opening=p.evaluate(()=>todayNote()); await requested;
  await p.evaluate(()=>startNote('Elsewhere.md')); release(); await opening;
  t.check('late settings cannot replace a newer selection',await p.evaluate(()=>current.path==='Elsewhere.md'));
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({'A.md':'A','B.md':'B','.obsidian/daily-notes.json':'{bad'});
  await p.evaluate(()=>openFile('A.md'));
  let release; const gate=new Promise(r=>release=r);
  let entered; const requested=new Promise(r=>entered=r);
  await p.route('**/contents/B.md?*',async route=>{entered();await gate;await route.fallback();});
  await p.evaluate(()=>{openFile('B.md');}); await requested;
  await today(p); release();
  t.check('failed Today restores the visible note after cancelling an open',await p.evaluate(()=>current.path==='A.md'&&!current.leaving));
  await H.setEditor(p,'A edited'); await p.click('#btn-save');
  await p.waitForFunction(()=>!dirty());
  t.check('the visible note remains saveable',gh.files['A.md']==='A edited');
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  await p.route('**/contents/.obsidian/daily-notes.json?*',route=>route.abort());
  await today(p);
  t.check('offline config read leaves no invented daily note',await p.evaluate(()=>!current));
  t.check('offline config read explains retry',/Today.*retry/i.test(await H.status(p)));
  await p.unroute('**/contents/.obsidian/daily-notes.json?*');
  await p.evaluate(()=>{readOnly='This repository is read-only.';});
  await today(p);
  t.check('read-only repository cannot prepare a new daily note',await p.evaluate(()=>!current));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  let release,entered; const gate=new Promise(r=>release=r), requested=new Promise(r=>entered=r);
  await p.route('**/contents/.obsidian/daily-notes.json?*',async route=>{entered();await gate;await route.fallback();});
  const opening=p.evaluate(()=>todayNote()); await requested;
  await p.evaluate(()=>{pinEpoch++;}); release(); await opening;
  t.check('a repository change invalidates pending daily settings',await p.evaluate(()=>!current));
  await ctx.close();
}
await H.stop(); t.finish();
