# Drift notifications

The icons, Best 2x2, regulation and SQ1 workflows serialize each detector with
`cancel-in-progress: false` and use `drift-issue.mts`. Do not restore direct,
unconditional `gh issue create` or `gh issue comment` calls.

Reports include `sourceMarker()` over semantic upstream content: SVG blob hashes,
normalized sheet hashes, regulation article hashes, or SQ1 content/presentation
digests and invariants. Scan time, ZIP metadata and SQ1 discussion-only changes
do not change notification identity. Do not hash only a truncated human report.

The publisher reads open and closed issues and every comments page. The latest
managed version suppresses retries, including a successful write whose response
was lost. Genuine revisions and reverts reuse the same issue; closed unchanged
versions stay closed. Original descriptions and human comments are preserved.
Invalid reports, oversized bodies and failed history reads stop before posting.
Existing legacy issues receive one versioned report on the first detected drift;
subsequent identical runs are silent. Existing duplicates are not deleted.

Run `node --test scripts/drift-issue.test.mts` from `core/`; each detector workflow
runs this check before fetching/publishing. WCA news uses its separate per-source
digest publisher and aborts issue publication above 50 changed sources per run;
inspect the retained source/report artifact rather than resetting the baseline or
removing that guard to make a failed detector green.
