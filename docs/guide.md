# Using Padgit

The detailed guide. For a first note in two minutes, see [Try it](../README.md#try-it).

## Finding and saving notes
The editor's formatting bar inserts or toggles Markdown around selected text
or lines: bold, italic, heading, bulleted/numbered/task lists, links, quotes and
code. With no selection, inline actions select a placeholder to replace.
Ctrl/Cmd+B and I format text; Ctrl/Cmd+Shift+K inserts a link. Ctrl/Cmd+K
continues to open the note switcher. Undo works in both editors.

Editor and Preview use a centred reading column on wide screens. Settings →
**Note text size** changes both at once (Smaller, Normal or Larger), remembers
the choice in this browser and keeps it after sign-out. Phone text stays at
least 16 pixels to avoid focus zoom.

Opening a note updates the address. Bookmark or copy it to return after
sign-in; choose the same repository and branch in Settings. Browser Back and
Forward (or Alt+← and Alt+→) and phone back gestures move between notes.
Leaving still saves edits or keeps their draft. Filenames are in the address
fragment (not sent to the static host), and may remain in browser history.

Settings includes **About Padgit**, with the version, GitHub repository,
privacy note, changelog and **Report a bug**. Links open in a new tab.

Before browsing folders, you can use **Find** in the header or **Ctrl/Cmd+K**
to open a note by name or path. Recent notes appear first for an empty query;
typing ranks exact names and then name prefixes. Use arrow keys and Enter,
or tap a result. Escape closes the switcher. This searches the loaded file
list without reading note contents; use **Search contents** for that.

The line below the note keeps its save status visible, including in Preview:
Saved, Saving, Unsaved changes, a conflict, or an offline draft. A successful
save in this open note shows its time. Word count counts whitespace-separated
parts of the Markdown source, including frontmatter and Markdown markers.
If browser storage is full or blocked, the line says the local copy is
unavailable; save or copy your text before closing the page.

## No notes repository yet


Signed in, but Padgit is on no repository? The app shows two steps and
nothing else: **Create a repository** opens GitHub's form with the name
`notes` and *Private* already filled in, and **Let Padgit use it** opens the
page where you choose that repository for the app. Both open in a new tab.
Come back to the Padgit tab and it notices by itself (or press *Check now*):
with one private repository you go straight in, with several you choose
(a private one called `notes` is offered first). A public repository is never
chosen for you, and choosing one says that anyone can read what is saved
there.

## A brand new, empty repository

A repository with no commits works: the file list says it is empty, and the
first note you save creates its main branch. If
the repository's main branch is later renamed, or your first push from
elsewhere creates a differently named one, the app follows it and says so.

## Writing, saving and organising

**Today** in Files opens your daily note using your device's local date.
Without Obsidian settings it uses `Daily/YYYY-MM-DD.md`. If your vault has
`.obsidian/daily-notes.json`, Padgit reads its folder, format and template
without changing that file. An empty folder means the repository root.
Common Moment year, month, day and time tokens and `[literal text]` work;
unsupported filename formats fall back to `YYYY-MM-DD` with a notice.
Templates support `{{title}}`, `{{date}}`, `{{time}}` and explicit formats
such as `{{date:dddd, D MMMM YYYY}}`; template scripts are not executed.
A new daily note is created only when saved (or after editing triggers
autosave). Existing notes and drafts are preserved. Missing templates or
invalid settings show an explanation and leave the current note alone.

- Folder tree of the repository, collapse state remembered
- **New note** asks for a name and a folder: it starts in the folder of the
  note you have open, lists every folder in the repository, and offers **New
  folder…** for one that does not exist yet (it is made when the note is first
  saved). The line underneath shows exactly where the note will go; if a note
  with that name is already there, it offers to open it instead. Each folder
  in Files also has a **+** (on hover on a computer, always on a phone) that
  opens New note in that folder
- Markdown editor that saves itself; `Ctrl`/`Cmd`+`S` commits at once
- The note's **⋯** menu, at the top right, holds **Rename or move**,
  **Outline**, **Tags** and **Delete**.
- **Rename or move** opens the same dialog on the note's name and folder:
  change either, and the line underneath says where it will go. A saved note
  moves in a single commit: it either happens completely or not at all, and
  it never overwrites another file (a name that is taken is refused before
  anything is sent). A new note you have not saved yet can be renamed or
  moved too; that only changes where it will be saved, so nothing is sent
- With a mouse, you can also drag a note in Files onto a folder to move it
  there, or onto the **Files** heading to move it to the top level. It is
  the same single commit as Rename or move, and is refused the same way (a
  name already taken there, or a note changed on GitHub since the list
  loaded). Expand a folder first to drop into a folder inside it. Unsaved
  words go with the note. On a phone or tablet without a mouse, use
  **Rename or move**: dragging in a list would fight scrolling
- **Delete** removes the open note in a single commit, after asking. Nothing
  is lost for good: the note stays in the repository's history, and on
  github.com the file's history (or the commit that deleted it) lets you
  copy it back. If it changed elsewhere since you opened it, it is not
  deleted.
- **Recently deleted**, under Recent in Files, lists notes deleted in the
  last 30 changes to the repository (here or anywhere else), newest first.
  **Restore** brings a note back as it was just before its latest deletion,
  in one commit, and opens it. It never overwrites a note made at that name
  since, and a read-only repository says why nothing can be restored.
  Nothing extra is kept in your repository: the list is read from its
  history, only when you expand it. Older deletions are still in the
  history on GitHub.
- Pin or unpin the open note using the star beside its name. Pinned files
  appear at the top of Files as shortcuts and open like any other note. A pin is saved in the note itself, as the property
  `pinned: true` at its top (Obsidian shows it as a property; other editors
  keep it), so it shows on every device; pinning saves the note, unsaved
  edits included, and unpinning removes only that line. Each browser reads
  each note once to find pins, up to 500 notes per visit, and after that
  only notes that changed. Files that cannot hold a property (not Markdown,
  or in a read-only repository), and pins made before this change, stay
  pinned in this browser only; unpinning one and pinning it again moves it
  into the note.
- Any note's Preview has live checklists. Add a task in Edit, as a `- [ ]`
  line or with the toolbar's checklist button. In Preview, tick it, tap its
  text to edit it, drag its handle to reorder it, or use its **⋯** menu for
  Edit, Move up, Move down and Remove; moving
  or removing a parent includes its nested tasks and continuation paragraphs.
  Ticks and
  edits go to GitHub one at a time; clicks made while one is on its way
  share the next commit. A task's ⋯ menu is always shown on a phone and
  appears on hover on a computer. **Remove** takes out one task and **Clear
  done** every ticked one, each in one commit, with a few seconds to press
  **Undo**
- Filter across every path in the repository
- The file list: on a computer, the button at the top left hides it to give the note the whole
  width, and dragging its right edge makes it wider or narrower (the arrow
  keys work on the edge too; double-click puts it back to the usual width).
  Both are remembered in this browser. On a phone, ☰ opens it over the note,
  with the search box at its top.
- Light and dark: **Settings → Theme** is *Same as this device* unless you
  choose Light or Dark, which this browser then remembers (signing out keeps
  it)
- A layout that works on a phone

Each save is one commit. Notes save themselves two seconds after you stop
typing, and straight away when you switch to another app or tab. Beside the
note's name, a green dot with **Saved** means GitHub has it; with unsaved
changes it turns into a **Save** button (on a phone, the dot alone), and
`Ctrl`/`Cmd`+`S` works any time. A file you have only opened, or a
restored draft you have not typed into yet, is never saved on its own.
Switching to another file never asks anything: what you typed is committed
on the way out, or, if that cannot happen yet (offline, a conflict), kept as
a draft for when you come back.

A write carries the version it was based on, so if
the file changed underneath you GitHub rejects it: you are told, your text
stays in the editor, and that file stops saving itself until you resolve it.
Nothing is silently overwritten.

Unsaved changes are kept in the browser as you type, one draft per file, so a
reload, a closed tab or a phone closing the app in the background loses
nothing. Open the file again and the draft is back, marked *unsaved draft*;
saving commits it and removes it, **Discard** throws it away and loads the
version on GitHub. A draft remembers which version it started from, so if the
file changed on GitHub in the meantime, saving never overwrites it: it is
merged when the changes are on different lines, or reported as a conflict
(a draft restored after a reload is never merged, only kept both ways). Signing out deletes every draft in that browser.

## Preview and search

Use the **Edit / Preview** switch at the top to read the current note, including unsaved edits,
as rendered Markdown. **Edit** returns to the unchanged source. Headings use
your device's book face. Obsidian callouts (`> [!tip] Title`, `> [!warning]`,
and foldable `> [!note]-` or `> [!note]+`) appear as coloured boxes with an
icon; other editors see an ordinary quote. Simple properties (frontmatter) appear as chips above
the note, such as *Pinned* and its tags; anything more complex appears as its
text; checklists are editable and wikilinks open
notes. Repository PNG, JPEG, GIF and WebP images appear in Markdown image
references and Obsidian `![[image.png]]` embeds. Relative paths resolve from the
note's folder; `/` starts at the repository root. Up to 20 images, each no larger
than 10 MB, load with four requests at a time (images over 1 MB are read as Git
blobs, as GitHub only hands smaller files over with their contents). External images, SVGs, hidden paths
and known symlinks show a notice instead. Missing or undecodable images also
show an explanation. Images never become editable notes.
If the preview libraries cannot load,
Padgit explains this and keeps the editor available.

