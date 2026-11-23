import { LAYOUT, type PagedMachine } from './model';
import { multiply, square } from './modexp';

/**
 * The DATA-OBLIVIOUS rewrite (Xu et al. §VII: rewrite the program so that its memory
 * access pattern does not depend on secrets). A fixed exponent width w; for every one
 * of the w positions, from the top: always square, always multiply, then keep the
 * product or not by an arithmetic mask — no branch on the bit. Every exponent below
 * 2^w, including 0, produces the same 2w-step page sequence.
 *
 * Scope: page-oblivious in this model, NOT constant-time. BigInt arithmetic, caches and
 * the browser are outside the page-fault model, and a branch confined to one page
 * would be invisible to this observer anyway.
 */
export const DEFAULT_WIDTH = 64;

export function modexpOblivious(m: PagedMachine, base: bigint, e: bigint, mod: bigint, w = DEFAULT_WIDTH): bigint {
  if (mod < 1n) throw new RangeError('the modulus must be at least 1');
  if (e < 0n) throw new RangeError('the exponent must not be negative');
  if (e >= 1n << BigInt(w)) throw new RangeError(`the exponent is wider than ${w} bits: refused, because the fixed-width schedule cannot cover it`);
  const b0 = ((base % mod) + mod) % mod;
  m.touch(LAYOUT.caller);
  m.touch(LAYOUT.data);
  let acc = 1n % mod;
  for (let i = w - 1; i >= 0; i--) {
    m.touch(LAYOUT.loop);
    acc = square(m, acc, mod);
    m.touch(LAYOUT.loop);
    const t = multiply(m, acc, b0, mod);
    const bit = (e >> BigInt(i)) & 1n;
    acc = t * bit + acc * (1n - bit); // select by mask: both values are computed every time
  }
  m.touch(LAYOUT.caller);
  return acc;
}
