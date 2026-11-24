import { cryptoRng } from '../rng';
import { countLogins, osCounts, type CounterLayout, type Gender } from '../enclave/countlogin';
import { clear, control, h, note, panelIntro, select, selectWrap, verdict } from './dom';

export function renderLoginPanel(root: HTMLElement): void {
  const layoutSel = select('login-layout', [['separate', 'The two counters on different pages'], ['shared', 'Both counters on one page']], 'separate');
  const run = h('button', { class: 'btn btn-primary', type: 'button', id: 'login-run' }, 'Generate 30 logins') as HTMLButtonElement;
  const out = h('div', { class: 'output', id: 'login-out', role: 'status' });
  let logins: Gender[] = [];
  const show = (): void => {
    if (logins.length === 0) return;
    const layout = layoutSel.value as CounterLayout;
    const { counts, faults } = countLogins(logins, layout);
    const seen = osCounts(faults);
    clear(out);
    out.append(
      h('p', {}, 'Inside the enclave: ', h('strong', { 'data-claim': 'login-true-m' }, String(counts.male)), ' male and ', h('strong', { 'data-claim': 'login-true-f' }, String(counts.female)), ' female logins.'),
      h('p', {}, 'The OS counted faults on the counter pages: ', h('strong', { 'data-claim': 'login-os-m' }, String(seen.male)), ' on page 0x601 and ', h('strong', { 'data-claim': 'login-os-f' }, String(seen.female)), ' on page 0x602.'),
      layout === 'separate'
        ? verdict('alarm', 'The OS learned both counts exactly — and which login was which, in order.')
        : verdict('pass', 'Both counters share page 0x601, so the OS learns only the total. Page granularity hides which counter was touched here — the problem Xu et al. §III-B sets out to work around in real programs.'),
    );
  };
  run.addEventListener('click', () => {
    logins = Array.from({ length: 30 }, () => (cryptoRng() < 0.5 ? 'male' : 'female'));
    show();
  });
  layoutSel.addEventListener('change', show);
  root.append(
    panelIntro(
      'Xu et al.\'s own example',
      'The paper opens its design section with two tiny functions (§III-A). The second counts logins by gender in two global counters; the function and the counters sit on different pages. Every increment touches a counter page, so an OS that unmaps those pages counts the faults — and reads off how many men and women logged in, and in what order.',
    ),
    h('div', { class: 'controls' }, control('login-layout', 'Where the counters live', selectWrap(layoutSel), 'Switch layouts to replay the same logins. Generate another batch to change the inputs.')),
    h('div', { class: 'action-row spaced' }, run),
    out,
    note('info', 'This is the paper\'s Figure 2 re-expressed as a model, not its code. The paper\'s real-world attacks — on FreeType, Hunspell and libjpeg (§IV) — follow the same idea at scale, using the order of page faults to tell apart functions that share pages.'),
  );
}
