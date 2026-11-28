/* N52: Collapse all, beside New folder in the Files heading, closes every
   folder in the list at once, and is remembered like folding one by hand.
   It only changes the view: nothing is written, the open note stays open. */
import * as H from './harness.mjs';
const t = H.suite('collapse-all');
await H.start();

const FILES = { 'Garden/Deep/Seeds.md': '# Seeds\n', 'Garden/Plan.md': '# Plan\n', 'Archive/Old.md': '# Old\n', 'Top.md': '# Top\n' };
async function setup(opts = {}) {
  const gh = H.fakeGitHub({ files: { ...FILES }, ...opts });
  const ctx = await H.context(gh, { noCdn: true, ...(opts.ctx || {}) });
  const p = await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  return { gh, ctx, p };
}
const openFolders = p => p.evaluate(() => [...document.querySelectorAll('#tree .row.dir[aria-expanded=true]')].map(r => r.textContent));
const rowNames = p => p.evaluate(() => [...document.querySelectorAll('#tree .row')].map(r => r.textContent));

{
  const { gh, ctx, p } = await setup();
  const btn = p.getByRole('button', { name: 'Collapse all folders', exact: true });
  t.check('Collapse all is in the Files heading, beside New folder',
    await btn.isVisible() && await p.evaluate(() => { const b = document.getElementById('btn-collapse'); return b.parentElement.id === 'files-row' && b.nextElementSibling?.id === 'btn-new-folder'; }));
  await H.expand(p, 'Archive');
  await p.evaluate(() => openFile('Garden/Deep/Seeds.md')); await p.waitForFunction(() => current?.path === 'Garden/Deep/Seeds.md' && current.sha);
  await H.setEditor(p, '# Seeds\n\nunsaved\n'); await H.settle(p, 100);
  t.check('setup: three folders open', (await openFolders(p)).length === 3, JSON.stringify(await openFolders(p)));
  const before = gh.commits.length;
  await btn.click(); await H.settle(p, 100);
  t.check('every folder is closed', (await openFolders(p)).length === 0, JSON.stringify(await openFolders(p)));
  t.check('only the top level is listed', JSON.stringify(await rowNames(p)) === JSON.stringify(['Archive', 'Garden', 'Top.md']), JSON.stringify(await rowNames(p)));
  t.check('the open note stays open, with its unsaved typing', await p.evaluate(() => current?.path === 'Garden/Deep/Seeds.md' && dirty()));
  t.check('nothing is committed', gh.commits.length === before);
  // Remembered like a folder folded by hand.
  await p.reload(); await p.waitForFunction(() => treeState === 'ok' && current?.path === 'Garden/Deep/Seeds.md'); await H.settle(p, 300);
  // A reload reopens the note, which shows it in Files (N51): only its own folders open again.
  t.check('after a reload the other folders stay closed; only the open note\'s reopen', JSON.stringify(await openFolders(p)) === JSON.stringify(['Garden', 'Deep']), JSON.stringify(await openFolders(p)));
  await ctx.close();
}
{
  const repos = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main', private: true, permissions: { push: false, pull: true } }];
  const { ctx, p } = await setup({ repos });
  await H.settle(p, 600); await H.expand(p, 'Garden');
  await p.click('#btn-collapse'); await H.settle(p, 100);
  t.check('read-only: offered and works (it changes only the view)', await p.locator('#btn-collapse').isVisible() && (await openFolders(p)).length === 0);
  await ctx.close();
}
{
  const { ctx, p } = await setup({ ctx: { viewport: { width: 390, height: 844 }, touch: true } });
  await p.click('#btn-tree'); await H.still(p);
  await H.expand(p, 'Garden');
  const fits = await p.evaluate(() => { const b = document.getElementById('btn-collapse').getBoundingClientRect(), s = document.getElementById('sidebar').getBoundingClientRect(); return b.width >= 24 && b.left >= s.left && b.right <= s.right; });
  t.check('on a phone it fits in the Files sheet', fits);
  await p.click('#btn-collapse'); await H.settle(p, 100);
  t.check('and works there', (await openFolders(p)).length === 0);
  t.check('the sheet stays open', await p.evaluate(() => document.body.classList.contains('tree-open')));
  await ctx.close();
}
{
  // Review: with text in the find box the list shows paths, not folders, and a content search may be running.
  const gh = H.fakeGitHub({ files: { ...FILES, 'Garden/Plan.md': '# Plan\n\nneedle\n' } });
  const ctx = await H.context(gh, { noCdn: true }); const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  await H.expand(p, 'Garden');
  await p.fill('#filter', 'needle'); await H.settle(p, 100);
  t.check('while searching, Collapse all is not available', await p.locator('#btn-collapse').isDisabled());
  await p.fill('#filter', ''); await H.settle(p, 100);
  t.check('cleared, it is available again, and the folders are as they were', !await p.locator('#btn-collapse').isDisabled() && JSON.stringify(await openFolders(p)) === JSON.stringify(['Garden']), JSON.stringify(await openFolders(p)));
  await ctx.close();
}
await H.stop();
t.finish();
