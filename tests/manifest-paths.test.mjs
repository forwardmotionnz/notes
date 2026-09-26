/* Home-screen metadata works on the shared site and on a fork's subpath. */
import { readFileSync, existsSync } from 'node:fs';
import * as H from './harness.mjs';
const t = H.suite('manifest');
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const path = new URL('manifest.webmanifest', root);
t.check('the web app manifest exists', existsSync(path));
if (existsSync(path)) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  t.check('home screen uses the Notes name', manifest.name === 'Notes' && manifest.short_name === 'Notes');
  t.check('opens the canonical app path without sign-in query parameters', manifest.start_url === './' && manifest.scope === './');
  t.check('home screen opens a standalone window', manifest.display === 'standalone');
  const icons = manifest.icons || [];
  for (const size of [192, 512]) {
    const icon = icons.find(i => i.sizes === `${size}x${size}`);
    t.check(`a ${size}px PNG icon is supplied`, icon?.type === 'image/png' && !/^[a-z]+:|^\//.test(icon.src));
    if (icon && existsSync(new URL(icon.src, root))) {
      const bytes = readFileSync(new URL(icon.src, root));
      t.check(`${size}px icon has real PNG dimensions`, bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
        bytes.readUInt32BE(16) === size && bytes.readUInt32BE(20) === size);
    } else t.check(`${size}px icon file exists`, false);
  }
}
t.check('manifest is linked beside the app', /<link rel="manifest" href="manifest.webmanifest">/.test(html));
t.check('CSP allows the same-origin manifest', /manifest-src 'self'/.test(html));
t.check('an Apple touch icon is linked', /<link rel="apple-touch-icon" href="icon-180.png">/.test(html));
const applePath = new URL('icon-180.png', root);
const apple = existsSync(applePath) ? readFileSync(applePath) : null;
t.check('Apple receives a real 180px PNG', apple?.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
  apple.readUInt32BE(16) === 180 && apple.readUInt32BE(20) === 180);
t.check('the separate iPhone home-screen sign-in and drafts are explained',
  /On iPhone or iPad[\s\S]*sign in again[\s\S]*drafts[\s\S]*stay in the browser/.test(readFileSync(new URL('README.md', root), 'utf8')));
t.check('a scalable browser icon is linked', /<link rel="icon" href="icon.svg" type="image\/svg\+xml">/.test(html));
t.check('no service worker is installed', !/serviceWorker\s*\.\s*register/.test(html));

await H.start();
const ctx = await H.context(H.fakeGitHub());
const p = await H.page(ctx);
for (const base of [H.APP(), new URL('/a-fork/', H.APP()).href]) {
  await p.goto(base);
  const manifest = await p.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute('href'));
  // This checks the server's asset responses, without loosening the app's
  // API-only connect-src just to fetch its own metadata from page script.
  if (manifest) {
    const response = await ctx.request.get(new URL(manifest, base).href);
    t.check(`${new URL(base).pathname} serves manifest JSON`, response.ok() &&
      /application\/manifest\+json/.test(response.headers()['content-type']) &&
      JSON.parse(await response.text()).start_url === './');
    if (H.engine() === 'chromium') {
      // Chromium's own loader, including CSP and JSON parsing:
      // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getAppManifest
      const client = await ctx.newCDPSession(p);
      const loaded = await client.send('Page.getAppManifest');
      t.check(`${new URL(base).pathname} browser accepts the manifest under CSP`,
        loaded.url === new URL(manifest, base).href && loaded.errors.length === 0 &&
        JSON.parse(loaded.data || '{}').name === 'Notes', JSON.stringify(loaded.errors));
      await client.detach();
    }
  }
}
if (H.engine() === 'chromium') {
  let sent = 0;
  await ctx.route('https://outside.example/**', route => {
    sent++;
    return route.fulfill({ contentType: 'application/manifest+json', body: '{"name":"Outside"}' });
  });
  await p.evaluate(() => { document.querySelector('link[rel="manifest"]').href = 'https://outside.example/manifest.json'; });
  const client = await ctx.newCDPSession(p);
  const loaded = await client.send('Page.getAppManifest');
  t.check('a third-party manifest is blocked before sending a request', sent === 0 && !loaded.data,
    JSON.stringify({ sent, errors: loaded.errors }));
  await client.detach();
}
await ctx.close();
await H.stop();
t.finish();
