# 3×3 stage table coordinate checks

These bounded research models verify candidate goals, symmetries and coordinate
sizes. They do not load or generate pruning tables, run an analyzer, or change
production table selection. Results are not throughput measurements.

- `model.mjs` derives 48 spatial symmetries from `cube_common.rs`, checks move
  conjugation and counts fixed states/coordinate orbits for candidate tables.
- `rank-probe.mjs` checks the C4 canonical rows and the additional E7 residual
  position/flip coordinate. It consumes the first model's evidence JSON.
- `pseudo-pair-goals.rs` checks Pair/PseudoPair goal seeds, a depth-3 joint bound,
  and the four PseudoXX target classes. See [pair-study.md](pair-study.md).
- The separate [F2LEO compact Cross experiment](../f2leo-compact-cross/README.md)
  implements and tests its collision-free coordinate.

Run the JavaScript checks from the repository root:

```sh
mkdir -p .local-data/stage-table-audit-20261110
node --max-old-space-size=32 solver/experiments/stage-table-coordinates/model.mjs
node --max-old-space-size=32 solver/experiments/stage-table-coordinates/rank-probe.mjs
```

Compile the Rust goal model without the solver's table managers or dependencies:

```sh
mkdir -p .local-data/pseudo-pair-table-study-20261110
rustc --edition=2021 -O solver/experiments/stage-table-coordinates/pseudo-pair-goals.rs -o .local-data/pseudo-pair-table-study-20261110/goal-model
.local-data/pseudo-pair-table-study-20261110/goal-model
```

Evidence from 2026-11-10 is retained in those `.local-data` directories. The models
use only small transformations, coordinates, and the bounded depth-3 graph.
Any real PDB generation/integration requires the existing unified generator,
resource review, checkpoints and separate correctness/performance acceptance;
the consumed stage-benchmark receipts do not cover it.
