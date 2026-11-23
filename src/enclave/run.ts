import { PagedMachine } from './model';
import { modexpLeaky } from './modexp';
import { DEFAULT_WIDTH, modexpOblivious } from './modexp-oblivious';
import type { Observation, Program } from '../os/observer';

/**
 * Run the enclave program and split what happens into two parts that never mix:
 * the result (inside the enclave) and the Observation (what the OS gets: page numbers
 * and public metadata only — invariant 1).
 */
export function runEnclave(program: Program, base: bigint, e: bigint, mod: bigint, w = DEFAULT_WIDTH): { result: bigint; observation: Observation; machine: PagedMachine } {
  const machine = new PagedMachine();
  const result = program === 'leaky' ? modexpLeaky(machine, base, e, mod) : modexpOblivious(machine, base, e, mod, w);
  const faults = machine.faultTrace();
  const observation: Observation = Object.freeze({ program, width: program === 'oblivious' ? w : null, faults: Object.freeze(faults) });
  return { result, observation, machine };
}
