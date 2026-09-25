/* Local drafts: nothing typed is lost to a reload, a closed tab or a killed page. */
import * as H from './harness.mjs';

const t = H.suite('drafts');
await H.start();

const FILES = () => ({
  'todo.md': '# Today\n\n- [ ] one\n',
  'inbox.md': '# Inbox\n\nloose thoughts\n',
  'plan.md': '# Plan\n',
});

const drafts = p => p.evaluate(() => {
  const pick = s => Object.keys(s).filter(k => k.startsWith('notes.draft.'));
  return { local: pick(localStorage), session: pick(sessionStorage) };
});
const tag = p => p.evaluate(() => document.querySelector('#crumb .tag')?.textContent || '');
const discardShown = p => p.evaluate(() => {
  const b = document.getElementById('btn-discard');
  return !!b && !b.hidden && getComputedStyle(b).display !== 'none';
});

async function ready(opts = {}) {
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, opts);
  return { gh, ctx, p };
}

/* A reload hides the page, which autosaves. These tests are about the case
   drafts exist for, where that last commit never gets out before the page
   dies, so commits are refused while it reloads. */
async function reloadUnsaved(p) {
  const before = p.errors.length;
  // Installed once and switched by a flag: removing a route while the new
  // page's requests are in flight lets them escape to the real network.
  if (!p.holdPuts) {
    p.holdPuts = { on: false };
    await p.route('https://api.github.com/**', r =>
      p.holdPuts.on && r.request().method() === 'PUT' ? r.abort() : r.fallback());
  }
  p.holdPuts.on = true;
  await p.reload({ waitUntil: 'load' });
  p.holdPuts.on = false;
  // The refused commit is reported by the page on its way out; expected here.
  p.errors.splice(before, p.errors.length - before,
    ...p.errors.slice(before).filter(e => !/Failed to fetch/.test(e)));
}

async function type(p, text) {
  await H.setEditor(p, text);
  await p.waitForTimeout(60);
}

/* ===== written as you type, restored after a reload, cleared by a commit ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nhalf a thought');
  // No unload event: a phone may kill a backgrounded page without one.
  t.check('draft stored before any unload event', (await drafts(p)).local.length === 1,
    JSON.stringify(await drafts(p)));

  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('reload restores the draft', (await H.editorValue(p)) === '# Inbox\n\nhalf a thought');
  t.check('restored draft is flagged in the header', /draft/i.test(await tag(p)), await tag(p));
  t.check('restored draft is flagged in the status line', /restored/i.test(await H.status(p)), await H.status(p));
  t.check('restored draft can be saved', await p.isEnabled('#btn-save'));
  t.check('a restored draft offers Discard', await discardShown(p));
  t.check('restoring does not commit', gh.commits.length === 0);

  await p.click('#btn-save');
  await p.waitForTimeout(350);
  t.check('restored draft commits', gh.files['inbox.md'] === '# Inbox\n\nhalf a thought');
  t.check('commit clears the draft', (await drafts(p)).local.length === 0, JSON.stringify(await drafts(p)));
  t.check('commit clears the draft flag', !/draft/i.test(await tag(p)) && !(await discardShown(p)));

  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('nothing restored once committed', (await H.editorValue(p)) === gh.files['inbox.md'] &&
    await p.isDisabled('#btn-save'));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== typing back to the saved text drops the draft ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'changed');
  await type(p, gh.files['inbox.md']);
  t.check('undoing every change drops the draft', (await drafts(p)).local.length === 0);
  await ctx.close();
}

/* ===== closed tab ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'plan.md');
  await type(p, '# Plan\n\nstep one\n');
  await p.close();                                  // no beforeunload, no prompt
  const q = await H.page(ctx);
  await q.waitForTimeout(700);
  t.check('closed tab: draft restored in a new tab', (await H.editorValue(q)) === '# Plan\n\nstep one\n');
  await ctx.close();
}

/* ===== a restored draft nobody touched survives visiting another file ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'plan.md');
  await type(p, '# Plan\n\nstep two\n');
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  await H.clickRow(p, 'inbox.md');                 // leaves it untouched: not committed
  t.check('an untouched restored draft is not committed on leaving', gh.commits.length === 0);
  await H.clickRow(p, 'plan.md');
  t.check('and comes back on return', (await H.editorValue(p)) === '# Plan\n\nstep two\n' &&
    (await drafts(p)).local.length === 1);
  await ctx.close();
}

/* ===== a new file that was never committed ===== */
{
  const { gh, ctx, p } = await ready();
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('ideas/first') : d.accept());
  await p.click('#btn-new');
  await p.waitForTimeout(150);
  await type(p, '# First\n\nnot saved yet\n');
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('new file draft restored after reload', (await H.editorValue(p)) === '# First\n\nnot saved yet\n');
  t.check('still marked new', /new/i.test(await tag(p)), await tag(p));
  await p.click('#btn-save');
  await p.waitForTimeout(450);
  t.check('new file draft commits as a create', gh.files['ideas/first.md'] === '# First\n\nnot saved yet\n' &&
    gh.commits.at(-1).message === 'Create ideas/first.md');
  t.check('and the draft is gone', (await drafts(p)).local.length === 0);
  await ctx.close();
}

