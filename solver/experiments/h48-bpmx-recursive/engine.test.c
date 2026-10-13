/* Low-memory proof-boundary checks only: no H10, generated table or solve.
 * Artificial cocsep bounds exercise actual DFS restoration. */
#include <assert.h>
#include <stdio.h>
#include "engine.c"

static void set_pending(h48_prune_t prune[NMOVES]) {
    memset(prune, 0, sizeof(h48_prune_t) * NMOVES);
    for (unsigned i = 0; i < NMOVES; i++) prune[i].stop = 1;
    prune[MOVE_U].stop = prune[MOVE_R].stop = prune[MOVE_F].stop = 0;
}

static void test_local_and_recursive_thresholds(void) {
    dfsarg_solve_h48_t arg = {.bpmx_enabled = true};
    h48_prune_t prune[NMOVES];
    uint8_t bound = 0;
    set_pending(prune);
    assert(!h48_bpmx_cut(&arg, prune, 8, 6, MOVE_U, &bound));
    assert(bound == 7); /* Retain evidence even without an immediate cut. */
    assert(h48_bpmx_cut(&arg, prune, 9, 6, MOVE_U, &bound));
    assert(bound == 8 && arg.bpmx_cuts == 1 && arg.bpmx_skipped == 2);
    assert(arg.bpmx_recursive_cuts == 0);

    /* The same witness travels several levels, losing exactly one per edge. */
    uint8_t parent = 0;
    set_pending(prune);
    assert(h48_bpmx_propagate(&arg, prune, bound, 3, 0, &parent));
    assert(parent == 7);
    bound = parent; parent = 0;
    assert(h48_bpmx_propagate(&arg, prune, bound, 4, 0, &parent));
    assert(parent == 6);
    bound = parent; parent = 0;
    assert(!h48_bpmx_propagate(&arg, prune, bound, 5, 0, &parent));
    assert(parent == 5); /* Equality cannot prove the ancestor impossible. */
    assert(arg.bpmx_recursive_cuts == 2 && arg.bpmx_cuts == 3);
    parent = 0;
    assert(!h48_bpmx_propagate(&arg, prune, 0, 0, 0, &parent));
    assert(parent == 0); /* No unsigned underflow from absent evidence. */
    assert(!h48_bpmx_propagate(&arg, prune, 1, 0, 0, &parent));
    assert(parent == 0);

    arg.bpmx_enabled = false;
    assert(!h48_bpmx_cut(&arg, prune, UINT8_MAX, 0, MOVE_U, &parent));
    assert(!h48_bpmx_propagate(&arg, prune, UINT8_MAX, 0, 0, &parent));
    assert(parent == 0 && arg.bpmx_cuts == 3);
}

static void test_dfs_restoration_and_early_exit_evidence(void) {
    uint32_t *synthetic = malloc(COCSEP_TABLESIZE * sizeof *synthetic);
    assert(synthetic != NULL);
    for (size_t i = 0; i < COCSEP_TABLESIZE; i++) synthetic[i] = 9;
    solution_moves_t moves;
    solution_moves_reset(&moves);
    moves.nmoves = 4;
    moves.npremoves = 1;
    solution_settings_t settings = {.maxsolutions = 1};
    solution_list_t solutions = {0};
    const cube_t state = move(move(SOLVED_CUBE, MOVE_U), MOVE_R);
    dfsarg_solve_h48_t arg = {
        .cube = state, .inverse = inverse(state), .target_depth = 7, .base = 10,
        .bpmx_enabled = true, .cocsepdata = synthetic,
        .solution_moves = &moves, .solution_settings = &settings,
        .solution_list = &solutions, .lb_normal = 2, .lb_inverse = 3,
        .movemask_normal = MM_SINGLE(MOVE_U),
        .movemask_inverse = MM_SINGLE(MOVE_R) | MM_SINGLE(MOVE_F),
    };
    const cube_t saved_inverse = arg.inverse;
    uint8_t bound = UINT8_MAX;
    assert(solve_h48_dfs(&arg, &bound) == 0);
    assert(bound == 8 && arg.bpmx_cuts == 1);
    assert(equal(arg.cube, state) && equal(arg.inverse, saved_inverse));
    assert(moves.nmoves == 4 && moves.npremoves == 1);
    assert(arg.lb_normal == 2 && arg.lb_inverse == 3);
    assert(arg.movemask_normal == MM_SINGLE(MOVE_U));
    assert(arg.movemask_inverse == (MM_SINGLE(MOVE_R) | MM_SINGLE(MOVE_F)));

    /* Force inverse expansion and verify the same cleanup contract. */
    arg.movemask_normal = MM_SINGLE(MOVE_U) | MM_SINGLE(MOVE_L);
    arg.movemask_inverse = MM_SINGLE(MOVE_R);
    assert(solve_h48_dfs(&arg, &bound) == 0);
    assert(bound == 8 && arg.bpmx_cuts == 2);
    assert(equal(arg.cube, state) && equal(arg.inverse, saved_inverse));
    assert(moves.nmoves == 4 && moves.npremoves == 1);
    assert(arg.lb_normal == 2 && arg.lb_inverse == 3);
    assert(arg.movemask_normal == (MM_SINGLE(MOVE_U) | MM_SINGLE(MOVE_L)));
    assert(arg.movemask_inverse == MM_SINGLE(MOVE_R));

    solutions.nsols = 1; bound = UINT8_MAX;
    assert(solve_h48_dfs(&arg, &bound) == 0 && bound == 0);
    solutions.nsols = 0; arg.cube = SOLVED_CUBE; bound = UINT8_MAX;
    assert(solve_h48_dfs(&arg, &bound) == 0 && bound == 0);
    assert(arg.bpmx_cuts == 2);
    free(synthetic);
}

