# Exact-puzzle assets

This family is separate from the WCA statistics snapshot and its size limits. Small
histograms and witness examples are source artifacts. Full CSV/TXT gzip corpora
live under `stats/scramble/exact-puzzles/<event>/<sha256>/<file>` and stay outside Git
and Next deployment bundles. The original computation reports remain unchanged.

Run from the repository root with Node 24:

```sh
# One-time local migration of the existing verified public/ files and completion receipts.
node scripts/exact-puzzles/cli.ts migrate
# Stream-verify gzip bytes and prepare one tar per event plus a checksum-named manifest.
node scripts/exact-puzzles/cli.ts prepare .local/small-puzzle-distributions-20261023/publication
# Restore from prepared files into another empty stats root; validates every byte.
node scripts/exact-puzzles/cli.ts hydrate MANIFEST_JSON ARCHIVE_DIRECTORY DESTINATION_STATS_ROOT
# Small fixture only: archive restoration, replay, corruption and unsafe-path rejection.
node --test scripts/exact-puzzles/assets.test.ts
```

Preparation and restoration do not enumerate states or load solver tables. They
stream file hashes and tar I/O. Tar members must exactly match the manifest,
contain only regular files, and pass per-file checksums before installation.
Existing immutable destination files are verified and reused; differing files
are rejected. Per-depth rows and total rows are checked against the manifest.
The one-time migration checks every size, destination and filesystem first, then
renames without reading gzip contents. It saves the original manifest SHA, a
manifest backup and every source/destination in the local computation evidence
directory. Rollback reverses those same-volume renames and restores the backup;
it must also restore each completion receipt's `downloads` from that backup.

Publication is a separate explicit action:

1. `upload MANIFEST_JSON` uploads the prepared tar files and independent manifest
   to the existing `wca-data-latest` Release via the existing GitHub transport.
   It neither edits the shared Release body nor activates server files.
2. Restore on the static server with `hydrate-release MANIFEST_NAME STATS_ROOT`
   (or use `hydrate` with already-transferred archives). For the maintained server,
   the stats root is `/www/wwwroot/toolkit/stats`. The new immutable hash paths can
   coexist with the previously published paths.
3. `verify-published MANIFEST_JSON` streams all expected public static URLs and
   checks size and SHA, then writes the small publication receipt. This command
   makes no remote changes. Include the matching receipt and download manifest in
   the next code release.

Until step 3 succeeds, production hides full-state and per-depth download links.
Local development uses the local streaming `/stats/` handler after migration or
hydration. Complete histogram and bounded example CSVs remain available without
the large corpus. A changed download inventory invalidates the prior publication
receipt. Do not regenerate corpora in CI or relax the WCA snapshot limits.
