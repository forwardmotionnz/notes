/* [[Wikilinks]] open the note they name, the way Obsidian resolves them. */
import * as H from './harness.mjs';

const t = H.suite('wikilinks');
await H.start();

const DAILY = [
  '# 2026-09-25',
  'See [[Holflo hardware]] today.',
  'Also [[holflo HARDWARE|the kit]].',
  'And [[Missing note]].',
  'Yesterday: [[Daily/2026-09-24]].',
  'Specs: [[Holflo hardware#Specs]].',
  'Plain text here.',
  '',
].join('\n');
const VAULT = () => ({
  // Listed deepest first, so the shortest path has to be chosen, not met first.
  '.trash/Holflo hardware.md': '# trashed\n',
  'Archive/Old/2020/Holflo hardware.md': '# old copy\n',
  'Projects/Holflo/Holflo hardware.md': '# Holflo hardware\n\nthe right one\n',
  'Daily/2026-09-25.md': DAILY,
  'Daily/2026-09-24.md': '# 2026-09-24\n',
  'todo.md': '',
});

// Put the caret inside the text `needle` on the page, then click as a
// desktop (Ctrl/Cmd) or tap as a phone does.
async function hit(p, needle, how) {
  await p.evaluate(({ needle, how }) => {
    const ta = document.querySelector('#cm-stub, .fallback-editor');
    const at = ta.value.indexOf(needle) + Math.floor(needle.length / 2);
    ta.focus();
    ta.setSelectionRange(at, at);
    if (how === 'tap') ta.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    else ta.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
    ta.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: how === 'ctrl', metaKey: how === 'meta' }));
  }, { needle, how });
  await p.waitForTimeout(500);
}
const name = p => p.textContent('#crumb .name');
const dir = p => p.textContent('#crumb .dir');

