/* Release review: replies and queued work must remain with the repository
   and selection that started them. Storage migration must be transactional. */
import * as H from './harness.mjs';

const t = H.suite('release races');
await H.start();
const repos = () => ['alpha', 'beta'].map(name => ({
  owner: { login: 'roldaof' }, name, full_name: 'roldaof/' + name,
  default_branch: 'main', private: true,
}));
const files = () => ({ 'todo.md': '- [ ] one\n', 'inbox.md': 'same note\n', 'plan.md': 'the plan\n' });

async function ready({ multiple = true, remember = true } = {}) {
  const gh = H.fakeGitHub({ files: files(), ...(multiple ? { repos: repos() } : {}) });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p, { remember });
  if (multiple) {
    await p.selectOption('#f-repo', { label: 'roldaof/alpha' });
    await p.click('#f-save');
  }
  await p.waitForFunction(() => configured() && !accessPending && treeState === 'ok');
  return { gh, ctx, p };
}

async function pickBeta(p) {
  await p.click('#btn-settings');
  await p.waitForFunction(() => repoChoices.some(r => r.repo === 'beta'));
  await p.selectOption('#f-repo', { label: 'roldaof/beta' });
  await p.click('#f-save');
}

async function gate(p, url, method = 'GET', answer) {
  let release, entered;
  const blocked = new Promise(r => { release = r; });
  const started = new Promise(r => { entered = r; });
  let held = false;
  await p.route(url, async route => {
    if (held || route.request().method() !== method) return route.fallback();
    held = true;
    entered();
    await blocked;
    return answer ? answer(route) : route.fallback();
  });
  return { release, started };
}

