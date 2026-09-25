/* Autosave: commits after a pause and when the page is hidden, never per keystroke. */
import * as H from './harness.mjs';

const t = H.suite('autosave');
await H.start();

const IDLE = 2000;          // the app's pause before an autosave
const FILES = () => ({
  'todo.md': '# Today\n\n- [ ] one\n',
  'inbox.md': '# Inbox\n\nloose thoughts\n',
});

async function ready() {
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  p.puts = 0;
  p.on('request', r => { if (r.method() === 'PUT' && r.url().startsWith('https://api.github.com/')) p.puts++; });
  await H.signIn(p);
  return { gh, ctx, p };
}

const type = (p, v) => H.setEditor(p, v);
const hide = p => p.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const drafts = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length);

/* ===== a pause commits, typing does not ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  t.check('opening a file commits nothing', (await p.waitForTimeout(IDLE + 500), p.puts === 0));

  for (let i = 1; i <= 6; i++) {                 // steady typing, 3 s in all
    await type(p, '# Inbox\n\n' + 'word '.repeat(i));
    await p.waitForTimeout(500);
  }
  t.check('no commit while typing steadily', p.puts === 0, String(p.puts));
  await p.waitForTimeout(IDLE + 600);
  t.check('one commit after a pause', p.puts === 1 && gh.commits.length === 1, String(p.puts));
  t.check('it holds the latest text', gh.files['inbox.md'] === '# Inbox\n\n' + 'word '.repeat(6));
  t.check('status says saved', /saved/i.test(await H.status(p)), await H.status(p));
  t.check('save disabled again', await p.isDisabled('#btn-save'));
  t.check('draft cleared by the autosave', (await drafts(p)) === 0);
  await p.waitForTimeout(IDLE + 300);
  t.check('nothing more once clean', p.puts === 1);
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== hiding the page commits at once ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nswitching apps');
  await p.waitForTimeout(100);
  await hide(p);
  await p.waitForTimeout(400);
  t.check('hidden page commits without waiting', gh.files['inbox.md'] === '# Inbox\n\nswitching apps' &&
    p.puts === 1, String(p.puts));
  await p.waitForTimeout(IDLE + 300);
  t.check('and the pending autosave does not commit again', p.puts === 1, String(p.puts));
  await ctx.close();
}

/* ===== Save still works, and the autosave does not repeat it ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nby hand');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(IDLE + 600);
  t.check('Save commits once, autosave adds nothing', p.puts === 1 && gh.files['inbox.md'] === '# Inbox\n\nby hand',
    String(p.puts));
  await ctx.close();
}

/* ===== a save in flight is never raced ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  // A slow phone network: every commit takes a second to answer.
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 1000));
    return r.fallback();
  });
  await type(p, '# Inbox\n\nfirst');
  await p.waitForTimeout(60);
  await p.click('#btn-save');
  await p.waitForTimeout(200);
  await type(p, '# Inbox\n\nfirst and second');
  await hide(p);                                   // tries to commit while the first is in flight
  await p.waitForTimeout(3000);
  const st = await H.status(p);
  t.check('no conflict from racing our own save', !/conflict/i.test(st), st);
  t.check('both edits land, in order', gh.files['inbox.md'] === '# Inbox\n\nfirst and second' &&
    gh.commits.length === 2, JSON.stringify(gh.files['inbox.md']) + ' ' + gh.commits.length);
  await ctx.close();
}

/* ===== a conflict stops autosave for that file ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\ntheirs\n';
  await type(p, '# Inbox\n\nmine');
  await p.waitForTimeout(IDLE + 600);
  t.check('autosave hits the conflict', /conflict/i.test(await H.status(p)) && p.puts === 1, String(p.puts));
  t.check('their text is not overwritten', gh.files['inbox.md'] === '# Inbox\n\ntheirs\n');
  t.check('draft kept', (await drafts(p)) === 1);
  t.check('Discard offered', await p.isVisible('#btn-discard'));
  await type(p, '# Inbox\n\nmine, more');
  await p.waitForTimeout(IDLE + 600);
  await hide(p);
  await p.waitForTimeout(300);
  t.check('no further automatic attempts on that file', p.puts === 1, String(p.puts));
  t.check('the user is still told', /conflict/i.test(await p.textContent('#crumb')) ||
    /conflict/i.test(await H.status(p)), (await p.textContent('#crumb')) + ' / ' + (await H.status(p)));
  await p.click('#btn-save');                      // the button still tries, and still refuses to clobber
  await p.waitForTimeout(400);
  t.check('Save button still tries', p.puts === 2 && gh.files['inbox.md'] === '# Inbox\n\ntheirs\n');

  await p.click('#btn-discard');
  await p.waitForTimeout(400);
  await type(p, '# Inbox\n\ntheirs\nand mine\n');
  await p.waitForTimeout(IDLE + 600);
  t.check('after Discard, autosave resumes', gh.files['inbox.md'] === '# Inbox\n\ntheirs\nand mine\n',
    JSON.stringify(gh.files['inbox.md']));
  await ctx.close();
}

/* ===== a restored draft waits for the user ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nleft behind');
  await p.close();
  const q = await H.page(ctx);
  q.puts = 0;
  q.on('request', r => { if (r.method() === 'PUT') q.puts++; });
  await q.waitForTimeout(IDLE + 1200);
  t.check('restoring a draft commits nothing by itself', q.puts === 0 &&
    (await H.editorValue(q)) === '# Inbox\n\nleft behind');
  await type(q, '# Inbox\n\nleft behind, now kept');
  await q.waitForTimeout(IDLE + 600);
  t.check('typing into it resumes autosave', gh.files['inbox.md'] === '# Inbox\n\nleft behind, now kept');
  await ctx.close();
}

/* ===== a new note is not created until something is typed ===== */
{
  const { gh, ctx, p } = await ready();
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('later') : d.accept());
  await p.click('#btn-new');
  await p.waitForTimeout(IDLE + 600);
  t.check('New alone commits nothing', p.puts === 0 && !('later.md' in gh.files));
  await type(p, '# later\n\nnow with words\n');
  await p.waitForTimeout(IDLE + 600);
  t.check('typing creates it', gh.files['later.md'] === '# later\n\nnow with words\n' &&
    gh.commits.at(-1).message === 'Create later.md');
  await ctx.close();
}

