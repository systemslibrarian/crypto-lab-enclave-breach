/**
 * A MODEL of a shielded execution platform — not Intel SGX. Xu, Cui and Peinado (IEEE
 * S&P 2015, §II-A, §III) describe the setting: the enclave's memory cannot be read by
 * the operating system, but the OS manages the page tables. It can unmap pages, and
 * each access to an unmapped page faults to the OS, which learns the page number —
 * not the 12-bit offset within the page.
 *
 * The controlled channel modelled here is the paper's basic one: the OS keeps only
 * the most recently faulting page mapped, so every change of page faults and the OS
 * sees the sequence of pages the enclave moves between.
 */

// [extension] point — cache-line granularity: a model in which the observer sees
// 64-byte lines instead of 4 KB pages (cache attacks). Not built here.

/** The program's page layout. Public: the OS loaded the binary, so it knows which function sits on which page. */
export const LAYOUT = {
  caller: 0x40f,
  loop: 0x410,
  square: 0x411,
  multiply: 0x412,
  data: 0x500,
} as const;

export class MemoryIsolationError extends Error {}

export class PagedMachine {
  readonly #accesses: number[] = [];
  readonly #enclavePages: ReadonlySet<number>;

  constructor(enclavePages: Iterable<number> = Object.values(LAYOUT)) {
    this.#enclavePages = new Set(enclavePages);
  }

  /** The enclave touches a page (code it runs or data it reads). */
  touch(page: number): void {
    this.#accesses.push(page);
  }

  /**
   * The fault sequence the OS observes: every change of page. Page numbers only —
   * nothing about what the enclave computed or why it went there.
   */
  faultTrace(): number[] {
    const out: number[] = [];
    for (const p of this.#accesses) if (out[out.length - 1] !== p) out.push(p);
    return out;
  }

  /**
   * The OS reads a page directly. Its own pages it may read (they hold nothing of the
   * enclave's, so this model returns 0); an enclave page is refused.
   */
  osRead(page: number): number {
    if (this.#enclavePages.has(page)) throw new MemoryIsolationError(`page 0x${page.toString(16)} belongs to the enclave: read refused`);
    return 0;
  }
}
