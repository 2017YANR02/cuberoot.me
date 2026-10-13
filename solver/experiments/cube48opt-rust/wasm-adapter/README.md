# Rust Opt WebAssembly adapter

This experimental adapter compiles the existing Rust Opt1–9 search kernel to
**memory64 WebAssembly**. It uses the same Opt pruning-table bytes as the original
WASM. Search, coordinates, and pruning lookup execute inside this new module;
there is no JavaScript pruning callback or native solver substitution.

It is not Rust H9, does not load Nissy H tables, and does not implement Opt10.
The module supports **one solve thread only**. Multiple DFS contexts are search
interleaving within that one thread, not a thread pool. The wrapper rejects a
thread count other than one instead of silently ignoring it.

## Measured Opt9 result (2026-10-13)

Same existing Opt9 table, fixed WCA first 100 scrambles in order, one thread,
one pass per engine, no extra warmup. Both processes exited successfully; all
200 solutions passed independent replay and matched retained optimal lengths.

| Engine | Total solve time | Worker peak RSS |
| --- | ---: | ---: |
| Original Opt9 WASM | 77.185700040 s | 15,856,189,440 B |
| Rust Opt9 WASM | 191.636963913 s | 15,633,809,408 B |

This initial Rust WASM build takes **2.48 times** as long. It does not satisfy
the user's deployment condition, so production was not replaced. Native Rust
results are a different compilation target and cannot establish WASM speed.
One pass does not estimate measurement variance. Full results, raw records and
frozen source/artifacts: `.tmp/cubeopt-reverse/wca100-wasm-opt9-single/`.

## Reproduce the build

Required toolchain: `nightly-2026-10-12` with `rust-src`. Keep the current default
toolchain unchanged. The build script does not install anything.

From the repository root:

```sh
node solver/experiments/cube48opt-rust/wasm-adapter/build.mjs
```

The pinned compilation is equivalent to:

```sh
RUSTFLAGS='-C panic=abort -C target-feature=+simd128 -C link-arg=--max-memory=17179869184' \
  cargo +nightly-2026-10-12 build --locked -Zbuild-std=std,panic_abort \
  --target wasm64-unknown-unknown --release --lib \
  --manifest-path solver/experiments/cube48opt-rust/wasm-adapter/Cargo.toml \
  --target-dir solver/experiments/cube48opt-rust/wasm-adapter/target
```

The host working directory is the repository root. `simd128` permits LLVM
vectorization; the AArch64-only NEON source branch is not used. The memory ceiling
is **16 GiB** for linear memory, not a limit or guarantee for process RSS.

The script preserves the previous Cargo output before rebuilding, then freezes
the new WASM, wrapper, full Rust source snapshot, compiler/flags, source hashes,
and an allocation-free ABI smoke report under:

```text
.tmp/cubeopt-reverse/rust-wasm64-builds/<wasm-hash-prefix>-<source-hash-prefix>/
```

`build-metadata.json` and versioned artifacts are immutable. `latest.json` is only
a convenience pointer; benchmarks must freeze a specific version and copy its
metadata. Existing benchmark reports are not rewritten. Compilation and the
smoke check allocate no pruning table and perform no real cube search.

## Runtime requirements

The runtime must implement memory64, SIMD128, and the emitted WebAssembly
instructions. The local ABI smoke check passes on **Node 24.21.0 / V8 13.6**;
this is not a claim of compatibility with every Node release or browser.
`wasm64-unknown-unknown` is a Rust Tier 3 target and needs `build-std` rather than
an ordinary `rustup target add` precompiled standard library.

Opt9's pruning table occupies 15,565,455,360 bytes plus the module's heap and host
runtime. Normal wasm32's 4 GiB address space cannot hold this table. Never create
an additional whole-table Node Buffer. Large allocations and benchmarks must use
the repository research guard and its current authorization and memory limits.

## Load and call

The async default factory accepts `variant`, `wasmBinary` or `wasmURL`, and
`smallTableBytes` or `smallTableURL`. A passed binary/snapshot must be a
`Uint8Array`/Node Buffer or ArrayBuffer. A URL can be fetched by the browser or
read as a file in Node. Omitting a source looks beside the wrapper for
`cube48opt_rust_wasm.wasm` and `cube48optN.small.bin`; packaging those files is a
separate integration step.

