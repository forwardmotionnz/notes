/* The signed-out screen: what this is, what it asks for, where notes live. */
import { existsSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('welcome');
await H.start();

for (const [w, h, label] of [[1280, 820, 'desktop'], [390, 780, 'phone'], [320, 600, 'small phone']]) {
  const gh = H.fakeGitHub();
  const ctx = await H.context(gh, { viewport: { width: w, height: h } });
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
