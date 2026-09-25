---
description: Take one item from the MVP ledger through the full gauntlet, commit it, and stop.
argument-hint: "[optional: a ledger item ID to work on, e.g. C1]"
---

# Gauntlet: get `notes` to a shareable MVP

You are working on `notes`, a markdown notes app in one HTML file, backed by
the user's own GitHub repository. The goal of this loop is an MVP that the
owner can hand to other people with a link and no setup on their side.

Each run of this command does **one** item, all the way through the gauntlet
below, then stops. Progress lives in `MVP.md` at the repo root, so any fresh
session can pick up where the last one left off. If `$ARGUMENTS` names an item
ID, work on that item; otherwise take the next one by priority.

Write in British English. Keep it simple: the smallest change that meets the
criterion, nothing extra.

---

## Where things stand

Read these before touching anything: `README.md`, `index.html` (the app),
`broker/worker.js` (token broker), `tests/harness.mjs` (simulated GitHub).

Already done and tested:

- Sign in with GitHub through a GitHub App, PKCE and state, repo picker from
  the app's installations, 8-hour tokens with single-use refresh tokens,
  cross-tab refresh lock, session-only mode for shared computers.
- A stateless Cloudflare Worker broker holding the client secret, origin-locked.
- Folder tree, editor (CodeMirror with plain textarea fallback), one commit per
  save with SHA-based conflict detection, pinned files as task lists.
- Obsidian vault support: dot-folders hidden, binary attachments refused,
  wikilinks and frontmatter preserved byte for byte.
- `npm test`: four suites (broker, auth, app, vault) in headless Chromium
  against a simulated GitHub that runs the real broker code.

## Rules that do not bend

1. **One app file, no build step.** `index.html` is the app. No bundler, no
   framework, no transpiler. A runtime library may only come from a CDN, and
   the app must still work (degraded, with a visible notice) if it fails to
   load. Dev dependencies for tests are fine.
2. **The repository is the model.** Paths are paths, filenames are titles. No
   IDs, no required frontmatter, no app-specific files written into the user's
   repo. Everything the app does is an ordinary git change another editor
   would understand.
3. **GitHub-specific code stays in the `PROVIDER` and `AUTH` sections.**
4. **No telemetry, analytics, or third-party requests** beyond GitHub, the
   broker and the CDN. The broker stores and logs nothing.
5. **Never weaken, skip or delete a test to get green.** If a test is wrong,
   say why in the ledger, fix it, and show it now fails for the right reason.
6. **The fake GitHub must match the real one.** Any GitHub API behaviour you
   add to `tests/harness.mjs` must be checked against GitHub's documentation
   first (fetch the page), with the URL in a comment beside it. A fake that
   drifts from reality makes every test a lie.
7. **Human-only actions.** Never do these; write the exact steps into the
   ledger under `## Needs the owner` and continue with other work:
   changing GitHub App settings, deploying the broker or setting its secrets,
   anything that needs a password or token, pushing to `main`, force-pushing,
   deleting branches.
8. **Git.** Work on the `mvp` branch (create it from `main` if missing). One
   item per commit. Push `mvp` if a remote exists. Never touch `main`.

## What MVP means

The loop is done when every **MUST** below is checked in `MVP.md` with
evidence, the release gate has passed, and the owner has only the items in
`## Needs the owner` left. **SHOULD** items are done only after every MUST, and
only if each fits in a single iteration.

### A. Someone else can use it with only a GitHub account
- **A1 MUST** Works as one shared deployment: a new user signs in, installs
  the owner's GitHub App on their own repository, and writes a note. No App
  registration or broker of their own. Cover personal and organisation
  installations, several installations at once, and repository lists longer
  than one page (paginate).
- **A2 MUST** The signed-out screen says, in three short sentences or fewer,
  what the app is, what access it asks for (only the repositories you choose,
  contents read and write), and that notes stay in their repo. Links to the
  privacy note.
- **A3 MUST** `PRIVACY.md`: what the broker sees (sign-in codes and tokens in
  transit, never stored or logged), what the browser stores and where, how to
  revoke access on GitHub, and how to self-host instead. Plain language.

### B. First run for someone who has never set up a notes repo
- **B1 MUST** An empty repository (no commits) works: the app notices, says
  so, and creating the first note creates the default branch.
