/* A phone's layout, checked by measuring what is drawn (found while looking at the owner's phone report of 2026-11-24). */
import * as H from './harness.mjs';
const t = H.suite('phone-layout'); await H.start();
const note = '# Suburbs\n\n| Suburb | Typical section | Notes on it |\n|---|---|---|\n| Halswell | 700 m2 | newer subdivisions further out, with smaller sections than the hills |\n| Cashmere | 900 m2 | hills, older and larger sections |\n\n| A | B | C | D | E | F |\n|---|---|---|---|---|---|\n| Christchurch | Christchurch | Christchurch | Christchurch | Christchurch | Christchurch |\n\nA line with averyveryverylongwordthatcannotfitonaphonescreenwithoutbeingbrokensomewhereinsideitatall.\n';
const gh = H.fakeGitHub({ files: { 'Suburbs.md': note } });
const c = await H.context(gh, { viewport: { width: 390, height: 800 } }), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
await H.preview(p, 'Suburbs.md');

// The Files sheet waits off-screen; its shadow must not reach onto the note beside it.
const shadow = () => p.evaluate(() => getComputedStyle(document.getElementById('sidebar')).boxShadow);
t.check('the closed Files sheet casts no shadow onto the note', await shadow() === 'none', await shadow());
await p.click('#btn-tree'); await H.still(p);
t.check('the open one does', await shadow() !== 'none');
await p.mouse.click(370, 400); await H.still(p);   // the scrim, beside the sheet
t.check('and it goes when the sheet closes', await shadow() === 'none');

// Tables: a word is never broken inside a cell to squeeze the table in; a table too wide scrolls on its own.
const lines = text => p.evaluate(text => {
  const w = document.createTreeWalker(document.getElementById('preview'), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) if (n.textContent.trim() === text) { const r = document.createRange(); r.selectNodeContents(n); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; }
  return -1;
}, text);
for (const word of ['Suburb', 'Halswell', 'Cashmere', 'Christchurch']) t.check(`${word} stays whole in its cell`, await lines(word) === 1, String(await lines(word)));
t.check('a long cell still wraps between words', await lines('newer subdivisions further out, with smaller sections than the hills') > 1);
const wide = await p.evaluate(() => [...document.querySelectorAll('#preview table')].map(x => ({ scrolls: x.scrollWidth > x.clientWidth + 1, fits: x.getBoundingClientRect().right <= innerWidth + 1, overflow: getComputedStyle(x).overflowX })));
t.check('the wide table scrolls sideways inside the note', wide.length === 2 && wide[1].scrolls && wide[1].fits && wide[1].overflow === 'auto', JSON.stringify(wide));
t.check('the ordinary one fits without scrolling', wide.length === 2 && !wide[0].scrolls, JSON.stringify(wide));
t.check('a very long word outside a table still breaks', await lines('A line with averyveryverylongwordthatcannotfitonaphonescreenwithoutbeingbrokensomewhereinsideitatall.') > 1);
t.check('and the page never scrolls sideways', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('preview').scrollWidth <= document.getElementById('preview').clientWidth + 1));
await c.close(); await H.stop(); t.finish();
