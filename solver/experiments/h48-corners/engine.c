/* Compile with -I pointing to the patched snapshot's src directory.
 * Keep nissy.c in this translation unit to reuse its private coordinates. */
#include "engine.h"
#include "nissy.c"

struct cuberoot_h48_corners_engine {
    h48_corners_context_t context;
};

#define CORNER_COORD_BYTES (INFOSIZE + 4 * (FACT_8 + CLASSES_CP_48))
#define CORNER_PRUNING_OFFSET (INFOSIZE + CORNER_COORD_BYTES)
#define CORNER_ENTRIES (CLASSES_CP_48 * POW_3_7)
#define CORNER_BYTES (CORNER_PRUNING_OFFSET + INFOSIZE + CORNER_ENTRIES / 2)
#define H10_BYTES UINT64_C(30336314216)

static bool header_name_is(const tableinfo_t *info, const char *name) {
    const size_t size = strlen(name) + 1;
    return size <= sizeof info->solver && !memcmp(info->solver, name, size);
}

static long long validate_corners(const unsigned char *data, size_t size) {
    tableinfo_t envelope, helper, pruning;
    if (data == NULL) return NISSY_ERROR_NULL_POINTER;
    if ((uintptr_t)data % 8 != 0 || size != CORNER_BYTES)
        return NISSY_ERROR_DATA;
    if (readtableinfo(size, data, &envelope) != NISSY_OK ||
        readtableinfo(size - INFOSIZE, data + INFOSIZE, &helper) != NISSY_OK ||
        readtableinfo(size - CORNER_PRUNING_OFFSET,
            data + CORNER_PRUNING_OFFSET, &pruning) != NISSY_OK)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&envelope, "coord helper table for CORNERS") ||
        envelope.type != TABLETYPE_SPECIAL || envelope.infosize != INFOSIZE ||
        envelope.fullsize != CORNER_PRUNING_OFFSET ||
        envelope.next != CORNER_PRUNING_OFFSET || envelope.entries != 0 ||
        envelope.classes != 0 || envelope.bits != 0 || envelope.base != 0 ||
        envelope.maxvalue != 0)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&helper, "coord data for CORNERS") ||
        helper.type != TABLETYPE_SPECIAL || helper.infosize != INFOSIZE ||
        helper.fullsize != CORNER_COORD_BYTES || helper.next != 0 ||
        helper.entries != FACT_8 + CLASSES_CP_48 ||
        helper.classes != CLASSES_CP_48 || helper.bits != 32 ||
        helper.base != 0 || helper.maxvalue != 0)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&pruning, "coordinate solver for CORNERS") ||
        pruning.type != TABLETYPE_PRUNING || pruning.infosize != INFOSIZE ||
        pruning.fullsize != INFOSIZE + CORNER_ENTRIES / 2 || pruning.next != 0 ||
        pruning.entries != CORNER_ENTRIES || pruning.classes != 0 ||
        pruning.bits != 4 || pruning.base != 0 || pruning.maxvalue != 11)
        return NISSY_ERROR_DATA;

    /* Bound every helper lookup before allowing the search to use the blob.
     * Also check that its representative transformations agree with CP. */
    const uint32_t *classes = (const uint32_t *)(data + 2 * INFOSIZE);
    const uint32_t *representatives = classes + FACT_8;
    for (size_t i = 0; i < CLASSES_CP_48; i++)
        if (representatives[i] >= FACT_8) return NISSY_ERROR_DATA;
    for (size_t i = 0; i < FACT_8; i++) {
        const uint32_t entry = classes[i];
        if (COORD_CLASS(entry) >= CLASSES_CP_48 || COORD_TTREP(entry) >= NTRANS ||
            COORD_ISNASTY(entry) > 1)
            return NISSY_ERROR_DATA;
        if (coord_cp(transform(invcoord_cp(i), COORD_TTREP(entry))) !=
            representatives[COORD_CLASS(entry)])
            return NISSY_ERROR_DATA;
    }
    /* Includes the fixed upstream distribution and actual nibble payload. */
    return nissy_checkdata("corners", size, data);
}

long long cuberoot_h48_corners_probe(const unsigned char *data, size_t size,
    cuberoot_h48_corners_info *info) {
    if (info != NULL) memset(info, 0, sizeof *info);
    const long long result = validate_corners(data, size);
    if (result == NISSY_OK && info != NULL) {
        info->bytes = size;
        info->entries = CORNER_ENTRIES;
        info->max_distance = 11;
    }
    return result;
}

