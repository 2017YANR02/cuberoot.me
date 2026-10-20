# Contests maintenance

## CubeRoot public UI

The bilingual public interface lives in `core/packages/client/app/[lang]/contests/`.
Its query URLs keep contest/person IDs and filters shareable without generating
thousands of Next pages. WCA person profiles link by WCA ID; numeric RecordRanks
IDs remain authoritative for competitors without a WCA ID. Official WCA results
remain separate.

The Hono `/v1/contests` GET gateway forwards only validated public queries to
`https://contests.cuberoot.me/api/default/cuberoot`. The CubeRoot RecordRanks fork
owns that adapter and reuses its existing ranking, record and result-formatting
implementations (including the distinct RecordRanks multi-blind encoding).
The adapter is enabled only with `PROJECT_ID=cuberoot-contests`, and rejects a
private default organization. It never returns user accounts or moderation data.

The independent public views offer Chinese and English links into the matching
main-site page, preserving event, contest, region and result-category filters.
Existing routes are retained without redirects. Administration, authentication,
exports and source rules remain available on the independent application.
The daily importer sets the instance name, description and website separately
from imported event/result data. Missing contact email is omitted in the fork;
no address is fabricated.

Release order for the first integration release (local development is not a release):

1. Validate and publish the changes in the `2017YANR02/RecordRanks` fork, whose
   default Mac checkout is `/Users/eula/Developer/RecordRanks`. Pin that published
   commit in `recordranks-ref.txt`; the old pin lacks `/api/default/cuberoot`.
2. Deploy Contests with the new pin and verify the public adapter.
3. Publish the main repository changes and confirm the API and Next deployments.

For local validation, use the fork's PGlite-backed tests; do not connect a dev
RecordRanks process to the production DB (its instrumentation can seed data).
Browser fixtures verify the host UI separately from live deployment acceptance.

- Upstream code: run `pnpm --dir core upstream:sync --only recordranks`, review the pinned SHA change, then commit and push this repository.
- Upstream public data: `Deploy Contests` downloads and validates the v1 CSV export in CI, then imports it transactionally on every deployment and once per day.
- Manual refresh: run `gh workflow run deploy_contests.yml` from this repository.
- The import replaces the `default` organization's public events, people, contests, rounds, and results. A failed download, validation, or SQL statement rolls the transaction back.
- The pinned app does not implement higher-is-better rankings yet, so imports accept that CSV column only while every value is false.
