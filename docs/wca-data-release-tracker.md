# WCA latest-data Release migration

Status: IN PROGRESS (2026-10-21).

## Authorized outcome

- Use this repository and one mutable `wca-data-latest` GitHub Release.
- Keep only the latest successfully deployed WCA dataset; old files may exist temporarily during a transaction, then are removed.
- Stop committing large generated WCA files. Preserve latest datasets' historical results; do not confuse historical results with obsolete export snapshots.
- No new repository, OSS subscription, Git LFS, or Git history rewriting.
- User authorized scoped commits, push, deployment, and necessary verification.

## Concurrent work boundary

Another AI owns solver/scramble pipeline optimization and publication. This task does not edit `solver/**`, `stats/scramble/**`, or `core/jobs/scramble-stats-build/**`, and does not start computation or stop another task's processes. Existing unrelated working changes must remain intact and must not enter this task's commits.

Potential shared integration files: `.github/workflows/stats.yml`, `.github/workflows/sync_toolkit.yml`, `.gitignore`, and `docs/generated-artifacts.json`. Inspect current diffs immediately before editing/committing. Keep data generation algorithms and database loading unchanged.

## First migration unit

`stats/nemesizer/{persons.bin.gz,ranks.bin.gz,counts.bin.gz,meta.json}` and `stats/persons_search.json.gz`. All five files remain supported runtime artifacts. The API loads Nemesizer at startup; the person picker downloads the gzip index from the static service.

## Delivery checklist

- [ ] Record existing runtime, workflows, data versions and concurrent changes.
- [ ] Implement manifest, checksums, bounded validation, and local hydration.
- [ ] Publish to the single Release without exposing an incomplete dataset.
- [ ] Deploy the complete dataset and verify API/static consumers; retain the previous live data until success.
- [ ] Remove obsolete Release attachments only after success; prevent stale concurrent publishers.
- [ ] Update WCA generation and generic static sync so old checkout files cannot overwrite released data.
- [ ] Remove only the migrated generated files from Git tracking and register their new owner.
- [ ] Run focused failure-path checks and applicable builds/CI.
- [ ] Synchronize main, commit only this task's changes, push, and verify applicable CI/deployment (CodeQL excluded).
- [ ] Record actual release, commit, deployment, rollback and final file inventory evidence.

## Acceptance and failure behavior

- Downloads resolve a complete manifest and verify every file; no silent recomputation or partial replacement.
- Empty, corrupt, mixed-version and missing data fail before activation.
- Runtime reads local deployed data, not GitHub on user requests.
- Static deployment preserves unrelated directories, especially server-owned `stats/comp/`.
- Publish/deploy failures preserve the last complete live dataset and are reported distinctly.
- A clean checkout can hydrate the migrated files explicitly; ordinary tests use fixtures.
- Successful publication leaves one Release and one current dataset, without daily releases.
- Existing Git history remains unchanged; this migration stops new blob accumulation rather than immediately shrinking old clones.

## Implementation and evidence

- Initial inspected data: export `2026-10-21`, generation `2026-10-21T00:08:44.216Z`, 300,617 persons and 1,945,619 ranks. Local and API metadata match. The five-file archive is about 18 MB, not the accumulated Git-history size.
- Latest manifest is the single Release's JSON body. Upload the content-addressed archive first, activate/verify production, then update the body as the commit point. A candidate JSON attachment exists only while queued/in progress. Completed candidates and previous archives are deleted after commit.
- WCA publication runs in `deploy-core-production`, shared with the existing API deployment. Generation retains its own existing concurrency group and submits a candidate; it does not reload the API itself.
- Production `.wca-data/current` switches a complete dataset. Only this owner's files are linked; the rest of `stats/`, including `comp/`, is untouched. The last data remains until API and public static validation succeed. A journal recovers interrupted activation or finalization.
- Six focused fixture checks pass locally: byte integrity, invalid gzip/counts, scoped cleanup, activation rollback, interrupted commit recovery, stale/same-generation rejection. Fixtures use the canonical shared binary encoders; no real WCA computation or solver was started.
- Phase 1 adds the publisher and prevents generic static sync from overwriting its files. Bootstrap adopts the existing live dataset. Phase 2 stops Git tracking and connects the scheduled WCA producer after bootstrap succeeds.
