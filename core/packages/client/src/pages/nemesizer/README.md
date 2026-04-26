# Nemesizer

Route: `/nemesizer` — a client-side port of [nemesizer.com](https://nemesizer.com).

The nemesis algorithm follows the open-source reference implementation at
[huizhiLLL/WCA-Nemesizer-API](https://github.com/huizhiLLL/WCA-Nemesizer-API)
(Python + sqlite). We reimplement it client-side in TypeScript against
gzipped binary blobs, so queries are interactive (no per-request server hop)
and the page works offline once loaded.

## Definitions

Q is a **nemesis** of P iff:

1. `E_P ⊆ E_Q` (Q has rank in every event-kind P competes in)
2. `∀ ek ∈ E_P : rank_Q(ek) < rank_P(ek)` (Q strictly better in each)

P **nemesizes** Q is the symmetric relation with roles swapped: `E_Q ⊆ E_P` and
P strictly better in every E_Q ek. Note the asymmetry — the event-coverage
direction flips with the roles. A person with 0 ranks satisfies E_Q = ∅ ⊆ E_P
vacuously and is therefore counted in every iNem set.

**Nearly nemesis** of P: E_P ⊆ E_Q (or E_Q ⊆ E_P for reverse), strict winner in
all but exactly 1 ek of the relevant set, ties/loses in 1.

**Only just nemesis**: strict nemesis with min margin (rank gap over the
relevant ek set) equal to 1.

## Modes

- **Nemeses (宿敌)** — six relation views above + scope filter (world / continent / country) + people / countries display + CSV export
- **Head to head (对决)** — two-person ranks + results comparison, color-coded by who's better
- **What if (假设)** — override your own ranks in any (event, kind) and recompute the relation
- **Statistics (统计)** — most / fewest nemeses, biggest nemesizers, top countries (world only; depends on precomputed counts)

## Data pipeline

Binary files served from `stats/data/nemesizer/` (gzipped, decoded client-side via `DecompressionStream`):

| file | what | size (real WCA dump) |
|---|---|---|
| `persons.bin.gz` | WCA ID / name / country / continent per person | ~4 MB |
| `ranks.bin.gz`   | `personIdx / eventIdx / kind / worldRank / best` per rank | ~10 MB |
| `counts.bin.gz`  | `nemesisCount` / `nemesizedCount` per person (StatsMode) | ~2 MB |
| `meta.json`      | events / countries / continents lookup | < 100 KB |

Binary format defined in `@cuberoot/shared/nemesizer-format` (shared between Node builder and browser reader).

The WCA developer dump publishes `ranks_single` / `ranks_average` as schema-only
(actual rows are computed in WCA prod, never exported). So we recompute PBs from
`results` and rank with `RANK()` (not `ROW_NUMBER()` — ties must collapse so
rank-comparison is equivalent to strict best-comparison).

### Regenerating data

```bash
# Real WCA MySQL data (needs stats-build/database.yml configured)
# ~110s on a recent local SSD; the two ROW_NUMBER queries dominate.
pnpm --filter @cuberoot/stats-build nemesizer

# Mock 8-person dataset (no DB required, ~10 sec)
pnpm --filter @cuberoot/stats-build nemesizer -- --mock
```

The CI workflow `stats.yml` reruns this weekly and commits the regenerated
binaries. `deploy_mirror.yml` copies `stats/` wholesale, so no whitelist
change is needed for new data files.

## URL state

All four modes use query string so pages are shareable:

```
/nemesizer                                                 # search prompt
/nemesizer?mode=standard&person=2017YANR02&view=myNem&scope=world&show=people
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
│   └── nemesizerAlgo.ts   nemesis / nearly / onlyJust / scope filter
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

### Forward (myNem) algorithm

Smallest-prefix-first intersection (matches the Python ref's intersection loop):

1. Gather P's rank entries E_P.
2. For each `ek ∈ E_P`, compute `prefix(ek)` = persons with `rank < rank_P(ek)` in that ek (binary search).
3. Sort E_P by `|prefix(ek)|` ascending.
4. Initialize candidates = the smallest prefix.
5. For each remaining ek in order: filter candidates → keep only those with strictly-better rank in that ek.
6. Subtract P himself; the survivors are P's strict nemeses.

Per-query cost is O(min_prefix · |E_P|), sub-second in the browser even on the full WCA export.

### Reverse (iNem) algorithm

Iterate all persons; reject Q on the first non-conforming ek (Q has an ek not
in E_P, or Q's rank in some E_Q ek is not strictly worse than P's). Persons
with zero ranks pass vacuously.

## Numerical drift vs nemesizer.com

We use the latest WCA dump (refreshed weekly by `stats.yml`); nemesizer.com
publishes static snapshots roughly every two weeks. Across spot-checks this
manifests as a 0.05–0.5 % drift in the larger counts (ours and theirs differ
by ~100s of cubers in iNem) and a few-cuber drift in myNem. Same algorithm,
different dump dates.
