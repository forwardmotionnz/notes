/* Delete: one commit, a clear warning, and nothing deleted by mistake. */
import * as H from './harness.mjs';

const t = H.suite('delete');
await H.start();

const FILES = () => ({ 'todo.md': '- [ ] one\n', 'inbox.md': '# Inbox\n\nold thoughts\n', 'plan.md': '# Plan\n' });

async function ready(opts = {}) {
  const gh = H.fakeGitHub({ files: FILES(), ...opts });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  return { gh, ctx, p };
}
// Answer the confirmation; record what it said.
const answer = (p, yes) => {
  p.asked = [];
  p.removeAllListeners('dialog');
  p.on('dialog', d => { if (d.type() === 'confirm') { p.asked.push(d.message()); return yes ? d.accept() : d.dismiss(); } d.accept(); });
};

/* ===== deleting a note ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  t.check('a Delete button is offered for the open note', await p.isVisible('#btn-delete'));
  answer(p, false);
  await p.click('#btn-delete');
  await H.settle(p, 300);
  t.check('it asks first', p.asked.length === 1);
  t.check('and says it can be recovered from the history', /history/i.test(p.asked[0] || '') && /recover/i.test(p.asked[0] || ''),
    p.asked[0]);
  t.check('saying no deletes nothing', 'inbox.md' in gh.files && gh.commits.length === 0);

  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('saying yes deletes it, in one commit', !('inbox.md' in gh.files) && gh.commits.length === 1 && gh.commits[0].deleted);
  t.check('the commit says what it did', /inbox\.md/.test(gh.commits[0].message) && /delete/i.test(gh.commits[0].message),
    gh.commits[0].message);
  t.check('the other files are untouched', gh.files['plan.md'] === '# Plan\n' && gh.files['todo.md'] === '- [ ] one\n');
  t.check('the note is closed and gone from the list', (await H.editorValue(p)) === '' && !(await H.rows(p)).includes('inbox.md'),
    JSON.stringify(await H.rows(p)));
  t.check('and the person is told', /deleted/i.test(await H.status(p)), await H.status(p));
  await p.waitForTimeout(2600);
  t.check('nothing brings it back', !('inbox.md' in gh.files));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== unsaved changes are named in the warning, and go with it ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, '# Inbox\n\nunsaved\n');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('the warning mentions the unsaved changes', /unsaved/i.test(p.asked[0] || ''), p.asked[0]);
  t.check('it is deleted, not saved first', !('inbox.md' in gh.files) && gh.commits.length === 1);
  t.check('and no draft is left to bring it back', await p.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('notes.draft.')).length) === 0);
  await ctx.close();
}

/* ===== on a slow network, a pending autosave does not race the delete ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'DELETE') await new Promise(res => setTimeout(res, 3000));
    return r.fallback();
  });
  await H.setEditor(p, '# Inbox\n\nunsaved\n');   // an autosave is now 2 s away
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 300);
  await p.evaluate(() => {                         // and they switch apps meanwhile
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForTimeout(3500);
  t.check('neither the autosave that was due nor switching apps saves it first', !gh.commits.some(c => !c.deleted) && !('inbox.md' in gh.files),
    JSON.stringify(gh.commits.map(c => c.message)));
  await ctx.close();
}

/* ===== changed elsewhere since it was opened ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\nnew words from another device\n';
  gh.touch();
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('a file changed elsewhere is not deleted', gh.files['inbox.md'] === '# Inbox\n\nnew words from another device\n');
  t.check('and the person is told why', /changed/i.test(await H.status(p)) && /not deleted/i.test(await H.status(p)),
    await H.status(p));
  await ctx.close();
}

/* ===== a failure deletes nothing and says so ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', r => r.request().method() === 'DELETE' ? r.abort() : r.fallback());
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('a failed delete leaves the file and the note open', 'inbox.md' in gh.files &&
    (await p.textContent('#crumb .name')) === 'inbox.md' && /not deleted/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== a lost reply is recognised ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/contents/inbox.md', r => {
    if (!lose || r.request().method() !== 'DELETE') return r.fallback();
    lose = false;
    delete gh.files['inbox.md']; gh.touch();      // it went through...
    return r.abort();                             // ...and the reply was lost
  });
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 700);
  t.check('a delete whose reply was lost is reported as done', /deleted/i.test(await H.status(p)) &&
    !/not deleted/i.test(await H.status(p)) && (await H.editorValue(p)) === '', await H.status(p));
  await ctx.close();
}

/* ===== other tabs ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const b = await H.page(ctx);
  await H.settle(b, 700);                     // tab B has inbox.md open, clean
  const c = await H.page(ctx);
  await H.settle(c, 700);                     // tab C has it open too...
  await H.setEditor(c, '# Inbox\n\nC was typing\n'); // ...with unsaved words
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 800);
  t.check('a clean tab closes the deleted note', (await H.editorValue(b)) === '' && /deleted/i.test(await H.status(b)),
    await H.status(b));
  t.check('a tab with unsaved words keeps them, as a new unsaved note', (await H.editorValue(c)) === '# Inbox\n\nC was typing\n' &&
    /new/i.test(await c.textContent('#crumb')), await c.textContent('#crumb'));
  await c.waitForTimeout(2600);
  t.check('which is not saved behind their back', !('inbox.md' in gh.files));
  await c.click('#btn-save');
  await H.settle(c, 500);
  t.check('but can be, deliberately', gh.files['inbox.md'] === '# Inbox\n\nC was typing\n');
  await ctx.close();
}

/* ===== review: a tab with unsaved words keeps them, even after leaving the note ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const c = await H.page(ctx);
  await H.settle(c, 700);
  await H.setEditor(c, '# Inbox\n\nC was typing\n');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 800);
  await H.clickRow(c, 'plan.md');                   // C moves on without saving
  await c.evaluate(() => openFile('inbox.md'));     // and comes back to it (no longer listed)
  await H.settle(c, 500);
  t.check("the other tab's unsaved words survive the delete and leaving the note",
    (await H.editorValue(c)) === '# Inbox\n\nC was typing\n', JSON.stringify(await H.editorValue(c)));
  t.check('and are still not saved behind their back', !('inbox.md' in gh.files));
  const d = await c.evaluate(() => JSON.parse(localStorage.getItem('notes.draft.v1:roldaof/obsidian-vault@main:inbox.md')));
  t.check('kept as a draft of a new note, so saving creates it rather than conflicting', d && d.sha === null, JSON.stringify(d));
  await ctx.close();
}

/* ===== review: a tab that never hears of the delete keeps its draft ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const c = await H.page(ctx);
  await H.settle(c, 700);
  await c.evaluate(() => moveChannel && moveChannel.close());   // e.g. an iOS tab frozen in the background
  await H.setEditor(c, '# Inbox\n\nfrozen tab typing\n');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 800);
  t.check("the deleting tab leaves another tab's draft alone", await p.evaluate(() =>
    (localStorage.getItem('notes.draft.v1:roldaof/obsidian-vault@main:inbox.md') || '').includes('frozen tab typing')));
  await ctx.close();
}

/* ===== review: with no note open, nothing can be typed into nowhere ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('after a delete the empty editor takes no typing', await p.evaluate(() => document.querySelector('#cm-stub').readOnly));
  await H.clickRow(p, 'plan.md');
  t.check('until a note is opened', !(await p.evaluate(() => document.querySelector('#cm-stub').readOnly)));
  await ctx.close();
}

/* ===== review: already deleted elsewhere, and a double tap ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  delete gh.files['inbox.md']; gh.touch();         // another device got there first
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('a note already deleted elsewhere counts as deleted', /deleted/i.test(await H.status(p)) &&
    !/not deleted/i.test(await H.status(p)) && (await H.editorValue(p)) === '', await H.status(p));
  await ctx.close();
}
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/contents/**', async r => {
    if (r.request().method() === 'DELETE') await new Promise(res => setTimeout(res, 1500));
    return r.fallback();
  });
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 200);
  await p.click('#btn-delete', { timeout: 1000 }).catch(() => {});
  await p.waitForTimeout(2200);
  t.check('a second tap while it deletes changes nothing', p.asked.length === 1 && !/not deleted/i.test(await H.status(p)),
    p.asked.length + ' ' + await H.status(p));
  await ctx.close();
}

/* ===== review: a restored draft that conflicts points to the way out ===== */
{
  const { gh, ctx, p } = await ready();
  await p.evaluate(() => localStorage.setItem('notes.draft.v1:roldaof/obsidian-vault@main:inbox.md',
    JSON.stringify({ text: 'old draft', sha: 'stale', at: 0 })));
  await H.clickRow(p, 'inbox.md');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 600);
  t.check('a delete refused over a stale draft says to Discard first', /discard/i.test(await H.status(p)) &&
    'inbox.md' in gh.files, await H.status(p));
  await ctx.close();
}

