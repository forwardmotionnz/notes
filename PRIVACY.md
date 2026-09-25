# Privacy

Notes is a web page that edits markdown files in GitHub repositories. There
is no Notes database, no account with us, no analytics and no tracking.
This page says exactly who can see what, including the parts that depend
on trusting whoever runs the copy you are using.

## The short version

- Your notes go between your browser and GitHub. They are not sent anywhere
  else by the app.
- GitHub gives the app access to the repositories it is installed on, and
  only to their contents (read and write).
- A small helper, the broker, is used only to sign you in. It stores nothing
  and logs nothing, and your notes never pass through it.
- Whoever runs the copy of Notes you use (its GitHub App and its web page)
  is someone you are trusting with those repositories. If that is not you,
  read [Who you are trusting](#who-you-are-trusting).
- Your sign-in and any unsaved changes are kept in your browser until you
  sign out.

## What GitHub sees

Everything the app does is an ordinary request to GitHub's API,
`api.github.com`, made with your own sign-in: listing files, reading a note,
saving it as a commit. GitHub's own privacy statement covers what GitHub
keeps. Signing in happens on `github.com`, where GitHub asks you to approve
the app. The page itself is usually hosted on GitHub Pages, so GitHub also
sees the page being loaded, as for any website. Your picture in settings
comes from `avatars.githubusercontent.com`, GitHub's image server.

What your sign-in can reach is limited to reading and writing the contents
of repositories the app is installed on that you also have access to. That
is the repositories you chose when you installed it, plus any that someone
else installed it on and you can use, such as an organisation's. Like any
GitHub sign-in it can also read public repositories. It cannot see your
private email address, your issues or your settings, and cannot act
anywhere else on your behalf.

## What the broker sees

GitHub will only turn a sign-in into a token for an app that proves who it
is with a secret, and a web page cannot keep a secret. The broker is a
tiny program that holds that secret and does this one swap. It receives:

- when you sign in: the one-time sign-in code GitHub just gave your browser
  (`code`) and a random value your browser made to prove the code is its
  own (`code_verifier`);
- every eight hours or so: your refresh token (`refresh_token`), to get a
  fresh token without asking you again.

It passes them to GitHub and hands GitHub's answer (your tokens) straight
back to your browser. It stores nothing and logs nothing: there is no
database, no storage and no logging in its code, which is short enough to
read in a few minutes (`broker/worker.js`). Your notes never pass through
it; once your browser has a token it talks to GitHub directly.

The broker runs on Cloudflare Workers. Like any hosting company, Cloudflare
handles the requests that reach it.

## Other places the page loads from

The editor, CodeMirror, is loaded from `cdnjs.cloudflare.com`, a public
library server. Cloudflare sees that your browser fetched it, as for any
website using it. That code then runs inside the page, like the app's own,
so you are also trusting what cdnjs serves. If it does not load, the app
still works with a plain text box. The page's security policy lets it send
data only to GitHub and the broker.

## Who you are trusting

If you use someone else's copy of Notes, you are trusting that person, not
just this code:

- **Their GitHub App.** Installing it grants the app itself read and write
  access to the contents of the repositories you choose. Whoever owns the
  app can use that access directly, from their own computer, without you
  signing in and without the broker. They can also see which accounts
  installed it and on which repositories. Revoking your sign-in does not
  stop this; uninstalling the app does (see below).
- **Their web page.** They control the page you load, so a changed page
  could read what you type and your sign-in.
- **Their broker settings.** They run the broker; the code here keeps
  nothing, but they deploy it.

The code in this repository does none of these things. If you would rather
not trust anyone but GitHub, run your own copy (see the end of this page).

## What your browser keeps

All of this stays on your device, in the browser's storage for this site:

| Name | What it holds | Removed when |
|---|---|---|
| `notes.config.v2` | your sign-in (the token, when it expires, and the refresh token that renews it), your GitHub username and picture link, the repository and branch you chose, your pinned files | you sign out, or GitHub stops accepting the sign-in |
| `notes.ui.v1` | which folders are open, the note you last had open, the pinned list you last looked at | you sign out |
| `notes.draft.v1:` followed by the repository, branch and file | the words you have typed but not yet saved in that file, which version they were based on, and when | the change is saved, you press Discard, or you sign out |
| `notes.signin` | for a sign-in in progress: a random value that ties GitHub's answer to this sign-in, the proof value sent to the broker, and whether to remember you | you come back from GitHub; if you never do, when the tab closes |

Normally these are in local storage, so you stay signed in on this browser.
If you tick **Forget me when I close the browser**, they are kept in session
storage instead, which the browser throws away when the tab is closed. Two
things to know on a shared computer:

- A browser set to reopen your tabs when it starts ("Continue where you
  left off" and similar) brings session storage back with them, so you would
  still be signed in. Press **Sign out** before you leave.
- Each tab has its own copy. A duplicated tab carries one too, and signing
  out in one tab does not clear the other. Sign out in each, or close them
  all.

The one-off `notes.signin` value is always in session storage.

**Sign out** (in settings) removes all of it from this browser, unsaved
changes included; the app warns you first. If instead GitHub stops accepting
your sign-in (it expired, or you revoked it), the app signs you out but
keeps your unsaved changes, so nothing you typed is lost; they are there if
you sign in again, and **Sign out** removes them.

Signing out does not cancel the sign-in on GitHub. A token copied off this
device would keep working until it expires, at most eight hours later, and
a copied refresh token could keep getting new ones for up to six months. If
you think either was copied, revoke the app on GitHub.

## How to take the access back

On GitHub, click your profile picture, then **Settings**, then
**Applications**:

- **Authorized GitHub Apps**
  (<https://github.com/settings/apps/authorizations>): press **Revoke** next
  to the app. Every token and refresh token it holds for you stops working,
  everywhere; open Notes tabs sign out the next time they talk to GitHub.
- **Installed GitHub Apps** (<https://github.com/settings/installations>):
  press **Configure** next to the app to change which repositories it can
  use, or **Uninstall** to remove it from your account. Uninstalling is
  what takes the app's own access away, including its owner's. For an
  organisation, an owner does the same under the organisation's
  **Settings → GitHub Apps**.

To take everything back, do both. Nothing needs deleting on the broker,
because it keeps nothing.

## Self-hosting instead

You can run your own copy, with your own GitHub App, your own page and your
own broker, so the only people you trust are GitHub and the companies that
host the page and the broker (GitHub Pages and Cloudflare, unless you
choose others). The README's *Setup* section walks through it: about twenty
minutes, with a GitHub account and a free Cloudflare account.
