/** Owner-maintained semantics; executable configuration comes from the generator. */
export const definitions = [
  {
    id: 'wca-heavy', name: { zh: 'WCA 大规模成绩聚合', en: 'WCA heavy aggregations' },
    category: 'statistics', pages: ['/wca'], artifacts: ['stats.wca'],
    sources: ['core/jobs/stats-build/src/bin/compute_all.ts', '.github/workflows/stats.yml'],
    scope: 'Podium/PR streaks, moving averages, completed solves, round top-three sums and other heavyStatIds extracted from the isolation list.',
    basis: 'Imported WCA results; each statistic retains its own scope.',
    cost: 'HEAVY_STATS is a memory-isolation classification, NOT a CPU ranking or uniform measured memory threshold. Individual entries have exceptions; comparable CPU measurements are unknown.',
    update: { trigger: 'workflow', execution: 'GitHub Actions runner', strategy: 'compute_all computes selected statistics from the imported dump; stats_filter can restrict IDs. Other builders/imports have separate strategies.' },
    publication: 'Validated JSON owner patches publish to wca-data-latest/static statistics. Database builders have separate transfer/load steps. Code push only syntax-checks this workflow.'
  },
  {
    id: 'wca-history', name: { zh: 'WCA 历史排名与纪录演化', en: 'WCA historical ranks and records' },
    category: 'statistics', pages: ['/wca/results', '/wca/records'], artifacts: ['stats.wca'],
    sources: ['.github/workflows/stats.yml', 'core/jobs/stats-build/src/bin/historical_ranks_build.ts', 'core/jobs/stats-build/src/bin/sor_over_time_build.ts', 'core/jobs/stats-build/src/bin/sor_over_time_daily_build.ts'],
    scope: 'Historical ranking snapshots, historical best SOR, daily SOR evolution and historical WR/CR/NR records.',
    basis: 'Historical result replay and time-series snapshots, not only current personal bests.',
    cost: 'Large historical result replay/aggregation; no comparable CPU or memory measurement registered.',
    update: { trigger: 'workflow', execution: 'GitHub Actions runner', strategy: 'Full workflow builds rank snapshots; best-rank SOR consumes those TSVs; daily SOR replays competition-day results. Separate wca_results_flat imports use competition fingerprint deltas. Do not label the entire chain incremental.' },
    publication: 'Historical ranks/best SOR transfer TSV/load SQL into PostgreSQL; daily SOR and record histories publish JSON.'
  },
  {
    id: 'scramble', name: { zh: '比赛打乱阶段难度与最优步数', en: 'Competition scramble difficulty and optimal lengths' },
    category: 'statistics', pages: ['/scramble/stats'], artifacts: ['stats.scramble'],
    sources: ['scripts/stats/update-local.ts', 'scripts/stats/update-published.ts', 'core/package.json'],
    scope: 'stages (Cross/XCross and other 3x3 goals), 333opt (whole-cube optimal), puzzles (2x2, Pyraminx, Skewb, Clock, SQ1 and selected puzzle jobs).',
    basis: 'Competition scramble corpus, not a uniform full-state distribution.',
    cost: 'Per-scramble stage/optimal solving, including expensive 3x3/SQ1 searches; no measured cross-job CPU ordering.',
    update: { trigger: 'manual', execution: 'Local computation machine', strategy: 'Explicit stages/333opt/puzzles entry: incremental fetching, missing-result backfill and checkpoint continuation. Cached/publish-only modes reuse results. Unresolved puzzle states remain marked unresolved and may accompany a partial publication.' },
    publication: 'Publishing entry loads relevant PG tables, submits the Release and incrementally publishes static shards. Local-only entry does not publish.'
  },
  {
    id: 'exact-distributions', name: { zh: '精确分布与全状态数据集', en: 'Exact distributions and full-state datasets' },
    category: 'statistics', pages: ['/scramble/stats'], artifacts: ['client.precomputed-exact-puzzle-distributions', 'client.exact-puzzle-state-downloads'],
    sources: ['docs/data/artifacts/generated-artifacts.json', 'core/packages/client/scripts/export-exact-puzzle-distributions.mts', 'scripts/exact-puzzles/cli.ts'],
    scope: 'Registered exact puzzle/goal histograms, farthest-state witnesses and full-state downloads.',
    basis: 'Full-state exact distances with explicit move metric/frame; some distributions derive from existing verified tables.',
    cost: 'Depends on enumerated states and method. Small BFS, closed-form counts and reading histograms are NOT automatically heavy. Per-target CPU measurements are not registered here.',
    update: { trigger: 'manual', execution: 'Resource-guarded offline computation', strategy: 'Enumerate or reuse verified tables, validate counts/witnesses, then export histograms. Full-state downloads stream separately; summary export does not rerun BFS.' },
    publication: 'Compact histogram JSON ships with Web code. Large full-state downloads use a separate verified asset/manifest chain.'
  },
  {
    id: 'lsll', name: { zh: 'LSLL 批量最优解', en: 'LSLL batch optimal solutions' },
    category: 'statistics', pages: ['/alg/lsll'], artifacts: [],
    sources: ['solver/lsll/README.md', 'solver/lsll/update_lsll.mts'],
    scope: 'Trainable LSLL case optimal solutions and lengths; excludes O class.',
    basis: 'Minimum HTM over pre/post AUF equivalence, not one display representative.',
    cost: 'Batch optimal solving of case AUF images. Owner README historical benchmarks are not a current site-wide CPU ranking.',
    update: { trigger: 'manual', execution: 'Local solver machine', strategy: 'Batch solving checkpoints by case key; update_lsll exports cases and applies row-manifest differences. --export-only skips loading; --solve explicitly requests solving.' },
    publication: 'Exported CSV is diffed against the target PG row manifest, then changed rows load into PostgreSQL.'
  },
  {
    id: 'double-zbll', name: { zh: '双底 ZBLL 题库与摘要', en: 'Double-bottom ZBLL corpus and summary' },
    category: 'statistics', pages: ['/alg/double-zbll-about'], artifacts: ['trainer.double-zbll'],
    sources: ['docs/product/timer/double-zbll-trainer.md', 'core/packages/client/scripts/summarize-double-zbll.mts'],
    scope: 'Batch optimal solving, candidate selection and resulting corpus length distributions.',
    basis: 'Frozen case/candidate corpus, canonical AUF and explicit selection criteria.',
    cost: 'Upstream batch solving is heavy. Summary refresh only aggregates installed corpus data without loading solver tables.',
    update: { trigger: 'manual', execution: 'Local solving/export then corpus installation', strategy: 'Reuse verified solve journals, export/install the corpus and regenerate its summary when it changes. CI/browser startup does not rerun heavy solving.' },
    publication: 'Verified hash-named corpus assets/manifest and compact statistics JSON ship through the artifact owner.'
  },
  {
    id: 'solver-tables', name: { zh: '求解器预计算表（依赖）', en: 'Solver precomputed tables (dependencies)' },
    category: 'dependency', pages: ['/dev/solvers'], artifacts: ['solver.tables-wasm'],
    sources: ['docs/data/artifacts/generated-artifacts.json', 'docs/contributing/compute.md'],
    scope: 'Pruning/distance tables supporting statistics; not an ordinary statistical leaderboard.',
    basis: 'Solver-specific coordinates, metrics and verified formats.',
    cost: 'Some builds require substantial memory/CPU; table size alone is not a CPU measurement.',
    update: { trigger: 'manual', execution: 'Explicitly authorized resource-guarded machine', strategy: 'Generate/verify the table family and reuse it across solves. Ordinary CI/page opening does not rebuild large tables. Metadata reads never start or authorize computation.' },
    publication: 'Large local tables stay outside Git; runtime artifacts have their own deployment contracts.'
  }
];
export const coverage = {
  level: 'registered-families',
  statement: 'Returns all registered main families including dependencies, not proof that every costly statistic or experimental solver has been enumerated.',
  excluded: [
    { artifact: 'stats.upcoming', reason: 'Separate lightweight feed synchronization.' },
    { artifact: 'stats.competition-calendar', reason: 'Derived index; no heavy-cost evidence.' },
    { artifact: 'stats.world-bests', reason: 'External scraping; no heavy-cost evidence.' },
    { artifact: 'client.code-language-history', reason: 'Manual Git-history snapshot; cost not measured here. CI/page reads reuse it.' }
  ],
  gaps: ['Per-target exact-enumeration costs', 'Comparable CPU/memory measurements', 'Local run receipts not uploaded', 'Per-family publication times without receipts', 'Unregistered experimental jobs']
};
