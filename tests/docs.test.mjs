/* First-time readers should reach a note without deployment instructions. */
import { readFileSync, existsSync } from 'node:fs';
import * as H from './harness.mjs';
const t = H.suite('docs');
const root = new URL('../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
// Since the README was split (2026-09-27): the detailed guide and self-hosting live in docs/.
const guide = readFileSync(new URL('docs/guide.md', root), 'utf8');
const selfHosting = readFileSync(new URL('docs/self-hosting.md', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const deployment = JSON.parse(html.match(/<script type="application\/json" id="deployment">([\s\S]*?)<\/script>/)[1]);
const first = readme.match(/^## (.+)$/m)?.[1];
const intro = readme.split(/^## /m)[1] || '';
const firstNote = intro.split('\n3. ')[1]?.split('\n\n')[0] || '';
t.check('README opens with Try it', first === 'Try it');
// Moved to padgit.com (owner, 2026-09-30).
t.check('Try it links the shared app', /\]\(https:\/\/padgit.com\/\)/.test(intro));
t.check('a beginner reaches the first saved note', /GitHub account/.test(intro) && /Sign in with GitHub/.test(intro) &&
  /private repository/i.test(intro) && /New/.test(intro) && /Save/.test(intro));
t.check('a repository is explained and creation help is linked', /repository[^\n]*folder|folder[^\n]*repository/i.test(intro) &&
  /\]\(docs\/guide\.md#no-notes-repository-yet\)/.test(intro) && /^## No notes repository yet$/m.test(guide));
t.check('Try it explains owner trust and links privacy', /\]\(PRIVACY.md\)/.test(intro) &&
  /shared\s+copy's app has no private key/i.test(intro) && /taking their word/i.test(intro));
// N46: first steps for people who use AI tools but not GitHub.
t.check('Try it says how to get a free GitHub account', /free/i.test(intro) && /\]\(https:\/\/github\.com\/signup\)/.test(intro));
t.check('Try it says AI tools can use the notes', /\bAI\b/.test(intro));
t.check('the finished move to padgit.com is no longer announced in Try it', !/Notes is now \*\*Padgit\*\*/.test(intro));
t.check('the guide explains GitHub words for newcomers', /^## New to GitHub\?$/m.test(guide) &&
  /\*\*Repository\*\*/.test(guide) && /\*\*Commit\*\*/.test(guide) && /\*\*GitHub App\*\*/.test(guide));
// N43 (with N44): agents get standing instructions the person copies in; Padgit writes none.
{const sec=guide.split(/^## Using Padgit with agents$/m)[1]?.split(/^## /m)[0]||'';
 t.check('the guide has a sample AGENTS.md for agents', /`AGENTS\.md`/.test(sec) && /```markdown[\s\S]*Co-authored-by[\s\S]*```/.test(sec) && /never writes/i.test(sec), sec.slice(0,80));}
t.check('Try it links that explanation', /\]\(docs\/guide\.md#new-to-github\)/.test(intro));
t.check('Try it needs no developer setup', !/```|npx |npm |client secret|wrangler|register.*App/i.test(intro));
t.check('unfinished sign-in is stated before the shared link', !/REPLACE_ME/.test(deployment.broker) ||
  /not ready for sign-in[\s\S]*https:\/\/forwardmotionnz.github.io\/notes\//i.test(intro));
t.check('self-hosting and architecture follow user guidance', readme.indexOf('## How it fits together') > readme.indexOf('## What it does') &&
  readme.indexOf('](docs/self-hosting.md)') > readme.indexOf('## Try it') && !/^## Setup/m.test(readme) &&
  ['## 1. ', '## 2. Register a GitHub App', '## 3. Deploy the broker', '## 4. ', '## 5. Sign in'].every(h => selfHosting.includes(h)));
t.check('phone readers can find New behind Files', /Files[\s\S]*\*\*\+\*\*[\s\S]*New note/.test(intro));
t.check('the repository choice is saved before making a note', /choose your repository[^.]*Save[\s\S]*Files/i.test(firstNote));

// Markdown templates require name/about in YAML frontmatter on the default branch:
// https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates
const bugPath = new URL('.github/ISSUE_TEMPLATE/bug_report.md', root);
const bug = existsSync(bugPath) ? readFileSync(bugPath, 'utf8') : '';
t.check('a recognised Markdown bug template exists', /^---\r?\nname: Bug report\r?\nabout: [^\r\n]+\r?\n---/.test(bug));
for (const heading of ['Device', 'Browser', 'Steps to reproduce', 'Expected result', 'Actual result']) {
  t.check(`bug report asks for ${heading.toLowerCase()}`, new RegExp(`^## ${heading}$`, 'm').test(bug));
}
t.check('browser version and home-screen context can be reported', /version/.test(bug) && /home.screen/i.test(bug));
t.check('public reports keep notes and credentials private', /reports are public/i.test(bug) &&
  /Do not include private notes, passwords, tokens/.test(bug) && /made.up example/i.test(bug));
t.check('README links the report template', /\]\(\.github\/ISSUE_TEMPLATE\/bug_report.md\)/.test(readme));
t.check('readers can find where to submit their report', /\]\(https:\/\/github.com\/forwardmotionnz\/notes\/issues\/new\)/.test(readme));

const changePath = new URL('CHANGELOG.md', root);
const changes = existsSync(changePath) ? readFileSync(changePath, 'utf8') : '';
const ledger = readFileSync(new URL('docs/dev/MVP.md', root), 'utf8');
t.check('changelog has the first versioned MVP entry', /^## 1\.0\.0 — 2026-09-29$/m.test(changes));
t.check('MVP entry describes the implemented user features', /autosave/i.test(changes) && /drafts/i.test(changes) &&
  /rename/i.test(changes) && /delete/i.test(changes) && /wikilinks/i.test(changes) && /home.screen/i.test(changes));
t.check('known limitations include network and file limits', /### Known limitations/.test(changes) &&
  /no offline sync/i.test(changes) && /1 MB/.test(changes) && /Git LFS/.test(changes) && /partial file list/i.test(changes));
// Since N14 a conflict offers Save as copy; Discard must still be named as dropping your text.
t.check('draft recovery guidance names the destructive actions', /\*\*Discard\*\*[^.]*drops yours/.test(changes) &&
  /Sign out[^.]*removes[\s\S]*drafts/.test(changes));
t.check('sign-out scope includes each independent session-only tab', /current tab's\s+session.only drafts/.test(changes) &&
  /sign out in each session.only tab separately/i.test(changes));
t.check('phone limitations and owner-reported completion are explicit', /iPhone or iPad[\s\S]*separate[\s\S]*drafts/.test(changes) &&
  /owner reported the real.phone[\s\S]*checks completed on 2026-09-27/i.test(changes));
t.check('F2 remains an explicit release blocker', !/\| F2 \|[^\n]*\| blocked \|/.test(ledger) ||
  /WebKit[\s\S]*blocked[\s\S]*release gate has not passed/i.test(changes));
t.check('unfinished shared sign-in names the owner setup', !/REPLACE_ME/.test(deployment.broker) ||
  /owner[\s\S]*broker[\s\S]*GitHub App/.test(changes));
t.check('release status and privacy have working local links', /\]\(docs\/dev\/MVP.md\)/.test(changes) && /\]\(PRIVACY.md\)/.test(changes));
t.check('README links the changelog', /\]\(CHANGELOG.md\)/.test(readme));
t.check('configured public deployment is not presented as awaiting account setup', /sign-in is configured/.test(intro) &&
  /GitHub App is public/.test(intro) && !/not ready for sign-in|needs to connect/.test(intro) &&
  !/still needs to configure the broker|Shared sign-in is disabled/.test(changes));
t.check('owner checklist records public App setup as complete', /GitHub App visibility[^\n]*complete/i.test(ledger));

// ===== ready for the community (2026-09-27) =====
t.check('no personal example account in the docs', ![readme, guide, selfHosting].some(d => /roldaof/i.test(d)),
  'use YOUR-USERNAME');
t.check('the README stays a short front door', readme.split('\n').length < 150, String(readme.split('\n').length));
t.check('no internal status at the top of the README', !/MVP|the owner has reported/i.test(readme.split('## Try it')[0] + intro));
const contributing = readFileSync(new URL('CONTRIBUTING.md', root), 'utf8');
const security = readFileSync(new URL('SECURITY.md', root), 'utf8');
t.check('CONTRIBUTING has the design rules and how to test', /## Design rules/.test(contributing) && /npm run test:dev/.test(contributing) &&
  /Never weaken, skip or delete a test/.test(contributing));
t.check('SECURITY asks for private reports', /Report a\s+vulnerability/.test(security) && /do not open a public issue/i.test(security));
t.check('a feature request template exists', /^---\r?\nname: Feature request\r?\nabout: [^\r\n]+\r?\n---/.test(
  existsSync(new URL('.github/ISSUE_TEMPLATE/feature_request.md', root)) ? readFileSync(new URL('.github/ISSUE_TEMPLATE/feature_request.md', root), 'utf8') : ''));
t.check('a pull request template exists', existsSync(new URL('.github/pull_request_template.md', root)));
// Every relative link in the documentation leads somewhere: the file, and the
// heading when there is a #fragment (GitHub's heading anchors).
const slug = h => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
const docs = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'PRIVACY.md', 'CHANGELOG.md', 'docs/guide.md', 'docs/self-hosting.md',
  'docs/dev/README.md', '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bug_report.md'];
const broken = [];
for (const doc of docs) {
  const text = readFileSync(new URL(doc, root), 'utf8');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [file, frag] = target.split('#');
    const to = file ? new URL(file, new URL(doc, root)) : new URL(doc, root);
    if (!existsSync(to)) { broken.push(`${doc} -> ${target}`); continue; }
    if (frag && to.pathname.endsWith('.md')) {
      const heads = [...readFileSync(to, 'utf8').matchAll(/^#{1,6} (.+)$/gm)].map(m => slug(m[1]));
      if (!heads.includes(frag)) broken.push(`${doc} -> ${target}`);
    }
  }
}
t.check('every relative link in the docs works', broken.length === 0, broken.join(', '));
t.finish();
