/* N19: Auto (the device's setting), Light or Dark, chosen in Settings,
   remembered in this browser and applied before the page first draws. */
import * as H from './harness.mjs';

const t = H.suite('theme');
await H.start();

const LIGHT = 'rgb(255, 255, 255)', DARK = 'rgb(22, 24, 28)';
const bg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const metas = p => p.$$eval('meta[name="theme-color"]', m => m.map(x => x.content));
async function choose(p, value) {
  await p.click('#btn-settings');
  await p.waitForSelector('#f-theme');
  await p.selectOption('#f-theme', value);
  await p.keyboard.press('Escape');          // applied at once: nothing to save
  await H.settle(p, 100);
}

/* ===== Auto follows the device ===== */
{
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.emulateMedia({ colorScheme: 'dark' });
  await H.signIn(p);
  t.check('auto: dark on a dark device', (await bg(p)) === DARK, await bg(p));
  await p.emulateMedia({ colorScheme: 'light' });
  t.check('auto: light on a light device', (await bg(p)) === LIGHT, await bg(p));
  await p.click('#btn-settings');
  await p.waitForSelector('#f-theme');
  t.check('auto is the default', (await p.inputValue('#f-theme')) === 'auto');
  await ctx.close();
}

/* ===== Light and Dark override the device ===== */
{
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.emulateMedia({ colorScheme: 'dark' });
  await H.signIn(p);
  await choose(p, 'light');
  t.check('light on a dark device: applied at once', (await bg(p)) === LIGHT, await bg(p));
  t.check('light: the browser bar colour follows', (await metas(p)).every(c => c === '#2f6f4f'), JSON.stringify(await metas(p)));
  t.check('light: form controls follow too', await p.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === 'light');
  t.check('light: nothing sent to GitHub', gh.commits.length === 0);
  await choose(p, 'dark');
  await p.emulateMedia({ colorScheme: 'light' });
  t.check('dark on a light device', (await bg(p)) === DARK, await bg(p));
  t.check('dark: the browser bar colour follows', (await metas(p)).every(c => c === '#16181c'), JSON.stringify(await metas(p)));
  // Remembered, and in place before anything is drawn: the editor's files are
  // held back, so only the head of the page has run when this is measured.
  let release;
  const held = new Promise(r => { release = r; });
  await ctx.route('**/codemirror/5.65.16/codemirror.min.js', async r => { await held; return r.fallback(); });
  const nav = p.reload({ waitUntil: 'commit' });
  await nav;
  await p.waitForSelector('body');
  t.check('remembered: dark before the app has started', (await bg(p)) === DARK, await bg(p));
  release();
  await H.settle(p, 1500);
  await ctx.unroute('**/codemirror/5.65.16/codemirror.min.js');
  t.check('remembered: and after', (await bg(p)) === DARK);
  // A display choice, not an account one: signing out keeps it.
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.accept());
  await p.click('#btn-settings');
  await p.click('#f-forget');
  await H.settle(p, 800);
  t.check('signed out: the theme stays', (await bg(p)) === DARK);
  await ctx.close();
}

/* ===== back to Auto ===== */
{
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.emulateMedia({ colorScheme: 'light' });
  await H.signIn(p);
  await choose(p, 'dark');
  await choose(p, 'auto');
  t.check('auto again: follows the device', (await bg(p)) === LIGHT, await bg(p));
  t.check('auto again: both bar colours back', JSON.stringify(await metas(p)) === '["#2f6f4f","#16181c"]', JSON.stringify(await metas(p)));
  await p.reload();
  await H.settle(p, 1000);
  t.check('auto again: nothing remembered', await p.evaluate(() => localStorage.getItem('notes.theme')) === null);
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== storage refused (a private window): no harm ===== */
{
  const gh = H.fakeGitHub({ files: { 'a.md': '# A\n' } });
  const ctx = await H.context(gh);
  await ctx.addInitScript(() => {
    const deny = () => { throw new DOMException('denied', 'SecurityError'); };
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return k === 'notes.theme' ? deny() : real.call(this, k); };
  });
  const p = await H.page(ctx);
  await p.emulateMedia({ colorScheme: 'dark' });
  const started = await p.waitForSelector('#f-signin:not([disabled])', { timeout: 5000 }).then(() => true, () => false);
  t.check('storage refused: the app still starts, following the device', started && (await bg(p)) === DARK);
  await ctx.close();
}

import { readFileSync } from 'node:fs';
t.check('the privacy note lists what is stored', /`notes\.theme`/.test(readFileSync(new URL('../PRIVACY.md', import.meta.url), 'utf8')));

await H.stop();
t.finish();
