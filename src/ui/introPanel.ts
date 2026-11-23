import { h, note, panelIntro } from './dom';

export function renderIntroPanel(root: HTMLElement): void {
  root.append(
    panelIntro(
      'What an enclave hides — and what it doesn\'t',
      'A trusted enclave is a walled-off region of a program that even the computer\'s own operating system cannot read. Its memory is encrypted and locked away; the OS is treated as an enemy. Cloud providers use enclaves so that customers can run secrets on machines they do not control.',
      'But the operating system still does the enclave\'s housekeeping. It decides which pages of memory are mapped, and when the enclave touches a page that is not mapped, the processor stops and asks the OS to fix it — telling the OS which page. Xu, Cui and Peinado showed in 2015 that an OS can unmap pages on purpose and read the enclave\'s secrets from the order of those requests. No encryption is broken; the secret leaks through where the program goes.',
    ),
    h('h3', {}, 'What is on this page'),
    h(
      'ul',
      { class: 'plain-list' },
      h('li', {}, h('strong', {}, 'The enclave program'), ' — modular exponentiation with a secret exponent, the core of RSA and Diffie–Hellman, written the textbook way.'),
      h('li', {}, h('strong', {}, 'The OS view'), ' — nothing but the page numbers of the faults.'),
      h('li', {}, h('strong', {}, 'Recovery'), ' — the exponent rebuilt from those page numbers alone.'),
      h('li', {}, h('strong', {}, 'The oblivious rewrite'), ' — the same computation with a trace that is identical for every exponent.'),
      h('li', {}, h('strong', {}, 'Xu et al.\'s own example'), ' — counting logins by gender from data-page faults.'),
    ),
    note('caveat', 'Not production software, and not real SGX: the enclave, its pages and the OS are a model in your browser, following the threat model of Xu, Cui and Peinado. The arithmetic is real BigInt modular exponentiation, checked against a reference.'),
  );
}
