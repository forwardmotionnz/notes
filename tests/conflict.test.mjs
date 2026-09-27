/* N14: a save refused because the note changed on GitHub is merged with
   their version when the two changed different lines, and otherwise offers
   to keep both: theirs as the file, mine as a new note beside it. Nothing
   either side wrote is lost, and nothing is guessed. */
import * as H from './harness.mjs';

const t = H.suite('conflict');
await H.start();

const BASE = 'one\ntwo\nthree\nfour\nfive\n';

async function ready(files = { 'inbox.md': BASE }) {
  const gh = H.fakeGitHub({ files });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  return { gh, ctx, p };
}
// Someone else commits, from another device.
const elsewhere = (gh, text, path = 'inbox.md') => { gh.files[path] = text; gh.touch(); };
async function save(p) {
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 3000);
}
const crumb = p => p.textContent('#crumb');
const status = p => p.textContent('#status');
const drafts = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')));

/* ===== different lines: merged and saved ===== */
{
  const { gh, ctx, p } = await ready();
  elsewhere(gh, 'ONE (theirs)\ntwo\nthree\nfour\nfive\n');
  await H.setEditor(p, 'one\ntwo\nthree\nfour\nFIVE (mine)\n');
  await save(p);
  const want = 'ONE (theirs)\ntwo\nthree\nfour\nFIVE (mine)\n';
  t.check('different lines: both changes saved', gh.files['inbox.md'] === want, JSON.stringify(gh.files['inbox.md']));
  t.check('different lines: the editor shows the merged note', (await H.editorValue(p)) === want, JSON.stringify(await H.editorValue(p)));
  t.check('different lines: not left in conflict', !/conflict/i.test(await crumb(p)), await crumb(p));
  t.check('different lines: the person is told', /merged/i.test(await status(p)), await status(p));
  t.check('different lines: no draft left', (await drafts(p)).length === 0, JSON.stringify(await drafts(p)));
  t.check('different lines: Save off again', await p.isDisabled('#btn-save'));
  t.check('different lines: no copy made', Object.keys(gh.files).length === 1, JSON.stringify(Object.keys(gh.files)));
  t.check('no page errors', p.errors.filter(e => !/409|Conflict/.test(e)).length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== autosave merges too ===== */
{
  const { gh, ctx, p } = await ready();
  elsewhere(gh, 'one\ntwo\nthree (theirs)\nfour\nfive\n');
  await H.setEditor(p, 'one (mine)\ntwo\nthree\nfour\nfive\n');
  await p.waitForTimeout(3500);
  await H.settle(p, 2000);
  t.check('autosave: merged and saved', gh.files['inbox.md'] === 'one (mine)\ntwo\nthree (theirs)\nfour\nfive\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== lines added and removed on each side ===== */
{
  const { gh, ctx, p } = await ready();
  elsewhere(gh, 'one\ntwo\nfour\nfive\nsix (theirs)\n');                 // removed three, added six
  await H.setEditor(p, 'zero (mine)\none\ntwo\nthree\nfour\nfive\n');   // added zero at the top
  await save(p);
  t.check('added and removed: combined', gh.files['inbox.md'] === 'zero (mine)\none\ntwo\nfour\nfive\nsix (theirs)\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== the same change on both sides is not a conflict ===== */
{
  const { gh, ctx, p } = await ready();
  elsewhere(gh, 'one\ntwo (fixed)\nthree\nfour\nfive\n');
  await H.setEditor(p, 'one\ntwo (fixed)\nthree\nfour\nfive (mine)\n');
  await save(p);
  t.check('same change both sides: taken once', gh.files['inbox.md'] === 'one\ntwo (fixed)\nthree\nfour\nfive (mine)\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== the same lines changed differently: never guessed ===== */
{
  const { gh, ctx, p } = await ready();
  const theirs = 'one\ntwo (theirs)\nthree\nfour\nfive\n';
  const mine = 'one\ntwo (mine)\nthree\nfour\nfive\n';
  elsewhere(gh, theirs);
  await H.setEditor(p, mine);
  await save(p);
  t.check('same lines: theirs left as it is', gh.files['inbox.md'] === theirs, JSON.stringify(gh.files['inbox.md']));
  t.check('same lines: no conflict markers written anywhere', !Object.values(gh.files).some(f => /<<<<<<<|>>>>>>>/.test(f)));
  t.check('same lines: marked as a conflict', /conflict/i.test(await crumb(p)), await crumb(p));
  t.check('same lines: my text still in the editor', (await H.editorValue(p)) === mine);
  t.check('same lines: and kept as a draft', (await drafts(p)).length === 1);
  t.check('same lines: keeping both is offered', await p.isVisible('#btn-copy'));
  t.check('same lines: the message says how', /copy/i.test(await status(p)) && !/copy your text/i.test(await status(p)),
    await status(p));
  await p.click('#btn-copy');
  await H.settle(p, 3000);
  t.check('keep both: mine saved as a new note beside it', gh.files['inbox (my copy).md'] === mine,
    JSON.stringify(Object.keys(gh.files)));
  t.check('keep both: theirs untouched', gh.files['inbox.md'] === theirs);
  t.check('keep both: the note now shows theirs', (await H.editorValue(p)) === theirs, JSON.stringify(await H.editorValue(p)));
  t.check('keep both: conflict over', !/conflict/i.test(await crumb(p)) && !(await p.isVisible('#btn-copy')), await crumb(p));
  t.check('keep both: no draft left', (await drafts(p)).length === 0, JSON.stringify(await drafts(p)));
  t.check('keep both: says where mine went', (await status(p)).includes('inbox (my copy).md'), await status(p));
  t.check('keep both: the copy is in the list', (await H.rows(p)).includes('inbox (my copy).md'), JSON.stringify(await H.rows(p)));
  await ctx.close();
}

/* ===== a copy never replaces an existing note ===== */
{
  const { gh, ctx, p } = await ready({ 'inbox.md': BASE, 'inbox (my copy).md': 'an older copy\n' });
  elsewhere(gh, 'one\ntwo (theirs)\nthree\nfour\nfive\n');
  await H.setEditor(p, 'one\ntwo (mine)\nthree\nfour\nfive\n');
  await save(p);
  await p.click('#btn-copy');
  await H.settle(p, 3000);
  t.check('name taken: the older copy kept', gh.files['inbox (my copy).md'] === 'an older copy\n');
  t.check('name taken: a new name used', gh.files['inbox (my copy 2).md'] === 'one\ntwo (mine)\nthree\nfour\nfive\n',
    JSON.stringify(Object.keys(gh.files)));
  await ctx.close();
}

/* ===== the copy fails to save: nothing is lost ===== */
{
  const { gh, ctx, p } = await ready();
  const mine = 'one\ntwo (mine)\nthree\nfour\nfive\n';
  elsewhere(gh, 'one\ntwo (theirs)\nthree\nfour\nfive\n');
  await H.setEditor(p, mine);
  await save(p);
  await ctx.route('https://api.github.com/repos/**/contents/**', r =>
    r.request().method() === 'PUT' ? r.fulfill({ status: 502, contentType: 'application/json', body: '{"message":"Server Error"}' }) : r.fallback());
  await p.click('#btn-copy');
  await H.settle(p, 3000);
  t.check('copy failed: my text still in the editor', (await H.editorValue(p)) === mine);
  t.check('copy failed: and in the draft', (await drafts(p)).length === 1);
  t.check('copy failed: still a conflict, still offered', /conflict/i.test(await crumb(p)) && await p.isVisible('#btn-copy'));
  t.check('copy failed: the error shown', (await p.getAttribute('#status', 'class')) === 'err');
  await ctx.close();
}

/* ===== typing while their version is fetched is kept ===== */
{
  const { gh, ctx, p } = await ready();
  elsewhere(gh, 'ONE (theirs)\ntwo\nthree\nfour\nfive\n');
  let hold = false;
  await ctx.route('https://api.github.com/repos/**/contents/**', async r => {
    if (hold && r.request().method() === 'GET') await new Promise(res => setTimeout(res, 800));
    return r.fallback();
  });
  await H.setEditor(p, 'one\ntwo\nthree\nfour\nfive (mine)\n');
  hold = true;
  await H.settle(p, 60);
  await p.click('#btn-save');
  await p.waitForTimeout(400);                            // the refusal is in, their version on its way
  await H.setEditor(p, 'one\ntwo\nthree\nfour\nfive (mine)\nsix (typed meanwhile)\n');
  await H.settle(p, 4000);
  hold = false;
  if (await p.isEnabled('#btn-save')) await p.click('#btn-save');   // whatever is left unsaved
  await H.settle(p, 3000);
  t.check('typing meanwhile: kept, and merged', gh.files['inbox.md'] === 'ONE (theirs)\ntwo\nthree\nfour\nfive (mine)\nsix (typed meanwhile)\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== line endings and a byte-order mark are theirs to keep ===== */
{
  const crlf = '﻿one\r\ntwo\r\nthree\r\nfour\r\nfive\r\n';
  const { gh, ctx, p } = await ready({ 'inbox.md': crlf });
  elsewhere(gh, '﻿ONE (theirs)\r\ntwo\r\nthree\r\nfour\r\nfive\r\n');
  await H.setEditor(p, 'one\ntwo\nthree\nfour\nFIVE (mine)\n');
  await save(p);
  t.check('CRLF: merged with Windows line endings kept', gh.files['inbox.md'] === '﻿ONE (theirs)\r\ntwo\r\nthree\r\nfour\r\nFIVE (mine)\r\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== a draft restored over an older version is never merged ===== */
{
  // The version it started from is not known here (only its sha): merging
  // against GitHub's text instead would quietly undo their change.
  const { gh, ctx, p } = await ready({ 'inbox.md': BASE, 'other.md': 'x\n' });
  const key = await p.evaluate(() => draftKey(current.path));
  const sha = await p.evaluate(() => current.sha);
  await H.clickRow(p, 'other.md');
  const theirs = 'ONE (theirs)\ntwo\nthree\nfour\nfive\n';
  elsewhere(gh, theirs);
  await p.evaluate(([k, sha]) => localStorage.setItem(k, JSON.stringify({ text: 'one\ntwo\nthree\nfour\nFIVE (mine)\n', sha, at: Date.now() })), [key, sha]);
  await H.clickRow(p, 'inbox.md');
  await save(p);
  t.check('stale draft: theirs not overwritten', gh.files['inbox.md'] === theirs, JSON.stringify(gh.files['inbox.md']));
  t.check('stale draft: keeping both offered instead', await p.isVisible('#btn-copy') && /conflict/i.test(await crumb(p)));
  await ctx.close();
}

/* ===== changed again while merging: one merge, then keep both ===== */
{
  const { gh, ctx, p } = await ready();
  let puts = 0;
  await ctx.route('https://api.github.com/repos/**/contents/**', r => {
    if (r.request().method() === 'PUT') { puts++; elsewhere(gh, 'one\ntwo\nthree\nfour (' + puts + ')\nfive\n'); }
    return r.fallback();
  });
  await H.setEditor(p, 'one (mine)\ntwo\nthree\nfour\nfive\n');
  await save(p);
  t.check('changing under us: tries once more, then stops', puts === 2, String(puts));
  t.check('changing under us: theirs kept', /four \(2\)/.test(gh.files['inbox.md']));
  t.check('changing under us: mine kept, keeping both offered', /one \(mine\)/.test(await H.editorValue(p)) && await p.isVisible('#btn-copy'));
  await ctx.close();
}

/* ===== deleted on GitHub: kept, never recreated behind their back ===== */
{
  const { gh, ctx, p } = await ready();
  delete gh.files['inbox.md']; gh.touch();
  await H.setEditor(p, 'one\ntwo (mine)\nthree\nfour\nfive\n');
  await save(p);
  t.check('deleted elsewhere: not recreated', !('inbox.md' in gh.files));
  t.check('deleted elsewhere: my text kept', (await H.editorValue(p)) === 'one\ntwo (mine)\nthree\nfour\nfive\n' && (await drafts(p)).length === 1);
  await ctx.close();
}

{
  // An empty note deleted elsewhere: "deleted" reads as empty text, which a
  // merge alone would accept. It is still never recreated.
  const { gh, ctx, p } = await ready({ 'inbox.md': '' });
  delete gh.files['inbox.md']; gh.touch();
  await H.setEditor(p, 'typed into the empty note\n');
  await save(p);
  t.check('empty note deleted elsewhere: not recreated', !('inbox.md' in gh.files), JSON.stringify(Object.keys(gh.files)));
  t.check('empty note deleted elsewhere: my text kept', (await H.editorValue(p)) === 'typed into the empty note\n');
  await ctx.close();
}

await H.stop();
t.finish();
