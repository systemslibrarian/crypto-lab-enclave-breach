import { cryptoRng } from '../rng';
import { LAYOUT } from '../enclave/model';
import { tokens } from '../os/observer';
import { clear, control, h, note, panelIntro, verdict } from './dom';
import { powmod, store } from './store';
import { smRow } from './tokens';

const hex = (p: number) => `0x${p.toString(16)}`;

export function parseHex(s: string): bigint | null {
  const t = s.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{1,32}$/.test(t) ? BigInt(`0x${t}`) : null;
}
export function parseDec(s: string): bigint | null {
  const t = s.trim();
  return /^[0-9]{1,60}$/.test(t) ? BigInt(t) : null;
}

export function renderProgramPanel(root: HTMLElement): void {
  const r0 = store.run;
  const baseIn = h('input', { id: 'prog-base', class: 'mono-input wide', type: 'text', value: r0.base.toString(), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const expIn = h('input', { id: 'prog-exp', class: 'mono-input wide', type: 'text', value: r0.exponent.toString(16), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const modIn = h('input', { id: 'prog-mod', class: 'mono-input wide', type: 'text', value: r0.mod.toString(), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const run = h('button', { class: 'btn btn-primary', type: 'button', id: 'prog-run' }, 'Run inside the enclave') as HTMLButtonElement;
  const rand = h('button', { class: 'btn btn-ghost', type: 'button', id: 'prog-random' }, 'Random 64-bit exponent') as HTMLButtonElement;
  const out = h('div', { class: 'output', id: 'prog-out', role: 'status', 'aria-live': 'polite' });

  const show = (): void => {
    const r = store.run;
    const ref = powmod(r.base, r.exponent, r.mod);
    clear(out);
    out.append(
      h('p', {}, 'Result (stays inside the enclave): ', h('code', { 'data-claim': 'prog-result' }, r.result.toString())),
      r.result === ref ? verdict('pass', 'Correct: equal to a reference computation by a different algorithm (right-to-left).') : verdict('fail', 'WRONG: the result differs from the reference.'),
      h('p', {}, 'What ran inside, in order — the enclave\'s own view, which the OS never sees: '),
      smRow(tokens(r.observation), 'prog-steps', 'Squares and multiplies, in order'),
      h('p', { class: 'help' }, `${tokens(r.observation).length} steps for exponent 0x${r.exponent.toString(16)} = ${r.exponent.toString(2)} in binary.`),
    );
  };

  const go = (): void => {
    const base = parseDec(baseIn.value);
    const e = parseHex(expIn.value);
    const mod = parseDec(modIn.value);
    for (const [el, v] of [[baseIn, base], [expIn, e], [modIn, mod]] as const) {
      if (v === null || (el === modIn && v < 1n)) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
    if (base === null || e === null || mod === null || mod < 1n) {
      clear(out);
      out.append(verdict('fail', 'Enter the base and modulus as decimal numbers (modulus at least 1) and the exponent as up to 32 hex digits.'));
      return;
    }
    store.set(base, e, mod);
    show();
  };
  run.addEventListener('click', go);
  rand.addEventListener('click', () => {
    const hi = BigInt(Math.floor(cryptoRng() * 2 ** 32)) | (1n << 31n);
    const lo = BigInt(Math.floor(cryptoRng() * 2 ** 32));
    expIn.value = ((hi << 32n) | lo).toString(16);
    go();
  });

  root.append(
    panelIntro(
      'The enclave program',
      'Inside the enclave runs modular exponentiation, base^exponent mod modulus, with a secret exponent — the operation at the heart of RSA and Diffie–Hellman. It uses the textbook left-to-right method: start from the base, and for every bit of the exponent after the leading 1, square; if the bit is 1, also multiply by the base.',
      'The code is split across pages, as compilers do. The squaring routine and the multiplying routine sit on different 4 KB pages. Nothing here is wrong as arithmetic.',
    ),
    h(
      'pre',
      { class: 'listing', id: 'prog-listing', tabindex: '0', role: 'region', 'aria-label': 'The enclave program and its pages' },
      `page ${hex(LAYOUT.caller)}  modexp(base, e, mod):            # entry and return\n` +
        `page ${hex(LAYOUT.data)}    read the secret exponent e\n` +
        `page ${hex(LAYOUT.loop)}    acc ← base; for each bit of e after the leading 1:\n` +
        `page ${hex(LAYOUT.square)}      acc ← square(acc)        # every bit\n` +
        `page ${hex(LAYOUT.multiply)}      if bit = 1: acc ← multiply(acc, base)\n` +
        `page ${hex(LAYOUT.caller)}  return acc`,
    ),
    h('div', { class: 'controls' }, control('prog-base', 'Base (decimal)', baseIn), control('prog-exp', 'Secret exponent (hex)', expIn, 'Default b5 = 1011 0101 in binary.'), control('prog-mod', 'Modulus (decimal)', modIn, 'Default 2^127 − 1.')),
    h('div', { class: 'action-row spaced' }, run, ' ', rand),
    out,
    note('info', 'Nothing is shown to the OS on this tab. The next tab is everything it gets.'),
  );
  show();
}
