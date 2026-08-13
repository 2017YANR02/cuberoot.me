# Contests maintenance

- Upstream code: run `pwsh -NoProfile -File .\sync_upstream.ps1 -Only recordranks`, review the pinned SHA change, then commit and push this repository.
- Upstream public data: `Deploy Contests` refreshes the v1 CSV export transactionally on every deployment and once per day.
- Manual refresh: run `gh workflow run deploy_contests.yml` from this repository.
- The import replaces the `default` organization's public events, people, contests, rounds, and results. A failed download, validation, or SQL statement rolls the transaction back.
