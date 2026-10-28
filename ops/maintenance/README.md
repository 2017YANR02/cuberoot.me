# Server disk maintenance

`deploy_core.yml` ships `prune-api-releases.ts` with each API release. After
health, solver smoke, compression service checks and `pm2 save` succeed, it
removes old managed releases. It retains the active release, two newest
alternatives, the deployment's explicit rollback release, and releases referenced
by running process commands, mappings, working directories or open files.
Staging directories, unknown layouts and release symlinks are never removed.
Inspection failures stop cleanup. A cleanup error fails the job but does not
roll back an already healthy application.

Activation and manual cleanup share `/run/lock/cuberoot-api-releases.lock`.
For manual maintenance, use the active release's script under `flock -n`;
omit `--apply` to preview, then inspect the retained/deletion lists before applying.
An explicit older rollback can be protected with `--previous /absolute/release/dist`.
Do not run cleanup concurrently with an older deployment workflow lacking this lock.

`stats.yml` copies and runs `stats-capacity.ts` before MySQL startup, dependency
installation, WCA download or computation. It requires the greater of 8 GiB and
1.75 × existing historical table heap + 3 GiB. The floor covers the observed
5.08 GiB staging demand plus uploads/concurrent growth; the dynamic component
grows with historical data. It logs filesystem and major directory sizes.
This early estimate cannot guarantee future free space: import-time source-size,
temporary-table and changed-row/WAL admission checks remain authoritative.
Database data, WAL, tablespaces and `/tmp` must remain on one filesystem until
both the early and import-time accounting support separate volumes.

Regression coverage lives in `core/packages/client/tests/server-maintenance.test.ts`
and `workflow-path-contract.test.ts`, including real fixture deletion, symlink
boundaries, rollback/process protection, observed capacity failure, growth,
workflow ordering and CI path coverage.