Save or resolve source changes before editing a checklist. Read-only
repositories keep every checklist control read-only. Unusual or ambiguous
Markdown stays read-only in Preview with a notice; use Edit for its source.
Tasks inside a quote or a callout (such as `> [!todo]`) work like any other;
a quote with a line that carries on without its `>` is one of the unusual
cases. Failed task text edits are kept as drafts and return
when the note is reopened. Clear done removes checked lines only, leaving
unchecked children; × removes the whole task and its children. Both offer Undo.

In **Files**, typing filters filenames instantly. Press **Enter** or **Search
contents** to search note text as well, including local drafts. Opening a result
keeps the list available. Search reads up to 300 text files, four at a time;
files over 1 MB and hidden folders are excluded. It reports unreadable files,
scan limits and partial file lists rather than claiming a complete search.
Press Search contents again to update results after edits, or refresh Files
to pick up remote changes. Search creates no index or extra repository files.

## If a request fails

If GitHub or the connection fails, the message stays visible until another
action. Retry the same button: **Save** for a note, the file-list refresh
button for the list, or the file name to open it again. A request that does
not answer times out after 30 seconds. A temporary sign-in service outage
keeps your sign-in; a rejected refresh token still asks you to sign in again.
For a rate limit, wait for the time shown before retrying. Padgit also holds
requests during that wait. Repository rules may require the repository
owner's help before a write can succeed.

