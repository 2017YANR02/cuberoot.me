# Second Layer conditional-state audit

## Semantics

The input, not just the terminal state, has a solved D first layer:

- D-layer corners 4..7 are solved in position and orientation;
- D-cross edges 8..11 are solved in position and orientation;
- the four labelled middle-layer edges 0..3 may occupy any remaining edge
  position with either orientation.

The goal also solves edges 0..3, so the terminal state has the full first two
layers solved. Search may temporarily disturb the first layer. Requiring it to
remain solved after every move would leave only U turns and make almost every
input unreachable.

The goal predicate equals `std` stage 4 (`xxxxcross`), but the problem does not:
`std` accepts arbitrary cube states, whereas this distribution is conditioned
on the first layer already being solved. WCA / XXXXCross samples therefore
cannot stand in for this dataset.

## Exact quotient and result

The U-layer corners and edges are irrelevant fillers. Once the first layer is
fixed, the complete target-relevant input coordinate is only the four labelled
middle-layer edges:

`P(8,4) * 2^4 = 26,880` states.

`src/bin/second_layer_distribution.rs` enumerates each coordinate exactly once
and calls the exact IDA* primitive in `XCrossSolver::second_layer_distance`.
The admissible heuristic is the maximum of four exact single-slot PDB values;
the goal test requires all four slots. The resulting HTM distribution is:

`[1, 0, 0, 0, 0, 22, 24, 283, 682, 2590, 7006, 12400, 3854, 18]`

The counts sum to 26,880 and prove God's number 13 HTM. A 14-thread release run
on the development machine completed the enumeration in 57.75 seconds.

## Resources and integration

The offline enumerator loads the existing `pt_cross_C4E0` single-slot PDB
(54,743,056 bytes) and `mt_edge4` (18,247,692 bytes), plus two 1,740-byte move
tables: 72,994,228 known table bytes (69.61 MiB) total. It does not map the
22.9 GiB XXXXCross pair tables and creates no persistent table.

The client stores only the 14-bin precomputed histogram. It runs no BFS or
IDA*, downloads no solver table, and exposes the result under the separate
`First layer solved` / `第一层已还原` dataset. The old WCA, recent-scramble,
generator, timer and live StageSolver aliases are intentionally removed.

`tests/second_layer_audit.rs` locks the coordinate cardinality, physical target
predicate, shallow independent IDDFS agreement in all six views, and agreement
between conditional coordinates and ordinary algorithm-applied cube states.
