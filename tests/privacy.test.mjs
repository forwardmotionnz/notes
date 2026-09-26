/* PRIVACY.md is held to what the code does, so it cannot drift into fiction. */
import { readFileSync, existsSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('privacy');
const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf-8');

t.check('PRIVACY.md exists', existsSync(new URL('PRIVACY.md', root)));
const doc = existsSync(new URL('PRIVACY.md', root)) ? read('PRIVACY.md') : '';
const said = s => doc.includes(s);

/* ===== it covers what it must, in plain words ===== */
for (const topic of [/what the broker sees/i, /what (your|the) browser (keeps|stores)/i, /revok|take (the )?access back/i, /self-host|your own copy/i]) {
  t.check('it has a section on ' + topic.source, doc.split('\n').some(l => l.startsWith('#') && topic.test(l)));
}
t.check('it says the broker stores and logs nothing', /stores nothing/i.test(doc) && /logs nothing/i.test(doc));
t.check('it says notes never pass through the broker', /notes never (go|pass) through/i.test(doc));

/* ===== the broker: what it receives, and that it keeps nothing ===== */
const worker = read('broker/worker.js');
const code = worker.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
t.check('the broker has no logging', !/console\.|\blog\(/.test(code));
t.check('the broker has no storage: no KV, cache, database or durable object',
  !/\b(caches|KV|kv|D1|R2|DurableObject|put\(|waitUntil)\b/.test(code));
const envUsed = [...new Set([...code.matchAll(/env\.([A-Z_]+)/g)].map(m => m[1]))].sort();
t.check('the broker reads only its four settings', JSON.stringify(envUsed) ===
  JSON.stringify(['ALLOWED_ORIGIN', 'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI']), JSON.stringify(envUsed));
const toml = read('broker/wrangler.toml').replace(/#.*$/gm, '');
t.check('its deployment binds no storage and turns on no logs',
  !/kv_namespaces|d1_databases|r2_buckets|durable_objects|logpush|observability|tail_consumers/.test(toml));
const fields = [...new Set([...code.matchAll(/body\.([a-z_]+)/g)].map(m => m[1]))];
t.check('every field the broker reads is named in the note', fields.length === 3 && fields.every(f => said('`' + f + '`')),
  JSON.stringify(fields));

/* ===== every host the page may talk to is named ===== */
const page = read('index.html');
const hosts = new Set();
for (const m of page.matchAll(/Content-Security-Policy" content="([^"]+)"/g)) {
  for (const h of m[1].matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]+)/g)) hosts.add(h[1]);
}
hosts.add('github.com');                               // where sign-in and settings happen
// The broker's host is each copy's own (the DEPLOYMENT block); the note
// names it by what it is, "the broker", in a section of its own.
const brokerHost = new URL(JSON.parse(page.match(/<script type="application\/json" id="deployment">([\s\S]*?)<\/script>/)[1]).broker).hostname;
const unnamed = [...hosts].filter(h => !said(h) && !(h === brokerHost && /^## What the broker sees/m.test(doc)));
t.check('every host in the page\'s policies is named in the note', hosts.size >= 4 && unnamed.length === 0,
  JSON.stringify(unnamed));

/* ===== revoking: the pages GitHub documents ===== */
// https://docs.github.com/en/apps/using-github-apps/reviewing-and-revoking-authorization-of-github-apps
// https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps
t.check('it links the Authorized GitHub Apps page', said('https://github.com/settings/apps/authorizations') &&
  /Authorized GitHub Apps/.test(doc));
t.check('and the Installed GitHub Apps page, for an organisation too', said('https://github.com/settings/installations') &&
  /Installed GitHub Apps/.test(doc) && /organi[sz]ation/i.test(doc));
t.check('it is honest that signing out does not cancel the sign-in on GitHub',
  /does not cancel the sign-in on GitHub/i.test(doc) && /until it expires, at\s+most eight hours/i.test(doc));
// The refresh token lasts six months (index.html, AUTH) and the broker renews
// it for anyone who has it, so a copied sign-in outlives the token.
t.check('and that a copied refresh token keeps working for up to six months',
  /refresh token could keep getting new ones for up to six months/i.test(doc));
// A GitHub App's owner can act on its installations with the App's own key,
// without any user: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
t.check("it says whoever owns the GitHub App can use the app's access without them",
  /owns\s+the\s+app\s+can\s+use\s+that\s+access\s+directly/i.test(doc) &&
  /Revoking\s+your\s+sign-in\s+does\s+not\s+stop\s+this;\s+uninstalling\s+the\s+app\s+does/i.test(doc));
t.check('and that they control the page too', /control the page you load/i.test(doc));
t.check('it says the editor code from the CDN runs inside the page', /runs inside the page/i.test(doc));
t.check('it warns that a browser reopening tabs brings "Forget me" storage back',
  /reopen your tabs[\s\S]{0,200}brings session storage back/i.test(doc));
t.check('and that each tab, a duplicated one too, has its own copy', /duplicated tab/i.test(doc));
t.check('it says an automatic sign-out keeps unsaved changes, and Sign out removes them',
  /signs you out but\s+keeps your unsaved changes/i.test(doc));
// The README must not promise more than the note either.
const readme = read('README.md');
t.check('the README does not promise "nothing is written to disk" for Forget me',
  !/nothing is written to disk/i.test(readme) && /reopen its tabs/i.test(readme));
t.check('it says the sign-in reaches repositories others installed the app on that they can use',
  /someone\s+else installed it on and you can use/i.test(doc));

/* ===== the browser: every key a real session writes is in the note ===== */
await H.start();
const keysOf = p => p.evaluate(() => ({
  local: Object.keys(localStorage).filter(k => k.startsWith('notes.')),
  session: Object.keys(sessionStorage).filter(k => k.startsWith('notes.')),
}));
const family = k => k.startsWith('notes.draft.v1:') ? 'notes.draft.v1:' : k;
// Named means a row of its own in the table of what the browser keeps.
const inTable = k => new RegExp('^\\| `' + family(k).replace(/[.]/g, '\\.') + '`', 'm').test(doc);
for (const remember of [true, false]) {
  const label = remember ? 'remembered' : 'forget me';
  const gh = H.fakeGitHub({ files: { 'todo.md': '- [ ] one\n', 'inbox.md': 'hello\n' }, expiresIn: 60 });
  const ctx = await H.context(gh);
  const sentToBroker = [];
  ctx.on('request', r => { if (r.url().startsWith('https://broker.test') && r.method() === 'POST') sentToBroker.push(r.postData()); });
  // Every key the app ever writes, even ones gone a moment later.
  const written = new Set();
  await ctx.exposeFunction('noteKey', k => written.add(k));
  await ctx.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      window.noteKey((this === sessionStorage ? 'session ' : 'local ') + k);
      return set.call(this, k, v);
    };
  });
  const p = await H.page(ctx);
  await H.signIn(p, { remember });
  await H.settle(p, 500);
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'hello\nunsaved words\n');               // a draft
  await p.fill('#pin-input', 'a task');
  await p.click('#pin-go');
  await H.settle(p, 600);
  const k = await keysOf(p);
  const all = [...k.local, ...k.session].map(family);
  t.check(`${label}: every key in storage is named in the note`, all.length >= 3 && all.every(inTable),
    JSON.stringify(k));
  t.check(`${label}: and kept where the note says`, remember ? k.session.length === 0 : k.local.length === 0,
    JSON.stringify(k));
  const ever = [...written].map(w => w.split(' '));
  t.check(`${label}: every key ever written, even for a moment, is named too`,
    ever.some(([, k]) => k === 'notes.signin') && ever.every(([, k]) => inTable(k)), JSON.stringify(ever));
  t.check(`${label}: and only session storage is used when they asked to be forgotten`,
    remember || ever.every(([where]) => where === 'session'), JSON.stringify(ever));
  const bodies = sentToBroker.map(b => Object.keys(JSON.parse(b)).sort().join());
  t.check(`${label}: the broker got only a sign-in code, its verifier, and a refresh token`,
    bodies.includes('code,code_verifier') && bodies.includes('refresh_token') &&
    bodies.every(b => b === 'code,code_verifier' || b === 'refresh_token'), JSON.stringify(bodies));
  t.check(`${label}: and never a note`, sentToBroker.every(b => !/hello|unsaved|a task/.test(b)));
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.accept());
  await p.click('#btn-settings');
  await H.settle(p, 300);
  await p.click('#f-forget');
  await H.settle(p, 800);
  const after = await keysOf(p);
  t.check(`${label}: signing out leaves nothing, as the note says`, after.local.length + after.session.length === 0,
    JSON.stringify(after));
  await ctx.close();
}

/* ===== an automatic sign-out keeps drafts, as the note says ===== */
{
  const gh = H.fakeGitHub({ files: { 'inbox.md': 'hello\n' } });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'hello\nnot saved yet\n');
  await H.settle(p, 100);
  // Revoked on GitHub: the token and the refresh token both stop working.
  gh.expireAll();
  for (const v of gh.refresh.values()) v.used = true;
  await p.click('#btn-refresh');
  // A refused refresh waits up to 2 s for another tab's tokens before
  // signing out; wait for the sign-out itself.
  await p.waitForFunction(() => document.getElementById('settings').open &&
    !document.getElementById('view-signin').hidden, null, { timeout: 5000 }).catch(() => {});
  await H.settle(p, 100);
  const k = await keysOf(p);
  t.check('revoked: signed out, the sign-in gone from storage', !k.local.includes('notes.config.v2') &&
    await p.evaluate(() => !document.getElementById('view-signin').hidden), JSON.stringify(k));
  t.check('but the unsaved words kept, as the note says', k.local.some(x => x.startsWith('notes.draft.v1:')),
    JSON.stringify(k));
  await ctx.close();
}

await H.stop();
t.finish();
