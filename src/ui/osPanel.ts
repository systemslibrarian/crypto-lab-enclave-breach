import { LAYOUT } from '../enclave/model';
import { tokens } from '../os/observer';
import { clear, h, note, panelIntro } from './dom';
import { store } from './store';
import { faultRow, smRow } from './tokens';

export function renderOsPanel(root: HTMLElement): void {
  const out = h('div', { class: 'output', id: 'os-out' });
  const show = (): void => {
    const obs = store.run.observation;
    clear(out);
    out.append(
      h('p', {}, h('strong', { 'data-claim': 'os-faults' }, String(obs.faults.length)), ' page faults, in order. Each shows the page number the OS learned and — from the public layout of the program — which routine lives there:'),
      faultRow(obs.faults, 'os-faults', 'Page faults, in order'),
      h('p', {}, 'Keeping only the square and multiply pages:'),
      smRow(tokens(obs), 'os-sm', 'The square and multiply pages, in order'),
      h('p', { class: 'help', 'data-claim': 'os-sm-text' }, tokens(obs).join('') || '(none)'),
    );
  };
  store.onChange(show);
  root.append(
    panelIntro(
      'The OS view',
      `The malicious OS unmaps the enclave's pages. Whenever the enclave moves to an unmapped page, the processor faults and the OS learns the page number — never the contents, never the exact address within the page. The OS maps that one page, unmaps the rest, and lets the enclave continue. This is Xu, Cui and Peinado's controlled channel (§III).`,
      `It knows the program's layout because it loaded the binary: page 0x${LAYOUT.square.toString(16)} is square(), page 0x${LAYOUT.multiply.toString(16)} is multiply().`,
    ),
    out,
    note('info', 'Everything on this tab comes from the observation object the OS receives: page numbers, plus which program is running. A test checks that no exponent, result or branch label is in it.'),
  );
  show();
}
