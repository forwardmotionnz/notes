/* The notes app itself: tree, editor, saving, conflicts, pinned tasks, layout. */
import * as H from './harness.mjs';

const t = H.suite('app');
await H.start();

const FILES = () => ({
  'todo.md': '# Today\n\n- [ ] ring the panelbeater\n- [x] swap the spare\n',
  'inbox.md': '# Inbox\n\nloose thoughts\n',
  'work/notes/standup.md': '# Standup\n\n- shipped the thing\n',
  'work/plan.md': '# Plan\n',
  'unicode.md': '# Bom dia ção — emoji 🚀 café\n',
});

async function ready(opts = {}) {
  const gh = H.fakeGitHub({ files: FILES(), ...opts.gh });
  const ctx = await H.context(gh, opts.ctx || {});
  const p = await H.page(ctx);
  await H.signIn(p);
  if (opts.pins) await setPins(p, opts.pins);
  return { gh, ctx, p };
}

async function setPins(p, pins) {
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.fill('#f-pins', pins);
  await p.click('#f-save');
  await p.waitForTimeout(450);
}

/* ===== tree ===== */
{
  const { ctx, p } = await ready();
  const r = await H.rows(p);
  t.check('top level shows folders then files',
    r[0] === 'work' && r.includes('inbox.md') && r.includes('todo.md'), JSON.stringify(r));
  t.check('nested files hidden while folder collapsed', !r.includes('standup.md'));
  await H.expand(p, 'work');
  const r2 = await H.rows(p);
  t.check('expanding reveals children', r2.includes('notes') && r2.includes('plan.md'), JSON.stringify(r2));
  await p.fill('#filter', 'standup');
  await p.waitForTimeout(80);
  const r3 = await H.rows(p);
  t.check('filter finds nested file by path', r3.length === 1 && r3[0] === 'work/notes/standup.md',
    JSON.stringify(r3));
  await p.fill('#filter', '');
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== open, edit, save ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  t.check('content loads', (await H.editorValue(p)) === gh.files['inbox.md']);
  t.check('save disabled when clean', await p.isDisabled('#btn-save'));
  const cleanBg = await p.evaluate(() => getComputedStyle(document.getElementById('btn-save')).backgroundColor);

  await H.setEditor(p, '# Inbox\n\nedited\n');
  await p.waitForTimeout(60);
  t.check('save enables when dirty', await p.isEnabled('#btn-save'));
  const dirtyBg = await p.evaluate(() => getComputedStyle(document.getElementById('btn-save')).backgroundColor);
  t.check('armed Save looks different from disabled', cleanBg !== dirtyBg);

  await p.click('#btn-save');
  await p.waitForTimeout(300);
  t.check('commit reached the repo', gh.files['inbox.md'] === '# Inbox\n\nedited\n');
  t.check('commit message names the file', gh.commits.at(-1).message === 'Update inbox.md');
  t.check('commit on the repo default branch', gh.commits.at(-1).branch === 'main');

  await H.setEditor(p, '# Inbox\n\nsecond\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(300);
  t.check('consecutive saves track the new sha', gh.files['inbox.md'] === '# Inbox\n\nsecond\n' &&
    !(await H.status(p)).includes('Conflict'));

  await p.keyboard.press('Control+s');   // nothing dirty: must be a no-op
  await p.waitForTimeout(150);
  t.check('Ctrl+S on a clean file makes no commit', gh.commits.length === 2);
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== unicode ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'unicode.md');
  const loaded = await H.editorValue(p);
  t.check('utf-8 decodes', loaded === gh.files['unicode.md'], JSON.stringify(loaded));
  const v = loaded + 'acentuação – 🍴\n';
  await H.setEditor(p, v);
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(300);
  t.check('utf-8 survives save', gh.files['unicode.md'] === v);
  await ctx.close();
}

/* ===== conflict ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\nchanged on github\n';
  await H.setEditor(p, '# Inbox\n\nmine\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(350);
  t.check('stale write rejected, user told', (await H.status(p)).toLowerCase().includes('conflict'));
  t.check('remote not clobbered', gh.files['inbox.md'] === '# Inbox\n\nchanged on github\n');
  t.check('local text kept', (await H.editorValue(p)) === '# Inbox\n\nmine\n');
  t.check('save re-enabled', await p.isEnabled('#btn-save'));
  await ctx.close();
}

/* ===== new file ===== */
{
  const { gh, ctx, p } = await ready();
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('projects/holflo/ideas') : d.accept());
  await p.click('#btn-new');
  await p.waitForTimeout(150);
  t.check('extension appended', (await p.textContent('#crumb .name')) === 'ideas.md');
  t.check('flagged as new', (await p.textContent('#crumb .tag')) === '(new)');
  await H.setEditor(p, '# Ideas\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(450);
  t.check('nested file created', gh.files['projects/holflo/ideas.md'] === '# Ideas\n');
  t.check('create commit worded as create', gh.commits.at(-1).message === 'Create projects/holflo/ideas.md');
  t.check('tree refreshed', (await H.rows(p)).includes('projects'));
  await ctx.close();
}

