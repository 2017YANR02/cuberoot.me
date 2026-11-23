# Local full-stack dev (edit DB data before push)

## Isolated timer live sharing

`dev-timer-live.ts` mounts only the timer-sharing HTTP routes and WebSocket relay.
It requires explicit loopback `DB_HOST`, a non-production `DB_PORT`, and `DB_NAME`;
it does not load `.env`, production background jobs, or apply migrations for you.
Apply `migrations/0330_timer_live_shares.sql` to an isolated local database first.
From `core/`:

```sh
DB_HOST=127.0.0.1 DB_PORT=55434 DB_NAME=postgres DB_USER=your_local_pg_user PORT=3006 pnpm --filter @cuberoot/server exec tsx scripts/dev-timer-live.ts
```

For browser automation, redirect only `/v1/timer/live-shares` HTTP requests and
`/v1/timer/live-shares/socket` WebSockets to this server. The ordinary Web dev
proxy and installed App still default to production API addresses; starting this
server alone does not redirect either client. Keep this isolation in tests so
creating or revoking a test share never writes to production.

## Historical reconstruction completion

`Deploy Core` bundles `src/tools/recheck_recon_completion.ts` and runs it after the
new API passes health checks (except disk-dashboard-only releases). It recalculates
derived completion statuses using the deployed checker and clears obsolete reasons
only for solved records. Recorded algorithms and other content are not rewritten.

On the server, from `/root/core-api`, preview with
`node --max-old-space-size=512 --env-file=.env dist/recheck-recon-completion.mjs`.
Add `--apply --backup-dir=/root/core-api/backups/recon-completion` to apply.
Private, durable JSON backups are flushed before the transaction; conditional
updates skip concurrent edits. Inspect the `.result.json` files for applied IDs.
The pending cache queue survives interruptions; rerunning completes invalidation
on both Next deployments. A cache failure or skipped concurrent edit fails the
maintenance step so an incomplete refresh cannot be reported as successful.

Backups contain the original input and derived fields. To undo a correction,
restore only the affected derived fields after verifying the input still matches
that snapshot, then invalidate the corresponding reconstruction pages.

For push acceptance, use `pnpm --filter @cuberoot/server push:acceptance` from `core/` and the [separate acceptance entry](../../../../docs/operations/record-notification-setup.md#6-隔离-api-与推送验收入口). This loopback fixture API does not load production auth, `.env`, PG, monitors or provider transports. The selective production proxy described below is not a push isolation environment.

## Manual SOR player-best refresh

The scheduled refresh runs in `.github/workflows/sor.yml`. For a local fallback, run from `core/`:

```sh
pnpm sor:update --dry-run       # read-only inventory of the four existing outputs
pnpm sor:update --no-publish    # compute and assemble the local copy TSV
pnpm sor:update --skip-solve    # reuse all four outputs, then publish to production PG
```

`SOR_DATA_DIR` changes the local data directory; `SOR_REMOTE` changes the SSH target. The default thread count uses the machine's available parallelism, without a fixed cap. The command with no flags computes and publishes, so use `--no-publish` for a local-only run.

By default `pnpm --filter @cuberoot/client dev` proxies **all** `/v1/*` to the prod
API (see `client/next.config.ts`), so you get real data + your real prod login with
zero local setup — but you can't test **data** changes (case moves, subgroup renames,
new algs, new wiki terms…) without pushing to prod first.

The fix is a **selective** local proxy: route only the domain(s) you're editing to a
local server + local DB, and keep everything else — including auth/login — on prod. A
blanket "dev → local DB" switch is deliberately avoided: this site's dev data source is
prod (15+ GB of derived WCA data that can't be fixtured; content edited live on prod by
multiple agents), so a full local DB would only give you stale/empty tables. Instead you
opt in per domain with `LOCAL_DOMAINS`.

## One-time

