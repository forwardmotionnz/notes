/* N40: a note dragged onto a folder in Files moves there (onto the Files
   heading: to the top level), by the same single commit as Rename or move. */
import * as H from './harness.mjs';
const t = H.suite('drag-move'); await H.start();
const gh = H.fakeGitHub({ files: {
  'Inbox.md': '# Inbox\n', 'Shared.md': 'top\n', 'drafted.md': 'old\n', 'stale.md': 'one\n', 'open.md': 'open\n',
  'Garden/Plan.md': '# Plan\n', 'Garden/Shared.md': 'in garden\n', 'Garden/Deep/Bed.md': 'bed\n', 'photo.png': 'png' } });
const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
const row = name => p.locator('#tree .row', { hasText: new RegExp('^\\s*' + name.replace(/[.]/g, '\\.') + '\\s*$') }).first();
const drag = async (name, target) => { await (await row(name)).dragTo(target); await p.waitForFunction(() => !moving); await H.settle(p, 300); };
const folder = name => p.locator('#tree .row.dir', { hasText: name }).first();
const done = () => p.waitForFunction(() => treeState === 'ok' && !moving);

t.check('a note can be picked up', await row('Inbox.md').getAttribute('draggable') === 'true');
t.check('pictures and other files cannot', await row('photo.png').getAttribute('draggable') !== 'true');
t.check('folders cannot (only notes move)', await folder('Garden').getAttribute('draggable') !== 'true');

// a note that is not open, onto a folder
let commits = gh.commits.length;
await drag('Inbox.md', folder('Garden')); await done();
t.check('dropped on a folder, it moves there', gh.files['Garden/Inbox.md'] === '# Inbox\n' && !('Inbox.md' in gh.files), JSON.stringify(Object.keys(gh.files)));
t.check('in one commit', gh.commits.length === commits + 1 && gh.commits.at(-1).message === 'Rename Inbox.md to Garden/Inbox.md');
t.check('and it says where it went', /Moved to Garden\/Inbox\.md/.test(await H.status(p)), await H.status(p));
await H.expand(p, 'Garden');
t.check('Files shows it in its new folder', await p.evaluate(() => files.some(f => f.path === 'Garden/Inbox.md')) && await row('Inbox.md').count() === 1);

// onto the Files heading: the top level
commits = gh.commits.length;
await drag('Plan.md', p.locator('#files-head')); await done();
t.check('dropped on the Files heading, it moves to the top level', gh.files['Plan.md'] === '# Plan\n' && !('Garden/Plan.md' in gh.files) && gh.commits.length === commits + 1);

// onto a folder inside a folder
await H.expand(p, 'Deep'); commits = gh.commits.length;
await drag('Plan.md', folder('Deep')); await done();
t.check('and into a folder inside a folder', gh.files['Garden/Deep/Plan.md'] === '# Plan\n' && gh.commits.length === commits + 1);

// onto the folder it is already in: nothing
commits = gh.commits.length;
await drag('Bed.md', folder('Deep'));
t.check('dropped where it already is, nothing happens', gh.commits.length === commits && 'Garden/Deep/Bed.md' in gh.files);

// a name taken there is refused
commits = gh.commits.length;
await row('Shared.md').count(); await p.locator('#tree .row', { hasText: /^\s*Shared\.md\s*$/ }).last().dragTo(folder('Garden')); await p.waitForFunction(() => !moving); await H.settle(p, 300);   // the top-level one (Garden's is listed first)
t.check('a name already taken in that folder is refused, and it says so', gh.commits.length === commits && gh.files['Shared.md'] === 'top\n' &&
  gh.files['Garden/Shared.md'] === 'in garden\n' && /already exists/.test(await H.status(p)), await H.status(p));

// a note changed on GitHub since the list loaded: what is there now moves (nothing of it is lost)
gh.files['stale.md'] = 'two\n'; gh.touch('Edit stale.md elsewhere');
commits = gh.commits.length;
await drag('stale.md', folder('Garden'));
t.check('a note changed elsewhere since moves as it is on GitHub now', gh.files['Garden/stale.md'] === 'two\n' && !('stale.md' in gh.files) &&
  gh.commits.length === commits + 1, await H.status(p));

// unsaved words in this browser go with it
await p.evaluate(() => draftStore().setItem(draftKey('drafted.md'), JSON.stringify({ text: 'new words\n', sha: files.find(f => f.path === 'drafted.md').sha, at: Date.now() })));
await drag('drafted.md', folder('Garden')); await done();
t.check('a note with unsaved words moves, and its words go with it', gh.files['Garden/drafted.md'] === 'old\n' &&
  await p.evaluate(() => readDraft('Garden/drafted.md')?.text === 'new words\n' && !readDraft('drafted.md')));
await p.evaluate(() => openFile('Garden/drafted.md')); await p.waitForFunction(() => current?.path === 'Garden/drafted.md');
t.check('and opening it there brings them back', await H.editorValue(p) === 'new words\n', JSON.stringify(await H.editorValue(p)));

