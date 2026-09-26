import * as H from './harness.mjs';

const t = H.suite('auth');
await H.start();

/* ===== first visit, not deployed ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { deploy: false });
  const p = await H.page(ctx);
  await p.waitForTimeout(200);
  t.check('undeployed copy shows sign-in dialog', await H.dialogOpen(p));
  t.check('and explains it needs setting up',
    await p.evaluate(() => !document.getElementById('not-deployed').hidden));
  t.check('sign-in button disabled until configured', await p.isDisabled('#f-signin'));
  await ctx.close();
}

/* ===== the happy path ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.waitForTimeout(200);
  t.check('signed-out visit shows only the sign-in button',
    await p.evaluate(() => !document.getElementById('view-signin').hidden &&
                           document.getElementById('view-account').hidden));
  t.check('no repo, owner, branch or token fields anywhere',
    await p.evaluate(() => !document.querySelector('#f-owner, #f-token, #f-branch')));
  t.check('Escape does not dismiss the sign-in dialog', await (async () => {
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    return H.dialogOpen(p);
  })());

  await H.signIn(p);

  const a = gh.log.authorize[0];
  t.check('authorize carries our client id', a.client_id === H.DEPLOY.clientId);
  t.check('authorize uses PKCE S256', a.code_challenge_method === 'S256' && a.code_challenge.length === 43,
    a.code_challenge);
  t.check('authorize carries a state value', a.state && a.state.length >= 20);
  t.check('redirect is the app URL exactly', a.redirect_uri === H.APP(), a.redirect_uri);
  t.check('code exchanged exactly once, PKCE verified by the fake', gh.log.exchanges === 1);
  t.check('code and state removed from the address bar', !p.url().includes('code='), p.url());

  t.check('single installed repo chosen automatically', !(await H.dialogOpen(p)));
  t.check('its notes are loaded', (await H.rows(p)).includes('todo.md'), JSON.stringify(await H.rows(p)));
  t.check('header shows the repo', (await p.textContent('#crumb')).includes('roldaof/obsidian-vault'));

  const s = await H.stored(p);
  t.check('remembered on this browser', !!s.local && s.session === null);
  t.check('PKCE verifier not left behind',
    await p.evaluate(() => sessionStorage.getItem('notes.signin') === null));

  await p.fill('#pin-input', 'signed in with GitHub');
  await p.click('#pin-go');
  await p.waitForTimeout(400);
  t.check('writes go through with the GitHub App token',
    gh.files['todo.md'].includes('- [ ] signed in with GitHub') &&
    gh.commits.at(-1).token.startsWith('ghu_'));

  // reload: no dialog, straight in
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(500);
  t.check('reload goes straight to the notes', !(await H.dialogOpen(p)) &&
    (await H.rows(p)).includes('todo.md'));
  t.check('no second sign-in on reload', gh.log.authorize.length === 1);

  // account view shows who you are
  await p.click('#btn-settings');
  await p.waitForTimeout(400);
  t.check('settings shows the GitHub login',
    (await p.textContent('#who-login')) === '@roldaof', await p.textContent('#who-login'));
  t.check('install link points at the app',
    (await p.getAttribute('#f-install', 'href')) === 'https://github.com/apps/notes-test/installations/new');
  t.check('no page errors on the happy path', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== several repositories: a real choice ===== */
{
  const gh = H.fakeGitHub({ repos: [
    { owner: { login: 'roldaof' }, name: 'obsidian-vault', full_name: 'roldaof/obsidian-vault', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'work-notes', full_name: 'roldaof/work-notes', default_branch: 'trunk', private: true },
  ]});
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  t.check('with two repos the picker stays open', await H.dialogOpen(p));
  const opts = await p.$$eval('#f-repo option', o => o.map(x => x.textContent));
  t.check('both repos offered', opts.length === 2 && opts.join().includes('work-notes'), JSON.stringify(opts));

  await p.selectOption('#f-repo', { index: 1 });
  await p.click('#f-save');
  await p.waitForTimeout(400);
  const cfg = JSON.parse((await H.stored(p)).local);
  t.check('choice saved with its default branch', cfg.repo === 'work-notes' && cfg.branch === 'trunk',
    JSON.stringify({ repo: cfg.repo, branch: cfg.branch }));
  await ctx.close();
}

