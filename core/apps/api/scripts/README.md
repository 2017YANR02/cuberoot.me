# Local full-stack dev (edit DB data before push)

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

  ```pwsh
  pnpm --filter @cuberoot/server seed:local-alg           # shortcut: alg_sets + alg_cases
  pnpm --filter @cuberoot/server seed:local wiki_terms    # any other domain, by table name
  ```

## Each session

1. Run the local API against pg13 (leave it running):

   ```pwsh
   pnpm --filter @cuberoot/server dev:local
   ```

   Hono comes up on `http://127.0.0.1:3001`; only the domains you pick below use it.

2. Start (or restart) the frontend with the domains you're editing:

   ```pwsh
   $env:LOCAL_DOMAINS='alg'; pnpm --filter @cuberoot/client dev     # comma list: 'alg,wiki'
   ```

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
- `seed-local.ps1` reads the prod DB password from `$env:PROD_PG_PASS` or the gitignored
  repo-root `.password.md`; nothing secret is committed. Re-run anytime to reset.
- To test a **migration** locally, apply it to pg13 after seeding:
  `Get-Content migrations/00xx_*.sql | docker exec -i pg13 psql -U postgres -d cuberoot_db`.