1. Create the factory. This allocates one module-owned `Vec<u32>` for the PDB and
   initializes the small coordinate snapshot.
2. Stream the existing table into `module.HEAPU8.buffer` beginning at
   `Number(module._get_mem_ptr())`. Use a bounded view, for example 4 MiB. The
   getter always returns a view of the current memory buffer.
3. Call `module.init(0, 1)`. It verifies the complete native checksum/distribution
   and moves the PDB allocation into the Rust decoder without copying it.
4. Call `module.solve(scramble, {contexts: 8, maxDepth: 20, maxNodes: 0n,
   threads: 1})`. The result includes solution, length, cancellation/exhausted
   depth, counters, and host-monotonic seconds. Zero maxNodes means unlimited;
   the outer guard must still enforce its deadline and memory policy.

Inputs are UTF-8, at most 4096 bytes, and contain ordinary HTM move tokens. Errors
throw rather than masquerading as valid results. Finalization failure requires
a fresh instance; do not retain or write through old buffer views. Do not share
one mutable instance across workers. Complete and discard one engine's process
before loading the comparison engine.

`query(scramble)` returns the Opt coordinate index and decoded lower bound for
validation. `solve_scramble(scramble, 1, 1, true)` supplies the existing
`Solution found!:` and `Cube1 finished in N` log format, but it is not a complete
Emscripten runtime replacement: it rejects table generation, repeated solves,
and thread pools. `instantiateOnly: true` checks the ABI without allocating a
PDB and disables `_get_mem_ptr`, `init`, and real solving.

For fair measurements, use the guarded harness's same host clock around the
public call in **both** engines. Do not compare the wrapper's duration with an
unrelated upstream internal timer or native Rust timing. Loading, validation,
independent solution replay, and worker startup are separate measurements.

No server replacement or browser deployment is performed by this adapter or
build script. Correctness, single-thread performance, the production thread
configuration, and the actual deployment host must be validated separately.

References: [Rust wasm64 target](https://doc.rust-lang.org/rustc/platform-support/wasm64-unknown-unknown.html),
[Cargo build-std](https://doc.rust-lang.org/cargo/reference/unstable.html#build-std).

## First Opt9 comparison and static inspection

The frozen single-thread WCA100 pass completed with all 100 solutions from each
engine independently replayed and their lengths matched. Rust WASM took
**191.636964 s**, while the original WASM took **77.185700 s**: this Rust build
took **2.483 times as long**. Their worker peak RSS was approximately 15.634 GB
and 15.856 GB respectively. The build is therefore **not a performance upgrade
and has not replaced the server's original WASM**.

Evidence is preserved under `.tmp/cubeopt-reverse/wca100-wasm-opt9-single/`:
`report.json`, the two immutable WASM artifacts, and
`static-hotpath-audit.json`. The static audit records both binary hashes, the
WABT 1.0.42 disassembly commands, text hashes, function names/line positions,
and instruction counts. It did not compile or run either solver again.

Observed differences in those exact binaries:

| Code | Static SIMD instructions | Byte swizzles |
| --- | ---: | ---: |
| Rust `CoordTables::index64` | 0 | 0 |
| Original `step1_query` | 70 | 6 |
| Original `step4_domove` | 31 | 3 |

The Rust module does contain SIMD elsewhere (776 static SIMD instructions),
but none of its functions contains `i8x16.swizzle`. Enabling `simd128` did not
automatically vectorize the coordinate kernel. This matches the source:
`coord.rs` selects `coordinate_parts_slow` outside AArch64, and `cube.rs` uses
the scalar source operations for paired moves outside the NEON branch.

These are **static observations, not a CPU profile**. Coordinate calculation
and paired moves are the leading candidates for excess work per node, but the
audit does not establish what fraction of the measured gap they explain.
Instruction counts do not measure runtime cost; no speedup from a future SIMD
implementation is promised. Cache misses, remaining bounds checks, scheduling,
and V8 tiering have not been separately measured.

If this WASM optimization is resumed, first profile each guarded Node worker
in a separate diagnostic run with the same V8 configuration and map samples
to the frozen functions. Keep profiled timings separate from the completed
benchmark. Only after identifying the costly code should explicit WASM SIMD
coordinate/move paths be implemented and differentially checked before a new
comparison. Current research proceeds to Opt10 instead of deploying this build.