/* ===== the file changed on GitHub since the draft was made ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nmine\n');
  gh.files['inbox.md'] = '# Inbox\n\ntheirs\n';
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('stale draft still restored', (await H.editorValue(p)) === '# Inbox\n\nmine\n');
  t.check('user told the file changed on GitHub', /changed on github/i.test(await H.status(p)),
    await H.status(p));
  await p.click('#btn-save');
  await p.waitForTimeout(350);
  t.check('saving a stale draft is a conflict', /conflict/i.test(await H.status(p)), await H.status(p));
  t.check('their change is not overwritten', gh.files['inbox.md'] === '# Inbox\n\ntheirs\n');
  t.check('draft kept after the conflict', (await drafts(p)).local.length === 1);

  await p.click('#btn-discard');
  await p.waitForTimeout(400);
  t.check('Discard loads the version on GitHub', (await H.editorValue(p)) === '# Inbox\n\ntheirs\n');
  t.check('Discard removes the draft', (await drafts(p)).local.length === 0);
  t.check('Discard makes no commit', gh.commits.length === 0);
  await ctx.close();
}

/* ===== a draft that matches GitHub is dropped quietly ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, '# Inbox\n\nsame\n');
  gh.files['inbox.md'] = '# Inbox\n\nsame\n';       // committed from elsewhere
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('matching draft not flagged', !/draft/i.test(await tag(p)) && await p.isDisabled('#btn-save'));
  t.check('matching draft removed', (await drafts(p)).local.length === 0);
  await ctx.close();
}

/* ===== session-only mode ===== */
{
  const { ctx, p } = await ready({ remember: false });
  await H.clickRow(p, 'inbox.md');
  await type(p, 'on a shared computer');
  const d = await drafts(p);
  t.check('session-only drafts live in session storage', d.session.length === 1 && d.local.length === 0,
    JSON.stringify(d));
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  t.check('session-only draft restored after reload', (await H.editorValue(p)) === 'on a shared computer');
  await ctx.close();
}

