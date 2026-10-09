*The explanation below is an informal description of the issues that arise
in generating a pruning table when working with a complex cube coordinate
that has a symmetric component. It is an excerpt of an email exchange
between me and [Arhan Chaudhary](https://github.com/ArhanChaudhary).*

Let's say we are working with what I call a
*symmetric-composite coordinate* in my
[cube coordinate page](https://sebastiano.tronto.net/speedcubing/coordinates).
So you have one coordinate that is reduced by symmetry composed with
one that is not. As an example:

* The symmetry-reduced coordinate is "corners", a coordinate that
  determines the orientation and permutation of corners, reduced by
  symmetry. Before reducing it by symmetry it would be a number
  0 <= x < 8! * 3^7, after applying symmetry that number is between 0
  and ~(8! * 3^7)/48 (because here are 48 possible symmetries).
* The other coordinate is "edges", given by a number between 0 and
  12! * 2^11. This coordinate is NOT reduce by symmetry.

This is obviously a very large coordinate, not usable in practice,
but it is easy to explain.

Computing the value of this combined coordinate is done like this
(it is also explained in the paged I linked above):

1. Compute the coordinate value c of "corners".
2. Find the cube transformation that brings the corner position to the
   representative of its symmetry class.
3. Transform the cube by the transformation found in step 2.
4. Compute the value e of "edges" of the transformed cube.
5. Compute c * (12! * 2^11) + e (the number we multiply by is the
   maximum value of "edges" +1).

(Some of the information we need, like which one is the representative
of a symmetry class or whic transformation leads to a representative,
is pre-computed).

Now let's consider a position that is symmetrical as far as corners
are concerned, but not symmetrical (or less symmetrical) as far as
edges are concerned:

* The corners are all solved;
* The edges are off by an H-perm on the top layer (UF swapped with UB and
  UR swapped with UL).

We'll call this position P1. This P1 is equivalent to a position P2
that has corners all solved and an H-perm on the bottom, but these two
positions DO NOT have the same value according to the coordinate we
defined: in step 3 above, in both case the transformation is going to
be trivial (i.e. no transformation is performed), because there is only
one element in the symmetry class of this corner position, the solved
position; this must also be the representative. This leads in one case
to use the value of e coming from "H-perm on top" and in the other case
that coming from "H-perm on the bottom".

The problem we have now is this: will the pruning table values for
P1 and P2 be initialized correctly?  Let's say that there is only one
shortest path from the solved cube to P1, and it ends with the move U,
and let's call Q1 the position before this last U. (In reality this can't
be the case, because then also U' would work, but this is not going to
break our reasoning here.) Similarly, let's call Q2 the position before
the last D move in the shortest path from solved to P2 (by symmetry,
the last move must be D, like it was U for P1).

Q1 and Q2 are of course equivalent, in the same sense that P1 and P2
were. But more than that, they actually have the same coordinate value,
unlike P1 and P2! This is because their edge position is "less symmetric":
the "transformation to representative" of step 2 above must bring each
of Q1 and Q2 with the turned side (U or D respectively) to the same side.

This means that when we scan the list of positions at distance N
(the distance of Q1/Q2 to solved) to fill the positions at distance
N+1 (such as P1/P2), this position Q1/Q2 is reached only once; and
we apply the move U (or equivalent) to it only once. Therefore, we
cannot reach both P1 and P2 with this strategy! As I explain
[here](https://sebastiano.tronto.net/speedcubing/coordinates/#pruning-tables):
we'll have to add an extra step to fill in correctly the positions like
P1 and P2.

In the previous paragraph I am assuming that we are filling the pruning
table in a specific way, i.e. "scanning the list of position at distance N
to fill the positions at distance N+1". This not the only techniques for
filling a pruning table, but I hope it is clear that any other technique
that takes advantage of symmetry (by considering Q1 and Q2 as the same)
is going to lead to the same problem with P1 and P2.

Trying to summarize all of the above:

* When using the "symmetric-composed coordinates" technique, there are
  positions that are technically equivalent but have distinct values.
* When we fill the pruning table, we may reach these positions from
  positions that do not have this characteristic. This is going to "hide"
  some equivalent positions that have distinct values.
