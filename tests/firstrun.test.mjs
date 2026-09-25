/* Signed in, but the app is on no repository yet: one clear way forward. */
import * as H from './harness.mjs';

const t = H.suite('firstrun');
await H.start();

const repo = name => ({ owner: { login: 'roldaof' }, name, full_name: 'roldaof/' + name,
                        default_branch: 'main', private: true });
const backToTab = p => p.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
// Everything in the dialog a person could click or type into, as they see it.
const controls = p => p.$$eval('#settings a, #settings button, #settings input, #settings select',
  els => els.filter(e => e.offsetParent !== null || e.getClientRects().length).map(e => e.id || e.textContent.trim()));

/* ===== the whole way: nothing, a new empty repository, the first note ===== */
{
  const gh = H.fakeGitHub({ repos: [], empty: true, files: {} });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  t.check('the first-run steps are shown', await H.dialogOpen(p) && await p.isVisible('#firstrun'));
  const shown = await controls(p);
  t.check('and nothing else competes: only the two steps, "Check now" and Sign out',
    JSON.stringify(shown.slice().sort()) === JSON.stringify(['f-forget', 'fr-check', 'fr-create', 'fr-install']),
    JSON.stringify(shown));
  t.check('step 1 has the focus, not Sign out', (await p.evaluate(() => document.activeElement.id)) === 'fr-create',
    await p.evaluate(() => document.activeElement.id));
  const create = new URL(await p.getAttribute('#fr-create', 'href'));
  // https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository#creating-a-new-repository-from-a-url-query
  t.check('step 1 opens GitHub\'s new repository form, named and private already',
    create.origin + create.pathname === 'https://github.com/new' && create.searchParams.get('name') === 'notes' &&
    create.searchParams.get('visibility') === 'private', create.href);
  t.check('step 2 opens installing the app, to choose that repository',
    /^https:\/\/github\.com\/apps\/[^/]+\/installations\/new$/.test(await p.getAttribute('#fr-install', 'href')));
  t.check('both in a new tab, with no way back into this page',
    (await p.getAttribute('#fr-create', 'target')) === '_blank' && (await p.getAttribute('#fr-install', 'target')) === '_blank' &&
    /noopener/.test(await p.getAttribute('#fr-create', 'rel')) && /noopener/.test(await p.getAttribute('#fr-install', 'rel')));
  t.check('the steps say what happens', /create/i.test(await p.textContent('#fr-create')) &&
    /repository/i.test(await p.textContent('#firstrun')) && /come back/i.test(await p.textContent('#firstrun')),
    await p.textContent('#firstrun'));

  // On GitHub: a new, empty repository, and the app installed on it.
  gh.repos.push(repo('notes'));
  await backToTab(p);
  await p.waitForTimeout(800);
  t.check('coming back, the one repository is chosen by itself', !(await H.dialogOpen(p)) &&
    (await p.textContent('#crumb')).includes('roldaof/notes'), await p.textContent('#crumb'));
  t.check('and it says how to write the first note', /empty.*press \+/i.test(await p.textContent('#tree')),
    await p.textContent('#tree'));
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.accept('Welcome'));
  await p.click('#btn-new');
  await p.waitForTimeout(200);
  await p.click('#btn-save');
  await p.waitForTimeout(600);
  t.check('and the first note is a commit in it', gh.commits.some(c => c.path === 'Welcome.md' && c.repo === 'roldaof/notes'),
    JSON.stringify(gh.commits));
  t.check('settings later show the usual form again', await (async () => {
    await p.click('#btn-settings'); await p.waitForTimeout(500);
    return (await p.isHidden('#firstrun')) && (await p.isVisible('#f-repo')) && (await p.isVisible('#f-save'));
  })());
  // GitHub answers 409 for a repository with no commits yet (see B1); the
  // browser logs that response, the app does not.
  const unexpected = p.errors.filter(e => !/status of 409 \(Conflict\)/.test(e));
  t.check('no page errors', unexpected.length === 0, unexpected.join(' | '));
  await ctx.close();
}

/* ===== "Check now", and more than one repository ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  await p.click('#fr-check');
  await p.waitForTimeout(500);
  t.check('"Check now" with still nothing keeps the steps, and says so', await p.isVisible('#firstrun') &&
    /still/i.test(await p.textContent('#firstrun')), await p.textContent('#firstrun'));
  // The network drops just as they check.
  await ctx.route('**/user/installations?**', r => r.abort());
  await p.click('#fr-check');
  await p.waitForTimeout(500);
  t.check('a check that fails stays on the steps and says to try again', await p.isVisible('#firstrun') &&
    /try again/i.test(await p.textContent('#fr-status')), await p.textContent('#fr-status'));
  await ctx.unroute('**/user/installations?**');
  gh.repos.push(repo('a'), repo('b'));
  await p.click('#fr-check');
  await p.waitForTimeout(600);
  t.check('with two, the steps give way to the usual choice', await p.isHidden('#firstrun') &&
    (await p.$$eval('#f-repo option', o => o.map(x => x.textContent))).join() === 'roldaof/a,roldaof/b' &&
    !(await p.isDisabled('#f-save')));
  await p.selectOption('#f-repo', { label: 'roldaof/b' });
  await p.click('#f-save');
  await p.waitForTimeout(600);
  t.check('and choosing one opens it', !(await H.dialogOpen(p)) && (await p.textContent('#crumb')).includes('roldaof/b'));
  await ctx.close();
}

