/* N30: Recently deleted lists notes deleted in the last 30 commits, read from
   the repository's history, and Restore commits a note's last version again.
   Nothing is written to the repository to keep deleted notes. */
import * as H from './harness.mjs';
const t = H.suite('deleted-notes'); await H.start();
const HOSTILE = '<img src=x onerror=window.__pwned=1>.md';
const gh = H.fakeGitHub({ files: {
  'keep.md': '# Keep\n', 'Garden/Plan.md': '# Plan\n\nbeds\n', 'again.md': 'first\n', 'move me.md': '# Moving\n',
  '.obsidian/workspace.md': 'hidden', 'photo.png': 'png', [HOSTILE]: 'hostile\n', 'Old/gone.md': 'too old\n' } });
// History, made "elsewhere" (each change is a commit, as another device would make it).
const change = (msg, fn) => { fn(gh.files); gh.touch(msg); };
change('Delete Old/gone.md', f => { delete f['Old/gone.md']; });
for (let i = 0; i < 30; i++) change('Edit keep.md', f => { f['keep.md'] += i + '\n'; });   // Old/gone.md's deletion is now beyond the last 30
change('Edit Garden/Plan.md', f => { f['Garden/Plan.md'] = '# Plan\n\nbeds, and the last words\n'; });
change('Delete Garden/Plan.md', f => { delete f['Garden/Plan.md']; });
change('Delete again.md', f => { delete f['again.md']; });
change('Create again.md', f => { f['again.md'] = 'second\n'; });
change('Move move me.md', f => { f['Moved/move me.md'] = f['move me.md']; delete f['move me.md']; });
change('Delete hidden and a picture', f => { delete f['.obsidian/workspace.md']; delete f['photo.png']; });
change('Delete a hostile name', f => { delete f[HOSTILE]; });
change('Create twice.md', f => { f['twice.md'] = 'one\n'; });
change('Delete twice.md', f => { delete f['twice.md']; });
change('Create twice.md again', f => { f['twice.md'] = 'two\n'; });
change('Delete twice.md again', f => { delete f['twice.md']; });

const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
t.check('history is read only when asked', !gh.log.commitReads);
const open = async () => {
  await p.evaluate(() => { const d = document.getElementById('deleted-notes'); if (d.open) d.open = false; d.open = true; });
  await p.waitForFunction(() => !deletedLoading && /deleted in the last/.test(document.getElementById('deleted-status').textContent));
};
const rows = () => p.$$eval('#deleted-list > div small', e => e.map(s => s.textContent.split(' · ')[0]));
t.check('Recently deleted is in the sidebar', await p.locator('#deleted-notes summary').textContent() === 'Recently deleted');
await open();
const listed = await rows();
t.check('a deleted note is listed, with its folder and when', listed.includes('Garden/Plan.md') &&
  /deleted \d/.test(await p.locator('#deleted-list > div small').first().textContent()), JSON.stringify(listed));
t.check('newest deletion first, and nothing else', JSON.stringify(listed) === JSON.stringify(['twice.md', HOSTILE, 'Garden/Plan.md']), JSON.stringify(listed));
t.check('a note deleted and made again is not listed', !listed.includes('again.md'));
t.check('a moved note is not listed', !listed.includes('move me.md'));
t.check('hidden files and pictures are not listed', !listed.some(x => /obsidian|photo/.test(x)));
t.check('only the last 30 changes are read, and it says so', !listed.includes('Old/gone.md') && gh.log.commitReads <= 31 &&
  /last 30 changes/.test(await p.textContent('#deleted-status')), String(gh.log.commitReads));
t.check('a hostile name is only text', await p.evaluate(() => !window.__pwned) && await p.locator('#deleted-list img').count() === 0);

// Restore
const commits = gh.commits.length;
await p.getByRole('button', { name: 'Restore Garden/Plan.md' }).click();
await p.waitForFunction(() => current?.path === 'Garden/Plan.md');
t.check('Restore brings back its last version', gh.files['Garden/Plan.md'] === '# Plan\n\nbeds, and the last words\n', JSON.stringify(gh.files['Garden/Plan.md']));
t.check('in one commit that says so', gh.commits.length === commits + 1 && gh.commits.at(-1).message === 'Restore Garden/Plan.md');
t.check('and opens the note, now in Files', await H.editorValue(p) === '# Plan\n\nbeds, and the last words\n' &&
  await p.evaluate(() => files.some(f => f.path === 'Garden/Plan.md')));
t.check('it leaves the list', !(await rows()).includes('Garden/Plan.md'));

await p.getByRole('button', { name: 'Restore twice.md' }).click();
await p.waitForFunction(() => current?.path === 'twice.md');
t.check('a note deleted twice is listed once and comes back as its latest version', gh.files['twice.md'] === 'two\n', JSON.stringify(gh.files['twice.md']));
// A note of that name made meanwhile is never overwritten.
gh.files[HOSTILE] = 'made elsewhere\n'; gh.touch('Create it elsewhere');
const before = gh.commits.length;
await p.getByRole('button', { name: 'Restore ' + HOSTILE }).click();
await p.waitForFunction(() => /exists already/.test(document.getElementById('status').textContent));
t.check('a name taken since is not overwritten, and it says so', gh.files[HOSTILE] === 'made elsewhere\n' && gh.commits.length === before);