async function run(label, ctxOpts) {
  const gh = H.fakeGitHub({ files: VAULT() });
  const ctx = await H.context(gh, ctxOpts);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(400);
  const open = () => p.evaluate(() => openFile('Daily/2026-09-25.md')).then(() => p.waitForTimeout(400));
  p.asked = [];
  p.removeAllListeners('dialog');
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); return p.answer ? d.accept() : d.dismiss(); });

  await open();
  await hit(p, 'Holflo hardware]]', 'mouse');
  t.check(`${label}: a plain click only places the cursor`, (await name(p)) === '2026-09-25.md');

  await hit(p, 'Holflo hardware]]', 'ctrl');
  t.check(`${label}: Ctrl-click opens the linked note`, (await name(p)) === 'Holflo hardware.md');
  t.check(`${label}: the shortest path wins, the trash is ignored`, (await dir(p)) === 'Projects/Holflo/' &&
    (await H.editorValue(p)).includes('the right one'), await dir(p));

  await open();
  await hit(p, 'the kit', 'meta');
  t.check(`${label}: Cmd-click on an alias, any case, opens it too`, (await name(p)) === 'Holflo hardware.md');

  await open();
  await hit(p, 'Daily/2026-09-24', 'ctrl');
  t.check(`${label}: a link with a folder opens that note`, (await name(p)) === '2026-09-24.md');

  await open();
  await hit(p, 'hardware#Specs', 'ctrl');
  t.check(`${label}: a link to a heading opens the note`, (await name(p)) === 'Holflo hardware.md');

  await open();
  await hit(p, 'Holflo hardware]] today', 'tap');
  t.check(`${label}: a tap on a phone opens it`, (await name(p)) === 'Holflo hardware.md');

  await open();
  await hit(p, 'Plain text', 'ctrl');
  t.check(`${label}: Ctrl-click outside a link does nothing`, (await name(p)) === '2026-09-25.md' && p.asked.length === 0);

  p.answer = false;
  await hit(p, 'Missing note', 'ctrl');
  t.check(`${label}: an unresolved link asks to create the note`, p.asked.some(m => /create/i.test(m) && m.includes('Missing note')),
    JSON.stringify(p.asked));
  t.check(`${label}: and saying no creates nothing`, (await name(p)) === '2026-09-25.md' && !('Missing note.md' in gh.files));
  p.answer = true;
  await hit(p, 'Missing note', 'ctrl');
  t.check(`${label}: saying yes opens it as a new note`, (await name(p)) === 'Missing note.md' &&
    /new/i.test(await p.textContent('#crumb')));
  await H.setEditor(p, '# Missing note\n\nnow it exists\n');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(500);
  t.check(`${label}: and saving creates it`, gh.files['Missing note.md'] === '# Missing note\n\nnow it exists\n');
  t.check(`${label}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== the edges ===== */
{
  const gh = H.fakeGitHub({ files: {
    'Home.md': 'Two: [[Alpha]] and [[Beta]].\n| a | [[Beta\\|b]] |\nUp: [[../secret]]\nNew: [[Plans/Q4]]\n',
    // Listed longest first, so the shortest has to be chosen, not met first.
    'zz/Alpha.md': 'other alpha\n', 'Alpha.md': 'alpha\n', 'x/y/Beta.md': 'deep beta\n',
    'long/Beta.md': 'long beta\n', 'x/Beta.md': 'beta\n', 'Beta notes.md': 'not it\n',
  } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); return d.dismiss(); });
  await H.signIn(p);
  await p.waitForTimeout(400);
  const open = () => p.evaluate(() => openFile('Home.md')).then(() => p.waitForTimeout(400));
  await open();
  await hit(p, 'Beta]] and', 'ctrl');   // not there: the second link on the line
  await hit(p, 'Beta]].', 'ctrl');
  t.check('two links on a line: the one clicked opens, the shorter of two at one depth', (await dir(p)) === 'x/' && (await name(p)) === 'Beta.md',
    (await dir(p)) + (await name(p)));
  await open();
  await hit(p, '[[Alpha', 'ctrl');
  t.check('the root copy beats one in a folder', (await dir(p)) === '' && (await name(p)) === 'Alpha.md');
  await open();
  await hit(p, 'Beta\\|b', 'ctrl');
  t.check("a table's escaped alias bar is not part of the name", (await dir(p)) === 'x/' && (await name(p)) === 'Beta.md');
  await open();
  await hit(p, '../secret', 'ctrl');
  t.check('a link out of the repository creates nothing and asks nothing',
    p.asked.length === 0 && (await name(p)) === 'Home.md' && /not a place/i.test(await H.status(p)), await H.status(p));

  t.check('edges: no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}
{
  // A new note written before the list of notes has arrived: unresolved
  // is not yet missing, so nothing may be offered that could duplicate a note.
  const gh = H.fakeGitHub({ files: { 'Plans/Q4.md': 'the real plans\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  let release, held = true;
  const gate = new Promise(r => { release = r; });
  await p.route('**/git/trees/**', async r => { if (held) await gate; r.fallback(); });
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); return d.type() === 'prompt' ? d.accept('Scratch') : d.dismiss(); });
  await H.signIn(p);
  await p.click('#btn-new');
  await p.waitForTimeout(200);
  await H.setEditor(p, '# Scratch\n\nsee [[Plans/Q4]]\n');
  p.asked = [];
  await hit(p, 'Plans/Q4', 'ctrl');
  t.check('before the list loads, a link does not offer to create', p.asked.length === 0 &&
    (await name(p)) === 'Scratch.md' && /not loaded/i.test(await H.status(p)), await H.status(p));
  held = false;
  release();
  await p.waitForTimeout(800);
  await hit(p, 'Plans/Q4', 'ctrl');
  t.check('once it has, the link opens the note', (await name(p)) === 'Q4.md' &&
    (await H.editorValue(p)) === 'the real plans\n', await name(p));
  t.check('edges: no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}
{
  const gh = H.fakeGitHub({ files: { 'Home.md': 'See [[Nowhere]] and [[Home]].\n' },
    repos: [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main',
              private: true, archived: true }] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); return d.accept(); });
  await H.signIn(p);
  await p.waitForTimeout(600);
  await p.evaluate(() => openFile('Home.md'));
  await p.waitForTimeout(400);
  await hit(p, 'Nowhere', 'ctrl');
  t.check('read-only: an unresolved link does not offer to create', p.asked.length === 0 &&
    (await name(p)) === 'Home.md' && /archived/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== what a link creates (review findings) ===== */
{
  const gh = H.fakeGitHub({ files: {
    'Home.md': 'Ship [[Release 1.2]] on [[Node.js]].\nPlan: [[projects/Q4]]\nRelated: [[Other]]\nLost: [[Gone]]\n',
    'Other.md': 'other\n', 'Projects/Plan.md': 'plan\n', 'Huge/Hidden.md': 'not listed\n',
  } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { p.asked.push(d.message()); return d.type() === 'prompt' ? d.accept(p.reply) : d.accept(); });
  await H.signIn(p);
  await p.waitForTimeout(400);
  const open = () => p.evaluate(() => openFile('Home.md')).then(() => p.waitForTimeout(400));
  const saveAs = async text => {
    await H.setEditor(p, text); await p.waitForTimeout(60);
    await p.click('#btn-save'); await p.waitForTimeout(500);
  };

  await open();
  await hit(p, 'Release 1.2', 'ctrl');
  t.check('a name ending in a dot-suffix is still a note: Release 1.2.md', (await name(p)) === 'Release 1.2.md',
    await name(p));
  await saveAs('# Release 1.2\n');
  t.check('which is saved as such', 'Release 1.2.md' in gh.files && !('Release 1.2' in gh.files));
  await open();
  await hit(p, 'Release 1.2', 'ctrl');
  t.check('and the link opens it afterwards', (await name(p)) === 'Release 1.2.md' &&
    (await H.editorValue(p)) === '# Release 1.2\n', await H.status(p));

  await open();
  await hit(p, 'Node.js', 'ctrl');
  t.check('[[Node.js]] makes Node.js.md, as Obsidian does', (await name(p)) === 'Node.js.md', await name(p));

  await open();
  await hit(p, 'projects/Q4', 'ctrl');
  t.check('a new note goes in the folder already there, whatever the case',
    (await dir(p)) === 'Projects/' && (await name(p)) === 'Q4.md', (await dir(p)) + (await name(p)));

  // Just after a link at the end of a line is a place to type, not a link.
  await open();
  p.asked = [];
  await p.evaluate(() => {
    const ta = document.querySelector('#cm-stub, .fallback-editor');
    for (const needle of ['[[Other]]', '[[Gone]]']) {
      for (const at of [ta.value.indexOf(needle), ta.value.indexOf(needle) + needle.length]) {
        ta.focus(); ta.setSelectionRange(at, at);
        ta.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
        ta.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
  });
  await p.waitForTimeout(500);
  t.check('a tap just before or after a link stays put', (await name(p)) === 'Home.md' && p.asked.length === 0,
    (await name(p)) + ' ' + JSON.stringify(p.asked));

  // + with a name that looks like it has an extension.
  p.reply = 'Release 2.0';
  await p.click('#btn-new');
  await p.waitForTimeout(300);
  t.check('+ "Release 2.0" makes a note too, not a file it could never reopen', (await name(p)) === 'Release 2.0.md',
    await name(p));
  p.reply = 'notes.txt';
  await p.click('#btn-new');
  await p.waitForTimeout(300);
  t.check('+ still makes a text file by its own extension', (await name(p)) === 'notes.txt', await name(p));

  // A list GitHub cut short: missing from it is not missing.
  gh.truncate = ['Huge/Hidden.md'];
  await p.click('#btn-refresh');
  await p.waitForTimeout(600);
  await H.setEditor(p, 'see [[Hidden]] and [[Other]]\n');
  p.asked = [];
  await hit(p, 'Hidden', 'ctrl');
  t.check('a partial list: an unresolved link does not offer to create', p.asked.length === 0 &&
    (await name(p)) === 'notes.txt' && /large/i.test(await H.status(p)), await H.status(p));
  await hit(p, 'Other', 'ctrl');
  t.check('a partial list: a listed note still opens', (await name(p)) === 'Other.md');

  // A refresh that failed: the list may be stale.
  gh.truncate = null;
  await p.route('**/git/trees/**', r => r.abort());
  await p.click('#btn-refresh');
  await p.waitForTimeout(600);
  await H.setEditor(p, 'other\nsee [[Brand new]]\n');
  p.asked = [];
  await hit(p, 'Brand new', 'ctrl');
  t.check('a failed refresh: an unresolved link does not offer to create', p.asked.length === 0 &&
    /not loaded/i.test(await H.status(p)), await H.status(p));
  // Only the outage injected above may be logged (fail() logs every error).
  const unexpected = p.errors.filter(e => !(/^console: /.test(e) && H.networkFailure.test(e)));
  t.check('findings: no page errors but the injected outage', unexpected.length === 0, unexpected.join(' | '));
  await ctx.close();
}

await run('CodeMirror', {});
await run('plain editor', { noCdn: true });

await H.stop();
t.finish();
