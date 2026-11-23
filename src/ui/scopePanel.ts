import { h, panelIntro } from './dom';

const link = (href: string, text: string): HTMLElement => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

export function renderScopePanel(root: HTMLElement): void {
  root.append(
    panelIntro('Scope & sources', 'What this lab does not do, and where each piece comes from.'),
    h('h3', {}, 'Not covered'),
    h(
      'ul',
      { class: 'plain-list' },
      h('li', {}, 'Real SGX: the enclave and the OS are a model. Intel SGX hides the low 12 bits of a fault address, as this model does (Xu et al. §III).'),
      h('li', {}, 'Cache attacks and transient-execution (speculative) attacks: named, not built. A cache-line model is an extension point.'),
      h('li', {}, 'Constant-time code: the rewrite is page-oblivious only.'),
      h('li', {}, 'Remote attestation — see Attestation Gate.'),
      h('li', {}, 'Defences at the platform level: T-SGX (Shih, Lee, Kim, Peinado, NDSS 2017) runs enclave code in TSX transactions, which abort without telling the OS that a page fault occurred; ZeroTrace (Sasy, Gorbunov, Fletcher, NDSS 2018) builds oblivious memory primitives on SGX. Neither is modelled here.'),
    ),
    h('h3', {}, 'Sources'),
    h(
      'ul',
      { class: 'plain-list sources' },
      h('li', {}, 'Y. Xu, W. Cui, M. Peinado, "Controlled-Channel Attacks: Deterministic Side Channels for Untrusted Operating Systems", IEEE S&P 2015 — §II-A, §III, §VII. ', link('https://doi.org/10.1109/SP.2015.45', 'doi:10.1109/SP.2015.45')),
      h('li', {}, 'V. Costan, S. Devadas, "Intel SGX Explained", IACR ePrint 2016/086. ', link('https://eprint.iacr.org/2016/086', 'eprint.iacr.org/2016/086')),
      h('li', {}, 'M.-W. Shih, S. Lee, T. Kim, M. Peinado, "T-SGX: Eradicating Controlled-Channel Attacks Against Enclave Programs", NDSS 2017. ', link('https://doi.org/10.14722/ndss.2017.23193', 'doi:10.14722/ndss.2017.23193')),
      h('li', {}, 'S. Sasy, S. Gorbunov, C. W. Fletcher, "ZeroTrace: Oblivious Memory Primitives from Intel SGX", NDSS 2018. ', link('https://doi.org/10.14722/ndss.2018.23239', 'doi:10.14722/ndss.2018.23239')),
    ),
  );
}
