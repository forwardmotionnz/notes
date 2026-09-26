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
  await H.settle(p, 450);
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
  await H.settle(p, 80);
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
  await H.settle(p, 60);
  t.check('save enables when dirty', await p.isEnabled('#btn-save'));
  const dirtyBg = await p.evaluate(() => getComputedStyle(document.getElementById('btn-save')).backgroundColor);
  t.check('armed Save looks different from disabled', cleanBg !== dirtyBg);

  await p.click('#btn-save');
  await H.settle(p, 300);
  t.check('commit reached the repo', gh.files['inbox.md'] === '# Inbox\n\nedited\n');
  t.check('commit message names the file', gh.commits.at(-1).message === 'Update inbox.md');
  t.check('commit on the repo default branch', gh.commits.at(-1).branch === 'main');

  await H.setEditor(p, '# Inbox\n\nsecond\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 300);
  t.check('consecutive saves track the new sha', gh.files['inbox.md'] === '# Inbox\n\nsecond\n' &&
    !(await H.status(p)).includes('Conflict'));

  await p.keyboard.press('Control+s');   // nothing dirty: must be a no-op
  await H.settle(p, 150);
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
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 300);
  t.check('utf-8 survives save', gh.files['unicode.md'] === v);
  await ctx.close();
}

/* ===== conflict ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\nchanged on github\n';
  await H.setEditor(p, '# Inbox\n\nmine\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 350);
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
  await H.settle(p, 150);
  t.check('extension appended', (await p.textContent('#crumb .name')) === 'ideas.md');
  t.check('flagged as new', (await p.textContent('#crumb .tag')) === '(new)');
  await H.setEditor(p, '# Ideas\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 450);
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
  await H.settle(p, 350);
  t.check('ticking rewrites only that line',
    gh.files['todo.md'] === '# Today\n\n- [x] ring the panelbeater\n- [x] swap the spare\n');
  await p.fill('#pin-input', 'book the wof');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 350);
  t.check('quick capture appends', gh.files['todo.md'].endsWith('- [ ] book the wof\n'));
  t.check('capture input cleared', (await p.inputValue('#pin-input')) === '');
  await ctx.close();
}

/* ===== rapid toggles ===== */
{
  const { gh, ctx, p } = await ready({ gh: { files: { 'todo.md': '- [ ] one\n- [ ] two\n- [ ] three\n' } } });
  for (let i = 0; i < 3; i++) await p.locator('#pin-list .task input').nth(i).click();
  await H.settle(p, 900);
  const n = (gh.files['todo.md'].match(/\[x\]/g) || []).length;
  t.check('rapid toggles all land', n === 3, `${n}/3`);
  await ctx.close();
}

