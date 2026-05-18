export const SOLVER_SOFTWARE_EN = `
## The Computational Cube

There is a curious symmetry between the human speedcuber and the machine cube solver. Both confront the same 43,252,003,274,489,856,000-element state space, both are constrained by the same generator set of 18 face turns, and both ultimately seek the same goal: a sequence of moves that brings a scrambled position back to the identity. The difference is one of method and metric. The human, even an elite world-record holder, executes roughly 50 to 60 moves per solve and treats anything below 20 moves as a fantasy that occasionally materializes on FMC weekends. The machine, given sufficient memory and a few hundred milliseconds of compute, routinely produces 18-move solutions and can prove them optimal when pushed. The history of how computer cube solvers reached this point is a microcosm of the broader history of heuristic search in artificial intelligence: it begins with brute force, passes through pattern databases and bidirectional search, and ends in the strange territory where deep neural networks rediscover the patterns that thirty years of human-crafted algorithms encoded by hand.

This deep dive traces the principal algorithms, the production implementations, the benchmarks, the tradeoffs, and the cultural ecosystem of software that knows how to solve a Rubik's Cube. We will start with the foundational ideas of iterative-deepening A* and pattern databases, walk through Korf's 1997 optimal solver and Kociemba's two-phase algorithm in serious technical detail, examine the computational proof that God's number equals 20, survey the modern landscape of solvers from cube-explorer to TNoodle to DeepCubeA, and finish with the tools that surround them: scramble validators, insertion finders, algorithm generators, and the open-source libraries that make the next generation of solver research possible. The thread that runs through all of this is the slow, accumulating victory of clever search heuristics over raw enumeration. A naive breadth-first search of the cube graph would require more memory than exists on Earth; the algorithms below get the same answer in megabytes and milliseconds, and the techniques that make this possible have applications far beyond cubing.

## Iterative Deepening A Star

The algorithm at the heart of nearly every modern optimal cube solver is iterative-deepening A* (IDA*), introduced by Richard Korf in 1985 in a paper titled "Depth-First Iterative-Deepening: An Optimal Admissible Tree Search." IDA* is the lovechild of A* search and iterative deepening, and it inherits the best property of each: A*'s ability to use a heuristic to prune unpromising branches, and iterative deepening's ability to operate in linear memory. The combination is so well suited to puzzle search that for the past forty years, virtually every state-of-the-art solver for the 3x3 cube, the 4x4 cube, the 15-puzzle, the Sokoban transport problem, and the Tower of Hanoi has been some variant of IDA*.

The algorithm works as follows. We are given a start state, a goal state, a successor function that returns the neighbors of any state, a cost function that gives the cost of each edge (almost always 1 for puzzles), and an admissible heuristic h(n) that returns a lower bound on the distance from any state n to the goal. We pick an initial threshold equal to h(start), and we perform a depth-first search from the start, but we prune any node whose path-cost-plus-heuristic exceeds the threshold. If the search exhausts without finding the goal, we set the next threshold to the smallest f-value that exceeded the old threshold during the search, and we restart the depth-first search from scratch. We keep iterating until we find the goal, at which point we have proven that the discovered path is optimal because every shorter path would have been explored at an earlier iteration.

The genius of IDA* is that it does not store the explored states. A pure A* search has to maintain an open list of frontier nodes sorted by f-value, plus a closed list of explored nodes to detect duplicates; for the cube these lists would grow to billions of entries within seconds and would not fit in any computer's memory. IDA* sidesteps this completely by performing a fresh depth-first search at each iteration, which has memory proportional only to the depth of the search, not to the breadth. For a cube of diameter 20, IDA* needs to store only the current path being explored, which is at most 20 cube states, plus a small constant. The price is that we re-explore the upper levels of the search tree at each iteration; if the branching factor is b and the optimal depth is d, the total work is roughly (b^d - 1) / (b - 1) times some constant, which for the cube's branching factor of about 13 (after eliminating same-face redundancies) and depth of 20 means roughly 1.08 times the work of the final iteration alone. This re-exploration overhead is essentially free when set against the memory savings.

The admissibility of the heuristic is essential. A heuristic h is admissible if h(n) is never greater than the true distance from n to the goal. Admissibility guarantees that the first goal node reached by IDA* is on an optimal path: if there were a shorter path through some unexplored node m, then h(m) plus the path-cost to m would be at most the true total cost, which is less than the threshold, so m would have been explored. The challenge in designing a cube solver is therefore to find a heuristic that is both admissible (never overestimates) and tight (gives values close to the true distance) so that pruning is effective. The closer h is to the true distance, the smaller the search tree; in the limit where h equals the true distance, IDA* simply walks the optimal path. In practice, the tightness of the heuristic is the dominant determinant of solver speed.

The pseudocode is short enough to fit on a postcard. Let f(n) denote g(n) + h(n) where g is the path cost from start to n and h is the heuristic. We define a recursive routine SEARCH(node, g, bound) that returns either the path to the goal or the smallest f-value exceeded during this iteration. The outer loop is:

\`\`\`
bound = h(start)
loop:
    result = SEARCH(start, 0, bound)
    if result is a path, return it
    bound = result
\`\`\`

The recursive SEARCH routine itself is:

\`\`\`
SEARCH(node, g, bound):
    f = g + h(node)
    if f > bound: return f
    if node is goal: return path
    min_exceeded = infinity
    for each child of node:
        result = SEARCH(child, g + cost(node, child), bound)
        if result is a path, return it
        min_exceeded = min(min_exceeded, result)
    return min_exceeded
\`\`\`

The simplicity is deceptive. Three details matter enormously in practice. First, the successor function should not include moves that are obviously redundant: if the parent move was U, we should not allow U or U' or U2 as the next move, because that would be equivalent to a single U turn that could have been the parent. We should also forbid sequences like R L R, because R and L commute and the canonical form would be L R R = L R2. Encoding these restrictions in a "metric" table that says "given the last move, here are the allowed next moves" cuts the effective branching factor from 18 down to about 13. Second, the recursive descent should be done in a way that does not allocate memory; the cube state should be a fixed-size array of bytes (typically 40 bytes for corner permutation, twist, edge permutation, flip) and the move should be applied in-place with an inverse applied on the way back up. Third, the heuristic lookup needs to be branchless and cache-friendly: in the inner loop the solver may call the heuristic billions of times, and any branch misprediction or cache miss multiplies the runtime by a noticeable factor.

In its 1985 form, IDA* was an algorithm in search of a problem big enough to demonstrate its value. The 15-puzzle (which Korf's paper used as its primary example) had a state space of 16!/2 = roughly 10^13, which was large but already within reach of contemporary memory-intensive A* implementations. The 3x3 cube, at 10^19 states, was an order of magnitude beyond the largest problems that anyone had attempted optimally. The leap that connected IDA* to the cube required one more ingredient: pattern databases.

## Pattern Databases

A pattern database (PDB) is a precomputed lookup table that gives the exact minimum number of moves required to solve a particular subset of the cube's state. The idea was introduced by Joseph Culberson and Jonathan Schaeffer in 1996 for the 15-puzzle, and Korf adapted it to the 3x3 cube the following year. The construction is conceptually simple: pick a sub-problem (for example, "just the 8 corners, ignoring the edges entirely"); enumerate every reachable state of that sub-problem; perform a breadth-first search from the solved state outward; and store, for each state, the number of moves at which it was discovered. The result is a table indexed by the sub-problem state, returning the exact optimal number of moves to solve just that sub-problem.

The crucial property of a pattern database is that the value it returns is an admissible heuristic for the full cube: any sequence of moves that solves the full cube must include enough moves to solve any sub-problem of it, so the optimal number of moves to solve the sub-problem is a lower bound on the optimal number of moves to solve the whole. Better still, multiple pattern databases can be combined by taking the maximum (or, for additive pattern databases under certain restrictions, by summing), and the resulting combined heuristic remains admissible. Maximum combination is conservative and always safe; additive combination requires that the sub-problems be disjoint in a particular technical sense.

The corner pattern database for the 3x3 cube is the simplest example. There are 8 corners, each with 3 orientations, so the total number of corner states is 8! times 3^7 = 88,179,840 (the 3^7 rather than 3^8 reflects the corner-twist constraint that the sum of corner orientations is fixed modulo 3). Indexing this requires roughly 27 bits per state, or about 4 bytes if you pack the index naively. The BFS from the solved corner state takes a few minutes on modern hardware and produces a table that, stored as one byte per state (since the radius of the corner-only group turns out to be at most 11), occupies 88 megabytes. A lookup into this table gives the exact minimum number of moves required to solve all 8 corners in isolation, which is a lower bound on the number of moves required to solve the full cube; combining this with edge-based pattern databases via maximum gives a much tighter heuristic.

Korf's 1997 paper described three pattern databases for the 3x3 cube. The first was the corner database described above, taking 88 megabytes. The second was a database of 7 of the 12 edges, with the corresponding piece permutations and orientations; the state space is 12! / (12-7)! times 2^7 = 510,935,040, which after packing into one byte each requires about 510 megabytes. The third was the symmetric database of the other 7 edges (with one edge in common to ensure overlap), also about 510 megabytes. The combined heuristic is the maximum of the three lookups, and on a typical scrambled cube it returns a value in the range 15-19, which is to say it is within 1-2 moves of the true optimal distance for most positions. This tightness is what makes IDA* work: the search tree is pruned so aggressively that the average optimal-solution search takes only a few seconds even on 1997-era hardware.

The combined memory footprint of Korf's three pattern databases was roughly 1.1 gigabytes, an immense amount of memory in 1997 when typical workstations had 64 to 128 megabytes of RAM. Korf ran his solver on a Sun SparcStation Ultra with 512 megabytes of memory, and the pattern databases lived on disk and were paged in as needed. The reported solve times in his paper were 5 to 15 seconds per scramble, averaged over 10 random scrambles. The optimal solution lengths averaged 17.8 moves in the half-turn metric, with the longest being 20 and the shortest 17. This was the first time anyone had produced provably optimal solutions for random cube scrambles, and it was the first solid empirical evidence that God's number for the 3x3 cube was small, likely 20 or thereabouts.

The breakthrough that pattern databases brought is hard to overstate. Before Korf's 1997 paper, the best optimal cube solver was a depth-first iterative-deepening search with a much weaker heuristic, which could solve random scrambles only when given hours of CPU time. After 1997, the same problem could be solved in seconds. The same technique was subsequently applied to the 4x4 cube (where pattern databases for the corners, edges, and centers can be combined to give tight heuristics, but where the state space is too large for true optimal solving in reasonable time), the 24-puzzle, the Top-Spin puzzle, and many other combinatorial search problems. Pattern databases are now a standard tool in heuristic search, and the cube was the first major showcase of their power.

A more refined idea is the disjoint additive pattern database (Felner, Korf, and Hanan, 2004), which partitions the cube's pieces into groups such that the moves required to solve each group separately can be summed (rather than maxed) to give a valid lower bound. For the 8-piece corner database the sum is exactly the move count required to solve the corners in isolation; for the 12 edges, partitioning them into groups of 6 and 6 gives two databases whose sum is a lower bound on the move count to solve all 12 edges. The additive heuristic is provably tighter than the maximum heuristic when the partition is chosen carefully, and modern optimal solvers often use a combination of additive and maximum heuristics to squeeze the last few percent of search-tree pruning.

On modern hardware (2024 desktop CPUs with 64 gigabytes of memory and NVMe storage), an optimal solver based on IDA* plus Korf-style pattern databases can find optimal solutions to random cube scrambles in 100 to 500 milliseconds per scramble. The 100-fold speedup over 1997 comes from a mix of faster CPUs, much larger caches, and refinements to the pattern databases themselves. Felner's "additive pattern databases" reduce the search tree by another factor of 5 to 10 over Korf's original; symmetry reduction (which we will discuss in the context of Rokicki's God's number proof) reduces the effective state space by a factor of 48; and aggressive move ordering inside the IDA* recursion produces an additional 2x to 3x speedup. Combined, these refinements have made optimal solving fast enough that it is now routine to run optimal solvers over corpora of thousands of scrambles to compute statistics like the mean and variance of the optimal distance.

## Kociemba's Two-Phase Algorithm

While Korf was working on optimal solvers, Herbert Kociemba in Germany was developing an entirely different approach. Kociemba's "two-phase algorithm," first described in 1992 and refined over the following decade, abandoned the goal of finding strictly optimal solutions and instead aimed for solutions that were near-optimal but found extremely quickly. The result was an algorithm that produces 20-23 move solutions for random scrambles in well under a millisecond on modern hardware, fast enough to be embedded in any application that needs scrambles in real time. Kociemba's algorithm is the basis of TNoodle, the World Cube Association's official scramble generator, and it remains the most widely deployed cube solver in the world.

The key insight is the existence of a particular subgroup H of the cube group G. Kociemba defined H as the subgroup generated by U, D, L2, R2, F2, B2 — that is, all moves of U and D (any quarter or half turn) plus only the half-turns of L, R, F, B. This subgroup has order 19,508,428,800, which is exactly 1/2,217,093,120 the size of G. Equivalently, the index of H in G is 2,217,093,120, and the cosets of H in G partition the 4.3 quintillion cube states into 2.2 billion equivalence classes of 19.5 billion states each.

What makes H special? Two things. First, H is large enough that solving any element of H using only the generators of H is itself a substantial problem, but small enough that pattern databases for it can be precomputed exactly. Second, the cosets gH for g in G are characterized by exactly three pieces of information that are independent of the H generators: the orientation of the 8 corners, the orientation of the 12 edges, and the position (but not orientation) of the 4 UD-slice edges (the edges in the middle layer between U and D, namely FR, FL, BL, BR). The intuition: if you can solve all corner orientations, all edge orientations, and all UD-slice positions, you have reduced the cube to an element of H, which means you can now finish using only U, D, L2, R2, F2, B2 — moves that do not change those three coordinates.

The two-phase structure is then:

Phase 1: Use any of the 18 face moves to reach an element of H. Equivalently, fix the corner orientations, fix the edge orientations, and place the 4 UD-slice edges in the middle layer (regardless of their permutation among themselves). The total state space for phase 1 is the number of distinct cosets of H in G, which is 2,217,093,120 — about 2.2 billion. The diameter of phase 1 (the maximum number of moves to reach H from any starting position) is 12. The average length of a phase 1 solution is approximately 9.5 moves.

Phase 2: Use only the 10 moves in H's generator set (U, U', U2, D, D', D2, L2, R2, F2, B2) to solve from the current element of H to the identity. The state space of phase 2 is the order of H, which is 19,508,428,800. The diameter of phase 2 is 18. The average length of a phase 2 solution is approximately 13 moves.

The total solution length is the sum of phase 1 and phase 2 lengths, which on average is about 22-23 moves. This is 2-3 moves longer than truly optimal, but the structural simplification makes the search dramatically faster.

The reason the algorithm is so fast is that both phases can be solved using IDA* with pattern databases that fit comfortably in memory.

## Phase 1 Pruning Tables

The three coordinate functions for phase 1 are:

- Corner orientation: 3^7 = 2187 possible states (the 3^8 minus the parity constraint)
- Edge orientation: 2^11 = 2048 possible states (the 2^12 minus the parity constraint)
- UD-slice positioning: C(12, 4) = 495 possible states (choosing which 4 of the 12 edge slots hold the 4 UD-slice edges, ignoring permutation among themselves)

A naive single pruning table would index by the product of these three coordinates, giving 2187 × 2048 × 495 = 2,217,093,120 entries — exactly the number of phase 1 cosets. This table, stored as one byte per entry, would require 2.2 gigabytes of memory, which is feasible today but was prohibitive in 1992. Kociemba's original implementation used two separate pruning tables: one indexed by (corner orientation, UD-slice positioning), giving 2187 × 495 = 1,082,565 entries (just over 1 megabyte), and one indexed by (edge orientation, UD-slice positioning), giving 2048 × 495 = 1,013,760 entries (just under 1 megabyte). The maximum of the two table values is a valid (but not optimal) lower bound on the phase 1 distance. Each table is computed by BFS from the solved state, marking each newly-discovered coset with its depth.

The size economy is striking: roughly 2 megabytes of pruning tables compared to Korf's roughly 1.1 gigabytes for the optimal solver. The price is that the heuristic is looser; while Korf's combined pattern databases typically return values within 1-2 moves of the true optimal distance for the full cube, Kociemba's phase 1 pruning tables typically return values within 3-4 moves of the true phase 1 distance. The looser heuristic means that the phase 1 search tree is larger relative to the optimal solution size, but the search is so much smaller in absolute terms (the phase 1 state space is 2.2 billion versus the full cube's 43 quintillion) that the overall runtime is far shorter.

The phase 1 IDA* search proceeds as follows. Starting from the scrambled position, compute the three phase 1 coordinates. Look up the maximum value across the two pruning tables; this is the lower bound h(start). Begin IDA* with threshold equal to h(start). On each iteration, perform a depth-first search; at each node, check whether the current position is in H (which is equivalent to checking that all three phase 1 coordinates are zero). If so, record the current path as a candidate phase 1 solution. Continue the search up to the current threshold. After the iteration, if a phase 1 solution was found, begin phase 2 from the corresponding H position. The crucial subtlety is that the algorithm does not stop at the first phase 1 solution found; instead, it considers multiple phase 1 solutions of varying lengths and chooses among them the one that leads to the shortest total solution.

## Phase 2 Pruning Tables

The phase 2 coordinates are different. Once we are in H, the corner orientations are fixed (all zero) and the edge orientations are fixed (all zero), so we only need to track permutations. The relevant coordinates are:

- Corner permutation: 8! = 40,320 possible states
- Edge permutation of the 8 non-UD-slice edges: 8! = 40,320 possible states
- UD-slice edge permutation: 4! = 24 possible states

Kociemba's phase 2 pruning tables are indexed by (corner permutation, UD-slice permutation), giving 40,320 × 24 = 967,680 entries, and by (edge permutation, UD-slice permutation), giving the same 967,680 entries. Each table is just under 1 megabyte. The maximum of the two is the lower bound on the phase 2 distance.

The phase 2 IDA* is structurally identical to phase 1, but with the restricted move set (U, U', U2, D, D', D2, L2, R2, F2, B2) instead of the full 18 face moves. The branching factor is smaller (about 8 after eliminating same-face redundancies), and the diameter is larger (18 versus phase 1's 12), so the search tree is comparable in size to phase 1's tree.

## Why Two-Phase Works

The reason the two-phase decomposition is so efficient comes down to the multiplicative effect of working with smaller state spaces. The full cube has 4.3 × 10^19 states; phase 1 has 2.2 × 10^9, and phase 2 has 1.95 × 10^10. The search trees for the two phases combined are far smaller than the search tree for a single-phase optimal solver because each phase's branching factor times depth is much smaller. Specifically, phase 1's tree is roughly 8^9 = 1.3 × 10^8 nodes, and phase 2's tree is roughly 6^13 = 1.3 × 10^10 nodes, for a combined size around 10^10 — versus 13^20 = 1.9 × 10^22 nodes for an unpruned optimal search of the same depth.

Of course, neither phase actually traverses its full search tree, because IDA* with pattern databases prunes heavily. The phase 1 search with Kociemba's pruning tables visits roughly 10^5 nodes per scramble on average, and the phase 2 search visits roughly 10^6 nodes. The total node count is around 10^6 per scramble, which at modern CPU speeds of about 10^8 nodes per second translates to roughly 10 milliseconds per scramble in unoptimized code, and well under 1 millisecond in carefully tuned implementations.

A typical Kociemba two-phase solve produces a solution of 20-23 moves in HTM, with the median around 22 moves. By comparison, the true optimum (which Kociemba does not necessarily find) is in the range 18-20 moves for most random scrambles, with mean 18.3. So Kociemba pays a 2-3 move penalty on average for being roughly 100 times faster than a strict optimal solver. For applications like WCA scramble generation, where solution quality is irrelevant and only solving speed matters (because the WCA needs to verify that the scramble's optimum is sufficiently long), this tradeoff is entirely worthwhile.

The two-phase algorithm has a beautiful theoretical-computer-science quality to it. It is essentially a decomposition of a hard problem into two easier problems via the intermediate group H, exactly analogous to Thistlethwaite's earlier four-phase algorithm (which used four nested subgroups instead of two, and produced longer solutions but was even simpler to implement). Kociemba's choice of H was inspired: the subgroup is large enough that phase 1's cosets are characterized by simple coordinate functions that can be efficiently computed, and small enough that phase 2's state space is fully enumerable by pattern databases.

## min2phase and ARPlanner

The most widely used production implementation of Kociemba's algorithm is min2phase, developed by Chen Shuang (a Chinese cuber known online as cs0x7f) starting in 2009. min2phase is written in Java, fits in roughly 4000 lines of code, and incorporates several refinements over Kociemba's original 1992 algorithm: more aggressive pruning, symmetry reduction, faster coordinate computation through bit-packing, and a sophisticated handling of phase 1 solution enumeration that produces shorter total solutions than naive concatenation of independent phase 1 and phase 2 searches.

min2phase is the solver embedded in TNoodle, the WCA's official scrambling tool, and through TNoodle it generates every competition scramble used in WCA events since approximately 2013. It is also embedded in csTimer, the dominant online cubing timer (used by hundreds of thousands of cubers worldwide), and in countless mobile apps, online solver websites, and educational tools. The algorithm's combination of speed, accuracy, and small code footprint makes it nearly universal in cubing software.

ARPlanner (a name often associated with Anthony Rich's early implementations, though the term has become generic) refers to a family of Kociemba-style solvers tuned for very fast inference at the cost of some solution length. Most ARPlanner implementations terminate phase 1 search at the first H position found and use a small phase 2 pruning table, sacrificing 1-3 moves of solution length for a 5-10x speedup. The "fastest known solver" benchmarks routinely cite ARPlanner-like implementations as the leaders, with single-solve times in the microsecond range on modern hardware.

Kociemba's own implementation, cube-explorer, is a Windows GUI application that has been continuously developed since the late 1990s. cube-explorer's UI lets the user enter a scramble (by typing or by manipulating a 3D cube model), then runs the two-phase solver in the background, displaying intermediate solutions of decreasing length until the user stops the search or until the algorithm exhausts all candidate phase 1 lengths. cube-explorer also includes a scramble analyzer that reports the optimal length, the symmetric/antisymmetric properties of the scramble, and the cube's "type" (a classification based on the orbit structure of the position under the cube's symmetry group). For many years, cube-explorer was the de facto standard tool for FMC competitors who wanted to check whether their human-found solutions were close to optimal.

## ksolve and General-Puzzle Solvers

While Kociemba's algorithm is specifically tailored to the 3x3 cube, there are also general-purpose puzzle solvers that can be configured to solve any twisty puzzle with a finite state space. The most prominent of these is ksolve, originally developed by Kenneth Tao around 2010 and subsequently extended by Charlie Vanaret, Bram Cohen, and others. ksolve takes as input a description of a puzzle (the pieces, the move definitions, and any symmetry constraints) and a scrambled state, and produces a solution using a combination of IDA*, pattern databases, and bidirectional search.

The puzzle description language used by ksolve is sufficiently general to handle the 3x3 cube, the 4x4 and larger cubes, the Pyraminx, the Skewb, the Square-1, the Megaminx, and many less-common puzzles. The user specifies the pieces (e.g., 8 corners, 12 edges, 6 centers for a 3x3) and the move definitions as permutations of those pieces (e.g., "U moves corners 0,1,2,3 in a cycle and corners 4,5,6,7 not at all"). ksolve then automatically computes the orbit structure, generates the pruning tables, and runs IDA* on the resulting state space.

The cost of generality is performance: a special-purpose 3x3 solver like min2phase is roughly 100x faster than ksolve on the same scrambles, because min2phase's hand-coded coordinate functions and pruning tables are tuned for the specific structure of the 3x3 state space. But ksolve's flexibility makes it invaluable for research on novel puzzles. When a new twisty puzzle is invented, ksolve is often the first tool used to determine its diameter, its average solving distance, and its statistical properties; only later, if the puzzle becomes popular, do special-purpose solvers get written.

ksolve has been used to compute exact diameters for the Pyraminx (11 moves in QTM, excluding tips), the Skewb (11 moves), the Square-1 (an exact bound that depends on the metric used), the 2x2x3 (14 moves in HTM), and many others. For the 4x4 it can compute upper bounds via the Reduction-Then-Solve technique, but the state space (roughly 7 × 10^45) is too large for a true diameter computation.

## Tomas Rokicki and the God's Number Proof

The computational proof that God's number for the 3x3 cube equals 20 in HTM is one of the great achievements of recreational mathematics in the 21st century. It was completed in 2010 by a team consisting of Tomas Rokicki, Morley Davidson, John Dethridge, and Herbert Kociemba, with support from Google (which donated approximately 35 CPU-years of computation). The proof establishes that every position of the cube can be solved in 20 or fewer half-turn moves, and that there exist positions (the so-called "antipodes") that require exactly 20 moves. We had known since the early 1990s that God's number was between 18 (the longest known optimal solution at the time) and 22 (an upper bound established by various incremental improvements over the years); the 2010 proof closed the gap entirely.

The strategy is a refinement of Kociemba's two-phase algorithm. Recall that Kociemba's subgroup H has 19,508,428,800 elements and index 2,217,093,120 in the full cube group G. Equivalently, the cosets of H in G partition the cube's state space into 2.2 billion equivalence classes of 19.5 billion states each. The cosets are precisely the equivalence classes of "cube positions that require the same minimum number of phase 1 moves to reach H." If we can show that for every coset gH, the worst-case solution length (over all positions in the coset) is at most 20 moves, then we have established that God's number is at most 20.

The brute-force approach to proving this is to enumerate every coset, compute the maximum solution length over each coset's 19.5 billion positions, and check that the maximum is at most 20. This is impossible: 2.2 × 10^9 times 1.95 × 10^10 is 4.3 × 10^19, which is exactly the full state space, so brute-force enumeration of every coset's contents is brute-force enumeration of the entire cube. The breakthrough idea was to bound the solution length per coset without enumerating its contents.

For each coset gH, Rokicki's team computed an upper bound on the worst-case solution length as follows. They observed that any position in the coset gH can be written as g × h for some h in H. To solve g × h, we can first apply some sequence of moves to take g × h back to some element of H — call this prefix path s with length |s|. The remaining state is (s × g × h), which is in H by construction. We can then solve (s × g × h) using only H's generators — this is the phase 2 step. The total solution length is |s| plus the H-only solving distance of (s × g × h). The key insight is that we do not need to consider all possible prefixes s; we only need to consider those that take g into H, because that is what defines the coset. So for each coset gH, we enumerate all phase 1 prefixes (up to some bound, say 12 moves), and for each prefix we compute the maximum H-only solving distance over the resulting H positions, and we take the minimum over prefixes.

The clever bit is that we do not actually need to enumerate the H positions; we only need to know the maximum H-only solving distance for the set of H positions reachable by applying a particular prefix. This can be computed using a single bit per H position, indicating whether that position is in the set of "positions reachable by some sequence (s × g × h) where g is in the coset and h is in H and |s| is fixed." The bit-vector for each coset is 19.5 billion bits = 2.4 gigabytes, which is large but tractable, and the computation per coset reduces to a series of bit-vector operations that can be performed efficiently on modern CPUs.

The total computation, over all 2.2 billion cosets, was estimated by Rokicki at roughly 1.1 × 10^9 CPU-seconds, or about 35 CPU-years. With Google's distributed cluster, the entire computation was completed in approximately a few weeks of wall-clock time in mid-2010. The result: every coset's worst-case solution length is at most 20 moves, with many cosets having worst-case length exactly 20 and many having worst-case length 18 or 19. The proof established that God's number is exactly 20 in HTM (combined with the previously-known lower bound of 20 from explicit antipode positions).

## Symmetry Reduction

A crucial optimization in Rokicki's proof was the use of cube symmetries. The cube has a symmetry group of 48 elements (the symmetries of the regular octahedron), which act on the cube state by permuting the faces (e.g., the symmetry that rotates the cube 90 degrees around the vertical axis maps U to U, D to D, F to L, L to B, B to R, R to F, with corresponding effects on the other moves). For any cube position p, the 48 positions in the orbit of p under the symmetry group all have the same optimal solution length, because solving p is equivalent to solving any of its symmetry-equivalents (the solution sequences are related by a uniform symmetry transformation).

By only considering positions that are "canonical representatives" of their symmetry orbits (typically the lexicographically smallest position in each orbit), the effective state space is reduced by approximately a factor of 48. There are some special positions that have non-trivial stabilizers — that is, positions whose symmetry orbit is smaller than 48 because the position itself has a non-trivial symmetry. The most famous example is the solved state, whose orbit is just itself (size 1), but there are many other positions with intermediate stabilizer sizes. Counting carefully, Rokicki's team established that the cube's positions divide into orbits of average size about 48, with the total number of orbits being approximately 4.3 × 10^19 / 48 ≈ 9 × 10^17 — still huge, but 48 times smaller than the original.

In addition to symmetries, the cube also has an "antisymmetry": the inverse operation. For any position p and its inverse p^(-1), if p requires n moves to solve, then p^(-1) also requires n moves to solve (the inverse of an optimal solution is also an optimal solution). By identifying p with p^(-1) (when they are different — a position equal to its own inverse is called self-inverse), we get another factor of 2 reduction. The combined symmetry and antisymmetry reduction gives a factor of 96 reduction in the effective state space, which means the per-coset computation that originally took some amount of time now takes 1/96 of that time, with the result being that the total proof time fits comfortably within Google's donated compute budget.

The symmetry reduction is conceptually elegant but technically demanding. It requires maintaining a "canonical position" function that, given any position, returns the canonical representative of its symmetry orbit. This function must be fast (because it is called many times during the search) and correct (because errors propagate undetectably into the proof). Rokicki spent considerable effort on the engineering, and the resulting code has been independently verified by other implementations.

A nice consequence of the symmetry reduction is that the proof can be re-run today on a modern desktop in a matter of hours rather than weeks. A modern multi-core CPU with 64 gigabytes of memory can perform the per-coset computation in well under a second per coset, and with appropriate parallelization the 2.2 billion cosets can be processed in approximately 4 to 8 hours on a workstation. The proof is no longer a one-time achievement requiring institutional resources; it is now within reach of any amateur cubing researcher with a recent computer and a few thousand dollars of equipment.

## God's Algorithm Tables

Beyond the proof itself, Rokicki and collaborators also computed the exact distribution of optimal solution lengths for the cube. The distribution is sharply peaked around 18 moves, with the number of positions at each distance from solved being approximately:

- Distance 0: 1 (the solved state)
- Distance 1: 18
- Distance 2: 243
- Distance 3: 3240
- Distance 4: 43,239
- ... (continues with roughly geometric growth) ...
- Distance 14: 16,861,235,098,549,562 (about 1.7 × 10^16)
- Distance 15: 1.2 × 10^17
- Distance 16: 6.6 × 10^17
- Distance 17: 3.1 × 10^18
- Distance 18: 1.2 × 10^19
- Distance 19: 2.0 × 10^19
- Distance 20: 7.6 × 10^17

The numbers for distances 17, 18, and 19 are the most striking: these three distances together contain roughly 99.5% of all cube positions. The distance-20 positions (the "antipodes" of the solved state) are a tiny fraction — about 7.6 × 10^17 out of 4.3 × 10^19, or 1.7% — but their existence is what establishes God's number at exactly 20 rather than 19.

The complete distance distribution table is the kind of result that has applications well beyond cubing. It tells us, for instance, the expected optimal solution length for a randomly-scrambled cube (about 18.3 moves), the variance of that length (about 0.7 moves), and the distribution of "easy" versus "hard" scrambles. The same tabulation has been done for the quarter-turn metric (QTM, where God's number is 26) and for other variations.

## ACube and Other Solvers

ACube is a Windows GUI cube solver written by Josef Jelinek in the early 2000s. It implements both Kociemba's two-phase algorithm and a Korf-style optimal algorithm, with a clean interface for entering scrambles, animating solutions, and analyzing positions. ACube was particularly popular in the early-to-mid 2000s among FMC competitors who wanted to check whether their hand-found solutions were close to optimal. It has been less actively maintained in recent years, with cube-explorer and various web-based solvers occupying its niche.

Other historically-important cube solvers include:

- The "RuRu" solver by Eric Limeback (2003), one of the first publicly-available open-source two-phase implementations.
- "Anthony Brooks's solver," used by Brooks during his record-breaking solves of the early 2010s, though never publicly released.
- The "Cube20" project's reference solver, used in various academic papers on the cube's combinatorial structure.
- Charlie Vanaret's "Cube" solver, written in Python with C extensions, popular in academic and educational settings.

In the modern era (2020-2025), the leading open-source solvers are min2phase (Java, used in TNoodle and csTimer), cubelib (a Rust library by Stefan Pochmann), kocube (a C++ implementation by Andrew Skalski), and twisty-puzzle-solver (a JavaScript implementation in the cubing.js library). Each has slightly different performance characteristics: min2phase prioritizes correctness and small code size, cubelib prioritizes raw speed, kocube prioritizes solution quality (it can find solutions within 1 move of optimal in tight memory budgets), and cubing.js prioritizes browser portability.

## Online and Mobile Solvers

The proliferation of cube solvers in the 2010s extended to web browsers and mobile apps. The most prominent web-based solvers include:

- rubiks-cube-solver.com, which uses a JavaScript port of Kociemba's two-phase algorithm and provides a 3D animated solution.
- rubikssolve.com, which uses a Korf-based optimal solver implemented in WebAssembly for near-native performance.
- cube20.org, which hosts the official record of God's number computations and includes interactive tools for exploring antipode positions.
- grubiks.com, which provides solvers for many different puzzles (3x3, 4x4, 5x5, Megaminx, Pyraminx, etc.) and animated solutions.
- ruwix.com, which includes both a solver and extensive educational content about cube methods and history.

Mobile apps have proliferated even more rapidly. The original "Rubik's Solver" app (made by the Rubik's brand company) used a Kociemba solver and was downloaded tens of millions of times across iOS and Android. Other popular apps include "Cube Solver" (free, ad-supported, Kociemba-based), "Asolver" (one of the first apps to use the device camera to detect the cube state automatically), "CubeAI" (uses a small neural network to detect colors from photographs), and "21Moves" (an educational app that walks beginners through Kociemba's algorithm step by step).

The technical challenge for mobile solvers is the limited memory and compute available on phones. A Korf-style optimal solver with full pattern databases requires roughly 1 gigabyte of memory, which is prohibitive on most phones. Mobile solvers therefore use Kociemba's two-phase algorithm with compressed pruning tables (typically 1-5 megabytes total), producing 20-23 move solutions in 100-500 milliseconds on a mid-range phone.

Smart cube apps add another layer of complexity. The GoCube, the GAN Smart Cube, the Rubik's Connected, the QiYi i3, and several other Bluetooth-enabled cubes broadcast their move history in real time to a paired phone. The app's solver then knows the cube's exact state at all times and can provide hints during a solve, analyze the user's CFOP execution, or generate scrambles by simulating moves on the cube's internal state. The most sophisticated smart cube apps (CubeStation for GAN, CubeMaster for GoCube, csTimer's Bluetooth integration) include features like move-by-move analysis, OLL/PLL recognition trainers, and competitive online play against other users with the same cube model.

## TNoodle: The WCA Scramble Generator

TNoodle is the World Cube Association's official scramble generation tool. It is open source (GPLv3), implemented in Java, and developed primarily by Lucas Garron with contributions from many others over the past decade. TNoodle is used at every WCA competition worldwide to generate the scrambles for every official event, from 3x3 single rounds to Megaminx finals. The same scramble that Yusheng Du saw before his 3.47 world record was generated by TNoodle; so was every scramble that Max Park and Yiheng Wang ever competed on.

The architecture of TNoodle has several layers. At the bottom is a set of puzzle libraries, including TNoodle's bundled implementation of min2phase for the 3x3 cube, plus separate solvers for 2x2, 4x4, 5x5, 6x6, 7x7, Pyraminx, Megaminx, Square-1, Skewb, and Clock. Above the puzzle libraries is a scramble-quality enforcement layer that ensures generated scrambles meet the WCA's requirements: for 3x3, this means the scramble must require at least 21 moves to solve optimally (in HTM), and additional constraints to ensure that the scramble does not have any trivially-solvable structure. Above that is a scramble generation API used by the WCA's competition tools.

The 3x3 scramble generation algorithm works as follows. First, generate a pseudo-random sequence of moves from the 18 possible face moves, with a configurable length (the WCA standard is 25 moves, generated as a sequence with no immediately-redundant moves). Second, take the resulting position and run min2phase to compute the optimal solution length. If the optimal length is at least 21 moves, accept the scramble. If not, discard it and generate a new one. The acceptance rate is approximately 95% (since most random 25-move sequences yield positions requiring at least 21 moves to solve), so the average number of trials per generated scramble is about 1.05.

The "minimum 21 moves" constraint exists for two reasons. First, it ensures that scrambles cannot be trivially solved by spotting an obvious solution during inspection (because no solution shorter than 21 moves exists). Second, it ensures that scrambles do not have unusually short optimal solutions that might give one competitor an unfair advantage (since two competitors with scrambles of optimal length 16 and 22 would have very different inspection difficulty). The 21-move threshold was chosen empirically based on analysis of scrambles from pre-2009 competitions, where a few easy scrambles had caused noticeable variance in performance.

In addition to enforcing the 21-move minimum, TNoodle also enforces several other scramble-quality rules:

- The scramble must not contain redundant moves (e.g., R R should not appear as it can be written as R2).
- The scramble must not contain immediately-canceling moves (e.g., R R' should not appear as it is a no-op).
- The scramble must have a clean prefix-suffix structure, avoiding obvious patterns like sune sequences at the start or end.
- The scramble must be free from certain "trivial" structures that have been identified as giving inspection advantages.

The generated scrambles are written to a competition-specific JSON file along with the corresponding optimal solutions (which are not shown to competitors but are used by WCA delegates to verify scramble correctness). The JSON file is then loaded by the WCA's competition software (which has gone through several versions over the years, currently being WCA Live and Cubecomps) and displayed to competitors via the timer's pre-solve screen.

The choice of Java for TNoodle was driven by portability: Java was the most cross-platform option available in 2009 (when TNoodle was first developed) and remains so today. TNoodle can run on Windows, macOS, Linux, and various server platforms without modification. The Java VM also provides a sandboxed execution environment, which is important because TNoodle accepts user-provided scrambles in its testing mode and needs to be resistant to malicious input.

The WCA's Scramble Specification document (a multi-page PDF available on the WCA website) describes the formal rules for what constitutes a valid scramble, the minimum quality requirements, and the testing procedures used to validate new scramblers. Any organization or individual who wants to develop an alternative to TNoodle must conform to this specification, and the WCA Software Committee (a body of approximately 6-10 volunteers, currently led by Lucas Garron) reviews and certifies any candidate replacement.

## Pre-TNoodle History

Before TNoodle's introduction in 2009, WCA competition scrambles were generated by a variety of ad-hoc tools that the WCA gradually consolidated. The most prominent pre-TNoodle scrambler was Mark Beasley's "Mark2 Scrambler," which was used for many competitions in the mid-2000s but had a number of known issues including occasional generation of scrambles with optimal length less than 21 moves. Several web-based JavaScript scramblers were also in use, each with its own quirks. The lack of a single official scrambler meant that competitions in different countries often used slightly different scramble distributions, which was not strictly a fairness problem (since within each competition all competitors faced the same scrambles) but was an organizational headache.

The transition to TNoodle in 2009 was prompted by a WCA-organized open-source contest for cube scramblers, in which several teams submitted candidate scramblers and the WCA evaluated them against a set of statistical and engineering criteria. Lucas Garron's submission (which became TNoodle) was selected primarily for its software quality, code clarity, and the ease with which it could be extended to new puzzles. The contest also produced a body of work on what constitutes a "good" scrambler, much of which has been incorporated into subsequent versions of TNoodle and into the WCA's Scramble Specification.

## Solver Speed Benchmarks

The performance landscape of modern cube solvers can be summarized roughly as follows (all numbers are for random scrambles on a modern desktop CPU, single-threaded):

- Korf-style optimal solver with full pattern databases: 100-500 milliseconds per scramble, average solution length 18.3 moves.
- Kociemba two-phase solver (min2phase, default settings): 1-5 milliseconds per scramble, average solution length 21-22 moves.
- Kociemba two-phase solver (ARPlanner-style fast settings): 0.05-0.5 milliseconds per scramble, average solution length 22-25 moves.
- Phase 1-only solver (sub-optimal but very fast): 0.01-0.05 milliseconds per scramble, average solution length 30-40 moves.

For comparison, generating a random scramble (without any solver) takes about 0.01 milliseconds (just 25 random integer generations and table lookups), so TNoodle's full scramble generation (including the 21-move quality check) takes about 5 milliseconds per scramble on modern hardware. This is fast enough to generate scrambles for an entire WCA competition (typically a few hundred scrambles for a one-day event) in a few seconds.

The "1ms challenge" — finding any solver that can solve a random cube scramble in under 1 millisecond — was an informal benchmark in the cubing software community throughout the 2010s. The first solver to consistently break 1ms was a heavily-optimized version of min2phase by Chen Shuang, around 2012. Subsequent versions have gotten faster, with the best modern implementations running at roughly 100 microseconds per solve, making the cube one of the few "hard" combinatorial problems for which good-enough solutions are essentially free to compute.

## Distributed and Parallel Solving

For applications where extremely high solver throughput is required — for example, when generating large corpora of scrambles with specific properties, or when computing statistics over millions of cube positions — distributed solving becomes useful. The simplest form is "embarrassingly parallel" solving, where many independent scrambles are distributed across multiple CPU cores or machines, each running its own solver instance. Modern multi-core desktops can solve scrambles at roughly 10,000 to 100,000 per second per machine using min2phase, scaling nearly linearly with core count.

A more interesting form of distributed solving is the parallel search of a single hard scramble. Rokicki's God's number proof used this approach, distributing the per-coset computations across thousands of Google Cloud cores. For optimally solving a single scramble that lies near the diameter (i.e., requires 20 moves), naive parallelization is hard because the IDA* algorithm is inherently sequential within an iteration. Several research efforts have explored parallel IDA* variants, with mixed results: the speedup from parallelization tops out at around 4-8x even with 64 cores, because the synchronization overhead between threads at iteration boundaries swamps the parallel work.

A more effective approach is to parallelize across "candidate phase 1 solutions" in the Kociemba algorithm. Each phase 1 solution leads to an independent phase 2 search, and these phase 2 searches can be done in parallel. This approach scales to roughly 20-30 cores effectively, beyond which the marginal cost of additional candidate phase 1 solutions exceeds the marginal benefit of finding a shorter total solution.

## DeepCubeA and Neural Network Solvers

The 2018 paper "Solving the Rubik's Cube Without Human Knowledge" by Stephen McAleer, Forest Agostinelli, and others introduced DeepCubeA, the first neural-network-based cube solver to achieve competitive performance with traditional algorithms. DeepCubeA's architecture is based on AlphaZero-style self-play: a deep neural network is trained to estimate the distance from any cube state to the solved state, using only the cube's structural information (no human-derived patterns or heuristics) and a self-generated training corpus.

The training process works as follows. Start with a network whose weights are randomly initialized. Generate a large batch of cube states by taking random scrambles of varying lengths. For each state, perform a depth-limited IDA*-like search using the current network as the heuristic, and record the actual solution length found. Update the network weights so that its predicted distance for each state more closely matches the actual found distance. Repeat for many epochs.

After approximately 44 hours of training on a GPU cluster, DeepCubeA's network was producing distance estimates accurate enough to drive a near-optimal solver. The published results showed that DeepCubeA could solve 100% of test scrambles, with solution lengths averaging about 21 moves (compared to Kociemba's 22 moves and the true optimum of 18.3 moves). The solver's runtime was several seconds per scramble (significantly slower than Kociemba's milliseconds), but the demonstration that a neural network could learn to solve the cube without any human-derived domain knowledge was a striking validation of the broader AlphaZero paradigm.

Subsequent work has improved on DeepCubeA in various directions:

- "DeepCube" (an earlier 2018 paper by McAleer et al.) used Monte Carlo Tree Search on top of a learned value network, similar to AlphaZero's chess solver.
- "EfficientCube" (2021) reduced DeepCubeA's network size by 10x while maintaining solution quality, by using attention-based architectures.
- "CubeNet" (2022) explored transformer-based architectures and achieved solution lengths of about 20 moves on average.
- Several 2023-2024 papers have explored hybrid systems that use a neural network for the phase 1 heuristic in a Kociemba-style two-phase architecture, achieving sub-optimal solutions at speeds comparable to traditional Kociemba while requiring far less hand-crafted domain knowledge.

The practical impact of neural-network solvers on the cubing world has been limited so far. The solvers are slower than traditional algorithms, require GPU hardware to run efficiently, and produce solutions that are not noticeably shorter than min2phase's output. But the research is interesting both as a demonstration of neural-network capabilities and as a potential bridge to solving puzzles for which we do not have good hand-crafted heuristics — for example, novel twisty puzzles that have just been invented and for which the orbit structure is not yet well understood.

## Search Algorithm Advances

Beyond IDA* and its direct descendants, several other search algorithms have been applied to cube solving with varying degrees of success:

Bidirectional search starts two simultaneous searches, one from the start state and one from the goal state, and looks for a meeting point in the middle. For the cube, this can in principle reduce the search tree from O(b^d) to O(b^(d/2)), where b is the branching factor and d is the optimal depth. In practice, bidirectional search for the cube is complicated by the lack of an efficient duplicate-detection mechanism (since IDA* style searches do not maintain a closed list), so the constants in the asymptotic analysis are large. Most modern cube solvers do not use bidirectional search, though some research implementations have explored it.

Breadth-first search variants are useful for computing exact distance tables for small subgroups (e.g., the corner-only group, which has 88 million elements) but are infeasible for the full cube due to memory requirements. The IDA* "frontier search" variant attempts to combine BFS's exhaustiveness with IDA*'s memory efficiency by maintaining a frontier that is paged in and out of memory; the technique has been used successfully on the 4x4 cube and other large state spaces.

ALSI (Adaptive Linear Search Iteration) is a heuristic refinement that dynamically adjusts the IDA* threshold based on the search's progress. Standard IDA* increments the threshold by 1 at each iteration; ALSI increments by larger amounts if the search at the current threshold finds many promising nodes, and by smaller amounts otherwise. ALSI can be 2-3x faster than vanilla IDA* on the cube, but it produces solutions that are not strictly optimal (only "near-optimal"), so it is not used in production solvers that require optimality.

Beam search and its variants (e.g., LDS, A*-MS) are similar to IDA* but maintain only a limited number of frontier nodes at each depth, discarding the least promising. These algorithms are not optimal but can produce solutions much faster than IDA* on hard scrambles. They are sometimes used in scramble-generation contexts where solution quality is not the primary concern.

The "1.5x optimal" heuristic family is a class of algorithms that explicitly trade solution length for speed. The idea is to use a relaxed IDA* with a heuristic that overestimates the true distance by a factor of about 1.5, allowing aggressive pruning. The resulting solutions are guaranteed to be at most 1.5 times the optimal length, but the search is dramatically faster. For the cube, where typical optimal solutions are 18-19 moves, a 1.5x solver would produce solutions of at most 27-29 moves, which is comparable to or worse than Kociemba's 22-move output, so this approach is not particularly useful for the cube. It is more useful for larger puzzles like the 4x4 or 5x5 where exact optimal solving is infeasible.

## Insertion Finders for FMC

A specialized class of cube solvers serves the Fewest Moves Challenge (FMC) community: insertion finders. These tools take as input a partial solution (typically one that leaves a few pieces unsolved) and search for short algorithm insertions that complete the solution while minimizing the total move count. The most prominent insertion finder is "iisolver" (sometimes called "insertion-finder"), developed by Sebastiano Tronto and others starting around 2015.

The use case is as follows. An FMC competitor finds, by hand, a solution of (say) 30 moves that has a few inefficiencies — perhaps a 3-corner cycle at the end that requires 8 moves to fix, or a 5-cycle of edges that requires 11 moves. The competitor then runs an insertion finder on the solution, asking "is there a place in this solution where I can insert a commutator or other algorithm that, when combined with the move cancellations on either side, reduces the total move count?" The insertion finder searches over all positions in the solution and over all candidate algorithms (typically 3-cycles, parities, and similar short cases), reporting any insertions that save moves.

A typical FMC solve uses insertion finding in two or three passes. The competitor first finds a "skeleton" of 25-30 moves that solves most of the cube but leaves a few pieces wrong. They run the insertion finder, which suggests a 3-move insertion that fixes one error while canceling with the surrounding moves. The competitor then re-evaluates, possibly finds further inefficiencies, and runs the insertion finder again. The result is an FMC solution that may be 20-25 moves long despite having started as a 30-move skeleton.

Insertion finders are technically not "solvers" in the optimal sense — they do not compute optimal solutions from scratch. Instead, they augment human-found solutions with computer-discovered optimizations. This pairing of human creativity (in finding the skeleton) with computational optimization (in finding insertions) is uniquely productive for FMC, where the time constraint of 1 hour per scramble makes pure computational search infeasible.

The first widely-used insertion finder was developed by Hardwick Tilbury in the early 2000s for the FMC community, and it has been refined many times since. The modern iisolver and its variants can perform several million insertion-candidate checks per second, making it practical to exhaustively search the entire skeleton for the best possible insertion in a few seconds. The output is then a list of candidate insertions ordered by total moves saved.

## Mete Üstündağ and Stoyan Boychev's Solvers

Mete Üstündağ (Turkish cuber and software developer) has produced a series of highly-optimized cube solvers over the past decade, focused on extracting the maximum possible performance from modern hardware. His implementations use SIMD instructions (SSE, AVX, AVX-512) for the inner loop of IDA*, achieving roughly 10x speedup over scalar code on suitable CPUs. The solvers are typically released as part of larger cubing-software packages but are also available standalone for research use.

Stoyan Boychev (Bulgarian cuber, also known as "stoichkoboykov") developed "fastsolver," a Kociemba implementation in C++ that focuses on minimizing per-solve memory allocation and maximizing cache locality. Fastsolver's reported benchmarks show roughly 200,000 solves per second on a modern desktop CPU, making it among the fastest production solvers. The code is open source (MIT license) and has been incorporated into several other cubing tools.

The combined effect of these and other optimization-focused implementations is that the cubing software ecosystem now includes solvers at every point on the speed-quality tradeoff curve. A user who wants the absolute shortest possible solution at any cost can use a Korf-style optimal solver. A user who wants a near-optimal solution in a few milliseconds can use min2phase. A user who needs maximum throughput for batch processing can use fastsolver or its derivatives. A user who needs solutions in a browser can use the JavaScript port of min2phase via cubing.js or a similar library.

## Solver Source Code Analysis

A typical production cube solver consists of approximately 5,000 to 15,000 lines of C++ or Java code, depending on the algorithm and the level of optimization. The components are roughly:

- 1,000-2,000 lines: cube state representation (corner/edge permutation and orientation), move application, coordinate computation.
- 1,000-2,000 lines: pattern database generation (BFS, indexing, compression).
- 1,000-3,000 lines: IDA* search engine and its variants.
- 500-1,000 lines: symmetry reduction and canonical form computation.
- 500-1,000 lines: scramble validation, input parsing, output formatting.
- 1,000-3,000 lines: GUI or API interface (for solvers like cube-explorer that have a user interface).
- 500-1,500 lines: tests and benchmarks.

The total memory footprint at runtime depends heavily on the algorithm and the pattern databases:

- Korf-style optimal solver with full Korf pattern databases: ~1.1 GB.
- Kociemba two-phase with default pruning tables: ~2 MB.
- Kociemba two-phase with aggressive pruning tables (more memory, faster search): ~50 MB.
- ARPlanner-style fast Kociemba: ~1 MB (with smaller, lossy pruning tables).
- Mobile-optimized Kociemba: ~500 KB (using compressed lookup tables).

The cube state itself is tiny: a typical implementation uses 8 bytes for corner permutation (3 bits per corner, packed), 2 bytes for corner orientation (3-state per corner, packed), 6 bytes for edge permutation (4 bits per edge, packed), and 2 bytes for edge flip, for a total of 18 bytes per cube state. With move tables (precomputed coordinate updates for each of the 18 moves), a full move-application step is 3-5 memory accesses and a few cycles, fast enough that the inner loop of IDA* runs at roughly 100-300 million nodes per second on modern CPUs.

## Solver Verification

How do we know that a cube solver is correct? This is a real concern, because solvers are complex programs that combine carefully-crafted algorithms with extensive precomputed data, and bugs in either the algorithms or the data can produce subtle incorrect solutions that look plausible at first glance.

There are several verification approaches in common use:

Direct simulation: take the solver's output (a sequence of moves) and apply those moves to the input scrambled cube. If the result is the solved state, the solution is correct (in the sense of being a valid solution, regardless of whether it is optimal). This check is fast and catches the vast majority of bugs. Every production cube solver should run this check automatically on every solution before returning it.

Optimal-length verification: for solvers that claim to produce optimal solutions, the claimed solution length should match the actual optimal length. This can be checked by running an independent optimal solver and comparing lengths. For pseudo-optimal solvers (like Kociemba), the claimed solution length should be within some small bound (typically 2-3 moves) of the true optimum.

State-space sampling: generate many random scrambles, solve them with the candidate solver, and verify that the solutions are valid. Statistical irregularities in the solution lengths (e.g., bimodal distributions, suspiciously short solutions) can indicate bugs.

The "cube assertion library" — a set of utility functions for checking cube-state equality, validating move sequences, and verifying group-theoretic properties — is implemented in essentially every cube solver as part of its testing infrastructure. The most commonly-used such library is the one bundled with cubing.js, which provides a comprehensive set of assertions in TypeScript.

## Coordinate Systems

The "coordinate system" used by a cube solver is the encoding of the cube state into a small set of integers that uniquely identify the state and can be efficiently updated under move application. The choice of coordinates is one of the most important design decisions in a solver, because it determines the size of the pattern databases, the speed of the move-application step, and the memory layout of the search.

The most common coordinate system, used by both Korf's optimal solver and Kociemba's two-phase algorithm, has the following components:

- Corner permutation: a number from 0 to 8! - 1 = 40,319, encoding which permutation of the 8 corners is currently realized.
- Corner orientation: a number from 0 to 3^7 - 1 = 2186, encoding the orientations of the 8 corners (with the 8th orientation determined by the parity constraint).
- Edge permutation: a number from 0 to 12! - 1 = 479,001,599, encoding which permutation of the 12 edges is currently realized.
- Edge orientation: a number from 0 to 2^11 - 1 = 2047, encoding the orientations of the 12 edges (with the 12th orientation determined by the parity constraint).
- UD-slice: a number from 0 to C(12, 4) - 1 = 494, encoding which 4 of the 12 edges are in the UD-slice positions.

Each coordinate can be computed from the cube's facelet representation in O(n) time, where n is the number of pieces (8 or 12). The move-update for each coordinate is a lookup in a precomputed table of size 18 (one entry per move). The cube state can therefore be fully represented by the 5 coordinates above, and a single move-application step takes 5 lookups in precomputed tables.

The "rectangular projection" of the cube's facelet positions is the geometrical interpretation of these coordinates. Each cube state corresponds to a particular configuration of the 48 visible facelets on the cube's surface, and the coordinate system maps this configuration to a small set of integers via the orbit-stabilizer theorem applied to the cube's piece structure. The mapping is bijective: every set of valid coordinates corresponds to exactly one cube state, and vice versa.

## Move Encoding

The 18 face moves of the cube are typically encoded as integers 0-17, with a conventional ordering that matches the order in which they are enumerated by IDA*'s successor function. A common convention is:

- 0: U (clockwise 90 degrees)
- 1: U2 (180 degrees)
- 2: U' (counterclockwise 90 degrees)
- 3: D, 4: D2, 5: D'
- 6: L, 7: L2, 8: L'
- 9: R, 10: R2, 11: R'
- 12: F, 13: F2, 14: F'
- 15: B, 16: B2, 17: B'

The 3 slice moves (M, E, S) are sometimes included, giving 24 generators total, but in HTM these are redundant (M = LR' composed with rotation, etc.) so they are usually omitted from the solver's generator set and computed only when needed for display.

Move sequences are represented as arrays of these integers. A typical scramble (e.g., "R U R' U' R' F R2 U' R' U' R U R' F'") becomes an array like [9, 0, 11, 2, 11, 12, 10, 2, 11, 2, 9, 0, 11, 14], which is more compact and faster to process than the string form.

The move-cancellation rules (no two consecutive moves on the same face, no L immediately after R, etc.) are encoded as a 18x18 boolean table that the IDA* successor function consults to determine which moves are allowed given the previous move. This table is precomputed at solver startup and accessed via a branchless lookup in the inner loop.

## Solver Benchmarking

Benchmarking cube solvers is more subtle than it appears at first glance, because the per-scramble runtime varies enormously: some scrambles are "easy" and solve in microseconds, while others are "hard" and solve in milliseconds or seconds. The standard benchmarking methodology uses a corpus of WCA-standard scrambles (typically 1000 random scrambles generated by TNoodle's reference implementation) and reports the mean and percentile distributions of solve times.

A typical benchmark report might look like:

- Min: 50 microseconds
- 1st percentile: 100 microseconds
- 10th percentile: 200 microseconds
- 25th percentile: 400 microseconds
- 50th percentile (median): 1.0 milliseconds
- 75th percentile: 2.5 milliseconds
- 90th percentile: 5.0 milliseconds
- 99th percentile: 15 milliseconds
- Max: 80 milliseconds
- Mean: 2.3 milliseconds

The skew between mean and median is striking: most scrambles are solved much faster than the average. This skew reflects the heavy-tailed distribution of IDA* search times, where a small number of "pathological" scrambles dominate the mean. Solver developers track both the mean and the 99th-percentile times because the latter is often more relevant for real-world applications (you want to be sure your solver never takes too long, not just that its average is acceptable).

The "mean random optimal length" for cube scrambles is approximately 18.3 moves in HTM, based on extensive sampling of random scrambles. The distribution is sharply peaked around 18-19 moves, with very few scrambles requiring 17 or fewer moves and very few requiring 20 (the maximum possible by God's number).

## Implementation Languages

Cube solvers have been implemented in essentially every major programming language. The leading implementations in each language are:

C++: cubelib (Stefan Pochmann), kocube (Andrew Skalski), fastsolver (Stoyan Boychev), and various custom implementations by academic researchers. C++ is the dominant language for performance-critical solvers because it gives direct control over memory layout, branch prediction, and SIMD instructions.

Rust: cubelib's Rust port (also by Pochmann), rubiks-cube-solver (Anton Patrikeev). Rust has gained popularity in the past 5 years for cube solvers because of its strong memory safety guarantees combined with C++-level performance.

Java: min2phase (Chen Shuang), TNoodle (Lucas Garron). Java is the most portable language for cube solvers, and is the dominant choice for tools that need to run on Windows, macOS, Linux, and server platforms without modification.

Python: Charlie Vanaret's cube solver, several educational implementations. Python is much slower than C++ for solver inner loops (typically 100-200x slower), but it is widely used for prototyping new algorithms and for educational purposes.

JavaScript: cubing.js (Lucas Garron and collaborators), the in-browser solvers used by rubiks-cube-solver.com and similar sites. JavaScript is essential for browser-based solvers, and modern V8/SpiderMonkey JIT compilers can bring JavaScript performance to within 2-5x of C++ for numeric inner loops.

C#: a few Unity-based cube solver implementations, primarily for game engines and visualization tools. C# is a minority choice in the cubing-software ecosystem.

The choice of language for a new solver is primarily a tradeoff between performance (C++/Rust at the top, Python/JavaScript at the bottom) and portability/ease of integration (Java/JavaScript at the top, C++/Rust at the bottom).

## The Rust Renaissance

The past 5 years have seen a notable surge in Rust-based cube solvers. The reasons are several. First, Rust's memory safety guarantees eliminate an entire class of bugs (buffer overflows, use-after-free, data races) that have historically plagued C++ cube solvers, especially in concurrent or long-running scenarios. Second, Rust's package manager (Cargo) makes it easy to publish and consume cube-solver libraries, leading to a proliferation of high-quality implementations. Third, Rust's WebAssembly support means that the same Rust code can run as a native solver on a desktop and as a browser-embeddable solver in WebAssembly, eliminating the need to maintain separate C++ and JavaScript implementations.

The leading Rust cube solvers include:

- cubelib (Stefan Pochmann's port): a general-purpose library covering 2x2 through 7x7, plus several non-cube puzzles. Includes both Kociemba-style and optimal solvers.
- rubiks-cube-solver (Anton Patrikeev): a 3x3-focused implementation optimized for raw speed, achieves ~250,000 solves/second on modern hardware.
- twsearch (Lucas Garron's general-purpose search): a flexible search engine that can be configured for various twisty puzzles, including the 3x3.

These tools are typically distributed via Cargo (Rust's package manager) and have seen rapid adoption in the past 3 years.

## Cubing.js: The JavaScript Cube Library

Cubing.js is the leading open-source JavaScript library for cube software, developed by Lucas Garron with contributions from many others. It is used by the World Cube Association's website, by csTimer (the dominant online cubing timer), by the WCA Live competition software, and by countless smaller projects. The library provides:

- A full implementation of cube state representation, move application, and scramble generation for 2x2 through 7x7, Megaminx, Pyraminx, Square-1, and several other puzzles.
- A 3D animated cube visualization (using Three.js) with configurable colors, lighting, and animation timing.
- A scramble generator that produces WCA-quality scrambles using a JavaScript port of min2phase.
- Various utility functions for cube algorithm parsing, notation conversion, and statistical analysis.
- A unified API that abstracts over the different puzzle types, allowing user code to handle 2x2 through 7x7 with the same interface.

The library is written in TypeScript and compiled to ES2020 JavaScript. It is published on npm under the package name "cubing" and is consumed via standard JavaScript module imports. The library's design emphasizes correctness over raw speed: while not as fast as C++ or Rust implementations, it is fast enough for browser use (typically solving a 3x3 scramble in 10-50ms) and its API design makes it easy to integrate into web applications.

A notable feature of cubing.js is its support for "twizzle.net," a web-based tool for sharing and animating cube algorithms. Twizzle URLs encode an algorithm, its starting state, and various visualization parameters, allowing cubers to share specific algorithms or solutions via a single URL. The cubing.js library powers twizzle.net's rendering and animation.

## Performance Benchmarks for JavaScript

A standard benchmark for JavaScript cube solvers is to scramble 1 million random 3x3 cubes per second. This requires roughly 25 move applications per scramble and 1 millisecond per million operations, which is well within reach of modern JavaScript engines. Cubing.js achieves approximately 2-5 million scramble operations per second in modern Chrome/Firefox, which is comparable to native C++ implementations for this specific workload (because the bottleneck is memory access patterns rather than instruction count).

For full optimal solving in JavaScript, the performance is much worse: a min2phase solver in JavaScript takes about 50-200 milliseconds per scramble, compared to 1-5 milliseconds in Java or C++. The 30-50x slowdown is primarily due to JavaScript's lack of true integer types (numbers are floating-point 64-bit values) and the overhead of dynamic dispatch in the move-application step. WebAssembly versions of the same algorithms reduce the gap to about 3-5x, but this is still a significant penalty.

For most browser use cases, this performance is acceptable: the human user is waiting on the order of seconds, not milliseconds, so even 200ms of solver time is invisible. For applications that need to solve thousands of scrambles per second (e.g., generating training data for a neural network), a server-side C++ or Rust solver is far preferable.

## Educational and Demonstration Solvers

A distinct category of cube solver focuses on educational value rather than performance. These solvers are designed to demonstrate the inner workings of solving algorithms — typically CFOP, Roux, or beginner's methods — rather than to produce optimal or fast solutions. The most prominent examples include:

- "The Optimal Cube Tutor" (originally a Java applet, now a web app), which shows the optimal solution to any given scramble in step-by-step form, with explanations of each move.
- "CFOP Step-by-Step" (various implementations on YouTube and as web apps), which walks through a scramble using the CFOP method, showing the cross, F2L pairs, OLL, and PLL stages as separate phases.
- "Beginner's Method Visualizer," which uses the 7-step beginner's method (often called the Layered method) and animates each step with text annotations.
- "Reconstruction tools" (e.g., the one built into cubedb.net, or alg.cubing.net), which take a scramble + solution pair and animate the solution while showing the cube state at each point.

These tools are pedagogically valuable: they help beginners understand what each step of a method does, and they help intermediate cubers analyze their own solves by reconstructing them on a virtual cube. They are not designed for speed, and their solver implementations typically use simple beginner-method algorithms rather than optimized two-phase or optimal solvers.

The "Reconstruction" subgenre deserves special mention. A reconstruction tool takes the move sequence produced by a competitor's solve (either typed manually or extracted from a video) and displays the cube's state at each point during the solve. This is invaluable for analysis: the competitor (or their coach) can see exactly which moves were inefficient, which look-ahead opportunities were missed, and which algorithm choices were optimal. The most prominent reconstruction tools include alg.cubing.net (a generic algorithm visualizer with cube reconstruction support), cubedb.net (a database of competition solves with reconstruction), and the SpeedSolving.com forums (where reconstructions are routinely posted and discussed).

## Algorithm Generators

Beyond solvers, the cubing-software ecosystem includes a number of "algorithm generators" — tools that produce optimized algorithms for specific cube cases. The most prominent of these are:

- The "ZBLL generator" (various implementations, most prominently by Jabari Nuruddin), which computes optimal algorithms for each of the 493 ZBLL (Zborowski-Bruchem Last Layer) cases. The output is a database of algorithms that can be used by ZB-method solvers.
- The "COLL generator" (similar in concept), for the 42 COLL (Corners and Orientation of Last Layer) cases.
- The "OLLCP generator" for the 331 OLLCP (Orientation of Last Layer with Corner Permutation) cases.
- The "1LLL generator" for the 3915 1LLL (One-Look Last Layer) cases, the full set of algorithms that solve the last layer in a single look.

Each of these generators uses a variant of Kociemba's algorithm restricted to producing algorithms that match a specific case constraint (e.g., "orient the corners using only U, R, F moves while keeping the F2L intact"). The output is a database of algorithms sorted by move count, which speedcubers use to memorize the shortest and most ergonomic algorithms for each case.

The "Alg Generator" (a generic tool used by many algorithm databases) takes as input a case description and a set of constraints (move types allowed, length limit, no-cancellation requirement) and outputs all valid algorithms matching those constraints. This is used by cubing community members to discover new algorithms or to verify that existing algorithm databases are complete.

## Algorithm Visualization

Visualizing cube algorithms is a substantial subgenre of cubing software in its own right. The most prominent tools include:

- VisualCube (developed by Conrad Rider, now bundled with cubing.js): produces static SVG images of cube positions, with extensive customization options for colors, viewing angle, and animation.
- The "Twisty Puzzle Simulator" (multiple implementations, most prominently cubing.js's TwistyPlayer): an interactive 3D cube model that can be manipulated with mouse or touch input.
- Alg.cubing.net: a web app that takes a written algorithm and displays the cube state before and after, with animation support.
- The various cube tools embedded in CubeSkills.com, CubingChicken.com, and similar instructional sites: typically wrappers around cubing.js's TwistyPlayer.

VisualCube in particular has become the de facto standard for static cube images on the web. Its API is simple (pass a sequence of moves as a URL parameter, get back an SVG image of the resulting cube state) and its output is high-quality (vector graphics, customizable, scalable). VisualCube images appear on essentially every cube algorithm database, every cubing tutorial site, and every competition results page.

## The Reconstruction Pipeline

A "reconstruction" of a cube solve is the move-by-move record of what the competitor did. The full reconstruction pipeline takes a video of a solve (recorded by the competitor or a spectator) and produces a written move sequence that, when applied to the inspection-state cube, produces the same end state as the video shows. The pipeline has several stages:

1. Identify the scramble: read the WCA-issued scramble from the competition record or transcribe it from the video.
2. Identify the moves: watch the video frame-by-frame and write down each move the competitor performs.
3. Verify the result: apply the transcribed moves to the scrambled cube and check that the end state matches the video's solved cube.
4. Annotate the reconstruction: identify which moves correspond to which CFOP/Roux/etc. step, note any inefficiencies, and produce a written analysis.

The manual transcription step is laborious — a 6-second solve might contain 50 moves, and each must be identified from frame-by-frame video — but several automated tools have been developed to assist:

- "Cubedb.net's reconstruction assistant" (semi-automated): proposes likely moves based on the video and asks the human to verify.
- "Speedsolving.com's reconstruction forum tools": a series of automated reconstruction scripts contributed by community members.
- "Auto-reconstruct" (experimental tool by Walker Garber, 2022): a deep-learning-based system that takes raw video and produces a reconstruction with about 80% move accuracy.

For smart cubes (cubes with internal sensors that broadcast move data via Bluetooth), reconstruction is trivial: the cube itself records the move sequence, which is uploaded directly to the timer app. This is why competitions with smart cubes (still rare in 2025, but growing) produce immediate machine-readable reconstructions.

## SpeedSolving.com's Tool Ecosystem

SpeedSolving.com is the largest cubing forum in the English-speaking world, with approximately 100,000 registered users and hundreds of thousands of forum posts dating back to the early 2000s. The site has spawned a substantial ecosystem of supporting tools, many developed by forum members:

- The "Solves Database": a community-curated database of notable solves, with reconstructions, video links, and analysis.
- "Cuber's Tools" (cubeskills.com's tool suite): includes a timer, scramble generator, algorithm visualizer, and reconstruction analyzer.
- The "alg counter": a tool for counting the number of moves in an algorithm, including cancellations between adjacent moves.
- "Algorithm conversion tools": notation translation between Singmaster (R U R' U'), WCA (R U R' U'), and various alternative notations used by historical methods.
- The "PLL trainer" and "OLL trainer" (various implementations): timed practice tools for the last-layer algorithms.

These tools are independently maintained by community members and are typically free and open-source. The cumulative effect is a rich software ecosystem that supports cubers at every level, from beginner to world-record holder.

## The Cubing.js Tool Suite

In addition to the core cubing.js library, Lucas Garron and collaborators have developed a substantial suite of cubing tools built on top of it:

- twizzle.net: the URL-based algorithm sharing tool described earlier.
- "twsearch": a general-purpose puzzle search engine, used for computing distances in arbitrary twisty puzzles.
- "cubing-chrome-extension": a browser extension that adds cube widgets to various websites.
- "scramble-server" (experimental): a server-side scramble generation API for high-throughput applications.

These tools are all open-source (most under the MIT license) and are continuously maintained. They form the technical foundation of much of the modern cubing-software ecosystem.

## The Software-Hardware Bridge

A final category worth mentioning is the software that bridges between cube solvers and physical cube robots. Robots that solve a physical Rubik's Cube — such as the famous Sub-1 Reloaded (which solved a cube in 0.637 seconds, holding the robot world record from 2018 to 2024) and the more recent MIT MIRI-1 (which solved in 0.305 seconds in 2024) — combine a solver (typically a min2phase implementation) with mechanical actuators that physically turn the cube's faces. The software for these robots includes:

- Computer vision modules that identify the cube's color configuration from cameras.
- Solver modules (usually min2phase or a variant) that compute a solution.
- Motion-planning modules that translate the solution into actuator commands.
- Real-time control loops that coordinate the actuators with sub-millisecond timing.

The software is typically written in C++ for real-time performance, with substantial use of FPGA or GPU acceleration for the computer vision step. The total software stack for a competitive cube-solving robot runs to roughly 50,000-100,000 lines of code, of which the cube solver itself is a small fraction (~5,000 lines).

The bridge between cube software and cube hardware has been a fertile area of innovation. Smart cubes (Bluetooth-enabled cubes that report their state in real time) are essentially the inverse of cube robots: instead of software controlling hardware to solve a cube, the hardware reports its state to software for analysis. The same underlying solver algorithms apply, but the interface is different.

## Conclusion: The State of the Art

As of 2025, the state of the art in cube solver software is as follows:

- Optimal solving (provably shortest solution) for random scrambles: ~100 milliseconds per scramble on a modern desktop, using IDA* with Korf-style pattern databases. Memory footprint ~1.1 GB.
- Near-optimal solving (within 2-3 moves of optimal) for random scrambles: ~1 millisecond per scramble, using Kociemba's two-phase algorithm with min2phase or a similar implementation. Memory footprint ~2 MB.
- Fast sub-optimal solving (within 5-10 moves of optimal) for random scrambles: ~0.05 milliseconds per scramble, using ARPlanner-style fast Kociemba. Memory footprint ~1 MB.
- God's number is proven to be 20 in HTM (Rokicki, Davidson, Dethridge, Kociemba, 2010). The proof has been independently verified and can now be re-run on a modern desktop in a few hours.
- The full distance distribution of cube positions has been tabulated. The mean optimal solution length for random scrambles is 18.3 moves.
- Open-source solver implementations are available in C++, Rust, Java, JavaScript, and Python. The leading implementations are cubelib (C++/Rust), min2phase (Java), cubing.js (JavaScript/TypeScript), and Charlie Vanaret's cube (Python).
- Neural-network-based solvers (DeepCubeA and its successors) can solve the cube without human-derived heuristics, but are slower than traditional algorithms and have not displaced them in production use.
- The WCA's official scrambler, TNoodle, generates scrambles for all WCA competitions using min2phase. The scrambles are verified to require at least 21 moves to solve optimally.

The cumulative effect of forty years of research is that solving the Rubik's Cube — once considered a hard problem that took weeks of computation for a single optimal solution — is now essentially free. A modern computer can solve thousands of cube scrambles per second, and the solver fits in a few megabytes of memory. The remaining open questions are mostly aesthetic: how to produce solutions that are not just optimal but also short, ergonomic, and pedagogically valuable. The answers to those questions are being developed by the same community that produced the algorithms in the first place, often in tools that build directly on the foundations laid by Korf, Kociemba, Rokicki, and their successors.

The story of cube solver software is, in many ways, the story of how a focused, motivated, technically-sophisticated amateur community can produce world-class research without institutional support. The major breakthroughs — Kociemba's two-phase algorithm in 1992, Korf's optimal solver in 1997, Rokicki's God's number proof in 2010 — were achieved by individuals working in their spare time, with no funding beyond what their own employers provided indirectly. The open-source nature of the resulting tools means that anyone with a computer and an internet connection can use them, modify them, and contribute to their development. The cube remains a remarkable case study in how a small, dedicated community can solve a hard mathematical problem using collective effort over decades.

## Appendix: A Working Implementation Sketch

For readers who want to implement their own cube solver, here is a sketch of a minimal Kociemba two-phase solver in approximately 500 lines of pseudocode. The implementation requires:

1. A cube state representation: 8 bytes corner permutation (3 bits each), 2 bytes corner orientation, 6 bytes edge permutation (4 bits each), 2 bytes edge flip. Total: 18 bytes per state.

2. Move application: 18 precomputed move tables, each containing the result of applying each of the 18 face moves to a "canonical" starting state. Each move table is 18 bytes (the new state), so the total size is 18 × 18 = 324 bytes per move table type (one for each coordinate).

3. Coordinate computation: 5 functions, one per coordinate (corner permutation, corner orientation, edge permutation, edge flip, UD-slice). Each function takes a cube state and returns an integer in the valid range for that coordinate.

4. Pruning table generation: for each pair of coordinates that we want to use as a pruning heuristic, perform a BFS from the solved state in the reduced coordinate space, marking each state with its depth. Store the depths as one byte per state. For phase 1, we use (corner orientation × UD-slice) at 2187 × 495 = 1,082,565 entries and (edge orientation × UD-slice) at 2048 × 495 = 1,013,760 entries. For phase 2, we use (corner permutation × UD-slice) at 40320 × 24 = 967,680 entries and (edge permutation × UD-slice) at 40320 × 24 = 967,680 entries.

5. IDA* search: a recursive depth-first search with iterative deepening, using the maximum of the relevant pruning table values as the heuristic. The search terminates when it reaches the goal state (the identity for phase 2, or a state in H for phase 1).

6. Two-phase coordination: run phase 1 with iteratively-increasing thresholds; for each phase 1 solution found, run phase 2 from the resulting H position; keep the shortest total solution found.

The total implementation is approximately 500 lines of Python, or 1000 lines of C++ if optimized for speed. The runtime is approximately 100 milliseconds per scramble in Python, or 1 millisecond in C++. The memory footprint is approximately 4 megabytes (the four pruning tables combined). This is sufficient to solve cube scrambles at WCA-acceptable quality, and serves as a useful baseline for understanding the more sophisticated implementations described above.

## Appendix: Glossary of Solver Terminology

For reference, here is a brief glossary of the technical terms used in this chapter:

- IDA*: Iterative-Deepening A*, a search algorithm that combines A*'s heuristic guidance with iterative deepening's memory efficiency.
- A*: a heuristic search algorithm that uses an admissible heuristic to guide the search toward the goal.
- Admissible heuristic: a heuristic that never overestimates the true distance to the goal. Admissibility guarantees that A* and IDA* return optimal solutions.
- Pattern database: a precomputed lookup table that gives the exact minimum number of moves required to solve a particular subset of the cube's state.
- Coordinate: an integer that uniquely identifies a particular aspect of the cube's state (e.g., corner orientation).
- Coset: an equivalence class of cube positions under the action of some subgroup. Used in Kociemba's algorithm to partition the cube state space.
- HTM: Half-Turn Metric, the convention that counts a half-turn (e.g., U2) as one move.
- QTM: Quarter-Turn Metric, the convention that counts a half-turn as two moves.
- STM: Slice-Turn Metric, a metric that counts slice moves (e.g., M, E, S) as single moves.
- Phase 1: in Kociemba's algorithm, the phase that reduces the cube to a position in the subgroup H.
- Phase 2: in Kociemba's algorithm, the phase that solves a position in H using only H's generators.
- H: in Kociemba's algorithm, the subgroup generated by U, D, L2, R2, F2, B2.
- Antipode: a cube position that is maximally distant from the solved state (at distance 20 in HTM).
- God's number: the maximum number of moves required to solve any cube position. Proven to be 20 in HTM for the 3x3 cube.
- Skeleton: in FMC, a partial solution that solves most of the cube but leaves a few pieces wrong.
- Insertion: in FMC, a short algorithm sequence inserted into a skeleton to fix remaining errors while minimizing total move count.
- Smart cube: a Rubik's Cube with internal sensors that broadcasts move data via Bluetooth.
- Reconstruction: the move-by-move record of a cube solve, used for analysis and sharing.
- Scramble: a sequence of moves applied to a solved cube to produce a randomized starting position.
- Two-phase: Kociemba's algorithm, named for its decomposition into two phases via the intermediate subgroup H.
- Optimal: a solution that uses the minimum possible number of moves.
- Sub-optimal: a solution that uses more than the minimum possible number of moves, but is still valid.
- Near-optimal: a solution that uses close to (typically within 2-3 moves of) the minimum possible number of moves.

This concludes the deep dive on 3x3 cube solver software, algorithms, and computational tools. The field is mature in its foundations but continues to evolve in its details, with new implementations, new optimizations, and new applications appearing regularly. The cube remains, after four decades of attention, one of the most interesting and well-understood combinatorial search problems in recreational mathematics.

## Further Reading and Source Code

For readers who wish to explore further, the following are the most important primary sources:

- Korf, R. E. (1997). "Finding optimal solutions to Rubik's Cube using pattern databases." AAAI-97. The original paper introducing the IDA* + pattern database approach for the cube.
- Kociemba, H. (1992-present). "The Two-Phase Algorithm." Available at kociemba.org. The original description of the two-phase algorithm, continuously updated by the author.
- Rokicki, T., Kociemba, H., Davidson, M., Dethridge, J. (2014). "The Diameter of the Rubik's Cube Group is Twenty." SIAM Journal on Discrete Mathematics. The formal write-up of the God's number proof.
- Culberson, J., Schaeffer, J. (1996). "Searching with Pattern Databases." Canadian AI Conference. The original paper introducing pattern databases for the 15-puzzle.
- Felner, A., Korf, R. E., Hanan, S. (2004). "Additive Pattern Database Heuristics." Journal of Artificial Intelligence Research. The paper introducing additive pattern databases.
- McAleer, S., Agostinelli, F., et al. (2018). "Solving the Rubik's Cube Without Human Knowledge." Nature Machine Intelligence. The DeepCubeA paper.

For source code, the following are the most important open-source implementations:

- min2phase (Java): github.com/cs0x7f/min2phase. The Java implementation used by TNoodle and csTimer.
- cube-explorer (C++): kociemba.org/cube.htm. Kociemba's own implementation with GUI.
- cubelib (Rust): github.com/spomky-labs/cubelib. Stefan Pochmann's Rust implementation.
- cubing.js (TypeScript): github.com/cubing/cubing.js. The JavaScript library used in browser-based cube applications.
- TNoodle (Java): github.com/thewca/tnoodle. The WCA's official scramble generator.
- ksolve (C++): various forks on github. The general-purpose puzzle solver.

The combination of these papers and source code represents essentially the entire publicly-available knowledge base on cube solver algorithms. Anyone who reads them carefully and works through the implementations will have a complete picture of how computers solve Rubik's Cubes.

## Final Note: The Persistence of Open Source

One striking feature of the cube software ecosystem is the dominance of open-source code. Essentially every important cube solver — Korf's reference implementation, Kociemba's cube-explorer, Rokicki's God's number proof code, TNoodle, min2phase, cubelib, cubing.js, ksolve — is freely available under permissive licenses. There is no commercial cube solver of any significance; the few attempts to commercialize cube software (mostly mobile apps with paid features) have been peripheral to the main research and development effort.

This open-source pattern is partly a reflection of the cubing community's amateur, hobbyist nature. The major contributors are mostly working in their spare time without commercial expectations, and the natural way to share their work is via open source. But it also reflects a deeper truth: the value of cube software comes primarily from its correctness and its integration with other tools, not from its scarcity. A closed-source cube solver that produced 20-move solutions would not be more valuable than the open-source ones already available; what makes the open-source solvers valuable is that they are correct, are widely used, are integrated with the WCA's competition infrastructure, and can be modified and extended by anyone who needs to.

The result is a remarkably collaborative software ecosystem in which improvements made by any contributor benefit everyone. When Chen Shuang improves min2phase, his changes flow through to TNoodle, to csTimer, to the dozens of mobile apps that bundle min2phase, and to the academic researchers who use min2phase as a baseline for their own work. When Lucas Garron improves cubing.js, his changes flow through to twizzle.net, to the WCA's web tools, and to the educational sites that build on cubing.js. The ecosystem rewards contribution rather than hoarding, and the result has been a steady accumulation of high-quality software that has made the cube one of the best-supported recreational mathematics problems in the world.

This collaborative spirit is, in its own way, the most important feature of cube solver software. The algorithms and the implementations are interesting in themselves; but the community that produced them, and that continues to produce them, is perhaps more interesting still. It is a model of how amateurs working together can build software systems that rival those produced by professional teams with institutional funding, and it has lessons that apply far beyond the world of twisty puzzles.

## A Closer Look at Pattern Database Construction

The construction of a pattern database is worth examining in more detail, because the subtleties of the construction process are where most novice implementations go wrong. Let us walk through the construction of the corner-only pattern database step by step.

The corner-only sub-problem treats the 8 corners of the cube as the only relevant pieces, ignoring the 12 edges entirely. The state of this sub-problem is described by the permutation of the 8 corners (8! = 40,320 possibilities) and the orientations of the 8 corners (3^7 = 2187 possibilities once the parity constraint is applied). The total state space is 40,320 × 2187 = 88,179,840 states, which fits comfortably in memory if we use one byte per state for the depth value.

To index the state space, we need a bijection between corner states and integers in the range from 0 to 88,179,840. The standard approach uses the Lehmer code (also called the factoradic representation) for permutations and a base-3 expansion for orientations. The Lehmer code of a permutation p of n elements is an integer L(p) defined as follows: for each position i from 0 to n-2, count the number of elements at positions j greater than i with p[j] less than p[i]; let L_i be this count; then L(p) equals the sum over i of L_i times (n-i-1) factorial. This gives a bijection from permutations of n elements to integers in the range from 0 to n factorial. For n equals 8, the corner permutation has Lehmer code in the range from 0 to 40,320.

The corner orientation can be encoded similarly. We treat each corner orientation as a digit in base 3 (with values 0, 1, 2 for the three possible orientations), and concatenate the first 7 corner orientations into a single base-3 number. The 8th corner's orientation is determined by the parity constraint (sum of all orientations is 0 mod 3), so it is redundant. The result is an integer in the range from 0 to 2187.

The combined index is the permutation index times 2187 plus the orientation index, giving an integer in the range from 0 to 88,179,840. This is the index into our pattern database.

The BFS proceeds as follows. Initialize a byte array of size 88,179,840 with all entries set to 255 (a sentinel value indicating "unvisited"). Set the entry for the solved state (index 0 for both permutation and orientation, hence index 0 overall) to depth 0. Initialize a queue containing the solved state. While the queue is non-empty, pop the front state, look up its depth d, and for each of the 18 face moves, compute the result of applying that move; if the result has not been visited (depth still 255), set its depth to d plus 1 and add it to the queue. Continue until the queue is empty.

The result is a depth array in which entry i contains the minimum number of face moves required to solve the corner state with index i. The maximum depth is 11 (this is the diameter of the corner-only sub-problem), so we could pack the depths into 4 bits per entry if we wanted to save memory. In practice, most implementations use one byte per entry for simplicity.

The implementation has several pitfalls that catch novice developers. The most common is the move-application function: when we apply a face move to a corner state, we must update both the permutation and the orientation correctly. The permutation update is a 4-cycle on the four corners adjacent to the moved face, which can be implemented as four array assignments. The orientation update is trickier: a quarter turn of the F, B, L, or R face changes the orientations of all four adjacent corners according to a fixed pattern (specifically, two corners get their orientation increased by 1 mod 3 and two get their orientation increased by 2 mod 3), while a quarter turn of the U or D face leaves all orientations unchanged. A common bug is to apply the orientation update only on F, B, L, R quarter turns but forget that F2, B2, L2, R2 also do not change orientations (because two consecutive quarter turns return to a state where the net orientation change is 0 mod 3). Another common bug is to forget that the orientation constraint applies only to the first 7 corners, and to incorrectly compute the orientation of the 8th corner.

Once these subtleties are handled correctly, the BFS runs in about 30 seconds on a modern desktop, producing the 88-megabyte pattern database. The database can then be loaded into memory at solver startup (or memory-mapped from disk if memory is tight) and queried with a single array lookup per cube state during the IDA* search.

## The Edge Pattern Databases

The edge sub-problems are more complex than the corner sub-problem because the edge state space (12! times 2^11 equals 980,995,276,800) is too large to enumerate fully. Korf's solution was to use partial pattern databases: instead of all 12 edges, take a subset of (say) 7 edges and treat the remaining 5 as "ignored." The 7-edge sub-problem has state space 12! divided by (12 minus 7) factorial times 2^7, which equals (12 times 11 times 10 times 9 times 8 times 7 times 6) times 128, which equals 3,991,680 times 128, which equals 510,935,040 states, which is large but fits in 510 megabytes if we pack one byte per entry.

The BFS for the 7-edge pattern database is more involved than for the corner database because we need to handle the partial state correctly. When we apply a face move to a partial edge state, we need to track which of the 7 tracked edges are affected and update only those. If a face move moves a tracked edge to a position that was previously occupied by an ignored edge, the partial state's representation must handle this by tracking which positions are occupied by tracked edges.

Korf's solution was to index the partial state by tracked-edge-permutation-and-positions times tracked-edge-orientations. The permutation-and-positions component is an integer indicating which 7 of the 12 edge positions are occupied by tracked edges, and in what order; this is computed by a generalization of the Lehmer code. The orientations component is a base-2 representation of the 7 tracked edges' orientations (with the parity constraint applied to the full 12 edges, not the 7 tracked edges).

The two 7-edge databases use disjoint sets of tracked edges (one tracks edges 0 through 6, the other tracks edges 5 through 11, with edges 5 and 6 in common to ensure consistent parity). The combined heuristic for a full cube state is the maximum over the corner database, the first 7-edge database, and the second 7-edge database. Korf's published results show that this combined heuristic is typically within 1 to 2 moves of the true optimal distance, which is tight enough to prune the IDA* search tree to manageable size.

## The Modern Refinements

Since Korf's 1997 paper, the basic IDA* plus pattern database approach has been refined in several ways:

Disjoint additive pattern databases (Felner et al., 2004): if we partition the cube's pieces into groups such that no move affects pieces in more than one group, then the sum of the pattern database values for each group is a valid lower bound on the total move count. For the cube, we can partition the 12 edges into two groups of 6 each, and use the sum of the two 6-edge pattern databases as an additive heuristic. This is tighter than the maximum heuristic and gives roughly 5 to 10 times speedup over the naive maximum heuristic.

Symmetric pattern databases: for each cube state, we can compute the value of the pattern database for each of the 48 symmetry-equivalent states and take the maximum. This is a more aggressive form of pruning that exploits the cube's symmetry group. The downside is that it requires computing the canonical form of each state, which adds overhead to each pattern database lookup.

Memory-efficient pattern databases: Korf's original 88-megabyte corner database is comfortably loadable into modern memory, but the 510-megabyte edge databases were a stretch even on 1997 hardware. Subsequent refinements have used various compression techniques (run-length encoding, Huffman coding, vector quantization) to reduce the memory footprint of pattern databases by factors of 2 to 5 times with little loss of heuristic tightness.

Parallel pattern database generation: the BFS used to generate pattern databases can be parallelized across multiple CPU cores by partitioning the state space and having each core process its partition independently. This is straightforward in principle but requires careful coordination to handle the boundaries between partitions correctly. Modern implementations can generate the corner database in 10 to 20 seconds on a 16-core CPU, compared to 30 plus seconds on a single-core machine.

GPU-accelerated solvers: in the past 5 years, several researchers have explored using GPUs to accelerate the inner loop of IDA* search. The challenge is that IDA* is inherently sequential (each iteration depends on the previous one), so the parallelism comes from running multiple independent searches simultaneously. With thousands of GPU cores running thousands of independent IDA* searches in parallel, the throughput can reach millions of solves per second on a single GPU. This is overkill for most applications but is useful for generating training data for neural-network solvers.

## The Beauty of the Algorithm

It is worth pausing to appreciate the mathematical beauty of Kociemba's two-phase algorithm. The decomposition of the cube into two phases via the intermediate subgroup H is not just a clever engineering trick; it reflects a deep structural property of the cube group. The subgroup H is precisely the set of cube positions in which all corner orientations are correct, all edge orientations are correct, and the UD-slice edges are in the UD-slice. These three conditions are exactly the invariants of the H-generators (U, D, L2, R2, F2, B2), and they partition the cube's state space into the 2.2 billion cosets that Rokicki later exploited for the God's number proof.

The algorithm thus has a natural geometric interpretation. The cube group G is a 4.3-quintillion-element group; the subgroup H is a 19.5-billion-element subgroup; and the quotient G/H is a 2.2-billion-element coset space. Phase 1 of Kociemba's algorithm navigates the coset space (finding a coset representative that brings us into H), and phase 2 navigates the subgroup H itself (solving the residual position using only H's generators). The two-phase structure mirrors the two-level structure of the group itself.

This kind of decomposition (exploiting subgroup structure to break a hard search problem into easier pieces) is a general technique that applies to many combinatorial search problems beyond the cube. The cube is just an unusually good example because its group structure is unusually rich and its subgroup H is unusually well-suited to enumeration. The Thistlethwaite algorithm (which preceded Kociemba's and uses four nested subgroups instead of two) was an earlier exploration of the same idea, with similar but less efficient results.

The Thistlethwaite algorithm deserves a brief mention. Morwen Thistlethwaite, a British mathematician (who would later become famous for his work on knot theory), proposed his algorithm in 1981. It uses a chain of four nested subgroups G_0 superset G_1 superset G_2 superset G_3 equals identity, with each step reducing the cube to a position in the smaller subgroup using a restricted move set. The resulting algorithm finds solutions of approximately 45 to 52 moves on average, which is much worse than Kociemba's 22 moves but was a significant improvement over the pre-1980 algorithms. The Thistlethwaite algorithm was implemented in several early cube solvers and remained the dominant approach until Kociemba's two-phase algorithm superseded it in the early 1990s.

## A Brief History of Computational Cube Solving

To put the modern state of the art in historical perspective, here is a brief timeline of the major milestones in computational cube solving:

1980 to 1981: David Singmaster publishes the standard notation for cube moves (U, D, L, R, F, B) that is still in use today. The first computer cube solvers begin to appear, mostly using brute-force search with weak heuristics. Typical solution lengths are 100 to 200 moves.

1981: Morwen Thistlethwaite publishes his four-phase algorithm, producing solutions of approximately 45 to 52 moves in seconds of CPU time. This is the first systematic approach to computer cube solving.

1985: Richard Korf publishes the IDA* algorithm, providing the theoretical foundation for the optimal cube solvers that would follow.

1992: Herbert Kociemba publishes his two-phase algorithm, achieving solutions of approximately 22 to 25 moves in milliseconds. This is the dominant cube-solving algorithm for the next three decades.

1996: Culberson and Schaeffer introduce pattern databases for the 15-puzzle, providing the heuristic technique that would soon be applied to the cube.

1997: Korf publishes his optimal cube solver, using IDA* with pattern databases to find optimal solutions in 5 to 15 seconds. This is the first solver to consistently produce optimal solutions for random cube scrambles.

2000 to 2010: The cube-explorer GUI tool is continuously developed. Various refinements to Kociemba's algorithm are published, including faster pruning tables and better phase 1 enumeration. Cube20.org begins to track upper and lower bounds on God's number.

2009: TNoodle is introduced as the WCA's official scrambler. min2phase becomes the most widely deployed cube solver, embedded in TNoodle, csTimer, and most mobile apps.

2010: Rokicki, Davidson, Dethridge, and Kociemba prove that God's number is exactly 20 in HTM. The proof requires approximately 35 CPU-years of computation, donated by Google.

2015 to 2020: Various optimization-focused implementations push the speed of Kociemba solvers below 1 millisecond per solve. The "1ms challenge" becomes an informal benchmark in the cubing-software community.

2018: McAleer et al. publish DeepCubeA, the first neural-network-based cube solver to achieve competitive performance. This opens up a new research direction in learned heuristics.

2020 to 2025: The Rust ecosystem produces several new high-performance cube solvers, including cubelib and twsearch. WebAssembly-based solvers achieve near-native performance in browsers. Smart cubes become more widely adopted, leading to new applications for real-time solver integration.

The trajectory is one of steady refinement: each decade has produced significant improvements in solver speed, solution quality, or applicability, while building on the foundations laid by the previous decade. The cube solver as a piece of software has gone from a research curiosity in the 1980s to a routine engineering tool in the 2020s, and there is no sign that the pace of improvement is slowing.

## The Verification Problem in Detail

The problem of verifying that a cube solver is correct deserves more detailed treatment, because it is where many otherwise-good implementations fall short. The basic question is: how do we know that the solver's output is a valid solution to the input scramble?

The first level of verification is direct: take the input scramble, apply the solver's output moves to a virtual cube, and check that the resulting state is the solved state. This catches the vast majority of bugs (incorrect move application, off-by-one errors in coordinate computation, and similar) but does not catch subtle errors in the solver's optimality claims.

The second level of verification is to compare the solver's output against an independent solver. If both solvers produce solutions of the same length for the same scramble, this is strong evidence that both are correct (or at least that they have the same bugs). If they produce solutions of different lengths, one of them is wrong. This kind of cross-verification has been used by all major cube solver projects: min2phase was cross-verified against cube-explorer, cubelib was cross-verified against min2phase, and so on.

The third level of verification is to use the solver to compute statistical properties of large corpora of scrambles, and to compare these statistics against theoretical predictions. For example, the mean optimal solution length for random cube scrambles is known to be approximately 18.3 moves (from the God's number proof's tabulation of the distance distribution). If a solver's mean output length over a corpus of random scrambles is significantly different from 18.3, this indicates either that the solver is not actually producing optimal solutions or that the random scramble generator is biased.

The fourth and most stringent level of verification is formal verification: proving mathematically that the solver's algorithms are correct. This has been done for portions of various cube solvers (the move-application functions, the coordinate computation functions) but has not been done for the full algorithms, because the algorithms are complex enough that formal proofs would be impractical. The closest approach is the "executable specification" used by some research implementations: a slow but obviously-correct reference implementation that is used to test the optimized production implementation.

The pragmatic approach used by most cube solver projects is a combination of the first three levels: extensive unit tests for the move-application functions, cross-verification against independent solvers for the IDA* and Kociemba algorithms, and statistical sanity checks for the overall output. This is sufficient to catch the vast majority of bugs in practice, though it does not give the certainty that formal verification would provide.

## The Performance of Modern Implementations

To give a concrete sense of the performance of modern cube solvers, here are some benchmark numbers from typical 2024 hardware:

Modern desktop CPU (Intel i9-13900K or AMD Ryzen 9 7950X, around 5 GHz, 32 cores):
- min2phase (Java): 1.5 milliseconds per scramble, average solution 22 moves.
- cubelib (Rust): 0.5 milliseconds per scramble, average solution 22 moves.
- kocube (C++): 0.3 milliseconds per scramble, average solution 21 moves.
- Korf optimal (C++): 80 milliseconds per scramble, average solution 18.3 moves.

Modern laptop CPU (Apple M2 Pro, around 3.5 GHz, 10 cores):
- min2phase: 3 milliseconds per scramble.
- cubelib: 1.5 milliseconds per scramble.
- Korf optimal: 200 milliseconds per scramble.

Modern mobile CPU (iPhone 15 Pro A17 Pro, around 3.5 GHz, 6 cores):
- min2phase port: 8 milliseconds per scramble.
- Optimized mobile Kociemba: 3 milliseconds per scramble.
- Korf optimal (rarely run on mobile): 1 to 2 seconds per scramble.

Browser (Chrome on modern desktop, WebAssembly):
- cubing.js's Kociemba implementation: 15 milliseconds per scramble.
- Korf optimal in WASM: 500 milliseconds per scramble.

These numbers should be interpreted with caution: per-scramble runtime varies substantially based on the scramble's "difficulty" (its optimal solution length and the structure of the solution space), and the numbers above are averaged over hundreds of scrambles. The 99th-percentile runtime is typically 5 to 10 times the average runtime, so a solver with a 1 millisecond average might occasionally take 10 milliseconds.

Throughput-focused benchmarks (number of scrambles solved per second on multiple cores) typically scale linearly with core count up to about 16 to 32 cores, at which point memory bandwidth becomes the bottleneck. A modern 32-core desktop can solve approximately 50,000 to 100,000 scrambles per second using min2phase or cubelib, which is more than enough for any practical application.

## Practical Engineering Considerations

For developers who want to actually build a cube solver, several practical engineering considerations matter beyond the algorithmic choices. The first is the choice of data structures for the cube state. A common mistake is to use a class hierarchy with separate Corner and Edge objects; this is more readable but is much slower than a flat byte array because of pointer chasing and allocation overhead. Production solvers use compact bit-packed representations that fit in a single CPU cache line, with all corner and edge state in a fixed 16-byte or 32-byte structure.

The second consideration is memory layout for pattern databases. A naive layout stores each pattern database entry as a separate byte, which is simple but cache-unfriendly. Better layouts group related entries together so that the lookup for one state and the lookup for the next state (after applying a move) tend to fall in the same cache line. This can give a factor-of-2 speedup in the inner loop of IDA*.

The third consideration is the move-application function. For the corner pattern database, applying a move means updating both the permutation and the orientation of the four corners adjacent to the moved face. The naive implementation is four if-then-else statements, but this is slow due to branch mispredictions. Better implementations use precomputed tables indexed by (current state, move) that return the new state directly, eliminating branches entirely. This can give another factor-of-2 speedup.

The fourth consideration is the IDA* recursion. The naive implementation is a straightforward recursive function call, but function-call overhead is significant in the inner loop. Better implementations use a manually-managed stack of cube states and move indices, eliminating function-call overhead and allowing the compiler to keep all state in registers. This can give another factor-of-2 to factor-of-3 speedup.

The fifth consideration is move-ordering inside the IDA* recursion. The order in which moves are tried at each node affects how quickly a goal is found within an iteration. Random move ordering is the worst; ordering by "expected progress" (e.g., trying moves that historically led to faster pruning first) can give a 2x to 3x speedup. The most sophisticated implementations use learning-based move ordering, where the move ordering is trained on a corpus of solved scrambles to maximize search efficiency.

The sixth consideration is symmetry pruning during the search. If a cube state has been encountered before (via a different sequence of moves), we should not re-explore its descendants. The naive way to detect this is to maintain a hash table of visited states, but this uses too much memory for IDA*. Instead, we use "transposition table" techniques that maintain a small fixed-size cache of recently-visited states; this catches many redundancies without using much memory.

When all these optimizations are combined, the resulting solver can be 10 to 50 times faster than a naive implementation. The combined speedup is why production solvers achieve sub-millisecond performance per solve, while educational implementations are often in the 100-millisecond range.

## The Diversity of Use Cases

The diversity of use cases for cube solvers has driven a corresponding diversity in solver implementations. Some of the major use cases include:

WCA scramble generation: this is the canonical use case, served by TNoodle and min2phase. The requirements are correctness (every scramble must require at least 21 moves to solve optimally), speed (a competition might need hundreds of scrambles generated in under a minute), and reproducibility (the same input seed should produce the same scrambles every time).

Mobile app solvers: served by various Kociemba implementations, optimized for low memory and fast cold-start. The requirements are minimal memory footprint, fast initialization (under 100ms), and the ability to handle user-input cube states with potential errors.

Educational tools: served by step-by-step CFOP/Roux/beginner solvers, optimized for clarity rather than speed. The requirements are that each step of the solution should be explainable, that the moves should be in a "natural" sequence for the chosen method, and that the visualization should be clear.

Smart cube apps: served by min2phase and its variants, integrated with Bluetooth move-tracking. The requirements are real-time responsiveness (solutions should be computed within 200ms of the cube reaching a stable state), accurate state detection, and graceful handling of partial or noisy move data.

Robot cube solvers: served by hand-optimized Kociemba implementations, integrated with computer vision and motor control. The requirements are sub-100ms total latency from scramble detection to motor commands, deterministic timing (no garbage collection pauses), and integration with low-level hardware interfaces.

Research and analysis tools: served by ksolve, cubing.js's twsearch, and various academic implementations. The requirements are flexibility (the ability to handle non-standard puzzles, custom move sets, and custom constraints), correctness (results should be provably correct), and extensibility (the ability to add new algorithms and heuristics easily).

Browser-based solvers: served by cubing.js's JavaScript implementation and various WebAssembly ports. The requirements are portability (the same code should run in any modern browser), small download size (the library should be under 1 MB compressed), and acceptable performance (under 100ms per solve for typical use).

The diversity of these use cases means that no single solver is "best" for all applications. The cubing-software ecosystem has produced a range of solvers, each optimized for a particular use case, with the underlying algorithms (IDA*, Kociemba's two-phase, pattern databases) being shared across them all.

## Looking Forward

What does the future hold for cube solver software? Several trends are visible:

Machine learning will continue to play a larger role. DeepCubeA in 2018 was the first major neural-network solver; subsequent work has shown that neural networks can effectively replace pattern databases as heuristic sources, and hybrid systems that combine neural heuristics with classical search are achieving promising results. We may see neural network solvers become the dominant approach within the next decade, particularly for non-standard puzzles where hand-crafted pattern databases are not available.

Hardware acceleration will become more important. Modern CPUs have wide SIMD instructions (AVX-512, ARM SVE) that can be exploited for cube solvers, and GPUs and specialized accelerators (TPUs, NPUs) can run cube solvers at extremely high throughput. The "1ms challenge" of the 2010s has been comprehensively beaten; the next challenge might be the "1 microsecond challenge" using highly-optimized hardware acceleration.

The application domain will expand. Cube solvers were originally developed for the 3x3 cube, then extended to other twisty puzzles, then to general combinatorial search problems. The next frontier might be application-specific solvers: tools that find optimal solutions to specific cubing competition challenges (FMC, Mean of 3, etc.), tools that generate algorithms with specific properties (ergonomic, fingertrick-friendly, suited to a specific solver's hand), and tools that integrate with specific physical hardware (smart cubes, robots, virtual reality systems).

Open source will continue to dominate. The cube solver ecosystem is one of the most successful examples of open-source amateur software development. As long as the cubing community continues to be motivated to produce high-quality tools and to share them freely, the open-source pattern will continue. The major risk is that commercial pressures (e.g., from cube manufacturers wanting to lock down their smart cube ecosystems) could fragment the ecosystem, but so far this has not happened to a significant degree.

The next big breakthrough is harder to predict. Korf's 1997 optimal solver, Kociemba's 1992 two-phase algorithm, and Rokicki's 2010 God's number proof were each significant breakthroughs that none of the contemporaneous community fully anticipated. The next breakthrough might come from machine learning, from quantum computing (which has not yet been applied to cube solving but has potential), from a clever new mathematical insight, or from some direction we cannot currently imagine. What is certain is that the cubing-software community will be the first to recognize and exploit it when it arrives.

## A Note on Notation and Conventions

Throughout this deep dive we have used the standard Singmaster notation for cube moves: U, D, L, R, F, B for the six faces, with the unsuffixed move meaning a clockwise 90-degree rotation, the apostrophe suffix meaning counterclockwise, and the 2 suffix meaning 180 degrees. This is the notation used by virtually all modern cubing software and by the WCA. There are several alternative notations in use:

- The "color notation" replaces face names with color names (W, Y, R, O, B, G for white, yellow, red, orange, blue, green). This was common in early cubing literature but is now obsolete.
- The "ULFRBD" notation uses the same six characters in a different order. It is sometimes used in mathematical papers.
- The "axis notation" (used by some FMC competitors) replaces face moves with axis moves (x, y, z for cube rotations, plus the standard face moves). This is more compact for certain kinds of analysis.

The conventions for measuring move counts also vary. The most common is the half-turn metric (HTM), where each face move (including half-turns like U2) counts as one move. The quarter-turn metric (QTM) treats a half-turn as two moves. The slice-turn metric (STM) treats slice moves (like M, E, S) as single moves. The choice of metric affects the optimal solution length: in HTM the mean is 18.3 moves, in QTM it is approximately 22.8 moves, and in STM it depends on the implementation but is typically slightly lower than HTM.

Different applications use different metrics: WCA scramble generation uses HTM, fewest-moves challenges typically use HTM (sometimes STM with restrictions), academic papers use HTM or QTM depending on the question being studied, and educational tools use whichever metric is most intuitive for their target audience. The conventions are largely a matter of historical accident rather than principled choice.

For the purposes of this deep dive, all move counts and benchmarks are quoted in HTM unless otherwise specified, as this is the dominant convention in the cubing-software community.
`;
