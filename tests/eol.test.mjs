/* Line endings: a file keeps its own, and opening one never makes a draft. */
import * as H from './harness.mjs';

const t = H.suite('eol');
await H.start();

const FILES = () => ({
  'win.md': '# Windows\r\n\r\nfirst line\r\nsecond line\r\n',
  'mac.md': '# Old Mac\r\rone\rtwo\r',
  'unix.md': '# Unix\n\nfirst line\n',
  'mixed.md': '# Mixed\r\none\r\ntwo\nthree\r\n',
  'todo.md': '# Today\r\n\r\n- [ ] ring the panelbeater\r\n- [x] swap the spare\r\n',
  'tie.md': 'a\r\nb\n',
  'stray.md': 'a\nprogress 10%\rprogress 20%\nc\n',
  'trailing.md': 'a\r\nb\r\nc\r',
  'twoedits.md': 'one\r\ntwo\nthree\r\nfour\nfive\r\n',
  'twoedits2.md': 'one\r\ntwo\nthree\r\nfour\nfive\r\n',
  // U+FEFF at the start: a byte-order mark, as Notepad writes.
  'bom.txt': '\uFEFFfirst\r\nsecond\r\n',
  // Windows-1252 "café": not UTF-8 at all.
  'latin.txt': Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0D, 0x0A]).toString('latin1'),
});
// The fake stores strings as UTF-8; this one must be stored as raw bytes.
const RAW = { 'latin.txt': true };

async function ready() {
  const gh = H.fakeGitHub({ files: FILES(), raw: RAW });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  return { gh, ctx, p };
}
const drafts = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length);
const tag = p => p.evaluate(() => document.querySelector('#crumb .tag')?.textContent || '');

