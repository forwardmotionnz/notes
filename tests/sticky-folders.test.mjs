/* N55: while Files is scrolled, the folders above the rows in view stay at
   the top of the list, one under another, so a deep note never looks
   orphaned. A folder lets go once its own rows have scrolled past. */
import * as H from './harness.mjs';
const t = H.suite('sticky-folders');
await H.start();

const FILES = { 'Top.md': '# Top\n' };
for (let i = 0; i < 40; i++) FILES['Projects/Client/c' + String(i).padStart(2, '0') + '.md'] = '# c\n';
for (let i = 0; i < 40; i++) FILES['Zoo/z' + String(i).padStart(2, '0') + '.md'] = '# z\n';

async function setup(ctxOpts = {}) {
  const gh = H.fakeGitHub({ files: { ...FILES } });
  const ctx = await H.context(gh, { noCdn: true, ...ctxOpts });
  const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  for (const f of ['Projects', 'Client', 'Zoo']) await H.expand(p, f);
  return { gh, ctx, p };
}
// Which folder rows sit at the top of the list's visible area, in order, and whether they cover what is under them.
const pinned = p => p.evaluate(() => {
  const tree = document.getElementById('tree'), b = tree.getBoundingClientRect();
  return [...tree.querySelectorAll('.row.dir')].filter(r => { const q = r.getBoundingClientRect(); return q.top >= b.top - 1 && q.top < b.top + 100 && q.height > 0; })
    .sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)
    .map(r => ({ name: r.textContent, top: Math.round(r.getBoundingClientRect().top - b.top), h: Math.round(r.getBoundingClientRect().height), onTop: document.elementFromPoint(r.getBoundingClientRect().left + 40, r.getBoundingClientRect().top + 10)?.closest('.row') === r }));
});
const scrollToRow = (p, name) => p.evaluate(name => {
  const tree = document.getElementById('tree'), row = [...tree.querySelectorAll('.row')].find(r => r.textContent === name);
  tree.scrollTop += row.getBoundingClientRect().top - tree.getBoundingClientRect().top;
}, name);

