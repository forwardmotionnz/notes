/* Rename and move: one commit, never both copies, never neither. */
import * as H from './harness.mjs';

const t = H.suite('rename');
await H.start();

const FILES = () => ({ 'todo.md': '- [ ] one\n', 'inbox.md': '# Inbox\n\nkeep me\n', 'plan.md': '# Plan\n' });

async function ready(opts = {}) {
  const gh = H.fakeGitHub({ files: FILES(), ...opts });
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  return { gh, ctx, p };
}
const renameTo = async (p, target) => {
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(target) : d.accept());
  await p.click('#btn-rename');
  await H.settle(p, 700);
};

/* ===== the move itself ===== */
{
  const { gh, ctx, p } = await ready();
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  await p.fill('#f-pins', 'todo.md, inbox.md');
  await p.click('#f-save');
  await H.settle(p, 400);
  await H.clickRow(p, 'inbox.md');
  t.check('a Rename button is offered for the open file', await p.isVisible('#btn-rename'));
  const before = gh.commits.length;
  await renameTo(p, 'archive/2026/inbox old.md');
  t.check('the file is at its new path with its content', gh.files['archive/2026/inbox old.md'] === '# Inbox\n\nkeep me\n');
  t.check('and gone from the old one', !('inbox.md' in gh.files));
  t.check('in exactly one commit', gh.commits.length === before + 1, String(gh.commits.length - before));
  t.check('named for what it did', /inbox\.md/.test(gh.commits.at(-1).message) && /inbox old\.md/.test(gh.commits.at(-1).message),
    gh.commits.at(-1).message);
  t.check('the editor follows it', (await p.textContent('#crumb .name')) === 'inbox old.md' &&
    (await H.editorValue(p)) === '# Inbox\n\nkeep me\n');
  await H.expand(p, 'archive');
  await H.expand(p, '2026');
  t.check('the tree shows it', (await H.rows(p)).includes('inbox old.md') && !(await H.rows(p)).includes('inbox.md'));
  t.check('a pin follows it', JSON.stringify(await p.$$eval('#pin-tabs button', b => b.map(x => x.textContent))) ===
    '["todo.md","inbox old.md"]');
  await H.setEditor(p, '# Inbox\n\nkeep me, edited after the move\n');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check('and saves go to the new path', gh.files['archive/2026/inbox old.md'] === '# Inbox\n\nkeep me, edited after the move\n' &&
    !('inbox.md' in gh.files));
  t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== a failure at any step leaves the repository as it was ===== */
for (const step of ['git/ref/heads', 'git/commits/', 'git/trees', 'git/commits', 'git/refs/heads']) {
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const method = step === 'git/trees' || step === 'git/commits' ? 'POST' : step === 'git/refs/heads' ? 'PATCH' : 'GET';
  await p.route('https://api.github.com/**', r => {
    const u = r.request().url();
    const hit = u.includes('/' + step) && r.request().method() === method &&
      (step !== 'git/commits' || !/git\/commits\/./.test(u));
    return hit ? r.abort() : r.fallback();
  });
  await renameTo(p, 'moved.md');
  t.check(`a failure at ${method} ${step}: both copies never, neither never`,
    gh.files['inbox.md'] === '# Inbox\n\nkeep me\n' && !('moved.md' in gh.files));
  t.check(`and the person is told (${step})`, /not renamed|could not/i.test(await H.status(p)), await H.status(p));
  t.check(`and the note stays open where it was (${step})`, (await p.textContent('#crumb .name')) === 'inbox.md');
  await ctx.close();
}

/* ===== the file was changed elsewhere since it was opened ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['inbox.md'] = '# Inbox\n\nchanged on another device\n';
  gh.touch();
  await renameTo(p, 'moved.md');
  t.check('a file changed elsewhere is not moved in its old form', gh.files['inbox.md'] === '# Inbox\n\nchanged on another device\n' &&
    !('moved.md' in gh.files));
  t.check('and the person is told why', /changed/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== the target already exists ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let gitCalls = 0;
  p.on('request', r => { if (r.url().startsWith('https://api.github.com/')) gitCalls++; });
  await renameTo(p, 'plan.md');
  t.check('an existing file is never overwritten by a move', gh.files['plan.md'] === '# Plan\n' && 'inbox.md' in gh.files);
  t.check('and the person is told', /already/i.test(await H.status(p)), await H.status(p));
  // A file already in the list is refused before anything is asked of GitHub.
  t.check('refused at once, before any request to GitHub', gitCalls === 0, String(gitCalls));
  await ctx.close();
}

/* ===== the target was created elsewhere after the list loaded ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  gh.files['fresh.md'] = '# made on another device\n';
  gh.touch();
  await renameTo(p, 'fresh.md');
  t.check('a target that appeared since is never overwritten', gh.files['fresh.md'] === '# made on another device\n' &&
    gh.files['inbox.md'] === '# Inbox\n\nkeep me\n');
  t.check('and the person is told it exists', /already/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== nothing can be typed while it moves ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/git/refs/heads/**', async r => {
    await new Promise(res => setTimeout(res, 1500)); return r.fallback();
  });
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('moved.md') : d.accept());
  await p.click('#btn-rename');
  await H.settle(p, 500);
  t.check('the note is locked while it moves', await p.evaluate(() => document.querySelector('#cm-stub').readOnly));
  await p.waitForTimeout(2500);
  t.check('and unlocked once it has moved', !(await p.evaluate(() => document.querySelector('#cm-stub').readOnly)) &&
    (await p.textContent('#crumb .name')) === 'moved.md');
  t.check('with nothing written to the old path', !('inbox.md' in gh.files) && gh.files['moved.md'] === '# Inbox\n\nkeep me\n');
  await ctx.close();
}

/* ===== another commit lands between reading and moving ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let once = true;
  await p.route('https://api.github.com/**/git/refs/heads/**', async r => {
    if (once && r.request().method() === 'PATCH') {
      once = false;
      gh.files['plan.md'] = '# Plan\n\nedited elsewhere\n';   // someone commits another file
      gh.touch();
    }
    return r.fallback();
  });
  await renameTo(p, 'moved.md');
  t.check('another commit meanwhile: the move still lands, on top of it', gh.files['moved.md'] === '# Inbox\n\nkeep me\n' &&
    !('inbox.md' in gh.files) && gh.files['plan.md'] === '# Plan\n\nedited elsewhere\n');
  await ctx.close();
}

/* ===== unsaved changes are saved first ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, '# Inbox\n\nunsaved words\n');
  await H.settle(p, 60);
  await renameTo(p, 'moved.md');
  await H.settle(p, 600);
  t.check('unsaved words go with the file', gh.files['moved.md'] === '# Inbox\n\nunsaved words\n' && !('inbox.md' in gh.files),
    JSON.stringify(gh.files['moved.md']));
  await ctx.close();
}

/* ===== review: another tab with the file open follows it ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  const b = await H.page(ctx);
  await H.settle(b, 700);                     // tab B reopens inbox.md
  await renameTo(p, 'moved.md');
  await H.settle(b, 400);
  t.check('the other tab follows the file to its new name', (await b.textContent('#crumb .name')) === 'moved.md',
    await b.textContent('#crumb'));
  await H.setEditor(b, '# Inbox\n\ntyped in the other tab\n');
  await H.settle(b, 60);
  await b.click('#btn-save');
  await H.settle(b, 500);
  t.check('and saves there, never recreating the old path', !('inbox.md' in gh.files) &&
    gh.files['moved.md'] === '# Inbox\n\ntyped in the other tab\n');
  await ctx.close();
}

/* ===== review: words typed right after a rename are kept ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/git/trees/main**', async r => {
    await new Promise(res => setTimeout(res, 1500)); return r.fallback();
  });
  await renameTo(p, 'moved.md');
  t.check('the note is at its new name straight away', (await p.textContent('#crumb .name')) === 'moved.md');
  await H.setEditor(p, '# Inbox\n\ntyped straight after\n');
  await p.waitForTimeout(3500);
  t.check('and what is typed straight after is saved there', gh.files['moved.md'] === '# Inbox\n\ntyped straight after\n' &&
    !('inbox.md' in gh.files), JSON.stringify(gh.files['moved.md']));
  await ctx.close();
}

/* ===== review: a refresh during the move does not unlock the note ===== */
{
  const { ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await p.route('https://api.github.com/**/git/refs/heads/**', async r => {
    await new Promise(res => setTimeout(res, 1500)); return r.fallback();
  });
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('moved.md') : d.accept());
  await p.click('#btn-rename');
  await H.settle(p, 300);
  await p.click('#btn-refresh');
  await H.settle(p, 400);
  t.check('a refresh while it moves leaves the note locked', await p.evaluate(() => document.querySelector('#cm-stub').readOnly));
  await p.waitForTimeout(2000);
  await ctx.close();
}

/* ===== review: a move whose reply was lost is recognised ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  let lose = true;
  await p.route('https://api.github.com/**/git/refs/heads/**', async r => {
    if (!lose || r.request().method() !== 'PATCH') return r.fallback();
    lose = false;
    const branch = r.request().url().split('/git/refs/heads/')[1];
    gh.patchRef('roldaof/obsidian-vault', branch, JSON.parse(r.request().postData()), '');   // GitHub makes the move...
    return r.abort();                             // ...and the reply never arrives
  });
  await renameTo(p, 'moved.md');
  await H.settle(p, 400);
  t.check('it moved, and the app says so rather than "Not renamed"', 'moved.md' in gh.files && !('inbox.md' in gh.files) &&
    (await p.textContent('#crumb .name')) === 'moved.md' && !/not renamed/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== review: names the app could not open again ===== */
{
  const { gh, ctx, p } = await ready();
  await H.clickRow(p, 'inbox.md');
  await renameTo(p, 'Groceries');
  t.check('a name without an extension keeps the note\'s own', 'Groceries.md' in gh.files && !('inbox.md' in gh.files),
    JSON.stringify(Object.keys(gh.files)));
  for (const bad of ['notes.pdf', '.archive/x.md', 'todo.md/inside.md']) {
    await renameTo(p, bad);
    t.check(`"${bad}" is refused, nothing moves`, 'Groceries.md' in gh.files && !(bad in gh.files) &&
      /not renamed/i.test(await H.status(p)), await H.status(p));
  }
  await ctx.close();
}

/* ===== review: symlinks and executables are not rewritten as plain files ===== */
{
  const { gh, ctx, p } = await ready();
  gh.modes = { 'inbox.md': '120000' };
  await p.click('#btn-refresh');
  await H.settle(p, 400);
  await H.clickRow(p, 'inbox.md');
  await renameTo(p, 'moved.md');
  t.check('a symbolic link is not renamed here', 'inbox.md' in gh.files && !('moved.md' in gh.files) &&
    /link|rename it on GitHub/i.test(await H.status(p)), await H.status(p));
  await ctx.close();
}

/* ===== review: nothing from GitHub is served stale from the browser's cache ===== */
{
  const gh = H.fakeGitHub({ files: FILES() });
  const ctx = await H.context(gh);
  await ctx.addInitScript(() => {
    const real = window.fetch;
    window.__cacheModes = [];
    window.fetch = (u, init) => {
      if (String(u).startsWith('https://api.github.com/')) window.__cacheModes.push((init && init.cache) || 'default');
      return real(u, init);
    };
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'inbox.md');
  const modes = await p.evaluate(() => window.__cacheModes);
  t.check('every GitHub request skips the browser cache', modes.length > 0 && modes.every(m => m === 'no-store'),
    JSON.stringify([...new Set(modes)]));
  await ctx.close();
}

/* ===== a read-only repository offers no rename ===== */
{
  const repos = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault', default_branch: 'main', private: true, archived: true }];
  const { ctx, p } = await ready({ repos });
  await H.clickRow(p, 'inbox.md');
  t.check('no Rename in a read-only repository', !(await p.isVisible('#btn-rename')));
  await ctx.close();
}

await H.stop();
t.finish();