/* ===== app installed nowhere yet ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  t.check('no repos: dialog stays, save disabled', (await H.dialogOpen(p)) && (await p.isDisabled('#f-save')));
  t.check('and points you to install it',
    (await p.textContent('#repo-hint')).includes('not installed'), await p.textContent('#repo-hint'));
  await ctx.close();
}

/* ===== CSRF: a code we did not ask for ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { tamperState: true });
  const p = await H.page(ctx);
  await p.waitForSelector('#f-signin:not([disabled])');
  await p.click('#f-signin');
  await p.waitForTimeout(800);
  t.check('mismatched state is refused', gh.log.exchanges === 0);
  t.check('user told to try again',
    (await p.textContent('#signin-error')).toLowerCase().includes('try again'),
    await p.textContent('#signin-error'));
  t.check('nothing stored', (await H.stored(p)).local === null);
  await ctx.close();
}

/* ===== a code planted in a link ===== */
{
  const gh = H.fakeGitHub();
  gh.codes.set('attacker_code', { challenge: 'x', used: false });
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?code=attacker_code&state=whatever');
  await p.waitForTimeout(500);
  t.check('a code arriving without our sign-in is never exchanged', gh.log.exchanges === 0 &&
    gh.codes.get('attacker_code').used === false);
  t.check('and scrubbed from the URL', !p.url().includes('attacker_code'));
  await ctx.close();
}

/* ===== returning from installing the app on github.com ===== */
// Only a first install sends the browser back (with a code we did not ask
// for, no state, and setup_action); changing repositories later does not
// come back at all. Nobody is signed in by a return alone, and where we
// cannot know whether they wanted to be remembered, "Forget me" starts on.
{
  const gh = H.fakeGitHub();
  gh.codes.set('install_code', { challenge: 'x', used: false });
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?code=install_code&installation_id=77&setup_action=install');
  await p.waitForTimeout(600);
  t.check('install redirect leaves a clean address', !p.url().includes('code='), p.url());
  t.check('install redirect does not sign anyone in by itself', gh.log.authorize.length === 0 &&
    (await H.stored(p)).local === null);
  t.check('the unsolicited install code is not used', gh.codes.get('install_code').used === false);
  t.check('it shows the sign-in view with a note, not an error', await H.dialogOpen(p) &&
    /another Notes tab/i.test(await p.textContent('#signin-info')) && await p.isHidden('#signin-error'),
    await p.textContent('#signin-info'));
  t.check('"Forget me" starts ticked there', await p.isChecked('#f-session-in'));
  await p.click('#f-signin');
  await p.waitForURL(u => !u.search.includes('code='), { timeout: 5000 });
  await p.waitForTimeout(600);
  t.check('one click signs in, session-only unless they untick it', (await H.rows(p)).includes('todo.md') &&
    (await H.stored(p)).local === null && !!(await H.stored(p)).session);
  await ctx.close();
}

/* ===== choosing repositories from a session-only tab ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, { remember: false });
  await p.waitForSelector('#view-account:not([hidden])');
  t.check('"Choose repositories" opens GitHub in a new tab, leaving this one as it is',
    (await p.getAttribute('#f-install', 'target')) === '_blank');
  // The person adds a repository on GitHub, then comes back to this tab.
  gh.repos.push({ owner: { login: 'roldaof' }, name: 'fresh', full_name: 'roldaof/fresh',
                  default_branch: 'main', private: true });
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(600);
  const opts = await p.$$eval('#f-repo option', o => o.map(x => x.textContent));
  // One repository is picked for you, so the dialog may already have closed on it.
  t.check('coming back to the tab refreshes the list', opts.some(o => o.includes('roldaof/fresh')) ||
    (!(await H.dialogOpen(p)) && (await p.textContent('#crumb')).includes('roldaof/fresh')), JSON.stringify(opts));
  const s = await H.stored(p);
  t.check('still session-only, nothing on disk', s.local === null && !!s.session);
  await ctx.close();
}

/* ===== a refresh on coming back keeps the repository they had picked ===== */
{
  const two = [
    { owner: { login: 'roldaof' }, name: 'a', full_name: 'roldaof/a', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'b', full_name: 'roldaof/b', default_branch: 'main', private: true },
  ];
  const gh = H.fakeGitHub({ repos: two });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/b' });        // picked, not saved yet
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(600);
  t.check('a refresh keeps the unsaved pick',
    (await p.$eval('#f-repo', s => s.options[s.selectedIndex].textContent)).includes('roldaof/b'));
  await ctx.close();
}

