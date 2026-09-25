# MVP ledger

Iterations: 2 / 30

## Items
| ID | Priority | Status | Evidence |
|----|----------|--------|----------|
| C1 | 1 | done | `tests/drafts.test.mjs` 44/44 (written before unload, reload, closed tab, new file, stale draft → conflict + Discard, session-only, mode switch, sign-out, plus six review regressions); screens `tests/screens/c1-{desktop,phone}-{light,dark}.png`; commit daa2754 |
| C2 | 2 | done | `tests/autosave.test.mjs` 36/36 (pause commits, steady typing does not, hide commits, Save kept, in-flight save not raced, conflict stops autosave and keeps the draft, restored draft and New wait for typing, plus seven review regressions); screens `tests/screens/c2-{desktop,phone}-{light,dark}.png`; commit 493850a |
| C3 | 3 | todo | |
| G2 | 4 | todo | |
| G1 | 5 | todo | |
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
| G3 | 18 | todo | |
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

## Needs the owner
(exact steps for human-only actions)
- **Give Claude push access to `forwardmotionnz/notes`.** Pushing `claude/pensive-sagan-0vk6ud` was refused (403): Claude's GitHub App has no access to this repository. Connect or reconnect GitHub at https://claude.ai/connect-github, and install the Claude GitHub App on `forwardmotionnz/notes` (an organisation owner may have to approve it). Until then, commits stay in the session's container and are lost if it is reclaimed.

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

## Decisions
- 2026-09-25: Work happens on `claude/pensive-sagan-0vk6ud`, not `mvp`. The session that runs this loop is only permitted to push that branch; it plays the role the command gives `mvp`. Rename or merge it as you see fit.

- 2026-09-25: Drafts are written on every change, not on `pagehide`/`visibilitychange`: iOS can discard a background page without firing either.
- 2026-09-25: A restored draft keeps the sha it was based on, so it goes through GitHub's conflict check; a **Discard** button appears for a restored draft or a conflict, as the way out.
- 2026-09-25: Autosave waits 2 s after the last keystroke and commits at once on `visibilitychange` to hidden. It only saves text typed since the file was opened: restored drafts and New templates wait for a keystroke or Save.
- 2026-09-25: Ledger updates land in a small follow-up commit, since an item's commit cannot contain its own hash.

## Log
(one line per iteration: date, item, result, commit)
- 2026-09-25 · C1 · done · daa2754
- 2026-09-25 · C2 · done · 493850a (push still refused, 403)