- Local `pg13` docker must be up (`127.0.0.1:5433`, password `dev`, db `cuberoot_db`).
- Seed the tables for the domain you want, from prod (read-only `pg_dump`, re-runnable).
  Pass **every** table that domain's queries read:

  ```sh
  pnpm --filter @cuberoot/server seed:local-alg           # shortcut: alg_sets + alg_cases
  pnpm --filter @cuberoot/server seed:local wiki_terms    # any other domain, by table name
  ```

## Each session

1. Run the local API against pg13 (leave it running):

   ```sh
   pnpm --filter @cuberoot/server dev:local
   ```

   Hono comes up on `http://127.0.0.1:3001`; only the domains you pick below use it.

   The local launcher reads only `ENTERPRISE_VERIFICATION_KEY` from the ignored
   `core/apps/api/.env`, unless already supplied by the environment. Other `.env`
   settings are not imported; the local database and session defaults stay local.

2. Start (or restart) the frontend with the domains you're editing:

   ```sh
   LOCAL_DOMAINS=alg pnpm --filter @cuberoot/client dev     # Mac/Linux; comma list: alg,wiki
   ```

   On Windows, set `LOCAL_DOMAINS` in your terminal first, then run the same pnpm command.

   Now `/v1/alg/*` (and any other listed domain) hits your **local** DB; **all other
   endpoints — WCA stats, recon, and crucially auth/login — still hit prod**, so you
   stay logged in with your real account. Edit the data via the admin API (`X-Admin-Key`)
   or SQL against pg13, refresh, and see it immediately — no push required.

To go back to all-prod, start the frontend **without** `LOCAL_DOMAINS` set.

## Notes

- `LOCAL_DOMAINS` names map 1:1 to `/v1/<name>/*` route prefixes. `alg` → `/v1/alg/*`.
- A domain that JOINs several tables needs **all** of them seeded, or its query 500s
  against the local DB. When in doubt, grep the route file in `src/routes/<domain>.ts`.
- Don't put a WCA-heavy domain (wca/recon/scramble_marks — they read the multi-GB
  `wca_*` tables) in `LOCAL_DOMAINS`; leave those on prod.
- `scripts/local/seed-api.ts` reads the prod DB password from `PROD_PG_PASS` or the gitignored
  repo-root `.password.md`; nothing secret is committed. Re-run anytime to reset.
- To test a **migration** locally, apply it to pg13 after seeding:
  `Get-Content migrations/00xx_*.sql | docker exec -i pg13 psql -U postgres -d cuberoot_db`.

## Local draw API verification

For read-only lucky-draw competition search and registration import, run
`pnpm --filter @cuberoot/server exec tsx scripts/dev-draw.ts` from `core/`.
This mounts the real draw routes on `127.0.0.1:3003` without a database or background jobs.
Add `draw` to `LOCAL_DOMAINS` and set `LOCAL_API_PORT_DRAW=3003` in the client's
ignored `.env.local`. Per-domain ports override `LOCAL_API_PORT`, so existing
local domains keep their own service. Next reloads its config to apply the proxy.
Responses include `X-Draw-Backend: local`; competition and registration data come
from the real CubingChina source. This does not deploy the API to production.

## Local chat API verification

`pnpm --filter @cuberoot/server exec tsx scripts/dev-assistant.ts` (from `core/`)
loads the real chat routes, model transport and monitoring without unrelated API
background jobs. It binds to `127.0.0.1:3002` by default (`PORT` can override it).
It requires `DB_HOST=127.0.0.1`, `DB_NAME=assistant_dev`, local database connection
settings, an explicit `JWT_SECRET` and the chosen model provider configuration.
Pass credentials through the process environment; do not commit them.

Seed only the current account's public ID/WCA mapping into local `app_users`,
plus the assistant quota, monitoring, attachments and context migrations. Existing
browser sessions require the matching session verification secret. All chat
records and quotas then stay in the local database. Set `SITE_ASSISTANT_OUTBOX_DIR`
to a dedicated directory under `.local-data/`; set `SITE_ASSISTANT_KNOWLEDGE_ENABLED=0`
when the local vector index is absent (public lexical retrieval remains available).

