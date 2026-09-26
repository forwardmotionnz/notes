/* Part of the auth tests, split into its own file so suites run in parallel
   finish sooner (tests/run.mjs). */
import * as H from './harness.mjs';

const t = H.suite('auth-renewal');
await H.start();


/* ===== expiry and refresh ===== */
{
  const gh = H.fakeGitHub({ expiresIn: 30 });     // inside the 60 s margin: refresh on next call
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const before = gh.log.refreshes;
  await p.click('#btn-refresh');
  await H.settle(p, 500);
  t.check('near-expiry token refreshed before use', gh.log.refreshes > before);
  const cfg = JSON.parse((await H.stored(p)).local);
  t.check('rotated refresh token stored', cfg.refresh.startsWith('ghr_') &&
    gh.refresh.get(cfg.refresh).used === false, cfg.refresh);
  t.check('API call used the new token', gh.log.apiAuth.at(-1) === cfg.token);
  t.check('no errors across refresh', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== GitHub revokes the token early: 401 then retry ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  gh.expireAll();
  await p.fill('#pin-input', 'after revoke');
  await p.click('#pin-go');
  await H.settle(p, 700);
  t.check('401 triggers one refresh', gh.log.refreshes === 1);
  t.check('and the write still lands', gh.files['todo.md'].includes('after revoke'));
  t.check('user never saw an error', !(await H.status(p)).toLowerCase().includes('sign'),
    await H.status(p));
  await ctx.close();
}

/* ===== refresh token dead too: clean sign-out ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  gh.expireAll();
  for (const v of gh.refresh.values()) v.used = true;
  await p.click('#btn-refresh');
  // A refused refresh waits up to 2 s for another tab's tokens before
  // signing out (WebKit's storage can lag); wait for the outcome itself.
  await p.waitForFunction(() => document.getElementById('settings').open &&
    !document.getElementById('view-signin').hidden, null, { timeout: 5000 }).catch(() => {});
  t.check('dead refresh token signs you out cleanly', await H.dialogOpen(p) &&
    await p.evaluate(() => !document.getElementById('view-signin').hidden));
  t.check('tokens removed from storage', (await H.stored(p)).local === null);
  await ctx.close();
}

/* ===== two tabs, one refresh token ===== */
{
  const gh = H.fakeGitHub({ expiresIn: 30 });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  t.check('second tab starts signed in', !(await H.dialogOpen(b)));

  // both tabs hit the API at once with a near-expired token
  await Promise.all([a.click('#btn-refresh'), b.click('#btn-refresh')]);
  await a.waitForTimeout(900);                     // tab B reacts through a Web Lock and storage: fixed
  const aOk = !(await H.dialogOpen(a)), bOk = !(await H.dialogOpen(b));
  t.check('simultaneous refresh in two tabs signs neither out', aOk && bOk,
    JSON.stringify({ aOk, bOk, refreshes: gh.log.refreshes }));
  await b.fill('#pin-input', 'from tab b');
  await b.click('#pin-go');
  await H.settle(b, 600);
  t.check('both tabs keep working afterwards', gh.files['todo.md'].includes('from tab b'));
  await ctx.close();
}

/* ===== WebKit: another tab's new tokens reach this one late ===== */
// In WebKit a localStorage write in one tab can reach another a moment after
// the refresh lock does. Tab B is made to see the old tokens for 800 ms after
// tab A has written new ones; B must wait for them, not spend A's used token.
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  await b.evaluate(() => {
    const real = Storage.prototype.getItem;
    const old = localStorage.getItem('notes.config.v2');
    window.lagUntil = 0;
    Storage.prototype.getItem = function (k) {
      // Only local storage lags; session storage must still read as empty.
      return this === localStorage && k === 'notes.config.v2' && Date.now() < window.lagUntil ? old : real.call(this, k);
    };
  });
  // A's refresh takes 300 ms, so B asks while A holds the lock; B then sees
  // the old tokens until 800 ms after A has written the new ones.
  await a.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 300)); return r.fallback(); });
  await b.evaluate(() => { window.lagUntil = Date.now() + 1100; });
  const refreshesBefore = gh.log.refreshes;
  const first = a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  await H.settle(a, 50);                      // A holds the lock, its refresh in flight
  const waited = await b.evaluate(() => navigator.locks.query().then(q => q.held.length === 1));
  const second = b.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  const [ra, rb] = await Promise.all([first, second]);
  t.check('late storage: tab B really asked while A held the lock', waited);
  t.check('late storage: the waiting tab does not spend the used refresh token',
    gh.log.badRefresh === 0 && gh.log.refreshes - refreshesBefore === 1,
    JSON.stringify({ bad: gh.log.badRefresh, ok: gh.log.refreshes - refreshesBefore }));
  t.check('late storage: both tabs stay signed in, on the same new token', ra === 'ok' && rb === 'ok' &&
    (await a.evaluate(() => cfg.token)) === (await b.evaluate(() => cfg.token)), JSON.stringify({ ra, rb, a: await a.evaluate(() => cfg.token), b: await b.evaluate(() => cfg.token), stored: await a.evaluate(() => JSON.parse(localStorage.getItem('notes.config.v2')).token) }));
  await ctx.close();
}

