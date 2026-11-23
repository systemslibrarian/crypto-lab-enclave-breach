import { LAYOUT } from '../enclave/model';
import { h } from './dom';

const NAMES: Record<number, string> = { [LAYOUT.caller]: 'caller', [LAYOUT.loop]: 'loop', [LAYOUT.square]: 'S', [LAYOUT.multiply]: 'M', [LAYOUT.data]: 'data' };

/** A row of fault tokens: page number, and the OS's reading of it from the public layout. */
export function faultRow(faults: readonly number[], id: string, label: string): HTMLElement {
  return h(
    'ol',
    { class: 'token-row', id, 'aria-label': label },
    ...faults.map((p) => {
      const name = NAMES[p] ?? '?';
      const kind = name === 'S' ? 'tok-s' : name === 'M' ? 'tok-m' : 'tok-other';
      return h('li', { class: `token ${kind}`, 'data-page': p.toString(16) }, h('span', { class: 'tok-name' }, name), h('span', { class: 'tok-page' }, `0x${p.toString(16)}`));
    }),
  );
}

export function smRow(tokens: readonly string[], id: string, label: string): HTMLElement {
  return h('ol', { class: 'token-row compact', id, 'aria-label': label }, ...tokens.map((t) => h('li', { class: `token ${t === 'S' ? 'tok-s' : 'tok-m'}` }, h('span', { class: 'tok-name' }, t))));
}
