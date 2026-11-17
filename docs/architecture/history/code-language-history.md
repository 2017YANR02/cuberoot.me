# Code language history

The Code language history section is embedded in the Architecture overview at `/dev/architecture#code-history` and uses the official `github-linguist` 9.7.0 gem. The former `/dev/code-history` and `/dev/architecture/code-history` URLs, including language-prefixed forms, return HTTP 404 without a redirect. The component and snapshot live under `core/packages/client/app/[lang]/dev/architecture/_components/code-history/`. The snapshot stores byte counts for every detected language, each day's source commit, the branch, and timezone. No hand classification or line counting is used.

The chart and selected-day bar separately show every language reaching 1% on any day in the snapshot: TypeScript, JavaScript, CSS, HTML, Rust, PLpgSQL, C++, Python, Ruby, PHP. Recheck this set when refreshing the snapshot. Colors come from Linguist's language registry; order and colors remain fixed across dates. Other contains only the remaining small languages. Labels round actual byte shares to one decimal; geometry retains unrounded shares. Rounding can make displayed totals differ slightly from 100%.

Daily snapshots follow `main`'s first-parent history, using America/Los_Angeles dates and carrying the previous state through days without commits. They describe retained Git history, not historical deployment dates. Rewritten or removed commits cannot be recovered by this chart. The current partial day is included and the snapshot is not automatically refreshed at page load or build time.

To refresh, install Ruby and the official gem (`gem install github-linguist -v 9.7.0`), then from `core/` run. On macOS, the gem's native extensions need CMake, pkg-config and ICU; use Homebrew Ruby instead of the system Ruby for the generator. A read-only plan does not load the gem:

```sh
ruby packages/client/scripts/build-code-history.rb --plan
ruby packages/client/scripts/build-code-history.rb
```

Run the repeatable planning and checkpoint regression checks with `ruby packages/client/scripts/check-code-history.rb` from `core/`; they use only Ruby's standard library and do not load Linguist or change Git history or the real snapshot/cache.

The Ruby script remains an adapter to Linguist's Ruby API, which provides incremental analysis; it is not a separate language detector. It pins `main` to a commit at startup and saves each completed day, including Linguist's per-file cache, to `.local-data/code-language-history/checkpoint.json`. A lock prevents concurrent writers; checkpoint and public snapshot writes are atomic. The old Git-directory checkpoint is read when present and left intact during migration.

Repeated runs reuse completed days. More commits on the final saved day replace that day's partial snapshot through the same incremental API. Changes to older saved days or unrelated replacement commits still fail closed; preserve the checkpoint and snapshot before investigating a rewritten history. When no cache exists, the checked-in snapshot supplies the verified historical prefix: the generator analyzes its last matching commit once, checks that its byte counts match, and then analyzes only missing days. It does not rescan the entire retained history on a new machine. Keep the engine version and timezone unchanged unless deliberately rebuilding the series.

The [Update Code Language History workflow](../../../.github/workflows/code_language_history.yml) runs daily at 18:23 UTC (10:23 PST / 11:23 PDT), independently of Codex, this chat, and local computers. GitHub may delay scheduled jobs; this is a daily refresh, not an exact-time delivery guarantee. `workflow_dispatch` runs the same job on `main` for an on-demand refresh. The architecture log and its authored scenes remain separate from this deterministic chart job.

The workflow reuses this generator and its incremental checkpoint. If the only commits since the published snapshot changed `history.json`, it skips Linguist and publishing, so the bot does not generate an endless chain of snapshot-only commits. Real source changes are detected by paths, regardless of author or commit message. A missing CI cache bootstraps from the checked-in snapshot, without rescanning every historical day. The job is serialized and bounded to 30 minutes; a failed analysis leaves the published chart unchanged and saves completed checkpoint progress where possible.

Only the generated `history.json` is committed. Publication reuses the existing `AUTOMATION_PUSH_SSH_KEY` deploy key, as in the Recon backup workflow, so the new commit triggers normal Web checks and both website deployments. It does not use `GITHUB_TOKEN` pushes or `[skip ci]`, which would suppress those checks. Concurrent changes are rebased without force-pushing; a conflict fails without overwriting anyone's work. The chart becomes visible after the existing production gates pass. No page request or Next build runs Linguist. The job uses ordinary GitHub Actions build minutes and no AI service.

The previous weekly Codex task now maintains only the architecture log/scenes. Archiving that chat can remove its architecture task, but cannot remove or stop this repository workflow. Follow repository resource rules when manually running the analysis locally.

The 2026-11-16 refresh reached `0ff1eb88a` (339 calendar days). It reused 232 committed days and analyzed 17 days in 113 seconds, including a 36-second cache bootstrap and two approximately 35-second full scans triggered by `.gitattributes` changes. Ordinary incremental days took 0.14–0.76 seconds; an unchanged rerun took 0.10 seconds. Observed peak RSS was 1.13 GiB, with no new swap-outs. These are measurements on the maintainer's Mac, not fixed runtime guarantees; Linguist itself decides when attributes require a full scan.
