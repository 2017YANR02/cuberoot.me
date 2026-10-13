/* Collector/control-flow tests only. No H10 mapping or nissy_solve call. */
#include <assert.h>
#include "engine.c"

static void test_siphash_vectors(void) {
    /* veorq/SipHash vectors.h: key bytes 00..0f, message bytes 00..3f. */
    unsigned char input[64];
    for (unsigned i = 0; i < 64; i++) input[i] = (unsigned char)i;
    const uint64_t k0 = UINT64_C(0x0706050403020100);
    const uint64_t k1 = UINT64_C(0x0f0e0d0c0b0a0908);
    assert(survivor_siphash24(input, 0, k0, k1) == UINT64_C(0x726fdb47dd0e0e31));
    assert(survivor_siphash24(input, 8, k0, k1) == UINT64_C(0x93f5f5799a932462));
    assert(survivor_siphash24(input, 15, k0, k1) == UINT64_C(0xa129ca6149be45e5));
    assert(survivor_siphash24(input, 24, k0, k1) == UINT64_C(0xb8ad50c6f649af94));
}

static void test_full_state_bottomk_order_and_repeated_visits(void) {
    cuberoot_h48_survivor_collector *a = cuberoot_h48_survivor_create(20261012, 4);
    cuberoot_h48_survivor_collector *b = cuberoot_h48_survivor_create(20261012, 4);
    assert(a != NULL && b != NULL);
    assert(cuberoot_h48_survivor_set_case(a, "first") == NISSY_OK);
    assert(cuberoot_h48_survivor_set_case(b, "reverse") == NISSY_OK);
    for (unsigned r = 10; r <= 12; r++) {
        for (uint8_t m = 0; m < NMOVES; m++)
            survivor_capture(move(SOLVED_CUBE, m), r, 8, 9, a);
        for (unsigned m = NMOVES; m-- > 0;)
            survivor_capture(move(SOLVED_CUBE, (uint8_t)m), r, 8, 9, b);
    }
    assert(cuberoot_h48_survivor_set_case(a, "later") == NISSY_OK);
    for (unsigned r = 10; r <= 12; r++) {
        for (uint8_t m = 0; m < NMOVES; m++)
            survivor_capture(move(SOLVED_CUBE, m), r, 1, 2, a);
        cuberoot_h48_survivor_layer_stats stats;
        assert(cuberoot_h48_survivor_get_layer_stats(a, r, &stats) == NISSY_OK);
        assert(stats.seen_total == 2 * NMOVES && stats.retained == 4);
        for (size_t i = 0; i < 4; i++) {
            cuberoot_h48_survivor_sample x, y;
            assert(cuberoot_h48_survivor_get_sample(a, r, i, &x) == NISSY_OK);
            assert(cuberoot_h48_survivor_get_sample(b, r, i, &y) == NISSY_OK);
            assert(!strcmp(x.cube, y.cube) && x.priority == y.priority);
            assert(!strcmp(x.case_id, "first") && x.lb_normal == 8 && x.lb_inverse == 9);
            assert(strlen(x.cube) == 23 && x.cube[22] == 'A');
            const oriented_cube_t restored = readcube(x.cube);
            assert(isconsistent(restored) && issolvable(restored));
            assert(restored.orientation == ORIENTATION_UF);
            for (size_t j = 0; j < i; j++) {
                cuberoot_h48_survivor_sample previous;
                assert(cuberoot_h48_survivor_get_sample(a, r, j, &previous) == NISSY_OK);
                assert(strcmp(previous.cube, x.cube));
                assert(survivor_compare(&previous, &x) < 0);
            }
        }
    }
    cuberoot_h48_survivor_free(a);
    cuberoot_h48_survivor_free(b);
}