/* ===== switching to session-only moves drafts off disk ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'moving');
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.check('#f-session');
  await p.click('#f-save');
  await p.waitForTimeout(300);
  const d = await drafts(p);
  t.check('choosing session-only moves drafts to session storage', d.local.length === 0 && d.session.length === 1,
    JSON.stringify(d));
  await ctx.close();
}

/* ===== sign out removes every draft ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'draft one');
  // A second file's draft, left from an earlier visit.
  await p.evaluate(() => localStorage.setItem('notes.draft.v1:roldaof/obsidian-vault@main:plan.md',
    JSON.stringify({ text: 'draft two', sha: null, at: 0 })));
  const before = (await drafts(p)).local.length;
  await p.click('#btn-settings');
  await p.waitForTimeout(300);
  await p.click('#f-forget');
  await p.waitForTimeout(700);
  const d = await drafts(p);
  t.check('sign out removes all drafts', before === 2 && d.local.length === 0 && d.session.length === 0,
    before + ' ' + JSON.stringify(d));
  await ctx.close();
}

/* ===== a tab signed out from another tab writes no drafts back ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const other = await H.page(ctx);
  await other.waitForTimeout(500);
  await other.click('#btn-settings');
  await other.waitForTimeout(300);
  await other.click('#f-forget');
  await other.waitForTimeout(700);
  await type(p, 'typed after sign-out elsewhere');
  const d = await drafts(p);
  t.check('signed-out tab leaves no draft behind', d.local.length === 0 && d.session.length === 0,
    JSON.stringify(d));
  await ctx.close();
}

/* ===== review: text left behind never lingers as a stale draft ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'typed then left');
  await H.clickRow(p, 'plan.md');                  // commits it on the way out
  await H.clickRow(p, 'inbox.md');
  t.check('text committed on leaving does not come back as a draft',
    gh.files['inbox.md'] === 'typed then left' && (await H.editorValue(p)) === 'typed then left' &&
    await p.isDisabled('#btn-save'));
  t.check('and leaves nothing in storage', (await drafts(p)).local.length === 0);
  await ctx.close();
}

/* ===== review: New on a path whose draft was never committed ===== */
{
  const { ctx, p } = await ready();
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('idea') : d.type() === 'beforeunload' ? d.accept() : d.dismiss());
  await p.click('#btn-new');
  await p.waitForTimeout(150);
  await type(p, '# idea\n\nlong important text\n');
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  await H.clickRow(p, 'inbox.md');                 // dismissed: the draft stays where it is
  await p.click('#btn-new');
  await p.waitForTimeout(400);
  t.check('New on a drafted path reopens the draft instead of overwriting it',
    (await H.editorValue(p)) === '# idea\n\nlong important text\n', JSON.stringify(await H.editorValue(p)));
  await ctx.close();
}

/* ===== review: sign-out says which unsaved changes it will delete ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'unsaved');
  let message = '';
  p.removeAllListeners('dialog');
  p.on('dialog', d => { if (/sign out/i.test(d.message())) { message = d.message(); d.dismiss(); } else d.accept(); });
  await p.click('#btn-settings');
  await p.waitForTimeout(300);
  await p.click('#f-forget');
  await p.waitForTimeout(300);
  t.check('sign-out confirm names the unsaved file', /unsaved/i.test(message) && message.includes('inbox.md'), message);
  t.check('cancelling sign-out keeps the draft', (await drafts(p)).local.length === 1);
  await ctx.close();
}

/* ===== review: saving in one tab keeps another tab's newer draft ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const b = await H.page(ctx);
  await b.waitForTimeout(700);                     // reopens inbox.md
  await type(p, 'from tab A');
  await type(b, 'from tab B');
  await p.click('#btn-save');
  await p.waitForTimeout(350);
  const left = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('notes.draft.'))
    .map(k => JSON.parse(localStorage.getItem(k)).text));
  t.check("saving in tab A keeps tab B's draft", JSON.stringify(left) === '["from tab B"]', JSON.stringify(left));
  await ctx.close();
}

/* ===== review: signing back in as session-only brings drafts along ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'before the token died');
  await p.evaluate(() => localStorage.removeItem('notes.config.v2'));   // as signOutLocally does
  await reloadUnsaved(p);
  await p.waitForTimeout(300);
  await H.signIn(p, { remember: false });
  await p.waitForTimeout(500);
  const d = await drafts(p);
  t.check('session-only sign-in moves drafts off disk', d.local.length === 0 && d.session.length === 1,
    JSON.stringify(d));
  await H.clickRow(p, 'inbox.md');
  t.check('and the draft is restored', (await H.editorValue(p)) === 'before the token died');
  await ctx.close();
}

/* ===== review: Discard on a failed fetch keeps the draft ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await type(p, 'keep me');
  await reloadUnsaved(p);
  await p.waitForTimeout(700);
  await p.route('https://api.github.com/**/contents/**', r => r.abort());
  await p.click('#btn-discard');
  await p.waitForTimeout(400);
  t.check('failed Discard keeps the draft', (await drafts(p)).local.length === 1);
  await type(p, 'keep me, edited');
  t.check('and the editor still tracks it', await p.isEnabled('#btn-save') &&
    await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage)
      .find(k => k.startsWith('notes.draft.')))).text) === 'keep me, edited');
  await ctx.close();
}

await H.stop();
t.finish();
