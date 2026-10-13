/* Bounded tests: no table file, H10 mapping, table generation, or solver call.
 * Synthetic bound fixtures check the actual patched pipeline control flow.
 * The cube-distance witnesses below enumerate at most two basic moves. */
#include <assert.h>
#include <stdio.h>
#include "engine.c"

static void set_pending(h48_prune_t prune[NMOVES]) {
    memset(prune, 0, sizeof(h48_prune_t) * NMOVES);
    for (unsigned i = 0; i < NMOVES; i++) prune[i].stop = 1;
    prune[MOVE_U].stop = prune[MOVE_R].stop = prune[MOVE_F].stop = 0;
}

static void test_strict_threshold_and_counters(void) {
    dfsarg_solve_h48_t arg = {
        .bpmx_enabled = true, .lb_normal = 3, .lb_inverse = 4,
        .movemask_normal = UINT64_C(0x1234), .movemask_inverse = UINT64_C(0x5678),
    };
    h48_prune_t prune[NMOVES];
    set_pending(prune);
    assert(!h48_bpmx_cut(&arg, prune, 8, 6, MOVE_U));
    assert(arg.bpmx_cuts == 0 && arg.bpmx_skipped == 0);
    assert(prune[MOVE_U].stop == 0);
    assert(h48_bpmx_cut(&arg, prune, 9, 6, MOVE_U));
    assert(arg.bpmx_cuts == 1 && arg.bpmx_skipped == 2);
    assert(prune[MOVE_U].stop == 1);
    assert(arg.lb_normal == 3 && arg.lb_inverse == 4);
    assert(arg.movemask_normal == UINT64_C(0x1234));
    assert(arg.movemask_inverse == UINT64_C(0x5678));
    arg.bpmx_enabled = false;
    set_pending(prune);
    assert(!h48_bpmx_cut(&arg, prune, UINT8_MAX, 0, MOVE_U));
    assert(arg.bpmx_cuts == 1 && arg.bpmx_skipped == 2);
    assert(prune[MOVE_U].stop == 0);
    arg.bpmx_enabled = true;
    assert(!h48_bpmx_cut(&arg, prune, UINT8_MAX, UINT8_MAX, MOVE_U));
}

static void test_actual_pipeline_cut(void) {
    /* Artificial cocsep lower bounds, deliberately not a generated table.
     * A cut must return in Stage 1 before touching the absent H48 mapping. */
    uint32_t *synthetic_cdata = malloc(COCSEP_TABLESIZE * sizeof *synthetic_cdata);
    assert(synthetic_cdata != NULL);
    for (size_t i = 0; i < COCSEP_TABLESIZE; i++) synthetic_cdata[i] = 9;
    dfsarg_solve_h48_t arg = {
        .cube = SOLVED_CUBE, .inverse = SOLVED_CUBE, .base = 10,
        .bpmx_enabled = true, .cocsepdata = synthetic_cdata,
        .movemask_normal = MM_SINGLE(MOVE_U) | MM_SINGLE(MOVE_R),
        .movemask_inverse = MM_SINGLE(MOVE_F) | MM_SINGLE(MOVE_L),
    };
    h48_prune_t prune[NMOVES];
    assert(h48_prune_pipeline(&arg, prune, 6, true));
    assert(arg.bpmx_cuts == 1 && arg.bpmx_skipped == 1);
    assert(h48_prune_pipeline(&arg, prune, 6, false));
    assert(arg.bpmx_cuts == 2 && arg.bpmx_skipped == 2);
    assert(equal(arg.cube, SOLVED_CUBE) && equal(arg.inverse, SOLVED_CUBE));
    assert(arg.lb_normal == 0 && arg.lb_inverse == 0);
    assert(arg.movemask_normal == (MM_SINGLE(MOVE_U) | MM_SINGLE(MOVE_R)));
    assert(arg.movemask_inverse == (MM_SINGLE(MOVE_F) | MM_SINGLE(MOVE_L)));
    arg.bpmx_enabled = false;
    assert(!h48_prune_pipeline(&arg, prune, 6, true));
    assert(arg.bpmx_cuts == 2 && arg.bpmx_skipped == 2);
    free(synthetic_cdata);
}

static bool within_two_moves(cube_t cube) {
    if (equal(cube, SOLVED_CUBE)) return true;
    for (uint8_t a = 0; a < NMOVES; a++) {
        cube_t first = move(SOLVED_CUBE, a);
        if (equal(cube, first)) return true;
        for (uint8_t b = 0; b < NMOVES; b++)
            if (equal(cube, move(first, b))) return true;
    }
    return false;
}

static void test_cube_adjacency_and_exact_small_witnesses(void) {
    const cube_t u = move(SOLVED_CUBE, MOVE_U);
    const cube_t ur = move(u, MOVE_R);
    const cube_t urf = move(ur, MOVE_F);
    assert(!equal(u, SOLVED_CUBE));
    assert(within_two_moves(ur));
    for (uint8_t m = 0; m < NMOVES; m++)
        assert(!equal(ur, move(SOLVED_CUBE, m)));
    assert(!within_two_moves(urf)); /* d(U R F)=3, while d(U R)=2. */
    assert(!within_two_moves(inverse(urf)));
    for (uint8_t m = 0; m < NMOVES; m++) {
        assert(equal(inverse(move(ur, m)), premove(inverse(ur), m)));
        assert(equal(inverse(premove(ur, m)), move(inverse(ur), m)));
    }

    dfsarg_solve_h48_t arg = {.bpmx_enabled = true};
    h48_prune_t prune[NMOVES];
    set_pending(prune);
    /* Parent U has distance 1 and budget 1 (target=0). Its neighbor U R
     * has distance 2. Equality bound=target+2 must NOT discard that parent. */
    assert(!h48_bpmx_cut(&arg, prune, 2, 0, MOVE_R));
    /* Parent U R has distance 2 and budget 1. Its neighbor U R F has
     * distance 3: bound>target+2 correctly proves the parent impossible. */
    assert(h48_bpmx_cut(&arg, prune, 3, 0, MOVE_F));
}

int main(void) {
    nissy_setlogger(NULL, NULL);
    assert(!atomic_load(&h48_bpmx_enabled));
    cuberoot_h48_bpmx_enable(true);
    assert(atomic_load(&h48_bpmx_enabled));
    cuberoot_h48_bpmx_enable(false);
    test_strict_threshold_and_counters();
    test_actual_pipeline_cut();
    test_cube_adjacency_and_exact_small_witnesses();
    puts("BPMX threshold, pipeline and bounded cube witnesses passed; H10 not loaded.");
    return 0;
}
