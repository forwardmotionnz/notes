/* Human failures and safe retries. GitHub's documented statuses/headers:
   https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors
   https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
   Refresh tokens rotate once; a transport failure is not token rejection:
   https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens */
import * as H from './harness.mjs';
const t = H.suite('errors');
await H.start();
async function setup() {
  const gh = H.fakeGitHub(); const ctx = await H.context(gh); const p = await H.page(ctx);
  await H.signIn(p); await H.clickRow(p, 'todo.md');
  await p.waitForFunction(() => current?.path === 'todo.md');
  await p.evaluate(() => { AUTOSAVE_MS = 60000; });
  return { gh, ctx, p };
}
async function save(p) {
  await p.click('#btn-save'); await p.waitForFunction(() => !saving);
}
const kept = p => p.evaluate(() => readDraft('todo.md')?.text === editor.getValue() && !!cfg.token);
const human = s => /try again|retry/i.test(s) && !/TypeError|Failed to fetch|Load failed|SyntaxError|STACK|<html>/i.test(s);
for (const mode of ['offline', 'outage', 'invalid-json', 'incomplete-object']) {
  const { gh, ctx, p } = await setup(); let blocked = true;
  if (mode === 'offline') await p.clock.install();
  await ctx.route('https://api.github.com/**/contents/todo.md', r => {
    if (!blocked || r.request().method() !== 'PUT') return r.fallback();
    if (mode === 'offline') return r.abort();
    return r.fulfill({ status: mode === 'outage' ? 503 : 200, contentType: 'text/html', body: mode === 'incomplete-object' ? '{}' : '<html>STACK internal failure</html>' });
  });
  await H.setEditor(p, 'my unsaved words ' + mode); await save(p);
  t.check(`${mode}: fixed human message explains retry`, human(await H.status(p)), await H.status(p));
  t.check(`${mode}: draft and sign-in survive`, await kept(p));
  if (mode === 'offline') {
    await p.clock.fastForward(8000);
    t.check('a failed save remains explained until another action', human(await H.status(p)), await H.status(p));
  }
  blocked = false; await save(p);
  t.check(`${mode}: Save retries without losing text`, gh.files['todo.md'] === 'my unsaved words ' + mode && !await p.evaluate(() => dirty()));
  await ctx.close();
}
for (const mode of ['offline', 'outage', 'invalid-json', 'partial-tokens', 'object-token', 'object-refresh']) {
  const { gh, ctx, p } = await setup(); let blocked = true;
  const tokens = await p.evaluate(() => [cfg.token, cfg.refresh]);
  await ctx.route('https://broker.test/**', r => {
    if (!blocked) return r.fallback();
    return mode === 'offline' ? r.abort() : r.fulfill({ status: mode === 'outage' ? 502 : 200,
      contentType: 'application/json', body: mode === 'outage' ? '{"error":"github_unreachable"}' : mode === 'partial-tokens'
        ? '{"access_token":"ghu_bad","expires_in":28800}' : mode === 'object-token'
        ? '{"access_token":{},"refresh_token":"ghr_bad","expires_in":28800}' : mode === 'object-refresh'
        ? '{"access_token":"ghu_bad","refresh_token":{},"expires_in":0}' : 'not JSON' });
  });
  await p.evaluate(() => { cfg.expires = Date.now() - 1; saveCfg(); });
  await H.setEditor(p, 'draft through a refresh outage'); await save(p);
  const signedIn = await p.evaluate(() => !!cfg.token && !!cfg.refresh);
  t.check(`refresh ${mode}: keeps sign-in and draft`, signedIn && await kept(p) && await p.evaluate(tokens => cfg.token === tokens[0] && cfg.refresh === tokens[1], tokens));
  t.check(`refresh ${mode}: offers retry without a sign-in dialog`, !await H.dialogOpen(p) && human(await H.status(p)), await H.status(p));
  blocked = false;
  if (signedIn) await save(p);
  t.check(`refresh ${mode}: retry refreshes and commits`, signedIn && gh.log.refreshes === 1 && gh.files['todo.md'] === 'draft through a refresh outage');
  await ctx.close();
}
for (const rate of ['retry-after', 'primary', 'secondary']) {
  const { gh, ctx, p } = await setup(); let blocked = true, requests = 0;
  await ctx.route('https://api.github.com/**/contents/todo.md', r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    requests++;
    if (!blocked) return r.fallback();
    return r.fulfill({ status: rate === 'retry-after' ? 429 : 403, contentType: 'application/json',
      headers: rate === 'retry-after' ? { 'retry-after': '2' } : rate === 'primary'
        ? { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.ceil(Date.now() / 1000) + 2) } : {},
      body: JSON.stringify({ message: rate === 'secondary' ? 'You have exceeded a secondary rate limit.' : 'API rate limit exceeded.' }) });
  });
  await H.setEditor(p, 'rate-limited draft'); await save(p);
  const message = await H.status(p);
  t.check(`${rate}: says to wait and retry`, /wait|after/i.test(message) && /limit|too many/i.test(message) && human(message), message);
  t.check(`${rate}: draft and sign-in survive`, await kept(p));
  await p.evaluate(() => { cfg.expires = Date.now() - 1; });
  blocked = false; await save(p);
  t.check(`${rate}: no request is sent during cooldown`, requests === 1, String(requests));
  t.check(`${rate}: cooldown does not spend a refresh token either`, gh.log.refreshes === 0, String(gh.log.refreshes));
  await p.clock.setFixedTime(new Date(Date.now() + 65000));
  if (await p.evaluate(() => dirty())) await save(p);
  t.check(`${rate}: Save works after cooldown`, gh.files['todo.md'] === 'rate-limited draft' && requests === 2, String(requests));
  await ctx.close();
}
for (const status of [409, 422]) {
  const { gh, ctx, p } = await setup(); let blocked = true;
  await ctx.route('https://api.github.com/**/contents/todo.md', r => blocked && ['PUT', 'DELETE'].includes(r.request().method())
    ? r.fulfill({ status, contentType: 'application/json', body: '{"message":"Repository rule violations found: protected branch"}' }) : r.fallback());
  await H.setEditor(p, 'kept despite repository rules'); await save(p);
  const message = await H.status(p);
  t.check(`${status} repository rule: does not falsely instruct Discard`, /rules|protected/i.test(message) && !/conflict|discard/i.test(message), message);
  t.check(`${status} repository rule: keeps draft without marking a content conflict`, await kept(p) && !await p.evaluate(() => current.conflict));
  blocked = false; await save(p);
  t.check(`${status} repository rule: can retry once permitted`, gh.files['todo.md'] === 'kept despite repository rules');
  blocked = true;
  await p.click('#btn-delete'); await p.waitForFunction(() => !moving);
  const deletion = await H.status(p);
  t.check(`${status} protected delete: explains the rules without Discard`, /rules/i.test(deletion) && !/discard/i.test(deletion), deletion);
  t.check(`${status} protected delete: keeps the note open and unchanged`, await p.evaluate(() => current?.path === 'todo.md') && gh.files['todo.md'] === 'kept despite repository rules');
  await ctx.close();
}
for (const reply of ['<html>STACK</html>', '{}']) {
  const { gh, ctx, p } = await setup(); let blocked = true;
  await ctx.route('https://api.github.com/**/contents/todo.md?*', r => blocked
    ? r.fulfill({ status: 200, contentType: 'application/json', body: reply }) : r.fallback());
  await p.evaluate(() => openFile('todo.md'));
  await p.waitForFunction(() => document.querySelector('#status').textContent !== 'Opening...');
  t.check(`bad read ${reply}: says how to retry`, human(await H.status(p)), await H.status(p));
  t.check(`bad read ${reply}: does not replace the note with an empty file`, await H.editorValue(p) === gh.files['todo.md'] && await p.evaluate(() => !!current.sha));
  blocked = false; await p.evaluate(() => openFile('todo.md'));
  await p.waitForFunction(() => document.querySelector('#status').textContent !== 'Opening...');
  t.check(`bad read ${reply}: opening again succeeds`, await H.editorValue(p) === gh.files['todo.md']);
  await ctx.close();
}
{
  const { ctx, p } = await setup(); let release;
  await p.clock.install();
  await ctx.route('https://api.github.com/**/contents/todo.md', r => r.request().method() === 'PUT'
    ? new Promise(resolve => { release = async () => { await r.fulfill({ status: 503, body: '{}' }).catch(() => {}); resolve(); }; }) : r.fallback());
  await H.setEditor(p, 'words while a request hangs'); await p.click('#btn-save');
  await p.waitForTimeout(50);
  await p.clock.fastForward(31000);
  await p.waitForTimeout(50);
  t.check('a request that never answers ends with a human retry message', !await p.evaluate(() => saving) && human(await H.status(p)), await H.status(p));
  t.check('a timed-out request keeps the draft and sign-in', await kept(p));
  if (release) await release();
  await ctx.close();
}
{
  const { gh, ctx, p } = await setup(); let lost = true;
  await ctx.route('https://api.github.com/**/contents/todo.md', r => {
    if (!lost || r.request().method() !== 'PUT') return r.fallback();
    lost = false;
    // Same contents update semantics as the fake, but its success reply is
    // replaced by an outage response. A server error cannot prove no write.
    gh.files['todo.md'] = Buffer.from(JSON.parse(r.request().postData()).content, 'base64').toString('utf8'); gh.touch();
    return r.fulfill({ status: 503, body: '{}' });
  });
  await H.setEditor(p, 'server kept these words'); await save(p);
  t.check('a write followed by a server error keeps the draft', await kept(p));
  await save(p);
  t.check('retry recognises a write that landed before a server error', !await p.evaluate(() => dirty() || current.conflict) && gh.files['todo.md'] === 'server kept these words', await H.status(p));
  await ctx.close();
}
{
  const { gh, ctx, p } = await setup(); let mode = 'lost';
  await ctx.route('https://api.github.com/**/contents/todo.md*', r => {
    if (mode === 'offline') return r.abort();
    if (mode === 'lost' && r.request().method() === 'PUT') {
      gh.files['todo.md'] = Buffer.from(JSON.parse(r.request().postData()).content, 'base64').toString('utf8'); gh.touch();
      mode = 'offline'; return r.abort();
    }
    return r.fallback();
  });
  await H.setEditor(p, 'first text landed'); await save(p);
  await H.setEditor(p, 'second text is still local'); await save(p);
  mode = 'online'; await save(p);
  t.check('a second offline edit retains the earlier uncertain write for retry', gh.files['todo.md'] === 'second text is still local' && !await p.evaluate(() => dirty() || current.conflict), await H.status(p));
  await ctx.close();
}
{
  const { ctx, p } = await setup(); let apiRequests = 0, releaseAPI, releaseBroker;
  await ctx.route('https://api.github.com/user', r => {
    apiRequests++;
    return apiRequests === 1 ? new Promise(resolve => { releaseAPI = async () => {
      await r.fulfill({ status: 429, headers: { 'retry-after': '60' }, body: '{}' }); resolve();
    }; }) : r.fallback();
  });
  await ctx.route('https://broker.test/**', r => new Promise(resolve => { releaseBroker = async () => { await r.fallback(); resolve(); }; }));
  await p.evaluate(() => { window.firstRequest = request('/user').catch(e => e.message); });
  while (!releaseAPI) await new Promise(resolve => setTimeout(resolve, 10));
  await p.evaluate(() => { cfg.expires = Date.now() - 1; window.waitingRequest = request('/user').catch(e => e.message); });
  while (!releaseBroker) await new Promise(resolve => setTimeout(resolve, 10));
  await releaseAPI(); await p.evaluate(() => firstRequest);
  await releaseBroker(); await p.evaluate(() => waitingRequest);
  t.check('a request waiting for refresh honours a newly imposed cooldown', apiRequests === 1, String(apiRequests));
  await ctx.close();
}
for (const action of ['rename', 'delete']) {
  const { gh, ctx, p } = await setup();
  if (action === 'delete') await ctx.route('https://api.github.com/**/contents/todo.md', r => {
    if (r.request().method() !== 'DELETE') return r.fallback();
    delete gh.files['todo.md']; gh.touch(); return r.fulfill({ status: 503, body: '{}' });
  });
  else await ctx.route('https://api.github.com/**/git/refs/heads/main', r => {
    if (r.request().method() !== 'PATCH') return r.fallback();
    gh.patchRef('roldaof/obsidian-vault', 'main', JSON.parse(r.request().postData()), r.request().headers().authorization);
    return r.fulfill({ status: 503, body: '{}' });
  });
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept(action === 'rename' ? 'moved.md' : undefined));
  await p.click('#btn-' + action); await p.waitForFunction(() => !moving);
  t.check(`${action}: recognises an operation that landed before a server error`, action === 'rename'
    ? await p.evaluate(() => current?.path === 'moved.md') && !!gh.files['moved.md'] && !gh.files['todo.md']
    : await p.evaluate(() => !current) && !gh.files['todo.md'], await H.status(p));
  await ctx.close();
}
for (const part of ['tree', 'installations', 'rename', 'rename-head', 'rename-tree', 'rename-commit', 'empty-write']) {
  const { gh, ctx, p } = await setup(); let blocked = true, malformedSent = false, laterGitCalls = 0;
  ctx.on('request', r => { if (malformedSent && /api.github.com.*\/git\//.test(r.url())) laterGitCalls++; });
  const pattern = part === 'tree' ? 'https://api.github.com/**/git/trees/main*' : part === 'installations'
    ? 'https://api.github.com/user/installations?*' : part === 'rename'
    ? 'https://api.github.com/**/git/ref/heads/main' : part === 'rename-head'
    ? 'https://api.github.com/**/git/commits/*' : part === 'rename-tree'
    ? 'https://api.github.com/**/git/trees' : part === 'rename-commit'
    ? 'https://api.github.com/**/git/commits' : 'https://api.github.com/**/contents/todo.md';
  await ctx.route(pattern, r => blocked && (part !== 'empty-write' || r.request().method() === 'PUT')
    ? (malformedSent = true, r.fulfill({ status: part === 'empty-write' ? 204 : 200, contentType: 'application/json', body: part === 'empty-write' ? '' : '{}' })) : r.fallback());
  let message;
  if (part === 'tree') { await p.evaluate(() => refreshTree()); message = await H.status(p); }
  else if (part === 'installations') message = await p.evaluate(() => listRepos().then(() => '', e => e.message));
  else if (part.startsWith('rename')) {
    p.removeAllListeners('dialog'); p.on('dialog', d => d.accept('moved.md'));
    await p.click('#btn-rename'); await p.waitForFunction(() => !moving); message = await H.status(p);
  } else { await H.setEditor(p, 'safe from empty response'); await save(p); message = await H.status(p); }
  t.check(`malformed ${part}: human retry message instead of success or a raw exception`, human(message), message);
  t.check(`malformed ${part}: repository files are untouched`, gh.files['todo.md'] === '# Today\n\n- [ ] one\n' && Object.keys(gh.files).length === 1);
  if (part.startsWith('rename')) t.check(`malformed ${part}: stops before another Git data request`, laterGitCalls === 0, String(laterGitCalls));
  await ctx.close();
}
{
  const { gh, ctx, p } = await setup(); let puts = 0;
  await ctx.route('https://api.github.com/**/contents/todo.md', r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    puts++;
    if (puts === 1) { gh.files['todo.md'] = 'our earlier write'; gh.touch(); return r.abort(); }
    return r.fallback();
  });
  await H.setEditor(p, 'our earlier write'); await save(p);
  gh.files['todo.md'] = 'someone else changed it'; gh.touch();
  await H.setEditor(p, 'our newer draft'); await save(p);
  t.check('recovery seeing an outside edit stops before sending another write', puts === 1, String(puts));
  t.check('a genuine conflict preserves both the remote edit and local draft', gh.files['todo.md'] === 'someone else changed it' && await kept(p) && await p.evaluate(() => current.conflict));
  await ctx.close();
}
await H.stop();
t.finish();
