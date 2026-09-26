/* Part of the autosave tests, split into its own file so suites run in parallel
   finish sooner (tests/run.mjs). */
/* Autosave: commits after a pause and when the page is hidden, never per keystroke.
   Pauses here stay fixed: they measure time against the app's 2 s timer, and
   typing makes no request that H.settle could wait for. */
import * as H from './harness.mjs';

const t = H.suite('autosave-restore');
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


/* A network that answers GitHub file reads slowly, for one path. */
async function slowGet(p, name, ms) {
  await p.route('https://api.github.com/**/contents/' + name + '*', async r => {
    if (r.request().method() === 'GET') await new Promise(res => setTimeout(res, ms));
    return r.fallback();
  });
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
  // Switching apps is the other way an automatic save starts.
  await hide(q);
  await q.waitForTimeout(600);
  t.check('nor when the page is hidden, untouched', q.puts === 0, String(q.puts));
  await q.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
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
  await hide(p);
  await p.waitForTimeout(600);
  t.check('not even when the page is hidden', p.puts === 0 && !('later.md' in gh.files), String(p.puts));
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await type(p, '# later\n\nnow with words\n');
  await p.waitForTimeout(IDLE + 600);
  t.check('typing creates it', gh.files['later.md'] === '# later\n\nnow with words\n' &&
    gh.commits.at(-1).message === 'Create later.md');
  await ctx.close();
}


/* ===== review: a file being left is committed once, and nothing else is ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await slowGet(p, 'todo.md', IDLE + 800);
  await type(p, 'left behind');
  await p.waitForTimeout(100);
  await H.clickRow(p, 'todo.md');                  // commits inbox on the way out
  await type(p, 'typed while todo loads');         // lands on the file being left
  await p.waitForTimeout(IDLE + 1200);
  t.check('while the next file loads, the one left is committed exactly once',
    p.puts === 1 && gh.files['inbox.md'] === 'left behind' && gh.files['todo.md'] === FILES()['todo.md'],
    p.puts + ' ' + JSON.stringify(gh.files['inbox.md']));
  await H.clickRow(p, 'inbox.md');
  t.check('and what was typed during the load comes back as a draft',
    (await H.editorValue(p)) === 'typed while todo loads', JSON.stringify(await H.editorValue(p)));
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await slowGet(p, 'todo.md', 1500);
  await type(p, 'left behind');
  await p.waitForTimeout(100);
  await H.clickRow(p, 'todo.md');
  await type(p, 'typed while todo loads');
  await hide(p);                                   // switched apps while it loads
  await p.waitForTimeout(2000);
  t.check('and hiding the page meanwhile adds nothing', p.puts === 1 &&
    gh.files['inbox.md'] === 'left behind' && gh.files['todo.md'] === FILES()['todo.md'], String(p.puts));
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


await H.stop();
t.finish();
