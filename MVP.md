# MVP ledger

Iterations: 4 / 30

## Items
| ID | Priority | Status | Evidence |
|----|----------|--------|----------|
| C1 | 1 | done | `tests/drafts.test.mjs` 44/44 (written before unload, reload, closed tab, new file, stale draft → conflict + Discard, session-only, mode switch, sign-out, plus six review regressions); screens `tests/screens/c1-{desktop,phone}-{light,dark}.png`; commit daa2754 |
| C2 | 2 | done | `tests/autosave.test.mjs` 36/36 (pause commits, steady typing does not, hide commits, Save kept, in-flight save not raced, conflict stops autosave and keeps the draft, restored draft and New wait for typing, plus seven review regressions); screens `tests/screens/c2-{desktop,phone}-{light,dark}.png`; commit 493850a |
| C3 | 3 | done | `tests/switching.test.mjs` 33/33 (no dialog on switch, New or change of repository; commit on leaving; offline and conflict keep a draft; save in flight; untouched template leaves nothing; right repository; reopening during a commit; failed open; two-tab draft; lost reply across repositories); rewritten drafts/autosave tests listed below; commit ec26502 |
| G2 | 4 | done | `tests/hostile.test.mjs` 28/28: source scan for HTML sinks (incl. bracket and split spellings); payloads in file, folder, pin and new-note names, note text, task lines, headings, branch, login, a GitHub error message, a pin read error and the sign-in error in the URL; folders and pins named `constructor`, `__proto__`, `toString`, `valueOf`, `hasOwnProperty`; tripwire never set and no payload element created. Screens `tests/screens/g2-{desktop,phone}-{light,dark}.png`; commit COMMIT |
| G1 | 5 | todo | |
| N1 | 5a | todo | From G2 review: a note with CRLF line endings opens as an "unsaved draft" nobody made (the editor normalises to LF), Discard cannot clear it, and any edit rewrites every line ending. Must open clean and save with the file's own line endings. |
| N2 | 5b | todo | From G2 review: signing in with "Forget me" ticked, then "Choose repositories" (opens a new tab, returns with `setup_action`) starts a remembered sign-in there and writes a 6-month refresh token to localStorage. Session-only must survive that round trip. |
| N3 | 5c | todo | From G2 review: Save in Settings (or signing in) in one tab fires a storage event with no value first, and every other tab drops to the sign-in view with no way back but a new sign-in. |
| N4 | 5d | todo | From G2 review: a crafted `?error=…&error_description=…` link shows attacker-worded text as a sign-in error and hides a signed-in user's notes. Only honour it when a sign-in from this tab is pending; never show arbitrary text. |
| B1 | 6 | todo | |
| B3 | 7 | todo | |
| A1 | 8 | todo | |
| D1 | 9 | todo | |
| D2 | 10 | todo | |
| E1 | 11 | todo | |
| B2 | 12 | todo | |
| A2 | 13 | todo | |
| A3 | 14 | todo | |
| F2 | 15 | todo | |
| F1 | 16 | todo | |
| F3 | 17 | todo | |
| G3 | 18 | todo | Note from C3 review: with the token near expiry and no network, `refreshTokens` treats "could not reach the sign-in service" as a dead token and signs the user out. Fix under G3. |
| H1 | 19 | todo | |
| H2 | 20 | todo | |
| H3 | 21 | todo | |
| S1 | 22 | todo | SHOULD |
| S2 | 23 | todo | SHOULD |
| S3 | 24 | todo | SHOULD |
| S4 | 25 | todo | SHOULD |

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

## Needs the owner
(exact steps for human-only actions)
- ~~Give Claude push access to `forwardmotionnz/notes`.~~ Done by the owner on 2026-09-25; branch pushed.

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

## Decisions
- 2026-09-25: Work happens on `claude/pensive-sagan-0vk6ud`, not `mvp`. The session that runs this loop is only permitted to push that branch; it plays the role the command gives `mvp`. Rename or merge it as you see fit.

- 2026-09-25: Drafts are written on every change, not on `pagehide`/`visibilitychange`: iOS can discard a background page without firing either.
- 2026-09-25: A restored draft keeps the sha it was based on, so it goes through GitHub's conflict check; a **Discard** button appears for a restored draft or a conflict, as the way out.
- 2026-09-25: Autosave waits 2 s after the last keystroke and commits at once on `visibilitychange` to hidden. It only saves text typed since the file was opened: restored drafts and New templates wait for a keystroke or Save.
- 2026-09-25: Leaving a file commits it rather than asking. A person switching files wants their words kept, and the history holds anything they regret; offline or in conflict, the draft keeps it instead.
- 2026-09-25: No `innerHTML` at all, rather than "only with static strings": a rule a test can enforce beats a judgement each reader must repeat.
- 2026-09-25: Review findings outside the current item become ledger items (N1–N4) rather than widening the item. They go straight after G1 because three of them touch data or sign-in.
- 2026-09-25: Ledger updates land in a small follow-up commit, since an item's commit cannot contain its own hash.

## Log
(one line per iteration: date, item, result, commit)
- 2026-09-25 · C1 · done · daa2754
- 2026-09-25 · C2 · done · 493850a
- 2026-09-25 · C3 · done · ec26502 (pushed once the owner granted access)
- 2026-09-25 · G2 · done · COMMIT