try {
  // Identical blobs have identical SHAs in separate repositories. A SHA
  // check alone therefore cannot protect a delete sent to the wrong repo.
  {
    const { gh, ctx, p } = await ready();
    await H.preview(p, 'todo.md');
    const hold = await gate(p, 'https://api.github.com/**/contents/todo.md', 'PUT');
    await H.tick(p, 'one');
    await hold.started;
    await H.clickRow(p, 'inbox.md');
    await H.noteAction(p, '#btn-delete');
    await p.waitForFunction(() => moving);
    await pickBeta(p);
    hold.release();
    await p.waitForFunction(() => !moving && Object.keys(pinBusy).length === 0);
    t.check('a delete waiting for tasks never deletes from the newly selected repository',
      !gh.commits.some(c => c.repo === 'roldaof/beta' && c.message === 'Delete inbox.md'),
      JSON.stringify(gh.commits.map(c => [c.repo, c.message])));
    await ctx.close();
  }

  {
    const { ctx, p } = await ready();
    const hold = await gate(p, 'https://api.github.com/repos/roldaof/alpha/contents/inbox.md?*');
    await p.evaluate(() => { openFile('inbox.md'); });
    await hold.started;
    await pickBeta(p);
    hold.release();
    await H.settle(p, 500);
    t.check('a late note from alpha cannot open under beta',
      await p.evaluate(() => cfg.repo === 'beta' && current === null));
    await ctx.close();
  }

  {
    const { ctx, p } = await ready();
    const hold = await gate(p, 'https://api.github.com/**/contents/inbox.md?*');
    await p.evaluate(() => { openFile('inbox.md'); });
    await hold.started;
    await H.clickRow(p, 'plan.md');
    await p.waitForFunction(() => current?.path === 'plan.md');
    hold.release();
    await H.settle(p, 500);
    t.check('an older slow open cannot replace the more recently selected note',
      await p.evaluate(() => current?.path === 'plan.md' && editor.getValue() === 'the plan\n'));
    await ctx.close();
  }

  // N37 retired reading a pinned list with no note open (the late read this
  // block used to hold). What remains: alpha's checklist never stays on show.
  {
    const { ctx, p } = await ready();
    await H.preview(p, 'todo.md');
    await pickBeta(p);
    await p.waitForFunction(() => cfg.repo === 'beta' && !accessPending && treeState === 'ok');
    await H.settle(p, 500);
    t.check('a checklist from alpha is not left showing under beta',
      await p.evaluate(() => current === null && !document.body.classList.contains('preview-view') &&
        !document.querySelector('#pin-list').textContent && !pinCache['todo.md']));
    await ctx.close();
  }

  for (const remember of [true, false]) {
    const { ctx, p } = await ready({ multiple: false, remember });
    await H.clickRow(p, 'inbox.md');
    await p.route('https://api.github.com/**/contents/inbox.md', route =>
      route.request().method() === 'PUT' ? route.abort() : route.fallback());
    await H.setEditor(p, 'WORDS THAT EXIST ONLY IN THE DRAFT');
    await H.clickRow(p, 'plan.md');
    await p.waitForFunction(() => !saving && current?.path === 'plan.md');
    await p.evaluate(remember => {
      const original = Storage.prototype.setItem;
      const destination = remember ? sessionStorage : localStorage;
      Storage.prototype.setItem = function (key, value) {
        if (this === destination && key.startsWith('notes.draft.')) {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    }, remember);
    await p.click('#btn-settings');
    await p.waitForSelector('#f-save:not([disabled])');
    await p.setChecked('#f-session', remember);
    await p.click('#f-save');
    const result = await p.evaluate(() => {
      const key = draftKey('inbox.md');
      return { draft: localStorage.getItem(key) || sessionStorage.getItem(key),
        message: document.querySelector('#status').textContent };
    });
    t.check(`${remember ? 'local to session' : 'session to local'}: a failed copy preserves the sole draft`,
      !!result.draft && JSON.parse(result.draft).text === 'WORDS THAT EXIST ONLY IN THE DRAFT', JSON.stringify(result));
    t.check(`${remember ? 'local to session' : 'session to local'}: storage migration failure is explained`,
      /could not|couldn't|full|failed|cannot|unable/i.test(result.message));
    await ctx.close();
  }

  {
    const { gh, ctx, p } = await ready();
    const hold = await gate(p, 'https://api.github.com/**/contents/todo.md', 'PUT');
    // N37: queued checklist edits in Preview (the capture box is gone).
    await H.preview(p, 'todo.md');
    const edit = async (from, to) => { await H.taskAction(p, 'Edit task: ' + from); await p.locator('.task-edit').fill(to); await p.locator('.task-edit').press('Enter'); };
    await edit('one', 'FIRST EDIT');
    await hold.started;
    await H.tick(p, 'FIRST EDIT');
    await edit('FIRST EDIT', 'THIRD EDIT');
    await pickBeta(p);
    hold.release();
    await H.settle(p, 600);
    const recovery = await p.evaluate(() => JSON.stringify(Object.fromEntries(
      Object.entries({ ...localStorage, ...sessionStorage }).filter(([key]) => key !== 'notes.config.v2' && key !== 'notes.ui.v1'))));
    t.check('switching repository preserves the latest queued checklist edit in commits or recovery storage',
      gh.files['todo.md'].includes('[x] THIRD EDIT') || recovery.includes('[x] THIRD EDIT'),
      JSON.stringify({ committed: gh.files['todo.md'], recovery }));
    await ctx.close();
  }
  {
    const { ctx, p } = await ready();
    // A checklist save still in flight while another note is being edited.
    await H.preview(p, 'todo.md');
    const hold = await gate(p, 'https://api.github.com/**/contents/todo.md', 'PUT');
    await H.tick(p, 'one');
    await hold.started;
    await H.clickRow(p, 'inbox.md');
    await p.evaluate(() => { AUTOSAVE_MS = 60000; });
    await p.route('https://api.github.com/**/contents/inbox.md', route =>
      route.request().method() === 'PUT' ? route.abort() : route.fallback());
    await H.setEditor(p, 'COMBINED SETTINGS DRAFT');
    // Existing editor drafts fit, but preserving the pending task does not.
    // Migration must not strand the editor draft in the unselected store.
    await p.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key.startsWith('notes.draft.') && key.endsWith(':todo.md')) {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await p.click('#btn-settings');
    await p.waitForFunction(() => repoChoices.some(r => r.repo === 'beta'));
    await p.selectOption('#f-repo', { label: 'roldaof/beta' });
    await p.check('#f-session');
    await p.click('#f-save');
    const state = await p.evaluate(() => ({ repo: cfg.repo, session: sessionOnly,
      draft: readDraft('inbox.md')?.text, leaving: !!current?.leaving,
      localConfig: !!localStorage.getItem('notes.config.v2'), sessionConfig: !!sessionStorage.getItem('notes.config.v2') }));
    t.check('combined quota failure keeps the repository and storage mode unchanged',
      state.repo === 'alpha' && !state.session && state.localConfig && !state.sessionConfig, JSON.stringify(state));
    t.check('combined quota failure keeps the draft readable and the editor saveable',
      state.draft === 'COMBINED SETTINGS DRAFT' && !state.leaving, JSON.stringify(state));
    hold.release();
    await p.waitForFunction(() => !saving && Object.keys(pinBusy).length === 0);
    await p.reload();
    await p.waitForFunction(() => current?.path === 'inbox.md');
    t.check('the same draft restores after reloading the failed combined change',
      await p.evaluate(() => !sessionOnly && editor.getValue() === 'COMBINED SETTINGS DRAFT'));
    await ctx.close();
  }

  // N37 retired merging queued captures into a dirty editor's draft: with no
  // capture box, a checklist write and unsaved typing in the same note cannot
  // overlap, because Edit waits for the checklist save to finish.
  {
    const { gh, ctx, p } = await ready();
    await H.preview(p, 'todo.md');
    const hold = await gate(p, 'https://api.github.com/**/contents/todo.md', 'PUT');
    await H.tick(p, 'one');
    await hold.started;
    await p.click('#btn-preview');
    await H.settle(p, 300);
    t.check('Edit waits for a checklist save in flight', await p.evaluate(() => document.body.classList.contains('preview-view')));
    hold.release();
    await p.waitForFunction(() => !document.body.classList.contains('preview-view') && Object.keys(pinBusy).length === 0);
    t.check('and then opens the saved text', await H.editorValue(p) === '- [x] one\n' && gh.files['todo.md'] === '- [x] one\n', await H.editorValue(p));
    await ctx.close();
  }
} finally {
  await H.stop();
}
t.finish();
// READY_TO_RUN
