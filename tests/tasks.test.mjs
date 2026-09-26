/* Removing pinned tasks: one at a time, or every ticked one, with Undo. */
import * as H from './harness.mjs';

const t = H.suite('tasks');
await H.start();

const TODO = '# Today\n\n- [ ] ring the panelbeater\n- [x] swap the spare\n  - [ ] indented, not done\n\n## Later\n- [X] paid the rates\n- [ ] book the wof\nloose line\n';
const FILES = () => ({ 'todo.md': TODO, 'inbox.md': 'hello\n' });

async function ready(opts = {}) {
  const gh = H.fakeGitHub({ files: FILES(), ...opts.gh });
  const ctx = await H.context(gh, opts.ctx || {});
  const p = await H.page(ctx);
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); d.accept(); });
  await H.signIn(p);
  if (!opts.gh || !opts.gh.repos) await p.waitForSelector('#pin-list .task');   // several: none chosen yet
  return { gh, ctx, p };
}
const tasks = p => p.$$eval('#pin-list .task span', e => e.map(s => s.textContent));
const removeBtn = (p, i) => p.locator('#pin-list .task .rm').nth(i);
const undoShown = p => p.isVisible('#pin-undo');

/* ===== remove one task ===== */
{
  const { gh, ctx, p } = await ready();
  const n = await p.locator('#pin-list .task .rm').count();
  t.check('a remove control per task', n === 5, String(n));
  t.check('named for its task', (await removeBtn(p, 0).getAttribute('aria-label')) === 'Remove task: ring the panelbeater',
    await removeBtn(p, 0).getAttribute('aria-label'));
  const before = gh.commits.length;
  await removeBtn(p, 0).click();
  await H.settle(p, 600);
  t.check('removes that one line and nothing else', gh.files['todo.md'] === TODO.replace('- [ ] ring the panelbeater\n', ''),
    JSON.stringify(gh.files['todo.md']));
  t.check('in one commit', gh.commits.length - before === 1, String(gh.commits.length - before));
  t.check('no confirmation asked', p.asked.length === 0, JSON.stringify(p.asked));
  t.check('the list no longer shows it', !(await tasks(p)).includes('ring the panelbeater'));
  t.check('an Undo is offered', await undoShown(p));
  t.check('saying what went', (await p.textContent('#pin-undo')).includes('ring the panelbeater'),
    await p.textContent('#pin-undo'));
  await p.click('#pin-undo button');
  await H.settle(p, 600);
  t.check('Undo puts the line back where it was', gh.files['todo.md'] === TODO, JSON.stringify(gh.files['todo.md']));
  t.check('Undo is one more commit', gh.commits.length - before === 2);
  t.check('the Undo goes once used', !(await undoShown(p)));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== the offer goes after a while ===== */
{
  const { ctx, p } = await ready();
  await removeBtn(p, 1).click();
  await H.settle(p, 600);
  t.check('Undo shown after removing', await undoShown(p));
  await p.waitForTimeout(8600);
  t.check('and gone after a few seconds', !(await undoShown(p)));
  await ctx.close();
}

/* ===== clear done ===== */
{
  const { gh, ctx, p } = await ready();
  t.check('Clear done counts the ticked tasks', (await p.textContent('#pin-list .clear-done')) === 'Clear 2 done',
    await p.textContent('#pin-list .clear-done'));
  const before = gh.commits.length;
  await p.click('#pin-list .clear-done');
  await H.settle(p, 600);
  t.check('Clear done removes every ticked task, and only them',
    gh.files['todo.md'] === '# Today\n\n- [ ] ring the panelbeater\n  - [ ] indented, not done\n\n## Later\n- [ ] book the wof\nloose line\n',
    JSON.stringify(gh.files['todo.md']));
  t.check('Clear done is one commit', gh.commits.length - before === 1);
  t.check('Clear done asks nothing', p.asked.length === 0, JSON.stringify(p.asked));
  t.check('Clear done gone with nothing ticked', (await p.$$('#pin-list .clear-done')).length === 0);
  t.check('Clear done offers Undo', (await p.textContent('#pin-undo')).includes('2'), await p.textContent('#pin-undo'));
  await p.click('#pin-undo button');
  await H.settle(p, 600);
  t.check('Undo brings every cleared line back in place', gh.files['todo.md'] === TODO, JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}

/* ===== CRLF files stay CRLF ===== */
{
  const crlf = TODO.replace(/\n/g, '\r\n');
  const { gh, ctx, p } = await ready({ gh: { files: { 'todo.md': crlf } } });
  await removeBtn(p, 0).click();
  await H.settle(p, 600);
  t.check('a CRLF file keeps its line endings', gh.files['todo.md'] === crlf.replace('- [ ] ring the panelbeater\r\n', ''),
    JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}

/* ===== a remove and a tick while GitHub is slow (N8's queue) ===== */
{
  const { gh, ctx, p } = await ready();
  const seen = [];
  p.on('response', r => { if (r.request().method() === 'PUT') seen.push(r.status()); });
  await ctx.route('https://api.github.com/repos/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 500));
    return r.fallback();
  });
  await removeBtn(p, 0).click();
  await p.locator('#pin-list .task input').nth(0).click();   // now "swap the spare": unticks it
  await p.click('#pin-list .clear-done');                    // "paid the rates"
  await H.settle(p, 4000);
  t.check('slow GitHub: remove, untick and clear all land',
    gh.files['todo.md'] === '# Today\n\n- [ ] swap the spare\n  - [ ] indented, not done\n\n## Later\n- [ ] book the wof\nloose line\n',
    JSON.stringify(gh.files['todo.md']));
  t.check('slow GitHub: nothing refused', seen.length > 0 && seen.every(s => s === 200), JSON.stringify(seen));
  await ctx.close();
}

/* ===== the list changed under the click ===== */
{
  // The rendered row and the file must agree on the line; if they do not,
  // nothing is removed (never the wrong line).
  const { gh, ctx, p } = await ready();
  await p.evaluate(() => { const c = pinCache['todo.md']; c.text = c.text.replace('- [ ] ring the panelbeater\n', '- [ ] something else\n'); });
  const before = gh.commits.length;
  await removeBtn(p, 0).click();
  await H.settle(p, 600);
  t.check('a stale row removes nothing', gh.commits.length === before && gh.files['todo.md'] === TODO);
  t.check('and the list is redrawn', (await tasks(p))[0] === 'something else', JSON.stringify(await tasks(p)));
  await ctx.close();
}

/* ===== failure keeps the task ===== */
{
  const { gh, ctx, p } = await ready();
  await ctx.route('https://api.github.com/repos/**/contents/**', r =>
    r.request().method() === 'PUT' ? r.fulfill({ status: 502, contentType: 'application/json', body: '{"message":"Server Error"}' }) : r.fallback());
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  t.check('failed remove: the file is untouched', gh.files['todo.md'] === TODO);
  t.check('failed remove: the task is back in the list', (await tasks(p)).includes('ring the panelbeater'), JSON.stringify(await tasks(p)));
  t.check('failed remove: no Undo offered for it', !(await undoShown(p)));
  t.check('failed remove: the error shown', (await p.getAttribute('#status', 'class')) === 'err');
  await ctx.close();
}

/* ===== Undo never crosses to another repository ===== */
{
  const repos = ['alpha', 'beta'].map(name => ({ owner: { login: 'roldaof' }, name,
    full_name: 'roldaof/' + name, default_branch: 'main', private: true }));
  const { gh, ctx, p } = await ready({ gh: { repos } });
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/alpha' });
  await p.click('#f-save');
  await p.waitForSelector('#pin-list .task .rm');
  await removeBtn(p, 0).click();
  await H.settle(p, 600);
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/beta' });
  await p.click('#f-save');
  await H.settle(p, 800);
  t.check('another repository: the Undo is withdrawn', !(await undoShown(p)));
  await ctx.close();
}

/* ===== review: Undo never puts a line back in the wrong place ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'todo.md');
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  const removed = gh.files['todo.md'];
  await H.setEditor(p, 'NEW LINE\nNEW LINE 2\n' + removed);
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 1500);
  const edited = gh.files['todo.md'];
  t.check('lines added above since: setup', edited.startsWith('NEW LINE\n') && await undoShown(p));
  const before = gh.commits.length;
  await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('lines added above since: nothing put back', gh.files['todo.md'] === edited && gh.commits.length === before,
    JSON.stringify(gh.files['todo.md']));
  t.check('lines added above since: says why', /not undone/i.test(await p.textContent('#status')), await p.textContent('#status'));
  t.check('lines added above since: the offer goes', !(await undoShown(p)));
  await ctx.close();
}
{
  // A tick meanwhile is not a move: Undo still puts everything back, tick kept.
  const { gh, ctx, p } = await ready();
  await p.click('#pin-list .clear-done');
  await H.settle(p, 1500);
  await p.locator('#pin-list .task input').nth(0).click();   // ring the panelbeater
  await H.settle(p, 1500);
  await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('a tick meanwhile: Undo still restores, keeping the tick',
    gh.files['todo.md'] === TODO.replace('- [ ] ring', '- [x] ring'), JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}

{
  // Re-review: the line above a task is often not unique (a blank line under
  // each heading); a section added above must still stop the Undo.
  const SECTIONS = '## A\n\n- [ ] a1\n## B\n\n- [ ] b1\n## C\n\n- [ ] c1\n';
  const { gh, ctx, p } = await ready({ gh: { files: { 'todo.md': SECTIONS } } });
  await H.clickRow(p, 'todo.md');
  await removeBtn(p, 1).click();
  await H.settle(p, 1500);
  await H.setEditor(p, '## Z\n\n- [ ] z\n' + gh.files['todo.md']);
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 1500);
  const edited = gh.files['todo.md'];
  await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('a section added above: nothing put back', gh.files['todo.md'] === edited, JSON.stringify(gh.files['todo.md']));
  t.check('a section added above: says why', /not undone/i.test(await p.textContent('#status')));
  await ctx.close();
}
{
  // A task captured since goes at the end: Undo still puts the line back, and keeps it.
  const { gh, ctx, p } = await ready();
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  await p.fill('#pin-input', 'new one');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 1500);
  await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('a capture meanwhile: Undo still restores, keeping it', gh.files['todo.md'] === TODO + '- [ ] new one\n',
    JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}
{
  // Re-review: another tab changed the file; the Undo's commit is refused.
  // The offer comes back, and then says the list has moved on.
  const { gh, ctx, p } = await ready();
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  gh.files['todo.md'] = 'from the other tab\n' + gh.files['todo.md'];
  gh.touch();
  const theirs = gh.files['todo.md'];
  await p.click('#pin-undo button');
  await H.settle(p, 2000);
  t.check('changed in another tab: the Undo comes back after the refusal', await undoShown(p));
  if (await undoShown(p)) await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('changed in another tab: then says the list moved on', /not undone/i.test(await p.textContent('#status')),
    await p.textContent('#status'));
  t.check('changed in another tab: their text kept', gh.files['todo.md'] === theirs);
  await ctx.close();
}

/* ===== review: Undo refused for now stays on offer ===== */
{
  const { gh, ctx, p } = await ready();
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  // The access check that every reload makes, held for a moment
  await ctx.route('https://api.github.com/repos/*/*', async r => {
    await new Promise(res => setTimeout(res, 1200));
    return r.fallback();
  });
  await p.click('#btn-refresh');
  await p.waitForTimeout(150);
  await p.click('#pin-undo button');
  t.check('undo while checking access: still offered', await undoShown(p));
  await H.settle(p, 3000);
  if (await undoShown(p)) await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('undo while checking access: works once it can', gh.files['todo.md'] === TODO, JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}

/* ===== review: Undo follows a rename ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'todo.md');
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('tasks.md') : d.accept());
  await p.click('#btn-rename');
  await H.settle(p, 2000);
  t.check('renamed: setup', 'tasks.md' in gh.files && !('todo.md' in gh.files) && await undoShown(p));
  await p.click('#pin-undo button');
  await H.settle(p, 1500);
  t.check('renamed: Undo puts the line back in the renamed file', gh.files['tasks.md'] === TODO,
    JSON.stringify(gh.files['tasks.md']));
  await ctx.close();
}

/* ===== review: Undo goes when another pinned list is shown ===== */
{
  const { ctx, p } = await ready();
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.fill('#f-pins', 'todo.md, inbox.md');
  await p.click('#f-save');
  await H.settle(p, 1500);
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  t.check('another list: setup', await undoShown(p));
  await p.locator('#pin-tabs button').nth(1).click();
  t.check('another list: the Undo is withdrawn', !(await undoShown(p)));
  await ctx.close();
}

/* ===== review: no Undo once the repository cannot be changed ===== */
{
  const { gh, ctx, p } = await ready();
  await removeBtn(p, 0).click();
  await H.settle(p, 1500);
  gh.repos.forEach(r => { r.archived = true; });
  await p.click('#btn-refresh');
  await H.settle(p, 1500);
  t.check('archived since: setup', await p.isVisible('#readonly'));
  t.check('archived since: the Undo is withdrawn', !(await undoShown(p)));
  await ctx.close();
}

/* ===== phone: the control is there without hovering ===== */
{
  const { ctx, p } = await ready({ ctx: { viewport: { width: 390, height: 780 } } });
  const opacity = await p.evaluate(() => getComputedStyle(document.querySelector('#pin-list .task .rm')).opacity);
  t.check('phone: remove always shown', opacity === '1', opacity);
  await ctx.close();
}
{
  const { ctx, p } = await ready();
  const hidden = await p.evaluate(() => getComputedStyle(document.querySelector('#pin-list .task .rm')).opacity);
  await p.hover('#pin-list .task >> nth=0');
  const shown = await p.evaluate(() => getComputedStyle(document.querySelector('#pin-list .task .rm')).opacity);
  t.check('desktop: remove shown on hover', hidden === '0' && shown === '1', hidden + ' -> ' + shown);
  await ctx.close();
}

await H.stop();
t.finish();
