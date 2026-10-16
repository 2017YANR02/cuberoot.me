# Rust Opt WASM production replacement

## Scope — 2026-10-13 (maintainer local date)

The maintainer authorized replacing Aliyun's original WASM with our Rust WASM,
removing the old table after replacement, and real multithreaded support for all
table tiers. Production was verified as **original Opt8 / four solve threads**;
the earlier Opt9 single-thread result is not a production Opt8 benchmark.

No H9 generation, H11 execution, Opt10 regeneration or unrelated publication is
part of this replacement. Existing programs, raw reports and table bytes remain
recoverable. Opt8's immutable table format is identical for both implementations:
the new bundle reuses the verified bytes rather than creating a duplicate table.

## Implementation and evidence

- Native Opt1–10 and H0–H10 now have single-scramble workers with one shared oracle.
  `CUBEOPT_SEARCH_THREADS=1..16`; existing `CUBEOPT_SOLVE_THREADS` remains batch
  parallelism. Both cannot exceed one simultaneously. Finite node budgets retain
  the single-thread path; parallel search explicitly requires `MAX_NODES=0`.
  Shallow exhaustive fixtures, cancellation/panic and disjoint-prefix checks pass.
  Separate builds preserve existing native binaries; no new full-table native run.
- `wasm-adapter/shared/` provides ABI2, Opt1–9, one shared memory64 table and 1–4
  workers. Stack, allocator and TLS are private per worker. The depth barrier and
  first-solution cancellation preserve optimality. Opt10 WASM remains unsupported
  by the pinned linker's 16 GiB maximum; native Opt10 is supported separately.
- API adapter manifest, async initialization/serialized requests, strict READY
  thread verification and EPIPE recovery pass 66 bounded tests plus typecheck.
- API-only compatibility commit `6cd038374a14b4c9ef18d0617c2595617880be5e` was
  pushed. It does not itself switch the production artifact pointer.
  Deploy Core: https://github.com/2017YANR02/cuberoot.me/actions/runs/38501572230
  Deploy Core completed successfully. Server CI tests/typecheck passed; the separate Test workflow failed only its
  unrelated pre-existing Knip fixture detection (`teaching_daily_board_sql.mts`).

## Production acceptance — in progress

The local comparison was not started: another authorized Opt10 long task acquired
the shared computation lock. Its process and baseline are untouched. Acceptance
will run sequentially on Linux after disabling only optimal-solver admission and
preload and confirming the old daemon has exited. Both engines use the same Opt8
table, four threads and the fixed WCA first 100, one pass each, no warmup. Full
independent replay is performed locally from the small result files before promotion.

Current production pointer and actual configuration must be snapshotted before
the temporary disable. Failure restores the old pointer and configuration. New
and old full tables must never be resident simultaneously. Only after successful
promotion/real request acceptance may the old bundle's redundant table path be
removed; the new link retains the same verified table bytes.

No completed production replacement or measured four-thread speedup is claimed yet.

## Remote candidate prepared

- Immutable candidate `cubeopt-opt8-rust8e9f78851ee4-20261014` passed full artifact hashing and ABI probing.
- Final build `build-MEhVBN`: WASM SHA256 `8e9f78851ee46837065092e428a253bd9b7d9b729bc3c22b83d4fb275ed6bd51`. Frozen source/build metadata was also uploaded.
- Both Opt8 table paths are hard links to inode 1622040 (two links), 7,782,727,680 bytes. No second table copy was created.
- Remote kernel exposes no memory PSI metric. The runner records it as unavailable and enforces Linux MemAvailable, process-tree RSS, API admission, and time limits. Remote swap follows existing host policy.

## Remote acceptance v1 — rejected, old service restored

- Same server/Opt8 table/4 workers/WCA first100, one fresh pass each, zero warmup.
- Original: 126.296131695 s; peak RSS 7,941,787,648 B. Rust ABI2 candidate MEhVBN: 148.077852546 s; peak RSS 7,944,888,320 B (17.25% longer).
- Both processes exited normally. All 200 solutions plus the retained 100 H10 references independently replayed successfully; all optimal lengths matched. Results and full raw files: `.tmp/cubeopt-reverse/opt8-server-deploy-20261014/run-v1/`.
- Current production pointer was never promoted. Transaction `rust-opt8-20261014` rolled back configuration; original engine is enabled/configured/ready again. No old table was removed.
- Search-node totals: original 2,382,921,416; Rust 2,266,356,939. These counters are an implementation diagnostic, not proof that node work is identical.
- Follow-up candidate reuses empty context stacks to remove allocation/free calls during splitting. Original baseline will be retained, not rerun.

