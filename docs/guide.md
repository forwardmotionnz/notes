# Using Padgit

The detailed guide. For a first note in two minutes, see [Try it](../README.md#try-it).

## Finding and saving notes
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
first note you save (or the first task you add) creates its main branch. If
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
- Markdown editor that saves itself; `Ctrl`/`Cmd`+`S` commits at once
- **Rename** beside the open note's name renames or moves it (type a new
  path, folders included) in a single commit: it either happens completely
  or not at all, and it never overwrites another file
- **Delete** removes the open note in a single commit, after asking. Nothing
  is lost for good: the note stays in the repository's history, and on
  github.com the file's history (or the commit that deleted it) lets you
  copy it back. If it changed elsewhere since you opened it, it is not
  deleted. On a phone, Rename and Delete are the ✎ and 🗑 buttons.
- Pin or unpin the open note using the star beside its name. Pinned files
  appear at the top of Files and open as a checklist in the main area.
  **Edit note** opens the Markdown source; **Tasks** returns to the checklist
  after saving any edits. A pin is saved in the note itself, as the property
  `pinned: true` at its top (Obsidian shows it as a property; other editors
  keep it), so it shows on every device; pinning saves the note, unsaved
  edits included, and unpinning removes only that line. Each browser reads
  each note once to find pins, up to 500 notes per visit, and after that
  only notes that changed. Files that cannot hold a property (not Markdown,
  or in a read-only repository), and pins made before this change, stay
  pinned in this browser only; unpinning one and pinning it again moves it
  into the note.
- Pinned files have a live task list with a one-line capture box. Ticks and
  captures go to GitHub one at a time; clicks made while one is on its way
  share the next commit. × removes a task (always shown on a phone, on
  hover on a computer) and **Clear done** removes every ticked one, each
  in one commit, with a few seconds to press **Undo**
- Filter across every path in the repository
- The file list: on a computer, ☰ hides it to give the note the whole
  width, and dragging its right edge makes it wider or narrower (the arrow
  keys work on the edge too; double-click puts it back to the usual width).
  Both are remembered in this browser. On a phone, ☰ opens it over the note.
- Light and dark: **Settings → Theme** is *Same as this device* unless you
  choose Light or Dark, which this browser then remembers (signing out keeps
  it)
- A layout that works on a phone

Each save is one commit. Notes save themselves two seconds after you stop
typing, and straight away when you switch to another app or tab; **Save** and
`Ctrl`/`Cmd`+`S` still work any time. A file you have only opened, or a
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

Use **Preview** beside Save to read the current note, including unsaved edits,
as rendered Markdown. **Edit** returns to the unchanged source. Frontmatter
appears as text above the note; task boxes are read-only and wikilinks open
notes. Repository PNG, JPEG, GIF and WebP images appear in Markdown image
references and Obsidian `![[image.png]]` embeds. Relative paths resolve from the
note's folder; `/` starts at the repository root. Up to 20 images, each no larger
than 1 MB, load with four requests at a time. External images, SVGs, hidden paths
and known symlinks show a notice instead. Missing or undecodable images also
show an explanation. Images never become editable notes.
If the preview libraries cannot load,
Padgit explains this and keeps the editor available.

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

If a task save fails, every queued capture returns to the Add a task box,
alongside any newer typing. After the wait shown for a rate limit, refresh
the file list, then add again; each recovered line becomes a separate task.
Changing repositories while tasks are saving keeps their pending text as a
draft in the original repository. Return there and open the pinned file to
recover it; copy the text before discarding if it reports a conflict.
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
- Attachments (images, PDFs) cannot be opened in the text editor: decoding them as
  text and saving would corrupt them, so the app refuses.
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

## What it deliberately does not do

No offline queue, no graph view, no plugins, no real-time collaboration and
no line-by-line merge tool: a conflict is merged when the changes are on
different lines, and otherwise kept both ways (see above). Each of those is
a common reason a notes app becomes unmaintainable. Backlinks and adding
images to a note are planned.

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
