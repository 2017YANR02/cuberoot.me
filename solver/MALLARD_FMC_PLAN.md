# Mallard-style FMC Reduction Chain — Implementation Plan

> Single source of truth for porting the joba.me/mallard step-by-step FMC solver onto
> cuberoot's own `solver/` engine (TS + Rust). Each phase is dispatched to a fresh sub-agent
> that reads the relevant section here + the actual source, executes, verifies, commits, and
> returns a ≤20-line summary. Main loop stays thin; truth lives in git + this file.
>
> **License note**: cubelib (github.com/Jobarion/cubelib, codeberg.org/joba/cubelib) is
> **unlicensed = all-rights-reserved**. We do NOT copy its code. We read it only as a behavior
> reference and reimplement on cuberoot's own engine. User handles author communication.

---

## §0 SCOPE

**SHIP this round (Phases 1–4): normal-side chain, no NISS.**
EO → DR → HTR → **FR (new)** → Finish, with: per-stage multi-solution enumeration (engine's
`enumerate_face(alg, rot, extra, cap)` already does best..=best+extra), per-stage axis
"variations" (UD/FB/LR — engine returns 6 viewpoints), per-stage step-length [min,max] filter,
per-stage "exclude this reduction → re-solve a different one". New analyzer **bottom section**.

**Phase 5 (attempt after 1–4 land & verify): NISS.** EO=Always (exact table, `min(1,h)` clamp),
DR/HTR/FR=Before (two-sided search), Finish=Never — matching mallard defaults. Requires a
two-list `{normal_moves, inverse_moves}` Algorithm rep threaded through the chain + parenthesized
`(R U)` printing + `to_uninverted()` finalization. Honest red-line: NISS-Always over DR's IDA*
`max(eo_slice,co_slice)` heuristic is HARD; DR default is Before so default-config parity is
feasible, but stop & report if the Always-on-IDA* clamp proves unsound.

**Deferred / out of scope (document, do NOT build now):** RZP + DR-triggers, HTR-subset
`[4a1 4e]` comments, the `(a/b)` cancellation solution-line format (we print `len/cumulative`),
FRLS "leave slice" + insertions.

---

## §1 VERIFIED ENGINE FACTS (ground truth — do not re-derive from memory)

Source: `D:\cube\cuberoot.me\solver\src\`. WASM surface: `solver/src/wasm.rs`
(`#[cfg(target_arch="wasm32")]`, registered in `lib.rs`). Build: `solver/build_wasm.ps1`.

- **Move model** (`cube_common.rs`): `#[repr(u8)] enum Move` = 18 values U,U2,U',D,D2,D',L,L2,L',
  R,R2,R',F,F2,F',B,B2,B' (idx 0..17). `MOVE_NAMES[18]`, `Move::ALL`, `from_index`, `index`.
  `string_to_alg(s)->Vec<Move>` (drops rotation tokens). `INV_MOVE[18]` per-move inverse.
- **State** (`cube_common.rs:94`): `struct State { corners:[u8;8], edges:[u8;12] }`,
  `corners[i]=3*cubie+ori`, `edges[i]=2*cubie+ori`. `State::SOLVED`. `apply(&mut self, Move)` /
  `applied(Move)` via `compose`. `cp_co()`, `ep_eo()`. **Apply a sequence**:
  `let mut st=State::SOLVED; for &m in &alg { st.apply(m); }` then read coords.
- **Viewpoint/frame**: `alg_rotation(&mut [u8], r)`, `rot_map()->[[u8;18];4]`,
  `conj_buf(alg, rot, yk)->Vec<u8>` (rotate scramble into a viewpoint + y-frame). Keep the whole
  chain in ONE fixed frame to avoid re-mapping.
- **Move masking** (M1): `valid_moves_masked(mask)`, `move_mask_of(&[u8])`, `MoveMask=u32`
  aligned to `Move::index`. G3 = 6 double-turns mask = moves [1,4,7,10,13,16].
- **Multi-solution enumeration EXISTS for all DR-method stages**: `enumerate_face(alg, rot,
  [stage,] extra, cap) -> (best_len, Vec<S1Sol>)` where `S1Sol { yk:usize, len:u32, moves:Vec<u8> }`
  (`roux_s1_solver.rs:181`). Loops `for d in best..=best+extra { enum_paths(...) }`, cap-truncated,
  sorted by len. Refs: `dr_solver.rs:285`, `htr_solver.rs:383`, `htr_phase2_solver.rs:249`,
  `eoline_solver.rs:251`.
