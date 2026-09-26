/*
  Runs every suite (tests/*.test.mjs) in every engine: Chromium, and WebKit,
  which is what Safari and every browser on iOS use.

    node tests/run.mjs              both engines
    node tests/run.mjs webkit       one engine
    node tests/run.mjs --list       the suites it would run
    --dir <folder>                  suites from another folder (the runner's own test)
    --jobs <n>                      suites run at once (default: 2 per CPU, at most 8)
    --suite <name>                  exact suite name; repeat to select several

  Each suite has its own fake GitHub and its own browser, so several can run
  at once; each one's output is printed together when it finishes. Most of a
  suite's time is waiting on the app, not CPU, hence more suites than CPUs.
  (Measured on 4 CPUs: 4 at a time 109 s, 8 at a time 72 s, 12 at a time 60 s,
  each three runs in a row without a failure here; but 12 at a time on
  GitHub's slower 4-CPU runners failed sign-ins and loads for lack of time,
  so the default is 8; CI now asks for 2 in each engine to limit contention.)

  An engine that is not installed fails the run, with the command that
  installs it. It is never skipped: a run that quietly left out Safari's
  engine would look like a pass.
*/
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as playwright from 'playwright';
import { ENGINES } from './harness.mjs';

const args = process.argv.slice(2);
const requested = [];
while (args.includes('--suite')) {
  const at = args.indexOf('--suite');
  const name = args[at + 1];
  if (!name || name.startsWith('--')) {
    console.error('--suite needs an exact name, e.g. npm run test:dev -- drafts');
    process.exit(2);
  }
  requested.push(name.endsWith('.test.mjs') ? name : `${name}.test.mjs`);
  args.splice(at, 2);
}
const jobsAt = args.indexOf('--jobs');
const jobs = jobsAt === -1 ? Math.max(1, Math.min(8, 2 * cpus().length)) : Number(args.splice(jobsAt, 2)[1]);
if (!Number.isInteger(jobs) || jobs < 1) { console.error('--jobs needs a whole number from 1.'); process.exit(2); }
const dirAt = args.indexOf('--dir');
const here = dirAt === -1 ? new URL('./', import.meta.url)
  : new URL(args.splice(dirAt, 2)[1].replace(/\/?$/, '/'), 'file://' + process.cwd() + '/');
// The policy suite goes first: when it fails it prints the hash to fix.
// Then the biggest first (size stands in for how long a suite takes), so the
// short ones fill in around them and the run ends sooner.
const size = f => statSync(new URL(f, here)).size;
const allFiles = readdirSync(here).filter(f => f.endsWith('.test.mjs'))
  .sort((a, b) => (b === 'csp.test.mjs') - (a === 'csp.test.mjs') || size(b) - size(a) || a.localeCompare(b));
const missingSuites = requested.filter(f => !allFiles.includes(f));
if (!allFiles.length || missingSuites.length) {
  console.error(missingSuites.length ? `Unknown suite: ${missingSuites.join(', ')}. Use npm test -- --list.`
    : 'No test suites found; refusing an empty run.');
  process.exit(2);
}
const files = requested.length ? allFiles.filter(f => requested.includes(f)) : allFiles;

if (args[0] === '--list') { console.log(files.join('\n')); process.exit(0); }
const unknown = args.filter(a => a.startsWith('--') && !['--list', '--engines'].includes(a));
if (unknown.length || args.slice(1).some(a => a === '--list' || a === '--engines')) {
  console.error(`Not understood: ${args.join(' ')}. See the top of tests/run.mjs.`);
  process.exit(2);
}
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

// One suite in one engine; resolves with whether it passed. Its output is
// kept and printed in one piece, so parallel suites do not interleave.
const timings = [];
function runOne(f, e) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [fileURLToPath(new URL(f, here))],
      { env: { ...process.env, NOTES_TEST_ENGINE: e } });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('error', err => { out += String(err); });
    child.on('close', code => {
      const seconds = (Date.now() - started) / 1000;
      timings.push({ suite: `${f} [${e}]`, seconds });
      process.stdout.write(`\n── ${f} [${e}] ──\n${out}`);
      resolve(code === 0);      // a crash or a signal (code null) is a failure
    });
  });
}

const queue = chosen.flatMap(e => files.map(f => [f, e]));
if (requested.length) console.log(`Focused: ${files.length} of ${allFiles.length} suites in ${chosen.join(' and ')}. Full check: npm test.`);
const failed = [];
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) {
    const [f, e] = queue.shift();
    if (!(await runOne(f, e))) failed.push(`${f} [${e}]`);
  }
}));
const took = Math.round((Date.now() - started) / 1000) + ' s';
console.log('\n' + (failed.length ? 'FAILED: ' + failed.join(', ') + ` (${took})`
  : `${requested.length ? 'Selected' : 'All'} ${files.length} suites passed in ${chosen.join(' and ')} (${took}, ${jobs} at a time).`));
console.log('Slowest suites: ' + timings.sort((a, b) => b.seconds - a.seconds).slice(0, 5)
  .map(t => `${t.suite} ${t.seconds.toFixed(1)}s`).join('; '));
process.exit(failed.length ? 1 : 0);
