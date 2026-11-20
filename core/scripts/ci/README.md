# Affected CI and web release checks

The workflow remains in **shadow mode**: both complete Vitest shards, isolated Cross tests and formula browser geometry still run. A candidate selection is evidence, not permission to skip tests. Do not enable narrowed execution until real CI reports cover the business groups and shared/structural changes without missed failures or missing results.

## Single sources

- Workspace dependencies come from existing package manifests and `resolve-workspace-path.mjs`.
- `client-test-plan.ts` owns business grouping and conservative fallbacks. Vitest `list --filesOnly --json` supplies the actual test inventory; there is no second test discovery engine. Unknown tests stay in the common group; shared, unknown, new, removed and renamed inputs select everything.
- `test.yml` uses the last successful main/push Test run as the comparison base. Failed or cancelled pushes remain in the next comparison. PRs use their base SHA. Missing evidence selects the full check set; scheduled/manual runs retain their existing complete scope.
- `build:ci` in `core/turbo.json` reuses the five existing library build scripts and caches `dist` plus TypeScript build info. `build:deps` selects the client's dependency closure. No native WASM build is added. Root TypeScript settings, Node version and generated stack-kernel inputs participate in hashing. GitHub caches the local Turbo cache; a remote cache service is not required.
- Client tests run through Turbo with caching disabled: fixtures read outside package boundaries, live-data checks and environment dependencies are not yet modeled as deterministic cache inputs.

## Evidence and validation

From `core/`:

```sh
node --test scripts/ci/*.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/workflow-path-contract.test.ts
```

CI saves each inventory, candidate plan and actual JSON result in `.local-data/ci/`, uploaded as `client-selection-1` and `client-selection-2`. Each shard compares with `--partial`; the audit job merges both results and checks complete coverage. Vitest 4's `list` does not narrow its inventory with `--shard`, so a partial comparison alone must never count as full coverage. Aggregation rejects mismatched plans/SHAs, unknown result files, missing results and failures the candidate selection would have missed. The candidate selection does not suppress existing test failures.

Before enforcing selection, review representative CI artifacts for each group, exercise shared/config/new/deleted paths and compare the union of full shards. Keep weekly full execution, conservative fallbacks and explicit run/skip reasons after enforcement. A successful small local fixture is not evidence that the entire library is safe to narrow.

## Production release boundary

`Web checks` aggregates core integration, both client shards, complete selection evidence and the affected analyzer. Mobile and desktop jobs are outside this gate. Only a push to `main` publishes this check name. PR, scheduled and manual runs use `Web audit`: Vercel keys GitHub checks by name, so a later live-data audit must neither block nor approve the same commit's release. The audit still reports its real result; a manual `scope: core` run still skips this incomplete web verification.

`deploy_next.yml` builds in parallel, then invokes `wait-web-checks.ts` before SSH/upload. It accepts only the current attempt of the latest `test.yml` push/main run for the exact deployment SHA. Missing, failed, cancelled or ambiguous checks and API errors fail closed. A rerun of the failed check may require rerunning the deployment; manual deployment does not bypass verification.

Vercel's ignored-build command uses the same frontend input paths. Before skipping an unchanged frontend, it also verifies the previous deployment SHA against the latest exact main/push Test attempt using the shared Web-check selector. Failed, pending, missing or ambiguous checks, incomplete inventories and GitHub API errors cause a build. This prevents an API-only repair from hiding frontend changes whose previous deployment was blocked by Web checks. The command remains Node-only and works before dependency installation.

Vercel's Git deployment is independent of this workflow. On 2026-11-16, project `cube-root/cuberoot-me` was configured and read back with exactly one **Deployment Check**: GitHub's `Web checks`, **Blocking** in Production, with automatic production domain assignment enabled. Configuration lives in Vercel, not `vercel.json`; repository changes alone do not enable it. Vercel holds a new production deployment until this check passes, then assigns its production domains. Keep the check name stable and do not add the separate `Web audit` or duplicate Vercel lint/typecheck jobs. After changing this contract or the project setting, verify both a passing deployment and a failing check that leaves the current production domains in place; never use Force Promote to validate the gate.

- [Vercel project setting](https://vercel.com/cube-root/cuberoot-me/settings/build-and-deployment#deployment-checks)
- [Official Deployment Checks documentation](https://vercel.com/docs/deployment-checks)
