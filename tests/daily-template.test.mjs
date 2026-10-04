/* N41: Settings adds the Emotional weather template for Today, as ordinary Obsidian files. */
import * as H from './harness.mjs';
const t=H.suite('daily-template');
await H.start();
const TPL='Templates/Daily note.md', CONF='.obsidian/daily-notes.json';
const settingsFor=extra=>JSON.stringify({folder:'Daily',format:'YYYY-MM-DD',template:'Templates/Daily note',...extra});
async function setup(opts={}) {
  const gh=H.fakeGitHub(opts);
  const ctx=await H.context(gh,{noCdn:true});
  const p=await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(()=>!accessPending);
  await p.clock.setFixedTime(new Date('2026-09-27T12:00:00'));
  const writes=[]; p.on('request',r=>{if(r.method()!=='GET'&&/api\.github|\/repos\//.test(r.url()))writes.push(r.method()+' '+decodeURIComponent(r.url()));});
  return {gh,ctx,p,writes};
}
async function add(p) {
  await p.click('#btn-settings');
  await p.locator('#daily-setup summary').click();
  await p.click('#f-daily');
  await p.waitForFunction(()=>!document.querySelector('#f-daily').disabled&&document.querySelector('#daily-status').textContent);
  return p.textContent('#daily-status');
}
{
  const {p,ctx,gh}=await setup({files:{'a.md':'a'}});
  await p.click('#btn-settings');
  t.check('the template is offered in Settings',await p.locator('#daily-setup').isVisible());
  await p.keyboard.press('Escape');
  const said=await add(p);
  const tpl=gh.files[TPL]||'';
  t.check('the template file is written',/^---\nweather: \n---\n# \{\{date:dddd, D MMMM YYYY\}\}\n/.test(tpl)&&tpl.includes('### Today\'s map')&&tpl.includes('  - Watch for: ')&&tpl.endsWith('- What would I forecast differently tomorrow?\n'),tpl.slice(0,80));
  t.check('daily settings created, keeping Daily/YYYY-MM-DD',gh.files[CONF]&&JSON.stringify(JSON.parse(gh.files[CONF]))===settingsFor({}),gh.files[CONF]);
  t.check('says it is ready',/Today/.test(said),said);
  await p.keyboard.press('Escape');
  await p.evaluate(()=>todayNote()); await p.waitForFunction(()=>current?.path==='Daily/2026-09-27.md');
  const text=await H.editorValue(p);
  t.check('Today opens the template with the date filled in',text.startsWith('---\nweather: \n---\n# Sunday, 27 September 2026\n\n## Morning forecast'),text.slice(0,60));
  t.check('an untouched Today note writes nothing',!gh.files['Daily/2026-09-27.md']);
  await ctx.close();
}
{
  const conf=JSON.stringify({folder:'Journal',template:'Other/Mine'});
  const {p,ctx,gh,writes}=await setup({files:{[CONF]:conf,'Other/Mine.md':'mine'}});
  const said=await add(p);
  t.check('a template already set: nothing written',writes.length===0&&!gh.files[TPL]&&gh.files[CONF]===conf,writes.join());
  t.check('and says which template Today uses',/Other\/Mine/.test(said),said);
  await ctx.close();
}
{
  const conf=JSON.stringify({folder:'Journal'});
  const {p,ctx,gh}=await setup({files:{[CONF]:conf}});
  const said=await add(p);
  t.check('settings without a template: the template is written',!!gh.files[TPL]);
  t.check('Obsidian\'s settings are left alone',gh.files[CONF]===conf);
  t.check('and the line to add is given',said.includes('"template": "Templates/Daily note"'),said);
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({files:{[TPL]:'my own'}});
  const said=await add(p);
  t.check('an existing template file is never overwritten',gh.files[TPL]==='my own');
  t.check('Today is pointed at it',!!gh.files[CONF]&&JSON.parse(gh.files[CONF]).template==='Templates/Daily note');
  t.check('and says so',/already/i.test(said),said);
  await ctx.close();
}
{
  const {p,ctx,gh,writes}=await setup({files:{[CONF]:'{bad'}});
  const said=await add(p);
  t.check('unreadable settings: nothing written',writes.length===0&&!gh.files[TPL]&&gh.files[CONF]==='{bad',writes.join());
  t.check('and says why',/settings/i.test(said),said);
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({empty:true,files:{}});
  await add(p);
  t.check('an empty repository gets both files',!!gh.files[TPL]&&!!gh.files[CONF],Object.keys(gh.files).join());
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({files:{'a.md':'a'}});
  let failed=false;
  await p.route('**/contents/.obsidian/daily-notes.json',r=>{if(r.request().method()==='PUT'&&!failed){failed=true;return r.abort();}return r.fallback();});
  const first=await add(p);
  t.check('a failed write says so and offers a retry',/again/i.test(first)&&!gh.files[CONF],first);
  await p.click('#f-daily');
  await p.waitForFunction(()=>!document.querySelector('#f-daily').disabled&&!/again/i.test(document.querySelector('#daily-status').textContent));
  t.check('pressing again finishes: the identical template is kept, settings written',!!gh.files[TPL]&&!!gh.files[CONF]&&!/already/i.test(await p.textContent('#daily-status')),await p.textContent('#daily-status'));
  await ctx.close();
}
{
  const repos=[{owner:{login:'roldaof'},name:'vault',full_name:'roldaof/vault',default_branch:'main',private:true,permissions:{push:false,pull:true}}];
  const {p,ctx,writes}=await setup({files:{'a.md':'a'},repos});
  await H.settle(p,600);
  await p.click('#btn-settings');
  t.check('read-only repositories offer no template',!await p.locator('#daily-setup').isVisible());
  await p.evaluate(()=>addDailyTemplate()); await H.settle(p,300);
  t.check('and nothing is written if it is called anyway',writes.length===0,writes.join());
  await ctx.close();
}
{
  const {p,ctx,gh,writes}=await setup({files:{'2026-09-01.md':'old daily'}});
  await p.waitForFunction(()=>files.some(f=>f.path==='2026-09-01.md'));
  const said=await add(p);
  t.check('daily notes already at the top level stay there, as in Obsidian',JSON.parse(gh.files[CONF]||'{}').folder==='',gh.files[CONF]);
  t.check('and says where Today puts them',/top level/.test(said),said);
  await p.keyboard.press('Escape'); await p.click('#btn-settings');
  t.check('reopening Settings clears the last result',await p.textContent('#daily-status')==='');
  await ctx.close();
}
{
  const {p,ctx,writes}=await setup({files:{'a.md':'a'}});
  let release; const gate=new Promise(r=>release=r); let entered; const asked=new Promise(r=>entered=r);
  await p.route('**/contents/.obsidian/daily-notes.json?*',async r=>{entered();await gate;await r.fallback();});
  await p.click('#btn-settings'); await p.locator('#daily-setup summary').click();
  await p.click('#f-daily'); await asked;
  await p.evaluate(()=>{cfg.repo='elsewhere';}); release();
  await p.waitForFunction(()=>!document.querySelector('#f-daily').disabled);
  t.check('a repository switched mid-way gets nothing written',writes.length===0,writes.join());
  t.check('and it says so',/repository changed/.test(await p.textContent('#daily-status')),await p.textContent('#daily-status'));
  await ctx.close();
}
{
  const {p,ctx,writes}=await setup({files:{'a.md':'a'}});
  await p.evaluate(()=>{accessPending=true;}); await p.evaluate(()=>addDailyTemplate());
  t.check('nothing is written while access is still being checked',writes.length===0,writes.join());
  await ctx.close();
}
await H.stop();
t.finish();