/* ===== pinned tasks ===== */
{
  const { gh, ctx, p } = await ready({ pins: 'todo.md, inbox.md' });
  const tabs = await p.$$eval('#pin-tabs button', e => e.map(b => b.textContent));
  t.check('a tab per pinned file', JSON.stringify(tabs) === '["todo.md","inbox.md"]', JSON.stringify(tabs));
  const tasks = await p.$$eval('#pin-list .task span', e => e.map(s => s.textContent));
  t.check('checkbox per task', JSON.stringify(tasks) === '["ring the panelbeater","swap the spare"]');
  await p.locator('#pin-list .task input').nth(0).click();
  await p.waitForTimeout(350);
  t.check('ticking rewrites only that line',
    gh.files['todo.md'] === '# Today\n\n- [x] ring the panelbeater\n- [x] swap the spare\n');
  await p.fill('#pin-input', 'book the wof');
  await p.press('#pin-input', 'Enter');
  await p.waitForTimeout(350);
  t.check('quick capture appends', gh.files['todo.md'].endsWith('- [ ] book the wof\n'));
  t.check('capture input cleared', (await p.inputValue('#pin-input')) === '');
  await ctx.close();
}

/* ===== rapid toggles ===== */
{
  const { gh, ctx, p } = await ready({ gh: { files: { 'todo.md': '- [ ] one\n- [ ] two\n- [ ] three\n' } } });
  for (let i = 0; i < 3; i++) await p.locator('#pin-list .task input').nth(i).click();
  await p.waitForTimeout(900);
  const n = (gh.files['todo.md'].match(/\[x\]/g) || []).length;
  t.check('rapid toggles all land', n === 3, `${n}/3`);
  await ctx.close();
}

/* ===== pinned file that does not exist yet ===== */
{
  const { gh, ctx, p } = await ready({ pins: 'scratch.md' });
  t.check('missing pin invites a first task',
    (await p.textContent('#pin-list')).toLowerCase().includes('nothing in'));
  await p.fill('#pin-input', 'first');
  await p.click('#pin-go');
  await p.waitForTimeout(400);
  t.check('capture creates the file', gh.files['scratch.md'] === '- [ ] first\n');
  await ctx.close();
}

/* ===== reload restores last file ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(600);
  t.check('reload reopens the last file', (await H.editorValue(p)) === gh.files['inbox.md']);
  await ctx.close();
}

/* ===== no CDN ===== */
{
  const { gh, ctx, p } = await ready({ ctx: { noCdn: true } });
  await H.clickRow(p, 'inbox.md');
  t.check('fallback textarea used', (await p.$$('.fallback-editor')).length === 1);
  t.check('plain badge shown', await p.evaluate(
    () => getComputedStyle(document.getElementById('degraded')).display !== 'none'));
  await H.setEditor(p, '# Inbox\n\nno cdn\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(350);
  t.check('save works without the CDN', gh.files['inbox.md'] === '# Inbox\n\nno cdn\n');
  await ctx.close();
}

/* ===== phone ===== */
{
  const { ctx, p } = await ready({ ctx: { viewport: { width: 390, height: 780 } } });
  t.check('tree off-canvas on a phone', await p.evaluate(
    () => document.getElementById('sidebar').getBoundingClientRect().right <= 1));
  await p.click('#btn-tree');
  await p.waitForTimeout(260);
  await H.clickRow(p, 'inbox.md');
  t.check('picking a file closes the tree', await p.evaluate(() => !document.body.classList.contains('tree-open')));
  const crumb = await p.evaluate(() => {
    const n = document.querySelector('#crumb .name');
    return { text: n.textContent, cut: n.scrollWidth > n.clientWidth + 1 };
  });
  t.check('filename stays legible', crumb.text === 'inbox.md' && !crumb.cut);
  await p.click('#btn-pins');
  await p.waitForTimeout(260);
  t.check('pins open as a bottom sheet with capture focused', await p.evaluate(
    () => document.getElementById('pins').getBoundingClientRect().top < innerHeight - 10 &&
          document.activeElement.id === 'pin-input'));
  t.check('no horizontal overflow', await p.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth + 1));
  await ctx.close();
}

await H.stop();
t.finish();
