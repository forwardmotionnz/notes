/*
  Every file index.html loads from the CDN must carry the hash of the bytes
  the CDN really serves (Subresource Integrity), so a changed file is refused
  by the browser instead of run with the person's GitHub sign-in in reach.
  https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity

  This fetches each file and compares. It needs to reach cdnjs, which the
  test suite never does (it serves its own copies), so it runs as its own CI
  job: node tests/cdn-integrity.mjs. For a missing or wrong hash it prints
  the right one, to copy into index.html.
*/
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
const tags = [...html.matchAll(/<(script|link)\b[^>]*\b(?:src|href)="(https:\/\/cdnjs\.cloudflare\.com\/[^"]+)"[^>]*>/g)];
if (!tags.length) { console.log('No CDN files found in index.html: nothing to check?'); process.exit(1); }

let bad = 0;
for (const [tag, , url] of tags) {
  const res = await fetch(url);
  if (!res.ok) { console.log(`UNREACHABLE ${res.status} ${url}`); bad++; continue; }
  const want = 'sha384-' + createHash('sha384').update(Buffer.from(await res.arrayBuffer())).digest('base64');
  const has = (tag.match(/\bintegrity="([^"]*)"/) || [])[1];
  const cors = /\bcrossorigin="anonymous"/.test(tag);
  if (has === want && cors) console.log(`OK        ${url}`);
  else {
    bad++;
    console.log(`${!has ? 'MISSING ' : has !== want ? 'MISMATCH' : 'NO CORS '}  ${url}\n          integrity="${want}" crossorigin="anonymous"`);
  }
}
console.log(bad ? `\n${bad} of ${tags.length} CDN files not pinned to what the CDN serves.` : `\nAll ${tags.length} CDN files pinned.`);
process.exit(bad ? 1 : 0);
