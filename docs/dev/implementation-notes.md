# Implementation notes

Detailed rationale moved from index.html to keep the downloaded page small.
Short section comments remain beside the implementation.

## N1

The policies at the top of the page decide which hosts the app may reach.
 A copy whose broker is not allowed would fail at sign-in with nothing but
 a console error; say so up front instead. The broker must pass every
 policy, as the browser requires.

## N2

Does one CSP source expression allow this URL? Covers what a person is
 likely to write: a scheme ("https:"), an origin with or without a trailing
 slash, any case, no scheme, "*." wildcards, explicit ports and paths.

## N3

Settings live in localStorage by default, so you sign in once per browser.
	 On a shared or work computer that is the wrong default: sessionOnly puts
	 them in sessionStorage instead, so closing the browser signs you out.
	 Which store the settings were found in is what sets this on load.

## N4

Maps keyed by a path or a folder name have no prototype: a folder called
	 "constructor" or "__proto__" is an ordinary name in someone's notes, and
	 on a plain object it would find a built-in instead of nothing.

## N5

Write in place, then clear the other store. Removing first would tell
	 every other tab, for an instant, that there is no sign-in, and they would
	 drop to the sign-in view. Clearing localStorage on the way to session-only
	 does sign the other tabs out, on purpose: kept signed in, they would
	 write the sign-in back to disk.

## N6

---- local drafts --------------------------------------------------
	 Every edit is copied to storage as it happens, one entry per file, so a
	 reload, a closed tab or a phone killing a backgrounded page loses nothing.
	 Written on each change rather than on unload: iOS may discard a page
	 without firing any event. The entry keeps the sha the text was based on,
	 so a restored draft still goes through the conflict check and cannot
	 overwrite a change made on GitHub in the meantime.

## N7

Mirror the open file: a draft while it differs from what is committed,
	 nothing once it does not. Only while signed in, so a tab signed out from
	 elsewhere cannot write drafts back after sign-out removed them.

## N8

================================================================
	 AUTH  -  GitHub App user tokens via the broker.
	 Sign-in is the standard authorization code flow with PKCE and a state
	 value, both kept in sessionStorage for the one round trip to GitHub.
	 Tokens last 8 hours; the refresh token lasts 6 months and is single-use,
	 so every refresh returns a new pair that must replace the old one.
	 ================================================================

## N9

Called on load when GitHub has sent us back with ?code=. Returns a promise
	 that settles once the URL is clean and we are signed in, or not.

## N10

Back from installing the app on github.com: a code we did not ask for
 and none of our state. The code is not used, and nobody is signed in by
 it: a tab already signed in just carries on, and anyone else signs in
 themselves, choosing "Forget me" or not. (Signing in automatically here
 once wrote a remembered sign-in to disk for a session-only user.)

## N11

A code this tab did not ask for: a link someone sent, or a real
 sign-in whose tab lost its state (iOS can discard a tab while someone
 fetches a 2FA code). Never used; boot() says so to anyone signed out.

## N12

The sign-in view after a failed or foreign return from GitHub, with
	 "Forget me" as the person chose it when they started, or ticked when
	 that is not known (the choice that leaves nothing behind).

## N13

The deadline covers the body as well as the headers. A timeout never
 proves that a write did not land; callers retain their draft for retry.

## N14

Two tabs refreshing at once would both spend the same single-use refresh
	 token; GitHub honours one and the other would be signed out. A browser-wide
	 lock makes them take turns: the second tab waits, then finds the first
	 tab's new tokens in storage and uses those. `fn` is told whether it had to
	 wait: in WebKit (Safari, every iOS browser) another tab's storage write
	 can reach this tab a moment after the lock does.

## N15

`stale` is the token that is expiring or was just rejected. If, once we
	 hold the lock, storage has something newer, another tab already did the
	 work.

## N16

Having waited, the tab before us most likely refreshed: let its new
 tokens arrive rather than spend the refresh token it just used up.
 ("Forget me" tabs share no storage, so there is nothing to wait for.)

## N17

While this was in flight another tab may have signed out or chosen
 "Forget me" (which cleared ours through the storage event), or,
 without Web Locks, refreshed first. Either way what we hold is no
 longer what we spent: write nothing, and carry on with what we
 hold (nothing, if signed out; the caller then reports it).

