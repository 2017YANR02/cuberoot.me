# Benchmarks for the H48 optimal solver and comparison with vcube

This page contains some benchmarks for some of the possible
configurations of the H48 optimal solver. For comparison we also
include similar measurements for Andrew Skalski's impressive optimal
solver [vcube](https://github.com/Voltara/vcube), which has been taken
as a benchmark reference throughout the development of H48. The two
solvers differ both in method (although they both use an A* search)
and implementation.

Similar benchmarks can be found:

* In Chen Shuang's
  [dedicated github page](https://github.com/cs0x7f/cube_solver_test/wiki),
  which includes many more solvers. At the time of writing, the version
  of H48 used for these benchmarks is a rather old one. Note that
  cube48opt is a re-implementation of the H48 solver by Chen Shuang.
* In Enrico Tenuti's [thesis](https://github.com/enricotenuti/h48thesis),
  also using an old implementation of H48, but including more data and
  nice plots.

## Setting

*All movecounts are in Half Turn Metric*

For the benchmarks we used some sets of random positions that can be found
in `benchmarks/scrambles`. We divide them by optimal solution length,
because the time to solve a scramble grows exponentially on the number of
moves, so mixing up positions with long and short solutions is going to
make the shorter solution almost irrelevant. Even within the same solution
length the time to solve a random position can vary significantly,
so we have used sets of 25 scrambles and taken the average of those,
except for the [Superflip](https://en.wikipedia.org/wiki/Superflip),
which is a single scramble.

For short solutions, the very low numbers we get with the largest solver
may be particularly inaccurate, because writing the solution (together
with some log messages) to standard output may take a significant portion
of the time, depending on the terminal emulator used and other factors.

All benchmark tests were done on the following configuration:

* CPU: AMD Ryzen 7 7700 (8 cores, 16 virtual threads)
* Memory: 2x Corsair Vengeance 32GB 5600MHz
* Motherboard: Gigabyte B650M K
* Operating system: Debian 13 (Linux kernel 6.12.57)
* Compiler: GCC 14.2.0 for H48 and Clang 19.1.7 for vcube

## Benchmark results

### Single solution, single thread

The first test we performed was finding a single optimal solution, and
we compared the results with vcube.

This test was run in a single-thread configuration, because the two
solvers use very different strategies for multithreading: vcube can only
parallelize by solving one cube per thread, while H48 is able to take
advantage of multiple threads even when solving a single cube. Therefore
we prefer to compare their single-threaded performance only.

Since the size of the pruning table used by the solver is of utmost
importance, we include two statistics: time per cube and time per cube
*adjusted by table size*.  The adjustment we took simply consists in
multiplying the time per cube by the size of the table. Empirically this
leads to more even results across the board, although the speed of the
solvers of the same family does not scale exactly linearly with the size
of the pruning table.

<!-- The following details block can be found in benchmarks/single_thread_comparison.md -->
<details><summary>Results: Single solution, single thread</summary>

Time per cube (in seconds, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|vcube 212 |58.2 GiB|    0.11|    0.75|    3.43|   27.28|    19.30|
|H48 h11   |56.5 GiB|    0.09|    0.50|    2.24|   15.73|    15.55|
|vcube 404 |31.8 GiB|    0.23|    1.24|    6.10|   59.33|   268.26|
|H48 h10   |28.3 GiB|    0.15|    0.76|    3.36|   23.51|    38.05|
|vcube 308 |21.2 GiB|    0.17|    1.02|    6.20|   58.70|   604.35|
|H48 h9    |14.1 GiB|    0.24|    1.48|    6.69|        |         |
|vcube 208 | 7.3 GiB|    0.56|    4.36|   20.58|        |         |
|H48 h8    | 7.1 GiB|    0.46|    3.36|   14.13|        |         |
|H48 h7    | 3.5 GiB|    0.63|    4.85|   23.25|        |         |
|vcube 112 | 2.4 GiB|    0.96|    9.29|   40.52|        |         |
|H48 h6    | 1.8 GiB|    1.25|    9.45|   46.31|        |         |

Time per cube adjusted for table size (in seconds \* GiB, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|vcube 212 |58.2 GiB|    6.43|   43.80|  199.38| 1587.43|  1122.73|
|H48 h11   |56.5 GiB|    5.21|   28.28|  126.68|  889.01|   878.77|
|vcube 404 |31.8 GiB|    7.40|   39.47|  194.01| 1887.94|  8535.87|
|H48 h10   |28.3 GiB|    4.22|   21.37|   94.86|  664.22|  1075.08|
|vcube 308 |21.2 GiB|    3.51|   21.71|  131.50| 1245.26| 12819.94|
|H48 h9    |14.1 GiB|    3.34|   20.97|   94.57|        |         |
|vcube 208 | 7.3 GiB|    4.08|   31.74|  149.68|        |         |
|H48 h8    | 7.1 GiB|    3.25|   23.75|   99.82|        |         |
|H48 h7    | 3.5 GiB|    2.22|   17.12|   82.14|        |         |
|vcube 112 | 2.4 GiB|    2.33|   22.53|   98.23|        |         |
|H48 h6    | 1.8 GiB|    2.21|   16.70|   81.86|        |         |

<img src="img/17moves1thread.png">
<img src="img/18moves1thread.png">
<img src="img/19moves1thread.png">
<img src="img/20moves1thread.png">
</details>

As we can see, adjusting for table size, H48 is generally faster than
vcube.  The gap between the two solvers is larger for scrambles with
longer optimal solutions.

### Single solution, multiple threads

The same benchmark as before is repeated using 4 and 16 threads (recall
that the CPU used for these tests has 8 physical cores and 16 virtual
threads).

As mentioned above, we don't compare these results to vcube. Instead,
we compare them with the single-threaded results for H48 and we show
how far the speedup factor is from a theoretically optimal 4x and 16x.

<!-- The following details block can be found in benchmarks/tables_4_threads.md -->
<details><summary>Results: Single solution, 4 threads</summary>

Time per cube (in seconds, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    0.04|    0.14|    0.60|    3.97|     4.19|
|H48 h10   |28.3 GiB|    0.05|    0.20|    0.91|    6.65|     9.81|
|H48 h9    |14.1 GiB|    0.07|    0.39|    1.74|   12.54|    18.96|
|H48 h8    | 7.1 GiB|    0.13|    0.90|    3.71|        |         |
|H48 h7    | 3.5 GiB|    0.17|    1.28|    6.12|        |         |
|H48 h6    | 1.8 GiB|    0.33|    2.47|   12.22|        |         |

Speed-up factor (higher is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    2.55|    3.46|    3.75|    3.96|     3.71|
|H48 h10   |28.3 GiB|    3.09|    3.71|    3.67|    3.54|     3.88|
|H48 h9    |14.1 GiB|    3.25|    3.84|    3.85|        |         |
|H48 h8    | 7.1 GiB|    3.53|    3.72|    3.81|        |         |
|H48 h7    | 3.5 GiB|    3.60|    3.78|    3.80|        |         |
|H48 h6    | 1.8 GiB|    3.77|    3.82|    3.79|        |         |

<img src="img/4threadsspeedupfactor.png">

</details>

<!-- The following details block can be found in benchmarks/tables_16_threads.md -->
<details><summary>Results: Single solution, 16 threads</summary>

Time per cube (in seconds, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    0.02|    0.06|    0.22|    1.33|     1.84|
|H48 h10   |28.3 GiB|    0.03|    0.08|    0.33|    2.34|     4.18|
|H48 h9    |14.1 GiB|    0.04|    0.15|    0.64|    4.45|     8.09|
|H48 h8    | 7.1 GiB|    0.06|    0.34|    1.36|        |         |
|H48 h7    | 3.5 GiB|    0.07|    0.47|    2.20|        |         |
|H48 h6    | 1.8 GiB|    0.13|    0.91|    4.39|        |         |

Speed-up factor (higher is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    3.90|    8.14|   10.39|   11.86|     8.45|
|H48 h10   |28.3 GiB|    5.72|    9.00|   10.03|   10.04|     9.09|
|H48 h9    |14.1 GiB|    6.56|    9.75|   10.53|        |         |
|H48 h8    | 7.1 GiB|    8.08|    9.91|   10.40|        |         |
|H48 h7    | 3.5 GiB|    8.59|   10.30|   10.57|        |         |
|H48 h6    | 1.8 GiB|    9.60|   10.39|   10.54|        |         |

<img src="img/16threadsspeedupfactor.png">

</details>

We can see that H48 scales pretty well with 4 threads, getting close
to the 4x theoretical maximum speedup in slower cases (small table or
long solutions).

In the 16 threads benchmark shows that, although the virtual threads
help push us beyond the 8x theoretical speedup that would be provided
by the 8 cores, we are nowhere near a 16x speedup.

### All solutions

Finally, we ran a test on finding *all* optimal solutions which, as
far as I know, is a use case not supported by vcube. For convenience,
this test is only run on 16 threads.

<!-- The following details block can be found in benchmarks/all_solutions.md -->
<details><summary>Results: All solutions (16 threads)</summary>

Time per cube (in seconds, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    0.04|    0.26|    2.22|   18.96|    16.95|
|H48 h10   |28.3 GiB|    0.05|    0.42|    3.82|   34.42|    36.80|
|H48 h9    |14.1 GiB|    0.08|    0.73|    7.28|        |         |
|H48 h8    | 7.1 GiB|    0.15|    1.56|   15.41|        |         |
|H48 h7    | 3.5 GiB|    0.21|    2.38|   26.52|        |         |
|H48 h6    | 1.8 GiB|    0.39|    4.67|   53.00|        |         |

Time per cube adjusted for table size (in seconds \* GiB, lower is better).

|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|
|:---------|:-------|-------:|-------:|-------:|-------:|--------:|
|H48 h11   |56.5 GiB|    2.11|   14.55|  125.21| 1071.23|   957.47|
|H48 h10   |28.3 GiB|    1.48|   11.96|  107.83|  972.35|  1039.73|
|H48 h9    |14.1 GiB|    1.08|   10.29|  102.88|        |         |
|H48 h8    | 7.1 GiB|    1.03|   10.99|  108.87|        |         |
|H48 h7    | 3.5 GiB|    0.74|    8.41|   93.69|        |         |
|H48 h6    | 1.8 GiB|    0.70|    8.25|   93.68|        |         |

</details>

## Other notes

* To repeat the benchmarks, use `./benchmarks/run-h48-benchmarks.sh`.
* All the measurements above exclude the time needed to load the pruning
  tables into memory, which can be quite significant for large tables.
* The measurements also excluded the one-off computation of the pruning
  tables which, for reasons related to the cube coordinates used, is
  significantly slower for H48 compared to vcube.
* H48's and vcube's approach to multithreading are extremely different:
  H48 parallelize the search for each cube individually, vcube solves
  multiple cubes in parallel by dedicating a single thread to each of
  them. Both apporaches have pros and cons: vcube's approch has less
  overhead in coordination between the threads, but often some threads
  may be left without work when there are no more cubes left to solve.
* Per-cube parallelization means that H48 will always be faster than
  vcube when solving a single cube.
* vcube only supports x86 processors (Intel, AMD), while H48 runs on any
  architecture, including e.g. ARM (Macbook M series, android phones)
  and can be compiled to WebAssembly as well.
* For H48, both GCC and Clang have been tried, with the same options;
  the resulting executable was about 10% faster with GCC compared to Clang.
  vcube only supports compiling with Clang.
