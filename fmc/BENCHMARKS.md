# FMC solver — benchmarks & parity (mine vs upstream mallard)

**Same engine.** `fmc/cubelib/` is a verbatim copy of [Jobarion/cubelib](https://github.com/Jobarion/cubelib),
the exact solver that powers https://joba.me/mallard. So solution *quality* is a
function of **config**, not of two different solvers. The differences below are
config + native-vs-WASM, nothing else.

- **mine** = `cubelib-server` (native, vendored cubelib) behind `api.cuberoot.me/v1/fmc`.
- **upstream** = joba.me/mallard, the same cubelib compiled to **WASM**, solving in a
  Web Worker in the browser.

## Speed & solution length

Measured on the **same machine** (8C16T desktop) so it's a fair native-vs-WASM
comparison. "mine" = local `cubelib-server` over HTTP at the deployed default
config (`EO[niss=always] > RZP > DR[niss=before] > HTR[niss=before] > FR[niss=before] > FIN`,
quality 1000). "mallard" = time from last keystroke to rendered solution (warm —
tables already generated & cached in IndexedDB), its own default config.

| scramble | mine: len / time | mallard: len / time |
|----------|------------------|---------------------|
| `R U F R'` (trivial)        | 4 HTM / ~6 ms   | 4 HTM / instant |
| WCA-1 (24-move scramble)    | 22 HTM / ~0.17 s | 20 HTM / ~6.4 s |
| WCA-2 (19-move scramble)    | 21 HTM / ~0.17 s | 19 HTM / ~5.3 s |
| WCA-3 (20-move scramble)    | 21 HTM / ~0.18 s | 20 HTM / ~6.4 s |

(WCA-1 `R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F`,
 WCA-2 `D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'`,
 WCA-3 `D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2`.)

### Honest read of the data

- **Trivial cases are bit-identical** (`R U F R'` → `R F' U' R'` on both).
- **mallard finds ~1–2 moves shorter** on hard scrambles. Its default ships a deeper,
  trigger-optimized search (RZP + DR triggers + high quality) — it spends ~5–6 s to
  shave those moves.
- **mine is ~30–40× faster** (~0.17 s vs ~6 s) at the fast default, trading those
  1–2 moves for latency. The server is loopback + nginx-cached (deterministic per
  scramble+steps), so repeat queries are instant.
- **Same engine ⇒ same reachable quality.** Cranking `quality` makes the native
  solver converge to mallard's length: at `quality=100000` it returns **20 HTM for
  WCA-1** — identical to mallard — but takes ~30 s on this machine (no trigger
  optimisation, pure breadth). The fast default is the deliberate latency/length
  trade for an interactive web tool; users who want the last move or two can raise
  the search depth.
- Native (server) is faster per unit of search than WASM (browser); mallard still
  wins wall-clock on length because its config prunes smarter (DR triggers), not
  because WASM is fast.

> Numbers are on a fast desktop; the production box has a weaker CPU, so absolute
> `mine` times scale up (still sub-second at the default for typical scrambles,
> and nginx caches each (scramble, steps) for 7 days).

## Tests

`cargo test -p cubelib-server` (also gates `deploy_fmc.yml`):

- **`solutions_actually_solve`** — for the trivial + 3 WCA scrambles, the linearized
  solution applied to the scramble returns a solved cube (independent State check),
  and its length equals the reported total.
- **`golden_totals`** — locks the deployed-config bests (`R U F R'`→4 `R F' U' R'`,
  WCA-1→22, WCA-2→21, WCA-3→21). Update intentionally if the config/engine changes
  (acts as a regression signal).
- **`quality_converges_shorter`** — raising `quality` never lengthens and strictly
  improves WCA-1, and that shorter solution still solves.
- **`parse_steps_basic`** — the CLI-style steps-string parser (niss/min/max/quality/
  substeps, invalid-niss rejection).

Reproduce the speed table: `cargo run --release -p cubelib --example bench`
(native, no HTTP) and the mallard column via the browser on joba.me/mallard.
