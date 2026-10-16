# Opt8 WASM local optimization

## 2026-10-15: coset page row archived, research retained

The owner requested hiding the Opt8 coset 39.7 s row from the comparison page.
This is a presentation-only archive: the candidate is marked archived in the
downloadable manifest, and its exact result remains in `current-results.json`.
Keep all research source, frozen artifacts, raw solutions, independent reports,
review/receipt records and resource-protection evidence. The official Rust
release remains 33.368675666 s; this archive does not change a solver or table.

The archived candidate took **39.667527956 s**, **18.88% more time** than the
retained release, on the same WCA100 / four workers / one pass / no warmup
protocol. Its coset certificate removed 38,233,566 half-turn mask bits, but
visited nodes decreased only **0.0086%**, from 1,717,133,808 to 1,716,985,601.
Removed mask bits are not a count of eliminated search nodes and do not by
themselves demonstrate a speedup. No instruction-level cause for the slowdown
has been established; additional checks, generated code or runtime costs remain
hypotheses, not measured conclusions. Do not promote this candidate on the
strength of its pruning counter or extrapolate these single-pass results.

Preserved local evidence, with paths relative to the repository root:

- Source snapshot and exact WASM/wrapper/worker: `.tmp/cubeopt-reverse/rust-wasm-shared-builds/build-K1O5W7/`, including `source/`, `build-metadata.json` and `small-check.json`. WASM SHA-256: `47ef75332d6b4e50e62d7265a33003617df1e061cf26e62935d795534e83c3b6`.
- Independent report: `.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/opt8-report.json`; raw solutions: `opt8/rust/results.jsonl` inside that same run directory.
- Consumed review/receipt and exit evidence: `.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/`, including `opt8-receipt.json` and `opt8-exit.json`.
- Resource record: `.tmp/cubeopt-reverse/wasm-opt8-candidate-20261015-resources.json`; the separate Opt9 loading stop remains in `.tmp/cubeopt-reverse/wasm-opt9-candidate-20261015-resources.json` and the run directory's `stop.json`.

The `wasm-coset-prune` research source and `coset-batch-four` build definition
are retained. Future AI work must inspect the frozen source/report first and
must not rerun either consumed label, overwrite old evidence or reset a stopped
scope. Existing runtime and resource rules are unchanged. No computation or
publication was performed for this archive update.

## 2026-10-15: matched original WASM baseline completed

Owner requested the original Opt8 WASM on this Mac: identical WCA100, four
search workers, one pass, no warmup. Original took **44.984614785 s**; the
retained official Rust WASM release took **33.368675666 s**, 25.82% less time
(1.348x total-time ratio). The Rust release was not rerun. Same table, machine,
Node v24.21.0 / TurboFan and timing boundary; runs occurred at different times.

All 100 solutions independently replayed and matched reference optimal lengths.
Original WASM bytes remain unchanged; only its private JS pthread mailbox
compatibility fix was applied. Guard exited 0, Swapouts stayed 48, no protection
trigger. Solver peak RSS 8,076,361,728 B; process-tree peak 8,399,142,912 B.
The first memory-preflight rejection is retained. Owner then explicitly asked
to start after freeing memory; no threshold reduction or baseline reset.

Evidence: `.tmp/cubeopt-reverse/original-opt8-local4-20261015/opt8-report.json`,
SHA-256 `f165222be3b03314630bd0f0780585418669d711dff721fbb6e4b46c8a2a79d6`.
The one-use receipt is consumed. Local comparison page updated; no commit,
push, deployment, Rust rerun, Opt9 run or solver replacement. Padded-state
experiments remain paused. Single-pass results do not establish global ranking.

## Protocol — 2026-10-14

Owner requested all optimization measurements on the local Mac first. Fixed WCA
first 100 cases in original order, four actual search workers, one pass per build,
no warmup. Deployment is conditional on a correct, faster candidate. Do not run
another server benchmark or compare local seconds directly with server seconds.