/* ===== offline or the broker down during a refresh: nobody is signed out ===== */
for (const [label, fail] of [['offline', r => r.abort()],
                             ['broker 502', r => r.fulfill({ status: 502, contentType: 'application/json',
                               body: JSON.stringify({ error: 'github_unreachable' }) })]]) {
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  const spent = await a.evaluate(() => cfg.refresh);
  await a.route(H.DEPLOY.broker + '**', fail);
  const r = await a.evaluate(() => refreshTokens().then(() => 'ok', e => (e.retryable ? 'retry:' : 'fail:') + e.message));
  await H.settle(a, 300);
  t.check(`${label}: the refresh fails as "try again", not as a sign-out`, /^retry:.*try again/i.test(r), r);
  t.check(`${label}: the sign-in stays in storage and in both tabs`,
    (await a.evaluate(() => !!JSON.parse(localStorage.getItem('notes.config.v2') || '{}').refresh)) &&
    (await a.evaluate(() => cfg.refresh)) === spent && (await b.evaluate(() => cfg.refresh)) === spent &&
    !(await H.dialogOpen(a)) && !(await H.dialogOpen(b)));
  t.check(`${label}: the refresh token was never spent, so it still works`, gh.refresh.get(spent).used === false);
  await a.unroute(H.DEPLOY.broker + '**');
  t.check(`${label}: and once back, the refresh goes through`,
    (await a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message))) === 'ok');
  await ctx.close();
}

/* ===== storage later still: the waiting tab may give up, but never wipes the new pair ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  await b.evaluate(() => {
    const real = Storage.prototype.getItem;
    const old = localStorage.getItem('notes.config.v2');
    window.lagUntil = Date.now() + 6000;
    Storage.prototype.getItem = function (k) {
      return this === localStorage && k === 'notes.config.v2' && Date.now() < window.lagUntil ? old : real.call(this, k);
    };
  });
  await a.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 300)); return r.fallback(); });
  const first = a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  await H.settle(a, 50);
  const second = b.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  const [ra] = await Promise.all([first, second]);
  const kept = await a.evaluate(() => ({ mine: cfg.token, stored: JSON.parse(localStorage.getItem('notes.config.v2') || '{}').token }));
  t.check('very late storage: the tab that refreshed keeps its new pair, in memory and in storage',
    ra === 'ok' && !!kept.mine && kept.mine === kept.stored && !(await H.dialogOpen(a)), JSON.stringify({ ra, ...kept }));
  await ctx.close();
}

/* ===== a waiting tab takes the other's new token even if it is short-lived ===== */
// The new token is valid, only due for renewal soon; the waiting tab must use
// it, not refresh again (with 30 s tokens every token is "due soon").
{
  const gh = H.fakeGitHub({ expiresIn: 30 });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  await a.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 300)); return r.fallback(); });
  const before = gh.log.refreshes;
  const first = a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  await H.settle(a, 50);
  const second = b.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  const [ra, rb] = await Promise.all([first, second]);
  t.check("short-lived: the waiting tab uses the other's new token, no second refresh",
    ra === 'ok' && rb === 'ok' && gh.log.refreshes - before === 1 && gh.log.badRefresh === 0 &&
    (await a.evaluate(() => cfg.token)) === (await b.evaluate(() => cfg.token)),
    JSON.stringify({ ra, rb, refreshes: gh.log.refreshes - before, bad: gh.log.badRefresh }));
  await ctx.close();
}