/* ===== quick clicks while GitHub is slow (N8) ===== */
// Real GitHub takes a moment to commit. A click in that moment used to name
// the version before the last one, GitHub refused it (409), and the click
// was lost behind a "Conflict" message. Every PUT here is held for `ms`.
async function slowPuts(ctx, p, ms, answer) {
  const seen = [];
  p.on('response', r => { if (r.request().method() === 'PUT') seen.push(r.status()); });
  let n = 0;
  await ctx.route('https://api.github.com/repos/**/contents/**', async r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    const i = n++;
    await new Promise(res => setTimeout(res, ms));
    if (answer && answer(i)) return answer(i)(r);
    return r.fallback();
  });
  return seen;
}
const THREE = () => ({ gh: { files: { 'todo.md': '- [ ] one\n- [ ] two\n- [ ] three\n' } } });
const boxes = p => p.$$eval('#pin-list .task input', e => e.map(b => b.checked));
{
  const { gh, ctx, p } = await ready(THREE());
  const seen = await slowPuts(ctx, p, 400);
  const before = gh.commits.length;
  for (let i = 0; i < 3; i++) await p.locator('#pin-list .task input').nth(i).click();
  await H.settle(p, 4000);
  t.check('slow GitHub: three quick ticks all land',
    gh.files['todo.md'] === '- [x] one\n- [x] two\n- [x] three\n', JSON.stringify(gh.files['todo.md']));
  t.check('slow GitHub: nothing refused', seen.length > 0 && seen.every(s => s === 200), JSON.stringify(seen));
  t.check('slow GitHub: no error shown', !(await p.getAttribute('#status', 'class') || '').includes('err'),
    await p.textContent('#status'));
  t.check('slow GitHub: the list shows all three ticked', JSON.stringify(await boxes(p)) === '[true,true,true]');
  t.check('slow GitHub: clicks while one commit is on its way share the next',
    gh.commits.length - before === 2, `${gh.commits.length - before} commits`);
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready(THREE());
  const seen = await slowPuts(ctx, p, 400);
  const box = p.locator('#pin-list .task input').nth(1);
  await box.click();
  await box.click();
  await H.settle(p, 4000);
  t.check('slow GitHub: tick then untick ends as it began',
    gh.files['todo.md'] === '- [ ] one\n- [ ] two\n- [ ] three\n', JSON.stringify(gh.files['todo.md']));
  t.check('slow GitHub: untick not refused', seen.every(s => s === 200), JSON.stringify(seen));
  t.check('slow GitHub: the list shows the last click', JSON.stringify(await boxes(p)) === '[false,false,false]');
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready(THREE());
  const seen = await slowPuts(ctx, p, 400);
  await p.locator('#pin-list .task input').nth(0).click();
  await p.fill('#pin-input', 'four');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 4000);
  t.check('slow GitHub: a tick and a quick capture both land',
    gh.files['todo.md'] === '- [x] one\n- [ ] two\n- [ ] three\n- [ ] four\n', JSON.stringify(gh.files['todo.md']));
  t.check('slow GitHub: capture not refused', seen.every(s => s === 200), JSON.stringify(seen));
  await ctx.close();
}
{
  // The first commit fails: what was waiting behind it is not sent on a
  // guess, the list goes back to what GitHub has, and the error is shown.
  const { gh, ctx, p } = await ready(THREE());
  const seen = await slowPuts(ctx, p, 400, i => i === 0 && (r => r.fulfill({ status: 502,
    contentType: 'application/json', body: '{"message":"Server Error"}' })));
  await p.locator('#pin-list .task input').nth(0).click();
  await p.locator('#pin-list .task input').nth(1).click();
  await p.fill('#pin-input', 'four');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 4000);
  t.check('failed commit: nothing sent after it', JSON.stringify(seen) === '[502]', JSON.stringify(seen));
  t.check('failed commit: the file is untouched', gh.files['todo.md'] === '- [ ] one\n- [ ] two\n- [ ] three\n');
  t.check('failed commit: the list shows what GitHub has', JSON.stringify(await boxes(p)) === '[false,false,false]',
    JSON.stringify(await boxes(p)));
  t.check('failed commit: the error is shown', (await p.getAttribute('#status', 'class')) === 'err',
    await p.textContent('#status'));
  t.check('failed commit: the waiting capture goes back in the box', (await p.inputValue('#pin-input')) === 'four');
  await ctx.close();
}
{
  // A change made elsewhere is still a conflict: the queue never writes over it.
  const { gh, ctx, p } = await ready(THREE());
  await slowPuts(ctx, p, 200);
  gh.files['todo.md'] = '- [ ] one\n- [ ] two\n- [ ] three\n- [ ] from the phone\n';
  gh.touch();
  await p.locator('#pin-list .task input').nth(0).click();
  await p.locator('#pin-list .task input').nth(1).click();
  await H.settle(p, 4000);
  t.check('change elsewhere: kept', gh.files['todo.md'].endsWith('- [ ] from the phone\n')
    && !gh.files['todo.md'].includes('[x]'), JSON.stringify(gh.files['todo.md']));
  t.check('change elsewhere: reported as a conflict', (await p.textContent('#status')).includes('Conflict'),
    await p.textContent('#status'));
  await ctx.close();
}

{
  // A pinned commit still on its way when another repository is chosen:
  // its reply belongs to the old repository, and says nothing about the
  // new one's version of a file with the same name.
  const repos = ['alpha', 'beta'].map(name => ({ owner: { login: 'roldaof' }, name,
    full_name: 'roldaof/' + name, default_branch: 'main', private: true }));
  const { gh, ctx, p } = await ready({ gh: { ...THREE().gh, repos } });
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/alpha' });
  await p.click('#f-save');
  await H.settle(p, 500);
  const seen = [];
  p.on('response', r => { if (r.request().method() === 'PUT') seen.push(r.url().split('/repos/')[1].split('/')[1] + ' ' + r.status()); });
  // alpha is another repository: answered as GitHub would, with alpha's new version
  await ctx.route('https://api.github.com/repos/roldaof/alpha/contents/**', async r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    await new Promise(res => setTimeout(res, 800));
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: { path: 'todo.md', sha: 'a1'.repeat(20) } }) });
  });
  // beta's commits are slow too, so alpha's reply arrives while one is on its way
  await ctx.route('https://api.github.com/repos/roldaof/beta/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 800));
    return r.fallback();
  });
  await p.locator('#pin-list .task input').nth(0).click();
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/beta' });
  await p.click('#f-save');
  await p.waitForFunction(() => document.querySelectorAll('#pin-list .task input:not(:checked)').length === 3);
  await p.locator('#pin-list .task input').nth(1).click();
  await p.locator('#pin-list .task input').nth(2).click();
  await H.settle(p, 4000);
  t.check('changed repository mid-commit: the new one\'s ticks land',
    gh.files['todo.md'] === '- [ ] one\n- [x] two\n- [x] three\n', JSON.stringify(gh.files['todo.md']) + ' ' + JSON.stringify(seen));
  t.check('changed repository mid-commit: nothing refused', seen.every(x => x.endsWith(' 200')), JSON.stringify(seen));
  await ctx.close();
}

