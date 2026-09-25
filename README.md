# notes

Markdown notes in one HTML file, stored in a GitHub repository you own.
Sign in with GitHub, pick the repository, write. Works in any browser, on any
computer or phone, with nothing to install.

- **Your notes are plain `.md` files in your repo.** No database, no export
  step. Obsidian, nvim or github.com can edit the same files.
- **One file is the whole app.** `index.html`, vanilla JavaScript, no build.
- **Scoped access.** Sign-in goes through a GitHub App installed only on the
  repositories you choose. It cannot see anything else in your account.

## How it fits together

```
 browser ──── sign in ────▶ github.com ──── code ────▶ browser
    │                                                     │
    │                       broker (Cloudflare Worker)    │
    │   code + PKCE ───────▶ holds the client secret ─────┘
    │   ◀──────── token ─── swaps code for token
    │
    └──────── every read and write ────────▶ api.github.com
```

GitHub requires a client secret to turn a sign-in code into a token, and a web
page cannot keep a secret. The broker (`broker/worker.js`, about 100 lines)
holds it and does only that swap, plus a refresh every 8 hours. It stores
nothing and never sees your notes: those go straight from the browser to
GitHub.

## Setup

About twenty minutes, once. You need a GitHub account and a free Cloudflare
account. The examples assume your GitHub user is `roldaof` and this repo is
called `notes`; substitute your own.

### 1. Put this repo on GitHub and turn on Pages

Push this repository to GitHub as **public**. It contains no secrets, and
GitHub Pages only serves public repositories on a free plan. Your notes live
in a separate, private repository.

Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/`.
After a minute the app is at `https://roldaof.github.io/notes/`.

### 2. Register a GitHub App

github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.

| Field | Value |
|---|---|
| GitHub App name | anything unique, e.g. `roldaof-notes` |
| Homepage URL | `https://roldaof.github.io/notes/` |
| Callback URL | `https://roldaof.github.io/notes/` (exactly, trailing slash included) |
| Expire user authorization tokens | ✅ on |
| Request user authorization (OAuth) during installation | ✅ on |
| Enable Device Flow | off |
| Webhook → Active | ❌ **off** |
| Repository permissions → **Contents** | **Read and write** |
| Where can this GitHub App be installed? | Only on this account |

Leave every other permission at *No access*. Metadata (read) is added
automatically.

Create it, then on the app's page note the **Client ID** and the **slug** (the
last part of `github.com/apps/<slug>`). Click **Generate a new client secret**
and copy it somewhere safe for the next step.

### 3. Deploy the broker

```sh
cd broker
# edit wrangler.toml: CLIENT_ID, ALLOWED_ORIGIN, REDIRECT_URI
npx wrangler login
npx wrangler deploy
npx wrangler secret put CLIENT_SECRET     # paste the secret from step 2
```

`ALLOWED_ORIGIN` is the site with no path (`https://roldaof.github.io`) and
`REDIRECT_URI` is the app's full URL, identical to the callback URL in step 2.
Deploy prints the worker's URL; you need it next.

If you would rather not use Cloudflare, `worker.js` is a standard
Request/Response handler and runs on Deno Deploy, Bun, or a small Node server.

### 4. Point the app at your deployment

Two edits in `index.html`, both plain text.

The deployment block, just above the script:

```html
<script type="application/json" id="deployment">
{
  "clientId": "Iv23li...",
  "appSlug":  "roldaof-notes",
  "broker":   "https://notes-token-broker.<you>.workers.dev"
}
</script>
```

`clientId` and `appSlug` come from step 2, `broker` from step 3.

The second `Content-Security-Policy` tag at the very top, the one that is
only `connect-src`: replace `https://notes-token-broker.REPLACE_ME.workers.dev`
with the same broker origin.

```html
<meta http-equiv="Content-Security-Policy" content="connect-src https://api.github.com https://notes-token-broker.<you>.workers.dev">
```

