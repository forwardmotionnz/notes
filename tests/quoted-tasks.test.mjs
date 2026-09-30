/* Tasks inside a quote or callout (Obsidian's [!todo]) can be ticked, edited,
   moved and removed in Preview like any other; before, one quoted task made
   the note's whole checklist read-only. */
import * as H from './harness.mjs';
const t = H.suite('quoted-tasks'); await H.start();
const NOTE = [
  '# Jobs', '',
  '- [ ] top task', '',
  '> [!todo] This week',
  '> - [ ] ring the shop',
  '> - [x] swap the spare',
  '>   - [ ] nested in a quote', '',
  '> 1. [ ] first',
  '> 2. [ ] second', '',
  '> Quote',
  '> > - [ ] deep one', '',
].join('\n');
const LAZY = '> - [ ] lazy\ncarried on\n\n- [ ] outside\n';
const gh = H.fakeGitHub({ files: { 'jobs.md': NOTE, 'lazy.md': LAZY } });
const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
const settled = () => p.waitForFunction(() => !Object.keys(pinBusy).length && !!document.querySelector('#pin-list .task')).catch(() => {});
const box = name => p.locator('#pin-list .task', { hasText: name }).first().locator('input[type=checkbox]');
let text = NOTE;
const expect = (from, to) => { text = text.replace(from, to); return text; };

await H.preview(p, 'jobs.md'); await settled();
t.check('every task is offered, quoted ones too', await p.locator('#pin-list .task').count() === 7 &&
  !/Use Edit for this checklist/.test(await p.textContent('#pin-list')), String(await p.locator('#pin-list .task').count()));
t.check('and none is read-only', await p.locator('#pin-list .task input[type=checkbox]:not(:disabled)').count() === 7);
t.check('the callout still shows as a callout', await p.locator('#pin-list .callout[data-callout=todo] .task').count() === 3);

await box('ring the shop').click(); await settled();
t.check('ticking a task in a callout writes that line only', gh.files['jobs.md'] === expect('> - [ ] ring the shop', '> - [x] ring the shop'), JSON.stringify(gh.files['jobs.md']));
await box('deep one').click(); await settled();
t.check('and in a quote inside a quote', gh.files['jobs.md'] === expect('> > - [ ] deep one', '> > - [x] deep one'), JSON.stringify(gh.files['jobs.md']));

await p.locator('#pin-list .task-text', { hasText: 'nested in a quote' }).click({ position: { x: 5, y: 8 } });
await p.fill('.task-edit', 'nested, renamed'); await p.keyboard.press('Enter'); await settled();
t.check('editing a quoted task keeps its quote marks and indent', gh.files['jobs.md'] === expect('>   - [ ] nested in a quote', '>   - [ ] nested, renamed'), JSON.stringify(gh.files['jobs.md']));

await H.taskAction(p, 'Move down: first'); await settled();
t.check('moving a numbered quoted task keeps the numbers in order', gh.files['jobs.md'] === expect('> 1. [ ] first\n> 2. [ ] second', '> 1. [ ] second\n> 2. [ ] first'), JSON.stringify(gh.files['jobs.md']));

await H.taskAction(p, 'Remove task: second'); await settled();
t.check('removing a quoted task removes its line', gh.files['jobs.md'] === expect('> 1. [ ] second\n', ''), JSON.stringify(gh.files['jobs.md']));

await box('top task').click(); await settled();
t.check('a task outside any quote still works', gh.files['jobs.md'] === expect('- [ ] top task', '- [x] top task'), JSON.stringify(gh.files['jobs.md']));

// A line carried on without its ">" is not read as a quote line, so that checklist stays for Edit (nothing is written).
const commits = gh.commits.length;
await H.preview(p, 'lazy.md');
await p.waitForSelector('#pin-list li');
t.check('a quote carried on without ">" leaves the checklist to Edit', /Use Edit for this checklist/.test(await p.textContent('#pin-list')) &&
  await p.locator('#pin-list input[type=checkbox]:not(:disabled)').count() === 0 && gh.files['lazy.md'] === LAZY && gh.commits.length === commits);
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await c.close(); await H.stop(); t.finish();
