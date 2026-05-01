// cubedb.net Tab-autocomplete ground truth dataset.
//
// Collected: 2026-05-01
// Source: cubedb.net (Gil Zussman's online reconstruction tool)
// Method: For each (scramble, solution) we navigated to cubedb, set the
//   moves textarea value, placed the cursor at each segment break, dispatched
//   a synthetic Tab keydown, then read every visible
//   `.autocomplete-container .autocomplete-option .autocomplete-text` value.
//
// THIS IS GROUND TRUTH. If you change anything below you MUST re-run the
// cubedb probe (see scripts/probe-cubedb-recon.ts or rerun manually) and
// confirm parity, otherwise our recon autofill will diverge from cubedb.
//
// Source URLs probed:
//   1. user-provided ZBLL example (https://cubedb.net/?puzzle=3x3&scramble=...&alg=...)
//   2. https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=D_U_F2-_L2_U-_B2_F2_D_L2_U_R-_F-_D_R-_F-_U_L_D-_F-_D_R2&alg=... (Max Park 3.13)
//   3. https://cubedb.net/?puzzle=3&title=Finally_a_new_PB!&scramble=F2_D_R2_U2_B_R2_F_D2_B-_R2_B-_L2_D2_R-_D2_U2_R-_B_F2_U-&alg=... (PLL skip)
//   4. https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=B_L2_B_L2_B_L-_B_D2_F-_R_U2_B_U-_B-_R_F-_D-&alg=... (xxcross + T-perm)
//   5. https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=R2_D-_B2_R2_U-_F2_L2_D2_U-_B_D_B2_D2_B_L2_D2_F2_L-_B&alg=... (3rd/4th combined)
//   6. https://cubedb.net/solve/2198 (Asher Kim 3.89 NAR; xcross + OLLCP, repeat group)
//   7. https://cubedb.net/solve/2015 (xcross + VLS = LL skip)
//   8. https://cubedb.net/solve/2200 (full 2-look LL CFOP, PLL Ub)
//   9. https://cubedb.net/solve/2500 (xcross green + OLL Pi + PLL Ua)
//  10. https://cubedb.net/solve/1950 (xxcross + OLL 2 + PLL Ub)
//  11. https://cubedb.net/solve/2100 (full CFOP + PLL Aa)
//  12. https://cubedb.net/solve/1850 (cross + 1st&2nd combined + 2-look LL)
//  13. https://cubedb.net/solve/1800 (full CFOP + Sune + PLL skip)
//
// Notable observations from cubedb behavior (apply these in our autofill):
//   - Suggestions are cube-state-derived. The "Cross Color" UI dropdown only
//     affects highlighting; cubedb's actual cross color label is computed
//     from where the cross stickers actually ended up.
//   - Every match is offered with and without a `(N)` move-count suffix.
//   - F2L pair labels appear in 3 forms: ordinal ("1st pair"), 2-letter
//     color code ("GR Pair"), and full color name ("Green Red Pair").
//     Each form also has its `(N)` variant. No truncation: a step that
//     finishes 4th pair will only ever show 4th pair, never 1st-3rd.
//   - Move-count `(N)` is for the *current segment only* (not cumulative
//     across the whole solve). Rotations (x/y/z) appear NOT to count, but
//     repeat-grouped notation like `(U R U' R')3` still emits 12 face
//     moves; the count we observed for one such case was 14 which suggests
//     repeats *do* expand into HTM (12 face moves + 2 y' rotations was
//     counted as 14 — implying rotations DO count in some contexts).
//   - xcross / xxcross / xxxcross are first-class stage labels, not
//     decorations. xxcross is recognized only when 2 F2L slots are
//     simultaneously filled with the cross.
//   - "SS" / "SB" appear as alternative labels for last-slot insertions
//     in some xcross/xxcross solutions (Square Same-side / Slot Back?
//     Alt notation seen in cubedb only).
//   - When the top layer is already solved or solved-after-CP, popup
//     surfaces both the OLL slot and a CMLL slot (CMLL is Roux's last-layer
//     step naming the same case under a different scheme). After PLL
//     skip the OLL line itself shows OLL(CP) + OLL + OLL N + CMLL labels.
//   - 2-look LL is captured: line N labelled `// OLL` then line N+1
//     labelled `// PLL`. After PLL line cube is solved; if a final AUF is
//     on its own line it returns ZERO popups (cube is already solved at
//     entry, so no recognizable stage).
//   - Combined steps recognized as such: `// 3rd & 4th pairs`,
//     `// 1st & 2nd pairs`, and the corresponding color combos.
//   - ZBLL is NOT a label cubedb ever offers. A 1-look LL alg shows up
//     under `OLL(CP)` + `OLL N` + `CMLL` rather than "ZBLL".
//   - PLL labels use single-letter form: `PLL - T`, `PLL - Ua`, `PLL - Ub`,
//     `PLL - Aa`, `PLL - Y`, etc.
//   - When a move segment fails to advance to a recognized stage end-state
//     (e.g. 2-look OLL halfway, or a partial cross), the popup is empty.
//     Empty `expected: []` is itself a meaningful ground truth value.
//   - The `crosscolor=White` URL param on `/?type=alg` pages is for
//     highlighting only and doesn't affect labels.

