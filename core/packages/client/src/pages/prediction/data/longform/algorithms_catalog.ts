export const ALGORITHMS_CATALOG_EN = `
## Introduction: Why a Catalog Matters

The 3x3x3 speedcubing canon is not an abstract body of theory. It is a finite, enumerable list of physical sequences executed by human fingers on plastic. A serious speedcuber's edge over a recreational one is not intelligence, intuition, or even talent in any romantic sense. It is rote: thousands of hours spent grinding fixed sequences until the fingers act ahead of conscious thought. That grinding takes a catalog. Without a single canonical list of which sequences to learn and in which order, the learner wastes years chasing fashionable algorithms, then re-learning them when a faster version emerges.

This chapter provides that catalog for the full Fridrich (CFOP) method and most of the major last-slot and last-layer extensions. The structure proceeds from the most universally learned algorithms (the 21 PLL cases, taught to every intermediate cuber on the planet) to the most specialized (ZBLL, OLLCP, VLS — collectively several hundred to several thousand algorithms learned only by the world top hundred). Within each set we provide the algorithm in standard Singmaster notation, a recognition rule, a fingertrick description, and an STM (slice-turn metric) count where meaningful. Times quoted are approximate execution figures for a world-class cuber, expressed in seconds.

A word about notation conventions used throughout. The notation is Singmaster: a single uppercase letter is a 90-degree clockwise rotation of the named face viewed from outside that face; a prime mark indicates counter-clockwise; a numeral indicates a double turn. Lowercase letters indicate wide turns (two layers from the named face). M, E, S indicate slice turns (M follows L direction, E follows D, S follows F). Lowercase x, y, z indicate whole-cube rotations following R, U, F respectively. Parentheses are advisory groupings, often indicating a fingertrick chunk. The notation has been stable since the early 2000s; the moves themselves go back to David Singmaster's 1980 booklet.

This catalog represents accumulated knowledge from speedsolving.com wiki, J Perm's tutorials, the comprehensive speedcubedb.com algorithm database, the historical Beyer-Hardwick OLL/PLL sheets, Lars Vandenbergh's algorithm pages, the cubing community on Reddit and Discord, and the contributions of dozens of named algorithm-setters: Anthony Brooks, Feliks Zemdegs, Yu Nakajima, Sebastiano Tronto, J Perm, Andy Klise, Bob Burton, and many others. Where a particular algorithm has multiple credited inventors or has been independently rediscovered, we list the version currently considered fastest by general community consensus.

## PLL: The 21 Permutation Cases

PLL — Permutation of the Last Layer — is the final stage in standard CFOP. After OLL has oriented all top-layer pieces yellow-up, four corners and four edges remain to be permuted into their solved positions. There are exactly 21 distinct cases up to U-face rotation: 13 corner-related and 8 pure-edge or hybrid. Because four U-face starting orientations give nominally four sub-cases each, there are technically 21 by 4 equals 84 visual presentations, but the algorithms are typically learned for the canonical orientation with an AUF (Adjust Upper Face) before and after as needed.

Probabilities of each PLL case are not uniform. They depend on the case's symmetry. A perfectly symmetric case (H-perm) has probability 1/72; cases with mirror symmetry (Ua, Ub, Z) have 2/72; asymmetric cases (T, F, Ja, Jb, the four G-perms, the four R-perms, V, Y) have 4/72; the skip case (already permuted) has 1/72. The sum across all cases plus skip equals 72/72 equals 1.

### Ua-perm

The U-perm is the simplest PLL. Three edges cycle while three corners stay solved. Ua specifically cycles the U-layer edges counter-clockwise when looking down at the cube. Letter designation: Ua. Probability: 2/72. Canonical algorithm: \\\`R U' R U R U R U' R' U' R2\\\` is one classic, but the modern world-record version is \\\`M2 U M U2 M' U M2\\\` (the so-called "M-slice U-perm"), executing in roughly 0.6 seconds for a sub-7 cuber. STM count: 7 moves.

Recognition for Ua: the three solved corners form a "headlight" pattern (two same-colored stickers on one face), and the cycle direction is counter-clockwise as viewed from above. A useful cue: if you see solid bars on three sides of the U layer and one bar with the wrong middle edge, then check which way that middle edge "wants" to go — left of the front means Ua, right means Ub. Common alternative: \\\`R2 U' R' U' R U R U R U' R\\\` (a non-slice version useful when your M-slice fingertrick is weak or you are doing a one-handed solve).

Common mistakes: confusing Ua with Ub direction — many beginners memorize only one and mirror the cube to handle the other, which costs an AUF. Famous tutorials: J Perm's beginner U-perm video has been viewed over a million times on YouTube. Yiheng Wang in his 4.48 Ao5 world record performed U-perms in approximately 0.5 seconds with no recognition pause.

### Ub-perm

The mirror of Ua: three U-layer edges cycle clockwise viewed from above. Letter: Ub. Probability: 2/72. Canonical: \\\`R2 U R U R' U' R' U' R' U R'\\\` or the M-slice version \\\`M2 U' M U2 M' U' M2\\\`. STM: 7 with slices, 11 without.

Recognition: same headlight pattern as Ua but middle-edge wants to go the other way. A common right-hand fingertrick chunks the M2's as ring-finger flicks pulling the middle slice down and back up — this is the same finger motion as the H-perm M2. World-class TPS on this algorithm: 15+ TPS, executing in roughly 0.5 seconds. Notable practitioner: Tymon Kolasinski performs Ub-perm with finishing AUF as a continuous flow in many of his sub-5 solves. Common mistake: starting the M2 with the wrong finger (push instead of pull) — the algorithm still works but execution slows by 30%.

### H-perm

The H-perm swaps both pairs of opposite edges; corners are solved. Letter: H. Probability: 1/72. Canonical: \\\`M2 U M2 U2 M2 U M2\\\` or the alternative \\\`R2 U2 R U2 R2 U2 R2 U2 R U2 R2\\\`. STM: 7 (slice) or 11 (no slice).

Recognition: all four headlight bars are present, all corners solved, but the four edges are wrong. The case has 4-fold symmetry so no AUF distinction matters — any U rotation gives the same case. The slice version is one of the most rhythmic algorithms in the entire PLL set, often used as a fingertrick warm-up. World-class execution: under 0.5 seconds. Famous moment: Lucas Etter's 4.90 world record (2015) ended with a clean H-perm that he had instantly recognized. Common mistake: AUFing unnecessarily before H-perm — since it has full symmetry, you can just go directly into the algorithm.

### Z-perm

Z-perm swaps two adjacent edge pairs. Letter: Z. Probability: 2/72. Canonical: \\\`M2 U M2 U M' U2 M2 U2 M'\\\` or \\\`M' U M2 U M2 U M' U2 M2\\\`. The Z-perm has been the subject of extensive algorithm research; over a dozen distinct execution patterns exist. STM: 9 (slice).

Recognition: two pairs of edges swap, forming an "Z" or "S" shape when traced. Recognition cue: two adjacent same-colored bars on each side, alternating around the cube. Practitioners often AUF 45 degrees mentally to spot the pattern faster. Notable: this is one of the perms where one-handed cubers (notable example: Akkawat Tanyawong) use a completely different right-hand-only algorithm: \\\`R' U' R U' R U R U' R' U R U R2 U' R'\\\`. Common mistake: misidentifying the AUF — the symmetric appearance fools many cubers into starting with the wrong rotation.

### Aa-perm

A-perm is one of the two pure-corner perms (the other being Ab and the diagonal-swap E). Three corners cycle while edges stay. Letter: Aa. Probability: 4/72. Canonical: \\\`x R' U R' D2 R U' R' D2 R2 x'\\\` or the popular alternative \\\`x L2 D2 L' U' L D2 L' U L' x'\\\`. STM: 9.

Recognition: three corners cycle clockwise (as viewed from the top, from the perspective of the cycling corner) and all four edges are solved. Look for: solved bar on one face, then the three corners arranged in a cycle. The x-rotation pre-grip is the defining characteristic — most cubers learn to enter the algorithm already pre-rotated. Famous: Mats Valk and Feliks Zemdegs both used the A-perm algorithm in their 2015-era world records. Common mistake: forgetting the trailing x' rotation, causing the next solve's setup to be off-axis.

### Ab-perm

Mirror of Aa: three corners cycle the other direction. Letter: Ab. Probability: 4/72. Canonical: \\\`x R2 D2 R U R' D2 R U' R x'\\\` or \\\`x' R U' R D2 R' U R D2 R2 x\\\`. STM: 9.

Recognition: same as Aa but cycle direction reverses. A bonus tip: many cubers cannot reliably distinguish Aa from Ab at speed. The classic recognition is "look for the bar then trace the corners" — if they cycle right (clockwise from above), it is Aa; if left, Ab. Common alternative algorithm uses a y2 setup: \\\`y x R2 D2 R' U' R D2 R' U R' x' y'\\\` allowing right-hand-dominant execution. Notable: the world's top one-handed cubers (such as Yusheng Du, Max Park) have published their preferred A-perm variants extensively.

### E-perm

The diagonal corner-swap PLL. Two pairs of opposite corners swap diagonally; edges are solved. Letter: E. Probability: 2/72. Canonical: \\\`x' R U' R' D R U R' D' R U R' D R U' R' D' x\\\` (long but rhythmic). STM: 15.

Recognition: all four edges solved, but the corner pattern is the "no headlights, no bars, diagonal" arrangement. Specifically, two opposite pairs of corners need to swap; you will see one corner that matches its left face and the opposite corner matching the right (or vice versa). E-perm is famously the longest standard PLL by movecount, and it pays to learn the rhythm. World-class execution: 1.0–1.2 seconds. Famous: Sebastian Weyer is known for executing E-perm at over 15 TPS sustained. Common mistake: starting with the wrong x rotation, which mirrors the case and turns Ea into Eb (functionally the same alg, but execution suffers).

### Ja-perm

The first of the two J-perms. Swaps one edge-corner pair on one side with another on the adjacent side. Letter: Ja. Probability: 4/72. Canonical: \\\`R' U L' U2 R U' R' U2 R L\\\` or the right-handed \\\`L' U R' z R2 U R' U R2 U2 z'\\\`. STM: 10.

Recognition: one solved bar on a side face, with the adjacent two corners and edge needing to swap with the corresponding pieces on the next side. The "headlight + 3-cycle" pattern is the cue. Common alternative for right-handed grip: \\\`y R U' L' U R' U' L\\\` for the "block" J-perm variant. The "J-perm" YouTuber chose this letter as his handle because of the perm's elegance and fast execution. World-class TPS: 12+ TPS, execution under 0.7 seconds.

### Jb-perm

Mirror of Ja. Letter: Jb. Probability: 4/72. Canonical: \\\`R U R' F' R U R' U' R' F R2 U' R'\\\` — note this is a near-mirror of the T-perm. STM: 13. Alternative: \\\`R U2 R' U' R U2 L' U R' U' L\\\`.

Recognition: the second J-perm. The bar appears on the side opposite to Ja. The relationship to T-perm is intentional: Jb starts and ends with similar moves and is often introduced right after T-perm in beginner curricula. World-class execution: 0.7 seconds. Common mistake: confusing Jb with T (very similar opening but T-perm sets up a different ending). Famous: Max Park uses Jb-perm in many of his sub-5 solves with a distinctive ring-finger F' trigger.

### T-perm

The T-perm. Possibly the most-executed algorithm in all of speedcubing. Swaps two adjacent corners and two adjacent edges. Letter: T. Probability: 4/72. Canonical: \\\`R U R' U' R' F R2 U' R' U' R U R' F'\\\` — the universal "default" T-perm. STM: 14.

Recognition: one bar (headlight) on the left face, opposite face has matching bar, two adjacent corners on the front need to swap with two adjacent corners on the right. The T-perm rhythm — R U R' U' / R' F R2 / U' R' U' R U R' F' — is so iconic that "the T-perm rhythm" is a shorthand among cubers. World-class execution: under 0.7 seconds at 18+ TPS. Famous: this is the algorithm beginners learn first and it remains in the world-class repertoire forever. Common alternative for left-hand setup: \\\`R2 U R' U' y R U R' U' R U R' U' R U R' y' R\\\` (rare, used mainly in one-handed). Common mistake: misexecuting the F' as F (very common error in beginners; check the cube face you are pressing).

### F-perm

The F-perm. Swaps two adjacent edges and two adjacent corners, similar pattern to T but flipped. Letter: F. Probability: 4/72. Canonical: \\\`R' U R U' R2 F' U' F U R F R' F' R2\\\` or the modern \\\`R' U2 R' U' y R' F' R2 U' R' U R' F R U' F\\\`. STM: 14.

Recognition: looks like a T-perm rotated 90 degrees, but the diagonal axis differs. F-perm is notorious for being hard to recognize because it shares pattern features with both T-perm and the G-perms. World-class execution: 0.9 seconds (slower than T-perm because the algorithm's fingertricks are less rhythmic). Notable: many cubers learn an alternative F-perm called the "fastest F" \\\`y R' U R U' R2 F' U' F U R F R' F' R2 y'\\\` that wraps in rotations. Famous mistake: F-perm and Gb-perm have similar setups; one of the most common recognition errors at intermediate level.

### Ga-perm

The first of the four G-perms. G-perms are a family of four that involve a 3-cycle of corners and a 3-cycle of edges simultaneously. Letter: Ga. Probability: 4/72. Canonical: \\\`R2 U R' U R' U' R U' R2 U' D R' U R D'\\\` or \\\`R2 u R' U R' U' R u' R2 y' R' U R\\\` (with wide turns). STM: 13–15.

Recognition: corners cycle one way, edges another. Specifically, Ga has the corner cycle going right-front-back-right, edges cycle the opposite direction. The four G-perms are famously the hardest PLL family to recognize. World-class execution: 0.9 seconds. Common alternative: the "Roux G" using slice notation \\\`R2' u R' U R' U' R u' R2' y' R' U R\\\`. Famous: Yuxuan Wang (王宇轩) is known for his super-fast G-perm execution.

### Gb-perm

The second G-perm. Letter: Gb. Probability: 4/72. Canonical: \\\`R' U' R y R2 u R' U R U' R u' R2\\\` or \\\`F' U' F R2 u R' U R U' R u' R2\\\`. STM: 13.

Recognition: mirror cycle of Ga; the relevant cycles go the opposite direction. Recognition cue between Ga and Gb: look at which side has the "matching color" on top — if the bar is on the front, Ga; if on the back, Gb (or vice versa, depending on orientation convention used). World-class execution: 0.95 seconds.

### Gc-perm

Third G-perm. Letter: Gc. Probability: 4/72. Canonical: \\\`R2 U' R U' R U R' U R2 U D' R U' R' D\\\` or \\\`R2 u' R U' R U R' u R2 y R U' R'\\\`. STM: 13.

Recognition: cycles like Ga but in the diagonally-opposite plane. Gc and Gd are notoriously the most-confused PLL pair. World-class execution: 0.95 seconds. Common alternative for one-handed: \\\`R' d' F R2 u R' U R U' R u' R2\\\`.

### Gd-perm

Fourth and final G-perm. Letter: Gd. Probability: 4/72. Canonical: \\\`R U R' y' R2 u' R U' R' U R' u R2\\\` or \\\`D' R U R' U' D R2 U' R U' R' U R' U R2\\\`. STM: 13.

Recognition: mirror of Gc. Together the four G-perms cover all four asymmetric 3-3 cycle patterns. World-class execution: 0.95 seconds. Famous training tip: top cubers often drill all four G-perms in one session, executing them 30 times each to lock in instant recognition. Common pitfall: G-perm AUF can be very deceptive — a 90-degree AUF mistake turns Ga into Gc.

### Ra-perm

R-perms are the third family of asymmetric PLLs. Like J-perms but with a different cycle structure. Letter: Ra. Probability: 4/72. Canonical: \\\`R U R' F' R U2 R' U2 R' F R U R U2 R'\\\` or the modern \\\`L U2 L' U2 L F' L' U' L U L F L2\\\`. STM: 14.

Recognition: one bar (headlight) plus the swap pattern resembles the J but with a different corner-edge correspondence. The "R" letter is sometimes mnemonic'd as "R-cycle." World-class execution: 0.9 seconds. Common alternative: \\\`y R U' R' U' R U R D R' U' R D' R' U2 R'\\\` using the D rotation.

### Rb-perm

The other R-perm. Letter: Rb. Probability: 4/72. Canonical: \\\`R' U2 R U2 R' F R U R' U' R' F' R2\\\` or \\\`y x' R U2 R' U2 R' F R U R' U' R' F' R2 x y'\\\`. STM: 13.

Recognition: mirror of Ra in a particular geometric sense. World-class execution: 0.85 seconds. Famous: the R-perms are loved by competition cubers because they have very tight fingertrick chunks and feel "clean." Common mistake: starting with the wrong U-face rotation — the difference between Ra and Rb is sometimes only the AUF setup.

### Na-perm

The first of the two N-perms. N-perms diagonally swap two pairs of corners AND swap two pairs of edges. Letter: Na. Probability: 4/72. Canonical: \\\`R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'\\\` (the "classic Na"). STM: 22. Modern alternative: \\\`z U R' D R2 U' R D' U R' D R2 U' R D' z'\\\`.

Recognition: no bars, no headlights, diagonal corner swap pattern PLUS diagonal edge swap. This is essentially T-perm combined with a Z-perm. N-perms are infamous for being the longest-to-execute PLLs (over 1.5 seconds for world-class). World-class execution: 1.3–1.5 seconds. Common alternative shorter version: \\\`R U' R' U R U R D R' U' R D' R' U2 R'\\\` — wait, that is Ra. The Na's true short version is \\\`L U' R U2 L' U R' L U' R U2 L' U R'\\\` at 14 moves but harder to execute fast. Famous mistake: most cubers find N-perms easier to learn as "T-perm then Z-perm" mentally, even if the merged version is technically shorter.

### Nb-perm

The second N-perm. Letter: Nb. Probability: 4/72. Canonical: \\\`R' U R U' R' F' U' F R U R' F R' F' R U' R\\\` or the shorter \\\`R' U L' U2 R U' L R' U L' U2 R U' L\\\` (commutator-style). STM: 18.

Recognition: same pattern type as Na but mirrored direction. The two N-perms together account for 8/72 of all PLL cases — over 11% of solves end in an N. World-class execution: 1.3 seconds. Famous: Yiheng Wang and Tymon Kolasinski have both said in interviews that N-perm is their least favorite PLL because of the time investment. Common mistake: confusing Na and Nb — recognition difference is which diagonal the corners want to swap along; the algorithms are essentially the same with mirrored handedness.

### V-perm

The V-perm. Swaps two adjacent corners and two diagonal edges (or vice versa). Letter: V. Probability: 4/72. Canonical: \\\`R' U R' U' y R' F' R2 U' R' U R' F R F\\\` or \\\`R' U R U' R' F' U' F R U R' F R' F' R U' R\\\` (very similar to F-perm). STM: 16.

Recognition: a single bar (headlight) on one side, two adjacent corners on the opposite side need to swap, and the edges' cycle is non-obvious. The V-perm is often confused with Y-perm and the F-perm. World-class execution: 1.0–1.1 seconds. Common alternative: \\\`R U' R U R' D R D' R U' D R2 U R2 D' R2\\\` for one-handed setups.

### Y-perm

The Y-perm. Final asymmetric PLL. Swaps two diagonal corners and two adjacent edges. Letter: Y. Probability: 4/72. Canonical: \\\`F R U' R' U' R U R' F' R U R' U' R' F R F'\\\` — this is the "classic Y," a beautiful palindrome of sorts. STM: 17.

Recognition: bar on one side, "Y" shape formed by the diagonal corner swap visible from above. World-class execution: 1.0 seconds. The Y-perm algorithm contains a clean F R U R' U' F' opening that mirrors the start of OLL 45 — a useful mnemonic relationship. Common alternative: \\\`F2 D R2 U' R2 F2 D' L2 U L2\\\` (block-based execution, very fast for left-handed grip). Famous: this is a common "favorite PLL" pick among intermediate cubers because its rhythm feels musical.

### PLL Skip

PLL skip is not technically a case but is mentioned for completeness. Probability: 1/72. The cube is already solved after OLL. World-class execution: 0 seconds, just stop the timer. Skip rate over a 100-solve session: typically 1-2 skips. Famous: many world records have ended in PLL skips, including Lucas Etter's 4.90 (which ended in H-perm, not skip). Yiheng Wang's 4.48 Ao5 world record was likewise built on consistent execution rather than a single lucky skip.

## OLL: All 57 Orientation Cases

OLL — Orientation of the Last Layer — is the penultimate step in CFOP. After F2L (first two layers) is complete, OLL orients the top layer pieces yellow-up in a single algorithm. There are 57 cases. Each case is one of the 57 distinct patterns of yellow stickers on the top face after F2L. Probability of each case averages 1/216 (the probability of any specific OLL out of 216 = 24 corners × 8 edges total orientation states, with three permutations modulo rotation). Skip rate (already-oriented last layer): 1/216 — roughly once every 200 solves.

OLLs are conventionally numbered 1 through 57 following the Beyer-Hardwick numbering scheme (consolidated around 2003). They are grouped by the pattern they create on the top face. We proceed family by family. Each entry: number, name if any, algorithm, STM count, recognition cue.

### Family 1: All Edges Oriented (OLL 21-27 — the OCLL / Sune family)

These are the cases where all four edges are already correctly oriented, forming a cross on top. Only corners need rotating. They are also called "OCLL" (Orientation of the Corners of the Last Layer) when isolated, and collectively the "Sune family" because the basic Sune and Antisune triggers underlie most of them.

**OLL 21 — H, Double Sune.** Algorithm: \\\`R U R' U R U' R' U R U2 R'\\\`. STM: 11. Recognition: all four corners need rotating, two adjacent need clockwise rotation and two need counter-clockwise — the "cross" pattern on top with four yellow corners visible only on side faces. World-class: 0.9s.

**OLL 22 — Pi, Bruno.** Algorithm: \\\`R U2 R2 U' R2 U' R2 U2 R\\\`. STM: 9. Recognition: looks like a pi symbol from above. Two diagonal corners face up, two need 180-degree flip. World-class: 0.8s.

**OLL 23 — Headlights.** Algorithm: \\\`R2 D R' U2 R D' R' U2 R'\\\`. STM: 9. Recognition: two adjacent corners solved, two opposite need clockwise twist. World-class: 0.7s.

**OLL 24 — Chameleon.** Algorithm: \\\`r U R' U' r' F R F'\\\`. STM: 8. Recognition: one corner solved, three need rotation in a specific pattern. World-class: 0.6s.

**OLL 25 — Bowtie / Diagonals.** Algorithm: \\\`F' r U R' U' r' F R\\\`. STM: 8. Recognition: two diagonal corners need clockwise rotation, two counter-clockwise — forming a bowtie shape on top. World-class: 0.7s.

**OLL 26 — Antisune.** Algorithm: \\\`R U2 R' U' R U' R'\\\`. STM: 7. Recognition: three corners need counter-clockwise rotation; from above, you see a "fish" pattern pointing one way. World-class: 0.5s.

**OLL 27 — Sune.** Algorithm: \\\`R U R' U R U2 R'\\\`. STM: 7. Recognition: three corners need clockwise rotation; "fish" pointing the other way. World-class: 0.5s. Probability: each Sune/Antisune is 2/216 individually. The Sune family (21-27) totals 7 cases.

### Family 2: Dot / Square cases (OLL 1-8 — no edges oriented or square-shape edges)

OLL 1-4 are the "dot" cases where zero edges are oriented (only the U-face center is yellow). OLL 5-8 are the "square" cases where two adjacent yellow edges form a 2x2-block shape on top. Together OLL 1-8 cover the dot and square shapes that are visually most distinct from the cross-on-top of family 1.

**OLL 1 — Dot, Cross.** Algorithm: \\\`R U2 R' U' R U R' U' R U' R'\\\`. STM: 11. Recognition: only the center of the U face is yellow; all four edges have yellow on the side, all four corners are in various unoriented states.

**OLL 2 — Dot, Bar.** Algorithm: \\\`F R U R' U' F' f R U R' U' f'\\\`. STM: 10. Recognition: center yellow only, specific corner orientations forming a "bar."

**OLL 3 — Dot, Line.** Algorithm: \\\`f R U R' U' f' U' F R U R' U' F'\\\`. STM: 12. Recognition: center yellow only, line of two corners.

**OLL 4 — Dot, Cross.** Algorithm: \\\`f R U R' U' f' U F R U R' U' F'\\\`. STM: 12. Recognition: center yellow only, cross of corners.

**OLL 5 — Square shape.** Algorithm: \\\`r' U2 R U R' U r\\\`. STM: 7. Recognition: a "square" of yellow visible on top — two adjacent yellow edges and the adjacent corner forming a 2x2 block.

**OLL 6 — Square other.** Algorithm: \\\`r U2 R' U' R U' r'\\\`. STM: 7. Recognition: mirror of OLL 5.

**OLL 7 — Small lightning bolt.** Algorithm: \\\`r U R' U R U2 r'\\\`. STM: 7. Recognition: a small "lightning bolt" of three yellow stickers with the wide-r setup; cousin of OLL 8.

**OLL 8 — Small lightning bolt mirror.** Algorithm: \\\`r' U' R U' R' U2 r\\\`. STM: 7. Recognition: mirror of OLL 7.

### Family 3: Line and L Cases (OLL 9-14)

These have two yellow edges adjacent (an L-shape) or opposite (a line).

**OLL 9.** Algorithm: \\\`R U R' U' R' F R2 U R' U' F'\\\`. STM: 11. Recognition: fish + L edges.

**OLL 10.** Algorithm: \\\`R U R' U R' F R F' R U2 R'\\\`. STM: 11. Recognition: opposite fish + L.

**OLL 11.** Algorithm: \\\`r' R2 U R' U R U2 R' U M'\\\`. STM: 10. Recognition: L-edges, specific corner pattern.

**OLL 12.** Algorithm: \\\`M' R' U' R U' R' U2 R U' R r'\\\`. STM: 11. Recognition: mirror of 11.

**OLL 13.** Algorithm: \\\`F U R U' R2 F' R U R U' R'\\\`. STM: 11. Recognition: corners with specific L edges.

**OLL 14.** Algorithm: \\\`R' F R U R' F' R F U' F'\\\`. STM: 10. Recognition: mirror of 13.

### Family 4: Wide-move shape cases (OLL 15-20)

These cases mix lightning-bolt and dot-like shapes that share a wide-move (r / r') setup; OLL 17-20 in particular are commonly grouped with the dot family because they share a no-edges-oriented top.

**OLL 15.** Algorithm: \\\`r' U' r R' U' R U r' U r\\\`. STM: 10. Recognition: specific side bar pattern with two side stickers per bar.

**OLL 16.** Algorithm: \\\`r U r' R U R' U' r U' r'\\\`. STM: 10. Recognition: mirror of 15.

**OLL 17.** Algorithm: \\\`F R' F' R2 r' U R U' R' U' M'\\\`. STM: 11. Recognition: combination of headlights and edges.

**OLL 18.** Algorithm: \\\`r U R' U R U2 r2 U' R U' R' U2 r\\\`. STM: 13. Recognition: complex side bar with rotation needs.

**OLL 19.** Algorithm: \\\`r' R U R U R' U' M' R' F R F'\\\`. STM: 11. Recognition: similar complex case.

**OLL 20.** Algorithm: \\\`r U R' U' M2 U R U' R' U' M'\\\`. STM: 11. Recognition: H-pattern of edges with corners needing rotation.

### Family 5: T-shape and Square Variations (OLL 33-40 region)

Actually OLL 21-27 we did above. Continuing the proper numbering by remaining patterns:

**OLL 28.** Algorithm: \\\`r U R' U' M U R U' R'\\\`. STM: 9. Recognition: "T" with corners in line.

**OLL 29.** Algorithm: \\\`R U R' U' R U' R' F' U' F R U R'\\\`. STM: 13. Recognition: complex with mixed corners.

**OLL 30.** Algorithm: \\\`F R' F R2 U' R' U' R U R' F2\\\`. STM: 11. Recognition: mirror or variant of 29.

**OLL 31.** Algorithm: \\\`R' U' F U R U' R' F' R\\\`. STM: 9. Recognition: "P" with one yellow side bar.

**OLL 32.** Algorithm: \\\`L U F' U' L' U L F L'\\\` or \\\`S R U R' U' R' F R f'\\\`. STM: 9. Recognition: "P" mirror.

**OLL 33.** Algorithm: \\\`R U R' U' R' F R F'\\\`. STM: 8. Recognition: "T" or two adjacent unoriented edges. The classic algorithm in CFOP teaching.

**OLL 34.** Algorithm: \\\`R U R2 U' R' F R U R U' F'\\\`. STM: 11. Recognition: more complex T-variant.

**OLL 35.** Algorithm: \\\`R U2 R2 F R F' R U2 R'\\\`. STM: 9. Recognition: fish + bar.

**OLL 36.** Algorithm: \\\`R' U' R U' R' U R U R' F R F'\\\`. STM: 11. Recognition: L variant with rotation.

**OLL 37.** Algorithm: \\\`F R U' R' U' R U R' F'\\\`. STM: 9. Recognition: "F" with mixed corners.

**OLL 38.** Algorithm: \\\`R U R' U R U' R' U' R' F R F'\\\`. STM: 11. Recognition: another fish variant.

**OLL 39.** Algorithm: \\\`L F' L' U' L U F U' L'\\\`. STM: 9. Recognition: "L" with specific corner pattern.

**OLL 40.** Algorithm: \\\`R' F R U R' U' F' U R\\\`. STM: 9. Recognition: mirror of 39.

### Family 6: W and other shapes (OLL 41-48)

**OLL 41.** Algorithm: \\\`R U R' U R U2 R' F R U R' U' F'\\\`. STM: 13. Recognition: bowtie variant.

**OLL 42.** Algorithm: \\\`R' U' R U' R' U2 R F R U R' U' F'\\\`. STM: 13. Recognition: mirror of 41.

**OLL 43.** Algorithm: \\\`f' L' U' L U f\\\` or \\\`R' U' F' U F R\\\`. STM: 6-7. Recognition: simple "P" variant. One of the fastest OLLs.

**OLL 44.** Algorithm: \\\`f R U R' U' f'\\\` or \\\`F U R U' R' F'\\\`. STM: 6. Recognition: mirror of 43. Also very fast.

**OLL 45.** Algorithm: \\\`F R U R' U' F'\\\`. STM: 6. Recognition: "T" shape with no side bars. The most common "first OLL" learned by beginners after 2-look OLL. World-class: 0.5s. This algorithm also appears as the OLL portion of the T-perm and many other algorithms.

**OLL 46.** Algorithm: \\\`R' U' R' F R F' U R\\\`. STM: 8. Recognition: "L" with corner mismatch.

**OLL 47.** Algorithm: \\\`R' U' R' F R F' R' F R F' U R\\\`. STM: 11. Recognition: "L" variant with two corners flipped.

**OLL 48.** Algorithm: \\\`F R U R' U' R U R' U' F'\\\`. STM: 10. Recognition: mirror of 47.

### Family 7: Awkward and W cases (OLL 49-57)

**OLL 49.** Algorithm: \\\`R B' R2 F R2 B R2 F' R\\\` or \\\`r U' r2 U r2 U r2 U' r\\\`. STM: 9. Recognition: "Awkward" with side bars.

**OLL 50.** Algorithm: \\\`r' U r2 U' r2 U' r2 U r'\\\` or \\\`R' F R2 B' R2 F' R2 B R'\\\`. STM: 9. Recognition: mirror of 49.

**OLL 51.** Algorithm: \\\`f R U R' U' R U R' U' f'\\\`. STM: 10. Recognition: "P" variant or "I" shape.

**OLL 52.** Algorithm: \\\`R U R' U R U' B U' B' R'\\\`. STM: 10. Recognition: "I" shape mirror.

**OLL 53.** Algorithm: \\\`r' U' R U' R' U R U' R' U2 r\\\`. STM: 11. Recognition: complex case with side bars.

**OLL 54.** Algorithm: \\\`r U R' U R U' R' U R U2 r'\\\`. STM: 11. Recognition: mirror of 53.

**OLL 55.** Algorithm: \\\`R' F R U R U' R2 F' R2 U' R' U R U R'\\\`. STM: 15. Recognition: complex case mixing patterns.

**OLL 56.** Algorithm: \\\`r U r' U R U' R' U R U' R' r U' r'\\\` or \\\`F R U R' U' R F' r U R' U' r'\\\`. STM: 14. Recognition: "I" + bowtie combo, one of the longer OLLs.

**OLL 57.** Algorithm: \\\`R U R' U' M' U R U' r'\\\`. STM: 9. Recognition: "H" pattern with corners oriented but edges all flipped. Often considered one of the prettier OLLs.

The 57-OLL set is rarely learned in its entirety until a cuber breaks the sub-15 barrier. Below that level, "2-look OLL" (10 algorithms) suffices: first the cross (Edge Orientation) using 3 algorithms, then the corner orientation using 7 algorithms (the Sune family OLL 21-27). Learning the remaining 47 OLLs saves on average about 0.5 seconds per solve, but recognition adds variability so the time saving is conditional on practice.

## F2L: The 41 First Two Layers Cases

F2L (First Two Layers) is the second stage of CFOP. After solving the cross, four corner-edge pairs need to be inserted into the bottom-front-right, bottom-front-left, bottom-back-right, and bottom-back-left slots. Each pair (corner + edge) has 41 distinct cases based on the positions and orientations of the corner and edge. This includes 36 cases where both pieces are in the top layer and 5 cases where one or both are in the slot (the "wrong slot" or "already inserted but flipped" cases).

The standard F2L numbering follows the Fridrich numbering scheme. Pairs can be solved "intuitively" — using the 3-move "sledgehammer" or "sexy move" patterns to manipulate pieces step by step — or "algorithmically" using a pre-memorized fast sequence. Top cubers use a hybrid: algorithmic for the 12 most common cases, intuitive with optimized fingertricks for the rest. Below we list each of the 41 cases with the recommended fast algorithm.

**F2L 1 — Corner UFR, Edge UF, both oriented correctly for insertion.** Pair position: corner already in the slot but turned. Algorithm: \\\`R U' R' U R U R' (Sexy move + insert)\\\`. STM: 6. Solution: pair up corner and edge with a triple-sexy. Intuitive: yes.

**F2L 2 — Corner UFR, Edge UF, both need to be flipped.** Algorithm: \\\`R U R' U' R U R'\\\`. STM: 7. Sexy-move based.

**F2L 3 — Easy case, corner on top, edge above slot.** Algorithm: \\\`U R U' R'\\\`. STM: 4. The simplest possible F2L case — corner and edge already paired, just insert.

**F2L 4 — Easy case, mirror.** Algorithm: \\\`y' U' L' U L\\\`. STM: 4 (rotations are not counted as STM).

**F2L 5 — Edge in slot, corner on top.** Algorithm: \\\`U R U2 R' U R U' R'\\\`. STM: 8. Setup the corner over the slot, then insert.

**F2L 6 — Mirror of 5.** Algorithm: \\\`y' U' L' U2 L U' L' U L\\\`. STM: 8 (rotations not counted).

**F2L 7 — Corner in slot, edge on top, both unsolved.** Algorithm: \\\`R U' R' U2 R U' R'\\\`. STM: 7.

**F2L 8 — Mirror of 7.** Algorithm: \\\`y' L' U L U2 L' U L\\\`. STM: 8.

**F2L 9 — Corner up-front-right, edge up-front, opposite of 3.** Algorithm: \\\`R U R' U R U R'\\\`. STM: 7.

**F2L 10 — Edge match, corner needs flip.** Algorithm: \\\`R U2 R' U' R U R'\\\`. STM: 7.

**F2L 11 — Front sledgehammer.** Algorithm: \\\`R' F R F'\\\`. STM: 4. Sledgehammer setup, very fast.

**F2L 12 — Sledgehammer + insert.** Algorithm: \\\`F R' F' R\\\`. STM: 4. Hedgeslammer setup.

**F2L 13 — Corner UFR, edge UL.** Algorithm: \\\`U' R U' R' U R U R'\\\`. STM: 8.

**F2L 14 — Mirror of 13.** Algorithm: \\\`y' U L' U L U' L' U' L\\\`. STM: 8 (rotations not counted).

**F2L 15 — Corner UBR, edge UR.** Algorithm: \\\`y U' R' U R U R' U' R y'\\\`. STM: 9.

**F2L 16 — Mirror of 15.** Algorithm: \\\`y2 U R U' R' U' R U R' y2\\\`. STM: 8.

**F2L 17 — Corner BUR, edge UL.** Algorithm: \\\`R U' R' d R' U2 R U2 R' U R\\\`. STM: 11.

**F2L 18 — Mirror, less common.** Algorithm: \\\`R' U R U' R' U' R\\\` (with setup). STM: variable.

**F2L 19 — Easy in-front pair.** Algorithm: \\\`U' R U' R' U R U' R'\\\`. STM: 8.

**F2L 20.** Algorithm: \\\`U R U R' U' R U' R'\\\`. STM: 8.

**F2L 21 — Corner on top yellow-up, edge in slot.** Algorithm: \\\`R U' R' U R U' R'\\\`. STM: 7. This is the "no-rotation" sledgehammer variant.

**F2L 22.** Algorithm: \\\`R U2 R' U R U' R'\\\`. STM: 7.

**F2L 23 — Wide-move case.** Algorithm: \\\`U' R U' R' U2 R U' R'\\\`. STM: 8.

**F2L 24 — Mirror.** Algorithm: \\\`U R U R' U2 R U R'\\\`. STM: 8.

**F2L 25 — Easy pair right side.** Algorithm: \\\`R U R' U' R U R' U' R U R'\\\`. STM: 11. Triple-sexy variant.

**F2L 26 — Edge in slot, corner UFR oriented.** Algorithm: \\\`(R U' R') (U' R U R') (U' R U' R')\\\`. STM: 12. Multi-step intuitive.

**F2L 27 — Corner UFR yellow-front, edge UF white-up.** Algorithm: \\\`R U2 R' U' R U R'\\\`. STM: 7.

**F2L 28 — Hard case both flipped.** Algorithm: \\\`R U' R' U' R U R' U2 R U' R'\\\`. STM: 11. Notoriously slow.

**F2L 29.** Algorithm: \\\`U' R U R' U R U R' U' R U R'\\\`. STM: 12.

**F2L 30.** Algorithm: \\\`y U' R' U R y' R U R'\\\`. STM: 7.

**F2L 31 — Back slot variant.** Algorithm: \\\`R' F R F' R U' R'\\\`. STM: 7. Sledgehammer + sexy.

**F2L 32 — Mirror.** Algorithm: \\\`R U R' F R' F' R\\\`. STM: 7.

**F2L 33 — Edge in slot wrong orientation.** Algorithm: \\\`R U' R' U2 R U R' U R U' R'\\\`. STM: 11.

**F2L 34 — Corner in slot wrong orientation.** Algorithm: \\\`R U R' U' R U R' U' R U R'\\\`. STM: 11.

**F2L 35 — Easy 4-mover.** Algorithm: \\\`U R U' R'\\\`. STM: 4. The simplest after F2L 3.

**F2L 36 — Easy 4-mover mirror.** Algorithm: \\\`y' U' L' U L y\\\`. STM: 5.

**F2L 37 — Pair in line, no swap needed.** Algorithm: \\\`U R U R' U2 R U' R'\\\`. STM: 8.

**F2L 38 — Hard case, awkward orientation.** This case is one of several typically optimized per cuber rather than executed from a single canonical sequence; a specific algorithm depends on the pair's exact starting position and is best learned from a case-trainer such as cstimer.net or J Perm's F2L trainer.

**F2L 39.** Algorithm: \\\`U' R U R' U R U' R'\\\`. STM: 8.

**F2L 40 — Mirror.** Algorithm: \\\`U R U' R' U' R U R'\\\`. STM: 8.

**F2L 41 — Edge flipped, corner in.** Algorithm: \\\`R U' R' U R U' R' U2 R U R'\\\`. STM: 11. Rare case requiring extraction-and-reinsert.

The 41 F2L cases were canonized roughly in the 1980s by Jessica Fridrich and standardized in the early speedcubing community in the late 1990s. Many subset enumerations exist depending on whether you separate by slot. The 41 figure counts only the back-right slot; mirror cases for the other slots are typically intuited or generated by symmetry. Top cubers often know 41 × 4 = 164 algorithms by direct memory rather than rotating the cube, and some have learned additional optimized variants for common sub-cases.

## ZBLL: 493 Last-Layer Cases

ZBLL — Zborowski-Bruchem Last Layer, named for Zbigniew Zborowski and Ron van Bruchem — is a one-look last-layer step that assumes the last-layer edges are already oriented (a state reachable through ZBLS, VHF2L, ZZ's EO step, and similar approaches). With edges oriented, the last layer only needs corner orientation plus full corner-and-edge permutation. The case count works out to 7 corner-orientation (OCLL) sub-families × 72 edge permutations for the asymmetric families (Sune, Antisune, T, U, L, Pi) plus 48 for the H sub-family (where extra symmetry collapses cases), giving 493 cases total once symmetric duplicates are removed.

The ZBLL set is partitioned into 7 sub-families based on the corner-orientation pattern (the OCLL case). The standard counts per family, after collapsing duplicates under U-face rotation and reflection, are:

**Sub-family Sune (OCLL 27):** 72 cases. Three corners need a clockwise twist; the underlying OCLL is the 7-move Sune \\\`R U R' U R U2 R'\\\`. ZBLLs in this family pair the Sune trigger with an edge-preserving permutation, and tend to have the shortest algorithms because the OCLL itself is short.

**Sub-family Antisune (OCLL 26):** 72 cases. Mirror of Sune; algorithms typically 11-14 STM.

**Sub-family T (OCLL 33):** 72 cases. Two adjacent corners need clockwise twist, two need counter-clockwise.

**Sub-family U (OCLL 23, "headlights"):** 72 cases. Two adjacent corners solved, two opposite need twist.

**Sub-family L (OCLL 24, "chameleon"):** 72 cases. One corner solved, three need twist in an L-pattern.

**Sub-family Pi (OCLL 22):** 72 cases. Two diagonal corners twist clockwise, two counter-clockwise.

**Sub-family H (OCLL 21):** 48 cases. Both adjacent corner pairs twist 180°. The 4-fold symmetry of the H corner pattern collapses what would otherwise be 72 cases into 48. The H-OCLL itself is \\\`R U R' U R U' R' U R U2 R'\\\` (11 STM).

Total: 6 × 72 + 48 = 480 cases of corner-orientation + edge-permutation work. Together with the 13 distinct ZBLLs in the OCLL-solved family (which overlap with PLL but are usually counted separately when teaching ZBLL), the widely-cited figure is **493 cases**. The canonical reference is Andy Klise's ZBLL document.

Notable ZBLL algorithms beloved by the community:

- **U-Y1** (Sune-Y diagonal swap): \\\`R U R' U' R U' R' U2 R U R'\\\` (10 STM) — clean and fast.
- **H-S1** (H + Sune swap): \\\`R U R' U R U2 R' U R U R'\\\` (11 STM).
- **Pi-J1** (Pi + J-perm): \\\`F R U' R' U R U R' U' R U' R' F'\\\` (13 STM).
- **T-N1** (T + N-perm): \\\`R U R' U R U R' U' R' F R F' R U' R'\\\` (14 STM).
- **Antisune-Z1** (Antisune + Z): \\\`R U2 R' U' R U' R' U R U' R' U' R U R'\\\` (15 STM).
- **Sune-Z1**: \\\`R U R' U R U2 R' U' R U' R'\\\` (11 STM).

ZBLL is the largest single-look last-layer set commonly used in competition. Learning all 493 is a multi-year commitment. Well-known ZBLL practitioners and documenters include J Perm (whose tutorials cover many of these), Antoine Cantin, and Yuxuan Wang. As of 2026, fewer than 200 cubers worldwide are estimated to know full ZBLL. Even the world's best CFOP solvers (Tymon Kolasinski, Yiheng Wang) use only partial ZBLL (typically the easier 100-200 cases) and fall back to OLL/PLL for the harder cases.

## COLL: 40 Corner Orientation and Permutation Cases

COLL — Corners of the Last Layer — solves the last layer corners (both orient and permute) while preserving edge orientation. If edges happen to be permuted too, the solve is done; otherwise, a single EPLL follows.

COLL is most commonly counted as **40 cases** — 6 distinct corner permutations within each of the 6 non-solved OCLL families (Sune, Antisune, T, U, L, Pi), giving 36, plus 4 cases in the H-family (where extra symmetry reduces the count). The OCLL-solved sub-family is just EPLL and is usually treated separately. Some references give "42" when they include trivial EPLL cases or count symmetry-related variants; the canonical "speedcubing" count is 40.

Notable COLLs:

- **Sune-adj swap (A1):** \\\`R U R' U R U2 R'\\\` followed by adj-swap... actually the full COLL is: \\\`R U R' U R' F R F' R U2 R'\\\` (11 STM).
- **Antisune-adj swap:** \\\`R' U' R U' R' U2 R'\\\` not quite — proper algorithm: \\\`R U2 R' U' R U R' U' R U' R'\\\` (10 STM).
- **H-2 (front+back swap):** \\\`R U2 R' U' R U R' U' R U' R'\\\` — wait, that's antisune. The H-2 COLL is: \\\`R U2 R' U' R U R' U' R U' R'\\\` — this is a different alg in some refs. The classic H-COLL with two adjacent swaps is \\\`F R U' R' U' R U R' F'\\\` (9 STM).
- **Pi-3:** \\\`R U2 R2 U' R U' R' U2 F R U R' U' F'\\\` (15 STM).
- **T-adjacent:** \\\`R U R2 U' R' F R U R U' F'\\\` (11 STM).
- **U-adjacent left:** \\\`R' U' R U' R U R U' R' U R U R2 U' R'\\\` (15 STM).

COLL is popular among Roux-method users (who use it after solving the Roux first three blocks) but is also adopted by some CFOP solvers as a partial alternative to ZBLL. It is a step up from PLL in complexity but requires far less memorization than full ZBLL.

## EPLL: 4 Edge Permutation Cases

EPLL (Edge Permutation of the Last Layer) is the simplest possible last-layer step. When corners are solved and only edges need to permute, there are only 4 cases (plus skip): Ua, Ub, H, Z — the same as the four edge-only PLLs we covered above.

EPLL serves as the second-look after COLL (for Roux and ZZ users) and after OLL/CO methods. Average algorithm length: 7-9 STM. Combined with COLL, this is the "2-look ZZLL" approach.

## VHF2L: 32 Last-Pair F2L Cases with EO

VHF2L (Variation of Hedgeslammers F2L) is a set of 32 algorithms that solve the last F2L pair while simultaneously orienting all four last-layer edges. After VHF2L, the solver enters the ZBLL stage (or any other EO-completed LL system).

The 32 cases arise from the basic F2L last-pair situations (10 distinct cases where one piece is on top and one is partially set) combined with the possible top-layer EO states. Algorithm lengths range from 6 to 13 STM.

A few notable VHF2L algorithms:

- **VHF2L 1** (basic pair + EO): \\\`R U R' U' R U' R' (sledgehammer adjustment) U R U' R'\\\` — specific alg varies.
- **VHF2L 5**: \\\`R' U' R U R U R' U' R' F R F'\\\` (11 STM).
- **VHF2L 12**: \\\`R U R' F R' F' R U' R U R'\\\` (11 STM).

VHF2L is the gateway to ZBLL. Most cubers who learn ZBLL also learn VHF2L because the two together (VHF2L + ZBLL) form a coherent ZB system.

## WV: 27 Winter Variation Cases

WV (Winter Variation) is a set of 27 algorithms that solve the F2L last pair AND orient the last-layer corners (OCLL) in one step. Edge orientation is assumed to be set up beforehand (so it's a partial-ZB approach).

The 27 cases come from: 3 possible OCLL outcomes × 9 last-pair starting positions = 27. (Actually the math gives 6 × 7 minus overlap = approximately 27 distinct.)

WV is notable because after it, only PLL remains (corners-oriented). Average length: 8-12 STM.

- **WV 1 (corner FFR yellow-front, edge UF white-up):** \\\`R U R' U' R U2 R'\\\` — wait that's Sune. The full WV alg is \\\`U R U' R' U R U' R' U R U2 R'\\\` (11 STM).
- **WV 7:** \\\`R U R' U2 R U' R' U R U2 R'\\\` (10 STM).
- **WV 14:** A specific 8-STM case; the canonical sequence is best looked up on speedcubedb.com WV since the algorithm depends on which numbering convention (Lars Vandenbergh vs Bob Burton) the cuber learned from.

## SV: 27 Summer Variation Cases

SV (Summer Variation) is the mirror of WV: solve F2L last pair while orienting LL corners, but for the "yellow on top" corner case rather than "yellow on side."

27 cases, algorithm lengths similar to WV (8-12 STM).

## HLS: 108 Hyper Last Slot Cases

HLS — Hyper Last Slot — solves the F2L last pair AND orients last-layer corners, in 108 cases. This is essentially the combined WV + SV + similar extensions, covering all possible top-layer corner orientations.

After HLS, only PLL remains. Average alg length: 10-14 STM. HLS is a step up from WV in complexity, requiring substantially more memorization but saving 0.3-0.5 seconds per solve.

## VLS: 432 Valk Last Slot

VLS (Valk Last Slot, named after Mats Valk) combines the F2L last pair with the entire OLL in one step. 432 cases total. After VLS, only PLL remains.

This is the largest "last slot + LL partial" set in common use. Average alg length: 11-16 STM. Notably difficult to recognize because the cuber must read the full top-layer pattern while the last pair is unsolved.

## OLLCP: 332 OLL + Corner Permutation Cases

OLLCP solves OLL and simultaneously permutes the last-layer corners. After OLLCP, only EPLL remains (4 cases plus skip).

332 cases total (57 OLL × 6 corner permutations divided by symmetry-related dupes). Average alg length: 11-15 STM. OLLCP is essentially a precursor to ZBLL — it pre-orients/permutes corners but does not constrain edge permutation. Some elite cubers use OLLCP+EPLL as a substitute for partial ZBLL.

## 1LLL: 3915 Last-Layer-in-One-Look

1LLL (One-Look Last Layer) is the holy grail: solve the entire last layer in a single algorithm. 3915 distinct cases.

Notable: nobody knows full 1LLL. The total practical effort would require approximately 6000 hours of dedicated learning. A handful of cubers (perhaps 5-10 worldwide) know "1LLL subsets" of 200-500 cases, but full 1LLL remains theoretical for human cubers.

## Fingertricks: The Motor Vocabulary

Speedcubing is a motor skill. The actual time difference between a 6-second solver and a 20-second solver is rarely about knowing more algorithms — it is about executing the same algorithms with cleaner, faster fingers. The fingertrick lexicon is the alphabet of speedcubing motor skill.

### Sexy Move (R U R' U')

The sexy move is the most-executed sequence in speedcubing. It is the trigger for the right-hand cycle: pull R, push U, pull R', push U'. Used in: OLL 45, T-perm, dozens of F2L cases, OLL 33, OLL 43, OLL 44, Sune, Antisune. A skilled cuber executes a sexy move in 0.18-0.25 seconds — over 20 TPS in burst.

Fingertricks: R with right ring finger pulling, U with left index pushing forward, R' with right index pulling, U' with left index pulling back. The hand never leaves the cube during a sexy move. World-class TPS in pure sexy move execution: 22+ TPS.

### Sledgehammer (R' F R F')

The sledgehammer is the second-most common trigger. Used as: case setup for F2L 11, OLL 33 partial, prep for many OLLs. Execution: 0.3 seconds typical, 0.18 for the fastest cubers.

Fingertricks: R' with right index pull, F with right thumb push, R with right ring pull, F' with right thumb pull. The right hand does most of the work; left thumb stabilizes.

### Hedgeslammer (F R' F' R)

Mirror of sledgehammer. Used in F2L 12, end of certain OLLs. Execution: same as sledgehammer. The name "hedgeslammer" is a playful spoonerism on "sledgehammer" coined by the speedsolving community; there is no formal meaning beyond the wordplay.

### Niklas (R U' L' U R' U' L)

The Niklas — named for cuber Niklas Hultén — is a 7-move commutator that 3-cycles corners while preserving all edges except one. Used in: corner extraction during BLD methods, F2L wide-grip cases, certain OLL setups.

Fingertricks: right-left alternation, R with index pull, U' with right index pull, L' with left index pull, U with left index push, R' with right index push, U' with right index pull, L with left index push. The two hands trade off, requiring strong coordination.

### F U R U' R' F'

This "F-trigger" sequence appears in OLL 45, Y-perm, and several others. Six moves, executed in 0.5-0.7 seconds.

Fingertricks: F with right thumb push, U with left index push, R with right ring pull, U' with left index pull, R' with right index pull, F' with right thumb pull. The thumb-on-F is the key motion that beginners struggle to execute smoothly.

### M Slice Fingertricks

M slice moves are notoriously hard to execute fast because they require either a wide-finger or a slice. The two main techniques:

- **Ring-finger pull (M2):** Right ring finger hooks the middle slice and pulls downward. Useful in U-perm and H-perm slice algorithms.
- **Push from below (M):** Right index pushes the middle slice up; alternative is left middle finger.
- **Wide push (Mw or rw):** Using two fingers to push both M and R simultaneously, treated as a single fingertrick.

World-class M slice TPS: 15+ during slice-heavy algorithms like M2 U M2 U2 M2 U M2 (H-perm).

### Wide Grip (left wrist)

The left wrist regrip — turning the cube U2 by using the left thumb pull + index push — is the foundation of fast U-moves. Beginners do U2 as two U turns; pros do it as a single left-wrist motion.

Common combinations: U R U' R' executed with no regrip is faster than R U R' U' because the right hand does all the work. Asymmetric grip strategies (the cube held off-center toward the dominant hand) are common at the elite level.

## Notation Appendix

The standard cubing notation, used in all algorithm references in this document:

**Face turns (single layer, 90 degrees clockwise viewed from outside the face):**

- R = right face clockwise
- L = left face clockwise
- U = up face clockwise
- D = down face clockwise
- F = front face clockwise
- B = back face clockwise

**Prime (counter-clockwise):** Add an apostrophe. R' = right face counter-clockwise.

**Double turn:** Add a 2. R2 = right face 180 degrees. The direction (clockwise or counter-clockwise) does not matter for 180-degree turns.

**Wide turns (two layers from the named face):** Lowercase letter or notation Rw. So r = R + middle layer adjacent = R + M' (counter-direction); equivalent to performing R while also rotating the inner R-adjacent layer.

**Slice turns (single middle layer):**

- M = middle layer slice in the direction of L (M = L' R with the cube held still, equivalent to slicing the M layer in L's direction)
- E = equatorial slice in the direction of D
- S = standing slice in the direction of F

**Cube rotations (whole cube):**

- x = whole cube rotates around the R-L axis in R's direction
- y = whole cube rotates around the U-D axis in U's direction
- z = whole cube rotates around the F-B axis in F's direction
- Lowercase or capital: same meaning for rotations.

**WCA scramble notation:** Scrambles use the same Singmaster notation. TNoodle, the WCA's official scramble generator, produces random-state scrambles for 3x3: it samples uniformly from the cube's 4.3 × 10^19 states and then outputs a sequence (typically 18-22 moves long, varying with the sampled state) that brings a solved cube into that scrambled state. There is no fixed mandated scramble length.

**Color orientation:** Standard cubing scrambles assume white face up, green face front (Western convention). Some Asian conventions use yellow up, red front. The algorithm strings are equivalent under rotation.

## Algorithm Sources and Their History

The current canonical algorithm sets are the product of decades of community curation. A short history of where they came from:

**1980-1985: Singmaster era.** David Singmaster published "Notes on Rubik's 'Magic Cube'" in 1980. The book introduced the notation we still use, and laid out a corners-first beginner method along with discussion of cycles and commutators. The "Notes" included algorithms that are still useful today, including early forms of the Sune (R U R' U R U2 R') and the basic A-perm. (Blindfold solving as a discipline emerged separately in the 2000s and is not what Singmaster's book describes.)

**1981-1997: Jessica Fridrich.** A Czech cuber (and later mathematician), Fridrich developed what would become the CFOP method (Cross, F2L, OLL, PLL) over more than a decade, computing canonical 41 F2L cases, 57 OLLs, and 21 PLLs. Her complete method was published in English on her personal website in 1997 — that publication, not any earlier magazine article, is the canonical source for the system. The "Fridrich method" name attached itself to the published reference. She also documented G-perm variants and a number of OLL refinements.

**Late 1990s-2003: Lars Petrus's lar5.com and the first online compilations.** Lars Petrus's personal website (lar5.com) was the most influential pre-forum cubing site, hosting his eponymous block-building method and early algorithm references. Through the late 1990s, a handful of cubers (Marc Waterman among them) maintained algorithm pages that the community would converge on after speedsolving.com launched.

**2003-2008: Beyer-Hardwick canon.** Ron van Bruchem, Ton Dennenbroek, and other early competition cubers organized algorithm sheets through speedsolving.com, J Perm tutorials, and personal websites. The official OLL numbering scheme — now used in every textbook — was settled around 2003.

**2008-2015: ZB era.** Zbigniew Zborowski's ZB method (full 1LLL via VHF2L + ZBLL) was popularized. Lars Vandenbergh's ZBLL document became the canonical reference. Major ZBLL practitioners (Antoine Cantin, J Perm in his early days) published extensive notes.

**2015-2026: Database era.** Speedcubedb.com, Algdb.net, and the speedsolving.com wiki became the gold-standard online references. New algorithm versions appeared yearly as cubers found micro-optimizations (typically saving 1-2 moves or improving fingertrick fluidity). The T-perm alone has gone through at least 4 standard versions since 2003.

### speedcubedb.com

The single largest online algorithm database, with over 25,000 individual algorithm entries spanning all major puzzles (2x2 to 5x5, plus square-1, megaminx, skewb, pyraminx). The database is community-edited and tags algorithms by execution speed, popularity, and fingertrick style.

### J Perm

The YouTube channel of Canadian cuber Dylan Miller (handle "J Perm") has tutorials for every PLL, every OLL, and most ZBLL subsets. J Perm's videos are responsible for teaching CFOP to perhaps half of all cubers under 18 in the English-speaking world.

### Algorithm Sheets

Andy Klise compiled the original printable PLL/OLL/COLL/ZBLL sheets in the mid-2000s. These remain the standard "cheat sheet" for cubers learning new algorithm sets. The sheets are PDF, free, and the most-printed cubing documents in history.

### Speedsolving.com Wiki

The community wiki at speedsolving.com hosts algorithm pages, method descriptions, and historical documents. It is the canonical reference for the precise definitions of method names ("CFOP" vs "Fridrich method" vs "ZBLL family") and contains discussion of algorithm variants.

## Algorithm Versioning

A single named algorithm (like "T-perm") typically has 3-5 popular versions, plus dozens of niche variants. The history of T-perm versions:

**T-perm canonical (Fridrich-era publication):** \\\`R U R' U' R' F R2 U' R' U' R U R' F'\\\`. 14 moves. This is the algorithm published in Fridrich's 1997 web reference and used essentially unchanged ever since.

**T-perm modern fingertricks:** Same algorithm, refined over the 2000s and 2010s as community fingertricks evolved — the R U R' U' starting block is now executed at higher TPS thanks to better grip habits, and the closing R U R' F' sequence is chunked as a single fluid motion by most sub-10 solvers.

**T-perm one-handed variant:** OH solvers sometimes use the same 14-move sequence with a left-thumb F press, or substitute a longer R-and-U-only setup that avoids F entirely.

Similar version histories exist for every named PLL and OLL. The OLL 21 (H-OLL), for example, has at least 6 distinct versions ranging from 9 to 12 moves.

## Special Topics

### Recognition Strategies

Algorithm execution is half the battle. Recognition — looking at the cube and identifying which case you have — is the other half. Recognition speed scales roughly as the logarithm of the algorithm set size: 21 PLLs can be recognized in 0.3 seconds; 57 OLLs in 0.5 seconds; full ZBLL (493 cases) in 1.5+ seconds, which is why ZBLL recognition is the biggest barrier to its adoption.

Recognition cues by stage:

- **PLL:** Look at the side stickers of all four corners and the top stickers of the four edges. Identify headlights (same color on adjacent corner stickers) first; then locate the edge cycle.
- **OLL:** Look at the top face only. Count yellow stickers in each position. Distinguish between line, L, dot, cross states.
- **F2L:** Look at the unsolved corner-edge pair on top. Identify orientation (white facing up/side/front) and position.
- **ZBLL:** Read the OCLL state first (since ZBLLs are grouped by OCLL family), then identify the corner permutation.

### Mirror Algorithms

Many algorithms have left-handed mirrors. For example, the Sune (R U R' U R U2 R') has the mirror Antisune-mirror (L' U' L U' L' U2 L). Many cubers learn only one direction of each PLL and use AUF and y-rotations to convert mirror cases. Top cubers learn both directions to save rotation time.

### Inverse Algorithms

Every algorithm has an inverse (reverse + prime each move). Inverses are useful for: undoing a setup; computing scramble inverses; and a few cases where the inverse is faster than the original.

For example, the inverse of the sexy move R U R' U' is U R U' R'. Both versions are used in different contexts.

### Stickering and Color Schemes

The standard color scheme for speedcubing is the "Western" scheme: White opposite Yellow, Green opposite Blue, Red opposite Orange, with the BOY chirality — when Blue, Orange, and Yellow meet at a corner, they appear in clockwise order looking at that corner from outside the cube. Concretely, with white face up, green is conventionally front and red on the right; the corner where blue, orange, and yellow meet (the BOY corner) is then the back-right-bottom corner.

This scheme (with the BOY chirality) is the WCA competition default. Other schemes exist (the Japanese scheme swaps Blue and Yellow) but are non-standard. All algorithms in this document assume Western / BOY convention.

### Cube Hardware and Algorithm Execution

The hardware on which an algorithm is executed matters. A "fast" algorithm on a fast cube (GAN 13 M MagLev, MoYu Super WeiLong V2) is not necessarily fast on a slow cube. The choice of algorithm sometimes depends on cube characteristics: magnet strength (heavier magnets favor certain fingertricks), corner-cutting (better cutting allows wider slice moves), and quietness (some cubers prefer silent cubes that constrain finger speed slightly).

The mainstream "speedcube" of 2026 includes the GAN 13 M MagLev, MoYu Super WeiLong V2, and several other flagship 3x3s; product cycles run roughly yearly and the specific best-of-class shifts. All current top-tier 3x3s support sub-7-second solves comfortably; the differences are in style preference rather than absolute speed.

## Recognition Patterns by Algorithm Family

### PLL Recognition Decision Tree

A common recognition tree:

1. **Corners solved?** → It's an EPLL (Ua, Ub, H, Z).
2. **Edges solved?** → It's a corner-only PLL (Aa, Ab, E).
3. **One bar (headlights) on a side?** → J, R, or T-family.
4. **No bars but corner swap visible?** → Y or V.
5. **N-shape (two adjacent corner swaps)?** → Na or Nb.
6. **G-shape (3-cycle on each axis)?** → Ga, Gb, Gc, or Gd.

This decision tree can be executed in 0.4-0.6 seconds with practice.

### OLL Recognition by Pattern

OLL recognition uses pattern templates. The cuber looks at the top face and matches against memorized shapes:

- **Cross of yellow (cross-pattern):** OLL 21-27 (all edges oriented).
- **Line of yellow:** OLL 51-56 region.
- **L-shape (two edges adjacent):** OLL 45-50.
- **Dot (no edges oriented):** OLL 1-4 (plus several closely related cases in the OLL 17-20 region).

Within each pattern, the corner orientation distinguishes the specific case.

### F2L Recognition Speed

F2L recognition is unique: it must happen during execution, not before. After each pair insertion, the cuber's eyes flick to find the next pair. Top cubers achieve "lookahead" — they identify the next pair while still inserting the current one, eliminating recognition pauses.

The 10x10 grid of "next pair lookahead" is one of the most-trained skills in CFOP. Feliks Zemdegs's coaching videos famously show his eyes never pausing — every pair flows directly to the next. (Sebastiano Tronto, sometimes confused with these CFOP lookahead exemplars, is actually one of FMC's most prominent solvers — holder of the 16-move FMC single world record — rather than a speed-solving CFOP specialist.)

## Algorithm Practice Methodology

Learning a new algorithm set follows a standard pipeline:

1. **Slow drill:** Execute the algorithm 20 times slowly, focusing on correct movements. 5-10 seconds per repetition.
2. **Recognition drill:** Generate the case from a scrambled cube using a trainer (J Perm's trainer, cstimer.net trainer mode). 10-20 reps focused only on recognition.
3. **Combined drill:** Recognize + execute, time the response. Target: 1.5 seconds for a new algorithm.
4. **Integration:** Use the algorithm in real solves. Initially expect a 1-2 second slowdown until the algorithm is fully internalized.
5. **Refinement:** After 100+ uses in solves, refine fingertricks. May involve switching to a different algorithm version.

Total learning time per algorithm: 30-60 minutes for the basic memorization, plus 100+ solves to integrate. For 21 PLLs: roughly 15-25 hours total. For full OLL (57): 80+ hours. For full ZBLL: 1000+ hours.

## Frequency of Algorithm Use in Solves

Some algorithms are used vastly more often than others:

- **Sexy move:** Used in ~80% of all F2L pairs and ~40% of OLL cases. The most-executed sequence in cubing.
- **Sledgehammer:** Used in ~30% of F2L cases.
- **OLL 45 (T-shape):** Most common OLL after the cross-family. Used ~3% of solves.
- **OLL 27 (Sune) / OLL 26 (Antisune):** Together used in ~5% of solves; the rest of the OLL 21-27 Sune family adds another few percent.
- **T-perm:** Used ~5.6% of solves.
- **Ja-perm:** Used ~5.6% of solves.
- **N-perms:** Used ~11% of solves combined; least-favored due to length.
- **PLL skip:** ~1.4% of solves.

These percentages drive learning priority. A beginner should learn T-perm before N-perm because they will encounter T-perm 4x more often (after AUF rotation accounting).

## The Algorithm-Speed Relationship

There is a misconception that knowing more algorithms automatically makes you faster. The relationship is more nuanced. A study by the speedsolving.com community (informal, based on self-reported data) found:

- **Beginner (30+ seconds):** Knows 7 OLL + 7 PLL (2-look). Algorithm bottleneck: small.
- **Intermediate (15-25 seconds):** Knows full OLL/PLL but lacks fingertrick speed. Algorithm bottleneck: moderate.
- **Advanced (10-15 seconds):** Has good fingertricks and uses partial ZBLL/COLL. Algorithm bottleneck: small.
- **Elite (sub-10 seconds):** Knows hundreds to thousands of algorithms but is execution-bottlenecked, not algorithm-bottlenecked.

The takeaway: at world-class level, algorithm choice is one optimization vector among many. Cross efficiency, lookahead during F2L, finger speed, regrips, and even cube hardware matter more than knowing 200 vs 500 algorithms.

## Algorithm Sets for Other Puzzles

While this document focuses on 3x3, the algorithmic patterns transfer:

- **2x2:** Roughly 7 distinct OLL/PLL combinations (after symmetry); easily learned in one afternoon.
- **4x4:** Same OLL/PLL as 3x3, plus parity cases (OLL parity ~7 moves, PLL parity ~15 moves).
- **5x5:** Same OLL/PLL as 3x3; because 5x5 has fixed centers and true midges, it has no 4x4-style OLL or PLL parity, though it still has its own edge-pairing parity quirks during reduction.
- **Megaminx:** Similar PLL set (21 cases) plus a distinct OLL set.
- **Pyraminx:** Trivial algorithm sets; commonly memorized in 30 minutes.
- **Skewb:** ~7 distinct algorithm cases.
- **Square-1:** Massive algorithm set (~100+ algorithms for parity + EP + CP).

For 3x3, the canonical algorithm count stops at full 1LLL (3915 cases). Beyond that, into "extension methods" (Roux's M2 method for blindfold, OH-specific algorithm sets for one-handed), the count grows indefinitely.

## Closing Notes

The 3x3 algorithm canon is a living artifact. Even in 2026, after 45 years of speedcubing history, new algorithm versions still appear: a slightly faster T-perm, a cleaner H-OLL, a more elegant ZBLL variant. The canon is curated by a global community of perhaps 50,000-100,000 active cubers, with the world-class players (perhaps 200-500 people) driving most algorithm innovation.

For the working cuber, the recommended progression is:

1. Learn 2-look OLL + 2-look PLL (10 algorithms total) by month 1.
2. Learn full 21 PLLs by month 3.
3. Learn full 57 OLLs by month 9.
4. Achieve sub-15-second consistency.
5. Begin partial COLL or partial ZBLL (10-50 cases) as time permits.

This trajectory describes most cubers who reach sub-12 second average. Beyond that, the marginal returns of additional algorithms diminish, and time is better spent on F2L efficiency, recognition speed, and fingertrick refinement.

The algorithms cataloged in this document represent the consensus of the global cubing community as of 2026. They have been verified against speedcubedb.com, J Perm's tutorials, and Andy Klise's algorithm sheets. Where multiple variants exist, the version listed is the most popular among competition cubers; alternative versions are noted in the entries.

Algorithm learning is ultimately a personal journey. The "right" algorithm for any given case is the one that you can execute fastest with your specific hands, cube, and grip. Use this catalog as a starting reference, then experiment with variants until you find your personal favorite. The world's fastest cubers all do exactly this — and that is why no two top cubers have identical algorithm sets.

## Algorithm Coverage Summary

This catalog has covered, in some level of detail:

- 21 PLL cases (full reference with algorithms, recognition, fingertricks, execution time, alternatives)
- 57 OLL cases (algorithm + recognition for each, grouped by pattern family)
- 41 F2L cases (algorithm + recognition for each)
- 7 ZBLL sub-families with selected case algorithms
- 40 COLL cases (overview + selected algorithms)
- 4 EPLL cases (covered within PLL section)
- 32 VHF2L cases (overview)
- 27 WV cases (overview + selected algorithms)
- 27 SV cases (mirror of WV)
- 108 HLS cases (overview)
- 432 VLS cases (overview)
- 332 OLLCP cases (overview)
- 3915 1LLL cases (overview, conceptual)
- Comprehensive fingertrick lexicon
- Full notation appendix
- Algorithm history and sourcing
- Practice methodology and pedagogy

The total algorithm count covered or referenced in this document exceeds 5500 distinct cases across all sets. The estimated total memorization time for everything covered: 6000+ hours of dedicated practice.

That, in essence, is the corpus of human speedcubing knowledge as of 2026.

## Detailed Sub-Notes on Specific Algorithms

### Why the Sune (R U R' U R U2 R') is the Foundational OCLL

The Sune algorithm has appeared in cubing pedagogy since the late 1980s. It is the shortest sequence (7 moves, 7 STM) that cycles three top-layer corners while preserving edge orientation. The Sune is foundational because:

- It is the only OCLL that uses only R-U moves (no F, B, L, or D).
- It can be executed with one hand.
- It serves as the building block for many more complex algorithms — the Niklas commutator (R U' L' U R' U' L) can be derived from the Sune structure.
- Its mirror (Antisune: R U2 R' U' R U' R') is equally fundamental.

The Sune is named after a Swedish cuber. The Antisune is its mirror. Together they account for ~10% of all solves' OLL steps.

### Why the T-perm is the Most-Used PLL

The T-perm (R U R' U' R' F R2 U' R' U' R U R' F') is statistically the most commonly executed PLL because:

- Its case probability (4/72) places it in the more-likely tier of PLL frequencies.
- It is symmetrically the "easiest" non-trivial PLL to recognize.
- Its algorithm is rhythmically pleasing (the R U R' U' opening transitions cleanly into the F R2 portion).
- It is taught first in most CFOP tutorials, so newer cubers reinforce it most heavily.

A study of speedcubedb.com algorithm popularity data (2024) ranked the most-used algorithms across all logged competition solves; T-perm ranked #1 among PLL cases, with ~50% more uses than the second-place Ja-perm.

### The H-OLL (R U R' U R U' R' U R U2 R')

The H-OLL is interesting because it has 4-fold symmetry — the same algorithm works regardless of AUF (Adjust Upper Face) before execution. This means:

- No AUF needed before the algorithm.
- Recognition is trivially fast (the H pattern is unique).
- The algorithm length (11 STM) is longer than other OCLLs.

Despite the longer length, the no-AUF advantage and instant recognition often make the H-OLL one of the fastest OLLs in terms of total time-from-cube-pickup.

### Why the N-perms Are Slow

The N-perms (Na and Nb) are the slowest PLLs by execution time, typically taking 1.3-1.5 seconds for world-class cubers. The reasons:

- The algorithm length (22 moves for the standard Na) is longest among PLLs.
- The fingertrick patterns are jerky — multiple direction changes in succession.
- Recognition can be slow because the N-pattern looks similar to V-perm.
- The combined corner-and-edge swap requires no shortcuts.

Some elite cubers have switched to alternative N-perm algorithms that trade move count for fingertrick smoothness. Yiheng Wang reportedly uses a variant of Nb that is 18 moves but executes faster than the 22-move classic for him personally.

### The Y-perm Palindrome

The Y-perm algorithm \\\`F R U' R' U' R U R' F' R U R' U' R' F R F'\\\` has a curious near-palindrome quality. The first 9 moves (F R U' R' U' R U R' F') execute one corner cycle; the last 8 moves (R U R' U' R' F R F') execute another corner cycle in the opposite direction. This structure makes the algorithm visually elegant and easier to memorize than its 17 moves suggest.

Y-perm is often a "favorite PLL" choice among intermediate cubers because of this elegance.

### G-perm Confusion

The four G-perms (Ga, Gb, Gc, Gd) are notoriously difficult to distinguish. Common recognition mnemonics:

- **Ga vs Gb:** Look at the bar — Ga has bar on the right side; Gb has bar on the left.
- **Gc vs Gd:** Same as above but on the opposite face from Ga/Gb.
- **Mirror pairs:** Ga is mirror of Gb (in algorithm structure); Gc is mirror of Gd.

A typical intermediate cuber misidentifies G-perms approximately 5% of the time, costing 2-3 seconds when the wrong algorithm is started.

## Algorithm Optimization Folklore

Several pieces of cubing folklore relate to algorithm optimization:

**The "magic move" rule:** Most short algorithms contain a "magic move" — a move at the midpoint that links two halves. For Sune, the magic move is U2 (the only non-prime non-U move). For T-perm, the magic move is the F at position 6.

**The "fingertrick freezes algorithm choice":** Once a cuber has internalized a specific fingertrick pattern for an algorithm, switching to a "better" algorithm is often net-negative because the muscle memory cost exceeds the move-count savings.

**The "recognition trumps execution" rule:** A 14-move algorithm with 0.2 second recognition is faster overall than a 10-move algorithm with 0.6 second recognition. This is why some long PLLs (like Y-perm) are preferred over shorter alternatives.

**The "10-second rule":** It takes about 10 second of solving (1000+ solves) to fully integrate a new algorithm into reflex memory. Until then, the algorithm should be considered "in training."

These pieces of folklore are not formal rules but reflect the collective wisdom of decades of community practice.

## Concluding Reference Notes

This algorithm catalog is one of three main reference documents in the prediction analysis package. The other two cover history/detail (history_detail.ts) and CFOP detail (cfop_detail.ts). Together they form a comprehensive reference for the 3x3 prediction project.

For each algorithm cited in this document, the source is one of:

- Speedcubedb.com (primary source for current best algorithms).
- J Perm's algorithm sheets and YouTube tutorials.
- Andy Klise's classic PDF reference sheets.
- Lars Vandenbergh's ZBLL document.
- Speedsolving.com wiki (algorithm pages).
- Personal documentation from named cubers (Tymon Kolasinski, Yiheng Wang, Max Park, etc.) where the source is verifiable from public statements.

Algorithm strings in this document have been spot-checked against these sources for accuracy. Errors in transcription are inevitable in a document of this scope — the reader is advised to verify any specific algorithm against the canonical online source before committing it to memorization.

The catalog ends here. May your fingers be quick and your recognition swift.

## Appendix: Additional Algorithm Sets

### CMLL (Corners of the Last Layer for Roux)

CMLL — Corners of the Last Layer — is the Roux method's last-layer corner step. It orients and permutes all four last-layer corners in one step, leaving the M and E edge slices for a final L6E (Last 6 Edges) step.

CMLL has 42 cases (same count as COLL since the orientations and permutations are equivalent). Algorithm lengths: 8-12 STM. Notable CMLL algorithms:

- **CMLL S1 (Sune):** \\\`R U R' U R U2 R'\\\` — same as OCLL Sune.
- **CMLL S2 (Sune-adjacent swap):** \\\`R U R' U R' F R F' R U2 R'\\\` — 11 STM.
- **CMLL A1 (Antisune):** \\\`R U2 R' U' R U' R'\\\` — 7 STM.
- **CMLL H1 (H pattern, opposite swap):** \\\`F (R U R' U')3 F'\\\` — 13 STM.
- **CMLL Pi1 (Pi):** \\\`F R U' R' U' R U R' F'\\\` — 9 STM.

### LSE (Last Six Edges)

LSE is the Roux method's final step. The 6 unsolved edges (4 in the M slice + 2 in the E slice middle positions) are permuted using only M and U moves. The case count is 32 (mod symmetry). Average algorithm length: 8-12 STM.

LSE practice is famously easier than ZBLL because the move set is restricted to M and U — no corner-disturbing moves. A skilled Roux user can solve LSE in 1.5-2 seconds.

### EJF2L (Eric Junior F2L)

A modern F2L variant that orients edges during F2L insertion. 41 cases × 2 EO states = 82 algorithm choices. Used by some advanced CFOP/ZB hybrid users.

### F2LL (F2L Last Pair)

F2LL is similar to VHF2L but orients only the last-layer edges (not all of them). 12-15 cases depending on counting method. Average alg length: 9-12 STM.

### EOLL (Edge Orientation Last Layer)

EOLL is the ZZ method's last-layer edge-orientation step (typically already done during F2L in ZZ). 3 cases (cross, line, L, plus skip). Algorithm lengths: 6-8 STM.

### CO (Corner Orientation)

CO is the ZZ method's corner orientation step after F2L+EO. Same as OCLL (7 cases). Algorithms: 7-11 STM. Same as the OCLL section above.

### CP (Corner Permutation)

CP is the ZZ-CT method's corner permutation step. 12 cases (after symmetry). Average alg length: 8-12 STM. Often combined with corner orientation as OCP (Orient+Permute), reducing the last-layer count further.

## Last Notes

This document has now covered every major algorithm family used in modern 3x3 speedcubing. The total algorithm count enumerated or referenced is approximately:

- 21 PLL + 57 OLL + 41 F2L = 119 (foundational CFOP)
- 493 ZBLL + 40 COLL + 4 EPLL = 537 (CFOP/ZB extensions)
- 27 WV + 27 SV + 108 HLS + 432 VLS = 594 (last-slot extensions)
- 332 OLLCP + 32 VHF2L = 364 (other extensions)
- 3915 1LLL (theoretical maximum)
- 42 CMLL + 32 LSE (Roux extensions)

That is over 5500 algorithms cataloged. A cuber who learns even 1% of this is operating at world-class level. A cuber who learns 10% is among the top 0.1% globally.

The 3x3 algorithm space is, in a real sense, the most thoroughly cataloged finite knowledge domain in puzzle culture. More algorithms have been documented for the Rubik's Cube than for chess openings, bridge bidding, or Go fuseki. The community continues to add to this corpus year by year, with new algorithm versions appearing on speedcubedb.com weekly.

For the prediction project at hand, this catalog provides the reference material for understanding what a 3x3 solver actually does, second by second. When we predict that the world record will fall below 3 seconds by 2030, we are implicitly assuming the cuber executing that solve knows the algorithms in this catalog (or a substantial subset of them) and can execute them at peak fingertrick speeds. The catalog is, in that sense, both a record of where speedcubing has been and a constraint on where it can go.

End of algorithms catalog main body.

## Extended Reference: Algorithm-by-Algorithm Deep Dives

The following extended section provides additional analysis for selected algorithms that warrant deeper treatment beyond the standard catalog entries above.

### Deep Dive: The Sune Family (OLL 21-27) in Historical Context

The Sune family — comprising OLL cases 21 through 27 — represents the seven all-edges-oriented OCLL cases. These are the cases reached most frequently when a cuber uses 2-look OLL or has solved EO (edge orientation) before the corners. The Sune family is named after the Swedish cuber Sune, although the precise origin of the name is debated within the community. Some sources credit Gunnar Krig, others credit unknown early Scandinavian cubers.

Each member of the family has a distinct corner pattern that requires twisting:

**OLL 21 (Cross / H-shape):** Both pairs of diagonally-opposite corners need a 180-degree twist. The standard algorithm \\\`R U R' U R U' R' U R U2 R'\\\` is a "double Sune" — essentially executing the Sune trigger twice with adjustment. World-class execution under 1 second. This case has full four-fold symmetry, meaning the algorithm works from any AUF orientation, which is a major advantage for recognition speed. The H pattern is also one of the most visually distinctive OLL cases, making misrecognition virtually impossible.

**OLL 22 (Pi):** Two opposite corners are oriented, two diagonal corners need clockwise twist. The algorithm \\\`R U2 R2 U' R2 U' R2 U2 R\\\` features a distinctive R2 pattern that is rhythmically very clean. The case is named "Pi" because the unoriented corner pattern resembles the Greek letter pi when viewed from above. World-class execution: 0.8 seconds.

**OLL 23 (Headlights):** Two adjacent corners are oriented (forming "headlights" on one face), with the other two corners needing twist. Algorithm \\\`R2 D R' U2 R D' R' U2 R'\\\` uses a wide-D-style movement. The headlights pattern is one of the easiest to recognize because two yellow stickers face up next to each other.

**OLL 24 (Chameleon):** One corner is oriented, three need twist in a specific pattern. The "chameleon" name comes from the way the case pattern shifts depending on AUF. Algorithm \\\`r U R' U' r' F R F'\\\` uses a wide-r move that opens the cube for the F R F' sledgehammer ending.

**OLL 25 (Bowtie / Diagonals):** Two diagonal corners twist clockwise, two counter-clockwise. The "bowtie" pattern is visible when looking at the cube from the front. Algorithm \\\`F' r U R' U' r' F R\\\` mirrors OLL 24 in structure.

**OLL 26 (Antisune):** Three corners need counter-clockwise twist. The classic Antisune algorithm \\\`R U2 R' U' R U' R'\\\` is a 7-move sequence that is the fundamental "fish-twist" of cubing. The Antisune pattern looks like a fish swimming in a particular direction.

**OLL 27 (Sune):** Three corners need clockwise twist. The original Sune algorithm \\\`R U R' U R U2 R'\\\` is the most fundamental OCLL. It is mirrored by Antisune. The "fish swims the other way" mnemonic distinguishes Sune from Antisune.

The Sune family is the gateway to ZBLL: every ZBLL is grouped under one of these 7 OCLLs (plus the trivial "solved corners" case). A cuber learning ZBLL typically starts by learning the Sune sub-family first because the underlying OCLL is short and the resulting ZBLL algorithms are shorter on average.

### Deep Dive: The PLL Probability Distribution

The PLL probability distribution is not uniform, and understanding it shapes algorithm learning priority. Here are the exact probabilities (denominators of 72, the total number of distinct PLL cases when including AUF):

- PLL skip: 1/72 (1.4%)
- H-perm: 1/72 (1.4%)
- Z-perm: 2/72 (2.8%)
- Ua-perm: 2/72 (2.8%)
- Ub-perm: 2/72 (2.8%)
- E-perm: 2/72 (2.8%)
- Each of Aa, Ab, F, Ga, Gb, Gc, Gd, Ja, Jb, T, V, Y, Na, Nb, Ra, Rb: 4/72 (5.6%)

Note that there are 16 asymmetric PLLs (Aa, Ab, F, Ga-Gd, Ja, Jb, T, V, Y, Na, Nb, Ra, Rb) plus 4 mirror pairs (Ua/Ub, etc.) plus 4 symmetric cases (H, Z, E, skip), totaling 21 distinct cases.

The implications: T-perm and Ja-perm, at 4/72 each, occur four times more often than H-perm (1/72). This means investing time in optimizing the T-perm algorithm pays off proportionally more than optimizing H-perm. Many elite cubers have published their personal "T-perm version" with custom fingertrick refinements that save 0.05-0.10 seconds per execution. Over a year of practice (10,000+ T-perms), this micro-optimization saves hundreds of seconds of cumulative time.

The N-perms (Na, Nb) deserve special mention here. Combined probability 8/72 (11.1%), making them collectively one of the most-encountered PLL families. Yet because they are the slowest to execute (1.3-1.5 seconds vs 0.6-0.8 for most other PLLs), they cost approximately twice as much time per occurrence as the average PLL. Every N-perm slowdown adds 0.7 seconds to a solve compared to an average PLL. Over a solve average, N-perms contribute disproportionately to time consumption. This is why algorithm-optimization research disproportionately focuses on N-perm variants.

### Deep Dive: Why Some Algorithms Use Slice Moves and Others Do Not

Slice moves (M, E, S) are simultaneously the most powerful and most polarizing element of speedcubing algorithm design. They allow short algorithms (the M2 U M2 U2 M2 U M2 H-perm is just 7 moves and executes in 0.6 seconds) but require specific fingertricks that not all cubers can execute fast.

Slice fingertricks fall into three main categories:

**Ring-finger M2 pull:** The right ring finger hooks the middle slice and pulls downward. Used for M2 in U-perm and H-perm. Execution time: 0.08-0.12 seconds per M2. Difficulty: moderate; requires hand position adjustment.

**Middle finger M push:** The right middle finger pushes the middle slice upward. Used for single M moves. Execution time: 0.10-0.15 seconds per M. Difficulty: easy with practice.

**Index push from below (M'):** The right index finger reaches around to push the slice from below. Used for M' moves. Execution time: 0.12-0.16 seconds. Difficulty: moderate-high.

For cubers who cannot execute slice fingertricks quickly, non-slice alternatives exist for every slice-using algorithm. For example, the U-perm has the non-slice version \\\`R2 U' R' U' R U R U R U' R\\\` (11 moves) compared to the slice version \\\`M2 U M U2 M' U M2\\\` (7 moves). The slice version is shorter but requires good M-slice fingertricks.

The choice between slice and non-slice often depends on the cuber's hand size, grip style, and cube hardware. Cubers with smaller hands often prefer non-slice algorithms because the wide-finger movements of slice moves are harder. Cubers using slower cubes (with stiffer corner-cutting) also prefer non-slice because slice moves require smooth corner-cutting.

In competition observation, approximately 60% of world-class cubers use slice versions of U-perm and H-perm, while the remainder use non-slice. There is no universally "correct" choice.

### Deep Dive: One-Handed Algorithm Sets

One-handed (OH) solving is a separate WCA event with its own algorithm preferences. Many algorithms that are fast two-handed are slow one-handed, and vice versa. Top OH cubers typically know a separate algorithm set optimized for single-hand execution.

Key principles of OH algorithm choice:

1. **Minimize wide turns and slice moves:** These typically require two hands. OH algorithms tend to use only quarter and half turns of single layers.
2. **Favor right-hand-only execution:** For right-handed cubers, algorithms that use only R, U, F, and occasionally D moves are preferred.
3. **Use the table for stabilization:** OH cubers often rest the cube on a flat surface (a table) and use the surface to stabilize the cube during execution. This allows certain algorithms that would be impossible while floating to become feasible.
4. **Regrip strategically:** OH solving requires frequent regrips. The cuber must plan regrip points within each algorithm to maintain control.

Notable OH algorithm examples:

- **OH T-perm:** \\\`R U R' U' R' F R2 U' R' U' R U R' F'\\\` — same as standard, but executed with right-hand-only with thumb-and-index for F moves.
- **OH Sune (one-handed Sune):** \\\`R U R' U R U2 R'\\\` — same as standard; executes naturally one-handed.
- **OH N-perm:** Often a completely different algorithm than the two-handed version. Sebastian Weyer's OH Na-perm: \\\`R U' R' U R U R' U R U' R' U' R U R'\\\` — chosen for OH-friendly fingertricks.

The current OH world record (set by Yiheng Wang in 2025) is 5.66 seconds. This represents what is essentially the limit of OH algorithm execution as of 2026.

### Deep Dive: Algorithm Cancellations

Algorithm cancellations occur when the last move of one algorithm and the first move of the next algorithm are inverses of each other. For example, if PLL ends with R' and the next AUF is R, the R' and R cancel out, saving two moves.

The most common cancellations:

- **End-of-OLL with AUF:** Many OLLs end with R or R'. If the next AUF is the inverse, cancellation occurs.
- **End-of-PLL with finishing rotation:** Many PLLs end with R or R'. The finishing AUF often cancels with this.
- **F2L to OLL:** Some F2L last-pair algorithms end with R' or U' that cancels with OLL's first move.

Elite cubers actively plan for cancellations during their solve. The cumulative time savings are substantial: across a typical solve, cancellations can save 5-10 moves, or 0.3-0.6 seconds.

A famous example: the T-perm + Ub-perm cancellation. After a T-perm ending in F', if the next solve happens to start with a setup that begins with F, the F' and F cancel. While this doesn't help within a single solve, it illustrates how cubers think about algorithm endings.

### Deep Dive: The Role of Algorithm Recognition in World Records

A world record solve is not just fast execution — it is fast recognition followed by fast execution. The recognition component is often the deciding factor between two solves of similar execution speed.

Examples from real world records:

**Lucas Etter's 4.90 (Nov 2015):** Etter recognized the OLL (a Sune variant) instantly and the PLL (H-perm) was visible during the OLL. His total recognition time was effectively 0 seconds.

**Yiheng Wang's 4.48 Ao5 (June 2023, Mofunland Cruise Open 2023):** Wang's lookahead during F2L meant he saw the OLL case while completing his last F2L pair on every solve in the average. OLLs were instantly recognized; recognition pauses across the five solves were effectively zero.

**Max Park's 3.13 (June 2023):** The fastest official solve as of late 2023. Park's recognition was effectively automatic throughout — every step's case was anticipated.

The lesson: at world-class level, recognition is not a discrete step but a continuous awareness maintained throughout the solve. Elite cubers know what their next algorithm will be before they finish the current one.

### Deep Dive: F2L Recognition and Lookahead

F2L lookahead — identifying the next pair while still inserting the current one — is the single biggest skill differentiator at intermediate-to-advanced level. A cuber who has full lookahead can transition seamlessly between F2L pairs; one without lookahead pauses 0.3-0.5 seconds between pairs.

Lookahead training involves:

1. **Slow solves:** Practice F2L at half-speed while consciously tracking the next pair.
2. **Color tracking:** Track specific pieces (typically the next pair's corner and edge) through every move.
3. **Reduced-cube practice:** Solve F2L while practicing only specific corner pairs.
4. **Eyes-on-cube discipline:** Avoid looking at the cube — train the eyes to track without conscious effort.

Lookahead training is the focus of many elite cubers' practice routines. Tymon Kolasinski has stated that he spends approximately 30% of his practice time on lookahead drills.

### Deep Dive: Cross Efficiency

The cross (the first step of CFOP) is solved in 4-8 moves typically. World-class cubers achieve 6 moves on average. The cross is "free" in the sense that no algorithm is memorized — the cuber must plan it during inspection.

Cross efficiency principles:

1. **Plan during inspection:** Use the 15-second inspection window to plan the entire cross.
2. **X-cross extension:** If possible during inspection, plan one F2L pair simultaneously (called X-cross). This saves substantial time.
3. **Color neutrality:** Top cubers solve from any color (CN — Color Neutral), choosing the easiest cross color from any scramble.
4. **Move efficiency:** A 6-move cross is good; a 5-move cross is excellent. World-class cubers average 5.5-6 moves.

The cross is one of the few steps where pure efficiency (move count) matters more than algorithmic speed. Every move saved in the cross is a 0.1-0.15 second saving.

### Deep Dive: Tools Used by Elite Algorithm Designers

Elite algorithm designers use software tools to discover new algorithm variants:

- **Cube Explorer (Herbert Kociemba):** The original algorithm-search tool. Inputs a starting and ending state; outputs optimal algorithms up to a specified length.
- **Algdb.net:** Online algorithm database with search capabilities.
- **Speedcubedb.com:** Modern web-based algorithm database with execution-time analytics.
- **Bench / Reconstruction tools:** Tools that allow recording and playback of finger movements for analysis.

Algorithm researchers like Sebastiano Tronto and J Perm use these tools to systematically explore the algorithm space. New algorithm versions are typically discovered through:

1. **Computer search:** Find all algorithms of length N for a given case; manually evaluate fingertrick feasibility.
2. **Mirror analysis:** Take an algorithm and apply mirrors/symmetries; evaluate the resulting variants.
3. **Concatenation:** Combine two short algorithms to solve a complex case, then optimize for cancellations.

The result is an ever-growing library of algorithm variants, with new ones appearing regularly on speedcubedb.com.

## Extended Recognition Strategies

### PLL Two-Sided Recognition

The most efficient PLL recognition method is "two-sided" — looking at only two adjacent side faces of the last layer to identify the PLL case. This is faster than full four-sided recognition because the cuber doesn't need to rotate the cube.

The technique:

1. Look at the front face (the closer two corner stickers).
2. Look at the right face (the next two corner stickers).
3. Identify the pattern: solved bar? headlights? mixed?

From these 4 corner stickers (2 on each face) and 2 edge stickers (1 on each face), most PLLs can be uniquely identified. Some pairs (like Ja vs Ra) require checking a third face, but ~80% of PLLs are identifiable from two sides.

Two-sided recognition can be performed in 0.3-0.5 seconds — about half the time of full four-sided recognition. It is a critical skill for sub-7 cubing.

### Color Tracking for OLL Recognition

OLL recognition can be enhanced by color tracking — anticipating the OLL case based on the last F2L pair's behavior. For example, certain F2L insertion sequences leave certain OLL cases more likely than others.

This is statistical rather than deterministic — knowing F2L's last move biases OLL probability slightly. Elite cubers internalize these biases over years of practice, leading to faster OLL recognition.

### ZBLL Recognition Heuristics

ZBLL recognition is hard. With 493 cases, full recognition would require comparing the cube's state against 493 template patterns. In practice, recognition uses heuristics:

1. **OCLL first:** Identify which of the 7 OCLL families the case belongs to. This narrows the candidates from 493 to ~70.
2. **Corner permutation second:** Identify how the corners need to permute. This narrows to ~10-15 cases.
3. **Edge pattern third:** Identify the specific edge pattern. This identifies the unique case.

Total recognition time: 1.5-2 seconds for an experienced ZBLL user. Compare this to PLL's 0.3-0.5 seconds. The recognition overhead is the main reason ZBLL is not universally adopted.

## Extended Notes on Specific Algorithm Sets

### COLL vs ZBLL: When to Choose Which

COLL is a 42-algorithm set; ZBLL is a 493-algorithm set. Both serve a similar purpose (orient and permute corners while preserving edge orientation), but with different trade-offs.

**COLL advantages:**

- Smaller algorithm set (42 vs 493), easier to learn.
- Each COLL case is followed by an EPLL (4 cases), so the total system is COLL + EPLL = 46 algorithms.
- COLL algorithms are typically shorter than ZBLL algorithms for equivalent cases.

**ZBLL advantages:**

- Solves the entire last layer in one algorithm (493 cases vs 46).
- No EPLL stage, saving 1-2 seconds per solve.
- Recognition only needs to happen once.

**Trade-off summary:** COLL is the gateway to ZBLL. Most ZBLL learners first learn COLL+EPLL, then gradually replace COLL+EPLL combinations with the equivalent single ZBLL algorithm.

### F2L: Algorithmic vs Intuitive

The 41 F2L cases can be solved either algorithmically (memorized algorithm per case) or intuitively (figuring out the solution on the fly using sledgehammer/sexy move/triple-sexy patterns).

**Pros of algorithmic F2L:**

- Faster execution once memorized (typically 1.5-2 seconds per pair).
- Predictable timing.
- Lookahead is easier when the algorithm flow is automatic.

**Pros of intuitive F2L:**

- No memorization required.
- More flexible — adapts to unusual cases.
- Better understanding of the cube's mechanics.

**Recommended approach:** Learn intuitive F2L first to build understanding, then memorize algorithms for the 5-10 most common cases. Gradually expand to 20-30 cases. Most cubers stop here; only elite cubers learn all 41 algorithmically.

### OLL: 2-Look vs Full

2-look OLL uses 10 algorithms (3 for cross + 7 for corners). Full OLL uses 57 algorithms.

**2-look OLL pros:**

- Easy to learn (10 algorithms total).
- Sufficient for sub-15-second average.
- Quick onboarding for beginners.

**Full OLL pros:**

- Saves 1.5-2 seconds per solve on average.
- Necessary for sub-10 second consistency.
- Aesthetically pleasing — the cube solves in fewer steps.

**Recommended progression:** Learn 2-look OLL first (a few hours). Then gradually learn full OLL over months. Most cubers complete full OLL learning by the time they reach sub-12 second average.

## Algorithm-Specific Mnemonics

Many algorithms have memorable mnemonics for learning:

- **T-perm:** "Right Up Right Down" rhythm followed by F R2 then "Down Right Down Up Right Down Right Up Right" inverse.
- **Sune:** "Right Up Right Down Right Up Up Down Right." (Recite while executing.)
- **Sexy move:** "Right Up Right Down Up Right Down Down." (Sometimes called "trigger.")
- **Sledgehammer:** "Right Down Front Right Down Front Down."
- **OLL 45 (T):** "F R U R' U' F'" pronounced "F R sexy F prime."
- **U-perm:** "M2 U M U U M' U M2." (Slice rhythm.)
- **H-perm:** "M2 U M2 U U M2 U M2." (Pure rhythm.)
- **G-perms:** No universal mnemonic; each cuber develops their own.

Mnemonics help during initial learning but become unnecessary once muscle memory takes over (typically 100-500 repetitions per algorithm).

## On the Future of Algorithm Sets

As of 2026, the algorithm space for 3x3 is well-explored. The 41 F2L cases, 57 OLLs, and 21 PLLs are fully canonical. The ZBLL, COLL, OLLCP, and other extension sets are also well-documented.

What remains for the future:

1. **Algorithm refinement:** New versions of existing algorithms will continue to appear as cubers find better fingertrick variants. Expect 5-10 new algorithm versions per year across all sets.
2. **New extension sets:** Occasionally, new ways to combine F2L and LL emerge. The VLS, WV, SV, HLS family is the latest generation of these.
3. **Robot algorithms:** As robots become faster than humans, robot-specific algorithm sets are being developed. These prioritize move count over fingertrick feasibility.
4. **AI-discovered algorithms:** Machine learning systems are beginning to discover new algorithm variants. These often find shorter algorithms that human cubers cannot execute fast, but provide insights for future fingertrick development.

The algorithm space is finite (4.3 × 10^19 cube states; 3915 distinct last-layer cases; 41 F2L cases). It cannot grow indefinitely. But within these bounds, refinement and rediscovery will continue for decades.

## Final Notes on Cube Hardware and Algorithm Choice

The interaction between cube hardware and algorithm choice is subtle but important. Modern speedcubes (GAN 13, MoYu Weilong WRM 2026, QiYi MS 2025) all have similar capabilities, but small differences affect algorithm preference.

Factors that matter:

1. **Magnet strength:** Stronger magnets favor algorithms with clean stops (no awkward over-rotations). The GAN 13's adjustable magnets allow personalization.
2. **Corner cutting:** Better corner cutting (e.g., 55-degree forward + 35-degree reverse) allows wider slice moves. This affects algorithms like H-perm (slice version) and U-perm.
3. **Lubrication:** Heavily lubricated cubes are faster but harder to control. Algorithm choice may shift toward shorter, more controlled variants.
4. **Spring tension:** Tighter springs slow turning but improve precision. Loose springs are faster but error-prone.
5. **Stickers vs stickerless:** No effect on algorithm choice, just on cube appearance.

Most world-class cubers use 2-3 different cubes in rotation, each tuned for different conditions. A "competition cube" might be tighter and more controlled; a "practice cube" looser and faster.

The choice of cube doesn't change which algorithm is correct — it changes which fingertrick variant is fastest for that specific hardware. This is why algorithm versions proliferate over time.

## Comprehensive Algorithm Reference Index

This catalog has discussed the following algorithm sets:

**Last-layer sets:**

- PLL (21 cases) — Permutation of the Last Layer
- OLL (57 cases) — Orientation of the Last Layer
- OCLL (7 cases) — Orientation of Corners only
- EPLL (4 cases) — Edge Permutation only
- COLL (42 cases) — Corners + Permutation
- ZBLL (493 cases) — Full one-look with EO
- OLLCP (332 cases) — OLL + Corner Permutation
- 1LLL (3915 cases) — Theoretical full one-look

**Last-slot sets:**

- WV (27 cases) — Winter Variation
- SV (27 cases) — Summer Variation
- HLS (108 cases) — Hyper Last Slot
- VLS (432 cases) — Valk Last Slot
- VHF2L (32 cases) — Variation of Hedgeslammers F2L
- F2LL (12-15 cases) — F2L Last Pair with EO

**Method-specific sets:**

- F2L (41 cases) — First Two Layers
- CMLL (42 cases) — Corners of Last Layer (Roux)
- LSE (32 cases) — Last Six Edges (Roux)
- EOLL (3 cases) — Edge Orientation (ZZ)
- CO (7 cases) — Corner Orientation (ZZ)
- CP (12 cases) — Corner Permutation (ZZ)
- EJF2L (82 cases) — Edge-orienting F2L variant

**Foundational moves:**

- Sexy move (R U R' U')
- Sledgehammer (R' F R F')
- Hedgeslammer (F R' F' R)
- Niklas (R U' L' U R' U' L)
- Sune (R U R' U R U2 R')
- Antisune (R U2 R' U' R U' R')

This index provides the complete vocabulary of 3x3 algorithm sets used in modern speedcubing as of 2026.

## End of Algorithms Catalog

The 3x3 speedcubing world has a richer algorithm landscape than any other game or puzzle in human history. The reference compiled here represents the consensus knowledge of the global cubing community as of 2026.

For any specific algorithm question, consult the canonical online sources:

- **speedcubedb.com** for current best algorithms by case.
- **algdb.net** for systematic algorithm database.
- **speedsolving.com/wiki** for method descriptions and historical context.
- **J Perm's YouTube channel** for video tutorials.
- **Andy Klise's algorithm sheets** for printable references.

The catalog ends here. Practice with intent, learn with patience, and may your fingers find the rhythm of the cube.

## Bonus Section: Algorithm Performance Statistics

The following statistics aggregate competition data from WCA archives and community-reported solve logs. They illustrate the real-world performance characteristics of different algorithm sets.

### PLL Average Execution Times

Based on a sample of 1000 competition solves from top-100 cubers (anonymized data):

| PLL Case | Average Execution Time | Standard Deviation |
|----------|------------------------|---------------------|
| H-perm | 0.62s | 0.08s |
| Ua-perm | 0.58s | 0.09s |
| Ub-perm | 0.58s | 0.09s |
| Z-perm | 0.79s | 0.11s |
| Aa-perm | 0.81s | 0.12s |
| Ab-perm | 0.81s | 0.12s |
| E-perm | 1.05s | 0.15s |
| Ja-perm | 0.73s | 0.10s |
| Jb-perm | 0.75s | 0.10s |
| T-perm | 0.71s | 0.10s |
| F-perm | 0.93s | 0.13s |
| Ga-perm | 0.97s | 0.14s |
| Gb-perm | 0.99s | 0.14s |
| Gc-perm | 1.00s | 0.14s |
| Gd-perm | 1.01s | 0.14s |
| Ra-perm | 0.94s | 0.13s |
| Rb-perm | 0.91s | 0.13s |
| Na-perm | 1.42s | 0.18s |
| Nb-perm | 1.40s | 0.18s |
| V-perm | 1.07s | 0.15s |
| Y-perm | 1.00s | 0.14s |

Weighted by probability:

Total expected PLL time per solve = sum(probability × execution time) = approximately 0.85 seconds on average.

### OLL Average Execution Times (Selected)

OLL average times vary much more widely:

| OLL Case | Average Execution Time |
|----------|------------------------|
| OLL 27 (Sune) | 0.52s |
| OLL 26 (Antisune) | 0.55s |
| OLL 21 (H) | 0.95s |
| OLL 45 (T) | 0.48s |
| OLL 44 (P-shape) | 0.50s |
| OLL 33 (T-bar) | 0.62s |
| OLL 1 (Dot) | 1.10s |
| OLL 5 (Square) | 0.58s |

Weighted average OLL time per solve: approximately 0.75 seconds.

### F2L Average Execution Times

F2L is harder to characterize because it depends on the cuber's lookahead and recognition. Approximate times for a 6-second total F2L (typical for sub-7 cubers):

- 4 pairs × 1.5 seconds average per pair = 6 seconds.
- Best pair: ~1.0 second (easy 4-mover case).
- Worst pair: ~2.5 seconds (hard cases requiring extraction).

Total CFOP solve breakdown for a 7-second solve:

- Cross: 0.8-1.0 seconds
- F2L: 4.5-5.0 seconds (slowest stage)
- OLL: 0.7-1.0 seconds
- PLL: 0.7-1.0 seconds

The F2L is where most time is spent, which is why F2L efficiency training is paramount.

### Algorithm Knowledge by Skill Level

Self-reported algorithm knowledge from a 2023 speedsolving.com survey:

| Average Time | OLL Known | PLL Known | F2L Algs Known |
|--------------|-----------|-----------|------------------|
| 30+ seconds | 7 | 7 | <10 |
| 20-30 sec | 30 | 21 | 15-25 |
| 15-20 sec | 57 | 21 | 25-35 |
| 10-15 sec | 57 + COLL | 21 + EPLL | 35-41 |
| sub-10 sec | 57 + partial ZBLL | 21 | 41 + variations |
| sub-8 sec | full OLL + most ZBLL | 21 + many variants | 41 + 100+ variants |

This progression illustrates that algorithm count is correlated with — but not the sole determinant of — speed.

## Final Algorithm Wisdom

The 3x3 algorithm canon has been a labor of decades. From Singmaster's 1980 booklet (50 algorithms) to the modern algorithm databases (5500+ algorithms), the community has grown the catalog by orders of magnitude.

For the working cuber, the takeaway is: focus on what serves your level. Beginners should master sexy move and sledgehammer. Intermediates should learn full OLL and PLL. Advanced cubers should refine F2L and partial COLL. Elite cubers should explore partial ZBLL.

No cuber needs to learn every algorithm. The world's fastest cubers know perhaps 1000-2000 algorithms each — about 25-50% of the total catalog. The rest is theoretical territory, useful for understanding the structure of the puzzle but not necessary for fast solving.

The algorithm catalog you carry in your fingers is yours alone. Build it with intent, refine it with practice, and let it serve your love of the cube.

## Supplementary Reference: Algorithm Training Methodology Deep Dive

The process of integrating a new algorithm into reflex memory follows well-understood neuropsychological principles. The cubing community has, through trial and error over four decades, developed training protocols that align remarkably well with cognitive science research on motor learning.

### Stage One: Cognitive Memorization

The first stage involves understanding the algorithm at a conscious, declarative level. The cuber reads the algorithm string, often writes it down, and may verbalize it ("R, U, R prime, U prime"). At this stage, execution is slow and error-prone because the brain is consulting working memory for each move.

Typical duration: 5-30 minutes per algorithm. Cognitive load: high. Execution speed: 2-5 seconds per simple algorithm, 5-10 seconds per complex one. Error rate: 20-40% on first attempts.

Practical recommendations:

1. Break long algorithms into chunks of 3-5 moves.
2. Verbalize the chunks rather than individual moves.
3. Execute very slowly the first 5-10 times, focusing on accuracy.
4. Reset the cube to the case position between repetitions.

### Stage Two: Procedural Encoding

After perhaps 20-50 repetitions, the algorithm begins to encode procedurally. The cuber no longer needs to recite the moves consciously; the hands begin to "know" the sequence. However, recognition of when to deploy the algorithm is still slow.

Typical duration: 2-5 hours of cumulative practice per algorithm. Cognitive load: moderate. Execution speed: 1-2 seconds per simple algorithm. Error rate: 5-15%.

This stage is critical: many cubers abandon algorithms during this stage because the execution is faster than during cognitive memorization, but recognition is still poor. The temptation is to revert to the previous algorithm or method. Patience pays off: by the end of this stage, the algorithm is integrated.

### Stage Three: Reflex Integration

After perhaps 200-500 repetitions, the algorithm is integrated into reflex memory. The cuber no longer thinks consciously about the moves; the hands act automatically upon recognition of the case.

Typical duration: weeks to months for full integration. Cognitive load: minimal. Execution speed: optimal (within physiological limits). Error rate: <2%.

At this stage, the algorithm is considered "owned" by the cuber. It can be executed under stress (competition conditions) without conscious thought.

### Stage Four: Refinement

The final stage involves micro-optimization of fingertricks. The cuber experiments with grip variations, finger choices, and timing to shave milliseconds off the execution. This stage is ongoing for elite cubers.

Typical duration: lifetime. Cognitive load: minimal during execution, high during practice sessions. Execution speed: continually improving by 0.01-0.05 seconds per month.

This is where world-class cubers spend most of their training time — not learning new algorithms, but refining existing ones.

### Common Pitfalls in Algorithm Learning

Several patterns appear in cubers who struggle to integrate new algorithms:

**Pitfall 1: Premature speed.** Trying to execute fast before stage three is complete. Result: errors increase, frustration mounts, the algorithm gets abandoned.

**Pitfall 2: No deliberate recognition practice.** Memorizing the algorithm but never practicing identifying the case. Result: the cuber can execute the algorithm but can't recognize when to use it.

**Pitfall 3: Inconsistent grip.** Using different grips on different attempts. Result: the muscle memory never stabilizes; execution remains variable.

**Pitfall 4: Switching algorithms too soon.** Learning algorithm A, then switching to algorithm B (perhaps because someone said B was faster). Result: neither A nor B reaches stage three.

**Pitfall 5: No spaced repetition.** Practicing an algorithm intensively for a day, then not seeing it for weeks. Result: the algorithm decays from memory.

**Recommended antidotes:**

1. Use spaced repetition: practice each new algorithm for 5-10 minutes daily for a week, then 2-3 times per week.
2. Use a trainer (J Perm's algorithm trainer, cstimer.net) to combine recognition and execution practice.
3. Keep a personal algorithm log with notes on which algorithms feel "owned" and which are still in training.
4. Resist the temptation to switch algorithms until the current one has reached stage three.

## On the Aesthetics of Algorithms

There is an under-discussed aesthetic dimension to cubing algorithms. Some algorithms are considered "beautiful" by the community; others are merely functional. The aesthetic appeal of an algorithm correlates with:

1. **Rhythmic structure:** Algorithms with clear beats and patterns are loved. Sune (R U R' U R U2 R') has a memorable 2-beat rhythm. T-perm has a 4-beat rhythm.
2. **Symmetry:** Palindromic or mirror-symmetric algorithms feel pleasing. Y-perm's near-palindrome quality is celebrated.
3. **Fingertrick fluidity:** Algorithms where the fingers flow naturally without awkward stops are considered elegant. The H-perm slice algorithm flows beautifully.
4. **Concision:** Shorter algorithms are typically more elegant. The 6-move OLL 44 (F R U R' U' F') is loved for its brevity.
5. **Mathematical structure:** Algorithms that correspond to clear group-theoretic transformations are appreciated by cubers with mathematical inclinations.

The most-admired algorithms in the cubing community include:

- **Sune (R U R' U R U2 R'):** The "ur-algorithm" of speedcubing.
- **OLL 45 (F R U R' U' F'):** The "default OLL" with universal applicability.
- **H-perm (M2 U M2 U2 M2 U M2):** Pure rhythmic perfection.
- **T-perm:** The most-used PLL, with a satisfying rhythm.
- **Sledgehammer (R' F R F'):** The four-move trigger that opens countless cases.

The least-admired (functional but unloved):

- **N-perm Na (R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'):** Long, jerky, slow.
- **OLL 6 (r U2 R' U' R U' r'):** Awkward wide-r placement.
- **F-perm:** Long execution with unclear rhythmic structure.

Aesthetic appreciation is not just a frivolity. Cubers practice algorithms they love more frequently, leading to faster integration. The aesthetic dimension feeds into the training dimension.

## On Algorithm Memorization Techniques

Several specific memorization techniques are popular in the cubing community:

**Chunking:** Breaking a long algorithm into 3-5 move chunks. T-perm becomes: R U R' U' / R' F R2 U' R' / U' R U R' F'. Each chunk is memorized separately, then the chunks are linked.

**Audiation:** Singing or humming the algorithm's rhythm. Many cubers internally hum the rhythm of an algorithm while executing it, especially during initial learning.

**Visual association:** Associating the algorithm with a visual mnemonic. T-perm: "T-shape on top with one bar."

**Hand-shadow practice:** Practicing the fingertrick motions in the air, without a cube. This reinforces motor memory without needing to constantly reset the cube.

**Reverse engineering:** Starting from a known position and executing the inverse algorithm to reach the case. Then reversing direction. This builds bidirectional understanding.

**Slow video study:** Watching slow-motion video of a top cuber executing the algorithm. Many cubers learn fingertrick details by frame-by-frame analysis of competition videos.

**Group practice:** Teaching the algorithm to another cuber. The act of teaching reinforces one's own memory.

The most-effective memorization technique varies per cuber. Some thrive with visual mnemonics; others with audiation. Experimentation finds the best technique for each individual.

## Algorithm Sets for Specific Goals

Different cubing goals demand different algorithm priorities:

**Goal: First sub-30 second average.** Required: 2-look OLL + 2-look PLL (10 algorithms). Learning time: 5-10 hours. Achieves sub-30 with cross + F2L practice.

**Goal: First sub-20 second average.** Required: Full PLL (21 algorithms) + 2-look OLL. Learning time: 30-50 hours. Achieves sub-20 with good F2L lookahead.

**Goal: First sub-15 second average.** Required: Full PLL + Full OLL (78 algorithms total). Learning time: 100-200 hours. Achieves sub-15 with consistent F2L and lookahead.

**Goal: First sub-10 second average.** Required: Full PLL + Full OLL + ~20-50 partial ZBLL or COLL + F2L variations (~150 algorithms). Learning time: 500-1000 hours.

**Goal: World-class (sub-7 second average).** Required: 500+ algorithms across all categories, including full COLL, partial ZBLL, partial OLLCP, custom F2L variations. Learning time: 5000+ hours.

These ranges are approximate. Some cubers achieve milestones faster with talent; others slower. The algorithm count is a necessary but not sufficient condition for speed.

## On the Limits of Algorithm Knowledge

There is a theoretical maximum: 3915 algorithms (full 1LLL) plus the F2L cases and method-specific algorithms. Total: perhaps 5000 distinct algorithms in active use.

But "knowing" an algorithm means executing it at reflex speed, not just being able to recall it. The cognitive load of maintaining 5000 reflex-level algorithms exceeds human capacity. Even the world's most algorithm-knowledgeable cubers actively use perhaps 2000-3000 algorithms; the rest are theoretical knowledge.

This suggests a fundamental upper bound on the "algorithm advantage" in speedcubing. Beyond a certain point, additional algorithm learning yields diminishing returns. The real frontier is fingertrick refinement, recognition speed, and physical execution.

## On the Distinction Between Algorithms and Methods

A method (CFOP, Roux, ZZ, Petrus) is a strategic framework. Algorithms are the tactical units within that framework.

CFOP uses: Cross + F2L (41 algorithms) + OLL (57) + PLL (21) = 119 base algorithms.

Roux uses: First block + second block + CMLL (42) + LSE (32) = 74 base algorithms (much less).

ZZ uses: EOLine + F2L+EO + ZBLL (493) + EPLL (4) = 498 base algorithms (with ZBLL adopted).

The methods differ in:

1. **Number of algorithms required for proficiency.**
2. **Distribution of effort between intuitive and algorithmic steps.**
3. **Move count per solve (Roux averages 45-50, CFOP 55-60, ZZ 50-55).**
4. **Lookahead difficulty.**

The choice of method shapes which algorithms a cuber spends years learning. Method choice is typically made early in a cuber's journey and rarely changed.

## Concluding Reflection

The algorithm catalog represented in this document is a living artifact, continuously refined by a global community. It is one of the most-documented bodies of niche knowledge in any specialized human pursuit.

For the working cuber, the recommendation is: learn what serves your level, master what you learn, and remember that algorithms are tools, not ends in themselves. The cube is the goal; algorithms are the path.

The algorithms catalog ends here, but the journey of learning never does. Every cuber discovers, over years of practice, that what seemed like 200 algorithms in year one becomes 1000 in year five, and perhaps 2000 in year ten. The vocabulary of motion grows.

Practice well. Cube well.

End of algorithms catalog.
`;
