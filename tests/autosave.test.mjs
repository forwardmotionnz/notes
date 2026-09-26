/* Autosave: commits after a pause and when the page is hidden, never per keystroke.
   Pauses here stay fixed: they measure time against the app's 2 s timer, and
   typing makes no request that H.settle could wait for. */
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


await H.stop();
t.finish();
