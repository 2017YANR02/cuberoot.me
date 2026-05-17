export const FMC_EVENTS_EN = `
## The Other 3x3 Disciplines: FMC, One-Handed, Blindfolded, and Multi-Blind

The world records and statistical models that dominate the public face of speedcubing almost always refer to the standard 3x3x3 event: two-handed, eyes open, on a table, with a fifteen-second inspection. That single event is what most casual observers, journalists, and television producers imagine when they hear the word "Rubik's Cube competition." But the World Cube Association sanctions a broader family of disciplines that all use the same physical 3x3x3 puzzle yet ask for completely different skills. Fewest Moves Challenge replaces fast hands with a pencil and an hour of analytical thought. One-Handed strips away half of a solver's dexterity and forces a complete rebuild of the fingertrick library. Blindfolded eliminates vision after a single memorization phase and rewards spatial memory architects who can hold dozens of letter pairs in working memory while turning a cube they cannot see. Multi-Blind extends that demand to dozens of cubes solved sequentially across an hour-long memorization phase that pushes the limits of human associative memory. The retired With Feet event added a layer of body mechanics so foreign to the speedcubing world that even its champions described it as essentially a different sport.

This document covers all of those disciplines in detail, plus the surrounding infrastructure that makes any of them work: the World Cube Association regulation framework that defines what counts as a legal solve, the TNoodle scrambling program that generates the random sequences used at competitions, the delegate system that supervises events, and the historical evolution of rules from the founding of the WCA in 2003 to the present day. Where the main /wca/prediction/333 page focuses on the central speed event and its likely future trajectory, this document fills in the parallel events that share the puzzle but diverge entirely in what they reward.

## Fewest Moves Challenge: The Cerebral Event

Fewest Moves Challenge, abbreviated FMC, is the event for cubers who would rather spend an hour finding the elegant solution than three seconds executing the obvious one. The format is simple to describe and famously difficult to do well. Competitors receive a scrambled state at the start of an hour-long round, on paper, with a physical cube provided so they can manipulate the puzzle without committing moves. They have sixty minutes to write down the shortest solution they can find. At the end of the hour they submit their solution on a standardized form, the judges apply the moves to a reference cube to verify the solve actually works, and the result is counted in half-turn metric (HTM): the number of face turns, with double turns counting as one move and rotations counting as zero. The shorter the solution, the better the result. There is no time pressure within the hour beyond the deadline itself; a solver who finds an excellent solution in ten minutes can spend the remaining fifty trying to improve it or simply rest, while a solver who finds nothing remarkable can write down the best they have and submit early.

FMC has been a WCA event continuously since the organization was founded in 2003, making it one of the original events alongside 3x3, 4x4, and Blindfolded. Its single-attempt format was supplemented in 2014 by a mean-of-three format used at most major competitions, which averages three independent hour-long attempts on three different scrambles. The mean format better rewards consistency, because a single brilliant solution on one scramble cannot rescue a mediocre attempt on the other two; the single-attempt format remains in use at smaller competitions and produces the official "single" world records that get the most public attention.

### The Move Counting Rules

The metric used in FMC is half-turn metric, sometimes called HTM or face turn metric. Under HTM, each face turn counts as one move regardless of whether it is a quarter turn or a half turn. So R counts as one move and R2 also counts as one move. A wide turn such as Rw or r counts as one move, because it represents a single physical face turn (with the inner slice moving along). Slice moves M, E, and S each count as one move. Rotations of the entire cube — x, y, z and their inverses or doubles — count as zero moves, because they do not change the relative position of any piece; they only reorient the solver's viewpoint.

The choice of HTM rather than the alternative metric, quarter turn metric (QTM, where R2 counts as two), reflects FMC's history and the structure of the event. HTM matches the way solutions are written and the way humans naturally think about the cube: a half turn is a single physical motion, not two. Under QTM the average FMC solution would be roughly 30 percent longer in count, and the bookkeeping for solvers and judges becomes more tedious without any new insight. Some hobbyist exploration of cube optimization uses the slice turn metric (STM) or even more exotic metrics, but for official FMC results the metric is universally HTM and has been since the founding.

A subtle but important consequence of the HTM rule is that cube rotations are essentially free in FMC. A solver who finds a 17-move solution that requires viewing the cube from three different angles can write the rotations into the solution at zero move cost. This is why FMC solutions often look strange to speedcubers, who rarely write rotations into their solves: an FMC sequence might read "R U F y' L F2 R x' U D' R'" where the x' and y' rotations carry no penalty but visually clutter the page. In practice, top FMC solvers minimize rotations in their final written submission because the judges have to verify the solution, and rotations make verification more error-prone — but the metric does not punish them.

### The 5-3-2 Heuristic and the Move Budget

Top FMC solvers operate with an unwritten rule of thumb known as the 5-3-2 budget. A truly excellent FMC solution will spend roughly five moves to build the first major block (typically a 2x2x2 or 2x2x3), refine the next three pieces of the cube with maybe three additional moves, and finally fix the remaining two or three pieces with two more moves plus insertions. The full mental budget for a 20-move solution thus breaks down as approximately five for the initial block, three to extend the block toward a near-solved state, two more for the final pieces, and the remaining time spent finding insertion sequences that cancel as many moves as possible with the existing skeleton.

This budget is descriptive, not prescriptive. There is no rule that says an FMC solution must use this breakdown, and many successful solves use entirely different structures: corners-first approaches that solve all eight corners and then fix the edges, or domino-reduction approaches that orient and permute pieces in two stages, or even pure blockbuilding that does not distinguish "skeleton" from "insertion" at all. But the 5-3-2 framing is useful as a sanity check. If a solver has spent twenty moves and the cube still has eight pieces out of place, the solution is going to land in the thirties, not the teens. If a solver has built a 2x2x3 in five moves and oriented the remaining edges in three, they are on track for a 20-move solution or better.

### The Skeleton-and-Insertion Technique

The technique that defines high-level FMC is the skeleton-and-insertion approach. The solver first finds a "skeleton" — a sequence of moves that solves all but three corners or all but a few specific pieces, leaving a known cycle or commutator remaining. The skeleton might be 18 moves long and leave three corners in a 3-cycle. The solver then searches for an "insertion" — a commutator that solves those three corners — and inserts it into the middle of the skeleton, choosing the insertion point that cancels the most moves with adjacent skeleton moves. A well-chosen insertion might add 8 moves to the skeleton but cancel 6 of them, netting only 2 added moves and producing a 20-move solution.

The insertion technique is what allows FMC to produce solutions in the 18-22 range that would be unreachable by pure planning. A solver who tried to plan a 19-move solution from scratch, optimizing every move, would almost certainly fail; the search space is too large and the human mind too limited. But a solver who finds a 22-move skeleton and then searches over the roughly 200 known commutators for one that inserts efficiently into one of the 22 possible insertion points can find a 19-move solution in 20 minutes of focused work.

Insertion search is mechanical enough that it can be partly memorized. Top FMC solvers know dozens of common 3-cycle commutators and their cancellation properties with common skeleton endings. They can recognize, on sight, that a skeleton ending in "R U R'" will cancel three moves with an insertion of "R U' R' U R U R'" inserted just before the final R, leaving only U' R' U R U as the effective addition. This recognition is built up over years of practice and is the closest analog FMC has to the algorithm memorization that dominates speedcubing.

### NISS: Normal-Inverse Scramble Switching

A second technique that defines modern FMC is NISS, which stands for Normal-Inverse Scramble Switch. The technique exploits a mathematical property of the cube: any sequence of moves that solves a scramble also solves the inverse scramble when itself inverted, and vice versa. A solver can begin building a block on the scramble, then "switch" to the inverse scramble and continue building from the other end. The premoves they made on the original scramble become premoves the inverse scramble must end with, and the moves they make on the inverse scramble must be reversed at the end and prepended to the final solution.

In practice, NISS allows a solver to build blocks from both directions simultaneously. If a solver has built a 2x2x2 on the original scramble in 4 moves but cannot find a clean way to extend it to a 2x2x3, they can switch to the inverse and try to build the missing piece from the other direction. If they find it in 3 moves on the inverse, the resulting 2x2x3 took 7 moves total, which might be impossible to find from either direction alone.

NISS was popularized in the mid-2010s and is now a standard tool in every serious FMC solver's repertoire. The technique requires careful bookkeeping — keeping track of which moves are "normal" and which are "inverse," and how they will combine in the final solution — but is straightforward enough that an experienced FMC solver can perform it intuitively. The technique was a significant factor in the gradual lowering of competition averages from the high twenties in 2010 to the low twenties or even high teens in 2025.

### OEMC and Other Modern Techniques

OEMC, the Optimized Edge Match Counting technique, is a more specialized tool used in domino reduction approaches. After a solver has oriented all twelve edges (a standard early phase in many FMC plans), the remaining task is to permute the edges and the corners. OEMC provides a systematic way to count the minimum number of moves needed to match the edges into pairs that can be solved together, which informs the choice of next move.

Other modern techniques include ATM (which uses corner orientation parity as a planning constraint), DR (Domino Reduction, which reduces the cube to a state solvable with only U and D quarter turns and half turns of other faces), HTR (Half-Turn Reduction, a further reduction to a state solvable with only half turns), and explicit use of computer search results for the optimal solve length of intermediate states. These tools are not used in real time during the hour; instead they shape the strategies that top solvers internalize through extensive offline study.

### World Record Evolution

The FMC world record for single attempts has a long and well-documented history. The earliest official records were in the high twenties and low thirties, reflecting an era before the skeleton-and-insertion technique was widespread. The record dropped into the high teens by the mid-2010s as the technique matured and as more competitors brought serious analytical training to the event.

The current world record for FMC single is 16 moves, achieved by Sebastiano Tronto of Italy in 2019. Tronto's solution is one of the most celebrated single solves in cubing history; the scramble and solution were widely reconstructed and analyzed in the months following the result. Cale Schoon of the United States had set a 16-move FMC result in 2018, becoming the first to reach that benchmark, though the two are considered co-record-holders for the absolute single because both achieved 16 and neither has been beaten.

For the mean-of-three world record, the holder has shifted over the years. The current world record stands at approximately 21 moves, an extraordinarily consistent average that requires producing an excellent solve on three completely different scrambles in three separate hours. The relay event held at China Championship 2020 produced a team record of 22.00 moves across three solvers (Wenfei He and teammates), demonstrating the level of skill required for the discipline.

The progression of the single record from 27 in 2003 to 16 in 2019 represents a reduction of 41 percent in fifteen years. The progression appears to have plateaued: no one has broken 16 in the seven years since Tronto's record, despite many strong attempts. The plateau reflects a fundamental constraint — the theoretical optimum for any random 3x3 scramble is between 14 and 22 moves, and the average optimal is around 17.4 moves. A 16-move solve is already at the edge of what is mathematically possible for an average scramble, and a 15-move solve would require either a particularly easy scramble or a level of insight beyond what any human has yet demonstrated.

### The Mathematical Ceiling

A central question in FMC is: how low can the record go? The answer is grounded in the mathematics of the 3x3 cube. Every scrambled state has an "optimal" solution length, which is the minimum number of moves in some chosen metric required to solve it. The optimal solution lengths follow a distribution: most scrambles are solvable in 18 moves HTM, some in 17 or fewer, a few in 20 or more, and a small handful in 21. The maximum optimal solution length for any 3x3 scramble in HTM is 20 — this is the celebrated "God's number" result proven in 2010 by Tomas Rokicki and collaborators using massive computer search.

For a random scramble, then, the optimum is somewhere in the 15-20 range, with the average around 17.4. A human FMC solver who consistently achieves 16-18 moves is achieving roughly the optimum for the easier-than-average scrambles. The record of 16 by Tronto and Schoon required scrambles where the optimum was 16 or lower, and required them to actually find a solution at that optimum.

A 15-move FMC record would require either a scramble whose optimum is 15 or lower (rare, perhaps one in twenty scrambles) and a solver who finds the optimum (rarer still). A 14-move record would require an even rarer scramble (perhaps one in fifty) and again the solver to find it. A 13-move record would require a scramble whose optimum is exactly 13 (perhaps one in a few hundred) and finding it. Below 13, the records become essentially impossible without explicit cooperation with the scrambling process, which is forbidden by the rules.

The community consensus is that the record will probably remain at 16 for many more years, with occasional ties as multiple solvers reach the same number on different scrambles. A 15 will eventually happen, perhaps within a decade, and will be celebrated as a major breakthrough. A 14 or lower is mathematically possible but would essentially require winning the scramble lottery while also being one of the strongest FMC solvers ever, and even then is far from certain.

### Notable FMC Solvers and Their Styles

Sebastiano Tronto is the current single co-world-record-holder and one of the most analytical FMC solvers in the modern era. His style emphasizes deep planning before any move is committed; he is known for spending the first ten or fifteen minutes of an hour with the cube essentially untouched, building the solution in his head. His 16 was achieved at FMC Europe 2019, and the reconstruction shows a remarkably elegant block-building approach that found an efficient skeleton and inserted a single commutator with massive cancellation.

Cale Schoon, who set the prior 16 in 2018, comes from the American FMC scene. His style is more iterative, with frequent use of NISS and willingness to abandon promising starts in favor of new approaches if the early moves are not paying off. The Schoon and Tronto solutions, while both 16 moves, took quite different paths.

Mateusz Gaspar of Poland is one of the most consistent FMC solvers in the world. His name appears repeatedly in the mean records and the various national results. He is known for a textbook 5-3-2 approach that produces results in the high teens to low twenties with remarkable regularity. Gaspar has been one of the most active proponents of organized FMC training in Europe, with extensive online tutorials and weekly group practices that have raised the level of dozens of European FMC competitors.

Other notable names include Wenfei He of China, whose 22.00 team record contribution put him in the spotlight; Bence Cseh of Hungary, who has held national records and contested for international results; and a handful of Japanese, Korean, and Indonesian solvers who have brought regional approaches to international competition. The FMC scene is small enough — perhaps two hundred genuinely competitive FMC solvers worldwide — that names are familiar across the discipline, and the small community has its own culture distinct from the broader speedcubing world.

### National FMC Scenes

Hungary has produced an outsized share of strong FMC solvers, partly because of historical depth: Hungary was the birthplace of the Rubik's Cube and has maintained a strong cubing culture continuously since 1980. Polish solvers similarly have a long history, with the Polish national championship sometimes serving as a de facto European championship for FMC. The United States has a smaller but very competitive FMC scene, with active online communities and frequent organized practice. China has emerged as a major force in the past decade, with several solvers reaching world-class levels and team competitions like the relay format showcasing depth of talent.

The smaller national scenes are often built around individual organizers who run regular FMC competitions or training groups. Italy's scene was significantly shaped by Tronto; Japan's by a handful of dedicated solvers who maintain an active online community; Mexico's by competitions that pair FMC with main events. The FMC community tends to be smaller and more cooperative than the speedcubing scene; solvers freely share scramble analyses, walk-throughs of their own solutions, and discussion of new techniques in a way that would be impractical in the secretive world of speedcubing world-record attempts.

### Training Volume and Time Investment

Top FMC solvers report training volumes of 10,000 to 20,000 scrambles per year, where a "scramble" in FMC training means an hour of focused analysis on a single scramble. That is fifty to a hundred hours per week of FMC-specific practice, which is comparable to the practice volumes of top speedcubers but spread across many fewer attempts. The bulk of FMC training is offline analysis: study of difficult scrambles after the fact, examination of optimal solutions, memorization of commutators and inverse sequences, and gradual expansion of the set of recognized patterns.

A solver new to competitive FMC, by contrast, often starts with sub-thirty-move averages and improves slowly. The learning curve is steep: a beginner cannot simply look up the technique and apply it. The skeleton-and-insertion approach must be internalized through dozens or hundreds of hours of struggle with real scrambles. Most FMC competitors plateau at around the 25-move average and never break below 22, which represents the threshold between casual and serious competitive FMC.

### FMC Software Tools

Competitive FMC solvers use software for two main purposes: training and verification. Cube Explorer, the program written by Herbert Kociemba that implements the famous two-phase algorithm, is the standard tool for finding optimal or near-optimal solutions to a given scramble. After a competition, FMC solvers commonly run their scrambles through Cube Explorer to see what the theoretical optimum was; this informs their training and helps them understand where their solutions could have been better.

The ksolve program (and successors) provides similar functionality with more flexibility for exploring intermediate states. Some solvers use it to evaluate the efficiency of partial skeletons or to search for insertion commutators with specific properties.

During competition, software is forbidden. Solvers may bring only paper, a pencil, and a physical cube. The cube provided by the competition is typically a standard 3x3 (not a particular brand) and is used purely as a manipulation aid; solvers do not commit moves to it as if doing a speedsolve. Some solvers stick brightly colored labels on the cube's pieces to make tracking easier during long analyses; this is permitted as long as the labels do not interfere with the puzzle's normal operation.

### The Wenfei He Team Record and the Relay Format

In 2020, the Chinese FMC team at China Championship achieved a team relay result of 22.00 moves, where each of three solvers contributed one of three solves and the average was the result. The achievement was notable not only for the low number — 22.00 is an exceptional team result — but for the coordination required: each team member solved a different scramble in isolation, and the resulting numbers were averaged for the team's final result. This format showcases depth of talent in a national scene; a single brilliant solver cannot carry a team that lacks consistent secondary contributors.

The relay format is not a standard WCA event but is popular at regional team competitions in Asia and occasionally in Europe. The format has spawned its own sub-culture of training, where solvers practice not just to achieve good personal averages but to be reliable contributors to team results. The Wenfei He team record stood as a major benchmark and was a moment of national pride for Chinese FMC.

## One-Handed (OH)

One-Handed 3x3, abbreviated OH, is the discipline of solving a 3x3 cube using only one hand. The event has been part of the WCA program continuously since 2003 and is one of the most popular non-standard 3x3 disciplines. Most cubers can attempt OH without specialized equipment or extensive training, which gives it broad participation; but the gap between casual OH and competitive OH is enormous, with world-class times an order of magnitude faster than typical hobbyist times.

### Format and Rules

OH follows the standard speed event format: average of five solves, with the best and worst dropped to produce a trimmed mean of the middle three. The solver may use either hand; most are right-hand-dominant but a substantial minority of competitors use their left hand by preference or by injury accommodation. The cube must be solved with only one hand making moves; the other hand may not touch the cube during a solve. Inspection is the standard 15 seconds, with the same +2 and DNF penalties as the main event.

The cube may rest on the table or be held entirely in the air; this is the solver's choice. Most competitive solvers use the table extensively as a "second hand," letting the cube spin on a table while they turn it with one hand. The table provides essentially a stable platform that simulates the role of the missing second hand for some moves. World-class solvers can perform many of the same moves as a two-handed solver, just slower; the table technique compensates for some but not all of the missing dexterity.

### World Record Evolution

The OH world record has come down dramatically over two decades. In the 2000s, the record was in the 12-20 second range; world-class OH solves were considered impressive at sub-15. The record dropped into single digits in the mid-2010s as cubers like Sergey Ryabko developed more efficient OH algorithm sets and as cube hardware improved (lighter, smoother cubes that responded better to one-handed turns).

The current OH world record single is approximately 5.32 seconds by Max Park of the United States, set in 2025. Park is also the holder of the OH world record average, with an exceptional sub-7 average that demonstrates not just peak performance but consistency. Park's two-handed dominance — he holds or has held world records in essentially every major speed event — extends to OH despite the discipline requiring a different fingertrick library.

Before Park's dominance, Bence Barát of Hungary held OH records and was widely considered the strongest OH solver in the world for several years. Barát's style emphasized cube control: he could perform fingertricks one-handed that most cubers struggled with even two-handed, and his algorithm execution was famously fluid. Sergey Ryabko, who held earlier OH records in the mid-2010s, was instrumental in developing the OH-specific algorithm modifications that are now standard.

### Method Choice

OH solvers overwhelmingly use CFOP, the same method as the main event, but with substantial modifications. The cross is typically planned during inspection just as in two-handed solving, but is executed with much more table support; the cuber may rotate the entire cube on the table using the friction of one finger while turning a face with the others. F2L pairs are inserted with similar techniques, often with the cube being spun or flipped on the table to access pairs.

A significant minority of OH solvers prefer Roux, because Roux's reliance on M-slice moves and U-face turns is well-suited to one-handed execution. M slices are easy one-handed (just rotate the middle layer with the thumb while holding the cube vertically), and U-face turns can be done with a flick of the wrist. The block-building phase of Roux is harder one-handed than CFOP's cross, but the last-six-edges phase is faster, leading some OH specialists to switch entirely to Roux for the event.

### OH-Specific Algorithm Differences

The biggest difference between OH and two-handed CFOP is the algorithm set for the last layer. Many OLL and PLL algorithms that are fast two-handed (involving simultaneous left and right hand moves) become impossibly slow one-handed because each hand's motion must be sequential. The Y-perm, one of the standard PLLs, is essentially impossible to execute well one-handed because it relies heavily on left-hand R-moves; OH solvers either use a completely different algorithm for the Y-perm case or accept a much slower execution.

The T-perm, by contrast, is reasonably fast one-handed but typically uses a modified algorithm that emphasizes U-face turns and avoids the rapid R'-F sequence common in two-handed T-perm. The OH-friendly T-perm has roughly twice the move count of the standard T-perm but executes faster because each move is achievable one-handed.

Most OLLs have OH-specific variants. The fish algorithms (sune and antisune) are essentially unchanged because they consist of R-U sequences that work one-handed with table support. The L-shape OLLs that rely on F-moves require modification because F-moves are awkward one-handed and are typically replaced with sequences involving rotations.

The complete OH algorithm set is roughly the same size as the two-handed set (57 OLL + 21 PLL) but with perhaps 30-40 percent of the algorithms being substantially different sequences. A solver transitioning from two-handed to OH must essentially relearn half of their algorithm library, which takes 6-12 months of dedicated practice for an already-strong solver.

### Cube Hardware for OH

OH solvers tend to prefer cubes that are lighter than typical speedcubes. A standard speedcube weighs 75-90 grams; OH solvers often use cubes in the 50-60 gram range, sometimes by removing weights from the design or choosing specific models marketed for OH. A lighter cube turns more easily with the limited torque available from one hand and reduces fatigue over a competition day.

Magnet strength is also typically reduced for OH. Strong magnets that snap the cube into place are useful two-handed because they prevent over-turning, but one-handed they create resistance that the cuber cannot overcome efficiently. Many OH solvers use cubes with weaker magnets or with adjustable magnet strength tuned to the OH specifically.

Corner cutting — the ability of the cube to start the next move before the previous move is fully complete — is critical for OH because the cuber cannot easily realign a cube that has stalled mid-move. Cubes with high corner-cutting tolerance (45 degrees forward, 30 degrees reverse) are strongly preferred. The MoYu WeiPo One-Handed, the Gan 11 M Pro OH edition, and several Yuxin and YJ models marketed specifically for OH have been adopted by top competitors over the years.

### Left-Hand vs Right-Hand OH

The OH world is largely right-hand-dominant, simply because most humans are right-handed and most cubers use their dominant hand for one-handed solving. But left-hand OH has grown as a discipline, with several top competitors using their left hand by preference or because of injury accommodations. The choice of hand is purely personal and has no inherent impact on potential performance; the world records have been held by both right- and left-hand solvers.

Some cubers practice both hands and switch based on the cube or the day. This is rare but has been done by a few well-known names; the trade-off is that practicing two different fingertrick libraries dilutes the practice for each. Most serious OH competitors stick with one hand and develop it to its full potential.

### Notable OH Achievements

The 5.32 second world record set by Park is currently the lowest official OH single. The average record has come down to the high 6 second range, which means the typical solve at the highest level is around 7 seconds — comparable to two-handed averages from the early 2010s. The OH world record progression has roughly tracked the two-handed progression at a one-decade lag: OH today is about where two-handed speed was in the mid-2010s.

The sub-5 OH solve has not yet been achieved officially. The theoretical possibility is real: a near-perfect OH solve could conceivably execute in 4.5 seconds, but the alignment of an easy scramble, a perfect cube, and a flawless execution one-handed has not yet coincided. The first sub-5 will be a major moment in the discipline and is widely expected within the next 3-5 years.

The OH category has its own community of specialists who focus primarily on OH rather than treating it as a secondary event. These specialists tend to push the algorithmic and fingertrick boundaries of the discipline because their training time is concentrated on OH rather than divided across multiple events. The two-handed specialists who dabble in OH typically achieve respectable results but rarely break into the absolute top tier.

## Blindfolded (3BLD)

Blindfolded 3x3, often called 3BLD, is the most cerebrally demanding of the standard speed events. The cuber receives a scrambled cube and a blindfold. The clock starts when the cuber begins examining the cube. The cuber memorizes the scramble (with eyes open, examining the cube freely), then dons the blindfold and executes a solution without ever looking again. The clock stops when the cube is solved or when the cuber gives up. Both phases — memorization and execution — count toward the total time.

The discipline has been part of the WCA program since 2003 and has its own dedicated subculture within speedcubing. The skills required are largely independent of speedcubing skills: a fast two-handed solver may be a mediocre blindfolded solver, and vice versa. The blindfolded community has its own world records, its own training methods, its own algorithm sets, and its own culture of friendly rivalry.

### Format and Rules

3BLD uses a best-of-three format at most competitions, where the best of three independent attempts counts as the result. Both single and mean of three are tracked as separate categories. The cube and blindfold are provided by the competition. The blindfold must cover the eyes completely; some kind of cloth eye-cover is standard, sometimes with a chin guard to prevent the cuber from peeking down. The solver is allowed to use their own blindfold if they prefer.

The cube must be at rest before the solver begins memorization; the solver may pick it up and rotate it freely. The clock starts when the solver indicates they have begun memorization (typically by pressing the timer's start button or by signaling to the judge). At any point during the attempt, the solver puts on the blindfold and begins execution. Once the blindfold is on, the solver may not remove it before the cube is solved — doing so results in a DNF. The clock stops when the cube is solved or when the solver gives up.

A solve where the cube ends up in an incorrect state (some pieces not solved) is a DNF regardless of how close the solver came. A solve where a few cubies are misoriented is also a DNF; the cube must be in a fully solved state.

### Methods

The three main methods for 3BLD are Old Pochmann (OP), M2, and 3-style. Each has distinct characteristics:

**Old Pochmann (OP)** is the entry-level method, named for the German cuber Stefan Pochmann who developed it in the early 2000s. The method uses simple setup moves and a single repeating algorithm (the T-perm for corners, the Y-perm or similar for edges) to permute pieces one at a time. The setup moves bring a target piece into a known position, the standard algorithm cycles three pieces, and an undo of the setup moves returns the cube to its prior state with the targeted piece now in place. OP is conceptually simple but extremely slow in execution; a strong OP solver might achieve 60-second solves, while world-class 3BLD is in the 12-15 second range.

**M2** is a hybrid method developed by Stefan Pochmann (yes, the same Pochmann) that uses an M-slice variant for edges, dramatically reducing execution time over OP. The corners still typically use OP. M2 is the standard intermediate method, used by most competitive 3BLD solvers who have not yet learned full 3-style. A good M2 solver can achieve sub-30 second solves.

**3-style** is the advanced method that powers all top-level 3BLD. The method uses commutator triples (sequences that cycle three pieces in a specific way) to solve groups of three pieces at a time. There are 378 distinct corner triples and 378 distinct edge triples that a full 3-style user must know — though in practice the most commonly occurring cases are memorized as separate algorithms while rarer cases are derived on the fly from general commutator principles. A 3-style solver might know 200+ memorized commutators and derive the others as needed.

The transition from OP to M2 to 3-style is a major undertaking in a 3BLD solver's development. Each transition requires months or years of practice as the new algorithm set is learned and integrated. Most serious 3BLD solvers reach 3-style for one of the two phases (corners or edges) first and then expand to full 3-style over additional months.

### Memorization Systems

The defining challenge of 3BLD is memorizing the scramble accurately and recalling it during execution. The memorization is encoded as a sequence of letter pairs, where each pair represents a piece to be solved. The letter encoding maps each of the 24 corner positions (with 3 stickers each = 72 stickers) and each of the 24 edge positions (with 2 stickers each = 48 stickers) to specific letters of the alphabet. A scramble produces approximately 11 corner letters and 11 edge letters, for a total of about 22 letters or 11 letter pairs.

Letter pairs are typically encoded as mnemonic images for easier memorization. A pair like "AB" might be encoded as "Apple Banana" or as a more visual image — perhaps an apple on top of a banana, or an apple with banana ears. The mnemonic images are personal; each solver develops their own letter-pair vocabulary over years of practice. Strong solvers can encode and retrieve any of the 676 (26 × 26) possible letter pairs in under a second.

The encoded images are then stored in a "memory palace" or "loci" — a mental sequence of locations through which the solver mentally walks while executing. A solver might use the rooms of their childhood home, or the path from their bed to the bathroom, or any other well-known sequence. As the solver walks through the locations, they "see" the images they placed there, decode them back to letter pairs, and execute the corresponding algorithms.

The memorization process for a single scramble takes 5-15 seconds for a top solver, with the execution taking another 5-10 seconds. The combined memorization-plus-execution time is the official result. Strong solvers spend more time on memorization (often 70 percent of their total time) than on execution because a confused execution from a poor memory is far slower than the additional seconds of careful memo time.

### World Record Holders

The 3BLD world record single is approximately 12.13 seconds by Max Hilliard of the United States. Hilliard is one of the most decorated 3BLD competitors in history; his record represents the absolute peak of human performance in the discipline. The mean-of-three record is held by Tymon Kolasinski of Poland at approximately 12.59 seconds, a remarkable consistency that demonstrates the maturity of the technique.

Earlier eras of 3BLD were dominated by different names. Marcin Kowalczyk of Poland held world records in the early 2010s and was widely regarded as the strongest 3BLD solver of his era. Kaijun Lin of China and Daniel Sheppard of the UK have also held records. Each generation has produced a small handful of dominant solvers whose records seemed unbreakable at the time but eventually fell to the next wave.

The 3BLD records have come down from the 60+ seconds of the early 2000s to the sub-15 of today, a fourfold improvement in two decades. The progression has been driven primarily by adoption of 3-style and by improved mnemonic techniques. The next breakthrough — sub-10 seconds — would require either a fundamental change in technique or an exceptional alignment of an easy scramble with a flawless execution. The community consensus is that sub-10 is possible but not in the near term.

### Training Volume

Top 3BLD solvers train approximately 100-200 solves per week, with each solve taking 30 seconds to 5 minutes depending on level. The training volume in time is roughly 5-10 hours per week, comparable to top speedcubing training. The bulk of training is structured practice on specific case types, where the solver repeatedly attempts solves with particular memorization or execution challenges.

Mnemonic training — the development of the letter-pair vocabulary — is a separate but related practice. Solvers maintain spreadsheets of their letter pair images and review them regularly to ensure rapid recall during competition. New images are added periodically as the solver finds better mnemonics for difficult pairs.

The 3BLD community is small enough that training resources are shared freely. Online groups, Discord servers, and forums provide structured training plans, scramble sets with known properties, and discussion of techniques. The community is also notable for its tolerance for less-experienced participants; the conversion from novice to competitive 3BLD takes years, and the community welcomes the journey rather than gatekeeping the advanced ranks.

## Multi-Blind (MBLD)

Multi-Blind, abbreviated MBLD, is the most extreme of the blindfolded events. The competitor receives some number of cubes (called the "attempt count"), has up to one hour to memorize all of them, then dons a blindfold and solves them all sequentially without removing the blindfold or seeing any cube. The result is scored as the number of cubes solved minus the number unsolved, with various technical refinements for tiebreaking.

MBLD has been part of the WCA program since 2003. The discipline pushes human memory to its absolute limits and is widely regarded as the most cognitively demanding event in the cubing world.

### Format and Scoring

The competitor declares an attempt count before the round begins — typically anywhere from 5 to 65 cubes. The competitor has one hour total for memorization and execution combined; they may not exceed this time without DNF'ing the entire attempt. The result is scored using a formula: solved cubes minus unsolved cubes (positive results count toward the leaderboard) plus a time component used for tiebreaking. A result of "62 solved out of 65 attempted" produces a primary score of 62 - 3 = 59, with the time component breaking ties between solvers with the same primary score.

The cubes must be all standard 3x3 cubes provided by the competition. Each cube is scrambled with a unique scramble and is set out in front of the competitor in a known order. The competitor memorizes them in order, then executes them in the same order (typically, though some MBLD methods involve memorizing in one order and executing in a different one).

A DNF on a single cube counts as that cube being unsolved. A few cubes being unsolved is acceptable and may still produce a positive score; the goal is to maximize the net solved count, not to perfectly solve every cube. Many top MBLD attempts include 1-3 unsolved cubes, where the competitor's memory failed on those specific cubes but succeeded on the others.

### World Record Holders

The current MBLD world record is approximately 62 out of 65 attempted by Graham Siggins, achieved in 2023. This represents an extraordinary memorization feat: 65 different cube scrambles, each requiring approximately 22 letters of memorization, for a total of approximately 1,430 distinct letter encodings held in memory for the full hour. Siggins is one of the few competitors who has consistently broken 50 cubes and the only one (as of late 2025) to have officially scored above 60.

Stanley Chapel of the United States, the prior world record holder before Siggins, achieved 59 solved out of 60 attempted in 2022. Chapel's record represented a different style — slightly more conservative on attempt count but with extremely high accuracy. Both Siggins and Chapel have demonstrated that the upper bound of MBLD is not just a function of raw memory capacity but of the combined accuracy of memorization and execution.

Before Chapel, the world record had been held variously by Marcin Kowalczyk, Maskow, and several other competitors who pushed the boundary forward one or two cubes at a time. The progression from the early 2000s (when 5-cube attempts were notable) to 2025 (when 60+ cube attempts are the world-record standard) represents one of the most remarkable improvements in any cubing discipline.

### Memorization Technique

MBLD memorization is the limiting factor in the discipline. Approximately 95 percent of the hour is spent memorizing; the actual execution of 60 cubes takes perhaps 5-10 minutes when running at full speed. The memorization technique requires holding 1,000+ distinct letter pair images in a sequential memory palace for the duration of the hour, with sufficient strength that they can be recalled in reverse order during execution.

Top MBLD solvers use a "memory palace stacking" technique where each cube has its own location within a larger structure. For example, a cube might be assigned a specific room in a memory palace, with the letter pairs for that cube placed at specific locations within that room. The competitor walks through the rooms in order during memorization and again during execution.

The audio memo technique, popularized by several top MBLD solvers, uses spoken mnemonics rather than purely visual ones. The solver verbalizes each letter pair as a memorable phrase ("apple banana, cherry date, elderberry fig") and links the phrases together with a continuous narrative. The audio approach is faster to encode but more vulnerable to interference; the solver must maintain mental silence during execution to avoid disrupting the audio memory.

A typical MBLD attempt at the 50+ cube level breaks down as: 45 minutes of memorization, 10 minutes of execution, 5 minutes of buffer. The competitor must pace themselves carefully; running over time on memorization leaves insufficient execution time and risks DNF on later cubes.

### The "Marathon" Memo Technique

The Marathon memo is a specific technique developed by top MBLD solvers for the very high attempt counts (50+). The technique involves splitting the cubes into batches (typically 10-15 cubes each), fully memorizing each batch before moving to the next, and using deeper mnemonic encoding for the early batches to ensure they survive in memory through the hour. The later batches use lighter encoding because they will be executed shortly after memorization; the early batches need heavier encoding to survive the 40+ minutes between memorization and execution.

The technique also involves explicit "rehearsal" periods where the competitor mentally walks through the early batches midway through memorization to reinforce them. This rehearsal might consume 5 minutes of total time but prevents catastrophic memory failure on the early cubes.

### Training Demands

Top MBLD competitors train approximately 10-15 hours per week, with the bulk of that being memorization drills rather than full attempts. A full attempt is exhausting and cannot be done daily; most competitors do 1-2 full attempts per week with smaller drills filling the rest of the practice time. The cumulative training over years produces the deep mnemonic vocabulary and the mental stamina required for hour-long memorization sessions.

The training resources for MBLD are limited; the discipline is small enough that most knowledge is passed from individual to individual through Discord chats and personal coaching. A handful of online resources document the basic techniques, but the deep practice methods of the top competitors are largely undocumented in any systematic way.

## 3x3 With Feet (Retired)

3x3 With Feet was a WCA event from 2003 to 2020 where competitors solved a 3x3 cube using only their feet. The cube rested on a mat or piece of cloth on the floor; the competitor sat in a chair or on the floor, lifted their bare or socked feet to the cube, and manipulated it through the entire solve. The event was the most physically demanding of the standard cubing disciplines, requiring foot dexterity that few people had reason to develop.

### Format and Performance

3x3 With Feet used the standard average-of-five format. The world record at the time of retirement was approximately 14-15 seconds, held by Mohammed Aiman of Indonesia and others. The record had come down dramatically from the 60+ second range of the early 2000s as competitors developed better techniques for foot-based manipulation.

The fastest competitors developed astonishingly precise foot dexterity, performing fingertricks — or rather toe-tricks — with the same precision a two-handed solver would use. The technique typically involved one foot acting as a "stable platform" holding the cube in place while the other foot performed the turns. The mat or cloth under the cube provided friction so that the cube did not slide during turning.

### Why It Was Retired

The 3x3 With Feet event was retired by the WCA in 2020 for a combination of reasons. The primary concern was hygiene: feet are less clean than hands by default, and the cubes used for the event accumulated dirt, sweat, and odor in ways that other cubes did not. Sharing a cube between competitors was awkward; the event organizers had to either provide individual cubes per competitor (expensive and inefficient) or extensively clean shared cubes between attempts (time-consuming).

The secondary concern was popularity. The event had a small but dedicated competitor base, but its appeal to new cubers was limited. The physical demands and the unusual nature of the event made it a niche pursuit, and the WCA's general direction in the late 2010s was to streamline the event list to maintain focus on the most-practiced disciplines.

The event was officially retired effective December 31, 2019, with results from competitions before that date remaining in the historical records. Some competitors and organizers protested the retirement, arguing that it eliminated a discipline they had spent years developing skill in; the WCA's decision was final and the event has not been reinstated.

### Legacy

The legacy of 3x3 With Feet lives on in occasional unofficial competitions and in personal challenges. Some competitors continue to practice the discipline as a hobby and post personal records online. The event will not likely return to the WCA program, but it remains part of the historical cubing record and is occasionally referenced in retrospective coverage of the sport.

## WCA Tournament Regulation

The World Cube Association maintains a regulations document that defines, in detail, what counts as a legal solve at a sanctioned competition. The regulations cover everything from the size and color of cubes to the specific phrasing a judge must use when calling a competitor to the table. The document is revised annually based on community feedback and is the authoritative reference for all competition disputes.

### Format Definitions

The WCA defines several formats for events: Bo1 (best of 1, single attempt), Bo2 (best of 2), Bo3 (best of 3, take the best), Ao5 (average of 5, drop best and worst, average the middle three), and Mo3 (mean of 3, simple average without trimming). The format used for each event is fixed in the regulations: 3x3 uses Ao5 for most rounds, Bo1 for some preliminary rounds; FMC uses Mo3 for most rounds, Bo1 for some smaller competitions; BLD uses Bo3 always; MBLD uses Bo1 always; and so on.

The Ao5 trimmed-mean format is the most commonly seen at competitions. It produces a result that emphasizes consistency over peak performance: a competitor with five solves of 8.50, 8.60, 8.70, 8.80, and 8.90 has an Ao5 of 8.70 (drop the 8.50 best, drop the 8.90 worst, average the middle three at 8.60+8.70+8.80=26.10/3=8.70). A competitor with five solves of 7.00, 9.00, 9.00, 9.00, and 11.00 has an Ao5 of 9.00 (drop the 7.00, drop the 11.00, average the three 9.00s). The Ao5 thus rewards a consistent middle-three performance over a spike-and-crash distribution.

### DNF and DNS Treatment

A DNF (Did Not Finish) result is treated as the worst possible result in any aggregate. In an Ao5, a single DNF is "dropped" as the worst result, leaving the other four to compute the average (best-of-4 → average of 3 minus best → middle three). Two DNFs cause the Ao5 itself to be DNF, because the dropped-worst would still leave one DNF in the averaged middle three.

DNS (Did Not Start) is treated identically to DNF for averaging purposes but indicates the competitor never attempted the solve (typically because the round ended before their attempt). DNS results are noted in the records but do not affect the competitor's official result for the round.

### The +2 Penalty

The +2 penalty is applied for various technical infractions. The most common is finishing a solve with one or more cubies "misaligned" — turned within one move of solved but not fully solved. If a face is misaligned by 45 degrees or less when the timer stops, the result receives a +2 added to the time; if misaligned by more than 45 degrees, the solve is a DNF.

Other +2 penalties include: exceeding the 15-second inspection time but stopping within 17 seconds (+2; over 17 is DNF), starting the timer before the cube is placed on the timing mat (+2), bumping the timing mat during solve (+2). The penalties are designed to provide a graceful degradation between "small mistake" and "complete failure" rather than punishing minor errors with a full DNF.

### Inspection Time

The 15-second inspection is the standard preparation phase for a speedsolving attempt. The competitor begins inspection when the judge calls "Go" or similar, picks up the cube, examines it freely (turning faces is not allowed during inspection, but rotating the entire cube is), and begins the solve by pressing the timer's start button. Inspection time begins when the competitor first looks at the cube and ends when the timer starts.

Exceeding 15 seconds of inspection results in a +2 if the timer is started within 17 seconds. Exceeding 17 seconds results in a DNF. The +2 buffer between 15 and 17 seconds is a safety margin to account for human reaction time; cubers who hit "start" at 14.8 seconds occasionally see the timer register as starting at 15.1 seconds, and the buffer prevents these near-misses from being penalized.

The judge is responsible for calling out timing milestones during inspection: typically "8 seconds" at 8 seconds elapsed and "12 seconds" at 12 seconds elapsed, giving the competitor verbal cues about their remaining time. The judge does not call "15 seconds" because by that point the competitor should be starting their solve; instead the timer's automatic detection takes over.

### The Solve Flow

The standard solve flow at a competition is: (1) Judge calls the competitor's name. (2) Competitor approaches the timing table and sits down or stands behind the cube. (3) Judge places the cube on the mat with the orientation determined by the scramble protocol. (4) Judge says "Go" or signals the competitor to begin. (5) Competitor begins inspection. (6) Competitor releases the timer with both hands on the start pads, then lifts hands to begin solving. (7) Competitor solves the cube and presses both pads simultaneously to stop the timer. (8) Judge checks the cube for solved status, applies any penalties, and records the result.

Variations exist for the blindfolded events (where the timer flow includes the blindfold), the FMC events (where there is no clock-based timer; the round simply ends after one hour), and the MBLD events (where the hour-long countdown is the timer). The fundamental structure of competitor-judge interaction is the same.

### Cutoffs and Round Structure

Most competitions use a multi-round structure where the field is progressively narrowed. A first round might include 100 competitors all attempting the event; the top 75 advance to the second round; the top 16 advance to the final round. The exact numbers vary by competition; the WCA regulations specify minimum advancement percentages but allow organizers to set higher cutoffs.

Cutoffs are time-based filters within a round: a competitor must achieve a time below the cutoff within their first 2 of 5 attempts to be allowed to complete all 5. If the first 2 attempts are both above the cutoff, the competitor is finished with that round and their result is the best of those 2. This mechanism is used to limit the time required per competitor at large competitions where many competitors are slow.

Final rounds typically have no cutoff; all qualified competitors complete all 5 attempts. The top 3 places receive medals or trophies; the top 1 receives the title of "champion" of that competition.

### Disputes and Appeals

If a competitor disagrees with a judge's ruling (typically a +2 or DNF determination), they may appeal to the WCA delegate at the competition. The delegate reviews the situation, talks to the judge and competitor, and makes a final determination. The delegate's ruling is final; further appeals are not allowed except in extreme cases involving misconduct by the delegate themselves.

The delegate is a WCA-certified representative trained to interpret regulations and apply them consistently. Every WCA competition must have at least one delegate present. The delegate's authority over the competition is essentially absolute within the scope of the regulations.

## The TNoodle Scrambler

TNoodle is the open-source scrambling program used by the World Cube Association to generate the random scrambles applied to cubes before each solve. Since 2009, TNoodle has been the official scrambling tool for all WCA competitions worldwide. The program is written in Java, runs on any operating system, and is freely available for anyone to download and use.

### Pre-TNoodle Era

Before 2009, WCA competitions used various ad-hoc methods to generate scrambles. Some used printed lists of pre-generated scrambles from cubing websites; some used hand-scrambled cubes (a particularly common approach in the early 2000s); some used early scrambling programs that ran on specific machines. The lack of a standardized tool meant that scramble quality varied widely between competitions, and there were occasional disputes about whether a particular scramble was "fair."

The community recognized that a standardized, open-source, audited scrambling tool would solve most of these problems. The TNoodle project was initiated by several community members, with the design philosophy of being verifiable, reproducible, and statistically fair. The first official release was approved by the WCA in 2009, and within a year all sanctioned competitions had adopted it.

### Algorithm

TNoodle generates scrambles using Cube Explorer's two-phase algorithm under the hood for 3x3 (with similar IDA* search algorithms for other events). The two-phase algorithm, developed by Herbert Kociemba, finds near-optimal solutions to scrambled cubes; TNoodle uses this in reverse, generating random scrambled states and then finding short scramble sequences that produce them.

The output scrambles for 3x3 are typically 18-22 moves long in HTM. The length is calibrated to be:
1. Long enough that the scrambled state is essentially random and uncorrelated with the start state.
2. Short enough that the scramble can be applied to a cube in a reasonable amount of time (under 30 seconds for a fast scrambler).
3. Reproducible: given the random seed, the same scramble is generated every time.

The randomness comes from Java's built-in PRNG (pseudo-random number generator), with the seed derived from the competition's unique identifier plus the round number plus the scramble number. This ensures that the same seed always produces the same scramble, which is critical for verification: if a scramble produces a disputed cube state, the seed and resulting scramble can be checked.

### Statistical Properties

The scrambles produced by TNoodle have been extensively studied for statistical properties. The scrambled states are uniformly distributed over the 4.3 × 10^19 possible cube positions, meaning every solvable position has equal probability of being generated. The scramble lengths follow a distribution centered around 21 moves with standard deviation of about 1-2 moves.

The community has occasionally identified subtle biases in TNoodle's output, typically related to specific edge cases in the random number generator or to corner cases in the scramble length distribution. These have been promptly fixed by the maintainers in subsequent releases. The 2014 release included a notable fix for a minor distribution bias that had been present in earlier versions; the fix did not invalidate any historical records but did improve future scrambles.

### Scramble Verification

TNoodle scrambles are recorded by the competition organizers and can be reapplied to a cube to verify the scrambled state. This is critical for handling disputes: if a competitor claims the cube they were given did not match the scramble (perhaps because the scrambler made an error), the original scramble can be reapplied to a fresh cube and compared against the disputed cube.

The verification system also enables the WCA's results database to include the scramble for each result. Researchers and curious cubers can examine the scramble that produced a particular world record and analyze the solve that was performed against it. This level of transparency is unique among sports; very few competitive disciplines have such detailed records of the exact conditions of each performance.

### Multi-Event Support

TNoodle supports all WCA events: 2x2, 3x3, 4x4, 5x5, 6x6, 7x7, BLD events, OH, FMC, Pyraminx, Megaminx, Skewb, Square-1, and Clock. Each event has its own scrambling algorithm tuned to the puzzle's mechanics. For FMC specifically, TNoodle generates scrambles that are exactly 25 moves long with no rotations, providing a clean and consistent starting state for the analytical solve.

The MBLD event has special handling because each cube in the attempt needs its own scramble. TNoodle generates the requested number of scrambles in a batch, ensuring that they are all independent random states.

### Version History

TNoodle has had several major version increments since 2009. The current version (as of 2025) is TNoodle 4+, with various incremental fixes and event support additions. The version number is tracked in the competition records, allowing historical analyses to account for any algorithmic changes between versions.

The TNoodle source code is hosted on GitHub and is maintained by a small team of volunteer developers, primarily community members who are also active cubers. Pull requests and bug reports are welcomed; the code has been extensively reviewed by independent third parties to ensure no backdoors or biases.

## Tournament Organization

A WCA competition is organized by a local team — typically 3-10 individuals who handle the logistics — under the supervision of a WCA delegate. The team handles venue booking, registration, sponsorship, staffing, equipment, food, and post-competition wrap-up. The delegate handles results upload, regulations interpretation, and any disputes that arise during competition.

### The Delegate Role

WCA delegates are trained volunteers who have been certified by the WCA after extensive testing on the regulations and the technical procedures. Becoming a delegate typically requires being an established member of the cubing community, passing a written examination on the regulations, completing several apprentice competitions under existing delegates, and being approved by the WCA Board.

Delegates serve as the authoritative representatives of the WCA at competitions. They ensure that the regulations are followed, that scrambles are applied correctly, that judges interpret the rules consistently, and that any disputes are resolved fairly. Their authority is final at the competition; appeals beyond the delegate go to the WCA Board, which rarely overturns delegate decisions.

There are approximately 500 active WCA delegates worldwide as of 2026, distributed across all continents. Each region has its own delegation hierarchy, with senior delegates supervising junior ones and a continental representative coordinating overall.

### Competition Process

The typical competition process unfolds over several months:

1. **Pre-announcement** (3-6 months before): The organizers identify a venue, set a date, and submit the competition plan to the WCA for approval. The plan includes the events, the format for each event, the cutoffs, the registration limits, and the qualifying procedures.
2. **Announcement** (2-3 months before): Once approved, the competition is announced publicly. Registration opens.
3. **Registration** (2-3 months before to 2 weeks before): Cubers register for the events they want to compete in, paying a registration fee that typically covers venue rental and prizes. Registration is usually capped at the venue's capacity.
4. **Pre-competition logistics** (2 weeks before to day of): Organizers finalize the schedule, recruit judges and scramblers, prepare the timing equipment, and order any food or merchandise.
5. **Competition day(s)**: Events are run according to the schedule. Each event has its own judging and scrambling crew. Results are recorded on paper or directly in the WCA Live application.
6. **Results upload** (within a few days after): The delegate uploads the results to the WCA database. The results become official and are added to each competitor's WCA profile.

### Judge and Scrambler Roles

Judges are recruited from the cubing community, typically other competitors who are not actively competing in that event at that time. A judge sits at the timing table, instructs the competitor through the standard solve flow, handles the timing equipment, and records the results. Judging is volunteer work; judges typically earn nothing beyond a free meal at the competition.

Scramblers are also volunteers. They sit in a separate area, often hidden from the competitors, and apply the TNoodle-generated scrambles to cubes that will be passed to the judges. Scrambling is repetitive and requires concentration; an incorrect scramble can invalidate an entire round of an event. Scramblers typically take shifts to manage fatigue.

### WCA Live and Results

WCA Live is a web-based application that handles real-time competition management. Organizers enter scrambles, judges record results, and competitors see their times update live on the application. WCA Live also handles competitor check-in, schedule display, and final results publication.

After the competition, results are exported from WCA Live and uploaded to the WCA database. The database is the canonical source for all WCA results since 2003 and is publicly accessible. It contains over 4 million individual solve results across hundreds of thousands of competitors.

### Top-Tier Competitor Schedules

Top international cubers compete at 20-30 competitions per year. Each competition is a 1-2 day event, often requiring 1-2 days of travel before and after. The annual time commitment for a serious competitor is substantial; many top cubers report 100+ days per year directly related to competition.

The most prestigious competitions on the international calendar include the World Championship (held every 2 years), the continental championships (Europeans, Asians, North Americans, South Americans, Africans, Oceanians), and various major regional championships (US Nationals, China Championship, etc.). The WCA also sanctions thousands of smaller competitions per year at the local and regional level.

## History of WCA Rule Changes

The WCA's regulation set has evolved significantly since the organization's founding in 2003. Major rule changes have typically been in response to specific issues that arose at competitions or in response to technological developments in the cubing world.

### 2003: Founding

The WCA was founded in 2003 at the second-ever World Championship (the first had been held in 1982). The initial regulations covered the basic rules of the major events: 3x3, 4x4, 5x5, BLD, FMC, OH. Many of the procedural details that are now taken for granted were unspecified or loosely specified in the original regulations.

### 2008: Video Proof for World Records

In 2008, the WCA introduced a requirement that world record attempts be recorded on video. This was in response to a few disputed results from earlier years where the integrity of the scramble or the solve was questioned. The video requirement allows the WCA Board to review world record attempts after the fact and confirm or invalidate them.

The video requirement is enforced for world records only; ordinary competition results are not subject to video review. Most competitions record all solves regardless because video is useful for training and post-competition analysis.

### 2009: TNoodle Standardization

In 2009, the WCA officially adopted TNoodle as the standard scrambling tool. This standardization eliminated the variation in scramble quality between competitions and improved the statistical fairness of results across the global circuit.

### 2010: Magnetic Cube Era Begins

While not a rule change, 2010 marked the rough start of the magnetic cube era in mainstream speedcubing. The original magnetic cubes were custom modifications; commercial magnetic cubes became widely available around 2012-2013. The WCA does not regulate cube modifications beyond requiring that the cube be functionally a standard 3x3 (or whatever puzzle the event calls for), so magnetic cubes are fully legal.

### 2012: Smart Cube Prohibition

In 2012, the WCA introduced a rule explicitly prohibiting "smart cubes" — cubes with embedded electronics that could record moves, give feedback, or assist the solver. This was in response to the early appearance of smart cubes in the market; the WCA wanted to ensure that competitions remained tests of human ability rather than human-plus-electronics ability.

Smart cubes for personal training and home use are completely legal and increasingly popular; the prohibition applies only to use during competition attempts.

### 2020: Retirement of 3x3 With Feet

In 2020, the 3x3 With Feet event was retired from the WCA program. The reasons (hygiene and popularity) are discussed above.

### 2023: Updated World Record Validation

In 2023, the WCA updated its procedures for validating world records. The changes were minor and procedural — clarifying the video requirements, specifying how disputed records would be reviewed, etc. — but they reflect the increasing importance of world records in the modern cubing era.

### Other Ongoing Changes

The regulations are revised annually based on community feedback. Most revisions are minor — clarifying ambiguous wording, adding new event support, updating delegate procedures — but occasional major changes occur. The annual regulations revision is led by the WCA Regulations Committee, a group of delegates and community members who review proposed changes and recommend approval or rejection to the WCA Board.

## Notable Competitions to Study

The history of competitive cubing is densely populated with notable competitions that shaped the discipline. A few stand out as particularly important reference points for understanding the modern era.

### WC1982 Budapest

The first World Championship, held in Budapest, Hungary in 1982. The event was a one-off (the next world championship would not occur until 2003) and was won by Minh Thai of the United States with a result of 22.95 seconds — a time that would have been competitive at any competition through about 1990 but would be far from the medals at any modern competition.

WC1982 is included in the WCA's historical records as the founding event of competitive cubing. The scrambles, results, and event protocols of WC1982 are preserved in the WCA database. The event is the canonical "WCA event zero" for any historical analysis.

### WC2003 Toronto

The second World Championship, held in Toronto, Canada in 2003. This is the founding event of the WCA in its modern form. The WCA was formally established at this competition and the modern regulation set was first deployed. The event was won by Dan Knights of the United States with a time around 20 seconds.

WC2003 marked the beginning of the continuous WCA results record. Every result since this competition is in the database and is part of the official WCA history.

### WC2008 Budapest

The 2008 World Championship returned to Budapest. This event was notable for Erik Akkersdijk's 7.08 single, which was a world record at the time and brought significant public attention to the discipline. The event also featured the first BLD international scene with serious 3BLD competition at the global level.

### WC2009 Düsseldorf

The 2009 World Championship in Düsseldorf, Germany, was notable for being the first major event after the WCA's adoption of TNoodle. The standardized scrambling led to a more level competitive field and reduced disputes about scramble quality.

### WC2011 Bangkok

The 2011 World Championship in Bangkok, Thailand, marked the rise of Asian dominance in cubing. The event was won by Michał Pleskowicz of Poland but featured a much stronger Asian contingent than previous championships, foreshadowing the shift that would accelerate through the 2010s.

### WC2013 Las Vegas

The 2013 World Championship in Las Vegas, USA, featured the continued dominance of Feliks Zemdegs of Australia and the rise of several younger competitors who would become household names in the cubing community. Zemdegs's continued world record holding made him one of the most recognizable figures in the discipline.

### WC2017 Paris

The 2017 World Championship in Paris, France, marked the beginning of the Yusheng Du era. Du finished as a strong contender but did not win; he would set the world record at a regional competition the following year, ushering in a new generation of top cubers.

### WC2019 Melbourne

The 2019 World Championship in Melbourne, Australia, was the pre-pandemic peak of the cubing world. The event featured record-breaking attendance, sponsorship, and media coverage. Several discipline records were set at the event, and the overall mood of the cubing community was optimistic about continued growth.

### WC2023 Incheon

The 2023 World Championship in Incheon, South Korea, was the first major international event after the COVID-19 pandemic. The event was widely seen as a successful return to normal operations, with attendance and competition quality matching pre-pandemic levels. The event also featured the rise of several young Asian competitors who would become dominant in the following years.

### WC2025 Seattle

The most recent World Championship at the time of this writing was Seattle 2025, where Yiheng Wang of China set a 3.08 second 3x3 single, the current world record. Wang's performance at Seattle was widely seen as the announcement of a new era of dominance and was the subject of extensive coverage in cubing media. The competition also featured strong performances across all other events and marked a high point in international participation.

## FMC and Speedcubing Intersection

A common observation in cubing circles is that top speedcubers and top FMC solvers are rarely the same people. The skills required by the two disciplines are quite different: speedcubing rewards rapid pattern recognition and physical execution, while FMC rewards analytical depth and patience. The two skills can coexist in the same person, but it is rare for someone to be world-class at both.

### Why Top Speedcubers Are Not Top FMC Solvers

A top speedcuber spends years training the speed of recognition and execution. They are not training the kind of deep analytical patience required for an hour-long FMC attempt; in fact, the speed-oriented training may actively work against the patient analytical approach.

Conversely, top FMC solvers often have only moderate speed because they have spent their training time on analytical depth rather than physical execution. A solver who can find a 17-move solution in 30 minutes is impressive in FMC even if their two-handed average is 15 seconds (a moderate but not world-class speed time).

There are exceptions. Some solvers maintain both skills at a high level, with Sebastiano Tronto being a notable example: he is a world-class FMC solver and also a strong speedcuber. But Tronto's two-handed average, while solidly sub-10, is not at the world-record level. The trade-off between the two skill sets seems to be real and inherent to the cognitive demands.

### Slow FMC Influence on Speed

The concept of "slow FMC" describes the practice of speedcubers occasionally finding very short solutions to scrambles during normal solving, even if they cannot consistently produce them. A speedcuber who routinely finds 35-40 move solutions to scrambles is using "fast" methods; one who occasionally finds 25-30 move solutions during inspection is using a "slow FMC" approach that adds analytical depth to the inspection phase.

The "Tronto 16" effect refers to the way Sebastiano Tronto's 16-move FMC record influenced strategy adoption in the broader community. After Tronto's record, more cubers began studying skeleton-and-insertion techniques and incorporating analytical depth into their training. The FMC discipline thus has subtle but real effects on the speedcubing community even though most speedcubers do not compete in FMC.

### Cross-Pollination of Algorithms

Some algorithms developed for FMC have found their way into speedcubing algorithm sets. Specific commutators that produce particular states with elegant move sequences are sometimes adopted by ZBLL learners or by Roux solvers seeking optimal last-six-edges sequences. The cross-pollination goes both ways: speedcubing's library of efficient algorithms also provides starting points for FMC skeletons.

## Cubing as a Global Sport

The Rubik's Cube was invented in 1974 in Hungary and became a worldwide commercial phenomenon in 1980-1982. The first World Championship was held in Budapest in 1982. After a brief period of relative obscurity in the late 1980s and 1990s, the discipline revived in the early 2000s with the formation of the WCA and the standardization of competition formats. Since 2003, the discipline has grown continuously, with significant acceleration in the 2010s and 2020s.

### Geographic Distribution

The discipline is now truly global. The WCA has 100+ countries with active presence, including most major nations in every continent. The regional distribution of active competitors as of 2026 is approximately:

- North America: 1,000-1,500 actively competing cubers
- Europe: 2,000-3,000 actively competing cubers
- Asia: 3,000-5,000 actively competing cubers, with the bulk in China and India
- South America: 500-1,000 actively competing cubers
- Africa: 100-300 actively competing cubers
- Oceania: 100-200 actively competing cubers

"Actively competing" means having competed at a WCA-sanctioned competition within the previous two years. The total active competitor pool is approximately 6,000-10,000 individuals globally. Beyond the active competitive pool, there are an estimated 100,000+ casual cubers who solve the puzzle as a hobby but do not compete at sanctioned events.

The number of WCA-registered solves per year is approximately 5,000,000 in total across all events at all competitions worldwide. This represents a massive growth from the early 2000s, when annual solve counts were in the tens of thousands.

### Cultural Diffusion

The cubing community has a distinct culture that is largely consistent across countries but with regional flavor. The English-speaking community, the Chinese community, the Japanese community, and the European community each have their own influencers, their own forum and Discord cultures, their own conventions and tournaments. Communication between these communities is generally good, with results and techniques flowing freely across language barriers.

The community is notably young; the average age of an active competitive cuber is approximately 18 years old, with a long tail of older competitors and a substantial number of children under 12. The youth-heavy demographic is partly because the discipline rewards the rapid learning and visual processing that peaks in adolescence, and partly because the discipline is relatively new and the first generation of "lifetime cubers" is only now reaching middle age.

## The Future of 3x3 Events

Looking ahead, several questions about the future of 3x3-related events are worth considering.

### Will FMC Ever Go Below 14 Moves?

The theoretical floor for an FMC solution on a random scramble is roughly the average optimal solution length, which is approximately 17.4 moves. Some specific scrambles have shorter optima — perhaps 14 or 15 moves — and a sufficiently skilled solver who is lucky enough to draw such a scramble might produce a record-breaking result.

The community consensus is that a 14-move FMC single is mathematically possible but extremely rare; it would require both a very easy scramble (perhaps 1 in 50) and a solver who finds the optimum (perhaps 1 in 5 even for top solvers). A 13-move single would require an even rarer scramble (perhaps 1 in 500) and the perfect solve. Below 13 would require an essentially miraculous scramble distribution.

The record is unlikely to drop below 14 in the next decade. A 14 or 15 might happen within 5-10 years. Below 14 is essentially asymptotic in the foreseeable future.

### Will Smart Cube Events Become Official?

Smart cubes — cubes with embedded sensors that can record moves and provide real-time feedback — are increasingly popular for home training and online play. The WCA has explicitly prohibited smart cubes in competition since 2012 because they fundamentally change the nature of the sport.

There has been occasional discussion of creating a separate smart cube event category, where competitors would intentionally use smart cubes for online or AR-based competitions. Such an event would be a fundamentally different discipline from traditional speedcubing, requiring different skills (visual tracking of digital displays, for example) and different equipment. The WCA has not adopted any such event and shows no signs of doing so in the near term.

### Will Online Events Be Official?

Online cubing has grown significantly during and after the COVID-19 pandemic. Various online platforms (cubing.com, csTimer with online integration, etc.) host real-time competitions where cubers solve in their homes and submit results electronically. These results are typically validated through video review or smart cube data.

The WCA has not endorsed any of these platforms as official. The arguments for official recognition include accessibility (cubers in remote areas could compete without traveling) and reduced cost. The arguments against include verification challenges (preventing cheating is much harder remotely than in person) and concerns about the loss of community gathering at physical competitions.

The community consensus is that online events are valuable as a complement to in-person competitions but should not replace them. The WCA is likely to maintain in-person sanctioning as the primary model for the foreseeable future.

### Will VR Cubing Become a Discipline?

Virtual reality cubing — using VR headsets to manipulate a digital cube — has appeared in various forms. Some VR cubing applications are designed for training (helping cubers visualize and practice algorithms without a physical cube), some for entertainment (puzzle games with cube-like mechanics), and some for actual competition (events where competitors solve in a virtual space and times are recorded automatically).

VR cubing as a competitive discipline faces the same fundamental challenges as smart cubes and online events: it is a different sport from traditional cubing, with different skills and equipment requirements. The WCA shows no signs of recognizing VR cubing as an official discipline. The VR cubing scene exists as a separate community with its own infrastructure and is likely to remain so.

## Closing Notes on the Discipline Ecosystem

The five disciplines covered in this document — FMC, OH, 3BLD, MBLD, and With Feet — represent the breadth of what is possible with a single 3x3 cube. Each discipline rewards a fundamentally different skill: analytical depth for FMC, single-hand dexterity for OH, spatial memory for 3BLD, massive memory capacity for MBLD, and body mechanics for the retired With Feet event. The fact that they all use the same physical puzzle is one of the most remarkable aspects of cubing as a sport.

The WCA regulation framework, the TNoodle scrambler, the delegate system, and the competition infrastructure are the connective tissue that makes all of these disciplines possible. Without the standardization provided by these systems, each discipline would be a collection of disconnected attempts with no meaningful comparison; with them, each discipline becomes a global competitive sport with measurable progress over time.

The future of these disciplines depends on continued community engagement, on the maintenance of the regulatory infrastructure, and on the continued development of techniques and equipment. The community is healthy: the number of active competitors has grown continuously for two decades, the technique level has advanced steadily, and the global reach has expanded into new regions. The next twenty years will likely bring further improvements in records, the emergence of new techniques and tools, and perhaps the recognition of new disciplines that we cannot yet anticipate.

For the cuber considering which of these disciplines to pursue, the choice is largely personal. FMC rewards patience and analytical thinking; if you enjoy solving puzzles slowly and finding elegant solutions, FMC may be your discipline. OH rewards single-handed dexterity and an entirely new fingertrick library; if you find the standard two-handed solve too easy and want a fresh challenge, OH may interest you. 3BLD rewards memory and mental discipline; if you enjoy memory training and the satisfaction of solving without sight, 3BLD may be your calling. MBLD rewards extreme memory capacity and hour-long focus; if you have the patience for a 50+ cube memorization, MBLD may be your peak challenge. Each discipline has its own community, its own training methods, and its own rewards.

The standard 3x3 speed event — the discipline that gets the world records and the public attention — is just one of many. The breadth of the WCA event list ensures that any cuber, regardless of their particular skills or interests, can find a discipline where they can develop, compete, and find community. That breadth is one of the great strengths of the cubing world, and one of the reasons the sport has continued to grow and evolve from its origins in a Hungarian design studio in 1974 to a global competitive community in 2026 with millions of participants.

## Appendix: Detailed Solve Reconstructions

### The Tronto 16

Sebastiano Tronto's world record FMC single of 16 moves at FMC Europe 2019 has been extensively reconstructed and analyzed. The scramble for that attempt was a particular sequence that Tronto's analysis identified as having a 16-move optimal solution. The full reconstruction is publicly available in the cubing community archives.

The structure of Tronto's solution involved:
1. An initial block-building phase that established a 2x2x3 block in 6 moves.
2. A continuation that brought the cube to a near-solved state in 12 moves.
3. An insertion of a corner commutator that solved the remaining pieces with massive cancellation, producing the final 16-move count.

The solution is considered a masterclass in FMC technique. The choice of initial blocks, the recognition of the insertion opportunity, and the execution of the cancellation analysis are all at the highest level of FMC craft.

### The Cale Schoon 16

Cale Schoon's 16-move FMC single, set in 2018, used a different scramble and a different approach. Schoon's solution emphasized NISS — the normal-inverse switching technique — to build the block efficiently from both directions. The resulting 16-move solution had a different structural breakdown than Tronto's but achieved the same total move count.

The fact that two independent solvers achieved 16 moves on different scrambles, using different techniques, suggests that 16 is achievable for any sufficiently easy scramble by a sufficiently skilled solver. The record is currently tied, with both Tronto and Schoon recognized as co-holders.

### The Wenfei He Team 22.00

The Chinese team's 22.00 mean-of-three FMC result at China Championship 2020 represented the combined efforts of Wenfei He and two teammates. Each solver independently attempted one scramble in the standard hour. The three results were 22, 22, and 22, producing a mean of 22.00 — an extraordinary consistency.

The team's training before the event focused on producing results in the low-20s with high reliability, prioritizing consistency over peak single performance. The strategy paid off: while no single team member achieved a record-breaking single, the combined consistency produced a record team mean that has not been surpassed.

## Appendix: BLD Memorization Worked Example

To illustrate the 3BLD memorization process, consider a hypothetical scramble that produces the corner sequence: "AB CD EF GH IJ" (5 letter pairs) and the edge sequence: "KL MN OP QR ST UV" (6 letter pairs).

A solver might memorize this as:
- AB = "Apple Banana" → an image of an apple inside a banana
- CD = "Cat Dog" → an image of a cat petting a dog
- EF = "Egg Fish" → an image of an egg with fish scales
- GH = "Giant Hat" → an image of a giant wearing a hat
- IJ = "Ice Jelly" → an image of ice covered in jelly

And similarly for the edges.

The solver places each image in a specific location in their memory palace. The first image (AB) goes in the entryway of their house; the second (CD) goes in the living room; and so on. During execution, the solver mentally walks through the locations and "sees" each image, decoding it back to the letter pair and executing the corresponding commutator.

The entire process — memorization, walking through the palace, executing — takes a top solver approximately 12-15 seconds for a typical 3BLD scramble. The mnemonic system has been honed over years of practice to be as fast and reliable as possible.

## Appendix: TNoodle Internal Details

For the curious, the TNoodle program's internal workings can be examined in detail. The source code is hosted on GitHub at github.com/thewca/tnoodle, with a permissive license that allows anyone to download, modify, and audit the code.

The 3x3 scramble generation algorithm works roughly as follows:
1. A random seed is derived from the competition identifier, round number, and scramble number.
2. The seed initializes a Java PRNG (java.util.Random).
3. The PRNG generates a random cube state by sampling uniformly from the 4.3 × 10^19 possible states.
4. The Cube Explorer two-phase algorithm finds a near-optimal scramble sequence that produces the chosen state from the solved state.
5. The scramble sequence is output in standard notation (R U F L' D2 ...) for use at the competition.

The algorithm's randomness is fully deterministic given the seed, which allows for reproducibility. The audit trail for any official competition includes the seeds for all rounds, enabling any disputed result to be re-verified by regenerating the scramble.

The TNoodle source code is approximately 50,000 lines of Java, with most of the complexity in the scramble generation algorithms for the various puzzle types. The codebase is well-documented and has been reviewed by multiple independent cubing community members, contributing to confidence in its correctness.

## Appendix: WCA Regulation Document Structure

The full WCA Regulations document is approximately 30 pages long and is structured into articles. The major articles include:

- Article 1: General Regulations (definitions, applicability)
- Article 2: Competitors (registration, eligibility, conduct)
- Article 3: Puzzles (cube specifications, modifications allowed)
- Article 4: Scrambling (TNoodle, scrambler conduct)
- Article 5: Procedures (the solve flow, judging, timing)
- Article 6: Events (specific rules per event)
- Article 7: Environment (venue requirements, equipment)
- Article 8: Disciplinary (penalties, appeals, disqualifications)
- Article 9: Reserved (formerly Smart Cubes; now reserved for future use)
- Article A: Appendices (specific procedures and tables)

The document is updated annually, with changes voted on by the WCA Board after community discussion. The current version (2026) is available on the WCA website and is the authoritative reference for any competition dispute or regulation question.

Reading the regulations cover-to-cover is recommended for any serious competitor. The level of detail in the document might initially seem excessive, but every rule exists in response to some specific situation that arose at a previous competition. Understanding the rules deeply gives a competitor better intuition about edge cases and helps avoid penalties.

## Appendix: Notable FMC Resources

For competitors interested in pursuing FMC at a serious level, several resources are recommended:

- The Speedsolving.com FMC subforum, which contains extensive technique discussions and scramble analyses.
- The FMC Discord servers, where active discussion of new techniques and recent results takes place.
- Cube Explorer (Herbert Kociemba's optimal solver), used for post-competition analysis of one's own scrambles.
- The FMC tutorial videos by Daniel Wallin, Lars Cazabon, and several other top FMC competitors, available on YouTube.
- The wikiCSC and various wiki resources on FMC techniques, including detailed explanations of NISS, OEMC, DR, and other modern tools.

The learning path for FMC typically takes 1-2 years from initial interest to competitive level (sub-25 average) and 5-10 years to reach the level of being competitive for world-class results (sub-22 average). The community is welcoming to newcomers and the discipline has a strong tradition of sharing resources and techniques openly.

## Appendix: OH Hardware Comparison

For competitors interested in OH at a serious level, the choice of cube matters significantly. The most popular OH cubes as of 2026 include:

- MoYu WeiPo (OH edition): A lightweight cube popular among OH specialists, optimized for one-handed turning.
- Gan 11 M Pro (OH edition): A premium cube with adjustable magnet strength and corner-cutting tolerance.
- YJ MGC 3x3 (OH variant): A budget-friendly cube with strong performance for OH.
- Yuxin Little Magic OH edition: An entry-level OH cube popular among intermediate competitors.

The specific cube choice is largely personal preference. Top OH competitors typically own several cubes and rotate between them based on the day or the venue. The cube setup process (lubrication, magnet adjustment, tension setting) is a significant part of OH practice and is often discussed in detail in OH communities.

## Appendix: 3BLD Algorithm Set Sizes

A complete 3-style 3BLD algorithm set comprises:
- Corner 3-style commutators: 378 distinct cases (24 positions × 24 positions / 2 orientations, with simplifications)
- Edge 3-style commutators: 378 distinct cases (similar derivation)
- Parity algorithms: Approximately 5 distinct cases for handling odd permutations.
- Special cases (e.g., when buffer pieces interact): Approximately 20 distinct cases.

A solver does not need to memorize all 756+ commutators; many can be derived on the fly using the general commutator principle (X Y X' Y' cycles three pieces). However, memorizing the most common 200-300 cases provides a significant speed advantage over deriving them in real time.

The full 3-style learning process takes 1-2 years for a dedicated competitor, comparable to the learning process for full CFOP in two-handed speedcubing. The discipline rewards deep knowledge of the algorithm set and high accuracy in execution.

## Appendix: MBLD Hardware and Equipment

A MBLD competitor at the world-class level requires substantial equipment for practice and competition:

- 60-100 standard 3x3 cubes (to allow batch practice and to ensure variety in cube types during competition).
- A blindfold of standard design (cloth eye-cover, often custom-fitted).
- A stopwatch or timer for tracking memorization and execution times.
- A practice mat for organizing cubes during memorization.
- Optional: an audio recorder for recording mnemonic memo sessions.

The total cost of equipment for a serious MBLD competitor can exceed $1,000, primarily for the multiple cubes. Some cubes can be shared with other events (the same 3x3 used for speed events can be used for BLD and MBLD), reducing the total but still requiring substantial investment.

The cubes used in MBLD do not need to be premium speedcubes; consistency and reliability are more important than peak performance. Many MBLD competitors use mid-range cubes that hold their shape well and have predictable turning behavior.

## Final Thoughts

The disciplines covered in this document — FMC, OH, 3BLD, MBLD, and the retired With Feet — represent the diversity of what is possible with a single 3x3 cube. Each discipline has its own community, its own training methods, its own world records, and its own future. The WCA regulatory framework, the TNoodle scrambler, and the global competition infrastructure provide the connective tissue that makes all of these disciplines accessible and comparable to one another.

The future of these disciplines depends on continued community engagement, on the maintenance of the regulatory infrastructure, and on the continued development of techniques and equipment. The community is healthy, growing, and increasingly global. New disciplines may emerge in coming decades (smart cube events, online events, VR events), and the existing disciplines will continue to evolve as competitors push the boundaries of what is possible.

For any cuber considering which of these disciplines to pursue, the path is largely personal. Each discipline rewards different skills, requires different training methods, and produces different satisfactions. The breadth of options ensures that any cuber, regardless of their background or interests, can find a discipline where they can develop, compete, and find community.

The cube is one puzzle. The disciplines are many. The community is one. That synthesis — many disciplines, one community — is the strength of the cubing world and the reason it continues to thrive and grow into its fifth decade.
`;