An interrupted save keeps your draft. If you reload or change repositories
before its outcome is known, retrying may report a conflict with your own
earlier save: **Save as copy** keeps your text as a new note beside it.
Padgit does not silently replace a version it cannot verify.

If a note changed on GitHub while you were editing it (another device, a
colleague), saving merges the two when you changed different lines, and
says so. Where you both changed the same lines nothing is guessed: the note
is marked as a conflict, and **Save as copy** saves your version as
"name (my copy).md" beside it while the note shows theirs, or **Discard**
loads theirs and drops yours. No conflict markers are written into notes.

If a checklist save fails, the list goes back to what GitHub has; a task
text edit that could not be saved is kept as a draft of the note, and returns
when you reopen it. Changing repositories while a checklist is saving keeps
its pending text as a draft in the original repository. Return there and
open the note to recover it; copy the text before discarding if it reports a conflict.
If browser storage is full, changing between remembered and session-only
mode stops and explains why, keeping the drafts in their original storage.

## Repositories you cannot change

An archived repository, or one your GitHub account can only read, opens
read-only: a red `read-only` badge says why, the editor is locked and there
is nothing to save, so nothing is ever sent. If a repository is deleted,
renamed or the app is removed from it, the file list says so and points you
to settings.

## Using it on several computers

It is a web page, so any browser works: home, work, phone. Sign in once per
browser. On a phone, open the URL and choose *Add to Home Screen*.
The home-screen shortcut is named **Padgit**, uses the paper icon and opens
the app in its own window. It still needs a connection to GitHub to load
and commit notes.
On iPhone or iPad, sign in again in the home-screen app. Save any browser
drafts first; they stay in the browser. When GitHub opens in a browser to
choose repositories, return to the Padgit home-screen app afterwards.
On a phone, the editor follows the space above the keyboard, keeping the
caret and header controls visible. Pinch zoom remains available.

