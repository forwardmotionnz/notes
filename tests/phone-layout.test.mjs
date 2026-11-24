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
await c.close(); await H.stop(); t.finish();