## N18

Only a rejected refresh token proves sign-in has expired.
 Outages and malformed replies keep credentials and drafts for retry.

## N19

Storage may still be behind: what it shows as ours may already
 be the other tab's new pair on its way. Forget only this tab's
 copy; the storage event brings the new pair if it comes.

## N20

Resolves with a usable token newer than `stale`, or null after `ms`. The
	 check is on what we hold, not on whether this call did the adopting: the
	 cross-tab storage event often adopts the winner's token first.

## N21

Another tab's new token is ours to use while it still works, even if it
 is due for renewal soon: renewing it is not this call's job.

## N22

Forget this tab's tokens. Storage is only cleared if it still holds the
	 refresh token that failed (`spent`): a newer pair written by another tab
	 must survive, or one tab's failure would sign every tab out.

## N23

================================================================
	 PROVIDER  -  the only GitHub-specific code in this file.
	 To support another host, reimplement these four functions with the
	 same signatures and return shapes. Nothing below this section knows
	 which host it is talking to.
		 listTree()                 -> [{ path, type }]   type: "blob" | "tree"
		 readFile(path)             -> { text, sha }      sha is null if absent
		 writeFile(path, text, sha) -> { sha }            the new sha
		 describe()                 -> "owner/repo@branch"
		 isEmptyRepo()              -> true while the repository has no commits
		 repoAccess()               -> "" if writable, else why not
		 moveFile(from, to, sha, mode) -> one commit moving a file, or nothing
		 deleteFile(path, sha)      -> one commit deleting that version, or nothing
	 ================================================================

## N24

GitHub marks its answers cacheable for 60 s; a stale branch head,
 file list or file would make a move or a save act on the past.

## N25

GitHub documents 403/429, Retry-After, remaining/reset and a
 minimum one-minute wait when a secondary limit has no headers.
 https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors

## N26

A file over GitHub's 1 MB limit for this API is refused with
 code "too_large": say that, not that the app is not installed.

## N27

Every repository the signed-in user can reach through the app's
 installations. Each installation is one account the app is installed on.
 Installations are asked a few at a time (GitHub asks for requests in
 series, not bursts), and one that fails (suspended, SAML, a hiccup) does
 not take the others with it: the list carries `failed`, how many did.

## N28

Whether this person may change the repository at all. Both facts are on
	 the repository object: https://docs.github.com/en/rest/repos/repos#get-a-repository
	 Resolves to "" when writable, or the reason it is not.

## N29

Every page of a list GitHub hands out in pages
 (https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api).
 Asks for 100 a page, but does not rely on getting them: it stops when
 total_count is reached, or at an empty page when there is no total.
 A cap stops a runaway loop.

## N30

A repository with no commits yet. GitHub's Git database API answers 409
 for one, and a contents PUT creates its first commit on the default
 branch: https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database

## N31

The list may carry `movedTo`: the configured branch is gone (renamed, or
 a first push from elsewhere created another), and this is the
 repository's default branch now.

## N32

Over 1 MB GitHub leaves the content out (encoding "none"). Opening
 that as an empty note would let a save replace the whole file.

## N33

Not UTF-8 (an old Windows or Latin-1 file). Shown as text it would
 be garbled, and saved back it would be destroyed, so it is refused
 like an attachment.

## N34

Contents API returns base64 for files up to 1 MB; never use download_url.
 https://docs.github.com/en/rest/repos/contents#get-repository-content

## N35

Delete a file in one commit, naming the version the person has open: if
	 it changed elsewhere, GitHub refuses. https://docs.github.com/en/rest/repos/contents#delete-a-file
	 A reply that never arrived is settled by looking: gone means done.

## N36

Move a file in one commit, with the Git Data API: the new path and the
	 removal of the old one go into a single tree and commit, and the branch
	 only then moves, fast-forward only. Nothing is visible before that last
	 step, so a failure at any point leaves the repository as it was.
	 https://docs.github.com/en/rest/git/refs , .../git/commits , .../git/trees
	 `sha` is the version the person has open: if the file at the branch head
	 is not that version, or the target exists, nothing is done. Another
	 commit landing meanwhile (the branch would not fast-forward) is retried
	 on top of it.

