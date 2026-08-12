# Second Layer / F2L design audit

## Semantics

The canonical bottom face is D. The requested terminal state is:

- D-layer corners 4..7 solved in position and orientation;
- D-cross edges 8..11 solved in position and orientation;
- middle-layer edges 0..3 solved in position and orientation.

The existing `std` stage `xxxxcross` requires the D cross plus all four F2L
slots. Each slot contributes one of corners 4..7 and one of edges 0..3.
Consequently its terminal predicate is exactly the predicate above, state by
state. The six views already use `ROTS6 = ["", "z2", "z'", "z", "x'", "x"]`
and therefore cover D/U/L/R/F/B in the same order as First Layer.

The search may temporarily disturb the first layer. Requiring every
intermediate state to preserve it would leave only U turns in the 18-turn
face-move model; U turns cannot repair middle-layer edges, so almost every
applicable input would be unreachable. The contract is therefore a terminal
state constraint, not an intermediate-state move restriction.

## State space and optimality bounds

Tracking the four D corners and the eight solved F2L edges gives

`P(8,4) * 3^4 * P(12,8) * 2^8 = 695,280,402,432,000`

coordinate states. A full exact-distance table is not practical. The existing
IDA* is nevertheless exact: the native path uses exact cross-plus-two-slot
PDBs, while the browser path uses the maximum of four exact single-slot PDBs;
both are admissible and accept only when all four slots are solved.

The certified HTM God's-number interval is currently `16 <= God <= 20`:

- hard-corpus row 149604 has an exact D-view distance of 16;
- solving the whole 3x3 always solves F2L, so the full-cube diameter 20 is an
  unconditional upper bound.

The WCA corpus currently observes a maximum of 15 and the two-colour 10f
corpus a maximum of 16. Neither sample maximum is presented as a diameter.

## Reuse and resource plan

Second Layer should be a thin alias of `std` stage 4 (`xxxxcross`), not a new
solver family.

- Native/analyzer: reuse `XCrossSolver`, `std_analyzer`, and the existing
  `xxxxcross_*` CSV columns. The recorded full-cascade throughput is about 115
  scrambles/s for five stages by six colours.
- Statistics: reuse the already computed `std.xxxxcross` distributions,
  examples, recent-scramble data, and competition step matrices. No 1.3M-row
  re-analysis is needed.
- WASM: reuse the `cross` worker need and `CrossSolverWasm` variant 4. There is
  no new download and no new client-side BFS.

Native exact solving maps 24,598,089,928 bytes (22.909 GiB) of shared read-only
tables in the full `std` configuration, principally:

- `pt_cross_C4C5E0E1.bin`: 10,729,635,856 bytes;
- `pt_cross_C4C6E0E2.bin`: 10,729,635,856 bytes;
- `mt_edge6.bin`: 3,065,610,252 bytes.

They are mmap-backed and shared by analyzer threads, so eight threads do not
duplicate 22.9 GiB of private allocations. The OS may warm a comparable amount
of physical page cache; private committed memory remains small by comparison.

The browser reuses prebuilt `pt_cross_C4E0.bin.gz` (21,013,802 bytes compressed,
54,743,056 bytes decoded) plus generated movement tables. A complete F2L table
would be hundreds of terabytes even at four bits per coordinate, so arbitrary
scrambles must still run query-specific IDA*. Known competition rows already
use precomputed `comp_steps`, avoiding live client search.

## SL1/SL2 minimum implementation

Expose a user-facing `second_layer` label that delegates to `std` stage 4 and
maps every data consumer back to `std/xxxxcross`. Do not add a Rust searcher,
analyzer executable, table, WASM class, worker need, CSV, or full-corpus job.
Keep the independent physical-State/shallow-IDDFS probe in
`tests/second_layer_audit.rs` as the semantic regression guard.
