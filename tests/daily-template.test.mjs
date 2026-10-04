/* N41: any saved note becomes Today's template from its ⋯ menu, through Obsidian's own daily-note settings. */
import * as H from './harness.mjs';
const t=H.suite('daily-template');
await H.start();
const CONF='.obsidian/daily-notes.json', TPL='Templates/Morning.md', BODY='# {{date:dddd, D MMMM YYYY}}\n\n## Plan\n- \n';
async function setup(opts={}) {
  const gh=H.fakeGitHub(opts);
  const ctx=await H.context(gh,{noCdn:true});
  const p=await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(()=>!accessPending&&treeState==='ok');
  await p.clock.setFixedTime(new Date('2026-09-27T12:00:00'));
  const writes=[]; p.on('request',r=>{if(r.method()!=='GET'&&/\/repos\//.test(r.url()))writes.push(r.method()+' '+decodeURIComponent(r.url()));});
  return {gh,ctx,p,writes};
}
async function open(p,path) { await p.evaluate(path=>openFile(path),path); await p.waitForFunction(path=>current?.path===path&&current.sha,path); }
async function offered(p) { await p.click('#btn-more'); const shown=await p.locator('#btn-daily').isVisible(); const label=shown?await p.textContent('#btn-daily'):''; await p.keyboard.press('Escape'); return {shown,label}; }
async function toggle(p) {
  await H.noteAction(p,'#btn-daily');
  await p.waitForFunction(()=>!/Updating the daily/.test(document.querySelector('#status').textContent));
  return H.status(p);
}
{
  const {p,ctx,gh}=await setup({files:{[TPL]:BODY,'a.md':'a'}});
  await open(p,TPL);
  const o=await offered(p);
  t.check('a saved note offers Use for new daily notes in its ⋯ menu',o.shown&&/Use for new daily notes/.test(o.label),o.label);
  const said=await toggle(p);
  t.check('settings created naming this note, keeping Daily/',JSON.stringify(JSON.parse(gh.files[CONF]||'{}'))===JSON.stringify({folder:'Daily',template:'Templates/Morning'}),gh.files[CONF]);
  t.check('and says so',/start from this note/.test(said),said);
  t.check('the menu now offers to stop',/Stop using/.test((await offered(p)).label));
  await p.evaluate(()=>todayNote()); await p.waitForFunction(()=>current?.path==='Daily/2026-09-27.md');
  t.check('Today starts from the note, date filled in',await H.editorValue(p)==='# Sunday, 27 September 2026\n\n## Plan\n- \n',await H.editorValue(p));
  t.check('an untouched Today note writes nothing',!gh.files['Daily/2026-09-27.md']);
  await open(p,TPL);
  const off=await toggle(p);
  t.check('Stop removes only the template line',JSON.stringify(JSON.parse(gh.files[CONF]))===JSON.stringify({folder:'Daily'}),gh.files[CONF]);
  t.check('and says new daily notes start blank',/blank/.test(off),off);
  t.check('the menu offers it again',/Use for new daily notes/.test((await offered(p)).label));
  await ctx.close();
}
{
  const conf=JSON.stringify({folder:'Journal',format:'YYYY/MM/DD',autorun:true,template:'Old'});
  const {p,ctx,gh}=await setup({files:{[CONF]:conf,[TPL]:BODY}});
  await open(p,TPL); await toggle(p);
  const now=JSON.parse(gh.files[CONF]);
  t.check('existing settings keep everything but the template',now.folder==='Journal'&&now.format==='YYYY/MM/DD'&&now.autorun===true&&now.template==='Templates/Morning',gh.files[CONF]);
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({files:{'2026-09-01.md':'old daily',[TPL]:BODY}});
  await open(p,TPL); await toggle(p);
  t.check('daily notes already at the top level stay there, as in Obsidian',JSON.parse(gh.files[CONF]).folder==='',gh.files[CONF]);
  await ctx.close();
}
{
  const {p,ctx,gh,writes}=await setup({files:{[CONF]:'{bad',[TPL]:BODY}});
  await open(p,TPL); const said=await toggle(p);
  t.check('unreadable settings: nothing written',writes.length===0&&gh.files[CONF]==='{bad',writes.join());
  t.check('and says why',/could not be read/.test(said),said);
  await ctx.close();
}
{
  const {p,ctx,writes}=await setup({files:{[CONF]:JSON.stringify({template:'Templates/Morning'}),[TPL]:BODY}});
  await open(p,TPL);
  const said=await toggle(p);   // the label did not know yet: it offered Use
  t.check('already the template: nothing written, and said',writes.length===0&&/already start from this note/.test(said),said);
  t.check('the menu then offers to stop',/Stop using/.test((await offered(p)).label));
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({files:{[CONF]:JSON.stringify({folder:'Before'}),[TPL]:BODY}});
  await open(p,TPL);
  let release; const gate=new Promise(r=>release=r); let entered; const asked=new Promise(r=>entered=r);
  // Changed on GitHub just after Padgit read it, before its write.
  await p.route('**/contents/.obsidian/daily-notes.json',async r=>{if(r.request().method()==='PUT')gh.files[CONF]=JSON.stringify({folder:'Changed meanwhile'});await r.fallback();});
  const said=await toggle(p);
  t.check('settings changed meanwhile on GitHub are never overwritten',JSON.parse(gh.files[CONF]).folder==='Changed meanwhile'&&!/Signed out/.test(said)&&/changed elsewhere/.test(said),gh.files[CONF]+' / '+said);
  await ctx.close();
}
{
  const {p,ctx,writes}=await setup({files:{[TPL]:BODY}});
  await open(p,TPL);
  let release; const gate=new Promise(r=>release=r); let entered; const asked=new Promise(r=>entered=r);
  await p.route('**/contents/.obsidian/daily-notes.json?*',async r=>{entered();await gate;await r.fallback();});
  const done=toggle(p); await asked;
  await p.evaluate(()=>{cfg.repo='elsewhere';}); release(); const said=await done;
  t.check('a repository switched mid-way gets nothing written',writes.length===0&&/nothing was changed/.test(said),writes.join()+' / '+said);
  await ctx.close();
}
{
  const {p,ctx,writes}=await setup({files:{[TPL]:BODY}});
  await open(p,TPL);
  await p.evaluate(()=>{accessPending=true;}); await p.evaluate(()=>toggleDailyTemplate()); await H.settle(p,300);
  t.check('nothing is written while access is still being checked',writes.length===0,writes.join());
  await ctx.close();
}
{
  const {p,ctx}=await setup({files:{'plain.txt':'plain text',[TPL]:BODY}});
  await p.evaluate(()=>startNote('Unsaved.md','# new')); await p.waitForFunction(()=>current?.path==='Unsaved.md');
  t.check('a note never saved is not offered',!(await offered(p)).shown);
  await open(p,'plain.txt');
  t.check('nor a file that is not Markdown',!(await offered(p)).shown);
  await ctx.close();
}
{
  const repos=[{owner:{login:'roldaof'},name:'vault',full_name:'roldaof/vault',default_branch:'main',private:true,permissions:{push:false,pull:true}}];
  const {p,ctx}=await setup({files:{[TPL]:BODY},repos});
  await H.settle(p,600); await open(p,TPL);
  t.check('read-only repositories do not offer it',!(await offered(p)).shown);
  await ctx.close();
}
{
  const {p,ctx,gh,writes}=await setup({files:{'Ideas: morning.md':'# x','Plan.MD':'# y',[TPL]:BODY}});
  await open(p,'Ideas: morning.md'); const said=await toggle(p);
  t.check('a name Today cannot use is refused, nothing written',writes.length===0&&/cannot use this note/.test(said),said);
  await open(p,'Plan.MD');
  t.check('an upper-case .MD note is not offered',!(await offered(p)).shown);
  await open(p,TPL);
  await p.evaluate(()=>{dailyTemplate='Templates/Morning';dailyRepo='someone/else@main';});
  t.check('a label remembered for another repository is not used',/Use for new daily notes/.test((await offered(p)).label));
  await p.route('**/contents/.obsidian/daily-notes.json',async r=>{if(r.request().method()==='PUT')gh.files[CONF]=JSON.stringify({folder:'Made elsewhere'});await r.fallback();});
  const raced=await toggle(p);
  t.check('settings created elsewhere meanwhile: kept, and said clearly',JSON.parse(gh.files[CONF]).folder==='Made elsewhere'&&/changed elsewhere/.test(raced),gh.files[CONF]+' / '+raced);
  await ctx.close();
}
{
  const {p,ctx}=await setup({files:{[CONF]:JSON.stringify({template:'Templates/Gone'})}});
  await p.evaluate(()=>todayNote()); await p.waitForFunction(()=>/Today could not open/.test(document.querySelector('#status').textContent));
  t.check('a template renamed or deleted: Today says how to choose another',/Use for new daily notes/.test(await H.status(p)),await H.status(p));
  await ctx.close();
}
await H.stop();
t.finish();
