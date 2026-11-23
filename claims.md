# Claims and their evidence — Enclave Breach

Batch requirement 1. Every claim the page makes, how it is produced, the test that pins it, the source, and how far it can be read.

| Claim | Execution mode | Evidence (test name) | Source | Interpretation limit |
|---|---|---|---|---|
| Exponent 0b10110101 gives the trace S S M S M S S M S S M | computed | unit `exponent 0b10110101 → S S M S M S S M S S M`; claims `the default exponent 0b10110101 gives the trace…` | brief author's computation, re-derived in the tests from the rule | The left-to-right algorithm as written here |
| The OS sees page numbers: caller, data, loop, then loop ↔ square/multiply, then caller | computed (model) | unit `the fault trace is page numbers…` | Xu et al. §II-A, §III | A model of the controlled channel, not SGX |
| Every bit of 500 random 64-bit exponents is rebuilt from the trace; every result matches a reference | computed | unit `500 random 64-bit exponents…`; claims `a 64-bit exponent: the OS trace…` | Xu et al. §III (input-dependent control transfers) | Page granularity as modelled |
| The oblivious rewrite leaves the same 128-step trace for every exponent below 2^64, and is still correct | computed | unit `traces are identical across 500 seeded exponents and 0, 1, 2^64 − 1…`, `recovery … returns "no information"`; claims `the oblivious rewrite: 128 steps…` | Xu et al. §VII (rewrite so accesses do not depend on secrets) | Page-oblivious in this model, not constant-time |
| Memory isolation holds: the OS's direct read of an enclave page is refused | computed (model) | unit `the OS cannot read enclave memory…`; claims `the negative claim…` | Xu et al. §II-A | Modelled isolation |
| The OS receives page numbers and public metadata only | computed | unit `the observation has exactly program, width and faults…` | invariant 1 | — |
| Exponent 0: nothing to recover; a truncated trace leaves the tail unknown; a wider exponent is refused by the oblivious program | computed | unit `exponent 0…`, `a truncated trace…`, `an exponent wider than w is refused…`; claims `exponent 0…`, `a truncated trace…`, `an exponent wider than 64 bits…` | — | Exponents 0 and 1 give the same empty trace |
| Counting logins (Xu et al. Fig. 2): separate counter pages reveal both counts; a shared page reveals only the total | computed (model) | unit `Xu et al. §III-A, Figure 2…` (two tests); claims `Xu et al.'s login counter…` | Xu et al. §III-A, §III-B | A re-expression of the paper's example, not its code |
