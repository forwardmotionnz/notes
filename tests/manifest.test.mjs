/* Add to Home Screen: a name, an icon and a window of its own. */
import { readFileSync, existsSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('manifest');
const root = new URL('../', import.meta.url);
const file = f => new URL(f, root);
const page = readFileSync(file('index.html'), 'utf-8');
const head = page.slice(0, page.indexOf('</head>'));

// A PNG's width and height sit at bytes 16-23 of its IHDR chunk.
function pngSize(f) {
  const b = readFileSync(file(f));
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

/* ===== the manifest ===== */
t.check('manifest.webmanifest exists', existsSync(file('manifest.webmanifest')));
let m = {};
try { m = JSON.parse(readFileSync(file('manifest.webmanifest'), 'utf-8')); } catch (e) { t.check('it is valid JSON', false, String(e)); }
t.check('its name is Notes, short enough for a home screen', m.name === 'Notes' && m.short_name === 'Notes');
t.check('it opens in a window of its own', m.display === 'standalone');
t.check('its colours are the app\'s', /^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color) &&
  page.includes('--accent: ' + m.theme_color), JSON.stringify([m.theme_color, m.background_color]));
const icons = m.icons || [];
const has = (size, purpose) => icons.some(i => i.sizes === size && i.type === 'image/png' &&
  (i.purpose || 'any').split(' ').includes(purpose));
t.check('icons at 192 and 512, and one that may be cut to a circle (maskable)',
  has('192x192', 'any') && has('512x512', 'any') && has('512x512', 'maskable'), JSON.stringify(icons));
for (const i of icons) {
  const real = i.type === 'image/png' ? pngSize(i.src) : existsSync(file(i.src)) ? 'any' : null;
  t.check(`icon ${i.src} exists and is really ${i.sizes}`, real === i.sizes || (i.sizes === 'any' && real === 'any'), String(real));
}

/* ===== the page ===== */
const tag = re => (head.match(re) || [])[0] || '';
t.check('the page links the manifest', /href="manifest\.webmanifest"/.test(tag(/<link rel="manifest"[^>]*>/)));
const touch = tag(/<link rel="apple-touch-icon"[^>]*>/).match(/href="([^"]+)"/);
t.check('iPhones get a 180 px PNG icon (Safari does not read the manifest\'s icons)',
  !!touch && pngSize(touch[1]) === '180x180', touch && touch[1]);
t.check('and the name "Notes" under it', /<meta name="apple-mobile-web-app-title" content="Notes">/.test(head));
t.check('the browser tab gets the icon too', /<link rel="icon" href="icon\.svg" type="image\/svg\+xml">/.test(head) &&
  existsSync(file('icon.svg')));
t.check('the browser bar takes the app\'s colour, light and dark',
  new RegExp(`<meta name="theme-color" content="${m.theme_color}" media="\\(prefers-color-scheme: light\\)">`).test(head) &&
  /<meta name="theme-color" content="#16181c" media="\(prefers-color-scheme: dark\)">/.test(head) && page.includes('--bg: #16181c'));
t.check('the first-run steps do not assume a browser tab (a home-screen app has none)',
  (page.match(/come back to this tab/g) || []).length === 0 && (page.match(/this tab or the Notes app/g) || []).length === 2);
const policy = (head.match(/Content-Security-Policy" content="(default-src[^"]+)"/) || [])[1] || '';
t.check("the security policy lets the manifest load (manifest-src 'self')", /manifest-src 'self'/.test(policy), policy);

/* ===== in the browser ===== */
await H.start();
const gh = H.fakeGitHub();
const ctx = await H.context(gh);
const p = await H.page(ctx);
const blocked = [];
await p.exposeFunction('noteViolation', v => blocked.push(v));
await p.addInitScript(() => document.addEventListener('securitypolicyviolation',
  e => window.noteViolation(e.violatedDirective + ' ' + e.blockedURI)));
await p.goto(H.APP());
await p.waitForTimeout(600);
const link = await p.evaluate(() => document.querySelector('link[rel=manifest]').href);
const res = await p.request.get(link);
t.check('the manifest is served, as GitHub Pages serves it', res.ok() &&
  /application\/manifest\+json/.test(res.headers()['content-type'] || ''), res.headers()['content-type']);
for (const i of icons) {
  const r = await p.request.get(new URL(i.src, link).href);
  t.check(`${i.src} is served as ${i.type}`, r.ok() && (r.headers()['content-type'] || '').startsWith(i.type));
}
// GitHub sends a sign-in back to the page's own address, which must be the
// one the home-screen app starts at, or the callback would not match.
t.check('the home-screen app starts at the address sign-in returns to',
  new URL(m.start_url, link).href === H.APP() && new URL(m.scope, link).href === H.APP(),
  new URL(m.start_url || '', link).href);
if (H.engine() === 'chromium') {
  // Only Chromium can say what it made of the manifest.
  const cdp = await ctx.newCDPSession(p);
  const got = await cdp.send('Page.getAppManifest');
  t.check('Chromium loads the manifest and finds nothing wrong', got.url === link && got.errors.length === 0 &&
    /"name": ?"Notes"/.test(got.data || ''), JSON.stringify(got.errors));
}
t.check('nothing was blocked by the security policy', blocked.length === 0, blocked.join(' | '));
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await ctx.close();
await H.stop();
t.finish();
