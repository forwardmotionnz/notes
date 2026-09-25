/*
  Test harness: serves index.html, fakes GitHub, and runs the real broker.

  Nothing here talks to the network. GitHub is simulated closely enough to
  catch the mistakes that matter: the PKCE challenge is really verified, codes
  are single use, access tokens expire, and refresh tokens rotate and die
  after one use, as GitHub's do.
*/
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import worker from '../broker/worker.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Served as a deployment would be: the copy's own policy (the one that is
// only connect-src) names the broker this copy uses, here the test one,
// whatever the file says, so a fork's own settings do not break its tests.
// `pageEdit` lets a test serve the page edited as a fork would edit it.
let pageEdit = html => html;
export const setPageEdit = fn => { pageEdit = fn || (html => html); };
const PAGE = () => pageEdit(readFileSync(ROOT + 'index.html', 'utf-8').replace(
  /(<meta http-equiv="Content-Security-Policy" content=")connect-src [^"]*(">)/,
  '$1connect-src https://api.github.com https://broker.test$2'));

export const DEPLOY = {
  clientId: 'Iv23liTESTCLIENT',
  appSlug: 'notes-test',
  broker: 'https://broker.test/',
};

/* ---------------- results ---------------- */

export function suite(name) {
  const results = [];
  return {
    check(n, pass, detail) {
      results.push({ n, pass: !!pass, detail: detail || '' });
      console.log((pass ? 'PASS  ' : 'FAIL  ') + n + (detail ? '   -> ' + detail : ''));
    },
    finish() {
      const bad = results.filter(r => !r.pass);
      console.log('\n' + '='.repeat(60) + `\n${name}: ${results.length - bad.length}/${results.length} passed`);
      if (bad.length) {
        bad.forEach(b => console.log(' FAIL ' + b.n + '  ' + b.detail));
        process.exitCode = 1;
      }
    },
  };
}

/* ---------------- fake GitHub ---------------- */

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function fakeGitHub(opts = {}) {
  const gh = {
    user: { login: 'roldaof', avatar_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    repos: opts.repos || [
      { owner: { login: 'roldaof' }, name: 'obsidian-vault', full_name: 'roldaof/obsidian-vault',
        default_branch: 'main', private: true },
    ],
    files: opts.files || { 'todo.md': '# Today\n\n- [ ] one\n' },
    // Paths whose string is raw bytes (latin1), not UTF-8 text: for files
    // that are not valid UTF-8.
    raw: opts.raw || {},
    expiresIn: opts.expiresIn ?? 28800,
    codes: new Map(),        // code -> { challenge, used }
    access: new Map(),       // token -> { expired }
    refresh: new Map(),      // token -> { used }
    log: { exchanges: 0, refreshes: 0, badRefresh: 0, authorize: [], apiAuth: [] },
    commits: [],
    seq: 0,
    denyNext: false,
  };

  gh.mint = () => {
    const n = ++gh.seq;
    const a = `ghu_access${n}`, r = `ghr_refresh${n}`;
    gh.access.set(a, { expired: false });
    gh.refresh.set(r, { used: false });
    return { access_token: a, expires_in: gh.expiresIn, refresh_token: r,
             refresh_token_expires_in: 15897600, token_type: 'bearer', scope: '' };
  };
  gh.expireAll = () => { for (const v of gh.access.values()) v.expired = true; };
  gh.sha = p => 'sha' + createHash('sha1').update(gh.files[p] ?? '').digest('hex').slice(0, 12);

  // What github.com/login/oauth/access_token does.
  gh.tokenEndpoint = form => {
    if (form.client_id !== DEPLOY.clientId || form.client_secret !== 'test-secret') {
      return { error: 'incorrect_client_credentials' };
    }
    if (form.grant_type === 'refresh_token') {
      const r = gh.refresh.get(form.refresh_token);
      if (!r || r.used) { gh.log.badRefresh++; return { error: 'bad_refresh_token' }; }
      r.used = true;
      gh.log.refreshes++;
      return gh.mint();
    }
    const c = gh.codes.get(form.code);
    if (!c || c.used) return { error: 'bad_verification_code' };
    c.used = true;
    const expect = b64url(createHash('sha256').update(form.code_verifier || '').digest());
    if (expect !== c.challenge) return { error: 'bad_verification_code', error_description: 'PKCE mismatch' };
    gh.log.exchanges++;
    return gh.mint();
  };

  return gh;
}

/* The worker calls fetch() for GitHub's token endpoint. In this process
   that is always the fake, installed once so overlapping requests (two tabs
   refreshing at once) cannot see a half-swapped global. */
let activeGitHub = null;
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://github.com/login/oauth/access_token') {
    throw new Error('test process tried to reach ' + url);
  }
  const form = Object.fromEntries(new URLSearchParams(init.body));
  return new Response(JSON.stringify(activeGitHub.tokenEndpoint(form)), {
    status: 200, headers: { 'Content-Type': 'application/json' } });
};

/* ---------------- server + browser ---------------- */

let server, origin, browser;

export async function start() {
  server = createServer((req, res) => {
    // Every path serves the app, as GitHub Pages does for index.html.
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE());
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  return { origin: origin + '/notes/' };
}

export async function stop() {
  await browser?.close();
  await new Promise(r => server.close(r));
}

export const APP = () => origin + '/notes/';

const CM_STUB = `
window.CodeMirror = function (host, opts) {
  var ta = document.createElement('textarea'); ta.id = 'cm-stub';
  ta.style.cssText = 'flex:1;width:100%;border:0'; host.appendChild(ta);
  var hs = [], cm;
  // Like CodeMirror 5, "change" fires for setValue too, tagged with its origin.
  var fire = function (origin) { hs.forEach(function (h) { h(cm, { origin: origin }); }); };
  ta.addEventListener('input', function () { fire('+input'); });
  ta.value = (opts && opts.value) || '';
  return cm = { getValue: function () { return ta.value; },
    setValue: function (v) { ta.value = v; fire('setValue'); },
    clearHistory: function () {}, refresh: function () {}, focus: function () { ta.focus(); },
    on: function (e, f) { if (e === 'change') hs.push(f); } };
};
window.CodeMirror.defineMode = function () {};`;

/* A browser context wired to the fake GitHub. One context is one browser
   profile: tabs in it share localStorage, each tab has its own session. */
export async function context(gh, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 820 } });
  const deploy = opts.deploy === false ? null : { ...DEPLOY, ...(opts.deploy || {}) };
  await ctx.addInitScript(d => { if (d) window.NOTES_DEPLOYMENT = d; }, deploy);

  await ctx.route('**/cdnjs.cloudflare.com/**', r => {
    if (opts.noCdn) return r.abort();
    return r.request().url().endsWith('.css')
      ? r.fulfill({ contentType: 'text/css', body: '' })
      : r.fulfill({ contentType: 'application/javascript', body: CM_STUB });
  });

  // github.com: the authorize page. Consent is instant unless told to deny.
  await ctx.route('https://github.com/login/oauth/authorize**', route => {
    const u = new URL(route.request().url());
    const q = u.searchParams;
    gh.log.authorize.push(Object.fromEntries(q));
    const back = new URL(q.get('redirect_uri'));
    if (gh.denyNext) {
      gh.denyNext = false;
      // https://docs.github.com/en/apps/oauth-apps/maintaining-oauth-apps/troubleshooting-authorization-request-errors#access-denied
      // (checked against github/docs content/apps/oauth-apps/maintaining-oauth-apps/troubleshooting-authorization-request-errors.md)
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('error_description', 'The user has denied your application access.');
      back.searchParams.set('error_uri', '/apps/building-integrations/setting-up-and-registering-oauth-apps/troubleshooting-authorization-request-errors/%23access-denied');
      back.searchParams.set('state', q.get('state'));
    } else {
      const code = 'code' + (++gh.seq);
      gh.codes.set(code, { challenge: q.get('code_challenge'), used: false });
      back.searchParams.set('code', code);
      back.searchParams.set('state', opts.tamperState ? 'forged' : q.get('state'));
    }
    return route.fulfill({ status: 302, headers: { Location: back.toString() } });
  });

  // The broker: the real worker, with GitHub's token endpoint faked under it.
  activeGitHub = gh;
  await ctx.route(DEPLOY.broker + '**', async route => {
    const req = route.request();
    const res = await worker.fetch(new Request(req.url(), {
      method: req.method(),
      headers: req.headers(),
      body: req.method() === 'POST' ? req.postData() : undefined,
    }), {
      CLIENT_ID: DEPLOY.clientId,
      CLIENT_SECRET: 'test-secret',
      ALLOWED_ORIGIN: origin,
      REDIRECT_URI: origin + '/notes/',
    });
    return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers),
                           body: await res.text() });
  });

  // api.github.com
  await ctx.route('https://api.github.com/**', route => {
    const req = route.request();
    const auth = (req.headers()['authorization'] || '').replace(/^Bearer /, '');
    gh.log.apiAuth.push(auth);
    const tok = gh.access.get(auth);
    // A navigation can cancel a request before it is answered; answering it
    // then throws, and that says nothing about the app.
    const json = (body, status = 200) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});

    if (!tok || tok.expired) return json({ message: 'Bad credentials' }, 401);

    const p = decodeURIComponent(new URL(req.url()).pathname);
    if (p === '/user') return json(gh.user);
    if (p === '/user/installations') {
      return json({ total_count: 1, installations: gh.repos.length ? [{ id: 77 }] : [] });
    }
    if (p === '/user/installations/77/repositories') {
      return json({ total_count: gh.repos.length, repositories: gh.repos });
    }
    if (/\/git\/trees\//.test(p)) {
      const dirs = new Set();
      Object.keys(gh.files).forEach(k => {
        const s = k.split('/');
        for (let i = 1; i < s.length; i++) dirs.add(s.slice(0, i).join('/'));
      });
      return json({ truncated: false, tree: [
        ...[...dirs].map(d => ({ path: d, type: 'tree' })),
        // Tree entries carry the blob's size in bytes:
        // https://docs.github.com/en/rest/git/trees#get-a-tree
        ...Object.keys(gh.files).map(k => ({ path: k, type: 'blob', sha: gh.sha(k),
          size: Buffer.byteLength(gh.files[k], gh.raw[k] ? 'latin1' : 'utf-8') })),
      ]});
    }
    const m = p.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.*)$/);
    if (m) {
      const path = m[2];
      if (req.method() === 'GET') {
        if (!(path in gh.files)) return json({ message: 'Not Found' }, 404);
        // Files between 1 and 100 MB come back with an empty content and
        // encoding "none": https://docs.github.com/en/rest/repos/contents#get-repository-content
        // (checked against github/rest-api-description, "If the requested file's size is").
        const size = Buffer.byteLength(gh.files[path], gh.raw[path] ? 'latin1' : 'utf-8');
        if (size > 1024 * 1024) return json({ path, sha: gh.sha(path), size, encoding: 'none', content: '' });
        return json({ path, sha: gh.sha(path),
          content: Buffer.from(gh.files[path], gh.raw[path] ? 'latin1' : 'utf-8').toString('base64') });
      }
      if (req.method() === 'PUT') {
        const b = JSON.parse(req.postData() || '{}');
        const exists = path in gh.files;
        if (exists && b.sha !== gh.sha(path)) return json({ message: 'does not match' }, 409);
        if (!exists && b.sha) return json({ message: 'sha given for new file' }, 422);
        gh.files[path] = Buffer.from(b.content, 'base64').toString('utf-8');
        gh.commits.push({ repo: m[1], path, message: b.message, branch: b.branch, token: auth });
        return json({ content: { path, sha: gh.sha(path) } });
      }
    }
    return json({ message: 'no route: ' + p }, 404);
  });

  return ctx;
}