// the open note, with typing not yet saved
await p.evaluate(() => openFile('open.md')); await p.waitForFunction(() => current?.path === 'open.md');
await H.setEditor(p, 'open, and typed\n');
await drag('open.md', folder('Garden')); await p.waitForFunction(() => current?.path === 'Garden/open.md' && !moving && !saving);
await H.settle(p, 500);
t.check('the open note moves with what was typed', gh.files['Garden/open.md'] === 'open, and typed\n' && !('open.md' in gh.files), JSON.stringify(gh.files['Garden/open.md']));
t.check('and stays open at its new place', await H.editorValue(p) === 'open, and typed\n' && await p.evaluate(() => !dirty()));
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await c.close();
{
  // Review of N40.
  const gh = H.fakeGitHub({ files: { 'A.md': 'a\n', 'B.md': 'b\n', 'C.md': 'c\n', 'D.md': 'd\n', 'F/x.md': 'x\n' } });
  const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(8000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  const folderF = p.locator('#tree .row.dir', { hasText: 'F' }).first();
  const rowOf = n => p.locator('#tree .row', { hasText: new RegExp('^\\s*' + n + '\\.md\\s*$') }).first();
  // a note saved in this session (the list still has its old version) can be moved
  await p.evaluate(() => openFile('A.md')); await p.waitForFunction(() => current?.path === 'A.md');
  await H.setEditor(p, 'a, edited\n'); await p.click('#btn-save'); await p.waitForFunction(() => !saving && !dirty());
  await p.evaluate(() => openFile('D.md')); await p.waitForFunction(() => current?.path === 'D.md');
  await rowOf('A').dragTo(folderF); await p.waitForFunction(() => /Moved|Not moved/.test(document.getElementById('status').textContent));
  t.check('review: a note just saved here can be moved, with its saved words', gh.files['F/A.md'] === 'a, edited\n' && !('A.md' in gh.files), await H.status(p));
  await p.waitForFunction(() => treeState === 'ok');
  // moving another note leaves the open one alone: it takes typing, and autosave carries on
  let release; const gate = new Promise(r => release = r);
  await p.route('**/git/refs/heads/**', async r => { await gate; return r.fallback(); });
  await rowOf('B').dragTo(folderF); await p.waitForFunction(() => notesMoving['B.md']);
  await p.evaluate(() => { editor.setValue('d, typed meanwhile\n'); editor.getInputField?.(); document.querySelector('#cm-stub, .fallback-editor')?.dispatchEvent(new Event('input')); });
  t.check('review: the open note is not locked while another note moves', await p.evaluate(() => !moving && !(editor.getOption && editor.getOption('readOnly'))));
  release(); await p.waitForFunction(() => !notesMoving['B.md']);
  await p.waitForFunction(() => !dirty() && !saving, null, { timeout: 15000 }).catch(() => {});
  t.check('review: and its autosave still lands', gh.files['D.md'] === 'd, typed meanwhile\n' && gh.files['F/B.md'] === 'b\n', JSON.stringify(gh.files['D.md']));
  await p.unroute('**/git/refs/heads/**'); await p.waitForFunction(() => treeState === 'ok');
  // a note whose save is still on its way is not moved
  let let2; const gate2 = new Promise(r => let2 = r);
  await p.route('**/contents/C.md', async r => { if (r.request().method() === 'PUT') await gate2; return r.fallback(); });
  await p.evaluate(() => openFile('C.md')); await p.waitForFunction(() => current?.path === 'C.md');
  await H.setEditor(p, 'c, saving\n'); await p.click('#btn-save'); await p.waitForFunction(() => saving);
  await p.evaluate(() => openFile('D.md')); await p.waitForFunction(() => current?.path === 'D.md');
  const before = gh.commits.length;
  await rowOf('C').dragTo(folderF);
  t.check('review: a note still being saved is not moved, and it says so', /still being saved/.test(await H.status(p)) && 'C.md' in gh.files && !('F/C.md' in gh.files), await H.status(p));
  let2(); await p.waitForFunction(() => !saving);
  t.check('review: and its save lands where it was', gh.files['C.md'] === 'c, saving\n' && gh.commits.length === before + 1);
  // read-only, whenever it becomes known: it says so
  await p.evaluate(() => { readOnly = 'this repository is archived'; moveNote('D.md', 'F/D.md'); });
  t.check('review: read-only says why nothing moves', /Nothing can be moved: this repository is archived/.test(await H.status(p)) && 'D.md' in gh.files);
  await p.evaluate(() => { readOnly = ''; });
  await c.close();
}
{
  // read-only: nothing can be picked up
  const gh = H.fakeGitHub({ files: { 'a.md': 'a\n', 'F/b.md': 'b\n' }, repos: [{ owner: { login: 'roldaof' }, name: 'vault',
    full_name: 'roldaof/vault', default_branch: 'main', private: true, archived: true }] });
  const c = await H.context(gh), p = await H.page(c);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok' && !!readOnly);
  t.check('read-only: notes cannot be picked up', await p.locator('#tree .row[draggable=true]').count() === 0);
  await c.close();
}
{
  // a phone: dragging would fight scrolling, so Rename or move is the way
  const gh = H.fakeGitHub({ files: { 'a.md': 'a\n', 'F/b.md': 'b\n' } });
  const c = await H.context(gh, { viewport: { width: 390, height: 800 }, touch: true }), p = await H.page(c);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  t.check('phone: notes are not draggable', await p.locator('#tree .row[draggable=true]').count() === 0);
  await c.close();
}
await H.stop(); t.finish();