## N37

fatal: refuse bytes that are not UTF-8 rather than guess at them.
 ignoreBOM: keep a byte-order mark, so saving can put it back.

## N38

---- line endings and byte-order mark ------------------------
	 The editor works in "\n" (CodeMirror and a textarea both turn "\r\n"
	 and a lone "\r" into "\n"), so a Windows file would look edited the
	 moment it opened, and saving would rewrite every line. Instead a note
	 keeps the exact text it was read as (its `base`), and on writing each
	 line the user did not touch gets its own original ending back; only
	 new or changed lines take the file's usual ending. A byte-order mark is
	 kept off the editor and put back. Not host-specific, so it sits outside
	 PROVIDER.

## N39

Between the unchanged top and bottom: the longest run of lines that
 still appear in order keep their endings (a line-level diff); in each
 gap between those, lines are paired up by position, so an edited line
 keeps the ending it had. The table is quadratic, so past a million
 cells (replacing most of a very large note) positions alone are used.

## N40

"\r" then an empty line ending "\n" would read back as one "\r\n",
 swallowing a line the user typed: that empty line ends "\r" too.

## N41

Content from the repository or from GitHub (file and folder names, note
	 text, task lines, branch, login, error messages) reaches the page only as
	 text: textContent, text nodes, Option labels, the editor's value. There is
	 no innerHTML anywhere in this file, and tests/hostile.test.mjs fails if
	 one appears. File names and notes are data, never markup.

## N42

Asked on every load, alongside the file list: a repository can be
	 archived, or access taken away, while the app is open. Until the answer
	 is in, nothing is written; an answer about a repository no longer shown
	 is ignored; no answer at all (offline) blocks nothing, since writes
	 would fail anyway and drafts keep the text.

## N43

GitHub's contents API returns files up to 1 MB. Anything bigger is shown
	 but not opened: it could not be read, so it must not be written.

## N44

Dot-folders are an app's own state, not notes: .obsidian, .git, .trash.
	 They are hidden from the tree. A pinned file is an explicit choice, so pins
	 are not filtered.

## N45

A plain textarea with the same small interface the app uses. This is the
 fallback when CodeMirror is not on the page: the CDN is unreachable, the
 file is opened offline, or a future CodeMirror moves. Editing keeps working
 without syntax highlighting rather than the app being dead in the water.

## N46

Measure the caret without changing the value, selection or focus.
 A text node and span wrap exactly as the textarea does, including
 long lines. The temporary mirror is hidden and never parsed as HTML.

## N47

insertText preserves native Undo; setRangeText is the supported fallback.
 https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand

## N48

Both editors show note text as text: CodeMirror builds its lines from
 text nodes and a textarea's value is never parsed.
 Without its stylesheet (refused as changed) it would draw text invisibly.

## N49