## Remote candidate v2 — rejected

- Frozen `build-PsTms3` only reuses the target stack during context splitting; preserved 2,530 differential states and all prior small checks.
- Rust-only WCA100 one pass, no warmup: **167.297677901 s**, peak RSS **7,939,932,160 B**. Original baseline reused exactly from run-v1 (not rerun); report explicitly marks non-fresh pairing.
- Independent replay of both 200 returned solutions and all 100 H10 reference solutions passed. Sources/raw results retained under `run-v2/`.
- No speedup demonstrated; this disproves treating allocation reuse as an established primary cause. CPU sample during v2: user95.6%, system1.1%, idle2.5%, steal0%; solver dominated process CPU. This short sample cannot exclude all environmental drift.
- No promotion. Transaction `rust-opt8-v2-20261014` rolled back successfully. A fresh read confirmed enabled/configured/ready all true with the original pointer. No old tables were removed. Next work is diagnostic profiling rather than claiming the faster candidate exists.

## Hotspot investigation — 2026-10-13

The maintainer explicitly requested continued optimization: identify the slowdown,
beat the original with four threads, then replace production. The retained original
WCA100 result remains the baseline. A separate Rust-only sampled run uses the same
100 inputs once, without warmup, and is ineligible for performance acceptance.
Each worker isolate is sampled; exact artifacts, exits and raw output are retained.
Normal candidate acceptance still requires an unsampled run and independent replay.
The original service is restored after diagnostics; no slow candidate is promoted.

- `profile-v2-1` completed 100 cases, child exit 0; all 100 Rust solutions and
  retained 100 H10 references independently replayed. Transaction
  `rust-opt8-profile-20261014` rolled back and original READY was restored.
- Four worker isolates: main search function 62,536/85,592 self samples (73.06%).
  Queue/sort/fetch together are below 1%; allocation/split are negligible.
  Function-relative PC bin +8832 contributes 23,024 samples (36.82% of the
  search function). Its peak is immediately after the inverse PDB load.
  Two further hotspots follow corner-class loads. This is sampled instruction
  attribution, not a hardware cache-miss counter or a proven speedup.
- Next candidate batches inverse and normal PDB word loads before decoding,
  preserving table bytes, bounds checks, context processing order and statistics.
  It is restricted to an explicit shared-WASM feature; native defaults remain.
- Candidate v4: frozen `build-Ifxgw4`, WASM
  `cc24da6f19f42fd90163c3ab77594c4ea085f32c98803653b61a0413b3b7a6dc`.
  Passed 7,074 independent shallow solves and 3,072 actual-WASM synthetic
  decoder comparisons. Native feature off/on agree on 96 cases, all statistics
  and prepare/probe traces (`6d17ca1f6d7bb115`). The WAT retains two calls to the
  separate eight-slot load helper, followed by decoding. The earlier unmeasured
  removal of fixture-only production branches is also included in v4.
  Its unsampled server run is recorded separately as `run-v4`; the original
  baseline is reused, never rerun for this candidate.

## V4 result and owner acceptance — 2026-10-14

- V4 completed the same WCA100 once, four workers, no warmup: **129.397526357 s**;
  peak RSS **7,943,122,944 B**. Retained original: **126.296131695 s**.
  V4 is **2.456% slower than the original**, and **12.62% less time than Rust v1**.
  This is a single candidate pass against a retained baseline, not a fresh paired
  run or a confidence interval. No speedup over the original is claimed.
- Independent replay passed all 100 V4 results, 100 retained original results and
  100 H10 reference solutions. All optimal lengths matched. Report SHA-256:
  `0b6978fe7e5807e8775331492df41a11e6c453b851d5fae3af0f7075de0edcd3`.
- V1/V2/V4 agree exactly on all 7,044 completed worker-depth segments, including
  nodes, probes and jobs. Timing improvement did not come from skipping completed
  search depths; final-depth cancellation timing accounts for total-node variation.
