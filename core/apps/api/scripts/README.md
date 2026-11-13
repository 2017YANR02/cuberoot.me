# Local full-stack dev (edit DB data before push)

For push acceptance, use `pnpm --filter @cuberoot/server push:acceptance` from `core/` and the [separate acceptance entry](../../../../docs/record-notification-setup.md#6-隔离-api-与推送验收入口). This loopback fixture API does not load production auth, `.env`, PG, monitors or provider transports. The selective production proxy described below is not a push isolation environment.

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

## Frozen before/after assistant evaluation

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
