# Code language history

`/dev/code-history` uses the official `github-linguist` 9.7.0 gem. The snapshot stores byte counts for every detected language, each day's source commit, the branch, and timezone. No hand classification or line counting is used.

The chart and selected-day bar separately show every language reaching 1% on any day in the snapshot: TypeScript, JavaScript, CSS, HTML, Rust, PLpgSQL, C++, Python, Ruby, PHP. Recheck this set when refreshing the snapshot. Colors come from Linguist's language registry; order and colors remain fixed across dates. Other contains only the remaining small languages. Labels round actual byte shares to one decimal; geometry retains unrounded shares. Rounding can make displayed totals differ slightly from 100%.

Daily snapshots follow `main`'s first-parent history, using America/Los_Angeles dates and carrying the previous state through days without commits. They describe retained Git history, not historical deployment dates. Rewritten or removed commits cannot be recovered by this chart. The current partial day is included and the snapshot is not automatically refreshed at page load or build time.

To refresh, install Ruby and the official gem (`gem install github-linguist -v 9.7.0`), then from `core/` run:

```sh
ruby packages/client/scripts/build-code-history.rb
```

The small Ruby script is an adapter to Linguist's Ruby API, which provides incremental analysis; it is not a separate language detector. It saves a resumable checkpoint in the Git directory and leaves the checkout intact. If history has changed, it refuses stale checkpoints; preserve the old checkpoint before removing it and rebuilding. Follow repository resource rules when running the analysis.
