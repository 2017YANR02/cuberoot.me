# F2LEO compact Cross coordinate

Status: generated, verified and enabled by default on 2026-11-10. Production code
is in `../../src/f2leo_compact_table.rs`; this crate tests that same coordinate
implementation. The completed table is **106,444,816 bytes**, including its 16-byte
header, and covers **212,889,600 states** in ten distance layers, 0 through 9.

The default feature `f2leo-compact-table` uses `CUBE_F2LEO_COMPACT_MODE=off|first`,
defaulting to `first`. Native F2LEO and Pseudo F2LEO now answer the first (Cross)
stage with exact table lookups. `off` retains the original Cross search for
comparison. Later-stage searches are unchanged. Missing tables produce an error;
solver initialization never generates them.

The original `off`-mode native `f2leo_solver.rs` and `pseudo_f2leo_solver.rs` Cross searches
prune on the cross alone and check the four free F2L edges' orientation at leaves.
Their later stages also omit free-edge EO from their block pruning tables.
`src/bin/dist_tracked.rs` already models the complete Cross + F2L EO goal using
`Edges([DB, DR, DF, DL]) × EdgeSet([FR, FL, BL, BR])`. Its independent distribution
results are documented in `../../EXACT_DIST_EXPANSION.md`, sections E3 and P4.

This experiment changes the coordinate address space, not that goal.

## Production acceptance (2026-11-10)

The protected table build reported **2.2 s**, with process-tree peak RSS
**402,063,360 bytes** against a 1 GiB budget. Full reachable-state counts and all
ten distance layers matched the independent distribution; the diameter is 9.
Swapouts remained 336 throughout generation and the four comparison jobs.

Each solver/version used 18 threads, one 100-case warmup, then the same fixed
1,000-case input three times. Its process and tables stayed resident across all
four batches. Every candidate matched **74,400 distances** from its corresponding
baseline, including the warmup; output hashes were identical.

| Solver | `off` batches (s) | `first` batches (s) | Median per 1,000 cases |
| --- | --- | --- | --- |
| F2LEO | 0.95 / 0.19 / 0.20 | 0.21 / 0.19 / 0.19 | 0.20 → 0.19 s |
| Pseudo F2LEO | 1.98 / 1.72 / 1.78 | 1.70 / 1.55 / 1.59 | 1.78 → 1.59 s |

The standard F2LEO difference is too small to establish a stable speedup: the
reported times have 0.01 s resolution, and its first baseline batch differs
substantially from the following batches. Pseudo F2LEO's median elapsed time fell
**10.7% in this comparison**. These sequential runs on a fixed input establish
the observed result, not a general speedup guarantee.

Existing node counters omit Cross work. Their unchanged counts therefore do not
measure the Cross search removed by `first`: this stage now uses exact lookup.
The remaining stage searches keep their existing implementation and node counts.

Evidence at repository root:

- `.local-data/stage-pdb-build-20261110/f2leo-acceptance.json`
- `.local-data/stage-pdb-build-20261110/jobs/f2leo-compact-generate/execution.json`
- `.local-data/stage-pdb-build-20261110/jobs/{f2leo,pseudo-f2leo}-{off,first}/execution.json`

## Exact size and equivalence

Four labeled cross edges occupy `P(12,4) = 11,880` position tuples. Four unlabeled
free edges choose `C(8,4) = 70` of the remaining positions. All eight tracked edges
have independent flip bits because an untracked edge can supply the total flip
parity. The four untracked edges can be placed arbitrarily; a corner transposition
can supply the required permutation parity. Every coordinate therefore extends
to a legal full cube.

```
positions = 11,880 × 70 = 831,600
states    = 831,600 × 256 = 212,889,600
4-bit     = 106,444,800 bytes = 101.513671875 MiB
```

The current product representation allocates `190,080 × 7,920 = 1,505,433,600`
entries, or `752,716,800` packed bytes (717.8466796875 MiB). The difference is
entirely impossible position overlaps. Compact indexing retains exactly 1/7.0714
of its addresses: 85.86% less storage, with the same reachable graph and distances.

`Coordinate::rank` uses a mixed-radix permutation rank, a residual eight-position
subset rank, then eight flip bits. `unrank` reverses these three independent
operations. Free edges remain sorted by physical position. Permuting their
identities changes neither the move result nor the goal, so this is an exact
quotient, not a lower-information heuristic for the Cross stage.

A move applies the existing single-edge transition to all eight entries and
resorts the free set. Moves permute positions bijectively, preserving disjointness.
Projection of a full cube commutes with every move. Thus any abstract solution
lifts to the same move sequence on the original cube, and any original solution
projects to an abstract solution. Cross-stage shortest distances are equal.

The fixed-axis strict goal has 70 states: the cross is solved and all four free
edges have flip zero. Pseudo Cross permits the same four cyclic cross arrangements
as the original `(416,520)/(468,428)/(520,416)/(428,468)` seeds, giving 280 goals.
Both match the existing solver goal predicates exactly.

`relabel_cross` cyclically relabels the four tracked cross pieces, without turning
the physical cube. It commutes with all moves. The pseudo goal is the union of
four inverse images of the strict goal, so the strict table alone can return the
exact pseudo distance by taking the minimum of four relabeled-coordinate queries.
A separately generated pseudo table would trade another 101.5 MiB for one query.

The integration retains the solvers' existing 12 physical frames and
`min(rot, rot·y)` output folding. One-axis distances are not already folded.
A two-axis goal union would require a separate coordinate/rotation check.
The documented fixed-axis distributions have diameter 9, so exact values fit in
four bits with 15 reserved for unvisited entries.

