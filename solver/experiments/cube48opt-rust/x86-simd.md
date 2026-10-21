# Native x86 SIMD — 2026-10-21

Opt1–9 now have native AVX2 and AVX-512 implementations for paired cubie moves
and padded coordinates. PDB bytes, coordinate values, search policy and WASM
artifacts are unchanged. Initial kernel validation did not deploy a binary;
the subsequent native release and its measurements are recorded below.

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
Full same-table solver measurements are recorded below; production rollout is
tracked separately in `docs/cubeopt-native-rollout.md`.

Local raw evidence: `.tmp/cubeopt-reverse/x86-simd-20261021-c53Ib1/` at repository
root, containing `fixtures-manifest.json`, `correctness.json`, `kernels.json`,
the initial Opt8 probe and `instruction-evidence.json`. Small fixtures are retained
there for reproduction; historic programs and benchmark reports were not replaced.

## Linux full solves, 2026-10-21

The production Xeon host ran the fixed WCA100 corpus with four search threads,
one resident process per engine, in WASM / AVX2 / AVX-512 order. External
request-to-response wall times exclude startup, with one pass and no warmup.

| Backend | 100 solves (seconds) | Startup (seconds) | Peak RSS (bytes) |
| --- | ---: | ---: | ---: |
| Current Rust WASM Opt8 | 120.262 | 72.874 | 8,026,701,824 |
| Native Opt8 AVX2 | 109.989 | 69.221 | 7,788,609,536 |
| Native Opt8 AVX-512 | 121.867 | 52.258 | 7,788,605,440 |

Native features: `opt8-native-search,opt8-native-quarter,opt9-native-fixed-contexts`,
baseline target `x86-64`, static musl. AVX2 reduced total solve time by 8.5%
(1.093× throughput) in this run. AVX-512 was slower and remains opt-in.
The AVX-512 startup reused the native validation receipt; the AVX2 startup
performed the first full native checksum/distribution check. Startup differences
therefore do not measure SIMD performance. This fixed-order single pass does
not quantify scheduling, cache or thermal variance on the shared server.

Raw results and resource/PID/exit evidence are retained locally under
`.tmp/cubeopt-reverse/native-service-linux-20261021/results-ready-wait/`.
Its `independent-verification.json` confirms all 300 solutions replay to solved,
all 300 lengths match the pinned historical H10 optimum, and each engine
handled all requests in one PID before exiting normally without descendants.

## Follow-up candidates: awaiting Linux A/B acceptance

The native release was deployed by workflow `39651706031`; its two-request
smoke completed on 2026-10-21 at 18:26 UTC. A subsequent read-only observation
of resident PID `1595936` found RSS **7,601,880 kB**, anonymous memory
**7,601,072 kB**, `AnonHugePages` **65,536 kB**, and swap **0 kB**. Host THP
policy was `enabled=always`, `defrag=madvise`. This is a deployed baseline
snapshot, not evidence that most of the table already uses huge pages.

Two separate non-default candidates are staged; neither has an accepted
full-table performance result:

| Feature | Hypothesis | Acceptance measurements |
| --- | --- | --- |
| `opt8-native-prefetch` | Issue an x86 read hint after computing the existing Opt8 index to overlap a later table load. | Identical results and repeated solve throughput; instruction overhead or cache pollution may outweigh overlap. |
| `opt8-native-hugepages` | Advise the reserved Opt8 allocation before its first touches, potentially reducing translation misses. | Startup time, solve throughput, RSS and actual `AnonHugePages`; successful advice alone does not prove hugepage backing. |

The hugepage branch runs only on Linux x86_64 and only for Opt8, between
`try_reserve_exact` and `resize`. Runtime base-page size and checked arithmetic
select complete pages within the requested bytes and allocated capacity. The
FFI pointer retains the Vec allocation's provenance; no uninitialized element
is read, and neither partial edge page is included. Failed advice logs and
continues normally. No global setting, HugeTLB reservation or table format
changes. The pure range test passed 688,128 combinations plus explicit edge
cases; Linux release and test executables were compiled, without loading a table.
The two bounded Linux checks subsequently passed on the server: complete-page
range arithmetic and every cell of the tiny prefetch decoder fixture. Disassembly
of the frozen prefetch candidate also contains actual `prefetcht0` instructions.
These checks load no PDB and establish neither a full-solve speedup nor acceptance.

