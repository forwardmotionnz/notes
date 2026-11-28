/* Short windows: the Files list stays on screen. On a short window (a phone
   turned sideways uses the computer layout at 844 px wide) the sections above
   Files (find box, Pinned and its hint, Recent, Recently deleted, Tags) pushed
   the list below the bottom of the screen, so no note could be reached. */
import * as H from './harness.mjs';
const t = H.suite('short-window');
await H.start();

const FILES = { 'Plans.md': '---\npinned: true\n---\n# Plans\n\n- [ ] one\n' };
for (let i = 0; i < 30; i++) FILES['n' + String(i).padStart(2, '0') + '.md'] = '# n\n';

async function setup(w, h) {
  const gh = H.fakeGitHub({ files: { ...FILES } });
  const ctx = await H.context(gh, { noCdn: true, viewport: { width: w, height: h }, touch: true });
  const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  if (w <= 820) { await p.click('#btn-tree'); await H.still(p); }
  return { ctx, p };
}
// The file rows the person can actually see and touch: inside the window and inside the list, not covered by anything.
const visibleRows = p => p.evaluate(() => {
  const tree = document.getElementById('tree'), b = tree.getBoundingClientRect();
  return [...tree.querySelectorAll('.row:not(.dir)')].filter(r => {
    const q = r.getBoundingClientRect(), y = q.top + q.height / 2, x = q.left + Math.min(40, q.width / 2);
    return q.height > 0 && q.top >= Math.max(0, b.top) - 1 && q.bottom <= Math.min(innerHeight, b.bottom) + 1 && document.elementFromPoint(x, y)?.closest('.row') === r;
  }).map(r => r.textContent);
});
const layout = p => p.evaluate(() => {
  const s = document.getElementById('sidebar'), tr = document.getElementById('tree'), r = tr.getBoundingClientRect();
  return { treeTop: Math.round(r.top), treeBottom: Math.round(r.bottom), innerHeight, sideScroll: s.scrollHeight - s.clientHeight };
});

for (const [w, h] of [[844, 390], [390, 600]]) {
  const where = `${w}×${h}${w <= 820 ? ' (phone drawer)' : ' (computer layout)'}`;
  const { ctx, p } = await setup(w, h);
  let rows = await visibleRows(p);
  t.check(`${where}: at least three file rows are on screen`, rows.length >= 3, JSON.stringify({ rows, ...(await layout(p)) }));

  // A real tap on the first visible row opens it.
  if (rows.length) {
    const name = rows[0];
    const at = await p.evaluate(name => { const r = [...document.querySelectorAll('#tree .row')].find(r => r.textContent === name).getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 }; }, name);
    await p.mouse.click(at.x, at.y);
    const opened = await p.waitForFunction(n => current?.path === n && current.sha, name).then(() => true, () => false);
    t.check(`${where}: tapping a row on screen opens that note`, opened, name);
    if (w <= 820) { await p.click('#btn-tree'); await H.still(p); }
  } else t.check(`${where}: tapping a row on screen opens that note`, false, 'no row on screen');

  // With every section above open (Recent, Recently deleted, Tags), the list still keeps its rows on screen.
  await p.evaluate(() => { for (const id of ['recent-notes', 'deleted-notes', 'tags-panel']) document.getElementById(id).open = true; });
  await H.settle(p, 300);
  rows = await visibleRows(p);
  t.check(`${where}: with Recent, Recently deleted and Tags open, rows are still on screen`, rows.length >= 3, JSON.stringify({ rows, ...(await layout(p)) }));

  // The sections above Files are not lost: each heading can be scrolled to and touched.
  const reach = await p.evaluate(() => ['#pinned-files .side-head', '#pin-tabs button', '#recent-notes summary', '#deleted-notes summary', '#tags-panel summary'].map(sel => {
    const el = document.querySelector(sel); el.scrollIntoView({ block: 'nearest' }); const q = el.getBoundingClientRect();
    return { sel, ok: q.top >= -1 && q.bottom <= innerHeight + 1 && el.contains(document.elementFromPoint(q.left + 10, q.top + q.height / 2)) };
  }));
  t.check(`${where}: Pinned, Recent, Recently deleted and Tags can each be scrolled to and touched`, reach.every(r => r.ok), JSON.stringify(reach));
  await ctx.close();
}
{
  // A tall window is unchanged: everything above Files shows in full, nothing scrolls, and the list fills the rest.
  const { ctx, p } = await setup(1280, 800);
  const r = await p.evaluate(() => {
    const s = document.getElementById('sidebar'), tr = document.getElementById('tree'), repo = document.getElementById('side-repo');
    const scrollers = [...s.querySelectorAll('*')].filter(e => e !== tr && !tr.contains(e) && e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => e.id || e.className);
    return { scrollers, sideScroll: s.scrollHeight - s.clientHeight, gap: Math.round(repo.getBoundingClientRect().top - tr.getBoundingClientRect().bottom) };
  });
  t.check('1280×800: nothing above Files scrolls, and the list reaches down to the repository line', r.scrollers.length === 0 && r.sideScroll <= 0 && Math.abs(r.gap) <= 2, JSON.stringify(r));
  await ctx.close();
}
await H.stop();
t.finish();