- **B2 MUST** App installed on no repositories: one clear path to create a
  repository on GitHub and then choose it, with nothing else on screen
  competing for attention.
- **B3 MUST** Read-only, archived or unreachable repositories give a clear
  message instead of a failed save.

### C. Nobody ever loses what they typed
- **C1 MUST** Unsaved edits survive a reload, a closed tab, and a phone
  switching apps: a local draft per file, restored with a visible notice, and
  cleared once committed. In session-only mode drafts live in session storage.
  Sign out removes all drafts.
- **C2 MUST** Autosave: commits after a short idle pause and when the page is
  hidden, without committing on every keystroke. A conflict stops autosave for
  that file, keeps the draft, and tells the user. The Save button remains.
- **C3 MUST** Switching files never needs a blocking `confirm()` to be safe.

### D. Basic file operations
- **D1 MUST** Rename and move a file. It must not leave both copies or lose the
  file if a request fails midway (a single commit via the Git Data API is one
  way).
- **D2 MUST** Delete a file, with a confirmation that says it can be recovered
  from the repository's history.

### E. Obsidian users feel at home
- **E1 MUST** `[[Wikilink]]` and `[[Wikilink|alias]]` open the target note:
  Ctrl/Cmd-click on desktop, tap on a phone. Resolve by filename,
  case-insensitive, preferring the shortest path, as Obsidian does. An
  unresolved link offers to create the note.

### F. Phones
- **F1 MUST** A web app manifest and icon, so Add to Home Screen gives a proper
  name, icon and standalone window. Inline or as small files in the repo root;
  no service worker required.
- **F2 MUST** The whole suite also passes in **WebKit** (iOS runs Safari's
  engine). Parameterise the harness by browser; `npm test` runs both.
- **F3 MUST** On a 390 px screen with the keyboard up, the caret stays visible
  while typing and the header buttons stay reachable.

### G. Safe enough to hand to strangers
- **G1 MUST** A Content Security Policy that stops an injected script from
  sending data anywhere except GitHub and the broker (`connect-src`,
  `img-src`, `form-action`, `base-uri`). Prove it with a test that injects a
  request to a third-party host and sees it blocked. Document that forks must
  update it when they change the broker.
- **G2 MUST** Every `innerHTML` and every place user or repo content reaches
  the DOM is either removed or shown to be safe in a comment. File names and
  note contents must never execute. Add a test with hostile file names.
- **G3 MUST** Network failures, GitHub outages and rate limits give a human
  message and a way to retry, never a stack trace or a silent failure.

### H. People can try it and tell you what broke
- **H1 MUST** README opens with a "Try it" section for non-developers: the
  link, three steps, what they will be asked on GitHub. Self-hosting moves to
  its own section further down.
- **H2 MUST** `.github/ISSUE_TEMPLATE/bug_report.md` asking for device,
  browser, and what they expected.
- **H3 MUST** `CHANGELOG.md` with an MVP entry and a short known-limitations
  list.

### SHOULD (only after every MUST)
- **S1** Rendered preview toggle, sanitised, library from CDN with fallback.
- **S2** Search inside note contents, not only paths.
- **S3** Automated accessibility check (axe) with zero serious violations.
- **S4** Images referenced in a note shown in the preview.

### Out of scope for MVP (do not build)
Offline sync queue, backlinks, graph view, plugins, real-time collaboration,
attachment upload, native apps, user accounts or any database, a service
worker.

---

## The ledger: `MVP.md`

If it does not exist, create it on the first run from the criteria above:

```markdown
# MVP ledger

Iterations: 0 / 30

## Items
| ID | Priority | Status | Evidence |
|----|----------|--------|----------|
| C1 | 1 | todo | |
...

## Needs the owner
(exact steps for human-only actions)

## Decisions
(date, decision, why)

## Log
(one line per iteration: date, item, result, commit)
```

Status is one of `todo`, `doing`, `done`, `blocked`. `done` needs evidence:
test names, screenshot paths, and the commit hash. No evidence, not done.

**Priority order**, by what hurts most if it goes wrong: C1, C2, C3, G2, G1,
B1, B3, A1, D1, D2, E1, B2, A2, A3, F2, F1, F3, G3, H1, H2, H3, then SHOULDs.
Earlier items that turn out to depend on later ones: note it and reorder in the
ledger.

---

## One iteration

