# Native x86 SIMD — 2026-10-21

Opt1–9 now have native AVX2 and AVX-512 implementations for paired cubie moves
and padded coordinates. PDB bytes, coordinate values, search policy and WASM
artifacts are unchanged. This work does not promote a new production binary.

## Selection and build

Rust 1.89+ is required for the stable AVX-512 intrinsics. A normal native release
build contains both paths. `CUBEOPT_SIMD` accepts `auto` (default), `scalar`,
`avx2` and `avx512`. Selection is cached once per process. Explicit unsupported
modes fail; automatic mode falls back to scalar when AVX2 is unavailable.
AVX-512 requires AVX2 plus AVX512F/BW/VL, including OS register-state support.
It does not require VBMI or other extensions absent from the tested Xeon.

`auto` prefers AVX2: on the measured host its paired moves and coordinates both
beat the AVX-512 candidate. Instruction width alone is not a performance policy.
An explicit override permits comparisons on another CPU without recompilation.

For a binary transferable between x86_64 machines, override the repository's
`target-cpu=native` configuration:

```sh
RUSTFLAGS='-C target-cpu=x86-64' cargo build --release
```

The validation binary was cross-compiled on the maintainer Mac with the
`x86_64-unknown-linux-musl` standard library, baseline `target-cpu=x86-64` and
the toolchain's `rust-lld` linker, into the separate `target/x86-simd` directory.
No server toolchain installation or service change was needed.

## Implementation

- AVX2: one packed corner shuffle and a 256-bit shuffle of normal/inverse edges.
- AVX-512BW: four 128-bit lanes evaluate normal/inverse corners and edges in one
  512-bit permutation. AVX-512BW/VL mask instructions extract coordinate bitsets.
- Coordinate arithmetic shares the validated small LUTs and scalar specification.
- Cube stays 20 bytes. Edge loads cover bytes 4–20, then discard four corners;
  stores write exactly eight plus four edge bytes. No padded over-read is used.
- Runtime dispatch follows [Rust's CPU feature detection contract](https://doc.rust-lang.org/std/arch/index.html).

## Correctness and instruction evidence

Executed in an isolated temporary directory on the actual Linux x86_64 Intel
Xeon Platinum server. Processes were sequential, limited to 256 MiB address space
and 30 seconds CPU time each; no pruning table or live service state was loaded.

- Nine variants × scalar/AVX2/AVX-512: all 27 runs passed the existing 407-state
  fixture corpus and original WASM hot-coordinate references.
- 1,472,526 fast/scalar coordinate comparisons, including inverse and all 48
  symmetry frames; Opt6–9 include coordinates larger than `u32`.
- 21,978 original hot-query index comparisons and 197,802 paired move checks.
- Direct SIMD unit regression: 4,096 deterministic walk states × 18 moves for
  both kernels, including inverse products and subsequent side swaps.
- Dispatch unit checks reject unsupported modes and verify scalar fallback.
- Disassembly confirms `vpshufb` with YMM and ZMM registers and AVX-512 mask
  instructions. This is execution of explicit vector code, not merely CPU flags.
- ARM native and WASM SIMD library compilation checks pass.

## Bounded kernel measurements

The same portable release binary and deterministic 4,096-state corpus were used
for all modes. Each timed kernel performs 524,288 operations. Five rounds rotate
the backend order, use the same CPU affinity and run at reduced scheduling
priority. Values below are medians in milliseconds. The server also runs its
normal workloads; these are kernel measurements, not isolated end-to-end results.

| Variant | Backend | Paired moves | Coordinate |
| --- | --- | ---: | ---: |
| Opt8 | scalar | 19.765 | 52.801 |
| Opt8 | AVX2 | 4.150 | 9.039 |
| Opt8 | AVX-512 | 4.924 | 9.321 |
| Opt9 | scalar | 19.749 | 52.426 |
| Opt9 | AVX2 | 4.227 | 8.994 |
| Opt9 | AVX-512 | 4.971 | 9.188 |

AVX2 speeds up these kernels by about 4.7–4.8× and 5.8× versus scalar.
Do not apply these factors to whole solves: random PDB reads, search scheduling,
memory bandwidth and the chosen search features are outside this measurement.
Full same-table solver performance and production replacement remain unverified.

Local raw evidence: `.tmp/cubeopt-reverse/x86-simd-20261021-c53Ib1/` at repository
root, containing `fixtures-manifest.json`, `correctness.json`, `kernels.json`,
the initial Opt8 probe and `instruction-evidence.json`. Small fixtures are retained
there for reproduction; historic programs and benchmark reports were not replaced.
