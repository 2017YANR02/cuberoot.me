/* Fixed low-memory measurement-boundary check. Artificial pruning values
 * exercise task creation and the worker's pre-DFS skip; no H10 or search.
 * Compile against any candidate plus deterministic.patch, or that patch alone. */
#include <assert.h>
#include <stdio.h>
#include "nissy.c"

static void test_skipped_task_rank(void) {
    uint32_t *cocsep = calloc(COCSEP_TABLESIZE, sizeof *cocsep);
    /* The fixture maps every corner state to class 0, transform 0. Only one
     * edge-separation class block is addressed at h=0 (under 9 KB). */
    const size_t bytes = H48_LINE_BYTES * DIV_ROUND_UP(ESEP_MAX, H48_LINE_COORDS);
    unsigned char *pruning = malloc(bytes);
    solve_h48_task_t *tasks = malloc(H48_STARTING_CUBES * sizeof *tasks);
    assert(cocsep != NULL && pruning != NULL && tasks != NULL);
    memset(pruning, 0x55, bytes); /* Every two-bit entry is 1; no fallback. */
    solution_moves_t moves;
    solution_moves_reset(&moves);
    wrapthread_atomic int status = NISSY_STATUS_RUN;
    dfsarg_solve_h48_t arg = {
        .start_cube = SOLVED_CUBE, .h = 0, .base = 10,
        .cocsepdata = cocsep, .h48data = pruning,
        .tasks = tasks, .threads = 1, .thread_id = 0, .status = &status,
        .solution_moves = &moves, .target_depth = 14,
    };
    dfsarg_solve_h48_maketasks_t mtarg = {
        .nmoves = H48_STARTING_MOVES,
        .moves = {MOVE_U, MOVE_R, MOVE_F, MOVE_L},
    };
    int ntasks = 0;
    for (unsigned i = 0; i < 2; i++) {
        mtarg.moves[3] = i == 0 ? MOVE_L : MOVE_B;
        mtarg.cube = SOLVED_CUBE;
        for (unsigned m = 0; m < H48_STARTING_MOVES; m++)
            mtarg.cube = move(mtarg.cube, mtarg.moves[m]);
        assert(!equal(mtarg.cube, SOLVED_CUBE));
        tasks[i].rank = INT64_MAX; /* Detect a missing write deterministically. */
        assert(solve_h48_maketasks(&arg, &mtarg, tasks, &ntasks) == NISSY_OK);
        assert(ntasks == (int)i + 1);
        assert(tasks[i].rank == 0 && tasks[i].pval == 11);
        assert(memcmp(tasks[i].moves, mtarg.moves, H48_STARTING_MOVES) == 0);
        assert(tasks[i].pval + H48_STARTING_MOVES > arg.target_depth);
    }
    arg.ntasks = ntasks;
    solve_h48_runthread(&arg); /* Both tasks leave via the pre-DFS continue. */
    assert(arg.thread_done && arg.nodes_visited == 2);
    assert(arg.table_lookups == 2 && arg.table_fallbacks == 0);
    assert(tasks[0].rank == 0 && tasks[1].rank == 0);
    free(tasks);
    free(pruning);
    free(cocsep);
}

static void test_rank_and_prefix_total_order(void) {
    /* Expected descending rank, then ascending four-byte prefix. Adjacent
     * equal-rank cases distinguish every prefix position. */
    const solve_h48_task_t ordered[] = {
        {.rank = INT64_MAX, .moves = {17, 17, 17, 17}},
        {.rank = 0, .moves = {0, 0, 0, 0}},
        {.rank = 0, .moves = {0, 0, 0, 1}},
        {.rank = 0, .moves = {0, 0, 1, 0}},
        {.rank = 0, .moves = {0, 1, 0, 0}},
        {.rank = 0, .moves = {1, 0, 0, 0}},
        {.rank = INT64_MIN, .moves = {0, 0, 0, 0}},
    };
    const size_t count = sizeof ordered / sizeof ordered[0];
    solve_h48_task_t shuffled[sizeof ordered / sizeof ordered[0]];
    for (size_t i = 0; i < count; i++) {
        assert(solve_h48_compare_tasks(&ordered[i], &ordered[i]) == 0);
        for (size_t j = i + 1; j < count; j++) {
            assert(solve_h48_compare_tasks(&ordered[i], &ordered[j]) < 0);
            assert(solve_h48_compare_tasks(&ordered[j], &ordered[i]) > 0);
        }
    }
    /* All cyclic input orders plus reversed order must produce the same keys. */
    for (size_t offset = 0; offset <= count; offset++) {
        for (size_t i = 0; i < count; i++)
            shuffled[i] = ordered[offset == count ? count - 1 - i : (i + offset) % count];
        qsort(shuffled, count, sizeof shuffled[0], solve_h48_compare_tasks);
        for (size_t i = 0; i < count; i++) {
            assert(shuffled[i].rank == ordered[i].rank);
            assert(memcmp(shuffled[i].moves, ordered[i].moves, H48_STARTING_MOVES) == 0);
        }
    }
}

int main(void) {
    nissy_setlogger(NULL, NULL);
    test_skipped_task_rank();
    test_rank_and_prefix_total_order();
    puts("H48 task-rank initialization and deterministic ordering passed; H10 not loaded.");
    return 0;
}