Production baseline: frozen `build-Ifxgw4`, WASM SHA-256
`cc24da6f19f42fd90163c3ab77594c4ea085f32c98803653b61a0413b3b7a6dc`.
The retained server result is 129.397526357 seconds; this is 100 cases, not 1000.
The server binary and pointer remain untouched during local experiments.

Opt8's existing 7,782,727,680-byte table is read directly from the retained
`~/.Trash/retired-opt-tables-20261013` copy. No table regeneration, restoration
of the retired inventory, or table-format change. The original manifest/checksum
and the 818,008-byte Opt8 coordinate snapshot remain mandatory.

Both runs use `guard.mts` and the narrow `opt8-local-policy.mts` review. Existing
stopped records and same-boot zero-Swapouts baseline are preserved. The prior
16-worker Opt9 WASM program failure is checked by exact evidence hashes; it is
not erased or treated as a resource reset. Only the pinned Opt8 builds and
four-worker, 100-case commands are accepted. Duplicate runs and later failures
are rejected; resource thresholds remain unchanged.

## 2026-10-15: backward-coset WASM candidate rejected

Same local Opt8 table, WCA100, four search threads, one pass and no warmup.
Candidate `coset-batch-four`, frozen `build-K1O5W7`, took 39.667527956 s
versus the retained release's 33.368675666 s. All 100 independent replays,
optimal lengths and worker depth barriers passed. Peak solver RSS was
7,986,069,504 B; guard tree peak 8,180,318,208 B, no new swap during Opt8.

The new direct coset proof really removed 38,233,566 half-turn mask bits, but
visited nodes fell only 0.0086% (1,717,133,808 to 1,716,985,601), insufficient
evidence of a useful search-work reduction. This candidate is not promoted;
the release pointer and server WASM remain unchanged. No baseline rerun.
Full results: `.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/opt8-report.json`.

The subsequent separate Opt9 candidate stopped during table loading when
system Swapouts rose from 16 to 48. It solved zero cases. The shared scope is
now stopped: do not retry either consumed label or reset the approved baseline.
See `docs/optimal-solver-benchmark.md` for the preserved guard evidence.

## Candidate: quarter equivalence + fixed contexts

For parent state g, the inverse children of quarter turns F and F' differ by a
left half turn F². Their subgroup coordinate is identical, so an inverse-bound
rejection can remove the opposite quarter-turn sibling without another probe.
Side bits and owned masks preserve NISS and parallel-prefix ownership. Half
turns are not removed by this rule. Reuses the native proof and search body;
an opt-in feature also specializes the context array to the supported 1/8 sizes.

Feature `quarter-fixed` is disabled by default. Frozen build `build-Nv4Vc5`,
WASM SHA-256 `007e6a2076d64f998ad26518cc8b2633fb55d4dbb4374db40109b9688ac1aeee`.
Actual-WASM bounded validation: 9,432 independent shallow solves; real Opt8
scalar/optimized inverse-quarter coordinate checks; shared-worker ownership,
cancellation and failure checks. Full WCA100 replay and known optimal lengths
are verified by the measurement harness before accepting performance results.

Raw run directories under `.tmp/cubeopt-reverse/`:

- `wca100-local4-opt8-baseline-20261014`
- `wca100-local4-opt8-quarter-20261014`

The initial production-binary run failed before returning its first result.
Table validation passed; RSS 8,136,622,080 bytes, normal pressure, zero Swapouts.
No result was overwritten or counted as a timing sample.

### Local runtime cause and reviewed continuation

Sparse, no-PDB diagnostics reproduced a scalar/SIMD coordinate disagreement
at 4 GiB and 7 GiB addresses under this Mac's Node v24.21.0 default/Liftoff
compiler. The same WASM, snapshot and addresses passed under `--no-liftoff`.
This implicates the local WASM compiler path; it does not establish an upstream
engine bug's exact instruction or imply that thread count caused the trap.
`verify-high-address.mjs` checks all 100 inputs at three address ranges (300
checks, approximately 62 MB peak RSS), without loading a PDB or solving a batch.

