# Native Opt8 service release

First deploy the API version that supports `engine: rust-native`. Then run
**Deploy CubeOpt Native** on `main`; it is a manual workflow so a source push
does not replace the selected production engine before its full-solve benchmark.

The workflow builds a static Linux x86-64 binary using Rust 1.98.1 and
`opt8-native-search,opt8-native-quarter,opt9-native-fixed-contexts,opt8-native-prefetch`. The CPU
baseline is explicitly `x86-64`; runtime SIMD detection selects the supported
backend. Its `build.json` records the source commit, flags and binary SHA-256.
Builds never load or generate tables.

When publishing a measured optimization, supply the accepted executable's
SHA-256 as the workflow's `expected_binary_sha256` input. A different build
fails before upload or any server operation; inspect that difference before
changing the pin. The same check is available to the local builder through
`CUBEOPT_EXPECTED_BINARY_SHA256`.

The daemon keeps one table resident across requests. `CUBEOPT_THREADS` controls
single-cube search threads; the native batch worker count is fixed to one.
`CUBEOPT_SIMD=auto` defaults to AVX2 on supported x86 hosts; `avx512` is an
explicit override and fails if the CPU/OS cannot support it.

Install/promotion fully verifies the table SHA-256. Daemon restarts can reuse
the adjacent SHA receipt only when the expected digest, inode, size, mtime and
ctime still match. The native table's own checksum/distribution verification
has a separate receipt; its first load checks it once. Small files and executable
are always hashed. `CUBEOPT_VERIFY_TABLE=1` forces both full table checks.
These metadata caches do not detect silent corruption without a metadata change;
the force option is available for that check.

The server's existing artifact tools fully verify the immutable candidate,
copy the existing small snapshot, and hard-link the current Opt8 table. The old
bundle remains available without a second 7.25 GiB disk copy. Release execution
shares the `deploy-core-production` workflow concurrency group with API deploys.

During the switch, optimal-solve admission is disabled, the old daemon must
exit, and available RAM must cover the table, a 512 MiB worker allowance and
2 GiB headroom. The deploy waits up to 60 seconds for worker exit, the HTTP
readiness endpoint to confirm disabled admission, and memory reclamation.
The existing manager smoke verifies `R` produces an optimal
one-move solution, then normal admission and configured warm-up are restored.
The deployment preserves the server's existing thread count (1–4).

An error or interruption restores the saved `current.json` atomically and
reloads the previous configuration. If a worker fails to exit, admission stays
disabled to avoid loading two tables. The workflow reports this as a failure.
The build and deployment receipt are retained under
`/root/core-api/artifacts/cubeopt/native-uploads/<run>-<attempt>-<commit>/`.

The smoke checks the production protocol and lifecycle. The full-solve
performance comparison and release decision belong in
`docs/cubeopt-native-rollout.md`; a passing smoke alone is not a speed claim.