/* ===== a remembered sign-in returning from a first install in a new tab ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  gh.repos.push({ owner: { login: 'roldaof' }, name: 'a', full_name: 'roldaof/a', default_branch: 'main', private: true },
                { owner: { login: 'roldaof' }, name: 'b', full_name: 'roldaof/b', default_branch: 'main', private: true });
  let lists = 0;
  ctx.on('request', r => { if (/\/user\/installations\?per_page=100&page=1$/.test(r.url())) lists++; });
  const q = await H.page(ctx, H.APP() + '?code=install_code3&installation_id=77&setup_action=install');
  await q.waitForTimeout(800);
  t.check('a remembered sign-in carries on without signing in again', gh.log.authorize.length === 1 &&
    await q.isVisible('#view-account'));
  t.check('and fetches the repository list once', lists === 1, String(lists));
  await ctx.close();
}

/* ===== a slow, older repository list never overrides a newer one ===== */
{
  const gh = H.fakeGitHub({ repos: [
    { owner: { login: 'roldaof' }, name: 'a', full_name: 'roldaof/a', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'b', full_name: 'roldaof/b', default_branch: 'main', private: true },
  ] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/a' });
  await p.click('#f-save');
  await p.waitForTimeout(400);
  let first = true;
  await p.route(/\/user\/installations\?per_page=100&page=1$/, async r => {
    if (first) { first = false; await new Promise(res => setTimeout(res, 1500)); }
    return r.fallback();
  });
  await p.click('#btn-settings');                  // slow list
  await p.keyboard.press('Escape');
  await p.click('#btn-settings');                  // fast list
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/b' });
  await p.waitForTimeout(1800);                    // the slow one arrives
  t.check("an older list arriving late does not undo the person's choice",
    (await p.$eval('#f-repo', s => s.options[s.selectedIndex].textContent)).includes('roldaof/b'));
  await ctx.close();
}

/* ===== cancel on GitHub ===== */
{
  const gh = H.fakeGitHub();
  gh.denyNext = true;
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.waitForSelector('#f-signin:not([disabled])');
  await p.click('#f-signin');
  await p.waitForTimeout(700);
  t.check('cancelling on GitHub returns to sign-in with the reason',
    (await p.textContent('#signin-error')).includes('denied'), await p.textContent('#signin-error'));
  t.check("in the app's own words, not GitHub's", !/your application/i.test(await p.textContent('#signin-error')),
    await p.textContent('#signin-error'));
  t.check('button usable again', await p.isEnabled('#f-signin'));
  await ctx.close();
}

/* ===== an abandoned sign-in, then a crafted error link in the same tab ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.waitForTimeout(300);
  // As if Sign in was clicked and the person came Back from GitHub.
  await p.evaluate(() => sessionStorage.setItem('notes.signin', JSON.stringify({ state: 'ours', verifier: 'v', session: false })));
  await p.goto(H.APP() + '?error=access_denied&state=theirs', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  t.check('an error whose state is not ours is not taken as our cancel',
    /did not finish in this tab/i.test(await p.textContent('#signin-error')), await p.textContent('#signin-error'));
  await ctx.close();
}

/* ===== crafted links: an error or code this tab did not ask for ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const lie = 'Your GitHub session was revoked. Re-authorise at https://evil.example/login';
  const q = await H.page(ctx, H.APP() + '?error=access_denied&error_description=' + encodeURIComponent(lie));
  await q.waitForTimeout(700);
  t.check('a crafted error link does not hide a signed-in person\'s notes',
    !(await H.dialogOpen(q)) && (await H.rows(q)).includes('todo.md'));
  t.check('its words appear nowhere', !(await q.evaluate(() => document.body.innerText)).includes('evil.example'));
  t.check('and the address is clean', !q.url().includes('error'), q.url());
  const r = await H.page(ctx, H.APP() + '?code=junk&state=junk');
  await r.waitForTimeout(700);
  t.check('a crafted code link does not interrupt a signed-in person either',
    !(await H.dialogOpen(r)) && (await H.rows(r)).includes('todo.md'));
  await ctx.close();
}
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?error=server_error&error_description=' + encodeURIComponent('Call 0800 FAKE now'));
  await p.waitForTimeout(500);
  t.check('signed out, a crafted error link shows only fixed words', await H.dialogOpen(p) &&
    /did not finish in this tab/i.test(await p.textContent('#signin-error')) &&
    !(await p.evaluate(() => document.body.innerText)).includes('0800'), await p.textContent('#signin-error'));
  await ctx.close();
}

/* ===== a real sign-in coming back to a tab that lost its state ===== */
// iOS can discard a tab while someone fetches a 2FA code. The code is not
// used, but they are told, instead of landing back where they started.
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?code=real_but_orphaned&state=lost');
  await p.waitForTimeout(500);
  t.check('a sign-in that lost its state says so', /did not finish in this tab/i.test(await p.textContent('#signin-error')),
    await p.textContent('#signin-error'));
  t.check('with "Forget me" ticked, since their choice is unknown', await p.isChecked('#f-session-in'));
  await ctx.close();
}

/* ===== "Forget me" survives a cancel on GitHub ===== */
{
  const gh = H.fakeGitHub();
  gh.denyNext = true;
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, { remember: false }).catch(() => {});
  await p.waitForTimeout(500);
  t.check('after a cancel, "Forget me" is still ticked', await p.isChecked('#f-session-in'));
  await p.click('#f-signin');
  await p.waitForURL(u => !u.search.includes('code='), { timeout: 5000 });
  await p.waitForTimeout(600);
  const st = await H.stored(p);
  t.check('so the retry leaves nothing on disk', st.local === null && !!st.session);
  await ctx.close();
}

