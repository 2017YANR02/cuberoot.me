export const MATH_DETAIL_EN = `
## The State Space of the 3x3 Cube

The very first quantitative fact every cubing student encounters is the size of the puzzle's state space: 43,252,003,274,489,856,000 distinct positions, or roughly 4.3 times 10^19. The number is so often quoted that it has acquired a kind of folkloric quality, but its derivation is one of the cleanest exercises in elementary group theory you will find in a recreational mathematics textbook, and it tells you a great deal about how the cube actually behaves under turning. Let us reconstruct the derivation from first principles, because every later question in cube mathematics, including God's number itself, ultimately rests on the same counting argument.

The mechanical 3x3 cube has three kinds of cubies: 8 corners (each with three visible facelets), 12 edges (each with two visible facelets), and 6 fixed centers (each with one visible facelet). The centers cannot move relative to each other, because they are held together by the internal core mechanism, so they form a rigid orientation reference for the entire puzzle. A position of the cube is therefore completely described by where the 8 corners sit and how they are twisted, plus where the 12 edges sit and how they are flipped. Given full freedom, this would give us 8! ways to permute corners, 3^8 ways to twist them (each corner has three orientations: untwisted, rotated 120 degrees clockwise, rotated 120 degrees counterclockwise), 12! ways to permute edges, and 2^12 ways to flip them (each edge is either correctly oriented or flipped). Multiplied together this is 8! × 3^8 × 12! × 2^12 = 519,024,039,293,878,272,000, which is exactly 12 times the true state space.

The factor of 12 in the overcount arises because of three independent parity constraints, each of which divides the count by 2 or by 3. The first constraint, the corner-twist constraint, says that the sum of the corner orientations, taken modulo 3, is invariant under any face turn. If you label each corner orientation by 0, 1, or 2 (for untwisted, clockwise, counterclockwise) and sum them over all 8 corners, that sum is always congruent to 0 modulo 3 in any reachable position. A single face turn cycles four corners; tracking how their stickers move shows that each cycle adds a net twist of 0 modulo 3 to the system, so the global invariant is preserved. This divides 3^8 by 3, leaving 3^7 = 2187 reachable corner orientations once a permutation is fixed.

The second constraint, the edge-flip constraint, is the modulo 2 analog. Define an edge as "flipped" relative to some convention (one classical choice is the orientation it has when the edge can be moved into its slot using only U, D, R2, L2, F2, B2 moves) and sum the flip bits over all 12 edges. That sum is always 0 modulo 2 in any reachable position; in other words, you can never have an odd number of flipped edges. A quarter turn of one of the F, B, L, or R faces flips four edges simultaneously, which is even and so preserves the parity; U and D turns flip zero edges. This divides 2^12 by 2, leaving 2^11 = 2048 reachable edge orientations.

The third constraint, the permutation-parity constraint, links the corners and edges together. Each quarter face turn is a 4-cycle on corners and a 4-cycle on edges; a 4-cycle is an odd permutation, so each face turn changes both the corner permutation parity and the edge permutation parity simultaneously. As a consequence, the parities are always equal: if the corners are in an even permutation relative to solved, so are the edges, and vice versa. This divides 8! × 12! by 2.

Multiplying the corrections, we have an overcount factor of 3 × 2 × 2 = 12, so the reachable state space is

8! × 3^7 × 12! × 2^11 / 2 = 43,252,003,274,489,856,000

where the final /2 in this form accounts for the permutation parity constraint. The same number can be written more memorably as 43 quintillion in U.S. short-scale or 4.3 × 10^19. It exceeds the number of grains of sand on Earth by several orders of magnitude. It is roughly the number of microseconds in 1.4 trillion years, far longer than the age of the universe.

A useful sanity check: the three constraints exhaust the parity structure of the puzzle, which is to say that the group of reachable positions, often written as G, has index exactly 12 inside the full symmetric group on the 48 movable facelets you would get if you took the cube apart and reassembled it arbitrarily. So if you disassemble a cube and put it back together with random orientation of every piece, the probability of getting a solvable position is exactly 1/12. Speedcubers occasionally rediscover this when they pop a corner during a solve and reinstall it twisted; about 1 chance in 3 they will create an unsolvable position with a single mis-twisted corner, and they will only discover the problem at the very end of the solve when one corner refuses to orient.

It is instructive to compare this with the other WCA-recognized cubes. The 2x2 has 8 corners and nothing else; there is no permutation parity constraint (because the lack of fixed centers means any corner permutation is reachable by rotating the whole puzzle and then matching), but there is a corner-twist constraint. The count is 8! × 3^7 = 264,539,520, and we further divide by 24 to mod out by rotations of the whole cube, giving the often-quoted 3,674,160. This is small enough that the 2x2 has been completely solved: God's number is 11 in HTM (or 14 in QTM) and the full distance-from-solved distribution has been tabulated.

The 4x4 has 8 corners (8! × 3^7), 24 edges that come in 12 indistinguishable pairs (24! / 2^12 to account for the swap-equivalence of paired edges, with permutation parity constraints), and 24 centers in 6 sets of 4 indistinguishable each (24! / (4!)^6). Putting it together yields approximately 7.4 × 10^45. The 5x5 reaches roughly 2.8 × 10^74. The 6x6 is about 1.6 × 10^116 and the 7x7 is around 1.95 × 10^160. These numbers grow roughly as the 2.5 power of n on the log scale, consistent with the n^2/log(n) move-count bound we will discuss later.

The other shape-changing puzzles give striking comparisons. The Megaminx has roughly 1.0 × 10^68 states (20 corners with 3 orientations, 30 edges with 2 orientations, minus parity constraints). The Pyraminx has 933,120 states if you ignore the trivially-twistable tips (or 75,582,720 = 933,120 × 3^4 if you include all four tip rotations). The Skewb has 3,149,280 states. The Square-1 has only 170 distinct visible shapes, but the full reachable state space (including the shapes plus piece permutations within each shape) is 552,738,816,000 = 170 × 2 × 8! × 8!, and is mechanically more complex because the shape itself changes during turning.

A specialized variant worth mentioning is the supercube. A "supercube" is a 3x3 in which the centers carry orientation marks (such as logos or directional patterns) so that you can detect the rotation of each center. There are 4 visible rotations per center (one full rotation produces the same picture), so naively the supercube has 4^6 = 4096 times as many states as the regular 3x3. But there is one more parity constraint: the sum of center rotations modulo 4 is preserved by face turns combined with the corner-twist invariant. So the actual multiplier is 4^6 / 2 = 2048, and the supercube state space is 4.3 × 10^19 × 2048 ≈ 8.86 × 10^22. The supercube is a real challenge for cubers because all OLL parity, U-perm vs. M-symmetric algorithms suddenly need to be selected with care to preserve center orientation.

## Group-Theoretic Foundations

Once you have the counting argument, the next natural step is to recognize that the set of reachable positions is not just a set but a group, with composition of move-sequences as the binary operation. This group, conventionally denoted G or sometimes G_cube, is a subgroup of the symmetric group on 48 facelets (24 face-positions × 2 if you also count interior facelets, but for visible state we use 48 visible facelets). G has order 43,252,003,274,489,856,000 and index 12 in the wreath-product group S_8 wreath C_3 × S_12 wreath C_2 that you would get by treating all corner twists and edge flips as independent.

The group is generated by six elements: the quarter-turn rotations of the six faces, written as U, D, L, R, F, B for Up, Down, Left, Right, Front, Back. By convention, the un-suffixed move means a 90 degree clockwise rotation (looking at that face from outside the cube), the suffix 2 (e.g., U2) means a 180 degree rotation, and the suffix prime or apostrophe (e.g., U') means a 90 degree counterclockwise rotation. So the generator set in the quarter-turn metric (QTM) is the 12 elements {U, U', D, D', L, L', R, R', F, F', B, B'}, while the generator set in the half-turn metric (HTM) is the 18 elements {U, U2, U', D, D2, D', L, L2, L', R, R2, R', F, F2, F', B, B2, B'}.

The Cayley graph of G with respect to either of these generator sets is the central combinatorial object in cube mathematics. It is the directed graph whose vertices are the 4.3 × 10^19 positions and whose edges connect each position to the positions reachable by a single generator move. Solving a cube means finding a directed path in this graph from the current vertex to the identity (solved) vertex. The diameter of the Cayley graph (the longest shortest path) is exactly God's number for the chosen metric: 20 in HTM and 26 in QTM.

The Cayley graph is vertex-transitive: from the perspective of the graph's structure, every position looks the same as every other (this is automatic for any Cayley graph of a group). What changes is only the identity of the "solved" vertex we choose to head toward. This symmetry is one reason why we can talk about the average distance from solved as a property of the cube itself, not of any particular position.

The generator-set structure means we can also talk about a number of important subgroups. The simplest is the subgroup <U> generated only by U turns; this is cyclic of order 4. The subgroup <U, D> is more interesting: it contains all sequences of U and D turns and has order 4 × 4 = 16, since U and D commute with each other. The subgroup <U2, D2, L2, R2, F2, B2> generated only by half-turns is called the "squares group" or "antislice group" and has order exactly 663,552. The squares group is one of the most studied subgroups because it is closed under taking the inverse (every element is its own inverse, since two half-turns of the same face cancel), and because it can only produce positions where every corner is correctly oriented and every edge is correctly oriented; in fact, every position in the squares group is a pure permutation of pieces with no twists or flips.

The Thistlethwaite subgroup chain, proposed by Morwen Thistlethwaite in 1981, is the most famous structural decomposition of G. It is a sequence of nested subgroups:

G0 = G (the full cube group, 4.3 × 10^19 elements)

G1 = <U, D, L, R, F2, B2> (group of positions with all edges correctly oriented, about 2.1 × 10^16 elements)

G2 = <U, D, L2, R2, F2, B2> (group of positions with all edges oriented, all corners oriented, and the UD-slice edges in the UD slice, about 1.95 × 10^10 elements)

G3 = <U2, D2, L2, R2, F2, B2> (the squares group, 663,552 elements)

G4 = {e} (the identity)

The index sequence is [G : G1] = 2048, [G1 : G2] = 1082565, [G2 : G3] = 29400, [G3 : G4] = 663552, and the products give 2048 × 1082565 × 29400 × 663552 = 43,252,003,274,489,856,000 as required. The Thistlethwaite algorithm solves the cube in four phases, one per index, with each phase decreasing the subgroup membership by one step. In Thistlethwaite's original 1981 implementation, the worst case used about 52 moves; subsequent refinements (especially by Reid and Kociemba) pushed this down to the 30s and then the 20s.

A more refined decomposition is the two-phase Kociemba decomposition, which uses only two subgroups:

G0 = G

H = <U, D, L2, R2, F2, B2> (the same as Thistlethwaite's G2, sometimes called the Kociemba H subgroup, with 19,508,428,800 elements)

G_final = {e}

The two-phase decomposition is cleaner than four-phase because the two phases align nicely with the natural pruning structure of the cube. Phase 1 reduces an arbitrary position to a position in H, which is exactly equivalent to requiring all edges correctly oriented, all corners correctly oriented, and the 4 UD-slice edges (FR, FL, BR, BL) located in the UD slice. Once these three sub-state conditions are met, you can solve the cube using only U, D, L2, R2, F2, B2 moves, which keep the cube within H. We will return to this in detail when we discuss optimal solvers below.

Conjugates and commutators are fundamental tools in constructing useful cube algorithms. A conjugate has the form X Y X' (where X' means the inverse of X) and is interpreted as "do X to set up, do Y, then undo X". Conjugates allow you to apply an algorithm in a different orientation or location without rewriting it. A commutator has the form [X, Y] = X Y X' Y' and produces a small "swap" or "twist" effect that is much smaller than either X or Y alone. The commutator [R, U] = R U R' U' is the classic "sexy move" and is used in countless beginner and intermediate algorithms.

The commutator subgroup of G, denoted G' or [G, G], is the subgroup generated by all commutators of elements of G. For the cube, the commutator subgroup is exactly the subgroup of all "even" positions, i.e., positions where the corner permutation parity equals 0 (the edge permutation parity is then also 0, by the linking constraint). The commutator subgroup has order 21,626,001,637,244,928,000, which is exactly half of |G|. The quotient G / [G, G] is the abelianization of G, which is cyclic of order 2; the unique non-trivial coset corresponds to "odd" positions, which are reachable by an odd number of quarter-turns from solved.

A celebrated theorem of cube mathematics, due to David Singmaster, is that the cube group G is isomorphic to (Z_3^7 wreath Z_2) wreath_{1/2} ((S_8 × S_12) / Z_2), or more cleanly to a certain semidirect product. The structure theorem makes clear why the cube has exactly the parity constraints we counted, why the supercube has one additional Z_4^6 factor (subject to one more linkage), and why higher-order cubes have analogously structured groups.

The Schreier-Sims algorithm gives an explicit way to compute properties of G that would otherwise be intractable. The idea is to find a chain of subgroups G = G^{(0)} > G^{(1)} > ... > G^{(k)} = {e}, where each G^{(i)} is the stabilizer of some fixed "base point" sequence b_1, b_2, ..., b_i. By computing transversals (coset representatives) for each G^{(i+1)} inside G^{(i)}, you get a strong generating set that lets you decide membership in G in polynomial time, enumerate elements, compute centralizers, and so on. The standard implementation in GAP or Magma can compute that G has order 43,252,003,274,489,856,000 in a fraction of a second, and the cycle structure and conjugacy classes can be enumerated systematically. There are 81,120 conjugacy classes in G, a fact that is hard to discover by inspection but immediate from Schreier-Sims combined with the character-theoretic count.

## God's Number: A Brief History

God's number is the diameter of the Cayley graph of the cube, that is, the largest distance from solved to any position when both are measured in the chosen metric. The story of how this number was bounded and eventually pinned down spans almost three decades and is one of the great applied-computing achievements of the 21st century.

The first published upper bound on God's number was due to David Singmaster in 1981, in his book "Notes on Rubik's Magical Cube". Singmaster's bound was 277 moves in HTM, derived from a simple layer-by-layer solving method that one could prove always terminated in a bounded number of moves. This bound was extremely loose, in part because it relied on a method that was constructed to be analyzable rather than efficient. Within a year, Singmaster himself and other researchers had reduced the bound to around 110.

In 1981, Morwen Thistlethwaite published the four-phase algorithm we described above, which gave a worst-case upper bound of 52 moves. The Thistlethwaite algorithm was a true conceptual breakthrough: by carefully nesting subgroups and using pre-computed lookup tables, you can solve any position in at most 52 face turns. This bound stood for several years until further refinements pushed it down.

In 1992, Herbert Kociemba introduced the two-phase algorithm, which simultaneously offered a fast solver and a path to better upper bounds. The original Kociemba implementation in 1992 produced solutions of average length around 21-22 moves in fractions of a second, and gave an upper bound on God's number of 29 (improved from initial 50+ over the next few years). In 1995, Michael Reid proved the bound of 29 was tight in the sense that Kociemba's algorithm with infinite search depth would always finish in 29 or fewer moves, and he also exhibited specific positions that required 26+ moves. The first "hard position" identified was the superflip (where every edge is correctly placed but flipped), which is exactly 20 moves from solved in HTM, a fact proven by Reid in 1995 using a carefully crafted analysis of the position's coset structure.

The next decade was the brute-force era. In 2006, Tomas Rokicki used cosets of the Kociemba H subgroup to prove that God's number is at most 25. The technique exploits the fact that the 4.3 × 10^19 positions can be partitioned into about 2.2 × 10^9 cosets of H, where each coset has 19,508,428,800 elements. If you can prove that every coset has a representative within 11 moves of solved (so phase 1 of Kociemba succeeds in 11), and every element of H can be solved in 14 more moves (so phase 2 succeeds in 14), then the total is 25. Rokicki proved both halves by exhaustive coset enumeration on commodity hardware over several months.

In 2007, Rokicki improved the bound to 26 using stronger phase-2 analysis, then to 25 in early 2008 (matching the earlier bound but with cleaner proof structure), and then to 23 in mid-2008 by allowing phase 1 to use slightly more moves in exchange for shorter phase 2. The key technical trick was to observe that, in many cosets, the optimal solution does not have the form "11 phase-1 moves + 14 phase-2 moves" but rather "9 phase-1 moves + 13 phase-2 moves with overlap". By being more flexible about the phase boundary, Rokicki could prove tighter bounds.

In 2008, Rokicki and Kociemba, working together, proved 22 as an upper bound. In July 2010, Rokicki, Kociemba, Davidson, and Dethridge proved that God's number is exactly 20 by demonstrating that:

(a) every position can be solved in at most 20 moves (proven by computing optimal solutions to a representative from every one of the 55,882,296 symmetric cosets, with a total of 4 trillion positions checked across 35 CPU-years of compute time donated by Google).

(b) at least one position requires 20 moves (proven decades earlier with the superflip; later, a "20-move position" generator found about 490 million distinct depth-20 positions, with the total number estimated at a few billion).

The 2010 proof is one of the great computational achievements in mathematics. The full computation used about 35 CPU-years of Google compute, distributed across thousands of machines, but the algorithmic ingenuity is what made it possible: the symmetry+antisymmetry trick reduced the search space by a factor of 96 (48 cube symmetries times 2 for antisymmetry, with the actual factor about 80 due to symmetric positions being self-symmetric), and the coset technique limited each individual search to a manageable size. By combining symmetry reduction with coset partitioning and aggressive pruning of unprovably-deep cosets, the team managed to do in 35 CPU-years what would otherwise have required millions of CPU-years.

The quarter-turn metric (QTM) story is similar but with different numbers. QTM counts each 90 degree turn as 1 and each 180 degree turn as 2 (since 180 = 90 + 90). The QTM Cayley graph has the same vertices as the HTM Cayley graph but more edges between them (12 generators vs. 18) and longer typical distances. In QTM, God's number was proven to be exactly 26 by Rokicki and Davidson in 2014, using a similar symmetry-reduction + coset-enumeration technique but requiring about 29 CPU-years of compute. The hardest position in QTM, found by Rokicki, requires 26 quarter turns.

The slice-turn metric (STM) allows the 6 face turns plus 3 slice turns (the M, E, S middle slices), giving a generator set of 27 elements. STM is a natural metric for cubers who use middle-slice moves heavily, especially in the Roux method. STM God's number is not pinned down: the known bounds are a lower bound of 18 and an upper bound of 20. The wider STM variants ("wide turns" where you turn two layers as one) have not been fully nailed down because the metric is less standardized.

The natural question is "why is God's number 20?" There is no clean theoretical answer; the number 20 comes out of the brute-force enumeration with no deeper structural reason that has been discovered to date. There are hints: the diameter is roughly logarithmic in the state-space size with base equal to the average branching factor, and with 18 HTM generators and 4.3 × 10^19 positions, you would expect log_18(4.3e19) ≈ 15.4 to be a lower bound (and indeed the information-theoretic lower bound is 16, sharply matching this). The fact that God's number is 20, not 16, reflects the redundancy in the generator structure: many move sequences lead to the same position, so the effective branching factor is lower than 18.

## The Optimal HTM Distribution

The 2010 computation did more than prove God's number 20; it produced the full distance-from-solved distribution. The table is now part of cubing folklore:

Depth 0: 1 position (solved itself)

Depth 1: 18 positions

Depth 2: 243

Depth 3: 3,240

Depth 4: 43,239

Depth 5: 574,908

Depth 6: 7,618,438

Depth 7: 100,803,036

Depth 8: 1,332,343,288

Depth 9: 17,596,479,795

Depth 10: 232,248,063,316

Depth 11: 3,063,288,809,012

Depth 12: 40,374,425,656,248

Depth 13: 531,653,418,284,628

Depth 14: 6,989,320,578,825,358

Depth 15: 91,365,146,187,124,313

Depth 16: 1,100,000,000,000,000,000 (approximately, exact value computed by extrapolation)

Depth 17: ≈ 12,000,000,000,000,000,000

Depth 18: ≈ 29,000,000,000,000,000,000

Depth 19: ≈ 1,500,000,000,000,000,000

Depth 20: ≈ 490,000,000 (this is the number of distinct depth-20 positions exactly known as of 2010)

These numbers show a "fat middle" distribution: about 67% of all positions sit at depth 18, with another 28% at depth 17 and most of the remainder at depth 19. Positions at depth 20 are extraordinarily rare, accounting for roughly 0.0000000011% of the total state space (about 1 position in 90 billion). The distribution is not symmetric around any obvious mean; instead it has a sharp left edge (you cannot have fewer than zero moves) and a sharp right edge (God's number caps the right tail).

The mean optimal HTM solution length is approximately 17.92 moves, the median is 18, and the mode is also 18. The standard deviation is about 0.88 moves. So an "average" random position is 17 to 19 moves from solved, with a narrow spread around that.

This distribution has implications for any heuristic solver. If you grab a random position and try to solve it with a heuristic-based search like IDA*, the expected number of nodes to explore is roughly the number of positions at depth 17 or less, times some overhead. With 17+ years of optimization and excellent pruning heuristics, modern IDA*-based optimal solvers (such as those in Kociemba's CubeExplorer or Rokicki's tools) typically find optimal solutions in milliseconds to seconds for a typical random scramble.

The Cayley graph picture of the cube is a graph with 4.3 × 10^19 vertices, diameter 20, and vertex-transitive structure. The local structure around the solved state is regular: from solved you can reach 18 distinct positions in 1 move (no two generator moves give the same result), and at depth 2 you can reach 243 positions (18 × 18 - 81 duplicates, where the duplicates come from sequences like R then R' that cancel). The branching factor remains roughly 13.5 (after eliminating trivial cancellations like X then X') up to depth 6 or so, then slowly decreases as more sequences converge to the same position.

The mean distance of 17.92 has a beautiful theoretical implication: it means that, on average, a random position is "almost as bad as the worst possible position" in some loose sense. The diameter is 20, and the mean is 17.92, so the median position is within 2 moves of the worst. This is characteristic of a "small-world" graph: most vertices are nearly maximally distant from a given vertex. Cube positions do not form a small-world graph in the technical Watts-Strogatz sense (the cube graph is highly regular and lacks the random shortcuts of small-world models), but it has the same qualitative property of "average is near maximum".

The Demaine, Demaine, Eisenstat, Lubiw, and Winslow theorem of 2011 shows that for n×n×n cubes (using the natural generating set), the optimal solution length is Θ(n²/log n). For n = 3, this evaluates to roughly 9/log(3) ≈ 8.2 in big-Theta terms (the constants matter). For n = 4, it gives 16/log(4) ≈ 11.5. For n = 5, 25/log(5) ≈ 15.5. The constants of proportionality are not pinned down precisely; the upper-bound proof uses a clever "move sequence parallelization" technique that exploits the fact that multiple disjoint multi-edge cycles can be solved simultaneously by combining wide-turn moves with face turns.

The Demaine et al. result is particularly elegant because the lower bound n²/log(n) is information-theoretic: there are k^Θ(n²) reachable states (for some constant k depending on cube size), so any path of length L must satisfy 18^L ≥ k^Θ(n²), giving L ≥ Θ(n²/log(n) * 1/log(18)). The matching upper bound shows that this information-theoretic bound is essentially tight, modulo constants. For 3x3, the information-theoretic lower bound is log_18(4.3e19) ≈ 15.4, and the diameter is 20, a ratio of about 1.3. This ratio is asymptotically captured by the n²/log(n) result.

## Lower-Bound Arguments

The information-theoretic argument deserves a closer look because it gives the cleanest lower bound. If you have b generators and the diameter is d, then b^d must be at least the number of vertices in the graph. For the 3x3 in HTM, b = 18 and there are 4.3e19 vertices, so d ≥ log_18(4.3e19) ≈ 15.4, rounding up to 16. This argument shows that at least one position must require 16 or more HTM moves. The bound has been part of cube folklore since the late 1970s; refinements that account for branching-factor reduction due to move cancellations push the effective bound slightly higher.

A more refined lower bound uses the "sum-of-distance" argument. If you partition the positions into orbits under some structural feature (e.g., positions where the cross is solved, positions where F2L is done), you can sum the optimal distances within each orbit and use averaging arguments to show that the diameter must be at least some computed lower bound. This kind of argument was used by Reid, Kociemba, and others to push the bounds upward from the trivial information-theoretic 16 to the 18-19 range before brute-force confirmed exactly 20.

For methods (as opposed to optimal solutions), the lower bound is quite different and often much higher. A "method" is a fixed decomposition of the solving process into stages, where each stage is solved independently (possibly with lookahead). The CFOP method, for example, decomposes the solve into Cross + F2L + OLL + PLL stages, each of which is solved optimally (or near-optimally) given the current state. The total length of a CFOP solution is the sum of the stage lengths, and even with optimal per-stage solving, the sum is much larger than the global optimum.

To see why, consider the F2L stage. A given F2L slot has 41 distinct cases (considering corner-edge pair orientations and positions), each of which has a known short algorithm typically 5-12 moves long. The optimal length for solving all 4 F2L slots in HTM is around 24-32 moves, depending on the specific case combinations. But the global optimum for "Cross + F2L solved" is typically 15-20 HTM moves, because there are sequences that solve multiple pieces simultaneously in ways that no fixed stage-by-stage method can capture. The gap between CFOP-optimal (~50-60 HTM) and globally-optimal (~18 HTM) is about 30-40 moves, a factor of 3 in the move-length ratio.

This per-method lower bound can be made rigorous. Define a method M as a function from cube states to algorithms; M is "fixed-stage" if there are stages s_1, ..., s_k and the method produces an algorithm that consists of a sub-algorithm for stage s_1 (which solves stage 1's piece subset), then a sub-algorithm for stage s_2 (solving stage 2's pieces while preserving stage 1), and so on. Any fixed-stage method has the property that its total move-count is at least the sum of the minimum sub-algorithm lengths, because each stage must be solved with the constraint of preserving previous stages.

The CFOP-optimal length, defined as the minimum length over all CFOP-compatible solutions (where Cross is solved first, then F2L, then OLL, then PLL), has been studied empirically by simulating thousands of random scrambles. The result is that CFOP-optimal averages about 50-55 HTM moves, with a standard deviation around 5 moves. The minimum CFOP-optimal length (best case) is about 30 moves; the maximum is around 70 moves. Compare this to the globally-optimal average of 18 moves, and you see that CFOP is about 3x longer than necessary even when each stage is solved optimally.

Other methods have similar bounds. Roux-optimal solutions average around 50-70 HTM, with the variance being a bit higher because of the M-slice complications. ZZ-optimal averages 55-65 HTM. Petrus-optimal is around 50-65 HTM. None of the human-style methods can be expected to find sub-30-move solutions on average, because the method structure itself imposes redundancy.

The fewest-moves competition (FMC) is the WCA event where competitors have 60 minutes to find the shortest solution by hand (paper and pencil, no computer). The current world record for FMC single is 16 moves, held by Sebastiano Tronto (set in 2019 with a 16-move solution to a specific scramble). Calle Schoon set the same 16-move record on a different scramble in 2018. The team relay (FMC mean of 3 attempts on three different scrambles) record is held by Wenfei He with 22.00 mean. These records show that human FMC solvers can find solutions within 4-5 moves of optimal, given an hour of focused thinking. Modern FMC theory uses Kociemba-style techniques (insertion finders, NISS, etc.) to combine and optimize partial solutions.

The gap between FMC and optimal also has an interesting structural pattern. If you could ask a Kociemba solver for the optimal solution, you would get an answer in the 18-20 range; but human FMC competitors using sophisticated techniques typically find solutions in the 22-30 range. The 4-12 move gap reflects the difficulty of human-level search compared to brute-force computer search.

A useful question is: what is the minimum length that any single human-style solution can have, given unbounded thinking time? Even an idealized human, with infinite computational power, who insists on solving via fixed-stage methods (CFOP, Roux, ZZ, etc.) is bounded below by the structural redundancy of these methods. For CFOP, this lower bound is around 25-30 moves (because Cross+F2L+OLL+PLL stages produce inherently redundant move-sequences). For "anything-goes" thinking that allows on-the-fly creativity (like FMC competitors do), the bound is the actual global optimum of 18 moves, but this requires effectively running an optimal solver in your head.

## The Two-Phase Kociemba Algorithm in Depth

The Kociemba two-phase algorithm is the workhorse of modern cube solving. It is fast (typical solve times of milliseconds), it produces near-optimal solutions (averaging about 22 moves vs. the global optimum of 18, with a maximum of about 28), and it serves as the fundamental engine for WCA scramble generation, optimal solvers, FMC tools, and educational software.

Phase 1 of Kociemba reduces an arbitrary cube position to a position in the H subgroup, defined as H = <U, D, L2, R2, F2, B2>. A position is in H if and only if:

(a) all edges are correctly oriented (relative to the standard orientation convention)

(b) all corners are correctly oriented

(c) the 4 UD-slice edges (FR, FL, BR, BL) are in the UD slice

These three conditions are checked by three separate sub-state functions, each of which can be computed quickly:

Edge orientation: tracked by 12 bits, but only 11 are independent (the last is forced by parity), so there are 2^11 = 2048 possible edge-orientation states.

Corner orientation: tracked by 8 trits, but only 7 are independent (the last is forced by mod-3 parity), so there are 3^7 = 2187 possible corner-orientation states.

UD-slice positions: the 4 UD-slice edges are in some 4-element subset of the 12 edge positions. The number of size-4 subsets of a 12-element set is C(12, 4) = 495.

So phase 1's pruning state space is 2048 × 2187 × 495 = 2,217,093,120 distinct states. A pre-computed pruning table assigns to each of these 2.2 billion states a value equal to the minimum number of moves to reach the "all conditions satisfied" target state. The table requires 2.2 billion entries × 1 byte per entry = 2.2 GB, but a clever trick reduces this. You compute the pruning value as the maximum of three separate, smaller pruning tables:

P_eo = pruning table for edge orientation alone (2048 entries, indexed by edge orientation state)

P_co = pruning table for corner orientation alone (2187 entries)

P_ud = pruning table for UD-slice position alone (495 entries)

P_combined(state) = max(P_eo(state's EO), P_co(state's CO), P_ud(state's UD))

The combined pruning is admissible (it never overestimates) because each individual table is admissible: if the cube needs at least X moves to solve EO alone, then it needs at least X moves to solve EO+CO+UD jointly. The combined table has total size 2048 + 2187 + 495 = 4730 bytes, fitting easily in CPU cache.

In practice, Kociemba implementations use a "compound" pruning that is tighter: tables indexed by pairs of sub-states, like P_eo_ud (eo + ud combined, 2048 × 495 = 1,013,760 entries) and P_co_ud (co + ud combined, 2187 × 495 = 1,082,565 entries). The pruning is then max(P_eo_ud, P_co_ud, P_eo_co), where each table is computed by reverse BFS from the H subgroup target. This gives much tighter pruning at the cost of slightly more table space (still only a few MB).

The phase 1 search uses IDA* (iterative deepening A*) with the combined pruning table. The algorithm starts with a depth limit of 0 (corresponding to "is the position already in H?") and increments the depth limit by 1 until a solution is found. At each depth, IDA* does a depth-first search up to the limit, pruning any branch where the pruning table value exceeds the remaining depth budget. The result is the shortest move sequence that takes the position into H.

Phase 2 then solves the position within H using only H's generators (U, D, L2, R2, F2, B2). The H subgroup has 19,508,428,800 elements, and the diameter of H's Cayley graph (with respect to its generators) is 18, so phase 2 always finds a solution in at most 18 moves. The pruning for phase 2 is based on three sub-states:

Corner permutation: 8! = 40,320 possible orderings of the 8 corners.

UD-edge permutation (the 8 edges not in the UD slice): 8! = 40,320 possible orderings.

UD-slice edge permutation: 4! = 24 possible orderings of the 4 UD-slice edges.

The total phase 2 sub-state space is 40,320 × 40,320 × 24 = 38,996,179,200, which matches |H| up to the constraint that corner and edge permutation parities must be equal. Phase 2 pruning uses two combined tables: P_cp_eud (corner permutation + UD-edge permutation, 40320 × 40320 / 2 ≈ 800 million entries) and P_ep_uds (UD-edge perm + UD-slice perm, 40320 × 24 = 967,680 entries). The first table is too large for naive 1-byte-per-entry storage, but Kociemba uses 4-bit packing (since pruning values rarely exceed 15) to fit in about 400 MB; alternatively, you can use a coarser table with fewer indices.

The two-phase search combines phases 1 and 2 with a clever overlap strategy. Rather than running phase 1 to completion (yielding the shortest move sequence into H), then running phase 2 from the resulting H position, the algorithm runs phase 1 with successive depth limits, and at each yield of a new "into H" candidate, it tries phase 2 from that candidate. The total length is phase 1 length + phase 2 length; the algorithm keeps the shortest total found and continues searching with tighter constraints until it can prove no shorter solution exists or until a time budget is exhausted.

For an "any solution" call (find any valid solution in minimum time), modern Kociemba implementations (such as Tomas Rokicki's "min2phase" or Herbert Kociemba's "Cube Explorer") return a 22-move solution in about 10 ms on commodity hardware. For an "optimal solution" call (find the globally optimal solution), the same implementation takes 50-200 ms typically, and the optimal solution is usually 1-2 moves shorter than the first solution found.

The IDA* technique itself is due to Korf (1985), who studied the n-puzzle and showed that IDA* with admissible pruning is provably optimal. The application to the cube was straightforward but required carefully engineered pruning tables to fit the cube's state space. The combination of two-phase decomposition + IDA* + pruning tables is the cornerstone of modern optimal cube solving.

## Method-Specific Bounds and Real-World Methods

In addition to optimal solving, cubers care about specific solving methods that produce human-executable algorithms. These methods have their own theoretical bounds and empirical distributions.

CFOP (Cross-F2L-OLL-PLL), also called the Fridrich method, is the dominant speed method. The four stages have the following theoretical optima and empirical averages:

Cross: optimal HTM is 4-8 moves, averaging 6.5 over random scrambles with color-neutral cross choice. The cross-optimal distribution has a histogram showing modes at 6 and 7. With color-neutral cross choice (the cuber picks the best of 6 possible cross colors), the average drops to about 5.5. Without color-neutrality (fixed white cross), the average is 6.5-7.

F2L (4 pairs): optimal HTM per pair is 5-12 moves. Optimal for all 4 pairs simultaneously is 24-32 moves, averaging 28. With 41 distinct F2L cases plus mirrors (119 total), most cases have a "canonical" algorithm of 6-10 moves. Top cubers know optimized variants of all 41 cases.

OLL: 57 cases, with average algorithm length 9.7 STM. The 57 OLL cases can be reduced to "2-look OLL" with only 10 cases (edges first, then corners), at the cost of 3-5 extra moves per solve.

PLL: 21 cases, with average algorithm length 12.5 STM. The 21 cases can be reduced to "2-look PLL" with only 6 cases, at the cost of 3-5 extra moves.

Empirical total CFOP move count: average 50-60 HTM (54 STM-equivalent at top level), maximum around 75 HTM, minimum around 35 HTM. This includes finger-tricks-optimized algorithms but not deeper optimizations like cross-color choice. At the world-record level, Yusheng Du and Max Park average about 47-49 STM on their fastest solves, which translates to roughly 16-17 TPS over a 3-second solve.

Roux is a different method that uses M-slice moves heavily and avoids OLL/PLL by building two F2B blocks instead of a cross. Roux move count is typically 45-55 HTM (40-50 STM) at the elite level. Roux uses extensive M-slice moves which lower HTM count relative to CFOP, but in HTM they wash out. The world's best Roux solvers, including Sean Patrick Villanueva and Kian Mansour, average 40-45 STM on fast solves.

ZZ (Zborowski-Bruchem) is a CFOP-like method that pre-orients all edges in a phase called EOLine, then solves the rest with R, U, L only. ZZ move count is 50-65 HTM at the elite level. ZZ has lost popularity to CFOP because EOLine often takes too long to plan and execute relative to the savings.

Petrus is an older method that builds a 2x2x2 block first, then extends to 2x2x3, then orients edges, then completes the last layer. Petrus move count is 50-65 HTM at the elite level. Petrus is much less popular than CFOP but has a small dedicated following.

Other methods include CFCE (Corners-First, similar to Roux but corner-first), Heise (extremely method-specific, very low move count but extremely high recognition), Waterman, Belt, and many others. Most of these are exotic and not used in practice, but they have been studied as theoretical alternatives.

The "fewest moves" competition (FMC) is the WCA event where competitors find the shortest solution. The current world record for FMC single is 16 moves (Tronto 2019); for FMC mean of 3 attempts (over three different scrambles), the record is 22.00 by Wenfei He. These are remarkable achievements: 16 moves is just 1-2 moves more than the average global optimum of 18, achieved by human thinking over 60 minutes.

FMC techniques use a combination of: scramble-specific insights (looking for free edges, free corners, or pre-set blocks), block-building methods (similar to Petrus or Roux but optimized for move count), NISS (Normal Inverse Scramble Switch, where you alternate between solving from the scrambled side and from the solved side), insertion finders (where a partial solution is improved by inserting a short algorithm at a specific location to handle a remaining piece), and Kociemba-style optimization (manual application of two-phase reasoning). The skill is enormous: top FMC competitors can identify the "best" first 5-7 moves of a scramble in seconds, then iteratively refine the solution.

The lower bound on any "method-based" solution is interesting. If you have a fixed method M that consists of stages s_1, ..., s_k, and the stage optimum for s_i (given previous stages) is at least L_i, then the total optimum for M is at least sum(L_i). For CFOP this is roughly Cross(6.5) + F2L(28) + OLL(9.7) + PLL(12.5) ≈ 56.7 HTM. For 1LLL (a hypothetical method that has a single look-up table for the entire last layer of 3915 cases), the total would be Cross(6.5) + F2L(28) + 1LLL(13) ≈ 47.5 HTM. For "ZBLL", the actual all-LL method with 493 cases, total is Cross(6.5) + F2L(28) + OLL_edges(2) + ZBLL(11.7) ≈ 48.2 HTM. These are the asymptotic lower bounds; in practice, cubers achieve them within a few moves at the elite level.

For sub-3.5 second world record solves, the actual move counts are around 47-50 STM with 17-19 TPS. To break sub-3, you would need to reach 13.5 average STM length / 17-18 TPS ≈ 0.79 second per stage, which requires very specific scrambles or very different methods.

## Algorithm Complexity and N×N Cubes

The Demaine, Demaine, Eisenstat, Lubiw, Winslow (2011) theorem on n×n cube complexity is one of the most important theoretical results in cube mathematics. The theorem states that the worst-case optimal move count for an n×n×n cube, using the standard generating set of face turns, is Θ(n²/log n). The proof has two parts: a lower bound and an upper bound.

The lower bound is information-theoretic. An n×n×n cube has roughly (3 × 2)^O(n²) = 6^O(n²) reachable states (more precisely, the count grows as a polynomial in n times an exponential in n^2/n with some logarithmic correction). If you have a constant number of generators (say, 6n - 5 or so for an n×n cube with face turns and middle slices), then the number of distinct move sequences of length L is at most generators^L. For this to cover all states, you need L ≥ log_{generators}(state_count) = Θ(n² / log(n)). So the diameter must be at least this.

The upper bound is constructive. The Demaine et al. algorithm solves the n×n cube by:

1. First, reduce to a "3x3 like" state: pair up the n^2 - 4 inner edges into n - 2 "super-edges" each, pair up the (n-2)^2 inner centers per face into 6 "super-centers", and treat the resulting reduced cube as a 3x3.

2. Solve the reduced 3x3 using a fixed bounded-length sequence.

3. The reduction in step 1 is the hard part. The naive approach uses O(n³) moves: for each of the O(n²) inner edges, you spend O(n) moves to pair it with its partner using face + slice moves.

The clever step is to parallelize the edge-pairing: instead of pairing one edge at a time, you can pair multiple edges simultaneously using wide-turn moves (where a wide turn moves several outer layers as a block). With wide turns, you can do O(log n) edges in parallel per "phase", and there are O(n²) edges total, giving total move count O(n²/log n).

The constant of proportionality is not tightly bounded in the Demaine et al. result; the best-known upper bound has a constant of about 5-10, while the lower bound has constant 1. So there is still some gap, but the asymptotic order is correct.

For specific n values, here are the known optimal-move bounds (in HTM):

n=2: God's number 11 (exact, proven)
n=3: God's number 20 (exact, proven 2010)
n=4: God's number unknown; lower bound ≥ 30, upper bound ≤ 60 (estimated)
n=5: God's number unknown; lower bound ≥ 40, upper bound ≤ 90 (estimated)
n=6+: only asymptotic bounds from Demaine et al.

The 4x4 has been the subject of many computational studies, but its God's number has not been pinned down to within a single value because the state space is far too large for brute force (7.4 × 10^45 vs. 4.3 × 10^19 for 3x3). The lower bound of 30 comes from specific positions that have been proven hard; the upper bound of 60 is achievable by combining 4x4 reduction with optimal 3x3 solving on the reduced state.

The Demaine et al. theorem is also related to a broader complexity result: the problem of determining whether a given n×n cube position can be solved in k moves is NP-complete in n and k. This was proven by Demaine, Demaine, Eisenstat, Lubiw, and Winslow (arXiv 1706.06708, 2017). The NP-completeness means that, in general, you cannot decide if a cube can be solved in k moves in polynomial time (unless P = NP). However, for any fixed n (such as n = 3), the decision problem is in P (since the state space is bounded), so the asymptotic complexity result is about scaling with n, not about specific small cubes.

The NP-completeness has a practical implication: it explains why optimal solvers for n×n cubes scale very badly with n. For 3x3, optimal solving takes milliseconds. For 4x4, optimal solving takes minutes to hours per position with the best known algorithms. For 5x5, optimal solving is intractable; the best approaches use approximate (reduction-based) methods that give "good" but not necessarily optimal solutions.

The lower bound of n²/log(n) for the diameter has a beautiful counterpart: the average distance is also Θ(n²/log n). This means that the random position of an n×n cube is, on average, about as far from solved as the worst position, up to constants. This concentration is a generic feature of vertex-transitive graphs with high expansion.

For the cube specifically, the expansion can be measured by the second eigenvalue of the adjacency matrix. The cube graph is highly expanding: the second eigenvalue is bounded by a small constant times 1/sqrt(state_count), so random walks on the cube mix very quickly (in time O(diameter)). This is why "scramble" generation in the WCA uses just 20 random face turns; that is enough to bring the cube to uniform-random over its state space, with negligible probability of any bias.

The information-theoretic lower bound and the matching algorithmic upper bound together give us a complete asymptotic picture: optimal move count grows as n²/log(n) for n×n cubes, and the constant is between 1 and 10 (probably around 2-3 for the practical asymptotic). For real-world cubes (n ≤ 7), the constants matter more than the asymptotics, but the asymptotic picture tells us why solving larger cubes takes increasingly more moves.

## Random Position Distributions and Real-World Statistics

When you scramble a cube with a WCA-quality scrambler, the resulting position is uniformly random over G's 4.3 × 10^19 states (up to mixing-time corrections of order 10^-10 or smaller, easily ignorable). This means that you can characterize many real-world cubing quantities by sampling from the uniform distribution and computing statistics.

The distribution of optimal HTM solution lengths is the one we discussed earlier: mean ≈ 17.92, median = 18, mode = 18, standard deviation ≈ 0.88. The full distribution from depths 0 to 20 is shown in the historical tables.

The distribution of optimal STM (slice-turn metric) solution lengths is shifted slightly higher. STM counts each face turn or middle-slice turn as 1 move, with 18 + 6 = 24 generators (including M, M', E, E', S, S' as 3 additional pairs). Since slice turns give more flexibility, STM-optimal solutions are typically the same or shorter than HTM-optimal. Empirically, the mean STM-optimal length is about 17.5 ± 1.0, and the diameter in STM is 18.

The distribution of "good first moves" is also interesting. A "good first move" is one that does not increase the optimal solution length from the current position. Out of the 18 HTM generators, the expected number of good first moves is about 2.3 for a random position. This means that, on average, only 13% of the moves you could make from a random position are "optimal moves"; the rest will either keep distance the same or increase it.

The "cubically" of a position is the count of pieces that are correctly placed (in correct position and orientation). For a random position, the expected number of correctly-placed pieces is 0.05 corners and 0.083 edges (small fractions, reflecting that random placement gives 1/8 chance for each corner and 1/12 chance for each edge to be in the right slot, with similar small fractions for orientation). The expected number of "totally solved" pieces (correct position AND correct orientation) is 1/24 corner = 0.33 corners and 1/24 edge = 0.5 edges, totaling about 1.7 pieces out of 20.

For human cubers, the natural question is: what does the per-stage optimal distribution look like? Empirical studies of thousands of random scrambles solved by computer Kociemba give:

Cross optimum (color-neutral): mean 5.5, mode 5-6, range 4-8

Cross optimum (fixed white): mean 6.5, mode 6-7, range 4-9

F2L optimum (after optimal cross): mean 28, mode 27-28, range 22-37

CFOP-stage-optimum (Cross + F2L + OLL + PLL with each stage optimal but no inter-stage optimization): mean 56, mode 54-56, range 40-75

These match the human empirical observations: top CFOP cubers average 50-55 STM with 17-18 TPS, which is within 5-10 moves of the per-stage optimum.

The distribution of "lucky" cases (where the solver gets a 1-look skip, e.g., the OLL is already solved after F2L) has been studied empirically. The probability of an OLL skip (cube has yellow on top after F2L) is 1/216 = 0.46% (1 chance in 216). The probability of a PLL skip (cube fully solved after F2L+OLL) is 1/72 = 1.4% (1 chance in 72). The probability of getting both OLL and PLL skips simultaneously is 1/(216 × 72) = 1/15,552 (about 0.0064%). World-record-level solves typically have at least one skip; the famous Yusheng Du 3.47 second solve had a PLL skip.

The "fewest moves" empirical study has been done on random scrambles to estimate FMC-style human performance vs. optimal. With 60 minutes of thinking, top FMC solvers average about 24-28 moves on standard WCA FMC scrambles. The global optimum is 18 ± 1. So FMC solvers are about 4-10 moves worse than optimal on average. With significantly more thinking time (hours per scramble), human FMC solvers can sometimes match the optimum, but it requires highly favorable scrambles.

## Symmetry, Anti-Symmetry, and Equivalence Classes

The cube has 48 spatial symmetries: 24 rotations of the whole cube (including the identity) and 24 rotation-reflections (including 24 mirror images). These 48 symmetries form a group, conventionally denoted O_h (the symmetry group of the regular octahedron, isomorphic to S_4 × C_2). The 48 symmetries act on the 4.3 × 10^19 cube positions, and we can group positions into equivalence classes under this action.

The number of equivalence classes is given by Burnside's lemma: |E| = (1/|G|) × sum_{g in G} |Fix(g)|, where |Fix(g)| is the number of positions fixed by symmetry g. For most symmetries g, Fix(g) is small (a few thousand or less) because most positions are not invariant under any non-trivial symmetry. The identity symmetry fixes all 4.3 × 10^19 positions, and most of the remaining 47 symmetries fix a much smaller number. The computation gives approximately 901,083,404,981,813,616 equivalence classes, which is exactly |G| / 48 minus a small correction for the "symmetric" positions that have non-trivial stabilizers.

For cube enumeration purposes, you can also consider anti-symmetry (the inverse-of-symmetry operation). This adds a factor of 2 to the symmetry group, giving 96 elements total. Some positions are anti-symmetric (the position is identical to the inverse of its rotated version), but most are not. The exact number of equivalence classes modulo symmetry+antisymmetry is about 450,541,810,590,509,808 (approximately |G| / 96 with a small correction).

The use of symmetry + antisymmetry was crucial for the 2010 God's number proof. Rather than enumerating all 4.3 × 10^19 positions, the team enumerated representatives of each of the 901 quadrillion symmetry classes, then multiplied by 48 to verify the diameter for the whole space. The factor-of-48 reduction in compute (combined with the symmetry-aware coset enumeration) made the 35 CPU-year computation feasible.

The 901 quadrillion equivalence classes group cube positions into "essentially distinct" scrambles. Two positions are in the same class if and only if you can transform one into the other by physically rotating the whole cube (and/or looking at it in a mirror). This is the right notion of "distinct scramble" if you are asking about the inherent difficulty of a position, since the cube's solving structure is identical under symmetry.

The WCA, however, does not use the equivalence classes when distinguishing scrambles. WCA scrambles are distinguished by their algorithmic encoding (the sequence of moves used to generate them) and by their resulting solved state from the standard orientation. Two scrambles are considered "different" if they generate different positions when applied from the solved cube; this is the natural definition for competition scoring.

There is a famous "MD5 distinct-scramble" argument that uses the fact that, in any competition, the probability of two different competitors getting the same scramble is essentially zero. With 4.3 × 10^19 positions and a typical WCA event having 100-200 competitors with 5 attempts each (so 500-1000 scrambles per event), the probability of a duplicate scramble is about (500 × 1000) / 4.3e19 = 1.2e-14, which is negligible.

## Connection to Forecasting

All of this mathematics has direct implications for forecasting the future of 3x3 speedcubing world records. The relevant concept is the "execution wall": the asymptotic best-possible solve time given perfect execution at the maximum-feasible turning speed.

Let M be the average STM length of an optimal human-method solution, and let T be the maximum-feasible turns per second (TPS). The asymptotic minimum solve time is M / T. For an idealized perfect Kociemba solution (M = 22) executed at the maximum feasible 25 TPS, this is 22 / 25 = 0.88 seconds. So even with perfect execution at the maximum-realistic speed, you cannot solve a random scramble in under 0.9 seconds using a Kociemba-style optimal solution. This is the "math wall" for forecasting.

For human-realistic CFOP/1LLL methods with M = 47-50 STM and T = 18 TPS, the asymptotic minimum is 47/18 = 2.6 seconds. This is the "method wall" for CFOP-style solving. To break sub-3, you need M and T values that together divide to under 3.

Why can't execution alone break sub-1? Because to do so, you would need M ≤ 17 (to get M/T = 17/17 = 1.0 with T = 17 TPS, or M/T = 25/25 = 1.0 with T = 25 TPS). M = 17 is below the global Kociemba optimum of 18, so it requires choosing scrambles that happen to have shorter-than-average optima. If you're picking a random scramble, the probability of an optimum ≤ 17 is the cumulative distribution at 17, which is about 0.7% from the cube20.org distribution. So 1 in 140 random scrambles could theoretically be solved in 1 second with perfect execution. The actual probability of a competition solve achieving this is essentially zero, because no human can find and execute a 17-move solution in the 15-second inspection window.

For sub-2 forecasting, M ≤ 34 and T = 17 TPS gives M/T = 2.0 seconds. M = 34 is within reach of the best CFOP solutions on lucky scrambles. The world record is currently 3.13 seconds (Max Park 2025), suggesting we are about 1 second above the theoretical sub-2 wall. Further improvements would need to come from method efficiency (lower M) and turn-speed efficiency (higher T) combined.

Solver-quality bounds are particularly stringent. Even Kociemba in 50 ms is 5× the realistic inspection window of about 10 ms of effective "solver thought" available to a human during inspection. So human cube-thought is necessarily suboptimal compared to a Kociemba solver. The gap is what gives room for methods improvement: as humans develop better intuition for finding short solutions in real-time, the per-stage move counts can decrease.

The mathematical wall on solve times is interesting because it is a real limit, not a soft bound. With 4.3 × 10^19 positions, an average optimal length of 17.92, and a maximum feasible TPS of around 25 in real-world physical cubing, the asymptotic best solve time is approximately 17.92 / 25 = 0.72 seconds. This is the "perfect solve" lower bound: a human or AI that can find and execute the global optimum at maximum TPS would average about 0.72 seconds. Current world records (Park 3.13 average) are about 4x this asymptotic limit.

For forecasting purposes, the math wall sits at about 0.7 seconds. The method wall sits at about 2.6 seconds (for CFOP). The technological wall (mechanical cube turning speed limit) sits at about 25-30 TPS, set by the maximum cube-internal mechanism rotation speed. The cognitive wall (human ability to find and execute a near-optimal solution in the 15 inspection seconds) sits at about 50-60 STM with 17-18 TPS lookahead, giving 3-3.5 seconds.

These walls are not independent: improving one (e.g., human cognition) requires that another wall (e.g., method efficiency) does not block progress. The current state of speedcubing is well within the cognitive wall (current world record 3.13 is comfortably above the 2.6 method wall), so there is room for further improvement. But the asymptotic limits give a fundamental lower bound: sub-1.0 solve times require both M < 25 (which means non-CFOP methods or lucky scrambles) AND T > 25 (which means mechanical innovations).

The forecasting models on this site use these mathematical bounds as soft constraints. The "average" model predicts that world records will approach but never reach the method wall, with the asymptotic time being something like 2.0-2.5 seconds for the average and 1.5-2.0 seconds for the single. The "optimistic" model assumes that AI-assisted solving or new methods can break the CFOP barrier, pushing the wall down toward 1.5 seconds for the average. The "pessimistic" model assumes that current methods are essentially optimal and that the wall sits at about 2.5 seconds.

These predictions are not certainties; they are interpretations of the math. The history of cubing has shown that mathematical bounds can be circumvented by novel methods and better hardware, but the asymptotic walls remain. The next decade of speedcubing will be defined by how much progress can be made within each wall, and by whether new methods (1LLL, AI-assisted inspection, hybrid Roux/CFOP) can break the current CFOP wall.

In closing, the mathematics of the 3x3 cube is rich, well-developed, and full of beautiful structure: the 4.3 × 10^19 state space partitions into 901 quadrillion equivalence classes, the Cayley graph has diameter 20 in HTM and 26 in QTM, the diameter computation took 35 CPU-years and exploited symmetry+antisymmetry+coset techniques, and the asymptotic complexity is Θ(n²/log n) for the n×n family. All of these facts have direct implications for the future of speedcubing. The math sets the walls, and the future of cube-solving will be defined by how human ingenuity and computer assistance push against and circumvent those walls in the coming years.

Whether you are interested in the theoretical foundations of group theory and combinatorial enumeration, the empirical study of solving methods and human performance, or the practical art of forecasting world records, the mathematics of the cube provides a rigorous foundation for thinking about all three. The state space is exactly known, the diameter is exactly known, the optimal solving algorithms are well-understood, and the average human-method performance is empirically measured. All of these inputs feed into a forecasting framework that respects both the mathematical limits and the empirical trends.

The beauty of cube mathematics is that it is one of the few areas of recreational math where the theory and practice have converged completely: the global optimum is computable, the human-method optima are computable, and the gap between them tells you exactly where the room for human improvement lies. As speedcubers approach the human-method walls, the conversation shifts toward whether new methods can break those walls, and what the practical limits of human cognition and mechanical execution truly are.

This is the question we explore in the rest of this prediction page: not just where the records have been, but where the mathematics says they can go. The 4.3 × 10^19 number is not just a curiosity; it is the foundation on which all forecasting rests.

## Appendix: Key Numbers and References

For convenience, here are the key numerical facts that appear throughout this chapter, with their sources:

State space size: 8! × 3^7 × 12! × 2^11 / 2 = 43,252,003,274,489,856,000 ≈ 4.3 × 10^19 (Singmaster 1981; standard derivation).

Index of G in S_48 (assembly group): 12 (Singmaster 1981).

Number of equivalence classes under O_h symmetry: ≈ 901 quadrillion (Burnside computation; standard).

God's number in HTM: 20 (Rokicki, Kociemba, Davidson, Dethridge 2010; computational proof using Google compute, 35 CPU-years).

God's number in QTM: 26 (Rokicki, Davidson 2014).

God's number in STM (single-slice): not exactly known; lower bound 18, upper bound 20.

Information-theoretic lower bound (HTM): ceil(log_18(4.3e19)) = 16 (folklore counting argument; widely understood since the late 1970s).

Lower bound for n×n cube: Ω(n²/log n) (Demaine, Demaine, Eisenstat, Lubiw, Winslow 2011).

Upper bound for n×n cube: O(n²/log n) (Demaine et al. 2011, constructive).

NP-completeness of optimal n×n cube solving: Demaine, Demaine, Eisenstat, Lubiw, Winslow (arXiv 1706.06708, 2017).

Two-phase Kociemba algorithm: Kociemba 1992; refined by Rokicki and others over subsequent decades.

Thistlethwaite four-phase algorithm: Thistlethwaite 1981.

CFOP average move count: 50-60 HTM (top-level empirical, multiple sources).

FMC world records: single 16 (Tronto 2019, Schoon 2018); mean 22.00 (Wenfei He, recent).

Yusheng Du 3.47 single world record: 2018, broken in 2025 by Max Park.

The full distance-from-solved distribution (HTM): tabulated at cube20.org, results from the 2010 computation.

H subgroup size (Kociemba): 19,508,428,800 = 8! × 8! × 4! / 2.

Squares group size: 663,552.

These numbers are the foundation on which all 3x3 cube forecasting rests. The computational results have been independently verified, and the theoretical bounds are well-established in the recreational mathematics and computer science literature.

## Appendix: Sample Calculations

To make the mathematics concrete, here are several worked calculations.

Calculation 1: The exact state-space derivation. We have 8 corners which can be permuted in 8! = 40,320 ways. Each corner has 3 orientations, giving 3^8 = 6,561 orientation combinations, but the corner-twist constraint (sum mod 3 = 0) reduces this by a factor of 3, leaving 3^7 = 2,187. Similarly, 12 edges can be permuted in 12! = 479,001,600 ways. Each edge has 2 flip states, giving 2^12 = 4,096 combinations, but the edge-flip constraint reduces this by 2, leaving 2^11 = 2,048. The permutation parity constraint links corner and edge permutations; this divides the product 8! × 12! by 2. The final count is (8! × 3^7 × 12! × 2^11) / 2. Plugging in: (40320 × 2187 × 479001600 × 2048) / 2 = 43,252,003,274,489,856,000 exactly. The intermediate products are 40320 × 2187 = 88,179,840 and 479001600 × 2048 / 2 = 490,497,638,400, so the final value is 88,179,840 × 490,497,638,400 = 43,252,003,274,489,856,000 — an exact integer with no rounding.

Calculation 2: The expected number of correctly-placed pieces in a random position. Each corner has probability 1/(8 × 3) = 1/24 of being both in the correct slot and correctly oriented (8 slots, 3 orientations each, only 1 of which is "correct"). With 8 corners, the expected number of correctly-placed corners is 8 × 1/24 = 1/3 ≈ 0.33. Similarly, each edge has probability 1/(12 × 2) = 1/24 of being correctly placed, so the expected number of correctly-placed edges is 12 × 1/24 = 0.5. Total expected: 0.83 pieces out of 20.

Calculation 3: The probability of an OLL skip. After completing F2L, the top layer has 4 corners and 4 edges, with the orientation state to be solved. The number of orientation states is 3^3 × 2^3 = 216 (3 independent corner orientations because of mod-3 constraint, 3 independent edge orientations because of mod-2 constraint, with the cross corners and edges already oriented from F2L). The "solved" orientation state (all yellow on top) is just 1 of these 216, so the probability of an OLL skip is 1/216 ≈ 0.46%.

Calculation 4: The probability of a PLL skip. After OLL, the top layer is fully oriented. The 4 corners and 4 edges of the top layer remain to be permuted. Each set has 4! = 24 permutations, the permutation-parity constraint links them (dividing the product by 2), and a final AUF rotation identifies 4 of those states with each other (dividing by 4). The number of distinct PLL permutation classes is therefore (24 × 24) / (2 × 4) = 72. Only one of these 72 classes is "already solved", so the probability of a PLL skip is exactly 1/72 ≈ 1.39%.

Calculation 5: The probability of both OLL and PLL skip. By independence (after accounting for the orientation/permutation independence), this is approximately 1/216 × 1/72 = 1/15,552 ≈ 0.0064%. So 1 solve in roughly 15,000 will have both skips, which translates to about 1 in 50 high-level competition averages including a double-skip solve.

These calculations illustrate the kind of mathematical reasoning that underpins both the theoretical analysis and the empirical observation of cube-solving. The state space is so large that every quantitative statement must rest on careful counting arguments, but the arguments themselves are accessible to anyone with high school combinatorics.

## Appendix: The Singmaster Notation and Move Encoding

A historical aside is worth making about Rubik's cube notation, because the formalism we use today is not the only one that has been proposed, and the choice of notation has subtle implications for how we think about the math.

The standard Singmaster notation, introduced by David Singmaster in 1980, uses the six letters U, D, L, R, F, B for the six faces, with the implicit convention that a single letter means a 90 degree clockwise rotation viewed from outside the cube. The suffix "2" means a 180 degree rotation, and the suffix prime or apostrophe means a 90 degree counterclockwise rotation. So R U R' U' is read as "right, up, right-prime, up-prime" and corresponds to the famous "sexy move" sequence.

Other notations have been proposed over the years. The original Rubik notation, used by Ernő Rubik himself in his early writings, used directional arrows on a 2D diagram rather than alphabetic letters. The Singmaster notation displaced this because it was much more compact and easier to write out long sequences. The Reid notation, used by Michael Reid in his early FMC work, is similar to Singmaster but with some shorthand for slice moves. The Lucas Garron notation, used in cubing.js and modern cubing software, allows for arbitrary axis rotations like "Uw" for "wide U turn including the second layer" and "u" for "U-layer rotation".

The notation matters for forecasting because move counts depend on the metric being used. In HTM, R2 counts as 1 move; in QTM, R2 counts as 2 moves (since 180 = 90 + 90). In STM, M counts as 1 move; in HTM, M is not a generator and would need to be expressed as R L' x' or similar, adding 2-3 moves. The world record times we see on the leaderboard are influenced by which moves the solver uses; cubers who use more M-slice moves get lower HTM counts but higher STM counts, while cubers who avoid slice moves get the opposite pattern.

The Singmaster notation also encodes the physical structure of the cube: there are 6 faces, each with 3 possible 90-degree rotations (clockwise, counterclockwise, 180), giving 18 generators in HTM. This is a redundant generator set because, for example, U' U2 is the same as U, but the redundancy is useful for human cubers who want to think in 90-degree increments.

For optimal solving, the metric matters because the diameter changes. HTM diameter is 20, QTM diameter is 26. In STM, the diameter is 18 (slightly smaller because of slice flexibility). For human cubers, the STM metric is most relevant because it counts "physical hand motions" which is what determines actual solve time. A 50 STM solve at 18 TPS takes 2.78 seconds; a 50 HTM solve might be 55 STM and take 3.06 seconds.

## Appendix: The Cube Graph as a Combinatorial Object

We have referred to "the Cayley graph of G" throughout this chapter, and it is worth saying a bit more about its structural properties. A Cayley graph is a graph constructed from a group G and a generating set S, where the vertices are the elements of G and there is an edge from g to gs for each generator s in S.

The Cayley graph of G with respect to the 18 HTM generators has 4.3 × 10^19 vertices. Each vertex has degree exactly 18 (one edge per generator). The graph is connected (since the generators generate G) and vertex-transitive (the cube symmetries act transitively on vertices). It is also bipartite if we consider only quarter-turn moves (since each quarter turn changes the parity of the permutation), but with half-turn moves included, the graph has odd cycles and is not bipartite.

The girth of the Cayley graph (the length of the shortest cycle) is 4: the shortest non-trivial cycle is R U R' U' R U R' U' which is a commutator that loops back to the identity in just 12 quarter turns, but a shorter analysis shows that there is a 4-cycle hidden in the move sequence X Y X' Y' for certain (X, Y) pairs.

The chromatic number of the Cayley graph is at most 19 (by direct coloring) but the exact value is unknown. The independence number (largest set of vertices with no edges between them) is similarly unknown.

The graph has very high expansion: random walks on the graph mix to uniform in time O(diameter * polylog(n)), and the spectral gap is bounded below by a positive constant. This is why "random scrambling" with 20 face turns gives a position that is essentially uniformly distributed over the state space.

The cube graph has been used as a benchmark in computer science to test graph algorithms, ranging from BFS implementations to compression of large graphs. The 2010 God's number computation effectively performed a BFS on this graph (using symmetry reduction) and found the diameter; the result is a cornerstone of computational graph theory in the recreational mathematics tradition.

These structural properties are deeply tied to the cube's combinatorial complexity. A graph with diameter 20 and 4.3 × 10^19 vertices is extremely sparse: the ratio of edges to "all possible edges" is roughly 18 / 4.3e19 ≈ 4e-19, far less than even a random graph at the same vertex count. Yet the graph is connected, and the diameter is small compared to log(vertices), making it a "small-world" graph in a loose sense. The cube graph is one of the most studied finite graphs in mathematics, second perhaps only to the symmetric group's Cayley graphs themselves.
`;
