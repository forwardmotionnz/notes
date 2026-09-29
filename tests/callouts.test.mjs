/* N29: Obsidian callouts render as titled boxes in Preview; the note's text is untouched. */
import * as H from './harness.mjs';
const t = H.suite('callouts'); await H.start();
const NOTE = [
  '# Garden',
  '',
  '> [!tip] Water early',
  '> The soil dries out by **midday**.',
  '',
  '> [!warning]',
  '> Frost tonight.',
  '',
  '> [!faq]- Why raised beds?',
  '> Better drainage.',
  '',
  '> [!example]+ Open by default',
  '> - one',
  '> - two',
  '',
  '> [!custom] Your own kind',
  '> Still a callout.',
  '',
  '> [!note] <img src=x onerror="window.__pwned=1"> **Bold** title',
  '> See [[Seeds]].',
  '',
  '> An ordinary quote.',
  '',
  '> [!info] Outer',
  '> > [!danger] Inner',
  '> > Careful.',
  '',
].join('\n');
const gh = H.fakeGitHub({ files: { 'Garden.md': NOTE, 'Seeds.md': '# Seeds\n' } });
const c = await H.context(gh), p = await H.page(c); p.setDefaultTimeout(5000);
await H.signIn(p); await p.waitForFunction(() => treeState === 'ok');
const commits = gh.commits.length;
await H.preview(p, 'Garden.md');
const boxes = await p.$$eval('#preview .callout', els => els.map(e => ({
  tag: e.localName, cls: e.className, kind: e.getAttribute('data-callout'), open: e.localName === 'details' ? e.open : null,
  title: e.querySelector(':scope > .callout-title').textContent.trim(), body: e.querySelector(':scope > .callout-body').textContent.trim() })));
const find = kind => boxes.find(b => b.kind === kind) || {};
t.check('a callout becomes a box with its title and text', find('tip').cls === 'callout callout-tip' && find('tip').title === 'Water early' &&
  find('tip').body === 'The soil dries out by midday.', JSON.stringify(find('tip')));
t.check('formatting in the text stays', await p.locator('#preview .callout-tip .callout-body strong').textContent() === 'midday');
t.check('with no title, the kind is the title', find('warning').title === 'Warning' && find('warning').body === 'Frost tonight.', JSON.stringify(find('warning')));
t.check('an alias takes its kind\'s look', find('faq').cls === 'callout callout-question');
t.check('"-" folds shut', find('faq').tag === 'details' && find('faq').open === false && find('faq').title === 'Why raised beds?');
t.check('"+" folds open', find('example').tag === 'details' && find('example').open === true && find('example').body.includes('one'));
t.check('a folded callout opens when its title is clicked', await (async () => {
  await p.locator('#preview details.callout-question summary').click();
  return p.locator('#preview details.callout-question').evaluate(d => d.open);
})());
t.check('an unknown kind still shows, as a note', find('custom').cls === 'callout callout-note' && find('custom').title === 'Your own kind');
t.check('markup in a title never runs', await p.evaluate(() => !window.__pwned) && await p.locator('#preview .callout img').count() === 0 &&
  await p.locator('#preview .callout-note .callout-title strong').first().textContent() === 'Bold');
t.check('wikilinks inside a callout still open notes', await p.locator('#preview .callout a', { hasText: 'Seeds' }).count() === 1);
t.check('an ordinary quote stays a quote', await p.locator('#preview blockquote').count() === 1 &&
  (await p.locator('#preview blockquote').textContent()).trim() === 'An ordinary quote.');
t.check('callouts nest', find('danger').title === 'Inner' && await p.locator('#preview .callout-note .callout-danger').count() === 1);
t.check('a plain callout is announced as a note', await p.locator('#preview div.callout-tip').getAttribute('role') === 'note');
t.check('the note itself is never changed', gh.files['Garden.md'] === NOTE && gh.commits.length === commits && await p.isDisabled('#btn-save'));
await p.click('#btn-preview');
t.check('Edit still shows the Markdown as written', (await H.editorValue(p)) === NOTE);
t.check('no page errors', p.errors.length === 0, p.errors.join(' | '));
await c.close(); await H.stop(); t.finish();
