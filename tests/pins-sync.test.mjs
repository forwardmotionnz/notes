/* N15: a pin is `pinned: true` in the note's frontmatter (an ordinary
   Obsidian property), so it follows the note to every device and editor.
   Each browser finds pinned notes by reading each note version once. */
import * as H from './harness.mjs';

const t = H.suite('pins-sync');
await H.start();

const pinTabs = p => p.$$eval('#pin-tabs button', e => e.map(b => b.textContent));
async function device(gh, opts = {}) {
  const ctx = await H.context(gh, opts);
  const p = await H.page(ctx);
  const reads = [];
  p.on('request', r => { if (r.method() === 'GET' && r.url().includes('/contents/')) reads.push(decodeURIComponent(r.url().split('/contents/')[1].split('?')[0])); });
  p.reads = reads;
  await H.signIn(p);
  await H.settle(p, 3000);
  return { ctx, p };
}

/* ===== found on a device that has never seen them ===== */
{
  const gh = H.fakeGitHub({ files: {
    'Projects/plan.md': '---\ntitle: Plan\npinned: true\n---\n# Plan\n',
    'shopping.md': '---\npinned: true\n---\n- [ ] milk\n',
    'notes.md': '# Notes\n',
    'false.md': '---\npinned: false\n---\n',
    'body-only.md': '# Body\n\npinned: true\n',
    '.obsidian/hidden.md': '---\npinned: true\n---\n',
  } });
  const { ctx, p } = await device(gh);
  const tabs = await pinTabs(p);
  t.check('fresh device: pinned notes listed', tabs.includes('plan.md') && tabs.includes('shopping.md'), JSON.stringify(tabs));
  t.check('fresh device: only the pinned ones', !tabs.includes('notes.md') && !tabs.includes('false.md') && !tabs.includes('body-only.md') && !tabs.includes('hidden.md'),
    JSON.stringify(tabs));
  t.check('fresh device: nothing written', gh.commits.length === 0);
  t.check('fresh device: the help says pins travel with the note', /every device/i.test(await p.textContent('#pin-help')), await p.textContent('#pin-help'));
  // A second visit reads nothing it has already read.
  const before = p.reads.length;
  await p.reload();
  await H.settle(p, 3000);
  const again = p.reads.slice(before).filter(r => r !== 'todo.md' && r !== 'Projects/plan.md' && r !== 'shopping.md');
  t.check('second visit: unchanged notes not read again', again.length === 0, JSON.stringify(p.reads.slice(before)));
  t.check('second visit: still listed', (await pinTabs(p)).includes('plan.md'));
  // Pinned elsewhere, then seen here: only that note is read.
  gh.files['notes.md'] = '---\npinned: true\n---\n# Notes\n'; gh.touch();
  const mark = p.reads.length;
  await p.click('#btn-refresh');
  await H.settle(p, 3000);
  t.check('pinned on another device: appears after a refresh', (await pinTabs(p)).includes('notes.md'), JSON.stringify(await pinTabs(p)));
  t.check('pinned on another device: only that note read', JSON.stringify(p.reads.slice(mark).filter(r => r.endsWith('.md') && r !== 'todo.md')) === '["notes.md"]',
    JSON.stringify(p.reads.slice(mark)));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== pin: written into the note, seen by another device ===== */
{
  const gh = H.fakeGitHub({ files: { 'ideas.md': '# Ideas\n\nfirst\n', 'withprops.md': '---\ntitle: Props\ntags: [a, b]\n---\nbody\n' } });
  const { ctx, p } = await device(gh);
  await H.clickRow(p, 'ideas.md');
  t.check('pin: unpinned to start with', (await p.getAttribute('#btn-pin', 'aria-pressed')) === 'false');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('pin: saved in the note as a property', gh.files['ideas.md'] === '---\npinned: true\n---\n# Ideas\n\nfirst\n', JSON.stringify(gh.files['ideas.md']));
  t.check('pin: one commit', gh.commits.length === 1);
  t.check('pin: pressed and listed', (await p.getAttribute('#btn-pin', 'aria-pressed')) === 'true' && (await pinTabs(p)).includes('ideas.md'));
  t.check('pin: not kept as a browser-only pin', await p.evaluate(() => !JSON.parse(localStorage.getItem('notes.config.v2')).pins.includes('ideas.md')));
  const other = await device(gh);
  t.check('another device: sees the pin', (await pinTabs(other.p)).includes('ideas.md'), JSON.stringify(await pinTabs(other.p)));
  await other.ctx.close();
  // Existing properties are kept exactly.
  await H.clickRow(p, 'withprops.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('pin with properties: added, others kept', gh.files['withprops.md'] === '---\ntitle: Props\ntags: [a, b]\npinned: true\n---\nbody\n',
    JSON.stringify(gh.files['withprops.md']));
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('unpin with properties: only that line goes', gh.files['withprops.md'] === '---\ntitle: Props\ntags: [a, b]\n---\nbody\n',
    JSON.stringify(gh.files['withprops.md']));
  await H.clickRow(p, 'ideas.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('unpin: the note is back exactly as it was', gh.files['ideas.md'] === '# Ideas\n\nfirst\n', JSON.stringify(gh.files['ideas.md']));
  t.check('unpin: no longer listed', !(await pinTabs(p)).includes('ideas.md'));
  const third = await device(gh);
  t.check('another device: sees the unpin', !(await pinTabs(third.p)).includes('ideas.md'));
  await third.ctx.close();
  await ctx.close();
}

/* ===== line endings and unsaved words ===== */
{
  const gh = H.fakeGitHub({ files: { 'win.md': '﻿# Win\r\n\r\ntext\r\n', 'draft.md': '# Draft\n' } });
  const { ctx, p } = await device(gh);
  await H.clickRow(p, 'win.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('CRLF and BOM: kept, the new lines too', gh.files['win.md'] === '﻿---\r\npinned: true\r\n---\r\n# Win\r\n\r\ntext\r\n', JSON.stringify(gh.files['win.md']));
  await H.clickRow(p, 'draft.md');
  await H.setEditor(p, '# Draft\n\nnot saved yet\n');
  await H.settle(p, 60);
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('unsaved words: saved with the pin, none lost', gh.files['draft.md'] === '---\npinned: true\n---\n# Draft\n\nnot saved yet\n',
    JSON.stringify(gh.files['draft.md']));
  await ctx.close();
}

/* ===== pins from before carry over; files that cannot hold a property ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '- [ ] one\n', 'list.txt': 'plain text\n' } });
  const { ctx, p } = await device(gh);
  t.check('browser pins from before: still listed', (await pinTabs(p)).includes('todo.md'));
  await H.clickRow(p, 'list.txt');
  await p.click('#btn-pin');
  await H.settle(p, 1500);
  t.check('not a Markdown note: pinned in this browser, nothing written', gh.commits.length === 0 && (await pinTabs(p)).includes('list.txt')
    && gh.files['list.txt'] === 'plain text\n');
  await H.clickRow(p, 'todo.md');
  await p.click('#btn-pin');
  await H.settle(p, 1500);
  t.check('unpinning a browser pin: gone, nothing written', !(await pinTabs(p)).includes('todo.md') && gh.commits.length === 0);
  await ctx.close();
}
{
  const repos = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main', private: true,
    permissions: { admin: false, maintain: false, push: false, triage: false, pull: true } }];
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n', 'b.md': '---\npinned: true\n---\n' }, repos });
  const { ctx, p } = await device(gh);
  t.check('read-only repository: pinned notes still listed', (await pinTabs(p)).includes('b.md'));
  await H.clickRow(p, 'a.md');
  await p.click('#btn-pin');
  await H.settle(p, 1500);
  t.check('read-only repository: pins in this browser, nothing sent', gh.commits.length === 0 && !gh.log.refusedWrites && (await pinTabs(p)).includes('a.md'));
  t.check('read-only repository: the note is left as it was', (await H.editorValue(p)) === '# A\n' && !(await p.evaluate(() => dirty())));
  await ctx.close();
}

/* ===== the list follows the notes ===== */
{
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n', 'off.md': '---\ntitle: Off\npinned: false\n---\n', 'typed.md': '# Typed\n' } });
  const { ctx, p } = await device(gh);
  // A property typed by hand counts once saved.
  await H.clickRow(p, 'typed.md');
  await H.setEditor(p, '---\npinned: true\n---\n# Typed\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 3000);
  t.check('typed by hand: listed once saved', (await pinTabs(p)).includes('typed.md'), JSON.stringify(await pinTabs(p)));
  // "pinned: false" becomes true, never both.
  await H.clickRow(p, 'off.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('pinned: false becomes true', gh.files['off.md'] === '---\ntitle: Off\npinned: true\n---\n', JSON.stringify(gh.files['off.md']));
  // Renamed: listed under its new name only.
  await H.clickRow(p, 'a.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('b.md') : d.accept());
  await p.click('#btn-rename');
  await H.settle(p, 3000);
  const tabs = await pinTabs(p);
  t.check('renamed: listed under the new name only', tabs.includes('b.md') && !tabs.includes('a.md'), JSON.stringify(tabs));
  // Deleted: gone from the list.
  await p.click('#btn-delete');
  await H.settle(p, 3000);
  t.check('deleted: gone from the list', !(await pinTabs(p)).includes('b.md') && !('b.md' in gh.files), JSON.stringify(await pinTabs(p)));
  await p.reload();
  await H.settle(p, 3000);
  t.check('deleted: and after a reload', !(await pinTabs(p)).some(n => n === 'a.md' || n === 'b.md'), JSON.stringify(await pinTabs(p)));
  await ctx.close();
}
{
  // Pinned while a scan is still reading: the scan's older answer does not undo it.
  const files = {};
  for (let i = 0; i < 40; i++) files[`s/${i}.md`] = `# ${i}\n`;
  // mine.md first: the scan reads it before the pin, and must not undo it later.
  const gh = H.fakeGitHub({ files: { 'mine.md': '# Mine\n', ...files } });
  const ctx = await H.context(gh);
  let slow = true;
  await ctx.route('https://api.github.com/repos/**/contents/s/**', async r => { if (slow) await new Promise(res => setTimeout(res, 150)); return r.fallback(); });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'mine.md');
  t.check('mid-scan: a scan is running', await p.evaluate(() => pinScanning));
  await p.click('#btn-pin');
  await p.waitForFunction(() => !pinScanning && !saving, null, { timeout: 30000 });
  await H.settle(p, 500);
  t.check('mid-scan: the pin stays listed', (await pinTabs(p)).includes('mine.md'), JSON.stringify(await pinTabs(p)));
  await ctx.close();
}

/* ===== review: what pinning must never do to a note ===== */
{
  const gh = H.fakeGitHub({ files: {
    'draft.md': 'server text\n', 'dots.md': '---\ntitle: X\n...\nbody\n', 'list.md': '---\npinned:\n  - x\ntitle: y\n---\nbody\n', 'other.md': 'x\n',
  } });
  const { ctx, p } = await device(gh);
  // A restored draft is never saved by pinning.
  await H.clickRow(p, 'draft.md');
  const key = await p.evaluate(() => draftKey('draft.md')), sha = await p.evaluate(() => current.sha);
  await H.clickRow(p, 'other.md');
  await p.evaluate(([k, sha]) => localStorage.setItem(k, JSON.stringify({ text: 'old draft I meant to discard\n', sha, at: Date.now() })), [key, sha]);
  await H.clickRow(p, 'draft.md');
  await p.click('#btn-pin');
  await H.settle(p, 2000);
  t.check('restored draft: not saved by pinning', gh.files['draft.md'] === 'server text\n' && gh.commits.length === 0, JSON.stringify(gh.files['draft.md']));
  t.check('restored draft: says what to do', /save or discard/i.test(await p.textContent('#status')), await p.textContent('#status'));
  // Frontmatter ending in "..." is frontmatter.
  await H.clickRow(p, 'dots.md');
  await p.click('#btn-pin');
  await H.settle(p, 3000);
  t.check('"..." frontmatter: the pin goes inside it', gh.files['dots.md'] === '---\ntitle: X\npinned: true\n...\nbody\n', JSON.stringify(gh.files['dots.md']));
  t.check('"..." frontmatter: seen as pinned', (await pinTabs(p)).includes('dots.md'));
  // A "pinned" property used for something else is never overwritten.
  await H.clickRow(p, 'list.md');
  await p.click('#btn-pin');
  await H.settle(p, 2000);
  t.check('"pinned" used already: the note untouched', gh.files['list.md'] === '---\npinned:\n  - x\ntitle: y\n---\nbody\n', JSON.stringify(gh.files['list.md']));
  t.check('"pinned" used already: pinned in this browser, and says so', (await pinTabs(p)).includes('list.md') && /this browser only/.test(await p.textContent('#status')),
    await p.textContent('#status'));
  await ctx.close();
}

/* ===== review: the list shown stays the one shown ===== */
{
  const files = {};
  for (let i = 0; i < 30; i++) files[`s/${i}.md`] = `# ${i}\n`;
  const gh = H.fakeGitHub({ files: { 'z.md': '---\npinned: true\n---\n- [ ] zebra\n', ...files, 'a.md': '---\npinned: true\n---\n- [ ] apple\n' } });
  const ctx = await H.context(gh);
  await ctx.route('https://api.github.com/repos/**/contents/s/**', async r => { await new Promise(res => setTimeout(res, 100)); return r.fallback(); });
  // a.md is found only after z.md is on screen, and sorts ahead of it.
  await ctx.route('https://api.github.com/repos/**/contents/a.md*', async r => { await new Promise(res => setTimeout(res, 2500)); return r.fallback(); });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'z.md');
  t.check('scan adds a pin ahead: setup, not found yet', !(await pinTabs(p)).includes('a.md'));
  await p.evaluate(() => showTasks());
  await p.waitForFunction(() => !pinScanning, null, { timeout: 30000 });
  await H.settle(p, 500);
  t.check('scan adds a pin ahead: still showing the same list', await p.evaluate(() => activePin()) === 'z.md', await p.evaluate(() => activePin()));
  t.check('scan adds a pin ahead: its tab still the one marked', (await p.textContent('#pin-tabs button.active')) === 'z.md');
  await p.fill('#pin-input', 'zucchini');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 3000);
  t.check('scan adds a pin ahead: a new task goes where it is shown', gh.files['z.md'].includes('zucchini') && !gh.files['a.md'].includes('zucchini'));
  await ctx.close();
}

/* ===== review: a scan keeps what it read ===== */
{
  const files = {};
  for (let i = 0; i < 60; i++) files[`s/${i}.md`] = `# ${i}\n`;
  const gh = H.fakeGitHub({ files: { 'pinned.md': '---\npinned: true\n---\n', ...files, 'bad.md': 'caf\xe9\n' }, raw: { 'bad.md': true } });
  const ctx = await H.context(gh);
  const reads = [];
  ctx.on('request', r => { if (r.method() === 'GET' && r.url().includes('/contents/')) reads.push(decodeURIComponent(r.url().split('/contents/')[1].split('?')[0])); });
  let slow = 400;                                       // 60 notes, 4 at a time: about 6 s
  await ctx.route('https://api.github.com/repos/**/contents/s/**', async r => { await new Promise(res => setTimeout(res, slow)); return r.fallback(); });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(1500);                         // part of the way through
  for (let i = 0; i < 3; i++) { await p.click('#btn-refresh'); await p.waitForTimeout(300); }
  t.check('cut short: setup, still scanning', await p.evaluate(() => pinScanning));
  await p.reload();                                     // the page closed mid-scan
  await p.waitForFunction(() => !pinScanning, null, { timeout: 30000 });
  const counted = reads.filter(r => r.startsWith('s/'));
  // Refreshing loses nothing; the page closing loses at most the four reads then in flight.
  t.check('cut short and refreshed: each note read once, bar those in flight at the close', new Set(counted).size === 60 && counted.length <= 64, `${counted.length} reads`);
  slow = 2000;
  const mark = reads.length;
  await p.reload();
  await p.waitForSelector('#pin-tabs button');
  t.check('known pins show at once', (await pinTabs(p)).includes('pinned.md'));
  await p.waitForFunction(() => !pinScanning, null, { timeout: 30000 });
  t.check('a note that cannot be opened is not read again', !reads.slice(mark).includes('bad.md'), JSON.stringify(reads.slice(mark)));
  await ctx.close();
}

{
  // Offline (or the page closing): the scan stops, and carries on next time.
  const files = {};
  for (let i = 0; i < 60; i++) files[`s/${i}.md`] = `# ${i}\n`;
  const gh = H.fakeGitHub({ files: { ...files, 'z.md': '---\npinned: true\n---\n' } });
  const ctx = await H.context(gh);
  let tries = 0, offline = false;
  await ctx.route('https://api.github.com/repos/**/contents/s/**', r => {
    if (!offline) return r.fallback();
    tries++; return r.abort();
  });
  offline = true;
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForFunction(() => !pinScanning, null, { timeout: 30000 });
  t.check('offline: the scan stops instead of trying every note', tries > 0 && tries <= 4, `${tries} tries`);
  offline = false;
  await p.click('#btn-refresh');
  await p.waitForFunction(() => !pinScanning, null, { timeout: 30000 });
  await H.settle(p, 500);
  t.check('back online: carries on', (await pinTabs(p)).includes('z.md'), JSON.stringify(await pinTabs(p)));
  p.errors.length = 0;
  await ctx.close();
}

/* ===== bounded on a large repository ===== */
{
  const files = {};
  for (let i = 0; i < 520; i++) files[`n/${String(i).padStart(3, '0')}.md`] = i === 519 ? '---\npinned: true\n---\n' : `# ${i}\n`;
  const gh = H.fakeGitHub({ files });
  const { ctx, p } = await device(gh);
  await p.waitForFunction(() => /500 of 520/.test(document.getElementById('pin-help').textContent), null, { timeout: 30000 }).catch(() => {});
  t.check('large repository: at most 500 notes read at a time', p.reads.filter(r => r.startsWith('n/')).length === 500, String(p.reads.filter(r => r.startsWith('n/')).length));
  t.check('large repository: says the search is partial', /500 of 520/.test(await p.textContent('#pin-help')), await p.textContent('#pin-help'));
  await p.reload();
  await p.waitForFunction(() => [...document.querySelectorAll('#pin-tabs button')].some(b => b.textContent === '519.md'), null, { timeout: 30000 }).catch(() => {});
  t.check('large repository: the rest are read on the next visit', (await pinTabs(p)).includes('519.md'), JSON.stringify(await pinTabs(p)));
  await ctx.close();
}

await H.stop();
t.finish();
