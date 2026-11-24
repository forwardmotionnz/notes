/* New folder (the owner's report: "I'm not able to create folders, just notes").
   Git keeps a folder only while it holds a file, and the app writes nothing of its own to a
   repository, so a folder made here lives in this browser until a note is put in it. */
import * as H from './harness.mjs';
const t = H.suite('new-folder'); await H.start();
const SVG = '"><svg onload=window.__pwned=1>';
for (const width of [1280, 390]) {
  const gh = H.fakeGitHub({ files: { 'Garden/Plan.md': '# Plan\n', 'Inbox.md': 'hi\n', '.obsidian/app.json': '{}' } });
  const c = await H.context(gh, { viewport: { width, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  const side = async () => { if (await p.evaluate(() => innerWidth <= 820 && !document.body.classList.contains('tree-open'))) { await p.click('#btn-tree'); await H.still(p); } };
  const dirs = () => p.$$eval('#tree .row.dir', rows => rows.map(r => r.childNodes[2].textContent));
  const hint = () => p.textContent('#nn-path');
  const make = async (name, inside) => { await side(); await p.click('#btn-new-folder'); if (inside !== undefined) await p.selectOption('#nn-folder', inside); await p.fill('#nn-name', name); };
  const writes = () => gh.commits.length;
  const before = writes();

  await side();
  t.check(`${width}: Files has a New folder button`, await p.getByRole('button', { name: 'New folder', exact: true }).isVisible());
  await p.click('#btn-new-folder');
  t.check(`${width}: it opens a dialog titled New folder`, await p.locator('#new-note').isVisible() && await p.textContent('#nn-title') === 'New folder');
  t.check(`${width}: which starts at the top level and offers the folders there are, not a second new one`, await p.inputValue('#nn-folder') === '' && JSON.stringify(await p.$$eval('#nn-folder option', o => o.map(x => x.textContent))) === JSON.stringify(['Top level', 'Garden']));
  t.check(`${width}: no name, no folder`, await p.locator('#nn-go').isDisabled() && /Type a name/.test(await hint()));
  await p.fill('#nn-name', 'Recipes');
  t.check(`${width}: it says where the folder goes, and that it waits here for its first note`, /^Will add the folder Recipes\./.test(await hint()) && /this device/.test(await hint()) && await p.textContent('#nn-go') === 'Create');
  for (const [name, why] of [['.secret', /dot/], ['garden', /Garden is already there/], ['Inbox.md', /Inbox\.md is a note/], ['Inbox.md/Sub', /Inbox\.md is a note/], ['a\\b', /cannot/], ['a//b', /cannot/], ['../up', /cannot|dot/]]) {
    await p.fill('#nn-name', name);
    t.check(`${width}: ${name} is refused with the reason`, await p.locator('#nn-go').isDisabled() && why.test(await hint()), await hint());
  }
  await p.fill('#nn-name', 'Recipes'); await p.press('#nn-name', 'Enter');
  t.check(`${width}: Enter makes it: the dialog closes and Files shows the folder`, !await p.locator('#new-note').isVisible() && (await dirs()).includes('Recipes'));
  t.check(`${width}: open, saying it is empty and kept on this device`, /this device/.test(await p.locator('#tree .folder-hint').textContent().catch(() => '')));
  t.check(`${width}: nothing is written to the repository for it`, writes() === before);

  await make('Soups', 'Recipes'); await p.click('#nn-go');
  t.check(`${width}: a folder inside the new one`, JSON.stringify(await dirs()) === JSON.stringify(['Garden', 'Recipes', 'Soups']));
  await make(SVG); await p.click('#nn-go');
  t.check(`${width}: a name is text, never markup`, (await dirs()).includes(SVG) && await p.evaluate(() => !window.__pwned));
  await p.getByRole('button', { name: 'Remove the empty folder ' + SVG, exact: true }).click();
  t.check(`${width}: an empty folder can be removed`, !(await dirs()).includes(SVG));
  t.check(`${width}: a folder with a folder in it has no Remove`, await p.getByRole('button', { name: 'Remove the empty folder Recipes', exact: true }).count() === 0 && await p.getByRole('button', { name: 'Remove the empty folder Recipes/Soups', exact: true }).count() === 1);

  await p.reload(); await p.waitForFunction(() => treeState === 'ok'); await side();
  t.check(`${width}: the folders are still there after a reload`, JSON.stringify(await dirs()) === JSON.stringify(['Garden', 'Recipes', 'Soups']));
  await p.click('#btn-new'); await H.still(p);
  t.check(`${width}: New note offers them`, JSON.stringify(await p.$$eval('#nn-folder option', o => o.map(x => x.textContent))) === JSON.stringify(['Top level', 'Garden', 'Recipes', 'Recipes/Soups', 'New folder…']));
  t.check(`${width}: New note is unchanged: its own title and hint`, await p.textContent('#nn-title') === 'New note' && /^Will be saved as /.test(await hint()));
  await p.click('#nn-cancel');

  // The + on the folder's row puts a note in it; once saved, the folder is an ordinary one in the repository.
  await side(); await p.getByRole('button', { name: 'New note in Recipes/Soups', exact: true }).click();
  t.check(`${width}: the folder's + starts a note in it`, await p.inputValue('#nn-folder') === 'Recipes/Soups');
  await p.fill('#nn-name', 'Pumpkin'); await p.click('#nn-go'); await p.waitForFunction(() => current?.path === 'Recipes/Soups/Pumpkin.md');
  await H.setEditor(p, 'soup\n'); await p.click('#btn-save'); await p.waitForFunction(() => files.some(f => f.path === 'Recipes/Soups/Pumpkin.md'));
  t.check(`${width}: the note is saved in it`, gh.files['Recipes/Soups/Pumpkin.md'] === 'soup\n');
  t.check(`${width}: and the folder is no longer one this browser keeps`, await p.evaluate(() => emptyFolders().length === 0 && !JSON.parse(localStorage.getItem(UI_KEY)).folders.paths.length));
  await side();
  t.check(`${width}: it stays in Files, with no Remove`, (await dirs()).includes('Soups') && await p.locator('#tree .row-del').count() === 0);

  // Another repository does not see this one's folders; a read-only one cannot make any.
  await make('Elsewhere'); await p.click('#nn-go');
  await p.evaluate(() => { window.realRepo = cfg.repo; cfg.repo = 'another'; renderTree(); });
  t.check(`${width}: another repository does not show it`, !(await dirs()).includes('Elsewhere'));
  await p.evaluate(() => { cfg.repo = realRepo; ui.folders.paths.push('.hidden', 7, 'a//b', '../x'); renderTree(); });
  t.check(`${width}: stored names that are not folder paths are ignored`, JSON.stringify(await p.evaluate(() => emptyFolders())) === JSON.stringify(['Elsewhere']));
  await p.evaluate(() => document.body.classList.add('read-only'));
  t.check(`${width}: a read-only repository has no New folder`, !await p.locator('#btn-new-folder').isVisible());
  t.check(`${width}: the page never scrolls sideways`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await c.close();
}
await H.stop(); t.finish();