`defrag=madvise` can spend time compacting memory at first touch of an advised
region, so more hugepage backing may still worsen startup. This tradeoff is
described in the [Linux THP documentation](https://www.kernel.org/doc/html/latest/admin-guide/mm/transhuge.html).
The range/ABI rules follow [madvise(2)](https://man7.org/linux/man-pages/man2/madvise.2.html)
and [getpagesize(2)](https://man7.org/linux/man-pages/man2/getpagesize.2.html).

Frozen local evidence lives under
`.tmp/cubeopt-reverse/native-feature-ab-20261021/`: the original four candidates
retain their `builds.json` and `source/`; hugepages has its own
`hugepages/build.json`, source and ELF. It uses the same defaults, baseline
`x86-64` target and explicit production search flags, plus only the hugepage
feature; prefetch is disabled in that candidate. Compare sequential resident
processes with alternating baseline/candidate order, the same corpus and CPU
mode, independent solution/optimal-length checks, and comparable validation
receipt state. Retain only repeatable net improvements.

## Why 96 symmetries do not directly halve the current Opt8 table

For full cube states, the 48 spatial symmetries and group inversion form an
`M × C2` action with 96 elements; all states in one orbit have the same optimal
HTM distance. This is the mathematical basis of
[Kociemba's antisymmetry construction](https://www.kociemba.org/antisymmetric.html).
It does not establish an action on an already projected coordinate: equivalent
states must still map to equivalent states, as explained in
[coordinates and symmetry](https://www.kociemba.org/math/symcord.htm).

Our existing small Opt8 coordinate inspection gives a counterexample:

| State `g` | `q(g)` | `q(g⁻¹)` |
| --- | ---: | ---: |
| `R U F` | 9087280867 | 9087280867 |
| `U2 R U F` | 9087280867 | 9108694244 |

Both states share a current cell but their inverses do not. All 48 spatial
conjugates of each state retained the respective values above, ruling out a
remaining spatial-frame distinction. Thus there is no single-valued inverse
map on these Opt8 cells. The small-only reproduction uses `CUBEOPT_VARIANT=8`
and the CLI `inspect` command with the existing `opt8-small/small-memory.bin`;
no PDB generation or loading was involved. Detailed evidence is retained in
`native-feature-ab-20261021/96-symmetry-review.md` under the local evidence root.

Algebraically, inversion sends a right coset `Hg` to the left coset `g⁻¹H`;
the current projection does not make those interchangeable. See the
[coset definition](https://www.kociemba.org/math/cosets.htm). It also exchanges
move sides: `(gm)⁻¹ = m⁻¹g⁻¹`. A new canonicalized search or table generator
therefore needs a successor-coverage proof; reusing only the old right-move
transitions is insufficient. Orbit stabilizers and ranking overhead also
prevent an automatic 2× memory or speed claim.

The existing search already queries normal and inverse lower bounds and uses
proved opposite-side half-turn invariance for NISS and cached-bound reuse.
Querying the same inverse again adds no information. These bounds do not,
however, implement a general 96-symmetry quotient or prove antisymmetric
root pruning safe with the current move masks.

A possible independent experiment is a complete corner-state bound
(`8! × 3^7 = 88,179,840` raw states), whose projection is closed under inversion.
First verify shallow exact distances, symmetry/inversion transformations and
left/right successor coverage, then measure extra rejections versus ranking
cost before considering a full auxiliary table. Corner distance is admissible
but not opposite-side half-turn invariant: solved corners have distance zero,
while applying `U2` changes that distance to one. It must initially be a
separate prune-only check, **not** a `max` merged into the `PruningOracle`
values that authorize move removal and cached-bound reuse. No such auxiliary
table or integration has been built or accepted in this work.
