# Solvers

This document contains a list cube solvers supported by this library.
Some solvers require the cube to be in a certain state before they can
be used - see below for details.

## The H48 optimal solver

An HTM-optimal solver using fully-symmetric pruning tables. For details
about how this solver works, see [h48.md](./h48.md). For benchmarks see
[benchmarks/benchmarks.md](../benchmarks/benchmarks.md).

* Name: of the form `h8hX` for `X` from 0 to 11. The name `optimal` is
  an alias for `h48h7`.
* Requisites: none.
* Moveset: HTM (all 18 basic moves).
* From 115MB to 59GB (roughly 2<sup>X</sup>*56MB).

*Note: for better performance, the solver's data should be 64-byte
aligned. To achieve this, one can use
[`aligned_alloc(64, size)`](https://en.cppreference.com/w/c/memory/aligned_alloc)
in C11 or later,
[`_aligned_malloc(size, 64)`](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/aligned-malloc)
on Windows platforms, or the
[aligned `new` operator](https://cppreference.com/w/cpp/memory/new/operator_new.html)
in C++17 or later.*

## Coordinate solvers

Various solvers to solve different substeps, commonly used for Fewest
Moves solving.

The names start either with `coord_` or with `mcoord_`, and the last two
letters denote a transformation to adjust the starting orientation. For
example, `coord_EO_UR` solves the edge orientation on the RL axis.

For simplicity and for compatibility with nissy-classic, some aliases
are provided.

### Edge orientation

Solve the edge orientation on the FB axis. NISS can be used.

* Name: `coord_EO_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `eofb` for `coord_EO_UF` (EO on FB)
  * `eorl` for `coord_EO_UR` (EO on RL)
  * `eoud` for `coord_EO_FD` (EO on UD)
* Requisites: none.
* Moveset: HTM (all 18 basic moves). The ending quarter turns are
  always clockwise.
* Data size: 1.5KB.

### Domino reduction

Solve the domino reduction on the UD axis. NISS can be used.

* Name: `coord_DR_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `drud` for `coord_DR_UF` (DR on UD)
  * `drrl` for `coord_DR_RF` (DR on RL)
  * `drfb` for `coord_DR_FD` (DR on FB)
* Requisites: none.
* Moveset: HTM (all 18 basic moves). The ending quarter turns are
  always clockwise.
* Data size: 72MB.

### Domino reduction from edge orientation

Solve the domino reduction on UD from edge orientation on FB.
NISS can be used.

* Name: `coord_DREO_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `drud-eofb` for `coord_DREO_UF` (DR on UD from EO on FB)
  * `drrl-eofb` for `coord_DREO_RF` (DR on RL from EO on FB)
  * `drud-eorl` for `coord_DREO_UR` (DR on UD from EO on RL)
  * `drfb-eorl` for `coord_DREO_RU` (DR on FB from EO on RL)
  * `drrl-eoud` for `coord_DREO_FR` (DR on RL from EO on UD)
  * `drfb-eoud` for `coord_DREO_FD` (DR on FB from EO on UD)
* Requisites: edge orientation must be solved on FB.
* Moveset: {U, U', U2, D, D', D2, R2, L2, F2, B2}.
  The ending quarter turns are always clockwise.
* Data size: 91KB.

### HTR from domino reduction

Solve the half turn reduction from domino reduction on UD.
NISS can be used.

* Name: `coord_HTR_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `htr-drud` for `coord_DR_UF` (HTR from DR on UD)
  * `htr-drrl` for `coord_DR_LF` (HTR from DR on RL)
  * `htr-drfb` for `coord_DR_BU` (HTR from DR on FB)
* Requisites: domino reduction is solved on UD.
* Moveset: {U, U', U2, D, R2, L2, F2, B2}. The ending quarter turns are
  always clockwise. Moreover, solutions are filtered so that at most
  one D move is used, and it will always appear before any U or U' move.
  Solutions with consecutive U / U2 / U' / D moves are also filtered out.
  This solver will produce therefore fewer solutions than nissy-classic.
* Data size: 265KB.

### Leave slice from domino reduction

Solve all but the E-layer from domino reduction on UD.
The E-layer centers may not be solved. NISS will not be used.

* Name: `coord_DRSLICE_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `drudslice` for `coord_DRSLICE_UF` (Leave slice from DR on UD)
  * `drrlslice` for `coord_DRSLICE_LF` (Leave slice from DR on RL)
  * `drfbslice` for `coord_DRSLICE_BU` (Leave slice from DR on FB)
* Requisites: domino reduction is solved on UD.
* Moveset: {U, U', U2, R2, L2, F2, B2}.
* Data size: 54MB.

### Solve all from domino reduction

Solve the whole cube from domino reduction on UD.
NISS will not be used.

* Name: `coord_DRFIN_xx`, where `xx` denotes the rotation.
  Provided aliases are:
  * `drudfin` for `coord_DRSLICE_UF` (Solve from DR on UD)
  * `drrlfin` for `coord_DRSLICE_LF` (Solve from DR on RL)
  * `drfbfin` for `coord_DRSLICE_BU` (Solve from DR on FB)
* Requisites: domino reduction is solved on UD.
* Moveset: {U, U', U2, D, D', D2, R2, L2, F2, B2}.
* Data size: 54MB.

### Solve corners (fixed centers)

Solve the corners of the cube. The centers are considered fixed,
this is not the same as solving a 2x2x2 cube.

* Name: `coord_CORNERS_UF`. Other rotations in place of `UF` are allowed,
  but they are irrelevant to the solver. Provided alias: `corners`.
* Requisites: none.
* Moveset: HTM (all 18 basic moves).
* Data size: 1.2MB.

### Solve corners (ignoring centers)

Solve the corners of the cube relative to each other, ignoring centers.
This is the same as solving a 2x2x2 cube.

* Name: `coord_CORNERSX_UF`. Other rotations in place of `UF` are allowed,
  but they are irrelevant to the solver. Provided alias: `cornersx`.
* Requisites: none.
* Moveset: {U, U', U2, R, R', R2, F, F', F2}. Note: if the given cube
  has an orientation different from the standard `UF` orientation, the
  solution will use a different moves. The solution will always only use
  at most 3 different types of moves (as in U, R, F).
* Data size: 1.2MB.

### Undocumented coordinate solvers

There are some coordinate solvers that have not been listed above. These
are generally not very useful on their own, but instead they are combined
to produce some of the more complex coordinate solvers above.

These solvers include:

* `coord_CPEPE_xx`: solve the permutation of the corners and of the E-layer
  edges. Requires DR to be solved on UD.
* `coord_DRFINNOE_xx`: like the "leave slice" solver, but the U and D
  layers are going to be adjusted so that centers are solved. We chose
  to use `coord_DRSLICE_xx` as described above as it may produce shorter
  solutions, and it is easier to filter out duplicates (solutions that
  differ only by how they affect the E-layer).
