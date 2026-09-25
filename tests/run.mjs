/*
  Runs every suite (tests/*.test.mjs) in every engine: Chromium, and WebKit,
  which is what Safari and every browser on iOS use.

    node tests/run.mjs              both engines
    node tests/run.mjs webkit       one engine
    node tests/run.mjs --list       the suites it would run

  An engine that is not installed fails the run, with the command that
  installs it. It is never skipped: a run that quietly left out Safari's
  engine would look like a pass.
*/
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import * as playwright from 'playwright';
import { ENGINES } from './harness.mjs';

const here = new URL('./', import.meta.url);
// The policy suite goes first: when it fails it prints the hash to fix.
const files = readdirSync(here).filter(f => f.endsWith('.test.mjs'))
  .sort((a, b) => (b === 'csp.test.mjs') - (a === 'csp.test.mjs') || a.localeCompare(b));

const args = process.argv.slice(2);
if (args[0] === '--list') { console.log(files.join('\n')); process.exit(0); }
const engines = args.filter(a => !a.startsWith('--'));
const chosen = engines.length ? engines : ENGINES;
if (args[0] === '--engines') { console.log(chosen.join(' ')); process.exit(0); }

for (const e of chosen) {
  if (!ENGINES.includes(e)) {
    console.error(`Unknown engine "${e}": use ${ENGINES.join(' or ')}.`);
    process.exit(2);
  }
  if (!existsSync(playwright[e].executablePath())) {
    console.error(`${e} is not installed, so the suite cannot run in it.\n` +
      `Install it with:  npx playwright install --with-deps ${e}\n` +
      `(or run one engine on purpose:  node tests/run.mjs ${ENGINES.find(x => x !== e)}).`);
    process.exit(2);
  }
}

const failed = [];
for (const e of chosen) {
  for (const f of files) {
    const r = spawnSync(process.execPath, [new URL(f, here).pathname], { stdio: 'inherit', env: { ...process.env, BROWSER: e } });
    if (r.status !== 0) failed.push(`${f} [${e}]`);
  }
}
console.log('\n' + (failed.length ? 'FAILED: ' + failed.join(', ') : `All ${files.length} suites passed in ${chosen.join(' and ')}.`));
process.exit(failed.length ? 1 : 0);
