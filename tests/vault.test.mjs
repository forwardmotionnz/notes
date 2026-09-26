/* An existing Obsidian vault, laid out the way Obsidian lays one out. */
import * as H from './harness.mjs';

const t = H.suite('vault');
await H.start();

// A real 10x10 PNG, so "binary" means binary.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8Awk4ExhoGBgQEA' +
                        'HgwD/2sAAAAASUVORK5CYII=', 'base64').toString('latin1');

const VAULT = () => ({
  '.obsidian/app.json': '{"promptDelete":false}',
  '.obsidian/workspace.json': '{"main":{}}',
  '.obsidian/plugins/dataview/main.js': '/* plugin */',
  '.trash/old idea.md': '# Old\n',
  '.gitignore': '.obsidian/workspace.json\n',
  'Daily Notes/2026-09-24.md': '# 2026-09-24\n\n- [ ] ring the panelbeater\n',
  'Daily Notes/2026-09-25.md': '# 2026-09-25\n\nSee [[Holflo hardware]].\n',
  'Work/AI Programme/Reunião com a equipa.md': '# Reunião\n\nação, coração.\n',
  'Holflo/Holflo hardware.md': '# Holflo hardware\n',
  'Holflo/Board layout.canvas': '{"nodes":[],"edges":[]}',
  'attachments/Pasted image 20260822112523.png': PNG,
  'attachments/datasheet.pdf': '%PDF-1.4\n',
  'attachments/sketch.excalidraw': '{"type":"excalidraw"}',
  'todo.md': '# Today\n',
});

async function ready(pins) {
  const gh = H.fakeGitHub({ files: VAULT() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  if (pins) {
    await p.click('#btn-settings');
    await p.waitForSelector('#f-save:not([disabled])');
    await p.fill('#f-pins', pins);
    await p.click('#f-save');
    await H.settle(p, 450);
  }
  return { gh, ctx, p };
}

{
  const { ctx, p } = await ready();
  const top = await H.rows(p);
  t.check('.obsidian, .trash and dotfiles hidden',
    !top.some(r => r.startsWith('.')), JSON.stringify(top));
  t.check('vault folders shown',
    ['Daily Notes', 'Holflo', 'Work', 'attachments'].every(d => top.includes(d)));
  await p.fill('#filter', 'json');
  await H.settle(p, 80);
  t.check('filter does not surface hidden config', (await H.rows(p)).length === 0);
  await p.fill('#filter', 'reuni');
  await H.settle(p, 80);
  t.check('filter matches accented names',
    (await H.rows(p)).includes('Work/AI Programme/Reunião com a equipa.md'));
  await p.fill('#filter', '');
  await ctx.close();
}

{
  const { gh, ctx, p } = await ready();
  await H.expand(p, 'attachments');
  const bin = await p.$$eval('#tree .row.binary', e => e.map(x => x.textContent.trim()));
  t.check('images and PDFs marked unopenable',
    bin.includes('Pasted image 20260822112523.png') && bin.includes('datasheet.pdf'), JSON.stringify(bin));
  t.check('.excalidraw stays openable', !bin.includes('sketch.excalidraw'));
  const before = gh.files['attachments/Pasted image 20260822112523.png'];
  await H.clickRow(p, 'Pasted image 20260822112523.png');
  t.check('clicking a PNG loads nothing', (await H.editorValue(p)) === null);
  t.check('and says why', (await H.status(p)).includes('not a text file'));
  t.check('PNG untouched, no commit', gh.files['attachments/Pasted image 20260822112523.png'] === before &&
    gh.commits.length === 0);

  // Other ways to reach it than the tree: an Obsidian embed, followed as a
  // link, and the last file remembered across a reload.
  gh.files['embeds.md'] = 'Look: ![[Pasted image 20260822112523.png]]\n';
  await p.evaluate(() => openFile('embeds.md'));
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const ta = document.querySelector('#cm-stub, .fallback-editor');
    const at = ta.value.indexOf('Pasted image') + 3;
    ta.focus(); ta.setSelectionRange(at, at);
    ta.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
  });
  await p.waitForTimeout(400);
  t.check('a link to a PNG does not open it either', (await p.textContent('#crumb .name')) === 'embeds.md' &&
    (await H.status(p)).includes('not a text file'), await H.status(p));
  await p.evaluate(() => {
    const ui = JSON.parse(localStorage.getItem('notes.ui.v1') || '{}');
    ui.last = 'attachments/Pasted image 20260822112523.png';
    localStorage.setItem('notes.ui.v1', JSON.stringify(ui));
  });
  await p.reload();
  await p.waitForTimeout(800);
  t.check('nor does coming back to it after a reload', (await H.editorValue(p)) === null ||
    !/PNG|\uFFFD/.test(await H.editorValue(p)), await H.status(p));
  t.check('and still nothing is committed', gh.files['attachments/Pasted image 20260822112523.png'] === before &&
    gh.commits.length === 0);
  await ctx.close();
}

{
  const { gh, ctx, p } = await ready();
  await H.expand(p, 'Work');
  await H.expand(p, 'AI Programme');
  await H.clickRow(p, 'Reunião com a equipa.md');
  t.check('spaces and accents in the path open', (await H.editorValue(p)) === '# Reunião\n\nação, coração.\n');
  await H.setEditor(p, '# Reunião\n\natualizado — ç\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 350);
  t.check('and save back to the same path',
    gh.files['Work/AI Programme/Reunião com a equipa.md'] === '# Reunião\n\natualizado — ç\n');
  await ctx.close();
}

{
  const { gh, ctx, p } = await ready('Daily Notes/2026-09-24.md');
  await p.fill('#pin-input', 'get the guard lip straightened');
  await p.click('#pin-go');
  await H.settle(p, 400);
  t.check('a nested daily note works as the pinned todo',
    gh.files['Daily Notes/2026-09-24.md'].endsWith('- [ ] get the guard lip straightened\n'));
  await ctx.close();
}

{
  const { gh, ctx, p } = await ready();
  await H.expand(p, 'Daily Notes');
  await H.clickRow(p, '2026-09-25.md');
  const before = gh.files['Daily Notes/2026-09-25.md'];
  await H.setEditor(p, before + 'Also [[Board layout.canvas]] #tag\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 350);
  t.check('wikilinks and tags written back unchanged',
    gh.files['Daily Notes/2026-09-25.md'] === before + 'Also [[Board layout.canvas]] #tag\n');
  t.check('no page errors on a vault', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

await H.stop();
t.finish();
