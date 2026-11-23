import { LAYOUT } from '../enclave/model';

/**
 * The untrusted OS's view (Xu et al. §III). It receives the Observation: the page
 * numbers of the faults, in order, plus public facts it knows anyway — which program
 * binary is running and, for the oblivious program, its fixed width. No exponent, no
 * result, no branch labels.
 */
export type Program = 'leaky' | 'oblivious';

export interface Observation {
  readonly program: Program;
  readonly width: number | null;
  readonly faults: readonly number[];
}

export type Token = 'S' | 'M';

/** Translate page numbers into function names using the public binary layout; other pages are skipped. */
export function tokens(obs: Observation): Token[] {
  const out: Token[] = [];
  for (const p of obs.faults) {
    if (p === LAYOUT.square) out.push('S');
    else if (p === LAYOUT.multiply) out.push('M');
  }
  return out;
}

/** A complete trace ends with the return to the caller's page. */
export function isComplete(obs: Observation): boolean {
  return obs.faults.length >= 2 && obs.faults[obs.faults.length - 1] === LAYOUT.caller;
}

/** The OS loses the last n faults (a trace cut short). */
export function truncate(obs: Observation, n: number): Observation {
  return Object.freeze({ ...obs, faults: Object.freeze(obs.faults.slice(0, Math.max(0, obs.faults.length - n))) });
}