On a work or shared computer, tick **Forget me when I close the browser**
before signing in. The sign-in and drafts are kept for this browser session
only, not in its lasting storage, and go when the tabs are closed. Drafts of
unsaved changes still survive a reload in this mode, so save before you
leave, and press **Sign out**: a browser set to reopen its tabs on start
brings the session back with them (see the [privacy note](../PRIVACY.md)). A `session` badge in the
header shows which mode you are in.

Sign-ins last six months per browser; the app renews the short-lived token
every eight hours without asking. Several tabs open at once share one sign-in
and take turns renewing it, so they never sign each other out. They share
settings too: choose another repository or pinned files in one tab and the
others follow, after saving what was open in them to the repository it came
from. Signing out, or choosing *Forget me*, in one tab signs the others out.

## Using it with an existing Obsidian vault

It reads the vault as it is. Nothing is converted, and nothing is written that
Obsidian would not understand, so both can work on the same repository.

- `.obsidian/`, `.trash/` and other dot-folders are hidden. They hold app
  state, not notes.
- Attachments cannot be opened in the text editor: decoding them as text and
  saving would corrupt them, so the app refuses. Images (PNG, JPEG, GIF, WebP)
  open in a viewer instead, from the file list: it shows the image, links to
  it on GitHub and has **Add to note**, which puts a link to it at the cursor
  of the open note. Images up to 10 MB are shown; larger ones are not
  downloaded, and the viewer links to GitHub instead. Other attachments, such as PDFs, stay unopenable.
- `[[wikilinks]]`, `#tags` and frontmatter are left exactly as they are.
- A wikilink opens the note it names: `Ctrl`+click (`Cmd`+click on a Mac),
  or tap it on a phone. `[[Note]]`, `[[Note|shown text]]`,
  `[[folder/Note]]` and `[[Note#Heading]]` all work (the heading is not
  scrolled to). As in Obsidian, the name is matched against file names in
  any case, `.md` is implied, and if two notes share a name the one with
  the shortest path wins. A link to a note that does not exist yet asks
  whether to create it (at the top of the repository, or in the link's
  folder, spelt as the folder already is), always as a `.md` note, so
  `[[Release 1.2]]` makes `Release 1.2.md`. Nothing is written until you
  save it. If the list of notes has not loaded, or GitHub sent only part of
  it (a very large repository), it does not offer to create one: the note
  may exist already. On a phone a tap inside a link follows it; tap just
  before or after it to type there.
- Filenames with spaces and accents work.
- Line endings are kept: a note written on Windows (CRLF) is saved with
  CRLF, and an edit changes only the lines you touched, even in a file that
  mixes endings. New lines take the ending most of the file uses. A
  byte-order mark at the start of a file is kept too.
- A file over 1 MB is shown but not opened: GitHub's API does not hand
  over files that size, and opening one empty would let a save replace it.
  A note is not saved past 1 MB either; it stays a draft until it is
  shorter. If a file you had unsaved changes to has grown past 1 MB
  elsewhere, your text opens as a new note beside it, `name (unsaved copy).md`.
- A file stored with Git LFS is not opened: what the repository holds is a
  pointer, and saving over it would replace the real file.
- A text file that is not UTF-8 (an old Windows or Latin-1 file) is not
  opened: shown here it would be garbled, and saved it would be destroyed.

## Open notes

Choose **Outline** in the note's ⋯ menu to see its headings, including underlined
headings and headings inside lists or quotes. Select one to jump there in the
editor or Preview. The outline uses the current unsaved text without fetching
anything; it does not modify the note. Long outlines have Previous/More controls.
Escape closes the outline. If the note changes while it is open, reopen it to
get current positions. If the Markdown library is unavailable, a notice explains
why the outline cannot load; editing still works.

