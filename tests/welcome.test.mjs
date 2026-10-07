/* The signed-out screen: what this is, what it asks for, where notes live. */
import { existsSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('welcome');
await H.start();

for (const [w, h, label] of [[1280, 820, 'desktop'], [390, 780, 'phone'], [320, 600, 'small phone']]) {
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { viewport: { width: w, height: h } });
  const shots = [];
  ctx.on('request', r => { if (/screenshot\.png/.test(r.url())) shots.push(r.url()); });
  const p = await H.page(ctx);
  await p.waitForSelector('#f-signin:not([disabled])');
  const about = (await p.textContent('#about')).replace(/\s+/g, ' ').trim();
  if (label === 'desktop') {
    const sentences = about.replace(/\bPrivacy\b\.?$/, '').split(/(?<=[.!?])\s+/).filter(s => /\w/.test(s));
    t.check('three sentences at most', sentences.length >= 1 && sentences.length <= 3, JSON.stringify(sentences));
    t.check('each of them short', sentences.every(s => s.split(' ').length <= 20), JSON.stringify(sentences));
    t.check('it says what the app is', /markdown/i.test(about) && /notes/i.test(about) && /GitHub/.test(about), about);
    // Not "only the repositories you choose": an organisation may install it
    // for its members (PRIVACY.md, What GitHub sees).
    t.check('what access it asks for: only repositories the app is installed on, which you choose',
      /only in repositories the app is installed on, which you choose/i.test(about), about);
    t.check('and only their contents, read and write', /read and write/i.test(about) && /files|contents/i.test(about), about);
    t.check('that notes stay in their repository', /notes stay there/i.test(about), about);
    // PRIVACY.md, Who you are trusting: the app's owner can use its access directly.
    t.check("and, as PRIVACY.md says, that whoever runs this copy's App can reach them",
      /whoever runs this copy's GitHub App can reach them/i.test(about), about);
    // N46: for people who use AI tools but have never used GitHub.
    t.check('it says AI tools can use the notes too', /\bAI\b/.test(about), about);
    const su = await p.$('#signup');
    t.check('no GitHub account: a link to make one, free', !!su && await su.isVisible() && /free/i.test(await p.textContent('#signup-line')) &&
      (await su.getAttribute('href')) === 'https://github.com/signup' && (await su.getAttribute('target')) === '_blank' &&
      /noopener/.test(await su.getAttribute('rel')), su ? await p.textContent('#signup-line') : 'missing');
    t.check('below the sign-in button, so signing in stays first', !!su && await p.evaluate(() =>
      !!(document.getElementById('f-signin').compareDocumentPosition(document.getElementById('signup')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    const a = await p.$('#about a');
    t.check('it links the privacy note', !!a && /privacy/i.test(await a.textContent()));
    // GitHub Pages publishes PRIVACY.md as PRIVACY.html (jekyll-optional-front-matter, on by default):
    // https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll#plugins
    t.check('at the address GitHub Pages publishes it, beside the app', a && (await a.getAttribute('href')) === 'PRIVACY.html' &&
      existsSync(new URL('../PRIVACY.md', import.meta.url)));
    t.check('in a new tab, so the sign-in screen stays', a && (await a.getAttribute('target')) === '_blank' &&
      /noopener/.test(await a.getAttribute('rel')));
    t.check('Sign in has the focus, so Enter signs in rather than opening the note',
      (await p.evaluate(() => document.activeElement.id)) === 'f-signin', await p.evaluate(() => document.activeElement.id));
    t.check('"Forget me" promises no more than PRIVACY.md does', !/nothing is kept on disk/i.test(await p.textContent('#view-signin')) &&
      /sign out before you leave/i.test(await p.textContent('#view-signin')));
    t.check('above the sign-in button', await p.evaluate(() =>
      !!(document.getElementById('about').compareDocumentPosition(document.getElementById('f-signin')) &
         Node.DOCUMENT_POSITION_FOLLOWING)));
    // N47: what Padgit is, before asking for access.
    const how = await p.$('#how');
    t.check('How it works is offered, folded, below Sign in', !!how && !(await how.evaluate(d => d.open)) && await p.evaluate(() =>
      !!(document.getElementById('f-signin').compareDocumentPosition(document.getElementById('how')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    t.check('its picture is not downloaded until opened', !shots.length, JSON.stringify(shots));
    if (how) {
      await p.click('#how summary');
      await p.waitForFunction(() => { const i = document.querySelector('#how img'); return i && i.complete && i.naturalWidth > 0; });
      const alt = await p.getAttribute('#how img', 'alt');
      t.check('opened, it shows what Padgit looks like, described for screen readers', shots.length === 1 && /notes/i.test(alt || ''), alt);
      const steps = await p.$$eval('#how ol li', l => l.map(x => x.textContent));
      t.check('and the three steps', steps.length === 3 && /sign in/i.test(steps[0]) && /private repository/i.test(steps[1]) && /file/i.test(steps[2]), JSON.stringify(steps));
    }
    const links = await p.$$eval('#signin-links a:not([hidden])', l => l.map(a => [a.textContent, a.getAttribute('href'), a.target, a.rel]));
    t.check('links for checking it out: guide, source code, running your own copy', JSON.stringify(links.map(l => [l[0], l[1]])) === JSON.stringify([
      ['Guide', 'docs/guide.html'], ['Source code', 'https://github.com/forwardmotionnz/notes'], ['Run your own copy', 'docs/self-hosting.html']]), JSON.stringify(links));
    t.check('each in a new tab, at a page that exists', links.every(l => l[2] === '_blank' && /noopener/.test(l[3])) &&
      existsSync(new URL('../docs/guide.md', import.meta.url)) && existsSync(new URL('../docs/self-hosting.md', import.meta.url)));
  }
  const fits = await p.evaluate(() => {
    const d = document.getElementById('settings').getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth && d.left >= 0 && d.right <= innerWidth &&
      document.getElementById('f-signin').getBoundingClientRect().bottom <= innerHeight;
  });
  t.check(`${label}: it fits, with the sign-in button in view`, fits);
  t.check(`${label}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

await H.stop();
t.finish();
