/* index.html stays under the owner's size limit: 200 KB (raised from 150 KB
   on 2026-09-27). One file, no build step: this is what every visit loads. */
import { statSync } from 'node:fs';
import * as H from './harness.mjs';

const t = H.suite('size');
const LIMIT = 200 * 1024;
const size = statSync(new URL('../index.html', import.meta.url)).size;
t.check(`index.html is under 200 KB`, size < LIMIT, `${size} of ${LIMIT} bytes`);
t.finish();