long long cuberoot_h48_corners_init(const unsigned char *data, size_t size,
    cuberoot_h48_corners_engine **out) {
    if (out == NULL) return NISSY_ERROR_NULL_POINTER;
    *out = NULL;
    const long long result = validate_corners(data, size);
    if (result != NISSY_OK) return result;
    cuberoot_h48_corners_engine *engine = malloc(sizeof *engine);
    if (engine == NULL) return NISSY_ERROR_UNKNOWN;
    engine->context = (h48_corners_context_t) {
        .coord_data = data + INFOSIZE,
        .ptable = data + CORNER_PRUNING_OFFSET + INFOSIZE,
    };
    *out = engine;
    return NISSY_OK;
}

void cuberoot_h48_corners_free(cuberoot_h48_corners_engine *engine) {
    free(engine);
}

static long long validate_h10_headers(const unsigned char *data, size_t size) {
    tableinfo_t corners, main, fallback;
    const size_t main_bytes = INFOSIZE + H48_TABLESIZE(10);
    const size_t fallback_offset = COCSEP_FULLSIZE + main_bytes;
    if (data == NULL) return NISSY_ERROR_NULL_POINTER;
    if ((uintptr_t)data % 8 != 0 || size != H10_BYTES ||
        fallback_offset + EOESEP_FULLSIZE != size)
        return NISSY_ERROR_DATA;
    if (readtableinfo(size, data, &corners) != NISSY_OK ||
        readtableinfo(size - COCSEP_FULLSIZE, data + COCSEP_FULLSIZE, &main) != NISSY_OK ||
        readtableinfo(size - fallback_offset, data + fallback_offset, &fallback) != NISSY_OK)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&corners, "cocsep data for h48") ||
        corners.type != TABLETYPE_SPECIAL || corners.infosize != INFOSIZE ||
        corners.fullsize != COCSEP_FULLSIZE || corners.next != COCSEP_FULLSIZE ||
        corners.entries != COCSEP_TABLESIZE || corners.classes != COCSEP_CLASSES ||
        corners.bits != 32 || corners.base != 0 || corners.maxvalue != 9)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&main, "h48 solver h =10") ||
        main.type != TABLETYPE_PRUNING || main.infosize != INFOSIZE ||
        main.fullsize != main_bytes || main.next != main_bytes ||
        main.entries != H48_COORDMAX(10) + 2 * H48_LINES(10) ||
        main.classes != 0 || main.h48h != 10 || main.bits != 2 ||
        main.base > 20 || main.maxvalue != 3)
        return NISSY_ERROR_DATA;
    if (!header_name_is(&fallback, "eoesep data for h48") ||
        fallback.type != TABLETYPE_SPECIAL || fallback.infosize != INFOSIZE ||
        fallback.fullsize != EOESEP_FULLSIZE || fallback.next != 0 ||
        fallback.entries != EOESEP_TABLESIZE || fallback.classes != ESEP_CLASSES ||
        fallback.bits != 4 || fallback.base != 0 || fallback.maxvalue != 11)
        return NISSY_ERROR_DATA;
    return NISSY_OK;
}

long long cuberoot_h48_corners_solve(const cuberoot_h48_corners_engine *engine,
    const char *scramble, unsigned threads, const unsigned char *h10_data,
    size_t h10_size, char *solution, size_t solution_size,
    long long stats[NISSY_SIZE_SOLVE_STATS],
    cuberoot_h48_corners_stats *corner_stats) {
    if (stats != NULL) memset(stats, 0, NISSY_SIZE_SOLVE_STATS * sizeof *stats);
    if (corner_stats != NULL) memset(corner_stats, 0, sizeof *corner_stats);
    if (solution != NULL && solution_size > 0) solution[0] = '\0';
    if (scramble == NULL || solution == NULL || stats == NULL)
        return NISSY_ERROR_NULL_POINTER;
    if (solution_size < 1) return NISSY_ERROR_BUFFER_SIZE;
    if (threads < 1 || threads > THREADS || threads > INT8_MAX)
        return NISSY_ERROR_OPTIONS;
    const long long valid = validate_h10_headers(h10_data, h10_size);
    if (valid != NISSY_OK) return valid;
    char cube[NISSY_SIZE_CUBE];
    const long long applied = nissy_applymoves(NISSY_SOLVED_CUBE, scramble, cube);
    if (applied != NISSY_OK) return applied;
    const oriented_cube_t state = readcube(cube);
    if (!isconsistent(state) || !issolvable(state)) return NISSY_ERROR_INVALID_CUBE;
    h48_corners_stats_t observed = {0};
    const long long result = solve_h48(state, 0, 20, 1, 0, (uint8_t)threads,
        h10_size, h10_data, solution_size, solution, stats, NULL, NULL,
        engine == NULL ? NULL : &engine->context, &observed);
    if (corner_stats != NULL) {
        corner_stats->lookups = observed.lookups;
        corner_stats->prunes = observed.prunes;
    }
    return result;
}
