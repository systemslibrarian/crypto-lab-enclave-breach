import { PagedMachine } from './model';

/**
 * Xu, Cui and Peinado's own first data-access example (§III-A, Figure 2): a function
 * that counts logins by gender in two global counters. Here as a model: the function
 * sits on a code page, each counter on a data page. Every increment touches the
 * counter's page, so the OS counts faults per data page.
 *
 * If both counters share one page, the page-granular OS sees only the total — the
 * difficulty the paper's §III-B works around (it does not get the offset in the page).
 */
export type Gender = 'male' | 'female';
export type CounterLayout = 'separate' | 'shared';

export const COUNT_PAGES = { code: 0x420, male: 0x601, female: 0x602 } as const;

export function countLogins(logins: readonly Gender[], layout: CounterLayout): { counts: Record<Gender, number>; faults: number[] } {
  const femalePage = layout === 'separate' ? COUNT_PAGES.female : COUNT_PAGES.male;
  const m = new PagedMachine([COUNT_PAGES.code, COUNT_PAGES.male, femalePage]);
  const counts = { male: 0, female: 0 };
  for (const g of logins) {
    m.touch(COUNT_PAGES.code);
    m.touch(g === 'male' ? COUNT_PAGES.male : femalePage);
    counts[g]++;
  }
  m.touch(COUNT_PAGES.code);
  return { counts, faults: m.faultTrace() };
}

/** The OS's count of faults on each data page. With separate pages that is the two counts; with a shared page, only the total. */
export function osCounts(faults: readonly number[]): { male: number; female: number } {
  return { male: faults.filter((p) => p === COUNT_PAGES.male).length, female: faults.filter((p) => p === COUNT_PAGES.female).length };
}