- **Stages present**: EO/EOLine (`eoline_solver.rs`, exact BFS tables), DR (`dr_solver.rs`, **IDA***
  with admissible `h=max(pt_eo_slice,pt_co_slice)` — NOT a single exact table), HTR
  (`htr_solver.rs`, exact 2,822,400-state table, conditional on input==DR), HTR-finish/htr2
  (`htr_phase2_solver.rs`, exact 663,552-state table, G3-restricted 6 double-turns, conditional on
  input==HTR).
- **FR (Floppy Reduction): ABSENT.** Must be added. (The "FR" in code = F2L Front-Right slot label.)
- **NISS / inverse-scramble: ABSENT entirely.** `conj_buf` walks scramble forward from SOLVED only.
- **Chaining: NOT implemented.** Every stage solves the raw scramble independently; htr/htr2 are
  CONDITIONAL (return sentinel unless the scramble itself is already DR/HTR). Primitives for
  chaining exist (`State::apply` over `S1Sol.moves`, then re-extract coords) — used in tests
  (`dr_solver.rs:500`, `htr_phase2_solver.rs:570`) — but no orchestrator composes stages.
- **承重墙 (do NOT touch)**: the fixed 18-move FTM stride; the gitignored ~34GB `pt_*` cross/xcross/
  f2leo packed tables (separate from the in-WASM micro-tables). FR/chain/NISS use only the existing
  6 double-turns (FR) / 18 moves (NISS on inverted cube), build ≤8KB micro-tables at `new()`, zero
  mmap — like htr2. **No clash.**

## §1.1 WASM API (existing, for reference)
`HtrPhase2SolverWasm` (`wasm.rs:466-518`) is the COPY TEMPLATE for new zero-table conditional
solvers: `#[wasm_bindgen(constructor)] new()`, lazy `ensure()`, `solve(scramble)->Vec<u32>`
(6 viewpoints, `u32::MAX` sentinel where N/A), `solve_moves(scramble,face,extra,cap)->String`
(JSON `{"len":N,"sols":[{"m":"R U R'","c":"<label>"}]}` via `sols_json` helper `wasm.rs:56`).

---

## §2 THE "ADD A SOLVER KEY" RITUAL (9 sites — copy htr2 precedent commit `a8b9449f4` + `5626a0e9c`)

Data flow: Rust crate → `wasm.rs` export → `build_wasm.ps1` (pkg-web) → **manual copy** to
`tools/solver/rust-cross/` → **hand-maintained worker** → `rust-cross-client.ts` → `rust-cross-pool.ts`
→ `StageSolver.tsx`. Canonical: `solver/VARIANT_PLAYBOOK.md:56-84`.

0. **Rust** `solver/src/wasm.rs`: add `<Name>SolverWasm` (copy `HtrPhase2SolverWasm`). Register
   module in `lib.rs` wasm-region.
1. **Build** `solver/build_wasm.ps1`: if NEW `.bin` tables → add to `$names` (line 33). Zero-table
   solvers add nothing. Run `pwsh solver/build_wasm.ps1` → `solver/pkg-web/`.
