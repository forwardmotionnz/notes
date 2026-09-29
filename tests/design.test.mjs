/* N38: the redesign's own behaviour: the note's ⋯ menu, the save status,
   the Edit/Preview switch, property chips, checklist rows and icons. */
import * as H from './harness.mjs';
const t = H.suite('design'); await H.start();
const NOTE = '---\npinned: true\ntags: [car, "house"]\nstatus: <img src=x onerror=alert(1)>\n---\n# Weekend\n\n- [ ] ring [the shop](https://example.com) today\n- [ ] swap the spare\n';
for (const width of [1280, 390]) {
  const gh = H.fakeGitHub({ files: { 'jobs.md': NOTE, 'odd.md': '---\n: not a property\n---\nbody\n', 'inbox.md': 'hi\n' } });
  const c = await H.context(gh, { viewport: { width, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  t.check(`${width}: no note, no note menu or save status`, await p.locator('#btn-more').isHidden() &&
    await p.evaluate(() => getComputedStyle(document.getElementById('btn-save')).visibility === 'hidden'));
  await p.evaluate(() => openFile('jobs.md')); await p.waitForFunction(() => current?.path === 'jobs.md');
  // On a phone the dot alone says it.
  t.check(`${width}: a clean note says Saved`, await p.isDisabled('#btn-save') && (await p.locator('#btn-save').innerText()).trim() === (width === 390 ? '' : 'Saved'));
  await H.setEditor(p, NOTE + 'more\n');
  t.check(`${width}: unsaved changes offer Save`, await p.isEnabled('#btn-save') && (await p.locator('#btn-save').innerText()).trim() === 'Save' &&
    await p.getAttribute('#btn-save', 'aria-label') === 'Save');
  await p.click('#btn-save'); await p.waitForFunction(() => !saving && !dirty());

  // the note's ⋯ menu
  await p.click('#btn-more');
  // Text read from the DOM, not innerText: WebKit's innerText differs in whitespace for these flex buttons.
  const offered = await p.evaluate(() => [...document.querySelectorAll('#note-menu [role^=menuitem]')]
    .filter(b => !b.hidden && getComputedStyle(b).display !== 'none' && b.getClientRects().length).map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  const menuOpen = await p.locator('#note-menu').isVisible(), expanded = await p.getAttribute('#btn-more', 'aria-expanded');
  t.check(`${width}: ⋯ opens the note menu with its actions`, menuOpen && expanded === 'true' &&
    JSON.stringify(offered) === JSON.stringify(['Rename or move', 'Outline', 'Tags', 'Delete']), JSON.stringify({ menuOpen, expanded, offered }));
  t.check(`${width}: the first action has focus`, await p.evaluate(() => document.activeElement.id === 'btn-rename'));
  await p.keyboard.press('ArrowDown');
  t.check(`${width}: arrow keys move through the menu`, await p.evaluate(() => document.activeElement.id === 'btn-outline'));
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  t.check(`${width}: and wrap round`, await p.evaluate(() => document.activeElement.id === 'btn-delete'));
  await p.keyboard.press('Escape');
  t.check(`${width}: Escape closes it and returns focus`, await p.locator('#note-menu').isHidden() &&
    await p.evaluate(() => document.activeElement.id === 'btn-more') && await p.getAttribute('#btn-more', 'aria-expanded') === 'false');
  await p.click('#btn-more'); await p.mouse.click(5, 790);
  t.check(`${width}: a click elsewhere closes it`, await p.locator('#note-menu').isHidden());
  await H.noteAction(p, '#btn-tags');
  t.check(`${width}: Tags shows the tag bar and is marked`, await p.locator('#tag-input').isVisible() && await p.getAttribute('#btn-tags', 'aria-checked') === 'true');
  await H.noteAction(p, '#btn-tags');
  t.check(`${width}: and hides it again`, await p.locator('#tag-input').isHidden());

  // Edit / Preview
  await p.click('#btn-preview');
  t.check(`${width}: the switch says Preview is on`, await p.getAttribute('#btn-preview', 'aria-pressed') === 'true' && await p.getAttribute('#btn-preview', 'aria-label') === 'Preview');
  const chips = await p.locator('#preview .props .chip').allInnerTexts();
  t.check(`${width}: properties show as chips`, JSON.stringify(chips) === JSON.stringify(['Pinned', 'car', 'house', 'status: <img src=x onerror=alert(1)>']), JSON.stringify(chips));
  t.check(`${width}: a property value stays text`, await p.locator('#preview .props img').count() === 0);
  t.check(`${width}: headings use the reading face`, /Charter|Georgia|serif/.test(await p.evaluate(() => getComputedStyle(document.querySelector('#preview h1')).fontFamily)));

  // checklist rows
  await p.locator('#pin-list .task-text').first().click({ position: { x: 5, y: 8 } });
  t.check(`${width}: tapping a task's text edits it`, await p.locator('.task-edit').isVisible() && await p.inputValue('.task-edit') === 'ring [the shop](https://example.com) today');
  await p.locator('.task-edit').press('Escape');
  const popup = p.waitForEvent('popup').catch(() => null);
  await p.locator('#pin-list .task-text a').click();
  t.check(`${width}: a link in a task opens the link, not the editor`, await p.locator('.task-edit').count() === 0); await popup;
  await p.locator('#pin-list .task-more').first().click();
  t.check(`${width}: a task's ⋯ opens its actions`, JSON.stringify(await p.locator('#pin-list .task-menu:not([hidden]) [role=menuitem]').allInnerTexts()) === JSON.stringify(['Edit', 'Move up', 'Move down', 'Remove']));
  await p.locator('#pin-list .task-more').nth(1).evaluate(b => b.click());   // the open menu covers it on screen
  t.check(`${width}: only one task menu at a time`, await p.locator('#pin-list .task-menu:not([hidden])').count() === 1 &&
    await p.locator('#pin-list .task-more').nth(1).getAttribute('aria-expanded') === 'true' && await p.locator('#pin-list .task-more').first().getAttribute('aria-expanded') === 'false');
  await p.keyboard.press('Escape');
  t.check(`${width}: Escape closes a task menu`, await p.locator('#pin-list .task-menu:not([hidden])').count() === 0);
  await H.taskAction(p, 'Move up: swap the spare'); await p.waitForFunction(() => !Object.keys(pinBusy).length);
  t.check(`${width}: a task menu action still writes`, gh.files['jobs.md'].endsWith('# Weekend\n\n- [ ] swap the spare\nmore\n- [ ] ring [the shop](https://example.com) today\n'), JSON.stringify(gh.files['jobs.md']));

  await p.evaluate(() => openFile('odd.md')); await p.waitForFunction(() => current?.path === 'odd.md'); await H.preview(p);
  t.check(`${width}: frontmatter that is not simple stays as its text`, (await p.locator('#preview pre.frontmatter').innerText()).trim() === ': not a property');
  t.check(`${width}: nothing wider than the screen`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const broken = await p.evaluate(() => [...document.querySelectorAll('svg.i use')].map(u => u.getAttribute('href')).filter(h => !document.querySelector('#icons ' + h)));
  t.check(`${width}: every icon is in the icon set`, broken.length === 0, JSON.stringify(broken));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await c.close();
}
/* ===== review of N38 ===== */
{
  const gh = H.fakeGitHub({ files: { 'a/todo.md': '- [ ] a\n', 'b/todo.md': '- [ ] b\n', 'q.md': '---\npinned: "true"\n---\nq\n', 'n.md': 'one\n' } });
  const c = await H.context(gh, { viewport: { width: 1280, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  await p.evaluate(() => openFile('n.md')); await p.waitForFunction(() => current?.path === 'n.md');
  // a save in flight never says Saved
  let release; const gate = new Promise(r => release = r);
  await p.route('**/contents/n.md', async r => { if (r.request().method() === 'PUT') await gate; return r.fallback(); });
  await H.setEditor(p, 'two\n'); await p.click('#btn-save'); await p.waitForFunction(() => saving);
  t.check('a save on its way says Saving, not Saved', (await p.locator('#btn-save').innerText()).trim() === 'Saving…');
  release(); await p.waitForFunction(() => !saving && !dirty());
  t.check('and Saved once GitHub has it', (await p.locator('#btn-save').innerText()).trim() === 'Saved');
  // focus comes back to ⋯ after a menu action's dialog
  await p.focus('#btn-more'); await p.keyboard.press('Enter'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.getElementById('outline').open); await p.keyboard.press('Escape');
  t.check('closing Outline returns focus to ⋯', await p.evaluate(() => !document.getElementById('outline').open && document.activeElement.id === 'btn-more'));
  // tabbing out closes the menu
  await p.click('#btn-more'); await p.focus('#btn-delete'); await p.keyboard.press('Tab');
  t.check('tabbing out of the menu closes it', await p.locator('#note-menu').isHidden() && await p.getAttribute('#btn-more', 'aria-expanded') === 'false');
  // tabs with the same name show their folders
  await p.evaluate(() => openFile('a/todo.md')); await p.waitForFunction(() => current?.path === 'a/todo.md');
  await p.evaluate(() => openFile('b/todo.md')); await p.waitForFunction(() => current?.path === 'b/todo.md');
  const tabs = await p.locator('#note-tabs span button:first-child').allInnerTexts();
  t.check('two notes with one name are told apart', tabs.includes('a/todo') && tabs.includes('b/todo') && tabs.includes('n'), JSON.stringify(tabs));
  await H.preview(p);
  await p.locator('#pin-list .task-more').click(); await p.focus('#pin-list .task-menu [role=menuitem] >> nth=3'); await p.keyboard.press('Tab');
  t.check('tabbing out of a task menu closes it', await p.locator('#pin-list .task-menu:not([hidden])').count() === 0);
  await p.locator('#pin-list .task-more').click(); await p.locator('#pin-list .task-text').dispatchEvent('pointerdown');
  t.check('a tap on plain text closes a task menu', await p.locator('#pin-list .task-menu:not([hidden])').count() === 0);
  // the Pinned chip says only what the app's pin check says
  await p.evaluate(() => openFile('q.md')); await p.waitForFunction(() => current?.path === 'q.md'); await H.preview(p);
  t.check('a quoted "true" is not shown as Pinned', !(await p.locator('#preview .props').innerText()).includes('Pinned') && !(await p.evaluate(() => isPinned('q.md'))));
  await c.close();
}
{
  // on a phone the note's name stays readable during a conflict
  const gh = H.fakeGitHub({ files: { 'a rather long note name.md': 'one\n' } });
  const c = await H.context(gh, { viewport: { width: 390, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
  await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
  await p.evaluate(() => openFile('a rather long note name.md')); await p.waitForFunction(() => !!current);
  gh.files['a rather long note name.md'] = 'theirs\n'; gh.touch();
  await H.setEditor(p, 'mine\n'); await p.click('#btn-save'); await p.waitForFunction(() => !saving);
  await p.waitForSelector('#btn-copy:not([hidden])');
  const w = await p.evaluate(() => document.querySelector('#crumb .name').getBoundingClientRect().width);
  t.check('phone conflict: the note name keeps its own line', w > 150, String(w));
  t.check('phone conflict: nothing wider than the screen', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await c.close();
}
await H.stop(); t.finish();