/* ===== forced collision: both tabs spend the SAME refresh token ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);

  const shared = await a.evaluate(() => cfg.refresh);
  const bHas = await b.evaluate(() => cfg.refresh);
  t.check('both tabs hold the same refresh token', shared === bHas && !!shared);

  // Fire both refreshes in the same instant. GitHub honours exactly one.
  const [ra, rb] = await Promise.all([
    a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message)),
    b.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message)),
  ]);
  t.check('GitHub accepted the shared token exactly once', gh.refresh.get(shared).used === true);
  t.check('with the lock, the second tab never spends a dead token',
    gh.log.badRefresh === 0 && gh.log.refreshes === 1,
    JSON.stringify({ bad: gh.log.badRefresh, ok: gh.log.refreshes }));
  t.check('the losing tab adopts the winner\'s tokens instead of signing out',
    ra === 'ok' && rb === 'ok', JSON.stringify({ ra, rb }));
  const [ta, tb] = [await a.evaluate(() => cfg.token), await b.evaluate(() => cfg.token)];
  t.check('both tabs end on the same live token', ta === tb && gh.access.has(ta), JSON.stringify({ ta, tb }));
  await ctx.close();
}

/* ===== the storage guard, directly ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const r = await p.evaluate(() => {
    const newer = Object.assign({}, cfg, { token: 'ghu_newer', refresh: 'ghr_newer' });
    localStorage.setItem('notes.config.v2', JSON.stringify(newer));
    signOutLocally('ghr_some_old_spent_token');
    const kept = JSON.parse(localStorage.getItem('notes.config.v2') || 'null');
    localStorage.setItem('notes.config.v2', JSON.stringify(newer));
    signOutLocally('ghr_newer');
    const cleared = localStorage.getItem('notes.config.v2');
    return { kept: kept && kept.refresh, cleared };
  });
  t.check('a failing tab cannot wipe a newer token pair', r.kept === 'ghr_newer', JSON.stringify(r));
  t.check('but does clear the pair that actually failed', r.cleared === null, JSON.stringify(r));
  await ctx.close();
}

/* ===== same collision on a browser without Web Locks ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  await ctx.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined }); } catch (e) {}
  });
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 500);
  t.check('lock API really absent in this test', await a.evaluate(() => !navigator.locks));

  const [ra, rb] = await Promise.all([
    a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message)),
    b.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message)),
  ]);
  t.check('without locks, the loser still recovers by waiting for the winner',
    ra === 'ok' && rb === 'ok', JSON.stringify({ ra, rb }));
  const [ta, tb] = [await a.evaluate(() => cfg.token), await b.evaluate(() => cfg.token)];
  t.check('and both end on the live token', ta === tb && gh.access.has(ta), JSON.stringify({ ta, tb }));
  await ctx.close();
}

/* ===== work computer: session only ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, { remember: false });
  const s = await H.stored(p);
  t.check('session-only chosen before sign-in: nothing on disk', s.local === null && !!s.session,
    JSON.stringify({ local: !!s.local, session: !!s.session }));
  t.check('session badge shown', await p.evaluate(
    () => getComputedStyle(document.getElementById('ephemeral')).display !== 'none'));
  const fresh = await H.page(ctx);                 // a new session in the same profile
  await H.settle(fresh, 400);
  t.check('a new browser session starts signed out', await H.dialogOpen(fresh));
  await ctx.close();
}

/* ===== saving settings in one tab leaves the others signed in ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '# Today\n', 'inbox.md': 'x\n' } });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 600);
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.click('#f-save');                        // nothing changed
  await a.waitForTimeout(500);                     // tab B would react to a storage event: fixed
  t.check('saving settings in one tab does not sign another out', !(await H.dialogOpen(b)));
  await H.clickRow(b, 'inbox.md');
  await H.setEditor(b, 'from tab b\n');
  await H.settle(b, 60);
  await b.click('#btn-save');
  await H.settle(b, 400);
  t.check('and the other tab still saves', gh.files['inbox.md'] === 'from tab b\n');

  // A fresh sign-in in one tab (e.g. after its token was refused) hands the
  // new tokens to the others instead of signing them out.
  await a.evaluate(() => signIn(true));
  await a.waitForURL(u => !u.search.includes('code='), { timeout: 5000 });
  await a.waitForTimeout(600);                     // tab B would react to a storage event: fixed
  t.check('signing in again in one tab does not sign another out', !(await H.dialogOpen(b)));
  t.check('the other tab uses the new token', await b.evaluate(() => cfg.token) === await a.evaluate(() => cfg.token));

  // Choosing "Forget me" in one tab is the exception: the others must stop
  // writing the sign-in to disk, so they are signed out.
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.check('#f-session');
  await a.click('#f-save');
  await H.settle(a, 500);
  t.check('choosing session-only in one tab signs the other out', await H.dialogOpen(b));
  t.check('and nothing is left on disk', (await H.stored(a)).local === null);
  await ctx.close();
}

/* ===== another tab follows a change of repository and pins ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'personal', full_name: 'roldaof/personal', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'work', full_name: 'roldaof/work', default_branch: 'main', private: true },
  ];
  const gh = H.fakeGitHub({ repos, files: { 'todo.md': '# t\n', 'work.md': '# w\n', 'inbox.md': 'x\n' } });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  await a.waitForSelector('#f-save:not([disabled])');
  await a.selectOption('#f-repo', { label: 'roldaof/personal' });
  await a.click('#f-save');
  await H.settle(a, 400);
  const b = await H.page(ctx);
  await H.settle(b, 700);
  await H.clickRow(b, 'inbox.md');
  await H.setEditor(b, 'typed in b before the switch\n');
  await H.settle(b, 60);

  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.selectOption('#f-repo', { label: 'roldaof/work' });
  await a.fill('#f-pins', 'work.md');
  await a.click('#f-save');
  await H.settle(a, 700);
  t.check('the other tab follows to the new repository', (await b.textContent('#crumb')).includes('roldaof/work'),
    await b.textContent('#crumb'));
  t.check('and its pins', JSON.stringify(await b.$$eval('#pin-tabs button', x => x.map(e => e.textContent))) === '["work.md"]');
  const c = gh.commits.find(x => x.path === 'inbox.md');
  t.check('what it had typed went to the repository it came from', !!c && c.repo === 'roldaof/personal',
    JSON.stringify(gh.commits));
  // The other tab writing its settings (as opening Settings or a token
  // refresh does) must not undo the change.
  await b.click('#btn-settings');
  await H.settle(b, 600);
  const fresh = await H.page(ctx);
  await H.settle(fresh, 600);
  t.check('a new tab opens the repository and pins last chosen', (await fresh.textContent('#crumb')).includes('roldaof/work') &&
    JSON.stringify(await fresh.$$eval('#pin-tabs button', x => x.map(e => e.textContent))) === '["work.md"]',
    await fresh.textContent('#crumb'));
  await ctx.close();
}

/* ===== another tab follows a change of pins alone ===== */
{
  const gh = H.fakeGitHub({ files: { 'todo.md': '# t\n', 'later.md': '# l\n' } });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 600);
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.fill('#f-pins', 'todo.md, later.md');
  await a.click('#f-save');
  await H.settle(a, 600);
  t.check('the other tab shows the new pins', JSON.stringify(await b.$$eval('#pin-tabs button',
    x => x.map(e => e.textContent))) === '["todo.md","later.md"]');
  await ctx.close();
}

