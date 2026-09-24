# Upstream sync

From the repository root, use the same command on macOS and Windows:

```sh
pnpm --dir core upstream:sync --validate-only
pnpm --dir core upstream:sync --only solver --dry-run
pnpm --dir core upstream:sync --only blddb
```

`--only` accepts `cstimer`, `solver`, `algtrainers`, `blddb`, and `recordranks` (comma separated or repeated). With no `--only`, all are selected. `--skip-pull` uses existing clones. `--validate-only` checks the repository script graph without loading an upstream clone or running native commands. The dry run previews Solver and Alg-Trainers; it skips the csTimer and BLDDB builds. RecordRanks dry run fetches and lists pending commits but does not merge or push.

Clone roots are resolved from `CUBE_UPSTREAM_DIR`, defaulting to a `cube` directory beside this repository. Override one clone with `CUBE_UPSTREAM_CSTIMER_DIR`, `CUBE_UPSTREAM_SOLVER_DIR`, `CUBE_UPSTREAM_ALGTRAINERS_DIR`, `CUBE_UPSTREAM_BLDDB_DIR`, or `CUBE_UPSTREAM_RECORDRANKS_DIR`. A direct child entry also accepts `--upstream-dir`. No clone path is baked into the scripts.

The BLDDB task builds a detached worktree pinned to `origin/v2`, verifies the candidate and its provenance, then switches `tools/blddb` with rollback on failure. csTimer scramble sources use a three-way merge against `UPSTREAM.txt`; conflicts stop before writing merged files. RecordRanks is special: a non-dry-run task verifies the fork, builds it, pushes **that fork**, then updates `ops/contests/recordranks-ref.txt`. The CubeRoot repository is never committed or pushed by this command. Review the diff and deployment boundary before running a non-dry-run task.

The generated artifact ledger is `docs/generated-artifacts.json`; successful child tasks update their structured `UPSTREAM.txt` records from the verified clone commit. Tests use local fixture clones and do not download or publish upstream data:

```sh
pnpm --dir core exec tsx --test ../scripts/upstream/tests/upstream-sync-contract.test.ts
```
