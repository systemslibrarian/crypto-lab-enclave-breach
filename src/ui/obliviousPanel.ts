import { recover } from '../attack/recover';
import { runEnclave } from '../enclave/run';
import { DEFAULT_WIDTH } from '../enclave/modexp-oblivious';
import { tokens } from '../os/observer';
import { checkRow, clear, h, note, panelIntro, verdict } from './dom';
import { powmod, store } from './store';
import { smRow } from './tokens';

export function renderObliviousPanel(root: HTMLElement): void {
  const run = h('button', { class: 'btn btn-primary', type: 'button', id: 'obl-run' }, 'Run the oblivious version') as HTMLButtonElement;
  const out = h('div', { class: 'output', id: 'obl-out' });
  run.addEventListener('click', () => {
    const r = store.run;
    clear(out);
    let mine;
    try {
      mine = runEnclave('oblivious', r.base, r.exponent, r.mod);
    } catch (e) {
      out.append(verdict('fail', `Refused: ${(e as Error).message}.`));
      return;
    }
    const zero = runEnclave('oblivious', r.base, 0n, r.mod).observation;
    const ones = runEnclave('oblivious', r.base, (1n << BigInt(DEFAULT_WIDTH)) - 1n, r.mod).observation;
    const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((p, i) => p === b[i]);
    const rec = recover(mine.observation);
    const t = tokens(mine.observation);
    out.append(
      h('p', {}, h('strong', { 'data-claim': 'obl-steps' }, String(t.length)), ` steps for exponent 0x${r.exponent.toString(16)}: always square, always multiply, ${DEFAULT_WIDTH} times.`),
      smRow(t, 'obl-sm', 'Square and multiply pages, in order'),
      h(
        'ul',
        { class: 'check-list' },
        checkRow(same(mine.observation.faults, zero.faults), 'The page trace is identical to the trace for exponent 0', 'obl-same-zero'),
        checkRow(same(mine.observation.faults, ones.faults), `…and to the trace for exponent 2^${DEFAULT_WIDTH} − 1`, 'obl-same-ones'),
        checkRow(mine.result === powmod(r.base, r.exponent, r.mod), 'The result is still correct', 'obl-correct'),
        checkRow(rec.kind === 'no-information', rec.kind === 'no-information' ? 'Recovery: no information' : 'Recovery found something', 'obl-recovery'),
      ),
      verdict('pass', 'The OS sees the same page sequence whatever the exponent is.'),
    );
  });
  root.append(
    panelIntro(
      'The oblivious rewrite',
      'The fix Xu, Cui and Peinado point to (§VII) is to rewrite the program so its memory accesses do not depend on the secret. Here: fix the exponent width at 64 bits, and for every one of the 64 positions always square and always multiply — then keep the product or not by arithmetic on the bit (acc = t·b + acc·(1 − b)), with no branch. The page sequence is the same for every exponent below 2^64, including 0.',
    ),
    h('div', { class: 'action-row spaced' }, run),
    out,
    note('caveat', 'Page-oblivious in this model, not constant-time. BigInt arithmetic takes time that depends on its operands; caches see finer detail than pages; and a branch that stays inside one page would be invisible to this observer even if it were secret-dependent. Oblivious memory (ORAM) is the tool for secret-dependent data access — see ORAM Vault. A cache-line model is an extension point, not built here.'),
  );
}