In the client's ignored `.env.local`, set `LOCAL_DOMAINS=site-assistant` and
`LOCAL_API_PORT=3002`, preserving any other local domains. Also set
`NEXT_PUBLIC_SITE_ASSISTANT_API_ORIGIN=http://localhost:3002` for the direct streaming
request (development only); this does not redirect authentication or other API domains.
Apply `0294_assistant_message_shares.sql` and `0325_assistant_share_versions.sql` to
the isolated database when testing share snapshots. Reload the Next config
so its rewrites update. Responses include `X-Assistant-Backend: local`; `/health`
on the local API identifies the database. All other domains retain their existing
routing. To restore the default chat backend, remove `site-assistant` from
`LOCAL_DOMAINS`, remove `NEXT_PUBLIC_SITE_ASSISTANT_API_ORIGIN`, and reload the Next
config. Remove `LOCAL_API_PORT` only if no other local domains need it.

Check `/v1/site-assistant/providers` through the frontend you are testing before
sending a message. The `X-Assistant-Backend: local` header confirms it reaches
this checkout. A standalone recent 3×3 championship-count question can run
through the authenticated chat queue with no model configured. It still
requires imported WCA results, public analysis views and their import timestamp.

## Frozen before/after assistant evaluation

For the 2026-11-16 reliability candidate, reuse `benchmark-assistant-context.mjs`.
`--prepare --out=.local-data/<run>` freezes both executed bundles, dependency hashes,
cases, source mappings and runner identity. `baseline.json.candidateFiles` limits
treatment changes; other baseline files are shared by both variants. Never edit
an existing frozen directory; use a new directory for a changed candidate.
`--replay` runs the frozen synthetic provider replies with no network fallback and
stores `replay-results.json`; these are regression results, never model accuracy,
token or latency measurements. `--run --env-file=/absolute/private/path` uses real
provider credentials (or existing environment variables) and the bounded paid
ledger. Credentials are not embedded in either bundle. Resource rules below still
apply to paid runs. See the [current reliability record](../../../../docs/product/assistant/benchmarks/assistant-reliability-2026-11-16.md).

Real runs also retain each provider response, including rejected drafts, in
owner-only `provider-responses/<call>.txt`; `provider-calls.jsonl` links those
files to the request and usage. This is local synthetic evaluation evidence,
not production logging. Request headers and credentials are never copied.
Production plan diagnostics record only validation phase, reason and word counts.

`prepare-assistant-paired.mjs`, `run-assistant-paired.mjs`, and
`analyze-assistant-paired.mjs` use persistent evidence under `.local-data/`.
Set `ASSISTANT_EVALUATION_DIR` to a new repository-relative run directory. For a
follow-up comparison, set `ASSISTANT_EVALUATION_BASE` when preparing: the prior
run's frozen `after.mjs` becomes the unchanged control, and reviewed source
overrides in the new directory become the treatment. Preparation rejects missing
unfrozen dependencies. Preserve the original questions, source bodies and local
SQL fixture; never run the initial data seeder over an existing evaluation.

The runner requires explicit `--run` or `--index`, reads provider credentials from
the local API environment, and records usage in a bounded paid ledger. Optional
`config.json.knowledgeDatabases` maps `before`/`after` to existing isolated local
indexes. Never point these at production. Execute from `core/`, for example
`ASSISTANT_EVALUATION_DIR=.local-data/<run> node --max-old-space-size=768 apps/api/scripts/run-assistant-paired.mjs --run`.
Use `analyze-assistant-paired.mjs --review` to export anonymous answers, then
record the frozen rubric's scores in `manual-grades.json` before generating the
comparison. The runner calls real generation/embedding services, while business
HTTP responses are frozen; reported durations are not production end-to-end
latencies. No deployment is performed by these scripts.

Before a paid run, follow `docs/contributing/compute.md` and the latest evaluation
report: explicit authorization, the preserved resource baseline and the external
resource guard are required. The runner's own 2 GiB check does not replace them.
A protection stop must not be automatically resumed.

