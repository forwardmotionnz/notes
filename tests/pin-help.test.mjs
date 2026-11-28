/* N54: the Pinned explanation ("Pinned notes say so in their properties…") is
   a one-time hint: shown until Got it, remembered in this browser, then kept
   as the Pinned heading's tooltip. A partial pin search still says so. */
import * as H from './harness.mjs';
const t = H.suite('pin-help');
await H.start();

async function setup(files, ctxOpts = {}) {
  const gh = H.fakeGitHub({ files });
  const ctx = await H.context(gh, { noCdn: true, ...ctxOpts });
  const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  return { gh, ctx, p };
}
const why = p => p.locator('#pin-help', { hasText: 'every device' });
const helpHeight = p => p.evaluate(() => document.getElementById('pin-help').getBoundingClientRect().height);
const headTitle = p => p.evaluate(() => document.querySelector('#pinned-files .side-head').title);

{
  const { gh, ctx, p } = await setup({ 'Plan.md': '# Plan\n' });
  t.check('first visit: the hint explains where pins are kept', await why(p).isVisible());
  const ok = p.getByRole('button', { name: 'Got it', exact: true });
  t.check('with a Got it button', await ok.isVisible());
  t.check('the Pinned heading carries the same explanation as a tooltip', /properties.*every device/.test(await headTitle(p)), await headTitle(p));
  await ok.click(); await H.settle(p, 100);
  t.check('Got it: the hint is gone and takes no room', !await why(p).isVisible() && await helpHeight(p) === 0, String(await helpHeight(p)));
  t.check('the tooltip stays', /every device/.test(await headTitle(p)));
  t.check('nothing is written to the repository', gh.commits.length === 0);
  await p.reload(); await p.waitForFunction(() => !accessPending && treeState === 'ok' && !pinScanning); await H.settle(p, 200);
  t.check('after a reload it stays gone', !await why(p).isVisible() && await helpHeight(p) === 0);
  // Review: another tab writing its own UI state (opening a folder) must not undo Got it.
  const b = await ctx.newPage(); await b.goto(H.APP()); await b.waitForFunction(() => treeState === 'ok' && !pinScanning);
  t.check('another tab learns of Got it at once', await b.evaluate(() => document.getElementById('pin-why').hidden));
  await b.evaluate(() => { ui.open = pathMap({ x: true }); persist(UI_KEY, ui); });
  await p.reload(); await p.waitForFunction(() => !accessPending && treeState === 'ok'); await H.settle(p, 200);
  t.check('another tab saving its folders does not bring the hint back', !await why(p).isVisible());
  // Review: from the keyboard, focus is not lost; and ⓘ brings the hint back (phones have no tooltip).
  const again = p.getByRole('button', { name: 'About pinned notes', exact: true });
  t.check('an ⓘ beside Pinned offers it again', await again.isVisible());
  await again.focus(); await p.keyboard.press('Enter'); await H.settle(p, 100);
  t.check('ⓘ shows the hint again, focus on Got it', await why(p).isVisible() && await p.evaluate(() => document.activeElement?.id === 'pin-why-ok'));
  await p.keyboard.press('Enter'); await H.settle(p, 100);
  t.check('Got it from the keyboard: the focus moves to ⓘ, not the page', !await why(p).isVisible() && await p.evaluate(() => document.activeElement?.id === 'pin-why-again'));
  await ctx.close();
}
{
  // Dismissed, then a large repository: the partial search is still said.
  const files = {};
  for (let i = 0; i < 520; i++) files[`n/${String(i).padStart(3, '0')}.md`] = `# ${i}\n`;
  const { ctx, p } = await setup(files);
  await p.getByRole('button', { name: 'Got it', exact: true }).click();
  await p.waitForFunction(() => /500 of 520/.test(document.getElementById('pin-help').textContent), null, { timeout: 30000 }).catch(() => {});
  const said = await p.textContent('#pin-help');
  t.check('dismissed: a partial pin search is still said', /500 of 520/.test(said) && await p.locator('#pin-help').isVisible(), said);
  t.check('without the explanation coming back', !/every device/.test(await p.evaluate(() => document.getElementById('pin-help').innerText)));
  await ctx.close();
}
{
  const { ctx, p } = await setup({ 'Plan.md': '# Plan\n' }, { viewport: { width: 390, height: 844 }, touch: true });
  await p.click('#btn-tree'); await H.still(p);
  const ok = p.getByRole('button', { name: 'Got it', exact: true });
  const box = await ok.boundingBox();
  t.check('on a phone, Got it is shown and big enough to tap', !!box && box.height >= 24, JSON.stringify(box));
  await ok.click(); await H.settle(p, 100);
  t.check('and works there', !await why(p).isVisible());
  const info = await p.getByRole('button', { name: 'About pinned notes', exact: true }).boundingBox();
  t.check('and ⓘ is there to bring it back', !!info && info.height >= 24, JSON.stringify(info));
  await ctx.close();
}
await H.stop();
t.finish();