2. **Copy (manual)**: `solver/pkg-web/{cross_solver.js, cross_solver_bg.wasm, cross_solver.d.ts,
   cross_solver_bg.wasm.d.ts}` → `D:\cube\cuberoot.me\tools\solver\rust-cross\`. New tables →
   `tools/solver/rust-cross/tables/`. (No Copy-Item in any .ps1; it's a hand step.)
3. **Worker** `tools/solver/rust-cross/cross-solver-worker.js` (HAND-MAINTAINED, edit in place; the
   pkg-web copy is stale): add `let <name>Solver=null;`; init() branch
   `else if(need==='<key>'){ <name>Solver = new mod.<Name>SolverWasm(); }` (zero-table copies htr2
   lines 71-73); onmessage `<key>_stage` handler posts `type:'variant'` with
   `values=Array.from(out)`; onmessage `<key>_moves` handler posts `type:'<key>_moves'` with
   `data=JSON.parse(json)` (htr2 lines 196-209).
4. **Client** `lib/rust-cross-client.ts` — **BUMP `V`** (line 14, e.g. `v=20260611b`→next) on every
   wasm/worker rebuild. TABLE_BYTES (18-34): add decompressed size of new tables (zero-table=none).
   TABLE_SETS union literal (line 38) + `<key>:[...]` (must match worker init). Sentinel const
   (53/56) if conditional. RustCrossPool interface (77-159): `solve<Key>Stage`/`solve<Key>Moves`
   (htr2 at 147/149). createRustCrossPool need union (174). onmessage moves chain (261): add
   `m.type==='<key>_moves'`. Return-object submit() wrappers (363-371).
5. **Pool** `lib/rust-cross-pool.ts`: add `<key>` to `PoolNeed` union (line 10).
6. **Variants** `lib/scramble-variants.ts`: `ScrambleVariant` union (13), `VARIANT_LABEL` (17-37),
   `STAGE_BASE` (68-101), `VARIANT_STAGES` (114-132). **Keep conditional/manual keys OUT of
   `VARIANT_ORDER` (line 41)** so they don't leak into gen/recent dropdowns (htr/htr2 do this).
7. **StageSolver** `components/StageSolver.tsx` (8 points): `Method` union (42), `METHOD_KEYS`
   (49-52), `EAGER_MAX` (56-58; heavy=0), `Kind`+`kindOf` (62-68), `needOf` (71-77), `computeAll`
   ternary (238-250), `fetchMoves` ternary (304-318), + `isSentinel`/`faceDesc`/hint/empty-state if
   conditional. Labels resolve via `variantLabel`/`stageLabel` (no local METHODS map).
8. **Board** `app/[lang]/code/solvers/page.tsx`: sync TABLES/NATIVE/BROWSER snapshot (skill
   `solvers-tables`). CI guards: `tests/code-tokens-drift`, `tests/zh-hant-drift`.
9. **Verify**: playwright `127.0.0.1:3000/zh/scramble/analyzer`, switch method, desktop + 390px,
   0 console errors; native↔WASM 6 values bit-exact (node harness vs analyzer.exe). typecheck
   `pnpm --filter @cuberoot/client typecheck` **from core/** (repo root → ERR_PNPM_NO_PKG_MANIFEST).
   COEP: analyzer uses a classic worker WITHOUT COOP/COEP — do NOT add to next.config SAB list.

---

## §3 MALLARD BEHAVIOR SPEC (reference for faithful reimplementation)

**Subgroup chain**: G0 --EO--> oriented-edges --DR--> G2⟨U,D,L2,R2,F2,B2⟩ --HTR--> G3⟨U2,D2,L2,R2,F2,B2⟩
--FR--> floppy/2-axis --FIN--> solved. (Variant of Thistlethwaite + Kociemba two-step.)

- **EO**: orient 12 edges to one axis pair. st-moves F/F'/B/B'. Variations UD/FB/LR (3). Default
  NISS Always. Default len 0..5 (slider max 8).
- **DR**: orient edges on 2nd axis + all corners → G2. st-moves R/R'/L/L'. Variations UD/FB/LR coarse
  (each = 2 valid (eo,dr) pairs; 6 combos total). Default NISS Before. Default rel 0..12.
- **HTR**: DR(G2) → G3. st-moves U/U'/D/D', aux = 6 half-turns. Variations UD/FB/LR (DR axis).
  Default NISS Before. Default rel 0..12.
- **FR** (Floppy Reduction): G3 → only 2 axes of half-turns needed. st-moves U2/D2, aux R2/L2/F2/B2.
  Variations UD/FB/LR (which axis becomes floppy/slice). Default NISS Before. Default rel 0..10.
  Optional (skip → finish direct from HTR).
- **Finish**: solve. From HTR = 6 half-turns; from FR = `FRUD_FINISH_MOVESET`. NISS forced Never.
- **Variations control**: only shown in Advanced mode; otherwise all three axes forced
  (`default_variants=["ud","fb","lr"]`).
- **Step length**: dual-handle [min,max] per step. Global "Relative step length" toggle (default ON):
  relative bounds THIS step's own move count; absolute bounds CUMULATIVE length through this step.
- **NISS**: `NissSwitchType {Never,Before,Always}`. UI = 2 toggles: "switching before step"
  (ON⇒≥Before), "switching during step" (ON⇒Always, greyed unless toggle-1). Printed: inverse moves
  in parentheses — `(R U)` = done on inverse scramble (= premoves U' R' on normal); `R U (F)` = mixed.
  Final `Solution (N): ...` is uninverted single normal sequence (`to_uninverted()`).
- **Exclude**: per-step blacklist of a cumulative reduction alg (canonicalized, last-move-non-prime
  normalized for QT steps) → forces a different reduction. UI "Exclude: <alg>" button per stage.
- **Solution line**: `{alg:<padW}  // {variant} [comment] (a/b)` where a = this step's len
  (−cancellations), b = cumulative canonical len. Variant names: `eoud`, `drlr-eoud`, `htr-drlr`,
  `frud`, `fin`. **We print `len/cumulative` (no cancellation math) this round.**

