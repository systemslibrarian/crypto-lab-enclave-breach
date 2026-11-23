import { runEnclave } from '../enclave/run';
import type { Observation } from '../os/observer';

/** The current leaky run, shared by the program, OS-view and recovery exhibits. */
export interface Run {
  readonly base: bigint;
  readonly exponent: bigint;
  readonly mod: bigint;
  readonly result: bigint;
  readonly observation: Observation;
}

export const KAT_EXPONENT = 0b10110101n;
export const DEFAULT_BASE = 0x1234567890abcdefn;
export const DEFAULT_MOD = (1n << 127n) - 1n;

/** Reference modular exponentiation, right-to-left — a different algorithm from the enclave's left-to-right one. */
export function powmod(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n % m;
  let x = ((b % m) + m) % m;
  for (let k = e; k > 0n; k >>= 1n) {
    if (k & 1n) r = (r * x) % m;
    x = (x * x) % m;
  }
  return r;
}

type Listener = () => void;
class Store {
  run: Run;
  private listeners: Listener[] = [];
  constructor() {
    this.run = this.compute(DEFAULT_BASE, KAT_EXPONENT, DEFAULT_MOD);
  }
  private compute(base: bigint, exponent: bigint, mod: bigint): Run {
    const { result, observation } = runEnclave('leaky', base, exponent, mod);
    return { base, exponent, mod, result, observation };
  }
  set(base: bigint, exponent: bigint, mod: bigint): void {
    this.run = this.compute(base, exponent, mod);
    for (const l of this.listeners) l();
  }
  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
export const store = new Store();
