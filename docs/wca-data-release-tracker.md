# WCA latest-data Release migration

Status: GENERATED STATISTICS MIGRATION AND WRITABLE REMOTE HISTORY CLEANUP COMPLETE (2026-10-22). Latest datasets live in one mutable Release; generators no longer commit them. Earlier CI failures below are historical evidence, not current failures.

## History maintenance (2026-10-22)

The maintainer authorized publishing all pending project changes, merging PR #142, then cleaning obsolete data history after other AI tasks finished. Preserve `.local/`, computation checkpoints, current code and live Release assets. The earlier decision not to rewrite history is superseded for this maintenance window.

- [PR #142](https://github.com/2017YANR02/cuberoot.me/pull/142) is merged and published, with both the current `lockView` and the tutorial's section-pause/dynamic-stickering options preserved. All pending project work was published, excluding `.local/`. Client typecheck and 89 related checks passed, including an independent replay of all 150 tutorial practice placements. Three Opt10 guard-policy checks and a small Rust library feature compilation passed; no solver benchmark or table generation was repeated.
- Historical data also used `stats/data/nemesizer/` and `stats/data/persons_search.json.gz`. Include those predecessor paths in the same removal, retaining all source code, other data families and commit topology.
- Before remote rewriting: finish active automatic data publication, back up exact remote refs and protection/workflow state, validate rewritten branch/tag tips and unchanged main tree, then use explicit expected-old ref leases. Restore branch protection and temporarily paused writers after the cutover. Keep the offline backup and commit map for existing-checkout recovery.
- GitHub PR/fork references are outside normal writable branch/tag refs. Do not claim their retained storage has been purged or that GitHub's displayed repository size updates immediately.

### Completed maintenance evidence

- [General Test](https://github.com/2017YANR02/cuberoot.me/actions/runs/39703772705), [Deploy Next](https://github.com/2017YANR02/cuberoot.me/actions/runs/39703772794), [Deploy Core](https://github.com/2017YANR02/cuberoot.me/actions/runs/39702881860), Vercel production and the [WCA ownership checks](https://github.com/2017YANR02/cuberoot.me/actions/runs/39703071218) passed before rewriting. The F2L production page was checked through chapter selection, practice placement and restoration playback. A bare-button CSS guard failure discovered during integration was fixed before the successful Test run.
- The maintainer explicitly cancelled [today's statistics run](https://github.com/2017YANR02/cuberoot.me/actions/runs/39690156751). GitHub reports `cancelled`; its remote import process exited and its temporary import directory was cleaned. Database transactions committed before cancellation remain committed. The run did not reach Release publication or the statistics Git commit. The first fresh-data end-to-end producer acceptance therefore remains pending a future scheduled run; it is not claimed as passed.
- All 85 remote branches and the `wca-data-latest` tag were atomically rewritten with explicit expected-old leases. Main changed from `ab94ce76dee2e658e3c6a368f72fa240750f4d16` to `3554f987b0ca22044edd77ac4f0e52af66e2193c`; its tree stayed exactly `d515cb1ed39df8433780e0b8d3fe4e868daeeed9`.
- All 8,817 commits retain their authors, committers, timestamps, messages and mapped parent relationships, including empty commits and merges. Commit IDs change and old cryptographic signatures cannot carry over. All ten specified paths are absent from reachable history, and all 441 inventoried data blobs are unreachable even under other filenames. Every branch/tag tip differs only by the allowed data deletions; main has no file changes. Full object integrity validation passed.
- Comparable reachable packed-object size fell from 2,619,775,430 to 1,432,776,024 bytes: approximately 2.44 GiB to 1.34 GiB, a 45.3% reduction. This measures the cleaned Git history, not GitHub's server-side storage counter or the combined disk usage of retained local backups.
- Release ID, manifest body, asset IDs, hashes and sizes were unchanged by the rewrite. Main's deletion and non-fast-forward protections were restored, as were temporarily paused workflows and the Vercel preview setting. Previously disabled workflows remain disabled; daily scheduling resumes without rerunning the cancelled statistics job.
- The primary `/Users/eula/Developer/cuberoot.me` checkout is aligned with the rewritten main, with working files and `.local/` unchanged. The full offline original-history backup is `/Users/eula/Developer/cuberoot-history-backup-20261021.git`; exact ref proofs, commit mapping, cancellation, CI and restoration records are in `/Users/eula/Developer/cuberoot-history-maintenance-20261022/`.
- Other old worktrees, local-only branches/stashes and other computers are deliberately preserved. Before using them again, save unpublished work and move it onto the rewritten history. Do not merge or push the old main history back into the repository. This maintenance uses the primary checkout; the isolated checkout mentioned in the original migration notes below is now historical.

### Follow-up: retired frontend bundles (2026-10-22)

- The remaining-size audit identified root `_assets/` as obsolete hashed frontend bundles. It was absent from all 85 branch tips and the tag, but its historical versions still occupied about 338 MiB. Root `/_assets/` is now ignored, and the existing data-ownership CI rejects tracked files there. All nine checks passed locally and in [run 39710328778](https://github.com/2017YANR02/cuberoot.me/actions/runs/39710328778).
- Removed `_assets/` from all 86 writable remote refs using an atomic push with exact old-ref leases. Every branch/tag tip retains an identical tree, and all 8,819 commits retain their metadata and mapped parents. All 18,743 blobs used exclusively by `_assets/` are unreachable; shared blobs still required by other paths are preserved. Full object integrity validation passed.
- Main changed from `14b59e24570a7aaab04258a934707eed8abe541d` to `1912907d31a95e548678c0e4c91f92d6ad512cf2`, retaining tree `991b59bddc4346ade0031e920e22551a44372f1c`. The primary checkout was aligned without changing working files or `.local/`.
- Reachable compressed object bytes fell from 1,432,798,281 to 1,078,244,084, a further 354,554,197 bytes removed. Including pack indexes, the independently packed repositories measure approximately **1.34 GiB → 1.01 GiB**. These are local verified Git-object measurements, not GitHub's retained-object storage counter.
- The original full-history backup remains intact. The backup immediately before this second rewrite is `/Users/eula/Developer/cuberoot-history-assets-backup-20261022.git`; verification, exact ref mapping and restoration records are in `/Users/eula/Developer/cuberoot-history-assets-20261022/`.
- Release identity, manifest and asset hashes remain unchanged. The API reports ready with export date `2026-10-21`; the public person-index hash matches the Release and the F2L page returns HTTP 200. The cancelled statistics computation was not restarted.
- This cutover disabled Actions at repository level and temporarily disconnected Vercel's Git link, then restored Actions permissions, branch protections, repository identity, credentials, production branch and saved build settings. Vercel's reconnect API no longer returns the previous `sourceless` metadata field, even when explicitly supplied; that discrepancy and the verified functional settings are recorded in `restoration-verification.json`. No application code was changed by the rewrite.

### Completed statistics migration and final history cleanup

The maintainer subsequently authorized completing the remaining migration. The generic publisher uses checksum-verified tar.gz snapshots in the same Release, owner-scoped optimistic patches, serialized calendar regeneration and recoverable server activation. Live adoption and clean hydration were verified before removing Git tracking/history. The cancelled full statistics computation was not restarted.

Bootstrap [39716982510](https://github.com/2017YANR02/cuberoot.me/actions/runs/39716982510) successfully adopted 6,879 live statistics files into a 118,161,424-byte checksum-verified snapshot. All 6,857 previously Git-tracked generated files match the server byte-for-byte. Independent hydration restored all 6,879 files and verified their hashes before removing the 6,857 paths from Git tracking; local files were preserved. The single Release retains one binary archive and one statistics archive, with no old statistics snapshots. Existing AppleDouble sidecars are recognized by their binary signature and excluded during adoption.

Scheduled WCA/upcoming/elevation writers, local scramble publication, static sync and CI fixtures now use the Release ownership boundary. Fourteen focused archive, conflict, rollback, ownership and shared elevation-cache checks pass; calendar/workflow contract checks pass. The architecture artifact contract was updated to require Release publication rather than the removed Git-commit commands. Active tutorial media, public assets and upstream tools remain in Git.

- [Actual patch publication and calendar regeneration](https://github.com/2017YANR02/cuberoot.me/actions/runs/39718201212) passed using an idempotent replay of existing upcoming data. All 6,879 final file hashes equal the pre-publication snapshot. The Release retains exactly two current assets: the original 18,073,600-byte binary archive and `stats-snapshot-56df44524f7b9b8d497b1b4f0680c405f79976f6a3358b7959b6ac1d527f032f.tgz` (118,165,158 bytes). No completed patch or old statistics archive remains; the server retains one current statistics directory.
- [Final CI](https://github.com/2017YANR02/cuberoot.me/actions/runs/39718862799), [architecture contract correction](https://github.com/2017YANR02/cuberoot.me/actions/runs/39718506787), [Deploy Next](https://github.com/2017YANR02/cuberoot.me/actions/runs/39718136873), [Deploy Core](https://github.com/2017YANR02/cuberoot.me/actions/runs/39718136877) and Vercel production `dpl_55Mt2KNEDkxx5AJ5rTkUpWJyJZHL` passed. Clean CI hydration passed. The earlier client test run was interrupted by follow-up commits; its individual client jobs were resumed separately. Only the already-checked-out, read-only client shard was allowed to overlap the final history cutover.
- Removed 11,597 exact historical generated paths, including predecessor `stats/data/` paths, retired generated reports/download ZIPs and the obsolete `wca_optimal_puzzle.csv` output. All 115,626 blobs exclusive to these paths are unreachable. Every one of the 86 writable refs was verified and atomically rewritten using expected-old leases; all 8,825 commits retain their metadata and mapped parents. Every old branch tip changes only by allowed data deletions. Main changed from `226ee49396ee637201d5139759bb03d30f39ca27` to `461ffe735e2b2ddacc15c434f8bbaccfc29eb842` with identical tree `dc132be203714bdcf28ba8d947a5d37afa8db599`. Full object integrity verification passed.
- Independently packed Git data, including indexes/bitmaps, fell from 1,086,741,517 to **692,674,093 bytes (660.6 MiB)** in this final pass. The remaining compressed blobs are approximately 291 MiB of authored tutorial assets, 182 MiB of frontend public assets, 79 MiB of upstream tools, 11 MiB of active puzzle tables and 81 MiB of code/other retained history; commit/tree/index overhead is additional. Do not delete these active resources merely to lower the size counter.
- Release identity and contents were unchanged by the history rewrite. Main protection, Actions permissions, Vercel repository/build settings and previously active writer workflows were restored. The already-disabled elevation backfill stays disabled. The primary checkout was aligned without changing working files, ignored statistics, computation checkpoints or `.local/`.
- The exact pre-rewrite backup is `/Users/eula/Developer/cuberoot-history-statistics-backup-20261022.git`; the original full backup remains intact. Final path allowlist, commit/ref maps, lease-push output, integrity/size proofs and restoration evidence are in `/Users/eula/Developer/cuberoot-history-statistics-20261022/`. Adoption, hydration and unchanged-data replay proofs are in `/Users/eula/Developer/cuberoot-statistics-migration-20261022/`. GitHub retained PR/fork objects and its delayed capacity display remain outside writable-ref cleanup; local backup disk usage is separate.
- Client rerun evidence: shard 1 passed. Shard 2 passed 7,207 tests and failed only the old architecture publication markers because GitHub reruns use the original `9a56f6bb0d` checkout. That exact contract is already fixed in current main, passed the later architecture CI, and its focused regression passed again on the final rewritten checkout. The old run therefore remains red; it is not represented as a fully green run.

## Authorized outcome

- Use this repository and one mutable `wca-data-latest` GitHub Release.
- Keep only the latest successfully deployed WCA dataset; old files may exist temporarily during a transaction, then are removed.
- Stop committing large generated WCA files. Preserve latest datasets' historical results; do not confuse historical results with obsolete export snapshots.
- No new repository, OSS subscription or Git LFS. The initial migration excluded history rewriting; the later explicit maintenance authorization above supersedes that restriction.
- User authorized scoped commits, push, deployment, and necessary verification.

## Original migration concurrency boundary

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
- The migration stops new blob accumulation. The separately authorized maintenance above removes the old migrated-data history from writable remote refs; existing clones and GitHub's retained PR/fork objects are a separate boundary.

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

## Initial production evidence (2026-10-21)

- [Final publication run 39647834392](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647834392) passed both nine checks and actual publication at `7f651e248a`. [Static sync 39647753067](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647753067) and [39647752958](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647752958) passed with the migrated paths excluded.
- [Release `wca-data-latest`](https://github.com/2017YANR02/cuberoot.me/releases/tag/wca-data-latest), ID `419868944`, is public and mutable. It contains exactly one attachment: `wca-data-31d132fb2515070cc40cd938aeb5ce094974e646baa284ae3dc0817b0ab76bb0.tar`, 18,073,600 bytes. The Release body points at this archive.
- Production has exactly one owned dataset directory, with `.wca-data/current` pointing at the archive hash above. All five live file hashes match the manifest. No transaction journal or legacy adoption backup remains. Server-owned `stats/comp/` still exists.
- Origin API reports ready with export `2026-10-21`, generation `2026-10-21T00:08:44.216Z`, 300,617 persons and 1,945,619 ranks; public static index verification passed. Existing browser cache policies remain unchanged.
- Hydration into an empty local directory passed; all five restored hashes match the published dataset. The files are ignored and absent from the current Git index. Workflow actionlint and `git diff --check` passed.
- The scheduled WCA producer now submits these files through the serialized publisher before its Git commit. Initial adoption and repeat publication used existing server data; a fresh full statistics generation was deliberately not started alongside the other AI's work. The next scheduled generation remains the first end-to-end run with a newly generated dataset.
- Git history was not rewritten during the initial migration; the later cleanup is recorded above. Other WCA JSON, scramble statistics, media and solver assets remain outside this first migration unit.

## Original CI handoff (superseded by maintenance checks above)

The original general Test run on `7f651e248a` was cancelled by newer pushes. Successor `3caad42697` contains all three migration commits. Its [Test run 39647952130](https://github.com/2017YANR02/cuberoot.me/actions/runs/39647952130) reports failures in files not modified by this migration:

- Architecture boundary guard: six unregistered edges in `packages/client/tests/auth-doc-sync.test.ts` and `packages/client/tests/timer-heatmap-colors.test.ts`.
- Mobile: `packages/app-ui/src/mobile-scramble-history.test.ts:331` expects `data-tag-id="pb-single"` in rendered history.
- Client shard 2: failures include hash navigation ownership, magic controls, raw localStorage writes in `alg-library-cache.ts`, simulator companion lifecycle, timer settings/training and WCA calculator/auth contracts. See the run for complete logs.
- At handoff, client shard 1 is still running; Desktop UI passed. The overall run therefore cannot be described as green regardless of the remaining shard.

These are not claimed as passing and were not changed to avoid conflicting with the other task. The other maintainer/AI should inspect that run for their client/mobile work. Data-publication CI and its production checks passed independently. Preserve the new `stats.yml` submit step and the two `sync_toolkit.yml` rsync exclusions when modifying pipeline infrastructure; do not re-add the five generated files to Git.
