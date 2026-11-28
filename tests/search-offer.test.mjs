/* N53: no Search contents button under the find box. Typing lists matching
   file names as before, and the last line of that list offers
   Search contents for "…"; Enter still searches. The search's status takes
   no room until there is something to say. */
import * as H from './harness.mjs';
const t = H.suite('search-offer');
await H.start();

const FILES = { 'alpha.md': 'a hidden needle inside', 'needle.md': 'path match', 'Garden/no.md': 'nothing' };
async function setup(ctxOpts = {}) {
  const gh = H.fakeGitHub({ files: { ...FILES } });
  const ctx = await H.context(gh, { noCdn: true, ...ctxOpts });
  const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok' && !pinScanning);
  return { gh, ctx, p };
}
const offer = p => p.locator('#tree #btn-search');
const lastLine = p => p.evaluate(() => document.querySelector('#tree')?.lastElementChild?.textContent || '');
const toolsHeight = p => p.evaluate(() => document.getElementById('search-tools').getBoundingClientRect().height);

{
  const { gh, ctx, p } = await setup();
  t.check('no Search contents button under the find box', await p.locator('#sidebar-tools #btn-search, #search-tools button').count() === 0);
  t.check('and its line takes no room while there is nothing to say', await toolsHeight(p) === 0, String(await toolsHeight(p)));
  t.check('with the find box empty, nothing is offered', await offer(p).count() === 0);

  await p.fill('#filter', 'needle'); await H.settle(p, 100);
  const rows = await H.rows(p);
  t.check('typing still lists matching file names at once', rows.includes('needle.md') && !rows.includes('alpha.md'), JSON.stringify(rows));
  t.check('the last line offers Search contents for what was typed', /^Search contents for “needle”$/.test(await lastLine(p)), await lastLine(p));
  t.check('it is a button (reachable from the keyboard)', await offer(p).evaluate(b => b.tagName === 'BUTTON' && b.tabIndex >= 0));

  t.check('it looks like an action, in the accent colour', await offer(p).evaluate(b => { const st = getComputedStyle(b), probe = document.createElement('span'); probe.style.color = 'var(--accent)'; document.body.append(probe); const accent = getComputedStyle(probe).color; probe.remove(); return st.color === accent && st.paddingTop === '3px'; }));
  // Review: from the keyboard, the focus stays on it when the results replace the list.
  await offer(p).focus(); await p.keyboard.press('Enter'); await p.waitForFunction(() => !searchRunning); await H.settle(p, 100);
  t.check('from the keyboard, the focus stays on the offer when results arrive', await p.evaluate(() => document.activeElement?.id === 'btn-search'));
  await p.fill('#filter', 'needl'); await p.fill('#filter', 'needle'); await H.settle(p, 100);
  await offer(p).click(); await p.waitForFunction(() => !searchRunning);
  const found = await H.rows(p);
  t.check('choosing it searches note contents', found.includes('alpha.md') && found.includes('needle.md'), JSON.stringify(found));
  t.check('the result count shows', /2 matches/.test(await p.textContent('#search-status')) && await toolsHeight(p) > 0);
  t.check('it stays offered after the results, to search again after edits', /Search contents for “needle”/.test(await lastLine(p)));
  t.check('searching writes nothing', gh.commits.length === 0);

  // Nothing in a file name: say so, rather than "No notes here yet".
  await p.fill('#filter', 'inside'); await H.settle(p, 100);
  const said = await p.textContent('#tree');
  t.check('no file name matches: it says so, and still offers the search', /No file names match/.test(said) && !/No notes here yet/.test(said) && /Search contents for “inside”/.test(await lastLine(p)), said);
  await p.press('#filter', 'Enter'); await p.waitForFunction(() => !searchRunning);
  t.check('Enter in the find box still searches contents', (await H.rows(p)).includes('alpha.md'));

  // Review: while the file list is loading or failed, the search cannot run, so it is not offered.
  await p.fill('#filter', 'needle'); await H.settle(p, 100);
  await p.evaluate(() => { treeState = 'loading'; renderTree(); });
  t.check('while the file list is loading, it is not offered', await offer(p).count() === 0);
  await p.evaluate(() => { treeState = 'ok'; renderTree(); });
  await p.fill('#filter', ''); await H.settle(p, 100);
  t.check('cleared: the folders are back, nothing offered, the status gone', (await H.rows(p)).includes('Garden') && await offer(p).count() === 0 && await toolsHeight(p) === 0);
  await ctx.close();
}
{
  const { ctx, p } = await setup({ viewport: { width: 390, height: 844 }, touch: true });
  await p.click('#btn-tree'); await H.still(p);
  await p.fill('#filter', 'a long search term that goes on'); await H.settle(p, 100);
  const fits = await offer(p).evaluate(b => { const r = b.getBoundingClientRect(), s = document.getElementById('sidebar').getBoundingClientRect(); return r.height >= 30 && r.left >= s.left && r.right <= s.right + 0.5; });
  t.check('on a phone the offer fits the Files sheet', fits);
  await ctx.close();
}
await H.stop();
t.finish();
