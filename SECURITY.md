# Security

Padgit holds people's GitHub sign-in in their browser and reads and writes
their private notes, so security reports are especially welcome.

## Reporting a vulnerability

Please do not open a public issue. Report it privately instead:

1. Open the repository's **Security** tab and choose **Report a
   vulnerability** (GitHub's private vulnerability reporting).
2. If that option is not there, open a public issue that says only that you
   have a security report and asks for a private way to send it. Do not
   include any details.

Say what you found, how to reproduce it and what an attacker could do. You
will get a reply as soon as possible; this is a spare-time project, so please
allow a few days. Please give us a reasonable time to fix it before telling
anyone else.

## What is in scope

- The app, `index.html`, as published at https://padgit.com/
  and in this repository: anything that could leak a token, run a script
  from a note, a file name or a GitHub response, reach a host other than
  GitHub and the broker, or lose or corrupt someone's notes.
- The sign-in broker, `broker/worker.js`.
- The shared copy's configuration (its GitHub App and broker settings).

Out of scope: GitHub itself, Cloudflare, and copies of Padgit run by other
people (report those to whoever runs them, and here too if the problem is in
this code).

## What already protects people

The [privacy note](PRIVACY.md) explains what each part sees. In short:
tokens stay in the browser and the broker keeps nothing; a Content Security
Policy limits the page to GitHub and the broker; every library from the CDN
is pinned to its exact contents; note text and file names are only ever shown
as text. The test suite checks each of these, including with hostile file
names and notes (`tests/hostile.test.mjs`, `tests/csp.test.mjs`,
`tests/integrity.test.mjs`).
