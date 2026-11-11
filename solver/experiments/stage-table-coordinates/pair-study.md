# Pair / PseudoPair / Pseudo tables: source and small-model study

Scope: local 3×3 stage solvers only. No real PDB was loaded or generated, and no analyzer or scramble solving benchmark was run. This study corrects the unsafe standard-table reuse advice in `solver/PORTING_NOTES.md` Phase 6c; its reproducible model lives beside this document.

## First implementation: one exact Cross + Pair table

The actual target in `PairSolver::search_1` is the intersection `pt_cross_ins_c4 == 0 && pt_pair_c4e0 == 0`. Those are separate projections and their maximum is only a lower bound on distance to the intersection.

`create_pt_cross_ins_c` and `create_pt_pair_basic` both start with the solved state and the four algorithms `L U L'`, `L U' L'`, `B' U B`, `B' U' B`, each followed by any of no U/U/U2/U'. Deduplication in the source-based coordinate model gives:

- Cross + corner: 9 unique zero coordinates.
- Corner + edge: 17 unique zero coordinates.
- Their physically valid joint intersection: exactly 17 `(cross, corner, edge)` seeds. The cross is solved in every seed.

Use the existing `(cross_idx * 24 + corner) * 24 + edge` address. There are **109,486,080 addresses** and **54,743,040 payload bytes = 52.20703125 MiB**, plus the existing 16-byte PDB header. Only **72,990,720** addresses are physically reachable: the extra edge cannot collide with one of the four cross edges. Do not mistake the other **36,495,360** addresses for unfilled valid states.

Multi-source unit-cost BFS from those 17 seeds gives exact distance. Projection of every joint path is a valid path in each old table, so `h_joint >= max(h_ins, h_pair)`, and zero values reproduce the old target exactly. Stage 1 can return the joint distance after taking the same four-slot minimum. Stages 2–4 can use it for their pair component while retaining their existing fixed-slot constraints. Masked moves may use the table only as a lower bound; solution enumeration still needs search.

The depth-3 coordinate model contains **38,591** joint states. The joint bound is strictly stronger on **3,260 (8.45%)** of this shallow, biased sample. In particular, **62** states with joint distance 3 have old maximum bound 1. This establishes a real projection gap, not an estimate of production speedup.

Generation budget, using one byte/AtomicU8 per address and in-place packing:

- BFS array: **104.4140625 MiB**.
- Existing cross, corner and edge move arrays: **17.40563965 MiB**.
- Algorithmic peak: about **121.82 MiB** plus process/parallel-runtime/I/O overhead; reserve **256 MiB additional** as a practical bounded budget.
- Output: **52.207 MiB**. No new move table is necessary.
- Build with a single initial BFS array, not separate full-size initialization and atomic copies. Stop with a diagnostic if any reachable value would collide with the 4-bit unknown marker 15. Confirm the expected reachable count before accepting the file. Wall time is unmeasured.

Minimal acceptance after generation: correct header/length; exactly 17 zero states; all 72,990,720 valid coordinates reached; valid-state distance histogram; known goal and one-move checks; every sampled value at least both old projected bounds; frozen old/new analyzer outputs identical on the approved fixed batch. Run generation/benchmark only through a separately authorized guard.

## PseudoPair extension: four tables, not sixteen

The source's pseudo insertion seeds must be copied exactly: it has the D offsets and a different U/D expansion. For every physical `(corner, edge)` pair, the model finds **36 insertion zeros**, **20 pair zeros**, and **68 valid joint zero states**. A table generated from only one trigger sequence or from the intersection's projected minima would be wrong.

All **16** physical `(c,e)` joint goal sets normalize exactly to the existing four `diff=(e-c) mod 4` corner-canonical frames. The model checks the goal sets using the actual `conj_moves_flat` transitions, including the cross pieces' orientation reference correction. Thus four Cross×Corner×Edge tables suffice: **208.828125 MiB payload total**, each **52.20703125 MiB**. Generate them sequentially with the same memory budget. Production coordinate normalization and integration remain to be implemented and tested; the seed proof is not a substitute for full coordinate round trips.

This fills the same pair-component gap in all four native PseudoPair stages without changing the existing 2-/3-subset auxiliary goals.