---

## §4 PHASE 1 — FR Rust solver (engine only, no UI)

**Goal**: a new `solver/src/fr_solver.rs` that solves HTR(G3) → FR for axes UD/FB/LR, single-optimal
+ multi-solution enumeration, conditional on input already being HTR. Riskiest piece = the FR
coordinate (esp. orbit-twist parity). **Clone `htr_phase2_solver.rs` structure exactly.**

**Reuse**: the SAME G3 corner table (Hc=96) + G3 edge table (6912) + `G3_MOVES` (6 double-turns)
that `htr_phase2_solver.rs` already builds. Add ONLY the FR coordinate projection + a goal=0 BFS.

**FR coordinate (UD variant)** — project from a G3 `State` (cubelib `steps/fr/coords.rs` semantics):
- `FREdgesCoord` (Coord<64>, 6-bit): bitmask of the 6 U/D-layer non-slice edges (slots 0,1,2,3,8,9)
  whose "FR color"/orientation is wrong vs a fixed parity table.
- `FRCPOrbitCoord` (Coord<4>): position of the UBL-opposite corner orbit (2 bits).
- `FROrbitParityCoord` (Coord<2>): orbit-twist sign = permutation parity over a fixed set of
  corner/slice-edge comparisons. **Derive scalar from cp/co/ep** (cubelib uses SIMD; do not copy).
