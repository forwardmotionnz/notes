/* Sub-tasks indented with tabs (Obsidian's default) or four spaces work in
   Preview. Before, one such sub-task made the note's whole checklist read-only:
   the Markdown library rewrites nested indentation, so its lines were not found
   (the owner's report, 2026-10-02). */
import * as H from './harness.mjs';
const t = H.suite('nested-tasks'); await H.start();
const OBSIDIAN = 'WORK 1\n\n- [ ] AI Foundry\n\t- [ ] sub one\n\t\t- [x] deep\n\t- [ ] sub two\n- [x] slides\n';
const SPACES = '- [ ] parent\n    - [ ] four spaces\n- [ ] next\n';
const NUMBERED = '1. [ ] a\n\t1. [ ] x\n\t2. [ ] y\n';
// A sub-task the line search cannot see ("- - [ ]") and an HTML line that looks like a task: equal in number, so
// only the ticked states tell them apart; it is left to Edit rather than tick the wrong line.
const DECOY = '- [ ] a\n\t- - [ ] hidden\n\n\t<div>\n\t- [x] not a task\n\t</div>\n';
const FENCE = '- [ ] a\n\t```\n\t- [ ] only an example\n\t```\n\t- [ ] real\n- [ ] b\n';
const gh = H.fakeGitHub({ files: { 'todo.md': OBSIDIAN, 'spaces.md': SPACES, 'numbered.md': NUMBERED, 'fence.md': FENCE, 'decoy.md': DECOY } });
const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
const settled = () => p.waitForFunction(() => !Object.keys(pinBusy).length && !!document.querySelector('#pin-list .task')).catch(() => {});
const box = name => p.locator('#pin-list .task', { hasText: name }).first().locator('input[type=checkbox]').first();
const readOnlyNotice = async () => /Use Edit for this checklist/.test(await p.textContent('#pin-list'));
let text = OBSIDIAN;
const expect = (from, to) => { text = text.replace(from, to); return text; };

await H.preview(p, 'todo.md'); await settled();
t.check('tab-indented sub-tasks: every task can be ticked', await p.locator('#pin-list .task input[type=checkbox]:not(:disabled)').count() === 5 && !await readOnlyNotice(),
  String(await p.locator('#pin-list .task').count()));
await box('sub one').click(); await settled();
t.check('ticking a sub-task writes its line only, tabs kept', gh.files['todo.md'] === expect('\t- [ ] sub one', '\t- [x] sub one'), JSON.stringify(gh.files['todo.md']));
await box('deep').click(); await settled();
t.check('and a sub-sub-task', gh.files['todo.md'] === expect('\t\t- [x] deep', '\t\t- [ ] deep'), JSON.stringify(gh.files['todo.md']));
await box('AI Foundry').click(); await settled();
t.check('and the parent', gh.files['todo.md'] === expect('- [ ] AI Foundry', '- [x] AI Foundry'), JSON.stringify(gh.files['todo.md']));
await p.locator('#pin-list .task-text', { hasText: 'sub two' }).click({ position: { x: 5, y: 8 } });
await p.fill('.task-edit', 'sub two, renamed'); await p.keyboard.press('Enter'); await settled();
t.check('editing a sub-task keeps its tab', gh.files['todo.md'] === expect('\t- [ ] sub two', '\t- [ ] sub two, renamed'), JSON.stringify(gh.files['todo.md']));
await H.taskAction(p, 'Move up: sub two, renamed'); await settled();
t.check('moving a sub-task up takes its own sub-tasks along', gh.files['todo.md'] === expect('\t- [x] sub one\n\t\t- [ ] deep\n\t- [ ] sub two, renamed\n', '\t- [ ] sub two, renamed\n\t- [x] sub one\n\t\t- [ ] deep\n'),
  JSON.stringify(gh.files['todo.md']));
await H.taskAction(p, 'Remove task: sub one'); await settled();
t.check('removing a sub-task removes it and its sub-tasks, nothing else', gh.files['todo.md'] === expect('\t- [x] sub one\n\t\t- [ ] deep\n', ''), JSON.stringify(gh.files['todo.md']));

await H.preview(p, 'spaces.md'); await settled();
await box('four spaces').click(); await settled();
t.check('four-space sub-tasks work too', gh.files['spaces.md'] === SPACES.replace('    - [ ] four', '    - [x] four') && !await readOnlyNotice(), JSON.stringify(gh.files['spaces.md']));

await H.preview(p, 'numbered.md'); await settled();
await H.taskAction(p, 'Move down: x'); await settled();
t.check('moving a numbered sub-task keeps the numbers in order', gh.files['numbered.md'] === '1. [ ] a\n\t1. [ ] y\n\t2. [ ] x\n', JSON.stringify(gh.files['numbered.md']));

await H.preview(p, 'fence.md'); await settled();
t.check('a task-like line in a code example is not a task', await p.locator('#pin-list .task').count() === 3 && !await readOnlyNotice());
await box('real').click(); await settled();
t.check('and ticking the real one leaves the example alone', gh.files['fence.md'] === FENCE.replace('\t- [ ] real', '\t- [x] real'), JSON.stringify(gh.files['fence.md']));
await H.preview(p, 'decoy.md'); await p.waitForSelector('#pin-list li');
t.check('a look-alike line is never ticked in place of a sub-task: left to Edit', await readOnlyNotice() &&
  await p.locator('#pin-list input[type=checkbox]:not(:disabled)').count() === 0 && gh.files['decoy.md'] === DECOY);
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await c.close(); await H.stop(); t.finish();
