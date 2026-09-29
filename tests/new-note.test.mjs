/* New note: a dialog with a name and a folder (the owner's report: a new note
   could not be put in a folder). */
import * as H from './harness.mjs';
const t = H.suite('new-note'); await H.start();
const SVG = '"><svg onload=window.__pwned=1>';
for (const width of [1280, 390]) {
  const gh = H.fakeGitHub({ files: { 'Garden/Plan.md': '# Plan\n', 'Garden/Beds/North.md': 'n\n', 'Inbox.md': 'hi\n', '.obsidian/app.json': '{}', [`${SVG}/x.md`]: 'x\n' } });
  const c = await H.context(gh, { viewport: { width, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  await p.evaluate(() => openFile('Garden/Plan.md')); await p.waitForFunction(() => current?.path === 'Garden/Plan.md');

  const openNew = async () => { if (await p.evaluate(() => innerWidth <= 820 && !document.body.classList.contains('tree-open'))) { await p.click('#btn-tree'); await H.still(p); } await p.click('#btn-new'); };
  await openNew();
  t.check(`${width}: New note opens a dialog, not the browser's prompt`, await p.locator('#new-note').isVisible());
  const folders = await p.locator('#nn-folder option').allTextContents();
  t.check(`${width}: it lists the folders, as text, and hides dot folders`, JSON.stringify(folders) === JSON.stringify(['Top level', `${SVG}`, 'Garden', 'Garden/Beds', 'New folder…'].sort((a, b) => a === 'Top level' ? -1 : b === 'Top level' ? 1 : a === 'New folder…' ? 1 : b === 'New folder…' ? -1 : a.localeCompare(b))), JSON.stringify(folders));
  t.check(`${width}: it starts in the open note's folder`, await p.inputValue('#nn-folder') === 'Garden');
  t.check(`${width}: with a name ready to type over`, await p.evaluate(() => document.activeElement.id === 'nn-name' && /^\d{4}-\d{2}-\d{2}$/.test(document.activeElement.value)));
  await p.fill('#nn-name', 'Ideas');
  t.check(`${width}: it says where the note will go`, (await p.textContent('#nn-path')) === 'Will be saved as Garden/Ideas.md');
  await p.selectOption('#nn-folder', 'Garden/Beds');
  t.check(`${width}: choosing another folder updates it`, (await p.textContent('#nn-path')) === 'Will be saved as Garden/Beds/Ideas.md');
  await p.fill('#nn-name', 'North');
  t.check(`${width}: a name that exists offers to open it`, (await p.textContent('#nn-path')).includes('already exists') && (await p.textContent('#nn-go')) === 'Open');
  await p.fill('#nn-name', '');
  t.check(`${width}: no name, no note`, await p.isDisabled('#nn-go'));
  await p.selectOption('#nn-folder', '\u0000new');
  t.check(`${width}: New folder asks for its name`, await p.locator('#nn-new-folder').isVisible() && await p.evaluate(() => document.activeElement.id === 'nn-new-folder'));
  await p.fill('#nn-new-folder', 'Recipes/Soups');
  await p.fill('#nn-name', 'Pumpkin');
  t.check(`${width}: a new folder goes into the path`, (await p.textContent('#nn-path')) === 'Will be saved as Recipes/Soups/Pumpkin.md');
  await p.fill('#nn-new-folder', '.secret');
  t.check(`${width}: a hidden folder is refused`, await p.isDisabled('#nn-go') && /dot/.test(await p.textContent('#nn-path')));
  await p.fill('#nn-new-folder', 'Recipes/Soups');
  await p.press('#nn-name', 'Enter');
  await p.waitForFunction(() => current?.path === 'Recipes/Soups/Pumpkin.md');
  t.check(`${width}: Enter creates it there, unsaved until you save`, await p.locator('#new-note').isHidden() && await p.isEnabled('#btn-save') && !('Recipes/Soups/Pumpkin.md' in gh.files));
  await p.click('#btn-save'); await p.waitForFunction(() => !saving);
  t.check(`${width}: and saving makes the folder on GitHub`, gh.files['Recipes/Soups/Pumpkin.md'] === '# Pumpkin\n\n');

  await openNew(); await p.keyboard.press('Escape');
  t.check(`${width}: Escape cancels`, await p.locator('#new-note').isHidden() && await p.evaluate(() => current.path) === 'Recipes/Soups/Pumpkin.md');
  await openNew(); await p.click('#nn-cancel');
  t.check(`${width}: so does Cancel`, await p.locator('#new-note').isHidden());
  await openNew(); await p.selectOption('#nn-folder', 'Garden'); await p.fill('#nn-name', 'Plan'); await p.click('#nn-go');
  await p.waitForFunction(() => current?.path === 'Garden/Plan.md');
  t.check(`${width}: Open opens the note that is there`, await H.editorValue(p) === '# Plan\n');
  await p.evaluate(() => openFile('Inbox.md')); await p.waitForFunction(() => current?.path === 'Inbox.md');
  await openNew();
  t.check(`${width}: from a top-level note it starts at the top level`, await p.inputValue('#nn-folder') === '');
  await p.click('#nn-cancel');
  t.check(`${width}: nothing hostile ran`, await p.evaluate(() => !window.__pwned) && p.errors.length === 0, p.errors.join(' | '));
  await c.close();
}
/* ===== the folder proposal's other parts ===== */
for (const width of [1280, 390]) {
  const gh = H.fakeGitHub({ files: { 'Garden/Plan.md': '# Plan\n', 'Recipes/Soup.md': 'soup\n', 'Inbox.md': 'hi\n' } });
  const c = await H.context(gh, { viewport: { width, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  const files = async () => { if (await p.evaluate(() => innerWidth <= 820 && !document.body.classList.contains('tree-open'))) { await p.click('#btn-tree'); await H.still(p); } };
  // + on a folder
  await files();
  const plus = p.getByRole('button', { name: 'New note in Recipes', exact: true });
  await p.locator('#tree .row.dir', { hasText: 'Recipes' }).hover();
  t.check(`${width}: each folder offers + for a note in it`, await plus.count() === 1 && await plus.evaluate(b => getComputedStyle(b).opacity) === '1');
  await plus.click();
  t.check(`${width}: + opens New note in that folder, and leaves the folder as it was`, await p.locator('#new-note').isVisible() &&
    await p.inputValue('#nn-folder') === 'Recipes' && await p.evaluate(() => !ui.open['Recipes']));
  await p.fill('#nn-name', 'Stew'); await p.press('#nn-name', 'Enter'); await p.waitForFunction(() => current?.path === 'Recipes/Stew.md');
  // moving a note before its first save
  t.check(`${width}: a note never saved can be moved`, await H.inMenu(p, '#btn-rename') && !await H.inMenu(p, '#btn-delete'));
  const commits = gh.commits.length;
  await H.noteAction(p, '#btn-rename');
  t.check(`${width}: Rename or move opens on its name and folder`, (await p.textContent('#nn-title')) === 'Rename or move' &&
    await p.inputValue('#nn-name') === 'Stew' && await p.inputValue('#nn-folder') === 'Recipes' && /where it is now/.test(await p.textContent('#nn-path')));
  await p.selectOption('#nn-folder', 'Garden');
  t.check(`${width}: choosing another folder offers Move`, (await p.textContent('#nn-go')) === 'Move' && (await p.textContent('#nn-path')) === 'Will be saved as Garden/Stew.md');
  await p.click('#nn-go'); await p.waitForFunction(() => current?.path === 'Garden/Stew.md');
  t.check(`${width}: it moves without a commit, still unsaved`, gh.commits.length === commits && await p.isEnabled('#btn-save') &&
    /\(new\)/.test(await p.textContent('#crumb')) && await p.evaluate(() => !!readDraft('Garden/Stew.md') && !readDraft('Recipes/Stew.md')));
  await p.click('#btn-save'); await p.waitForFunction(() => !saving && !dirty());
  t.check(`${width}: and is saved where it was moved to`, gh.files['Garden/Stew.md'] === '# Stew\n\n' && !('Recipes/Stew.md' in gh.files));
  // the folder picker for a saved note
  await H.noteAction(p, '#btn-rename'); await p.fill('#nn-name', 'Plan');
  t.check(`${width}: a name that is taken is refused in the dialog`, await p.isDisabled('#nn-go') && /already exists/.test(await p.textContent('#nn-path')));
  await p.fill('#nn-name', 'Beef stew');
  t.check(`${width}: a new name in the same folder offers Rename`, (await p.textContent('#nn-go')) === 'Rename' && (await p.textContent('#nn-path')) === 'Will move to Garden/Beef stew.md');
  await p.selectOption('#nn-folder', 'Recipes'); await p.click('#nn-go');
  await p.waitForFunction(() => current?.path === 'Recipes/Beef stew.md' && !moving);
  t.check(`${width}: a saved note moves to the chosen folder in one commit`, gh.files['Recipes/Beef stew.md'] === '# Stew\n\n' && !('Garden/Stew.md' in gh.files) &&
    gh.commits.length === commits + 2, String(gh.commits.length - commits));
  t.check(`${width}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
  await c.close();
}
/* ===== review of the folder work ===== */
{
  const gh = H.fakeGitHub({ files: { 'Garden/Plan.md': '# Plan\n', 'Recipes/Soup.md': 'soup\n', 'Dr. Smith.md': 'appointment\n' } });
  const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  // 1: no move while the first save is on its way
  await H.newNote(p, 'Stew', 'Recipes'); await p.waitForFunction(() => current?.path === 'Recipes/Stew.md');
  let release; const gate = new Promise(r => release = r);
  await p.route('**/contents/Recipes/Stew.md', async r => { if (r.request().method() === 'PUT') await gate; return r.fallback(); });
  await p.click('#btn-save'); await p.waitForFunction(() => saving);
  await H.noteAction(p, '#btn-rename'); await p.selectOption('#nn-folder', 'Garden');
  t.check('a new note cannot move while its first save is on its way', await p.isDisabled('#nn-go') && /first save/.test(await p.textContent('#nn-path')));
  await p.click('#nn-cancel'); release(); await p.waitForFunction(() => !saving && !!current.sha);
  t.check('it saved where it was', 'Recipes/Stew.md' in gh.files && await p.evaluate(() => current.path) === 'Recipes/Stew.md');
  await p.unroute('**/contents/Recipes/Stew.md');
  // 2: a note in conflict is not moved
  await H.newNote(p, 'Idea', 'Garden'); await p.waitForFunction(() => current?.path === 'Garden/Idea.md');
  gh.files['Garden/Idea.md'] = '# made on another device\n'; gh.touch();
  await H.setEditor(p, '# mine\n'); await p.click('#btn-save'); await p.waitForFunction(() => !saving && current.conflict);
  await H.noteAction(p, '#btn-rename'); await p.fill('#nn-name', 'Idea mine');
  t.check('a note in conflict cannot be moved until the conflict is resolved', await p.isDisabled('#nn-go') && /conflict/.test(await p.textContent('#nn-path')));
  await p.click('#nn-cancel');
  t.check('and its text is still there', await H.editorValue(p) === '# mine\n' && await p.evaluate(() => current.path) === 'Garden/Idea.md');
  // 3: names with a dot
  await p.evaluate(() => { current.conflict = false; });
  await p.evaluate(() => openFile('Dr. Smith.md')); await p.waitForFunction(() => current?.path === 'Dr. Smith.md' && !openingPath);
  await H.noteAction(p, '#btn-rename');
  t.check('a name with a dot opens ready to move', await p.inputValue('#nn-name') === 'Dr. Smith' && /where it is now/.test(await p.textContent('#nn-path')));
  await p.selectOption('#nn-folder', 'Garden');
  t.check('and moves with its own extension', await p.isEnabled('#nn-go') && (await p.textContent('#nn-path')) === 'Will move to Garden/Dr. Smith.md');
  await p.fill('#nn-name', 'Release 2.0');
  t.check('"Release 2.0" keeps .md too', (await p.textContent('#nn-path')) === 'Will move to Garden/Release 2.0.md');
  // 4: the quick switcher does not open over the dialog
  await p.keyboard.press('Control+k');
  t.check('Ctrl+K does not open another note over the dialog', !await p.evaluate(() => document.getElementById('quick-switcher').open));
  await p.click('#nn-cancel');
  t.check('no page errors besides the conflict itself', p.errors.filter(e => !/409/.test(e)).length === 0, p.errors.join(' | '));
  await c.close();
}
await H.stop(); t.finish();
