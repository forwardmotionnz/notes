# MVP ledger

Iterations: 1 / 30

## Items
| ID | Priority | Status | Evidence |
|----|----------|--------|----------|
| C1 | 1 | done | `tests/drafts.test.mjs` 44/44 (written before unload, reload, closed tab, new file, stale draft → conflict + Discard, session-only, mode switch, sign-out, plus six review regressions); screens `tests/screens/c1-{desktop,phone}-{light,dark}.png`; commit COMMIT |
| C2 | 2 | todo | |
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

## Needs the owner
(exact steps for human-only actions)

### C1: gauntlet record
- G-1: full suite green three runs in a row, Chromium (WebKit arrives with F2).
- G-2: each safeguard reverted alone and caught: draft write, draft keeps its base sha, sign-out deletes drafts, session-only store, move on mode switch, signed-in guard, drop when clean, clear on commit, drop on confirmed discard, New reopens a draft, sign-out confirm names drafts, other tab's draft kept, Discard only after a successful fetch.
- G-3 findings: (1) accepting "Discard unsaved changes?" kept the draft, so it came back one Save from commit: fixed, test. (2) New on a path with an uncommitted draft overwrote it: fixed, test. (3) Sign-out deleted drafts without saying so: confirm now names them, test. (4) Saving in tab A deleted tab B's newer draft on the same file: fixed (only a draft this tab wrote, or one matching the commit, is dropped), test. (5) Drafts stranded in the wrong store after signing back in session-only: refuted, since sign-in always ends in `saveSettings`, which moves them; test "session-only sign-in moves drafts off disk" passes and fails when that move is removed. (6) Discard offline dropped the draft and left a dead editor: fixed (dropped only after GitHub's version arrives), test.
- Accepted, with reason: two tabs typing into the same unsaved file share one draft, so the later keystroke wins. Both texts are edits of the same file by the same person, and C2's autosave will narrow the window. A commit whose response is lost leaves a draft on the old sha: the next open reports a conflict and nothing is overwritten, so it is safe, if unfriendly.
- Tests corrected, not weakened: "draft survives visiting another file" assumed that answering OK to "Discard unsaved changes?" keeps the draft, which is finding (1). It now checks that declining keeps the draft, and a new test checks that accepting discards it. The sign-out test got its second draft by switching files, which now discards it; it plants the second draft in storage instead.
- G-4: phone header overflowed with the restore message; status now wraps to its own line under 820 px and the crumb tag truncates before the filename does. Screens above, no horizontal overflow at 390 or 1280, light and dark.
- G-5: no new dependency, no new request, `index.html` 59.7 KB. G-6: README describes drafts, Discard, and session-only drafts not surviving a browser close.

## Decisions
- 2026-09-25: Work happens on `claude/pensive-sagan-0vk6ud`, not `mvp`. The session that runs this loop is only permitted to push that branch; it plays the role the command gives `mvp`. Rename or merge it as you see fit.

- 2026-09-25: Drafts are written on every change, not on `pagehide`/`visibilitychange`: iOS can discard a background page without firing either.
- 2026-09-25: A restored draft keeps the sha it was based on, so it goes through GitHub's conflict check; a **Discard** button appears for a restored draft or a conflict, as the way out.
- 2026-09-25: Ledger updates land in a small follow-up commit, since an item's commit cannot contain its own hash.

## Log
(one line per iteration: date, item, result, commit)
- 2026-09-25 · C1 · done · COMMIT
