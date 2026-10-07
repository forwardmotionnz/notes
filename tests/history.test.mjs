/* N43: who changed a note, whether you have seen it since, and ⋯ → History with Restore. */
import * as H from './harness.mjs';
const t=H.suite('history');
await H.start();
const NOTE='Ideas.md', V1='one\ntwo\nthree\n', V2='one\nTWO\nthree\nfour\n';
// Claude Code on a computer commits as its person, naming itself in a Co-authored-by trailer;
// an agent with its own GitHub App commits as a bot account.
const CLAUDE={login:'roldaof',type:'User',name:'roldaof'}, BOT={login:'chatgpt-codex-connector[bot]',type:'Bot',name:'chatgpt-codex-connector[bot]'};
async function setup(opts={}) {
  const gh=H.fakeGitHub({files:{[NOTE]:V1,'Other.md':'x\n',...(opts.files||{})},...opts});
  gh.files[NOTE]=V2; gh.touch('Tidy Ideas\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',CLAUDE);
  gh.files['Other.md']='x\ny\n'; gh.touch('Add y',BOT);
  const ctx=await H.context(gh,{noCdn:true});
  const p=await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(()=>!accessPending&&treeState==='ok');
  return {gh,ctx,p};
}
async function recent(p) {
  await p.evaluate(()=>{const d=document.getElementById('recent-notes');d.open=false;d.open=true;});
  await p.waitForFunction(()=>!recentLoading&&/first 20 notes|No recent/.test(document.querySelector('#recent-status').textContent));
  return p.evaluate(()=>[...document.querySelectorAll('#recent-list button')].map(b=>({text:b.textContent,fresh:b.classList.contains('fresh')})));
}
const row=(rows,path)=>rows.find(r=>r.text.includes(path))||{text:'',fresh:false};
async function open(p,path){await p.evaluate(path=>openFile(path),path);await p.waitForFunction(path=>current?.path===path&&current.sha,path);}
async function history(p){
  await H.noteAction(p,'#btn-history');
  await p.waitForFunction(()=>document.getElementById('history').open&&!/Loading/.test(document.querySelector('#history-status').textContent));
  return p.evaluate(()=>[...document.querySelectorAll('#history-list > details > summary')].map(s=>s.textContent));
}
async function expand(p,i){
  await p.evaluate(i=>{document.querySelectorAll('#history-list > details')[i].open=true;},i);
  await p.waitForFunction(i=>{const d=document.querySelectorAll('#history-list > details')[i],st=d.querySelector('.diff-status');return d.querySelector('.diff')||(st&&!/Loading/.test(st.textContent));},i);
}
{
  const {p,ctx,gh}=await setup();
  const rows=await recent(p);
  t.check('Recent names an agent that signed its commit',/Claude Opus 5\.5/.test(row(rows,NOTE).text),row(rows,NOTE).text);
  t.check('and marks it as changed since you last looked',row(rows,NOTE).fresh);
  t.check('a bot account is named without [bot]',/chatgpt-codex-connector/.test(row(rows,'Other.md').text)&&!/\[bot\]/.test(row(rows,'Other.md').text),row(rows,'Other.md').text);
  await open(p,NOTE);
  t.check('once opened, it is no longer marked',!row(await recent(p),NOTE).fresh);
  await H.setEditor(p,V2+'mine\n'); await p.click('#btn-save'); await p.waitForFunction(()=>!saving&&!dirty());
  const mine=row(await recent(p),NOTE);
  t.check('your own change says you, unmarked',/\byou\b/.test(mine.text)&&!mine.fresh,mine.text);
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup();
  await open(p,NOTE);
  const list=await history(p);
  t.check('⋯ → History lists the note\'s changes, newest first, with who',list.length===2&&/Claude Opus 5\.5/.test(list[0])&&/Tidy Ideas/.test(list[0])&&/Initial commit/.test(list[1]),JSON.stringify(list));
  await expand(p,0);
  const diff=await p.evaluate(()=>[...document.querySelectorAll('#history-list > details')[0].querySelectorAll('.diff > *')].map(l=>l.className+':'+l.lastChild.textContent));
  t.check('a change shows lines removed and added',diff.includes('del:two')&&diff.includes('add:TWO')&&diff.includes('add:four'),JSON.stringify(diff));
  t.check('with signs and words in the page itself, not only colour',await p.evaluate(()=>{const l=document.querySelector('#history-list .diff .del');return /\u2212/.test(l.textContent)&&/removed:/.test(l.textContent);}));
  t.check('the newest version has no Restore (it is the note now)',await p.evaluate(()=>!document.querySelectorAll('#history-list > details')[0].querySelector('button.restore')));
  await expand(p,1);
  await p.evaluate(()=>document.querySelectorAll('#history-list > details')[1].querySelector('button.restore').click());
  await p.waitForFunction(()=>!saving&&!dirty()&&!document.getElementById('history').open);
  t.check('Restore this version puts it back in one save',gh.files[NOTE]===V1&&await H.editorValue(p)===V1,JSON.stringify(gh.files[NOTE]));
  t.check('as a new change, so the agent\'s version stays in the history',gh.history.some(c=>c.files[NOTE]===V2));
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup();
  await open(p,NOTE); await H.setEditor(p,V2+'typing\n');
  await history(p); await expand(p,1);
  await p.evaluate(()=>document.querySelectorAll('#history-list > details')[1].querySelector('button.restore').click());
  await H.settle(p,300);
  t.check('unsaved typing is never replaced by a restore',await H.editorValue(p)===V2+'typing\n'&&gh.files[NOTE]===V2,await H.status(p));
  t.check('and it says why',/unsaved/i.test(await H.status(p)),await H.status(p));
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup();
  await open(p,NOTE); await history(p); await expand(p,1);
  gh.files[NOTE]=V2+'theirs\n'; gh.touch('Elsewhere',BOT);   // changed on GitHub while History was open
  await p.evaluate(()=>document.querySelectorAll('#history-list > details')[1].querySelector('button.restore').click());
  await p.waitForFunction(()=>!saving);await H.settle(p,400);
  t.check('a change made elsewhere meanwhile is never lost',gh.files[NOTE].includes('theirs'),JSON.stringify(gh.files[NOTE]));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  await p.evaluate(()=>startNote('Unsaved.md','# new')); await p.waitForFunction(()=>current?.path==='Unsaved.md');
  await p.click('#btn-more');
  t.check('a note never saved offers no History',!await p.locator('#btn-history').isVisible());
  await ctx.close();
}
{
  const repos=[{owner:{login:'roldaof'},name:'vault',full_name:'roldaof/vault',default_branch:'main',private:true,permissions:{push:false,pull:true}}];
  const {p,ctx}=await setup({repos});
  await H.settle(p,600); await open(p,NOTE);
  const list=await history(p); await expand(p,1);
  t.check('read-only: History shows, but nothing can be restored',list.length===2&&await p.evaluate(()=>!document.querySelector('#history-list button.restore')));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  await open(p,NOTE);
  let release; const gate=new Promise(r=>release=r); let entered; const asked=new Promise(r=>entered=r);
  await p.route(/\/commits\?.*path=Ideas/,async r=>{entered();await gate;await r.fallback();});
  await p.click('#btn-more'); await p.click('#btn-history'); await asked;
  await p.evaluate(()=>document.getElementById('history').close()); await open(p,'Other.md'); release(); await H.settle(p,300);
  t.check('a late history reply is not shown for another note',await p.evaluate(()=>!document.getElementById('history').open&&!document.querySelector('#history-list details')));
  await ctx.close();
}
{
  // Deleted, then made again at the same name: the deletion is listed, never restorable.
  const {p,ctx,gh}=await setup();
  delete gh.files[NOTE]; gh.touch('Delete Ideas.md',BOT);
  gh.files[NOTE]='again\n'; gh.touch('Ideas again',BOT);
  await open(p,NOTE); const list=await history(p);
  const i=list.findIndex(s=>/Delete Ideas/.test(s)); await expand(p,i);
  const said=await p.evaluate(i=>document.querySelectorAll('#history-list > details')[i].textContent,i);
  t.check('a deletion says so and offers no Restore (it would empty the note)',/deleted the note/.test(said)&&await p.evaluate(i=>!document.querySelectorAll('#history-list > details')[i].querySelector('button.restore'),i),said);
  await ctx.close();
}
{
  // A person called Claude is not an agent; the move into a name says so.
  const {p,ctx,gh}=await setup();
  gh.files[NOTE]=V2+'five\n'; gh.touch('With a friend\n\nCo-authored-by: Claude Dupont <claude@example.fr>',{login:'roldaof',type:'User',name:'roldaof'});
  gh.files['Moved.md']=gh.files['Other.md']; delete gh.files['Other.md']; gh.touch('Rename Other.md to Moved.md',{login:'roldaof',type:'User',name:'roldaof'});
  await p.click('#btn-refresh'); await p.waitForFunction(()=>treeState==='ok'&&files.some(f=>f.path==='Moved.md'));
  const r=row(await recent(p),NOTE);
  t.check('a human co-author called Claude is not taken for an agent',/by you/.test(r.text)&&!r.fresh,r.text);
  await open(p,'Moved.md'); const list=await history(p); await expand(p,0);
  t.check('a note moved here says its earlier history is not shown',/moved here from another name/.test(await p.textContent('#history-list'))&&/before a rename or move is not shown/.test(await p.textContent('#history-status')));
  await ctx.close();
}
{
  // Busy: a rename or save on its way, or a conflict, refuses Restore with a reason.
  const {p,ctx,gh}=await setup();
  await open(p,NOTE); await history(p); await expand(p,1);
  await p.evaluate(()=>{moving=true;});
  await p.evaluate(()=>document.querySelectorAll('#history-list > details')[1].querySelector('button.restore').click());
  await H.settle(p,200);
  t.check('Restore while the note is busy changes nothing and says why',await H.editorValue(p)===V2&&/busy/i.test(await H.status(p)),await H.status(p));
  await p.evaluate(()=>{moving=false;});
  await ctx.close();
}
{
  // Only the final line break changed: said in words, not an empty line.
  const {p,ctx,gh}=await setup();
  gh.files[NOTE]=V2.replace(/\n$/,''); gh.touch('Trim',BOT);
  await open(p,NOTE); await history(p); await expand(p,0);
  t.check('a change of line breaks only is described in words',/spacing, blank lines or line endings only/.test(await p.textContent('#history-list')),await p.textContent('#history-list'));
  await ctx.close();
}
{
  // The device clock runs a day fast: a change made after opening is still New (versions, not clocks).
  const {p,ctx,gh}=await setup();
  await p.clock.setFixedTime(new Date(Date.now()+86400000));
  await open(p,NOTE); await p.evaluate(()=>openFile('Other.md')); await p.waitForFunction(()=>current?.path==='Other.md');
  gh.files[NOTE]=V2+'later\n'; gh.touch('Later',BOT);
  t.check('a change after you opened it is New even with a fast clock',row(await recent(p),NOTE).fresh);
  await ctx.close();
}
await H.stop();
t.finish();
