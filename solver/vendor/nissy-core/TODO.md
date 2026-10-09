# Ideas, improvements, things that I may never do...

This document contains a list of ideas for possible new features or
improvements to nissy-core. This file used to be private, but it makes
more sense to have it public, in case someone else wants to contribute.

## Priorities

Items in this section are what I consider top priorities. They enable or
simplify using nissy-core as a library inside other projects.

### Python packaging and distribution

Make a [PyPI](https://pypi.org/) package for nissy-core. There is already
a Python module in the `python/` folder, and it builds both on UNIX and on
Windows, so this should not require too much work. It is also possible to
make this process automatic using GitHub actions or something similar.

The documentation of the Python module should also be improved.

### WASM interface improvements

Currently there is a proof-of-concept web version for the H48 optimal
solver (see [h48.tronto.net](https://h48.tronto.net) - it is based on
a very old version of the solver). This needs some polishing, namely:

* The main thing we want to do is enabling downloading the pruning tables
in small pieces and show a progress bar of some sort. The best way to do
this would probably be handling all the data storage logic in JavaScript
code (`http/worker.mjs`) rather than in C++ (`storage.cpp`). With this,
we should also be able to remove the `-sASYNCIFY` and `-sFETCH` options
from the Emscripten build command.
* Table generation can be removed from the web version.
* Logging can also be simplified by just using `console.log`. We will then
loose the ability to show the log pane in the HTML page, but this is not
very interesting to the user. If future applications based on nissy-core
want to notify the user of the status of the solver, we can handle this
later with callback parameters to the solve function.
* For now it is fine to stick to 32-bit WASM and limit ourselves to 1.8GB
tables at most.

If possible, it would be nice to publish a nissy-core package on
[NPM](https://www.npmjs.com/).

### Improved documentation

Currently, there is documentation in multiple places, like the `doc/`
folder and the `nissy.h` header. This documentation should be expanded
into a sort of "developer guide" for contributing to the project.
Some critical parts of the code base could also be better commented.

For example, a list of instructions for implementing a new solver can
be useful.

## Turning this into a usable application

There are at least three ways to turn this into a useful tool for FMC
training.  I don't know if I want to work on any of these in the near
future - they are all up for grabs!

### CLI application

The easiest interface to make for nissy-core is a command line
one. This can be done be either improving on the shell in this
repository (see `shell/`), or by plugging this library into the old
[nissy](https://nissy.tronto.net). In either case, the result would not
be much different from the latest version of nissy-classic: there would
be a faster optimal solver, but some other features may be missing.

### Desktop application

It is easy to use nissy-core as a library in a C or C++ based
application.  I have some examples using the QT framework in
[qt-experiments](https://github.com/sebastianotronto/qt-experiments)
(note: the examples there are based on a very old version of nissy-core).

Distribution could be a bit of a pain, especially for Linux. That's why
I would personally prefer making a TUI-based application. For example,
[termbox2](https://github.com/termbox/termbox2) could be a good library
for this, if they implement Windows support.

Yet another option is using Python (for example with QT, via
[PySide6](https://doc.qt.io/qtforpython-6/)).

### Web application

Since nissy-core builds to WebAssembly, it is possible to use it as a
library for a WebApp. This would run entirely in the user's browser,
like [h48.tronto.net](https://h4.tronto.net).

It would also be nice to turn it into an installable PWA, see [this
repository](https://github.com/chr15m/minimal-pwa) for a minimal example.

## Additional features

Possible new features for nissy.

### Additional solvers

More solvers, or options for current solvers, can be added:

* Finish from HTR. This is available in nissy-classic and it is not hard
  to implement.
* Direct HTR, without having DR or EO. This can be useful for finding HTR
  trigger that break DR. The pruning table for this one is too big, but
  we can take advantage of the H48 tables.
* Floppy reduction.
* JZP / Axial reduction, from EO or direct.
* Slice solver, using
  [VR](https://www.youtube.com/watch?v=8SHjQtvuz5Q&list=PL0DmWpJUeHN-o0OKYhDe7w8O6GahIvOtx&index=2).
* Finish / leave double slice from JZP. This is a different type of solver,
  because we want to look from both sides for increasingly long solutions
  and meet in the middle. Similarly, we may also want to implement a
  "leave double slice" and a "solve double slice" steps.
* Finish / HTR / JZP finish / leave slice etc... with minimal number of
  quarter turns.

### Coordinate solvers improvements

The coordinate solvers do not support pause / resume / stop via callback
function. This is not too hard to add (just copy what the H48 solver is doing),
but also not too useful, as coordinate solvers are generally very fast.

## Performance improvements

I have worked a lot on performance, but some things can still be improved.

### H48 performance improvements

The only idea I have left for improving the performance of the H48 optimal
solver is implementing *microthreading*. This means making the main
solve DFS iterative, and working on multiple DFS branches at the same
time on the same physical thread. The end goal is taking advantage of
[prefetching](https://sebastiano.tronto.net/blog/2026-01-28-prefetch/)
even further.

### Coordinate solvers

Neither the solve algorithm nor the pruning table generation for
coordinate solver is parallelized. It should not be hard to do (just
copy what is done for the H48 optimal solver), but coordinate solvers
are generally small and fast.  Parallelized pruning table generation
could save some time though.

### Cube analysis

A new API function can be added to analyze a given cube position.
Example of analysis are:

* HTR state. Should return a short name for the HTR case.
* EO state (no NISS). First a nomenclature for EO cases should be defined.
* ARM subsets.
* VR case.

## Technical improvements

I lumped together here a bunch of possible improvements that would not
affect the use of the library much, but can still be useful or interesting
for developers.

### On-line (internal) documentation

Currently the only way to know which solvers are available is reading the
`doc/solver.md` page. There should be an API function to list available
solvers. Same thing for variations.

In general, there should be more documentation available from within
the library itself.

### Python pause / stop / resume

The pause / stop / resume via callback functionality for the H48 optimal
solver is not supported in the Python module. I tried to make it to work,
but I had some issues which I suspect were related to the GIL and the
fact the the solver is multi-threaded.  However, I get the exact same
issues with no-GIL versions of Python.

I have tried calling the callback function from within an `ALLOW_THREADS`
block, but I get a segfault. If I remove the `ALLOW_THREADS` blocks,
the program hangs indefinitely.

Good luck debugging this.

### Better Windows development support

The build script for Windows has fewer options than the UNIX one. For
example, to configure the maximum number of threads a developer would
have to manually edit the build script.

I'll leave this one to anyone who actually wants to work on nissy-core
from Windows.
