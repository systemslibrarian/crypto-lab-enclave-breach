# Enclave Breach

**Controlled-channel attack · page-fault traces · data-oblivious code**

Browser-based enclave side channels — a modelled enclave running secret-dependent code, the page-fault trace an untrusted operating system sees, and the secret rebuilt from that trace alone side by side with a data-oblivious rewrite that leaves the same trace for every secret.

## What It Is

Xu, Cui and Peinado ("Controlled-Channel Attacks: Deterministic Side Channels for Untrusted Operating Systems", IEEE S&P 2015) showed that a shielded application whose memory the operating system cannot read still leaks through **which pages** it touches: the OS controls the page tables, unmaps pages, and learns the page number of every fault — not the offset within the page (§II-A, §III).

This lab models that setting. An enclave program computes **modular exponentiation with a secret exponent** by left-to-right square-and-multiply, with `square()` and `multiply()` on different code pages. The **OS module** receives only the fault page numbers and public metadata (which program is running, and its width if it has one). The **attack module** rebuilds the exponent from that alone. A **data-oblivious rewrite** — fixed width 64, always square, always multiply, select the result by arithmetic mask — leaves the same 128-step trace for every exponent. A second exhibit re-expresses the paper's own login-counting example (§III-A, Figure 2).

What is real: BigInt modular exponentiation, checked against a reference by a different algorithm, and every trace on the page. What is modelled: the enclave, its pages and the OS — **this is not Intel SGX**. **Not production software — a teaching demo.**

### Exact model

- Public page layout: caller 0x40f, loop 0x410, square 0x411, multiply 0x412, data 0x500.
- The OS keeps only the most recently faulting page mapped, so every change of page is a fault; the observation is the list of fault page numbers.
- Leaky schedule: skip the leading 1 bit; for every remaining bit, square, then multiply if the bit is 1. Exponents 0 and 1 run no square or multiply.
- Oblivious schedule (w = 64): for each of the 64 positions from the top, square, multiply, then `acc = t·b + acc·(1 − b)`. Exponents of 2^64 and above are refused.

## Exhibits

1. **What an enclave hides — and what it doesn't.**
2. **The enclave program** — the code and its pages; run it on any exponent; result checked against a reference.
3. **The OS view** — the fault trace as page tokens, and the square/multiply row the OS reads off from the public layout.
4. **Recover the exponent** — the rebuilt bits beside the true bits; a truncated trace; the fixture.
5. **Oblivious rewrite** — 128 identical steps for every exponent; recovery returns "no information".
6. **Xu et al.'s own example** — counting logins by gender from data-page faults, with the counters on separate pages or on one.
7. **Scope & sources.**

## When to Use It

- To see why encrypting and isolating memory is not enough when access patterns depend on secrets.
- To see what a data-oblivious rewrite guarantees — and what it does not.
- **Do NOT** read the rewrite as constant-time code: it is page-oblivious in this model only.
- **Do NOT** draw conclusions about real SGX hardware or any product from this model.

## Live Demo

https://systemslibrarian.github.io/crypto-lab-enclave-breach/

Run modular exponentiation inside a modelled enclave, read its exponent off the page-fault trace, and rewrite it so every exponent leaves the same trace.

## What Can Go Wrong

A trusted enclave hides memory contents from the operating system, but not which pages it touches. When code takes secret-dependent branches or lookups, the OS can read the secret from the order of page faults — no bug in the encryption needed.

## Real-World Usage

- Xu, Cui and Peinado (IEEE S&P 2015) demonstrated controlled-channel attacks on FreeType, Hunspell and libjpeg running under shielding systems (§IV), and note that Intel SGX already withholds the low 12 bits of fault addresses from the OS.
- T-SGX (Shih, Lee, Kim, Peinado, NDSS 2017) runs enclave code inside Intel TSX transactions, whose aborts do not tell the OS that a page fault occurred.
- ZeroTrace (Sasy, Gorbunov, Fletcher, NDSS 2018) builds oblivious memory primitives on Intel SGX.

## How to Run Locally

```bash
npm ci
npm run dev          # http://localhost:5173/crypto-lab-enclave-breach/
npm test             # unit tests and KATs (Vitest)
npm run test:e2e:all # accessibility gate + claims suite (Playwright, builds first)
npm run test:mutations
```

## Related Demos