static void test_priority_collision_tie_break(void) {
    cuberoot_h48_survivor_collector *collector = cuberoot_h48_survivor_create(1, 2);
    assert(collector != NULL);
    cuberoot_h48_survivor_sample samples[3] = {0};
    const uint8_t moves[] = {MOVE_U, MOVE_R, MOVE_F};
    for (unsigned i = 0; i < 3; i++) {
        samples[i].remaining = 10;
        samples[i].priority = 123; /* Deliberate full 64-bit collision. */
        const oriented_cube_t cube = {
            .cube = move(SOLVED_CUBE, moves[i]), .orientation = ORIENTATION_UF,
        };
        assert(writecube(cube, sizeof samples[i].cube, samples[i].cube) == NISSY_OK);
    }
    for (unsigned i = 0; i < 3; i++)
        for (unsigned j = i + 1; j < 3; j++)
            if (survivor_compare(&samples[i], &samples[j]) > 0) {
                const cuberoot_h48_survivor_sample swap = samples[i];
                samples[i] = samples[j]; samples[j] = swap;
            }
    survivor_insert(collector, &samples[2]);
    survivor_insert(collector, &samples[1]);
    survivor_insert(collector, &samples[0]);
    survivor_insert(collector, &samples[2]); /* Evicted state cannot re-enter. */
    survivor_insert(collector, &samples[0]);
    assert(collector->layers[0].seen_total == 5 && collector->layers[0].retained == 2);
    assert(!strcmp(collector->layers[0].samples[0].cube, samples[0].cube));
    assert(!strcmp(collector->layers[0].samples[1].cube, samples[1].cube));
    cuberoot_h48_survivor_free(collector);
}

static void test_real_sampling_hook_filters_and_serialization(void) {
    assert(cuberoot_h48_survivor_create(1, 0) == NULL);
    assert(cuberoot_h48_survivor_create(1, 65) == NULL);
    cuberoot_h48_survivor_collector *collector = cuberoot_h48_survivor_create(123, 32);
    assert(collector != NULL);
    assert(cuberoot_h48_survivor_attach(collector) == NISSY_ERROR_OPTIONS);
    assert(cuberoot_h48_survivor_set_case(collector, "case\"\\\n") == NISSY_OK);
    assert(cuberoot_h48_survivor_attach(collector) == NISSY_OK);
    solution_settings_t settings = {.maxsolutions = 1};
    solution_list_t solutions = {0};
    dfsarg_solve_h48_t arg = {
        .cube = move(SOLVED_CUBE, MOVE_R), .base = 10,
        .lb_normal = 10, .lb_inverse = 11,
        .survivor_observer = h48_survivor_observer,
        .survivor_observer_data = h48_survivor_observer_data,
        .solution_settings = &settings, .solution_list = &solutions,
    };
    h48_observe_survivor(&arg, 9);
    h48_observe_survivor(&arg, 13);
    arg.base = 8; h48_observe_survivor(&arg, 12); /* Skipped H48 pipeline. */
    arg.base = 10; solutions.nsols = 1; h48_observe_survivor(&arg, 12);
    solutions.nsols = 0; arg.cube = SOLVED_CUBE; h48_observe_survivor(&arg, 12);
    arg.cube = move(SOLVED_CUBE, MOVE_R);
    arg.lb_normal = 13; h48_observe_survivor(&arg, 12);
    arg.lb_normal = 10; h48_observe_survivor(&arg, 12);
    assert(collector->layers[0].seen_total == 0 && collector->layers[1].seen_total == 0);
    assert(collector->layers[2].seen_total == 1 && collector->layers[2].retained == 1);
    const cuberoot_h48_survivor_sample *sample = &collector->layers[2].samples[0];
    assert(sample->remaining == 12 && sample->lb_normal == 10 && sample->lb_inverse == 11);
    assert(equal(readcube(sample->cube).cube, arg.cube));
    FILE *output = tmpfile();
    assert(output != NULL);
    assert(cuberoot_h48_survivor_write_jsonl(collector, output) == NISSY_OK);
    rewind(output);
    char json[4096] = {0};
    const size_t length = fread(json, 1, sizeof json - 1, output);
    assert(length > 0 && length < sizeof json - 1);
    assert(strstr(json, "\"unique_total\":null") != NULL);
    assert(strstr(json, "\"case_id\":\"case\\\"\\\\\\u000a\"") != NULL);
    fclose(output);
    assert(cuberoot_h48_survivor_clear(collector, 456) == NISSY_OK);
    assert(collector->layers[2].seen_total == 0 && collector->layers[2].retained == 0);
    cuberoot_h48_survivor_free(collector);
    assert(h48_survivor_observer == NULL && h48_survivor_observer_data == NULL);
}

int main(void) {
    nissy_setlogger(NULL, NULL);
    test_siphash_vectors();
    test_full_state_bottomk_order_and_repeated_visits();
    test_priority_collision_tie_break();
    test_real_sampling_hook_filters_and_serialization();
    puts("Survivor collector checks passed; no H10 mapping or solve was used.");
    return 0;
}
