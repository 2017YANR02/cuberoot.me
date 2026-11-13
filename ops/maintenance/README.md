# Server disk maintenance

`deploy_nginx.yml` installs two host timers, independent of a developer's computer:

- `cuberoot-log-compression.timer` checks hourly (up to five minutes of jitter).
  It compresses only dated CubeRoot nginx/PM2 and system log archives that have
  not changed for ten minutes and have no process references. Symlinks, hard links,
  active logs, unknown names and existing gzip destinations are preserved. The
  service shares `/run/lock/cuberoot-logrotate.lock` with the deployed daily
  logrotate wrapper and skips a busy rotation. The daily wrapper waits for an
  in-flight compression instead of skipping its daily run. Existing
  rotation/retention and journald caps remain unchanged; `delaycompress` still
  protects asynchronous nginx reopening, without leaving closed archives raw
  until the next day's rotation. Root/proc inspection errors fail closed.
- `cuberoot-package-cache-clean.timer` runs `dnf clean all` daily at 19:30 UTC
  (03:30 Beijing time, up to five minutes of jitter), before the scheduled stats
  run. It removes downloadable cache files, not installed packages or service data.

Both timers are persistent across reboot and log results to the system journal.
The deployer validates the units, runs each service once and enables the timers.

`deploy_core.yml` ships `prune-api-releases.ts` with each API release. After
health, solver smoke, compression service checks and `pm2 save` succeed, it
removes old managed releases. It retains the active release, two newest
alternatives, the deployment's explicit rollback release, and releases referenced
by running process commands, mappings, working directories or open files.
This successful-release pruning leaves staging to the separate cleanup below.
Unknown layouts and release symlinks are never removed.
Inspection failures stop cleanup. A cleanup error fails the job but does not
roll back an already healthy application.

Activation and manual cleanup share `/run/lock/cuberoot-api-releases.lock`.
For manual maintenance, use the active release's script under `flock -n`;
omit `--apply` to preview, then inspect the retained/deletion lists before applying.
An explicit older rollback can be protected with `--previous /absolute/release/dist`.
Do not run cleanup concurrently with an older deployment workflow lacking this lock.

`cleanup_api_staging.yml` runs after each completed Deploy Core attempt (including
failure/cancellation), every six hours as a retry, and on manual dispatch. Its
whole inventory/status/deletion sequence shares the deployment concurrency group.
`sweep-api-staging.ts` obtains the exact run **attempt**, commit, repository,
workflow path and main-branch identity from GitHub before allowing deletion of
`.RUN-ATTEMPT-SHA.staging`. Only completed attempts qualify; API errors fail
closed before deletion. Process references and root symlinks (active/rollback
entries) still protect directories. No age-only deletion is allowed. Retained
directories produce a visible failure and are reconsidered on the next sweep.
The script is streamed to Node under the same remote flock; the cleanup process
does not create another server-side temporary script directory. GitHub credentials
remain on the runner. Each sweep runs the deletion regression tests first.

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
