/* A brand new repository with no commits at all. */
import * as H from './harness.mjs';

const t = H.suite('empty');
await H.start();

{
  const gh = H.fakeGitHub({ empty: true, files: {} });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  const tree = await p.textContent('#tree');
  t.check('an empty repository is named as such', /empty/i.test(tree), tree);
  t.check('with how to start', /\+/.test(tree) || /first note/i.test(tree), tree);
  t.check('and no error', !/conflict|error|changed/i.test(await H.status(p)), await H.status(p));
  t.check('no page errors', p.errors.filter(e => !/409|404/.test(e)).length === 0, p.errors.join(' | '));

  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('first') : d.accept());
  await p.click('#btn-new');
  await p.waitForTimeout(200);
  await H.setEditor(p, '# First\n\nhello\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(600);
  t.check('the first note is created', gh.files['first.md'] === '# First\n\nhello\n' && !gh.empty,
    await H.status(p));
  t.check('without naming a branch that does not exist yet', gh.log.lastPutHadBranch === false);
  t.check('and the tree shows it', (await H.rows(p)).includes('first.md'), JSON.stringify(await H.rows(p)));
  await H.setEditor(p, '# First\n\nhello again\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(500);
  t.check('once it exists, saves name the branch again', gh.log.lastPutHadBranch === true &&
    gh.files['first.md'] === '# First\n\nhello again\n');
  await ctx.close();
}

/* ===== the pinned capture box works in an empty repository too ===== */
{
  const gh = H.fakeGitHub({ empty: true, files: {} });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  await p.fill('#pin-input', 'first task');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(600);
  t.check('a first task creates the pinned file', gh.files['todo.md'] === '- [ ] first task\n', await H.status(p));
  await ctx.close();
}

/* ===== a first task in the pinned box shows up in the tree ===== */
{
  const gh = H.fakeGitHub({ empty: true, files: {} });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  await p.fill('#pin-input', 'first task');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(700);
  t.check('the tree no longer says empty once the first task is saved',
    (await H.rows(p)).includes('todo.md') && !/empty/i.test(await p.textContent('#tree')), await p.textContent('#tree'));
  await ctx.close();
}

/* ===== a repository GitHub says is unavailable is not called empty ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '' } });
  gh.unavailable = true;
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  t.check('an unavailable repository is not called empty', !/empty/i.test(await p.textContent('#tree')),
    await p.textContent('#tree'));
  t.check('it says what is happening instead of "conflict"', /not available/i.test(await H.status(p)) ||
    /not available|could not load/i.test(await p.textContent('#tree')), await H.status(p) + ' / ' + await p.textContent('#tree'));
  await ctx.close();
}

/* ===== switching to a repository whose list fails to load ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'blank', full_name: 'roldaof/blank', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'full', full_name: 'roldaof/full', default_branch: 'main', private: true },
  ];
  const gh = H.fakeGitHub({ repos, empty: true, files: {} });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/blank' });
  await p.click('#f-save');
  await p.waitForTimeout(500);
  await p.route('https://api.github.com/repos/roldaof/full/git/trees/**', r => r.abort());
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/full' });
  await p.click('#f-save');
  await p.waitForTimeout(8000);                    // after the status message has gone
  const tree = await p.textContent('#tree');
  t.check('a list that failed to load is not shown as an empty repository', !/empty/i.test(tree) &&
    /could not load/i.test(tree), tree);
  await ctx.close();
}

/* ===== switching away from a repository with notes, to one that fails to load ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'full', full_name: 'roldaof/full', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'other', full_name: 'roldaof/other', default_branch: 'main', private: true },
  ];
  const gh = H.fakeGitHub({ repos, files: { 'todo.md': '', 'secret-plans.md': 'x\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/full' });
  await p.click('#f-save');
  await p.waitForTimeout(500);
  await p.route('https://api.github.com/repos/roldaof/other/git/trees/**', r => r.abort());
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/other' });
  await p.click('#f-save');
  await p.waitForTimeout(800);
  t.check("the old repository's files are not shown as the new one's", !(await H.rows(p)).includes('secret-plans.md') &&
    /could not load/i.test(await p.textContent('#tree')), await p.textContent('#tree'));
  await ctx.close();
}

/* ===== the configured branch no longer exists ===== */
{
  // The default branch was renamed, or someone's first push created "master".
  const gh = H.fakeGitHub({ files: { 'todo.md': '- [ ] from trunk\n', 'notes.md': 'hi\n' }, branch: 'trunk' });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(800);
  t.check("the app follows the repository's default branch", (await H.rows(p)).includes('notes.md') &&
    (await p.textContent('#crumb')).includes('@trunk'), await p.textContent('#crumb'));
  t.check('and says so', /trunk/.test(await H.status(p)), await H.status(p));
  t.check('pinned tasks come from it', (await p.textContent('#pin-list')).includes('from trunk'));
  await H.clickRow(p, 'notes.md');
  await H.setEditor(p, 'hi there\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(400);
  t.check('and saves go there', gh.files['notes.md'] === 'hi there\n' && gh.commits.at(-1).branch === 'trunk');
  await ctx.close();
}

/* ===== a pinned task that fails to save is put back ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  await p.route('https://api.github.com/**/contents/**', r => r.request().method() === 'PUT' ? r.abort() : r.fallback());
  await p.fill('#pin-input', 'do not lose me');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(600);
  t.check('a task that could not be saved is back in the box', (await p.inputValue('#pin-input')) === 'do not lose me');
  await ctx.close();
}

await H.stop();
t.finish();