{
  const { ctx, p } = await setup();
  await scrollToRow(p, 'c30.md'); await H.settle(p, 100);
  let s = await pinned(p);
  t.check('deep in a folder: its folders stay at the top, outermost first', s.length === 2 && s[0].name === 'Projects' && s[1].name === 'Client' && s[0].top <= 1 && s[1].top >= s[0].top + s[0].h, JSON.stringify(s));
  t.check('they are drawn over the rows scrolling under them', s.length > 0 && s.every(r => r.onTop), JSON.stringify(s));
  t.check('with a solid background', await p.evaluate(() => { const r = [...document.querySelectorAll('#tree .row.dir')].find(r => r.textContent === 'Client'); return !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(r).backgroundColor); }));

  await scrollToRow(p, 'z20.md'); await H.settle(p, 100);
  s = await pinned(p);
  t.check('scrolled into the next folder: the earlier ones let go', s.length === 1 && s[0].name === 'Zoo', JSON.stringify(s));

  // A pinned folder still folds when clicked.
  await p.evaluate(() => [...document.querySelectorAll('#tree .row.dir')].find(r => r.textContent === 'Zoo').click()); await H.settle(p, 100);
  t.check('a folder held at the top still folds when clicked', await p.evaluate(() => [...document.querySelectorAll('#tree .row.dir')].find(r => r.textContent === 'Zoo').getAttribute('aria-expanded') === 'false'));
  await ctx.close();
}
{
  const { ctx, p } = await setup({ viewport: { width: 390, height: 844 }, touch: true });
  await p.click('#btn-tree'); await H.still(p);
  await scrollToRow(p, 'c30.md'); await H.settle(p, 100);
  const s = await pinned(p);
  t.check('on a phone too, one under another without overlapping', s.length === 2 && s[0].name === 'Projects' && s[1].name === 'Client' && s.every(r => r.onTop) && s[1].top >= s[0].top + s[0].h, JSON.stringify(s));
  await ctx.close();
}
{
  // N51 with N55: a note whose row sits under the folders held at the top is not "in view".
  const { ctx, p } = await setup();
  await p.evaluate(() => openFile('Projects/Client/c30.md')); await p.waitForFunction(() => current?.path === 'Projects/Client/c30.md' && current.sha);
  await p.evaluate(() => openFile('Top.md')); await p.waitForFunction(() => current?.path === 'Top.md' && current.sha);
  await scrollToRow(p, 'c30.md'); await H.settle(p, 100);   // c30's row is now under Projects and Client
  await p.evaluate(() => openFile('Projects/Client/c30.md')); await p.waitForFunction(() => current?.path === 'Projects/Client/c30.md' && current.sha); await H.settle(p, 100);
  const seen = await p.evaluate(() => { const r = document.querySelector('#tree .row.active'), q = r.getBoundingClientRect(); return document.elementFromPoint(q.left + 40, q.top + q.height / 2)?.closest('.row') === r; });
  t.check('opening a note whose row is under the held folders scrolls it out from under them', seen);
  await ctx.close();
}
{
  // Review: deep folders on a short list. Only what fits in half the list is held, so the open note is reachable.
  const files = {};
  for (let i = 0; i < 40; i++) files['A/B/C/D/E/F/G/H/n' + String(i).padStart(2, '0') + '.md'] = '# n\n';
  for (const [w, h, touch] of [[1280, 520, false], [844, 390, true], [390, 600, true], [1280, 800, false]]) {
    const gh = H.fakeGitHub({ files });
    const ctx = await H.context(gh, { noCdn: true, viewport: { width: w, height: h }, ...(touch ? { touch } : {}) });
    const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
    await p.waitForFunction(() => !accessPending && treeState === 'ok');
    if (w <= 820) { await p.click('#btn-tree'); await H.still(p); }
    await p.evaluate(() => openFile('A/B/C/D/E/F/G/H/n35.md')); await p.waitForFunction(() => current?.sha); await H.settle(p, 200);
    const r = await p.evaluate(() => { const tree = document.getElementById('tree'), row = tree.querySelector('.row.active'), q = row.getBoundingClientRect();
      const held = [...tree.querySelectorAll('.row.dir')].filter(d => getComputedStyle(d).position === 'sticky').length;
      const b = tree.getBoundingClientRect(), cover = [...tree.querySelectorAll('.row.dir')].filter(d => getComputedStyle(d).position === 'sticky' && d.parentElement.contains(row)).reduce((n, d) => n + d.offsetHeight, 0);
      return { seen: q.top - b.top >= cover - 1 && q.bottom <= b.bottom + 1, top: Math.round(q.top - b.top), cover, held, list: tree.clientHeight }; });
    t.check(`${w}×${h}: eight folders deep, the open note is visible and not under the held folders`, r.seen, JSON.stringify(r));
    t.check(`${w}×${h}: at most half the list is held`, r.held >= 1 && r.held * (w <= 820 ? 38 : 30) <= Math.max(r.list / 2, w <= 820 ? 38 : 30), JSON.stringify(r));
    await ctx.close();
  }
}
{
  // Review: dragging a note over a held folder still fills it with the drop colour; large text is not cut off.
  const { ctx, p } = await setup();
  const fill = await p.evaluate(() => { const r = [...document.querySelectorAll('#tree .row.dir')].find(r => r.textContent === 'Client'); r.classList.add('drop'); const c = getComputedStyle(r).backgroundColor; r.classList.remove('drop');
    const probe = document.createElement('span'); probe.style.background = 'var(--accent-soft)'; document.body.append(probe); const want = getComputedStyle(probe).backgroundColor; probe.remove(); return c === want; });
  t.check('a folder being dropped onto shows the drop colour', fill);
  await p.addStyleTag({ content: '#tree .row{font-size:30px !important}' }); await p.evaluate(() => renderTree()); await scrollToRow(p, 'c30.md'); await H.settle(p, 100);
  const s = await pinned(p);
  const fits = await p.evaluate(() => { const r = [...document.querySelectorAll('#tree .row.dir')].find(r => r.textContent === 'Client'); return r.scrollHeight <= r.clientHeight + 1; });
  t.check('large text: folder names are not cut off, and held folders do not overlap', fits && s.length >= 1 && s.every((r, i) => i === 0 || r.top >= s[i - 1].top + s[i - 1].h), JSON.stringify(s));
  await ctx.close();
}
await H.stop();
t.finish();
