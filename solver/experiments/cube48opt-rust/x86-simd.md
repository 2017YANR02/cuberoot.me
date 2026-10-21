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

Two separate candidates were measured after the initial native release:

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

### Repeated Linux Opt8 results (2026-10-21)

Three interleaved rounds per candidate used the formal deployed binary as
baseline, AVX2, four search threads and the same WCA100 corpus. Each pass kept
one process resident for all 100 requests. Both six-pass groups passed 600/600
independent cubing.js replays and pinned historical H10 optimal-length checks;
the wrapper restored the original service and verified readiness after each
group. All timings below exclude startup.

| Candidate | Baseline rounds (s) | Candidate rounds (s) | Paired time reductions | Decision |
| --- | --- | --- | --- | --- |
| Hugepages | 109.839 / 92.081 / 87.075 | 95.869 / 86.323 / 88.891 | 12.718% / 6.253% / −2.086% | Keep off: not consistently faster. |
| Prefetch | 103.013 / 101.240 / 94.450 | 93.414 / 81.172 / 80.559 | 9.318% / 19.822% / 14.707% | Accepted as a measured release candidate; deployment is recorded separately. |

The review threshold was at least 5% improvement in every paired round and
in the ratio of median totals, followed by tail/resource review. This is a
conservative selection rule, not a statistical confidence interval. A fixed
100-case workload repeated three times does not establish performance for
every cube state or machine.

Hugepages added 8.5–10.3 seconds to startup. The baseline's actual process-wide
`AnonHugePages` changed from 16 MiB in round one to about 2,896 MiB in subsequent
rounds; the host's existing automatic THP policy also backed the baseline.
The candidate had more huge pages in round three yet was slower. These records
do not identify the cause of the timing drift or justify a global THP change.

Prefetch's median **paired** reduction was 14.707%. The separate ratio of median
totals was 19.822% (101.240 → 81.172 seconds); these are different statistics.
Every round improved P95, P99 and maximum request latency. Using each query's
three-run median, P95 was 3.655 → 3.421 seconds and P99 5.194 → 4.203 seconds.
The baseline's hardest ten queries improved by 13.24% in their sum of medians.
No query regressed in all three paired rounds, although individual regressions
remain: query 27001, for example, was slower in two rounds and its independent
median increased from 2.322 to 2.467 seconds. This is a workload improvement,
not a guarantee that every request is faster.

Prefetch and baseline both started in about 49–52 seconds, peaked near 7,428 MiB
RSS and had closely matched 3,002–3,010 MiB process-wide `AnonHugePages`. Search
CPU ticks decreased in all three pairs by 11.48% / 14.68% / 15.63%. These process
figures neither prove table-wide THP backing nor provide hardware cache/TLB
miss counters. Remote host swap is permitted; it must not be confused with the
separately monitored Mac's no-new-swapout evidence.

Accepted prefetch executable SHA-256:
`0f6f481c5f98130d5295aaf2b073f2b642a5b8c4e271dfb60c19f42c6c9a50c0`.
It was built by workflow `39657276722` from `8719737536`, adding only
`opt8-native-prefetch` to the production search flags. Full local records:
`.tmp/cubeopt-reverse/native-feature-ab-20261021/accepted-v4/{hugepages,prefetch}/`;
independent tail review: `.tmp/cubeopt-prefetch-review-20261021/review.md`.
Combining other features requires a new measured executable; standalone gains
must not be added together.

Production release `39681945513` completed at 2026-10-21 21:56 UTC. The formal
build and deployed ELF both match the accepted SHA above exactly; the workflow
rejects a mismatch before upload or server operations. The existing table and
small snapshot hashes are unchanged. Smoke, ready/health and a live Web cloud
solve passed. Release source is `9890b860f7`.

The additional nine-pass dynamic/root-bound group used the same frozen setup
and passed another 900 independent replays and historical-length checks:

| Candidate | Baseline rounds (s) | Candidate rounds (s) | Paired time reductions | Decision |
| --- | --- | --- | --- | --- |
| Dynamic prefixes | 93.430 / 83.370 / 87.232 | 82.598 / 79.572 / 81.839 | 11.594% / 4.556% / 6.183% | Keep off: below the all-round threshold; P95 regressed. |
| Root lower bound | 93.430 / 83.370 / 87.232 | 83.327 / 98.804 / 84.981 | 10.814% / −18.513% / 2.581% | Keep off: round-two and P99 regression. |

With each query's three-run median, dynamic prefixes increased P95 from 2.979
to 3.301 seconds; the root-bound candidate increased P99 from 4.734 to 5.275
seconds. All 21 passes across the three groups exited normally with no remaining
descendants; each kept the same solver PID for its 100 requests. The final
wrapper restored production health/readiness at 21:31 UTC. See
`.tmp/cubeopt-reverse/native-feature-ab-20261021/accepted-v4/dynamic-root/`.
Only prefetch proceeds to release; no unmeasured combination is enabled.

## Production-machine profile of the selected prefetch binary

The separate diagnostic pass attached only after READY, acknowledged sampling
before request 1, and covered all 100 requests. It recorded `cpu-clock` at 49 Hz
with 4096-byte DWARF stacks, using the exact accepted ELF above. Both its baseline
and sampled pass passed independent replay and historical-length checks (200
solutions). Profiling overhead is excluded from the acceptance timings above.
Production health/readiness was restored at 21:39 UTC.

The corrected offline export has 13,628 samples, zero lost samples, no empty
stacks and no unresolved symbols. Median stack depth is 4, P90 is 5. All 13,596
records containing the search worker reach its named thread `start`; the other
32 records are not assumed to have complete roots. The 386 sampled TIDs are
accumulated across requests, whose worker threads are recreated per request,
not 386 concurrent workers. Two earlier malformed text exports were rejected
and retained; only the export was corrected, with no repeated solve/recording.

| Self share | Location |
| --- | --- |
| 73.75% | Worker containing the inlined search loop |
| 14.39% | AVX2 coordinate calculation |
| 2.14% | Coordinate dispatch/entry |
| 4.81% | `Frame::child` |
| 4.16% | AVX2 paired move |

The worker's Rust short-backtrace wrapper name does not indicate thread-creation
cost. Exact-ELF instruction annotation places 40.29% of the global sampled period
at two PCs immediately following prefetch instructions, and 6.11% around PDB
load/decode. These are sampled neighborhoods, not measured instruction latency:
software sampling skid/dependencies do not prove that prefetch stalls for 40%,
or that removing it would help. Coordinate hotspots are near corner-class
lookup and outer-complement load-to-shuffle dependencies.

This supports a future small, separately measured prefetch-policy experiment
(for example T1 versus the accepted T0 hint), followed by coordinate dependency
scheduling if generated assembly actually changes. It does not justify a table
replacement or another scheduler rewrite. No PMU cycles, cache/TLB misses, IPC
or off-CPU waiting were available, and no new speedup is claimed from the profile.

Raw `perf.data` SHA-256:
`916ebef8ff3f31ab8eee58829fb7c33abd5721efe2baa2d8a55dc9f104566608`.
Local evidence: `.tmp/cubeopt-reverse/native-feature-ab-20261021/profile-results-v4/profile-QjFH26/`
(`analysis-v3`, exact-ELF `annotations`, original results and rejected exports).
Independent interpretation: `.tmp/cubeopt-profile-review-20261021/review.md`.

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