- The initial V4 transaction rolled back because it missed the faster-than-original
  gate. After being told the actual numbers, the owner explicitly accepted V4:
  **“够了 就这样 129不错了”**. Further optimization and performance tests stopped.
  The existing replacement authorization now applies to this exact measured V4.
- Deployment transaction `rust-opt8-v4-accepted-20261014` uses an explicit acceptance
  bound to this report, WASM hash, bundle, both elapsed times and the user message.
  Full independent verification, immutable artifact checks, four-thread smoke,
  READY checks and rollback remain mandatory. Deployment completion is recorded
  below only after the transaction succeeds.

### Production replacement completed

- Transaction `rust-opt8-v4-accepted-20261014` reached `complete`. Current bundle:
  `cubeopt-opt8-rustcc24da6f19f4-20261014`; remote manifest confirms `rust-wasm`,
  ABI2, shared table, four workers and the exact measured V4 WASM hash.
- The deployed manager's four-thread `R` smoke passed. Resident startup reached
  READY, effective `CUBEOPT_THREADS=4` was checked and PM2 configuration saved.
  Public `https://api.cuberoot.me/v1/scramble/optimal-solve/ready` returned
  `enabled=true`, `configured=true`, `ready=true` after activation.
- No additional performance pass was run after the owner's acceptance. Frozen
  source, build metadata, raw results and original rollback programs are retained.
  Research/source changes remain local; the immutable runtime artifact was
  deployed directly to Aliyun using the already deployed API compatibility layer.
- Authorized old-table cleanup completed: only the original bundle's
  `h48prun31h8.dat` directory entry was removed, after hashing and verifying that
  it and the new bundle pointed to the same inode. V4 retains the identical table
  bytes. Old WASM/wrapper/manifest remain, and the durable cleanup receipt contains
  the exact hardlink restore command required before rollback. This removes a
  redundant path and does not reclaim the shared file's disk blocks.

## Local 18-worker boundary — 2026-10-14

- The Mac Opt9 shared-WASM run `wca100-mt18-wasm-opt9` stopped with
  `Error: unreachable` before producing any case result. `rust/raw.jsonl`
  contains a ready record: the 15,565,455,360-byte table passed validation and
  all 18 workers initialized; loading took 22.647901583 seconds. The failure
  happened during the first solve, not table loading or worker startup.
- Guard retained the failure and sticky stop. Sampled peak RSS was
  15,857,188,864 bytes, minimum conservative headroom 21,452,537,856 bytes,
  Swapouts remained zero and pressure was normal. The formal queue remains
  stopped; no failed result is eligible for the comparison page.
- The old worker discarded the original WASM stack and operation/depth context.
  This information-loss bug is fixed locally: forwarded errors now preserve
  worker ID, operation, depth, original stack and arena statistics. **The actual
  first-solve trap has not been located or fixed.** No automatic retry occurred.
- Bounded diagnostics used no PDB. Frozen `build-ij8uAi/small-check.wasm`
  passed 1,800 begin-only calls (100 WCA inputs × 18 workers; no search-depth
  requests), with maximum arena use 642,436 bytes. New build `build-KGlaGt`
  passed 9,432 shallow independent solves, 81,450 scalar coordinate comparisons,
  18,432 synthetic comparisons through the production generic decoder, and
  18-worker depth 0–20 prefix preparation/sorting. Depths 17–20 each prepared
  43,254 total prefixes; peak arena use was 3,263,308 bytes. The deep-prefix
  fixture deliberately rejects queries and proves only resource/control-flow
  behavior, not admissibility or full-depth solving correctness.
- These checks did not reproduce the trap. They do not exercise the real Opt9
  PDB reads or production worker arenas above 15.58 GB. The failed frozen build,
  accepted four-worker production bundle and all stop records remain intact.
  New diagnostic build WASM SHA-256:
  `1ff8093b63c9c178c9010647fbcae4834e115137a5e2440f2e76c2badd328004`.
  It is not a verified repair or a deployment candidate.
- The simplified comparison-page commit
  `c4b32068639892424a146bde293320012cecec27` is deployed: CI, Next and Vercel
  succeeded. It displays the two verified Mac 18-thread results, Rust H7 and
  native Rust Opt9. The diagnostic changes above remain local.

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
