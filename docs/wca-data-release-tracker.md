# WCA latest-data Release migration

Status: FIRST MIGRATION UNIT DEPLOYED (2026-10-21). Scoped release checks passed; repository-wide CI has failures outside this change (see below).

## History maintenance (2026-10-22)

The maintainer authorized publishing all pending project changes, merging PR #142, then cleaning obsolete data history after other AI tasks finished. Preserve `.local/`, computation checkpoints, current code and live Release assets. The earlier decision not to rewrite history is superseded for this maintenance window.

- PR #142 is merged locally with both the current `lockView` and the tutorial's section-pause/dynamic-stickering options preserved. Client typecheck and 89 related checks passed, including an independent replay of all 150 tutorial practice placements. Three Opt10 guard-policy checks and a small Rust library feature compilation passed; no solver benchmark or table generation was repeated.
- Historical data also used `stats/data/nemesizer/` and `stats/data/persons_search.json.gz`. Include those predecessor paths in the same removal, retaining all source code, other data families and commit topology.
- Before remote rewriting: finish active automatic data publication, back up exact remote refs and protection/workflow state, validate rewritten branch/tag tips and unchanged main tree, then use explicit expected-old ref leases. Restore branch protection and temporarily paused writers after the cutover. Keep the offline backup and commit map for existing-checkout recovery.
- GitHub PR/fork references are outside normal writable branch/tag refs. Do not claim their retained storage has been purged or that GitHub's displayed repository size updates immediately.

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

- [x] Record existing runtime, workflows, data versions and concurrent changes.
- [x] Implement manifest, checksums, bounded validation, and local hydration.
- [x] Publish to the single Release without exposing an incomplete dataset.
- [x] Deploy the complete dataset and verify API/static consumers; retain the previous live data until success.
- [x] Remove obsolete Release attachments only after success; prevent stale concurrent publishers.
- [x] Update WCA generation and generic static sync so old checkout files cannot overwrite released data.
- [x] Remove only the migrated generated files from Git tracking and register their new owner.
- [x] Run focused failure-path checks and inspect applicable CI; record unrelated failures separately.
- [x] Synchronize main, commit only this task's changes, push, and verify scoped deployment (CodeQL excluded).
- [x] Record actual release, commit, deployment, rollback and final file inventory evidence.

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
- Nine focused checks pass locally and in GitHub Actions: Git tracking/ignore ownership, draft lookup and permissions, queued-asset cleanup, byte integrity, invalid gzip/counts, scoped activation, activation rollback, interrupted commit recovery, and stale/same-generation rejection. Fixtures use the canonical shared binary encoders; no real WCA computation or solver was started.
- Phase 1 adds the publisher and prevents generic static sync from overwriting its files. Bootstrap adopts the existing live dataset. Phase 2 stops Git tracking and connects the scheduled WCA producer after bootstrap succeeds.
- Published commits: `514b8deb5e` (publisher), `56ffa98d7b` (draft lookup fix), `7f651e248a` (stop Git tracking and connect producer). First bootstrap correctly stopped before activation because GitHub's tag endpoint omits drafts; the authenticated listing fallback and regression check fix this.
- Successful bootstrap: [run 39647075445](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647075445). The release is mutable and public, API/static validation passed, and only one current archive remains.
- The primary checkout contained another task's unpushed `f879fb7b0f`. To avoid including it, this task's edits were transferred once to `/Users/eula/Developer/cuberoot-wca-data-release`, based on remote main; no other task files or commits were published. Continue editing only that checkout.
- Existing generated-artifact ledger validation has four baseline errors in the isolated checkout (assistant generated output, two local miniprogram project configs, avatar-gallery license). Comparing old and new ledger reports no additional errors; these unrelated files are not modified here.

## Final production evidence

- [Final publication run 39647834392](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647834392) passed both nine checks and actual publication at `7f651e248a`. [Static sync 39647753067](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647753067) and [39647752958](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647752958) passed with the migrated paths excluded.
- [Release `wca-data-latest`](https://github.com/2017YANR02/cuberoot.me/releases/tag/wca-data-latest), ID `419868944`, is public and mutable. It contains exactly one attachment: `wca-data-31d132fb2515070cc40cd938aeb5ce094974e646baa284ae3dc0817b0ab76bb0.tar`, 18,073,600 bytes. The Release body points at this archive.
- Production has exactly one owned dataset directory, with `.wca-data/current` pointing at the archive hash above. All five live file hashes match the manifest. No transaction journal or legacy adoption backup remains. Server-owned `stats/comp/` still exists.
- Origin API reports ready with export `2026-10-21`, generation `2026-10-21T00:08:44.216Z`, 300,617 persons and 1,945,619 ranks; public static index verification passed. Existing browser cache policies remain unchanged.
- Hydration into an empty local directory passed; all five restored hashes match the published dataset. The files are ignored and absent from the current Git index. Workflow actionlint and `git diff --check` passed.
- The scheduled WCA producer now submits these files through the serialized publisher before its Git commit. Initial adoption and repeat publication used existing server data; a fresh full statistics generation was deliberately not started alongside the other AI's work. The next scheduled generation remains the first end-to-end run with a newly generated dataset.
- Existing Git history was not rewritten. Other WCA JSON, scramble statistics, media and solver assets remain outside this first migration unit.

## CI handoff for concurrent work

The original general Test run on `7f651e248a` was cancelled by newer pushes. Successor `3caad42697` contains all three migration commits. Its [Test run 39647952130](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647952130) reports failures in files not modified by this migration:

- Architecture boundary guard: six unregistered edges in `packages/client/tests/auth-doc-sync.test.ts` and `packages/client/tests/timer-heatmap-colors.test.ts`.
- Mobile: `packages/app-ui/src/mobile-scramble-history.test.ts:331` expects `data-tag-id="pb-single"` in rendered history.
- Client shard 2: failures include hash navigation ownership, magic controls, raw localStorage writes in `alg-library-cache.ts`, simulator companion lifecycle, timer settings/training and WCA calculator/auth contracts. See the run for complete logs.
- At handoff, client shard 1 is still running; Desktop UI passed. The overall run therefore cannot be described as green regardless of the remaining shard.

These are not claimed as passing and were not changed to avoid conflicting with the other task. The other maintainer/AI should inspect that run for their client/mobile work. Data-publication CI and its production checks passed independently. Preserve the new `stats.yml` submit step and the two `sync_toolkit.yml` rsync exclusions when modifying pipeline infrastructure; do not re-add the five generated files to Git.