/* ===== the "Forget me" choice survives a failed code exchange ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await p.route(H.DEPLOY.broker + '**', r => r.fulfill({ status: 400, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': new URL(H.APP()).origin },
    body: JSON.stringify({ error: 'bad_verification_code' }) }));
  await H.signIn(p, { remember: true }).catch(() => {});
  await p.waitForTimeout(500);
  t.check('a failed exchange is reported', (await p.textContent('#signin-error')).length > 0);
  t.check('and the retry keeps their choice (here: remembered)', !(await p.isChecked('#f-session-in')));
  await ctx.close();
}

/* ===== a signed-in tab ignores a code that does not match its old sign-in ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.evaluate(() => sessionStorage.setItem('notes.signin', JSON.stringify({ state: 'old', verifier: 'v', session: false })));
  await p.goto(H.APP() + '?code=junk&state=junk', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  t.check('a signed-in tab is not interrupted by a mismatched code', !(await H.dialogOpen(p)) &&
    (await H.rows(p)).includes('todo.md'));
  await ctx.close();
}

/* ===== expiry and refresh ===== */
{
  const gh = H.fakeGitHub({ expiresIn: 30 });     // inside the 60 s margin: refresh on next call
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  const before = gh.log.refreshes;
  await p.click('#btn-refresh');
  await p.waitForTimeout(500);
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
  await p.waitForTimeout(700);
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
  await b.waitForTimeout(500);
  t.check('second tab starts signed in', !(await H.dialogOpen(b)));

  // both tabs hit the API at once with a near-expired token
  await Promise.all([a.click('#btn-refresh'), b.click('#btn-refresh')]);
  await a.waitForTimeout(900);
  const aOk = !(await H.dialogOpen(a)), bOk = !(await H.dialogOpen(b));
  t.check('simultaneous refresh in two tabs signs neither out', aOk && bOk,
    JSON.stringify({ aOk, bOk, refreshes: gh.log.refreshes }));
  await b.fill('#pin-input', 'from tab b');
  await b.click('#pin-go');
  await b.waitForTimeout(600);
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
  await b.waitForTimeout(500);
  await b.evaluate(() => {
    const real = Storage.prototype.getItem;
    const old = localStorage.getItem('notes.config.v2');
    window.lagUntil = 0;
    Storage.prototype.getItem = function (k) {
      return k === 'notes.config.v2' && Date.now() < window.lagUntil ? old : real.call(this, k);
    };
  });
  // A's refresh takes 300 ms, so B asks while A holds the lock; B then sees
  // the old tokens until 800 ms after A has written the new ones.
  await a.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 300)); return r.fallback(); });
  await b.evaluate(() => { window.lagUntil = Date.now() + 1100; });
  const refreshesBefore = gh.log.refreshes;
  const first = a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  await a.waitForTimeout(50);                      // A holds the lock, its refresh in flight
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

