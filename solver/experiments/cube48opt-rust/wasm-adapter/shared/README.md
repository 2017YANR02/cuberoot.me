# Rust shared-memory WASM

ABI 2 is separate from the retained single-thread ABI 1 and its measured Opt9
artifacts. This Node adapter supports the existing **Opt1–9** raw pruning table
formats with 1–4 real workers. The production bundle currently targets Opt8 and
uses `cube48opt-rust8.mjs`, `cube48opt-rust8-worker.mjs`,
`cube48opt-rust8.wasm`, `cube48opt8.small.bin`, and `h48prun31h8.dat`.
The filenames are a production bundle convention; the factory's `variant`
selects the existing Opt1–9 layout. Opt8 has a fixed EO8 coordinate/decoder
oracle; other variants retain their respective format and coordinate projection.

The factory accepts `{ variant, threads, wasmURL, workerURL, snapshotURL, print,
printErr }`, or `wasmBinary` / `wasmModule` / `smallTableBytes`. URLs are absolute
URL objects or strings resolved relative to the module. Callers stream the table
once into `HEAPU8` at `_get_mem_ptr()`, then **await** `init(0, threads)` and
**await** `solve_scramble(scramble, threads, 1, true)`. One request runs at a time;
the caller must serialize requests. A worker error permanently closes the pool.

There is one shared memory64 pruning table, validated once with the existing
checksum/distribution rules before publishing it as read-only to workers. Each
worker has a separate WASM instance, 64 KiB TLS region, 2 MiB stack and 64 MiB
allocator arena. This is a bounded virtual-memory reservation; the shared table
is not copied per worker. The linker initializes static data once using atomics.
The wrapper verifies that the linker's static region stays below the reserved
8 MiB control page. Each worker explicitly initializes its own TLS and stack.
The host allocator only handles allocations; coordinate calculations and pruning
lookups run in WASM without JavaScript callbacks. The trusted host must not
modify published table/snapshot bytes while the pool exists.

This adapter opts into `wasm-batch-probes`. Opt8 first reads the raw words for
the eight active queries, then decodes them before the existing ordered context
processing. A separate load helper preserves that boundary in the Rust/WASM
output. Missing queries do not read memory; checked indexing and the code-zero
block-header lookup are retained. This does not change the table format or the
default native/ABI1 path. Its performance evidence is tracked in
`../../wasm-deployment.md` and requires the server's unsampled full benchmark.

The shared `DepthSearch` kernel assigns root moves to shards at shallow depths
and assigns canonical prefixes by a stable base-18 key at deeper depths. Local
ranking changes order, never ownership. A coordinator waits for every shard to
exhaust depth d before advancing to d+1. A verified solution sets an atomic
cancel word; siblings stop at the next search iteration. The coordinator waits
for all siblings to settle before reporting the solution or resetting the word
for a subsequent request. Contexts are fixed at eight and a nonzero maxNodes is
rejected rather than silently ignored. This preserves optimality through the
depth barrier and does not multiply table memory by the worker count.

`node build.mjs` uses the pinned nightly toolchain with SIMD, atomics and bulk
memory, one Cargo job, and a 16 GiB shared memory64 maximum. It first builds a
separate small-check artifact with a zero-bound fixture oracle, verifies exact
shallow BFS distances and scalar coordinates in real 1/2/4-worker WASM, then
builds the production module **without** that fixture entry. It archives source
hashes, immutable artifacts, logs and reports under the repository's `.tmp/`.
No PDB is allocated or read by this build. `instantiateOnly:true` uses 16 MiB,
starts no workers, and does not read the snapshot or table.

**Opt10 is not supported by this WASM ABI.** Its separate native table format is
about 31 GB and this pinned wasm linker rejects a shared maximum above 16 GiB.
Opt10 native multithreading uses the same sharded search kernel independently.
Small fixtures and successful compilation do not establish large-table
performance or production acceptance; those require the guarded matching
variant/thread benchmark and deployment checks.
