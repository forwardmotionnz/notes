# Contributing to Notes

Thank you for helping. Notes is small on purpose, and these notes are here so
that a change is quick to review and easy to accept.

## Before you start

- **Bugs:** open an issue with the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
  A fix without an issue is welcome too, if it comes with a test.
- **Features:** open an issue first ([feature request](.github/ISSUE_TEMPLATE/feature_request.md))
  so we can agree it fits before you spend time on it. The guide lists
  [what Notes deliberately does not do](docs/guide.md#what-it-deliberately-does-not-do).
- **Security problems:** never in a public issue. See [SECURITY.md](SECURITY.md).

## Design rules

1. **No build step, one app file.** `index.html` is the application. The
   broker is the only other code that runs, and it only swaps tokens.
2. **The repository is the model.** Paths are paths, filenames are titles. No
   IDs, no required frontmatter, no special link syntax. Everything the app
   does maps to an obvious git operation.
3. **Host-specific code stays in the `PROVIDER` section.** Supporting another
   host means reimplementing `listTree`, `readFile`, `writeFile`, `describe`
   and the sign-in, not touching the editor.
4. **No telemetry and no new hosts.** The page talks to GitHub, the sign-in
   broker and the CDN it loads its libraries from, and nothing else. A new
   library comes from cdnjs, pinned by its integrity hash, and the app must
   still work (with a visible notice) if it fails to load.
5. **Nothing the app writes needs Notes to read it.** No app-specific files
   in anyone's repository; a note stays an ordinary Markdown file.
6. **`index.html` stays under 200 KB** (`tests/size.test.mjs` checks it).

## Running it locally

Serve the folder with any static server and open it; signing in needs a
GitHub App and broker of your own ([Running your own copy](docs/self-hosting.md)).
Most work never needs that: the tests run the app against a simulated GitHub.

## Tests

```sh
npm install
npx playwright install --with-deps chromium webkit
```

For the edit/test loop, select the feature you changed:

```sh
npm run test:dev -- drafts
npm run test:dev -- mobile-new
npm run test:dev -- drafts --suite switching
```

This runs only the named suites in Chromium and labels the result as a
focused check. Names must match exactly; a typo or missing name fails rather
than silently passing. `npm test -- --list` lists the available names.
For an engine-specific fix, use `npm run test:webkit -- --suite drafts`.
Run the affected suites while editing; CI runs everything on your pull
request.

Before merging, `npm test` runs every suite in Chromium and WebKit, the engine of Safari and
of every browser on iOS. (That is Playwright's testing build of WebKit, which
catches engine differences; it is not an iPhone, so iOS-only behaviour such
as Safari's storage limits is not covered.) `npm run test:chromium` or `npm run test:webkit`
runs one on purpose; a missing engine fails the run rather than being
skipped. Suites run up to eight at a time (each has its own simulated
GitHub and browser; `--jobs` changes it). The runner reports the slowest
suites so performance changes are visible. The full release run currently
takes about four minutes locally; it is not the development loop.

GitHub Actions runs the full suite in both engines for pull requests and
pushes to `main`. A PR branch push starts one workflow, not duplicate push
and PR workflows. New commits cancel obsolete runs. CI runs two suites at
a time per engine to limit contention. Maintainers also run the whole suite three times
over before a release (the manual workflow's `repeat` input).

The browser is headless, with GitHub simulated and the real broker code in
the loop. The simulation verifies the PKCE challenge, expires tokens and
rotates single-use refresh tokens the way GitHub does. Nothing touches the
network.

If you change the script in `index.html`, its hash in the first
`Content-Security-Policy` tag changes too: the `csp` suite fails first and
prints the new hash to paste in.

## Pull requests

- One change per pull request, with a test that fails without it.
- Never weaken, skip or delete a test to make it pass. If a test is wrong,
  say why in the pull request and fix the test.
- Anything the simulated GitHub in `tests/harness.mjs` learns must match
  GitHub's documentation; put the page's URL in a comment beside it.
- If people would notice the change, update the [guide](docs/guide.md),
  [privacy note](PRIVACY.md) or [changelog](CHANGELOG.md) in the same pull
  request.
- Write for people who are not developers, in plain British English (the
  project's spelling).
- CI runs every suite in Chromium and WebKit on your pull request; a
  maintainer may need to approve the run the first time you contribute.

## How the maintainers work

Much of Notes has been built with AI coding agents, held to the rules above
by a written process: every change is tested first, every safeguard is
checked by breaking it on purpose, and every change is reviewed by a second
agent looking for ways it could lose notes or leak a sign-in. The process
and its records are in [docs/dev](docs/dev/). You do not need to follow it;
the pull request checks above are what matters.

## Licence

By contributing you agree that your contribution is licensed under the
project's [MIT licence](LICENSE).