// A note deleted here shows up too.
await p.evaluate(() => openFile('Garden/Plan.md')); await p.waitForFunction(() => current?.path === 'Garden/Plan.md');
await H.noteAction(p, '#btn-delete');
await p.waitForFunction(() => !current);
await open();
t.check('a note deleted in Padgit is listed', (await rows())[0] === 'Garden/Plan.md', JSON.stringify(await rows()));

// Read-only: Restore says why and sends nothing (review: a button hidden or shown from a stale answer misled either way).
await p.evaluate(() => { readOnly = 'this repository is archived'; });
const writes = gh.commits.length;
await p.getByRole('button', { name: 'Restore Garden/Plan.md' }).click();
t.check('read-only: Restore says why and sends nothing', /Nothing can be restored: this repository is archived/.test(await H.status(p)) && gh.commits.length === writes);
await p.evaluate(() => { readOnly = ''; });
const errors = p.errors.filter(e => !/status of 409/.test(e));   // GitHub's refusal of the taken name, expected
t.check('no page errors', errors.length === 0, errors.join(' | '));
await c.close();
{
  // Review of N30.
  const BIG = '# Big\n\n' + 'words '.repeat(200 * 1024) + '\n';   // over 1 MB
  const gh = H.fakeGitHub({ files: { 'a.md': 'v1\n', 'big.md': BIG, 'lost.md': 'lost\n', 'Work/x.md': 'x\n', 'Work/y.md': 'y\n' } });
  const change = (msg, fn) => { fn(gh.files); gh.touch(msg); };
  change('Delete a.md', f => { delete f['a.md']; });
  change('Delete big.md', f => { delete f['big.md']; });
  change('Delete lost.md', f => { delete f['lost.md']; });
  change('Delete Work/x.md', f => { delete f['Work/x.md']; });
  change('Rename folder Work to work', f => { f['work/y.md'] = f['Work/y.md']; delete f['Work/y.md']; });
  change('Delete a folder of 120 notes', f => { for (let i = 0; i < 120; i++) f['bulk/n' + i + '.md'] = 'n' + i; });
  change('Delete a folder of 120 notes', f => { for (let i = 0; i < 120; i++) delete f['bulk/n' + i + '.md']; });
  const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(8000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  await p.evaluate(() => { document.getElementById('deleted-notes').open = true; });
  await p.waitForFunction(() => !deletedLoading && /deleted in the last/.test(document.getElementById('deleted-status').textContent));
  const listed = await p.$$eval('#deleted-list > div small', e => e.map(s => s.textContent.split(' · ')[0]));
  t.check('review: a commit with more than 100 files is read in full', listed.includes('bulk/n119.md') && listed.includes('bulk/n0.md'), String(listed.length));
  // The list is now out of date: a.md came back elsewhere, was written, and deleted again.
  change('Create a.md', f => { f['a.md'] = 'brand new text written today\n'; });
  change('Delete a.md again', f => { delete f['a.md']; });
  await p.getByRole('button', { name: 'Restore a.md' }).click(); await p.waitForFunction(() => current?.path === 'a.md');
  t.check('review: an out-of-date list still restores the latest version', gh.files['a.md'] === 'brand new text written today\n', JSON.stringify(gh.files['a.md']));
  await p.getByRole('button', { name: 'Restore big.md' }).click(); await p.waitForFunction(() => /big\.md/.test(document.getElementById('status').textContent) || current?.path === 'big.md').catch(() => {});
  t.check('review: a note over 1 MB can be restored', gh.files['big.md'] === BIG, String(gh.files['big.md']?.length) + ' ' + await H.status(p));
  await p.getByRole('button', { name: 'Restore Work/x.md' }).click(); await p.waitForFunction(() => current?.path === 'work/x.md');
  t.check('review: restoring into a folder renamed since keeps its current spelling', gh.files['work/x.md'] === 'x\n' && !('Work/x.md' in gh.files));
  // GitHub applies the restore but the reply is lost; pressing Restore again says it worked.
  let lose = true;
  await p.route('**/contents/lost.md', async r => { if (r.request().method() === 'PUT' && lose) { lose = false; gh.files['lost.md'] = Buffer.from(JSON.parse(r.request().postData()).content, 'base64').toString(); gh.touch('Restore lost.md'); return r.abort(); } return r.fallback(); });
  await p.getByRole('button', { name: 'Restore lost.md' }).click();
  await p.waitForFunction(() => !document.querySelector('[aria-label="Restore lost.md"]')?.disabled);
  t.check('review: setup: the reply was lost after GitHub restored it', gh.files['lost.md'] === 'lost\n' && !(await H.status(p)).startsWith('Restored'), JSON.stringify(gh.files['lost.md']) + ' ' + await H.status(p) + ' ' + lose);
  await p.getByRole('button', { name: 'Restore lost.md' }).click(); await p.waitForFunction(() => current?.path === 'lost.md');
  t.check('review: pressing Restore again says it was restored', /Restored lost\.md/.test(await H.status(p)) && gh.files['lost.md'] === 'lost\n');
  await c.close();
}
{
  // An empty repository has no history to read.
  const gh = H.fakeGitHub({ files: {}, empty: true }), c = await H.context(gh), p = await H.page(c);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok' || repoEmpty);
  await p.evaluate(() => { document.getElementById('deleted-notes').open = true; });
  await p.waitForFunction(() => !deletedLoading && /deleted in the last/.test(document.getElementById('deleted-status').textContent));
  t.check('empty repository: nothing listed, nothing asked', await p.locator('#deleted-list > div').count() === 0 && !gh.log.commitReads);
  await c.close();
}
await H.stop(); t.finish();
