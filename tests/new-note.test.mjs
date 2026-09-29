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
await H.stop(); t.finish();
