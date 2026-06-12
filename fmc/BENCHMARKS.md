# FMC solver — benchmarks & parity (mine vs upstream mallard)

**Same engine, same architecture.** `fmc/cubelib/` is a verbatim copy of
[Jobarion/cubelib](https://github.com/Jobarion/cubelib), the solver behind
https://joba.me/mallard. The deployed mallard is **not** browser WASM: its
frontend ships `default = ["backend"]` and POSTs to
`joba.me/cubeapi/solve_stream?backend=multi_path_channel` — a native server
running the multi-path-channel solver with **step-limit doubling**
(2^5..2^19), streaming every strictly-shorter solution, 60 s window.
`cubelib-server` replicates that byte-for-byte: `GET /v1/fmc/solve_stream`
streams the same NDJSON-style improvements with the same level schedule.

The default request is the **deployed** mallard default, captured verbatim
off its POST body (relative per-step min/max, quality 10000, the five default
DR triggers via RZP):

```
EO 0-5 niss=always > RZP 0-3 niss=never >
DR 0-12 niss=before triggers=R,R U2 R,R F2 R,R U R,R U' R >
HTR 0-12 niss=before > FR 0-10 niss=before > FIN 0-10 niss=never
```

> Gotcha that cost us 2 moves: current git-HEAD frontend defaults use
> *absolute* (cumulative) caps (`max-abs=14/20/26/30`). Those prune harder
> than the deployed *relative* maxima and lock the search out of the
> shortest solutions (we plateaued at 20 where mallard found 19). Always
> compare against what production actually sends, not repo defaults.

## Convergence speed (same desktop, 8C16T)

mine = local `cubelib-server` `/solve_stream`, 60 s budget. upstream =
joba.me/mallard in a browser (its backend + network), fresh scrambles
(re-measured live 2026-06-12; mallard's backend also has a DB cache, so only
first-ever scrambles measure its real solve time).

| scramble | mine: first solution | mine: reach upstream len | upstream shows | mine best @60s |
|----------|---------------------|--------------------------|----------------|----------------|
| `R U F R'`| 4 HTM @ 26 ms (`R F' U' R'`, bit-identical) | 26 ms | 4, instant | 4 (exhausted @0.45 s) |
| WCA-1    | 24 HTM @ 26 ms | **20 @ 5.4 s** | 20 @ ~6.4 s | 20 |
| WCA-2    | 26 HTM @ 26 ms | **19 @ 5.3 s** | 19 @ 6.2 s (fresh) | 19 |
| WCA-3    | 25 HTM @ 32 ms | **20 @ 0.09 s** | 20 @ ~6.4 s | **19 @ 31.8 s** |

(WCA-1 `R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F`,
 WCA-2 `D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'`,
 WCA-3 `D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2`.)

Read of the data:

- **Same lengths, faster everywhere.** At every length upstream displays, we
  get there sooner (5.4 s vs 6.4 s; 5.3 s vs 6.2 s; 0.09 s vs 6.4 s). On
  WCA-3 the 60 s window even finds **19** where upstream stops at 20.
- **First solution ~26 ms** — the streaming UI paints a 24-26 HTM solution
  effectively instantly, then refines in place (upstream needs ~2-3 s for
  its first paint incl. debounce + network).
- Trivial scrambles are bit-identical (`R U F R'` → `R F' U' R'`).

> Production box has a much weaker CPU than this desktop. Measured on prod
> (2026-06-12): WCA-3 first solution 114 ms, **reaches 20 (= upstream) at
> 0.93 s vs upstream's 6.4 s**; WCA-2 reaches 20 at ~10-13 s, and the final
> 19 needs a 120 s budget (106 s) — that last move is a hardware gap, not an
> engine gap. The server keeps a transcript cache per (scramble, steps,
> budget): repeats replay instantly. `/solve` (one-shot) additionally sits
> behind nginx's 7-day cache.

## Feature parity notes

- **`[4a1 4e]` DR subset annotation**: ported verbatim from mallard's
  backend `add_comments()` (orientation-normalize until the DR axis is UD,
  HTR-subset table lookup, `DR_SUBSETS[id]`) — present in both endpoints'
  JSON (`steps[].comment`) and rendered as `// drlr-eoud [4b2 4e]`.
- **Exclude solutions**: cubelib's `FilterExcluded` compares the
  *cumulative* alg up to the excluded step (canonicalized) — the UI sends
  `N1 N2 (I1 I2)` cumulative notation, like mallard's `find_step` full_alg.
- **htr-breaking** is gated off with a clear error: its DR-finish pruning
  table is 40320·40320·24/2 ≈ 19.5 G entries (~10 GB), beyond this server.
  (That same constant is why cubelib HEAD no longer compiles to wasm32 —
  the coordinate size overflows 32-bit usize.)
- Leave-slice (FRLS/FINLS) passes through; insertions (VR) not wired, same
  as the upstream default flow.

## Tests

`cargo test -p cubelib-server` (gates `deploy_fmc.yml`):

- **`mpc_solutions_solve_and_converge`** — multi-path-channel solutions at
  the deployed config actually solve (independent state check) for the
  trivial + 3 WCA scrambles, and doubling the step limit never lengthens.
- **`dr_subset_comment_present`** — every DR step gets a valid subset name
  from `DR_SUBSETS` (mallard add_comments parity).
- **`oneshot_golden`** — `/solve` golden: trivial → 4, `R F' U' R'`
  bit-identical to upstream.
- **`htr_breaking_gated`** — the ~10 GB-table config is rejected with a
  clear error.
- **`parse_steps_basic`** — the CLI-style steps-string parser (incl. the
  deployed default string round-trip: triggers, relative min/max, niss).

Reproduce the convergence table: `cargo run --release -p cubelib --example
bench` (native, no HTTP), and the upstream column by typing the scrambles
into joba.me/mallard with devtools open.