/* A network that answers GitHub file reads slowly, for one path. */
async function slowGet(p, name, ms) {
  await p.route('https://api.github.com/**/contents/' + name + '*', async r => {
    if (r.request().method() === 'GET') await new Promise(res => setTimeout(res, ms));
    return r.fallback();
  });
}

/* ===== review: text discarded by switching files is never autosaved ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await slowGet(p, 'todo.md', IDLE + 800);
  await type(p, 'DISCARD ME');
  await p.waitForTimeout(100);
  await H.clickRow(p, 'todo.md');                  // confirm accepted
  await p.waitForTimeout(IDLE + 1200);
  t.check('discarded text not committed while the next file loads', p.puts === 0 &&
    gh.files['inbox.md'] === FILES()['inbox.md'], String(p.puts));
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await slowGet(p, 'todo.md', 1500);
  await type(p, 'DISCARD ME');
  await p.waitForTimeout(100);
  await H.clickRow(p, 'todo.md');
  await hide(p);                                   // switched apps while it loads
  await p.waitForTimeout(2000);
  t.check('nor when the page is hidden meanwhile', p.puts === 0 &&
    gh.files['inbox.md'] === FILES()['inbox.md'], String(p.puts));
  await ctx.close();
}

/* ===== review: Discard never commits what it throws away ===== */
{
  const { gh, ctx, p } = await ready();
  await p.evaluate(sha => localStorage.setItem('notes.draft.v1:roldaof/obsidian-vault@main:inbox.md',
    JSON.stringify({ text: 'junk', sha, at: 0 })), gh.sha('inbox.md'));
  await H.clickRow(p, 'inbox.md');                 // restored, Discard offered
  await slowGet(p, 'inbox.md', IDLE + 800);
  await type(p, 'junk!');                          // touched, timer running
  await p.waitForTimeout(100);
  const shown = await p.isVisible('#btn-discard');
  await p.click('#btn-discard');
  await p.waitForTimeout(IDLE + 1200);
  t.check('Discard during a pending autosave commits nothing',
    gh.files['inbox.md'] === FILES()['inbox.md'] && gh.commits.length === 0, JSON.stringify(gh.files['inbox.md']));
  t.check('and loads the version on GitHub', (await H.editorValue(p)) === FILES()['inbox.md'], String(shown));
  await ctx.close();
}

