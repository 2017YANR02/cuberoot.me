# Full egg h8 Timer candidate

The adapter builds against pinned upstream commit
`947c20d93564f150aad9c292486ab730a329b86c`. Copy `main.rs` to the
upstream checkout's `src/bin/cuberoot-egg.rs`; its existing Cargo manifest and
lockfile supply the dependencies. `build_egg_solver.yml` applies the reviewed
`patches/linux-table-prefetch-t0.patch` and builds static Linux skylake-avx512
executables, recording the exact patch and compiler. CI tests the patched source
with x86-64-v3; target binaries are also tested on the actual ECS CPU. CI does
not deploy or replace the exact measured binary.

`cuberoot-egg serve TABLE THREADS` implements Timer's existing TSV protocol:
`READY<TAB>threads`, then `id<TAB>scramble` requests and
`id<TAB>length<TAB>solution` replies. One request uses all workers. The table,
process and OS threads persist between requests; a new upstream `Pool` owns
each request, including its search buffers. Idle threads sleep on channels.
Search uses the upstream cooperative scheduler and SIMD, with the ECS-accepted
24 lanes per worker. This is Timer's h8 setting, separate from upstream CLI
defaults and the Mac h11 configuration. No tuning file is loaded.

`cuberoot-egg generate TABLE THREADS` is a separately authorized, Linux-only
operational command: generate h8 in anonymous RAM, then write a new file.
The SHA-256 receipt is computed during that write, without a second full-table
scan. The 4096-byte upstream trailer deliberately omits optional checksums and
distribution. Existing CubeRoot Opt8 tables are incompatible with egg.

Generation and benchmarking on the 16 GB Alibaba host require the existing
production solver to be stopped first, a single resident table, resource limits and
an exit trap restoring production. Never start large calculations in CI.
The release gate is documented in `docs/timer-optimal-egg-tracker.md`.

Local/CI adapter tests use only a roughly 30 MB h0 table. They exercise multiple
requests, invalid syntax, solved states and known shallow optimal lengths.
Production acceptance additionally requires independent cubing.js replay and
agreement with historical optimal lengths for every measured case.

## Completed Alibaba run

The user reduced the original 300-case plan to one new egg pass over WCA
cases 1–100, reusing the independently verified Nov 9 Opt8 baseline. The
interrupted 143-case baseline extension is retained but excluded. No egg
parameter tuning, second group or baseline rerun followed that change.

`maintenance.sh TASK benchmark100` runs `benchmark.mjs` with `plan100.json`
and `cases100.json`, retaining evidence under `TASK/egg100`. It requires the
fixed binaries, generated table receipt and `baseline-reused` evidence.
`verify.mjs TASK` independently replays both sets of solutions and evaluates
the frozen performance gates; it does not load a pruning table or run a solver.
The helper reuses the existing native-service benchmark's guards and protocol.

Historical result: egg **79.503483 s**, existing Opt8 **72.743526 s**; all 200 solutions
and optimal lengths verified. The performance gate failed; Timer then retained
Opt8. The unpromoted API integration draft was archived locally, not
deployed. Table and complete raw evidence remain at
`/root/egg-h8-20261109/` and the matching local `.local-data` directory.
The comparison page's `recent-results.json` publishes the exact timings,
measurement conditions and evidence hashes, including the earlier Mac tests.

## Follow-up h8 diagnosis

The user's later request authorized a separate local comparison and investigation
of the upstream 3.9× claim. The original acceptance pass above remains unchanged.
`cli-benchmark.mjs` and the `cli100` maintenance phase exercise upstream's original
CLI at concurrency 1, four threads and default lanes; `verify-diagnosis.mjs`
independently replays its small result files without opening a pruning table.

On the M5 Max, WCA cases 1–100 took **22.202973 s** in native Opt8,
**6.485724 s** in the original egg CLI and **6.446153 s** in the egg adapter:
**3.42× / 3.44×** speed, with all 300 solutions and optimal lengths verified.
The local preparation and benchmark drivers are single-use and bound to frozen
plans by `mac-h8-policy.mts` and the shared canonical guard. A consumed plan or
runtime stop cannot be restarted; historical parser-failure evidence is retained.
`derive-h8.rs` invokes unchanged upstream collapse on the existing h10 table;
it never opens h11. The two generated h8 tables remain in persistent local data.