static void test_child_dfs_returns_bound_to_ancestor(bool inverse_root) {
    /* A synthetic class-0 h0 table needs only 137 cache lines. Every packed
     * value is 1, so no lookup can enter the absent fallback table. These
     * artificial distances exercise control flow, not table correctness. */
    const size_t main_bytes = H48_LINE_BYTES *
        DIV_ROUND_UP(ESEP_MAX, H48_LINE_COORDS);
    unsigned char *main_table = malloc(main_bytes);
    uint32_t *cdata = calloc(COCSEP_TABLESIZE, sizeof *cdata);
    assert(main_table != NULL && cdata != NULL);
    memset(main_table, 0x55, main_bytes);

    const cube_t root = move(move(move(SOLVED_CUBE, MOVE_U), MOVE_R), MOVE_F);
    const uint8_t root_moves[] = {MOVE_U, MOVE_D};
    const uint8_t child_moves[] = {MOVE_R, MOVE_L, MOVE_F, MOVE_B};
    uint64_t root_neighbor_coords[4];
    for (unsigned i = 0; i < 2; i++) {
        const cube_t child = inverse_root ? premove(root, root_moves[i]) :
            move(root, root_moves[i]);
        root_neighbor_coords[2 * i] = coord_cocsep(child);
        root_neighbor_coords[2 * i + 1] = coord_cocsep(inverse(child));
    }
    const cube_t first_child = inverse_root ? premove(root, MOVE_U) :
        move(root, MOVE_U);
    /* The first child selects the opposite search direction because its
     * newly assigned allowedmask is wider than the retained four moves. */
    const cube_t grandchild_inverse_source = inverse_root ?
        inverse(first_child) : first_child;
    bool found_witness = false;
    for (unsigned i = 0; i < 4 && !found_witness; i++) {
        const uint64_t witness = coord_cocsep(
            premove(grandchild_inverse_source, child_moves[i]));
        bool collides = false;
        for (unsigned j = 0; j < 4; j++)
            collides = collides || witness == root_neighbor_coords[j];
        if (!collides) {
            cdata[witness] = 9;
            found_witness = true;
        }
    }
    assert(found_witness);

    const uint64_t narrow = MM_SINGLE(MOVE_U) | MM_SINGLE(MOVE_D);
    const uint64_t wide = MM_SINGLE(MOVE_R) | MM_SINGLE(MOVE_L) |
        MM_SINGLE(MOVE_F) | MM_SINGLE(MOVE_B);
    solution_moves_t moves;
    solution_moves_reset(&moves);
    moves.nmoves = 4;
    moves.npremoves = 1;
    solution_settings_t settings = {.maxsolutions = 1};
    solution_list_t solutions = {0};
    dfsarg_solve_h48_t arg = {
        .cube = root, .inverse = inverse(root), .target_depth = 8,
        .h = 0, .base = 0, .bpmx_enabled = true,
        .cocsepdata = cdata, .h48data = main_table,
        .solution_moves = &moves, .solution_settings = &settings,
        .solution_list = &solutions, .lb_normal = 2, .lb_inverse = 3,
        .movemask_normal = inverse_root ? wide : narrow,
        .movemask_inverse = inverse_root ? narrow : wide,
    };

    /* Prove this fixture cannot cut at the root's pipeline: both direct
     * children survive with pn=pi=1 and no generic parent evidence. */
    dfsarg_solve_h48_t probe = arg;
    h48_prune_t neighbors[NMOVES];
    uint8_t direct_bound = 0;
    assert(!h48_prune_pipeline(&probe, neighbors, 2, !inverse_root, &direct_bound));
    assert(direct_bound == 0 && probe.bpmx_cuts == 0);
    for (unsigned i = 0; i < 2; i++) {
        assert(!neighbors[root_moves[i]].stop);
        assert(neighbors[root_moves[i]].pn == 1);
        assert(neighbors[root_moves[i]].pi == 1);
    }
    assert(probe.table_lookups == 4 && probe.table_fallbacks == 0);

    const cube_t saved_inverse = arg.inverse;
    uint8_t returned_bound = 0;
    assert(solve_h48_dfs(&arg, &returned_bound) == 0);
    /* Grandchild raw 9 -> child bound 8 -> root bound 7. This can only
     * reach the root through the actual recursive return/cleanup path. */
    assert(returned_bound == 7);
    assert(arg.bpmx_recursive_cuts == 1 && arg.bpmx_cuts == 2);
    assert(arg.bpmx_skipped == 4); /* Three child neighbors + second root child. */
    assert(arg.nodes_visited == 6 && arg.table_lookups == 4);
    assert(arg.table_fallbacks == 0);
    assert(equal(arg.cube, root) && equal(arg.inverse, saved_inverse));
    assert(moves.nmoves == 4 && moves.npremoves == 1);
    assert(arg.lb_normal == 2 && arg.lb_inverse == 3);
    assert(arg.movemask_normal == (inverse_root ? wide : narrow));
    assert(arg.movemask_inverse == (inverse_root ? narrow : wide));
    free(cdata);
    free(main_table);
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

static void test_real_cube_word_metric(void) {
    const cube_t ur = move(move(SOLVED_CUBE, MOVE_U), MOVE_R);
    const cube_t urf = move(ur, MOVE_F);
    assert(within_two_moves(ur));
    for (uint8_t m = 0; m < NMOVES; m++) {
        assert(!equal(ur, move(SOLVED_CUBE, m)));
        assert(equal(inverse(move(ur, m)), premove(inverse(ur), m)));
        assert(equal(inverse(premove(ur, m)), move(inverse(ur), m)));
    }
    assert(!within_two_moves(urf) && !within_two_moves(inverse(urf)));
    /* Exact child distance 3 yields parent lower bound 2, then ancestor 1.
     * Neither may be cut when its remaining budget equals that bound. */
    dfsarg_solve_h48_t arg = {.bpmx_enabled = true};
    h48_prune_t prune[NMOVES]; set_pending(prune);
    uint8_t bound = 0, ancestor = 0;
    assert(!h48_bpmx_propagate(&arg, prune, 3, 2, 0, &bound));
    assert(bound == 2);
    assert(!h48_bpmx_propagate(&arg, prune, bound, 1, 0, &ancestor));
    assert(ancestor == 1);
}

int main(void) {
    nissy_setlogger(NULL, NULL);
    assert(!atomic_load(&h48_bpmx_enabled));
    cuberoot_h48_bpmx_enable(true);
    assert(atomic_load(&h48_bpmx_enabled));
    cuberoot_h48_bpmx_enable(false);
    test_local_and_recursive_thresholds();
    test_dfs_restoration_and_early_exit_evidence();
    test_child_dfs_returns_bound_to_ancestor(false);
    test_child_dfs_returns_bound_to_ancestor(true);
    test_real_cube_word_metric();
    puts("Recursive BPMX proof-boundary checks passed; H10 not loaded.");
    return 0;
}
