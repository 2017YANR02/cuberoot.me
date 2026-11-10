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
