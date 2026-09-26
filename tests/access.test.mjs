/* Repositories that cannot be written: archived, read-only for this person, or gone. */
import * as H from './harness.mjs';

const t = H.suite('access');
await H.start();

const repo = extra => [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault',
                         default_branch: 'main', private: true, ...extra }];
const FILES = () => ({ 'todo.md': '- [ ] one\n- [x] two\n', 'inbox.md': 'hello\n' });

async function readOnlyCase(name, extra, reason) {
  const gh = H.fakeGitHub({ files: FILES(), repos: repo(extra) });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 600);
  t.check(`${name}: a read-only badge is shown`, await p.isVisible('#readonly'));
  t.check(`${name}: with the reason`, reason.test((await p.getAttribute('#readonly', 'title')) + ' ' + await H.status(p)),
    (await p.getAttribute('#readonly', 'title')) + ' / ' + await H.status(p));
  t.check(`${name}: notes still open`, (await H.rows(p)).includes('inbox.md'));
  await H.clickRow(p, 'inbox.md');
  t.check(`${name}: and read`, (await H.editorValue(p)) === 'hello\n');
  t.check(`${name}: the editor is locked`, await p.evaluate(() => document.querySelector('#cm-stub, .fallback-editor').readOnly));
  await p.focus('#cm-stub');
  await p.keyboard.type('typed anyway');
  await p.keyboard.press('Control+s');
  await p.waitForTimeout(2600);
  t.check(`${name}: Save is off`, (await p.isDisabled('#btn-save')) || !(await p.isVisible('#btn-save')));
  t.check(`${name}: the pinned capture is off`, await p.isDisabled('#pin-input') &&
    await p.evaluate(() => [...document.querySelectorAll('#pin-list input')].every(b => b.disabled)));
  t.check(`${name}: no task can be removed`,
    await p.evaluate(() => [...document.querySelectorAll('#pin-list button')].every(b => b.disabled || b.hidden)));
  t.check(`${name}: nothing was ever sent`, gh.commits.length === 0 && !gh.log.refusedWrites,
    String(gh.log.refusedWrites));
  t.check(`${name}: no draft either`, await p.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length) === 0);
  await ctx.close();
}

await readOnlyCase('archived', { archived: true }, /archived/i);
await readOnlyCase('no write permission', { permissions: { admin: false, maintain: false, push: false, triage: false, pull: true } },
  /read this repository but not change it/i);

/* ===== archived while someone is typing ===== */
{
  const repos = repo({});
  const gh = H.fakeGitHub({ files: FILES(), repos });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 500);
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'typed before the archive\n');   // autosave is 2 s away
  repos[0].archived = true;                             // archived on GitHub meanwhile
  await p.click('#btn-refresh');
  await H.settle(p, 400);
  t.check('the open note locks when the repository turns read-only',
    await p.evaluate(() => document.querySelector('#cm-stub').readOnly));
  await p.keyboard.press('Control+s');
  await p.waitForTimeout(2600);                          // and the autosave comes due
  t.check('neither Save nor autosave sends anything', gh.commits.length === 0 && !gh.log.refusedWrites,
    String(gh.log.refusedWrites));
  t.check('what was typed is kept as a draft', await p.evaluate(() =>
    Object.values(localStorage).some(v => v.includes('typed before the archive'))));
  await ctx.close();
}

/* ===== nothing is written before access is known ===== */
{
  const repos = repo({ permissions: { admin: false, maintain: false, push: false, triage: false, pull: true } });
  const gh = H.fakeGitHub({ files: FILES(), repos });
  const ctx = await H.context(gh);
  // The answer about access is slow; the pinned file is quick.
  await ctx.route('https://api.github.com/repos/roldaof/vault', async r => {
    await new Promise(res => setTimeout(res, 3000)); return r.fallback();
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#pin-list .task');
  await p.fill('#pin-input', 'too early').catch(() => {});
  await p.press('#pin-input', 'Enter').catch(() => {});
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'typed too early\n');
  await H.settle(p, 60);
  await p.keyboard.press('Control+s');
  await p.waitForTimeout(3500);
  t.check('a task or a save before access is known is not sent', gh.commits.length === 0 && !gh.log.refusedWrites,
    String(gh.log.refusedWrites));
  t.check('and then read-only is shown', await p.isVisible('#readonly'));
  await ctx.close();
}

/* ===== a late answer about one repository is not applied to another ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'old', full_name: 'roldaof/old', default_branch: 'main', private: true, archived: true },
    { owner: { login: 'roldaof' }, name: 'live', full_name: 'roldaof/live', default_branch: 'main', private: true },
  ];
  const gh = H.fakeGitHub({ files: FILES(), repos });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/old' });
  await p.click('#f-save');
  await H.settle(p, 600);
  await ctx.route('https://api.github.com/repos/roldaof/old', async r => {
    await new Promise(res => setTimeout(res, 1500)); return r.fallback();
  });
  await p.click('#btn-refresh');                   // asks about "old", slowly
  await H.settle(p, 100);
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/live' });
  await p.click('#f-save');
  await p.waitForTimeout(2200);
  t.check("an archived repository's late answer does not lock the one switched to", !(await p.isVisible('#readonly')));
  await ctx.close();
}

/* ===== a repository gone while a note is open ===== */
{
  const gh = H.fakeGitHub({ files: FILES(), repos: repo({}) });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  await H.clickRow(p, 'inbox.md');
  gh.gone = true;
  await p.click('#btn-refresh');
  // Several requests settle "gone" (the tree, then the repository); a slow
  // machine needs longer than a fixed pause. The check is unchanged.
  await p.waitForFunction(() => document.querySelector('#cm-stub').readOnly &&
    !document.getElementById('readonly').hidden, null, { timeout: 5000 }).catch(() => {});
  t.check('the open note locks when its repository is gone',
    await p.evaluate(() => document.querySelector('#cm-stub').readOnly) && await p.isVisible('#readonly'));
  await ctx.close();
}

/* ===== on a phone the reason stays within reach ===== */
{
  const gh = H.fakeGitHub({ files: FILES(), repos: repo({ archived: true }) });
  const ctx = await H.context(gh, { viewport: { width: 390, height: 780 } });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(8000);                    // the first message has gone
  await p.click('#readonly');
  t.check('tapping the badge says why', /archived/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== a writable repository is not affected ===== */
{
  const gh = H.fakeGitHub({ files: FILES(), repos: repo({}) });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 600);
  t.check('a writable repository shows no badge', !(await p.isVisible('#readonly')));
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'changed\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('and saves', gh.files['inbox.md'] === 'changed\n');
  await ctx.close();
}

/* ===== a repository that is gone ===== */
{
  const gh = H.fakeGitHub({ files: FILES(), repos: repo({}) });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  gh.gone = true;
  await p.click('#btn-refresh');
  await H.settle(p, 600);
  const tree = await p.textContent('#tree');
  t.check('a repository that is gone says so, with what to do', /no longer be reached|can't be reached|cannot be reached/i.test(tree) &&
    /settings/i.test(tree), tree);
  t.check('not a bare "Not Found"', !/^Not Found$/.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

await H.stop();
t.finish();