/* ===== a refresh in flight during sign-out or "Forget me" leaves nothing on disk ===== */
for (const how of ['forget me', 'sign out']) {
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 600);
  // Slow enough that the other tab's sign-out or Settings lands first.
  await b.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 3000)); return r.fallback(); });
  // Tab B renews its token (slowly) while tab A's is still good, so A is
  // not queued behind B's refresh lock.
  b.evaluate(() => refreshTokens().catch(() => {}));
  await H.settle(b, 300);
  if (how === 'forget me') {
    await a.click('#btn-settings');
    await a.waitForSelector('#f-save:not([disabled])');
    await a.check('#f-session');
    await a.click('#f-save');
  } else {
    await a.click('#btn-settings');
    await H.settle(a, 300);
    await a.click('#f-forget');
  }
  await a.waitForTimeout(3500);
  t.check(`a refresh finishing after "${how}" writes nothing to disk`,
    await b.evaluate(() => localStorage.getItem('notes.config.v2')) === null);
  t.check(`and that tab stays signed out`, await b.evaluate(() => !cfg.token));
  t.check('without sending GitHub a request with no token', !gh.log.apiAuth.includes(''),
    JSON.stringify(gh.log.apiAuth.slice(-4)));
  await ctx.close();
}

/* ===== switching back from session-only to remembered sticks ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, { remember: false });
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.uncheck('#f-session');
  await p.click('#f-save');
  await H.settle(p, 400);
  await p.reload({ waitUntil: 'load' });
  await H.settle(p, 500);
  const s = await H.stored(p);
  t.check('back to remembered: on disk, no session copy left to override it', !!s.local && s.session === null);
  t.check('and it stays remembered after a reload', await p.evaluate(
    () => getComputedStyle(document.getElementById('ephemeral')).display === 'none'));
  await ctx.close();
}

/* ===== sign out ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await H.settle(b, 400);

  await a.click('#btn-settings');
  await H.settle(a, 300);
  await a.click('#f-forget');
  await H.settle(a, 700);
  t.check('sign out clears storage', (await H.stored(a)).local === null);
  t.check('sign out lands on the sign-in view', await H.dialogOpen(a));
  await H.settle(b, 300);
  t.check('other open tabs are signed out too', await H.dialogOpen(b));
  await ctx.close();
}

/* ===== mobile ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { viewport: { width: 390, height: 780 } });
  const p = await H.page(ctx);
  await H.settle(p, 200);
  const fits = await p.evaluate(() => {
    const b = document.getElementById('f-signin').getBoundingClientRect();
    return b.left >= 0 && b.right <= innerWidth && b.height >= 40;
  });
  t.check('sign-in button fits and is thumb-sized on a phone', fits);
  await H.signIn(p);
  t.check('phone sign-in lands in the notes', (await H.rows(p)).includes('todo.md'));
  await ctx.close();
}


await H.stop();
t.finish();
