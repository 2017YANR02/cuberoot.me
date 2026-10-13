# H48 surviving-node joint-target probe

This offline experiment asks whether **all eight corners and one specified edge** can be restored simultaneously within `r` HTM face turns. The remaining eleven edges are unrestricted. It helps decide whether a joint pattern database would add information at the nodes which survive the existing H10 bounds. It is not a production solver or a proposed hot-path speedup. Coordinate size alone does not establish useful pruning or runtime gains.

The worker includes the original `solver/vendor/nissy-core/src/nissy.c`, loads only the existing 1,242,756-byte complete corner table, and never opens H10 or generates a table. Working memory is the corner table plus small fixed arrays and depth-at-most-20 recursion. Source and table originals remain unchanged.

## Native interface

```text
joint-probe CORNERS MAX_NODES MAX_MS
```

`MAX_NODES` is 1 through 1,000,000,000; `MAX_MS` is 1 through 60,000. Budgets reset for each trial. Input is newline-terminated TSV, exactly four fields:

```text
trialId<TAB>remaining<TAB>edge<TAB>cube
```

- `trialId`: nonnegative integer no larger than 9,007,199,254,740,991.
- `remaining`: integer 0 through 20.
- `edge`: one of `UF UB DB DF UR UL DL DR FR FL BL BR`, in nissy index order; `UF` is index 0.
- `cube`: canonical 23-character nissy encoding in fixed `ORIENTATION_UF` (`A`). The worker rejects inconsistent or unsolvable states.

One JSON result is emitted and flushed per trial:

```json
{"trialId":0,"edge":"UF","remaining":12,"status":"unknown","reason":"node_limit","nodes":1000000,"seconds":0.123,"lowerBound":9,"solution":"","length":null}
```

Statuses:

| Status | Meaning | Can count as additional pruning? |
| --- | --- | --- |
| `found_le_r` | A replay-checked joint-target solution of length at most `r` was found. It need not be shortest. | No |
| `proved_gt_r` | The admissible bound or complete bounded search proves no joint-target solution within `r`. `lowerBound > r`. | Yes |
| `unknown` | A node/time budget or clock error stopped the search. `lowerBound` remains only the original admissible bound. | No |

`reason` is `complete`, `node_limit`, `time_limit`, or `clock_error`. `solution` is empty and `length` is null unless a solution was found. A found solution can be empty with length 0. `seconds` covers each search, excluding loading and output verification. Node limits are checked before visiting every node. Time is checked before each node with a monotonic clock; the last constant-size operation or OS scheduling can make elapsed time slightly exceed the requested limit. The outer monitored runner must still enforce overall resource limits.

The H10 sampler's `cube` and `remaining` fields transfer unchanged. Preserve its metadata and complete sample rows in a trials manifest keyed by `trialId`. Run this worker serially after H10 sampling under the existing monitored runner and the same resource baseline. No independent unmonitored launcher is provided. Initial proposed sample: at most 32 stored states per remaining-depth layer, UF only, 1,000,000 nodes and 250 ms per trial. Retain unknown counts in the denominator and report them separately; this bounded experiment cannot infer the missing answers.

## Correctness argument

Let `J_e` be the set of legal cube states with every corner solved and edge `e` solved. The solved cube is in `J_e`, so distance to this relaxed target is a lower bound on full solution distance. Projecting to all corner positions/orientations plus the position/orientation of edge `e` is deterministic under each face move. The untracked edges do not change these transitions.

The search uses `max(exact corner distance, exact one-edge distance)` as its admissible lower bound. It checks the joint target before expanding, and directly searches the bound `r`; no iterative deepening is necessary to decide existence within `r`. The only move omissions are the original generic same-face and opposite-face canonicalization in `allowedmask`. Consecutive same-face turns can be shortened; commuting opposite-face turns can be reordered. Both transformations preserve the full cube result, so they also preserve this target. No H48-specific half-turn masks, inverse bounds, symmetry assumptions for the joint target, or transposition cache are used.

Only complete exhaustion returns a proof. Encountering a budget stop immediately propagates `unknown`, even if some siblings were completely checked. A partial search never increases the lower bound. Every reported found path is replayed against the fixed joint target before output.

The corner table is size/layout/distribution checked; its corner permutation class/transform mapping is also checked against the original code. Like the existing solver, this relies on the existing generated corner PDB's provenance and correctness; the distribution check alone is not a proof that every distance entry is valid.

## Build and short-state validation

On the maintainer's arm64 Mac, from the repository root:

```sh
mkdir -p .tmp/h48-joint-probe
cc -std=c11 -DNEON -DTHREADS=1 -O3 -pthread -Isolver/vendor/nissy-core/src solver/experiments/h48-joint-probe/probe.c -o .tmp/h48-joint-probe/joint-probe
cc -std=c11 -DNEON -DTHREADS=1 -O3 -pthread -Isolver/vendor/nissy-core/src solver/experiments/h48-joint-probe/probe.test.c -o .tmp/h48-joint-probe/joint-probe-test
.tmp/h48-joint-probe/joint-probe-test .tmp/h48-corners-research/corners.dat
```

Use `-DPORTABLE` instead of `-DNEON` on other architectures. `probe.c` includes nissy's implementation, so do not separately link a second `nissy.c` translation unit. No large-table generation is part of these commands.

The test enumerates every zero-, one-, and two-move word (343 total) without pruning. For each of all 12 selected edges it compares projected states to the complete breadth-first ball, obtaining an independent exact projected distance for those states. It checks all bounds 0, 1, and 2 (12,348 decisions), replays every found path, checks 74,088 single-edge transitions against full cube moves, verifies a legal state with unsolved untracked edges already satisfies the goal, and checks that node/time truncation returns unknown. This guards the concrete admissibility/completeness risks; it does not establish performance at remaining depths 10–12.

## Follow-up boundary

The implemented target is exactly eight corners plus **one** edge. If actual H10 survivors show few or no `proved_gt_r` cases, an eight-corner/two-edge oracle is a separate possible experiment. It is not implemented here, and no joint PDB build or performance improvement is claimed from this prototype.
