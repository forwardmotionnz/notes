/* Images in the repository open in a viewer; large photos are made smaller
   before upload; errors are easy to see (the owner's report, 2026-09-30). */
import * as H from './harness.mjs';
import { readFileSync } from 'node:fs';
const t = H.suite('images'); await H.start();
const PNG = readFileSync(new URL('../icon-180.png', import.meta.url)).toString('latin1');
const IMG = '<img src=x onerror=window.__pwned=1>';
const BIG = 'x'.repeat(1100 * 1024);
const gh = H.fakeGitHub({ files: { 'Garden/Plan.md': '# Plan\n\nhello\n', 'Garden/Pasted image 1.png': PNG, [`${IMG}.png`]: 'not really a png',
  'Big photo.jpg': BIG, 'notes.pdf': 'pdf' }, raw: { 'Garden/Pasted image 1.png': true } });
const c = await H.context(gh, { noCdn: true }), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
await p.evaluate(() => openFile('Garden/Plan.md')); await p.waitForFunction(() => current?.path === 'Garden/Plan.md');
await H.expand(p, 'Garden');

// open an image from Files
await H.clickRow(p, 'Pasted image 1.png');
await p.waitForSelector('#iv-frame img');
t.check('an image in Files opens in a viewer', await p.locator('#image-view').isVisible() && (await p.textContent('#iv-title')) === 'Pasted image 1.png' &&
  (await p.getAttribute('#iv-frame img', 'src')).startsWith('data:image/png;base64,'));
t.check('the image is shown, not just named', await p.locator('#iv-frame img').evaluate(i => i.complete && i.naturalWidth === 180));
t.check('it links to the image on GitHub', (await p.getAttribute('#iv-github', 'href')) === 'https://github.com/roldaof/obsidian-vault/blob/main/Garden/Pasted%20image%201.png');
t.check('an image row is not greyed out as an attachment', await p.locator('#tree .row.image', { hasText: 'Pasted image 1.png' }).count() === 1);
await p.evaluate(() => { const ta = document.querySelector('.fallback-editor'); ta.setSelectionRange(7, 7); });
await p.click('#iv-insert');
t.check('Add to note puts a link at the cursor', await H.editorValue(p) === '# Plan\n![Image](Pasted%20image%201.png)\nhello\n' && await p.locator('#image-view').isHidden(),
  JSON.stringify(await H.editorValue(p)));
t.check('and the note is saved like any edit', await p.evaluate(() => dirty()));
// a large one, and a hostile name
await H.clickRow(p, 'Big photo.jpg');
t.check('an image over 1 MB says so and points to GitHub', /larger than 1 MB/.test(await p.textContent('#iv-frame')) && await p.locator('#iv-frame img').count() === 0);
await p.click('#iv-close');
await H.clickRow(p, `${IMG}.png`);
await p.waitForFunction(() => /could not be shown/.test(document.getElementById('iv-frame').textContent));
t.check('a hostile image name is only text', (await p.textContent('#iv-title')) === `${IMG}.png` && await p.evaluate(() => !window.__pwned) &&
  await p.locator('#image-view img').count() === 0);
await p.click('#iv-close');
await H.clickRow(p, 'notes.pdf');
t.check('other attachments are still left alone', /not a text file/.test(await H.status(p)) && await p.locator('#image-view').isHidden());

// upload: a photo over 1 MB is made smaller
// What the app sends (the fake stores uploads as text, so read the request itself).
const sent = {};
p.on('request', r => { if (r.method() === 'PUT' && /\/contents\//.test(r.url())) { const path = decodeURIComponent(r.url().split('/contents/')[1].split('?')[0]); sent[path] = JSON.parse(r.postData()).content; } });
const big = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1800; c.height = 1800; const x = c.getContext('2d'), d = x.createImageData(1800, 1800);
  for (let i = 0; i < d.data.length; i++) d.data[i] = (Math.random() * 256) | 0;
  x.putImageData(d, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  window.__big = new File([blob], 'photo.png', { type: 'image/png' });
  return blob.size;
});
t.check('setup: the photo is well over 1 MB', big > 3 * 1024 * 1024, String(big));
await p.evaluate(() => { document.querySelector('.fallback-editor').setSelectionRange(0, 0); });
// Status messages are replaced (an autosave's "Saved" may follow at once): keep every one shown.
await p.evaluate(() => { window.__said = []; new MutationObserver(() => __said.push(document.getElementById('status').textContent)).observe(document.getElementById('status'), { childList: true, characterData: true, subtree: true }); });
await p.evaluate(() => uploadImage(window.__big));
const sentPath = Object.keys(sent).find(f => /^Garden\/image-.*\.(png|jpg)$/.test(f)), bytes = sentPath ? Buffer.from(sent[sentPath], 'base64') : Buffer.alloc(0);
t.check('a photo over 1 MB is made smaller and uploaded', !!sentPath && bytes.length > 0 && bytes.length <= 1024 * 1024 && sentPath in gh.files, sentPath + ' ' + bytes.length);
t.check('and it is still a picture', bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
t.check('and linked, and the person is told it was made smaller', (await H.editorValue(p)).startsWith('![Image](image-') && (await p.evaluate(() => __said)).some(m => /made smaller to fit 1 MB, saved and linked/.test(m)), JSON.stringify(await p.evaluate(() => __said)));
await p.evaluate(() => uploadImage(new File([new Uint8Array(1100 * 1024).fill(71)], 'big.gif', { type: 'image/gif' })));
t.check('a GIF over 1 MB is refused with a clear reason', /GIFs over 1 MB/.test(await H.status(p)) && !Object.keys(sent).some(f => /\.gif$/.test(f)));
// errors stand out
t.check('an error is shown as a coloured label', await p.evaluate(() => {
  const s = getComputedStyle(document.getElementById('status'));
  return document.getElementById('status').classList.contains('err') && s.fontWeight >= 600 && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(s.fontSize) >= 13;
}));
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await c.close(); await H.stop(); t.finish();
