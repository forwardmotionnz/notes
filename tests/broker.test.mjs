// The broker, tested directly: it is the only code that sees the secret.
import worker from '../broker/worker.js';

const ENV = {
  CLIENT_ID: 'Iv23liTEST',
  CLIENT_SECRET: 'super-secret-value',
  ALLOWED_ORIGIN: 'https://app.example',
  REDIRECT_URI: 'https://app.example/notes/',
};

const results = [];
const check = (n, pass, d) => { results.push({ n, pass });
  console.log((pass ? 'PASS  ' : 'FAIL  ') + n + (d ? '   -> ' + d : '')); };

// Fake GitHub token endpoint. Records what the broker sent.
let sent = [];
let githubReply = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (url !== 'https://github.com/login/oauth/access_token') throw new Error('unexpected ' + url);
  const form = Object.fromEntries(new URLSearchParams(init.body));
  sent.push({ headers: init.headers, form });
  if (githubReply === 'down') throw new TypeError('network');
  return new Response(JSON.stringify(githubReply), { status: 200,
    headers: { 'Content-Type': 'application/json' } });
};

const call = (body, { origin = ENV.ALLOWED_ORIGIN, method = 'POST', env = ENV, raw } = {}) =>
  worker.fetch(new Request('https://broker.example/', {
    method,
    headers: { 'Origin': origin, 'Content-Type': 'application/json' },
    body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined,
  }), env);

const OK = { access_token: 'ghu_abc', expires_in: 28800, refresh_token: 'ghr_def',
             refresh_token_expires_in: 15897600, token_type: 'bearer', scope: '' };

// --- sign-in exchange ---
sent = []; githubReply = OK;
let r = await call({ code: 'code123', code_verifier: 'verifier_' + 'x'.repeat(40) });
let j = await r.json();
check('code + verifier exchanges for tokens', r.status === 200 && j.access_token === 'ghu_abc');
check('refresh token passed back', j.refresh_token === 'ghr_def' && j.expires_in === 28800);
check('secret sent to GitHub', sent[0].form.client_secret === 'super-secret-value');
check('verifier sent to GitHub', sent[0].form.code_verifier.startsWith('verifier_'));
check('redirect_uri comes from config, not the caller',
  sent[0].form.redirect_uri === ENV.REDIRECT_URI);
check('asks GitHub for JSON', sent[0].headers.Accept === 'application/json');
check('secret never appears in the reply', !JSON.stringify(j).includes('super-secret'));
check('reply is not cacheable', r.headers.get('Cache-Control') === 'no-store');
check('CORS allows the app origin', r.headers.get('Access-Control-Allow-Origin') === ENV.ALLOWED_ORIGIN);

// --- a caller cannot choose the redirect ---
sent = []; githubReply = OK;
await call({ code: 'c', code_verifier: 'v', redirect_uri: 'https://evil.example/' });
check('caller-supplied redirect_uri ignored', sent[0].form.redirect_uri === ENV.REDIRECT_URI);

// --- refresh ---
sent = []; githubReply = { ...OK, access_token: 'ghu_new', refresh_token: 'ghr_new' };
r = await call({ refresh_token: 'ghr_old' }); j = await r.json();
check('refresh exchanges', r.status === 200 && j.access_token === 'ghu_new' && j.refresh_token === 'ghr_new');
check('refresh uses grant_type=refresh_token',
  sent[0].form.grant_type === 'refresh_token' && sent[0].form.refresh_token === 'ghr_old');
check('refresh does not send a code', !('code' in sent[0].form));

// --- PKCE is mandatory ---
sent = [];
r = await call({ code: 'code123' });
check('code without verifier is refused', r.status === 400 && sent.length === 0);

// --- origin lock ---
sent = [];
r = await call({ code: 'c', code_verifier: 'v' }, { origin: 'https://evil.example' });
check('other origins refused', r.status === 403 && sent.length === 0);
check('no CORS grant to other origins', r.headers.get('Access-Control-Allow-Origin') === null);
r = await call({ code: 'c', code_verifier: 'v' }, { origin: '' });
check('no origin refused', r.status === 403);

// --- preflight ---
r = await call(null, { method: 'OPTIONS' });
check('preflight ok for the app', r.status === 204 &&
  r.headers.get('Access-Control-Allow-Methods').includes('POST'));
r = await call(null, { method: 'OPTIONS', origin: 'https://evil.example' });
check('preflight refused for others', r.status === 403);

// --- junk ---
r = await call(null, { method: 'GET' });
check('GET refused', r.status === 405);
r = await call(null, { raw: '{not json' });
check('bad JSON refused', r.status === 400);
r = await call({ code: 'a b"; drop', code_verifier: 'v' });
check('malformed code refused before reaching GitHub', r.status === 400);
r = await call({ refresh_token: 'x'.repeat(600) });
check('oversized token refused', r.status === 400);

// --- GitHub-side failures pass the code through ---
githubReply = { error: 'bad_refresh_token', error_description: 'The refresh token passed is incorrect or expired.' };
r = await call({ refresh_token: 'ghr_used' }); j = await r.json();
check('reused refresh token reported as error', r.status === 400 && j.error === 'bad_refresh_token');
githubReply = { error: 'bad_verification_code' };
r = await call({ code: 'c', code_verifier: 'v' }); j = await r.json();
check('expired code reported as error', r.status === 400 && j.error === 'bad_verification_code');
githubReply = 'down';
r = await call({ code: 'c', code_verifier: 'v' }); j = await r.json();
check('GitHub outage is a 502, not a crash', r.status === 502 && j.error === 'github_unreachable');

// --- misconfiguration ---
r = await call({ code: 'c', code_verifier: 'v' }, { env: { ...ENV, CLIENT_SECRET: '' } });
check('missing secret fails closed', r.status === 500);
r = await call({ code: 'c', code_verifier: 'v' }, { env: { ...ENV, ALLOWED_ORIGIN: '' } });
check('missing origin config refuses everyone', r.status === 403);

globalThis.fetch = realFetch;
const bad = results.filter(x => !x.pass);
console.log('\n' + '='.repeat(60) + `\nbroker: ${results.length - bad.length}/${results.length} passed`);
if (bad.length) process.exit(1);
