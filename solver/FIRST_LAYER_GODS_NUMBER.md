# First Layer God's number exact runbook

`first_layer_gods_number` proves the fixed-bottom First Layer diameter in HTM.
It tracks the labelled D-layer corners 4..7 and edges 8..11, including every
position and orientation:

`P(8,4) * 3^4 * P(12,4) * 2^4 = 25,866,086,400` states.

The proof is a complete BFS from the solved coordinate. Its last non-empty
layer is the God's number; the per-layer counts are the exact distribution.
The run is native-only and does not create, download, or expose a browser table.

The same pass also counts states with the four D-cross edges already solved.
This produces the exact global-HTM distribution and God's number for finishing
First Layer given a solved cross. Solutions may temporarily disturb the cross;
only the final First Layer target is constrained.

## Resource plan

- frontier state: 2 bits/state = 6,466,521,600 bytes (6.022 GiB);
- 4-corner and 4-edge move tables: 23,483,520 bytes;
- declared runtime reserve: 512 MiB;
- checked peak budget: below 7.1 decimal GB;
- hard process-plan ceiling: 25,000,000,000 bytes;
- two alternating crash-safe checkpoint slots: 12,933,051,392 bytes total;
- threads: defaults to all available CPU parallelism; no fixed thread cap.

The two frontier colours alternate between `current` and `next`; processed and
unseen are the other two values. Therefore the representation has no 4-bit
depth-14 ceiling and does not retain a distance byte for every state. Universal
self-loops are detected from the move tables and omitted when a quotient really
has them. The full First Layer coordinate keeps all 18 moves: a target D-layer
piece can occupy the U layer, so `U/U2/U'` are not universal self-loops.

After the first 1,000,000 visited states (the cheaper opening layers), every
completed layer writes the inactive A/B checkpoint slot, syncs its 6.47 GB
payload, and commits the checksummed header last. A torn new slot is ignored on
restart and the older committed slot is loaded. Resume continues at the next
whole layer, including both histograms.

## One-click command

From `core/` on macOS, Linux, or Windows, run:

```bash
pnpm solver:first-layer
```

The script builds the release binary, runs the dry resource gate, requires at
least 8 GiB free RAM and enough checkpoint disk, then
streams depth/count/percentage/rate/ETA/checkpoint progress to both the console
and a timestamped log. Run the same command after interruption to resume.

Options:

```bash
# Skip the incremental Cargo build; still run all resource gates.
pnpm solver:first-layer --skip-build

# Verify the one-click entry without starting the full BFS.
pnpm solver:first-layer --dry-run-only

# Store the two checkpoint slots elsewhere.
pnpm solver:first-layer --checkpoint-dir /path/to/first-layer-god
```

## Manual commands

From `solver/`, build and inspect the plan without allocating the 6 GiB frontier:

```bash
cargo build --release --bin first_layer_gods_number
./target/release/first_layer_gods_number --dry-run
```

Run later, after confirming enough free physical memory:

```bash
CUBE_ALLOW_HUGE_TABLES=1 ./target/release/first_layer_gods_number \
  --checkpoint-dir checkpoints/first-layer-god 2>&1 | tee first-layer-god.log
```

The full run prints one progress line per completed depth and finishes with:

- `FIRST_LAYER_GODS_NUMBER`;
- `FIRST_LAYER_HISTOGRAM`;
- `FIRST_LAYER_VISITED` (must equal 25,866,086,400);
- `FIRST_LAYER_GIVEN_CROSS_GODS_NUMBER`;
- `FIRST_LAYER_GIVEN_CROSS_HISTOGRAM` (must sum to 136,080);
- a deepest corner/edge coordinate;
- a concrete deepest-state scramble and its optimal solution;
- elapsed seconds.

## Proof checks

The binary refuses to publish a result unless all of these hold:

1. the BFS visits exactly 25,866,086,400 states;
2. the diameter does not exceed the independently known whole-cube bound 20;
3. the normal admissible-PDB First Layer IDA* gives the same optimum for a
   deepest BFS coordinate;
4. the inverse solution recreates that coordinate in the independent physical
   `State` model and replaying the solution restores all eight First Layer pieces.

Unit tests use a conventional queue BFS on a synthetic product graph and a
separate physical one-corner/one-edge model. They do not launch the full run.
