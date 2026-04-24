# Nemesizer

Route: `/nemesizer` — a client-side port of [nemesizer.com](https://nemesizer.com).

Given a WCA competitor P, Nemesizer answers:

- **My nemeses (我的宿敌)** — who is strictly better than P in every event they both hold a rank in (and shares ≥ 1 event).
- **Who I nemesize (谁视我为宿敌)** — the reverse: P is strictly better than them in every shared event.
- **Nearly nemesis** — same as nemesis except for exactly 1 shared event where the relation is flipped.
- **Only just nemesis** — nemesis where the smallest margin is exactly 1 rank.
- **Head to head** — two-person rank / result comparison (green = better).
- **What if** — override your own ranks in any (event, kind) and recompute.
- **Statistics** — most nemeses, fewest nemeses, biggest nemesizers, top countries.

## Data pipeline

Binary files served from `stats/data/nemesizer/` (gzipped, decoded client-side via `DecompressionStream`):

| file | what | size (mock 8-person) | size (full WCA export, approx) |
|---|---|---|---|
| `persons.bin.gz` | WCA ID / name / country / continent per person | 326 B | ~5 MB |
| `ranks.bin.gz`   | `personIdx / eventIdx / kind / worldRank / best` per rank | 2.7 KB | ~8 MB |
| `counts.bin.gz`  | precomputed `nemesisCount` / `nemesizedCount` per person | 76 B | ~1 MB |
| `meta.json`      | events / countries / continents lookup | — | < 100 KB |

Binary format defined in `@cuberoot/shared/nemesizer-format` (shared between Node builder and browser reader).

### Regenerating data

```bash
# Real WCA MySQL data (needs stats-build/database.yml configured)
pnpm --filter @cuberoot/stats-build nemesizer

# Mock 8-person dataset (no DB required, ~10 sec)
pnpm --filter @cuberoot/stats-build nemesizer -- --mock
```

Then commit the generated files under `stats/data/nemesizer/` to main. `deploy_mirror.yml` copies `stats/` wholesale so no whitelist change is needed.

Full-export run computes nemesis counts for every person (O(N · avg-events · avg-rank-prefix)) — expect a few minutes on ~450 K persons.

## URL state

All four modes use query string so pages are shareable:

```
/nemesizer                                         # search prompt
/nemesizer?mode=standard&person=2025WANY02&view=iNem&scope=world&show=people
/nemesizer?mode=h2h&p1=2019WANY36&p2=2023GENG02&show=results
/nemesizer?mode=whatif&person=2023GENG02&view=myNem
/nemesizer?mode=stats&tab=biggest
```

## Architecture

```
pages/nemesizer/
├── NemesizerPage.tsx      route entry + mode switch
├── nemesizer.css
├── data/
│   ├── nemesizerData.ts   fetch + gunzip + build indexes (byEk, rankOfPerson, etc.)
│   └── nemesizerAlgo.ts   nemesis / nearly / onlyJust / what-if
├── components/
│   ├── NemesizerBrand.tsx
│   ├── PersonCell.tsx
│   └── PersonSearch.tsx
└── modes/
    ├── StandardMode.tsx   search + 6 relation views + scope + people|countries + CSV export
    ├── H2HMode.tsx        two-person table, ranks or results
    ├── WhatIfMode.tsx     rank override → recompute
    └── StatsMode.tsx      most / few / people / biggest / countries (world only)
```

### Algorithm sketch

For each person P:

1. Gather P's rank entries `E_P` (one per event × kind).
2. For each `ek ∈ E_P`, split that ek's globally-sorted list at `rank_P(ek)`:
   - prefix = people better than P in that ek
   - suffix = people worse (≥) than P in that ek
3. `candidates = ⋃ prefix(ek)` (Q wins in ≥ 1 shared ek).
4. `disqualified = ⋃ suffix(ek)` (Q loses in ≥ 1 shared ek).
5. `nemeses(P) = candidates \ disqualified` (minus P himself).

`invert=true` swaps prefix/suffix to compute who P nemesizes.

The algorithm runs per-person in time O(|E_P| · |prefix|), so a single person's nemesis list is sub-second in the browser even on the full WCA export. Global counts (`counts.bin`) are precomputed at build time for the Statistics tab to avoid N² in the browser.

## Known deviations from nemesizer.com

- No left-hand drawer navigation. The four tabs live inline.
- Statistics tab is world-scope only (nemesizer.com has continent/country). Requires an anchor person, not in MVP.
- No "About Nemesizer" page.

## References

- Original: https://nemesizer.com (client-side port; definitions and UI semantics match).
- Design spec: `docs/superpowers/specs/2026-04-24-nemesizer-design.md`.
