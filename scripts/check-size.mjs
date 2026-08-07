import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Enforces the bundle budget from CLAUDE.md. A budget nobody checks is a wish,
 * and bundle growth is invisible until it is a problem.
 */

const BUDGET_KB = 200;
const ASSETS = 'dist/assets';

const entries = await readdir(ASSETS);
const scripts = entries.filter((name) => name.endsWith('.js'));

if (scripts.length === 0) {
  console.error(`No JavaScript found in ${ASSETS}. Run the build first.`);
  process.exit(1);
}

let total = 0;

for (const name of scripts) {
  const contents = await readFile(join(ASSETS, name));
  const gzipped = gzipSync(contents).length;
  total += gzipped;
  console.log(`${name}  ${(gzipped / 1024).toFixed(2)} kB gzipped`);
}

const totalKb = total / 1024;
const headroom = BUDGET_KB - totalKb;

console.log(`\nTotal ${totalKb.toFixed(2)} kB of a ${String(BUDGET_KB)} kB budget.`);

if (totalKb > BUDGET_KB) {
  console.error(`Over budget by ${Math.abs(headroom).toFixed(2)} kB.`);
  process.exit(1);
}

console.log(`${headroom.toFixed(2)} kB to spare.`);