For later F2LEO stages, Cross + orientation of all four F2L edges is necessary:
selected slot edges finish solved, and the remaining edges must have good EO.
Its distance is therefore an admissible joint EO bound. It dominates the old
cross-only bound, but it does not dominate the existing corner/edge block bounds.
Use `max(block_bound, compact_cross_eo_bound)`, with a correctly maintained real
frame coordinate. A hot-loop integration needs its own performance comparison;
ranking overhead and extra memory accesses can outweigh stronger pruning.

## Bounded validation

Run from this directory, reusing the main build cache if desired:

```
CARGO_TARGET_DIR=../../target cargo test --release --lib
rustfmt --check --edition 2021 src/lib.rs
```

Do not use `cargo fmt --all`: Cargo also formats local path dependencies.

Three tests passed on 2026-11-10, reported test time 0.18 s:

- Every one of the 831,600 position layouts roundtrips, rejects overlaps, and has
  exactly the original strict/pseudo goal classification. The 70/280 totals match.
- All 256 flip words at boundary/solved layouts roundtrip and extend to a legal
  full cube. The flip field is an independent byte in the rank, so this establishes
  its complete factor separately from the exhaustive position factor.
- 2,048 deterministic coordinates × 18 moves match `State::applied`, the original
  Cross/EdgeSet product projection, compact rank/unrank, and all four cross relabels.
- All 24 free-edge identity permutations, at five representative coordinates and
  every move, project to the same successor.

The tests allocate only the 1,728-byte single-edge move array and small vectors.
They call no table manager or `ensure_*` API. The 212-million-entry space is not
allocated or traversed. Full log:
`.local-data/three-stage-tables-20261110/compact-cross/validation.log` at repo root.

## Generator and protected integration

`generate_or_verify(path)` supplies the existing unified generator entry point.
The file is `pt_cross_eo_E0E1E2E3.bin`, in the existing 16-byte-header `CUBEPT01`
format. The unified `table_generator --only rust --table pt_cross_eo_E0E1E2E3`
entry selects this table and runs under the repository's computation protection
rules. This crate itself has no build/solve command.

A direct packed BFS keeps:

| Storage | Bytes |
| --- | ---: |
| Packed distance array | 106,444,800 |
| Current frontier bitset | 26,611,200 |
| Next frontier bitset | 26,611,200 |
| Position/move transitions | 119,750,400 |
| Combined core working memory | 279,417,600 (266.473388671875 MiB) |

It uses byte-level atomic CAS for packed distance assignment and atomic bit insertion
for the next frontier. No full `u32` queue and no temporary byte-per-state array
are needed. Table/header output should be written only after complete verification,
then synced and atomically renamed. Each completed layer atomically checkpoints the
packed distance array, current frontier, coordinate magic, state count, layer and
payload checksum. Resume validates the checksum, frontier membership and all completed
layer counts. The last valid checkpoint remains available after completion.

Each state is expanded at most once: at most `212,889,600 × 18 = 3,832,012,800`
successor transitions, plus frontier scans. Each eight-byte transition record stores
the destination placement, orientation XOR and free-edge flip permutation; table
expansion does not rank coordinates. Dense layers switch to reverse neighbor checks.
The accepted generator's measured 2.2 s is recorded separately from the old
distribution tool's 2.6 s result.

The accepted run used a 1 GiB total-process budget, including its Node supervisor
and Rust workers. Checkpoint writes use bounded streaming buffers; transitions and
frontiers are released before the final packed-byte copy. Resource monitoring still
preserves fixed boot/Swapouts and stops on swap, pressure or limit violations.

Builder unit checks additionally exercise all 256 orientations of representative
position-transition rows, the native two-edge root conversion, and both parallel
BFS kernels on a 512-state hypercube. A small checkpoint roundtrip and checksum
corruption test run without allocating the real table.

Conservative table residency (keeping every existing table, excluding runtime
stacks/allocator, based on the current table snapshot):

| Solver | Existing tables / local cross vector | Plus one compact payload |
| --- | ---: | ---: |
| F2LEO | 24,598,089,928 B (22.9088 GiB) | 24,704,534,728 B (23.0079 GiB) |
| Pseudo F2LEO | 2,300,977,972 B (2.1430 GiB) | 2,407,422,772 B (2.2421 GiB) |

The generated file adds a 16-byte header to the payload shown above. These are
data-size calculations, not peak RSS measurements. Cross direct lookup is now
enabled by default; using the table at every later-stage node requires separate
profiling and acceptance.

## Larger tables: exact sizes, not implementation promises

For a fixed selection of `k` solved F2L pairs plus EO of the remaining free edges,
the full collision-free coordinate has

`P(12,4+k) × C(8-k,4-k) × 2^8 × P(8,k) × 3^k` states.

| Fixed selected pairs | States | 4-bit payload |
| --- | ---: | ---: |
| 0 | 212,889,600 | 101.51 MiB |
| 1 | 20,437,401,600 | 10,218,700,800 B (9.5169 GiB) |
| 2 | 1,287,556,300,800 | 643,778,150,400 B (599.5651 GiB) |
| 3 | 46,352,026,828,800 | 23,176,013,414,400 B (21,584.3445 GiB) |

The one-pair table incorporates the currently missing free-edge EO constraint and
would dominate the corresponding plain XCross bound. It is for one target geometry
and one axis, not all slots/pseudo configurations in one file. Canonical rotation
reuse must prove how EO transforms; applying existing block-only conjugation blindly
is incorrect. Four separate strict slot tables would require 38.07 GiB before the
other tables; pseudo geometries require their own deduplication and goal checks.
The two/three-pair complete versions are unsuitable for a 128 GiB machine. Their
diameters have not been verified; the listed four-bit sizes are representation
budgets, not proof that four bits hold every exact distance.