### 0. Orient
- Read `MVP.md`, `git log --oneline -15`, and `git status`. Increment the
  iteration counter.
- If the counter passes 30, stop: write a status report in the ledger and end.
- Run `npm test`. If it is red and the cause is not an item in progress, fixing
  it is this iteration's item.

### 1. Pick one item
Take `$ARGUMENTS` if given, otherwise the highest-priority `todo` item whose
dependencies are done. Mark it `doing`. Write two lines in the ledger: what
done looks like for this item, and how you will prove it.

### 2. Test first
Write the test in the style of the existing suites. Run it and see it fail for
the right reason. If it passes already, the test is not testing the item.

### 3. Build
The smallest change that makes it pass. Match the file's existing style and
comment the why, not the what.

### 4. The gauntlet
Every gate must pass. If one fails, go back to step 3. If the same item fails
the gauntlet three times, mark it `blocked` with a diagnosis and stop the
iteration.

**G-1 Green, three times, two engines.** The full suite passes three runs in a
row in Chromium, and in WebKit once F2 is done. Flaky is failing.

**G-2 Break it on purpose.** For every check you added that protects data,
security or sign-in, revert that check alone and confirm at least one test
fails. Restore it and confirm `git diff` shows only your intended change. A
safeguard no test notices is not tested.

**G-3 Adversarial review.** Spawn a fresh subagent that has not seen your
work, with this prompt, filling in the brackets:

> You are reviewing a change to a notes app that stores people's private notes
> in their GitHub repositories and holds their GitHub tokens in the browser.
> Item: [ID and criterion]. See the change with `git diff HEAD -- . ':!MVP.md'`
> and `git status --short` (new files), and read the changed files in full. Find ways this change can lose or
> corrupt someone's notes, leak or misuse their token, sign them out wrongly,
> break on iOS Safari or a slow phone network, or confuse a first-time user.
> For each finding give the exact steps that trigger it and what goes wrong.
> Do not report style preferences or hypotheticals without a concrete
> trigger. If you find nothing, say so.

For each finding, either fix it (with a test) or refute it with evidence in the
ledger. Not "probably fine": evidence.

**G-4 Look at it.** Screenshot desktop (1280 wide) and phone (390 wide) in
light and dark wherever the change is visible, open the images, and check:
nothing overflows, text is legible, the new thing is findable by someone who
has never seen the app. Save them under `tests/screens/` (git-ignored) and
list the paths in the ledger.

**G-5 Rules.** No build step, no new runtime dependency without a fallback, no
third-party requests, `index.html` under 150 KB, and no text in the app that
contradicts the README.

**G-6 Docs.** If behaviour a user would notice changed, README, PRIVACY or
CHANGELOG say so.

### 5. Commit and record
- One commit for the item, message `ID: what changed and why`, with the
  project's usual co-author trailer.
- Push `mvp` if a remote exists.
- Mark the item `done` with evidence. Add a line to the log. Record any
  decision you made in `## Decisions`.

### 6. Report and stop
Reply with at most six lines: the item, the gates, anything the reviewer
found, the commit, anything newly added to `## Needs the owner`, and the next
item. Then stop. One item per run.

---

## The release gate

When every MUST is `done`, the next run is the release gate instead of an item:

1. Full suite, three runs, both engines.
2. **Whole-app review:** spawn a fresh subagent with the G-3 prompt, but over
   the entire codebase instead of a diff, and with the MVP criteria attached.
   Fix or refute every finding.
3. Walk through the first-run journey in the simulated GitHub as a brand new
   user on a phone viewport, screenshotting each step. Would someone who has
   never used GitHub Apps get through it? Fix what trips them.
4. Write `RELEASE_CHECKLIST.md`: the smoke test the owner runs on real GitHub
   before sharing. At minimum: a second GitHub account signing in from a phone;
   an empty repository; an organisation repository; an Obsidian vault with
   attachments; session-only mode on a second browser; revoking the app on
   GitHub and seeing a clean sign-out; two tabs left open overnight.
5. Add the owner's release steps to `## Needs the owner`: make the GitHub App
   public and installable on any account, redeploy the broker if it changed,
   review and merge `mvp` into `main`, run the checklist.
6. Report: what shipped, what is left for the owner, known limitations. Stop.

The loop is finished. Do not start SHOULD items unless asked.
