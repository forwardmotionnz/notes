/* N13: every file from the CDN is pinned to its hash, so a changed file is
   refused by the browser rather than run next to the person's sign-in.
   Whether each hash matches what cdnjs serves is checked by
   tests/cdn-integrity.mjs in CI, where the CDN can be reached. */
import { readFileSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('integrity');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');

/* ===== every CDN tag carries a hash ===== */
{
  const tags = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="https:\/\/cdnjs\.cloudflare\.com\/[^"]+"[^>]*>/g)].map(m => m[0]);
  t.check('the page loads six files from the CDN', tags.length === 6, String(tags.length));
  const unpinned = tags.filter(tag => !/\bintegrity="sha(256|384|512)-[A-Za-z0-9+/]+={0,2}"/.test(tag) || !/\bcrossorigin="anonymous"/.test(tag));
  t.check('each has an integrity hash and is fetched anonymously', unpinned.length === 0, unpinned.join('\n'));
  t.check('the CI job checks them against cdnjs',
    /node tests\/cdn-integrity\.mjs/.test(readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf-8')));
}

await H.start();

/* ===== a changed editor file is refused, and the app still works ===== */
{
  // The suite's usual stand-in for CodeMirror is not the file the hash
  // names: served with the page's real hashes, it must not run.
  H.keepIntegrity(true);
  const gh = H.fakeGitHub({ files: { 'inbox.md': '# Inbox\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  t.check('the changed file did not run', await p.evaluate(() => typeof window.CodeMirror === 'undefined'));
  t.check('the plain editor is used instead', (await p.$$('.fallback-editor')).length === 1);
  t.check('and says so', await p.evaluate(() => getComputedStyle(document.getElementById('degraded')).display !== 'none'));
  t.check('the note still opens', (await H.editorValue(p)) === '# Inbox\n');
  await H.setEditor(p, '# Inbox\n\nstill saves\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 2000);
  t.check('and still saves', gh.files['inbox.md'] === '# Inbox\n\nstill saves\n');
  // The renderer and sanitiser are served as the real files: their hashes
  // match, so they load.
  t.check('files matching their hash still load', await p.evaluate(() => typeof marked === 'object' && typeof DOMPurify === 'function'),
    await p.evaluate(() => typeof marked + ' ' + typeof DOMPurify));
  await ctx.close();
  H.keepIntegrity(false);
}

await H.stop();
t.finish();
