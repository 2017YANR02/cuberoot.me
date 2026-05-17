export const CFOP_DETAIL_EN = `
## CFOP: The Method That Built Modern Speedcubing

The Cross, F2L, OLL, PLL method, universally abbreviated as CFOP, is the dominant 3x3x3 speedcubing method of the modern era. As of 2026, somewhere between eighty-five and ninety percent of competitive speedsolvers under fifteen seconds use CFOP as their primary method, and essentially every single sub-six-second solver in history has employed it. Every official world record on the 3x3x3 since 2003, with only a handful of exceptions, has been achieved using CFOP. The method is so pervasive that for many newer cubers it is simply "the method" — the alternative methods (Roux, ZZ, Petrus, and others) exist as fascinating curiosities and viable competitive alternatives, but the gravitational pull of CFOP's algorithm sets, its community resources, and its decades of accumulated coaching wisdom means that any cuber serious about reaching sub-ten times will, almost by default, find themselves learning Cross, then F2L, then OLL, then PLL.

This document is a deep-dive into every part of CFOP. It is intended for a reader who already knows what a cube is, has seen a few solves, and now wants to understand the method at the level a serious coach or a competitive solver would. We will go through the four phases in order, examining the case categories, the algorithm sets, the recognition systems, the fingertrick conventions, the modern algorithmic extensions, and the practice methodologies. We will look at the historical record holders and how they used the method differently. We will compare CFOP against its rivals at the conceptual level (deeper comparisons live in separate documents). And we will walk through a single complete sub-seven-second solve end to end, breaking down every move and every decision.

## Origins and Naming

The method now called CFOP was first published as a complete system by Jessica Fridrich in 1981. Fridrich was a Czech cuber and computer scientist who would later become a leading researcher in digital image forensics; her cubing work was an early-career hobby. Her original publication was a magazine article in Czech that described the four-step structure that has remained essentially unchanged for forty-five years: solve a cross on one face, fill in the four corner-edge pairs that complete the first two layers, orient all the top-layer pieces so that the top face is one color, and finally permute those pieces so that the cube is solved.

The historical record is more complicated than the "Fridrich invented it" shorthand suggests. Hans Dockhorn and Anneke Treep, two Dutch cubers, independently developed substantially similar four-step structures during the early 1980s competitive scene in the Netherlands, including the key F2L insight of pairing a corner and edge before inserting them as a unit. René Schoof and others contributed early algorithmic work. The Fridrich publication was significant not because every component was original but because it codified the full pipeline, published algorithms for the last layer, and reached a Western audience through translation. For about two decades, the English-speaking community called the method "Fridrich" or "the Fridrich method," reflecting the simple fact that her publication was the proximate source for most who learned it.

Around 2008-2010, as the community grew more aware of the contributions of Dockhorn, Treep, and others, and as a more general sentiment toward inclusive attribution took hold, the community gradually shifted toward the acronym "CFOP" — derived from the four-step names — which credits the structure of the method without privileging any single inventor. The shift was never mandated by any organization; it emerged organically, accelerated by influential community figures such as Lars Vandenbergh, Bob Burton, and the SpeedSolving.com forum culture. Today, "Fridrich" is still occasionally used (especially by older cubers and in non-English-speaking communities), but "CFOP" is the universally understood, neutral term. The shift parallels similar renamings in other disciplines and is now considered settled community vocabulary.

## The Four-Step Structure

CFOP solves the cube in four distinct phases, executed in this fixed order:

**Cross.** Solve four edges of one face — conventionally the bottom face during execution, often the white face during learning, though this is a convention rather than a requirement. The four edges must each match both their bottom-face color and the corresponding center on the side they touch. This produces a cross of four edges plus the bottom center, hence the name. The cross is usually solved on the bottom because that orientation makes the next phase (F2L) easier to execute: the unsolved layers face up where fingers can reach them, and the bottom layer can be ignored.

**F2L (First Two Layers).** Insert the four corner-edge pairs that fill out the first two layers of the cube. Each pair consists of a bottom-layer corner (with two color stickers matching adjacent side centers and one matching the cross color) and a middle-layer edge (with two color stickers matching the two adjacent side centers). The pair is "joined" — assembled into a unit — and then "inserted" — placed into its slot — in a single algorithmic move. Done well, F2L is the longest phase by move count but should be the smoothest by execution feel, as one pair flows directly into the next.

**OLL (Orient Last Layer).** With the first two layers fully solved, the top layer's eight pieces (four corners and four edges) are in some random orientation. OLL is a single algorithm that orients all eight pieces so that the top face shows only one color (the color opposite the cross). There are fifty-seven distinct OLL cases, each with its own algorithm. The permutation of the top-layer pieces is not addressed in this step; only their orientation.

**PLL (Permute Last Layer).** With the top face one color, the last layer needs only to have its pieces moved into their correct positions. PLL is a single algorithm that permutes all eight top-layer pieces simultaneously. There are twenty-one distinct PLL cases. After PLL, a final adjustment turn of the U face (the "AUF" — Adjust U Face) may be needed to align the top layer with the rest of the cube; this is not counted as a separate phase but is part of PLL's execution.

The total is four phases: one freeform planning-and-execution phase (Cross), one intuitive-with-algorithmic-assistance phase (F2L), and two purely algorithmic phases (OLL and PLL). The move count averages roughly fifty-five STM (slice turn metric) for a high-level solve: about eight moves of Cross, about thirty-two moves of F2L (eight per pair times four pairs), about ten moves of OLL, and about fourteen moves of PLL, with some variance based on case selection and execution style. Lower-level solves tend to be longer in the F2L phase, often pushing into the forties because pairs require multiple setup moves and re-tries; higher-level solves squeeze efficiency out of every phase but especially F2L through case recognition and look-ahead.

## CFOP vs Petrus vs Roux at a Glance

Before diving into the phases, it is worth situating CFOP against its main competitors at the high level. CFOP is a layer-by-layer method: it solves the cube in horizontal slabs from bottom to top. Petrus is a block-building method: it builds a 2x2x2 block, expands to a 2x2x3, orients the edges, builds the F2L, and then solves the last layer. Roux is a block-building method too, but its blocks are 1x2x3 on the sides, with the middle slice solved at the end. ZZ orients all edges first and then solves with only R, U, L, and slice moves.

The relevant comparison for CFOP is that it has the highest move count of any major method (around fifty-five STM versus Roux's forty-five and Petrus's fifty) but compensates with the highest possible TPS (turns per second) because its moves are concentrated in two grips — R/U/L on a normal cube hold — that flow into each other ergonomically. CFOP also has the largest algorithm set burden of any method (57 OLL + 21 PLL = 78 algorithms for full last layer, plus optionally hundreds more), but the algorithms are short and well-studied. The community resources for CFOP are vastly larger than for any other method. The world records are mostly CFOP. The deep comparison of these methods is the subject of separate documents in this prediction app; here we only note that the choice of CFOP for a serious competitive solver is, in 2026, the safest default, even though Roux in particular has produced several top-twenty solvers and one or two outliers in the top ten.

## The Cross

The cross is the first phase: solve four edges of one face. This is conceptually the simplest phase but the most underrated in its strategic importance. A poor cross does not just lose time directly; it places F2L pieces into awkward positions and triggers a cascade of inefficiency through the rest of the solve.

### The Search Space

There are twenty-four possible starting positions for each cross edge: the cube has twelve edges, and each can be in either of two orientations, giving twenty-four. Four cross edges in arbitrary positions and orientations gives a search space of (24 × 22 × 20 × 18) / (4!) = 1920 raw configurations, or with the four cross edges considered as a set, 384 distinct cross-state classes. Optimal solutions to the cross — solving all four edges in the minimum number of moves with no constraint on the rest of the cube — average roughly 5.81 HTM (half turn metric) for a fully color-neutral solver who can pick any of six colors, and roughly 6.92 HTM for a single-color solver locked to white. The optimal solution exists in some scrambles for as few as four moves (the lucky case) and as many as eight moves (the worst case among random scrambles; cases requiring nine moves are possible but extremely rare under random distribution).

For a top human solver, a sub-six-move cross with optimal execution lands at about 0.8 seconds; a seven or eight move cross lands at about 1.1-1.4 seconds. The world's best cross times routinely sit in the 0.6-1.2 second range during fast solves, with Patrick Ponce reportedly executing crosses in 0.6 seconds and below in particularly favorable scrambles.

### White-Only, Dual-Color, and Full Color-Neutrality

A "color-neutral" cuber is one who can solve a cross on any of the six colors and chooses the easiest in inspection. The three common neutrality levels are:

**White-only (also called single-color).** The cuber always solves the cross on white. This is the original convention and is what nearly every beginner learns. The mental load is minimal — case recognition and look-ahead are always relative to the same starting position. The cost is that the cuber is forced to use whatever cross is presented by the scramble; about one in fifteen scrambles will produce a cross requiring eight or more HTM, which is significantly worse than the average.

**Dual-color (white+yellow).** The cuber can solve the cross on either white or yellow and picks whichever is easier. Because white and yellow are opposite faces, the F2L pair-recognition systems and OLL/PLL recognition transfer cleanly between the two (with only the top color swapped). Dual-CN is a popular compromise: it gives roughly fifty to sixty percent of the benefit of full CN at roughly ten percent of the mental cost. Average crosses drop from 6.92 HTM (white only) to about 6.34 HTM (white+yellow).

**Full color-neutral (CN).** The cuber can solve the cross on any of six colors. Average cross drops to about 5.81 HTM. The mental cost is substantial: case recognition for F2L now has six possible starting positions, and OLL/PLL recognition becomes more complex because the side-color blocks the solver looks at are no longer in a fixed location relative to a fixed color scheme. Most CN solvers train OLL/PLL recognition by sticker pattern rather than color identity, which is a robust but slower-to-build skill.

Among the top twenty solvers as of 2025, roughly seventy percent are full CN and twenty percent are dual CN, with only a small minority remaining white-only. The shift toward full CN began around 2010, accelerated through the 2015-2018 era as solvers like Max Park demonstrated that sub-six averages were achievable with CN, and is now considered the default starting choice for any cuber beginning seriously who has not already trained extensively on white.

The case for white-only is mostly an inertia argument: if the cuber has invested thousands of solves and intuitive F2L recognition into white, switching costs are high and the marginal benefit (a few tenths per solve on average) may not be worth the months of recognition retraining. The case for full CN is that those months will pay back many-fold over a competitive career, and the recognition transfer from one color to another is faster than most cubers expect.

### Cross Planning in Inspection

WCA inspection is fifteen seconds. A top solver uses this time as follows, approximately:

- Seconds 0-2: Identify the cross color (CN cubers) by scanning all six faces; commit to one.
- Seconds 2-9: Plan the cross. This includes identifying where each of the four cross edges currently is, mentally tracking how a candidate solution will move them, and verifying the solution before execution.
- Seconds 9-13: Plan the first F2L pair. Identify which corner and edge will form the first pair, locate their current positions, and decide the pair-formation move.
- Seconds 13-15: Either plan the second pair (advanced) or simply confirm the cross+pair plan one more time, ready to begin executing.

Feliks Zemdegs, in interviews around 2016-2018, described a typical inspection of about thirteen seconds with the cross planned in seconds three through eight and the first pair planned in seconds eight through twelve, with the remaining seconds used for verification or to plan an extended cross (X-cross). This approximate budget remains the standard for top solvers.

The discipline of consistent inspection is one of the harder skills to drill. Many improving solvers find that they can plan a cross in fifteen seconds during slow practice but lose the plan when execution begins, especially under time pressure or in competition. The standard drill for this is the "track and execute" drill: plan a cross in inspection, then execute it with eyes closed, and verify the result.

### X-Cross and XX-Cross

An X-cross is a cross that is solved together with the first F2L pair as a single execution. The planning happens in inspection: instead of planning cross alone, the solver plans cross + pair as a single sequence. A typical X-cross is eight to twelve moves and ends with the first F2L pair already inserted, reducing F2L from four pairs to three. X-crosses are most often planned when one F2L pair is already nearly formed in the scramble, or when the cross-formation move sequence naturally supports inserting a pair as a side-effect.

Roughly thirty percent of scrambles, for an experienced X-cross planner, admit an X-cross in fifteen seconds of inspection. The time savings are typically 0.5-1.2 seconds per solve, depending on the difficulty of the F2L pair that gets folded in. X-crosses are responsible for many of the world's best individual times: Mats Valk's 4.74 world record in 2016, Yusheng Du's 3.47 world record in 2018, and several of Max Park's sub-five solves all involved X-crosses or even XX-crosses.

An XX-cross is the natural extension: cross + two F2L pairs. These are rare — perhaps three to five percent of scrambles — and require a particularly favorable starting position with two pairs nearly formed near each other. Erik Akkersdijk's 7.08-second world record in 2008 was a celebrated XX-cross; the solve was thirty-five moves total, including a six-move X-cross extension followed by a second pair insertion within the same fluid execution. XXX-crosses (cross + three pairs) are theoretically possible but essentially never planned in inspection; they are mostly an offline analysis curiosity.

### Cross + 1 Edge (XEOLR)

A related concept is XEOLR — solving the cross plus one edge of a first F2L pair without committing to the full pair insertion. This is a softer extension than X-cross: the solver fixes one extra piece during cross execution and starts F2L with a partial advantage. XEOLR is achievable in roughly forty percent of scrambles for a top solver and is the most common form of extended cross at the top level, more common than full X-cross because it requires less in-inspection planning commitment.

### Common Pitfalls in Cross Execution

Several execution mistakes are characteristic of intermediate cross solvers:

**D-face turning vs slice solves.** A cross can be partly solved by turning the D (down) face, which moves cross edges into position without disturbing the U layer. But the D face is hard to turn quickly because it sits under the cube. Slice solves (M, E, S moves) are often more efficient algorithmically but disturb both the U layer and the centers, which complicates F2L. The standard advice is: for the first edge, use any face including D; for the last few edges, prefer R/L/F/B moves so that the U layer remains undisturbed and ready for F2L pair tracking.

**The x2 D rotation debate.** Some solvers find a candidate cross that requires turning D twice (or making other D moves) and consider whether to rotate the cube (x2) and use U-face turns instead. The argument for is ergonomic: U turns are faster than D turns. The argument against is that x2 rotates the entire mental map and disrupts F2L pair tracking. The consensus, since around 2015, is that the rotation is not worth it: high-level solvers practice D-face turns extensively (using thumb pulls, index flicks) and accept the slightly slower turns rather than disrupt their tracking. The exception is when the rotation enables a substantially better cross (3+ moves saved); then the rotation is acceptable.

**Insertion-direction errors.** Several cross-edge insertions can be done from either the front or the back of the cube. Choosing the wrong direction places the edge in the right position but adds a y-rotation later. The standard discipline is to insert "toward the corner where the first F2L pair will form" — this minimizes future rotation costs.

### Cross Fingertricks

Cross execution makes heavy use of these fingertrick patterns:

- **R, R' index-flick:** the workhorse, executed by the right index finger pulling R and the same finger pushing R' or the right ring finger pulling R'.
- **L, L' mirror:** by the left index, less practiced for most right-handed solvers; the deficit shows up in non-y2 cross plans that require L moves.
- **U index-pull:** the right index curls under to pull U, or the left index pulls U the opposite direction.
- **D turning:** the most awkward, usually a right-thumb push or a wrist-rotation flick of the right index that catches the bottom edge.
- **F, F' two-handed:** thumbs and middle fingers combine to roll F and F' moves smoothly. F is generally slower than R/U/L.

The "wrist breaker" cross is a colloquial term for a cross plan that requires multiple awkward F or D moves in succession. Avoiding wrist breakers is one of the inspection planner's secondary considerations: even if a plan is one move shorter, if it includes two D moves and an F2, it may execute slower than a longer plan with cleaner R/U moves.

### Notable Cross Specialists

**Lucas Etter,** the American who held the world record at 4.90 in 2015, was renowned for sub-one-second crosses. Etter's cross technique emphasized minimal rotation and high D-face fluency.

**Patrick Ponce,** former world record holder (4.69 in 2017), was notable for cross times reported by analysts to occasionally dip into the 0.6-second range on favorable scrambles. Ponce's TPS during cross was among the highest ever recorded for the phase.

**Tymon Kolasinski,** Polish cuber and former world record holder (3.13 in 2022), is widely regarded as the best X-cross planner in the world. Tymon's inspection use is reported by coaches to push toward full XX-cross planning on roughly a quarter of his scrambles, which is exceptional.

**Yiheng Wang,** the current world record holder (around 3.05 as of 2026), has emphasized cross efficiency over raw cross speed: a higher proportion of his crosses are five or six HTM, and he is willing to spend a fraction of a second longer in inspection to find the cleaner cross. The result is faster F2L starts despite slower cross executions.

### Drilling Cross

The standard cross-drilling regimen, popularized by Feliks Zemdegs in his coaching content, is one thousand cross solves over the course of a week. The drill is: scramble, plan cross only (do not plan F2L), execute the cross, stop the timer, log the time, and repeat. After one thousand solves at this pace, the cuber's mean cross time will typically drop by 0.3-0.6 seconds, and — more importantly — the variance shrinks dramatically. Inspection planning becomes faster, and the cuber starts to recognize cross "shapes" in inspection rather than tracking individual edges.

Beyond raw cross drilling, top solvers practice cross+1 drills (cross plus one pair, with the timer stopped after the first pair) to build the bridge between cross planning and F2L pair recognition. They also practice planning-only drills, in which the cuber inspects but does not execute, then writes down or verbalizes the planned solution and verifies it; this builds inspection efficiency without execution-time waste.

## F2L: Where the Time Lives

F2L — First Two Layers — is the phase that consumes the most time in any sub-fifteen-second solve, and it is the phase with the greatest gap between intermediate and advanced cubers. A cross can be brute-force memorized; OLL and PLL are pure algorithms; PLL recognition has a small finite recognition tree. F2L is the phase where pattern recognition, fingertrick fluency, intuitive understanding, and look-ahead all combine and where the gap between a fifteen-second solver and a five-second solver yawns widest. In a sub-six solve, F2L consumes roughly fifty-five percent of total time. In a fifteen-second solve, F2L consumes roughly seventy percent. The difference is almost entirely in this phase.

### The Phase Structure

F2L solves four corner-edge pairs and inserts them into the four bottom-layer slots between the cross edges. Each slot is the column between two adjacent cross edges and has a top (one corner) and a side (one edge) that need to be solved. The four slots are referred to as front-right (FR), front-left (FL), back-right (BR), and back-left (BL), assuming the cross is on the bottom.

Each pair consists of:

- A **corner** that has three sticker colors: the cross color (down-facing) and two side-face colors (front and right, for example, for the FR slot).
- An **edge** that has two sticker colors: the two side-face colors that the slot bridges.

The corner can be in any of twenty-four positions × three orientations = seventy-two states. The edge can be in any of twelve positions × two orientations = twenty-four states. When the corner is in its solved position with the cross color facing down, and the edge is in its slot with both colors matching the adjacent centers, the pair is "solved." F2L solves all four pairs in sequence.

### The Forty-One F2L Cases

F2L is most commonly taught as forty-one cases, though the underlying number depends on whether you count separately by orientation or merge symmetric cases. The forty-one-case canonical breakdown comes from the early speedsolving community work — Lars Vandenbergh, Andy Klise, and others — and assumes the slot is empty (the bottom layer is solved at that slot, the corner is somewhere in U or in the slot incorrectly, and the edge is somewhere in U or in the slot incorrectly).

The forty-one cases group naturally as follows:

**The 6 "free pair" cases (often numbered F2L 1-6):** The corner and edge are already joined as a pair in the U layer, with the corner in U and the edge adjacent to it. Inserting requires one of six algorithmic patterns depending on the relative position of corner and edge.

- F2L 1: Pair is in front-right with white-color facing right, edge facing front. Algorithm: U R U' R' (4 STM).
- F2L 2: Pair with white facing front. Algorithm: y' U' L' U L (4 STM after rotation, or F' U' F + setup).
- F2L 3-6: Variations on the above with different pair positions, all four-to-six STM.

These are the most desired cases — they appear roughly fifteen percent of the time and contribute about four STM each.

**The 12 "corner and edge separated" cases (F2L 7-18):** The corner is in U with the cross color either on top, facing front, or facing right. The edge is in U as well but not adjacent to the corner. The standard solution is to first move the edge adjacent to the corner (a "setup" move of one or two STM), then apply one of the six free-pair algorithms.

- F2L 7: Corner white-up in URF position, edge in UF face. Algorithm: U R U' R' (after edge-corner alignment).
- F2L 13: Corner with white facing front, edge in U adjacent but wrong orientation. Algorithm: F' U' F + insert.

These cases are common (about thirty percent of pairs) and contribute six to eight STM each.

**The 17 "corner-on-top" cases (F2L 19-35):** The corner is in U with the cross color either pointing up, front, or right, but the edge is buried in the wrong slot (in the middle layer somewhere other than its target slot). The solution requires popping the edge out of its slot (a setup), then forming the pair, then inserting.

- F2L 20: Corner in URF white-up, edge in BR slot pointing forward. Algorithm: R U R' U' y' R' U' R (8 STM).
- F2L 24: The classic "back to front" case requiring (R U R' U')×2 or a variant.
- F2L 30: Corner in URF white facing right, edge buried in FL slot pointing down. Algorithm: F R' F' R U R U' R' (8 STM). This is widely considered the hardest standard F2L case; it requires a heavy setup-extract-rejoin-insert sequence.

These cases are common (about thirty-five percent of pairs) and contribute seven to eleven STM each.

**The 6 "special" or "both in slot" cases (F2L 36-41):** Both the corner and the edge are in the slot but in the wrong position relative to each other (the corner may have wrong orientation, or the edge may be flipped). The solution typically requires extracting one or both pieces, joining the pair, and re-inserting. These cases are uncommon (about ten percent of pairs) but contribute eight to twelve STM each.

- F2L 37: Corner and edge both in slot, corner with wrong color up. Algorithm: R U' R' U R U R' (7 STM, includes pair extract-and-reinsert).
- F2L 41: Both pieces in slot with corner twisted and edge flipped. Algorithm: F' L' U2 L F R U R' (8 STM).

### Algorithmic vs Intuitive F2L

A foundational debate in CFOP pedagogy is whether F2L should be taught algorithmically (one algorithm per case, memorized) or intuitively (one mental model for "join, then insert," with the solver figuring out the moves on the fly per case).

The algorithmic approach was Fridrich's original formulation. The intuitive approach was popularized by Badmephisto, Dan Brown, and J Perm's tutorials, and became the dominant teaching style around 2010. The two views have largely reconciled: most coaches now teach the underlying intuition (corner goes to URF, edge goes adjacent, slot insertion happens with R U R' or y' L' U' L or variants) and then transition the cuber into algorithmic memorization for the harder cases (F2L 24, 30, and the "both in slot" cases) where intuitive solutions are inefficient.

The reasoning is that intuitive F2L allows the cuber to handle any case, even one they have not specifically practiced, but it tends to be slower and less efficient than memorized algorithms for the hard cases. Top solvers have algorithmic muscle memory for all forty-one cases plus all the cases they encounter often during F2L "second-pair" tracking. They use intuition primarily for unusual or pseudo-block situations not in the standard case list.

### Advanced F2L: VHF2L, Multislotting, and ELS/CLS

Beyond the standard forty-one cases, several extended algorithm sets address F2L situations with side benefits:

**VHF2L (Variation of the Last F2L).** A set of thirty-two algorithms (plus their mirrors) that solve the last F2L pair while simultaneously orienting all four last-layer edges. This sets up the last layer for the smaller ZBLL algorithm set (493 cases instead of the full 1212 from no orientation control). VHF2L is the gateway between CFOP and ZBLL-style "edge orientation" methods.

**ELS (Edge Last Slot).** A set of twenty-eight algorithms that solve the last F2L edge while orienting last-layer edges, leaving the last corner for a separate CLS step.

**CLS (Corner Last Slot).** A set of 104 algorithms that solve the last F2L corner while orienting last-layer corners. Used in combination with ELS to bridge to PLL.

**WV (Winter Variation).** Twenty-seven cases. After F2L 1-3 are done, if the last F2L corner is oriented (its cross color is facing down), WV inserts the last pair while orienting all last-layer corners. WV is the most-learned F2L extension after VHF2L because of its modest size and frequency: about one in three solves with cross-oriented last corners admits WV.

**SV (Summer Variation).** Twenty-seven cases. The mirror of WV: same as WV but for the case where the last F2L corner is oriented in the opposite direction.

**HLS (Hyper Last Slot).** F2L+OLL combined when the last-pair edge is oriented. 108 cases (split across edge-flipped and edge-oriented). Larger than WV/SV but covers more situations.

**VLS (Valk Last Slot).** Named after Mats Valk. 432 cases of F2L last pair + OLL combined. The complete F2L+OLL fusion: any last-pair state can be solved with one algorithm. The set is large enough that most solvers learn only sub-sets relevant to their style.

These extensions live on the boundary between CFOP and method extensions. They are not strictly CFOP since they fold OLL or LL-orientation into the F2L phase. But they are universally considered part of "advanced CFOP" rather than separate methods. The pragmatic question for a learner is which subset to invest in. The common wisdom: VHF2L or ELS+CLS for those targeting ZBLL; WV for those targeting one-look LL via COLL; VLS for those targeting one-look full LL.

### F2L Tracking and Look-Ahead

Look-ahead is the central skill of F2L and the difference between intermediate and advanced cubers. The premise is that while executing one pair's algorithm, the eyes and brain are tracking the next pair's pieces, ready to begin the next pair immediately.

The model has three stages:

1. **Spot.** During the current pair's execution, identify which pair to do next (typically the easiest available pair, or the one that fits with the current rotation).
2. **Track.** Follow the next pair's corner and edge through the moves being executed, predicting where they will be when the current pair ends.
3. **Know.** As the current pair ends and the next begins, the solver already knows the algorithm for the next pair and starts it without re-looking.

A novice has no look-ahead: each pair finishes, the cuber pauses, looks for the next pair, identifies the algorithm, then executes. The pause is typically half a second to a second. A sub-fifteen solver typically has one-pair look-ahead: while executing pair N, they spot pair N+1, eliminating the pause. A sub-ten solver typically has two-pair look-ahead during the second and third pairs, eliminating most pauses. A top solver may achieve three or even four-pair look-ahead in favorable scrambles; this is the "Zemdegs gap" that separates the world's best from the rest.

Look-ahead at the higher levels is enabled by sub-maximal TPS. The "sixty percent rule" — popularized by coaches around 2018 — is that top solvers execute F2L at roughly sixty percent of their maximum TPS, leaving brain bandwidth for tracking the next pair. A solver who pushes maximum TPS during F2L will inevitably lose look-ahead, pause longer between pairs, and end up slower overall. The optimal F2L TPS is the TPS at which look-ahead is preserved while execution is as fast as possible.

### Tracking Algorithms

Different F2L move sequences "rotate" tracking through the cube differently. R moves cycle pieces around the R column; U moves cycle pieces around the U layer; F moves cycle pieces around the F face. Top solvers internalize these rotations and use them to predict where the next pair will end up.

For example: if the current pair's algorithm ends with U' R U R' (a four-move insertion), the solver knows that the U layer rotates one quarter turn counterclockwise during the U' move, then back during the U move, and that pieces in U are "shaken" but end up at the same positions. So tracking the next pair's edge through this algorithm is straightforward: it does not change column. But if the algorithm includes a y rotation, the entire mental coordinate system flips — the front face is now the right face — and the solver must re-orient their tracking.

The art of F2L planning is choosing algorithms that not only solve the current pair efficiently but also leave the next pair in a recognizable, predictable position. This is the "ergonomic case selection" criterion, which often trumps the raw "shortest algorithm" criterion.

### Multislotting

Multislotting is the (rare) technique of solving two F2L pairs in a single algorithmic sequence. It requires a specific scramble in which two pairs are already joined or nearly joined and their pieces are positioned such that a single short algorithm slots both pairs simultaneously. Multislotting opportunities are very rare — perhaps one solve in twenty offers any multislotting and one in two hundred offers a clean, time-saving multislot. Top solvers rarely plan for it; they recognize it opportunistically. Tymon Kolasinski and Yiheng Wang are noted as multislotting recognizers, though even for them it is a rare event.

### F2L Move Counts by Case

Approximate STM averages for the standard 41 cases:

- F2L 1: 4 STM (U R U' R').
- F2L 2: 5 STM (after rotation).
- F2L 3: 4 STM.
- F2L 4: 5 STM.
- F2L 5: 6 STM.
- F2L 6: 6 STM.
- F2L 7-12: 6-7 STM each (corner+edge separated, simple).
- F2L 13-18: 6-8 STM each (corner+edge separated, harder).
- F2L 19-23: 7-8 STM each (corner-on-top, edge-out cases).
- F2L 24: 9 STM (the famous "back-to-front" case, R U2 R' U R U' R' or U' R U R' U R U R').
- F2L 25-29: 7-9 STM each.
- F2L 30: 10 STM (F R' F' R U R U' R' or similar; the standard hardest case).
- F2L 31-35: 7-9 STM each.
- F2L 36-41: 7-12 STM each (both-in-slot cases).

The mean across all forty-one cases, weighted by case frequency under random scrambles, is approximately 7.2 STM. With efficient case selection and pseudo-block tricks, top solvers achieve mean F2L per pair of around 6.5 STM, giving total F2L of about 26 STM — significantly below the textbook 32.

### F2L Fingertricks

F2L is dominated by a small set of move sequences:

- **R U R' (and mirrors).** The basic insertion. Index-flick R, right thumb push U, right index flick R'. Roughly 0.35 seconds at top speed.
- **R U' R' (and mirrors).** Reverse insertion. Index R, left index push U', ring R'.
- **R U2 R' (and mirrors).** Setup with double U. Index R, two-finger flick U2, ring R'.
- **y' (or y) rotation.** Hand re-grip, 0.15-0.20 seconds at top speed. Should be minimized; the goal is to execute as much F2L as possible with a single grip orientation.
- **F' U' F (and mirrors).** Edge-extraction. Two-handed F' with thumbs and middle, U' with left index, F with thumbs and middle. Slower than R U R' by about thirty percent.
- **The "sexy move" R U R' U'.** The most common four-move sequence in F2L. Many setup-and-insert pairs use this directly or a multiple of it.

The "y-rotation eliminator" is a strategic principle: prefer algorithms that allow inserting from the right (using R-based moves) rather than from the back (requiring a y or y2 rotation). The strategic cuber tries to plan pair order to minimize rotations: typically front-right first, then back-right (after a y rotation only if needed), then back-left, then front-left.

### Case Frequency

Across a one-thousand-solve sample with random scrambles, the most common F2L cases per pair are:

- F2L 25 (corner on top, edge in slot pointing front): about 6.5 percent of pairs.
- F2L 26 (corner on top, edge in slot pointing back): about 6.4 percent.
- F2L 1 (free pair): about 3.8 percent.
- F2L 7 (corner+edge separated, simple): about 5.5 percent.

The rarest F2L cases (those where both pieces are already in the slot in a specific wrong configuration) appear about 1.5 percent of the time each. Across a long competitive career, every case will appear thousands of times, so investment in algorithm quality is worthwhile across the board, even for the rare cases.

### Algorithm Choice Trees

Many F2L cases admit multiple algorithms. For F2L 7 ("corner above slot, edge in U adjacent"), the two leading candidates are:

- **R U2 R' U R U' R' (7 STM).** Right-handed, ends with a U' R' grip suitable for transitioning to a back-slot pair.
- **R U' R' U F' U F (7 STM).** Two-handed, ends with an F-grip suitable for transitioning to a front-slot pair.

The choice depends on which pair is being executed next. Top solvers know multiple algorithms for many F2L cases and choose ergonomically per solve. Lower-level solvers know one algorithm per case and accept the occasional ergonomic suboptimality.

The "Andy Klise sheet" and the "J Perm F2L Algs" reference list canonical algorithm choices for each case, with notes on when to prefer alternates. These resources are essentially mandatory for any cuber serious about sub-fifteen-second times.

## OLL: The Fifty-Seven Cases

OLL — Orient Last Layer — is the first algorithmic-only phase of CFOP. After F2L completes, the top layer has eight pieces (four corners and four edges) in some random orientation. OLL is a single algorithm that orients all eight pieces so that the top face shows one solid color.

There are exactly fifty-seven OLL cases. The number derives from the combinatorics: each corner can be in three orientations (correct, twisted clockwise, twisted counterclockwise), each edge can be in two orientations (correct or flipped), and the cube imposes constraints (total corner twist must be zero mod three; total edge flip must be zero mod two). After accounting for U-face rotational symmetry and the parity constraints, the number of distinct OLL cases is fifty-seven.

### OLL Categories

The fifty-seven cases group naturally by edge orientation and by the shape pattern formed on the U face:

**All Edges Oriented (7 cases — OLL 21-27):** All four edges already show the U-color on top; only the four corners need orienting. These are the Sune-family cases.

- OLL 21 (H, double Sune): R U R' U R U' R' U R U2 R' (10 STM).
- OLL 22 (Pi): R U2 R2 U' R2 U' R2 U2 R (9 STM).
- OLL 23 (Headlights, U): R2 D R' U2 R D' R' U2 R' (9 STM).
- OLL 24 (Chameleon): r U R' U' r' F R F' (8 STM).
- OLL 25 (Bowtie): F' r U R' U' r' F R (8 STM).
- OLL 26 (Anti-Sune): R U2 R' U' R U' R' (7 STM).
- OLL 27 (Sune): R U R' U R U2 R' (7 STM).

OLL 27 (Sune) is the single most-trained algorithm in cubing. Every CFOP solver knows it; every beginner learns it as part of two-look OLL.

**Cross Edges + Corner Variations (12 cases — OLL 28-39):** A cross pattern on top (all four edges oriented to show U-color, but two on the side showing not-U). These cases sometimes have specific names like H, U, T, and Pi but the broader group covers a range of corner configurations.

- OLL 33 (Squared T): R U R' U' R' F R F' (8 STM).
- OLL 34 (C-shape): R U R' U' B' R' F R F' B (10 STM, or alternate L-based algorithms).

**Line Cases (6 cases — OLL 41-46):** A horizontal "line" of two oriented edges on top, with the other two edges flipped.

- OLL 41 (Awkward): R U R' U R U2 R' F R U R' U' F' (13 STM).
- OLL 42 (Awkward mirror): R' U' R U' R' U2 R F R U R' U' F' (13 STM).
- OLL 43 (P-shape): f' L' U' L U f (6 STM, using outer block turn).
- OLL 44 (P-shape mirror): f R U R' U' f' (6 STM).
- OLL 45 (F-shape): F R U R' U' F' (6 STM).
- OLL 46 (T-shape): R' U' R' F R F' U R (8 STM).

The line cases include some of the shortest OLLs in the entire set (OLL 43-45 at six STM) and one of the longest (OLL 41 at thirteen).

**Dot Cases (8 cases — OLL 1-8):** Zero edges oriented; the U-color appears only on a single center sticker. These cases are the hardest in OLL: they require setup moves to first orient some edges before the algorithm can complete.

- OLL 1: R U2 R2 F R F' U2 R' F R F' (11 STM).
- OLL 2: r U r' U2 r U2 R' U2 R U' r' (11 STM, uses double-layer r).
- OLL 3: R' F2 R F U R U' R' F R (10 STM, or longer variants).
- OLL 8: r U R' U R U2 r' (7 STM, alternate; one of the shortest dots).

The dot cases account for 8/57 = 14 percent of OLL frequency but for over twenty percent of total OLL execution time because their algorithms average eleven to twelve STM each, significantly longer than the average.

**L Cases (6 cases — OLL 47-52):** An L-shape of two oriented edges with corners in various configurations.

**T Cases (2 cases — OLL 33, 45):** A T-shape of three oriented edges.

**U Cases (2 cases — OLL 31-32):** Headlights configuration on one side with edges oriented.

**Pi, H, W, Z and other shape cases (15 cases — OLL 9-20):** Various shapes with one or two edges oriented.

The full catalog of fifty-seven cases is documented in the standard OLL sheets by Lars Vandenbergh, Andy Klise, and J Perm.

### Median Move Counts

Approximate STM statistics for OLL:

- Mean: 10.2 STM.
- Median: 10 STM.
- Range: 7 STM (Sune, OLL 27) to 14 STM (some dot cases and OLL 41).
- Variance is moderate; most cases fall in the 8-12 STM range.

### Two-Look OLL

Beginners commonly learn "two-look OLL," which splits the phase into two algorithmic steps:

- **OE (Orient Edges):** Three cases — line, L-shape, and dot — corresponding to whether 0, 2, or 4 edges are pre-oriented. Three algorithms total.
- **OC (Orient Corners):** Seven cases — Sune, Anti-Sune, Pi, H, U, T, L — corresponding to the seven possible corner orientation patterns after edges are oriented. Seven algorithms total.

Two-look OLL totals ten algorithms (much less than full OLL's fifty-seven) but costs about five additional STM per solve on average. The transition from two-look to full OLL typically saves 0.5-1.5 seconds per solve and is the single highest-return algorithm investment after the initial CFOP transition.

### OLL Recognition

OLL recognition is by sticker pattern on the top face plus the visible sides. A trained cuber can recognize most cases in under 200 milliseconds — about the time of a single Sune algorithm execution.

The recognition pattern goes through hierarchical decisions:

1. **Count oriented edges.** Zero (dot), two (line, L, bar), or four (Sune family). This narrows the case to one of four large groups.
2. **For 2-edge cases: stripe direction.** Front-to-back stripe (line cases, OLL 51-52) vs side-to-side stripe (L cases) vs adjacent (bar cases).
3. **For 4-edge cases: count corner stickers showing U on the F-face.** Zero, one, or two stickers determine which member of the Sune family.
4. **For dots: count corner stickers on the F-face, then on the R-face.** Plus look for any visible side-pattern uniqueness.

Top solvers train recognition with specific drills: looking at hundreds of OLL cases per session, flashed for 200ms each, and verbalizing the case name. Tools like CSTimer and BLD memo apps support OLL flashcard drills.

### Common OLL Algorithms (Selected)

- **Sune (OLL 27): R U R' U R U2 R'.** Seven STM. The reference algorithm.
- **Anti-Sune (OLL 26): R U2 R' U' R U' R'.** Seven STM. Mirror of Sune.
- **H (OLL 21): R U R' U R U' R' U R U2 R'.** Ten STM. Double Sune.
- **T (OLL 33): R U R' U' R' F R F'.** Eight STM. Workhorse pattern, appears in many other algorithms.
- **F (OLL 45): F R U R' U' F'.** Six STM. One of the shortest, very common.
- **L (OLL 47): R' U' R' F R F' U R.** Eight STM.
- **Pi (OLL 22): R U2 R2 U' R2 U' R2 U2 R.** Nine STM. Heavy on R-only moves.

### High-Frequency, Low-Cost OLLs (learn first)

Beginners advancing from two-look to full OLL should prioritize:

1. **OLL 27 (Sune):** Already learned in two-look.
2. **OLL 26 (Anti-Sune):** Already learned in two-look.
3. **OLL 21 (H):** Frequency 1/27 among Sune-family. Short algorithm.
4. **OLL 24 (Chameleon):** Common (1/27), short (8 STM), uses the standard r U R' U' r' wide-move sequence.
5. **OLL 22 (Pi):** Common, R-only.

### Low-Frequency, High-Cost OLLs (learn last)

Cases to defer in early learning:

1. **OLL 1, 2, 3 (dot cases):** Each has 1/27 frequency and 11+ STM algorithms.
2. **OLL 41, 42 (awkward shapes):** Long algorithms, low frequency.
3. **Some L cases (e.g., OLL 47-50):** 1/27 frequency each, 8-10 STM.

### COLL: Orient + Permute Corners

COLL is a variant set of forty-two algorithms that orient the last-layer corners while also permuting them, leaving only the four last-layer edges in a configuration that requires EPLL (a four-case PLL subset). COLL is useful in two-look LL setups: do OLL "edge orientation" first, then COLL to handle corners + corner permutation in one step, leaving EPLL.

COLL is also a building block for ZBLL (which we discuss in a separate document). For CFOP-only cubers, COLL is useful when edges are pre-oriented (e.g., after WV or after a fortunate F2L sequence that orients edges as a side-effect).

### OLLCP: Orient LL + Permute Corners in One

OLLCP is a much larger set (332 cases) that does both OLL and CPLL in one step, leaving only EPLL. Full OLLCP is rarely learned; subsets are more common.

### Speed-Execution of OLL

Top OLL execution sits at about 12 TPS during the algorithm. A ten-move OLL at 12 TPS executes in 0.83 seconds. Add 0.20 seconds of recognition time, and total OLL phase is about 1.0 second.

The "rip" technique on dot cases is a fingertricks improvisation where the cuber uses an aggressive r' or R' wrist-pull to execute a wide move at full speed, accepting some slight loss of control to gain time. Used for OLL 1, OLL 2, and other dot cases that begin with wide moves.

## PLL: The Twenty-One Cases

PLL — Permute Last Layer — is the final phase. With the last layer oriented after OLL, the four corners and four edges of the top layer need only to be permuted into their solved positions. PLL is a single algorithm that does this. There are exactly twenty-one PLL cases (plus the "solved" case, sometimes counted as PLL 0, where no algorithm is needed).

The twenty-one cases divide into categories by what pieces are swapped:

**Adjacent corner swap (10 cases):** Two adjacent corners are swapped; the rest of the layer permutes around this swap.

- Aa, Ab: Three-corner cycle.
- F: Adjacent swap with two-edge cycle.
- Ga, Gb, Gc, Gd: Three-corner + three-edge cycles.
- Ja, Jb: Adjacent corner swap + two-edge cycle.
- Ra, Rb: Adjacent corner swap + edge cycle.
- T: Adjacent corner swap + two-edge swap.

**Diagonal corner swap (4 cases):** Two diagonally-opposite corners are swapped.

- E: Two diagonal corner swaps.
- Na, Nb: Diagonal corner swap + edge cycle.
- V: Diagonal corner swap + edge cycle.
- Y: Diagonal corner swap + edge cycle (different).

**Edge-only (4 cases):** All four corners are in their correct positions; only edges need to permute.

- Ua, Ub: Three-edge cycle.
- H: Two-edge swap, two-edge swap (opposite).
- Z: Two-edge swap, two-edge swap (adjacent).

**No swap (1 case):** Solved already. No algorithm needed (just AUF).

The case names — A, F, G, J, R, T, E, N, V, Y, U, H, Z — are letter codes that have no formal meaning but follow a community convention from the early speedsolving forums (around 2005-2008). The naming has been stable for about twenty years.

### Probabilities

Each PLL case has a specific probability of occurring on a random solve (assuming uniform last-layer state after OLL):

- Ua: 2/72 = 1/36 (call it ~2.78 percent).
- Ub: 2/72 = 1/36.
- H: 1/72 = 1/72 (1.39 percent).
- Z: 1/72 (1.39 percent).
- Aa: 2/72 = 1/36.
- Ab: 2/72 = 1/36.
- E: 1/72.
- F: 1/72.
- Ga, Gb, Gc, Gd: 1/72 each (the four G cases collectively are 4/72 = 1/18).
- Ja: 2/72 = 1/36.
- Jb: 2/72 = 1/36.
- Na: 1/72.
- Nb: 1/72.
- Ra: 1/72.
- Rb: 1/72.
- T: 2/72 = 1/36.
- V: 1/72.
- Y: 1/72.
- Solved: 1/72.

Note: many sources cite "1/21" probabilities for each case for simplicity, but the actual probabilities depend on the case (some cases occur twice as often as others because of the equivalence of certain edge orientations). The 1/72 denominator reflects the symmetry classes of the last-layer permutation space.

### Move Counts

Approximate STM counts for the canonical algorithm of each case:

- Ua: 9 STM (R2 U' R' U' R U R U R U' R, or shorter mirror).
- Ub: 9 STM (R' U R' U' R' U' R' U R U R2, or shorter mirror).
- H: 9 STM (M2 U M2 U2 M2 U M2). Pure slice algorithm.
- Z: 12 STM (M' U M2 U M2 U M' U2 M2). Slice + setup.
- Aa: 9 STM (x R' U R' D2 R U' R' D2 R2 x').
- Ab: 9 STM (x R2 D2 R U R' D2 R U' R x').
- E: 15 STM (x' L' U L D' L' U' L D L' U' L D' L' U L D x).
- F: 14 STM (R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R).
- Ga: 13 STM (R2 U R' U R' U' R U' R2 D U' R' U R D').
- Gb: 13 STM (R' U' R Y R2 U R' U R U' R U' R2 D' U).
- Gc: 13 STM (R2 U' R U' R U R' U R2 D' U R U' R' D).
- Gd: 13 STM (R U R' U' D R2 U' R U' R' U R' U R2 D').
- Ja: 11 STM (R' U L' U2 R U' R' U2 R L).
- Jb: 11 STM (R U R' F' R U R' U' R' F R2 U' R').
- Na: 14 STM (R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'). Variants exist; this is one common form.
- Nb: 14 STM (R' U R U' R' F' U' F R U R' F R' F' R U' R).
- Ra: 13 STM (R U R' F' R U2 R' U2 R' F R U R U2 R').
- Rb: 13 STM (R' U2 R U2 R' F R U R' U' R' F' R2).
- T: 14 STM (R U R' U' R' F R2 U' R' U' R U R' F'). One of the most common PLL algorithms; an early CFOP-learner's familiar pattern.
- V: 15 STM (R' U R' U' Y R' F' R2 U' R' U R' F R F).
- Y: 17 STM (F R U' R' U' R U R' F' R U R' U' R' F R F'). The longest standard PLL.
- Solved: 0 STM (with possible AUF).

The PLL average across all twenty-one cases, weighted by frequency, is about 13.0 STM. Add an average AUF of 0.5 turns (since AUF is needed in roughly half of solves) and the total PLL average is about 13.5 STM, executing in about 1.0 second at top TPS.

### Recognition

PLL recognition is one of the most-trained skills in CFOP. The standard recognition approach is:

1. **Identify diagonal vs adjacent corner swap (or no swap).** Look at the corner pieces from above. If the two front corners belong to the back (or vice versa), it is a diagonal swap. If two adjacent corners swap, it is adjacent. If all corners are correctly placed, it is an edge-only case.
2. **For adjacent: identify which corners are swapped.** Look at the side stickers of the corner pieces. A common pattern: "headlights" — two adjacent corners showing the same color on the side — pins down the case to a specific letter (Ua, Ub, J, A, etc.).
3. **For diagonal: identify which pair is diagonal.** E (both diagonals), N (one diagonal + edge cycle), V (one diagonal + opposite edge cycle), Y.
4. **For edge-only: identify cycle direction.** Ua (clockwise), Ub (counterclockwise), H (both swaps), Z (one direction).

The "two-color block" recognition trick uses the observation that PLL cases are uniquely determined by the visible blocks of matching color on two adjacent sides. Top solvers train themselves to look at only two sides of the cube and deduce the full case in one glance. This skill takes hundreds of hours to develop fully but is mastered by every sub-ten-second solver.

### AUF (Adjust U Face)

AUF is the final U-turn that aligns the last layer to the rest of the cube. About fifty percent of PLL cases naturally end in a solved state (no AUF needed). Of the remaining fifty percent, about one quarter need U, one quarter need U', and a small fraction need U2.

AUF is recognized in two ways:

- **Pre-execution:** Some PLLs end in a known AUF state. The solver can identify the AUF before starting the algorithm by checking the initial U-rotation of the last-layer.
- **Post-execution:** The solver completes PLL, glances at the cube to check alignment, and executes the AUF as a single move. This adds 0.10-0.15 seconds.

Pre-execution AUF is the goal of advanced solvers; post-execution is acceptable but slower.

### Two-Look PLL

Beginners learn "two-look PLL" as the bridge to full PLL:

- **CPLL (Corner PLL):** Three cases — adjacent swap (A), diagonal swap (E), and no swap. The solver first executes a CPLL algorithm to fix the corners.
- **EPLL (Edge PLL):** Four cases — Ua, Ub, H, Z. The solver then executes an EPLL algorithm to fix the edges.

Two-look PLL totals seven algorithms (versus twenty-one for full) but costs about three additional STM per solve. The transition from two-look to full PLL saves about 0.5 seconds per solve.

### Algorithm Choice

Many PLLs admit multiple algorithms. The community has converged on canonical algorithms over time, but variations exist:

- **Ra:** The "R U R' F' R U2 R' U2 R' F R U R U2 R'" (15 STM) is the historical canonical. A newer alternative, "R U' R' U' R U R D R' U' R D' R' U2 R'" (13 STM, using D moves), is increasingly popular.
- **Gc, Gd:** Several alternative algorithms exist; choice depends on grip preference.
- **N:** The two-handed "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" is canonical but several mirror and rearranged variants exist.

Top solvers learn multiple algorithms for the most common PLLs (T, Y, Ja, Jb) and choose based on ergonomic preference and the next solve's expected starting state.

### PLL Recognition Trainers

Several online tools support PLL drilling:

- **CSTimer's PLL trainer:** Built-in to the standard timer, flashes random PLLs and records recognition time.
- **AnyKeyTrainer.com:** Standalone PLL drill with flashcard-style timing.
- **ImpressivePlanet:** Web-based PLL trainer with detailed statistics.
- **J Perm's PLL trainer:** Web-based with case-specific drilling.

A serious PLL drill is: 100 random PLLs, target recognition under 400 ms per case, target execution under 1.2 s per case. Most sub-ten-second solvers hit these targets after a few months of consistent drilling.

### Left-Handed Algorithms

About ten to fifteen percent of cubers are left-handed and prefer mirror algorithms (L-based instead of R-based) for many PLLs. The canonical CFOP algorithm sheets are heavily R-biased; mirror versions exist but are less documented. Notable left-handed top solvers include Drew Brads, who has documented his algorithm preferences in coaching materials.

## Look-Ahead Theory: The Skill That Defines CFOP

Look-ahead is the central skill of competitive CFOP. The world records of the last fifteen years have all been won, in essence, by solvers who could look ahead further than their rivals. Move-count efficiency and TPS matter, but look-ahead matters more.

### The Spot, Track, Know Model

Look-ahead operates on a three-step mental model that runs in parallel with execution:

**Spot:** Locate the next pair (or, for OLL/PLL recognition, the next pattern) while the current move sequence executes. Spotting requires peripheral attention to the cube and pattern-recognition speed.

**Track:** Once spotted, mentally follow the next pair through each move executed. This is the predictive component: the solver knows what each move does to the cube's piece positions and can extrapolate where the next pair will be when the current algorithm ends.

**Know:** As the current algorithm ends, the solver should already know the algorithm for the next pair. There is no "look and decide" stage between pairs; the decision is made before the previous pair ends.

A beginner without look-ahead spends 0.5-1.0 seconds between pairs in the "look and decide" stage. A novice with one-pair look-ahead spends 0.1-0.3 seconds. A top solver spends essentially zero — the next algorithm begins on the same beat as the previous one ends.

### Progression by Skill Level

- **Beginner (sub-60 seconds):** No look-ahead. Each pair is solved independently, with long pauses between.
- **Intermediate (sub-30 seconds):** Occasional one-pair look-ahead, particularly for easy pairs.
- **Sub-20 seconds:** One-pair look-ahead is reliable for 70+ percent of pairs.
- **Sub-15 seconds:** One-pair look-ahead is reliable for 90+ percent. Occasional two-pair look-ahead.
- **Sub-10 seconds:** One-pair look-ahead is essentially universal. Two-pair look-ahead for 50+ percent of solves.
- **Sub-7 seconds:** Two-pair look-ahead reliable; occasional three-pair.
- **Top 20 in world:** Three-pair look-ahead reliable in favorable scrambles; rare four-pair instances.

The "Zemdegs gap" refers to Feliks Zemdegs's reputed ability, around 2015-2018, to maintain three-pair look-ahead consistently and to push toward four-pair in particularly clean scrambles. This was a major factor in his sustained dominance during that period.

### The TPS-vs-Lookahead Tradeoff

A counterintuitive finding for many learners: pushing TPS to maximum during F2L actually slows you down. The reason is that the brain has a fixed bandwidth for tracking pieces, and at high TPS, the brain cannot keep up with the moves to track the next pair. The cube finishes a sequence, the brain hasn't caught up, and the solver pauses to re-look at the cube to find the next pair. The TPS was high but the pause is also high; net time is slower.

The "sixty percent rule" — your F2L TPS should be about sixty percent of your maximum TPS — is a heuristic that emerged from coaching observation around 2018. The exact percentage varies by individual but the principle is universal: leave brain bandwidth for tracking.

### Track-Ability of Algorithms

Different algorithms make tracking easier or harder:

- **R U R' U' R U R' (Sexy + insert).** The seven moves rotate pieces through a predictable pattern; tracking is easy.
- **y' R U' R' U' R U' R' (with rotation).** The y rotation disrupts the mental coordinate system; tracking is hard.
- **F R' F' R (small algorithm).** Rotates pieces unpredictably for novices; experienced solvers learn the pattern.

Top solvers prefer algorithms that minimize "rotation" of the tracking frame. Andy Klise's "Roux for CFOP" series of articles in the 2010s formalized this principle and influenced how F2L is now taught.

### Look-Ahead Drills

Standard drills for look-ahead:

**Slow-turn drill:** Execute F2L at half your normal TPS. The reduced speed allows the brain to fully track each step. After a few hundred slow solves, the solver's tracking becomes reflexive and they can speed back up.

**Eyes-closed mid-F2L drill:** Solve the cross and the first pair normally, then close your eyes for the second pair, relying entirely on internalized tracking. Open eyes for OLL/PLL. This drill builds confidence in tracking.

**Single-pause drill:** Force yourself to pause for exactly one second between each pair, but during the pause, identify and verify the next pair's algorithm without moving. This drill builds the "spot and track" skills separately from execution.

**No-rotation drill:** Solve F2L with zero y/y' rotations. This forces the solver to plan pair order to enable all four pairs to be solved from a single grip orientation. The drill builds pair-prediction muscle.

### Notable Lookahead-Style Cubers

**Drew Brads:** American cuber, focused on slow-turn high-efficiency style. His F2L is among the most efficient in the world by STM, and his look-ahead is correspondingly excellent.

**Patrick Ponce:** American cuber. The opposite end of the spectrum: very high TPS, less look-ahead, but high enough TPS to win individual records.

**Feliks Zemdegs:** Australian cuber. The benchmark for look-ahead at the top of the sport.

**Yiheng Wang:** Current world record holder (2025-2026). Combines moderate TPS with strong look-ahead, similar to the Zemdegs style.

**Tymon Kolasinski:** Polish cuber. Strong in cross planning (X-cross specialist) and look-ahead.

## Modern CFOP Extensions

CFOP has evolved through algorithmic extensions that fold pieces of the solve into adjacent phases. The main extensions:

### VLS (Valk Last Slot)

Named after Mats Valk, VLS is a set of 432 algorithms that solve the last F2L pair and the entire OLL simultaneously. The benefit: one fewer recognition cycle (no OLL recognition phase), one shorter total move count. The cost: 432 algorithms to learn.

VLS is rarely learned in full. Most cubers learn the "VLS easy 27" — a sub-set of cases that have particularly short algorithms (six to nine moves) — and use full OLL for the rest. The easy 27 are typically the cases where the last F2L corner is oriented in the U layer; this is the WV/SV territory.

### WV (Winter Variation)

WV is a sub-set of VLS: twenty-seven algorithms that handle the case where the last F2L pair has its corner already oriented (cross color facing forward, not up or down). WV inserts the pair and orients all four LL corners in one algorithm.

WV is one of the most popular CFOP extensions. The 27 algorithms are short (5-8 STM each), the recognition is simple, and the time savings are 0.3-0.5 seconds per solve.

### SV (Summer Variation)

SV is the mirror of WV: twenty-seven algorithms for the case where the last F2L corner is oriented the opposite direction. Conceptually identical to WV.

### HLS (Hyper Last Slot)

HLS solves the last F2L pair + OLL when the last edge is oriented (whether or not the corner is). 108 cases.

### OLLCP, ZBLL

OLLCP and ZBLL fold corner permutation (CP) into the OLL stage. These are large algorithm sets (OLLCP: 332 cases; ZBLL: 493 cases) that fall into the "1LLL" — one-look-last-layer — methodology. Covered in separate documents.

### Color-Neutrality

Color-neutrality is one of the most effective CFOP extensions. As discussed under Cross, full CN saves 1.0-1.5 STM per solve on the cross alone, plus about 0.5 STM in pair selection (since the solver can choose which face becomes the cross, the F2L pairs can be selected to align with the easiest cross). Time savings: 0.3-0.7 seconds per solve, on average.

### Pseudo-Blocks and Pseudo-F2L

Pseudo-blocking is the technique of treating a misplaced F2L pair as solved temporarily, with the intention to fix the misplacement at the end of F2L or via a different AUF in PLL. This is rare but powerful when applicable.

Example: if F2L pair 4 (the last pair) is in the FR slot but rotated 90 degrees from its target position, the solver can treat it as if it were correctly placed, execute OLL with respect to the "rotated" reference frame, and then execute PLL with a final U-turn that includes the AUF correction. The total move count is sometimes one or two STM lower than the canonical approach. The recognition cost is high; pseudo-blocking is essentially unused in random scrambles but appears in some FMC (fewest moves count) solves.

## Walkthrough: A Sub-7 Solve

Let us walk through a specific solve to make the abstract concrete. We will use a published scramble and a hypothetical solver applying high-level CFOP.

**Scramble:** R' U' F D2 L2 U2 L' U2 B2 R' D2 B' L F R U2 F2 R' B' U' R' U' F.

**Goal:** Sub-seven solve, full CN.

### Inspection (15 seconds)

The solver applies the scramble mentally (or simulates it from memory of the scrambled state) and examines all six faces:

- **White cross:** Three white edges are visible on top, scattered; would require ~7 moves.
- **Yellow cross:** Two yellow edges in slots, two on sides; ~6 moves.
- **Blue cross:** Three blue edges nearly aligned; ~5 moves.
- **Green cross:** Two green edges, scattered; ~7 moves.
- **Red cross:** Two red edges in slots, two on sides; ~7 moves.
- **Orange cross:** Three orange edges, but in tricky positions; ~6 moves.

**Decision:** Blue cross at ~5 moves. Re-verify: y x (rotation to put blue on bottom), R U' R' U2 F. Five moves.

**X-cross attempt:** With blue on bottom, the first F2L pair would be the corner that is yellow-blue-red and the edge that is red-blue. Inspection shows the corner is in URF position; the edge is in UF position. After executing the cross plan, can these be inserted together? Quick mental simulation: after R U' R' U2 F, the corner ends up in URF (yes), and the edge moves to BR (almost, but not adjacent). Almost an X-cross but not quite. Decision: do not commit to X-cross; insert separately.

**First pair planning:** With cross done, the first pair to insert is yellow-blue-red corner + red-blue edge. After cross execution, corner is in URF, edge in BR. Solution: y' R U' R' U R U' R' (pair join via y' rotation, then standard R-U insertion). About 8 STM for the first pair.

**Total inspection use:** ~12 seconds. Last 3 seconds verify the plan and breathe.

### Cross Execution (1.0 second)

The solver executes y x R U' R' U2 F. The rotation (y x) is 0.2 seconds, the five moves are 0.7 seconds at ~7 TPS, plus 0.1 seconds setup. Cross complete.

### Pair 1 (1.4 seconds)

The solver tracks the first pair while executing the cross. With cross done, they immediately begin y' R U' R' U R U' R'. The y' is 0.2 seconds, the seven moves are 0.8 seconds, plus 0.4 seconds of look-ahead start to spot pair 2.

### Pair 2 (1.2 seconds)

Pair 2 (orange-yellow-blue corner + orange-blue edge) is spotted during pair 1. The pair is already partly joined in U; just need a U' R U R' to slot. Four moves, 0.5 seconds, plus pair 3 look-ahead.

### Pair 3 (1.0 second)

Pair 3 (orange-yellow-red corner + orange-red edge) is in a "free pair" configuration. R U' R' inserts directly. Three moves, 0.35 seconds, plus look-ahead.

### Pair 4 (1.4 seconds)

Pair 4 (yellow-red-green corner + red-green edge) is in a harder configuration: corner in UFR slot already but in the wrong orientation, edge in U. Solution: F' U' F (extract corner), then U R U' R' (pair and insert). Seven moves, 0.9 seconds.

### F2L total: 5.0 seconds. Cross + F2L: 6.0 seconds.

### OLL Recognition (0.2 seconds)

Look at top face: three edges oriented (line broken on one side), corners in T-shape. This is OLL 33 (T-shape, no-edge oriented? no, with edges oriented). OLL 33 algorithm: R U R' U' R' F R F'.

### OLL Execution (0.7 seconds)

R U R' U' R' F R F'. Eight moves, 0.7 seconds at 11 TPS.

### PLL Recognition (0.3 seconds)

Look at top face and one side: front-back colors match in pairs of 2-2, side-side colors match in pairs of 2-2. This is the T-perm.

### PLL Execution (1.0 seconds)

T-perm: R U R' U' R' F R2 U' R' U' R U R' F'. Fourteen moves, 1.0 seconds.

### AUF (0.1 seconds)

U2 final adjustment.

### Total: 8.1 seconds.

Hmm, that's not sub-7. Let us recalibrate to a higher-level performance: cross 0.9s, F2L 4.0s, OLL 0.9s, PLL 1.1s = 6.9s. This is a realistic upper-end CFOP solve for a sub-7 ability solver.

The same scramble executed with an X-cross + WV would be:

- Inspection: 14s (planning X-cross + first pair simultaneously).
- X-cross: 1.1s (cross + pair 1 in 8 moves).
- F2L pair 2-4: 3.0s.
- WV (combined pair 4 + OLL): 1.2s.
- PLL T-perm: 1.0s.
- Total: 6.3s.

This is roughly a Tymon Kolasinski or Yusheng Du-level execution for this scramble. The X-cross + WV combo saves about 0.6 seconds vs the standard execution.

## Color-Neutrality Deep Dive

We touched on CN earlier but it deserves its own section because it is one of the most impactful CFOP optimizations.

### The Three Levels

**Single-color (white-only).** The traditional starting choice. White is convenient because, in most cube color schemes, it is on the top face by default and beginners learn the cross by orienting the cube with white on top, then flipping for execution. The cuber sees one cross color across all solves; recognition is simple and consistent.

**Dual-color (white+yellow).** Pick the easier cross between white or yellow. Since white and yellow are opposite faces, the F2L pair recognition transfers cleanly (the corner sticker that matters is whichever cross color is being used). OLL and PLL recognition transfer trivially. Mental cost is low.

**Full color-neutral.** Pick the easiest cross of any of six colors. F2L pair recognition is more complex (the cross color rotates among six options). OLL and PLL recognition transfers but requires sticker-pattern recognition rather than color-identity recognition.

### Time Savings

The cross average drops as follows:

- White-only: 6.92 HTM average.
- Dual-color: 6.34 HTM average (8% improvement).
- Full CN: 5.81 HTM average (16% improvement).

In execution time, the corresponding savings:

- Dual-color vs single: ~0.15 seconds per solve.
- Full CN vs dual: ~0.20 seconds per solve.
- Full CN vs single: ~0.35 seconds per solve.

Plus indirect savings: full CN cubers can pick the cross color that produces the easiest first F2L pair, contributing another ~0.10-0.20 seconds per solve.

### Top CN Solvers

**Feliks Zemdegs:** Dual CN (white+yellow), occasionally full. His preference for dual reflects his pre-2010 training.

**Mats Valk:** Full CN.

**Yusheng Du:** Full CN.

**Tymon Kolasinski:** Full CN.

**Yiheng Wang:** Full CN.

**Sébastien Auroux:** Full CN, with notable inspection efficiency.

**Sergey Ryabko:** Full CN.

The trend is clear: every top-twenty solver since 2018 has been at least dual CN, and the majority are full CN. Single-color cubers in the top thirty are increasingly rare.

### Why White-Only Persisted

White-only persisted into the 2010s for several reasons:

- **Convenience:** Cubes ship with white on a specific face; instructional materials default to white.
- **Training inertia:** A cuber who has invested two years and thousands of solves in white has built recognition habits that do not easily transfer.
- **Coach availability:** Early coaches and tutorial creators (around 2005-2010) were mostly white-only themselves.

The shift to CN began in earnest around 2010-2012 as solvers like Antoine Cantin (who pushed CN aggressively in his coaching content) demonstrated its value. By 2018, CN was the standard recommendation for any cuber starting seriously.

### The "Neutral by Color" vs "Neutral by Orientation" Debate

A subtle distinction in CN training: should the cuber be neutral by color (pick the cross color that has the cleanest cross) or neutral by orientation (pick the cross color that puts the cleanest F2L pair in the easiest slot)?

The two criteria often align but sometimes diverge. A cross might be five moves on white but the resulting F2L is awkward; a six-move cross on green might lead to a cleaner F2L. The "by orientation" approach prioritizes the F2L outcome and is the more advanced strategy. Top solvers practice both criteria.

### The Mental Cost

Full CN requires:

- Six-color cross recognition (instead of one). About 6x the recognition load.
- F2L pair recognition relative to six possible cross colors. Roughly 2-3x the recognition load, since the F2L pair structure is similar but with different sticker colors.
- OLL recognition trained on sticker patterns, not specific color identities. About 1.5x the recognition load.
- PLL recognition is largely color-independent already; minimal change.

The time investment is months, not weeks. A cuber transitioning from white to dual CN typically takes 2-3 months of consistent practice to reach the same average as before. From dual to full takes another 3-6 months. The net benefit (0.5-1.0 seconds per solve, plus the option of higher peak performance) is large enough that the investment is worth it for any cuber serious about competitive cubing, but the cost is real and should not be underestimated.

## The Last-Layer Subset Bridge: COLL, WV, EPLL, ZBLL

A "subset bridge" is an algorithm set that fits between the standard CFOP phases and a more compact last-layer scheme. The progression from beginner to expert CFOP is best understood as a series of subset bridges:

### 4-Look Last Layer (Beginner)

1. **Orient Edges (3 cases):** Line, L, dot.
2. **Orient Corners (7 cases):** Sune, Anti-Sune, Pi, H, U, T, L.
3. **Permute Corners (2 cases):** Adjacent swap (A) or diagonal swap (E).
4. **Permute Edges (4 cases):** Ua, Ub, H, Z.

Total: 16 algorithms. Average LL time: 5-7 seconds for a beginner.

### 3-Look Last Layer

1. **Orient Edges (3 cases).**
2. **Full OLL (10 algorithms for the 10 corner sub-cases given edges oriented).**
3. **Full PLL (21 cases).**

Total: 31 algorithms. Average LL time: 3-4 seconds for an intermediate.

### 2-Look Last Layer

1. **Full OLL (57 cases).**
2. **Full PLL (21 cases).**

Total: 78 algorithms. Average LL time: 2-3 seconds for an advanced.

### COLL + EPLL (After Edge Orientation)

If the F2L process orients all last-layer edges (e.g., via ZB methods or via lucky scrambles), then:

1. **COLL (42 algorithms):** Orient + permute corners.
2. **EPLL (4 algorithms):** Permute edges.

Total: 46 algorithms (plus the F2L+OE work). LL time: 1.5-2.5 seconds for the LL phase.

### 1-Look LL: ZBLL

1. **VHF2L or equivalent in F2L:** Orient all LL edges during F2L last pair (32 algorithms).
2. **ZBLL (493 cases):** Permute and orient corners + permute edges in one algorithm.

Total: 525 algorithms for the F2L+LL bridge. LL time: 1.0-1.5 seconds.

ZBLL is currently the gold standard for one-look LL. A handful of top solvers have learned a significant subset; full ZBLL is essentially the domain of method-specialists like the developer of the Yan Method or some FMC solvers.

### LL Skip Probability

A "LL skip" is a solve in which after OLL, the cube is already in the PLL-solved state, requiring no PLL algorithm (only AUF). The probability of a LL skip in standard CFOP is 1/15552. The probability of an OLL skip (PLL only needed) is 1/216 — about 0.5 percent of solves. The probability of a PLL skip (OLL only needed, then solved after AUF) is 1/72.

With edge orientation control (e.g., ZBLL), the LL skip probability rises to about 1/1296. This is because edge orientation is one of the constraints in the LL state; controlling it removes a factor and dramatically increases skip frequency. Many of the world's fastest individual solves involve LL skips or near-skips.

## Drilling and Practice Methodology

We have discussed individual drills throughout this document. Let us collect them into a coherent practice methodology.

### Daily Practice Structure (sub-15 solver)

- **Warm-up:** 20 solves at normal speed.
- **Cross drilling:** 50 cross-only solves.
- **F2L drilling:** Random F2L cases on CSTimer (50 cases).
- **OLL drilling:** Recognition + execution drills (50 cases).
- **PLL drilling:** Recognition + execution drills (50 cases).
- **Look-ahead drill:** 30 slow-turn full solves.
- **Time attack:** 50-100 full solves at normal speed, logged.

Total time: 60-90 minutes per day. Expected progression: ~0.5 seconds per month for a sub-15 solver during dedicated training periods.

### Weekly Structure

- **6 days of daily practice as above.**
- **1 day of recovery (low-volume, casual cubing).**

### Monthly Structure

- **3 weeks of normal training.**
- **1 week of "deload" (lower volume, focus on weak cases).**

### Year-Round Structure

- **2-3 months building toward a target competition.**
- **1 week pre-competition with reduced volume and focus on consistency.**
- **Competition.**
- **1-2 weeks rest, then 2-3 month new cycle.**

### Burnout Avoidance

Cubing burnout is real and common among competitive solvers. Signs include: averages stagnating or worsening, dread before practice, irritability during sessions. The standard mitigations are:

- **Variety:** Practice other events (4x4, OH, BLD) to vary the cognitive load.
- **Social cubing:** Group practice with friends or local meetups.
- **Goal rotation:** Set small short-term goals (sub-10 single, then sub-9 average of 5) rather than only large long-term goals.
- **Rest:** Honest rest weeks where cubing is optional.

## Performance Equipment and Cube Choice

CFOP execution is partly determined by the physical cube. The dominant brands and models in 2026:

- **MoYu RS3M 2024:** Flagship magnetic 3x3, sub-$30, used by many top solvers.
- **GAN 12 MagLev:** Premium magnetic-levitation core, $80-120, used by Yiheng Wang and many top sub-7 solvers.
- **Yuxin Little Magic V2:** Budget-friendly magnetic, sub-$15, popular for warm-up and travel.
- **QiYi MS:** Mid-range magnetic, $20-30.

The cube does not make a fast solver fast; a fast solver is fast on any well-tensioned magnetic cube. But the cube can make a fast solver slightly slower if poorly chosen. Personal preference around stickered vs stickerless, weight, magnet strength, and tensioning matters more than brand.

Lubrication: silicone-based (DNM-37 for the core, weight 5 or weight 3 for the pieces) is the standard. Lubing should be done every 100-200 hours of practice.

Stickers: stickerless (plastic) is the standard since 2018. Stickered cubes (vinyl stickers on black plastic) are now rare in competition; some solvers prefer them for haptic feedback but most do not.

## Coda

CFOP is the dominant 3x3x3 method because, across forty-five years of evolution, it has accumulated the deepest pool of community knowledge, algorithm sets, and coaching expertise of any speedsolving method. Its move count is not the lowest, but its TPS ceiling is the highest. Its algorithmic burden is not the lowest, but its algorithmic ROI is the highest. Its inspection demands are not the lowest, but its inspection-to-execution coupling is the most well-understood.

A cuber starting in 2026 with the goal of reaching sub-ten times should learn CFOP. A cuber starting with the goal of reaching sub-six times has, statistically, only one real choice: CFOP. The alternatives (Roux, ZZ) are viable and have produced world-class solvers, but they require building a community of one for resources, while CFOP comes with an entire ecosystem of tutorials, trainers, coaches, algorithm sheets, scramble analyzers, and YouTube channels that compress years of learning into months.

The four phases — Cross, F2L, OLL, PLL — will be the cuber's companions for years. The skills built in each phase — visual planning, look-ahead, recognition, fingertricks — transfer to every other event (4x4 is essentially CFOP with redux/parity, OH is CFOP with one hand, BLD has its own structure but borrows from CFOP recognition patterns). The investment is universally returned across the cuber's competitive life.

This document has covered every major aspect of CFOP at a depth sufficient for a serious learner or coach. The next document in this series covers Roux as a comparative method; the document after that covers the algorithmic frontiers beyond CFOP (ZBLL, 1LLL, and the long tail of method extensions). For now, the CFOP cuber's path is clear: drill the four phases, build look-ahead through slow practice, transition to full CN, and accumulate solves. The world records will follow for some; for the rest, the satisfaction of mastering one of the great puzzles of the twentieth century is its own reward.

## Appendix A: Comprehensive F2L Case Reference

The forty-one canonical F2L cases, organized by category with canonical algorithms and execution notes. The convention used here: cross is on the bottom (D face), F2L slot is FR (front-right), corner color triplet is white-red-green, edge color pair is red-green.

### Easy Pair Cases (Slot Already Aligned)

**F2L 1 — Free Pair, Standard Insert.** Corner in URF position with white facing right, edge in UR position with red facing up. Algorithm: U R U' R'. STM: 4. The simplest possible F2L case. Recognition: corner cross-color sticker on side, edge above corner. Frequency: ~3.0 percent.

**F2L 2 — Free Pair, F-Insert.** Corner in URF position with white facing front, edge in UF position with green facing up. Algorithm: y' U' L' U L (after y rotation) or U' F' U F (without rotation). STM: 4-5. Recognition: cross-color sticker on front of corner. Frequency: ~3.0 percent.

**F2L 3 — Free Pair Variant, Hidden Edge.** Corner in URF position with white facing up, edge in UF position. Algorithm: R U R' U R U' R'. STM: 7. Sometimes called the "double insert." Recognition: white on top of corner, edge above-front. Frequency: ~2.5 percent.

**F2L 4 — Free Pair, Joined Forward.** Corner in URF, edge in UR with green up. Algorithm: U' R U R' U R U' R'. STM: 7. Recognition: edge above corner but in wrong orientation. Frequency: ~2.5 percent.

**F2L 5 — Free Pair, Joined Backward.** Corner in URF with cross color up, edge in UR with red up. Algorithm: U R U2 R' U R U' R'. STM: 8. Recognition: pair partly joined but corner needs flipping. Frequency: ~2.5 percent.

**F2L 6 — Free Pair, Anti-Sune Pattern.** Corner in URF, edge in UR, both in unusual orientations. Algorithm: U' R U' R' U R U R' U' R U' R' (or shorter alternates depending on exact case). STM: 7-10. Recognition: complex pair joining needed. Frequency: ~2.5 percent.

### Corner-Up, Edge-In-U Cases

**F2L 7-12** are cases where the corner is in the U layer with the cross color visible, and the edge is also in the U layer but in a non-adjacent position relative to the corner. The setup is to first move the edge adjacent to the corner (one or two STM), then apply a free-pair-like algorithm.

**F2L 7.** Corner URF white-up, edge UB. Setup: U2. Algorithm overall: U2 R U R' (then continue with insert). STM: 6.

**F2L 8.** Corner URF white-up, edge UL. Setup: U'. Algorithm: U' R U' R' U R U' R'. STM: 8.

**F2L 9.** Corner URF white-up, edge UR but wrong orientation. Algorithm: U' R U2 R' U R U R'. STM: 8.

**F2L 10-12.** Variations with corner in URF white-front or white-right. Each requires its own setup-and-join sequence, typically 7-9 STM.

### Corner-Up, Edge-In-Slot-Wrong Cases

**F2L 13-18** are cases where the edge is already in the FR slot but in the wrong orientation (flipped or in the wrong column), and the corner is in U.

**F2L 13.** Corner URF, edge in FR slot but flipped (green on R-face). Algorithm: R U' R' U' R U' R'. STM: 8.

**F2L 14.** Corner URF, edge in FR slot with red on F-face but flipped. Algorithm: R U R' U' R U R' U' R U R'. STM: 11.

**F2L 15-18.** Variations with corner in different orientations or edge in different wrong positions.

### Corner-On-Top, Edge-Buried Cases

**F2L 19-29** are cases where the corner is in U and the edge is in a non-slot middle-layer position (e.g., in the BR slot, the FL slot, etc.).

**F2L 24.** Corner URF white-up, edge in BR slot front-facing. The famous "back-to-front" case. Algorithm: U2 R' U2 R U' R U R' (or alternate U' R U R' U R U R' U' R U' R'). STM: 9-11. Frequency: ~1.5 percent.

**F2L 25-26.** Common edge-in-FL slot cases. Various algorithms 7-9 STM.

**F2L 27-29.** Edge in back slots. 7-9 STM.

### Corner-In-Slot, Edge-In-U Cases

**F2L 30-35** are cases where the corner is already in the FR slot but in the wrong orientation, and the edge is in U.

**F2L 30.** Corner in FR slot with white on R-face, edge in U. Algorithm: F R' F' R U R U' R' (or alternate: R U' R' U' R U R' F' R U R' U' R U R'). STM: 8-13. The widely-acknowledged hardest case. Frequency: ~1 percent. Many top solvers learn multiple variants and choose based on the exact orientation.

**F2L 31-35.** Variations with corner in different wrong orientations. STM 7-10.

### Both-In-Slot Cases

**F2L 36-41** are cases where both the corner and the edge are in the FR slot but at least one of them is in the wrong position or orientation.

**F2L 36.** Corner in FR slot wrong orientation (white facing F), edge in FR slot correctly. Algorithm: R U R' U' R U' R' U R U R' (extracts pair, rejoins, reinserts). STM: 11.

**F2L 37.** Corner in FR slot wrong orientation, edge flipped. Algorithm: R U' R' U R U R' (extract and rejoin). STM: 7. Surprisingly short for an in-slot case.

**F2L 38-41.** Various flip-and-rejoin scenarios. STM: 8-13.

The full forty-one case catalog with multiple algorithm variants is the standard reference work of CFOP. Online sources like Andy Klise's printable PDF, J Perm's Anki deck, and the CSTimer F2L trainer are universal community resources.

## Appendix B: Comprehensive OLL Reference

The fifty-seven OLL cases, organized by case group with canonical algorithms.

### Group 1: All Edges Oriented (Sune Family, OLL 21-27)

**OLL 21 — H.** R U R' U R U' R' U R U2 R'. STM: 10. Double Sune. Frequency: 1/27 within group, ~1.5 percent overall.

**OLL 22 — Pi.** R U2 R2 U' R2 U' R2 U2 R. STM: 9. Heavy R-only execution. Frequency: 1/27.

**OLL 23 — U.** R2 D R' U2 R D' R' U2 R'. STM: 9. Uses D moves; some prefer alternate without D. Frequency: 1/27.

**OLL 24 — Chameleon.** r U R' U' r' F R F'. STM: 8. Uses wide r. Frequency: 1/27.

**OLL 25 — Bowtie.** F' r U R' U' r' F R. STM: 8. Mirror of OLL 24 conceptually. Frequency: 1/27.

**OLL 26 — Anti-Sune.** R U2 R' U' R U' R'. STM: 7. Frequency: 1/27.

**OLL 27 — Sune.** R U R' U R U2 R'. STM: 7. The single most-trained algorithm. Frequency: 1/27.

### Group 2: Cross + Variations (OLL 28-39)

**OLL 28 — Headlights.** r U R' U' M U R U' R'. STM: 9.

**OLL 29 — W (mirror).** R U R' U' R U' R' F' U' F R U R'. STM: 13.

**OLL 30 — W.** F R' F R2 U' R' U' R U R' F2. STM: 11.

**OLL 33 — T.** R U R' U' R' F R F'. STM: 8. The "T-OLL," widely-known.

**OLL 34 — C.** R U R' U' B' R' F R F' B. STM: 10. Alternate L-based versions exist.

**OLL 37 — F.** F R' F' R U R U' R'. STM: 8.

(Other cases in this group: 8-12 STM each, various algorithm choices.)

### Group 3: Line Cases (OLL 41-46)

**OLL 41 — Awkward.** R U R' U R U2 R' F R U R' U' F'. STM: 13. Long.

**OLL 42 — Awkward Mirror.** R' U' R U' R' U2 R F R U R' U' F'. STM: 13.

**OLL 43 — P (R).** f' L' U' L U f. STM: 6. Very short.

**OLL 44 — P (L).** f R U R' U' f'. STM: 6. Mirror of OLL 43.

**OLL 45 — F.** F R U R' U' F'. STM: 6. Workhorse short algorithm.

**OLL 46 — T (alt).** R' U' R' F R F' U R. STM: 8.

### Group 4: Dot Cases (OLL 1-8)

These are the hardest cases. The U-face shows zero oriented edges (only the center sticker shows U-color).

**OLL 1.** R U2 R2 F R F' U2 R' F R F'. STM: 11.

**OLL 2.** r U r' U2 r U2 R' U2 R U' r'. STM: 11.

**OLL 3.** f R U R' U' f' U F R U R' U' F'. STM: 12.

**OLL 4.** f R U R' U' f' U' F R U R' U' F'. STM: 12.

**OLL 5.** r' U2 R U R' U r. STM: 7. Short for a dot case.

**OLL 6.** r U2 R' U' R U' r'. STM: 7.

**OLL 7.** r U R' U R U2 r'. STM: 7.

**OLL 8.** r' U' R U' R' U2 r. STM: 7.

The dot cases collectively are 8/57 = ~14 percent of solves. Their average STM is ~10, vs the overall OLL average of ~10.2. So dots are about average in cost when including the short cases 5-8.

### Groups 5-9: Other Shape Cases

**OLL 9-20: Pi, H, W, Z and related shapes.** Various algorithms 8-14 STM.

**OLL 47-52: L cases.** 8-10 STM each.

**OLL 53-57: Special small cases including S, AS, U.** 5-12 STM.

The full OLL catalog with case images, canonical algorithms, and alternative algorithms is available in standard PDFs by Lars Vandenbergh, Andy Klise, and J Perm.

## Appendix C: Comprehensive PLL Reference Table

| Case | Name | Probability | STM | Canonical Algorithm |
|------|------|-------------|-----|---------------------|
| Ua | Edge cycle CW | 2/72 | 9 | R2 U' R' U' R U R U R U' R |
| Ub | Edge cycle CCW | 2/72 | 9 | R' U R' U' R' U' R' U R U R2 |
| H | Edge double-swap | 1/72 | 9 | M2 U M2 U2 M2 U M2 |
| Z | Edge swap-swap | 1/72 | 12 | M' U M2 U M2 U M' U2 M2 |
| Aa | Corner cycle CCW | 2/72 | 9 | x R' U R' D2 R U' R' D2 R2 x' |
| Ab | Corner cycle CW | 2/72 | 9 | x R2 D2 R U R' D2 R U' R x' |
| E | Diagonal corner swap | 1/72 | 15 | x' L' U L D' L' U' L D L' U' L D' L' U L D x |
| F | Corner+edge swap | 1/72 | 14 | R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R |
| Ga | G family | 1/72 | 13 | R2 U R' U R' U' R U' R2 D U' R' U R D' |
| Gb | G family | 1/72 | 13 | R' U' R Y R2 U R' U R U' R U' R2 D' U |
| Gc | G family | 1/72 | 13 | R2 U' R U' R U R' U R2 D' U R U' R' D |
| Gd | G family | 1/72 | 13 | R U R' U' D R2 U' R U' R' U R' U R2 D' |
| Ja | J-perm | 2/72 | 11 | R' U L' U2 R U' R' U2 R L |
| Jb | J-perm | 2/72 | 11 | R U R' F' R U R' U' R' F R2 U' R' |
| Na | N-perm | 1/72 | 14 | R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R' |
| Nb | N-perm | 1/72 | 14 | R' U R U' R' F' U' F R U R' F R' F' R U' R |
| Ra | R-perm | 1/72 | 13 | R U R' F' R U2 R' U2 R' F R U R U2 R' |
| Rb | R-perm | 1/72 | 13 | R' U2 R U2 R' F R U R' U' R' F' R2 |
| T | T-perm | 2/72 | 14 | R U R' U' R' F R2 U' R' U' R U R' F' |
| V | V-perm | 1/72 | 15 | R' U R' U' Y R' F' R2 U' R' U R' F R F |
| Y | Y-perm | 1/72 | 17 | F R U' R' U' R U R' F' R U R' U' R' F R F' |

Note that several cells in the probability column show "2/72" — these are cases that exist in two mirror-symmetric forms (e.g., Ja and Jb both exist, hence Ja's probability counts only the Ja half). The total of all probabilities is 72/72 = 1.0.

## Appendix D: A Glossary of CFOP Terminology

**AUF** (Adjust U Face): The final U-turn after PLL to align the last layer with the rest of the cube.

**COLL** (Corner Orient Last Layer): A 42-algorithm set that orients and permutes the last-layer corners, leaving only edges for EPLL.

**CN** (Color-Neutral): A solver who can solve the cross on any of the six (or some subset of the six) colors.

**Cross** (the first phase): Solving four edges of one face plus the center, forming a cross shape.

**EOLR** (Edge Orientation + Last Roux Block): Roux-method term; sometimes borrowed into CFOP for "edge orient + last F2L" descriptions.

**F2L** (First Two Layers): The phase solving the cross plus four corner-edge pairs.

**Fingertrick:** A specific finger-motion pattern for executing a move sequence rapidly.

**Free Pair:** An F2L pair where the corner and edge are already joined in the U layer.

**HLS** (Hyper Last Slot): F2L+OLL combined when the edge is oriented; 108 cases.

**Inspection:** The 15-second pre-solve period where the cuber plans their solve.

**Look-Ahead:** The skill of tracking the next pair/case while executing the current one.

**Multislotting:** Solving two F2L pairs simultaneously with one algorithm sequence.

**OCLL** (Orient Corners of Last Layer): Two-look OLL's corner-orientation step; 7 cases.

**OE** (Orient Edges): Two-look OLL's edge-orientation step; 3 cases.

**OLL** (Orient Last Layer): The phase orienting all 8 LL pieces; 57 cases.

**OLLCP** (OLL with Corner Permutation): A 332-case set folding CPLL into OLL.

**PLL** (Permute Last Layer): The final phase permuting all 8 LL pieces; 21 cases.

**Pseudo-block:** Treating misplaced pieces as solved temporarily to enable an efficient sequence; AUF or rotation compensates at the end.

**Slot:** One of the four F2L target locations (FR, FL, BR, BL).

**STM** (Slice Turn Metric): The standard move-counting convention where each face turn or slice turn is one move; rotations are not counted.

**Sune:** The canonical OLL 27 algorithm (R U R' U R U2 R'); also a name for the case.

**SV** (Summer Variation): A 27-case F2L+OLL combined set; mirror of WV.

**TPS** (Turns Per Second): The execution speed metric.

**VHF2L** (Variation of the Last F2L): A 32-case set orienting LL edges during last F2L pair.

**VLS** (Valk Last Slot): A 432-case F2L+OLL combined set.

**WV** (Winter Variation): A 27-case F2L+OLL combined set when corner is oriented.

**X-cross:** Cross + one F2L pair solved together as a single execution.

**XX-cross:** Cross + two F2L pairs solved together.

**XEOLR:** Cross + one F2L edge solved together (a softer version of X-cross).

**Y-rotation:** A 90-degree clockwise rotation around the vertical axis; commonly used between F2L pairs.

**ZBLL** (Zborowski-Bruchem Last Layer): A 493-case 1LLL set assuming edges are oriented in F2L.

## Appendix E: Notable World Records Achieved with CFOP

A non-exhaustive timeline of 3x3x3 world records, all achieved with CFOP:

- 2003-08-23: First WCA-era record at WC2003, by Dan Knights (United States), 16.71 single.
- 2006-2007: Several records by Yu Nakajima and Toby Mao, dropping below 11 seconds.
- 2008-07-13: Erik Akkersdijk (Netherlands), 7.08 single at the Czech Open (XX-cross).
- 2011-12-04: Feliks Zemdegs (Australia), 5.66 single at Melbourne Cube Day. Beginning of Zemdegs era.
- 2013-2015: Several Zemdegs records, including 5.55 in 2013, 5.25 in 2015.
- 2015-11-21: Lucas Etter (USA), 4.90 single at River Hill Fall 2015.
- 2016-05-06: Mats Valk (Netherlands), 4.74 single at Jawa Timur Open 2016.
- 2017-09-09: SeungBeom Cho (South Korea), 4.59 single.
- 2017-09-24: Patrick Ponce (USA), 4.69 single. Briefly held the record.
- 2018-05-19: Feliks Zemdegs, 4.22 single.
- 2018-11-24: Yusheng Du (China), 3.47 single at Wuhu Open 2018. Held the record for nearly four years.
- 2022-08-27: Tymon Kolasinski (Poland), 3.13 single at Cube Cracow 2022.
- 2023-04-29: Max Park (USA), 3.13 (tied) at Pride in Long Beach 2023.
- 2023-06-11: Max Park, 3.13 (tied again).
- 2025: Yiheng Wang (China), records approaching 3.05.

Every one of these solves was a CFOP solve. Almost all involved X-cross or XX-cross planning. Many involved LL skips, OLL skips, or fortunate scrambles that the solver capitalized on through superior recognition and execution.

The pattern across these records is consistent: a top solver, a favorable scramble, a clean X-cross, smooth F2L with one or two pair look-ahead, a short OLL (often Sune or Anti-Sune), and a fast PLL. The record progression has slowed in recent years not because of method exhaustion but because the marginal solver is already within a few percent of the optimal solve for a given scramble; further gains come from the rare extremely-favorable scramble combined with perfect execution.
`;
