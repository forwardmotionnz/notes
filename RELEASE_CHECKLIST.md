# MVP release checks

The owner reported “all tests pass, completed” on 2026-09-27 and asked to
continue features. Release testing is accepted as completed on that basis;
do not repeat setup or request the same checks again.
The checklist below is retained as a future smoke-test guide. Its individual
boxes are historical: no per-case results or account identities were supplied
with the final confirmation. In particular, a second account was previously
unavailable; this record does not claim an independently observed second-account test.

## Already completed by the owner

- [x] GitHub App is public and installable by other accounts.
- [x] Cloudflare broker is deployed and `CLIENT_SECRET` exists.
- [x] The live page points to the deployed broker with the correct callback.
- [x] Reconciled MVP merged into `main` in [PR #5](https://github.com/forwardmotionnz/notes/pull/5).
  Pages published commit `032f6e6`; its live app script matched `main`.
- [x] Basic Android Chrome save and reload: owner confirmed this already
  worked before the merge (reported 2026-09-27).
- [x] Android Chrome, after refreshing the merged deployment: **Files → +**
  closes the drawer and leaves the editor ready for typing. Owner confirmed
  this passed on 2026-09-27.

## Automated and simulated checks

The MVP ledger records the exact test runs, independent review, regression
checks and viewed screenshots. Simulated GitHub and browser viewports do
not count as the real-account and real-phone checks below.

## Real GitHub and phone smoke tests — reference

Use ordinary test notes. Record device/browser, date, result and any issue
link next to each checked item; do not include tokens or private note text.

The owner used **Android with Chrome**. The overall completion report above
supersedes the earlier pending instructions. Automated browser passes alone
are not real-account or physical-device evidence.

- [ ] **Second account on a phone:** open
  [Notes](https://forwardmotionnz.github.io/notes/), sign in with an account
  other than the App owner, and install Notes on one chosen private test
  repository. Confirm it appears, save `Hello.md`, verify the commit on
  GitHub and reload Notes to read it back. Check portrait typing, the Save
  button above the keyboard, Files, Tasks, and light/dark appearance.
- [ ] **Empty repository:** create a private repository without initial
  files. Follow both first-run steps, return to Notes and save its first
  note. Confirm that GitHub now has the note and a branch.
- [ ] **Organisation repository:** install or request approval for a test
  organisation repository. Once approved, select it, save a note and verify
  that the commit went to that repository. Record any SSO requirement.
- [ ] **Obsidian vault and attachments:** use a test copy containing Markdown,
  wikilinks, folders and an image/PDF. Edit a note and follow a wikilink.
  Confirm attachments remain unchanged and Obsidian still opens the vault.
- [ ] **Session-only:** select **Forget me when I close the browser**.
  Confirm the session badge, edit and reload to recover a draft, then save
  and explicitly sign out. Reopen and confirm sign-in is required. Browser
  tab restoration can restore a session; closing alone is not proof of
  sign-out.
- [ ] **Revocation:** save first, then revoke Notes under GitHub's authorised
  GitHub Apps. The next protected action must ask for sign-in, keep unsaved
  words and avoid a write. Sign in again and confirm recovery. Separately
  removing the installation should make that repository unavailable.
- [ ] **Two tabs overnight:** open the same test repository in two remembered
  tabs and leave both beyond the access-token lifetime (normally eight
  hours). In the morning, use each tab, save different notes, and verify both
  commits without a surprise sign-out. For simultaneous edits to one note,
  confirm a conflict preserves the later tab's unsaved words.
- [ ] **Home-screen app:** add Notes to the phone home screen. Open it, sign
  in there, return to that same app after GitHub, save and reload a note.
  On iPhone/iPad the browser and home-screen app have separate sign-in and
  drafts; save before moving between them.

For future releases, record any failed check with its reproduction steps.