{
  // Review: saving settings (same repository) while a commit is on its way
  // dropped what waited behind it, and the next tick was a conflict again.
  const { gh, ctx, p } = await ready(THREE());
  const seen = await slowPuts(ctx, p, 800);
  await p.locator('#pin-list .task input').nth(0).click();
  await p.fill('#pin-input', 'milk');
  await p.press('#pin-input', 'Enter');
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.click('#f-save');
  const kept = await p.waitForFunction(() => document.querySelectorAll('#pin-list .task input').length === 4,
    null, { timeout: 3000 }).then(() => true, () => false);
  t.check('settings saved mid-commit: the list keeps what is being written', kept);
  await p.locator('#pin-list .task input').nth(1).click();
  await H.settle(p, 5000);
  t.check('settings saved mid-commit: nothing lost',
    gh.files['todo.md'] === '- [x] one\n- [x] two\n- [ ] three\n- [ ] milk\n', JSON.stringify(gh.files['todo.md']));
  t.check('settings saved mid-commit: nothing refused', seen.every(s => s === 200), JSON.stringify(seen));
  t.check('settings saved mid-commit: the list shows it all',
    JSON.stringify(await boxes(p)) === '[true,true,false,false]', JSON.stringify(await boxes(p)));
  await ctx.close();
}
{
  // Review: the open note (unedited) follows every commit that lands, so a
  // later one failing does not leave it a version behind, conflicting with
  // the person's own tick on the next save.
  const { gh, ctx, p } = await ready(THREE());
  await H.clickRow(p, 'todo.md');
  await slowPuts(ctx, p, 500, i => i === 1 && (r => r.fulfill({ status: 502,
    contentType: 'application/json', body: '{"message":"Server Error"}' })));
  await p.locator('#pin-list .task input').nth(0).click();
  await p.locator('#pin-list .task input').nth(1).click();
  await H.settle(p, 4000);
  t.check('failed follow-on commit: GitHub has the first',
    gh.files['todo.md'] === '- [x] one\n- [ ] two\n- [ ] three\n', JSON.stringify(gh.files['todo.md']));
  t.check('failed follow-on commit: the open note shows it', (await H.editorValue(p)) === gh.files['todo.md'],
    JSON.stringify(await H.editorValue(p)));
  await H.setEditor(p, '- [x] one\n- [ ] two\n- [ ] three\n- [ ] typed\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 2000);
  t.check('failed follow-on commit: the next save is not a conflict', gh.files['todo.md'].endsWith('- [ ] typed\n'),
    await p.textContent('#status'));
  await ctx.close();
}

/* ===== pinned file that does not exist yet ===== */
{
  const { gh, ctx, p } = await ready({ pins: 'scratch.md' });
  t.check('missing pin invites a first task',
    (await p.textContent('#pin-list')).toLowerCase().includes('nothing in'));
  await p.fill('#pin-input', 'first');
  await p.click('#pin-go');
  await H.settle(p, 400);
  t.check('capture creates the file', gh.files['scratch.md'] === '- [ ] first\n');
  await ctx.close();
}

/* ===== reload restores last file ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.reload({ waitUntil: 'load' });
  await H.settle(p, 600);
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
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 350);
  t.check('save works without the CDN', gh.files['inbox.md'] === '# Inbox\n\nno cdn\n');
  await ctx.close();
}

/* ===== phone ===== */
{
  const { ctx, p } = await ready({ ctx: { viewport: { width: 390, height: 780 } } });
  t.check('tree off-canvas on a phone', await p.evaluate(
    () => document.getElementById('sidebar').getBoundingClientRect().right <= 1));
  await p.click('#btn-tree');
  await p.waitForTimeout(260);                      // outlasts the sheet's 180 ms slide: fixed
  await H.clickRow(p, 'inbox.md');
  t.check('picking a file closes the tree', await p.evaluate(() => !document.body.classList.contains('tree-open')));
  const crumb = await p.evaluate(() => {
    const n = document.querySelector('#crumb .name');
    return { text: n.textContent, cut: n.scrollWidth > n.clientWidth + 1 };
  });
  t.check('filename stays legible', crumb.text === 'inbox.md' && !crumb.cut);
  await p.click('#btn-pins');
  await p.waitForTimeout(260);                      // outlasts the sheet's 180 ms slide: fixed
  t.check('pins open as a bottom sheet with capture focused', await p.evaluate(
    () => document.getElementById('pins').getBoundingClientRect().top < innerHeight - 10 &&
          document.activeElement.id === 'pin-input'));
  t.check('no horizontal overflow', await p.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth + 1));
  await ctx.close();
}

await H.stop();
t.finish();
