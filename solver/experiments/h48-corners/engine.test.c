/* Low-memory boundary/hook checks only. The synthetic coordinate fixture
 * below is intentionally NOT a valid corner table. These checks do not
 * establish full-table correctness, optimality, or H10 performance.
 * Compile this translation unit alone, not together with engine.c. */
#include <assert.h>
#include <stdalign.h>
#include <stdio.h>
#include "engine.c"

static void test_invalid_inputs(void) {
    alignas(8) const unsigned char tiny[1024] = {0};
    cuberoot_h48_corners_engine *engine = (void *)(uintptr_t)1;
    cuberoot_h48_corners_info info = {1, 1, 1};
    assert(cuberoot_h48_corners_probe(NULL, 0, &info) == NISSY_ERROR_NULL_POINTER);
    assert(info.bytes == 0 && info.entries == 0 && info.max_distance == 0);
    assert(cuberoot_h48_corners_probe(tiny, sizeof tiny, NULL) == NISSY_ERROR_DATA);
    assert(cuberoot_h48_corners_probe(tiny + 1, CORNER_BYTES, NULL) == NISSY_ERROR_DATA);
    assert(cuberoot_h48_corners_probe(tiny, SIZE_MAX, NULL) == NISSY_ERROR_DATA);
    assert(cuberoot_h48_corners_init(tiny, sizeof tiny, &engine) == NISSY_ERROR_DATA);
    assert(engine == NULL);
    assert(cuberoot_h48_corners_init(tiny, sizeof tiny, NULL) == NISSY_ERROR_NULL_POINTER);
    cuberoot_h48_corners_free(NULL);
    assert(validate_h10_headers(NULL, 0) == NISSY_ERROR_NULL_POINTER);
    assert(validate_h10_headers(tiny, sizeof tiny) == NISSY_ERROR_DATA);
    assert(validate_h10_headers(tiny + 1, H10_BYTES) == NISSY_ERROR_DATA);
}

static void test_malformed_headers(void) {
    /* Only a zero-filled 1.2 MB rejection fixture, never a generated table. */
    unsigned char *fixture = calloc(1, CORNER_BYTES);
    assert(fixture != NULL);
    assert(cuberoot_h48_corners_probe(fixture, CORNER_BYTES, NULL) == NISSY_ERROR_DATA);
    tableinfo_t envelope = {
        .solver = "coord helper table for CORNERS", .type = TABLETYPE_SPECIAL,
        .infosize = INFOSIZE, .fullsize = CORNER_PRUNING_OFFSET,
        .next = UINT64_MAX,
    };
    assert(writetableinfo(&envelope, CORNER_BYTES, fixture) == NISSY_OK);
    assert(cuberoot_h48_corners_probe(fixture, CORNER_BYTES, NULL) == NISSY_ERROR_DATA);
    free(fixture);
}

static void test_real_corner_hook_with_synthetic_distance(void) {
    /* CP(solved)=0 maps to class=0, transform=0; its CO coordinate is also 0.
     * This supplies one artificial distance to the actual patched hook. */
    alignas(8) const unsigned char coord_fixture[512 + sizeof(uint32_t)] = {0};
    const unsigned char synthetic_distance[] = {7};
    const h48_corners_context_t corners = {
        .coord_data = coord_fixture, .ptable = synthetic_distance,
    };
    dfsarg_solve_h48_t arg = {
        .cube = SOLVED_CUBE, .inverse = SOLVED_CUBE, .corners = &corners,
        .lb_normal = 3, .lb_inverse = 4,
        .movemask_normal = UINT64_C(0x1234), .movemask_inverse = UINT64_C(0x5678),
    };
    const dfsarg_solve_h48_t before = arg;
    assert(!h48_prune_corners(&arg, 11));
    assert(!h48_prune_corners(&arg, UINT8_MAX));
    assert(arg.corner_lookups == 0 && arg.corner_prunes == 0);
    assert(!h48_prune_corners(&arg, 7)); /* equal is retained */
    assert(h48_prune_corners(&arg, 6));
    assert(h48_prune_corners(&arg, 0));
    assert(arg.corner_lookups == 3 && arg.corner_prunes == 2);
    arg.corner_lookups = before.corner_lookups;
    arg.corner_prunes = before.corner_prunes;
    assert(memcmp(&arg, &before, sizeof arg) == 0);
    arg.corners = NULL;
    assert(!h48_prune_corners(&arg, 0));
    assert(arg.corner_lookups == 0 && arg.corner_prunes == 0);
}

int main(void) {
    nissy_setlogger(NULL, NULL);
    test_invalid_inputs();
    test_malformed_headers();
    test_real_corner_hook_with_synthetic_distance();
    puts("H48 corner input/hook checks passed; full-table/H10 acceptance not run.");
    return 0;
}
