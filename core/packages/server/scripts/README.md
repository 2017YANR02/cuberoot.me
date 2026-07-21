# Local full-stack dev (edit alg data before push)

By default `pnpm --filter @cuberoot/client dev` proxies **all** `/v1/*` to the prod
API (see `client/next.config.ts`), so you get real data with zero local setup — but
you can't test **data** changes (case moves, subgroup renames, new algs) without
pushing to prod first.

The fix is a **selective** local proxy, the same pattern this repo already uses for
`/v1/forum`: route only the API you're editing to a local server + local DB, and keep
everything else on prod. A blanket "dev → local DB" switch is deliberately avoided —
it would break every page whose data (WCA stats is GBs, recon, forum, …) isn't seeded
locally. Today this is wired for **alg**.

## One-time

- Local `pg13` docker must be up (`127.0.0.1:5433`, password `dev`, db `cuberoot_db`).
- Seed the alg tables from prod (read-only `pg_dump`, re-runnable):

  ```pwsh
  pnpm --filter @cuberoot/server seed:local-alg
  ```

## Each session

1. Run the local API against pg13 (leave it running):

   ```pwsh
   pnpm --filter @cuberoot/server dev:local
   ```

   Hono comes up on `http://127.0.0.1:3001`; only `/v1/alg/*` will be used.

2. Start (or restart) the frontend with the toggle on:

   ```pwsh
   $env:LOCAL_ALG='1'; pnpm --filter @cuberoot/client dev
   ```

   Now `loadAlg()` and every `/v1/alg/*` call hit your **local** DB; all other
   endpoints still hit prod. Edit alg data via the admin API (`X-Admin-Key`) or SQL
   against pg13, refresh, and see it immediately — no push required.

To go back to all-prod, just start the frontend **without** `LOCAL_ALG` set.

## Notes

- `seed-local-alg.ps1` reads the prod DB password from `$env:PROD_PG_PASS` or the
  gitignored repo-root `.password.md`; nothing secret is committed.
- Re-run the seed anytime to reset local alg data to current prod.
- To test a **migration** locally, apply it to pg13 after seeding:
  `Get-Content migrations/00xx_*.sql | docker exec -i pg13 psql -U postgres -d cuberoot_db`.
