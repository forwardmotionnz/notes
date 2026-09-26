/* The runner runs every suite in every engine, and never passes by skipping one. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('runner');
const root = new URL('../', import.meta.url);
const run = (args, env = {}) => spawnSync(process.execPath, ['tests/run.mjs', ...args],
  { cwd: root, env: { ...process.env, ...env }, encoding: 'utf-8', timeout: 60000 });

const listed = run(['--list']);
const files = readdirSync(new URL('tests/', root)).filter(f => f.endsWith('.test.mjs')).sort();
const got = listed.stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
t.check('every suite file is run, found by itself', listed.status === 0 &&
  JSON.stringify(got.slice().sort()) === JSON.stringify(files), listed.stdout + listed.stderr);
t.check('the policy suite runs first (it prints the hash to fix)', got[0] === 'csp.test.mjs', got[0]);

const both = run(['--engines']);
t.check('with no engine named, both run', both.stdout.trim() === 'chromium webkit', both.stdout + both.stderr);

const flag = run(['webkit', '--list']);
t.check('an option it does not understand is refused, not ignored', flag.status === 2 &&
  run(['--webkit']).status === 2, flag.stdout + flag.stderr);

const bad = run(['firefoxx']);
t.check('an unknown engine is refused, not ignored', bad.status !== 0 && /unknown engine/i.test(bad.stdout + bad.stderr),
  bad.stdout + bad.stderr);

// An engine that is not installed fails the run and says how to fix it.
const missing = run(['webkit'], { PLAYWRIGHT_BROWSERS_PATH: '/nonexistent-browsers' });
const said = missing.stdout + missing.stderr;
t.check('a missing engine fails the run', missing.status !== 0, said);
t.check('naming the fix', /npx playwright install --with-deps webkit/.test(said), said);
t.check('and running nothing that could look like a pass', !/passed/.test(said), said);

// A suite that fails, or dies before reporting, fails the whole run, and
// every suite still runs.
// In the engine this run has: the other may not be installed (CI installs one).
const here = process.env.NOTES_TEST_ENGINE || 'chromium';
const fx = run([here, '--dir', 'tests/fixtures/runner']);
const fxOut = fx.stdout + fx.stderr;
t.check('a failing suite fails the run', fx.status === 1 && new RegExp(`FAILED: .*bad\\.test\\.mjs \\[${here}\\]`).test(fxOut), fxOut);
t.check('so does one that crashes before reporting', new RegExp(`FAILED: .*crash\\.test\\.mjs \\[${here}\\]`).test(fxOut), fxOut);
t.check('and the rest still run', new RegExp(`ok \\[${here}\\]: 1/1 passed`).test(fxOut), fxOut);
// Several at once: each suite's output still comes out in one piece.
t.check('run in parallel, each suite\'s output stays together',
  new RegExp(`── bad\\.test\\.mjs \\[${here}\\] ──\\nbad \\[${here}\\]: 0/1 passed`).test(fxOut) &&
  new RegExp(`── ok\\.test\\.mjs \\[${here}\\] ──\\nok \\[${here}\\]: 1/1 passed`).test(fxOut), fxOut);
const one = run([here, '--dir', 'tests/fixtures/runner', '--jobs', '1']);
t.check('one at a time gives the same verdict', one.status === 1 && /FAILED: .*bad.*crash|FAILED: .*crash.*bad/.test(one.stdout));
t.check('--jobs must be a whole number from 1', run([here, '--jobs', '0']).status === 2 && run([here, '--jobs', 'x']).status === 2);
t.check('the fixtures are not part of the real suite', !run(['--list']).stdout.includes('bad.test.mjs'));

// The harness launches the engine it is told to: in the WebKit run this is
// what proves the suite really ran in WebKit.
await H.start();
t.check(`the harness launches ${H.engine()} when told to`, H.launched() === (process.env.NOTES_TEST_ENGINE || 'chromium'),
  `${process.env.NOTES_TEST_ENGINE} -> ${H.launched()}`);
await H.stop();
const wrong = spawnSync(process.execPath, ['-e', "import('./tests/harness.mjs').then(H => H.start()).then(() => process.exit(0), e => { console.log(String(e)); process.exit(3); })"],
  { cwd: root, env: { ...process.env, NOTES_TEST_ENGINE: 'netscape' }, encoding: 'utf-8', timeout: 60000 });
t.check('and refuses one it does not know', wrong.status === 3 && /netscape/.test(wrong.stdout), wrong.stdout + wrong.stderr);

t.finish();
