import * as H from './harness.mjs';

const t = H.suite('auth');
await H.start();


/* ===== first visit, not deployed ===== */
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { deploy: false });
  const p = await H.page(ctx);
  await H.settle(p, 200);
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
  await H.settle(p, 200);
  t.check('signed-out visit shows only the sign-in button',
    await p.evaluate(() => !document.getElementById('view-signin').hidden &&
                           document.getElementById('view-account').hidden));
  t.check('no repo, owner, branch or token fields anywhere',
    await p.evaluate(() => !document.querySelector('#f-owner, #f-token, #f-branch')));
  t.check('Escape does not dismiss the sign-in dialog', await (async () => {
    await p.keyboard.press('Escape'); await H.settle(p, 100);
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
  await H.settle(p, 400);
  t.check('writes go through with the GitHub App token',
    gh.files['todo.md'].includes('- [ ] signed in with GitHub') &&
    gh.commits.at(-1).token.startsWith('ghu_'));

  // reload: no dialog, straight in
  await p.reload({ waitUntil: 'load' });
  await H.settle(p, 500);
  t.check('reload goes straight to the notes', !(await H.dialogOpen(p)) &&
    (await H.rows(p)).includes('todo.md'));
  t.check('no second sign-in on reload', gh.log.authorize.length === 1);

  // account view shows who you are
  await p.click('#btn-settings');
  await H.settle(p, 400);
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
  await H.settle(p, 400);
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
  await H.settle(p, 800);
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
  await H.settle(p, 500);
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
  await H.settle(p, 600);
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
  await H.settle(p, 600);
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
  await H.settle(p, 600);
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
  await H.settle(p, 600);
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
  await H.settle(q, 800);
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
  await H.settle(p, 400);
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
  await H.settle(p, 700);
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
  await H.settle(p, 300);
  // As if Sign in was clicked and the person came Back from GitHub.
  await p.evaluate(() => sessionStorage.setItem('notes.signin', JSON.stringify({ state: 'ours', verifier: 'v', session: false })));
  await p.goto(H.APP() + '?error=access_denied&state=theirs', { waitUntil: 'load' });
  await H.settle(p, 400);
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
  await H.settle(q, 700);
  t.check('a crafted error link does not hide a signed-in person\'s notes',
    !(await H.dialogOpen(q)) && (await H.rows(q)).includes('todo.md'));
  t.check('its words appear nowhere', !(await q.evaluate(() => document.body.innerText)).includes('evil.example'));
  t.check('and the address is clean', !q.url().includes('error'), q.url());
  const r = await H.page(ctx, H.APP() + '?code=junk&state=junk');
  await H.settle(r, 700);
  t.check('a crafted code link does not interrupt a signed-in person either',
    !(await H.dialogOpen(r)) && (await H.rows(r)).includes('todo.md'));
  await ctx.close();
}
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?error=server_error&error_description=' + encodeURIComponent('Call 0800 FAKE now'));
  await H.settle(p, 500);
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
  await H.settle(p, 500);
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
  await H.settle(p, 500);
  t.check('after a cancel, "Forget me" is still ticked', await p.isChecked('#f-session-in'));
  await p.click('#f-signin');
  await p.waitForURL(u => !u.search.includes('code='), { timeout: 5000 });
  await H.settle(p, 600);
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
  await H.settle(p, 500);
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
  await H.settle(p, 600);
  t.check('a signed-in tab is not interrupted by a mismatched code', !(await H.dialogOpen(p)) &&
    (await H.rows(p)).includes('todo.md'));
  await ctx.close();
}


await H.stop();
t.finish();
