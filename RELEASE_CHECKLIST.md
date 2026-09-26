# MVP release checks

This is the remaining release gate. Account setup is already complete;
do not repeat it unless a check reveals a configuration problem.

## Already completed by the owner

- [x] GitHub App is public and installable by other accounts.
- [x] Cloudflare broker is deployed and `CLIENT_SECRET` exists.
- [x] The live page points to the deployed broker with the correct callback.
- [x] Owner has authorised merging the reconciled MVP into `main`.
- [x] Basic Android Chrome save and reload: owner confirmed this already
  worked before the merge (reported 2026-09-27).

## Automated and simulated checks

The MVP ledger records the exact test runs, independent review, regression
checks and viewed screenshots. Simulated GitHub and browser viewports do
not count as the real-account and real-phone checks below.

## Real GitHub and phone smoke tests — pending

Use ordinary test notes. Record device/browser, date, result and any issue
link next to each checked item; do not include tokens or private note text.

The owner will use **Android with Chrome**. A second GitHub account is not
currently available; leave the separate-account sharing check open. Do not
repeat the completed basic phone journey. Recheck the changed New action:
Files → + should close the drawer and leave the new note ready for typing.

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

Only mark the MVP ready to share after every required check above passes.
Keep a failed check open with its reproduction steps.
