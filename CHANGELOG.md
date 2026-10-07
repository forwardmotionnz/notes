# Changelog

## 1.0.0 — 2026-09-29

This entry tracks the first version and the features since; no version tag
is published yet. The shared copy's sign-in is configured and its GitHub App
is public. The automated release checks passed, and the
owner reported the real-phone and real-GitHub checks completed on 2026-09-27 (the
[release checklist](docs/dev/RELEASE_CHECKLIST.md); every item's evidence is
in the [development ledger](docs/dev/MVP.md)).

### Added
- A new icon: a notepad whose last line ends in a commit dot, on a rounded tile (the old page-with-a-folded-corner looked like an office file). Android gets a crop-safe version of its own, and the browser tab a simplified one.
- **Look around first** on the sign-in screen: Padgit with sample notes that explain it, no account needed. They live only in that tab: nothing reaches GitHub or the broker, and nothing is written to the browser's storage.
- The sign-in screen shows what Padgit is before asking for access: **How it works** (a picture of the app, loaded only when opened, and the three steps), and links to the guide, the source code and running your own copy.
- Who changed what: **Recent** names who made each change (you, or an agent such as Claude or Codex) and marks notes someone else changed since you last opened them. **⋯ → History** lists a note's last 20 changes with the lines each removed and added, and **Restore this version**. The guide has a section on using Padgit with agents, with a sample `AGENTS.md`.
- Plainer first steps for people new to GitHub: the sign-in screen says AI tools you connect can read your notes and links to making a free GitHub account; first run explains what a repository is; the guide has a short *New to GitHub?* section.
- Support Padgit: About links to the owner's GitHub Sponsors page, and the repository page has a Sponsor button.
- Any note can be the template for Today: **⋯ → Use for new daily notes** in a saved note, and **Stop using** to go back to blank. Padgit sets only the `template` line of Obsidian's `.obsidian/daily-notes.json` (made if missing), so the choice follows you to every device and to Obsidian.
- Drag a note in Files onto a folder to move it there, or onto the Files heading for the top level (with a mouse; on touch screens Rename or move stays the way). One commit, as Rename or move.
- Recently deleted, under Recent in Files: notes deleted in the last 30 changes, read from the repository's history, with Restore to bring one back in a single commit.
- Tasks inside a quote or a callout (such as `> [!todo]`) can be ticked, edited, moved and removed in Preview. Before, one quoted task made the whole note's checklist read-only.
- Images up to 10 MB now show in the viewer and in Preview (larger than 1 MB are read as Git blobs). The address-change notice is gone: Padgit lives at padgit.com.
- Images in the file list open in a viewer, with Add to note and a link to GitHub. Photos and screenshots over 1 MB are made smaller in the browser before upload instead of being refused, and error messages now stand out as a red label.
- Obsidian callouts in Preview: `> [!tip] Title`, `> [!warning]` and the other kinds show as coloured boxes; `-` and `+` make them fold shut or open. The note's text is unchanged.
- A + on each folder in Files makes a new note in it; Rename or move uses the New note dialog's folder picker, and works on a note before its first save (without a commit).
- New note asks for a name and a folder (starting in the folder you are in, with New folder… for a new one) and shows where the note will be saved, instead of the browser's plain prompt.
- A calmer look (from the owner's review): one set of line icons, one family of buttons, a header with the note's name, a save dot, an Edit / Preview switch and a ⋯ menu for Rename or move, Outline, Tags and Delete; tabs that look like tabs (a row of chips on phones); an icon formatting toolbar; Pinned, Recent, Tags and Files as sidebar sections; headings in Preview in the device's book face; simple properties as chips; checklist rows that edit on tap, with a drag handle and a ⋯ menu. No fonts or images are downloaded.
- Heading outline with source/Preview navigation, nested headings and paging for long notes; no extra requests.
- “Linked from” backlinks for the open Markdown note, including wikilinks, Markdown links and local drafts.
- Tags from frontmatter and note text, counted in Files, with tag chips and safe frontmatter editing.
- Recent notes with titles, previews and opened/changed times; shared, bounded reads for previews, search and pin discovery.
- Open-note tabs, remembered per repository and folded into a list on phones; closing preserves drafts.
- Paste, drop or choose images to upload into the vault's attachment folder and link from a note.
- Markdown formatting toolbar, selection-aware shortcuts and Undo in both editors.
- Editable checklists in Preview for any note, with inline text edits, nested reordering and removal Undo. New tasks are typed in Edit (or with the toolbar's checklist button), like any other line.
- Centred reading columns and a remembered note text size for editor and Preview.
- Note addresses and browser back and forward navigation, including bookmarks restored after sign-in.
- About Padgit in Settings, with the version and links for this deployment.
- Padgit branding (formerly Notes), plus a notice before the planned move
  to padgit.com. The domain cutover still needs the owner's coordinated
  account changes; the existing shared address remains in use meanwhile.
- Persistent note save status, last-save time and source word count. Offline
  status only promises a local copy when the current text is stored.
- Quick note switcher: Ctrl/Cmd+K or Find, recent paths, ranked name matches,
  keyboard navigation and phone support, without extra searches on GitHub.

- On a computer, the file list can be hidden (☰) and resized by dragging
  its edge; both are remembered. A theme choice in Settings: the device's
  setting, Light or Dark.

- Pins follow you between devices: pinning a note adds `pinned: true` to
  its properties, and each device finds pinned notes by reading each note
  once (up to 500 per visit, then only notes that changed). Pins from before
  stay in this browser until moved.

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
  A pinned note is a shortcut: it opens like any other note. (Earlier it
  opened a separate Tasks screen with an "Add a task" box; both are gone, as
  are the header's ← and → buttons, in favour of the browser's own Back and
  Forward.) This replaces the right-hand panel, phone bottom sheet and
  Settings pins field.

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
- Checklists with sub-tasks indented by tabs (Obsidian's default) or four spaces can be ticked, edited, moved and removed in Preview again. Before, one such sub-task made the whole note's checklist read-only.
- A space or tab left at the end of a checklist's last line no longer makes the whole checklist read-only in Preview.
- Clear done leaves a ticked task in place when its unticked sub-tasks are indented a tab or four spaces: without it they would turn into a code block.

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