On Alibaba Cloud, the original AVX2 CLI took **81.381066 s**. A fixed
`skylake-avx512` cross build, tested on the actual supported CPU, took
**76.110201 s**. Both returned 100 correct, optimal-length solutions, but neither
beat the reused Opt8 baseline. No candidate was promoted. The Mac / cloud node
counts differ by less than 1%, so the large platform discrepancy concerns the
cost of executing that search, not an order-of-magnitude increase in searched
nodes. A detailed CPU/cache/SMT attribution has not been measured.

Evidence is under `.local-data/egg-h8-mac-20261109/`, the existing Alibaba
directory's `cli100/`, and `.local-data/egg-h8-skylake-20261109/`. Timings exclude
loading; CLI uses whole-batch wall time while both services sum sequential
request/reply times. The local loader-receipt fallback and the AVX-512 build
receipt's corrected compiler-host field are explicitly retained alongside raw
evidence. See `docs/egg-solver-performance-analysis.md` and the task tracker.

## Intel cloud diagnosis and accepted T0 candidate

On Nov 11 the user authorized profiling and optimization. Software CPU samples
pointed to table accesses. `patch-prefetch.mjs` changes exactly six decoded NTA
hint bytes in the pinned AVX-512 binary, keeping all code placement unchanged.
This diagnostic-only binary reduced instrumented WCA100 time from 74.275352 s
to 39.717867 s; both runs had identical 2,942,304,256-byte AnonHugePages coverage.

The source patch only replaces NTA with T0 in x86 `read_once`. The source-built
binary (SHA256 `d6bcfcf0eccbb690e95edfc4f12d2211f1df556dc79f2850e25a6b5b757d5bba`)
passed actual-host h0 tests and uninstrumented paired acceptance: **36.391685 s**
versus Opt8 **72.907062 s**, 2.0034×. All 200 answers were independently replayed
with matching historical optimal lengths; CPU, P50/P95/P99 and idle gates passed.
The original failed measurements remain unchanged above.

`maintenance.sh TASK diagnose` runs an exclusive, frozen `linux-diagnosis.mjs`
plan. `profile-session.mjs` optionally enables `perf cpu-clock:u` only after
READY, bounds output and disables it before shutdown. `verify-linux.mjs TASK`
replays raw results and separates instrumented diagnosis from acceptance.
It refuses to apply production gates to instrumented results.

After the API integration is deployed, `deploy.sh ACCEPTED_TASK REPOSITORY_SHA [CANDIDATE_LABEL]`
uses the API's `prepare-egg.mjs` to publish only the measured source binary and
unchanged table. It retains both release locks, admission shutdown, single-table
preflight, atomic pointer promotion, the real manager smoke, and rollback.
The artifact loader checks the skylake-avx512 CPU flags before execution. The
existing table is hard-linked with its generation-time digest lineage, not
copied or rescanned. The previous working egg bundle remains available for rollback;
the old Opt8 table was explicitly retired by the user.
The production status and deployment receipts are tracked in
`docs/timer-optimal-egg-tracker.md`.

The subsequent Nov 11 ECS experiment tested 100 cases per candidate, once with
no warmup. Current T0/40 lanes took 40.339816 s; prefault, T1 and 24 lanes took
40.578671, 38.888326 and 35.217528 s. Only 24 lanes passed every frozen gate.
AVX2 alone and AVX2/24 lanes took 37.315290 and 37.154508 s and failed the
minimum 10% reduction gate. All 600 answers independently replayed and matched
historical optimal lengths. The 24-lane result is 12.70% less time than the new
baseline, but only 3.23% less than the earlier 36.391685 s measurement; do not
claim a stable 14.5% gain or a 3x improvement over Opt8.

Follow-up plans use `baselineLabel`, optionally a hash-pinned
`baselineReference`, and one independently checked verdict per candidate.
Publication selects that exact candidate label, binary and unchanged table;
rejected siblings and altered evidence cannot qualify. Evidence directories:
`.local-data/egg-h8-followup-20261111/` and `.local-data/egg-h8-isa-20261111/`.
