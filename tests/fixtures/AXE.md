# Offline accessibility audit

axe-core 4.11.3, MPL-2.0 (see AXE-LICENSE), downloaded unchanged from
https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.11.3/axe.min.js.
Source and API: https://github.com/dequelabs/axe-core.

Used only by Playwright tests. No runtime dependency, external audit service,
or changes to the app's Content Security Policy. No axe rules are disabled;
serious and critical violations fail the suite. Full results, including items
needing human review, are saved under tests/screens/accessibility-ENGINE.json.
