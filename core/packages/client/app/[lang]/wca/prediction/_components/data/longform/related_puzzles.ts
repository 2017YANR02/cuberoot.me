export const RELATED_PUZZLES_EN = `
## Related WCA Puzzles: How They Compare to the 3x3x3

The 3x3x3 Rubik's Cube is the gravitational center of the speedcubing world. It is the puzzle on the World Cube Association logo, the one that television cameras gravitate toward at competitions, the one whose world record gets reported by mainstream news outlets, and the one that almost every competitor learns first. But the WCA sanctions seventeen official events spread across thirteen distinct physical puzzles, and the broader twisty puzzle hobby includes hundreds of designs that have never appeared on a WCA registration page. Each of those puzzles has its own state space, its own optimal solving theory, its own dominant methods, its own hardware ecosystem, and its own community of specialists who often have very different opinions about which puzzle is the "real" challenge. This document is a deep-dive into those related puzzles, treating the 3x3 as a reference point for comparison and asking, for each one, three concrete questions: what does the puzzle look like mathematically, who solves it fastest and how, and what does training on it actually give a 3x3 cuber back in the way of skill transfer.

The framing matters because newcomers to the hobby often encounter speedcubing through a video of a sub-five 3x3 solve and then assume that any other puzzle must follow roughly the same logic at a larger or smaller scale. That intuition is wrong in interesting ways. A 2x2 looks like a baby 3x3 but is actually solved with completely different last-layer algorithms and a fundamentally different state-space structure that admits brute-force optimal solving in microseconds. A 4x4 looks like a slightly bigger 3x3 but introduces a reduction phase that has no analogue in 3x3 solving and ends with parity cases that can only occur because the bigger cube has indistinguishable pieces that become distinguishable once oriented. A Megaminx looks like a 3x3 with extra faces but is solved with a five-color cross instead of one and demands a completely different set of last-layer algorithms despite preserving the broad CFOP structure. A Square-1 looks like nothing else on the table at a competition and is solved with an algorithmic vocabulary that shares almost no ideas with the rest of the puzzle world. And the Clock looks like a watch with nine faces and is solved by manipulating pins and dials in a way that has nothing at all to do with twisting and turning.

Through all of this, the 3x3 remains the dominant event. There are good reasons for that dominance: it is small enough that top times are bounded by physical reaction speed rather than algorithm execution time, it has a deep enough theoretical structure to reward thousands of hours of practice without bottoming out, and it has the largest community of method developers and algorithm sheet maintainers in the hobby. But it is not the only event, and many of the most interesting innovations in speedcubing in the past five years have come from outside the 3x3 mainstream. Understanding those events makes it easier to predict where the broader sport is going and what kinds of records are most likely to fall in the coming years.

## 2x2x2: The Pocket Cube

The 2x2x2, often called the Pocket Cube, is the smallest twisty puzzle in the standard Rubik's family. It consists of eight corner pieces with no edges and no centers, so all eight cubies are corner-type and all of them are visible at the same time. There are no fixed pieces, which means every solution involves choosing an orientation as well as a permutation; conventionally solvers pick a corner to designate as the "bottom-back-left" reference and solve relative to it. The state space is exactly 3,674,160 distinct positions if we account for the symmetry that comes from the lack of a fixed reference frame, or about 88 million if we count every distinguishable physical state without modding out by orientation. The diameter of the Cayley graph, the "God's number" for the 2x2, is exactly 11 in the half-turn metric and 14 in the quarter-turn metric. That number was proven by Tomas Rokicki and collaborators in the late 2000s using a brute-force search over the entire state space, which is small enough to fit in memory on a modern laptop.

The 2x2 has been a WCA event since the founding of the organization in 2003 and has been held at almost every WCA competition since then. The world record for the single 2x2 solve has been broken many times and currently sits in the low-half-second range; as of recent updates, the official world record stood at 0.43 seconds set by Teodor Zajder in 2023, with several other competitors having recorded times in the 0.46 to 0.49 range. The average of five world record has been pushed under 1.00 second by multiple competitors, with Yiheng Wang and others trading the record back and forth in the 0.78 to 0.85 range as of recent competition seasons. The 2x2 is the event where single-solve records are most influenced by luck because a favorable scramble that requires only one or two algorithms can be solved in essentially the time it takes to recognize the case and execute the moves, while an unfavorable scramble that requires four or five algorithms might take three times as long.

The dominant solving methods on 2x2 are Ortega, CLL, and EG. Ortega is the entry-level method and is essentially a one-look first layer followed by a one-look orientation of the last layer and a one-look permutation of both layers. It requires only twelve algorithms total and is roughly the 2x2 equivalent of beginners' method on a 3x3. CLL (Corners of the Last Layer) is the next step up: solvers learn 42 algorithms to one-look the entire last layer after solving the first layer, reducing the solve to a one-look first layer plus a one-look last layer. EG (Erik-Gunnar, named for its developers) extends CLL by allowing the first layer to be unoriented before the last-layer algorithm is applied; learning the full EG set requires 128 algorithms but reduces the average move count by enough to make sub-one second solving practical for top competitors. The very top 2x2 solvers also use specialized techniques like "TCLL" for handling specific cases and develop personal recognition shortcuts that let them identify the optimal algorithm in under 100 milliseconds.

Compared to 3x3, the 2x2 is a much smaller and more tractable puzzle. The state space is roughly 12 orders of magnitude smaller than the 3x3 state space, and the methods are correspondingly shallower in their algorithmic depth. A 3x3 expert who picks up a 2x2 cold can typically reach competitive intermediate times within a few weeks of practice because the underlying solving intuitions transfer: looking ahead, planning the first layer during inspection, recognizing last-layer cases by their color patterns, and executing algorithms with efficient fingertricks. The skill gap between a strong 3x3 cuber and a 2x2 specialist is much smaller than the gap between a strong 3x3 cuber and a 2x2 beginner, which means 2x2 rewards specialization less than most other events.

The transfer from 2x2 to 3x3 is more limited than the other direction. CLL algorithms on the 2x2 happen to share many patterns with COLL (Corners of the Last Layer, preserving edge orientation) on the 3x3, so a 2x2 specialist who has memorized the full CLL set has effectively learned half of the COLL set "for free." Inspection skills also transfer reasonably well because both events reward the ability to plan moves during the fifteen-second pre-solve period. But the bulk of 3x3 solving time is spent on F2L (first two layers), which has no analogue on the 2x2, so most of the deeper 3x3 expertise has nothing to do with 2x2 skill. A common pattern in the community is for competitors to maintain strong 2x2 times almost as a "warmup event" without spending serious training time on it.

Hardware-wise, the 2x2 has gone through the same generational evolution as the 3x3. Early 2x2 puzzles were rebranded Rubik's-style hardware that pop spontaneously and had loose tensions. The modern 2x2 market is dominated by MoYu, GAN, QiYi, and a few other Chinese manufacturers, with magnetic flagship cubes typically selling for $15-30 and offering crisp turning, adjustable tensions, and corner-cutting tolerances that are essentially identical to flagship 3x3 hardware. Some specialists prefer slightly smaller 2x2 puzzles (50mm rather than the standard 55-56mm) because the smaller cube fits more comfortably in the closed hand for ultra-fast execution.

## 4x4x4: The Rubik's Revenge

The 4x4x4, originally marketed as Rubik's Revenge when Ideal Toy Corporation introduced it in the early 1980s, is the first cube in the Rubik's family that does not have fixed centers. Each face has four center pieces that can be rearranged among themselves, twelve edges that come in pairs of two identical-looking wings, and eight corners. The state space is approximately 7.4 times 10 to the 45th power, which is dramatically larger than the 3x3 state space of about 4.3 times 10 to the 19th. The diameter of the Cayley graph is not known exactly because the state space is too large to enumerate, but lower bounds suggest the God's number is at least in the high 30s and upper bounds from various heuristic searches place it somewhere in the 40s. There is no known algorithm that solves arbitrary 4x4 positions in fewer than about 60 moves on average, and most human solvers use methods that produce solutions in the 90 to 140 move range.

The 4x4 has been a WCA event since the founding of the organization in 2003 and has been held at almost every major competition since then. The world record for the single 4x4 solve was pushed under 17 seconds by Max Park, with Tymon Kolasinski and Sebastian Weyer also trading positions in the top three throughout the mid-2020s. The average of five world record has been under 19 seconds for years, with the trend line moving steadily downward as both hardware and methods improve. The 4x4 has historically been an event where Asian and European competitors have dominated more evenly than on the 3x3, which has been almost entirely dominated by a handful of US and Chinese cubers in recent years.

The dominant method for 4x4 solving is reduction, which is the only method seriously used at the top level. Reduction proceeds in three phases. In the first phase, the solver builds the six 2x2 center blocks by treating the inner slice turns as the only available moves; this is sometimes called "centers" or "center building" and typically takes 8 to 12 seconds for top solvers. In the second phase, the solver pairs up the edges by combining the two wings of each of the twelve edge pairs into single edge units; this is called "edge pairing" and typically takes 10 to 15 seconds. After both centers and edges are built, the puzzle effectively becomes a 3x3 with thicker pieces, and the final phase is a 3x3 solve using whatever method the solver normally uses for 3x3 (usually CFOP). The 3x3 phase typically takes 8 to 12 seconds because the pieces are larger and harder to manipulate quickly.

The defining challenge of 4x4 is parity. Because the 4x4 has indistinguishable wings, the final 3x3 phase can end up in a state that is impossible on a true 3x3. Specifically, the OLL parity case occurs when a single edge is flipped (impossible on 3x3 because all twelve edges flip together), and the PLL parity case occurs when two edges are swapped without other changes (impossible on 3x3 because PLL is constrained by corner permutation parity). Both cases have to be solved with specialized algorithms that are 14 to 17 moves long and are slow compared to standard 3x3 last-layer algorithms. OLL parity occurs about half the time and PLL parity occurs about half the time independently, so a typical 4x4 solve has a 25 percent chance of "double parity" and a 25 percent chance of "no parity," with the remaining 50 percent split between the two single-parity cases.

Advanced 4x4 methods like Yau, Hoya, and Meyer try to interleave the reduction phases to save time. Yau, developed by Robert Yau, solves three centers first, then a partial 3x3 cross, then the remaining three centers, then edge pairing, then completes the 3x3 phase. The advantage of Yau is that the cross is built before edges are paired, which would normally be impossible but is enabled by using slice moves during edge pairing. Hoya, developed by Jong Ho-Jeong, solves four centers first, then edges, then the last two centers, then the 3x3 phase. Each of these methods has trade-offs in terms of move count, lookahead, and difficulty, and elite competitors typically pick one and stick with it for years.

Compared to 3x3, the 4x4 is much slower at the top level (sub-17 vs sub-4) and much more dependent on consistent execution over a 100+ move solve. The skill transfer from 3x3 to 4x4 is moderate to high: the 3x3 phase of a 4x4 solve is essentially a 3x3 solve, so any improvement on 3x3 directly translates into faster 4x4 solves. The reverse transfer (4x4 to 3x3) is much weaker: practicing centers and edges does not help with 3x3 solving in any direct way. A common pattern at the top of the sport is for a competitor to be strong at one event and weak at the other; Max Park is exceptional in that he holds top times at both. Hardware for 4x4 has evolved similarly to 3x3, with magnetic flagship cubes from MoYu, GAN, QiYi, and YJ all offering crisp performance. The standard size for competition 4x4 cubes is now 60-62mm, smaller than the original 65mm hardware that was standard in the early 2010s.

## 5x5x5: The Professor's Cube

The 5x5x5, often called the Professor's Cube after the marketing name used by Verdes Innovations and later Ideal, has been a WCA event since the founding of the organization in 2003. It has fixed centers like the 3x3 (the center facelet of each face does not move relative to the other center facelets), four wing edges per face, four T-center pieces around each fixed center, and the standard set of eight corners and twelve "true" edges. The state space is approximately 2.8 times 10 to the 74th power, which is so large that it dwarfs even the 4x4 state space by 28 orders of magnitude. The God's number is not known but lower bounds place it well above 40 and upper bounds from heuristic searches put it somewhere in the 70s; no human-feasible method comes close to optimal solving, and typical solutions are in the 120 to 200 move range.

The world record for 5x5 single is held by Max Park at a time under 32 seconds, with the average of five record also in the low 30s. The dominant method, as with 4x4, is reduction, but the reduction process is more involved because there are more pieces to handle. Centers on 5x5 consist of a fixed center, four T-centers, and four X-centers; the T-centers and X-centers have to be placed in the correct positions relative to the fixed center to preserve the correct color scheme. Edge pairing involves three wings per edge instead of two: each of the twelve edge positions has a "midge" (middle edge) flanked by two "wings" that have to be matched to it. Once the centers and edges are reduced, the puzzle becomes a 3x3 with no parity issues (because the 5x5 has an odd number of layers and the middle layer prevents the parity cases that plague the 4x4).

Methods like Yau5 and Hoya5 adapt the 4x4 methods to the 5x5 by interleaving cross building with center and edge work. Yau5 in particular has been refined by competitors like Feliks Zemdegs and Max Park to the point where it allows them to do a partial cross before all centers are finished, saving significant time. The challenge with 5x5 is that the edge pairing phase requires the solver to track three wings at once and choose pairing moves that avoid disturbing already-paired edges; this requires a much more developed lookahead skill than 4x4 edge pairing and is typically the rate-limiting step in fast 5x5 solving.

Notable 5x5 specialists include Justin Mallari, who has held world records on 5x5 average and who is widely regarded as one of the most consistent big-cube solvers in the sport. Mallari is an example of a "specialist" cuber who excels at one or two specific events without being elite on 3x3; his 3x3 times are competitive but not world-class, while his big cube times are at or near the world record level. This pattern is more common on the big cube events than on 3x3, where the depth of competition makes specialization less profitable; on 5x5 and especially 6x6 and 7x7, a competitor can be a top-ten or even top-three solver in the world without ever holding a sub-7 3x3 average.

The transfer from 3x3 to 5x5 is again moderate to high for the final 3x3 phase but much lower for the reduction phase. Many 3x3 cubers find that 5x5 is more frustrating than 4x4 because the larger puzzle is physically harder to manipulate and the reduction phase is longer and more cognitively demanding. The 5x5 is also the puzzle where pop-outs (pieces accidentally falling out of the cube during a solve) are most common, requiring competitors to either accept a small DNF risk or use slightly tighter tensions that slow turning. Modern flagship 5x5 hardware from MoYu, MGC, and other manufacturers has largely solved the pop problem, but the puzzle remains physically demanding.

## 6x6x6: The First Mass-Produced Larger Cube

The 6x6x6 has been a WCA event since 2009, when it was added along with 7x7 to the official event list. It is the first cube in the family that has no fixed centers (because 6 is even) but also no "true" midges (because there is no middle layer). The state space is approximately 1.6 times 10 to the 116th power, which is functionally infinite from a brute-force search perspective. The God's number is unknown and not even seriously estimated; all practical solutions are produced by reduction methods that generate solutions in the 250 to 400 move range.

The world record for 6x6 single sits in the low-to-mid one minute range, with Max Park holding the current record at a time around 65 seconds. The average of three (6x6 uses a mean-of-three format rather than the average-of-five used on smaller cubes, to reduce competition time per round) is also in the low 70 second range at the top level. Method-wise, 6x6 is solved by reduction with even more elaborate center-pairing and edge-pairing phases than 5x5. Each face has 16 center pieces that have to be grouped into four 2x2 blocks, each edge has four wings that have to be combined into a single edge pair, and there are parity cases that occur about half the time (the same OLL and PLL parities as on 4x4, because 6x6 also has an even number of layers).

Hardware for 6x6 has been a limiting factor on world records for years. The 6x6 puzzle has so many small pieces that manufacturing tolerances become critical: tiny variations in piece size, hub geometry, or tension settings can produce dramatically different turning feel. Modern flagship 6x6 hardware from MoYu (the MoYu Aochuang series), QiYi (the QiYi WuHua series), and YJ (the YJ MGC series) has converged on a 65-67mm puzzle size that balances finger reach against piece manipulability. The community has also developed specialized lubrication techniques for 6x6, often using thinner oils than would be used on a 3x3 to reduce friction on the many internal contact surfaces.

The transfer from 3x3 to 6x6 is similar to the transfer from 3x3 to 5x5: the 3x3 phase of the reduction transfers directly, the reduction phase has its own specific skill set, and most 3x3 cubers find 6x6 frustrating because of the long execution time and the difficulty of physical manipulation. Specialists who excel at 6x6 typically also excel at 7x7, and the same competitors tend to dominate both events. Kevin Hays, an American competitor who has held multiple big cube records, is a classic example: his 6x6 and 7x7 times have been world-class for years while his 3x3 times have been merely competitive.

## 7x7x7: The Largest WCA Cube

The 7x7x7 is the largest cube in the WCA's official event list and has been an event since 2009. It is similar to 5x5 in having fixed centers and "true" midges (because 7 is odd), but with two layers of T-centers and X-centers on each face and three wings per edge. The state space is approximately 1.95 times 10 to the 160th power, and the God's number is again unknown and probably uninteresting because no method comes close to it. Practical solutions take 300 to 500 moves and 2 to 5 minutes of human execution time.

The world record for 7x7 single is held by Max Park at a time around 1 minute 35 seconds, with the average of three also in the 1:40 to 1:45 range at the top level. The reduction method on 7x7 has the most elaborate center-pairing phase of any WCA event: each face has 25 center pieces (one fixed, four T-centers, four X-centers, eight outer T-centers, and eight outer X-centers) that have to be sorted into the correct positions. Edge pairing involves five pieces per edge (two outer wings, two inner wings, and one midge), and the pairing process is the longest single phase of the solve.

Hardware for 7x7 has historically been the most challenging of any cube to manufacture. The puzzle has so many pieces that internal contact surfaces multiply rapidly, making the turning feel highly sensitive to manufacturing tolerances. Early 7x7 puzzles from V-Cube, the company that originally developed the design, were widely considered to be of low quality, and the puzzle was almost unsolvable at competitive speed until the Chinese manufacturers like MoYu and QiYi released their own designs in the mid-2010s. Modern flagship 7x7 hardware from MoYu (the MoYu Aofu series) and QiYi (the QiYi WuJi series) has largely solved the manufacturing problems, and the world record times have come down accordingly.

A notable feature of competitive 7x7 is the extreme demand for stamina. A typical 7x7 solve takes 2 to 5 minutes of continuous turning, which is much more physically demanding than any other WCA event. Top competitors often train their wrists and forearms specifically for 7x7, and the event has more frequent retirements due to repetitive strain injuries than any other cube event. The community has developed various ergonomic techniques for managing this load, including specific cube tensions, rest positions, and breathing patterns during the solve.

The transfer from 7x7 to 3x3 is essentially zero in the speed-development sense; the puzzles are too different and the relevant skills (long-form pattern recognition, sustained manipulation, edge pairing) do not appear on 3x3. However, the discipline and consistency required to be elite at 7x7 do transfer in a more abstract sense, and many top 7x7 solvers report that the mental skills they developed for big cube events have helped them in other areas of speedcubing and even non-cubing pursuits.

## Megaminx: The Dodecahedral Puzzle

The Megaminx is a twelve-sided dodecahedral puzzle that has been a WCA event since 2005. It has twelve faces, each colored in one of twelve distinct colors (modern competition Megaminx hardware uses a standardized color scheme), with eleven layers of rotation rather than the six layers of a 3x3. Each face has five pentagonal pieces around the center, ten triangular edges connecting them, and a central pentagonal piece. The state space is approximately 1.0 times 10 to the 68th power, which sits between 4x4 and 5x5 in size. The God's number is not known but lower bounds place it above 40 and upper bounds in the 50s; practical methods produce solutions in the 70 to 90 move range.

The world record for Megaminx single is held by Juan Pablo Huanqui at a time under 27 seconds, with the average of five record also in the low 30s. Huanqui has dominated the Megaminx event for years and is widely regarded as the greatest Megaminx solver in history; his combination of fast turning, deep recognition, and consistent execution has been hard to match. Other notable Megaminx specialists include Yu Da-Hyun of South Korea and several European competitors who have been close to but not at the world record level.

The dominant method for Megaminx is a CFOP-adapted approach with significant differences. The "cross" on Megaminx is actually a five-color star: the solver builds a star on one face of the puzzle by solving the five edges adjacent to one center, in any of the five surrounding colors. The first two layers (F2L equivalent) on Megaminx involve solving the corner-edge pairs that flank each of the five surrounding faces, which is similar in spirit to 3x3 F2L but requires the solver to handle five F2L slots arranged radially instead of four in a square. The last layer on Megaminx has its own set of algorithms; the most common method is "4-look last layer" or "2-look last layer," with elite competitors using more advanced systems like "1-look LL" for the most common cases.

Megaminx is widely considered the closest WCA event to 3x3 in terms of solving theory, because both events use a CFOP-style approach with a cross, F2L pairs, and a last layer. The skill transfer between Megaminx and 3x3 is high in both directions: 3x3 cubers who pick up Megaminx can often reach intermediate times quickly, and Megaminx specialists often have competitive 3x3 times as well. The differences are in the details: Megaminx has more F2L slots, more last-layer cases, more pieces to track, and a slower execution speed because the larger puzzle is harder to manipulate.

Hardware for Megaminx has evolved significantly in the past decade. Early Megaminx puzzles from Mefferts were poorly manufactured and could not be turned quickly. The modern Megaminx market is dominated by Chinese manufacturers, with the YuXin Little Magic Megaminx and the QiYi Galaxy Megaminx being two of the most popular flagship models. Magnetic Megaminx hardware has become standard since around 2018, and the puzzles have become faster and more reliable. Some competitors prefer "stickerless" Megaminx (with each piece molded in its native color) while others prefer "stickered" versions for the slightly crisper visual contrast; the choice is largely personal preference.

A unique feature of Megaminx training is the importance of color recognition. Because the puzzle has twelve colors instead of six, the solver has to be able to distinguish all twelve colors quickly during inspection and during the solve. Competitors often spend significant time training their color recognition specifically for Megaminx, and some report that they perceive the colors differently after extended Megaminx practice. The standard Megaminx color scheme places contrasting colors on opposite faces to make recognition easier, but the difficulty of color discrimination remains a significant factor in elite Megaminx solving.

## Pyraminx: The Tetrahedral Puzzle

The Pyraminx is a four-sided tetrahedral puzzle that has been a WCA event since 2005. It has four triangular faces, each composed of nine triangular pieces arranged in three rows. The pieces include four "tips" at the corners (which can be rotated independently and are essentially free), four "axis" corners (which are fixed relative to each other), and six edges. The state space, ignoring the four free tips, is exactly 75,582 distinct positions, which is small enough that the entire state space fits in a few kilobytes of memory and can be solved optimally by lookup table in microseconds. With the tips included, the state space expands to 933,120 positions, still trivial by comparison to even the 2x2.

The God's number for Pyraminx (excluding tips) is exactly 11 in the half-turn metric and was proven by exhaustive search in the late 2000s. With tips included it is also 11 because the tips can be rotated in parallel with the main puzzle turning. Practical methods produce solutions in the 8 to 11 move range, which is essentially optimal because the diameter is so small.

The world record for Pyraminx single sits in the low half-second range. As of recent updates, the official world record was held by Dominik Górny at 0.91 seconds, with multiple competitors having recorded sub-1 second singles and sub-1.5 second averages. The average of five world record is around 1.5 seconds, with the top competitors trading positions in the 1.40 to 1.60 range. Pyraminx is the event where single-solve records are most influenced by luck, even more so than 2x2: a favorable scramble can be solved in two algorithms and require essentially zero recognition time, while an unfavorable scramble might require three or four algorithms and twice as long.

The dominant solving methods are L4E (Last 4 Edges) and Keyhole. L4E is the most popular method at the top level and works by solving one tip, the three adjacent axis corners, and two of the edges, then using a small set of algorithms to solve the last four edges in one step. The full L4E set has about 35 algorithms but the most common cases can be one-looked in under 200 milliseconds. Keyhole is an older method that solves the puzzle by treating one edge as a "key" and using it to set up other moves; it is less efficient than L4E but easier to learn. Some specialists also use methods like OKA and WO that are variations on the same theme.

Pyraminx is the WCA event with the smallest skill transfer to 3x3. The puzzle has its own algorithmic vocabulary, its own move notation, and its own recognition system, and none of those things appears on the 3x3 in any direct form. A Pyraminx specialist who has never touched a 3x3 will not be able to solve one without learning a completely new method, and a 3x3 expert who picks up a Pyraminx cold will struggle to reach competitive times without dedicated practice. The main transferable skills are general inspection planning and fast execution, which transfer across all puzzle events to some degree.

Hardware for Pyraminx has evolved similarly to other puzzles. The original Mefferts Pyraminx was a slow puzzle that pop spontaneously; modern flagship Pyraminx hardware from QiYi (the QiYi X-Man Bell series), MoYu (the MoYu Magnetic series), and ShengShou (the ShengShou Mr. M series) is fast, stable, and supports the kind of explosive turning needed for sub-2 second solves. Magnetic Pyraminx hardware has become standard since around 2018, and the puzzles are now small enough and light enough to be held entirely between the thumb and two fingers for ultra-fast execution.

## Square-1: The Shape-Shifting Puzzle

The Square-1 is a shape-changing puzzle that has been a WCA event since 2007. It has three layers like a 3x3 but the pieces in the top and bottom layers can rotate freely between corner-shaped and edge-shaped positions, which means the puzzle can take on dozens of different shapes depending on how the layers are arranged. The state space is approximately 6.3 times 10 to the 17th power if we count distinguishable physical positions, smaller than the 3x3 but still vast compared to puzzles like Pyraminx. The God's number is not known but is believed to be around 30-35 moves.

The world record for Square-1 single is around 4 seconds, with the average of five record around 5 seconds. The current record holders include Vicenzo Guerino Cecchini, Eduard Khanin, and Martin Vædele Egdal, who have traded the records back and forth in recent years. Square-1 is an event where method choice has a large effect on performance because the dominant methods have very different move counts.

The dominant solving method is Vandenbergh, named for Lars Vandenbergh, who developed the original algorithm sheets in the early 2000s. Vandenbergh proceeds in three phases: first, the solver "cubeshapes" the puzzle by turning it into a recognizable cube shape (there are about 14 distinct cube shapes that can appear after a scramble), then orients the corners and edges in one or two looks, then permutes them in one or two looks. Advanced solvers use "CSP" (Cubeshape Parity) techniques to handle the parity case that arises in about half of solves, and the very top competitors use "1-look EP" (Edge Permutation in one look) to save time at the end of the solve.

Square-1 is widely considered the most "different" WCA event in terms of solving theory. The puzzle has its own move notation (different from cube notation), its own algorithmic vocabulary, and its own recognition system based on shape and color simultaneously. The skill transfer between Square-1 and 3x3 is almost zero in either direction: a 3x3 expert who picks up a Square-1 cold will need months of dedicated practice to reach competitive times, and a Square-1 specialist who has never solved a 3x3 will not be able to do so without learning a new method.

Square-1 specialists tend to be among the most dedicated members of the speedcubing community because the puzzle rewards long hours of memorization and recognition practice with relatively little payoff in terms of skill transfer. The community has developed an extensive ecosystem of algorithm trainers, recognition tools, and tutorial videos specifically for Square-1, and the event has a smaller but more passionate following than most other events.

Hardware for Square-1 has been particularly challenging to manufacture because of the unusual geometry. Early Square-1 puzzles from Verdes Innovations and Calvin's were slow and unreliable, and the puzzle did not become viable for serious speedcubing until the early 2010s when MF8 and later Chinese manufacturers released magnetic flagship models. Modern Square-1 hardware from MoYu (the MoYu Volt series) and QiYi (the QiYi X-Man Volt series) is fast, stable, and supports the explosive turning needed for sub-5 second solves.

## Skewb: The Vertex-Turning Puzzle

The Skewb is a corner-turning puzzle that has been a WCA event since 2014, making it one of the most recently added events to the WCA list. It has six square faces and eight vertex-turning axes, which means each move rotates one of the four vertices on one side of the puzzle (the eight vertices come in two sets of four that are connected by the puzzle's structure). The state space is exactly 3,149,280 distinct positions, smaller than the 2x2 but larger than the Pyraminx (excluding tips). The God's number for Skewb is exactly 11 in the half-turn metric.

The world record for Skewb single is around 0.8 seconds, with the average of five record around 1.6 seconds. Łukasz Burliga and Andrew Huang have traded records back and forth in recent years, with multiple competitors having recorded sub-1.5 second averages. Skewb is another event where single-solve records are heavily luck-influenced because a favorable scramble can be solved in two algorithms.

The dominant solving methods are Sarah, Rubiks Skewb (sometimes called the Beginners Method), and Kirjava. Sarah is the most popular method at the top level and was developed by Sarah Strong; it works by solving one face, then orienting the corners on the opposite face, then permuting them. The full Sarah set has about 16 algorithms and can produce sub-2 second averages. Kirjava is a more advanced method developed by Jaap Scherphuis that uses different first-step heuristics to reduce the move count; it has a steeper learning curve but produces faster averages for those willing to learn it. Rubiks Skewb is an entry-level method that is rarely used at the top level.

Skewb has minimal skill transfer to 3x3, similar to Pyraminx. The puzzle has its own algorithmic vocabulary and its own solving theory, and the transferable skills are limited to general execution speed and inspection planning. Skewb specialists are often also Pyraminx specialists because both puzzles reward similar skills (fast pattern recognition, short algorithms, low move counts), and the community has significant overlap between the two events.

Hardware for Skewb has evolved similarly to other puzzles. The original Mefferts Skewb was a slow puzzle that did not turn well; modern flagship Skewb hardware from MoYu (the MoYu Magnetic series), QiYi (the QiYi X-Man Wingy series), and YJ (the YJ MGC series) is fast and stable. Magnetic Skewb hardware has become standard, and the puzzles are now small enough to be held between two fingers for ultra-fast execution.

## Clock: The Pin-and-Dial Puzzle

The Rubik's Clock is unlike any other WCA event in that it does not involve turning a cube. The puzzle consists of nine clock faces arranged in a 3x3 grid on each side of a small flat case, with twelve pins around the edges of the case and a small wheel on each corner. Turning a wheel adjusts the time shown on a subset of the nine clock faces; pushing a pin in or out switches which subset of faces is affected. The goal is to set all eighteen clock faces (nine on each side) to 12:00. The state space is exactly 12 to the 14th power divided by 2, which is approximately 6.0 times 10 to the 14th power, smaller than the 3x3 but larger than the 2x2 and Skewb.

The Clock has been a WCA event since 2007. The world record for Clock single is around 2.6 seconds, with the average of five record around 3.7 seconds. The current record holders include Yunhao Lou and Suen Ming Chi, who have traded records back and forth in recent years. Clock is widely considered the most "specialized" WCA event because the puzzle is so different from the rest of the cubing world that almost no skills transfer from other events.

The dominant solving method is a variant of "all-in-one" that pre-computes the optimal pin and wheel sequence for each scramble. There are several variations including the Flip and SCC methods, and elite solvers customize their approach based on personal preference. The full method involves recognizing the clock positions, planning the optimal sequence of wheel turns and pin flips, and executing the solution as quickly as possible.

Clock has essentially zero skill transfer to 3x3 or any other cube event because the physical and mental skills are completely different. Clock specialists are a tight-knit community within the broader cubing world and are often the only competitors at smaller competitions who can solve the puzzle at all. The event has a small but passionate following and has produced some of the most consistent competitors in the sport; the very top Clock solvers can produce sub-4 second averages with remarkable reliability.

Hardware for Clock has been a major limiting factor on world records. The original Rubik's Clock was a poorly manufactured puzzle that did not turn smoothly and was prone to mechanical failure. Modern flagship Clock hardware from QiYi (the QiYi Magnetic Clock) and LingAo (the LingAo Magnetic Clock) has largely solved the manufacturing problems, with magnetic pin positioning and smooth wheel turning enabling sub-3 second solves.

## Master Pyraminx: The Four-Layer Tetrahedron

The Master Pyraminx is a four-layer version of the Pyraminx with significantly more pieces and a much larger state space. It is not currently a WCA event but has been discussed as a possible future addition; the WCA has historically been conservative about adding new events, and the Master Pyraminx has not made the cut despite years of community interest. The state space is approximately 2.17 times 10 to the 17th power, much larger than the standard Pyraminx, and the puzzle requires methods that are substantially more involved than L4E.

In the broader twisty puzzle community, Master Pyraminx is solved using methods that adapt the 4x4 reduction approach to the tetrahedral geometry. The solver builds up the centers, pairs the edges, and then solves the resulting Pyraminx-like state using a standard method. World "unofficial" times for Master Pyraminx have come down to the 20-30 second range for top competitors, and the puzzle has a small but dedicated following.

The puzzle is sometimes considered a "stepping stone" to even larger Pyraminx variants (5-layer, 6-layer) that exist as commissioned custom puzzles but have not seen mass production. The community of large-Pyraminx solvers overlaps significantly with the community of big-cube solvers, and many of the same competitors who excel at 6x6 and 7x7 also enjoy Master Pyraminx.

## Square-2 and Other Square-1 Variants

The Square-2 is a variation of the Square-1 with extra slices that increase the puzzle's complexity. It is not a WCA event and has not been seriously considered for inclusion. The puzzle has a larger state space than Square-1 and requires methods that adapt the Vandenbergh approach to the new geometry. The community of Square-2 solvers is small but dedicated, and the puzzle has produced some impressive unofficial solving times.

Other Square-1 variants include the Square-3 (with even more slices) and various asymmetric Square-1 designs that have been produced as custom puzzles. These puzzles are popular with collectors and a small group of dedicated solvers but have not seen mainstream adoption in the WCA community.

## Mirror Cube: The 3x3 with Different Sizes

The Mirror Cube is a 3x3 puzzle in which the pieces have different sizes instead of different colors. All facelets are typically a single reflective color (often silver or gold), and the puzzle is solved by getting all the pieces back to a recognizable cube shape rather than by matching colors. It is not a WCA event and is unlikely to ever become one because the solving experience is too similar to a standard 3x3 to justify a separate competition.

The state space of the Mirror Cube is mathematically identical to the 3x3 because the puzzle has the same group structure; only the visualization changes. Solving a Mirror Cube uses the same algorithms as a 3x3, with the recognition based on piece shape rather than color. The puzzle is popular as a display piece and a casual challenge but does not have a serious competitive following.

A related variant is the "Ghost Cube" by Adam G. Cowan, which is a 3x3 with pieces of different shapes arranged in a more elaborate pattern. Ghost cubes are popular as art pieces and as custom commissions but have not seen mass production at scale. The "Mastermorphix" is another variant in which the 3x3 has been reshaped into a tetrahedron, with the pieces having different sizes and shapes to fit the tetrahedral form. None of these variants is a WCA event, but all of them are popular in the broader twisty puzzle community.

## Bandaged Cubes and Other Non-WCA Puzzles

Bandaged cubes are 3x3 (or larger) puzzles in which some pieces have been glued together to constrain the moves that can be made. The bandaging creates puzzles that have very different solving characteristics from standard cubes; some bandaged cubes can be solved with a few simple algorithms, while others are nearly as difficult as the original puzzle but with a completely different set of moves available. None of the bandaged cube variants is a WCA event.

The most famous bandaged cube is the "Bandaged 3x3," in which a single pair of pieces has been glued together to create a puzzle that cannot be solved by a standard 3x3 method. The puzzle has a small but dedicated community of solvers who have developed methods specifically for the bandaging pattern.

Other non-WCA puzzles include the Gear Cube (a 3x3-like puzzle in which the layers are connected by gears that force them to turn simultaneously), the Axis Cube (a 3x3 with the axes shifted to different positions), and dozens of other variations on the basic cube concept. Each of these puzzles has its own community of solvers and its own solving methods, but none has made the cut for WCA inclusion.

## Gear Cubes and Mechanism-Based Puzzles

Gear cubes are a class of puzzles in which the layers are connected by gears that force the moves to follow a specific pattern. The original Gear Cube, designed by Oskar van Deventer, is a 3x3-like puzzle in which turning any face causes the adjacent faces to turn at half speed; this means the moves are highly constrained and the puzzle has a very different solving character from a standard 3x3.

The Gear Cube has a small but dedicated community of solvers and has produced some impressive solving times in unofficial competitions. The puzzle's state space is smaller than a 3x3 because the geared connections eliminate many of the move sequences that would be possible on a standard cube, but the solving methods are very different from anything in the WCA cubing world.

Other gear-based puzzles include the Gear Mixup (a Gear Cube with the centers swapped to different positions), the Gear Pyramid (a tetrahedral gear puzzle), and various custom gear puzzles that have been produced by puzzle designers like van Deventer and Tony Fisher. None of these puzzles is a WCA event, but all of them are popular with collectors and a small group of dedicated solvers.

## The Hierarchy of WCA Events

The WCA's seventeen events do not all receive equal attention from competitors or from the community. The 3x3 is the dominant event at almost every level: it has the most competitors registered at competitions, the most spectator attention, the most media coverage, the most algorithm sheets, the most YouTube tutorials, and the most dedicated training resources. The 2x2, 4x4, 5x5, 6x6, and 7x7 events form a secondary tier of "speed" events that get significant attention but less than the 3x3. The Megaminx, Pyraminx, Square-1, Skewb, and Clock events form a tertiary tier of "non-cube speed" events that have smaller but passionate communities. The 3x3 OH, 3x3 Blindfolded, 4x4 Blindfolded, 5x5 Blindfolded, Multi-Blind, and Fewest Moves events form a separate tier of "specialty" events that share the 3x3 puzzle but require completely different skills.

Within this hierarchy, individual competitors typically focus on a subset of events based on personal preference and skill. The most extreme specialists focus on a single event and barely compete in others; Stanley Chapel is widely regarded as the greatest Multi-Blind solver in history but rarely competes in other events, and Justin Mallari is similarly focused on 5x5 and big cube events. The "all-rounder" competitors compete in many events and try to be reasonably strong in all of them; Feliks Zemdegs is the classic all-rounder, having held world records in multiple events including 3x3, 4x4, 5x5, and 6x6 at various points in his career. Max Park is another notable all-rounder, currently holding world records in 3x3, 4x4, 5x5, 6x6, and 7x7 simultaneously.

The all-rounder vs specialist dichotomy is one of the most interesting tensions in modern speedcubing. The all-rounder has to spread training time across many events, which means they cannot achieve the same depth of mastery as a specialist in any single event. The specialist can achieve unmatched depth in their chosen event but lacks the breadth that gives all-rounders their place in the sport's pantheon. The community has historically celebrated both types of competitors, but the public spotlight tends to focus on the all-rounders because their multi-event dominance is easier to communicate to casual observers.

## Event Retirement: 3x3 With Feet

The 3x3 With Feet event was a WCA event from 2004 to 2020 in which competitors solved a 3x3 cube using only their feet, with the cube placed on a mat in front of them. The event was retired in 2020 due to a combination of factors: low participation rates compared to other events, concerns about long-term effects on competitors' feet and joints, the difficulty of providing appropriate venues and equipment, and a general sense in the community that the event had stopped being culturally important.

The world record for 3x3 With Feet at the time of retirement was around 15 seconds, held by Daniel Rose-Levine of the United States. Rose-Levine was the dominant competitor in the event during its final years and is widely regarded as the greatest With Feet solver in history. The event had produced some impressive performances over its lifetime, but the overall trend in the community was toward retirement rather than continued development.

The retirement of 3x3 With Feet was controversial in some quarters of the community, with some competitors arguing that the event was a unique part of the sport's identity and others arguing that the resources spent on it could be better used elsewhere. The decision was made by the WCA's Board of Directors after extensive consultation with the community, and the event has not been seriously discussed for reinstatement since.

## Possible Future Events

The WCA has historically been conservative about adding new events, with the most recent additions being Skewb in 2014 and the formalization of the multi-blind format in the early 2010s. Several events have been discussed as possible future additions, including:

- **8x8x8 and larger cubes**: There is community interest in adding even larger cubes to the WCA event list, but the difficulty of manufacturing high-quality 8x8 or 9x9 hardware has been a significant barrier. As manufacturers like MoYu and QiYi continue to improve their large cube designs, the addition of 8x8 may become feasible in the next several years.

- **Master Pyraminx**: As discussed above, the Master Pyraminx has been discussed as a possible WCA event but has not been added.

- **Multi-color cube**: A cube with each piece a unique color (rather than the standard six-color scheme) has been discussed as a way to test recognition skills more rigorously. The puzzle would be functionally identical to a standard 3x3 but would require much more complex inspection.

- **Square-2 and other Square-1 variants**: Various Square-1 variants have been discussed but none has been seriously considered for addition.

- **Mirror cube events**: The Mirror Cube has been discussed as a possible event but the similarity to standard 3x3 has been a barrier.

None of these proposed events is expected to be added in the immediate future, but the WCA continues to consider new ideas as the community evolves. The decision to add or remove events is made by the WCA Board of Directors based on input from the community, the technical feasibility of running the event at competitions, and the overall direction of the sport.

## The 3x3 Dominance: Why It Persists

Despite the variety of WCA events, the 3x3 remains the dominant event by a wide margin. There are several reasons for this dominance, some practical and some cultural. Practically, the 3x3 is the smallest cube that produces a non-trivial state space, which means it is the puzzle that has been most thoroughly studied by mathematicians and the puzzle for which the best algorithms have been developed. It is also the most affordable puzzle to buy in large quantities, the most portable puzzle to carry to competitions, and the puzzle for which the most online resources are available.

Culturally, the 3x3 has been the public face of the speedcubing community since the original Rubik's Cube craze of the early 1980s. The puzzle is recognizable to almost everyone in the developed world, even people who have never solved one, and it has appeared in countless movies, television shows, and pop culture references. This cultural prominence makes the 3x3 the easiest event to explain to casual observers and the easiest event to attract new competitors to.

The 3x3 also benefits from a positive feedback loop in terms of training resources. Because more competitors compete in 3x3 than in any other event, there are more algorithm sheets, more tutorial videos, more example solves, and more training tools for the 3x3 than for any other event. This makes it easier for new competitors to improve at 3x3 than at any other event, which means more new competitors gravitate toward 3x3, which produces more training resources, and so on.

Top times on 3x3 are also constrained by physical reaction speed rather than algorithm execution time, which makes the event particularly compelling to watch. A sub-5 3x3 solve is essentially a demonstration of human cognitive speed at the limits of what is physically possible, and the visual spectacle of the cube being solved in front of the audience is uniquely engaging. Other events have their own visual appeal, but none is quite as immediate as the 3x3.

## Custom Cubes and Twisty Puzzle Engineering

Beyond the WCA event list, the broader twisty puzzle community includes a vast array of custom cubes that have been designed by individual puzzle makers, commissioned by collectors, or produced in small batches by specialty manufacturers. These puzzles range from simple variations on standard cube designs to elaborate sculptural objects that push the boundaries of what is mechanically possible.

Tony Fisher of the United Kingdom is one of the most prolific custom cube designers in history. His designs include the Fisher Cube (a 3x3 with the centers rotated 45 degrees), the Golden Cube (a 3x3 with golden facelets), and dozens of other puzzles that have become collector's items. Fisher is also the holder of the Guinness World Record for the smallest 3x3 cube, a tiny puzzle measuring less than 10mm on each side that he hand-built in the early 2010s.

At the other extreme, the world's largest 3x3 cubes have been produced as art pieces and as challenges to manufacturing. The current record for the largest 3x3 is held by a cube measuring over 2 meters on each side, built by a Chinese puzzle maker as a marketing demonstration. Such large cubes are essentially unsolvable in the traditional sense because the pieces are too heavy and too large to manipulate, but they exist as proof that the cube concept can scale to nearly any size.

The current record for the largest NxN cube that is actually solvable is held by a 22x22x22 cube manufactured by Coren Puzzles. The puzzle has 7,260 individual stickers and a state space so vast that no estimate of the God's number is meaningful; it is solvable only by extreme dedication and patience and is treated more as an engineering feat than as a serious solving challenge. The current production NxN cubes from MoYu, QiYi, and other major manufacturers cap out at 17x17, with the MoYu Aohun 17x17 being the most popular flagship for large cube enthusiasts.

The community of custom cube collectors overlaps significantly with the community of speedcubers but has its own distinct culture. Collectors often pay hundreds or thousands of dollars for rare custom puzzles, and the secondary market for vintage and custom cubes has its own auction houses, online marketplaces, and price-tracking websites. Some custom puzzles have appreciated significantly in value over time; an original Mefferts Megaminx from the early 1980s, for example, can sell for several hundred dollars in good condition.

## Twisty Puzzle Art and Engineering

Beyond the functional puzzles, twisty puzzles have inspired a substantial body of art and engineering work. Puzzle artists have used cubes as sculptural elements, as components in larger installations, and as inspiration for non-puzzle artworks. The mathematical structure of the cube, with its 43 quintillion states and elegant group theory, has been the subject of academic papers, mathematical exhibits, and educational outreach programs around the world.

Engineering work on twisty puzzles has produced some of the most impressive mechanical designs in modern toy manufacturing. The internal mechanism of a modern flagship 3x3 cube involves dozens of precisely engineered parts that work together to produce smooth turning, corner cutting, and pop resistance. The development of magnetic positioning systems in the late 2010s revolutionized the hardware market and enabled cube designs that are now standard across all major manufacturers.

Some of the most innovative engineering work has come from designers like Oskar van Deventer, Tony Fisher, Adam G. Cowan, and a small group of others who have produced puzzles that push the boundaries of what is mechanically possible. Van Deventer's "Over the Top" 17x17 cube, designed in 2009 and produced in a limited run, was the first commercially available NxN cube larger than 11x11 and demonstrated that very large cubes could be both manufactured and solved.

The art and engineering aspects of twisty puzzles have also produced significant academic interest. The Cube Lovers mailing list, which operated from the early 1980s to the early 2000s, was one of the earliest online communities devoted to mathematical study of the cube and produced many of the foundational insights that still inform modern speedcubing methods. Academic papers on cube mathematics have appeared in journals like the Mathematical Intelligencer and the American Mathematical Monthly, and the puzzle has been the subject of multiple PhD dissertations.

## Transfer Effects: A Detailed Look

The question of skill transfer between events is one of the most discussed topics in modern speedcubing. The transfer matrix is complex and depends on many factors including the puzzles being compared, the specific skills being transferred, and the level of expertise of the competitor.

At the broadest level, the transfers can be categorized as follows:

- **High transfer (2x2, Megaminx)**: These puzzles share significant solving theory with the 3x3 and a 3x3 cuber can typically reach intermediate times on them quickly. The transfer goes in both directions: 2x2 and Megaminx specialists often have competitive 3x3 times.

- **Medium transfer (4x4, 5x5, 6x6, 7x7)**: These puzzles have a 3x3 phase that transfers directly from 3x3 skill, but they also have a reduction phase that has no analogue on the 3x3. The transfer is asymmetric: 3x3 skill helps big cubes more than big cubes help 3x3.

- **Low transfer (Pyraminx, Skewb, Square-1, Clock)**: These puzzles have their own solving theory and minimal overlap with the 3x3. The transfer is essentially zero in either direction; specialists in these events are often not strong at 3x3, and 3x3 experts often struggle with these events.

- **Specialty events (BLD, OH, FMC)**: These events use the 3x3 puzzle but require completely different skills. The transfer is more nuanced: standard 3x3 skill helps somewhat (especially for OH), but the specialty skills (memorization for BLD, planning for FMC, asymmetric fingertrick development for OH) are largely independent.

Understanding these transfers helps both individual competitors plan their training and the community as a whole understand the structure of the sport. A competitor who wants to maximize their overall WCA ranking would focus on events with high transfer to each other; a competitor who wants to be the best in the world at a single event would focus on that event alone.

## The Specialist Phenomenon

One of the most interesting cultural phenomena in modern speedcubing is the emergence of "specialists" who excel at a single event without being elite at the rest. The specialist phenomenon has become more pronounced as the sport has matured and as the depth of competition has increased.

Stanley Chapel is perhaps the most famous specialist in modern cubing. He has held the world record in Multi-Blind for years and is widely regarded as the greatest Multi-Blind solver in history. His Multi-Blind results have included successfully solving over 60 cubes blindfolded in under an hour, a feat that demonstrates a memory architecture that few other humans possess. Yet Chapel's results in other events are merely competitive; he is not in the top 100 in the world for any other event, despite being unquestionably the best Multi-Blind solver in history.

Juan Pablo Huanqui is the dominant Megaminx specialist of his generation. He has held world records in both Megaminx single and average for years and has produced some of the most impressive Megaminx solves in history. His 3x3 times are good but not world-class, and he rarely competes in other events. The Megaminx community has built much of its culture around Huanqui's dominance, and many Megaminx specialists train with the explicit goal of approaching his level.

Daniel Rose-Levine was the dominant 3x3 With Feet specialist before the event was retired. He held the world record at the time of retirement and was widely regarded as the greatest With Feet solver in history. His other event results were competitive but not exceptional, and his career was defined almost entirely by his Feet expertise.

These specialists represent one extreme of the competitive spectrum. At the other extreme are all-rounders like Feliks Zemdegs and Max Park who compete in many events and excel at most of them. The two extremes coexist in modern competitions, with each type of competitor contributing to the diversity of the sport.

## Multi-Event Ao5 vs Single-Event Focus

A related question is whether a competitor should aim for breadth (competing in many events with good but not elite times) or depth (focusing on one or two events with world-class times). The answer depends on the competitor's goals and the structure of competitions they care about.

Breadth competitors benefit from competitions that award overall rankings or that calculate "Sum of Single Times" or similar multi-event metrics. These competitions reward the all-rounder who can produce good times across many events, even if they are not world-class in any single event. The historical precedent for breadth competition includes the original Rubik's World Championship in 1982, which awarded the title to the competitor with the fastest single 3x3 solve but also tracked performance across multiple events.

Depth competitors benefit from competitions that focus on a single event or that award separate rankings for each event. These competitions reward the specialist who can produce world-class times in their chosen event, regardless of their performance in other events. Most modern WCA competitions follow this model, with separate rankings for each event and no overall ranking that combines them.

The community has gone through cycles of preference for breadth vs depth over the years. In the early 2010s, breadth was generally favored because the sport was small enough that an all-rounder could compete in every event at most competitions. As the sport has grown and the depth of competition has increased, depth has become more favored because it is the only way to actually win world records or top international competitions. The current era is characterized by a mix of both types of competitors, with the most famous cubers tending to be either extreme all-rounders (Feliks Zemdegs) or extreme specialists (Stanley Chapel).

## Hardware Evolution Across Events

The hardware market has evolved differently for different events, with some events benefiting from rapid improvement and others stuck with older designs. The 3x3 market is by far the most competitive, with multiple manufacturers releasing new flagship models every year and prices generally falling over time. The 4x4 and 5x5 markets are also competitive, with similar release cycles but slightly higher prices.

The 6x6 and 7x7 markets are smaller and slower to evolve. Manufacturing high-quality large cubes is technically challenging and economically risky because the customer base is smaller. The current generation of flagship 6x6 and 7x7 cubes from MoYu and QiYi represents a major improvement over the previous generation but remains less polished than the corresponding 3x3 and 4x4 cubes.

The Megaminx market has improved dramatically in the past decade. The current flagship Megaminx cubes from MoYu, QiYi, and YuXin are dramatically better than the early Mefferts puzzles, with magnetic positioning, adjustable tensions, and smooth turning. The Pyraminx and Skewb markets have also improved significantly, with multiple manufacturers competing at similar quality levels.

The Square-1 and Clock markets are smaller but have produced some excellent recent releases. The QiYi Magnetic Volt Square-1 and the QiYi Magnetic Clock are widely regarded as the best models currently available for their respective events, and both have enabled new world records in the past few years.

The overall trend across all events is toward magnetic positioning, smaller form factors, and crisper turning. The introduction of magnets to cube hardware in the mid-2010s was the most significant single change in cube design since the original Rubik's Cube, and it has now spread to essentially every WCA event. The next major hardware innovation may be customizable magnet strength (already available in some flagship cubes) or active feedback systems that detect and respond to solver actions in real time.

## Notable Competitors Across Events

The history of speedcubing is filled with notable competitors who have made their mark on one or more events. Some of the most influential include:

- **Feliks Zemdegs** (Australia): One of the most dominant all-rounders in cubing history. Held world records in 3x3, 4x4, 5x5, 6x6, and 7x7 at various points in his career. Largely defined the modern era of speedcubing through his combination of fast turning, smooth execution, and consistent performance.

- **Max Park** (United States): Current world record holder in 3x3, 4x4, 5x5, 6x6, and 7x7 simultaneously. The first competitor to hold all five major cube records at once and one of the most physically gifted cubers in history. Has been particularly dominant on the larger cubes where his consistent execution stands out.

- **Yusheng Du** (China): Held the 3x3 single world record at 3.47 seconds for several years before it was broken in 2023. His record was iconic in the community for its longevity and for being set at a relatively small competition.

- **Tymon Kolasinski** (Poland): Current 3x3 single world record holder and one of the most dominant 3x3 solvers of the current era. Known for his explosive turning style and his strong performance under pressure.

- **Yiheng Wang** (China): Multiple-time world record holder in 3x3 average and one of the most consistent 3x3 solvers in history. Has set multiple world records before age 13 and is widely regarded as the most talented young cuber in the sport.

- **Juan Pablo Huanqui** (Peru): Dominant Megaminx specialist who has held both single and average world records for years.

- **Stanley Chapel** (United States): Greatest Multi-Blind solver in history, with multiple world records and an unmatched record of consistent performance.

- **Justin Mallari** (Philippines/United States): Dominant 5x5 and 6x6 specialist with multiple world records.

- **Daniel Rose-Levine** (United States): Held the 3x3 With Feet world record at the time of the event's retirement.

- **Dominik Górny** (Poland): Multiple-time Pyraminx world record holder.

- **Łukasz Burliga** (Poland): Multiple-time Skewb world record holder.

- **Vicenzo Guerino Cecchini** (Brazil): Multiple-time Square-1 world record holder.

- **Yunhao Lou** (China): Multiple-time Clock world record holder.

These competitors are just a small sample of the many talented cubers who have shaped the sport. The depth of competition in modern speedcubing means that world records are broken regularly and the list of record holders changes frequently.

## The Community Structure of Each Event

Each WCA event has its own community structure, with its own forums, training resources, and cultural traditions. The 3x3 community is by far the largest and most diverse, with multiple subcommunities organized around different methods, regions, and competitive levels. The 2x2 community is smaller and more tightly knit, with most active members knowing each other personally. The big cube communities (4x4 through 7x7) overlap significantly, with many of the same competitors active in multiple events.

The Megaminx community has its own distinct culture, partly because of the dominance of Juan Pablo Huanqui and partly because the puzzle requires its own specialized training resources. The Pyraminx and Skewb communities overlap significantly, with many competitors active in both events. The Square-1 community is small but passionate, with extensive online resources and a strong tradition of method development. The Clock community is the smallest of the WCA event communities and has historically struggled to attract new competitors.

The BLD and Multi-Blind communities have their own unique culture, organized around memorization techniques, letter pair systems, and the unique challenges of blindfolded solving. The FMC community is similarly distinct, with its own forums, training tools, and culture of analytical solving.

Each of these communities has its own annual gatherings, online presence, and cultural traditions. The cross-pollination between communities is significant, with many competitors active in multiple communities, but each community maintains its own identity and its own traditions.

## Final Thoughts: The Diversity of the Sport

The variety of WCA events and the broader twisty puzzle world represents one of the most interesting features of modern speedcubing. The sport has space for extreme specialists who focus their entire competitive career on a single event, for all-rounders who try to be reasonably strong in everything, for casual competitors who participate in whatever events are available at local competitions, and for collectors and engineers who push the boundaries of what is mechanically possible.

The 3x3 will likely remain the dominant event for the foreseeable future, but the other events provide important alternatives that keep the sport diverse and interesting. The development of new methods, new hardware, and new training resources across all events ensures that there is always something new to learn and always a new challenge to take on. Whether a competitor's goal is to set a world record, to win their local competition, to learn a new event, or simply to enjoy the meditative process of solving a puzzle, the WCA event list has something to offer.

For 3x3 cubers specifically, the related puzzles provide a way to expand their skills, explore new methods, and connect with different parts of the community. Whether the transfer from another event to 3x3 is high (as with Megaminx) or low (as with Clock), the experience of learning a new puzzle is valuable in itself and contributes to the overall depth of skill that defines an expert cuber.

The future of the sport will be shaped by the continued evolution of all of these events, by the addition or retirement of events at the WCA level, and by the broader cultural changes in the cubing community. The 3x3 will remain at the center of attention, but the diversity of related puzzles will continue to provide alternatives, challenges, and opportunities for competitors at every level. The next decade of speedcubing will likely see continued world record progress on the 3x3 alongside parallel developments on all the other events, and the sport as a whole will be richer for that diversity.

## Appendix: State Space Sizes Compared

For mathematical reference, here is a comparison of the state space sizes of the major WCA puzzles:

- **Pyraminx (without tips)**: 75,582 states. Smallest state space of any WCA event.
- **Pyraminx (with tips)**: 933,120 states.
- **Skewb**: 3,149,280 states.
- **2x2x2**: 3,674,160 states.
- **Clock**: approximately 6.0 × 10^14 states.
- **Square-1**: approximately 6.3 × 10^17 states.
- **3x3x3**: approximately 4.3 × 10^19 states.
- **Megaminx**: approximately 1.0 × 10^68 states.
- **4x4x4**: approximately 7.4 × 10^45 states.
- **5x5x5**: approximately 2.8 × 10^74 states.
- **6x6x6**: approximately 1.6 × 10^116 states.
- **7x7x7**: approximately 1.95 × 10^160 states.

The range from Pyraminx to 7x7 spans more than 155 orders of magnitude, which reflects the extreme diversity of the puzzles in the WCA event list. The 3x3, despite being the most popular event, has a state space that is enormously larger than the smallest puzzles and enormously smaller than the largest. Its position in the middle of the state space spectrum is part of what makes it such a compelling event: large enough to be deeply challenging, small enough to be thoroughly understood.

## Appendix: God's Numbers Compared

For events where the God's number is known or estimated:

- **Pyraminx**: God's number is 11 (proven).
- **Skewb**: God's number is 11 (proven).
- **2x2x2**: God's number is 11 (proven, in half-turn metric).
- **3x3x3**: God's number is 20 (proven, in half-turn metric).
- **4x4x4**: God's number is unknown; lower bounds suggest at least 35, upper bounds suggest less than 45.
- **5x5x5**: God's number is unknown; lower bounds suggest at least 45, upper bounds suggest less than 75.
- **Square-1**: God's number is unknown; estimates suggest around 30-35.
- **Megaminx**: God's number is unknown; lower bounds suggest at least 40, upper bounds suggest around 55.
- **Clock**: God's number is unknown but believed to be around 12.

The proof of the 3x3's God's number of 20 in 2010 by Tomas Rokicki and collaborators was a landmark achievement in computational mathematics. It required the equivalent of about 35 years of CPU time on a single modern processor, distributed across thousands of computers via cloud computing. The proofs for smaller puzzles are correspondingly simpler, while proofs for larger puzzles remain out of reach with current computational technology.

## Appendix: World Records in Singles Format

For reference, here is an approximate snapshot of single world records across major WCA events (subject to frequent updates):

- **3x3**: under 4 seconds, currently around 3.13 seconds.
- **2x2**: under 0.5 seconds, currently around 0.43 seconds.
- **4x4**: under 17 seconds, currently around 16 seconds.
- **5x5**: under 33 seconds, currently around 32 seconds.
- **6x6**: around 65 seconds.
- **7x7**: around 1 minute 35 seconds.
- **Megaminx**: under 27 seconds.
- **Pyraminx**: under 1 second, currently around 0.91 seconds.
- **Square-1**: around 4 seconds.
- **Skewb**: under 1 second, currently around 0.81 seconds.
- **Clock**: around 2.6 seconds.

These records change frequently and the values listed above are approximate snapshots that should be verified against current WCA records for any specific application. The general trend is downward across all events, with most records being broken at least once per year and some records being broken multiple times per year.

## Appendix: Manufacturer Landscape

The current cube manufacturing landscape is dominated by a handful of major Chinese companies, with a few Western and Japanese manufacturers also contributing to specific market segments:

- **MoYu**: The largest cube manufacturer by volume. Produces flagship cubes across all standard NxN sizes and Megaminx, Pyraminx, Square-1, and Skewb. Known for the Weilong (3x3 flagship), Aochuang (4x4-6x6), Aofu (7x7), and other product lines.

- **GAN**: Premium manufacturer focused on the 3x3 market. Their GAN 13 and earlier GAN 12 flagship 3x3 cubes have been used to set multiple world records.

- **QiYi**: Major manufacturer with strong presence across all WCA events. Their X-Man product line includes flagship cubes for most events.

- **YJ (YongJun)**: Mid-range manufacturer with strong presence in the budget and mid-tier markets. Their MGC series has been particularly popular for Megaminx, Pyraminx, and Skewb.

- **YuXin**: Specialist manufacturer focused on Megaminx and a few other event-specific cubes. Their Little Magic Megaminx has been a long-running budget flagship.

- **MoYu/MGC, etc.**: Various sub-brands and partnerships exist within the larger Chinese manufacturing ecosystem.

The Western manufacturer market is smaller and focused on premium and collector items. Rubik's Brand Limited continues to produce branded cubes for the mass market but does not compete at the speedcubing level. Various small Western and European manufacturers produce custom and specialty cubes for the collector market.

The Japanese manufacturer market is smaller still but includes some notable players. The legacy of early Japanese cube design influences modern manufacturing in subtle ways, but the current production volume is largely Chinese.

The overall trend in manufacturing is toward consolidation around a handful of major Chinese companies, with the smaller manufacturers serving niche markets. The price competition between the major manufacturers has been intense, with prices for flagship cubes falling significantly over the past decade. A flagship 3x3 cube that cost $80 in 2015 might cost $30 in 2025, with significantly better performance.

## Closing Notes

The world of WCA events and related puzzles is vast, diverse, and constantly evolving. This document has covered the major events and many of the related puzzles, but the full picture includes far more variation than can be summarized in any single document. Anyone interested in deepening their knowledge of the sport is encouraged to explore the WCA's official website, the various community forums, the YouTube channels of top competitors, and the algorithm databases maintained by the community.

The 3x3 will remain at the center of speedcubing for the foreseeable future, but the related puzzles provide important alternatives, challenges, and opportunities. Whether a competitor's interest is in the deep mathematical structure of a particular puzzle, in the social aspects of a particular community, or simply in the joy of solving a new physical object, the WCA event list and the broader twisty puzzle world have something to offer.

The future of the sport will be shaped by continued innovation in all of these areas. New hardware, new methods, new training resources, and new competitors will all contribute to the ongoing evolution of speedcubing. The 3x3 may always be the headline event, but the diversity of related puzzles will continue to enrich the sport and provide alternative paths to excellence for competitors at every level.

## Deep Dive: The Megaminx as 3x3's Closest Cousin

The Megaminx deserves additional attention because of its unique position as the WCA event most structurally similar to the 3x3. Both events use the same fundamental solving paradigm: build a cross, solve corner-edge pairs in stages, and then handle the last layer with a set of algorithms. The differences are quantitative rather than qualitative: more pieces, more faces, more last-layer cases, but the same underlying logic.

The Megaminx is sometimes described as "3x3 with extra steps," but that description undersells the depth of the puzzle. The five-color cross is significantly harder to plan than the one-color cross on 3x3, because the solver has to track five different color combinations simultaneously and choose the best starting face from many possibilities. The F2L phase on Megaminx involves five sets of corner-edge pairs (one for each surrounding face) rather than four (for the 3x3), and the pairs are arranged radially around the cross face rather than in a square pattern. This radial arrangement means the lookahead is different: the solver has to track pieces moving around a five-sided ring rather than across a four-sided face.

The last layer on Megaminx is where the differences from 3x3 become most pronounced. The Megaminx last layer has five corners and five edges (instead of four and four on 3x3), which means the OLL and PLL phases have more cases. The standard "4-look last layer" approach on Megaminx solves the edges of the last layer (5 cases), then orients the corners (8 cases), then permutes them, with a final adjustment step. The "2-look last layer" approach learned by intermediate Megaminx solvers combines these steps but requires significantly more algorithms. The "1-look last layer" used by elite solvers requires hundreds of algorithms and is one of the most demanding memorization challenges in the WCA event list.

The Megaminx is also unique in being the only WCA non-cube puzzle that uses a CFOP-style approach. All other non-cube events (Pyraminx, Skewb, Square-1, Clock) use methods that are fundamentally different from CFOP. This makes the Megaminx a natural choice for 3x3 cubers looking to expand their event list, because the underlying skills transfer more directly than for any other event.

Hardware for Megaminx has improved dramatically in the past decade and modern flagship Megaminx cubes are now competitive with flagship 3x3 cubes in terms of turning quality. The magnetic positioning systems used in modern Megaminx hardware are particularly important because the puzzle's twelve faces create complex internal geometry that can be difficult to stabilize without active support. The Megaminx market has also seen significant innovation in size: while early Megaminx cubes were typically 65mm or larger, modern flagship Megaminx cubes are often 60mm or smaller for better fit in the hand during fast solves.

The future of the Megaminx as a WCA event is bright. The puzzle has a passionate community, excellent hardware, and a clear competitive trajectory. World record progress has been steady and is likely to continue, with single times potentially dropping below 20 seconds in the next several years. The puzzle's structural similarity to the 3x3 also means that improvements in 3x3 technique (faster fingertricks, better lookahead, more efficient algorithms) tend to translate into Megaminx improvements, which keeps the event relevant to the broader cubing community.

## Deep Dive: Pyraminx and the Sub-Second Era

The Pyraminx has reached a competitive maturity where sub-second single solves are routinely achieved at top competitions and the world record is in the low half-second range. This represents an interesting endpoint for a WCA event because at some point the times approach the limit of human reaction time and further improvement becomes very difficult.

The current Pyraminx world record of 0.91 seconds, held by Dominik Górny, is essentially at the boundary of what is physically possible for a human to do. A 0.91 second solve includes the time to release the timer mat, execute approximately 6-8 moves, and re-press the mat to stop the timer. The actual solving time (between mat releases) is typically less than 0.7 seconds, which leaves very little room for further improvement. The community has debated whether sub-0.5 second Pyraminx solves are physically possible; some argue they would require essentially instantaneous reaction and execution, while others point to scrambles that could theoretically be solved in 3-4 moves.

The Pyraminx average of five is another interesting case study. Current records are in the 1.4-1.6 second range, which means the average solve takes about 1 second longer than the fastest single. This gap reflects the high luck variance in Pyraminx: a single can be very lucky (3-4 move solution), but an average of five usually includes at least one or two longer solves (8-11 moves) that bring the average up significantly.

The Pyraminx community has developed an extensive set of training tools and methods for the sub-second era. Algorithm trainers like TwistyTimer and CubeDesk include Pyraminx-specific training modes that focus on case recognition speed and algorithm execution speed. Hardware development has also focused on the sub-second era, with manufacturers like QiYi and MoYu producing Pyraminx hardware specifically designed for explosive turning.

The future of the Pyraminx is interesting because the puzzle is approaching the limit of human performance. The community has discussed various ways to make the event more challenging, including adding a "tip orientation" requirement (where the tips have to be oriented correctly in addition to the main puzzle) or changing the scrambling algorithm to produce harder average scrambles. None of these changes has been seriously proposed at the WCA level, but the discussions reflect a community grappling with the question of what to do when an event has been "solved" to the point of human limitation.

## Deep Dive: 4x4 Parity in Detail

The parity cases on 4x4 are one of the most important technical features of the puzzle and deserve detailed examination. Understanding parity requires understanding why it occurs, which requires some group theory background.

The 4x4 has indistinguishable wing edges: each of the twelve edge positions has two wing pieces that look identical. When the puzzle is in a "reduced" state (centers solved, edges paired), the indistinguishable wings act as a single edge unit. However, the underlying permutation of the wings can be in a state that is impossible on a true 3x3 because the wings are not actually identical at the deeper level of the puzzle's permutation structure.

OLL parity occurs when one edge of the last layer appears to be flipped while all other edges are oriented correctly. This is impossible on a true 3x3 because the edge orientation parity must be conserved (the number of flipped edges must be even). On 4x4, the apparent single flipped edge is actually a state in which the two wings of that edge are swapped relative to each other; from the solver's perspective, the edge looks flipped, but at the puzzle level it is the wings that are out of place. The parity algorithm that fixes this case (often called "OLL parity" or "single dedge flip") is typically 14-17 moves long and works by cycling pieces in a way that swaps the two wings back to the correct positions.

PLL parity occurs when two edges of the last layer appear to be swapped without other changes. This is impossible on a true 3x3 because PLL permutations are constrained by corner permutation parity (an even number of edge swaps requires an even number of corner swaps). On 4x4, the apparent two-edge swap is actually a state in which the wings of those edges are swapped with each other; from the solver's perspective, the edges look swapped, but at the puzzle level it is the wings that are crossed. The parity algorithm that fixes this case (often called "PLL parity" or "edge swap parity") is typically 14-17 moves long and works by cycling pieces in a way that uncrosses the wings.

The two parity cases are independent, so a typical 4x4 solve has four possible parity states:
- No parity: occurs about 25% of the time. The 3x3 phase is a normal 3x3 solve.
- OLL parity only: occurs about 25% of the time. Requires one parity algorithm during the OLL phase.
- PLL parity only: occurs about 25% of the time. Requires one parity algorithm during the PLL phase.
- Double parity: occurs about 25% of the time. Requires both parity algorithms or a combined "double parity" algorithm.

Some elite 4x4 solvers prefer to use a single "double parity" algorithm rather than executing the two parity algorithms separately. The double parity algorithm is typically 20-25 moves long but saves the overhead of recognizing and executing two separate algorithms.

Advanced 4x4 methods like Yau and Hoya try to "fix" parity earlier in the solve to avoid the slow parity algorithms in the last phase. The technique involves identifying the parity state during edge pairing and using specific pairing techniques that produce the desired parity outcome. This is called "parity prediction" or "OLL parity avoidance" and is one of the most advanced techniques in 4x4 solving.

The existence of parity on 4x4 is a fundamental consequence of the puzzle's geometry and cannot be avoided through method choice alone. Any solving method that reduces the 4x4 to a 3x3 will encounter parity cases with some probability, and the parity algorithms will always be slower than standard 3x3 algorithms. This is one of the main reasons why 4x4 times are significantly slower than 3x3 times: even after the puzzle is "reduced," the last phase is not quite a normal 3x3 solve.

## Deep Dive: Blindfolded Events and 3-Style

The Blindfolded events (3BLD, 4BLD, 5BLD, and Multi-Blind) deserve their own deep dive because they represent a completely separate skill domain from regular speedcubing despite using the same physical puzzles. The dominant memorization and solving system in modern BLD is called "3-style" and represents a culmination of decades of method development.

The basic challenge of blindfolded solving is that the solver has to memorize the entire state of the puzzle during a "memorization phase" and then execute the solution during a "solving phase" without looking at the puzzle. The combined time of both phases is the solve time. The current 3BLD world record is around 13 seconds, which means the solver memorizes the entire 3x3 state and executes a 60+ move solution in about 13 seconds total.

The 3-style method works by treating the 3x3 as a collection of corner cycles and edge cycles. The solver memorizes the corners as a sequence of letter pairs, where each letter represents a specific corner position. A typical 3x3 corner permutation can be expressed as a sequence of 7-8 letter pairs, which the solver memorizes using mnemonic techniques (typically by converting each letter pair to a word or image and constructing a memorable story). The edges are similarly memorized as 10-12 letter pairs.

During the solving phase, the solver executes a "3-cycle commutator" for each letter pair. A 3-cycle commutator is a sequence of moves that cycles three specific pieces and leaves all other pieces unchanged. The 3-style method has commutators for every possible corner 3-cycle and every possible edge 3-cycle; the full set is around 1000 algorithms for corners and 2000 for edges, although many can be derived from simpler base cases through symmetry and conjugation.

The skill ceiling for 3-style is essentially unlimited. The current world record holders have memorized thousands of commutators and have trained their execution speed to the point where they can complete a 3x3 BLD solve faster than many people can solve a 3x3 with their eyes open. The memorization speed is similarly fast: elite solvers can memorize a 3x3 state in 3-5 seconds.

The transfer from 3x3 BLD to 4x4 BLD is high because the same 3-style method applies to the larger puzzle. The main differences are the larger number of pieces (more letter pairs to memorize), the more complex commutators (longer sequences for some piece types), and the parity considerations from 4x4. The current 4x4 BLD world record is around 1 minute 5 seconds, which is dramatically slower than 3BLD but represents a similar level of expertise scaled to the larger puzzle.

5x5 BLD is even more demanding, with the current world record around 2 minutes. The puzzle has so many pieces that memorization alone takes 30-45 seconds for elite solvers, and the execution phase is correspondingly long. The 5x5 BLD community is small but highly dedicated, with only a few competitors in the world capable of completing a 5BLD solve in under 3 minutes.

Multi-Blind takes the BLD challenge to its extreme. Competitors memorize multiple cubes (sometimes dozens) during a long memorization phase and then execute the solutions one cube at a time without looking. The current Multi-Blind world record involves successfully solving over 60 cubes in under an hour, which represents an astonishing memory feat. The dominant memorization technique for Multi-Blind is "letter pair imagery" combined with the "method of loci" (memory palace), where each cube is associated with a specific location and the letter pairs for each cube are placed at sub-locations within the main location.

The community of BLD specialists is one of the most tightly knit in the cubing world. The skill required for elite BLD is so unique and demanding that the specialists tend to know each other personally and to share training techniques, commutator improvements, and memorization strategies. The cross-pollination between BLD and other events is limited because the skills are so different, but BLD specialists often have an unusually deep understanding of cube structure that benefits them in other analytical events like FMC.

## Long-Term Trends

Looking at the long-term trends across all WCA events, several patterns emerge. World records are coming down across all events, but the rate of improvement varies. The 3x3 has seen incremental improvements with occasional dramatic drops (such as the Yusheng Du 3.47 in 2018 and the more recent 3.13 by Tymon Kolasinski). The 4x4 and 5x5 have seen steady incremental improvements with no dramatic drops in recent years. The 6x6 and 7x7 have seen larger relative improvements as hardware has continued to evolve. The non-cube events (Pyraminx, Skewb, Megaminx, Square-1, Clock) have all seen significant improvements as their respective communities have matured and developed better methods and hardware.

The all-rounder vs specialist trend has fluctuated over time. The dominant all-rounders of the late 2010s (Feliks Zemdegs, then Max Park) have largely defined the public face of the sport, but specialists have continued to dominate specific events. The relative balance between these two approaches will likely continue to shift as the sport evolves.

Hardware has been the most predictable area of improvement. The transition from non-magnetic to magnetic cubes in the mid-2010s was the most significant single change in cube design, and the continued evolution toward adjustable magnetics, smaller form factors, and crisper turning has improved performance across all events. The next major hardware innovation is likely to be in the area of customizable feedback (haptic, visual, or electronic) that helps solvers refine their technique.

Method development has been more variable. The 3x3 has seen continued refinement of CFOP and incremental adoption of alternative methods like Roux, but no dramatic method shift in recent years. The big cube events have seen ongoing refinement of reduction methods. The non-cube events have seen various method innovations but no major shifts. The BLD events have seen the most dramatic method evolution with the gradual dominance of 3-style over earlier methods like M2 and old Pochmann.

Looking forward, the next decade of speedcubing will likely see continued world record progress across all events, with potentially dramatic improvements in some events (especially the big cubes and BLD events) as hardware and methods continue to evolve. The 3x3 will remain the dominant event, but the related puzzles will continue to provide important alternatives and challenges. The community will continue to grow and diversify, with new competitors entering the sport from all over the world and bringing new perspectives and techniques to bear.

The sport is in a healthy and dynamic state, with no major existential threats and many opportunities for continued growth. The 3x3 prediction trajectories that motivate the broader /wca/prediction/333 page are part of a larger pattern of improvement across all events, and the same factors that drive 3x3 improvement (better hardware, better methods, more dedicated training, larger competitive pools) drive improvement in the other events as well. The future of speedcubing is bright across the entire WCA event list, and the related puzzles will continue to play a vital role in the sport's continued evolution.

## Deep Dive: 2x2 Algorithm Sets and the CLL/EG Hierarchy

The 2x2 algorithm sets deserve detailed examination because they represent one of the cleanest cases in speedcubing of how method choice affects competitive performance. The 2x2 has a small enough state space that nearly every interesting sub-method has been thoroughly explored, and the trade-offs between different method choices are well understood.

Ortega is the entry-level method for 2x2 and consists of three phases: first layer face (orient one face), orient the opposite face, then permute both layers. The full Ortega set has only 12 algorithms and can be learned in a few hours by a competitive 3x3 cuber. Average times with Ortega typically range from 3 to 5 seconds for intermediate solvers, which is competitive but not world-class.

CLL (Corners of the Last Layer) is the next step up and consists of solving the first layer (any color) and then using a one-look algorithm to solve the last layer in one step. The full CLL set has 42 algorithms covering all possible last-layer states. Learning CLL takes weeks or months of dedicated practice, but it reduces average times to the 1.5-2.5 second range for intermediate solvers and under 1.5 seconds for advanced solvers.

EG (Erik-Gunnar) extends CLL by allowing the first layer to be unoriented when the last-layer algorithm is applied. The full EG set has 128 algorithms (42 for CLL, 42 for EG-1 which handles a single misoriented corner in the first layer, and 42 for EG-2 which handles two misoriented corners), and learning the full set takes months to years of dedicated practice. EG reduces average times to the 1.0-1.5 second range for elite solvers and enables the sub-1 second averages that define the top of the 2x2 competitive scene.

Beyond EG, the most advanced 2x2 solvers use specialized techniques like TCLL (a variation of CLL that handles specific cases more efficiently), CLL+1 (a technique that solves the last layer plus one piece of the first layer in a single step), and various personalized algorithm sets that optimize for specific scrambling patterns. The very top 2x2 solvers like Teodor Zajder, Yiheng Wang, and Zayn Khanani have customized their algorithm sets to such a degree that comparing their methods to standard CLL/EG is almost meaningless; they have effectively created personalized methods that work optimally for their individual cognitive and physical patterns.

The 2x2 has also been the subject of interesting computational studies. The full state space has been enumerated multiple times by different researchers, and the distribution of optimal solution lengths is well understood. Of the 3,674,160 distinguishable positions, the largest single set (those requiring exactly 9 moves to solve optimally) contains about 1.1 million positions, or about 30 percent of all positions. The smallest non-trivial set (those requiring exactly 11 moves to solve optimally) contains only 50,944 positions, which means an "antipodal" scramble that requires the full God's number to solve is encountered in only about 1.4 percent of random scrambles.

These statistical properties of the 2x2 state space are useful for predicting world record possibilities. The maximum possible single solve time for a competitor with perfect execution would be bounded by the longest optimal solution length (11 moves) plus their recognition time. For an elite solver with 100 millisecond recognition time and 50 millisecond per move execution time, the theoretical minimum solve time would be approximately 100 + 11*50 = 650 milliseconds. Current world record times of around 430 milliseconds suggest that elite solvers are routinely executing in well under 50 milliseconds per move when the algorithm is well-rehearsed, which is consistent with what high-speed video analysis has shown.

## Deep Dive: 4x4 Hardware Evolution

The 4x4 hardware market has gone through several distinct generations, each marked by significant performance improvements. Understanding this hardware evolution helps explain why world record times have come down so dramatically over the past decade.

The first generation of 4x4 hardware, exemplified by the original Rubik's Revenge from the early 1980s, was essentially unsolvable at competitive speed. The puzzles had loose tolerances, sticky turning, and tendencies to pop spontaneously during fast manipulation. Average solve times for the best competitors of that era were in the 60-90 second range, and the puzzle was largely considered a novelty rather than a serious competitive event.

The second generation, exemplified by the Eastsheen 4x4 from the mid-2000s, introduced more reliable manufacturing and significantly better turning. The Eastsheen cube was the first 4x4 that could be turned at speeds approaching the limits of human hand motion, and it enabled world record times in the 50-60 second range. The cube was still prone to pop and required careful tensioning, but it represented a major step forward.

The third generation, exemplified by the V-Cube 4 from the late 2000s, introduced a different mechanical design with improved stability and reduced pop tendency. The V-Cube 4 was the first 4x4 that could be turned aggressively without immediately popping, and it pushed world record times into the 30-40 second range. The cube was expensive and somewhat heavy, but it set a new standard for 4x4 design.

The fourth generation, exemplified by the MoYu Aosu and similar designs from the early 2010s, introduced the modern "speed cube" design philosophy: light weight, fast turning, and corner-cutting tolerances optimized for high-speed solving. These cubes pushed world record times into the 20-30 second range and established the basic design language that still dominates the 4x4 market today.

The fifth generation, exemplified by the MoYu Aosu WR M and similar magnetic flagship cubes from the late 2010s, introduced magnetic positioning systems that dramatically improved stability and consistency. These cubes pushed world record times into the high teens and low 20s, where they remain today. The MoYu Aosu WR M was particularly influential and was used to set multiple world records during its peak years.

The current sixth generation, exemplified by cubes like the MoYu Aosu V2 M and the GAN 460M, represents further refinement of the magnetic flagship concept. These cubes have adjustable magnet strength, customizable tensions, and the smallest form factors yet seen on a 4x4. World record times have continued to come down steadily, with single times now under 16 seconds and average times under 19 seconds.

The seventh generation, which is currently being developed, may introduce new design concepts like electronic feedback systems, adaptive tensioning, or completely new mechanical designs that have not yet been seen in mass production. The competitive pressure to break the next generation of world records will likely drive significant hardware innovation in the next few years.

## Deep Dive: Why 6x6 and 7x7 Are Unique Among WCA Events

The 6x6 and 7x7 events are unique among WCA events in several important ways. They are the only events that use a mean-of-three competition format rather than the average-of-five format used by most other events. This format choice was made to reduce competition time, because a single 7x7 solve can take 2-5 minutes and an average-of-five would take 10-25 minutes per competitor per round. The mean-of-three format reduces this to 6-15 minutes per competitor per round, which is more manageable for competition organizers.

The mean-of-three format has interesting statistical properties compared to the average-of-five format. The mean-of-three uses all three times equally and does not exclude the best or worst time, while the average-of-five excludes both the best and worst times. This means a single bad solve has a much larger effect on the mean-of-three than on the average-of-five, which makes consistency more important for big cube success.

Big cube events also have the longest event durations of any WCA events. A typical 7x7 round at a major competition can take 4-6 hours to complete, with each competitor needing 15-25 minutes to complete their three solves and the judging overhead adding additional time. The long duration means that big cube events are usually held in fewer rounds (typically 2-3 rounds for a major competition) compared to the 4-5 rounds typical for 3x3 events at the same competitions.

The big cube events are also unique in their hardware demands. A competitor who wants to be competitive on 6x6 or 7x7 needs to invest in dedicated flagship hardware that costs $80-150 per cube, and they need to spend significant time breaking in and tuning their cubes. The "main cube" for a big cube specialist is often a personalized setup that has been adjusted over months or years of use, and replacing it can require weeks of adjustment to the new cube.

The big cube communities have developed their own specialized cultures around these unique features. Big cube specialists often have detailed opinions about lubrication choices, magnet strengths, tensioning approaches, and other hardware details that would be considered esoteric in the broader cubing community. The community has its own online forums, video tutorials, and competitive ranking systems that focus specifically on big cube events.

The future of big cube events in the WCA is interesting. There has been some discussion of adding 8x8 as a future event, but no concrete plans have been announced. The 6x6 and 7x7 events will likely remain in their current form for the foreseeable future, with continued hardware and method evolution driving steady world record progress. The mean-of-three format has been criticized by some competitors as less indicative of true skill than the average-of-five, but no serious proposals to change the format have been made.

## Final Comparison: The 3x3 in Context

Bringing all of these comparisons together, the 3x3 occupies a unique position in the WCA event hierarchy. It is the most popular event, the most thoroughly studied event, and the event with the most developed competitive infrastructure. But it is also one event among many, and the broader WCA event list contains puzzles that range from the trivially small Pyraminx to the enormous 7x7, from the structurally similar Megaminx to the completely different Clock, and from the visually obvious Square-1 to the abstract challenge of Multi-Blind.

For 3x3 cubers looking to expand their event list, the choice of which event to pick up next depends on several factors. If they want the highest skill transfer back to 3x3, they should pick Megaminx or 2x2. If they want a completely different challenge that will exercise different cognitive skills, they should pick Square-1 or Clock. If they want to test their ability to scale up to larger puzzles, they should pick 4x4 or 5x5. If they want to develop a separate skill domain that uses the 3x3 puzzle but completely different methods, they should pick 3BLD or OH.

The 3x3 prediction page focuses on the central event, but the related puzzles provide important context for understanding the broader trajectory of the sport. The same factors that drive 3x3 world record progress (better hardware, better methods, larger competitive pools, more dedicated training) drive progress across all events. The 3x3 will always be the headline, but the supporting cast of related puzzles is what gives the sport its depth and diversity.
`;