## Larger opportunity: complete PseudoXX mixed constraint

PseudoXX currently combines two one-corner/one-edge tables with a Cross+2-corners projection and a Cross+2-edges projection. PseudoXXX/PseudoPair also have separate Cross+3-corners and Cross+3-edges auxiliaries. They do not enforce all corner/edge correlations in one table.

For a PseudoXX task the full fixed-piece target is the four D offsets of its cross, two selected corners, and two selected middle edges. Both corner/edge assignments for the same selected sets have that same target. There are **36** distinct selected-set goals behind the present **72** assignment tasks.

A dense joint coordinate is **E6 × C2 = 42,577,920 × 504 = 21,459,271,680 states**. Four-bit storage is **10,729,635,840 bytes = 9.992752075 GiB per table**. Unlike Cross×E2, E6 excludes edge collisions in its coordinate by construction.

The small goal model verifies exactly **four** target classes under a whole-cube y frame, cyclic renaming of the four tracked cross edges, and permutation of the two tracked-edge/two tracked-corner labels. Class sizes are **16, 8, 8, 4**. These transformations preserve the move graph; they are not free physical D moves. Four tables would cover the goals, with **39.97100830 GiB total payload**.

Potential consumers: PseudoXX can use exact lookup; PseudoXXX can use its three two-corner/two-edge subsets as stronger mixed bounds; PseudoPair stages 3–4 can strengthen their two/three fixed pseudo slots. Do not apply this fixed-slot table to the free pair's insertion target.

Generation would need about **19.986 GiB** for one BFS array plus the existing **2.855 GiB E6 move table**, other small arrays and runtime overhead. Keep four table builds sequential and release inactive arrays. This is a future guarded large-memory task, not an authorized execution in this study. Full compact-coordinate canonicalization, transition equivalence, coverage and diameter remain unimplemented; no production speedup is claimed.

Smaller mixed alternatives per table: E6×C1 = **1,021,870,080 states / 0.475845337 GiB**; E5×C2 = **1,532,805,120 / 0.713768005 GiB**. Larger partial alternatives: E7×C1 = **12,262,440,960 / 5.710144043 GiB**; E5×C3 = **27,590,492,160 / 12.84782410 GiB**. Each needs its own verified projected goal set; those sizes alone do not establish how many canonical tables are needed. Full E6×C3 is already **179.870 GiB**, E7×C2 **119.913 GiB**, before build working memory, so an arbitrary 64-GiB target is not a meaningful next coordinate here.

## Existing standard tables: exact conditions for reuse

Standard goals are narrower. A single D is already a pseudo goal (distance 0), whereas its standard Cross/XXCross distance is 1. Standard distance cannot be inserted unchanged into a pseudo maximum heuristic.

For a specific task whose tracked-piece identities/reference geometry match the standard table, and every pseudo goal is within one D-family move of that table's zero set, triangle inequality permits `max(h_std - 1, 0)`. This is conditional and does not extend automatically to arbitrary mismatched corner/edge sets or pair insertion goals. Where a standard zero set is a subset of the requested pseudo target, its exact distance is instead a valid feasible-length upper bound.

For regular Pair's verified 17 insertion goals, the seed construction supplies a word of at most four moves from the canonical standard XCross goal; hence `max(h_standard_xcross - 4, 0)` is an admissible coarse bound on the same canonical pair coordinates. It is not the exact joint table and may be too weak to justify another lookup. No analogous constant is asserted for arbitrary PseudoPair diff configurations.

Appending four D variants to a scramble is not a general exact multi-goal transformation. Any attempted table reuse must prove the actual coordinate graph map and target correspondence, not rely on “AUF” naming.

## Local evidence

`pseudo-pair-goals.rs` imports the repository's `cube_common.rs` directly. It recreates only the documented generator seeds, tiny 24-state single-piece transitions, a depth-3 coordinate graph, and target-set transformations. The live data stayed far below the allowed 32 MiB (conservative combined hash capacity 1,390,592 bytes plus small queues). `.local-data/pseudo-pair-table-study-20261110/goal-model-results.txt` contains the original passing results. No production PDB or file table is accessed.
