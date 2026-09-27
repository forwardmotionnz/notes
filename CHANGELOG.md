# Changelog

## Unreleased — MVP candidate

This entry tracks the MVP and the next features; no version tag is published.
The broker and its secret are configured, and the GitHub App is public.
Safari fixes and MVP error recovery have been brought together; the
automated release checks passed, and the owner reported the real-phone and
real-GitHub checks completed on 2026-09-27. See
[MVP progress and exact owner steps](MVP.md).
Record their results in the [release checklist](RELEASE_CHECKLIST.md).

### Added

- Conflicts: a note changed on GitHub while you edited it is merged with
  your version when you changed different lines, and saved. Where you both
  changed the same lines, **Save as copy** keeps yours as a new note beside
  theirs, instead of copying the text out by hand before **Discard**.

- Every file loaded from the CDN is pinned to an integrity hash, the editor
  (CodeMirror) now included, so a changed file is refused rather than run.
  A refused editor script or stylesheet means the plain editor, with its
  badge; a refused Markdown mode means no syntax colours; a refused
  Markdown renderer or sanitiser means Preview says it is unavailable. A CI
  job checks each hash against what cdnjs serves, weekly and on every
  change.

- Repository images in preview, including Markdown and Obsidian embeds.
  PNG/JPEG/GIF/WebP up to 1 MB, at most 20 per preview; external and unsupported
  images show notices. Attachment filenames now meet contrast requirements.

- Offline axe accessibility checks across desktop/phone, light/dark, sign-in,
  tasks, editing, preview, search and settings. Preview task boxes and the
  plain editor now have accessible labels.

- Search inside note contents and local drafts from Files with Enter or Search
  contents. Filename filtering stays instant; bounded reads and visible
  incomplete-result notices keep larger repositories manageable.

- Preview current Markdown and drafts with headings, tables, read-only tasks,
  code, links and a frontmatter box. Sanitised with DOMPurify; CDN failure
  preserves editing with a visible notice. Repository images are supported.

- Pin/unpin beside the note name and a Pinned section at the top of Files.
  Pinned notes open as a checklist in the main area, with Edit note and Tasks
  controls to switch views. Pins remain local to this browser. This replaces
  the right-hand panel, phone bottom sheet and Settings pins field.

- Today opens or prepares the day's note, using the vault's Obsidian daily-note
  folder, date format and template where configured. Nothing is created until
  saved. Common date/time template placeholders work; unsupported filename
  formats visibly fall back to `YYYY-MM-DD`.

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

### Fixed

- Signing out invalidates the current page immediately. Delayed account or
  repository replies cannot restore credentials or forgotten preferences
  while the replacement sign-in page loads.
- Delayed note and task reads cannot replace content after changing
  repositories or selecting another note. A queued deletion stays tied to
  the repository where it was confirmed.
- Failed task saves recover every queued capture, preserving newer typing.
  Switching repositories keeps pending task text as an original-repository
  draft. Storage quota failures preserve drafts when changing sign-in mode.
- Creating a note on a phone closes the file drawer so the editor is usable.

### Known limitations

- A connection is needed to load and commit notes; there is no offline sync.
  A failed save keeps a browser draft. A note changed on GitHub and here in
  the same lines (or a restored draft based on an older version) is a
  conflict: **Save as copy** keeps yours as a new note beside theirs, while
  **Discard** loads the remote version and drops yours; there is no
  line-by-line merge tool. After an interrupted save and a reload or
  repository switch, a conflict may be with your own earlier save.
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