/* ===== review: a pinned note that is deleted is unpinned ===== */
{
  const { gh, ctx, p } = await ready();
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.fill('#f-pins', 'todo.md, inbox.md');
  await p.click('#f-save');
  await H.settle(p, 400);
  await H.clickRow(p, 'inbox.md');
  answer(p, true);
  await p.click('#btn-delete');
  await H.settle(p, 700);
  t.check('a deleted note is no longer pinned', JSON.stringify(await p.$$eval('#pin-tabs button', b => b.map(x => x.textContent))) === '["todo.md"]');
  t.check('and the person is told', /unpinned/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== review: a delete waits for a pinned task still being saved ===== */
{
  const { gh, ctx, p } = await ready();
  await p.route('https://api.github.com/**/contents/todo.md', async r => {
    if (r.request().method() === 'PUT') await new Promise(res => setTimeout(res, 1200));
    return r.fallback();
  });
  await H.clickRow(p, 'inbox.md');
  const order = [];
  p.on('request', r => { if (r.url().includes('/contents/') && r.method() !== 'GET') order.push('start ' + r.method()); });
  p.on('requestfinished', r => { if (r.url().includes('/contents/') && r.method() !== 'GET') order.push('end ' + r.method()); });
  await p.fill('#pin-input', 'a task');
  await p.press('#pin-input', 'Enter');
  answer(p, true);
  await p.click('#btn-delete');
  await p.waitForTimeout(2500);
  t.check('both the task and the delete land', gh.files['todo.md'].includes('a task') && !('inbox.md' in gh.files),
    await H.status(p));
  // GitHub: writes to files must go one after another, never overlapping.
  t.check('and the delete is sent only after the task has been saved',
    order.indexOf('start DELETE') > order.indexOf('end PUT') && order.indexOf('end PUT') !== -1, JSON.stringify(order));
  await ctx.close();
}

/* ===== a read-only repository offers no delete ===== */
{
  const repos = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main', private: true, archived: true }];
  const { ctx, p } = await ready({ repos });
  await H.clickRow(p, 'inbox.md');
  t.check('no Delete in a read-only repository', !(await p.isVisible('#btn-delete')));
  await ctx.close();
}

await H.stop();
t.finish();
