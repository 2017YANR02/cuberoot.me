# Full egg h8 Timer candidate

The adapter builds against unchanged upstream commit
`947c20d93564f150aad9c292486ab730a329b86c`. Copy `main.rs` to the
upstream checkout's `src/bin/cuberoot-egg.rs`; its existing Cargo manifest and
lockfile supply the dependencies. `build_egg_solver.yml` builds static Linux
x86-64-v3 executables and records their provenance. This does not deploy them.

`cuberoot-egg serve TABLE THREADS` implements Timer's existing TSV protocol:
`READY<TAB>threads`, then `id<TAB>scramble` requests and
`id<TAB>length<TAB>solution` replies. One request uses all workers. The table,
process and OS threads persist between requests; a new upstream `Pool` owns
each request, including its search buffers. Idle threads sleep on channels.
Search uses the unchanged upstream cooperative scheduler, SIMD and default
40 lanes per worker. No tuning file or candidate-specific parameter sweep.

`cuberoot-egg generate TABLE THREADS` is a separately authorized, Linux-only
operational command: generate h8 in anonymous RAM, then write a new file.
The SHA-256 receipt is computed during that write, without a second full-table
scan. The 4096-byte upstream trailer deliberately omits optional checksums and
distribution. Existing CubeRoot Opt8 tables are incompatible with egg.

Generation and benchmarking on the 16 GB Alibaba host require the existing
Opt8 daemon to be stopped first, a single resident table, resource limits and
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

Result: egg **79.503483 s**, existing Opt8 **72.743526 s**; all 200 solutions
and optimal lengths verified. The performance gate failed; Timer continues
to use Opt8. The unpromoted API integration draft was archived locally, not
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
