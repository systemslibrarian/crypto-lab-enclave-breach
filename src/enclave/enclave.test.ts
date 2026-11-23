import { describe, expect, it } from 'vitest';
import { seeded } from '../testing/seeded';
import { recover } from '../attack/recover';
import { isComplete, tokens, truncate } from '../os/observer';
import { countLogins, osCounts } from './countlogin';
import { LAYOUT, MemoryIsolationError, PagedMachine } from './model';
import { runEnclave } from './run';

/** BigInt modular exponentiation by right-to-left binary — a different algorithm from the enclave's, as the oracle. */
function powmod(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n % m;
  let x = ((b % m) + m) % m;
  for (let k = e; k > 0n; k >>= 1n) {
    if (k & 1n) r = (r * x) % m;
    x = (x * x) % m;
  }
  return r;
}
/** The logical trace written here from the brief's definition: skip the leading 1; S per bit, then M if the bit is 1. */
const expectedTrace = (e: bigint): string => (e <= 1n ? '' : [...e.toString(2).slice(1)].map((b) => (b === '1' ? 'SM' : 'S')).join(''));
const rand64 = (rng: () => number): bigint => (BigInt(Math.floor(rng() * 2 ** 32)) << 32n) | BigInt(Math.floor(rng() * 2 ** 32));
const MOD = (1n << 127n) - 1n; // a Mersenne prime; any modulus works
const BASE = 0x1234567890abcdefn;

describe('A. Trace KAT', () => {
  it('exponent 0b10110101 → S S M S M S S M S S M', () => {
    const { observation } = runEnclave('leaky', BASE, 0b10110101n, MOD);
    expect(tokens(observation).join('')).toBe('SSMSMSSMSSM');
    expect(expectedTrace(0b10110101n)).toBe('SSMSMSSMSSM');
  });
  it('the fault trace is page numbers: caller, data, loop, then loop ↔ square/multiply, then caller', () => {
    const { observation } = runEnclave('leaky', BASE, 0b101n, MOD);
    expect(observation.faults).toEqual([LAYOUT.caller, LAYOUT.data, LAYOUT.loop, LAYOUT.square, LAYOUT.loop, LAYOUT.square, LAYOUT.loop, LAYOUT.multiply, LAYOUT.caller]);
  });
});

describe('B. Recovery from the leaky trace', () => {
  it('500 random 64-bit exponents: every bit recovered from the trace, and every result matches BigInt pow', () => {
    const rng = seeded(64);
    for (let n = 0; n < 500; n++) {
      const e = rand64(rng) | 2n; // ≥ 2, so the trace is non-empty
      const { result, observation } = runEnclave('leaky', BASE, e, MOD);
      expect(result).toBe(powmod(BASE, e, MOD));
      expect(tokens(observation).join('')).toBe(expectedTrace(e));
      const r = recover(observation);
      expect(r.kind).toBe('recovered');
      expect(r.kind === 'recovered' && r.exponent).toBe(e);
    }
  });
});

describe('C. The oblivious rewrite (w = 64)', () => {
  it('traces are identical across 500 seeded exponents and 0, 1, 2^64 − 1; 128 steps; results correct', () => {
    const rng = seeded(65);
    const exps = [0n, 1n, (1n << 64n) - 1n, ...Array.from({ length: 500 }, () => rand64(rng))];
    const ref = runEnclave('oblivious', BASE, 0n, MOD).observation;
    expect(tokens(ref)).toHaveLength(128);
    expect(tokens(ref).join('')).toBe('SM'.repeat(64));
    for (const e of exps) {
      const { result, observation } = runEnclave('oblivious', BASE, e, MOD);
      expect(result).toBe(powmod(BASE, e, MOD));
      expect(observation.faults).toEqual(ref.faults);
    }
  });
  it('recovery on an oblivious trace returns "no information"', () => {
    const r = recover(runEnclave('oblivious', BASE, 0xdeadbeefn, MOD).observation);
    expect(r.kind).toBe('no-information');
  });
});

describe('E. Fail-closed edge cases', () => {
  it('exponent 0: the leaky trace is empty and the page says there is nothing to recover; the oblivious run still has 128 steps', () => {
    const leaky = runEnclave('leaky', BASE, 0n, MOD);
    expect(leaky.result).toBe(1n);
    expect(tokens(leaky.observation)).toEqual([]);
    expect(recover(leaky.observation).kind).toBe('empty');
    expect(tokens(runEnclave('oblivious', BASE, 0n, MOD).observation)).toHaveLength(128);
  });
  it('a truncated trace: the certain leading bits, and the tail reported as unknown', () => {
    const e = 0b1011010111n;
    const obs = truncate(runEnclave('leaky', BASE, e, MOD).observation, 5);
    expect(isComplete(obs)).toBe(false);
    const r = recover(obs);
    expect(r.kind).toBe('partial');
    expect(r.kind === 'partial' && e.toString(2).startsWith(r.bits)).toBe(true);
    expect(r.kind === 'partial' && r.bits.length).toBeLessThan(e.toString(2).length);
  });
  it('an exponent wider than w is refused by the oblivious program', () => {
    expect(() => runEnclave('oblivious', BASE, 1n << 64n, MOD)).toThrow(/wider than 64/);
  });
  it('the OS cannot read enclave memory: a direct read is refused', () => {
    const m = new PagedMachine();
    expect(() => m.osRead(LAYOUT.data)).toThrow(MemoryIsolationError);
    expect(() => m.osRead(LAYOUT.data)).toThrow(/refused/);
    for (const p of Object.values(LAYOUT)) expect(() => m.osRead(p)).toThrow(MemoryIsolationError);
    expect(m.osRead(0x100)).toBe(0); // the OS's own page
  });
});

describe('Invariant 1: the OS receives page numbers and public metadata only', () => {
  it('the observation has exactly program, width and faults — and no exponent, result or branch label anywhere in it', () => {
    const e = 0xfedcba9876543210n;
    const { result, observation } = runEnclave('leaky', BASE, e, MOD);
    expect(Object.keys(observation).sort()).toEqual(['faults', 'program', 'width']);
    const json = JSON.stringify(observation);
    for (const secret of [e.toString(10), e.toString(16), e.toString(2), result.toString(10), result.toString(16)]) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/square|multiply|bit|exponent|result/i);
    expect(observation.faults.every((p) => Number.isInteger(p))).toBe(true);
  });
});

describe('Xu et al. §III-A, Figure 2 (counting logins)', () => {
  const logins = Array.from({ length: 40 }, (_, i) => ((i * 7) % 5 < 2 ? 'female' : 'male') as 'male' | 'female');
  it('separate counter pages: the OS reads both counts from its faults', () => {
    const { counts, faults } = countLogins(logins, 'separate');
    expect(osCounts(faults)).toEqual(counts);
  });
  it('one shared page: the OS sees only the total', () => {
    const { counts, faults } = countLogins(logins, 'shared');
    const seen = osCounts(faults);
    expect(seen.male).toBe(counts.male + counts.female);
    expect(seen.female).toBe(0);
  });
});