That policy is the list of hosts the page may talk to at all, so if anything
ever got into the page it could reach GitHub and your broker and nothing
else. If the broker there and in the deployment block do not match, the
sign-in screen says so. Leave the first policy alone: it pins the app's own
script by its hash, and your edits above do not affect it. (If you change the
app's script, `npm test` fails first thing and prints the new hash to paste
into that first policy.)

Commit and push. Pages redeploys on its own.

### 5. Sign in

Open the app, **Sign in with GitHub**, and install the app on your notes
repository when GitHub asks. If it is installed on one repository you go
straight in; with several you choose. To add or remove repositories later,
use *Choose repositories* in the app's settings. It opens GitHub in a new
tab; save your choice there, come back to the Notes tab, and the list has
updated. (GitHub does not send you back after a change, only after a first
install.) Arriving from a GitHub install never signs you in by itself: you
are asked to sign in, with *Forget me* ticked, since the app cannot tell
whether this is your own computer.

## Using it on several computers

It is a web page, so any browser works: home, work, phone. Sign in once per
browser. On a phone, open the URL and choose *Add to Home Screen*.

On a work or shared computer, tick **Forget me when I close the browser**
before signing in. Nothing is written to disk and closing the browser signs
you out. Drafts of unsaved changes still survive a reload in this mode, but
not closing the browser, so save before you leave. A `session` badge in the
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
- Attachments (images, PDFs) are shown but cannot be opened: decoding them as
  text and saving would corrupt them, so the app refuses.
- `[[wikilinks]]`, `#tags` and frontmatter are left exactly as they are. They
  are not rendered or followed, just preserved.
- Filenames with spaces and accents work.
- Line endings are kept: a note written on Windows (CRLF) is saved with
  CRLF, and an edit changes only the lines you touched, even in a file that
  mixes endings. New lines take the ending most of the file uses. A
  byte-order mark at the start of a file is kept too.
- A text file that is not UTF-8 (an old Windows or Latin-1 file) is not
  opened: shown here it would be garbled, and saved it would be destroyed.

## What it does

- Folder tree of the repository, collapse state remembered
- Markdown editor that saves itself; `Ctrl`/`Cmd`+`S` commits at once
- Pinned files as a live task list with a one-line capture box
- Filter across every path in the repository
- Light and dark, and a layout that works on a phone

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
file changed on GitHub in the meantime, saving reports a conflict instead of
overwriting. Signing out deletes every draft in that browser.

## What it deliberately does not do

No offline queue, no wikilink navigation, no backlinks, no graph, no plugins,
no attachment upload, no merge tool. Each of those is a common reason a notes
app becomes unmaintainable.

## Design rules

Keep these if you contribute:

1. **No build step, one app file.** `index.html` is the application. The
   broker is the only other code that runs, and it only swaps tokens.
2. **The repository is the model.** Paths are paths, filenames are titles. No
   IDs, no required frontmatter, no special link syntax. Everything the app
   does maps to an obvious git operation.
3. **Host-specific code stays in the `PROVIDER` section.** Supporting another
   host means reimplementing `listTree`, `readFile`, `writeFile`, `describe`
   and the sign-in, not touching the editor.

## Tests

```sh
npm install
npm test
```

Runs in a headless browser with GitHub simulated, and the real broker code in
the loop. The simulation verifies the PKCE challenge, expires tokens and
rotates single-use refresh tokens the way GitHub does. Nothing touches the
network.

## Known limits

- The Content Security Policy stops the page sending data to any host but
  GitHub and the broker by request, image, beacon, socket or form. No policy
  can stop a script navigating the page away or making DNS lookups, so it
  narrows what injected code could do; the app is built so none gets in.

- Very large repositories: GitHub truncates the file listing; the app says so.
- CodeMirror loads from a CDN. If it fails, the editor falls back to a plain
  text box (a `plain` badge appears) and everything still works.
- Signing out forgets the sign-in in that browser. The token itself stays
  valid until it expires, at most eight hours. To cut access everywhere
  immediately, revoke the app under GitHub → Settings → Applications.

## Licence

MIT.
