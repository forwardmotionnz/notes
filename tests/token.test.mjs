/* N49: sign in with a fine-grained personal access token: no GitHub App, no broker. */
import * as H from './harness.mjs';
const t=H.suite('token');
await H.start();
const TOKEN='github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP';
async function setup(pat={repos:['roldaof/obsidian-vault'],write:true}) {
  const gh=H.fakeGitHub({files:{'a.md':'hello\n'}});
  gh.pats=new Map([[TOKEN,pat]]);
  const ctx=await H.context(gh);
  const p=await H.page(ctx); p.setDefaultTimeout(5000);
  await p.waitForSelector('#f-signin:not([disabled])');
  return {gh,ctx,p,pat};
}
async function useToken(p,token=TOKEN,forget=false) {
  if (!(await p.evaluate(()=>document.getElementById('pat').open))) await p.click('#pat summary');
  if (forget) await p.check('#f-session-in');
  await p.fill('#f-pat',token); await p.click('#f-pat-go');
}
{
  const {p,ctx,gh}=await setup();
  const det=await p.$('#pat');
  t.check('Other ways to sign in is offered, folded, below Sign in',!!det&&!(await det.evaluate(d=>d.open))&&await p.evaluate(()=>!!(document.getElementById('f-signin').compareDocumentPosition(document.getElementById('pat'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  await p.click('#pat summary');
  const make=await p.$('#pat a[href^="https://github.com/settings/personal-access-tokens/new"]');
  t.check('it links to making a fine-grained token on GitHub, in a new tab',!!make&&(await make.getAttribute('target'))==='_blank'&&/noopener/.test(await make.getAttribute('rel')));
  t.check('and says what to choose: one repository, Contents read and write',/Only select repositories/.test(await p.textContent('#pat'))&&/Contents/.test(await p.textContent('#pat'))&&/Read and write/.test(await p.textContent('#pat')));
  t.check('the token field does not show what is typed',await p.$eval('#f-pat',e=>getComputedStyle(e).webkitTextSecurity==='disc'));
  t.check('and is not a password field, so the browser does not offer to save the token',(await p.getAttribute('#f-pat','type'))!=='password'&&(await p.getAttribute('#f-pat','autocomplete'))==='off');
  await useToken(p,'ghp_classicTokenNotFineGrained0123456789');
  await p.waitForFunction(()=>!document.getElementById('pat-error').hidden);
  t.check('a token that is not fine-grained is refused before anything is sent',/github_pat_/.test(await p.textContent('#pat-error'))&&!(gh.log.patCalls)&&!(await p.evaluate(()=>signedIn())));
  await useToken(p);
  await p.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok'&&files.length);
  t.check('a fine-grained token signs in and its one repository is chosen',(await p.textContent('#crumb')).includes('roldaof/obsidian-vault'),await p.textContent('#crumb'));
  await H.saveNote(p,'a.md','hello from a token\n'); await p.waitForFunction(()=>!saving&&!dirty());
  t.check('saving works with the token',gh.files['a.md']==='hello from a token\n');
  t.check('the broker is never used',gh.log.exchanges===0&&gh.log.refreshes===0,JSON.stringify([gh.log.exchanges,gh.log.refreshes]));
  t.check('the app\'s installation lists are never asked for',!gh.log.patInstallations);
  t.check('the token is not in the address',!p.url().includes('github_pat_'));
  await p.click('#btn-settings');
  const hint=await p.locator('#repo-hint').innerText();
  t.check('Settings offers no app installation, and says the token saves only where it was given',!(await p.locator('#f-install').isVisible())&&/token[\s\S]*only save to the ones you gave it/i.test(hint),hint);
  t.check('with no leftover words about installing on GitHub',!/new tab|updates when you come back/.test(hint),hint);
  await p.keyboard.press('Escape');
  await p.reload(); await p.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok');
  t.check('a reload stays signed in with the token, still without the broker',gh.log.exchanges===0&&gh.log.refreshes===0);
  await ctx.close();
}
{
  const {p,ctx,gh,pat}=await setup();
  await useToken(p); await p.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok'&&files.length);
  await p.evaluate(()=>openFile('a.md')); await p.waitForFunction(()=>current?.path==='a.md');
  pat.revoked=true;
  await H.setEditor(p,'typed after revoking\n'); await p.click('#btn-save'); await H.settle(p,600);
  t.check('a revoked or expired token signs out, saying to make a new one',/expired or been revoked/i.test(await p.textContent('#view-signin'))&&!(await p.evaluate(()=>signedIn())),await p.textContent('#signin-error'));
  t.check('and the typing is kept as a draft',await p.evaluate(()=>Object.keys(localStorage).some(k=>/^notes\.draft/.test(k)&&localStorage.getItem(k).includes('typed after revoking'))));
  t.check('without the broker',gh.log.exchanges===0&&gh.log.refreshes===0);
  await ctx.close();
}
{
  const {p,ctx,gh}=await setup({repos:['roldaof/obsidian-vault'],write:false});
  await useToken(p); await p.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok'&&files.length);
  await H.saveNote(p,'a.md','not allowed\n'); await H.settle(p,600);
  t.check('a read-only token says what to check on GitHub: the repository, the permission, an organisation\'s approval',/includes this repository with Contents: Read and write[\s\S]*organisation/.test(await H.status(p)),await H.status(p));
  t.check('nothing is written, and the typing is kept',gh.files['a.md']==='hello\n'&&await p.evaluate(()=>dirty()));
  await ctx.close();
}
{
  const {p,ctx}=await setup({repos:[],write:true});
  await useToken(p); await p.waitForFunction(()=>!document.getElementById('pat-error').hidden);
  t.check('a token that reaches no repository says so and does not sign in',/any repository/i.test(await p.textContent('#pat-error'))&&!(await p.evaluate(()=>signedIn()))&&await p.evaluate(()=>!localStorage.getItem('notes.config.v2')));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  await useToken(p,'github_pat_11WRONGWRONGWRONG_wrongwrongwrongwrongwrongwrongwrongwrongwrongwrongwrong');
  await p.waitForFunction(()=>!document.getElementById('pat-error').hidden);
  t.check('a token GitHub does not accept says so',/did not accept/i.test(await p.textContent('#pat-error'))&&!(await p.evaluate(()=>signedIn())));
  await ctx.close();
}
{
  const {p,ctx}=await setup();
  await useToken(p,TOKEN,true); await p.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok');
  t.check('Forget me keeps the token in this session only',await p.evaluate(()=>!localStorage.getItem('notes.config.v2')&&!!sessionStorage.getItem('notes.config.v2')));
  await ctx.close();
}
{
  // A wrong token typed in one tab must not touch the sign-in another tab saved.
  const {p:a,ctx,gh}=await setup();
  const b=await H.page(ctx); b.setDefaultTimeout(5000); await b.waitForSelector('#f-signin:not([disabled])');
  await useToken(a); await a.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok'&&files.length);
  await useToken(b,'github_pat_11WRONGWRONGWRONG_wrongwrongwrongwrongwrongwrongwrongwrongwrongwrongwrong');
  await b.waitForFunction(()=>!document.getElementById('pat-error').hidden); await H.settle(a,400);
  t.check('a wrong token in one tab leaves the saved sign-in alone',await b.evaluate(()=>/github_pat_11ABC/.test(localStorage.getItem('notes.config.v2')||'')));
  t.check('and the other tab stays signed in',await a.evaluate(()=>signedIn()&&document.getElementById('view-signin').hidden));
  await ctx.close();
}
await H.stop();
t.finish();
