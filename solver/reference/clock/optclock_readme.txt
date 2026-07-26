## OptClock Readme ##

== What is this? ==

OptClock is a program for optimally solving Rubik's Clock positions. It is Copyright 2014 by Michael Gottlieb and Ben Whitmore. Michael Gottlieb developed the solving algorithm and wrote the non-GUI version of the program, while Ben Whitmore created the GUI in Qt.

The exe files are compiled for Windows, but if you are not using a Windows system you may want to recompile. 

== Notation Used ==

There are two types of notation used for the program: one for scrambles and one for moves.

Scrambles are just lists of 14 integers. Each number represents the "hour" displayed by one of the clock pieces, and any list of 14 integers is a valid scramble. Usually people use 1-12 for each number but this is not required. The order of the numbers is as follows:
   1 2 3     . 10 .
   4 5 6    11 12 13
   7 8 9     . 14 .
  (front)    (back)
The dotted numbers do not need to be entered since their values are determined by the front corners. Also, when turning from front to back, make sure to turn so that the top of the puzzle remains on top (so 10 is opposite 2).

Moves look something like UUDU u3'. The uppercase part (UUDU) is the state of the 4 pins, in the order top-left, top-right, bottom-left, bottom-right. U means up (pin towards you) and D means down (pin away from you). If the lowercase letter is a u, it means to turn a corner that is next to a U pin; if the lowercase letter is a d, it means to turn a corner next to a D pin. The number tells you the amount to turn, and is just like the notation for cubes: the letter by itself means to turn clockwise by 1 increment; the letter with a number means to turn clockwise by that number of increments; and a ' sign always means to do the same turn counterclockwise instead of clockwise. So in this case (u3') it means to turn a corner next to a U pin counterclockwise by 3 increments.

== Using the Program ==

There are two non-GUI versions: a normal version and a statistics version. The normal version is for solving individual scrambles: just enter in a scramble with the above notation, and it will be optimally solved for you. Enter "q" to quit the program. The statistics version is for solving many scrambles at once and reporting on how many moves they took. Enter in the number of scrambles and an upper bound, and the program will generate that many scrambles and solve them all, and then print some statistics. Every 100 scrambles a number will be printed to the screen so you can be sure it's still running properly.

A little note about the upper bound. Basically, the program will stop searching for solves when it finds a solve using no more than the upper bound number of moves. The higher the upper bound is, the faster the solver will run. If you set it to 0, it will only look for optimal solves.

With the GUI version, the features are pretty much the same, but it is a little different to use. To solve a given scramble, set up the scramble by clicking on the clocks, and then press the "Solve" button. The "Generate random scramble" button will generate a random position, and the "Reset" button will move the clocks back to solved. "Batch solver" works like the statistics version as explained above, although it will also let you run the solver with multiple threads (to speed up execution) and a custom priority level.

Note that all forms of the program will create and use a 3-megabyte tables file (phase2.table). Apart from the program itself, this is all the hard drive space it needs. If you ever lose this file it will just get regenerated the next time the program is run.

== The Solving Algorithm ==

Here I will discuss how the program actually finds optimal Clock solves, since as far as I know this is a pretty new feature. The program itself has a lot of optimizations and memoization, so even if you understand the theory it may be tricky to see out exactly what the code is doing.

The solving algorithm uses two phases. Consider the 9 clocks on each side of the puzzle; we can divide these into 1 center, 4 edges, and 4 corners. The first phase of the solution matches each face's center and edges into a "cross" of 5 clocks pointing the same way. The second phase then solves the corners and two crosses optimally. At a very high level, we can quickly figure out how long a phase-2 optimal solution is, so we just try every possible phase 1 solution and determine the best total movecount we can get, where total movecount is the sum of the phase 1 movecount and phase 2 movecount.

It saves time to separate the puzzle into two phases like this because the 30 possible moves can be split into moves useful for phase 1, and moves useful for phase 2. The 16 phase 1 moves are moves that affect the cross - that is, they move a face's center without moving all four of its edges. The 14 phase 2 moves, on the other hand, preserve both crosses. By design, phase 1 moves are not useful in phase 2 (they break the cross), and phase 2 moves are not useful in phase 1 (they do not affect the cross). So, since we can do the moves of a solution in any order, it is safe to assert that phase 1 moves are only used during phase 1, and phase 2 moves are only used during phase 2.

Phase 2 is simpler, so I'll discuss it first. Because we only have two crosses and four corners to deal with, there are only 12^6 positions - about 3 million. This is small enough that we can use a standard God's Algorithm loop to compute the optimal distance for each of these positions, and then store that in a table. Having the phase 2 distance in a table lookup is what makes the solver fast enough to be practical. For the two-phase algorithm we only need the number of moves, until we want to print a solution, and then we can just work backwards from the phase 2 position to find an optimal move sequence for this phase.

In phase 1, we have to try all solutions to see which ones end up with fast phase 2 solutions, so we can't just set up an optimal table. But there are 16 possible moves, so we have to be clever about it. I divided those 16 moves into two types: edge moves such as UUDD u, which only affect one edge (relative to the center), and corner moves such as UDDD u, which affect two edges (relative to the center). If we know how much we want to do each corner move, then since each of the 8 edge moves affects only one of the 8 edges, and they all must be the same as their center after phase 1, the amount of each edge move that we do is forced. So the only "degrees of freedom" we have for our phase 1 solution is the amount of each corner move that we use. There are 8 of those, with 12 possible angles for each, so there are only 12^8 phase 1 solutions! We can simply loop through those, and check the total movecount of each possibility. The best total movecount means the optimal solution.

Now, 12^8 is about 430 million, so of course we don't want to do too much computation for each one. We can quickly compute the phase 1 movecount by splitting it into a front and a back, each affected by 4 of the 8 corner moves. We can compute the number of moves on each side for every possible set of angles for those 4 moves (that is, two tables of size 12^4) and just add the relevant entries together to get the phase 1 movecount. Then, for phase 2, with a little math we can predict the positions of the crosses and corners for any given set of corner moves, and then plug that into our phase 2 table to get the phase 2 movecount. So the movecount for the whole puzzle is computed by indexing into a bunch of tables, and all we have to do is figure out the indexes.

To save some more time, it turns out we don't even need to look at phase 2 for most of the 12^8 possibilities. Suppose we have already seen an 11-move solution. Then, if we are trying a solution that already takes at least 11 moves in phase 1, we know there's no way it can be better than what we already have, and we can decide not to even check the phase 2 movecount. Phase 1 solutions can take up to 16 moves, so we can usually throw out the vast majority of them, saving a surprising amount of time.

In the end, most of this was only possible because the moves commute - you can do a set of moves in any order. A lot of the tricks I used wouldn't be possible or useful on a cube. Still, it's cool to add this to the list of puzzles that can be solved optimally! After this release, I'm going to see if I can find God's Number. Right now, it's looking like it's 11.