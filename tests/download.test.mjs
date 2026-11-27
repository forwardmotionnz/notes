/* N50: ⋯ → Download saves the open note as a file on this device: what is on
   screen (unsaved typing included), under the note's own name, with the
   note's line endings and byte-order mark kept, and nothing sent to GitHub. */
import { readFileSync } from 'node:fs';
import * as H from './harness.mjs';
const t = H.suite('download');
await H.start();

const FILES = {
  'Plan.md': '# Plan\n\none\ntwo\n',
  'Garden/Seeds.md': '# Seeds\n\nkale\n',
  'win.md': '﻿# Windows\r\n\r\nfirst\r\nsecond\r\n',
};
async function setup(opts = {}) {
  const gh = H.fakeGitHub({ files: { ...FILES }, ...opts });
  const ctx = await H.context(gh, { noCdn: true, ...(opts.ctx || {}) });
  const p = await H.page(ctx); await H.signIn(p);
  p.setDefaultTimeout(5000);
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  return { gh, ctx, p };
}
async function open(p, path) { await p.evaluate(path => openFile(path), path); await p.waitForFunction(path => current?.path === path && current.sha, path); }
async function download(p, opts) {
  const [d] = await Promise.all([p.waitForEvent('download'), H.noteAction(p, '#btn-download', opts)]);
  return { name: d.suggestedFilename(), bytes: readFileSync(await d.path()) };
}

{
  const { gh, ctx, p } = await setup();
  t.check('with no note open, Download is not offered', !await H.inMenu(p, '#btn-download'));

  await open(p, 'Plan.md');
  t.check('an open note offers Download in ⋯', await H.inMenu(p, '#btn-download'));
  let got = await download(p);
  t.check('the file is named after the note', got.name === 'Plan.md', got.name);
  t.check('and holds the note', got.bytes.toString('utf8') === FILES['Plan.md'], JSON.stringify(got.bytes.toString('utf8')));

  const before = gh.commits.length;
  await H.setEditor(p, '# Plan\n\none\ntwo\nthree, not saved yet\n');
  got = await download(p);
  t.check('unsaved typing is in the download', got.bytes.toString('utf8') === '# Plan\n\none\ntwo\nthree, not saved yet\n', JSON.stringify(got.bytes.toString('utf8')));
  await H.settle(p, 300);
  t.check('downloading commits nothing', gh.commits.length === before, String(gh.commits.length - before));
  t.check('and leaves the typing unsaved', await p.evaluate(() => !document.getElementById('btn-save').disabled));

  await open(p, 'Garden/Seeds.md');
  got = await download(p);
  t.check('a note in a folder is named without its folder', got.name === 'Seeds.md', got.name);

  await open(p, 'win.md');
  got = await download(p);
  t.check('Windows line endings and the byte-order mark are kept', got.bytes.equals(Buffer.from(FILES['win.md'], 'utf8')), JSON.stringify(got.bytes.toString('utf8')));

  await p.evaluate(() => startNote('Fresh.md', '# fresh')); await p.waitForFunction(() => current?.path === 'Fresh.md');
  got = await download(p);
  t.check('a note never saved can be downloaded too', got.name === 'Fresh.md' && got.bytes.toString('utf8') === '# fresh', got.name + ' ' + JSON.stringify(got.bytes.toString('utf8')));
  await ctx.close();
}
{
  const repos = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main', private: true, permissions: { push: false, pull: true } }];
  const { ctx, p } = await setup({ repos });
  await H.settle(p, 600); await open(p, 'Plan.md');
  const got = await download(p);
  t.check('read-only: Download is still offered and works', got.name === 'Plan.md' && got.bytes.toString('utf8') === FILES['Plan.md']);
  await ctx.close();
}
{
  const { ctx, p } = await setup({ ctx: { viewport: { width: 390, height: 844 }, touch: true } });
  await open(p, 'Plan.md');
  const got = await download(p);
  t.check('on a phone too', got.name === 'Plan.md' && got.bytes.toString('utf8') === FILES['Plan.md'], got.name);
  await ctx.close();
}
{
  // Review: after changing repository no note is open, so ⋯ offers nothing for one.
  const repos = ['alpha', 'beta'].map(name => ({ owner: { login: 'roldaof' }, name, full_name: 'roldaof/' + name, default_branch: 'main', private: true }));
  const gh = H.fakeGitHub({ files: { ...FILES }, repos });
  const ctx = await H.context(gh, { noCdn: true });
  const p = await H.page(ctx); await H.signIn(p); p.setDefaultTimeout(5000);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/alpha' }); await p.click('#f-save');
  await p.waitForFunction(() => !accessPending && treeState === 'ok');
  await open(p, 'Plan.md');
  await p.click('#btn-settings'); await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/beta' }); await p.click('#f-save');
  await p.waitForFunction(() => cfg.repo === 'beta' && !current);
  await H.settle(p, 300);
  t.check('after changing repository, with no note open, Download is not offered',
    await p.evaluate(() => !current) && !await H.inMenu(p, '#btn-download'));
  t.check('and nor are Rename or Delete', !await H.inMenu(p, '#btn-rename') && !await H.inMenu(p, '#btn-delete'));
  await ctx.close();
}
await H.stop();
t.finish();
