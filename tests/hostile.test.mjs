/* Hostile names and contents: nothing from a repository or from GitHub may execute. */
import * as H from './harness.mjs';
import { readFileSync } from 'fs';

const t = H.suite('hostile');
await H.start();

/* ===== the source has no HTML sinks at all ===== */
{
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
  const sinks = [...src.matchAll(/\.(?:innerHTML|outerHTML)\s*[+]?=|\[\s*["'](?:inner|outer)HTML["']\s*\]|["'](?:inner|outer)["']\s*\+\s*["']HTML|insertAdjacentHTML|document\.write/g)]
    .map(m => src.slice(0, m.index).split('\n').length);
  t.check('no innerHTML, outerHTML, insertAdjacentHTML or document.write', sinks.length === 0,
    'lines ' + sinks.join(', '));
}

// Each payload sets the tripwire if it ever runs. None contains a slash
// except where a slash is legal (a branch name), because a slash in a path
// is a folder separator.
const TRIP = 'window.__pwned=(window.__pwned||0)+1';
const IMG = `<img src=x onerror="${TRIP}">`;
const SVG = `"><svg onload=${TRIP}>`;
const IFR = `<iframe srcdoc=x onload=${TRIP}>`;
const BODY = [
  `# <svg onload=${TRIP}> heading`,
  '',
  `<script>${TRIP}</script>`,
  IMG,
  `- [ ] ${IMG} task`,
  `- [x] <a href="javascript:${TRIP}">link</a>`,
  '',
].join('\n');

const FILES = {
  [`${IMG}.md`]: BODY,
  [`${SVG}.md`]: 'plain\n',
  [`${IFR}/inside.md`]: 'nested\n',
  // Names that are also properties of every JavaScript object.
  'constructor/a.md': 'a\n',
  '__proto__/b.md': 'b\n',
  'notes/toString/c.md': 'c\n',
  'valueOf/d.md': 'd\n',
  'hasOwnProperty': '- [ ] pinned by an awkward name\n',
  [`${IMG}.png`]: 'binary',
  'todo.md': BODY,
  'inbox.md': 'safe\n',
};

const BRANCH = `<svg/onload=${TRIP}>`;
const REPOS = [{ owner: { login: 'roldaof' }, name: 'vault', full_name: 'roldaof/vault',
                 default_branch: BRANCH, private: true }];

const dangerous = p => p.evaluate(() => {
  const inside = ['tree', 'crumb', 'status', 'pin-list', 'pin-tabs', 'who-login', 'f-repo', 'signin-error'];
  let n = 0;
  inside.forEach(id => {
    const el = document.getElementById(id);
    if (el) n += el.querySelectorAll('img, svg, script, iframe, a[href^="javascript"]').length;
  });
  return n;
});
const pwned = p => p.evaluate(() => window.__pwned || 0);

{
  const gh = H.fakeGitHub({ files: { ...FILES }, repos: REPOS });
  gh.user.login = IMG;
  const ctx = await H.context(gh);
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 300);

  // pins, including a hostile pinned name
  await p.click('#btn-settings');
  await p.waitForSelector('#f-save:not([disabled])');
  t.check('hostile login shown as text', (await p.textContent('#who-login')) === '@' + IMG);
  await p.fill('#f-pins', `todo.md, ${IMG}.md, hasOwnProperty, ${SVG}-missing.md, ${IFR}-broken.md`);
  await p.click('#f-save');
  await H.settle(p, 500);
  t.check('hostile branch shown as text in the header', (await p.textContent('#crumb')).includes(BRANCH));
  await p.locator('#pin-tabs button').nth(2).click();
  await H.settle(p, 300);
  t.check('a pin named like an object property loads at once',
    (await p.textContent('#pin-list')).includes('awkward name'), await p.textContent('#pin-list'));
  await p.locator('#pin-tabs button').nth(0).click();

  const rows = await H.rows(p);
  t.check('hostile names listed as text', rows.includes(`${IMG}.md`) && rows.includes(`${SVG}.md`) &&
    rows.includes(IFR), JSON.stringify(rows));
  t.check('folders named like object properties are listed',
    ['constructor', '__proto__', 'notes'].every(n => rows.includes(n)), JSON.stringify(rows));
  await H.expand(p, '__proto__');
  await H.expand(p, 'constructor');
  const inner = await H.rows(p);
  t.check('and open', inner.includes('a.md') && inner.includes('b.md'), JSON.stringify(inner));
  await p.reload({ waitUntil: 'load' });
  await H.settle(p, 700);
  const again = await H.rows(p);
  t.check('and stay open after a reload', again.includes('a.md') && again.includes('b.md'), JSON.stringify(again));
  t.check('an untouched folder named like one stays closed', !again.includes('d.md'), JSON.stringify(again));
  await H.expand(p, '__proto__');
  t.check('and close again', !(await H.rows(p)).includes('b.md'));
  await H.expand(p, IFR);
  t.check('hostile folder opens', (await H.rows(p)).includes('inside.md'));
  await H.clickRow(p, 'inside.md');
  t.check('hostile folder is text in the header', (await p.textContent('#crumb .dir')) === IFR + '/');

  await p.fill('#filter', '<');
  await H.settle(p, 100);
  t.check('filter results render as text', (await H.rows(p)).length >= 3);
  await p.fill('#filter', '');

  t.check('pinned tasks render as text', (await p.textContent('#pin-list')).includes(`${IMG} task`));
  const tabs = await p.$$eval('#pin-tabs button', b => b.map(x => x.textContent));
  t.check('hostile pinned name is a text tab', tabs.includes(`${IMG}.md`), JSON.stringify(tabs));
  const pinTab = async i => { await p.locator('#pin-tabs button').nth(i).click(); await H.settle(p, 300); };
  await pinTab(2);
  t.check('a pin named like an object property loads', (await p.textContent('#pin-list')).includes('awkward name'));
  await pinTab(3);
  t.check('an empty hostile pin is named as text', (await p.textContent('#pin-list')).includes(`${SVG}-missing.md`),
    await p.textContent('#pin-list'));
  await p.route('https://api.github.com/**/contents/**', r => r.request().url().includes('broken')
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: IFR }) })
    : r.fallback());
  await pinTab(4);
  t.check("a pin's hostile error message is text", (await p.textContent('#pin-list')).includes(IFR),
    await p.textContent('#pin-list'));
  await pinTab(0);

  await H.clickRow(p, `${IMG}.md`);
  t.check('hostile file opens with its contents as text', (await H.editorValue(p)) === BODY);
  t.check('its name is text in the header', (await p.textContent('#crumb .name')) === `${IMG}.md`);

  await H.clickRow(p, `${IMG}.png`);
  t.check('refusing a hostile attachment names it as text', (await H.status(p)).includes(`${IMG}.png`));

  // A hostile error message from GitHub.
  await p.route('https://api.github.com/**/contents/**', r => r.request().method() === 'PUT'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: IMG }) })
    : r.fallback());
  await H.clickRow(p, 'inbox.md');
  await H.setEditor(p, 'changed');
  await H.settle(p, 60);
  await p.click('#btn-save');
  await H.settle(p, 400);
  t.check("GitHub's error message shown as text", (await H.status(p)).includes(IMG), await H.status(p));

  // A new note with a hostile name.
  p.removeAllListeners('dialog');
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(`${SVG}`) : d.accept());
  await p.click('#btn-new');
  await H.settle(p, 300);
  t.check('a hostile new name is text in the header', (await p.textContent('#crumb .name')) === `${SVG}.md`);

  await H.settle(p, 300);
  t.check('no payload element created anywhere', (await dangerous(p)) === 0, String(await dangerous(p)));
  t.check('no payload ever ran', (await pwned(p)) === 0, String(await pwned(p)));
  // The 500 above is logged on purpose, with its message; nothing else may be.
  const unexpected = p.errors.filter(e => !/status of 500|Error: <img src=x onerror/.test(e));
  t.check('no page errors', unexpected.length === 0, unexpected.join(' | '));
  await ctx.close();
}

/* ===== a hostile sign-in error comes back in the address bar ===== */
// Text from the address is never shown at all (N4), so it can neither run
// nor put words in the app's mouth.
{
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh);
  const p = await H.page(ctx, H.APP() + '?error=access_denied&error_description=' + encodeURIComponent(IMG));
  await H.settle(p, 300);
  t.check('error_description from the URL is never shown', !(await p.evaluate(() => document.body.innerText)).includes('onerror'));
  t.check('and never runs', (await pwned(p)) === 0 && (await dangerous(p)) === 0);
  await ctx.close();
}

await H.stop();
t.finish();
