/* One shared deployment: someone else signs in, with personal and
   organisation installations and more repositories than fit on one page. */
import * as H from './harness.mjs';

const t = H.suite('shared');
await H.start();

const repo = (owner, name) => ({ owner: { login: owner }, name, full_name: `${owner}/${name}`,
                                 default_branch: 'main', private: true });
const personal = Array.from({ length: 150 }, (_, i) => repo('someone-else', 'repo-' + String(i).padStart(3, '0')));
const org = [repo('acme', 'team-notes'), repo('acme', 'handbook'), repo('acme', 'ops')];
const moreOrgs = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i, account: { login: 'org' + i, type: 'Organization' },
  repos: [repo('org' + i, 'notes')] }));

{
  const gh = H.fakeGitHub({
    files: { 'todo.md': '' },
    installations: [
      { id: 501, account: { login: 'someone-else', type: 'User' }, repos: personal },
      { id: 502, account: { login: 'acme', type: 'Organization' }, repos: org },
      ...moreOrgs,                                   // 102 installations: more than one page even at 100
    ],
  });
  gh.user.login = 'someone-else';
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  const opts = await p.$$eval('#f-repo option', o => o.map(x => x.textContent.trim()));
  t.check('another person signs in to the same deployment', (await p.textContent('#who-login')) === '@someone-else');
  t.check('every repository on every page is offered', opts.length === 150 + 3 + 100, String(opts.length));
  t.check('including the last personal one', opts.includes('someone-else/repo-149'));
  t.check('and organisation repositories', opts.includes('acme/team-notes') && opts.includes('org99/notes'));
  t.check('each once', new Set(opts).size === opts.length);

  await p.selectOption('#f-repo', { label: 'acme/team-notes' });
  await p.click('#f-save');
  await H.settle(p, 500);
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('hello') : d.accept());
  await p.click('#btn-new');
  await H.settle(p, 200);
  await H.setEditor(p, '# Hello from acme\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 500);
  const c = gh.commits.at(-1);
  t.check('and writes a note in an organisation repository', !!c && c.repo === 'acme/team-notes' &&
    c.path === 'hello.md', JSON.stringify(c));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== pages smaller than asked for, and no total ===== */
for (const [label, set] of [['smaller pages than asked for', gh => { gh.maxPerPage = 30; }],
                            ['no total_count', gh => { gh.noTotal = true; }]]) {
  const gh = H.fakeGitHub({ files: { 'todo.md': '' }, installations: [
    { id: 501, account: { login: 'someone-else', type: 'User' }, repos: personal },
    { id: 502, account: { login: 'acme', type: 'Organization' }, repos: org } ] });
  set(gh);
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  const n = await p.$$eval('#f-repo option', o => o.length);
  t.check(`${label}: every repository still offered`, n === 153, String(n));
  await ctx.close();
}

/* ===== review: one installation failing does not empty the list ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '' }, installations: [
    { id: 501, account: { login: 'someone-else', type: 'User' }, repos: [repo('someone-else', 'mine')] },
    { id: 502, account: { login: 'acme', type: 'Organization' }, repos: org } ] });
  const ctx = await H.context(gh);
  await ctx.route('**/user/installations/502/repositories**', r => r.fulfill({ status: 403,
    contentType: 'application/json', body: JSON.stringify({ message: 'This installation has been suspended' }) }));
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 800);
  const opts = await p.$$eval('#f-repo option', o => o.map(x => x.textContent.trim()));
  t.check('the installations that answered are still offered', opts.includes('someone-else/mine') || !(await H.dialogOpen(p)),
    JSON.stringify(opts));
  await p.click('#btn-settings').catch(() => {});
  await H.settle(p, 600);
  t.check('and the person is told some could not be listed', /could not be listed/i.test(await p.textContent('#repo-hint')),
    await p.textContent('#repo-hint'));
  await ctx.close();
}

/* ===== review: not hundreds of requests at once ===== */
{
  const many = Array.from({ length: 40 }, (_, i) => ({ id: 2000 + i, account: { login: 'o' + i, type: 'Organization' },
    repos: [repo('o' + i, 'notes')] }));
  const gh = H.fakeGitHub({ files: { 'todo.md': '' }, installations: many });
  const ctx = await H.context(gh);
  let inFlight = 0, peak = 0;
  await ctx.route('**/user/installations/*/repositories**', async r => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(res => setTimeout(res, 100));
    inFlight--;
    return r.fallback();
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.waitForTimeout(1500);
  const n = await p.$$eval('#f-repo option', o => o.length);
  t.check('installations are asked a few at a time', peak <= 4, 'peak ' + peak);
  t.check('and all of them still arrive', n === 40, String(n));
  await ctx.close();
}

/* ===== review: the current repository is never silently swapped ===== */
{
  const repos = Array.from({ length: 5 }, (_, i) => repo('me', 'r' + i));
  const gh = H.fakeGitHub({ files: { 'todo.md': '' }, repos });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'me/r3' });
  await p.click('#f-save');
  await H.settle(p, 500);
  gh.repos.splice(3, 1);                           // gone from the list (or skipped between pages)
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await H.settle(p, 400);
  const sel = await p.$eval('#f-repo', s => s.options[s.selectedIndex].textContent);
  t.check('a current repository missing from the list stays selected', sel.includes('me/r3'), sel);
  await p.fill('#f-pins', 'todo.md, more.md');
  await p.click('#f-save');
  await H.settle(p, 500);
  t.check('so saving other settings does not switch repository', (await p.textContent('#crumb')).includes('me/r3'),
    await p.textContent('#crumb'));
  await ctx.close();
}

/* ===== review: settings can be saved while a long list is still loading ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '' }, repos: [repo('me', 'notes')] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 500);
  await ctx.route('**/user/installations**', async r => { await new Promise(res => setTimeout(res, 3000)); return r.fallback(); });
  await p.click('#btn-settings');
  await H.settle(p, 300);
  t.check('with a repository already chosen, Save works before the list arrives', await p.isEnabled('#f-save'));
  await p.fill('#f-pins', 'todo.md, quick.md');
  await p.click('#f-save');
  await H.settle(p, 300);
  t.check('and keeps that repository', (await p.textContent('#crumb')).includes('me/notes') &&
    JSON.stringify(await p.$$eval('#pin-tabs button', b => b.map(x => x.textContent))) === '["todo.md","quick.md"]');
  await ctx.close();
}

/* ===== review: an install waiting for an organisation owner's approval ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const q = await H.page(ctx, H.APP() + '?setup_action=request');
  await H.settle(q, 600);
  t.check('a request for approval is not described as done', /approv/i.test(await q.evaluate(() => document.body.innerText)),
    await H.status(q));
  await ctx.close();
}

await H.stop();
t.finish();
