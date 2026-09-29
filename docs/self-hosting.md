# Running your own copy

Anyone can use the shared copy linked in the [README](../README.md#try-it).
Run your own when you would rather trust no one but GitHub and your hosts:
your own page, your own GitHub App and your own sign-in broker. The
[privacy note](../PRIVACY.md) explains what each part sees.

## How it fits together
Remove `migrationFrom` and `migrationTo` from the deployment block for your
own copy unless you are planning your own address change. They control a
notice only; they do not set the OAuth callback or redirect visitors.
Set `repository` to your copy's GitHub repository URL for About and bug
reports. Leave `support` empty unless you want an HTTPS support link shown.
For static hosts without Markdown rendering, publish `CHANGELOG.md` as
`CHANGELOG.html`, alongside `PRIVACY.html`, so About's local links work.


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

About twenty minutes, once. You need a GitHub account and a free Cloudflare
account. The examples use `YOUR-USERNAME` for your GitHub user (or
organisation) and assume the repository is called `notes`; substitute your
own.

## 1. Put this repo on GitHub and turn on Pages

Fork this repository (or push a copy of it) to GitHub as **public**. It contains no secrets, and
GitHub Pages only serves public repositories on a free plan. Your notes live
in a separate, private repository.

Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/`.
After a minute the app is at `https://YOUR-USERNAME.github.io/notes/`. Pages also
publishes `PRIVACY.md` beside it as `PRIVACY.html`, which the sign-in
screen's *Privacy* link opens. On another host, serve the note at that
address too (or change the *Privacy* link in the sign-in screen's markup,
`id="about"` in `index.html`).

## 2. Register a GitHub App

github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.

| Field | Value |
|---|---|
| GitHub App name | anything unique, e.g. `YOUR-USERNAME-notes` |
| Homepage URL | `https://YOUR-USERNAME.github.io/notes/` |
| Callback URL | `https://YOUR-USERNAME.github.io/notes/` (exactly, trailing slash included) |
| Expire user authorization tokens | ✅ on |
| Request user authorization (OAuth) during installation | ✅ on |
| Enable Device Flow | off |
| Webhook → Active | ❌ **off** |
| Repository permissions → **Contents** | **Read and write** |
| Where can this GitHub App be installed? | **Any account**, so other people can use your copy (choose *Only on this account* if it is just for you) |

Leave every other permission at *No access*. Metadata (read) is added
automatically.

Create it, then on the app's page note the **Client ID** and the **slug** (the
last part of `github.com/apps/<slug>`). Click **Generate a new client secret**
and copy it somewhere safe for the next step.

## 3. Deploy the broker

```sh
cd broker
# edit wrangler.toml: CLIENT_ID, ALLOWED_ORIGIN, REDIRECT_URI
npx wrangler login
npx wrangler deploy
npx wrangler secret put CLIENT_SECRET     # paste the secret from step 2
```

`ALLOWED_ORIGIN` is the site with no path (`https://YOUR-USERNAME.github.io`) and
`REDIRECT_URI` is the app's full URL, identical to the callback URL in step 2.
Deploy prints the worker's URL; you need it next.

If you would rather not use Cloudflare, `worker.js` is a standard
Request/Response handler and runs on Deno Deploy, Bun, or a small Node server.

## 4. Point the app at your deployment

Two edits in `index.html`, both plain text. They replace this repository's
own deployment (its GitHub App and broker) with yours.

The deployment block, just above the script:

```html
<script type="application/json" id="deployment">
{
  "clientId": "Iv23li...",
  "appSlug":  "YOUR-USERNAME-notes",
  "broker":   "https://notes-token-broker.<you>.workers.dev"
}
</script>
```

`clientId` and `appSlug` come from step 2, `broker` from step 3.

The second `Content-Security-Policy` tag at the very top, the one that is
only `connect-src`: replace the broker address in it (in this repository,
`https://notes-token-broker.forwardmotionnz.workers.dev`) with the same
broker origin.

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

## 5. Sign in

Open the app, **Sign in with GitHub**, and install the app on your notes
repository when GitHub asks. If it is installed on one repository you go
straight in; with several you choose. To add or remove repositories later,
use *Choose repositories* in the app's settings. It opens GitHub in a new
tab; save your choice there, come back to the Padgit tab, and the list has
updated. (GitHub does not send you back after a change, only after a first
install.) Arriving from a GitHub install never signs you in by itself: you
are asked to sign in, with *Forget me* ticked, since the app cannot tell
whether this is your own computer.

## Sharing your copy

One deployment serves everyone: other people open your link, sign in with
their own GitHub account, and install your GitHub App on their own
repositories, personal or in an organisation. They never register an App
or run a broker. For that the App must be installable by *any account*
(step 2). Every repository the App can reach for them is offered, across
all their installations, however many there are. An organisation may ask
an owner to approve the install first (the app tells you when it has been
asked); that is GitHub's rule, not the app's. If an organisation uses SAML
single sign-on and its repositories do not appear, start an SSO session for
it on github.com, revoke the app under Settings → Applications, and sign in
again: GitHub only shows them to a sign-in made during an SSO session.
