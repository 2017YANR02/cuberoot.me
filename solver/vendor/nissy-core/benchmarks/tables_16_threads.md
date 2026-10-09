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
