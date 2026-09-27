/* N18: the file sidebar can be resized and collapsed on a computer, and the
   choice is remembered; phones keep the slide-over drawer. */
import * as H from './harness.mjs';

const t = H.suite('sidebar');
await H.start();

const FILES = { 'inbox.md': '# Inbox\n', 'work/plan.md': '# Plan\n' };
async function ready(width = 1280) {
  const gh = H.fakeGitHub({ files: FILES });
  const ctx = await H.context(gh, { viewport: { width, height: 800 } });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  return { gh, ctx, p };
}
const sideWidth = p => p.evaluate(() => Math.round(document.getElementById('sidebar').getBoundingClientRect().width));
const sideShown = p => p.evaluate(() => getComputedStyle(document.getElementById('sidebar')).display !== 'none' &&
  document.getElementById('sidebar').getBoundingClientRect().width > 0);
const paneLeft = p => p.evaluate(() => Math.round(document.getElementById('editor-pane').getBoundingClientRect().left));
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
async function drag(p, dx) {
  const box = await p.locator('#sidebar-resize').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.mouse.move(x, y); await p.mouse.down();
  await p.mouse.move(x + dx / 2, y); await p.mouse.move(x + dx, y);
  await p.mouse.up();
  await H.settle(p, 200);
}

/* ===== collapse and bring back ===== */
{
  const { ctx, p } = await ready();
  t.check('computer: the Files button is there', await p.isVisible('#btn-tree'));
  t.check('computer: it says the list is shown', (await p.getAttribute('#btn-tree', 'aria-expanded')) === 'true');
  const refreshes = await p.evaluate(() => window.cmRefreshes || 0);
  await p.click('#btn-tree');
  await H.settle(p, 200);
  t.check('collapse: the file list goes', !(await sideShown(p)));
  t.check('collapse: the note takes the width', (await paneLeft(p)) <= 1, String(await paneLeft(p)));
  t.check('collapse: the button says so', (await p.getAttribute('#btn-tree', 'aria-expanded')) === 'false');
  t.check('collapse: the editor lays itself out again', (await p.evaluate(() => window.cmRefreshes || 0)) > refreshes);
  await p.reload();
  await H.settle(p, 1500);
  t.check('collapse: remembered after a reload', !(await sideShown(p)));
  await p.click('#btn-tree');
  await H.settle(p, 200);
  t.check('bring back: the list is shown again', await sideShown(p) && (await sideWidth(p)) === 260, String(await sideWidth(p)));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== resize ===== */
{
  const { ctx, p } = await ready();
  t.check('resize: a handle, named for what it does', (await p.getAttribute('#sidebar-resize', 'role')) === 'separator' &&
    /resize/i.test(await p.getAttribute('#sidebar-resize', 'aria-label')));
  const refreshes = await p.evaluate(() => window.cmRefreshes || 0);
  await drag(p, 140);
  t.check('resize: dragging widens it', Math.abs((await sideWidth(p)) - 400) <= 2, String(await sideWidth(p)));
  t.check('resize: the note follows', Math.abs((await paneLeft(p)) - 400) <= 4, String(await paneLeft(p)));
  t.check('resize: the editor lays itself out again', (await p.evaluate(() => window.cmRefreshes || 0)) > refreshes);
  t.check('resize: the handle reports its value', (await p.getAttribute('#sidebar-resize', 'aria-valuenow')) === String(await sideWidth(p)));
  await p.reload();
  await H.settle(p, 1500);
  t.check('resize: remembered after a reload', Math.abs((await sideWidth(p)) - 400) <= 2, String(await sideWidth(p)));
  await drag(p, -1000);
  t.check('resize: never narrower than 180', (await sideWidth(p)) === 180, String(await sideWidth(p)));
  await drag(p, 2000);
  const max = await sideWidth(p);
  t.check('resize: never so wide the note has no room', max <= 1280 * 0.6 && max >= 400, String(max));
  // From the keyboard too.
  await p.focus('#sidebar-resize');
  await p.keyboard.press('Home');
  const home = await sideWidth(p);
  await p.keyboard.press('ArrowRight');
  t.check('keyboard: Home is the narrowest, an arrow widens it', home === 180 && (await sideWidth(p)) > home, `${home} -> ${await sideWidth(p)}`);
  await p.keyboard.press('ArrowLeft');
  t.check('keyboard: and narrows it', (await sideWidth(p)) === home);
  // A double-click puts it back as it was.
  await p.locator('#sidebar-resize').dblclick();
  await H.settle(p, 200);
  t.check('double-click: back to the usual width', (await sideWidth(p)) === 260, String(await sideWidth(p)));
  t.check('no overflow', !(await overflow(p)));
  await ctx.close();
}

/* ===== a window made narrower keeps room for the note ===== */
{
  const { ctx, p } = await ready();
  await drag(p, 400);
  await p.setViewportSize({ width: 900, height: 800 });
  await H.settle(p, 300);
  t.check('narrower window: the note keeps room', (await sideWidth(p)) <= 900 * 0.6, String(await sideWidth(p)));
  t.check('narrower window: no overflow', !(await overflow(p)));
  await ctx.close();
}

/* ===== phones keep the drawer ===== */
{
  const { ctx, p } = await ready(390);
  t.check('phone: no resize handle', !(await p.isVisible('#sidebar-resize')));
  // Collapsed on a computer earlier: a phone still opens the drawer.
  await p.evaluate(() => { ui.sideHidden = true; ui.sideWidth = 500; persist(UI_KEY, ui); });
  await p.reload();
  await H.settle(p, 1500);
  await p.click('#btn-tree');
  await H.settle(p, 400);
  await H.still(p);
  t.check('phone: Files opens the drawer as before', await p.evaluate(() => document.body.classList.contains('tree-open')) && await sideShown(p));
  t.check('phone: the drawer keeps its own width', (await sideWidth(p)) <= 300, String(await sideWidth(p)));
  t.check('phone: no overflow', !(await overflow(p)));
  await ctx.close();
}

await H.stop();
t.finish();
