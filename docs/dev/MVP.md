# MVP ledger

Iterations: 47 (cap extended by the owner's requests; current batch N17 and N28)

## Current handover — 2026-09-29

The requested next two features are N17 backlinks (`783c719`) and N28 heading
outline. Both are implemented and independently reviewed, with mutation tests
and inspected desktop/phone light/dark screenshots. Focused results: backlinks
13/13, outline 36/36, preview 15/15, tags 53/53, pins-sync 54/54, wikilinks 47/47
and accessibility 57/57 in both engines. Final merge validation is the full
61-suite CI run on the combined PR. Next by priority is N29 callouts, then N30
recently deleted notes. N34 still needs the owner's coordinated domain cutover.

### Previous batch handover — 2026-09-29 (merged in PR #20)

The requested next four are implemented: N16 image upload (`c8f2e48`),
N33 open tabs (`0d1c7ce`), N26 shared reader/Recent (`9eb3878`) and N27 tags.
Each has focused Chromium/WebKit checks, a fresh independent review,
mutation checks and inspected desktop/phone light/dark screenshots.
N27 passes 53/53 in both engines, including real CodeMirror and fallback Undo,
unsafe-YAML refusals, BOM/CRLF/draft preservation, bounded scan and scope races.
All 59 suites passed in both engines; PR #20 merged as `b60a541` and published.
Next by priority after this batch is N17 backlinks. N34's domain/account
cutover remains owner-only and outside this batch.

### Previous batch handover — 2026-09-29 (merged in PR #19)

The requested four-item batch is N22 note navigation/bookmarks, N23 reading
width/text size, N32 editable checklists in Preview, then N25 formatting.
The first three are committed as `40fe608`, `22359a0`, and `15a9c9d`.
All four are implemented and independently reviewed. The final combined PR
runs all 55 suites in both engines before merge. Next by priority is N16,
adding images to a note.
N34 stays doing until its owner-only name/domain/account cutover; the old URL
is intentionally still the working Try it link.

Focused checks cover real CodeMirror and its plain-text fallback. N25 passes
52/52 in each engine, including native Undo, selection boundaries, literal
backticks/brackets, initial blank lines, draft recovery and read-only mode.
Related keyboard-editor 24/24, quick-switcher 19/19 and axe 45/45 pass in both
engines. Desktop/phone light/dark screenshots were inspected for every item.
Mutations of navigation scope, checklist read-only/subtree handling and
formatting selection replacement all caused the intended assertions to fail.

N32's old Tasks tests now exercise the retained transition helper or visible
Preview/Edit controls; source-save and race assertions remain intact. Two
release-races calls previously awaited an intentionally held request, causing
a test deadlock; they now launch the operation without awaiting that gate.
The complete release-races suite passes 14/14 in both engines. Development
used focused suites rather than repeated full runs.

The first full CI run caught a missing refusal message for an unreadable pin;
Preview now shows the read error, with stale-read guards. The existing large
file overwrite protections still pass (large 20/20 both engines). Two Padgit
URL assertions now allow the note bookmark fragment while retaining exact
origin/path and OAuth redirect checks (11/11). Hostile content checks open
the pin's Preview and assert sanitised task text and no executable elements,
instead of expecting raw HTML to be displayed as literal text (28/28). These
three focused suites pass in both engines; the corrected PR repeats full CI.
That repeat exposed an error-rendering regression under rate limiting: the
shared task capture must be detached before replacing Preview contents, or
its recovered text field disappears. The node is now preserved, and the
capture-recovery fixture keeps the rate limit active until explicitly reset,
instead of depending on completing within one second. Capture recovery 6/6,
checklists 20/20 and large files 20/20 pass in both engines; review is clear.

Linux WebKit 1.56 repeatedly crashed on the navigation reload test. Playwright
documents the matching regression and its 1.57 fix in
[upstream issue 37766](https://github.com/microsoft/playwright/issues/37766).
The test dependency is upgraded to 1.57.0, retaining every reload assertion.
Before updating the lockfile, comparison with Git confirmed the pre-existing
local difference was line endings only; its original bytes are backed up in
the ignored `tests/screens/package-lock-before-browser-update.json`.
With the fixed browser, all new feature suites passed on Linux. An older
auth-renewal sign-out wait dereferenced the Settings dialog while the reload
briefly had no document; it now waits for the element to exist and be open.
Storage-clearing, sign-in visibility and other-tab sign-out assertions remain.

The original SHOULD list was completed and merged in PR #9. Older handover
details below are historical, including the pre-merge S3/S4 wording.

### Earlier handover — 2026-09-27

N12 preview and S2 search were merged and published in
[PR #8](https://github.com/forwardmotionnz/notes/pull/8), with all 39 suites green.
S3 accessibility and S4 repository images are now implemented on
`codex/accessibility-images`; the original feature list is complete.
The combined PR's full two-engine checks remain the final merge gate.

Account setup is complete. The reconciled MVP and faster development
workflow were merged into `main` in [PR #5](https://github.com/forwardmotionnz/notes/pull/5),
commit `032f6e6`, and the published Pages app matched that commit.
All 35 suites passed in Chromium and WebKit on the final PR head `e33befe`.
The owner subsequently confirmed that Android Chrome's Files → + closes
the drawer and leaves the editor ready for typing (2026-09-27). Basic phone
save/reload was already confirmed; neither check needs repeating.
The owner reported all release tests passed and completed on 2026-09-27.
This is owner-reported acceptance; no new independent account evidence is
implied. Completed setup and checks do not need repeating.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the acceptance record.
Earlier dated gauntlet records below are history,
including their old WebKit blocks and unfinished deployment instructions.
They are not instructions to repeat completed setup.

### Development loop — updated at the owner's request

The owner explicitly requested faster iterations on 2026-09-27. Use
`npm run test:dev -- <suite>` while editing, with `--suite <other-suite>`
for related cases; use the affected engine for browser-specific changes.
Do not repeat every suite three times for a small edit. Keep all assertions
and run the complete two-engine suite once on the final PR. Reserve three
full repeats for the release gate. This supersedes the older per-edit
gauntlet workflow below. The three full release runs recorded here cover the
earlier application baseline; the sign-out follow-up below uses focused
regressions and a final full CI check, not another three-run edit loop.

CI now runs once per PR update instead of twice (push plus PR), cancels
superseded runs, and preserves full coverage in both engines. Manual repeat
runs have a separate concurrency group from PR validation. The runner's
focused mode rejects unknown, missing and empty selections, preserves
selected failures, and labels focused results separately from full results.
Per-suite timings expose slow tests without changing their assertions.

Evidence: the new runner tests failed before implementation, then passed
24/24 in each engine; runner plus documentation checks took 10 seconds.
Actual development commands took 4.5 seconds for `mobile-new` (6/6) and
24.6 seconds for `drafts` (45/45), versus 255–269 seconds for the full local
run. Logs: `tests/screens/fast-runner-{before,after}.log` and
`tests/screens/dev-{mobile,drafts}-timing.log`. Independent review found no
blocker or weakened coverage. Full CI on 9586d76 passed twice per engine
after the readiness corrections; application code remains unchanged.

The final workflow check exposed a real sign-out race: a late account reply
could restore credentials between storage removal and page destruction.
The independent reviewer reproduced both tabs regaining their tokens.
`auth-signout` first failed 0/3 in 3.5 seconds. Sign-out now invalidates live
tokens immediately, configuration persistence requires sign-in, and pending
repository lists are invalidated. The final regression holds the profile and
final repository responses, keeps the old document alive through a
same-document navigation, and then really reloads; it passes 4/4 in each
engine in under three seconds. Removing each of the three safeguards
independently fails its corresponding assertion in both engines.

Related checks passed in both engines: auth-renewal 62/62, drafts 45/45,
CSP 26/26. The earlier WebKit version of the new regression cancelled its
own held request on navigation; the final cross-engine setup fixes that.
Logs: `tests/screens/signout-{race-before,fix-targeted,race-restored}.log`
and `tests/screens/signout-mutation-*.log`. The sign-out UI test now waits
for the actual signed-out state instead of a short quiet-network interval.
The app is 141,592 bytes with no new runtime dependency or host.

### Integration and release review

- The branch reconciliation preserves both independent manifest and keyboard
  suites, with the MVP variants named `manifest-paths` and `keyboard-editor`.
  The deployed broker URL and newer main fixes remain in the combined app.
- A fresh whole-codebase adversarial review reproduced four inherited data
  risks: queued captures disappearing after failure, deletion in the newly
  selected repository, late reads crossing repository/selection boundaries,
  and draft migration removing originals when storage is full. Fixes have
  regression coverage; the reviewer confirmed no remaining blocker.
- Follow-up review caught queued captures lost on repository change and a
  combined repository/storage-mode failure. Pending task text now stays as
  an original-repository draft without replacing dirty editor words; all
  preparation happens before storage mode changes. The final independent
  `release-races` checks passed 14/14, with the broken ordering caught by its
  own mutation. Failed capture recovery passed 6/6; phone New passed 6/6.
- Eight additional independent mutations were caught: capture restoration,
  closing the phone drawer, latest selection, note repository scope, queued
  delete scope, pin-read scope, draft-copy failure, and pending-task recovery.
  Logs: `tests/screens/reconcile-worktree/tests/screens/mutation-*.log`.
- The simulated phone first-run journey was saved and every screenshot
  viewed in Chromium and WebKit, light and dark: welcome, create/install,
  empty repository, first note, save and reload, plus 1280 px desktop views.
  They are under `tests/screens/reconcile-worktree/tests/screens/release-*`.
  The walkthrough found and fixed New leaving the phone drawer over the editor.
- Test readiness fixes wait for the actual sign-in outcome. The stale-list
  test closes settings through Save before opening a second list, preserving
  its older-response assertion. No test or browser engine is skipped.
- Repeat runs exposed task-queue tests assuming browser actions fit within
  short response delays. Queue-race cases now hold responses on promises
  until the intended actions finish; every original assertion is retained.
  A fresh review confirmed the ordering, and removing serialisation caused
  19 WebKit failures. The full-run count restarts after this test correction.
- Owner handover: Android Chrome; basic phone save and reload already passed
  before this merge. A second account is not currently available. Those
  facts are recorded in the release checklist rather than asking for setup
  or the completed basic journey again.
- `index.html` is 141,352 bytes. No runtime host, build step, dependency or
  service worker was added. The owner's root `package-lock.json` edit is
  outside the isolated integration checkout and remains untouched.
- Final combined full-suite evidence: all 34 suites passed three consecutive times in Chromium and WebKit (255 s, 269 s, 260 s; 8 suites at a time). Logs: `tests/screens/release-final-{1,2,3}.log`. The inline app stayed unchanged throughout. All MUST items are implemented; real-account/device checks in RELEASE_CHECKLIST.md remain the final release gate.
- CI follow-up: one duplicate Chromium job failed the wikilink phone check
  while the same-head PR job passed. Independent held-response probes proved
  that the source could still be the previous note after 400 ms, or that
  the correct target could still be loading after 500 ms. The test now waits
  for the actual source path/text and phone target. Assertions are retained;
  production code is unchanged from the three full green runs above.
  The corrected wikilink suite passed 47/47 three times in each engine:
  `tests/screens/wikilinks-final-{chromium,webkit}-{1,2,3}.log`. Both WebKit
  CI jobs and the PR Chromium job passed on the preceding app-identical head.
- A subsequent WebKit round exposed the same readiness issue in two sign-in
  checks: stored credentials existed before the repository tree arrived.
  Independent held-tree probes reproduced both failures; releasing the same
  response produced the expected row without another sign-in, CSP violation
  or page error. The phone sign-in and CSP tests now wait up to five seconds
  for that row before their unchanged assertions. App code is unchanged.
  Both suites passed three times in each engine (auth-renewal 62/62, CSP
  26/26); logs: `tests/screens/signin-ready-{chromium,webkit}-{auth-renewal,csp}-{1,2,3}.log`.
- The next PR Chromium run exposed an initial-editor race in the draft test
  (the duplicate full Chromium run passed). Holding the first note response
  reproduced the exact null-editor exception; releasing it created the editor
  and the correct file-scoped draft. The test's typing helper now waits for
  attachment, bounded at five seconds, before its unchanged typing operation.
  All 45 draft checks passed three times per engine; logs:
  `tests/screens/drafts-ready-{chromium,webkit}-{1,2,3}.log`.
- A duplicate Chromium job then caught the first file-switch assertion
  reading the previous editor before the return GET completed; the PR job
  and both WebKit jobs passed. Independent response gating reproduced this
  exactly. The first case now awaits the expected path and editor text;
  every assertion and deliberate in-flight race case remains unchanged.
  All 33 checks passed three times per engine; logs:
  `tests/screens/switch-ready-final-{chromium,webkit}-{1,2,3}.log`.
- A further duplicate Chromium failure was EOL setup editing the previous
  note while its requested note was loading, leaving Save disabled when the
  new note arrived. An independent held-response probe reproduced it and
  confirmed the old note's text remained recoverable in its scoped draft.
  EOL editing cases now await their requested path and completed opening;
  the deliberate non-UTF-8 refusal is unchanged. All 31 checks passed three
  times per engine: `tests/screens/eol-ready-final-{chromium,webkit}-{1,2,3}.log`.
  CI now runs two independent suites at a time in each engine to limit CPU
  contention; assertions, both engines, repeat counts and each suite's
  deliberate concurrent operations are unchanged. Independent review
  confirmed no weakened coverage or production change.

## Items
| ID | Priority | Status | Evidence |
|----|----------|--------|----------|
| C1 | 1 | done | `tests/drafts.test.mjs` 44/44 (written before unload, reload, closed tab, new file, stale draft → conflict + Discard, session-only, mode switch, sign-out, plus six review regressions); screens `tests/screens/c1-{desktop,phone}-{light,dark}.png`; commit daa2754 |
| C2 | 2 | done | `tests/autosave.test.mjs` 36/36 (pause commits, steady typing does not, hide commits, Save kept, in-flight save not raced, conflict stops autosave and keeps the draft, restored draft and New wait for typing, plus seven review regressions); screens `tests/screens/c2-{desktop,phone}-{light,dark}.png`; commit 493850a |
| C3 | 3 | done | `tests/switching.test.mjs` 33/33 (no dialog on switch, New or change of repository; commit on leaving; offline and conflict keep a draft; save in flight; untouched template leaves nothing; right repository; reopening during a commit; failed open; two-tab draft; lost reply across repositories); rewritten drafts/autosave tests listed below; commit ec26502 |
| G2 | 4 | done | `tests/hostile.test.mjs` 28/28: source scan for HTML sinks (incl. bracket and split spellings); payloads in file, folder, pin and new-note names, note text, task lines, headings, branch, login, a GitHub error message, a pin read error and the sign-in error in the URL; folders and pins named `constructor`, `__proto__`, `toString`, `valueOf`, `hasOwnProperty`; tripwire never set and no payload element created. Screens `tests/screens/g2-{desktop,phone}-{light,dark}.png`; commit 981fd4d |
| G1 | 5 | done | `tests/csp.test.mjs` 26/26 (runs first in `npm test`): two policies present and shaped as intended; inline script hash listed; no inline handlers; fetch, image, beacon, WebSocket, form, injected `<script>` and `<base>` to a third party all blocked and nothing reached it; a copy filled in exactly as the README says signs in end to end with nothing injected; the broker check agrees with the browser on 13 cases; a mismatched broker is reported and sign-in withheld. All 10 suites pass under the policy. Screens `tests/screens/g1-{desktop,phone}-{light,dark}.png`; commit 3290031 |
| N1 | 5a | done | `tests/eol.test.mjs` 31/31: CRLF, CR and mixed files open clean (no draft, no autosave, not "restored" after reload); edits keep the file's endings and every untouched line's own ending (ties, lone CRs inside and at the end, two edits plus an insertion in one save, a moved line, a second save); pinned CRLF task lists read, tick and capture with CRLF; a BOM is kept; non-UTF-8 text is refused and never written; a lost reply is matched byte for byte; the reviewer's counterexamples; 20,000 seeded random files and edits all read back exactly as typed; a 30,000-line rewrite takes ~25 ms. Commit 4dec41f |
| N2 | 5b | done | `tests/auth.test.mjs` 78/78, new cases: a return from installing signs nobody in, uses no code, shows a note with "Forget me" ticked, one click signs in session-only; "Choose repositories" opens a new tab and the tab refreshes its list on return, staying session-only; a remembered tab carries on and fetches the list once; an older, slower list never overrides a newer one; a refresh keeps an unsaved pick. Screens `tests/screens/n2-{desktop,phone}-{light,dark}.png`, `tests/screens/n2-settings-*.png`; commit 4f5062d |
| N3 | 5c | done | `tests/auth.test.mjs` 97/97, new cases: saving settings, or signing in again, in one tab leaves the others signed in and saving (and they adopt the new token); choosing "Forget me" in one tab signs the others out and leaves nothing on disk; switching back to remembered sticks after a reload; other tabs follow a change of repository (committing their open file to the old one first) and of pins alone, and do not undo it later; a token refresh finishing after another tab signed out or chose "Forget me" writes nothing and sends no empty-token request. Commit f23b584 |
| N4 | 5d | done | `tests/auth.test.mjs` 111/111, new cases: a crafted `?error=` or `?code=` link neither hides a signed-in person's notes nor puts its words anywhere on screen; signed out, it shows only fixed wording; an error whose state is not this tab's is not taken for a cancel; a real cancel is reported in the app's own words; a sign-in that lost its state says so; the "Forget me" choice survives a cancel and a failed exchange (and defaults to ticked when unknown); a signed-in tab ignores a mismatched code. `tests/hostile.test.mjs`: text from the address is never shown. The fake's access_denied redirect now carries `state` and `error_uri`, per GitHub's docs (URL in the harness). Commit 045b181 |
| N5 | 5e | done | `tests/large.test.mjs` 20/20: a file over 1 MB is listed but marked, clicking says why, opening it directly or as a pin is refused and nothing is written; GitHub's `too_large` refusal gets its own message; a draft whose file grew past 1 MB opens as `name (unsaved copy).md` and saves there; a note or a pinned task is never saved past 1 MB (the task text stays in the box); a lost reply followed by an unreadable file is a conflict with Discard; a Git LFS pointer is refused and never written. The fake answers large files as GitHub's docs describe (URLs in the harness). Screens `tests/screens/n5-*.png`; commit 42315db |
| B1 | 6 | done | `tests/empty.test.mjs` 19/19: an empty repository is named as such with how to start, no error; the first note and the first pinned task create it (without naming a branch that does not exist yet), and later saves name the branch; the tree updates after a first task; a 409 that is not "empty" is not called empty; a list that failed to load says so and never shows another repository's files; a vanished branch is followed to the default branch, with a note, and saves go there; a pinned task that fails to save goes back in the box. The fake models empty repositories, branches and the repository's default branch per GitHub's docs (URLs in the harness). Screens `tests/screens/b1-*.png`; commit 800e3ed |
| B3 | 7 | done | `tests/access.test.mjs` 30/30: archived and read-only repositories show a badge with the reason, keep notes readable, lock the editor, hide Save and New, disable the pinned capture and checkboxes, and send nothing (no draft either); a repository archived while someone types locks the open note and sends neither Save nor autosave, keeping the text as a draft; nothing (task or save) is sent before access is known; a late answer about one repository is not applied to another; a repository that is gone locks and says so with what to do; tapping the badge on a phone says why; a writable repository is unaffected. The fake's repository object carries `archived` and `permissions` per GitHub's docs. Screens `tests/screens/b3-*.png`; commit d32c97f |
| A1 | 8 | done | `tests/shared.test.mjs` 18/18: someone else signs in to the same deployment and is offered every repository across a personal and 101 organisation installations (253, over several pages of installations and of repositories) and writes a note in an organisation repository; paging survives smaller pages than asked for and a missing total; one installation failing leaves the rest listed, with a note; installations are asked at most four at a time; the repository in use is never swapped silently; Save works before a long list arrives; an install waiting for an organisation owner's approval says so. The fake pages both endpoints as GitHub documents. Owner step (make the App public) under Needs the owner. Commit 7a955b3 |
| D1 | 9 | done | `tests/rename.test.mjs` 49/49: one commit moves the file to a new path or folder, the editor, tree and pins follow, later saves go there; a failure at each of the five requests leaves the repository as it was and says so; a file changed elsewhere is not moved in its old form; an existing target (known or appeared since) is never overwritten; another commit meanwhile is built on, never forced over; unsaved words go with the file; the note is locked while it moves (a refresh cannot unlock it) and is the same note at its new path at once; another tab follows; a lost reply is recognised; a name without an extension keeps the note's own; unopenable targets, a path through a file, and links are refused; every GitHub request skips the browser cache; no Rename in a read-only repository. The fake Git database is modelled on GitHub's docs (trees built from their base, fast-forward-only refs). Screens `tests/screens/d1-*.png`; commit c77ef15 |
| D2 | 10 | done | `tests/delete.test.mjs` 37/37: Delete asks first, saying how to recover from the history (and that unsaved changes go too); saying no deletes nothing; one commit; the note closes and the list updates; a file changed elsewhere, a failure, a stale draft are not deleted and say why (pointing to Discard); a lost reply and an already-deleted file count as done; a double tap changes nothing; a slow delete is not raced by autosave or by switching apps; it waits for a pinned task being saved; the empty editor takes no typing; a pinned note is unpinned; other tabs close it, and one with unsaved words keeps them as a new, unsaved note (and a draft, even if it never heard); no Delete when read-only. Screens `tests/screens/d2-*.png` (incl. 320 px); commit d762495 |
| E1 | 11 | done | `tests/wikilinks.test.mjs` 47/47, in CodeMirror and the plain editor: Ctrl-click, Cmd-click and a tap open `[[Note]]`, `[[Note|alias]]`, `[[folder/Note]]`, `[[Note#Heading]]`, any case; shortest path wins (by depth, then length), dot-folders ignored; a plain click and a tap at a link's edge only place the cursor; an unresolved link asks to create `<name>.md` (no means nothing, yes then Save creates it) in the folder's existing spelling; no offer before the list loads, from a partial or stale list, when read-only, or outside the repository. Screens `tests/screens/e1-*.png`; commit 918ad02 |
| B2 | 12 | done | `tests/firstrun.test.mjs` 32/32: with the app on no repository, only the two steps, Check now and Sign out are on screen (step 1 focused); step 1 opens github.com/new with `notes` and Private filled in, step 2 the app's install page, both in a new tab; coming back, one repository is chosen by itself and its first note commits; with several, the usual choice; before one is in use nothing public is chosen for anyone, a private `notes` is preferred, a public one is named as public; failed or partly failed lists say so with Try again, on the steps or not; a slow list shows "looking"; Check now shows it is checking; fits a 390 px phone. Screens `tests/screens/b2-*.png`; commit 5bf6436 |
| A2 | 14 | done | `tests/welcome.test.mjs` 19/19: at most three sentences of at most 20 words, above Sign in, saying what Notes is, that it reads and writes files only in repositories the app is installed on (which you choose), that notes stay there and whoever runs the copy's App can reach them; a Privacy link to `PRIVACY.html` (GitHub Pages publishes `PRIVACY.md` there) in a new tab; Sign in has the focus; Forget me promises no more than PRIVACY.md (the privacy test holds the README to that too); fits 320 px. Screens `tests/screens/a2-*.png`; commit d91783c |
| A3 | 13 | done | `PRIVACY.md`; `tests/privacy.test.mjs` 40/40: every storage key a real session writes (remembered and Forget me, even for a moment) has its own row in the note and sits where the note says; sign-out leaves nothing; an automatic sign-out keeps drafts, as the note says; the broker only ever receives `code`, `code_verifier` and `refresh_token`, never a note, and its code and deployment keep and log nothing; every host in the page's policies is named; the revoke pages are GitHub's documented ones; the note states what sign-out does not do (eight hours, six months), the app owner's own access and Uninstall, the page and CDN trust, restored and duplicated tabs, and repositories others installed on. Commit 211e75b |
| F2 | 15 | done | Combined app: all 34 suites passed three consecutive times in Chromium and WebKit; tests/screens/release-final-{1,2,3}.log (255 s, 269 s, 260 s). Earlier blocked attempt is historical. |
| F1 | 16 | done | `tests/manifest.test.mjs` 20/20; full 22-suite Chromium gauntlet green three consecutive times; origin restriction mutation caught; viewed icon and `tests/screens/f1-{desktop,phone}-{light,dark}.png`; commit 83c1791 (pushed). |
| F3 | 17 | done | `tests/keyboard.test.mjs` 22/22 using real CodeMirror and the fallback; full 23-suite Chromium gauntlet green three times; five independent mutations caught; `tests/screens/f3-{desktop,phone}-{light,dark}.png` viewed; commit 3486a8f (pushed). |
| G3 | 18 | done | `tests/errors.test.mjs` 90/90; all 24 Chromium suites green three consecutive runs (`tests/screens/g3-gauntlet-2/`); 26 safeguards independently removed and caught; fresh review findings fixed or documented below; viewed `tests/screens/g3-{desktop,phone}-{light,dark}.png`; commit c57046d (pushed). |
| H1 | 19 | done | `tests/docs.test.mjs` 10/10; all 25 Chromium suites green three times (`tests/screens/h1-gauntlet-2/`); four misleading wording variants caught; reviewed `tests/screens/h1-{desktop,phone}-{light,dark}.png`; fresh review fixes recorded below; commit a7b60d0 (pushed). |
| H2 | 20 | done | `.github/ISSUE_TEMPLATE/bug_report.md`; `tests/docs.test.mjs` 20/20, five template mutations caught; all 25 Chromium suites green three times (`tests/screens/h2-gauntlet/`); fresh review and viewed `tests/screens/h2-{desktop,phone}-{light,dark}.png`; commit a66ce72 (pushed). |
| H3 | 21 | done | `CHANGELOG.md`; `tests/docs.test.mjs` 30/30, six misleading wording variants caught; all 25 Chromium suites green three times (`tests/screens/h3-gauntlet/`); fresh review fix and viewed `tests/screens/h3-{desktop,phone}-{light,dark}.png`; commit 2a16de0 (pushed). |
| N6 | 17a | done | a 32 px PNG tab icon beside the SVG (older Safari); `tests/manifest.test.mjs` 30/30 checks every tab-icon link (exists, type, real size, served type); run 32, both engines, green. Commit 74c2291; merged in forwardmotionnz/notes#2 |
| N7 | 17b | done | a full local run about 300 s -> 73 s (8 suites at a time; three runs green); CI runs the repeats as side-by-side jobs, three over in both engines in 5 min 42 s instead of about 35 min (run 43, https://github.com/forwardmotionnz/notes/actions/runs/36221083063, green). 367 short fixed pauses became `H.settle`; four missing checks found and added; the review's hollow check restored. Commits 5574a13, 47b968c, b1a75bd, 66dbef4, ae130fa |
| N8 | 17c | done | `tests/app.test.mjs` 70/70, new cases with GitHub slowed to 0.4-0.8 s a commit: three quick ticks all land with nothing refused and two commits; tick then untick ends as it began; a tick and a quick capture both land; a failed commit sends nothing after it, shows GitHub's state and the error, and puts the waiting capture back; a change made elsewhere is still a conflict and kept; changing repository mid-commit; saving settings mid-commit; the open note follows each commit. Commit in the log |
| N9 | 17d | done | `tests/tasks.test.mjs` 52/52 (new suite): a remove control per task, named for it; removes that one line in one commit, no question; Undo puts it back exactly and goes after 8 s or once used; Clear done removes every ticked task and only them, in one commit, with Undo; CRLF kept; remove, untick and clear while GitHub is slow all land; a stale row removes nothing; a failed remove keeps the task and offers no Undo; Undo withdrawn on changing repository, switching list, or the repository becoming read-only; Undo refuses when lines were added above (incl. a blank line under each heading), still works after a tick or a capture, stays on offer while it cannot be sent yet, comes back after a refusal, and follows a rename; × always shown on a phone, on hover on a computer. `tests/access.test.mjs`: no task can be removed read-only. Screens `tests/screens/n9-{desktop,phone}-{light,dark}-{list,undo}.png`. Commit in the log |
| N10 | 21a | done | Today’s daily note; `daily-notes` 23/23 in both engines; all 36 suites passed both engines in CI 36277448756 on `8e2b0fb`; PR #6 merged as `4f4a279`. |
| N11 | 21b | done | Pin toggle and main-area checklist; `pinned-tree` 23/23 both engines; all 37 suites passed both engines in CI 36279330993 on `4eb4756`; PR #7 merged as `00ed737`. |
| N12 | 21c | done | `0a655fc`, reviewed with `ec8d7b5`; preview 15/15 both engines, CSP 26/26, hostile 28/28. Screens and mutations below; final CI/merge status in PR #8. |
| S1 | 22 | moved | Rendered preview is now MUST N12. |
| S2 | 23 | done | `ec8d7b5`; content-search 13/13 each engine: drafts, incomplete results, retained matches, expired sign-in, stale repo/query responses, bounded reads. Independent re-review clear; final CI/merge status in PR #8. |
| S3 | 24 | done | `85a2893` plus attachment contrast fix with S4. axe accessibility 29/29 both engines; zero serious/critical across six views, both widths/themes and plain-editor fallback. Injected audit probe detects violations. |
| S4 | 25 | done | Repository Markdown and Obsidian image embeds; preview-images 15/15 both engines, screenshots and mutation evidence below. External/unsupported images visibly refused; bounded reads and stale-result guards. |
| N13 | 26 | done | `tests/integrity.test.mjs` 14/14: six CDN tags, each with a hash and anonymous fetch; the CI check is wired; a changed editor file is refused and the app still opens and saves with the plain editor and its badge; the real editor with a changed stylesheet falls back too; the real files with every hash kept run CodeMirror. CI job `CDN files match their integrity hashes`: all 6 match cdnjs (it printed the four CodeMirror hashes used). keyboard-editor and accessibility now check they test real CodeMirror. Commits 310c908, cbb4954, 16bddb3 |
| N14 | 27 | done | `tests/conflict.test.mjs` 53/53 (new suite): different lines merged and saved (by Save and by autosave), lines added and removed on both sides, the same change on both sides; the same lines never guessed, Save as copy keeps mine as a new note, never replaces an existing one, survives a failed save and a name taken meanwhile; typing during the fetch kept; CRLF and BOM kept; a restored stale draft never merged; one merge per save; deleted on GitHub (empty or not) never recreated; Undo after a merge cannot drop their lines; the caret stays (CodeMirror and the plain editor); one of several identical lines removed on both sides is not guessed; no typing lost while the copy saves. Screens `tests/screens/n14-{desktop,phone}-{light,dark}-{conflict,copied}.png`. Commit in the log |
| N15 | 28 | done | `tests/pins-sync.test.mjs` 54/54 (new suite): pinned notes found on a device that never saw them, and only those (not `pinned: false`, not in the body, not in hidden folders); a second visit reads nothing already read; a pin made elsewhere appears after a refresh, reading only that note; pinning writes `pinned: true` (with a frontmatter block if none, beside existing properties, inside `...` frontmatter), unpinning removes only that line, restoring the note exactly; another device sees both; CRLF/BOM kept; unsaved words saved with the pin; a restored draft is never saved by pinning; a `pinned` property used for something else is never overwritten (pinned in this browser, and said); browser pins from before carry over; non-Markdown and read-only repositories pin in this browser with nothing sent; typed by hand counts once saved; rename and delete keep the list right; a scan never undoes a pin made meanwhile; the list shown stays shown when the scan adds pins ahead of it; a scan cut short or refreshed keeps what it read; known pins show at once; unreadable notes are not read again; offline, the scan stops rather than trying every note, and carries on later; at most 500 notes a visit, and says so. Commit in the log |
| N18 | 29 | done | `tests/sidebar.test.mjs` 33/33 (new suite): ☰ on a computer hides and shows the list, says so, remembered; a handle resizes it by dragging (from where it is grabbed), arrow keys, Home, and double-click reset, remembered, 180 px to 600 px and at most 60% of the window, keeping room for the note when the window narrows; the handle is its own column, not over the note; the editor lays itself out again; hidden with nothing open, the hint says ☰ brings the list back; phones keep the drawer, with no handle, and the button follows the drawer however it closes. Commit in the log |
| N19 | 30 | done | `tests/theme.test.mjs` 20/20 (new suite): Auto follows the device both ways and is the default; Light and Dark override it at once, with the browser bar colour and form controls; remembered, and in place (with the bar colour) before the app's script has run; signing out keeps it; Auto again forgets it; storage refused, the app still starts; the privacy note lists `notes.theme`. Commit in the log |
| N20 | 31 | done | Quick switcher 13/13 both engines; switching 33/33 and hostile 28/28 both engines. Independent review's IME finding fixed; hidden-path and composition mutations caught. Screens `tests/screens/n20-{1280,390}-{light,dark}.png` viewed. Final combined PR CI follows N31. |
| N21 | 32 | done | `note-status` 14/14 both engines, autosave 22/22, conflict 53/53 and axe 33/33 both engines. Four safeguard mutations caught. Review fixes: replaced drafts withdraw local-copy reassurance; lost save replies after undo remain uncertain; an absent empty note is not called Saved. Screens `tests/screens/n21-{1280,390}-{light,dark}.png` viewed. |
| N34 | 33 | doing | Padgit branding and pre-move notice prepared; custom-domain sign-in/save 11/11 both engines; axe 41/41 and privacy 41/41 both engines. Review fixes: wait across mocked auth navigation; cap notice height with phone keyboard open. Eight screenshots viewed. Awaiting owner name confirmation and coordinated DNS/Pages/App/broker cutover; see `docs/padgit-migration.md`. No domain/secret/account changes made. |
| N31 | 34 | done | About 9/9 both engines; version 1.0.0 agrees with changelog, fork links configurable, unsafe links omitted, mutation caught. Independent review clear; 320/390 px keyboard access verified; `tests/screens/n31-{1280,390}-{light,dark}.png` viewed. |
| N22 | 35 | done | Browser/header history and scoped note bookmarks; navigation tests both engines, switching 33/33 both. Review fixed reload history and failed sign-in retry. Scope-guard mutation caught. Desktop/phone light/dark screenshots `tests/screens/n22-*.png` viewed. |
| N23 | 36 | done | Centred editor/Preview and remembered 16/18/20px sizes. Reading 12/12, keyboard-editor 24/24 and app 70/70 both engines; independent real-CodeMirror review clear. Desktop/phone light/dark screenshots `tests/screens/n23-*.png` viewed. N22 committed as `40fe608`; navigation 14/14 and privacy 41/41 both engines. Privacy test now distinguishes the documented tab-only history metadata; all sign-out assertions retained. |
| N32 | 37 | done | Shared Preview checklists; checklists 20/20, app 70/70, release-races 14/14, tasks 52/52, preview 15/15, images 15/15 both engines; axe 45/45. Independent review clear after source-map, loose subtree, formatting, conflict refresh, ordered-list and Cancel fixes. Read-only/subtree mutations caught; `tests/screens/n32-*.png` viewed. N23 commit `22359a0`. |
| N24 | 37 | moved | Folded into N32 |
| N25 | 38 | done | Formatting toolbar and scoped shortcuts; formatting 52/52 both engines, keyboard-editor 24/24, quick-switcher 19/19, axe 45/45; review fixes covered by rendered-Markdown assertions; selection mutation caught; four screenshots inspected. N32 commit `15a9c9d`. |
| N16 | 39 | done | Images: 39/39 both engines, actual paste/drop and real/fallback editor Undo, scopes, size/type, Obsidian folders; review fixes covered reserved paths, pointer drops and busy feedback. Cross-note insertion mutation caught; n16 desktop/phone light/dark screenshots inspected. |
| N33 | 40 | done | Tabs 17/17 both engines; navigation 14/14, reading 12/12, mobile-new 6/6, privacy 41/41, axe 45/45 both. Review: background deletion persisted, closing a loading tab cancels its read, local-storage failure blocks unsafe closing, failed neighbour read restores tab. Unsafe-close mutation caught. n33 four screenshots inspected. N16 commit `c8f2e48`. Long comments moved to implementation-notes.md with identical executable AST, saving 13 KB. |
| N26 | 41 | done | Recent previews/history and shared reader; 18/18 Chromium + WebKit, content-search 13/13 and pins-sync 54/54. Review fixes, mutation and screenshots below. |
| N27 | 42 | done | Tags, counts, filtering and source edits; 53/53 Chromium + WebKit, independent review fixed, mutation and screenshots below. |
| N17 | 43 | done | Linked from with bounded shared reads, draft priority and Markdown/wiki resolution. 13/13 both engines; wikilinks 47/47, review/mutation/screens below. |
| N28 | 44 | done | Heading outline with source/Preview jumps, nested headings and pagination. 36/36 both engines; axe 57/57; review/mutation/screens below. |
| N29 | 45 | done | Callouts in Preview: all Obsidian kinds and aliases, custom titles (formatting kept), default titles, `-`/`+` folding, unknown kinds as notes, nesting; built after sanitising by moving the note's own nodes. `tests/callouts.test.mjs` 16/16; accessibility now scans every callout colour in both themes (zero serious issues). G-2: folding, default title, title/body split and unknown kinds each fail a named check when reverted. Screenshots `tests/screens/callouts-*.png` |
| N30 | 46 | todo | UX review 2026-09-28: recently deleted notes |
| N36 | 44a | done | The header's ← → buttons removed; `tests/navigation.test.mjs` 14/14 now drives the browser's own back and forward (both ways, after a reload and from the middle of history) and checks the header has no arrows. Full suite 61/61 Chromium. Commit in the log |
| N37 | 44b | done | Tasks screen, "Add a task" boxes, Edit note / Tasks switch and pinned-only logic removed; a pin opens like any note; Preview checklists keep tick, edit, move, drag, remove, Clear done and Undo. 18 suites that drove the Tasks screen now drive Preview (reasons under "N37: tests changed"). G-1: full suite 61/61 Chromium, three runs. G-2: each safeguard reverted alone fails a test: Undo withdrawn on opening another note (tasks "another note: the Undo is withdrawn", "a new note: the Undo is not offered there"), cache refilled before Preview's shortcut (tasks "another list: setup"), Undo refused with unsaved typing (tasks "unsaved typing: Undo sends nothing"), shortcut marked only while open (pinned-tree "a new note: the shortcut is no longer marked"), late checklist reply never rolls the editor back (tasks "late tick reply: the note shows what GitHub has"). G-3: four findings, all fixed with those tests. G-4 `tests/screens/n37-*.png`. Commits in the log |
| N38 | 44c | done | Built to the approved mock-up (https://claude.ai/artifact/AmXpGUFgM5kpXJkZ1awT42): icons, buttons, header with save dot, Edit/Preview switch and ⋯ menu, tabs (chips on phones), icon toolbar, sidebar sections, reading face for headings, property chips, checklist rows with tap-to-edit, grip and ⋯. `tests/design.test.mjs` 60/60; full suite 62/62 Chromium; axe zero serious issues in every view, both themes, both widths. G-2: each safeguard reverted alone fails a named design check (property values as text; links in tasks; Saving… while a save is on its way; focus back to ⋯; menus close on Tab and on a tap; tabs with one name told apart; Pinned chip follows the pin check; phone title keeps its line in a conflict; one task menu at a time) and the menu observer writing unchanged attributes stops sign-in. G-3: nine findings; eight fixed with those tests; the ninth (no quick-switcher button on phones) kept on purpose, since search is at the top of the Files sheet. Screenshots `tests/screens/n38*.png`; README screenshot redone |
| N35 | 47 | todo | Owner's request 2026-09-28: GitHub Sponsors |

### N10: plan
- Today opens the local calendar day's note. Read `.obsidian/daily-notes.json`
  without changing it. Without config use `Daily/YYYY-MM-DD.md` and a heading.
  Honour common Moment date tokens and bracketed literals; explain fallback
  for unsupported filename formats. Preserve existing notes and drafts.
- Prove with focused `daily-notes` regressions in both engines, related draft
  and navigation checks, independent review and desktop/phone screenshots.
- The original N10–N12 descriptions were recovered from `877cc04`; the owner
  confirmed S1–S4 from `.claude/commands/gauntlet.md` on 2026-09-27.
  G3 and H1–H3 are already complete and are not reopened.

### N11: plan — 2026-09-27
- Pin/unpin beside the note name; a Pinned list above the file tree opens
  tasks in the main area. Source editing remains available through Edit note.
  Pins stay browser-local; remove the Settings field and separate task sheet.
- Proof: focused `pinned-tree`, existing task/save/Undo/navigation/keyboard
  regressions, adversarial review, viewed phone/desktop light/dark screens,
  then one full CI check on the final PR.
- Old Settings pin-field test calls now populate persisted fixtures through
  `H.setPins`; the new suite tests the actual toggle and reload persistence.
  Editor fixtures select source, and Undo tests return through Tasks. The
  release-race tests invoke delayed task handlers directly after source is
  shown, retaining every draft/capture preservation assertion.

### N11: verification
- Completed: [PR #7](https://github.com/forwardmotionnz/notes/pull/7) merged
  as `00ed737`. All 37 suites passed both engines in
  [CI 36279330993](https://github.com/forwardmotionnz/notes/actions/runs/36279330993)
  on `4eb4756`. Next item: N12, sanitised rendered preview.
- `pinned-tree` failed 0/4 before implementation; final 23/23 in Chromium
  and WebKit, about 10 seconds total. Related app 70/70, tasks 52/52,
  auth-renewal 62/62 and keyboard suites passed focused Chromium checks.
  Both engines passed the affected file-operation, hostile-content, vault,
  line-ending, daily-note, CSP and release-race suites. Documentation passed.
- Independent review reproduced mismatched header/checklist selection after
  a failed pin read, and a rescued draft hidden behind Tasks. New regressions
  failed for both, then passed after fixes; follow-up found no blocker.
- Four deliberate mutations were caught: premature pin selection, hidden
  rescue, skipping source-save protection, and a late view change overriding
  a clean newer selection. Logs: `tests/screens/n11-mutation-*.log`.
- Viewed all `tests/screens/n11-{1280,390}-{light,dark}-{tasks,source,files}.png`:
  task capture and note controls fit; no separate phone sheet or side panel.
- `index.html` is 148,499 bytes; no new dependency, host or build step.
  The owner's lockfile hash is unchanged. Full CI is the final PR gate.
- Initial full CI found one remaining obsolete interaction in `privacy`:
  it filled the task box after opening source, when that box is now hidden.
  Task creation now happens before editing the source draft; all storage,
  broker and revocation assertions remain. The unchanged app passes 41/41
  privacy checks in both engines (9 seconds). Chromium's other 36 suites
  passed on `a7e21b1`; the final test-only follow-up receives CI validation.

### N10: verification — 2026-09-27
- Completed: [PR #6](https://github.com/forwardmotionnz/notes/pull/6) merged
  into main as `4f4a279`. All 36 suites passed Chromium and WebKit in
  [CI 36277448756](https://github.com/forwardmotionnz/notes/actions/runs/36277448756)
  on final feature head `8e2b0fb`. Next item: N11.
- New `daily-notes` suite failed before the button existed, then passed 23/23
  in Chromium and WebKit (final focused run: 13 seconds total). Related
  `drafts` 45/45, `switching` 33/33, CSP 26/26 and phone New 6/6 passed in
  both engines; documentation 32/32 passed. Full CI remains the final gate.
- Independent review found repeated Today could drop an untouched template,
  and cancelling an open with a failed Today lookup could strand the old
  note's Save. Both have regressions and fixes; follow-up found no blocker.
- Five deliberate mutations were caught: repeated-template protection,
  reviving the visible note, stale navigation/repository responses, original
  template encoding, and path validation. Logs: `tests/screens/n10-mutation-*.log`.
  The stale-response mutation exposed a test route bypassing the simulated
  GitHub; changed it to `route.fallback()` and await the actual lookup promise.
  The final test now fails when cancellation is removed, without live traffic.
- Viewed light/dark Files and editor screenshots at 1280 and 390 px:
  `tests/screens/n10-{1280,390}-{light,dark}-{files,editor}.png`. Today fits
  beside the filter; the drawer closes and the editor is reachable.
- App remains under 150 KB, with no new runtime library, host or build step.
  The owner's existing `package-lock.json` edit remains untouched.
- Implementation commit `d513796`, [PR #6](https://github.com/forwardmotionnz/notes/pull/6).
  A final date-format check also covers unsupported day-of-year tokens;
  those must fall back rather than be interpreted as two day-of-month tokens.
- Updated the documentation test's old “still pending” requirement because
  the owner explicitly reported completion. It now requires dated,
  owner-attributed completion and retains the separate iOS storage warning.

### C1: plan
- Done looks like: every edit is written to a per-file local draft (keyed by repo, branch and path) as you type; opening the file again after a reload, a closed tab or a killed page restores it with a visible notice; a commit clears it; session-only mode keeps drafts in session storage; sign out removes every draft; a draft whose file changed on GitHub since cannot overwrite that change.
- Proof: `tests/drafts.test.mjs` (new suite in `npm test`) covering reload, closed tab, write-before-unload, new file, session-only, sign-out, and a stale draft.

### C2: plan
- Done looks like: after a short pause in typing (2 s) the open file commits by itself, and at once when the page is hidden; typing steadily makes no commits until the pause; a conflict stops autosave for that file, keeps the draft and says so; Save still works; a save already in flight is never raced by a second one on the same sha; opening a file or restoring a draft commits nothing until the user types.
- Proof: `tests/autosave.test.mjs` counting PUT requests against the fake GitHub.

### C3: plan
- Done looks like: opening another file, creating a note or changing repository never shows a `confirm()`; whatever was typed in the file being left is committed straight away if it can be, and otherwise stays as a draft that is restored with a notice when the file is opened again (conflict, offline, a save already in flight). An untouched New template leaves nothing behind.
- Proof: `tests/switching.test.mjs` recording every dialog; the tests in earlier suites that relied on the confirm are rewritten to the new behaviour, with the reason here.

### G2: plan
- Done looks like: no `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` anywhere in the app; every other place repo or user content reaches the DOM (tree, filter results, crumb, status, pins, repository picker, account, editor) goes through text nodes, and each is marked with a comment saying why it is safe. Hostile file names, folder names, note contents, task lines, headings, a hostile GitHub error message and a hostile login never execute or create elements.
- Proof: `tests/hostile.test.mjs`: a source scan for HTML sinks (fails today on four static `innerHTML`s), and a repository full of payloads rendered in every view with a tripwire that any executed payload would set.

### G1: plan
- Done looks like: a `<meta>` Content Security Policy (GitHub Pages cannot set headers) with `default-src 'none'`; scripts only from the inline script's own hash and the pinned CodeMirror path on cdnjs; `connect-src` only api.github.com and the broker; `img-src` only the app, GitHub avatars and `data:`; `form-action`, `base-uri` and `object-src` none. A copy whose broker is missing from the policy says so instead of failing silently. README tells forks to update the policy with the broker.
- Proof: `tests/csp.test.mjs`: fetch, image, beacon, WebSocket, form post and injected `<script>`/`<base>` towards a third-party host are all blocked and never reach the network; the inline script's hash is in the policy; the rest of the suite passes with the policy on.

### N1: plan
- Done looks like: notes are read into the editor with line endings normalised, remembering which ending the file uses (the most common one if mixed), and written back with that ending. A CRLF or CR file opens clean (no draft, Save off, nothing autosaved), an edit changes only the edited lines, and pinned task lists read and tick CRLF files correctly.
- Proof: `tests/eol.test.mjs` comparing the committed bytes.

### N2: plan
- (Revised after review, see below.) First version: "Choose repositories" opens in the same tab, so a session-only tab keeps its session through GitHub and back. A return from installing the app never signs anyone in by itself: a tab already signed in keeps its sign-in and shows the updated repository list, and a tab that is not signed in shows the sign-in view with a short note, so the person chooses "Forget me" themselves. The unsolicited code is never used.
- Proof: new cases in `tests/auth.test.mjs`; the old "install redirect restarts a proper sign-in … and you end up signed in" is rewritten, because an automatic remembered sign-in is exactly the defect.

### N3: plan
- Done looks like: settings and sign-in are written in place, and only then is the other store cleared, so other tabs see new values (and adopt them) rather than an empty one. Saving settings or signing in again in one tab never signs another out. Switching a tab to session-only still signs the others out, because otherwise they would write the sign-in back to disk.
- Proof: two-tab cases in `tests/auth.test.mjs`.

### N4: plan
- Done looks like: an `?error=` or `?code=` in the address only counts when this tab started a sign-in (its pending state is there). Otherwise it is scrubbed and ignored: a signed-in person carries on with their notes, a signed-out one sees the plain sign-in view. When it does count, the message is the app's own fixed wording, never text from the address.
- Proof: new cases in `tests/auth.test.mjs`; the hostile-text check in `tests/hostile.test.mjs` changes from "shown as text" to "never shown".

### N5: plan
- Done looks like: a file over 1 MB is shown in the tree but cannot be opened, like an attachment, with a reason; if GitHub still answers a read with no content (`encoding: "none"`) or refuses it as too large, the app refuses to open it rather than showing an empty note that a save would write over the file. Nothing is ever committed to such a file.
- Proof: `tests/large.test.mjs` against a fake that answers large files as GitHub's documentation describes (URLs in the harness), plus the refusal variant.

### B1: plan
- Done looks like: an empty repository (no commits) shows "This repository is empty" and how to start, not an error; the first note (from + or the pinned capture) is created with the contents API, which initialises the default branch, and the tree then shows it.
- Proof: `tests/empty.test.mjs` against a fake whose empty repository answers as GitHub's docs describe (409 from the Git database API, 404 from contents, PUT initialises), with the URL in the harness.

### B3: plan
- Done looks like: on loading a repository the app reads its `archived` flag and the person's `push` permission (both documented on the repository object). A read-only repository opens read-only: a visible "read-only" badge with the reason, the editor locked, Save and the pinned capture disabled, and nothing is ever sent. A repository that no longer exists (deleted, renamed, app removed) says so in the file list, with what to do, rather than "Not Found".
- Proof: `tests/access.test.mjs`, with the fake's repository object carrying `archived` and `permissions` per GitHub's docs.

### A1: plan
- Done looks like: someone who is not the owner signs in to the owner's deployment, installs the app on their own personal account or an organisation (several installations at once), and every repository across all of them is offered, however many pages GitHub splits them into; they pick one and write a note there. What only the owner can do (making the App installable by anyone) goes under Needs the owner, and the README's App settings say so.
- Proof: `tests/shared.test.mjs` against a fake that pages both installation endpoints as GitHub documents (`per_page`, `page`, `total_count`, `Link`), with URLs in the harness.

### D1: plan
- Done looks like: a Rename button beside the open file's name moves it to any path (a new name, another folder) in one commit made with the Git Data API. Nothing is visible until the branch moves, and the branch only moves forward, so a failure at any step leaves the repository as it was. Before moving, the app checks at that exact commit that the file is still the version open, and that the target does not exist. Unsaved changes are saved first; pins and the last-open file follow the move.
- Proof: `tests/rename.test.mjs` against a fake Git database modelled on GitHub's docs (URLs in the harness): the move, a failure at each step, a change made elsewhere, an existing target, another commit landing meanwhile, and a read-only repository.

### D2: plan
- Done looks like: a Delete button beside Rename removes the open note in one commit (contents API DELETE, with the sha of the version open), after a confirmation that says it can be recovered from the repository's history and, if there are unsaved changes, that they go too. A file changed elsewhere is not deleted; a lost reply is recognised; other tabs with the note open are told, and one with unsaved words keeps them as a new note to save or discard.
- Proof: `tests/delete.test.mjs` against the fake's DELETE, modelled on GitHub's docs (URL in the harness).

### E1: plan
- Done looks like: Ctrl/Cmd-click (desktop) or a tap (phone) on `[[Note]]`, `[[Note|alias]]`, `[[folder/Note]]` or `[[Note#Heading]]` opens the note, resolved as Obsidian does: by file name, case-insensitive, `.md` implied, shortest path winning, dot-folders ignored. A plain click still just places the cursor. An unresolved link asks whether to create the note, and creates nothing if not.
- Proof: `tests/wikilinks.test.mjs` on an Obsidian-shaped vault, in the CodeMirror stub and in the plain-textarea fallback.

### B2: plan
- Done looks like: signed in with the app on no repository, the dialog shows only two numbered steps: create a repository on GitHub (name and "Private" pre-filled) and let Notes use it, each opening GitHub in a new tab. Coming back (or "Check now") picks up the new repository: one is chosen by itself and its empty state explains the first note; several show the usual picker. Nothing else (repository menu, pins, Save) is on screen until then. A list that failed to load is not mistaken for "no repositories".
- Proof: `tests/firstrun.test.mjs` walks it end to end in the simulated GitHub, down to the first note's commit, and counts what is on screen.

### A3: plan
- Done looks like: `PRIVACY.md` says in plain language what the broker sees (sign-in codes and tokens in transit, never stored or logged), what the browser stores and where (each key, local or session storage, and when it goes), every other host the page talks to, who else a person is trusting on a shared copy, how to revoke access on GitHub (both the authorisation and the installation), and how to self-host instead.
- Proof: `tests/privacy.test.mjs` holds the note to the code: every storage key a real session writes is named in it, and nothing is left after sign-out; every host in the page's policies is named; the broker's source keeps and logs nothing and only receives the fields the note lists; the GitHub settings pages it names are the documented ones.

### A2: plan
- Done looks like: the signed-out screen says, in at most three short sentences above the sign-in button, what Notes is, what it asks GitHub for (only the repositories you choose, their contents, read and write) and that notes stay in your repository, with a Privacy link to `PRIVACY.md` as GitHub Pages publishes it.
- Proof: `tests/welcome.test.mjs` counts the sentences and words, checks each point and the link, and that it all fits a 320 px phone.

### F2: earlier attempt (historical; superseded by integration below)
- 2026-09-26 resumed on `mvp`, created from `main` at 5ba9c81. Both Playwright engines are installed locally; tests require the normal Windows environment because the sandbox cannot access its browser cache. Baseline is running. Preserve the existing `package-lock.json` working-tree change.
- Fresh reviewer found the WebKit-only CI job's runner fixtures demanded Chromium. Reproduced before editing: `tests/f2-isolated-before.log`, WebKit 11/14, three failures naming missing Chromium. Use the selected engine for the same failure/crash/continuation assertions; prove it with only WebKit available, then the full three-run gauntlet, mutation and screenshots.
- Gauntlet attempt 1 failed: `tests/screens/f2-gauntlet/run-1.json`. The half-second sign-in helper returned before navigation/token exchange and silently clicked missing rows; WebKit's injected-outage wording also differs. New `tests/harness.test.mjs` failed 3/4 checks with delayed broker/tree responses before the readiness fix. A fresh second reviewer found loading-state tests that must opt out of waiting, an access-pending assertion that would otherwise lose coverage, and a valid task called `Loading...`; all have explicit coverage. WebKit can cancel a hide-triggered save before the test route sees it: its cancellation message is recognised only for the open dirty file during the forced reload, so unrelated CORS errors remain failures.
- Gauntlet attempt 2 failed: the deliberately aborted Chromium fetch can include a stack after its message. The expected-error check now matches the exact first line, with or without a following stack (`tests/screens/f2-gauntlet-2/run-1-chromium-drafts.test.mjs.log`). No application assertion is removed or weakened.
- Gauntlet attempt 3 failed: `tests/screens/f2-gauntlet-3/run-1-webkit-auth.test.mjs.log`, the second Settings click in the older-list test timed out because the dialog still intercepted clicks after Escape. No further F2 fixes were attempted, as required by the three-failure rule. The failed runs were stopped, the candidate saved as an ignored patch, and every unfinished F2 test/helper/README change reverted. Earlier paragraphs describe the attempted candidate, not shipped code. Continue F1 and the remaining items with Chromium gauntlets; F2 remains a release blocker.
- Done looks like: the harness takes the engine from `NOTES_TEST_ENGINE` (chromium or webkit); `npm test` runs every suite in both engines, and an engine that is not installed fails the run with the fix named, never a silent skip; the whole suite passes in WebKit.
- Proof: `tests/runner.test.mjs` for the runner and harness choosing (unknown engine refused, missing engine fails, every suite file picked up by itself). The previous session could not install WebKit; this Windows session can run both engines. The CI matrix must also work with only its chosen engine installed.

### F1: gauntlet record
- Test first: `tests/f1-before.log` failed because the manifest, icons and links were absent. `tests/manifest.test.mjs` now passes 20/20 in Chromium, including actual browser manifest loading at `/notes/` and `/a-fork/` under CSP. It verifies relative start/scope, PNG dimensions, Apple metadata and no service worker.
- Mutation: changing only `manifest-src 'self'` to `manifest-src *` sent the test's external manifest request and failed the browser security assertion (`tests/f1-mutation.log`); restored afterwards.
- Fresh reviewer found no blocker. The iPhone/iPad home-screen app has separate sign-in and draft storage from Safari: README now says to save browser drafts first and sign in again; a test failed before that wording was added. This follows https://webkit.org/blog/14787/webkit-features-in-safari-17-2/ . Actual device installation and standalone OAuth still need the owner's real-phone smoke test; desktop emulation does not establish those behaviours.
- Viewed `icon-512.png` and `tests/screens/f1-{desktop,phone}-{light,dark}.png`: clear paper icon, reachable controls and no horizontal overflow. Assets are static files beside the single HTML app; no build step, dependency, service worker or new external host. Full Chromium gauntlet passed three consecutive times, all 22 suites each time: `tests/screens/f1-gauntlet/run-{1,2,3}.json`. `index.html` is 119,216 bytes. WebKit remains blocked under F2.

### F3: gauntlet record
- Test first: `tests/f3-before.log`, 6/16; keyboard shrink and pan hid the caret/header in both editors. `tests/keyboard.test.mjs` now uses test-only copies of the exact CodeMirror 5.65.16 runtime and its CSS, plus the actual textarea fallback, with synthetic VisualViewport resize/scroll events at 390 px. No fake GitHub behaviour changed.
- Fresh reviewer reproduced a mid-word caret clipped by the fallback mirror: removing the suffix changed word wrapping. The regression failed 21/22 (`tests/f3-review-before.log`), using the browser's native ArrowRight scroll adjustment as an independent check. Keeping the suffix passes 22/22 (`tests/f3-review-after.log`). The reviewer confirmed the fix and found no remaining concrete F3 defect.
- Mutation proof: independently removing viewport height, viewport top, caret scrolling and safe mirror text each failed its intended assertion, with the inline script hash updated for each temporary variant; all restored (`tests/f3-mutation-{height,pan,caret,text}.log`). The suffix regression also fails with the original one-character suffix.
- The marker's separate text sink was also changed alone to HTML and caught by the existing hostile-source test, 27/28 (`tests/f3-mutation-marker-text.log`); restored to the same verified source afterwards.
- Viewed `tests/screens/f3-{desktop,phone}-{light,dark}.png`: real editor at 1280 px and 390 px, phone cropped to the 360 px area above a simulated keyboard. Header and final line fit, both themes are legible. Normal reading scroll and pinch-zoom layout are preserved by tests. The phone test does not launch a real OS keyboard.
- Rules/docs: app remains one HTML file, 121,983 bytes, no new external request or runtime dependency. Test fixtures retain the upstream MIT licence and source URLs. README explains the phone layout. Full Chromium gauntlet passed three consecutive times, all 23 suites each time: `tests/screens/f3-gauntlet/run-{1,2,3}.json`. WebKit is still blocked under F2.

### G3: plan
- Done looks like: connection failures, invalid outage responses, server errors and rate limits use fixed human messages with a clear retry action. Temporary refresh failures keep sign-in and drafts; only a rejected refresh token signs out. Rate-limited requests wait for the documented cooldown. Failed writes keep drafts and existing lost-reply safeguards; repository rules do not falsely instruct Discard.
- Proof: new error tests inject outages and documented rate-limit responses, retry reads/writes, preserve drafts and sign-in, distinguish genuine conflicts, and prevent requests during cooldown. Existing hostile-error tests will continue checking that payloads neither become DOM elements nor execute, while requiring human wording instead of raw server text.

### G3: gauntlet record
- Test-first evidence: `tests/g3-before.log` failed 22/36 checks for raw errors, lost sign-in on refresh outages, rate-limit retries and repository-rule wording. Further failing regressions (`g3-review-before.log`, `g3-shapes-before.log`, `g3-optional-refresh-before.log`) cover malformed replies, hanging requests and the review findings. `tests/errors.test.mjs` now covers network/server errors, retry, preserved drafts/credentials, cooldown headers and queued requests, uncertain saves/moves/deletes, each Git data response boundary, persistent messages, protected writes and genuine outside edits.
- Fresh reviewer found: (1) a request awaiting token refresh bypassed a newly imposed cooldown; the guard is now checked immediately before fetch too. (2) A later offline save overwrote knowledge of an earlier possibly landed save; retry now reads back before sending newer text, and a failed read keeps that knowledge. (3) Malformed broker token payloads replaced credentials; the complete payload is validated first. (4) A write can land before a 503; 5xx outcomes now use the existing conservative recovery checks. (5) Empty successful replies exposed raw exceptions or false empty lists; explicit response guards reject them. Each has an automated regression.
- The reviewer also confirmed by independent experiments that a recovery read failure sends no PUT, a real outside edit sends no PUT and preserves both versions, and a repository change during recovery sends no delayed PUT. Recovery metadata deliberately remains in memory: after a reload or repository switch, an uncertain earlier commit may conservatively report a conflict. This is not a silent overwrite or lost draft; C1/C3 tests retain the old-SHA draft and give Copy/Discard recovery. README and the repository-change message now explicitly explain that limitation rather than promising effortless recovery across reloads.
- Existing hostile tests first failed 26/28 because they required displaying the server's supplied strings. They now require fixed human retry wording and absence of those strings; every payload-element, execution-tripwire and unexpected-error assertion remains. `tests/switching.test.mjs` passed 33/33 with the new read-before-retry path.
- Full gauntlet attempt 1 failed only `tests/large.test.mjs`: an uncertain save whose remote file grew too large no longer entered the established conflict/Discard state. The test was left unchanged. A refused recovery read now retains that conflict pause; transient read failures still preserve the retry path. Evidence: `tests/screens/g3-gauntlet/run-1.json`.
- Mutation evidence is in `tests/screens/g3-mutations/`: each variant is served in a separate browser process with its own valid CSP hash, leaving the workspace source unchanged. Removing the repository guard alone really wrote alpha's text into beta in the fake and failed the switching assertion; the unmodified app writes nothing there. Other variants cover refresh preservation, token validation, deadlines, both cooldown guards, cooldown duration, JSON/shape guards, every rename boundary, uncertain outcomes, matched/outside versions and persistent messages.
- Viewed `tests/screens/g3-{desktop,phone}-{light,dark}.png`: the persistent outage message and Save button remain visible at 390 px, the draft stays in the real editor and no horizontal overflow occurs. No runtime dependency, build step, new storage key or external host was added. No broker change or deployment is needed for this item. The 90/90 error checks and all 24 Chromium suites passed three consecutive full runs: `tests/screens/g3-gauntlet-2/run-{1,2,3}.json`. All 26 distinct safeguard mutations failed their intended assertions (`tests/g3-mutations.log`, `tests/g3-extra-mutations.log`, `tests/g3-refused-mutation.log`). `index.html` is 127,373 bytes. WebKit remains blocked under F2.

### H1: plan
- Done looks like: README opens with a plain-language Try it section, the shared app link and steps to the first saved note. It clearly says the current shared copy cannot sign in until the owner configures the broker; privacy and shared-owner access are explained without claiming readiness. Self-hosting and architecture follow the user guidance.
- Proof: a test first checks section order, concrete shared link, first-note steps, privacy and deployment-readiness wording; fresh review, all suites three times and four viewed app screenshots.

### H1: gauntlet record
- Test first: `tests/h1-before.log` failed 0/8 because the README began with deployment details. `tests/docs.test.mjs` now passes 10/10 for the shared link, plain first-note steps, honest unfinished sign-in, trust/privacy and section order.
- Fresh reviewer found two exact first-run gaps: New is actually the + button behind Files on phones, and the repository picker needs Save to close. Both steps are now explicit. The phone regression failed before the correction (`tests/h1-review-before.log`); removing either corrected step independently now fails (`tests/screens/h1-mutation-{phone,picker-save}.log`).
- Gauntlet attempt 1 failed the new docs test: a multiline-regex end anchor read only the first line of step 3. Paragraph extraction now uses its blank-line boundary. The owner-trust assertion also formerly matched the preview's unrelated owner mention; it now checks the actual access sentence. The corrected suite is green, and four independent misleading variants (readiness, owner access, phone navigation, picker Save) all fail (`tests/h1-mutations.log`). No runtime safeguard was changed.
- Viewed `tests/screens/h1-{desktop,phone}-{light,dark}.png`: the existing app fits both widths, with Save reachable and clear text. The README now names the phone menu and creation icon seen there. App code stays 127,373 bytes; no build step, runtime dependency or host changed. All 25 Chromium suites passed three consecutive full runs: `tests/screens/h1-gauntlet-2/run-{1,2,3}.json`. WebKit remains blocked under F2.

### H2: plan
- Done looks like: GitHub offers a Bug report template asking for device, browser/version, steps, expected result and actual result, without asking people to share private notes or credentials.
- Proof: add failing documentation checks, create the minimal Markdown issue template, fresh review, four viewed screenshots and three full Chromium passes. No runtime change is planned.

### H2: gauntlet record
- Test first: `tests/h2-before.log` failed the nine new template checks (10/19 overall). The Markdown template now requests device/OS, browser/version and home-screen context, reproducible steps, expected result and actual result; the final docs suite passes 20/20.
- Fresh reviewer found no data, credential or sign-in defect. The reviewer noted that the README template link alone left beginners to find the issue composer; a new failing check (`tests/h2-review-before.log`, 19/20) preceded an explicit new-issue link. No issue was created or sent.
- GitHub documents the name/about frontmatter, directory and default-branch requirement at https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates . The template becomes selectable only after the owner's future merge into main; mvp does not activate it yet.
- Five independent removals (public-report privacy guidance, frontmatter, device, browser, expected result) failed their checks: `tests/h2-mutations.log` and `tests/screens/h2-mutation-*.log`. These variants only changed test-local strings; the files remained intact. No runtime safeguard changed.
- Viewed `tests/screens/h2-{desktop,phone}-{light,dark}.png`: clear existing app layout and reachable Save, no overflow. No runtime code, dependency, build or request changed; index.html remains 127,373 bytes. All 25 Chromium suites passed three consecutive full runs: `tests/screens/h2-gauntlet/run-{1,2,3}.json`. WebKit remains blocked under F2.

### H3: plan
- Done looks like: CHANGELOG.md describes the MVP candidate and its known limits, plainly marked unreleased. It does not imply WebKit, real-phone testing or shared sign-in are ready while F2 and owner setup remain outstanding.
- Proof: failing documentation checks before creation; compare each claim with app behaviour and the ledger, fresh review, four viewed screenshots and all Chromium suites three times. No runtime change is planned.

### H3: gauntlet record
- Test first: `tests/h3-before.log` failed all nine new changelog checks (20/29 overall). The entry now states implemented features, browser draft/conflict limits, files and network limits, separate home-screen storage, CDN fallback and owner trust, with an explicit unreleased status. The final docs suite passes 30/30.
- Fresh reviewer found that "Sign out removes that browser's drafts" overstated cleanup for duplicated session-only tabs. The new regression failed 29/30 (`tests/h3-review-before.log`); the entry now distinguishes shared remembered drafts from the current tab's session drafts and requires signing out in each session-only tab separately. The reviewer confirmed Discard waits for a successful read and the rename itself is atomic; the entry also clarifies that unsaved edits are saved before the rename commit.
- Six misleading wording variants independently failed their checks: release gate, owner setup, copy before Discard, sign-out draft removal, independent session tabs and separate phone storage (`tests/h3-mutations.log`, `tests/screens/h3-mutation-*.log`). No runtime safeguard changed.
- Viewed `tests/screens/h3-{desktop,phone}-{light,dark}.png`: readable app, reachable controls and no overflow. No app code, dependency, build step or request changed; index.html remains 127,373 bytes. All 25 Chromium suites passed three consecutive full runs: `tests/screens/h3-gauntlet/run-{1,2,3}.json`. WebKit F2 and the owner's real-phone/real-GitHub tests remain outstanding; the changelog says so.

### After the MVP: the owner's requests (2026-09-27), in the order agreed
The owner asked for all five; N13 and N14 now, the rest later.

### N13: plan: pin every CDN file to its hash (Subresource Integrity)
- Why: the editor (CodeMirror: one stylesheet, three scripts), the Markdown renderer and its sanitiser run inside the page, with the person's GitHub sign-in in reach. marked and DOMPurify are pinned already; CodeMirror is not.
- Done looks like: every `cdnjs` tag in `index.html` carries `integrity` and `crossorigin="anonymous"`; a changed file is refused by the browser and the app falls back to the plain editor with its visible badge; a check run where cdnjs can be reached (CI) proves each hash matches the bytes cdnjs serves, and fails the build the day they differ.

### N14: plan: conflict recovery without copy and Discard
- Why: today a conflict means "copy your text, then Discard to load theirs": the roughest moment in the app.
- Done looks like: when GitHub refuses a save because the file changed, the app fetches their version and merges it with yours against the version you started from (three-way, by line). Changes to different lines are combined and saved in one commit, and the person is told. Changes to the same lines are never guessed at: the person chooses to keep theirs as the file and save mine as a new note beside it ("… (my copy).md"), or keep editing. Nothing either side wrote is lost in any path; no conflict markers are written into a note.

### N15: plan: pins that follow you between devices
- A note is pinned by a line in the note itself (for example `pinned: true` in its frontmatter), an ordinary property other editors show and keep; the Pinned section lists every such note. No app-specific file in the repository (rule 2). Per-browser pins carry over.

### Owner's requests (2026-09-27, later), in the order agreed
Asked alongside "sync the pins between devices", which N15 already does (merged in PR #11): the owner's screenshot showed the page from before that deploy, so no new item for it. Order: the two small everyday-layout items first (N18, N19), then N16 and N17.

### N18: plan: resize and collapse the file sidebar
- Done looks like: on a computer, the file sidebar can be dragged wider or narrower (a handle on its edge, also usable from the keyboard, within sensible limits) and collapsed to give the note the whole width, with a button to bring it back; width and collapsed state are remembered per browser (UI state, like open folders). Phones keep today's slide-over drawer. No overflow at 1280 or 390 px; the editor refreshes its layout after a resize.

### N19: plan: a light/dark toggle
- Today the app follows the device's setting only (light or dark, by `prefers-color-scheme`); there is no choice in the app.
- Done looks like: a three-way choice, Auto (the device's setting, the default), Light or Dark, in Settings or the header; remembered per browser; applied before the first paint (no flash of the other theme), including the browser's theme colour; accessibility checks still pass in both themes.

### UX review against a desktop notes app (owner's screenshot, 2026-09-28), in the order agreed
Each keeps the rules: notes stay plain Markdown files, nothing app-specific is written into the repository, one HTML file. Small, everyday items first; the items that read many notes (N26, N27, N17) come after the shared note reader recommended in the clean-up assessment, which N26 builds first.

### N20: plan: quick switcher
- Completed 2026-09-29: Find / Ctrl/Cmd+K, 30 repository-scoped recent paths,
  ranked loaded-tree matches, capped at 50 visible results, accessible keyboard
  selection and literal filename rendering. No requests until opening a note.
  WebKit's native Escape closes asynchronously; the test awaits closure before
  asserting it. Existing save-on-leave behavior is used unchanged.
- Final real-editor check caught CodeMirror's macOS Ctrl-K deleting a line
  before the document listener ran. The shortcut now captures the event first.
  Both shortcuts leave text intact in real CodeMirror and the fallback;
  quick-switcher is now 19/19 in each engine. This regression is also a
  mutation proof: the previous bubbling listener failed the new test.
- Combined CI found the existing phone assertion `filename stays legible`
  failing after Find took header space. The filename now gets its own row
  on narrow screens, with compact controls below; the move notice is capped
  at 20% of the visible shell. No assertion changed. App 70/70, keyboard-editor
  24/24 and Padgit 11/11 passed in both engines; updated phone screenshots viewed.
- Ctrl/Cmd+K (and a button on phones) opens a box: type part of a name or path and Enter opens the note; recent notes first, then the best matches; arrow keys, Escape. Uses the file list already loaded, so no extra requests.

### N21: plan: save status and word count
- Completed 2026-09-29 after N20 (`58278fa`). Summary follows the document,
  not transient messages; only confirmed saves get a time. Source word count
  is whitespace-delimited, documented explicitly. No new storage key.
  A save whose reply was lost is never called Saved even if the text was
  undone to its old value. No full-suite reruns during development.
- A small, always-visible line under the note: "Saved", "Saving…", "Unsaved changes", "Not saved: conflict" or "Offline: kept on this device", with the time of the last save, and the note's word count. Replaces guessing from the header's transient messages.

### N22: plan: back and forward between notes
- Opening a note adds it to the browser's history (the address carries the note's path), so the browser's back and forward buttons, the phone back gesture and ← → buttons in the header move between notes. A link or bookmark to a note opens it after sign-in. Leaving a note still saves or keeps its draft as today.

### N23: plan: readable width and text size
- The editor and Preview keep lines to a comfortable width, centred on wide screens (as the screenshot's reading column does), and Settings gains a text size (smaller, normal, larger), remembered in this browser like the theme.

### N24: folded into N32
- Ticking tasks in Preview is now part of N32, which also adds, edits, reorders and removes them.

### N25: plan: formatting toolbar
- A small toolbar for the editor (bold, italic, heading, bulleted, numbered and task lists, link, quote, code), most useful on phones: each inserts or toggles the Markdown itself around the selection, so the note stays plain text. Ctrl/Cmd+B and I format text; Ctrl/Cmd+Shift+K inserts links, keeping Ctrl/Cmd+K for the quick switcher.

### N26: plan: recent notes with previews (with the shared note reader)
- First the shared note reader from the clean-up assessment: one bounded, cancellable reader, with results kept by blob sha, used by search, the pin scan and what follows. Then a "Recent" section in Files: notes opened recently on this device, and notes changed recently in the repository, each with its title (first heading), a short preview and when it changed.

### N27: plan: tags
- Tags from frontmatter (`tags:`) and inline `#tags`, as Obsidian writes them, found with the shared reader; a Tags section in Files with counts, choosing one lists its notes; the open note shows its tags as chips, and adding or removing one edits its frontmatter (like N15's pins).

### N28: plan: outline of headings
- A button shows the open note's headings; choosing one moves the editor, or Preview, to it. Built from the text already open: no requests.

### N29: plan: callouts in Preview
- Obsidian callouts (`> [!tip] Title`, `> [!warning]`, foldable `> [!note]-`) render as coloured boxes in Preview, as in the screenshot and in Obsidian; other editors still see a plain quote.

### N30: plan: recently deleted notes
- A "Recently deleted" view lists notes deleted in the repository's recent history (from commits), and restores one as a new commit of its last version. No trash folder is written into the repository: git history already keeps every deleted note.

### Left out of the UX review, and why
- Reminders: would need notifications from a server, and Notes has none.
- Locked (encrypted) notes: key management and recovery are a project of their own, and an encrypted note is no longer a plain file.
- A rich-text (WYSIWYG) editor: notes would stop being edited as the Markdown they are; the formatting toolbar (N25) and Preview cover most of the need.
- Tabs were left out here, then added at the owner's request (N33).
- Colour labels and notebooks as separate things: folders are the notebooks, and colours would need app-specific data in the repository.

### Owner's requests (2026-09-28), in the order agreed

### N31: plan: About (version and links)
- Settings gains "About": the version (starting at 1.0.0, since the release checks passed), links to the GitHub repository, the privacy note, the changelog and "Report a bug". The version lives in the app and in CHANGELOG.md, and a test keeps them in step. The repository link sits in the deployment block, with room for a support link (empty until N35), so each copy shows its own. Publishing a GitHub release for each version is the owner's call.

### N34: plan: rename to Padgit, served at padgit.com
- Preparation 2026-09-29 after N21 (`2d9edb9`): visible branding renamed;
  notes/storage keys and current working URL retained. Separate cutover broker
  config prepared; no CNAME committed prematurely. Manifest/auth assertions
  now expect Padgit with the original assertions retained. Name web search
  found no obvious software match, not trade-mark clearance.
  Custom-origin tests use the existing navigation shim in Chromium too:
  Playwright does not re-intercept a fulfilled 302's destination. This is a
  test transport constraint, not a change to OAuth behaviour. Await the app's
  loaded state across navigation. Screens `tests/screens/n34-*-{signin,notice}.png`.
- Why: "Notes" is the name of every phone's own app, so this one cannot be searched for or told apart; the owner has bought padgit.com, an address that stays the same whatever hosts it (GitHub Pages serves a custom domain over HTTPS, and redirects the old github.io address to it).
- Done looks like: the app is called Padgit everywhere a person sees a name (page title, home-screen name and label, sign-in screen, messages, README and docs, the privacy note, issue templates); the app and its tests work at `https://padgit.com/` (the deployment block, the broker's allowed origin and redirect address, the README's links); notes, files and storage names (`notes.*`) are unchanged. A notice on the old address, shipped before the switch, asks people to save their changes because browser storage does not move with the address (sign-ins and unsaved drafts stay with the old address; everyone signs in once more).
- The switch is the owner's (Needs the owner): DNS, the Pages custom domain, the GitHub App's callback and homepage, the broker's redeploy, all at the same moment so sign-in never breaks. Check no existing product or trademark uses the name first.

### N32: plan: checklists in any note; the Tasks screen folds in
- The owner's idea: a to-do list is just a note with a checklist. In Preview, task checkboxes can be ticked; a task's text can be edited in place; tasks can be reordered (a drag handle, and move up/down buttons for the keyboard and screen readers); removed (with Undo, as N9); and added (the one-line box at the end of each list). Each change rewrites only the lines concerned, through the one-at-a-time writing of N8, so quick clicks never conflict. Nested tasks move with their parent.
- The separate Tasks screen for pinned notes folds into this: a pinned note opens in Preview, with the same abilities. One way of showing a note instead of two. The toolbar's checklist button (N25) starts a list in any note. Read-only repositories keep checklists read-only.

### N33: plan: tabs
- A row of open notes above the editor: opening a note from the list, the quick switcher or a link adds a tab (or goes to its tab); × closes one; each keeps its unsaved words as a draft (drafts are already per note); the tabs are remembered in this browser; a limit keeps the row usable, and on a phone the tabs fold into a list behind a button. Built after the quick switcher (N20) and back/forward (N22).

### N35: plan: GitHub Sponsors
- The owner's choice for support (2026-09-28), as its own item at the end of the list. `.github/FUNDING.yml` adds a Sponsor button to the repository page, and About (N31) links to the sponsor page from the deployment block's support link. Needs the owner's Sponsors profile first.

### N16: plan: add images to a note
- Paste or drop an image into a note: it is committed as an attachment (the vault's Obsidian attachment folder when set, otherwise beside the note) and linked where the cursor is; size limit and type check; S4 shows it in the preview.

### N17: plan: backlinks
- A "Linked from" list under the open note: notes whose wikilinks or Markdown links resolve to it, found with the same bounded reads as S2's search, with its limits said.

### Owner's review of the built app (2026-09-29), in the order agreed
The owner found the app's look clunky (text buttons, glyphs as icons, three stacked rows of controls), the to-do list still a separate experience, the "Add a task" box on every pinned note, and the ← → buttons confusing (they follow the order notes were visited, which with tabs often reads as reversed). Checked: in a clean history the buttons do go back and forward; the confusion is visit order against the tabs' left-to-right order.

### N36: plan: remove the back and forward buttons
- The header's ← → buttons go. Notes stay in the browser's history (N22), so the browser's back and forward, Alt+←/→ and the phone's back gesture keep working, and note links still open notes. Tests that used the buttons use the browser's history instead.

### N37: plan: one kind of note
- The separate Tasks screen, the "Add a task" box, pinned-only task lists (N8/N9's pinned writing and Undo bar where nothing else uses them) and the Edit note / Tasks switch go. A pinned note is a shortcut at the top of Files and opens like any other note; checklists are edited in Preview (N32) and started with the toolbar's checklist button (N25). Nothing a person could do with a task is lost: tick, add, edit, reorder and remove all remain, in every note. Tests for the removed screen are retired with it, each replaced by the same check against Preview checklists where the ability remains.

### N37: tests changed with the Tasks screen
- Tests that typed into the "Add a task" box only to make a write happen (auth, auth-renewal, privacy, vault, delete, access, eol) now tick, edit or save the same note instead; what they check is unchanged.
- Tests of the capture box itself (capture-recovery, app's capture checks, empty, large, keyboard, release-races) check the same guarantee for Preview edits: failed edits are kept as drafts, over-limit edits are refused and stay in the field, the edit field stays above a phone keyboard, queued edits survive a repository change.
- Tests of the Tasks screen and its switch (pinned-tree, pins-sync, hostile, tasks) now open the pinned note like any note and use Preview. Retired with no equivalent: merging queued captures into a dirty editor's draft (it can no longer happen, because Edit waits for a checklist save in flight; release-races checks that instead) and reading a pinned list with no note open (replaced by: alpha's checklist is not left showing under beta).
- G-3 review (fixed, each with a test): an Undo offer followed New note or Today into another note and would have written to the first; Undo could commit unsaved typing past the checklist lock; the pinned shortcut stayed marked after its note closed; a slow checklist reply could roll the editor back after the note was saved again (older race, reachable via ★).
- Found while doing this: after Settings were saved, Remove in Preview did nothing, because the cache was emptied under a view that was still shown. Fixed; tasks' "another list: setup" catches it.

### N38: plan: visual redesign
- A design pass over the whole app, not piecemeal tweaks: one inline SVG icon set (openly licensed, no extra requests); a small family of buttons (icon, subtle, primary) with one size and radius; a calm header (file list, the note's title, save status, an Edit/Preview switch, and a ⋯ menu for Rename, Delete, Outline and Tags); tabs that look like tabs; one icon toolbar; sidebar sections (Pinned, Recent, Tags, Files) with consistent rows, icons and counts; a type scale and spacing tuned for reading; both themes; phones.
- First a static mock-up (desktop and phone, light and dark) for the owner's approval; then the build, with accessibility (axe) and every existing behaviour kept. Needs size headroom: `index.html` is 201 KB of 200 KB; N36 and N37 free some, and the owner may be asked to raise the limit (e.g. to 250 KB).

### N38: tests changed with the redesign
- Rename, Delete and Outline moved into the note's ⋯ menu, and a task's Edit, Move up, Move down and Remove into its ⋯ menu: tests open the menu first (`H.noteAction`, `H.taskAction`) and check what is offered with `H.inMenu`; what they check is unchanged. Tags opens from the menu (tags suite adds a check that it does).
- hostile and preview counted every `svg` as a payload; the app now draws its own icons as `svg`. Both now exempt only the exact icon shape (`<svg class="i" aria-hidden="true">` holding one `<use href="#i-name">`); any other `svg` still counts.
- theme and manifest: the dark background is now #151816 (was #16181c).
- note-tabs: on phones, open notes are one scrolling row of chips (approved design) instead of a folded list.
- keyboard: the Android resize check opens a note first, because the save status only shows while a note is open. accessibility: on phones the quick switcher opens without its header button, which phones no longer show (search is in the Files sheet).
- sidebar: the empty-state hint names the button at the top left instead of ☰.
- G-3 review (fixed, each with a design check): the save status said Saved while a save was on its way; on a phone the note's name vanished during a conflict; focus was lost after a ⋯ action's dialog; menus stayed open after tabbing out, and (on iOS) after a tap on plain text; closing one task menu closed another; tabs with the same name looked alike and the open chip could be off-screen; the Pinned chip accepted values the pin check does not; messages said "Press Edit" where phones show a pencil.

## Needs the owner

- **GitHub Sponsors for N35:** set up the Sponsors profile (github.com/sponsors) for the account that should receive support (your personal account, or the forwardmotionnz organisation) and say which. Whether each version is also published as a GitHub release is your call.
- **Padgit cutover for N34:** preparation is built. Follow [the migration checklist](../padgit-migration.md): confirm the name; publish the notice and save/copy drafts first; verify the domain, claim it in Pages before pointing DNS, wait for HTTPS, update the existing App and deploy `broker/wrangler.padgit.toml`, then verify sign-in/save. Update the default broker config and README link after success. The repository need not be renamed. This corrects the earlier DNS-first order using GitHub's guidance.

- **Community readiness (2026-09-27), three settings only the owner can change:**
  1. Settings → Code security → **Private vulnerability reporting**: enable it, so the "Report a vulnerability" button that `SECURITY.md` and the issue chooser point to exists.
  2. Settings → Actions → General → *Approval for running fork pull request workflows from contributors*: keep **Require approval for first-time contributors** (GitHub's default). The tests workflow uses no secrets, so forks get none.
  3. github.com → Settings → Emails: tick **Keep my email addresses private** and **Block command line pushes that expose my email**, and set git's `user.email` to the GitHub noreply address. Earlier commits keep the address they were made with; removing it would mean rewriting `main`'s history (a force-push), which is not recommended.

Account setup has already been completed. Do not repeat login, deployment,
secret generation or App visibility changes as part of this release.

- **Broker and CLIENT_SECRET: complete.** The owner confirmed the secret name and deployed Worker at https://notes-token-broker.forwardmotionnz.workers.dev. Live probes on 2026-09-27 confirmed allowed-origin OPTIONS 204, empty POST 400 bad_request, and unrelated-origin OPTIONS 403. The existing live Pages site already uses this broker. A real sign-in remains part of the smoke test; these probes did not exchange a token.
- **GitHub App visibility: complete.** The owner confirmed on 2026-09-27 that forwardmotion-notes had already been made public the previous day. Client ID, callback and authorisation settings were also checked during the walkthrough.
- **Merge authorised.** On 2026-09-27 the owner explicitly asked to update these stale instructions, merge mvp into main and continue. Integrate the newer main fixes and validate the combined app, then use the repository's pull-request flow. Do not bypass branch protections.
- **Real-device and real-GitHub smoke tests remain.** Follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md): second account on a phone, empty repository, organisation repository, Obsidian attachments, session-only mode, revocation and two tabs overnight. These checks need the owner's accounts and physical devices; automated simulations do not establish them.
- **CodeMirror Subresource Integrity: done in N13** (2026-09-27). If a CodeMirror version is ever changed, the CI job `CDN files match their integrity hashes` prints the new hashes to copy in.

### C1: gauntlet record
- G-1: full suite green three runs in a row, Chromium (WebKit arrives with F2).
- G-2: each safeguard reverted alone and caught: draft write, draft keeps its base sha, sign-out deletes drafts, session-only store, move on mode switch, signed-in guard, drop when clean, clear on commit, drop on confirmed discard, New reopens a draft, sign-out confirm names drafts, other tab's draft kept, Discard only after a successful fetch.
- G-3 findings: (1) accepting "Discard unsaved changes?" kept the draft, so it came back one Save from commit: fixed, test. (2) New on a path with an uncommitted draft overwrote it: fixed, test. (3) Sign-out deleted drafts without saying so: confirm now names them, test. (4) Saving in tab A deleted tab B's newer draft on the same file: fixed (only a draft this tab wrote, or one matching the commit, is dropped), test. (5) Drafts stranded in the wrong store after signing back in session-only: refuted, since sign-in always ends in `saveSettings`, which moves them; test "session-only sign-in moves drafts off disk" passes and fails when that move is removed. (6) Discard offline dropped the draft and left a dead editor: fixed (dropped only after GitHub's version arrives), test.
- Accepted, with reason: two tabs typing into the same unsaved file share one draft, so the later keystroke wins. Both texts are edits of the same file by the same person, and C2's autosave will narrow the window. A commit whose response is lost leaves a draft on the old sha: the next open reports a conflict and nothing is overwritten, so it is safe, if unfriendly.
- Tests corrected, not weakened: "draft survives visiting another file" assumed that answering OK to "Discard unsaved changes?" keeps the draft, which is finding (1). It now checks that declining keeps the draft, and a new test checks that accepting discards it. The sign-out test got its second draft by switching files, which now discards it; it plants the second draft in storage instead.
- G-4: phone header overflowed with the restore message; status now wraps to its own line under 820 px and the crumb tag truncates before the filename does. Screens above, no horizontal overflow at 390 or 1280, light and dark.
- G-5: no new dependency, no new request, `index.html` 59.7 KB. G-6: README describes drafts, Discard, and session-only drafts not surviving a browser close.

### C2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: in-flight guard, touched/conflict check, setValue not counted as typing, save on hide, debounce, conflict flag, leaving guard (both places), queued save tied to its file, in-flight text not treated as unsaved, lost-reply check on content, lost-reply recovery. The duplicate conflict check in `scheduleAutosave` was removed because no test could notice it.
- G-3 findings: (1) text discarded by switching files was autosaved while the next file loaded, or on hide: fixed (leaving guard, timer cleared), two tests. (2) Discard committed the draft it was throwing away: fixed by the same guard, test. (3) A queued manual save committed a different file's untouched draft: fixed (queue tied to the open file), test. (4) Switching during "Saving..." asked to discard text being saved, then lost it if the save failed: fixed (in-flight text is not unsaved; draft kept until confirmed), test. (5) A commit whose reply was lost made the next save a false conflict: fixed (on conflict, if GitHub holds exactly our last unconfirmed text, carry on from its sha), two tests incl. a real conflict after a failure. (6) Ticking a pinned task in the open file while it has unsaved edits leads to a conflict: accepted. Nothing is overwritten, the file really did change on GitHub, and taking the tick silently would drop it from the editor's text.
- Hollow tests caught: two review tests planted drafts with no sha, so any commit failed as a conflict and the test passed regardless. Fixed to use the real sha; both now fail when their guard is reverted.
- Test fixes, not weakening: the CodeMirror stub now fires `change` on `setValue` with its origin, as CodeMirror 5 does. The drafts suite's reloads now refuse commits during the reload (`reloadUnsaved`), because a reload hides the page and autosaves; those tests model the page dying before that commit gets out. The harness no longer crashes answering a request that a navigation cancelled. Removing a page route while requests were in flight let them reach the real network (seen as `ERR_CERT_AUTHORITY_INVALID`), so the hold is a flag, not a route that is removed.
- G-4: the conflict state is visible in the crumb ("conflict, not saved"), the status and the Discard button, with no overflow at 390 or 1280 px in light or dark. G-5: no new dependency or request, `index.html` 62 KB. G-6: README describes autosave and the conflict stop.

### C3: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: commit on leaving, untouched template dropped, draft moved onto the new commit only if this tab wrote it, leaving before a change of repository, reopening waits for a commit of that file, a failed open brings the old file back, lost-reply recovery confined to its repository, draft key captured before the repository changes.
- First G-2 pass found three safeguards no test noticed (draft rebase, which document a commit updates, failed open); tests added. Working it through showed that tying the commit to "same path" gave a false conflict when a file was reopened mid-commit. The fix is the wait-for-commit, so the success handler updates only the document that saved.
- G-3 findings: (1) a second tab's old draft was moved onto a commit it never saw, which let it overwrite that commit silently: fixed, since only text this tab wrote is moved; test. (2) Reopening a file during its commit showed the old text as an unsaved draft, and Discard then left the screen out of step with GitHub: fixed, since reopening waits for the commit; test. (3) A lost-reply retry after a change of repository could read, and write, the wrong repository: fixed, since recovery only runs in the repository the save began in; test. Gap: text typed while the next file loads had no assertion; one was added. Pre-existing offline sign-out noted under G3.
- Tests rewritten because they encoded the removed `confirm()`, with nothing weakened (the reviewer checked each): drafts "declining the discard keeps the draft open" became "an untouched restored draft is not committed on leaving, and comes back"; drafts "a draft you chose to discard does not come back" became "text committed on leaving does not come back as a draft"; autosave "discarded text not committed while the next file loads" (and its hidden-page twin) became "the file left is committed exactly once and nothing else is", plus a check that text typed during the load comes back as a draft. The fake GitHub now records which repository each commit went to (logging only, no new API behaviour).
- G-4: nothing new on screen. The change removes a dialog; the notices it relies on are C1's and C2's, already screenshotted. G-5: no new dependency or request, `index.html` 65 KB; the remaining `confirm()` calls are Discard and Sign out, which are deliberate destructive actions, not switching. G-6: README says switching never asks and what happens to the text.

### G2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: every text sink the test claims to cover was turned into HTML one at a time and caught: file row, folder row, header name, header folder, header branch, status, task text, pin heading, pin tab, pin error, empty-pin notice, login, sign-in error; the source scan catches `innerHTML` including `el["inner"+"HTML"]`. Prototype-free maps each reverted alone and caught: tree folders (top and nested), open-folder state loaded from storage, pin cache at load and after Settings. On the first pass two reverts went unnoticed: the reload in the test replaced one map, and a folder never toggled was the untested case. The test now checks pins before and after the reload, and an untouched `valueOf` folder.
- G-3 findings: (1) a folder named `constructor`, `__proto__`, `toString`… emptied the whole tree (and a pin with such a name broke the pin pane): fixed with prototype-free maps, tests. (2) Four sinks were listed but not exercised (repository label, header folder, pin error, empty-pin notice): three now carry payloads in the test. The repository label is refuted as unreachable: GitHub restricts owner and repository names to letters, digits, `.`, `-` and `_`, and the label is built with `new Option(text)`, which cannot parse HTML. A fake that returned `<` in a repository name would describe a GitHub that does not exist (rule 6). (3) A new comment credited a CSP that is not there yet: corrected. The regex dodge `el["inner"+"HTML"]` is now caught by the scan. Findings (4)–(7) are real but outside G2 and are now ledger items N1–N4 (CRLF drafts, session-only lost via "Choose repositories", storage-event sign-in flash, crafted error link).
- G-4: rows rebuilt without `innerHTML` look as before; hostile names show as plain text, light and dark, 1280 and 390 px. Long names are clipped at the sidebar edge as before (unchanged). G-5: no new dependency or request, `index.html` 66 KB. G-6: nothing a user would notice changed, except that folders with those names now show up; no doc claimed otherwise.

### G1: gauntlet record
- G-1: full suite green three runs in a row, Chromium, with the policy on for every suite.
- G-2: each directive loosened alone and caught (connect-src opened, img-src opened, no form-action, no base-uri, no default-src, `'unsafe-inline'` added), and the broker check switched off (with the hash recomputed so only that changed).
- G-3 findings: (1) BLOCKER: filling in `DEPLOYMENT` as the README said changed the hashed script, so a real fork got a dead page. The tests missed it because they injected settings instead of editing the file. Fixed: settings live in a `<script type="application/json">` data block, which is not code and not hashed. The policy is split in two: the app's own (hash, images, forms, base) and the copy's own (connect-src only). A fork edits only the second, so merging upstream never conflicts with the hash. New test: a page filled in exactly as the README says, with nothing injected, signs in end to end. (2) A fork's `npm test` stayed red and never printed the hash: the harness now rewrites the copy's policy whatever broker it holds, and the CSP suite runs first. (3) Windows line endings would print a hash that does not match the served file: `.gitattributes` pins `index.html` to LF. (4) The broker check rejected trailing slash, upper case, wildcard, no scheme, port and path forms the browser accepts: now matched per the CSP source grammar, 13 cases tested (it also caught a gap in my first version: a scheme-less source on an http page also allows https). (5) With a wrong broker entry, users already signed in are signed out at the next refresh: this is the "unreachable broker signs you out" bug already noted for G3, and fixing it there covers this. (6) "Nowhere else" overclaimed: navigation (location, window.open, links, meta refresh) and DNS prefetch cannot be stopped by any CSP. The policy comment, the test and README Known limits now say so. The WebSocket result is now asserted through the violation report. Writes through GitHub itself (e.g. into a public repository) cannot be stopped by CSP either; that is what G2's "nothing gets in" is for. No integrity hashes on the CodeMirror tags: cdnjs is unreachable from here, so steps are in Needs the owner.
- G-4: the new "broker not allowed" notice is legible at 1280 and 390 px, light and dark. G-5: no new dependency, no new request; `index.html` about 70 KB. G-6: README step 4 rewritten for the data block and the copy's policy; Known limits says what CSP cannot stop.

### N1: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: normalise on read, restore on write, CR detection, majority ending, pins using the file's endings, positional pairing, the line diff (LCS), the size cap (removing it runs a 30,000² table out of memory), BOM kept, non-UTF-8 refused, base refreshed after a save, lost-reply compared by bytes, blank-after-CR fix. The final "reads back as typed" check is a deliberate backstop that cannot fire while the CR fix holds: removing it alone is invisible, removing both makes the fuzz fail after 96 cases.
- G-3, first review: (1) a mixed file had untouched lines rewritten to the majority ending, against the item's own rule; my first version asserted that behaviour. Replaced by per-line endings. (2) A lone CR became a line break on save, now silently: kept, since each line carries its own ending. (3) The lost-reply check compared normalised text, so a commit differing only in endings was taken for ours: now compared byte for byte, test. (4) A UTF-8 BOM was dropped on save, and (5) a Windows-1252 file was destroyed on save. Both are older, but N1 would have made them silent. The BOM is now kept; non-UTF-8 files are refused like attachments; tests. (6) Files over 1 MB open empty and a save overwrites them: older and separate, now ledger item N5.
- G-3, second review (a fuzzer, about 1.2 million cases): (1) a typed blank line after a line ending in a lone CR merged into one CRLF, so the line was lost: fixed, the empty line ends in CR, with a reads-back-as-typed backstop; tests with the exact counterexamples. (2) Greedy matching let a blank line jump ahead, giving untouched lines new endings: replaced by a longest-common-subsequence diff (capped); tests. (3) After a save the next save still compared with the file as first opened: the base is refreshed. I had removed that line in G-2 as unobservable; the reviewer showed a case, and it is now tested. My own seeded fuzz first used a broken generator (float overflow, so almost no variety) and passed without the fix; it now uses `Math.imul`, and fails in 223 cases without the fix.
- G-4: nothing new on screen; a refused non-UTF-8 file uses the existing status line. G-5: no dependency or request; `index.html` about 75 KB. G-6: README (Obsidian section) describes line endings, the BOM, and non-UTF-8 files.

### N2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each change reverted alone and caught: automatic sign-in on return, "Forget me" pre-ticked, new-tab link, refresh on coming back, stale list ignored, list fetched once on return, unsaved pick kept on refresh.
- Rewritten test: the old "install redirect restarts a proper sign-in … and you end up signed in" asserted the defect itself (an automatic, remembered sign-in nobody chose). It now asserts that nobody is signed in by a return, and that one click signs in with the person's own choice.
- G-3 (checked against GitHub's docs source, since docs.github.com was blocked): with "Request user authorization during installation" on, as the README asks, GitHub returns the browser only after a first install; changing repositories later never comes back. (1) My first fix (same-tab link) would therefore strand people on github.com, and Back could show the stale list. Reverted to a new tab, and the Notes tab refreshes its list when it becomes visible again; the hint says so. (2) After a first install in a signed-in tab with no repository yet, the list was fetched twice, and a slow second answer could reset the person's pick so Save committed notes to the wrong repository (reproduced): only the newest list is used, the return opens settings once, and a refresh keeps an unsaved pick; tests. (3) A session-only person whose return lands in a fresh tab could still be remembered by clicking "Sign in" as the note invited: "Forget me" starts ticked there and the note points them back to their Notes tab. Not verified: whether an organisation member's install *request* returns with a code; it only affects apps registered under an organisation, not the README's setup.
- G-4: the return note and the new hint are legible at 1280 and 390 px, light and dark. G-5: no dependency or request, `index.html` about 77 KB. G-6: README step 5 describes the new-tab flow, the refresh on return, and "Forget me" on a return.

### N3: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each change reverted alone and caught: remove-first in Settings, remove-first in sign-in, session copy left on switching back, following another tab's settings, committing the open file before following, pins-only follow, the in-flight refresh check. Two checks proved redundant and were removed: an explicit sign-out throw, covered by "what we hold is not what we spent" plus the existing empty-token guard. My first in-flight test expired every token, so the other tab waited on the refresh lock and the race never happened; it now refreshes one tab alone and fails without the fix.
- G-3 findings: (1) caused by this fix: a tab that now stays signed in kept its old repository and pins in memory and wrote them back at its next token refresh or Settings open, undoing another tab's change (reproduced). Tabs now follow shared settings, first committing or keeping as a draft what was open, against its own repository; tests. (2) Older: a refresh in flight when another tab signed out or chose "Forget me" wrote the token back to disk (reproduced for both). The result of a refresh is now discarded when what the tab holds is no longer what it spent; tests. My new comment had claimed this was covered; it was not until now. (3) The same root cause as (1) for folder state; covered by following.
- G-4: nothing new on screen. G-5: no dependency or request; `index.html` about 79 KB. G-6: README says tabs share settings and what signing out in one does.

### N4: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each change reverted alone and caught: error honoured without a pending sign-in, state not checked, GitHub's description shown, a stray code reported over a signed-in tab, a lost-state sign-in silent, "Forget me" not restored after a cancel, the choice lost after a failed exchange. Two of my own checks were hollow at first: a mutation that operator precedence neutralised (redone), and a "Forget me" test whose expected value equalled the default (now tests the remembered choice).
- Tests changed: hostile "error_description from the URL shown as text" became "never shown", because showing it was the defect. My first new test expected silence for a signed-out crafted link; after the review it expects the fixed "did not finish" wording, and still fails without the state check.
- Rule 6: the fake's `access_denied` redirect lacked `state`; GitHub's documentation (troubleshooting-authorization-request-errors, fetched from github/docs) shows `error`, `error_description`, `error_uri` and `state`. Fixed, with the URL beside it.
- G-3 findings: (1) a real sign-in returning to a tab that lost its state (iOS discarding a tab during 2FA, blocked storage) failed with no word: now fixed wording, test. (2) Older: "Forget me" reset after a cancel or failure, so the retry stored the token on disk (reproduced): the choice is carried through, ticked when unknown; tests. (3) A signed-in tab could still be interrupted by a mismatched code: ignored now, test. (4) A crafted `setup_action` link opens Settings for a signed-in person: refuted as harmful, since it is N2's intended landing after a real install and its text is fixed.
- G-4: the only visible changes are fixed messages in the existing sign-in error note. G-5: no dependency or request; `index.html` about 80 KB. G-6: no documented behaviour changed; README does not describe error links.

### N5: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: tree marking, `encoding: "none"` refusal, the `too_large` message, draft rescue, the moved draft dropped, save refused past 1 MB, pinned task refused past 1 MB, recovery read failure reported as a conflict, LFS pointer refused. A guard in `openFile` duplicated the one in `readFile` and was removed.
- Rule 6: GitHub's OpenAPI description (github/rest-api-description) and docs say files of 1–100 MB come back with `content: ""` and `encoding: "none"` for the `object` type, and that tree entries carry `size`; the default media type is left unspecified, so the app handles both that and a 403 `too_large`, and the test covers both. The exact byte threshold is only given as "1 MB"; the app uses 1,048,576. A file between 1,000,000 and that would look openable but is still refused on reading, and nothing is written.
- G-3 findings: (1) a draft whose file grew past 1 MB elsewhere became unreachable: it now opens as a new note beside the file; test. (2) The app saved notes past 1 MB, which it then could not reopen, and after a lost reply the recovery read failed with a misleading message, stranding later text: saves (and pinned tasks) past 1 MB are refused and kept as drafts, and a recovery that cannot read the file reports a conflict; tests. Found while testing (2): a refused pinned task cleared the capture box, losing the text; it is kept. (3) Older, same class: a Git LFS pointer opened and a save replaced the real file at HEAD: pointers are refused; test.
- G-4: the greyed large file and the rescue note are legible at 1280 and 390 px, light and dark. G-5: no dependency or request; `index.html` about 84 KB. G-6: README (Obsidian section and Known limits) covers the 1 MB limit, the rescue copy and LFS files.

### B1: gauntlet record
- G-1: full suite green three runs in a row, Chromium. The first three runs caught a fake inconsistency: one global default branch while the repository list gave each repository its own, so a repository whose default is `trunk` was "followed" to `main`. The fake now takes each repository's own `default_branch` (an explicit override models a rename the list has not caught up with), and the auth suite's `trunk` case passes again.
- G-2: each change reverted alone and caught: 409 "empty" only by GitHub's words, following a vanished branch, a failed load not looking empty, the old repository's files cleared on a switch, the tree refreshed after a first pinned task, a failed task put back, no branch named in an empty repository. Two removed as unobservable: clearing the empty flag on a write (the refresh after the first save does it), and resetting it on each load (a failed load now says "could not load" whatever the flag, and a write without a branch lands on the default branch anyway).
- Rule 6: GitHub's Git database guide says the API answers 409 for a repository that is empty *or unavailable*, and that a contents PUT initialises an empty one; the contents PUT's `branch` defaults to the default branch; trees, contents GET (`ref`) and contents PUT (`branch`) all list 404; the repository object carries `default_branch`. All modelled with URLs in the harness. Not documented, so not modelled: what an empty repository's `default_branch` reports, and what a PUT naming a branch in an empty repository does; the app avoids depending on either.
- G-3 findings: (1) any 409 was called empty, including a repository still being created: now only when GitHub's message says empty; others get their own message; test. (2) The "empty" message outlived the empty repository after a first pinned task, and after switching to a repository whose list failed: the tree refreshes after a first task, and a failed load says "Could not load the files"; tests. (3) After a first push from elsewhere created "master", saves and reads diverged; together with the older problem of a renamed default branch, the app now follows the repository's default branch when its branch has gone, and says so; test. (4) Not verifiable: with a failed first load the app does not know the repository is empty, and names the branch on the first save; GitHub does not document the result. The app now says the list could not load rather than looking empty, so the person retries first. Older (B): a pinned task whose save failed was lost from the box: put back; test.
- G-4: the empty-repository message is legible at 1280 and 390 px, light and dark. G-5: no dependency or request beyond GitHub's API; `index.html` about 87 KB. G-6: README has a short section on empty repositories and a followed branch.

### B3: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: `archived`, `push:false`, asking at all, the editor locked on open and when created later, Save guarded, the capture and checkboxes disabled, a gone repository locked and its list cleared, nothing sent before access is known (task and save), a late answer ignored, the badge tappable. Removed as unobservable: guards in `commitPin` and `newFile` behind controls that are already disabled or hidden, and comparing the repository name when the sequence number already discards a late answer.
- Rule 6: `archived` and `permissions` (incl. `push`) are documented on the repository object, also in the installation's repository list. What a contents PUT answers for an archived or read-only repository is not documented (only 404/409/422 are listed), so the app decides before writing, and the fake refuses and counts any write it should never have received.
- G-3 findings: (1) pinned capture, checkboxes and saves could write before the access answer arrived (the check ran after the tree): it now runs alongside, and writes wait for it; test. (2) A late answer about one repository was applied to the one switched to, locking a writable one or unlocking an archived one: ignored now; test. (3) A repository that is gone left the open note editable and failed the save: locked with its reason; test. (4) On a phone the reason vanished after 7 s (touch shows no titles): tapping the badge says it again, and a draft restored in a read-only repository says to copy it out; test for the badge. Noted for G3: branch protection and rulesets refuse writes with 409/422, shown as "Conflict". Unverified: whether a user token's `permissions.push` also reflects the app installation's rights; if the owner granted the app only read, writes fail with the old 403 message, which README step 2 prevents.
- G-4: the badge and reason are legible at 1280 and 390 px, light and dark; Save and New are hidden. G-5: no dependency or request beyond GitHub's API; `index.html` about 91 KB. G-6: README has a section on repositories you cannot change.

### A1: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each change reverted alone and caught: paging at all, not stopping at a short page, not needing a total, one failure isolated, at most four at a time, the repository in use kept, Save before the list, the approval note, the "could not be listed" note. G-2 also found a fault before the review: requesting pages of 30 (as if GitHub served fewer than asked) stopped after the first page, because a short page was taken as the last. Paging now ends at `total_count`, or at an empty page, and both cases are tested.
- Two auth tests matched the old list URL exactly; one would have passed without testing anything (its slowing route no longer matched). Both now match the paged URL; the stale-list test was reverted and shown to fail again.
- Rule 6: both installation endpoints are documented with `per_page` (default 30, max 100), `page`, `total_count` and `Link`; the fake pages accordingly, with URLs in the harness.
- G-3 findings: (1) one failing installation (suspended, SAML, a 5xx) emptied the whole list and locked a first-time user out: the rest are listed, with a note; test. (2) Hundreds of installations meant hundreds of simultaneous requests, against GitHub's guidance: at most four at a time; test. Not changed: each Settings open still costs about one request per 100 repositories per installation plus one per installation; recorded here as the known cost. (3) A repository shifting between pages dropped the one in use, and Save then silently switched to the first: the repository in use is always kept and selected; test. (4) An install awaiting an organisation owner's approval was described as done: it now says the owners have been asked; test. Not verified: whether GitHub puts a code on that return; handled either way. (5) SAML SSO hides an organisation's repositories silently; the app cannot tell, so README explains the fix. (6) A slow list locked pins and "Forget me": Save works at once with the repository in use; test. Older, not changed: `redirectUri()` is the page's own path, so a link to `/notes/index.html` would not match a callback of `/notes/`; noted for H1's "Try it" link.
- G-4: nothing new on screen but the hint's wording. G-5: no dependency or request beyond GitHub's API; `index.html` about 94 KB. G-6: README step 2 says *Any account*, and a new "Sharing your copy" section covers others signing in, organisations, approvals and SAML.

### D1: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: the version check at head, both existence checks, the retry on another commit, fast-forward only, pins following, saving first, the lock (and that a refresh cannot lift it), re-pointing instead of re-reading, telling other tabs, checking a lost reply, keeping the extension, refusing unopenable targets, paths through a file and links, and no-store. The first G-2 pass found that `force: true` went unnoticed because my fake applied only the changes; it now builds each tree from its base like git, so a forced update really drops what came between, and the test catches it.
- Rule 6: git refs (get, update with force false: 422 if not a fast-forward), commits (get, create with parents), trees (create with base_tree; a null sha deletes) follow GitHub's docs, with URLs in the harness. Not modelled: symlink contents (the app refuses modes other than 100644/100755 instead), HTTP caching (the app asks for no-store), a nested path through a file (the app refuses first).
- G-3 findings: (1) another tab with the old path open would recreate it: tabs are told over BroadcastChannel (no storage, so session-only mode is unaffected) and their note, draft and pins follow; test. Another device editing the old path is the same as a file deleted elsewhere: its save fails as a conflict; noted for D2 and G3. (2) Words typed right after a rename were lost while the file was re-read: the note is re-pointed instead, same content, no window; test. (3) A refresh during the move unlocked the note: the lock holds; test. (4) A move whose reply was lost said "Not renamed": the app checks whether it landed; test. (5) Renaming to a name the app cannot open stranded the note: a missing extension keeps the note's own, and unopenable names, dot-folders and paths through a file are refused; tests. (6) GitHub's 60-second cache could serve a stale head or list: all GitHub requests are no-store; test. (7) A symlink would have been rewritten as a file holding the note's text: links and unknown modes are refused; test. (8) A nested path through an existing file: refused before asking GitHub; test. Minor, not changed: a 409 from the git endpoints reads as "the file changed", which fits G3's error wording.
- G-4: Rename sits beside the file name in the header, legible at 1280 and 390 px, light and dark, with no overflow. G-5: no dependency or request beyond GitHub's API; `index.html` about 101 KB. G-6: README lists Rename under "What it does".

### D2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught: asking first, naming unsaved changes, the lost-reply read-back, 404 as done, a double tap ignored, the pending autosave cleared and saves held during the delete (incl. switching apps), waiting for a pinned task, unpinning, the Discard wording, the empty editor locked, other tabs told, the other tab's words kept (as a new note, and its draft re-based), and the deleting tab leaving another tab's draft alone. Two safeguards first covered each other in one test; each now has its own case (a tab that never hears, and the draft's base).
- Rule 6: the contents DELETE (message and sha required; 404, 409, 422 documented) is modelled with the URL in the harness. GitHub's docs say contents writes must not run in parallel; the fake does not model that conflict, so the test checks the order of requests instead.
- G-3 findings: (1) the deleting tab dropped another tab's draft, whose words were then lost on leaving: a tab drops only a draft it wrote, and the other tab re-writes its own as a new note's; tests. (2) After a delete the empty editor took typing into nowhere: with no note open the editor is locked; test. (3) The recovery promise was true but unusable: the confirmation now says how (the "Delete ..." commit on GitHub) and "as long as the history is kept", and the done message stays up longer. (4) Delete did not wait for other writes: it waits for saves and pinned tasks in flight; test. (5) An already-deleted file said "Not deleted": counts as done; test. (6) A double tap said "Not deleted": ignored while one is in flight; test. (7) "Open it again first" was a dead end for a stale draft: now points to Discard; test. (9) A deleted pinned file stayed pinned and a task would recreate it: unpinned, and said so; test. (10) "No files." after the last delete now says to press +. Left for G3: raw network error text, and a lost reply where the file was recreated meanwhile (reported as not deleted; nothing lost).
- G-4: on a phone the header had no room for Rename and Delete beside a long name, which overlapped them. On narrow screens they are now icons (pencil, bin, with labels for screen readers), and a long name gives way with an ellipsis after the folders. Checked at 1280, 390 and 320 px, light and dark: no overlap, no overflow. G-5: no dependency or request beyond GitHub's API; `index.html` about 107 KB. G-6: README describes Delete and how to recover.

### E1: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught (14 mutations): dot-folders ignored, shortest path by depth, then by length, no offer to create before the list has loaded, nor from a partial list, nor when read-only, nor outside the repository; a plain mouse click only places the cursor; a link's edges on both sides are not the link; a table's `\|` is not part of the name; a link always makes a `.md` note; the folder's existing spelling is used; + with "Release 2.0" makes a note. The fixtures list the wrong candidates first, so a missing rule cannot pass by the order it meets them. Not caught: `configureMouse` (Ctrl-click adding no second cursor), which only real CodeMirror shows and the CDN is unreachable here; it changes no text.
- Rule 6: `truncated` in the fake's tree follows GitHub's tree docs (URL in the harness).
- G-3 findings: (1) `[[Release 1.2]]` or `[[Node.js]]` created a file with no `.md`, which the app then refused to open, stranding any draft: a link always makes `<name>.md`, as Obsidian does, and + adds `.md` to a name that is not a text file; tests. (2) A tap just after a link at the end of a line followed it, so there was no way to tap in to carry on typing: the edges no longer count; test. (3) A tap inside a link follows it, so a phone user cannot tap in to fix a typo in a link: by design (the criterion), stated in the README with the way round it (tap just before or after). (4) `[[projects/Q4]]` created a second folder beside `Projects/`: a new note uses the folder's existing spelling; test. (5) A partial (truncated) or stale list offered to create a note that might exist, ending in an alarming conflict: no offer unless the list is freshly and fully loaded; tests. (6) The stub has no `coordsChar`: noted above; the edge fix in (2) covers the end-of-line case real CodeMirror would hit.
- G-4: `tests/screens/e1-{desktop,phone}-{light,dark}-{refused,followed}.png`. The message fits on a phone; no overflow. G-5: no dependency or request added; `index.html` about 112 KB. G-6: README describes following and creating links, and no longer lists wikilink navigation as something the app does not do.

### B2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each safeguard reverted alone and caught (21 mutations), each by the test written for it: steps only for a list that came back whole and empty; a partly failed or failed list named where it can be seen, with Try again, on the steps or not; the steps kept through a failed check; the form back once repositories exist; Save and the form hidden while the steps show; a neutral "looking" view while the first list loads; the "still" and "checking" messages, and Check now disabled while it runs; Check now and Try again wired; step 2's link; before a repository is in use, a private `notes` preferred, otherwise a private one, otherwise nothing chosen (Save waits); a public repository named as such when chosen, and never chosen by itself even when it is the only one. Two mutations first left a dangling `else` and so broke the whole script; rewritten so each removes only its own rule.
- Rule 6: the pre-filled form is `https://github.com/new?name=notes&visibility=private`, parameters as GitHub documents them (URL in the test; invalid ones are ignored).
- G-3 findings: (1) After the steps, with GitHub's default "All repositories", the first repository alphabetically was preselected, which could be public, and a single public repository was chosen without asking: before a repository is in use, nothing public is chosen for anyone; the private `notes` is preferred; choosing a public one says anyone can read it; tests. (2) A list with an account that did not answer (SAML, suspended) left the steps saying nothing had happened: that is now said on the steps; test. (3) A first list that failed was a dead end (the dialog cannot be closed then, and "open settings again" was impossible): it now says so with Try again; test. (4) On a slow network the old form showed first: a neutral "Looking for your repositories" until the answer; test. (5) Check now gave no sign of working: "Checking…", disabled until the answer; test.
- G-4: `tests/screens/b2-{desktop,phone,small}-{light,dark}{,-still}.png`. The dialog fits at 320 px; no overflow. "Check now" looked like text: it is now a button. The screenshots also showed Sign out holding the focus (the dialog opens on "looking", where it is the only control), so Enter would sign out: step 1 now takes the focus; test, and reverting it is caught. G-5: no dependency, no request beyond GitHub's API; links to github.com only; `index.html` about 118 KB. G-6: README has "No notes repository yet".

### A3: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: the note is held to the code, so each check was broken from both sides and caught: the app writing a new storage key; the broker logging, storing, reading a new field, or its deployment switching logs on; a new host in the page's policy; the app wiping drafts on an automatic sign-out; and each claim removed from the note (the key table rows, "logs nothing" in both places, the CDN host, the revoke link, the eight-hour and six-month honesty, the app owner's own access and Uninstall, control of the page, CDN code running in the page, restored tabs, duplicated tabs, drafts kept on automatic sign-out, repositories others installed on). Three note mutations first went unnoticed because the words also appeared elsewhere; the checks now look at the table row or the exact sentence.
- G-3 findings, all taken: (1) It left out that whoever owns a shared copy's GitHub App can use the app's access to installed repositories directly, without the person, and that Revoke does not stop that but Uninstall does; and that they control the page: a new "Who you are trusting" section; tests. (2) "At most eight hours" was false for a copied sign-in: the refresh token lasts six months and the broker renews it for anyone holding it: the note and the README now say so; test. (3) "Nothing is written to disk" with Forget me is not true where the browser restores tabs: now a warning to Sign out; test. (4) A duplicated tab keeps its own session copy: said; test. (5) An automatic sign-out (revoked, expired) keeps drafts on purpose: the note says so, and a test shows it happens. (6) CDN code runs inside the page with full access: said (integrity pinning is already under Needs the owner). (7) The sign-in reaches every repository the app is installed on that the person can use, not only ones they chose, and public repositories: corrected; test. (8) Self-hosting still involves GitHub and the hosts; "twenty minutes" as in the README. (9) The table's details corrected: what `notes.signin` holds and when it goes, the branch and time in draft keys, what the config keeps. Not done here, noted for later: revoking the token on GitHub at sign-out would need the broker (GitHub's token-revocation endpoint takes the client secret), so the owner would have to redeploy it; the note says what sign-out does and does not do instead.
- Ledger: the `## Needs the owner` heading was lost in B2's ledger commit (a plan was inserted in its place); restored here, with nothing else missing.
- G-4: nothing in the app changed. G-5: no code, dependency or request changed. G-6: README's known limits corrected and linked to PRIVACY.md.

### A2: gauntlet record
- G-1: full suite green three runs in a row, Chromium.
- G-2: each check reverted alone and caught: Sign in taking the focus (without it the dialog focused the Privacy link, so Enter opened the note); the link's address and its new tab; the "Forget me" wording. The words themselves are pinned by the test: three sentences at most, 20 words each at most, and each point the item asks for.
- Rule 6: `PRIVACY.html` relies on GitHub Pages publishing `PRIVACY.md` there (jekyll-optional-front-matter is on by default and cannot be turned off; docs URL in the test). The repository has no `.nojekyll` or `_config.yml` to stop it. The README says what to do on another host.
- G-3 findings, all taken: (1) The README still promised "Nothing is written to disk" for Forget me, against PRIVACY.md (browsers that reopen tabs bring the session back): the README is corrected and the privacy test now holds the README to it too. The checkbox text in the app said the same and was already changed in this item. (2) "Only the repositories you choose" is not true when an organisation installs the app for its members: now "only in repositories the app is installed on, which you choose"; test. (3) "Your notes stay in your repository" hid the one thing that changes the risk on someone else's copy: the third sentence now says whoever runs this copy's GitHub App can reach them too, as PRIVACY.md does; test. (4) The README pointed to the wrong place for the link: it now names `id="about"`.
- G-4: `tests/screens/a2-{desktop,phone,small}-{light,dark}.png`: fits at 320 px with Sign in in view and focused; the link is visible in both themes. G-5: markup and one CSS rule, outside the hashed script; no request added. G-6: README says where the privacy note is published, and the Forget me paragraph matches PRIVACY.md.
### N13: gauntlet record
- cdnjs cannot be reached from the development machine, so the hashes came from a CI job that fetches each CDN file named in `index.html` and compares it with its `integrity` (`tests/cdn-integrity.mjs`); it printed the four CodeMirror hashes, and confirmed the two marked/DOMPurify hashes Codex had pinned. It stays, as a check that goes red the day cdnjs serves anything else, on every change and weekly on its own (schedule), without running the suites.
- Tests: the suite serves a stand-in for CodeMirror, which cannot match a real hash, so the test server leaves out the CodeMirror hashes only (documented in the harness); `tests/integrity.test.mjs` keeps them and shows the stand-in refused while notes still open and save.
- G-2: the hash removed from the editor script: the static check and the three browser checks fail. The stylesheet check removed: three checks fail.
- G-3 findings, all taken: (1) a changed stylesheet with a passing script left CodeMirror drawing the note invisibly, with no badge: the editor now needs its stylesheet too; tests with the real files. (2) keyboard-editor and accessibility never checked they were testing real CodeMirror: they do now. (3) the changelog over-promised what each refusal means: corrected. (4) "red the day cdnjs changes" needed a schedule: added.
- G-4: no visible change. G-5: no new dependency; the hashes add 0.5 KB. G-6: PRIVACY and CHANGELOG.

### N14: gauntlet record
- A save refused because the note changed on GitHub reads their version and merges by line (three-way, against the version the edit started from), then saves; different lines are combined and the person is told. The same lines changed differently are never guessed: conflict, and **Save as copy** saves mine as "name (my copy).md" beside it and loads theirs. The merge runs only when the starting version is known: a draft restored over an older version is never merged (the app knows only its sha; merging against GitHub's text instead would silently undo their change: found while building, test added).
- G-2: 13 safeguards removed one at a time, each caught: stale drafts merged (2 checks); no once-per-save guard (2, 251 commits); a deleted empty note recreated (1); overlap guessed (crash); identical change treated as a conflict (1); merged text not saved (11); copy name not checked (1); the copy leaving mine in the note (2); undo history kept (1); caret not kept (1, and 1 in the plain editor); repeated-line runs guessed (2); editor not locked during the copy (1); list not reloaded after a name taken (1). Merge function also checked alone: hand cases, symmetry, 3,000 random edits (a line changed by one side only always survives), a 20,000-line note in 26 ms.
- G-3 findings, all taken: (1) typing while Save as copy uploads was lost: the editor is locked meanwhile. (2) Undo right after a merge brought back the pre-merge text, which the next save would commit over their lines: history cleared. (3) the caret jumped: it moves with its text. (4) both sides removing one of several identical lines could lose two: such runs are a conflict. (5) after switching notes the message offered a button not shown: reworded; a copy name taken since the list loaded showed GitHub's raw error and stuck: the list reloads and it says so.
- Test changed, not weakened: docs.test.mjs required the changelog to say "copy your latest text before using Discard", advice N14 makes obsolete; it now requires Discard still to be named as dropping your text.
- Caught by the full suite before commit: giving the plain editor a `setCursor` that takes a number broke `keyboard-editor`, which (like other code) recognises CodeMirror by that method; the plain editor's caret is set directly instead.
- G-4: screens above; the conflict header wraps to two rows on a phone, legible, no overflow. G-5: `index.html` 153,504 bytes, under 150 KB, after shortening my own earlier comments. G-6: README, CHANGELOG.
### N15: gauntlet record
- A pin is the property `pinned: true` in the note's frontmatter, so it travels with the note (Obsidian shows it as a property; any editor keeps it). No app-specific file is written (rule 2). Each browser finds pinned notes by reading each note version once (by blob sha, remembered in its UI state, cleared at sign-out), up to 500 a visit, one scan at a time. GitHub's code search would be one request, but it covers only the default branch and lags behind recent commits, so it was not used.
- G-2: 22 safeguards removed one at a time, each caught (13 before the review, 9 after): versions already known read again; no bound; a scan overriding what this tab saw; read-only repositories written to; any file given frontmatter; an old `pinned` line kept; the body counted; hidden folders scanned; a save not updating the list; rename or delete leaving the old name; a pin written outside frontmatter; an empty frontmatter block left behind; restored drafts saved by pinning; `...` frontmatter not recognised; another `pinned` property overwritten; the shown list not kept; known pins shown only at the end; unreadable notes read again; answers saved only at the end; scans side by side; a failed read not stopping the scan.
- Found while making the "cut short" check exact: when the page closed, each aborted read made the scan start the next one from the dying page, and offline it would have tried every note. A network failure now stops the scan (it carries on next time); a note GitHub refuses is still remembered. Two other G-2 gaps found and closed on the way (plus two after the review: the shown-list and closed-page tests had passed for the wrong reason, since the fake listed the note early and the scan finished before the reload): the read-only check only looked at the list, not that the note was left untouched; the mid-scan test put its note last, so the scan read it after the pin and could not see the race.
- G-3 findings, all taken: (1) pinning a restored draft committed it: refused until saved or discarded. (2) frontmatter ending in `...` was not recognised, and a `pinned:` list lost its key: `...` accepted, and a `pinned` property that is not a plain true/false is never touched (the note is pinned in this browser instead, and the app says so). (3) the scan reordering the list moved the shown tab to another note, so a new task could go to the wrong file: the shown note stays shown. (4) a scan kept nothing until it finished (refreshes and a phone closing the page read the same notes again; unreadable notes read every visit): answers kept as they arrive, one scan at a time, unreadable notes remembered. (5) known pins disappeared until a scan ended: shown at once.
- Tests changed for the new design, not weakened: pinned-tree asked for pins saved only in this browser (N11's design, replaced at the owner's request); content-search counted every read of its notes, which now includes the pin scan's, so it waits for that scan before measuring search.
- G-4: the only visible changes are the star's tooltip and the Pinned help line. G-5: `index.html` 157 KB, under the new 200 KB limit. G-6: README, PRIVACY (what `notes.ui.v1` now holds), CHANGELOG.

### Clean-up assessment after N15 (2026-09-27, asked by the owner)
- Size: 157 KB of 200 KB. Script 135 KB, of which comments are 33 KB (25%); CSS 11 KB; markup 11 KB. No function unused, no CSS rule without a use, indentation consistent (tabs).
- Worth doing, before N17 and not before: four copies of the same bounded, four-at-a-time, stop-if-the-repository-changed read loop (repository list, content search, preview images, pin scan). N17 (backlinks) would add a fifth and read every note again. One shared reader (limits, cancellation, results by blob sha) would remove about 60 lines and let search, pins and backlinks share one read of each note version.
- Not worth doing: shortening comments (the size limit now allows them, and they carry the reasons the tests rely on); restyling the compact code from the Codex merges (26 long lines, about 100 packed statements) for its own sake: it would touch much of the file for no behaviour change, and every change there needs the full suite in both engines.
- Recommendation: no general clean-up now. Do the shared reader as the first step of N17.
### N18 and N19: gauntlet record
- One commit for both (an exception to one item per commit): their changes interleave in the same lines of `index.html` (the header button, the settings form, the stylesheet's colour tokens).
- N18: ☰ now also works on a computer, hiding the file list; its right edge is a separator (pointer, keyboard, double-click). The stylesheet alone clamps the width (180-600 px, 60% of the window); two clamps in the script duplicated it, no test could see them, so they went. Width and hidden state are UI state (`notes.ui.v1`), so sign-out and *Forget me* treat them like open folders. Not done: another open tab does not pick up a width change until reloaded (as with open folders).
- N19: the choice is `notes.theme`, kept at sign-out because it says nothing about the person (PRIVACY lists it). A second inline script in the head applies it, with the bar colour, before the first paint; the CSP lists both hashes, and the CSP test now expects exactly two.
- G-2: 23 safeguards removed one at a time, all caught (17 before the review, 6 after): the stylesheet clamp and the 60% limit; width, hidden state and double-click reset not kept; the editor not refreshed; the handle on phones (after moving that check before the test collapsed the list, which had hidden it anyway); collapse hiding the phone drawer; the aria value; the head script; Light not overriding a dark device; the bar colour (at once, and early); form controls; Auto keeping the old choice; refused storage breaking start (made a check, not a crash); the button not following the drawer; the handle over the note; the way back not said; the drag jumping to the pointer.
- G-3 findings, taken: (1) the phone drawer's button kept saying "open" after a file closed it: it follows the drawer however it closes. (2) the handle lay over the note's first 4 px, so a click at a line's start began a resize: it is its own column (12 px on touch screens). (3) hidden, with nothing open, the hint pointed at a + no longer shown: it now says ☰ shows the list, and the button is named "Files". (4) the browser bar colour flashed on load: the head script sets it too. (5) Theme beside a Save it does not need: a note says it applies at once; it stays in the account form, because first run must show only its two steps (B2, which the firstrun suite enforces). Accepted: iPad double-tap does not reset the width (Home and the arrow keys do).
- Found on the way, in N15's pin scan: a read finishing while the page closed started another from the dying page (the rare 65th read in pins-sync under load). The scan now stops at `pagehide` and carries on if the page is restored from the back/forward cache. pins-sync then passed 16 of 16 runs, eight at a time.
- Tests changed, not weakened: the CSP test expects two inline scripts; pins-sync waits for the file list as well as the scan (a race under load).
- G-4: `tests/screens/n18-*`, `n19-*`: desktop light and dark (wide, hidden), phone drawer, settings with the other theme; no overflow. G-5: 165 KB of 200 KB. G-6: guide, PRIVACY, CHANGELOG.

## Decisions
- 2026-09-27: Latest owner instruction explicitly authorises merging mvp into main after reconciliation. This supersedes the earlier no-main-merge boundary. Public App setup is confirmed complete; no account setup is outstanding. Preserve both branches' tests, task controls, Safari token race handling, real-editor keyboard checks and G3 failure recovery. Integration takes place in an isolated checkout so the existing package-lock.json change remains untouched.
- 2026-09-27: Owner walkthrough exposed stale local evidence. The live site and origin/main already use the deployed broker, and CLIENT_SECRET exists. Origin/main advanced to 03f7311 while mvp remains separate (13 mvp-only and 32 main-only commits at this check). Refreshed remote refs and corrected this checklist; no app code, secret, GitHub App setting or live deployment was changed by the assistant. The earlier deployment instructions repeated work already completed; future steps must check live state and current remote history first.
- 2026-09-26: F1, F3, G3 and H1–H3 are complete on mvp. The only unfinished MUST is F2, blocked after its three failed gauntlet attempts. Stop this checklist run at that boundary and the owner-only deployment steps above. The release gate has not started: both-engine validation, whole-codebase release review, the first-run phone walkthrough and RELEASE_CHECKLIST.md remain for after F2 is resolved. No main commit, merge, broker deployment, secret handling or GitHub App settings change was performed. The pre-existing package-lock.json working-tree change was left unstaged and untouched.
- 2026-09-26: The current request supersedes the earlier branch exception: work is on `mvp`, created from `main` at 5ba9c81. No commit or push to `main` is permitted. The old branch notes below remain historical.
- 2026-09-26: F2's attempted local gauntlet ran all 22 suite entry points in both engines in isolated Node processes, four at a time. Each complete pass finished before the next could begin, and any non-zero suite exit stopped the three-pass attempt. The normal `npm test` entry point was also run. All output stays under ignored `tests/screens/` or `*.log` paths. After the third failure, its unfinished changes were reverted.
- 2026-09-25: Work happens on `claude/pensive-sagan-0vk6ud`, not `mvp`. The session that runs this loop is only permitted to push that branch; it plays the role the command gives `mvp`. Rename or merge it as you see fit.

- 2026-09-25: Drafts are written on every change, not on `pagehide`/`visibilitychange`: iOS can discard a background page without firing either.
- 2026-09-25: A restored draft keeps the sha it was based on, so it goes through GitHub's conflict check; a **Discard** button appears for a restored draft or a conflict, as the way out.
- 2026-09-25: Autosave waits 2 s after the last keystroke and commits at once on `visibilitychange` to hidden. It only saves text typed since the file was opened: restored drafts and New templates wait for a keystroke or Save.
- 2026-09-25: Leaving a file commits it rather than asking. A person switching files wants their words kept, and the history holds anything they regret; offline or in conflict, the draft keeps it instead.
- 2026-09-25: No `innerHTML` at all, rather than "only with static strings": a rule a test can enforce beats a judgement each reader must repeat.
- 2026-09-25: Review findings outside the current item become ledger items (N1–N4) rather than widening the item. They go straight after G1 because three of them touch data or sign-in.
- 2026-09-25: The policy is a `<meta>` tag because GitHub Pages cannot send headers, and it comes in two parts. The app's part pins its one inline script by sha256 rather than allowing `'unsafe-inline'`. Deployment settings moved into a JSON data block so that a fork's edits never touch the hash.
- 2026-09-25: Line endings are kept per line, by diffing the editor text against the text as read, rather than by picking one ending per file. A notes app must never change bytes the user did not touch.
- 2026-09-25: A return from GitHub's install flow never signs anyone in. Where the app cannot know whether the computer is shared, it defaults to "Forget me": the cost is signing in again, while the other mistake leaves a six-month token on someone else's disk.
- 2026-09-25: Remembered tabs share one set of settings and follow each other; session-only tabs keep their own. Two remembered tabs on different repositories cannot be kept apart without per-tab storage, and the last writer silently winning was worse.
- 2026-09-25: Rename uses the Git Data API in one commit and a fast-forward-only branch update, rather than the contents API's create-then-delete, so there is no moment with both copies or neither. All GitHub requests skip the browser cache, since GitHub marks answers cacheable for 60 seconds.
- 2026-09-25: A link that names no existing note is only offered for creation when the whole list of notes is loaded and fresh. Otherwise "not found" may be wrong, and creating would end in a conflict at best.
- 2026-09-25: Before a repository is in use, a public one is never chosen for anyone, even when it is the only one: notes are private by default, and the other mistake cannot be undone.
- 2026-09-25: A3 goes before A2: the signed-out screen links to the privacy note, so the note has to exist first.
- 2026-09-25: At the owner's request, `main` was fast-forwarded to aaa113f (everything up to A2, plus F2 in progress: Chromium green in CI, WebKit not yet). The release gate still applies before sharing the link.
- 2026-09-25: Ledger updates land in a small follow-up commit, since an item's commit cannot contain its own hash.
- 2026-09-27: The owner raised the size limit for `index.html` from 150 KB to 200 KB (204,800 bytes), now enforced by `tests/size.test.mjs`. Whether the file needs a clean-up is assessed after N15.
- 2026-09-27: The README split for the community: a short front door (what it is, Try it, privacy, links); the detailed guide in `docs/guide.md`; self-hosting in `docs/self-hosting.md` with `YOUR-USERNAME` placeholders; `CONTRIBUTING.md`, `SECURITY.md`, pull request and feature request templates; this ledger and the release checklist moved to `docs/dev/`. Docs tests follow the moved text, and a new check keeps every relative link (and heading anchor) in the docs working. Test data no longer uses the owner's own project name.
- 2026-09-28: UX review against a desktop notes app (owner's screenshot): N20-N30 added, ordered with N16 and N17 by value and effort; the note-reading items after a shared note reader (built first in N26); reminders, locked notes, a rich-text editor, tabs and colour labels left out, with reasons.
- 2026-09-28: Owner's requests: N31 About (version, links, support), N32 checklists in any note with the Tasks screen folded in (the owner's idea; replaces N24), N33 tabs (earlier left out). Placed by priority among N20-N30.
- 2026-09-28: Owner's choices: GitHub Sponsors for support (N31); rename to Padgit at padgit.com (N34, placed before About so 1.0.0 is Padgit).
- 2026-09-28: GitHub Sponsors moved out of About (N31) into its own item at the end of the list (N35), as the owner asked.
- 2026-09-29: Owner's review of the built app: N36 remove ← →, N37 one kind of note (Tasks screen and "Add a task" go), N38 visual redesign with a mock-up first. Placed ahead of the remaining items.
- 2026-09-29: The owner raised the size limit for `index.html` to 250 KB (256,000 bytes) for the redesign (N38).
- 2026-09-29: The owner approved the N38 mock-up and all five choices in it: a header with title, save dot, Edit/Preview switch and ⋯ menu; checklist rows with tap-to-edit, grip and ⋯; a reading face for headings; properties as chips; Save as a status dot rather than a header button.

## Log
(one line per iteration: date, item, result, commit)
- 2026-09-26 · H3 · done · 2a16de0 (pushed)
- 2026-09-26 · H2 · done · a66ce72 (pushed)
- 2026-09-26 · H1 · done · a7b60d0 (pushed)
- 2026-09-26 · G3 · done · c57046d (pushed)
- 2026-09-26 · F3 · done · 3486a8f (pushed)
- 2026-09-26 · F1 · done · 83c1791 (pushed)
- 2026-09-26 · F2 · blocked after three gauntlet failures; unfinished changes reverted · 1f6e274 (pushed)
- 2026-09-25 · C1 · done · daa2754
- 2026-09-25 · C2 · done · 493850a
- 2026-09-25 · C3 · done · ec26502 (pushed once the owner granted access)
- 2026-09-25 · G2 · done · 981fd4d
- 2026-09-25 · G1 · done · 3290031
- 2026-09-25 · N1 · done · 4dec41f
- 2026-09-25 · N2 · done · 4f5062d
- 2026-09-25 · N3 · done · f23b584
- 2026-09-25 · N4 · done · 045b181
- 2026-09-25 · N5 · done · 42315db
- 2026-09-25 · B1 · done · 800e3ed
- 2026-09-25 · B3 · done · d32c97f
- 2026-09-25 · A1 · done · 7a955b3
- 2026-09-25 · D1 · done · c77ef15
- 2026-09-25 · D2 · done · d762495
- 2026-09-25 · E1 · done · 918ad02
- 2026-09-25 · B2 · done · 5bf6436
- 2026-09-25 · A3 · done · 211e75b (taken before A2, which links to it)
- 2026-09-25 · A2 · done · d91783c

## Upstream integration evidence (historical main at 03f7311)

### F2: gauntlet record
- Environment: WebKit cannot be installed in the session this was built in (the environment's network policy blocks Playwright's download host, `cdn.playwright.dev`), so WebKit runs on GitHub Actions (`.github/workflows/test.yml`, both engines on every push, `repeat` input for runs in a row); results read back through the Actions API. The owner may allow that host in the environment's network settings to run WebKit locally too.
- G-1: GitHub Actions run 18, three runs in a row in both engines, green; three local Chromium runs green (72c1af2).
- G-2: each runner and harness safeguard reverted alone and caught: a missing engine skipped; the run always exiting 0; failures not counted; an unknown engine accepted; a suite left out; the policy suite not first; the harness launching Chromium whatever it is told (caught in the WebKit job, where the engine really launched is checked); an unknown engine accepted by the harness.
- What WebKit found in the app: one real bug. When two tabs renew the sign-in at once, the Web Lock makes them take turns, but in WebKit the first tab's new tokens can reach the second tab's storage a moment after the lock does; the second then spent the refresh token the first had just used, and could be signed out if GitHub's refusal came back before the tokens did. It showed as an intermittent failure of "with the lock, the second tab never spends a dead token" in one WebKit run of two on the same code. Fixed: a tab that had to wait for the lock gives the other tab's tokens up to 1.5 s to arrive; a refused refresh waits up to 2 s for them before signing out; a newer token from another tab counts while it still works. New Chromium tests reproduce the late storage, so every run guards it; each change reverted alone is caught (deterministically, after a first version of the short-lived-token test caught it only one run in three and was rewritten). The dead-sign-in test now waits for the sign-out rather than a fixed 700 ms, as the sign-out can take up to 2 s.
- Review of that fix (G-3), both taken: (1) any broker failure (offline, a timeout, the broker or GitHub down) was treated as a dead token, so losing signal at renewal time signed every tab out and threw away a refresh token that still worked (this was the "offline sign-out" noted for G3; fixed here because the same handler was being rewritten): now only GitHub's refusal (the broker's 400) signs out, anything else says to try again and keeps the sign-in; tests for offline and a 502, both tabs, token unspent, and the retry succeeding. (2) If storage lagged past the grace period, the waiting tab's sign-out wiped the other tab's new pair from storage and signed everyone out: a tab that waited now forgets only its own copy; test with 6 s of lag. Also: "Forget me" tabs no longer wait for tokens that cannot arrive. Both reverted alone are caught. Not done: `broker()` has no timeout, so a stalled connection holds the lock until the browser gives up; left for G3.
- Test issues WebKit found: Playwright's WebKit cannot fulfil a 302, so the fake sign-in page replaces itself with the redirect address there; WebKit words an aborted request differently ("Load failed", "... due to access control checks"), so the two checks that filter a failure they injected use one engine-aware pattern; the runner test's fixtures named Chromium, which the WebKit job does not install. And one Chromium check waited a fixed 500 ms for several requests and failed on GitHub's slower runner; it now waits for the condition (up to 5 s), the check itself unchanged. 56 other fixed pauses remain; none has failed in CI.
- G-3 findings, all taken: (1) a `repeat` input of 0 or not a number made a green run that ran nothing: rejected before the loop. (2) Nothing checked which browser really ran: the runner test compares the launched browser with the one asked for. (3) Paths with spaces or accents made every suite fail: fixed, checked from such a path. (4) `BROWSER` is set by other tools: the engine now comes from `NOTES_TEST_ENGINE`. Also: the README now says this is Playwright's WebKit on Linux, not an iPhone; unknown runner options are refused.
- Commits: F2 spans d2b0cec, aaa113f, 8424be2, c7db305, 2a86afd and 72c1af2 (the first was pushed to get WebKit results from CI, which is the only place they can come from; force-pushing is not allowed, so the fixes followed as separate commits). `main` was fast-forwarded to aaa113f at the owner's request before WebKit was green.
- G-4: nothing in the app changed. G-5: dev tooling only; no runtime dependency, no request from the app. G-6: README's Tests section.

### F1: gauntlet record
- G-1: GitHub Actions run 22, three runs in a row in both engines, green; three local Chromium runs green (1326f8c).
- G-2: each safeguard reverted alone and caught: `manifest-src 'self'` (without it Chromium refuses the manifest, 4 checks fail), the start address (`index.html` would not match the sign-in callback), standalone display, the maskable icon, an icon's claimed size against its real pixels, the iPhone touch icon, the manifest link. The dark-mode colour and the tab-free wording have checks of their own.
- Rule 6: the harness now serves the manifest and icons with the types GitHub Pages gives them (mime-db: `.webmanifest` is `application/manifest+json`; URL in the harness).
- G-3 findings, all taken; the reviewer found nothing that could lose notes or a token, and confirmed the scope, start address, icons (opaque, maskable safe zone), policy and safe-area padding. (1) After installing the GitHub App from the home-screen app, iOS opens GitHub outside it, and the page GitHub returns to spoke of "tabs", inviting a sign-in in a throwaway sheet: the wording now names the Notes app too, and the README says to come back to the app. (2) On iPhone the home-screen app's storage is its own: the README now says the two are signed in and out separately and unsaved changes stay where they were typed. (3) The browser bar colour ignored dark mode: a dark `theme-color` too. Known limit, for the release checklist: signing in from the home-screen app on a real iPhone can only be tried there.
- G-4: `tests/screens/f1-icon-shapes.png`: the icon as an Android circle, an iOS rounded square, and at 48 and 24 px. G-5: five small files in the root (about 7 KB together), no dependency, no service worker, no request beyond the app's own files. G-6: README on Add to Home Screen, iPhone and Android.

### F3: gauntlet record
- G-1: three local runs green (Chromium); GitHub Actions run 32, three in a row, both engines, green. The first CI runs failed in WebKit on Safari's console notice that it ignores `interactive-widget` (harmless; Android's setting), which every "no page errors" check counted: the harness now passes over that one notice (07173fe).
- G-2: each safeguard reverted alone and caught (9): the resize listener, the scroll listener, following a pan, leaving pinch zoom alone, resetting when the keyboard goes, 16px fields, the pins sheet's cap, not moving the note on a pan, not moving it to its caret when typing elsewhere. The fake keyboard fires `resize` and `scroll` separately, as iOS does; a first version fired both together and hid a missing listener.
- What no test here can show: a real on-screen keyboard. The tests fake `visualViewport` as iOS reports it (height, pageTop, scale), at real keyboard heights; Android's path is a shorter window. The release checklist needs a real iPhone and an Android phone: type at the end of a long note, and add a task, with the keyboard up.
- G-3 findings, all taken: (1) every field's text was under 16px, so iOS Safari zooms in when one is tapped; the code took any zoom for a pinch and stood aside, so on a real iPhone it would never have run: every field is 16px on phones; test. (2) The pinned-tasks sheet was sized from the full screen height, so at real keyboard heights (417 px left on an iPhone 14 with Safari's form bar, 343 on an iPhone SE) its "Add a task" box was cut off, worse than before; the test had used a generous 508 px and passed by 1 px: the sheet is capped to the space there is; tests at both real heights. (3) Every pan snapped the note back to its caret and re-measured it: now only when the height changes, and the caret only while the note has the focus; tests. (4) The position follows `pageTop`, which allows for the page itself having scrolled. Left, noted: while the page pans, the header can lag a frame behind until iOS reports the pan (the transform follows each event, not each frame); and re-measuring CodeMirror while an input method is composing is not known to be safe.
- G-4: `tests/screens/f3-{editor,pins}-{light,dark}.png` with the keyboard's space marked: the header at the top, the editor ending at the keyboard with the typed line in view, the task box above the keyboard. G-5: CSS and one small function; no dependency. G-6: README.

### N6: gauntlet record
- G-1: three local runs green (Chromium); GitHub Actions run 32, three in a row, both engines, green.
- G-2: dropping the PNG link, and a size claimed that the file does not have, are each caught.
- Change: a 32 px PNG tab icon (367 bytes) beside the SVG, raster first with explicit sizes (so Chromium still prefers the SVG). The test now checks every tab-icon link: the file exists, its type and real pixel size match, it is served with its type.
- G-3: nothing wrong found. Chrome, Edge, Firefox and current Safari use the SVG; older Safari the PNG; iOS the PNG or the 180 px touch icon. Favicons are same-origin, so `img-src 'self'` allows them where a browser applies the policy. The globe the owner saw: the link was already on `main`, so most likely a page loaded before the deploy finished (Pages also caches for up to 10 minutes) or Chrome's favicon cache; hard reload, or open the app in a new tab.
- G-4: a browser's tab strip cannot be screenshotted headless; the icon itself was checked at 32 px. G-5: one 367-byte file, no request beyond the app's own files. G-6: no behaviour described in the README changed.

### N7: gauntlet record
- Result: a full run went from about 300 s to about 72 s here (three runs at 8 at a time: 73, 72, 73 s). Steps: parallel suites and settle() took it to 103 s (92 s before the review's fixes); the limit then was not the slowest suite but the total waiting divided by the slots (splitting autosave in three and auth in two changed nothing at 4 at a time), and since a suite mostly waits rather than computes, more suites than CPUs pay off: 8 at a time 72-73 s, 12 at a time 59-61 s, each three runs in a row without a failure. But on GitHub's runners (4 slower CPUs, WebKit heavier) twelve at a time failed sign-ins and loads for lack of time (run 37, 5 of 6 jobs), so the default is 2 per CPU, at most 8 (72 s here), and CI asks for 4. In CI the repeats are now separate jobs side by side (engine x run), so three runs take the time of one; `repeat` is still checked (1 to 20). Two changes. (1) The runner runs suites in parallel, four at a time by default (`--jobs`), each suite's output kept together; each suite has its own simulated GitHub and browser, so nothing they test changes. (2) The 367 fixed pauses under 1.5 s became `H.settle(page, ms)`: at least 100 ms, then until no tab of the test has had a request in flight for 80 ms, and never longer than the pause it replaced, so a test can only get faster and a check that something did NOT happen still waits at least 150 ms. The 31 pauses of 1.5 s and more wait for the app's own timers (autosave at 2 s, the status line) and stay fixed; the app has no other timer but a 150 ms poll inside sign-in renewal.
- G-1: three local runs green (Chromium, 72-73 s each); GitHub Actions run 43, three runs side by side in both engines, green (and run 44). In CI, WebKit needed more room: twelve and then four suites at a time failed on GitHub's slower runners (runs 37, 39) until the sign-in helper waited for the stored sign-in rather than for a quiet network (a gap between sign-in steps outlasted the quiet window); Chromium runs 4 at a time there, WebKit 2.
- G-2, across the suites rather than one (the risk being a check made hollow by waiting less): 18 of the app's safeguards broken one at a time against the suite that should notice, 16 caught at once. The other two, and two more found the same way, were gaps before N7 as well (the old tests, with their fixed pauses, missed them too), and are closed here with new checks: an untouched restored draft, or an untouched new note, is not committed when the page is hidden (switching apps); a PNG is not opened through an Obsidian embed link (`![[image.png]]`) or as the remembered last file after a reload; a rename onto a file already in the list is refused before any request to GitHub. One remains unobservable by design: leaving a note checks "touched" before saving, and the save checks it again; breaking either alone changes nothing, as the other still holds (the save's own check is the one caught).
- The runner's own tests: parallel output stays per suite, one at a time gives the same verdict, `--jobs` must be a whole number from 1; failing and crashing suites still fail the run.
- G-3 findings, all taken: (1) real: "no commit while typing steadily" had become hollow. Typing makes no request, so each settle returned after the floor, the six keystrokes fitted inside one 2 s autosave window, and a mutant whose keystrokes did not push autosave back passed. Every pause in the autosave suite is fixed again (they measure time against the app's timer), and that mutant is caught again. (2) settle watched one tab while three auth checks were about another tab reacting to a storage event or a Web Lock, which make no request: settle now watches every tab of the test, and those three checks keep their fixed pauses. (3) The app spent 128 ms encoding a 1 MB note before its request started, past the 100 ms floor: the floor is now 150 ms. (4) The pins-sheet check waits out its 180 ms slide again (fixed 260 ms). (5) The new rename check counts every request to GitHub, not only git calls. Checked by the reviewer: Playwright counts a request held by a route handler as in flight until it is fulfilled, and aborted ones as finished; parallel suites share no port, file or state.
- G-4: no visible change. G-5: tests only. G-6: README's Tests section.
### N8: gauntlet record
- Cause, confirmed by a test before the fix: each pinned-task commit names the version it replaces, the next version is known only when GitHub answers, and a click in that moment (hundreds of milliseconds on real GitHub) named the old one; GitHub refused it with 409 and the click was lost behind "Conflict. The file changed on the server.". The simulated GitHub already refused a stale sha as GitHub does (the ledger's plan was wrong to suspect it); it answered instantly, so the old "rapid toggles all land" could not see the race. The new tests hold each commit for a few hundred milliseconds; before the fix they failed 14 checks with exactly the owner's message.
- Fix: writes to a pinned file go one at a time. A click while one is on its way waits; several waiting clicks share one commit carrying the latest state. If a commit fails, what waited behind it is not sent (it was built on that commit): the list reloads from GitHub, the error shows, and a waiting capture goes back into the box.
- G-1: three full local runs green in Chromium (74-75 s each), before and after the review's fixes; WebKit in GitHub Actions (see the log).
- G-2: seven safeguards broken one at a time, each caught: writes not serialised (14 checks); the waiting commit never sent (3); a failed commit's waiting capture not returned (1); the waiting commit sent after a failure (1); a reply from the previous repository accepted (2); the queue not reset on changing repository (1); the queue reset on saving settings (4, and 3 when only the cache entry is dropped); the open note not following a commit that has another behind it (2).
- G-3 findings: (1) and (2) real: saving settings with the same repository reset the queue, so a task waiting behind a commit was silently lost, and the next tick was a conflict again. Now the queue, and the list of a file being written, are kept unless the repository changes. (3) real: with a commit waiting, the open (unedited) note was not updated when the first landed, so a failed second left it a version behind and the next save was a conflict with the person's own tick; the open note now follows every commit. Re-review: all three fixed. Accepted: switching to another repository and back inside one commit's wait (seconds) can still give a conflict on the next tick; nothing saved is lost, the error shows and the list reloads.
- G-4: no visible change. G-5: 126 KB, no new dependency. G-6: README's feature list says quick clicks share a commit.
### N9: gauntlet record
- × on each task removes that one line in one commit; "Clear N done" removes every ticked task in one commit. No question first: a bar in the pinned panel says what went, with **Undo**, for 8 seconds (the repository's history keeps every line anyway). Both go through N8's one-at-a-time writes. A row drawn from text that has changed since removes nothing (never the wrong line).
- Undo puts lines back by position, so it checks the positions still mean the same: the file must be the text the removal left, give or take ticks and tasks added at the end. Anything else (lines added or removed above, here or in another tab) and Undo refuses and says the lines are in GitHub's history. It stays on offer while it cannot be sent (access being checked, list loading), comes back if its commit is refused, follows a rename, and is withdrawn when another list is shown, the repository changes, or the repository becomes read-only.
- G-1: three full local runs green in Chromium (75 s each, 27 suites); WebKit in GitHub Actions (see the log).
- G-2: 15 safeguards broken one at a time, each caught: the stale-row check (2 checks); lines removed front to back (2); Undo in reverse order (1); Undo kept after a failed remove (1), on changing repository (1), on switching list (1), on the repository becoming read-only (1); the × enabled read-only (2, access suite); Clear done shown read-only (2, access suite, after giving that suite a ticked task); Undo without the whole-file check (2); ticks counted as a change (1); captures counted as a change (1); Undo hidden before it is accepted (2); no re-offer after a refusal (1); Undo not following a rename (1). Removed as untestable and redundant: Undo checking the repository itself (the offer is already withdrawn when the repository changes).
- G-3 findings, all taken: (1) Undo put lines back by number after lines were added above, into another section; first fixed with a line-above check, which the re-review showed fooled by a blank line under each heading; now the whole-file check above. (2) Undo lost when refused (access check running, list loading): kept on offer. (3) Undo lost on rename: follows it. (4) Undo left up over another list, or on a read-only repository: withdrawn. Re-review: (5) Undo lost after a conflict with another tab: offered again, and then explains. Also taken: the × on a phone is a finger-sized target (about 31 x 33 px).
- G-4: screens above; the rows keep their old spacing (the row is now a div around the label, and the settings form's label margin no longer leaks in). No overflow at 390 px.
- G-5: 131 KB, no new dependency. G-6: README's feature list.

### N12 and S2 — combined validation, 2026-09-27

The owner requested these two items together, extending the original iteration
cap. N12 implementation: `0a655fc`. S2 follows in a separate commit, with one
full two-engine CI pass for the final combined PR. Setup and owner smoke checks
are already complete and are not repeated.

Preview uses pinned Marked 18.0.14 and DOMPurify 3.4.16, SRI, narrow CDN paths
and sanitised DOM fragments. Frontmatter, tasks, code, links, drafts and CDN
fallback: 15/15 checks in each engine. Images remain S4.

Content search includes paths and scoped drafts, with at most 300 file reads
and four workers. Read failures, skipped files and partial lists are visible.
13/13 checks in each engine, including stale query/repo, auth recovery and
bounded reads. Both feature suites together take about eight seconds.

Independent review found lost results after selecting a match, and expired
sign-in leaving search running. Both fixed with regressions; re-review passed
13/13 and found no residual blocker. Mutations independently caught unsafe
preview tags, unsafe attributes, stale results and missing sign-in recovery.
The attribute payload was strengthened to use an allowed paragraph, so that
check does not accidentally rely on the disallowed-element check.

Screenshots inspected: tests/screens/n12-{1280,390}-{light,dark}.png and
s2-{1280,390}-{light,dark}.png. No overflow, readable tables/frontmatter/links.
CSP, hostile, privacy, docs, pinned-view and keyboard regressions passed.
The keyboard fixture now preserves real preview-library routing.

The app is still one file under 150,000 bytes (148,069 at review), no build.
Tabs and shortened duplicate introductory prose leave room while preserving
security/data-loss comments. Existing owner package-lock.json edit untouched.

### S3 and S4 — 2026-09-27

The owner requested the next two items together. S3 is `85a2893`; S4 is the
following feature commit on `codex/accessibility-images`. One combined full
CI check follows focused development; no repeated owner setup or release smoke.

- S3 initially failed on unnamed preview task checkboxes and the plain-editor
  textarea. Both now have accessible names. Adding actual repository images
  exposed low-contrast attachment rows in both themes; removing their opacity
  fixed that. No axe rules are disabled. All serious/critical violations fail.
  A deliberately unnamed button verifies the audit catches a violation.
  Full reports including incomplete/manual-review results are in
  tests/screens/accessibility-{chromium,webkit}.json. This is automated coverage,
  not a claim of full screen-reader or keyboard accessibility certification.
- S4 fetches repository PNG/JPEG/GIF/WebP bytes from the existing Contents API,
  validates encoding, byte limit and raster signatures, and creates image data
  URLs in memory. No new runtime library or host, no raw HTML image permission,
  no persistent image cache. Limit 20 references and four concurrent reads;
  duplicate paths share a request. Relative Markdown URLs and literal Obsidian
  paths work; missing, unsupported, external and oversized images show notices.
- Review found literal-percent wiki filenames were incorrectly URI-decoded;
  fixed and covered. Late image replies cannot replace another note; expired
  sign-in returns to sign-in. Hidden paths and known symlinks are refused.
- Focused final checks: accessibility 29/29, preview-images 15/15 in each engine
  (about twelve seconds together with docs), plus preview, CSP, hostile and
  real-editor keyboard coverage. The Contents fixture now supplies documented
  size and base64 encoding fields; no API behaviour invented.
- Mutations caught missing task/plain-editor labels, raster-type checks,
  decoded-byte limit, hidden-path refusal, image count limit and auth recovery.
  Earlier stale-image guards also retain independent detached-node protection.
- Desktop/phone light/dark images viewed: tests/screens/s4-{1280,390}-{light,dark}.png,
  including a 512px image shrinking to the phone width. CSS formatting was
  compacted to retain the single-file/no-build rule; app size 149,000 bytes.
- A reviewer audit ran during an edit/hash-refresh window and could not open
  sign-in in its final fallback case. Stable-file runs in both engines passed;
  audit failures were not suppressed. Owner package-lock.json remains untouched.

Final CI caught two unchanged manifest assertions requiring spaces after CSS colour variables. Restored that formatting; all assertions retained. Focused manifest and axe checks pass in both engines. The app remains under 150 KB.

- 2026-09-27 · N13 · done · 310c908, cbb4954, 16bddb3 (pin every CDN file to its hash; CI checks them against cdnjs, weekly too)
- 2026-09-27 · N14 · done · f4921b0 and its review fixes (merge a note changed on GitHub; Save as copy when it cannot be merged)
- 2026-09-27 · N15 · done · 860eab3 and its review fixes (pins follow you between devices); size limit raised to 200 KB (6d1581b); clean-up assessed: none now, a shared note reader as the first step of N17
- 2026-09-27 · N18, N19 · done · 9798935 and its review fixes (resize and hide the file list; a light/dark choice)

### N26 evidence — 2026-09-29
- Shared reader: four requests at most, queued cancellation and ignored late results, same-path in-flight deduplication, SHA cache capped at 64 entries / 2 MiB. Scope/auth/write/rename/delete invalidation; editor reads remain fresh.
- Recent: on-demand history (10 commits, 100 files per commit), first 20 opened/changed notes, local draft priority, missing-history notice. Uses documented GitHub commit endpoints; no added permissions or runtime dependency.
- Fresh G-3 review found phone overflow, expired-auth loading stuck and stale-SHA cross-path response reuse. All fixed, with regression assertions. The pending reader keys include paths; only confirmed matching-SHA results enter the shared cache.
- Focused checks: recent-notes 18/18, content-search 13/13 and pins-sync 54/54 in Chromium and WebKit. Mutation restoring cross-path pending dedup failed as expected (tests/screens/recent-mutation.log). Cache-aware search fixtures explicitly clear cache when exercising network failures/holds; distinct blobs preserve the 300-read bound assertion.
- Inspected screenshots: tests/screens/n26-{1280,390}-{light,dark}.png. Phone list scrolls within 25vh. Final full suite runs after N27.

### N27 evidence — 2026-09-29
- Reads simple Obsidian YAML list/scalar tags and inline tags, case-insensitive with nested-parent counts. Tags in Files uses the shared reader for up to 300 notes and labels incomplete results. Chips prefer current text and drafts; add/remove changes only frontmatter, using the editor Undo history and ordinary save/conflict handling.
- Read-only, scope changes, deleted/renamed notes, hostile-looking keys, hidden/binary files and late reads covered. A saved edit preserves UTF-8 BOM, untouched CRLF lines, other properties and unsaved body text. No new runtime dependency, host or stored index. Obsidian semantics checked at https://obsidian.md/help/tags and https://obsidian.md/help/properties.
- Independent G-3 review found valid but unsupported YAML root indentation, explicit keys and blank-separated scalar continuation could be damaged. All now refuse the edit, with regression assertions. Duplicate/quoted/spaced tags keys, aliases and complex values also refuse edits; source editing remains available.
- Focused tags suite 53/53 in Chromium and WebKit. Removing the safe-frontmatter guard makes assertions fail (tests/screens/tags-mutation.log). Existing development-note references shortened, with all detailed explanations retained in docs/dev/implementation-notes.md, to keep the app below 204800 bytes.
- Inspected tests/screens/n27-{1280,390}-{light,dark}.png and n27-390-{light,dark}-chips.png. Scrolling sidebar sections and note chips stay within phone/desktop bounds. Axe now also scans expanded Tags and Recent.

### N17 evidence — 2026-09-29
- On-demand Linked from panel below the open note, four shared reads at a time / at most 300 Markdown files. Reports skipped, failed and truncated listings; local drafts win, changing note/repository cancels publication, sign-out clears results, missing Markdown CDN has a visible fallback. Does not write or persist an index.
- Fresh G-3 review found formatted and URL wikilink aliases split across parser tokens and were omitted. Fixed by tokenising opaque references through the existing Markdown parser; code, escaped links, comments and embeds still do not count. Regression tests cover these aliases and Obsidian comments outside code.
- Backlinks 13/13 and existing wikilinks 47/47 pass in Chromium and WebKit. Removing the target-match filter causes expected failures (tests/screens/backlinks-mutation.log). Screens tests/screens/n17-{1280,390}-{light,dark}.png inspected.
- Longer comments appended to implementation-notes.md with executable AST equality verified; numbered source comments point there. Existing notes retained. No new dependency/build step; final size/full CI checked with N28.

### N28 evidence — 2026-09-29
- Outline uses current source and the existing Markdown parser, no requests or writes. Source maps follow nested lists/quotes and setext headings; duplicate headings jump by render identity in Preview. Focus goes to the heading/editor, Escape closes, stale source refuses a jump, account/repository boundaries clear private outline text. Previous/More provides all headings with at most 500 entries per page.
- G-3 review found the initial 500-entry cap hid later headings; pagination fixed it and a 505-heading regression checks both directions. Reviewer independently verified 1001 entries and the final jump. Initial different-frontmatter-parsers concern was refuted, but exercising empty frontmatter exposed an older shared regex error: it could consume through a later horizontal rule. Both views now share a parser that stops at the first delimiter, with a real Preview-jump regression.
- Outline 36/36, Preview 15/15, axe 57/57 and size checks pass in both engines. Related tags 53/53 and pins-sync 54/54 also pass after the frontmatter fix. One initial combined focused run reported an outline WebKit failure; isolated and subsequent combined checks passed with all assertions retained. Full CI remains the combined release validation.
- Removing the source-change guard causes the intended assertion to fail (tests/screens/outline-mutation.log). Inspected tests/screens/n28-{1280,390}-{light,dark}.png. Remaining longer source comments moved to the existing implementation notes with AST equivalence checked, preserving the single-file size limit without runtime dependencies or a build.
- Full CI on a3de4bb: all 61 WebKit suites passed; Chromium caught the backlinks summary covering task capture at the iPhone SE keyboard height. Fixed viewport resize handling to scroll the focused Preview field into view and collapse expanded backlinks when the keyboard leaves under 450px. Existing keyboard assertions retained; expanded-panel checks added. Keyboard now 33/33 in both engines, with editor resize/scroll-count assertions unchanged. The corrected PR runs full CI again before merge.
- 2026-09-29 · N36 · done · (the commit "N36: remove the header's back and forward buttons")
- 2026-09-29 · N37 · done · 0823ccd and the commit "N37: fixes from review"; merged in forwardmotionnz/notes#23
- 2026-09-29 · N38 · done · baa1aa9, 58a1107 and the commit "N38: fixes from review"
- 2026-09-29 · N38 follow-up · fixed · clicking a tab did nothing: a code comment in the middle of a line (added in N38's review fixes) cut off the tab's click handler, title and open mark. note-tabs now clicks tabs by name ("clicking a tab opens its note", "and marks that tab as open"), which fail without the fix.
- 2026-09-29 · New note folder (owner's report: a new note could not be put in a folder; owner chose the dialog from a four-part proposal) · done · a New note dialog with name, folder picker (open note's folder by default, dot folders hidden, New folder…), path preview and Open for an existing name. `tests/new-note.test.mjs` 36/36; G-2: hidden folder refused, folder names as text, default folder, dot folders hidden each fail a named check when reverted. Tests that answered the browser prompt use `H.newNote` (a typed path still starts from the top level, as before). The rest of the proposal followed on 2026-09-30 (owner's request).
- 2026-09-30 · Folder proposal, the rest · done · a + on each folder opens New note there (the folder's open state is left alone); Rename or move uses the same dialog (name and folder, Rename or Move, refused names explained before anything is sent); a note never saved can be renamed or moved, moving its draft, with no commit. `tests/new-note.test.mjs` 58/58. G-2: offering Rename before the first save, the no-commit move, refusing a taken name, the + not toggling its folder, and moving the draft each fail when reverted. Tests that typed into the rename prompt use `H.moveNote`; in rename.test, refused names are now explained by the dialog rather than a "Not renamed" message after asking GitHub, so those checks read the dialog's reason.
- 2026-09-30 · N29 · done · callouts in Preview (see the item).
- 2026-09-30 · Review of the folder work and N29 · fixed, each with a check (new-note, callouts): a never-saved note could be moved while its first save was on its way (the save still wrote the old path, then conflicts followed); a note in conflict could be moved, and Discard then emptied it; names with a dot ("Dr. Smith.md") could not be renamed or moved without typing .md; the dialog could close silently if another note opened meanwhile (also: Ctrl+K no longer opens over it); Outline could not reach a heading inside a folded callout. Noted, not changed (it predates this work): a task inside any quote, callouts included, makes the note's Preview checklist read-only, because checklistLines does not read quoted tasks. Worth an item of its own now that [!todo] callouts make it common.
- 2026-09-30 · note · one full-suite run failed in app.test.mjs (Chromium) and it did not come back in 22 runs of the suite under load or 4 more full runs; the failing check was not captured. Watching CI for it.
