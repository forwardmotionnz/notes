/* Notes over 1 MB: GitHub's contents API does not return them, so they are
   never opened as an empty note that a save would write over. */
import * as H from './harness.mjs';

const t = H.suite('large');
await H.start();

const BIG = '# Big\n' + 'x'.repeat(1100 * 1024) + '\n';        // just over 1 MB
const FILES = () => ({ 'big.md': BIG, 'todo.md': '# Today\n', 'inbox.md': 'small\n' });

{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  t.check('a large file is listed', (await H.rows(p)).includes('big.md'));
  t.check('but marked as not openable', await p.evaluate(() =>
    [...document.querySelectorAll('#tree .row')].find(r => r.textContent.includes('big.md')).classList.contains('binary')));
  await H.clickRow(p, 'big.md');
  t.check('clicking it says why and opens nothing', /1 MB/.test(await H.status(p)) &&
    (await H.editorValue(p)) === null, await H.status(p));

  // Reached some other way: the last file reopened on load, or a pin.
  await p.evaluate(() => openFile('big.md'));
  await p.waitForTimeout(400);
  t.check('opening it directly is refused too', (await H.editorValue(p)) === null && /1 MB/.test(await H.status(p)),
    await H.status(p));
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.fill('#f-pins', 'big.md');
  await p.click('#f-save');
  await p.waitForTimeout(500);
  t.check('pinned, it shows the reason instead of an empty list', /1 MB/.test(await p.textContent('#pin-list')),
    await p.textContent('#pin-list'));
  await p.fill('#pin-input', 'a task');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(500);
  t.check('and no task can be added over it', gh.files['big.md'] === BIG && gh.commits.length === 0,
    String(gh.commits.length));
  await ctx.close();
}

/* ===== GitHub refusing the read outright ===== */
{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.route('https://api.github.com/**/contents/inbox.md*', r => r.fulfill({ status: 403,
    contentType: 'application/json', body: JSON.stringify({ message: 'This API returns blobs up to 1 MB in size.',
      errors: [{ resource: 'Blob', field: 'data', code: 'too_large' }] }) }));
  await H.clickRow(p, 'inbox.md');
  t.check('a "too large" refusal is explained, not blamed on the installation',
    /1 MB/.test(await H.status(p)) && !/installed/i.test(await H.status(p)), await H.status(p));
  t.check('and nothing is open to save over it', (await H.editorValue(p)) === null);
  await ctx.close();
}

/* ===== a draft whose file has since grown past 1 MB stays reachable ===== */
{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.evaluate(() => localStorage.setItem('notes.draft.v1:roldaof/obsidian-vault@main:big.md',
    JSON.stringify({ text: '# Big\n\nmy offline paragraph\n', sha: 'old', at: 0 })));
  await p.evaluate(() => openFile('big.md'));
  await p.waitForTimeout(500);
  t.check('the stranded draft opens as a new note beside it', (await H.editorValue(p)) === '# Big\n\nmy offline paragraph\n' &&
    (await p.textContent('#crumb .name')) === 'big (unsaved copy).md', await p.textContent('#crumb'));
  t.check('with the reason', /1 MB/.test(await H.status(p)), await H.status(p));
  await p.click('#btn-save');
  await p.waitForTimeout(500);
  t.check('saving it creates the copy and leaves the big file alone',
    gh.files['big (unsaved copy).md'] === '# Big\n\nmy offline paragraph\n' && gh.files['big.md'] === BIG);
  t.check('and no draft is left behind', await p.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length) === 0);
  await ctx.close();
}

/* ===== a note is never saved past 1 MB ===== */
{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'y'.repeat(1100 * 1024));
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(400);
  t.check('saving past 1 MB is refused, with the reason', gh.files['inbox.md'] === 'small\n' &&
    /1 MB/.test(await H.status(p)), await H.status(p));
  t.check('and the text is kept as a draft', await p.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length) === 1);
  await ctx.close();
}

/* ===== a lost reply, then the file cannot be read back: a conflict, not a dead end ===== */
{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/**', r => {
    if (!lose || r.request().method() !== 'PUT') return r.fallback();
    lose = false;
    return r.abort();
  });
  await H.setEditor(p, 'mine\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(400);
  gh.files['inbox.md'] = BIG;                      // grew past 1 MB elsewhere meanwhile
  await H.setEditor(p, 'mine, more\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(600);
  t.check('it is reported as a conflict, with Discard offered', /conflict/i.test(await H.status(p)) &&
    await p.isVisible('#btn-discard'), await H.status(p));
  t.check('and the big file is untouched', gh.files['inbox.md'] === BIG);
  await ctx.close();
}

/* ===== a task never pushes a pinned file past 1 MB ===== */
{
  const NEAR = '# Near\n' + 'z'.repeat(1024 * 1024 - 20) + '\n';   // just under the limit
  const gh = H.fakeGitHub({ files: { 'todo.md': NEAR } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  await p.fill('#pin-input', 'one task too many');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(500);
  t.check('a task that would take the file past 1 MB is refused', gh.files['todo.md'] === NEAR &&
    gh.commits.length === 0 && /1 MB/.test(await H.status(p)), await H.status(p));
  t.check('and the task text stays in the box', (await p.inputValue('#pin-input')) === 'one task too many');
  await ctx.close();
}

/* ===== files stored with Git LFS ===== */
{
  const POINTER = 'version https://git-lfs.github.com/spec/v1\noid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393\nsize 5242880\n';
  const gh = H.fakeGitHub({ files: { 'data.csv': POINTER, 'todo.md': '' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'data.csv');
  t.check('a Git LFS pointer is not opened', (await H.editorValue(p)) === null && /LFS/.test(await H.status(p)),
    await H.status(p));
  await p.waitForTimeout(2600);
  t.check('and never written', gh.commits.length === 0);
  await ctx.close();
}

await H.stop();
t.finish();
