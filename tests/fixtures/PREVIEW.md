# Preview test fixtures

Exact CDN bytes used by the app, so browser tests exercise the real parser,
sanitiser and integrity checks offline. These are test fixtures, not deployed assets.

- Marked 18.0.14: https://cdnjs.cloudflare.com/ajax/libs/marked/18.0.14/lib/marked.umd.min.js (MIT; copyright Christopher Jeffrey). Source: https://github.com/markedjs/marked
- DOMPurify 3.4.16: https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.16/purify.min.js (Apache-2.0 or MPL-2.0; copyright Mario Heiderich). Source: https://github.com/cure53/DOMPurify

Version and licence banners are retained. When updating, replace the fixture,
app URL and integrity hash together, and run preview and CSP tests in both engines.