/* ===== review: a queued save never lands on another file ===== */
{
  const { gh, ctx, p } = await ready();
  await p.evaluate(sha => localStorage.setItem('notes.draft.v1:roldaof/obsidian-vault@main:todo.md',
    JSON.stringify({ text: 'private half-thought', sha, at: 0 })), gh.sha('todo.md'));
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 1200));
    return r.fallback();
  });
  await type(p, '# Inbox\n\none');
  await p.click('#btn-save');
  await p.waitForTimeout(100);
  await type(p, '# Inbox\n\none two');
  await p.keyboard.press('Control+s');             // queued behind the first
  await H.clickRow(p, 'todo.md');                  // confirm accepted; todo has an untouched draft
  await p.waitForTimeout(2500);
  t.check("a queued save does not commit the next file's untouched draft",
    !gh.commits.some(c => c.path === 'todo.md') && gh.files['todo.md'] === FILES()['todo.md'],
    JSON.stringify(gh.commits.map(c => c.path)));
  await ctx.close();
}

/* ===== review: leaving while a save is in flight asks nothing and loses nothing ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let asked = 0;
  p.removeAllListeners('dialog');
  p.on('dialog', d => { if (d.type() === 'confirm') asked++; d.accept(); });
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    await new Promise(res => setTimeout(res, 1500));
    return r.abort();                              // the connection drops
  });
  await type(p, '# Inbox\n\nin flight');
  await p.waitForTimeout(IDLE + 200);              // autosave has started
  await H.clickRow(p, 'todo.md');
  await p.waitForTimeout(2000);
  t.check('no discard question for text already being saved', asked === 0, String(asked));
  await p.unrouteAll({ behavior: 'ignoreErrors' });
  await H.clickRow(p, 'inbox.md');
  t.check('a failed save leaves the draft to restore', (await H.editorValue(p)) === '# Inbox\n\nin flight');
  await ctx.close();
}

/* ===== review: a commit whose reply was lost is not a conflict ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (!lose || r.request().method() !== 'PUT') return r.fallback();
    lose = false;
    // GitHub makes the commit; the reply never reaches the phone.
    const b = JSON.parse(r.request().postData());
    gh.files['inbox.md'] = Buffer.from(b.content, 'base64').toString('utf-8');
    gh.commits.push({ path: 'inbox.md', message: b.message, branch: b.branch });
    return r.abort();
  });
  await type(p, '# Inbox\n\nfirst');
  await p.waitForTimeout(IDLE + 500);
  await type(p, '# Inbox\n\nfirst second');
  await p.waitForTimeout(IDLE + 800);
  const st = await H.status(p);
  t.check('lost reply: next save is not a false conflict', !/conflict/i.test(st), st);
  t.check('lost reply: latest text committed', gh.files['inbox.md'] === '# Inbox\n\nfirst second');
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/**', r => {
    if (!lose || r.request().method() !== 'PUT') return r.fallback();
    lose = false;
    return r.abort();                              // nothing landed
  });
  await type(p, '# Inbox\n\nmine');
  await p.waitForTimeout(IDLE + 500);
  gh.files['inbox.md'] = '# Inbox\n\ntheirs\n';    // and someone else edits meanwhile
  await type(p, '# Inbox\n\nmine too');
  await p.waitForTimeout(IDLE + 800);
  t.check('after a failed save, a real conflict is still a conflict',
    /conflict/i.test(await H.status(p)) && gh.files['inbox.md'] === '# Inbox\n\ntheirs\n');
  await ctx.close();
}

await H.stop();
t.finish();
