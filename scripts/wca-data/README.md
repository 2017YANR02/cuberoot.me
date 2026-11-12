# Latest WCA data Release

`wca-data-latest` holds the current search/Nemesizer archive and the published statistics snapshot. It is a mutable data channel, not a website software version. Other asset families sharing this transport are not managed by WCA cleanup.

The Release body starts with a short Chinese introduction. A marked JSON code block inside a collapsed details section remains the publication manifest. `readReleaseBody` accepts both the original JSON body and this format; both publishers preserve the introduction. Old checkouts that parse the body directly as JSON must pull current scripts before hydration or publication.

`Maintain WCA data Release` runs daily at 09:17 UTC and after the WCA publication workflow completes. Manual dispatch defaults to a dry run. It shares the `deploy-core-production` queue, defers while any data publication is running or waiting, and rechecks the manifest before each deletion. Lookup or validation errors stop cleanup.

- Always retain the archives referenced by the current manifest.
- A successful publication removes its own merged patch/candidate and superseded snapshot/archive.
- Maintenance removes remaining known WCA archives, snapshots, candidates and patches after seven days. Fresh candidates protect their matching archives even when the archive was uploaded earlier. Pending publications defer expiry.
- Unknown names, independent exact-puzzle assets, Git tags and source history are untouched.
- GitHub's automatic source zip/tar links are not uploaded release assets and cannot be individually deleted through the release asset API.

Read-only preview: `node scripts/wca-data/maintenance-cli.ts`. Apply through the workflow (`dry_run=false`); this command does not connect to the production server or deploy an application. Verify with `node --test scripts/wca-data/*.test.ts`.
