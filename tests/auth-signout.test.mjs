/* A late profile reply must not restore credentials during sign-out navigation. */
import * as H from './harness.mjs';

const t = H.suite('auth-signout');
const bounded = promise => Promise.race([promise, new Promise((_, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for the controlled response')), 5000);
  timer.unref();
})]);
await H.start();
const gh = H.fakeGitHub();
const ctx = await H.context(gh);
const a = await H.page(ctx);
await H.signIn(a);
await a.waitForFunction(() => configured() && treeState === 'ok' && cfg.login);
const b = await H.page(ctx);
await b.waitForFunction(() => configured() && treeState === 'ok');

let releaseUser, releaseList, sawUser, sawList, profileAttempted, listAttempted;
const userGate = new Promise(resolve => { releaseUser = resolve; });
const listGate = new Promise(resolve => { releaseList = resolve; });
const userStarted = new Promise(resolve => { sawUser = resolve; });
const listStarted = new Promise(resolve => { sawList = resolve; });
const profileFinished = new Promise(resolve => { profileAttempted = resolve; });
const listFinished = new Promise(resolve => { listAttempted = resolve; });
// Observe completion of the real profile callback without altering its write.
await a.exposeFunction('__profileAttempted', profileAttempted);
await a.exposeFunction('__listAttempted', listAttempted);
await a.evaluate(() => {
  const original = saveCfg;
  saveCfg = function () { original(); window.__profileAttempted(); };
  const originalList = loadRepoList;
  loadRepoList = function () { return originalList().then(() => window.__listAttempted()); };
  // Keep the old document alive until we reload explicitly. WebKit aborts
  // requests when a full navigation starts, even if its response is held.
  // A same-document destination models the window before page destruction.
  const destination = redirectUri();
  redirectUri = () => destination + '#signout-pending';
});
await a.route('https://api.github.com/user', async route => {
  sawUser(); await userGate; return route.fallback();
});
await a.route(/^https:\/\/api\.github\.com\/user\/installations\/[^/]+\/repositories(?:\?|$)/, async route => {
  sawList(); await listGate; return route.fallback();
});
await a.click('#btn-settings');
await bounded(Promise.all([userStarted, listStarted]));
await a.click('#f-forget');
await b.waitForFunction(() => !cfg.token && localStorage.getItem('notes.config.v2') === null);
releaseUser();
await bounded(profileFinished);
t.check('late profile completion cannot recreate stored credentials', (await H.stored(b)).local === null);
releaseList();
await bounded(listFinished);
t.check('late repository list cannot recreate forgotten preferences',
  await b.evaluate(() => localStorage.getItem('notes.ui.v1') === null));
await a.reload({ waitUntil: 'load' });
await H.settle(a, 500);
t.check('sign-out navigation remains signed out', await a.evaluate(() => !cfg.token &&
  localStorage.getItem('notes.config.v2') === null && document.getElementById('settings').open &&
  !document.getElementById('view-signin').hidden));
t.check('the other tab has no restored token behind its sign-in dialog',
  await b.evaluate(() => !cfg.token && document.getElementById('settings').open));
await ctx.close();
await H.stop();
t.finish();
