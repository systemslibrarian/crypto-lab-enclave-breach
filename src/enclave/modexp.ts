import { LAYOUT, type PagedMachine } from './model';

/**
 * Left-to-right square-and-multiply with a secret exponent — the LEAKY version.
 * square() and multiply() live on different code pages, so the page the enclave
 * moves to after each square says whether that exponent bit was 1.
 * Logical schedule: skip the leading 1 bit; for every remaining bit, square, then
 * multiply if the bit is 1. Exponent 0b10110101 gives S S M S M S S M S S M.
 */
function square(m: PagedMachine, a: bigint, mod: bigint): bigint {
  m.touch(LAYOUT.square);
  return (a * a) % mod;
}

function multiply(m: PagedMachine, a: bigint, b: bigint, mod: bigint): bigint {
  m.touch(LAYOUT.multiply);
  return (a * b) % mod;
}

export { square, multiply };

export function modexpLeaky(m: PagedMachine, base: bigint, e: bigint, mod: bigint): bigint {
  if (mod < 1n) throw new RangeError('the modulus must be at least 1');
  if (e < 0n) throw new RangeError('the exponent must not be negative');
  m.touch(LAYOUT.caller);
  m.touch(LAYOUT.data); // reads its secret exponent
  if (e === 0n) {
    m.touch(LAYOUT.caller);
    return 1n % mod;
  }
  const bits = e.toString(2);
  m.touch(LAYOUT.loop);
  let acc = ((base % mod) + mod) % mod;
  for (let i = 1; i < bits.length; i++) {
    m.touch(LAYOUT.loop);
    acc = square(m, acc, mod);
    if (bits[i] === '1') {
      m.touch(LAYOUT.loop);
      acc = multiply(m, acc, ((base % mod) + mod) % mod, mod);
    }
  }
  m.touch(LAYOUT.caller);
  return acc;
}