- [Attestation Gate](https://systemslibrarian.github.io/crypto-lab-attestation-gate/) — proving what runs in an enclave.
- [ORAM Vault](https://systemslibrarian.github.io/crypto-lab-oram-vault/) — oblivious memory for secret-dependent data access.
- [Timing Oracle](https://systemslibrarian.github.io/crypto-lab-timing-oracle/), [Power Trace](https://systemslibrarian.github.io/crypto-lab-power-trace/), [Cold Boot](https://systemslibrarian.github.io/crypto-lab-cold-boot/) — other side channels.

## Build & Verify

- **Unit tests (Vitest): 17 tests**, including:
  - A. Trace KAT: exponent 0b10110101 → `SSMSMSSMSSM`, also derived in the test from the brief's rule; the full page sequence for 0b101.
  - B. 500 random 64-bit exponents: every bit rebuilt from the trace, and every result equal to a right-to-left reference.
  - C. The oblivious rewrite (w = 64): identical traces across 500 seeded exponents and 0, 1 and 2^64 − 1; 128 steps; results correct; recovery returns "no information".
  - E. Fail-closed: exponent 0 (empty trace, nothing to recover; the oblivious run still 128 steps), a truncated trace (unknown tail), an exponent wider than 64 bits refused, the OS's direct read of every enclave page refused.
  - Invariant 1: the observation has exactly `program`, `width` and `faults`, and no exponent, result or branch label anywhere in it.
  - Xu et al.'s Figure 2: separate counter pages reveal both counts; a shared page reveals only the total.
- **Claims suite (Playwright): 9 tests** — the trace KAT on the page, a 64-bit exponent rebuilt, the result recomputed with BigInt in the test, the negative claim in its fixture (§4.1d), truncation, exponent 0, the oblivious rewrite, a refused wide exponent, and the login counter.
- **Maintenance controls: 12 tests** on the workflow, pinning and provenance, run before every build.
- **Mutation ledger: 11 of 11 killed** — the brief's four (multiply on square's page; the oblivious step branching on the bit; the observer given the exponent; recovery reading right-to-left), the two §4.1d bites, a truncated trace decoded as complete, exponent 0 mishandled, the width check loosened, page-granular counting made byte-granular, and the accessibility gate. Run by `scripts/mutate.mjs`; its record is `mutations/observed.json`.
- **Accessibility gate:** axe-core WCAG 2.1 A/AA plus arithmetic contrast, non-text contrast, reflow at 380px, scroll-region and focus oracles over every driven state at desktop and phone width. Zero violations.

## Claim-to-evidence table

The full table is in [claims.md](claims.md).

## Negative claim

> The enclave's memory was never read, and its arithmetic is correct. The exponent leaked anyway, through which pages it used — and the fix is page-oblivious in this model, not constant-time.

Evidence fixture (Recover the exponent tab): memory isolation check passes, the result is correct, the exponent rebuilt from page numbers equals the secret — **MEMORY SEALED — AND THE KEY READ FROM ITS FOOTSTEPS**.

## Notes on the brief

- **Mutation D2** ("oblivious select uses a branch") is built as a branch around the multiply, which changes the page trace and is caught. A branch confined to the select itself, on one page, would *survive* in this model — the page observer cannot see it. That is the model's limit, stated on the page, not a gap in the tests.
- **Exhibit 6** reproduces Xu et al.'s own example from §III-A (Figure 2), re-expressed as a model; their FreeType, Hunspell and libjpeg attacks (§IV) are named, not rebuilt.

## Performance

Every run is a few hundred BigInt operations; everything runs on the main thread in milliseconds.

## Non-goals

Real SGX; cache attacks and transient execution (named, not built; a cache-line model is an extension point); constant-time code; attestation (see Attestation Gate); T-SGX and ZeroTrace (described, not modelled).

## Sources

- Y. Xu, W. Cui, M. Peinado, "Controlled-Channel Attacks: Deterministic Side Channels for Untrusted Operating Systems", IEEE S&P 2015 — https://doi.org/10.1109/SP.2015.45
- V. Costan, S. Devadas, "Intel SGX Explained", IACR ePrint 2016/086 — https://eprint.iacr.org/2016/086
- M.-W. Shih, S. Lee, T. Kim, M. Peinado, "T-SGX: Eradicating Controlled-Channel Attacks Against Enclave Programs", NDSS 2017 — https://doi.org/10.14722/ndss.2017.23193
- S. Sasy, S. Gorbunov, C. W. Fletcher, "ZeroTrace: Oblivious Memory Primitives from Intel SGX", NDSS 2018 — https://doi.org/10.14722/ndss.2018.23239

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
