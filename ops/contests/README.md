# Contests maintenance

- Upstream code: run `pwsh -NoProfile -File .\sync_upstream.ps1 -Only recordranks`, review the pinned SHA change, then commit and push this repository.
- Upstream public data: `Deploy Contests` downloads and validates the v1 CSV export in CI, then imports it transactionally on every deployment and once per day.
- Manual refresh: run `gh workflow run deploy_contests.yml` from this repository.
- The import replaces the `default` organization's public events, people, contests, rounds, and results. A failed download, validation, or SQL statement rolls the transaction back.
- The pinned app does not implement higher-is-better rankings yet, so imports accept that CSV column only while every value is false.