{
  const { gh, ctx, p } = await ready();
  for (const f of ['win.md', 'mac.md', 'mixed.md']) {
    await H.clickRow(p, f);
    await H.settle(p, 100);
    t.check(`${f} opens clean`, await p.isDisabled('#btn-save') && (await drafts(p)) === 0 && !(await tag(p)),
      `draft=${await drafts(p)} tag=${await tag(p)}`);
  }
  await H.clickRow(p, 'win.md');
  await p.reload({ waitUntil: 'load' });
  await H.settle(p, 700);
  t.check('and is not "restored" after a reload', !/draft/i.test(await tag(p)) && await p.isDisabled('#btn-save'));
  await p.waitForTimeout(2600);
  t.check('nothing committed by opening them', gh.commits.length === 0, String(gh.commits.length));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== an edit keeps the file's own endings ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'win.md');
  const v = await H.editorValue(p);
  t.check('the editor shows plain lines', v === '# Windows\n\nfirst line\nsecond line\n', JSON.stringify(v));
  await H.setEditor(p, v.replace('second line', 'second line, edited'));
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('CRLF file saved with CRLF, only the edited line changed',
    gh.files['win.md'] === '# Windows\r\n\r\nfirst line\r\nsecond line, edited\r\n', JSON.stringify(gh.files['win.md']));

  await H.clickRow(p, 'mac.md');
  await H.setEditor(p, (await H.editorValue(p)) + 'three\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('CR file saved with CR', gh.files['mac.md'] === '# Old Mac\r\rone\rtwo\rthree\r', JSON.stringify(gh.files['mac.md']));

  await H.clickRow(p, 'unix.md');
  await H.setEditor(p, (await H.editorValue(p)) + 'second\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('LF file stays LF', gh.files['unix.md'] === '# Unix\n\nfirst line\nsecond\n', JSON.stringify(gh.files['unix.md']));

  await H.clickRow(p, 'mixed.md');
  await H.setEditor(p, (await H.editorValue(p)) + 'four\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('mixed file: untouched lines keep their own endings, new ones take the usual',
    gh.files['mixed.md'] === '# Mixed\r\none\r\ntwo\nthree\r\nfour\r\n', JSON.stringify(gh.files['mixed.md']));

  const edit = async (name, from, to) => {
    await H.clickRow(p, name);
    await H.setEditor(p, (await H.editorValue(p)).replace(from, to));
    await H.settle(p, 60);
    await p.click('#btn-save');
    await H.settle(p, 400);
  };
  await edit('tie.md', 'a', 'A');
  t.check('a tie rewrites nothing untouched', gh.files['tie.md'] === 'A\r\nb\n', JSON.stringify(gh.files['tie.md']));
  await edit('stray.md', 'a', 'A');
  t.check('a lone CR inside a line survives an edit elsewhere',
    gh.files['stray.md'] === 'A\nprogress 10%\rprogress 20%\nc\n', JSON.stringify(gh.files['stray.md']));
  await edit('trailing.md', 'a', 'A');
  t.check('a trailing lone CR survives', gh.files['trailing.md'] === 'A\r\nb\r\nc\r', JSON.stringify(gh.files['trailing.md']));
  await edit('twoedits.md', 'one', 'ONE');
  await edit('twoedits.md', 'five', 'FIVE');
  await H.clickRow(p, 'twoedits2.md');
  await H.setEditor(p, (await H.editorValue(p)).replace('one', 'ONE').replace('two\n', 'two\nnew\n')
    .replace('five', 'FIVE'));
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('edits and an insertion in one save leave the lines between untouched',
    gh.files['twoedits2.md'] === 'ONE\r\ntwo\nnew\r\nthree\r\nfour\nFIVE\r\n', JSON.stringify(gh.files['twoedits2.md']));
  t.check('two separate edits leave the lines between untouched',
    gh.files['twoedits.md'] === 'ONE\r\ntwo\nthree\r\nfour\nFIVE\r\n', JSON.stringify(gh.files['twoedits.md']));
  await ctx.close();
}

/* ===== a lost reply is recognised by its exact bytes ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'win.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/**', r => {
    if (!lose || r.request().method() !== 'PUT') return r.fallback();
    lose = false;
    return r.abort();                              // nothing landed
  });
  await H.setEditor(p, '# Windows\n\nfirst line\nsecond line!\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  // Meanwhile another device commits the same words with LF endings.
  gh.files['win.md'] = '# Windows\n\nfirst line\nsecond line!\n';
  await H.setEditor(p, '# Windows\n\nfirst line\nsecond line!!\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 600);
  t.check("a commit differing only in endings is someone else's: a conflict",
    /conflict/i.test(await H.status(p)) && gh.files['win.md'] === '# Windows\n\nfirst line\nsecond line!\n',
    await H.status(p));
  await ctx.close();
}

/* ===== what is typed is exactly what is saved, and untouched lines stay put ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const r = await p.evaluate(() => {
    const run = (raw, text) => rawFor(text, baseOf(raw));
    const norm = s => s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const cases = {
      // a typed blank line after a lone CR must not merge into "\r\n"
      blankAfterCR: run('a\rb\n', 'a\n\nb\n'),
      blankKept: run('a\rb\n', 'a\n\n'),
      blankKept2: run('x\r\ny\rz\n', 'x\ny\n\n'),
      stray: run('a\nprogress 10%\rprogress 20%\nc\n', 'a\nprogress 10%\n\nprogress 20%\nc\n'),
      // untouched lines keep their endings when others change around them
      untouched: run('u1\nu2\r\n', '\nu2\n!'),
      moved: run('A\r\nB\nC\r\nD\n', 'D\nA\nB\nC\n'),
    };
    // Seeded fuzz: whatever the file and the edit, saving and reading back
    // gives exactly what was typed.
    let seed = 12345;
    const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
    const ends = ['\r\n', '\r', '\n'];
    const words = ['', '', 'a', 'b', 'x', 'same', 'same'];
    let bad = null, count = 0;
    for (let c = 0; c < 20000 && !bad; c++) {
      let raw = rnd(4) === 0 ? '\uFEFF' : '';
      const lines = 1 + rnd(8);
      for (let k = 0; k < lines; k++) raw += words[rnd(words.length)] + (k < lines - 1 || rnd(2) ? ends[rnd(3)] : '');
      const text = norm(raw).split('\n');
      for (let e = 0; e < 1 + rnd(3); e++) {
        const at = rnd(text.length + 1), op = rnd(3);
        if (op === 0) text.splice(at, 0, words[rnd(words.length)]);
        else if (op === 1 && text.length > 1) text.splice(Math.min(at, text.length - 1), 1);
        else text[Math.min(at, text.length - 1)] = words[rnd(words.length)] + 'z';
      }
      const typed = text.join('\n');
      const out = run(raw, typed);
      count++;
      if (norm(out) !== typed) bad = { raw, typed, out };
    }
    return { cases, bad, count };
  });
  const c = r.cases;
  t.check('a blank line typed after a lone CR is kept', c.blankAfterCR.replace(/\r\n?/g, '\n') === 'a\n\nb\n' &&
    c.blankKept.replace(/\r\n?/g, '\n') === 'a\n\n' && c.blankKept2.replace(/\r\n?/g, '\n') === 'x\ny\n\n' &&
    c.stray.replace(/\r\n?/g, '\n') === 'a\nprogress 10%\n\nprogress 20%\nc\n', JSON.stringify(c));
  t.check('and the typed blank line gets a lone CR, touching nothing else', c.blankAfterCR === 'a\r\rb\n',
    JSON.stringify(c.blankAfterCR));
  t.check('an untouched line keeps its ending when a blank line appears above it', c.untouched === '\nu2\r\n!',
    JSON.stringify(c.untouched));
  t.check('moving a line leaves the others their endings', c.moved === 'D\nA\r\nB\nC\r\n', JSON.stringify(c.moved));
  t.check(`saved text always reads back as typed (${r.count} random files and edits)`, !r.bad, JSON.stringify(r.bad));
  await ctx.close();
}

/* ===== a second save compares with what the first one wrote ===== */
{
  const gh = H.fakeGitHub({ files: { 'h.md': 'H\nA\r\nB\r\n', 'todo.md': '' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'h.md');
  await H.setEditor(p, 'X\nH\nA\nB\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  await H.setEditor(p, 'X\nH2\nA\nB\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('a line untouched since the last save keeps the ending it was saved with',
    gh.files['h.md'] === 'X\r\nH2\nA\r\nB\r\n', JSON.stringify(gh.files['h.md']));
  await ctx.close();
}

/* ===== replacing a large note stays quick ===== */
{
  const big = Array.from({ length: 30000 }, (_, i) => 'line ' + i).join('\r\n') + '\r\n';
  const gh = H.fakeGitHub({ files: { 'big.md': big, 'todo.md': '' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'big.md');
  const took = await p.evaluate(() => {
    const t0 = performance.now();
    rawFor(Array.from({ length: 30000 }, (_, i) => 'other ' + i).join('\n') + '\n', current.base);
    return performance.now() - t0;
  });
  t.check('rewriting every line of a 30,000-line note takes well under a second', took < 1000, took.toFixed(0) + ' ms');
  await ctx.close();
}

/* ===== byte-order mark, and text that is not UTF-8 ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'bom.txt');
  t.check('a BOM file opens clean, the mark not shown', await p.isDisabled('#btn-save') &&
    (await H.editorValue(p)) === 'first\nsecond\n', JSON.stringify(await H.editorValue(p)));
  await H.setEditor(p, 'first\nsecond, edited\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('and keeps its BOM and CRLF when saved', gh.files['bom.txt'] === '\uFEFFfirst\r\nsecond, edited\r\n',
    JSON.stringify(gh.files['bom.txt']));

  await H.clickRow(p, 'latin.txt');
  t.check('text that is not UTF-8 is not opened', (await H.editorValue(p)) === 'first\nsecond, edited\n' &&
    /not utf-8/i.test(await H.status(p)), await H.status(p));
  await p.waitForTimeout(2600);
  t.check('and never written', gh.commits.every(c => c.path !== 'latin.txt'));
  await ctx.close();
}

/* ===== pinned task list in a CRLF file ===== */
{
  const { gh, ctx, p } = await ready();
  const tasks = await p.$$eval('#pin-list .task span', e => e.map(s => s.textContent));
  t.check('CRLF tasks are listed', JSON.stringify(tasks) === '["ring the panelbeater","swap the spare"]', JSON.stringify(tasks));
  await p.locator('#pin-list .task input').nth(0).click();
  await H.settle(p, 400);
  t.check('ticking keeps CRLF and changes one line',
    gh.files['todo.md'] === '# Today\r\n\r\n- [x] ring the panelbeater\r\n- [x] swap the spare\r\n', JSON.stringify(gh.files['todo.md']));
  await p.fill('#pin-input', 'book the wof');
  await p.press('#pin-input', 'Enter');
  await H.settle(p, 400);
  t.check('capture appends with CRLF', gh.files['todo.md'].endsWith('- [x] swap the spare\r\n- [ ] book the wof\r\n'),
    JSON.stringify(gh.files['todo.md']));
  await ctx.close();
}

await H.stop();
t.finish();
