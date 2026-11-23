import { recover } from '../attack/recover';
import { LAYOUT, MemoryIsolationError, PagedMachine } from '../enclave/model';
import { truncate } from '../os/observer';
import { checkRow, clear, control, h, panelIntro, select, selectWrap, threatModel, verdict } from './dom';
import { powmod, store } from './store';

/** The isolation check: the OS tries to read the enclave's data page directly and is refused. */
function isolationHolds(): boolean {
  try {
    new PagedMachine().osRead(LAYOUT.data);
    return false;
  } catch (e) {
    return e instanceof MemoryIsolationError;
  }
}

export function renderRecoverPanel(root: HTMLElement): void {
  const lossSel = select('rec-loss', [['0', 'The whole trace'], ['3', 'Lose the last 3 faults'], ['12', 'Lose the last 12 faults']], '0');
  const out = h('div', { class: 'output', id: 'rec-out' });

  const show = (): void => {
    const r = store.run;
    const obs = truncate(r.observation, Number(lossSel.value));
    const rec = recover(obs);
    const truth = r.exponent.toString(2);
    clear(out);
    if (rec.kind === 'empty') {
      out.append(verdict('pass', rec.note), h('p', { class: 'help' }, `(The exponent was ${truth}.)`));
      return;
    }
    if (rec.kind === 'partial') {
      out.append(
        h('p', {}, 'Recovered from the trace: ', h('code', { 'data-claim': 'rec-bits' }, `${rec.bits}…`)),
        h('p', {}, 'The true exponent, for grading: ', h('code', { 'data-claim': 'rec-truth' }, truth)),
        verdict('alarm', rec.note),
      );
      return;
    }
    if (rec.kind === 'no-information') {
      out.append(verdict('pass', rec.note));
      return;
    }
    const match = rec.exponent === r.exponent;
    const correct = r.result === powmod(r.base, r.exponent, r.mod);
    out.append(
      h(
        'div',
        { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Recovered bits beside the true bits' },
        h(
          'table',
          { class: 'kat-table bits-table' },
          h('tbody', {}, h('tr', {}, h('th', { scope: 'row' }, 'Recovered from the trace'), h('td', {}, h('code', { 'data-claim': 'rec-bits' }, rec.bits))), h('tr', {}, h('th', { scope: 'row' }, 'True exponent (for grading)'), h('td', {}, h('code', { 'data-claim': 'rec-truth' }, truth)))),
        ),
      ),
      h(
        'div',
        { class: 'fixture-card', id: 'breach-fixture' },
        h('h3', {}, 'What the enclave\'s guarantees say'),
        h(
          'ul',
          { class: 'check-list' },
          checkRow(isolationHolds(), 'Memory isolation: the OS\'s direct read of the enclave\'s data page was refused', 'fx-isolation'),
          checkRow(correct, 'The arithmetic is correct: the enclave\'s result equals the reference', 'fx-result'),
          checkRow(match, match ? `The exponent rebuilt from page numbers alone equals the secret (${rec.bits.length} bits)` : 'The rebuilt exponent differs from the secret', 'fx-recovered', 'the leak'),
        ),
        verdict('alarm', 'MEMORY SEALED — AND THE KEY READ FROM ITS FOOTSTEPS'),
        h(
          'div',
          { class: 'callout callout-danger negative-claim', 'data-negative-claim': 'breach' },
          h('p', { class: 'negative-claim-title' }, h('span', { 'aria-hidden': 'true' }, '⚠ '), 'NO MEMORY READ, NO ARITHMETIC WRONG'),
          h('p', {}, 'The enclave\'s memory was never read, and its arithmetic is correct. The exponent leaked anyway, through which pages it used — and the fix is page-oblivious in this model, not constant-time.'),
        ),
      ),
    );
  };
  lossSel.addEventListener('change', show);
  store.onChange(show);

  root.append(
    panelIntro(
      'Recover the exponent',
      'Read the square and multiply pages left to right. A square followed by a multiply means that bit was 1; a square on its own means 0. Put back the leading 1 the algorithm skips, and the exponent is complete. Nothing else is needed: no key material, no timing, no memory contents.',
    ),
    h('div', { class: 'controls' }, control('rec-loss', 'What the OS captured', selectWrap(lossSel), 'A trace cut short leaves the end of the exponent unknown.')),
    out,
    threatModel({
      attacker: 'The operating system: it manages the page tables and handles page faults.',
      access: 'The page number of every fault (not the offset), and the program binary.',
      trusted: 'The enclave hardware: memory isolation holds throughout.',
      success: 'The secret exponent, rebuilt from the fault sequence.',
      notShown: 'An attack on real SGX hardware, or anything about caches or speculative execution.',
    }),
  );
  show();
}
