#!/usr/bin/env node
/*
 * Mutation runner (§4.1c). Every mutation is a CONCRETE PATCH — file, an anchor
 * that must occur exactly once, its replacement — never a sentence. A KILL is
 * defined by four rules, all enforced here:
 *   1. the owning test PASSED unmutated, in this same run;
 *   2. the patch actually CHANGED the file (anchor found exactly once);
 *   3. the run served the MUTATED code — the built bundle's hash moved;
 *   4. a patch that does not compile is DOES NOT BUILD, never a kill.
 * A red run whose output is a build error, a server that never started or a
 * refused connection is classified, not counted. Playwright runs with CI=1 so
 * `reuseExistingServer` is off and no stale server can answer.
 *
 * The records in mutations/observed.json are written by this script from what
 * it ran. Nothing in that file is typed by hand.
 *
 * Usage: node scripts/mutate.mjs            all mutations
 *        node scripts/mutate.mjs M03 M07    selected ids
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Both runners treat the name as a REGULAR EXPRESSION. An unescaped "[00]" in a
// test name once matched nothing, ran zero tests and passed — the §4.1e hazard —
// so names are escaped here AND every owner run must report a nonzero count.
const re = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UNIT = (name) => `npx vitest run -t ${JSON.stringify(re(name))}`;
// --retries=0: a retry that passes on a lucky draw would read as a survivor.
const CLAIM = (name) => `npx playwright test --project=claims --retries=0 -g ${JSON.stringify(re(name))}`;
const A11Y = `npx playwright test --project=a11y --retries=0 -g "dark theme$"`;

export const MUTATIONS = [
  {
    id: 'M01', what: 'multiply placed on the same page as square (brief D1)',
    file: 'src/enclave/modexp.ts',
    anchor: '  m.touch(LAYOUT.multiply);',
    replace: '  m.touch(LAYOUT.square); // multiply() linked onto square()\'s page',
    owner: UNIT('500 random 64-bit exponents'),
  },
  {
    id: 'M02', what: 'oblivious step branches on the bit: multiply only when it is 1 (brief D2)',
    file: 'src/enclave/modexp-oblivious.ts',
    anchor: '    m.touch(LAYOUT.loop);\n    const t = multiply(m, acc, b0, mod);\n    const bit = (e >> BigInt(i)) & 1n;\n    acc = t * bit + acc * (1n - bit);',
    replace: '    const bit = (e >> BigInt(i)) & 1n;\n    if (bit) {\n      m.touch(LAYOUT.loop);\n      acc = multiply(m, acc, b0, mod);\n    }',
    owner: UNIT('traces are identical across 500 seeded exponents'),
  },
  {
    id: 'M03', what: 'observer given the exponent (brief D3)',
    file: 'src/enclave/run.ts',
    anchor: "Object.freeze({ program, width: program === 'oblivious' ? w : null, faults: Object.freeze(faults) })",
    replace: "Object.freeze({ program, width: program === 'oblivious' ? w : null, faults: Object.freeze(faults), debug: e.toString(16) } as Observation)",
    owner: UNIT('the observation has exactly program, width and faults'),
  },
  {
    id: 'M04', what: 'recovery reads the bits right-to-left (brief D4)',
    file: 'src/attack/recover.ts',
    anchor: '  const all = `1${bits}`;',
    replace: "  const all = `1${[...bits].reverse().join('')}`;",
    owner: UNIT('500 random 64-bit exponents'),
  },
  {
    id: 'M05', what: 'negative-claim sentence deleted from the fixture (§4.1d bite, assertion 3)',
    file: 'src/ui/recoverPanel.ts',
    anchor: "h('p', {}, 'The enclave\\'s memory was never read, and its arithmetic is correct. The exponent leaked anyway, through which pages it used — and the fix is page-oblivious in this model, not constant-time.'),",
    replace: '',
    owner: CLAIM('the negative claim: memory sealed, arithmetic correct'),
  },
  {
    id: 'M06', what: 'a check inside the fixture broken: the data page left out of the enclave, so the OS read succeeds (§4.1d bite, assertion 2)',
    file: 'src/enclave/model.ts',
    anchor: 'constructor(enclavePages: Iterable<number> = Object.values(LAYOUT)) {',
    replace: 'constructor(enclavePages: Iterable<number> = Object.values(LAYOUT).filter((p) => p !== LAYOUT.data)) {',
    owner: CLAIM('the negative claim: memory sealed, arithmetic correct'),
  },
  {
    id: 'M07', what: 'a truncated trace is decoded as if complete',
    file: 'src/attack/recover.ts',
    anchor: "  if (!complete) return { kind: 'partial'",
    replace: "  if (false && !complete) return { kind: 'partial'",
    owner: UNIT('a truncated trace'),
  },
  {
    id: 'M08', what: 'exponent 0 runs the loop instead of returning 1',
    file: 'src/enclave/modexp.ts',
    anchor: '  if (e === 0n) {',
    replace: '  if (e < 0n) {',
    owner: UNIT('exponent 0: the leaky trace is empty'),
  },
  {
    id: 'M09', what: 'the oblivious program accepts an exponent wider than w',
    file: 'src/enclave/modexp-oblivious.ts',
    anchor: '  if (e >= 1n << BigInt(w)) throw',
    replace: '  if (e >= 1n << BigInt(w + 1)) throw',
    owner: UNIT('an exponent wider than w is refused'),
  },
  {
    id: 'M10', what: 'the OS reads the counters by byte address, not page: shared-page counts become exact',
    file: 'src/enclave/countlogin.ts',
    anchor: "  const femalePage = layout === 'separate' ? COUNT_PAGES.female : COUNT_PAGES.male;",
    replace: "  const femalePage = layout === 'separate' ? COUNT_PAGES.female : COUNT_PAGES.female;",
    owner: UNIT('one shared page: the OS sees only the total'),
  },
  {
    id: 'M11', what: 'gate bite: muted text token darkened below 4.5:1',
    file: 'src/style.css',
    anchor: '--text-dim: #b3bdc8;',
    replace: '--text-dim: #4a525c;',
    owner: A11Y,
  },
];

const sh = (cmd) => {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, CI: '1' }, maxBuffer: 64 << 20 }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};
const bundleHash = () => {
  const dir = join('dist', 'assets');
  const h = createHash('md5');
  for (const f of readdirSync(dir).sort()) h.update(f).update(readFileSync(join(dir, f)));
  return h.digest('hex');
};
/** Tests actually executed, from the runner's own summary line; 0 means the run proved nothing. */
const testsRan = (out) => {
  const v = /Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(out) ?? /Tests\s+(\d+) failed/.exec(out);
  const p = /(\d+) passed \(/.exec(out) ?? /(\d+) failed/.exec(out);
  return Number((v ?? p)?.[1] ?? 0);
};
const INFRA = /webServer|ECONNREFUSED|was not able to start|Error: Cannot find module|error TS\d+/;

const wanted = process.argv.slice(2);
const list = wanted.length ? MUTATIONS.filter((m) => wanted.includes(m.id)) : MUTATIONS;

const build0 = sh('npm run build');
if (!build0.ok) throw new Error('baseline build fails; refusing to mutate');
const baseHash = bundleHash();
const ownerBaseline = new Map();
for (const owner of new Set(list.map((m) => m.owner))) {
  const r = sh(owner);
  const n = testsRan(r.out);
  ownerBaseline.set(owner, r.ok && n > 0);
  console.log(`baseline ${r.ok ? 'PASS' : 'FAIL'} (${n} test${n === 1 ? '' : 's'})  ${owner}`);
}

const records = [];
for (const m of list) {
  const src = readFileSync(m.file, 'utf8');
  const count = src.split(m.anchor).length - 1;
  const rec = { id: m.id, what: m.what, file: m.file, owner: m.owner, ownerPassedUnmutated: ownerBaseline.get(m.owner) };
  if (count !== 1) {
    records.push({ ...rec, result: `ANCHOR FOUND ${count} TIMES` });
    console.log(`${m.id} ANCHOR FOUND ${count} TIMES`);
    continue;
  }
  let mutated = src.replace(m.anchor, m.replace);
  if (m.prelude) mutated = mutated.replace(m.prelude.anchor, m.prelude.replace);
  writeFileSync(m.file, mutated);
  try {
    const b = sh('npm run build');
    if (!b.ok) {
      records.push({ ...rec, result: 'DOES NOT BUILD' });
      console.log(`${m.id} DOES NOT BUILD`);
      continue;
    }
    const h = bundleHash();
    const t = sh(m.owner);
    const infra = !t.ok && INFRA.test(t.out);
    const killed = rec.ownerPassedUnmutated && h !== baseHash && !t.ok && !infra;
    const result = killed ? 'KILLED' : infra ? 'INCONCLUSIVE (infrastructure failure)' : h === baseHash ? 'INCONCLUSIVE (bundle unchanged)' : 'SURVIVED';
    const failLine = t.out.split('\n').find((l) => /✘|FAIL|AssertionError|Expected|expect\(/.test(l)) ?? '';
    records.push({ ...rec, bundleHashChanged: h !== baseHash, ownerFailedMutated: !t.ok, result, evidence: failLine.trim().slice(0, 240) });
    console.log(`${m.id} ${result}  ${m.what}`);
  } finally {
    writeFileSync(m.file, src);
  }
}
const restored = sh('npm run build');
const restoredHash = restored.ok ? bundleHash() : 'BUILD FAILED';
const summary = {
  ranAt: new Date().toISOString(),
  baselineBundle: baseHash,
  restoredBundleMatches: restoredHash === baseHash,
  killed: records.filter((r) => r.result === 'KILLED').length,
  total: records.length,
  records,
};
mkdirSync('mutations', { recursive: true });
if (!wanted.length) writeFileSync('mutations/observed.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`\n${summary.killed}/${summary.total} killed; restored bundle matches baseline: ${summary.restoredBundleMatches}`);
if (summary.killed !== summary.total || !summary.restoredBundleMatches) process.exit(1);
