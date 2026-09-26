/* First-time readers should reach a note without deployment instructions. */
import { readFileSync, existsSync } from 'node:fs';
import * as H from './harness.mjs';
const t = H.suite('docs');
const root = new URL('../', import.meta.url);
const readme = readFileSync(new URL('README.md', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const first = readme.match(/^## (.+)$/m)?.[1];
const intro = readme.split(/^## /m)[1] || '';
const firstNote = intro.split('\n3. ')[1]?.split('\n\n')[0] || '';
t.check('README opens with Try it', first === 'Try it');
t.check('Try it links the shared app', /\]\(https:\/\/forwardmotionnz.github.io\/notes\/\)/.test(intro));
t.check('a beginner reaches the first saved note', /GitHub account/.test(intro) && /Sign in with GitHub/.test(intro) &&
  /private repository/i.test(intro) && /New/.test(intro) && /Save/.test(intro));
t.check('a repository is explained and creation help is linked', /repository[^\n]*folder|folder[^\n]*repository/i.test(intro) &&
  /\]\(#no-notes-repository-yet\)/.test(intro));
t.check('Try it explains owner trust and links privacy', /\]\(PRIVACY.md\)/.test(intro) &&
  /app's owner\s+also has access through that installation/i.test(intro));
t.check('Try it needs no developer setup', !/```|npx |npm |client secret|wrangler|register.*App/i.test(intro));
t.check('unfinished sign-in is stated before the shared link', !/REPLACE_ME/.test(html) ||
  /not ready for sign-in[\s\S]*https:\/\/forwardmotionnz.github.io\/notes\//i.test(intro));
t.check('self-hosting and architecture follow user guidance', readme.indexOf('## Setup') > readme.indexOf('## What it does') &&
  readme.indexOf('## How it fits together') > readme.indexOf('## What it does'));
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
const ledger = readFileSync(new URL('MVP.md', root), 'utf8');
t.check('changelog has an unreleased MVP entry', /^## Unreleased — MVP candidate$/m.test(changes));
t.check('MVP entry describes the implemented user features', /autosave/i.test(changes) && /drafts/i.test(changes) &&
  /rename/i.test(changes) && /delete/i.test(changes) && /wikilinks/i.test(changes) && /home.screen/i.test(changes));
t.check('known limitations include network and file limits', /### Known limitations/.test(changes) &&
  /no offline sync/i.test(changes) && /1 MB/.test(changes) && /Git LFS/.test(changes) && /partial file list/i.test(changes));
t.check('draft recovery guidance names the destructive actions', /copy your latest text before using \*\*Discard\*\*/.test(changes) &&
  /Sign out[^.]*removes[\s\S]*drafts/.test(changes));
t.check('sign-out scope includes each independent session-only tab', /current tab's\s+session.only drafts/.test(changes) &&
  /sign out in each session.only tab separately/i.test(changes));
t.check('phone limitations do not claim a real-device pass', /iPhone or iPad[\s\S]*separate[\s\S]*drafts/.test(changes) &&
  /real.phone[\s\S]*still pending/i.test(changes));
t.check('F2 remains an explicit release blocker', !/\| F2 \|[^\n]*\| blocked \|/.test(ledger) ||
  /WebKit[\s\S]*blocked[\s\S]*release gate has not passed/i.test(changes));
t.check('unfinished shared sign-in names the owner setup', !/REPLACE_ME/.test(html) ||
  /owner[\s\S]*broker[\s\S]*GitHub App/.test(changes));
t.check('release status and privacy have working local links', /\]\(MVP.md\)/.test(changes) && /\]\(PRIVACY.md\)/.test(changes));
t.check('README links the changelog', /\]\(CHANGELOG.md\)/.test(readme));
t.finish();
