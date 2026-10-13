# Sources and licenses

The combined Rust Opt1–9 / Nissy H48 H0–H11 executable is distributed under GPL-3.0-or-later.
`LICENSE-GPL-3.0` retains the nissy-core copyright and complete license.

The original Opt1–9 reconstruction comes from Chen Shuang's published
cube48opt WebAssembly artifacts. Its MIT notice remains in `LICENSE-MIT`.
The original unmodified artifact, source snapshots, table generators, and
earlier Rust executables remain preserved alongside this H48 integration.

`src/h48_coord.rs`, `src/h48_table.rs`, `src/h48_variant.rs`, and the H10 differential oracle
translate or check nissy-core's cubie conventions, symmetry transforms,
H48 coordinates and file decoding. The fixed source is
`../../vendor/nissy-core` at commit
`1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88`:

- `src/arch/{portable,neon}.h`, `src/core/{constants,transform}.h` and
  `src/solvers/h48/coordinate.h`: cubie representation, symmetries and coordinates.
- `src/solvers/h48/gendata_types_macros.h`, `gendata_h48.h` and `solve.h`: layout, per-variant bases and bounds.
- `src/solvers/h48/checkdata.h` and `distribution_h48.h`: the twelve pinned four-code distributions and cache-line metadata/padding treatment. These are raw packed-code counts, not decoded-distance distributions.
- `src/solvers/tables_types_macros.h`: serialized table headers.

The production Rust executable does not link the C solver or a WebAssembly
runtime. The C reference program is a separate validation and benchmark
process. Rust uses a read-only operating-system mapping of the unchanged
Nissy H48 data file; no main-table generator or rewriting is part of this task.
`src/h10_coord.rs` and `src/h10_table.rs` retain explicit H10-compatible facades;
`H10Solver` and `H10Query` remain aliases for the shared implementation.
The format has no usable version or cryptographic digest field: the loader
checks the pinned format, exact headers, helper data and expected distribution,
which must not be described as a SHA-256 check.

The H0–H11 generalization has passed only compilation and small-data tests so
far, with no real-table regression or performance run. H11 is code-only on this
machine: the CLI rejects it before table-path access, stat, open or mmap.
Its library representation is retained for a future separately authorized host,
not as permission to load it here. No H11 table was generated or accessed.

The historical fixed-H10 executable with SHA-256
`e8b2c919087006bdcd51b76f7bdbe13a294b538c2a69058d4593fa107099d8a0`
is the source of the recorded 1.566× benchmark; that result does not validate
the generalized executable. The 39-file pre-generalization snapshot and
accepted executable are preserved with a manifest and hashes at
`/Users/eula/Developer/cuberoot.me-backups/rust-h10-before-h0-h11-2026-10-13/`.

Repository attribution is maintained in the site's [About](https://cuberoot.me/about)
page, backed by its existing `credits_data.json` entries.