/* ===== a waiting tab takes the other's new token even if it is short-lived ===== */
// The new token is valid, only due for renewal soon; the waiting tab must use
// it, not refresh again (with 30 s tokens every token is "due soon").
{
  const gh = H.fakeGitHub({ expiresIn: 30 });
  const ctx = await H.context(gh);
  const a = await H.page(ctx);
  await H.signIn(a);
  const b = await H.page(ctx);
  await b.waitForTimeout(500);
  await a.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 300)); return r.fallback(); });
  const before = gh.log.refreshes;
  const first = a.evaluate(() => refreshTokens().then(() => 'ok', e => 'fail:' + e.message));
  await a.waitForTimeout(50);
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
  await b.waitForTimeout(500);

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
  await b.waitForTimeout(500);
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
  await fresh.waitForTimeout(400);
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
  await b.waitForTimeout(600);
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.click('#f-save');                        // nothing changed
  await a.waitForTimeout(500);
  t.check('saving settings in one tab does not sign another out', !(await H.dialogOpen(b)));
  await H.clickRow(b, 'inbox.md');
  await H.setEditor(b, 'from tab b\n');
  await b.waitForTimeout(60);
  await b.click('#btn-save');
  await b.waitForTimeout(400);
  t.check('and the other tab still saves', gh.files['inbox.md'] === 'from tab b\n');

  // A fresh sign-in in one tab (e.g. after its token was refused) hands the
  // new tokens to the others instead of signing them out.
  await a.evaluate(() => signIn(true));
  await a.waitForURL(u => !u.search.includes('code='), { timeout: 5000 });
  await a.waitForTimeout(600);
  t.check('signing in again in one tab does not sign another out', !(await H.dialogOpen(b)));
  t.check('the other tab uses the new token', await b.evaluate(() => cfg.token) === await a.evaluate(() => cfg.token));

  // Choosing "Forget me" in one tab is the exception: the others must stop
  // writing the sign-in to disk, so they are signed out.
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.check('#f-session');
  await a.click('#f-save');
  await a.waitForTimeout(500);
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
  await a.waitForTimeout(400);
  const b = await H.page(ctx);
  await b.waitForTimeout(700);
  await H.clickRow(b, 'inbox.md');
  await H.setEditor(b, 'typed in b before the switch\n');
  await b.waitForTimeout(60);

  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.selectOption('#f-repo', { label: 'roldaof/work' });
  await a.fill('#f-pins', 'work.md');
  await a.click('#f-save');
  await a.waitForTimeout(700);
  t.check('the other tab follows to the new repository', (await b.textContent('#crumb')).includes('roldaof/work'),
    await b.textContent('#crumb'));
  t.check('and its pins', JSON.stringify(await b.$$eval('#pin-tabs button', x => x.map(e => e.textContent))) === '["work.md"]');
  const c = gh.commits.find(x => x.path === 'inbox.md');
  t.check('what it had typed went to the repository it came from', !!c && c.repo === 'roldaof/personal',
    JSON.stringify(gh.commits));
  // The other tab writing its settings (as opening Settings or a token
  // refresh does) must not undo the change.
  await b.click('#btn-settings');
  await b.waitForTimeout(600);
  const fresh = await H.page(ctx);
  await fresh.waitForTimeout(600);
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
  await b.waitForTimeout(600);
  await a.click('#btn-settings');
  await a.waitForSelector('#f-save:not([disabled])');
  await a.fill('#f-pins', 'todo.md, later.md');
  await a.click('#f-save');
  await a.waitForTimeout(600);
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
  await b.waitForTimeout(600);
  // Slow enough that the other tab's sign-out or Settings lands first.
  await b.route(H.DEPLOY.broker + '**', async r => { await new Promise(res => setTimeout(res, 3000)); return r.fallback(); });
  // Tab B renews its token (slowly) while tab A's is still good, so A is
  // not queued behind B's refresh lock.
  b.evaluate(() => refreshTokens().catch(() => {}));
  await b.waitForTimeout(300);
  if (how === 'forget me') {
    await a.click('#btn-settings');
    await a.waitForSelector('#f-save:not([disabled])');
    await a.check('#f-session');
    await a.click('#f-save');
  } else {
    await a.click('#btn-settings');
    await a.waitForTimeout(300);
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
  await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(500);
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
  await b.waitForTimeout(400);

  await a.click('#btn-settings');
  await a.waitForTimeout(300);
  await a.click('#f-forget');
  await a.waitForTimeout(700);
  t.check('sign out clears storage', (await H.stored(a)).local === null);
  t.check('sign out lands on the sign-in view', await H.dialogOpen(a));
  await b.waitForTimeout(300);
  t.check('other open tabs are signed out too', await H.dialogOpen(b));
  await ctx.close();
}

/* ===== mobile ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { viewport: { width: 390, height: 780 } });
  const p = await H.page(ctx);
  await p.waitForTimeout(200);
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