Expand **Linked from** under a Markdown note to see notes that link to it.
Wikilinks use the same resolution as opening a link; Markdown paths resolve
relative to their source note. Reference-style links work too. Code, comments,
image embeds and external links do not count. Drafts take precedence over
saved text. Choose a result to open its source.
On a small screen, Linked from collapses when the keyboard needs the space.

The scan reads up to 300 loaded Markdown notes and reports skipped or
unavailable files. Refresh Files to pick up repository changes, then reopen
Linked from. If the Markdown library fails to load, the section explains why
it is unavailable; editing remains available.

Expand **Tags** in Files to find Markdown notes by tag. Counts include nested
tags (`project` includes `project/notes`) and ignore case. Opening the section
scans up to 300 loaded Markdown notes using the shared reader; skipped or
unavailable notes are reported. Close and reopen it to refresh.

**Tags** in the note's ⋯ menu shows its tags above the editor and Preview. **Add tag** writes
the `tags` property; the × removes a frontmatter tag. These edits preserve
other properties and unsaved text and support Undo. Inline `#tags` remain in
the text: select their chip to find related notes, or edit the source to remove
them. Tag discovery skips fenced/indented code, inline code, links and comments.
Simple YAML tag lists and scalar tags are supported. Complex or ambiguous
frontmatter must be edited in the source; the tag controls explain this without
rewriting it. No tag index is written into your repository or browser storage.

Expand **Recent** in Files for recently opened notes and repository changes,
with the first heading, a short preview and a time. Local drafts take precedence.
The list reads history only when expanded: up to 10 commits, the first 100 files
in each commit and 20 notes. It is a bounded view, not a complete activity log.
Close and reopen it to refresh. Missing history or previews are labelled.

Open notes have tabs above the editor and Preview. Reopening a note selects
its tab. Use **×** to close a tab; unsaved text stays in its draft. The last
12 open tabs are remembered for this browser's current repository and branch.
On phones, expand **Open notes** to choose or close one. Closing the last tab
leaves the editor empty; it does not delete a file.

## Adding images

Use **Image** above the editor, paste an image, or drop one into the text.
PNG, JPEG, GIF and WebP files are supported, one at a time. A photo or
screenshot over 1 MB is made smaller in your browser before upload (a PNG
stays a PNG if it fits, otherwise it becomes a JPEG) and the status says so;
GIFs over 1 MB are refused, since shrinking would stop them moving.
Padgit reads the vault's `.obsidian/app.json` attachment folder setting;
without one it puts the image beside the note. Each upload creates a unique
attachment and inserts an ordinary Markdown link after GitHub confirms it.
Undo removes the link, leaving the attachment in the repository. If you switch
notes during upload, the status names the saved attachment so you can link it
from the original note. Failed uploads leave your note text unchanged.

## What it deliberately does not do

No offline queue, no graph view, no plugins, no real-time collaboration and
no line-by-line merge tool: a conflict is merged when the changes are on
different lines, and otherwise kept both ways (see above). Each of those is
a common reason a notes app becomes unmaintainable.

## Accessibility

Automated accessibility checks use axe against the main views and plain-editor
fallback, failing on serious or critical violations. They supplement manual
keyboard and screen-reader testing; they do not certify full accessibility.

## Known limits

- The Content Security Policy stops the page sending data to any host but
  GitHub and the broker by request, image, beacon, socket or form. No policy
  can stop a script navigating the page away or making DNS lookups, so it
  narrows what injected code could do; the app is built so none gets in.

- Very large repositories: GitHub truncates the file listing; the app says so.
- Notes over 1 MB cannot be opened here (see above); edit them elsewhere.
- CodeMirror loads from a CDN. If it fails, the editor falls back to a plain
  text box (a `plain` badge appears) and everything still works.
- Signing out forgets the sign-in in that browser but does not cancel it on
  GitHub: a copied token would work until it expires (at most eight hours),
  and a copied refresh token could renew it for up to six months. To cut
  access everywhere immediately, revoke the app under GitHub → Settings →
  Applications.
  [PRIVACY.md](../PRIVACY.md) says what the broker, GitHub and your browser
  each see and keep, and how to take access back.