[[Note]], [[Note|alias]], [[folder/Note#Heading]]: Ctrl/Cmd-click on a
 desktop, a tap on a phone. A plain click with a mouse only places the
 cursor, so the link's own text can still be edited there.

## N50

Where in the text the click landed. CodeMirror can say from the pointer
 itself; otherwise the caret the click has just placed.

## N51

Strictly inside: a tap just after a link at the end of a line is
 somewhere to carry on typing, not a way to leave the note.

## N52

As Obsidian does: by file name (or the end of the path, if the link has
 folders), any case, ".md" implied, and the shortest path wins. Dot-folders
 (.trash, .obsidian) are not notes.

## N53

Folders are matched in any case when a link resolves, so a note created
 from [[projects/Q4]] goes in the Projects folder that is already there,
 not a second one that only differs in case.

## N54

Status belongs to the open document, never to a transient toast or a save
 finishing for a note left behind. Check the actual stored draft before
 promising a local copy: a full or blocked store is not a safety net.

## N55

Discard is only offered where there is something it would rescue you
 from: a restored draft, or a save GitHub rejected as a conflict.

## N56

`discarding`: the user asked to throw this file's draft away. It is only
 dropped once GitHub's version is in hand, so a failed fetch leaves the
 draft, and the editor still tracking it, exactly as they were.

## N57

A commit of this very file may still be on its way (it was just left).
 Read it only once that has settled, so the editor starts from what
 GitHub really holds and never from the version before it.

## N58

A draft keeps the sha it was based on, not the one just fetched: if
 the file moved on since, saving is a conflict rather than an overwrite.
 A file that does not exist yet is always saveable, like a new note.

## N59

Paths live in the fragment, so bookmarks do not send private filenames to
 the static host. A link never switches repositories or grants access.

## N60

Open a draft as a new note beside the file it belonged to, and move it
 there: the original is left alone, the words stay within reach.

## N61

Leaving a file never asks. What was typed is committed now if it can be;
	 otherwise (offline, a conflict, a save already in flight) it stays as a
	 draft and comes back, with a notice, when the file is opened again. A
	 New template nobody typed into leaves nothing behind.

## N62

---- autosave ------------------------------------------------------
	 A commit after a pause in typing, and at once when the page is hidden
	 (switching apps on a phone, closing the laptop). Not per keystroke: each
	 save is a commit in someone's history. Only text the user has typed into
	 since it was opened is saved automatically; a restored draft or a fresh
	 template waits until they touch it, so nothing they have not looked at
	 gets committed. A conflict stops it for that file until Discard.

## N63

Two commits on the same sha would conflict with each other. Wait for
 the one in flight, then save again on the sha it returns, but only if
 the same file is still open: never another file's untouched draft.

## N64

Resolve the previous uncertain write before sending newer text. If a
 second attempt is offline too, it must not erase what may have landed.

## N65

A file that grew past the limit (or became binary/LFS) cannot be
 compared safely. Keep the existing conflict pause and draft recovery.

## N66

Start an ordinary write before leaving the file can change settings;
 writeFile captures this repository and branch synchronously.

## N67

Committed after the file was left. The draft on disk is either what
 was just saved (done with) or text typed after it, which now sits
 on top of this commit rather than the one before.

## N68

The open note's text replaced by the app (a merge, a pin): the caret moves
 with its text, and Undo cannot restore the text before (a save would then
 undo the change behind the person's back).

## N69

Rename or move the open note. Unsaved words are saved first; the note is
	 locked while it moves; then it is the same note at its new path (same
	 content, so nothing is re-read and nothing typed can go missing), and
	 other tabs are told so theirs follows too.

## N70

The note at `from` is now at `to`, same content: re-point whatever this
	 tab holds for it (the open note, its draft, pins, the last-open file).

## N71

The note at `path` is gone. Here, or in a clean tab, it is simply
	 closed. A tab told from elsewhere that holds unsaved words keeps them,
	 as a new note that is saved only if the person chooses to.

## N72

Only a draft this tab wrote, or one that matches what was deleted: a
 draft from another tab still typing is theirs to keep.

## N73

================================================================
	 PINNED FILES: "- [ ]" lines as checkboxes, headings as labels; a tick
	 rewrites that one line. The file stays ordinary markdown.
	 ================================================================

## N74

Only map plain list source recognised by the Markdown parser. Ambiguous
 constructs stay read-only; never guess a source line from rendered text.

## N75

A pin is `pinned: true` in the note's frontmatter (an Obsidian property),
	 so it travels with the note to every device and editor. Each browser
	 reads each note version (blob sha) once to find them, remembering the
	 answers in `ui.pinShas`. Files that cannot hold a property (not Markdown,
	 or a read-only repository) are pinned in this browser, as before N15,
	 and so are pins made before it.

## N76

pinned per scan / per text seen here
 A page closing starts no more reads (they would only be cut off); one
 restored from the back/forward cache carries on.

## N77

The text with the pin set or cleared, or null when the note already uses
 "pinned" for something else (a list, a date): never overwritten.

## N78

One scan at a time: a new file list meanwhile means another pass after
	 it, which skips what is known. Answers are kept as each note is read (a
	 page closed mid-scan carries on where it stopped next time) and pruned to
	 the notes present once a scan has seen them all. Known pins show at once.

## N79

Undo puts the lines back by position, so it keeps the text they were
 taken from, to check the positions still mean the same thing.

## N80

Positions hold only in the text the lines left (ticks and tasks added
 at the end aside); otherwise a line could land in the wrong place.

## N81

Each commit names the version it replaces, known only once GitHub
 answers: one write at a time per file; clicks meanwhile share the next.

## N82

Nothing to fill in until we know whether there is anything to choose;
 the steps, once shown, stay while the list is checked again.

## N83

Who, and which repositories, are fetched fresh each time the dialog opens:
 installing the app on another repository should show up without a reload.

## N84

The repository list, fetched afresh: when the dialog opens, and when the
	 person comes back to this tab from choosing repositories on GitHub, which
	 does not send them back itself. Only the newest answer is used, so a slow
	 older one cannot undo a choice made since.

## N85

The repository in use stays on offer even if the list left it out (it
 shifted between pages, or its installation did not answer): choosing
 it by default must never quietly become another repository.

## N86

Nothing came back. If every account answered, the app is on no
 repository: the first-run steps. If some did not, that is the news,
 with a way to ask again, and never "nothing happened".

## N87

Before a repository is in use, nothing public is chosen for anyone:
 the one just made (named as step 1 suggests), else a private one,
 else they choose.

## N88

Before any repository is in use, a list that failed leaves nothing to
 choose; the dialog cannot be closed either, so the way on is right here.

## N89

The account view shows one of: the settings form, the first-run steps,
 "looking", or a failed list with Try again. The steps and the others are
 never on screen together, and Save is only there for the form.

## N90

Point this tab at a repository and pinned files. The open file is
	 committed (or kept as a draft) first, while cfg still names the
	 repository it came from. Returns whether the repository changed.

## N91

A queued capture has not reached GitHub yet. Keep it under its old
 repository before replacing the queue, without erasing editor drafts.

## N92

Another tab saved settings. Settings are shared by every remembered tab
	 in this browser, so this one follows; otherwise its stale copy would be
	 written back at its next token refresh and undo the change. A
	 session-only tab reads its own copy and is unaffected.

## N93

Switching mode clears the store we are leaving (persist() below does
 it), so nothing is left on disk after choosing session-only.

## N94

Replies can finish before the replacement page loads. Invalidate this
 page's credentials too, so a late profile or refresh cannot restore them.

## N95

The on-screen keyboard. Android Chrome shrinks the page for it (the
	 viewport tag asks it to). iOS Safari does not: the page stays full height
	 behind the keyboard and Safari pans it to reach the caret, taking the
	 header off the top. There the app follows the visible area instead, as
	 visualViewport reports it, so the header stays at the top of what can be
	 seen and the editor ends at the keyboard, keeping the caret in view.

## N96

Where the visible area starts on the page (pageTop allows for the
 page itself having scrolled, not only for Safari panning it).

## N97

Only when the space itself changed (the keyboard came or went), not
 on every pan: the editor re-measures, and keeps the caret in view if
 that is where the person is typing.

## N98

The dialog is the way in, not a popup to dismiss: while signed out or
 without a repository chosen there is nothing behind it to use.

## N99

The file list. On a computer: drag its edge (or use the arrow keys on
	 it) to resize, double-click to reset, and ☰ to hide it; remembered in
	 this browser. Phones keep the slide-over drawer whatever was chosen.

## N100

Theme: Auto follows the device; Light or Dark is remembered in this
	 browser (not with the sign-in: signing out keeps it), and applied by the
	 small script in <head> before anything is drawn.

## N101

Quick switcher uses only the loaded tree. Recents belong to this repository
   and branch, and share the existing session-only/sign-out storage rules.

## N102

GitHub's answer to a sign-in: access_denied when someone clicks
 Cancel. It only counts if this tab started that sign-in; anyone can
 put ?error= in a link. Words from the address are never shown, so a
 link cannot make the app say something it did not.

## N103

An organisation member asked for the app; an owner must approve it.
 (Whether GitHub adds a code to this return is not documented; either way
 it is handled here, never as a sign-in.)

## N104

Nothing here says whether they wanted to be remembered on this
 computer, so start from the choice that leaves nothing behind.

## N105

unreadable: treated as not set up
 Tests and forks can override without editing the file.

## N106

Keyed by repository and branch as well as path: the same path in another
 repository is another file.

## N107

Another tab on the same file may have written the draft since; its
 text is not ours to throw away.

## N108

Storage full or blocked: say so once, so nobody relies on a copy
 that is not there.

## N109

On changing mode, drafts follow the settings into the other store and no
 copy is left behind in the one being left.

## N110

Another tab may already have refreshed. Refresh tokens are single-use, so
	 using ours after that would fail. Adopt theirs.

## N111

Safari storage may arrive after the refresh lock; allow its newer
 token to arrive even while this tab holds the lock.

## N112

409 means empty, or unavailable (still being created, for one); only
 GitHub's own words tell them apart.

## N113

A file the app will not open, so must never write: too large, stored in
 Git LFS, or not UTF-8.

## N114

A Git LFS pointer stands in for a file stored elsewhere; saving over it
 would replace that file with this text.

## N115

No branch exists yet in an empty repository; left out, GitHub uses the
 default one and creates it with this commit.

## N116

No answer at all: the move may have landed. It did if the
 new path now holds this version and the old one is gone.

## N117

why this repository cannot be changed, or ""
 The editor takes typing only when there is a note for it to go into.

## N118

shown in the list when it failed for a reason worth keeping          // "loading" | "failed" | "ok": what an empty tree means

## N119

A badge in the header, not a toast: the status line is transient and
 gets cleared by whatever happens next.

## N120

CodeMirror reports setValue (opening a file, a restored draft) as a
 change too; only typing counts towards an autosave.

## N121

The link target under `at`, without its alias, heading or block, or null.
 A link never spans lines.

## N122

Unsaved text for a file that can no longer be opened here (it grew
 past 1 MB elsewhere, say) must not become unreachable.

## N123

Past 1 MB GitHub's API would not hand the note back, so it could not be
 opened here again: keep it as a draft instead.

## N124

Only text this tab typed after it; another tab's draft never saw
 this commit and must still meet the conflict check.

## N125

A save refused as the note changed on GitHub: merge once, against a known start.

## N126

Small Moment-compatible subset; unknown tokens never silently change paths.
 https://obsidian.md/help/plugins/daily-notes

## N127

A note already there, or one typed but never committed: open it, never
 replace its draft with a fresh template.

## N128

GitHub asks for writes to files one after another: wait for any save or
 pinned task still on its way.

## N129

it would undo in a list no longer shown
 Header actions and tasks must still target the same file while loading.

## N130

Remove task lines in one commit, then offer Undo rather than ask first.
 `gone`: [{ index, line }] as drawn, in order.

## N131

The file changed since the rows were drawn: remove nothing, never the wrong line.

## N132

The repository in use is always there to keep, so pins and "Forget
 me" can be saved before a long list has arrived.

## N133

First sign-in with the app on a single private repository: nothing
 to choose. A public one is only ever chosen on purpose.

## N134

The dialog opened on "looking", where Sign out was all there was to
 focus; Enter must not sign anyone out by accident.

## N135

A new note that was never committed is not in the tree, but its draft
 is still worth reopening.

## N136

DEPLOYMENT  -  read from the data block above the script.

## N137

A notice only: never move a person away from an origin holding their drafts.

## N138

No scheme: the page's own, or its secure upgrade (CSP3, "scheme-part").

## N139

draft key -> last text this tab stored there

## N140

expires_in is 0 when the GitHub App has token expiry turned off.

## N141

Keep tabs in step: a refresh or sign-out in one applies to the others.

## N142

Another request may have hit a limit while this one awaited refresh.

## N143

A token GitHub no longer accepts: refresh once and try again.

## N144

Account-level calls, used only by the settings dialog.

## N145

fn over items, at most n at once; results in the items' order.

## N146

Encode a path for the contents API: slashes must stay literal.

## N147

https://docs.github.com/en/rest/commits/commits — bounded last ten commits.

## N148

---- base64 that survives UTF-8 and large files ----------------

## N149

[{ text, end }] per line; the last line's end is "".

## N150

The exact text to commit for editor text `text`, given what was read.

## N151

Whatever happens above, what is saved must read back as what was typed.

## N152

said once the next file list is in (it clears the status line)

## N153

path -> true while a commit to it is on its way

## N154

bumped on changing repository; older replies ignored

## N155

Follow the repository to its default branch, as if chosen in settings.

## N156

nothing listed may look as if it were still there

## N157

Read the current draft again: typing may have continued during the request.

## N158

Filtering flattens the view: it is a search result, not a tree.

## N159

Keep the suffix: truncating the word can move it to the line above.

## N160

Formatting edits source text through each editor's normal edit history.

## N161

Ctrl/Cmd-click follows a wikilink; it must not add a second cursor.

## N162

In a table the alias bar is written \| so it does not end the cell.

## N163

Unresolved against a list not (or not freshly) loaded is not "missing".

## N164

As Obsidian does, a link makes a note: [[Release 1.2]] is Release 1.2.md.

## N165

Rename and Delete are for a file that exists on GitHub (not a new one yet).

## N166

Guards the restore-on-boot path as well as a click.

## N167

Nothing on screen may be committed while GitHub's version loads.

## N168

Still on the old file after all: it is live again.

## N169

{ key, done }: that commit, settling either way

## N170

`auto` is true only for autosave; a click passes an event.

## N171

a rename or delete is in flight for the open note

## N172

Recovery waits for a read: settings may have changed while it waited.

## N173

the next save compares with what this wrote

## N174

Where each line of `o` is in `x` (LCS), or -1; null if too large.

## N175

Three-way line merge: what one side changed, or null if both did.

## N176

Both removing from one run of identical lines: which copy is unknowable.

## N177

Keep both: mine as a new note beside theirs, which the note then shows.

## N178

"Release 1.2" is a note, not a file this app could never open again.

## N179

Cancelling an earlier open must not leave its still-visible note unsaveable.

## N180

A cached or truncated tree cannot prove absence.

## N181

so a reload finds its way back to the draft

## N182

No extension given: keep the note's own, so it stays a note.

## N183

Why a note cannot be moved to `to` here, or "".

## N184

Delete the open note, after saying plainly what that means.

## N185

no autosave: bringing it back is their call

## N186

Keep the sanitised fragment: never serialise or reparse untrusted markup.

## N187

Wikilinks are built only from text nodes, outside code and existing links.

## N188

Unsupported blockquotes/HTML/indented code cannot shift line addresses.

## N189

Preserve nested lists; rebuild the task's own first line from text only.

## N190

Frontmatter: YAML between a first line "---" and a line "---" or "...".

## N191

Obsidian tags/properties: https://obsidian.md/help/tags

## N192

Pinned notes found change the list: the one shown stays the one shown.

## N193

What this tab saw in a note's own text is newer than any scan.

## N194

offline, or the page closing: stop, carry on next time

## N195

A restored draft is saved only when the person chooses to.

## N196

A tick is not a move: text compares with its boxes cleared.

## N197

In order, so each line goes back where it was.

## N198

Refused, or failed to save: the task goes back in the box.

## N199

The open note follows every commit, lest a later failure leave it behind.

## N200

What was waiting was built on this commit: not sent on a guess.

## N201

The account view: who you are, which repository, which pinned files.

## N202

An image source loads a picture and never runs script.

## N203

Save is for a real choice, and a public repository is named as such.

## N204

The app is on no repository: the two steps, nothing else.

## N205

Same repository: a pinned file being written keeps its state and queue.

## N206

the old repository's list is not this one's

## N207

nothing may write a draft back on the way out

## N208

Pinch zoom also shrinks the visible area; that is not a keyboard.

## N209

Phones never show a title: tapping the badge says why, again.

## N210

Not an onerror attribute: the policy allows no inline handlers.

## N211

the stylesheet keeps it within 180-600 px, 60% of the window

## N212

Many places close the phone drawer; the button follows whichever did.

## N213

Capture before CodeMirror's macOS Ctrl-K binding can delete a line.

## N214

A phone may never bring a hidden page back; commit what is there now.

## N215

Back from GitHub's repository settings in the other tab.

## N216

---- boot ------------------------------------------------------

## N217

start() has already opened settings when no repository is chosen yet.
