/* Part of the autosave tests, split into its own file so suites run in parallel
   finish sooner (tests/run.mjs). */
/* Autosave: commits after a pause and when the page is hidden, never per keystroke.
   Pauses here stay fixed: they measure time against the app's 2 s timer, and
   typing makes no request that H.settle could wait for. */
import * as H from './harness.mjs';

const t = H.suite('autosave-races');
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
  await H.clickRow(p, 'todo.md');                  // todo has an untouched draft
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