For an explicitly approved macOS monitored exception, `run-assistant-local.mts`
supervises the frozen runner without changing either evaluated bundle. Its default
mode only checks resources, hashes and whether the private credential is present.
`--run` requires an unused `local-authorization.json` bound to the runner, manifest,
supervisor, boot and Swapouts. The file records the user's actual one-run approval;
do not create or renew it without that approval. The evaluation credential belongs
in ignored `.local-data/assistant-evaluation-config/deepseek.env` with mode `0600`.
The supervisor samples the process tree, preserves results on stop, and enforces
the approved 1 GiB tree RSS, 2 GiB free-memory floor and 30-minute deadline. Changed
Swapouts, boot, memory pressure or failed observation stop the run; the consumed
receipt and stop record prevent automatic restart. This is monitoring, not an
operating-system guarantee against swap. No system settings are changed.

After an explicit user request to continue a stopped evaluation without repeating
completed requests, use a **new** evidence directory and `resume.json`. The
`assistant-evaluation-resume.mts` verifier binds the prior directory's hashes,
completed `(repeat, variant, id)` keys and the interrupted request’s usage records,
and unchanged model bundles, cases, fixtures and configuration. The new manifest
records `resumesBuildSha256` and the new harness hashes; never rewrite the old
manifest, ledger, authorization, consumed receipt or stop record. The supervisor
still needs a new one-run authorization bound to the continuation fingerprint.

The continuation writes only new results, skips every completed key, preserves
global provider call numbers and measured token totals, and deducts prior active
runtime from the original deadline. After a memory stop with a saved provider
response and an unsaved answer, measured usage counts against the original
budget and the unfinished request may run again. Historical unknown usage remains explicit;
reserve 1,000,000 input and 16,384 output tokens against the original budget rather
than reporting it as zero. Any new unknown usage stops the run. The first
continuation is supported after a memory-headroom stop with fully measured
usage or one interrupted call with unknown usage. With fully measured usage,
the worker's final memory check is also accepted when the frozen supervisor
sample, lease, exit record and worker log corroborate the stop. It also supports one unknown
call from a verified legacy wall-clock reversal. For a clock reversal the frozen records
must show continuous resource samples and leases before a stop timestamp that
precedes the latest accepted lease. A second, separately authorized continuation
can follow a recorded failed answer with unknown usage if an offline replay
matches the second request hash and verifies the approved 64,000-token input
reserve. It retains the first call's full reserve and both original result sets.
After a first continuation with fully measured usage, a second memory stop
may leave one provider call without usage and its answer unwritten. A separately
approved continuation verifies both stopped segments and reserves 1,000,000
input and 16,384 output tokens for that call. All measured usage and completed
answers from both segments carry forward.
Other histories fail closed. The helper does
not authorize resumption, reset boot or Swapouts, or restart automatically.
Reports retain both result segments and the interruption and unknown usage.


The local paid runner also requires the supervisor's live IPC connection. After
successful resource observations, the supervisor sends monotonically numbered
samples; `assistant-monitor-lease.mts` checks them every 250 ms and at paid-call
boundaries. Disconnect, a missing/replayed lease, a sample older than 8 seconds,
or the fixed run deadline makes the worker record the stop and terminate its own
process group, including while awaiting an HTTP response. Both processes use the
host monotonic clock for lease age and the deadline. Wall-clock timestamps remain
in the audit records. No lease can revive an expired run. The 8-second lease is
a fail-closed detection bound, not a replacement for the 2-second resource
sampling interval or an OS no-swap claim.

`worker-monitor-leases.jsonl` records accepted samples, and
`provider-starts.jsonl` records each call before transmission. On worker-triggered
termination, `worker-monitor-stop.json` retains in-flight call IDs whose usage may
be unknown. A missing response never means zero cost. The manifest binds the lease
helper hash; normal completion requires `local-exit.json` and continuous matching
resource/lease records. Interrupted evidence stays immutable in its original
folder; a new run needs a new expressly authorized, frozen directory.