/* ===== a list that failed is not "no repositories" ===== */
{
  const gh = H.fakeGitHub({ installations: [{ id: 9, account: { login: 'roldaof', type: 'User' }, repos: [repo('x')] }] });
  const ctx = await H.context(gh);
  await ctx.route('**/user/installations/9/repositories**', r => r.fulfill({ status: 403,
    contentType: 'application/json', body: JSON.stringify({ message: 'This installation has been suspended' }) }));
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(700);
  t.check('an installation that did not answer does not send them off to make a repository',
    await p.isHidden('#firstrun') && /could not be listed/i.test(await p.textContent('#repos-failed')) &&
    await p.isVisible('#f-retry'), await p.textContent('#repos-failed'));
  await ctx.close();
}
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  let down = true;
  await ctx.route('**/user/installations?**', r => down ? r.abort() : r.fallback());
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(700);
  t.check('nor does a list that could not be loaded at all', await p.isHidden('#firstrun') &&
    /could not load/i.test(await p.textContent('#repos-failed')), await p.textContent('#repos-failed'));
  t.check('which says so where it can be seen, with Try again (the dialog cannot be closed yet)',
    await p.isVisible('#repos-failed') && await p.isVisible('#f-retry'));
  down = false;
  await p.click('#f-retry');
  await p.waitForTimeout(600);
  t.check('and once it loads, empty, the steps appear', await p.isVisible('#firstrun') && await p.isHidden('#repos-failed'));
  await ctx.close();
}

/* ===== review: after the steps, nothing public is chosen for anyone ===== */
{
  const pub = n => ({ ...repo(n), private: false });
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  // Step 2 with GitHub's default, "All repositories".
  gh.repos.push(pub('blog'), repo('archive'), pub('dotfiles'), repo('notes'));
  await backToTab(p);
  await p.waitForTimeout(600);
  const chosen = () => p.$eval('#f-repo', s => s.options[s.selectedIndex].textContent);
  t.check('with others listed first, the private "notes" just made is the one chosen',
    (await chosen()) === 'roldaof/notes', await chosen());
  await p.selectOption('#f-repo', await p.$eval('#f-repo', s =>
    [...s.options].find(o => o.textContent.startsWith('roldaof/blog')).value));
  t.check('choosing a public one says anyone can read it', /public: anyone can read/i.test(await p.textContent('#repo-hint')));
  await ctx.close();
}
{
  const pub = n => ({ ...repo(n), private: false });
  const gh = H.fakeGitHub({ repos: [pub('blog'), pub('site')] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(600);
  t.check('only public ones: none is chosen, and Save waits for a choice',
    (await p.$eval('#f-repo', s => s.value)) === '' && await p.isDisabled('#f-save'));
  await ctx.close();
}
{
  const gh = H.fakeGitHub({ repos: [{ ...repo('blog'), private: false }] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(600);
  t.check('a single public repository is not chosen without asking', await H.dialogOpen(p) &&
    (await p.$eval('#f-repo', s => s.value)) === '' && await p.isDisabled('#f-save'));
  await p.selectOption('#f-repo', { index: 1 });
  t.check('choosing it says it is public', /public: anyone can read/i.test(await p.textContent('#repo-hint')) &&
    await p.isEnabled('#f-save'), await p.textContent('#repo-hint'));
  await p.click('#f-save');
  await p.waitForTimeout(500);
  t.check('but Save uses it once they say so', !(await H.dialogOpen(p)) && (await p.textContent('#crumb')).includes('roldaof/blog'));
  await ctx.close();
}

/* ===== review: while the steps show, trouble is said there ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  // They install on an organisation whose list does not answer (SAML, suspended).
  gh.installations = [{ id: 31, account: { login: 'acme', type: 'Organization' }, repos: [repo('x')] }];
  await ctx.route('**/user/installations/31/repositories**', r => r.fulfill({ status: 403,
    contentType: 'application/json', body: JSON.stringify({ message: 'Resource protected by organization SAML enforcement.' }) }));
  await p.click('#fr-check');
  await p.waitForTimeout(600);
  t.check('an account that did not answer is named on the steps, not "nothing happened"',
    /could not be listed/i.test(await p.textContent('#fr-status')), await p.textContent('#fr-status'));
  await ctx.close();
}
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  let slow = false, go;
  await ctx.route('**/user/installations?**', async r => { if (slow) await new Promise(res => { go = res; }); r.fallback(); });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  slow = true;
  await p.click('#fr-check');
  await p.waitForTimeout(200);
  t.check('"Check now" shows it is checking, and cannot be pressed twice',
    /checking/i.test(await p.textContent('#fr-status')) && await p.isDisabled('#fr-check'));
  go(); slow = false;
  await p.waitForTimeout(500);
  t.check('and is ready again after', await p.isEnabled('#fr-check') && /still/i.test(await p.textContent('#fr-status')));
  await ctx.close();
}
{
  // A slow first list: nothing to fill in yet, so nothing is shown to fill in.
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh);
  let go;
  await ctx.route('**/user/installations?**', async r => { await new Promise(res => { go = res; }); r.fallback(); });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(300);
  const shown = await controls(p);
  t.check('while the first list loads, only "looking" and Sign out are shown',
    await p.isVisible('#repos-loading') && JSON.stringify(shown) === '["f-forget"]', JSON.stringify(shown));
  go();
  await p.waitForTimeout(500);
  t.check('then the steps', await p.isVisible('#firstrun') && await p.isHidden('#repos-loading'));
  await ctx.close();
}

/* ===== on a phone ===== */
{
  const gh = H.fakeGitHub({ repos: [] });
  const ctx = await H.context(gh, { viewport: { width: 390, height: 780 } });
  const p = await H.page(ctx);
  await H.signIn(p);
  await p.waitForTimeout(500);
  const fits = await p.evaluate(() => [...document.querySelectorAll('#firstrun a, #firstrun button')]
    .every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 36; }));
  t.check('on a phone the steps fit and are big enough to tap', fits &&
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await ctx.close();
}

await H.stop();
t.finish();
