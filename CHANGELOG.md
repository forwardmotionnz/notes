# Changelog

## Unreleased — MVP candidate

This candidate is on `mvp`; it is not ready to share as a finished release.
WebKit testing (F2) is blocked, so the release gate has not passed. The owner
still needs to configure the broker and make the GitHub App installable by
other accounts. Shared sign-in is disabled until that setup is complete.
The real-phone and real-GitHub smoke tests are still pending. See
[MVP progress and exact owner steps](MVP.md).

### Added

- One shared app can connect to personal and organisation repositories,
  including multiple installations and long repository lists. First-run
  guidance helps create a private repository; an empty repository accepts
  its first note. Read-only and unavailable repositories explain their state.
- Autosave, an explicit Save button and browser drafts protect edits between
  file changes and reloads. Conflicts pause autosave and keep the local text.
- Rename or move the saved note in one commit (unsaved edits are saved first),
  and delete with confirmation and recovery through GitHub history.
  Ordinary Markdown files stay compatible with
  Obsidian, including line endings and existing vault folders.
- Wikilinks open matching notes or offer to create a missing note. A phone
  layout, light and dark themes, and a home-screen manifest with icons.
- A Content Security Policy, safe handling of repository text and a
  [plain-language privacy note](PRIVACY.md). Outages and rate limits show
  persistent retry guidance; temporary sign-in outages preserve credentials.
- A Try it guide and a bug report template for device, browser and expected
  result.

### Known limitations

- A connection is needed to load and commit notes; there is no offline sync.
  A failed save keeps a browser draft. Conflicts require manual recovery:
  copy your latest text before using **Discard**, which loads the remote
  version. After an interrupted save and a reload or repository switch, a
  conflict may be with your own earlier save.
- **Sign out** removes the shared remembered drafts and the current tab's
  session-only drafts. Sign out in each session-only tab separately, including
  duplicated tabs. Save first. Session-only drafts can be lost when the browser
  session ends; browsers that restore tabs may restore the session too. See
  the privacy note for storage and revocation.
- Files over 1 MB, binary attachments, non-UTF-8 text and Git LFS files are
  not edited. Very large repositories may return a partial file list. There
  is no attachment upload, merge tool or offline queue.
- On iPhone or iPad, the home-screen app has separate sign-in and drafts
  from the browser. Save browser drafts before switching. Keyboard layout
  has been tested with simulated viewport changes; actual device behaviour
  still needs the real-phone checks above.
- If the editor's CDN is unavailable, a visible `plain` badge identifies the
  fallback text editor. Notes still depends on GitHub and the sign-in service.
- Anyone using a shared copy trusts the person running it and its GitHub
  App; that owner can access installed repositories. Signing out does not
  revoke access on GitHub. The privacy note explains revoking authorisation
  and uninstalling the App.