export interface ReconFixtureTabPoint {
  /** Full text up to and including the cursor at probe time. Cursor sits at the end. */
  afterText: string;
  /** Every option text shown in cubedb's `.autocomplete-container` popup, in order. */
  expected: string[];
}

export interface ReconFixture {
  id: string;
  source: string;
  /** Human note about the solve (method, special features). */
  notes?: string;
  scramble: string;
  /** Full solution as a single string, lines separated by `\n`. Includes any inline `// comments` if originally present. */
  solution: string;
  /** Tab autocomplete probe results, one entry per segment-end break point. */
  tabPoints: ReconFixtureTabPoint[];
}

export const RECON_GROUND_TRUTH: ReconFixture[] = [
  {
    id: 'recon-1',
    source: "https://cubedb.net/?puzzle=3x3&scramble=F_U2_R-_F2_L-_B2_D2_R_D2_U2_B_D_R-_U-_F2_L-_R2_F-&alg=x-_%2F%2F_insp%0A(D_U-)%E2%86%91_L_l_D-_L-_%2F%2F_W_cross%0AU-_R-_U-_R_%0Ay-_U2_L-_U-_L_%2F%2F_GO%0AU-_R_U-_R2-_U_R_%2F%2F_RB%0AU_R_U_R-_U_R_U-_R-_F_R_F-_%2F%2F_OB%2FZBLS%0AU-_R-_U2-_R2_U_R2-_U_R2_U2-_R-_U_%2F%2F_ZBLL-Pi_(1.168)",
    notes: "User-provided ZBLL solve with non-standard notation (↑ marker, parentheses, wide moves). Cross + 4 F2L (last is ZBLS) + ZBLL. Cubedb labels the 1LL alg as OLL+CMLL, not ZBLL.",
    scramble: "F U2 R' F2 L' B2 D2 R D2 U2 B D R' U' F2 L' R2 F'",
    solution: [
      "x' // insp",
      "(D U')↑ L l D' L' // W cross",
      "U' R' U' R // 1st pair (GR)",
      "y' U2 L' U' L // GO",
      "U' R U' R2' U R // RB",
      "U R U R' U R U' R2' F R F' // OB/ZBLS",
      "U' R' U2' R2 U R2' U R2 U2' R' U // ZBLL'Pi (1.168)",
    ].join('\n'),
    tabPoints: [
      { afterText: "x'", expected: ["// inspection"] },
      { afterText: "x'\n(D U')↑ L l D' L'", expected: ["// cross", "// cross (6)", "// White cross", "// White cross (6)"] },
      { afterText: "x'\n(D U')↑ L l D' L'\nU' R' U' R", expected: ["// 1st pair", "// 1st pair (4)", "// GR Pair", "// GR Pair (4)", "// Green Red Pair", "// Green Red Pair (4)"] },
      { afterText: "x'\n(D U')↑ L l D' L'\nU' R' U' R\ny' U2 L' U' L", expected: ["// 2nd pair", "// 2nd pair (5)", "// GO Pair", "// GO Pair (5)", "// Green Orange Pair", "// Green Orange Pair (5)"] },
      { afterText: "x'\n(D U')↑ L l D' L'\nU' R' U' R\ny' U2 L' U' L\nU' R U' R2' U R", expected: ["// 3rd pair", "// 3rd pair (6)", "// RB Pair", "// RB Pair (6)", "// Red Blue Pair", "// Red Blue Pair (6)"] },
      { afterText: "x'\n(D U')↑ L l D' L'\nU' R' U' R\ny' U2 L' U' L\nU' R U' R2' U R\nU R U R' U R U' R2' F R F'", expected: ["// 4th pair", "// 4th pair (11)", "// OB Pair", "// OB Pair (11)", "// Orange Blue Pair", "// Orange Blue Pair (11)"] },
      { afterText: "x'\n(D U')↑ L l D' L'\nU' R' U' R\ny' U2 L' U' L\nU' R U' R2' U R\nU R U R' U R U' R2' F R F'\nU' R' U2' R2 U R2' U R2 U2' R' U", expected: ["// OLL(CP)", "// OLL", "// OLL 22", "// CMLL", "// CMLL - Pi Right Bar"] },
    ],
  },
  {
    id: 'recon-2',
    source: "https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=D_U_F2-_L2_U-_B2_F2_D_L2_U_R-_F-_D_R-_F-_U_L_D-_F-_D_R2&time=3.13&title=Max+Park+3.13sec++Reconstructed+By+BlueAcidball&alg=x2_%2F%2F_inspectionR-_D_D_R-_D_L-_U_L_D_R-_U-_R_D_%2F%2F_xxcrossL_U-_L-_%2F%2F_3rd_pairU-_R_U_R-_d_R-_U-_R_%2F%2F_4th_pairr-_U-_R_U-_R-_U_U_r_%2F%2F_OLL%28CP%29U_%2F%2F_AUF",
    notes: "Max Park 3.13. xxcross + 2 F2L pairs + OLLCP + AUF. Trailing `U` AUF returns empty popup because cube was already solved before it (the OLL alg solved CP).",
    scramble: "D U F2' L2 U' B2 F2 D L2 U R' F' D R' F' U L D' F' D R2",
    solution: [
      "x2 // inspection",
      "R' D D R' D L' U L D R' U' R D // xxcross",
      "L U' L' // 3rd pair",
      "U' R U R' d R' U' R // 4th pair",
      "r' U' R U' R' U U r // OLL(CP)",
      "U // AUF",
    ].join('\n'),
    tabPoints: [
      { afterText: "x2", expected: ["// inspection"] },
      { afterText: "x2\nR' D D R' D L' U L D R' U' R D", expected: ["// xxcross", "// xxcross (13)", "// White xxcross", "// White xxcross (13)"] },
      { afterText: "x2\nR' D D R' D L' U L D R' U' R D\nL U' L'", expected: ["// 3rd pair", "// 3rd pair (3)", "// GO Pair", "// GO Pair (3)", "// Green Orange Pair", "// Green Orange Pair (3)", "// SS", "// SS (3)"] },
      { afterText: "x2\nR' D D R' D L' U L D R' U' R D\nL U' L'\nU' R U R' d R' U' R", expected: ["// 4th pair", "// 4th pair (8)", "// BR Pair", "// BR Pair (8)", "// Blue Red Pair", "// Blue Red Pair (8)", "// SB", "// SB (8)"] },
      { afterText: "x2\nR' D D R' D L' U L D R' U' R D\nL U' L'\nU' R U R' d R' U' R\nr' U' R U' R' U U r", expected: ["// OLL(CP)", "// OLL", "// OLL 8", "// CMLL", "// CMLL - Anti Sune Right Bar"] },
      { afterText: "x2\nR' D D R' D L' U L D R' U' R D\nL U' L'\nU' R U R' d R' U' R\nr' U' R U' R' U U r\nU", expected: [] },
    ],
  },
  {
    id: 'recon-3',
    source: "https://cubedb.net/?puzzle=3&title=Finally_a_new_PB!&scramble=_F2_D_R2_U2_B_R2_F_D2_B-_R2_B-_L2_D2_R-_D2_U2_R-_B_F2_U-_&time=07.87&alg=____%2F%2F_Green_front_%2F_white_top_%28no_axis_movements%29____D_U-_R-_F_R2_B_r-_U-_M-__%2F%2F_Yellow_xcross_%289%29____R_U-_R2-_U_R_%2F%2F_Blue_Red_Pair_%285%29____L-_U_L_U_R_U_R-__%2F%2F_Green_Red_Pair_%287%29____y-_U_R_U_R-_U_R_U-_R-_%2F%2F_Green_Orange_Pair_%289%29____U_F_R_U_R-_U-_F-__%2F%2F_OLL_45____%2F%2F_PLL_SKIP_%F0%9F%98%83",
    notes: "7.87 PB with PLL skip. xcross + 3 F2L + OLL 45 (F-Sune). After OLL the cube is fully solved.",
    scramble: "F2 D R2 U2 B R2 F D2 B' R2 B' L2 D2 R' D2 U2 R' B F2 U'",
    solution: [
      "D U' R' F R2 B r' U' M' // Yellow xcross (9)",
      "R U' R2' U R // Blue Red Pair (5)",
      "L' U L U R U R' // Green Red Pair (7)",
      "y' U R U R' U R U' R' // Green Orange Pair (9)",
      "U F R U R' U' F' // OLL 45",
      "// PLL SKIP",
    ].join('\n'),
    tabPoints: [
      { afterText: "D U' R' F R2 B r' U' M'", expected: ["// xcross", "// xcross (9)", "// Yellow xcross", "// Yellow xcross (9)"] },
      { afterText: "D U' R' F R2 B r' U' M'\nR U' R2' U R", expected: ["// 2nd pair", "// 2nd pair (5)", "// BR Pair", "// BR Pair (5)", "// Blue Red Pair", "// Blue Red Pair (5)"] },
      { afterText: "D U' R' F R2 B r' U' M'\nR U' R2' U R\nL' U L U R U R'", expected: ["// 3rd pair", "// 3rd pair (7)", "// GR Pair", "// GR Pair (7)", "// Green Red Pair", "// Green Red Pair (7)"] },
      { afterText: "D U' R' F R2 B r' U' M'\nR U' R2' U R\nL' U L U R U R'\ny' U R U R' U R U' R'", expected: ["// 4th pair", "// 4th pair (9)", "// GO Pair", "// GO Pair (9)", "// Green Orange Pair", "// Green Orange Pair (9)", "// SB", "// SB (9)"] },
      { afterText: "D U' R' F R2 B r' U' M'\nR U' R2' U R\nL' U L U R U R'\ny' U R U R' U R U' R'\nU F R U R' U' F'", expected: ["// OLL(CP)", "// OLL", "// OLL 45", "// CMLL", "// CMLL - U Upper Row"] },
    ],
  },
  {
    id: 'recon-4',
    source: "https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=B_L2_B_L2_B_L-_B_D2_F-_R_U2_B_U-_B-_R_F-_D-&alg=y_%2F%2F_inspection%0AD_F-_U_U_L_D2_%2F%2F_xxcross%0A%2F%2F%0A%2F%2F%0AL_U-_L-_%2F%2F_3rd_pair%0AU_U-_F-_U-_F_U_R_U-_R-_%2F%2F_4th_pair%0AU_F_U_R_U-_R-_F-_%2F%2F_OLL%0AU-_R_U_R-_U-_R-_F_R2_U-_R-_U-_R_U_R-_F-_U_%2F%2F_PLL",
    notes: "xxcross (yellow) + 2 F2L + OLL 44 + T-perm with explicit AUF on the PLL line. Lines for empty 1st/2nd pair slot are skipped here.",
    scramble: "B L2 B L2 B L' B D2 F' R U2 B U' B' R F' D'",
    solution: [
      "y // inspection",
      "D F' U U L D2 // xxcross",
      "L U' L' // 3rd pair",
      "U U' F' U' F U R U' R' // 4th pair",
      "U F U R U' R' F' // OLL",
      "U' R U R' U' R' F R2 U' R' U' R U R' F' U // PLL",
    ].join('\n'),
    tabPoints: [
      { afterText: "y", expected: ["// inspection"] },
      { afterText: "y\nD F' U U L D2", expected: ["// xxcross", "// xxcross (6)", "// Yellow xxcross", "// Yellow xxcross (6)"] },
      { afterText: "y\nD F' U U L D2\nL U' L'", expected: ["// 3rd pair", "// 3rd pair (3)", "// OG Pair", "// OG Pair (3)", "// Orange Green Pair", "// Orange Green Pair (3)", "// SS", "// SS (3)"] },
      { afterText: "y\nD F' U U L D2\nL U' L'\nU U' F' U' F U R U' R'", expected: ["// 4th pair", "// 4th pair (9)", "// RB Pair", "// RB Pair (9)", "// Red Blue Pair", "// Red Blue Pair (9)", "// SB", "// SB (9)"] },
      { afterText: "y\nD F' U U L D2\nL U' L'\nU U' F' U' F U R U' R'\nU F U R U' R' F'", expected: ["// OLL", "// OLL 44"] },
      { afterText: "y\nD F' U U L D2\nL U' L'\nU U' F' U' F U R U' R'\nU F U R U' R' F'\nU' R U R' U' R' F R2 U' R' U' R U R' F' U", expected: ["// PLL", "// PLL - T", "// CMLL", "// CMLL - O Adjacent"] },
    ],
  },
  {
    id: 'recon-5',
    source: "https://cubedb.net/?puzzle=3x3x3&type=reconstruction&setup=R2_D-_B2_R2_U-_F2_L2_D2_U-_B_D_B2_D2_B_L2_D2_F2_L-_B&alg=x_y-_%2F%2F_inspection%0AR_D_F_R-_U_D-_%2F%2F_cross%0AR_U_R-_U_R_U-_R-_%2F%2F_1st_pair%0Ad_U_R_U_R-_y-_U-_L-_U-_L_%2F%2F_2nd_pair%0AR_U2-_R-_U_R_U_R2-_U_R_%2F%2F_3rd%2F4th_pairs%0AF_R_U_R-_U-_F-_%2F%2F_OLL%28CP%29%0AU_%2F%2F_AUF",
    notes: "Standard CFOP with 3rd+4th pairs combined into one segment. Cross is Blue. The combined pair line is recognized as just '3rd pair'. The OLL+AUF returns empty (CP issue or alg parse).",
    scramble: "R2 D' B2 R2 U' F2 L2 D2 U' B D B2 D2 B L2 D2 F2 L' B",
    solution: [
      "x y' // inspection",
      "R D F R' U D' // cross",
      "R U R' U R U' R' // 1st pair",
      "d U R U R' y' U' L' U' L // 2nd pair",
      "R U2' R' U R U R2' U R // 3rd/4th pairs",
      "F R U R' U' F' // OLL(CP)",
      "U // AUF",
    ].join('\n'),
    tabPoints: [
      { afterText: "x y'", expected: ["// inspection"] },
      { afterText: "x y'\nR D F R' U D'", expected: ["// cross", "// cross (6)", "// Blue cross", "// Blue cross (6)"] },
      { afterText: "x y'\nR D F R' U D'\nR U R' U R U' R'", expected: ["// 1st pair", "// 1st pair (7)", "// OY Pair", "// OY Pair (7)", "// Orange Yellow Pair", "// Orange Yellow Pair (7)"] },
      { afterText: "x y'\nR D F R' U D'\nR U R' U R U' R'\nd U R U R' y' U' L' U' L", expected: ["// 2nd pair", "// 2nd pair (10)", "// RY Pair", "// RY Pair (10)", "// Red Yellow Pair", "// Red Yellow Pair (10)"] },
      { afterText: "x y'\nR D F R' U D'\nR U R' U R U' R'\nd U R U R' y' U' L' U' L\nR U2' R' U R U R2' U R", expected: ["// 3rd pair", "// 3rd pair (9)", "// RW Pair", "// RW Pair (9)", "// Red White Pair", "// Red White Pair (9)"] },
      { afterText: "x y'\nR D F R' U D'\nR U R' U R U' R'\nd U R U R' y' U' L' U' L\nR U2' R' U R U R2' U R\nF R U R' U' F'", expected: [] },
      { afterText: "x y'\nR D F R' U D'\nR U R' U R U' R'\nd U R U R' y' U' L' U' L\nR U2' R' U R U R2' U R\nF R U R' U' F'\nU", expected: [] },
    ],
  },
  {
    id: 'recon-6',
    source: "https://cubedb.net/solve/2198",
    notes: "Asher Kim 3.89 NAR. xcross + OLLCP. Has `(U R U' R')3` repeat-group notation. Segment 4 is 3rd pair through repeated insertion; cubedb counts it as 14 (12 face moves + 2 y' rotations? — note rotations seemed not to count elsewhere; this is an inconsistency to mirror).",
    scramble: "L' U' B' L2 B' L2 F2 U2 L2 D2 F U R D2 U2 L2 U F' D B'",
    solution: [
      "x2 y' // inspection",
      "U' L' F' R D2 R' D // white xcross",
      "U R' U' R // 2nd pair",
      "y' y' (U R U' R')3 // 3rd pair",
      "U2 y R U' R' U R U' R' // 4th pair",
      "L F' L' U' L U F U' L' U // OLL(CP)",
    ].join('\n'),
    tabPoints: [
      { afterText: "x2 y'", expected: ["// inspection"] },
      { afterText: "x2 y'\nU' L' F' R D2 R' D", expected: ["// xcross", "// xcross (7)", "// White xcross", "// White xcross (7)"] },
      { afterText: "x2 y'\nU' L' F' R D2 R' D\nU R' U' R", expected: ["// 2nd pair", "// 2nd pair (4)", "// RB Pair", "// RB Pair (4)", "// Red Blue Pair", "// Red Blue Pair (4)"] },
      { afterText: "x2 y'\nU' L' F' R D2 R' D\nU R' U' R\ny' y' (U R U' R')3", expected: ["// 3rd pair", "// 3rd pair (14)", "// RG Pair", "// RG Pair (14)", "// Red Green Pair", "// Red Green Pair (14)"] },
      { afterText: "x2 y'\nU' L' F' R D2 R' D\nU R' U' R\ny' y' (U R U' R')3\nU2 y R U' R' U R U' R'", expected: ["// 4th pair", "// 4th pair (9)", "// OG Pair", "// OG Pair (9)", "// Orange Green Pair", "// Orange Green Pair (9)"] },
      { afterText: "x2 y'\nU' L' F' R D2 R' D\nU R' U' R\ny' y' (U R U' R')3\nU2 y R U' R' U R U' R'\nL F' L' U' L U F U' L' U", expected: ["// OLL(CP)", "// OLL", "// OLL 39", "// CMLL", "// CMLL - L Good"] },
    ],
  },
  {
    id: 'recon-7',
    source: "https://cubedb.net/solve/2015",
    notes: "VLS into PLL skip = full LL skip after F2L. The 4th-pair segment shown is actually the VLS alg that simultaneously inserts the pair and orients+permutes LL. Cubedb labels it as just '4th pair' because the cube reaches solved state.",
    scramble: "D B2 U' L2 D' B2 L2 U2 R2 U' F2 D2 B' F' R' F' R' F' L2 R B'",
    solution: [
      "y z2 // inspection",
      "D2 R B2 U2 F' U R' F R // xcross",
      "U2 R' U R U' R' U' R // 2nd pair",
      "U2 L U' L' U2 L U' L' // 3rd pair",
      "U' R' F R F' R U2 R' // VLS into PLL Skip, basically LL skip",
    ].join('\n'),
    tabPoints: [
      { afterText: "y z2", expected: ["// inspection"] },
      { afterText: "y z2\nD2 R B2 U2 F' U R' F R", expected: ["// xcross", "// xcross (9)", "// White xcross", "// White xcross (9)"] },
      { afterText: "y z2\nD2 R B2 U2 F' U R' F R\nU2 R' U R U' R' U' R", expected: ["// 2nd pair", "// 2nd pair (8)", "// OG Pair", "// OG Pair (8)", "// Orange Green Pair", "// Orange Green Pair (8)"] },
      { afterText: "y z2\nD2 R B2 U2 F' U R' F R\nU2 R' U R U' R' U' R\nU2 L U' L' U2 L U' L'", expected: ["// 3rd pair", "// 3rd pair (8)", "// OB Pair", "// OB Pair (8)", "// Orange Blue Pair", "// Orange Blue Pair (8)"] },
      { afterText: "y z2\nD2 R B2 U2 F' U R' F R\nU2 R' U R U' R' U' R\nU2 L U' L' U2 L U' L'\nU' R' F R F' R U2 R'", expected: ["// 4th pair", "// 4th pair (8)", "// RG Pair", "// RG Pair (8)", "// Red Green Pair", "// Red Green Pair (8)"] },
    ],
  },
  {
    id: 'recon-8',
    source: "https://cubedb.net/solve/2200",
    notes: "Full 2-look LL: edges-orient (`U l' U l U l' U' l F U' F'`) on its own line returns empty popup, then OLL 26 (anti-Sune) + PLL Ub.",
    scramble: "F' R D2 U2 B' D2 F' L2 R2 D2 R2 F2 L2 F' U' L D' F' D B2 F2",
    solution: [
      "y z2 // inspection",
      "D R' D // xcross (3)",
      "U F' L F L' // 2nd pair (5)",
      "U2 L U' L' // 3rd pair (4)",
      "U F' U2 F U' R U R' // 4th pair (8)",
      "U l' U l U l' U' l F U' F'",
      "L' U' L U' L' U2 L // OLL",
      "U' M2' U' M U2 M' U' M2' U2 // PLL - Ub",
    ].join('\n'),
    tabPoints: [
      { afterText: "y z2", expected: ["// inspection"] },
      { afterText: "y z2\nD R' D", expected: ["// xcross", "// xcross (3)", "// White xcross", "// White xcross (3)"] },
      { afterText: "y z2\nD R' D\nU F' L F L'", expected: ["// 2nd pair", "// 2nd pair (5)", "// RB Pair", "// RB Pair (5)", "// Red Blue Pair", "// Red Blue Pair (5)"] },
      { afterText: "y z2\nD R' D\nU F' L F L'\nU2 L U' L'", expected: ["// 3rd pair", "// 3rd pair (4)", "// OB Pair", "// OB Pair (4)", "// Orange Blue Pair", "// Orange Blue Pair (4)"] },
      { afterText: "y z2\nD R' D\nU F' L F L'\nU2 L U' L'\nU F' U2 F U' R U R'", expected: ["// 4th pair", "// 4th pair (8)", "// RG Pair", "// RG Pair (8)", "// Red Green Pair", "// Red Green Pair (8)"] },
      { afterText: "y z2\nD R' D\nU F' L F L'\nU2 L U' L'\nU F' U2 F U' R U R'\nU l' U l U l' U' l F U' F'", expected: [] },
      { afterText: "y z2\nD R' D\nU F' L F L'\nU2 L U' L'\nU F' U2 F U' R U R'\nU l' U l U l' U' l F U' F'\nL' U' L U' L' U2 L", expected: ["// OLL(CP)", "// OLL", "// OLL 26", "// CMLL", "// CMLL - Anti Sune Right Bar"] },
      { afterText: "y z2\nD R' D\nU F' L F L'\nU2 L U' L'\nU F' U2 F U' R U R'\nU l' U l U l' U' l F U' F'\nL' U' L U' L' U2 L\nU' M2' U' M U2 M' U' M2' U2", expected: ["// PLL", "// PLL - Ub"] },
    ],
  },
  {
    id: 'recon-9',
    source: "https://cubedb.net/solve/2500",
    notes: "Green xcross + standard CFOP + OLL 22 (Pi) + PLL Ua. Demonstrates non-white cross color and `S` slice move in PLL.",
    scramble: "U2 F R' D' F' B2 R' D F D R2 U2 F2 R2 U' B2 U L2 U R2",
    solution: [
      "x' y // inspection",
      "R' F' R2 D R2 D U L' // xcross",
      "U' L U L' // 2nd pair",
      "y' D' R U R' D // 3rd pair",
      "R' F R F' // 4th pair",
      "U R U2 R2' U' R2 U' R2' U2' R // OLL",
      "R2 U' S' U2' S U' R2 U' // PLL",
    ].join('\n'),
    tabPoints: [
      { afterText: "x' y", expected: ["// inspection"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'", expected: ["// xcross", "// xcross (8)", "// Green xcross", "// Green xcross (8)"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'\nU' L U L'", expected: ["// 2nd pair", "// 2nd pair (4)", "// OW Pair", "// OW Pair (4)", "// Orange White Pair", "// Orange White Pair (4)"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'\nU' L U L'\ny' D' R U R' D", expected: ["// 3rd pair", "// 3rd pair (6)", "// RY Pair", "// RY Pair (6)", "// Red Yellow Pair", "// Red Yellow Pair (6)"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'\nU' L U L'\ny' D' R U R' D\nR' F R F'", expected: ["// 4th pair", "// 4th pair (4)", "// WR Pair", "// WR Pair (4)", "// White Red Pair", "// White Red Pair (4)"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'\nU' L U L'\ny' D' R U R' D\nR' F R F'\nU R U2 R2' U' R2 U' R2' U2' R", expected: ["// OLL(CP)", "// OLL", "// OLL 22", "// CMLL", "// CMLL - Pi Right Bar"] },
      { afterText: "x' y\nR' F' R2 D R2 D U L'\nU' L U L'\ny' D' R U R' D\nR' F R F'\nU R U2 R2' U' R2 U' R2' U2' R\nR2 U' S' U2' S U' R2 U'", expected: ["// PLL", "// PLL - Ua"] },
    ],
  },
  {
    id: 'recon-10',
    source: "https://cubedb.net/solve/1950",
    notes: "Green xxcross + 2 F2L + OLL 2 + PLL Ub.",
    scramble: "F2 D L B L' B L2 B' U2 L' D2 F2 B2 L' U2 L D2 F2 L B2",
    solution: [
      "x' y // inspection",
      "B2 R2' F' R D2 U' F2 // xxcross (7)",
      "U2 R U R' U2 R U' R' // 3rd pair (8)",
      "U2 L' U' L y' U2 R U' R' // 4th pair (9)",
      "F R U R' U' F' f R U R' U' f' // OLL(CP)",
      "M2' U' M' U2 M U' M2' U // PLL - Ub",
    ].join('\n'),
    tabPoints: [
      { afterText: "x' y", expected: ["// inspection"] },
      { afterText: "x' y\nB2 R2' F' R D2 U' F2", expected: ["// xxcross", "// xxcross (7)", "// Green xxcross", "// Green xxcross (7)"] },
      { afterText: "x' y\nB2 R2' F' R D2 U' F2\nU2 R U R' U2 R U' R'", expected: ["// 3rd pair", "// 3rd pair (8)", "// RY Pair", "// RY Pair (8)", "// Red Yellow Pair", "// Red Yellow Pair (8)"] },
      { afterText: "x' y\nB2 R2' F' R D2 U' F2\nU2 R U R' U2 R U' R'\nU2 L' U' L y' U2 R U' R'", expected: ["// 4th pair", "// 4th pair (9)", "// RW Pair", "// RW Pair (9)", "// Red White Pair", "// Red White Pair (9)", "// SB", "// SB (9)"] },
      { afterText: "x' y\nB2 R2' F' R D2 U' F2\nU2 R U R' U2 R U' R'\nU2 L' U' L y' U2 R U' R'\nF R U R' U' F' f R U R' U' f'", expected: ["// OLL(CP)", "// OLL", "// OLL 2", "// CMLL", "// CMLL - Pi Right Bar"] },
      { afterText: "x' y\nB2 R2' F' R D2 U' F2\nU2 R U R' U2 R U' R'\nU2 L' U' L y' U2 R U' R'\nF R U R' U' F' f R U R' U' f'\nM2' U' M' U2 M U' M2' U", expected: ["// PLL", "// PLL - Ub"] },
    ],
  },
  {
    id: 'recon-11',
    source: "https://cubedb.net/solve/2100",
    notes: "Full standard CFOP: cross + 4 pairs + OLL 37 + PLL Aa. Uses doubled-letter notation (`R R` instead of `R2`); cubedb normalizes correctly.",
    scramble: "x2 y U' R' U' F' U' R' F L' B R2 B2 R D2 L F2 R' B2 U2 D2 L",
    solution: [
      "y' x // inspection",
      "R F F x' R R // cross",
      "U' R' U' R // 1st pair",
      "U' y' R U R R U' R // 2nd pair",
      "R U R' U U F U F' // 3rd pair",
      "U' R U U R' R' F R F' // 4th pair",
      "y' F R U' R' U' R U R' F' // OLL",
      "U' R R F F R' B' R F F R' B R' // PLL",
    ].join('\n'),
    tabPoints: [
      { afterText: "y' x", expected: ["// inspection"] },
      { afterText: "y' x\nR F F x' R R", expected: ["// cross", "// cross (6)", "// White cross", "// White cross (6)"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R", expected: ["// 1st pair", "// 1st pair (4)", "// GR Pair", "// GR Pair (4)", "// Green Red Pair", "// Green Red Pair (4)"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R\nU' y' R U R R U' R", expected: ["// 2nd pair", "// 2nd pair (8)", "// BR Pair", "// BR Pair (8)", "// Blue Red Pair", "// Blue Red Pair (8)"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R\nU' y' R U R R U' R\nR U R' U U F U F'", expected: ["// 3rd pair", "// 3rd pair (8)", "// OG Pair", "// OG Pair (8)", "// Orange Green Pair", "// Orange Green Pair (8)"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R\nU' y' R U R R U' R\nR U R' U U F U F'\nU' R U U R' R' F R F'", expected: ["// 4th pair", "// 4th pair (9)", "// OB Pair", "// OB Pair (9)", "// Orange Blue Pair", "// Orange Blue Pair (9)"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R\nU' y' R U R R U' R\nR U R' U U F U F'\nU' R U U R' R' F R F'\ny' F R U' R' U' R U R' F'", expected: ["// OLL", "// OLL 37"] },
      { afterText: "y' x\nR F F x' R R\nU' R' U' R\nU' y' R U R R U' R\nR U R' U U F U F'\nU' R U U R' R' F R F'\ny' F R U' R' U' R U R' F'\nU' R R F F R' B' R F F R' B R'", expected: ["// PLL", "// PLL - Aa", "// CMLL", "// CMLL - O Adjacent"] },
    ],
  },
  {
    id: 'recon-12',
    source: "https://cubedb.net/solve/1850",
    notes: "1st-pair-skip: cross alone is recognized as partial (empty popup), then the next segment is labelled '1st & 2nd pairs' (combined). Then 2-look LL with separate OLL 38 and PLL Y. Trailing AUF returns empty.",
    scramble: "B2 U2 L' F D2 B' L' R2 F D2 R2 B2 D2 F2 B R2 B' L2 D",
    solution: [
      "z2 //Inspection",
      "F' U R' F2 // Cross",
      "y' L' U' L D2 y2 U2 L' U L // Second pair (First pair skip)",
      "U2 R U' R' U' F' U' F U' R U2 R' // Third pair",
      "y2 L' U L F' L F L' U2 // Fourth pair",
      "R U R' U R U' R' U' R' F R F' // OLL",
      "U2 F R U' R' U' R U R' F' R U R' U' R' F R F' // PLL",
      "U' // AUF",
    ].join('\n'),
    tabPoints: [
      { afterText: "z2", expected: ["// inspection"] },
      { afterText: "z2\nF' U R' F2", expected: [] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L", expected: ["// 1st & 2nd pairs", "// 1st & 2nd pairs (10)", "// GO & GR Pairs", "// GO & GR Pairs (10)", "// Green Orange & Green Red Pairs", "// Green Orange & Green Red Pairs (10)"] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L\nU2 R U' R' U' F' U' F U' R U2 R'", expected: ["// 3rd pair", "// 3rd pair (12)", "// OB Pair", "// OB Pair (12)", "// Orange Blue Pair", "// Orange Blue Pair (12)"] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L\nU2 R U' R' U' F' U' F U' R U2 R'\ny2 L' U L F' L F L' U2", expected: ["// 4th pair", "// 4th pair (9)", "// RB Pair", "// RB Pair (9)", "// Red Blue Pair", "// Red Blue Pair (9)"] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L\nU2 R U' R' U' F' U' F U' R U2 R'\ny2 L' U L F' L F L' U2\nR U R' U R U' R' U' R' F R F'", expected: ["// OLL", "// OLL 38"] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L\nU2 R U' R' U' F' U' F U' R U2 R'\ny2 L' U L F' L F L' U2\nR U R' U R U' R' U' R' F R F'\nU2 F R U' R' U' R U R' F' R U R' U' R' F R F'", expected: ["// PLL", "// PLL - Y", "// CMLL", "// CMLL - O Diagonal"] },
      { afterText: "z2\nF' U R' F2\ny' L' U' L D2 y2 U2 L' U L\nU2 R U' R' U' F' U' F U' R U2 R'\ny2 L' U L F' L F L' U2\nR U R' U R U' R' U' R' F R F'\nU2 F R U' R' U' R U R' F' R U R' U' R' F R F'\nU'", expected: [] },
    ],
  },
  {
    id: 'recon-13',
    source: "https://cubedb.net/solve/1800",
    notes: "Full standard CFOP, Yellow cross + Sune OLL 27 + PLL skip + AUF. Trailing AUF empty popup (cube already solved).",
    scramble: "L2 F' U' R2 D L2 F2 L2 D' R2 U' L2 U' B' D B' D2 R F2 R'",
    solution: [
      "y // inspection",
      "R D' L R // cross (4)",
      "y' U L' U2 L U' L' U L // 1st pair (9)",
      "y R U' R2 U R // 2nd pair (6)",
      "L' U2 L U L' U' L // 3rd pair (7)",
      "U' R U' R' U2 R U' R' // 4th pair (8)",
      "U2' R U R' U R U2 R' // OLL (8)",
      "U' // AUF",
    ].join('\n'),
    tabPoints: [
      { afterText: "y", expected: ["// inspection"] },
      { afterText: "y\nR D' L R", expected: ["// cross", "// cross (4)", "// Yellow cross", "// Yellow cross (4)"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L", expected: ["// 1st pair", "// 1st pair (9)", "// OG Pair", "// OG Pair (9)", "// Orange Green Pair", "// Orange Green Pair (9)"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L\ny R U' R2 U R", expected: ["// 2nd pair", "// 2nd pair (6)", "// BO Pair", "// BO Pair (6)", "// Blue Orange Pair", "// Blue Orange Pair (6)"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L\ny R U' R2 U R\nL' U2 L U L' U' L", expected: ["// 3rd pair", "// 3rd pair (7)", "// RG Pair", "// RG Pair (7)", "// Red Green Pair", "// Red Green Pair (7)"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L\ny R U' R2 U R\nL' U2 L U L' U' L\nU' R U' R' U2 R U' R'", expected: ["// 4th pair", "// 4th pair (8)", "// RB Pair", "// RB Pair (8)", "// Red Blue Pair", "// Red Blue Pair (8)"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L\ny R U' R2 U R\nL' U2 L U L' U' L\nU' R U' R' U2 R U' R'\nU2' R U R' U R U2 R'", expected: ["// OLL(CP)", "// OLL", "// OLL 27", "// CMLL", "// CMLL - Sune Left Bar"] },
      { afterText: "y\nR D' L R\ny' U L' U2 L U' L' U L\ny R U' R2 U R\nL' U2 L U L' U' L\nU' R U' R' U2 R U' R'\nU2' R U R' U R U2 R'\nU'", expected: [] },
    ],
  },
];