- `FRSliceEdgesCoord` (Coord<16>, only 12 real): arrangement of E-slice edges.
- Composite `FRUDWithSliceCoord = slice + no_slice*16`, size **8192** (`no_slice = parity + cp*2 + edges*8`).
- FB/LR variants: pre-apply X / Z rotation (like htr's per-face rot), then same UD coordinate.
- Goal predicate = **FR-coord == 0** (NOT identity / solved).

**Search**: backward-BFS an exact `u8` dist table (≤8192 entries) over the FR coord using the 6
double-turn move tables (identical to htr2's `closure`/BFS). `solve_one`/`solve_face`/`get_stats`/
`is_fr` (conditional: requires input HTR via the existing HTR coords check) + `enum_paths`/
`enumerate_face` copied from htr2 (best..=best+extra, cap, `dist[next] >= depth` cutoff).

**Register** module in `lib.rs`.

**Tests** (`#[cfg(test)] mod` in fr_solver.rs) — these are the 承重墙 against silently-wrong coords:
1. Closure sizes: corner table == 96, edge table == 6912 (assert, locks the reused G3 tables).
2. FR coord space + BFS table max-depth == a hand-checked God's-number bound (lock with `expect/toBe`).
3. **Independent brute-force `fr_done(state)` predicate** (computed a DIFFERENT way than the solver's
   coord — e.g. directly check "solvable in ⟨R2,L2,F2,B2⟩" by BFS closure) and assert: for a set of
   fixtures, every solution returned by `enumerate_face` — when applied via `State::apply` over its
   `Vec<Move>` to the input state — reaches a state where `fr_done()==true`; and `best` is the true
   minimum (optimal-first). Mirror `htr_phase2_solver.rs:550` g3_closure golden test. **The test must
   NOT reuse the solver's own coordinate to judge correctness (no circularity).**

**Verify gate**: `cargo test -j8 fr` green (set `CUBE_TABLE_DIR=solver\tables`, `RAYON_NUM_THREADS=8`,
`CARGO_BUILD_JOBS=8`). Memory gate: micro-table ≤8KB, but the cargo *compile* peaks ~2GB — check
FreePhysicalMemory first; if tight, `-j2`. **Commit** only fr_solver.rs + lib.rs change (English msg,
Co-Authored-By trailer). No wasm, no UI this phase.

---

## §5 PHASE 2 — FR WASM + standalone FR explorer (StageSolver)

- `wasm.rs`: add `FrSolverWasm` (copy `HtrPhase2SolverWasm` 466-518). `solve`→6 viewpoints (u32::MAX
  where not-HTR), `solve_moves`→JSON; `c`-label = FR axis (UD/FB/LR).
- `build_wasm.ps1`: NO `$names` change (zero-table). Run `pwsh solver/build_wasm.ps1` (SERIAL build).
- Manual copy pkg-web artifacts → tools/solver/rust-cross/.
- Worker: `let frSolver=null;` + init `else if(need==='fr')` + `fr_stage`/`fr_moves` handlers.
- Client: **BUMP V**; TABLE_SETS `fr:[]`; interface `solveFrStage`/`solveFrMoves`; need union;
  onmessage `fr_moves`; submit wrappers.
- Pool: `'fr'` in PoolNeed.
- scramble-variants: register `fr` (label zh『Floppy 还原』/en 'Floppy Reduction'); keep OUT of
  VARIANT_ORDER. Run `pnpm -F @cuberoot/client zh:inject` after tr() labels.
- StageSolver: register `fr` as a single conditional stage (like htr2): Method, METHOD_KEYS,
  EAGER_MAX fr:0, kindOf, needOf, computeAll→solveFrStage, fetchMoves→solveFrMoves, isSentinel reuse,
  FR branch for faceDesc/hint/empty-state ('-' for non-HTR viewpoints).

**Verify gate**: node native↔wasm parity (FR 6-value bit-exact, fixture set) + typecheck (from core/)
+ playwright analyzer method=FR desktop+390px 0 errors, click a solution row → shared player updates.
This ships a usable FR stage on its own. BUMP V here. Commit.

---

## §6 PHASE 3 — Chained-solve orchestrator (Rust + WASM)

- `solver/src/chain_solver.rs` (NEW): takes scramble + fixed frame (rot, yk=0) + per-stage
  `{enabled, extra, cap, minLen, maxLen, excluded:Vec<Vec<u8>>}`. Walks EO→DR→HTR→FR→Finish: per
  stage `enumerate_face` on the CURRENT residual `State` (not raw scramble), filter by [minLen,maxLen]
  + excluded set, then for each surviving candidate `State::apply` its moves → residual State for next
  stage; carry accumulated move list. Sub-solvers: EOLineSolver(EO), DrSolver(DR), HtrSolver(HTR),
  FrSolver(FR), HtrPhase2Solver(Finish-from-HTR; from-FR if FR enabled). Output: `Vec` of chains,
  each `[{stageKind, variantAxis, moves, len}]`, sorted by cumulative length. **Keep one fixed frame.**
  Combinatorial guard: cap per-stage (default 5–10), prune by cumulative length, default single best
  viewpoint (opt-in "try all axes"). DR enumeration = collect IDA* leaves at threshold L in
  best..=best+extra then post-filter by length (reuse `dr_solver.rs:285` enum as-is).
- `chain_solver.rs` tests: golden — known scramble, full chain's concatenated moves replay to
  `State::SOLVED`; per-stage length monotonic; lock optimal-total with `expect().toBe()` baseline.
- `wasm.rs`: `ChainSolverWasm` — ctor builds all 5 sub-solvers once; `solve_chain(scramble,
  configJson)->String` returns `{chains:[{steps:[{kind,variant,m,len}],total}]}` (one round-trip).
- build_wasm (SERIAL) + copy + worker `chain` branch + `chain_solve` handler; client `solveChain` +
  `chain` need + onmessage `chain_solve`; pool `'chain'`. BUMP V.

**Verify gate**: cargo golden (chain replays to SOLVED, optimal-total baseline) + node native↔wasm
parity on chain JSON. Commit.

---

## §7 PHASE 4 — ChainExplorer UI + analyzer bottom mount

- `components/ChainExplorer.tsx` (NEW reusable). Props `{scramble, lang}`. Per-stage row
  (EO/DR/HTR/FR/Finish): enable toggle, axis Variations multiselect (UD/FB/LR), dual-handle
  step-length [min,max] range (reuse a components/ RangeSlider if present, else minimal 2-number
  control), "show N" cap select (LIMIT_OPTIONS pattern from StageSolver). Compute → `pool.solveChain`
  ONCE → render chains list; each chain row clickable → drives ONE shared `TwistySection` player
  (reuse StageSolver pattern line 613 — do NOT spawn N WebGL contexts). Per-chain "Exclude this
  EO/DR/…" buttons append the step's move string to that stage's excluded set + re-run. Solution line:
  normal-only `moves // stage-variant (len/cumulative)`. Mobile: `AccordionSection` per stage <480px;
  desktop inline rows. Register in `/code/components` catalog (`_catalog.tsx`) + a live Demo.
- `app/[lang]/scramble/analyzer/page.tsx`: mount between CFOP `</details>` (line 761) and
  `.analyze-page </div>` (line 762): `<section className="analyze-chain">` h2 (zh『FMC 多阶段还原链』/
  en 'Multi-stage FMC Reduction') wrapping `<ChainExplorer scramble={scramble} lang={lang} />`. Use
  the `.analyze-cfop` collapsible `<details open={...}>` pattern (chain solve is heaviest).
- `analyze.css`: `.analyze-chain` (margin/gap only, NO card/border/background per CLAUDE.md; mirror
  `.analyze-primary`). Colors via theme-tokens skill, no hardcoded greys.
- `/code/solvers/page.tsx`: add FR row to BROWSER/NATIVE snapshot (skill `solvers-tables`).

**Verify gate**: typecheck (tsgo, from core/) + `vitest run tests/code-catalog-sync.test.ts` + 
playwright analyzer bottom: run a chain, toggle stages, change a step-length range, click "Exclude
this DR" → different reduction returns, ONE WebGL context, desktop+390px, 0 console errors. Commit.

---

## §8 PHASE 5 — NISS (attempt after 1–4; stop & report if Always-on-IDA* is unsound)

Add two-list `{normal_moves, inverse_moves}` to the chain's solution rep + per-stage two-sided search.
- **Before** (DR/HTR/FR): run each stage search twice — on the residual State AND on its inverse —
  tag inverse-side moves as `(...)`. Invariant: `solve(invert(cube))` moves recorded as inverse_moves
  ≡ apply inverse-of-those on normal. No prune-table change.
- **Always** (EO only by default; EO is an EXACT table): recursive mid-step switch before st-moves
  with normal↔inverse list-swap splice; heuristic clamped `min(1,h)` to stay admissible. **HARD/red
  candidate** if extended to DR (IDA* `max()` heuristic) — DR default is Before, so do NOT force
  Always on DR; if user later wants DR-Always, that's a separate spike.
- Print: parenthesized inverse fragments; `to_uninverted()` final line. Per-step NISS toggles in
  ChainExplorer. Finish forced Never.

**Verify**: every NISS solution still replays to SOLVED after `to_uninverted()` (cubing.js replay).

---

## §9 PROGRESS LOG (agents append: date — phase — commit short hash — gate pass?)

- 2026-06-11 — Plan authored from understand-workflow synthesis (run wf_c5f5d54b-6bb). Phases 1–4 =
  ship normal-side chain; Phase 5 = attempt NISS.
- 2026-06-11 — **P1 done** `a37f2c910`. fr_solver.rs: FR coord = right-coset index of
  H=⟨L2,R2,F2,B2⟩ in G3 (3456 cosets, cleaner than cubelib's nominal 8192; provably same coord==0
  goal — review confirmed group-theoretically sound). FR God number = 11 (baseline locked).
  4 tests green incl. full-space 663,552-state independent oracle. Review: CONCERNS (FB/LR
  distance values lacked independent oracle) → P1b.
- 2026-06-11 — **P1b done** `7b2b56843`. fr_fb_lr_independent_oracle: self-derived ROTS6 axis map
  [UD,UD,LR,LR,FB,FB], full-space per-axis independent BFS ×2, 600 fixtures, physical replay via
  test-built face-relabel (non-circular). VERIFIED_NO_BUG — FB/LR path was already correct.
  5 tests green 8.5s. FR foundation fully verified on all axes.
- 2026-06-11 — **P2 done** `339b5c091` (11 files). FrSolverWasm + 9-site ritual (V→20260611c,
  TABLE_SETS fr:[], FR_NOT_HTR sentinel, StageSolver method 'fr', TNoodleMode stub). Node
  native↔wasm parity bit-exact 4 fixtures incl. all-sentinel; cargo fr 5 green; typecheck 0
  (main loop re-verified); playwright PASS desktop+390px 0 console errors, solution row drives
  shared player, axis labels [UD,UD,LR,LR,FB,FB] correct. FR live in StageSolver.
- 2026-06-11 — **P3 done** `7da7e2c02`. chain_solver.rs: beam DFS EO→DR→HTR→[FR]→Finish over
  residual home-frame state; inv_conj_map proven inverse+homomorphic (exhaustive 6×4×18 test);
  config mini-JSON (no serde, clamps extra≤4 cap≤50); ChainSolverWasm + worker/client 'chain'
  wiring (V→20260611d). 8 chain tests green; full lib 109 green; node parity 4 rows bit-exact
  (FIX1 best 25, FIX2 best 26, baselines locked). Perf: native 8ms, wasm first 644ms then 7ms;
  FR table first build 12.8s wasm. Review CONCERNS → P3b: (1) EO sibling-yk axis dropout
  (completeness bug, fix in stage_eo); (2) mini_json depth limit; UI guards for P4: cap≤10,
  min-couples-extra (expose extra+max only), tolerate steps:[], excluded only canonical
  round-trip, FR default OFF with loading hint.
- 2026-06-11 — **P3b done** `c89b37f8b`. EO sibling-yk fallback (additive enumerate_face_yk in
  eoline_solver) + mini_json depth limit 64; 10/10 chain tests green, FIX1=25/FIX2=26 unchanged;
  wasm rebuilt V→20260611f.
- 2026-06-11 — **P4 done** `ad8364c6f` + `f1125ddeb`. ChainExplorer.tsx/.css mounted as
  analyzer bottom <details>; per-stage axes/extra/max/cap controls (cap≤10), FR toggle default
  OFF, exclude = cumulative canonical round-trip with removable chips, ONE shared TwistySection.
  Playwright: chain 685ms (best 25 HTM quoted), exclude→27 HTM different EO→un-exclude restores,
  controls+FR all PASS, 0 console errors. Mobile 390px overflow (chx-chains escaped flex-start
  column) fixed by main loop: align-items stretch + max-width 100%, re-verified scrollWidth
  375≤390, 10 chains, 0 errors. typecheck/catalog/zh-hant all green.
- 2026-06-11 — **P5 done (engine NISS-Before)**. chain_solver.rs: per-chain two-list (N,I)
  HOME-frame rep; per-stage `niss` (default eo/dr/htr/fr ON, fin forced OFF); two-sided
  enumeration on words rev_inv(I)++S++N / rev_inv(N)++rev_inv(S)++I, merged-then-cap;
  excluded = "cumN|cumI" pair (no '|' = legacy normal-only); JSON gains per-step `inv` +
  per-chain `solution` (= N++rev_inv(I)). Baselines locked: NISS-on FIX1 25 / FIX2 25
  (FIX2 strictly better than off-26, best chain has inverse-side DR); niss-off stays 25/26.
  15 chain tests green (invariant/conjugacy, both-repr stage boundary incl. inverse DR,
  pair-exclude back-compat); full lib 121 green; node parity 6 rows BIT-EXACT (V→20260611g).
  UI follow-up owed: ChainExplorer sends '{}' so it now gets NISS chains — needs paren
  rendering of inv steps + player must use chain `solution` (not step concat); P5-UI next.
- 2026-06-11 — **P5 done (UI + verify)** `bf9f4d31a`. ChainExplorer: per-stage NISS toggles
  (default ON, fin none), inverse steps render mallard-style parens, per-chain
  "Solution (N): ..." line (regex-verified no parens, N==total), player drives linearized
  `solution` (model-API verified alg==Solution line, setup==scramble), exclude round-trip
  rebuilds engine "cumN|cumI" key. Adversarial review of NISS math: PASS (invariant exact,
  inv_conj_map single-application proven, subgroup symmetry tested not assumed). Playwright
  PASS: FIX2 best 25 HTM with "(U D2 B' D2 L2 D F) // drud-eolr (7/11)"; NISS-off reproduces
  26; 390px scrollWidth 375; 0 console errors. Main loop re-verified typecheck clean.
- 2026-06-11 — **SHIPPED.** Phases 1-5 complete & verified. Honest deltas vs mallard:
  EO NISS = Before (not Always: mid-step switching needs enum-internals surgery; assessed,
  deferred); RZP/DR-triggers, HTR-subset [4a1 4e] comments, (a/b) cancellation counts,
  FRLS+insertions: deferred (documented §0). Everything shipped is independently verified
  (non-circular oracles, bit-exact parity, playwright). Commits: a37f2c910 7b2b56843
  339b5c091 7da7e2c02 c89b37f8b ad8364c6f f1125ddeb 7c770a345 bf9f4d31a.
