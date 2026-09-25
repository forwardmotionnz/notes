/* Switching files is safe without asking: what was typed is committed, or kept as a draft. */
import * as H from './harness.mjs';

const t = H.suite('switching');
await H.start();

const FILES = () => ({
  'todo.md': '# Today\n\n- [ ] one\n',
  'inbox.md': '# Inbox\n\nloose thoughts\n',
  'plan.md': '# Plan\n',
});

async function ready(ghOpts = {}) {
  const gh = H.fakeGitHub({ files: FILES(), ...ghOpts });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  p.asked = [];
  p.removeAllListeners('dialog');
  // Record every blocking question except the ones a test answers on purpose.
  p.on('dialog', d => {
    if (d.type() === 'confirm') p.asked.push(d.message());
    if (d.type() === 'prompt') return d.accept(p.answer || '');
    return d.accept();
  });
  await H.signIn(p);
  return { gh, ctx, p };
}

const type = async (p, v) => { await H.setEditor(p, v); await p.waitForTimeout(60); };
const drafts = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')));
const tag = p => p.evaluate(() => document.querySelector('#crumb .tag')?.textContent || '');

/* ===== unsaved text is committed on the way out, without a question ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\ntyped then left');
  await H.clickRow(p, 'plan.md');
  await p.waitForTimeout(400);
  t.check('switching files asks nothing', p.asked.length === 0, JSON.stringify(p.asked));
  t.check('the file left behind is committed', gh.files['inbox.md'] === '# Inbox\n\ntyped then left');
  t.check('the new file is open', (await H.editorValue(p)) === '# Plan\n');
  t.check('no draft left once committed', (await drafts(p)).length === 0, JSON.stringify(await drafts(p)));
  await H.clickRow(p, 'inbox.md');
  t.check('going back shows the committed text', (await H.editorValue(p)) === '# Inbox\n\ntyped then left' &&
    await p.isDisabled('#btn-save'));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== offline: the draft is kept and comes back ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', r =>
    r.request().method() === 'PUT' ? r.abort() : r.fallback());
  await type(p, '# Inbox\n\nwritten on a train');
  await H.clickRow(p, 'plan.md');
  await p.waitForTimeout(400);
  t.check('offline switch asks nothing', p.asked.length === 0);
  t.check('offline switch keeps a draft', (await drafts(p)).length === 1);
  await H.clickRow(p, 'inbox.md');
  t.check('and it is restored on return', (await H.editorValue(p)) === '# Inbox\n\nwritten on a train' &&
    /draft/i.test(await tag(p)));
  t.check('nothing committed', gh.commits.length === 0);
  await ctx.close();
}

/* ===== a conflicted file is never forced, and its draft survives ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\ntheirs\n';
  await type(p, '# Inbox\n\nmine');
  await p.click('#btn-save');
  await p.waitForTimeout(350);
  await H.clickRow(p, 'plan.md');
  await p.waitForTimeout(300);
  t.check('conflicted file: switching asks nothing', p.asked.length === 0);
  t.check('their text still stands', gh.files['inbox.md'] === '# Inbox\n\ntheirs\n');
  await H.clickRow(p, 'inbox.md');
  t.check('my conflicted text comes back as a draft', (await H.editorValue(p)) === '# Inbox\n\nmine' &&
    /changed on github/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== typing more while a save is in flight ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 800));
    return r.fallback();
  });
  await type(p, '# Inbox\n\none');
  await p.click('#btn-save');
  await p.waitForTimeout(100);
  await type(p, '# Inbox\n\none two');           // not yet on its way
  await H.clickRow(p, 'plan.md');
  await p.waitForTimeout(2500);
  t.check('in-flight switch asks nothing', p.asked.length === 0);
  const committed = gh.files['inbox.md'];
  const left = (await drafts(p)).length;
  t.check('the later text is committed or kept as a draft',
    committed === '# Inbox\n\none two' || (committed === '# Inbox\n\none' && left === 1),
    JSON.stringify(committed) + ' drafts=' + left);
  await p.unrouteAll({ behavior: 'ignoreErrors' });
  await H.clickRow(p, 'inbox.md');
  t.check('reopening shows the later text', (await H.editorValue(p)) === '# Inbox\n\none two');
  t.check('without a false warning about GitHub', !/changed on github/i.test(await H.status(p)),
    await H.status(p));
  await p.click('#btn-save');
  await p.waitForTimeout(400);
  t.check('and it saves cleanly on top of the earlier commit',
    gh.files['inbox.md'] === '# Inbox\n\none two' && !/conflict/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== reopening a file while its commit is on the way ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 900));
    return r.fallback();
  });
  await type(p, '# Inbox\n\none');
  await p.click('#btn-save');
  await p.waitForTimeout(100);
  await H.clickRow(p, 'plan.md');
  await H.clickRow(p, 'inbox.md');                 // back before the commit lands
  await p.waitForTimeout(1500);
  await type(p, '# Inbox\n\none more');
  await p.click('#btn-save');
  await p.waitForTimeout(1500);
  t.check('reopened during a commit, the next save is not a false conflict',
    gh.files['inbox.md'] === '# Inbox\n\none more' && !/conflict/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== the next file fails to open ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/plan.md*', r => r.abort());
  await H.clickRow(p, 'plan.md');
  await p.waitForTimeout(300);
  t.check('a failed open leaves the old file on screen', (await H.editorValue(p)) === FILES()['inbox.md']);
  await type(p, '# Inbox\n\nstill here');
  await p.waitForTimeout(2600);
  t.check('and it still saves itself', gh.files['inbox.md'] === '# Inbox\n\nstill here');
  await ctx.close();
}

/* ===== New and back ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nbefore new');
  p.answer = 'fresh';
  await p.click('#btn-new');
  await p.waitForTimeout(400);
  t.check('New asks nothing about the file left', p.asked.length === 0);
  t.check('New commits the file left', gh.files['inbox.md'] === '# Inbox\n\nbefore new');
  await H.clickRow(p, 'plan.md');                   // leave the template untouched
  await p.waitForTimeout(300);
  t.check('an untouched New template leaves no draft', (await drafts(p)).length === 0,
    JSON.stringify(await drafts(p)));
  t.check('and no file', !('fresh.md' in gh.files));
  await ctx.close();
}

/* ===== changing repository commits the open file to the repository it came from ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'alpha', full_name: 'roldaof/alpha', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'beta', full_name: 'roldaof/beta', default_branch: 'main', private: true },
  ];
  const { gh, ctx, p } = await ready({ repos });
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/alpha' });
  await p.click('#f-save');
  await p.waitForTimeout(500);
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nfor alpha');
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/beta' });
  await p.click('#f-save');
  await p.waitForTimeout(500);
  t.check('changing repository asks nothing', p.asked.length === 0, JSON.stringify(p.asked));
  const c = gh.commits.at(-1);
  t.check('the open file is committed first', gh.files['inbox.md'] === '# Inbox\n\nfor alpha' && !!c);
  t.check('to the repository it came from', !!c && c.repo === 'roldaof/alpha', JSON.stringify(c));
  await ctx.close();
}

/* ===== review: another tab's draft is never moved past a commit it did not see ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const b = await H.page(ctx);
  await b.waitForTimeout(700);                     // tab B has inbox.md open too
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 900));
    return r.fallback();
  });
  await type(p, '# Inbox\n\nTAB ONE WORK');
  await H.clickRow(p, 'plan.md');                  // commit on its way
  await type(b, '# Inbox\n\ntab two');             // B's draft, on the old sha
  await p.waitForTimeout(1500);
  await H.clickRow(p, 'inbox.md');
  t.check("tab B's draft is restored with the warning", (await H.editorValue(p)) === '# Inbox\n\ntab two' &&
    /changed on github/i.test(await H.status(p)), await H.status(p));
  await p.click('#btn-save');
  await p.waitForTimeout(1500);
  t.check("and cannot overwrite tab A's commit", gh.files['inbox.md'] === '# Inbox\n\nTAB ONE WORK' &&
    /conflict/i.test(await H.status(p)), JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== review: coming back during the commit shows what GitHub holds ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 900));
    return r.fallback();
  });
  await type(p, '# Inbox\n\nOOPS pasted my password');
  await H.clickRow(p, 'plan.md');
  await H.clickRow(p, 'inbox.md');                 // before the commit lands
  await p.waitForTimeout(1500);
  t.check('reopening waits for the commit and shows it', (await H.editorValue(p)) === gh.files['inbox.md'] &&
    gh.files['inbox.md'] === '# Inbox\n\nOOPS pasted my password');
  t.check('not as an unsaved draft', !(await p.isVisible('#btn-discard')) && await p.isDisabled('#btn-save') &&
    (await drafts(p)).length === 0, JSON.stringify(await drafts(p)));
  await ctx.close();
}

/* ===== review: a lost reply is never recovered into another repository ===== */
{
  const repos = [
    { owner: { login: 'roldaof' }, name: 'alpha', full_name: 'roldaof/alpha', default_branch: 'main', private: true },
    { owner: { login: 'roldaof' }, name: 'beta', full_name: 'roldaof/beta', default_branch: 'main', private: true },
  ];
  const { gh, ctx, p } = await ready({ repos });
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/alpha' });
  await p.click('#f-save');
  await p.waitForTimeout(500);
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/**', r => {
    if (!lose || r.request().method() !== 'PUT') return r.fallback();
    lose = false;                                  // the commit lands, the reply is lost
    const body = JSON.parse(r.request().postData());
    gh.files['inbox.md'] = Buffer.from(body.content, 'base64').toString('utf-8');
    gh.commits.push({ repo: 'roldaof/alpha', path: 'inbox.md' });
    return r.abort();
  });
  await type(p, '# Inbox\n\nalpha one');
  await p.click('#btn-save');
  await p.waitForTimeout(400);
  await type(p, '# Inbox\n\nalpha two');
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.selectOption('#f-repo', { label: 'roldaof/beta' });
  await p.click('#f-save');
  await p.waitForTimeout(800);
  t.check('nothing from alpha is written into beta', !gh.commits.some(c => c.repo === 'roldaof/beta'),
    JSON.stringify(gh.commits.map(c => c.repo)));
  await ctx.close();
}

await H.stop();
t.finish();