Both comparison processes and their workers therefore use `--no-liftoff`.
The failed zero-case run's exact resource record is bound into the new reviews;
the original resource baseline and failed output remain unchanged. No extra
solve warmup or repeated measured pass was introduced.

| Local Mac, Opt8 / 4 workers / WCA100 / one pass | Solve seconds | Peak solver RSS | Verified |
| --- | ---: | ---: | ---: |
| Retained production V4, `baseline-turbofan` | 37.794426789 | 7,966,326,784 B | 100/100 |
| Quarter + fixed contexts, `quarter-turbofan` | 32.324482752 | 7,965,261,824 B | 100/100 |
| Four-worker release cap, `release4-turbofan` | 33.368675666 | 7,965,376,512 B | 100/100 |

The candidate reduced total solve time by 14.47% on this pass and searched
1,716,882,368 nodes versus 2,287,188,986 (24.94% fewer). Neither result is a
server measurement. Single-pass noise is not estimated. Both builds, raw
solutions, resource observations and independently verified reports are frozen.

The production ABI requires a four-worker capability cap. A separate
`quarter-fixed-four` build uses the same search code with `production-four`,
and receives its own bounded checks and local single-pass measurement before
being eligible to replace the server artifact. No server performance rerun.

Earlier guard-launch parse/initialization failures did not start a solver or
consume a benchmark receipt; their stderr logs remain available. The guard and
WASM-harness policy tests passed (34 tests, no PDB allocation).

Four-worker production build: `build-FcRcSF`, WASM SHA-256
`b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6`.
7,074 bounded WASM solves and 300 sparse high-address coordinate checks passed.
Its own single local WCA100 pass reduced time by **11.71%** versus retained V4,
with 100/100 exact-length and independent replay verification. The 32.324 s
research-build result is not substituted for this exact release binary.

Artifact-only deployment evidence is retained in
`.tmp/cubeopt-reverse/opt8-local-release-20261014/`. The transaction validates both
local reports against the exact old/new bundle file hashes, same corpus/table,
same local runtime and compiler, successful process exit and resource guard.
Table bytes are reused by hardlink; no new table or server benchmark. Publication
completion must be checked separately from staging.

## Deployment completed — local-qualified quarter candidate

Transaction `rust-opt8-local-quarter-20261014` reached `complete`. Fresh remote
readback confirmed `enabled/configured/ready=true` and bundle
`cubeopt-opt8-rustb600c699ab91-20261014`, SHA-256
`b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6`.
The four-thread smoke passed; PM2 state was saved. V4 remains available for
rollback, and both bundle table paths reference the same inode. No server
performance benchmark, table regeneration, Git commit or push was performed.
Local exact release: 33.368675666 s versus V4 37.794426789 s, WCA100/4 workers/
one pass/no warmup, both with --no-liftoff; 100/100 independently verified.
Server speed improvement has not been measured or inferred from local seconds.
The release selection is recorded in `opt8-wasm-release.json`; all reports and
transaction/verification evidence are under `.tmp/cubeopt-reverse/opt8-local-release-20261014/`.

## Obsolete server table links removed — 2026-10-14

At the maintainer's request, removed only h48prun31h8.dat links from the
retired rust8e9f78851ee4, rustcc24da6f19f4 and rustd884224c266c Opt8 bundles.
The active rustb600c699ab91 bundle retains the 7,782,727,680-byte table.
All four paths were the same device/inode; link count decreased from four to
one without changing table size or modification time. This releases no table
data blocks. Old programs and small runtime snapshots remain archived; rollback
now requires relinking the retained table into the selected old bundle first.
Current pointer and API health/solver readiness passed before and after cleanup.
The active TABLES inventory and sizes are unchanged. No benchmark was run.
Server receipt: /root/core-api/artifacts/opt8-local-release-20261014/obsolete-table-links-cleanup.json.
