import { PagedMachine } from '../enclave/model';
import { modexpOblivious } from '../enclave/modexp-oblivious';
import { isComplete, tokens, type Observation } from '../os/observer';

/**
 * Rebuild the exponent from the OS's observation alone. The attacker knows the program
 * (it is public) but not the exponent. For the leaky program: read the S/M tokens left
 * to right — S followed by M is a 1, S alone is a 0 — and put back the leading 1 that
 * the algorithm skips.
 */
export type Recovery =
  | { kind: 'recovered'; bits: string; exponent: bigint }
  | { kind: 'empty'; note: string }
  | { kind: 'partial'; bits: string; note: string }
  | { kind: 'no-information'; note: string };

export function recover(obs: Observation): Recovery {
  if (obs.program === 'oblivious') {
    // The attacker can run the public program on any exponent of its choosing. If the
    // trace it saw is the same as the trace for exponent 0, the trace carries nothing.
    const m = new PagedMachine();
    modexpOblivious(m, 2n, 0n, 3n, obs.width ?? 64);
    const ref = m.faultTrace();
    const same = ref.length === obs.faults.length && ref.every((p, i) => p === obs.faults[i]);
    return same
      ? { kind: 'no-information', note: 'The trace is identical to the trace for exponent 0 — and for every other exponent below 2^w. It carries no information about the exponent.' }
      : { kind: 'partial', bits: '', note: 'This trace differs from the oblivious schedule: the program did not run as published.' };
  }
  const t = tokens(obs);
  const complete = isComplete(obs);
  if (t.length === 0 && complete) return { kind: 'empty', note: 'No square or multiply ran, so the exponent is 0 or 1 — the trace has nothing to tell them apart, and nothing more to recover.' };
  let bits = '';
  let i = 0;
  while (i < t.length) {
    if (t[i] !== 'S') throw new Error(`malformed trace: a multiply at token ${i} without a square before it`);
    if (t[i + 1] === 'M') {
      bits += '1';
      i += 2;
    } else if (i + 1 < t.length || complete) {
      bits += '0';
      i += 1;
    } else {
      break; // a final S with the trace cut off: was a multiply coming? unknown
    }
  }
  if (!complete) return { kind: 'partial', bits: `1${bits}`, note: 'The trace was cut short: these leading bits are certain; the rest of the exponent, including its length, is unknown.' };
  const all = `1${bits}`;
  return { kind: 'recovered', bits: all, exponent: BigInt(`0b${all}`) };
}