/* A page that records errors, ignoring the ones the app expects. */
export async function page(ctx, url = APP()) {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/404 \(Not Found\)|401 \(Unauthorized\)|net::ERR_FAILED/.test(t)) return;
    if (/Signed out/.test(t)) return;
    p.errors.push('console: ' + t);
  });
  p.on('dialog', d => d.accept());
  await p.goto(url, { waitUntil: 'load' });
  return p;
}

/* Full sign-in through the real flow. */
export async function signIn(p, { remember = true } = {}) {
  await p.waitForSelector('#f-signin:not([disabled])');
  if (!remember) await p.check('#f-session-in');
  await Promise.all([
    p.waitForURL(u => u.toString().startsWith(APP()) && !u.search.includes('code='), { timeout: 5000 }),
    p.click('#f-signin'),
  ]);
  await p.waitForTimeout(500);
}

/* Helpers used across suites. */
export const rows = p => p.$$eval('#tree .row',
  els => els.map(e => e.textContent.replace(/[▸▾]/g, '').trim()));
export const clickRow = async (p, name) => {
  await p.$$eval('#tree .row', (els, n) => {
    const el = els.find(e => e.textContent.replace(/[▸▾]/g, '').trim() === n);
    if (el) el.click();
  }, name);
  await p.waitForTimeout(300);
};
export const expand = async (p, name) => {
  await p.$$eval('#tree .row.dir', (els, n) => {
    const el = els.find(e => e.textContent.replace(/[▸▾]/g, '').trim() === n);
    if (el) el.click();
  }, name);
  await p.waitForTimeout(100);
};
export const editorValue = p => p.evaluate(
  () => document.querySelector('#cm-stub, .fallback-editor')?.value ?? null);
export const setEditor = (p, v) => p.evaluate(v => {
  const ta = document.querySelector('#cm-stub, .fallback-editor');
  ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
export const status = p => p.evaluate(() => document.getElementById('status').textContent);
export const dialogOpen = p => p.evaluate(() => document.getElementById('settings').open);
export const stored = p => p.evaluate(() => ({
  local: localStorage.getItem('notes.config.v2'),
  session: sessionStorage.getItem('notes.config.v2'),
}));
