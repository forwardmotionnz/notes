/* N51: the open note is shown in Files. Opening a note (a tab, a link, the
   quick switcher, back and forward) opens the folders above it, marks its row
   and scrolls the list to it, without taking the keyboard focus and without
   closing any folder. On a phone the list is a drawer: opening it shows the
   note's row. */
import * as H from './harness.mjs';
const t = H.suite('reveal');
await H.start();

const FILES = { 'Garden/Deep/Seeds.md': '# Seeds\n\nkale\n', 'Plan.md': '# Plan\n', 'Other/Keep.md': '# Keep\n' };
for (let i = 0; i < 60; i++) FILES['Archive/n' + String(i).padStart(2, '0') + '.md'] = '# ' + i + '\n';
FILES['Zeta.md'] = '# Zeta\n';

async function setup(ctxOpts = {}) {
  const gh = H.fakeGitHub({ files: { ...FILES } });
  const ctx = await H.context(gh, { noCdn: true, ...ctxOpts });
  const p = await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  return { gh, ctx, p };
}
async function open(p, path) { await p.evaluate(path => openFile(path), path); await p.waitForFunction(path => current?.path === path && current.sha, path); await H.settle(p, 100); }
// The open note's row: marked, and wholly inside the list's visible part.
const shown = p => p.evaluate(() => {
  const tree = document.getElementById('tree'), rows = [...tree.querySelectorAll('.row.active')];
  if (rows.length !== 1) return { ok: false, why: rows.length + ' marked rows' };
  const r = rows[0].getBoundingClientRect(), b = tree.getBoundingClientRect();
  return { ok: r.height > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1, why: rows[0].textContent + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' in ' + Math.round(b.top) + '..' + Math.round(b.bottom) };
});
const openFolders = p => p.evaluate(() => [...document.querySelectorAll('#tree .row.dir[aria-expanded=true]')].map(r => r.textContent));

{
  const { ctx, p } = await setup();
  // A folder the person opened stays open; one they never opened stays closed.
  await H.expand(p, 'Archive');
  await open(p, 'Garden/Deep/Seeds.md');
  const folders = await openFolders(p);
  t.check('the folders above the open note are opened', folders.includes('Garden') && folders.includes('Deep'), JSON.stringify(folders));
  t.check('a folder already open stays open', folders.includes('Archive'), JSON.stringify(folders));
  t.check('other folders are left closed', !folders.includes('Other'), JSON.stringify(folders));
  let s = await shown(p);
  t.check("the note's row is marked and in view", s.ok, s.why);

  // Far down the list, below 60 notes in an open folder: the list scrolls to it.
  await open(p, 'Zeta.md');
  s = await shown(p);
  t.check('a note further down: the list scrolls to its row', s.ok, s.why);
  t.check('the list did scroll', await p.evaluate(() => document.getElementById('tree').scrollTop > 0));

  // Once shown, the list stays where the person scrolls it, whatever redraws it.
  await p.evaluate(() => { document.getElementById('tree').scrollTop = 0; renderTree(); });
  await H.settle(p, 100);
  t.check('a later redraw leaves the list where it was scrolled', await p.evaluate(() => document.getElementById('tree').scrollTop === 0));

  // Switching tabs, by clicking one.
  await p.locator('#note-tabs span button', { hasText: 'Seeds' }).first().click();
  await p.waitForFunction(() => current?.path === 'Garden/Deep/Seeds.md' && current.sha); await H.settle(p, 100);
  s = await shown(p);
  t.check('switching tabs: the tree goes back to that note', s.ok, s.why);
  t.check('the keyboard focus is not moved into Files', await p.evaluate(() => !document.getElementById('sidebar').contains(document.activeElement)));

  // Folding the note's own folder is the person's choice: it stays folded until another note is opened.
  await p.click('#tree .row.dir >> text=Deep');
  await H.settle(p, 100);
  t.check('folding the open note\'s folder is respected', !(await openFolders(p)).includes('Deep'));
  // Review: Discard reloads the same note; it is not opening one, so the folder stays folded.
  await H.setEditor(p, '# Seeds\n\nkale and more\n'); await H.settle(p, 100);
  await p.evaluate(() => discardDraft());
  await p.waitForFunction(() => current?.path === 'Garden/Deep/Seeds.md' && !dirty()); await H.settle(p, 200);
  t.check('Discard leaves the folded folder folded', !(await openFolders(p)).includes('Deep'), JSON.stringify(await openFolders(p)));
  await ctx.close();
}
{
  // A note opened by its address after a reload.
  const { ctx, p } = await setup();
  await open(p, 'Garden/Deep/Seeds.md');
  await p.reload(); await p.waitForFunction(() => current?.path === 'Garden/Deep/Seeds.md' && current.sha && treeState === 'ok'); await H.settle(p, 200);
  const s = await shown(p);
  t.check('after a reload the open note is shown in Files', s.ok, s.why);
  await ctx.close();
}
{
  // Files hidden with ☰ on a computer: shown again, it is at the open note.
  const { ctx, p } = await setup();
  await H.expand(p, 'Archive');
  await p.click('#btn-tree'); await H.still(p);
  await open(p, 'Zeta.md');
  await p.click('#btn-tree'); await H.still(p);
  const s = await shown(p);
  t.check('Files hidden while a note was opened: shown again, it is at that note', s.ok, s.why);
  // Review: once shown there, the next redraw leaves the list alone.
  await p.evaluate(() => { document.getElementById('tree').scrollTop = 0; });
  await H.expand(p, 'Other');
  t.check('and the next redraw leaves the list where it was scrolled', await p.evaluate(() => document.getElementById('tree').scrollTop === 0));
  await ctx.close();
}
{
  // A phone: the list is a drawer, closed while reading.
  const { ctx, p } = await setup({ viewport: { width: 390, height: 844 }, touch: true });
  await open(p, 'Zeta.md');
  await p.click('#btn-tree'); await H.still(p);
  const s = await shown(p);
  t.check('on a phone, opening Files shows the open note', s.ok, s.why);
  await ctx.close();
}
await H.stop();
t.finish();
