/* Offline bounded oracle; include the original vendor src directory.
 * This translation unit includes nissy.c: do not link nissy.c twice.
 * It never maps H10 or generates a pruning table. */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "nissy.c"

#define JOINT_MAX_DEPTH 20
#define JOINT_INPUT_SIZE 2048
#define JOINT_CORNER_HELPER (INFOSIZE + 4 * (FACT_8 + CLASSES_CP_48))
#define JOINT_PRUNING_OFFSET (INFOSIZE + JOINT_CORNER_HELPER)
#define JOINT_CORNER_BYTES (JOINT_PRUNING_OFFSET + INFOSIZE + CLASSES_CP_48 * POW_3_7 / 2)

static const char *joint_edge_names[12] = {
    "UF", "UB", "DB", "DF", "UR", "UL", "DL", "DR", "FR", "FL", "BL", "BR",
};

typedef struct {
    unsigned char *bytes;
    const unsigned char *coordinate;
    const unsigned char *pruning;
    uint8_t edge_move[24][NMOVES];
    uint8_t edge_distance[12][24];
} joint_tables;

typedef enum { JOINT_EXHAUSTED, JOINT_FOUND, JOINT_UNKNOWN } joint_status;
typedef struct {
    joint_status status;
    const char *stop_reason;
    uint64_t nodes;
    unsigned lower_bound;
    unsigned length;
    uint8_t moves[JOINT_MAX_DEPTH];
    double seconds;
} joint_result;

typedef struct {
    const joint_tables *tables;
    unsigned edge;
    unsigned initial_remaining;
    uint64_t max_nodes;
    double deadline;
    uint8_t path[JOINT_MAX_DEPTH];
    joint_result result;
} joint_search;

static double joint_now(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t) != 0) return -1;
    return (double)t.tv_sec + (double)t.tv_nsec / 1e9;
}

static unsigned joint_edge_coordinate(cube_t cube, unsigned edge) {
    uint8_t c[8], e[12];
    pieces(&cube, c, e);
    for (unsigned position = 0; position < 12; position++)
        if ((e[position] & PBITS) == edge)
            return 2 * position + ((e[position] & EOBIT) != 0);
    return 24; /* Only reachable with invalid input, rejected by the CLI. */
}

static bool joint_is_goal(cube_t cube, unsigned edge) {
    uint8_t c[8], e[12];
    pieces(&cube, c, e);
    for (unsigned i = 0; i < 8; i++) if (c[i] != i) return false;
    return e[edge] == edge;
}

static void joint_init_edges(joint_tables *tables) {
    for (uint8_t m = 0; m < NMOVES; m++) {
        cube_t moved = move(SOLVED_CUBE, m);
        uint8_t c[8], e[12];
        pieces(&moved, c, e);
        for (unsigned destination = 0; destination < 12; destination++) {
            unsigned source = e[destination] & PBITS;
            unsigned flip = (e[destination] & EOBIT) != 0;
            for (unsigned o = 0; o < 2; o++)
                tables->edge_move[2 * source + o][m] =
                    (uint8_t)(2 * destination + (o ^ flip));
        }
    }
    for (unsigned edge = 0; edge < 12; edge++) {
        uint8_t queue[24];
        unsigned head = 0, tail = 0;
        memset(tables->edge_distance[edge], 255, 24);
        queue[tail++] = (uint8_t)(2 * edge);
        tables->edge_distance[edge][2 * edge] = 0;
        while (head < tail) {
            unsigned from = queue[head++];
            for (unsigned m = 0; m < NMOVES; m++) {
                unsigned to = tables->edge_move[from][m];
                if (tables->edge_distance[edge][to] != UINT8_MAX) continue;
                tables->edge_distance[edge][to] = tables->edge_distance[edge][from] + 1;
                queue[tail++] = (uint8_t)to;
            }
        }
    }
}

static unsigned joint_lower_bound(const joint_tables *tables, cube_t cube, unsigned edge) {
    uint64_t coordinate = coordinate_corners_coord(cube, tables->coordinate);
    unsigned corners = get_coord_pval(&coordinate_corners, tables->pruning, coordinate);
    unsigned one_edge = tables->edge_distance[edge][joint_edge_coordinate(cube, edge)];
    return corners > one_edge ? corners : one_edge;
}

static joint_status joint_dfs(joint_search *search, cube_t cube, unsigned remaining,
    uint64_t allowed) {
    if (search->result.nodes >= search->max_nodes) {
        search->result.stop_reason = "node_limit";
        return JOINT_UNKNOWN;
    }
    double now = joint_now();
    if (now < 0 || now >= search->deadline) {
        search->result.stop_reason = now < 0 ? "clock_error" : "time_limit";
        return JOINT_UNKNOWN;
    }
    search->result.nodes++;
    if (joint_is_goal(cube, search->edge)) {
        search->result.length = search->initial_remaining - remaining;
        memcpy(search->result.moves, search->path, search->result.length);
        return JOINT_FOUND;
    }
    if (remaining == 0 || joint_lower_bound(search->tables, cube, search->edge) > remaining)
        return JOINT_EXHAUSTED;
    unsigned depth = search->initial_remaining - remaining;
    for (uint8_t m = 0; m < NMOVES; m++) {
        if (!(allowed & MM_SINGLE(m))) continue;
        search->path[depth] = m;
        joint_status child = joint_dfs(search, move(cube, m), remaining - 1,
            allowedmask[movebase(m)]);
        if (child != JOINT_EXHAUSTED) return child;
    }
    return JOINT_EXHAUSTED;
}

static joint_result joint_probe(const joint_tables *tables, cube_t cube, unsigned edge,
    unsigned remaining, uint64_t max_nodes, unsigned max_ms) {
    double start = joint_now();
    joint_search search = {
        .tables = tables, .edge = edge, .initial_remaining = remaining,
        .max_nodes = max_nodes, .deadline = start + (double)max_ms / 1000.0,
        .result = {.status = JOINT_UNKNOWN, .stop_reason = "invalid_options"},
    };
    if (edge >= 12 || remaining > JOINT_MAX_DEPTH) return search.result;
    if (start < 0) {
        search.result.stop_reason = "clock_error";
        return search.result;
    }
    search.result.lower_bound = joint_lower_bound(tables, cube, edge);
    search.result.stop_reason = "complete";
    search.result.status = joint_dfs(&search, cube, remaining, MM18_ALLMOVES);
    if (search.result.status == JOINT_EXHAUSTED && search.result.lower_bound <= remaining)
        search.result.lower_bound = remaining + 1;
    double end = joint_now();
    search.result.seconds = end >= start ? end - start : 0;
    return search.result;
}

/* Bound header offsets before the upstream integrity check follows them. */
static bool joint_validate_corners(const unsigned char *data) {
    tableinfo_t envelope, helper, pruning;
    if (readtableinfo(JOINT_CORNER_BYTES, data, &envelope) != NISSY_OK ||
        envelope.type != TABLETYPE_SPECIAL || envelope.infosize != INFOSIZE ||
        envelope.fullsize != JOINT_PRUNING_OFFSET || envelope.next != JOINT_PRUNING_OFFSET ||
        readtableinfo(JOINT_CORNER_HELPER, data + INFOSIZE, &helper) != NISSY_OK ||
        helper.type != TABLETYPE_SPECIAL || helper.infosize != INFOSIZE ||
        helper.fullsize != JOINT_CORNER_HELPER || helper.next != 0 ||
        helper.entries != FACT_8 + CLASSES_CP_48 || helper.classes != CLASSES_CP_48 ||
        helper.bits != 32 ||
        readtableinfo(JOINT_CORNER_BYTES - JOINT_PRUNING_OFFSET,
            data + JOINT_PRUNING_OFFSET, &pruning) != NISSY_OK ||
        pruning.type != TABLETYPE_PRUNING || pruning.infosize != INFOSIZE ||
        pruning.fullsize != JOINT_CORNER_BYTES - JOINT_PRUNING_OFFSET || pruning.next != 0 ||
        pruning.entries != CLASSES_CP_48 * POW_3_7 || pruning.bits != 4 ||
        pruning.maxvalue != 11 || pruning.base != 0)
        return false;
    const uint32_t *classes = (const uint32_t *)(data + 2 * INFOSIZE);
    const uint32_t *representatives = classes + FACT_8;
    for (size_t i = 0; i < CLASSES_CP_48; i++)
        if (representatives[i] >= FACT_8) return false;
    for (size_t i = 0; i < FACT_8; i++) {
        uint32_t entry = classes[i];
        if (COORD_CLASS(entry) >= CLASSES_CP_48 || COORD_TTREP(entry) >= NTRANS ||
            coord_cp(transform(invcoord_cp(i), COORD_TTREP(entry))) !=
                representatives[COORD_CLASS(entry)])
            return false;
    }
    return nissy_checkdata("corners", JOINT_CORNER_BYTES, data) == NISSY_OK;
}

static bool joint_load_corners(const char *path, joint_tables *tables) {
    memset(tables, 0, sizeof *tables);
    FILE *file = fopen(path, "rb");
    if (file == NULL) return false;
    if (posix_memalign((void **)&tables->bytes, 64, JOINT_CORNER_BYTES) != 0) {
        fclose(file);
        return false;
    }
    bool valid = fread(tables->bytes, 1, JOINT_CORNER_BYTES, file) == JOINT_CORNER_BYTES &&
        fgetc(file) == EOF && !ferror(file) && joint_validate_corners(tables->bytes);
    fclose(file);
    if (!valid) {
        free(tables->bytes);
        memset(tables, 0, sizeof *tables);
        return false;
    }
    tables->coordinate = tables->bytes + INFOSIZE;
    tables->pruning = tables->bytes + JOINT_PRUNING_OFFSET + INFOSIZE;
    joint_init_edges(tables);
    return true;
}

#ifndef JOINT_PROBE_TEST
static bool joint_parse_uint(const char *text, uint64_t max, uint64_t *value) {
    if (*text < '0' || *text > '9') return false;
    char *end;
    errno = 0;
    unsigned long long parsed = strtoull(text, &end, 10);
    if (errno != 0 || *end != '\0' || parsed > max) return false;
    *value = parsed;
    return true;
}

int main(int argc, char **argv) {
    uint64_t max_nodes, max_ms;
    if (argc != 4 || !joint_parse_uint(argv[2], UINT64_C(1000000000), &max_nodes) ||
        !joint_parse_uint(argv[3], 60000, &max_ms) || max_nodes == 0 || max_ms == 0) {
        fprintf(stderr, "usage: joint-probe CORNERS MAX_NODES MAX_MS\n"
            "stdin TSV: numeric-trial-id remaining edge-name cube\n");
        return 2;
    }
    nissy_setlogger(NULL, NULL);
    joint_tables tables;
    if (!joint_load_corners(argv[1], &tables)) {
        fprintf(stderr, "cannot load validated complete corner table\n");
        return 1;
    }
    char line[JOINT_INPUT_SIZE];
    int exit_code = 0;
    while (fgets(line, sizeof line, stdin)) {
        char *newline = strchr(line, '\n');
        if (newline == NULL) { exit_code = 1; break; }
        *newline = '\0';
        char *fields[4] = {line};
        bool valid = true;
        for (unsigned i = 1; i < 4; i++) {
            char *tab = strchr(fields[i - 1], '\t');
            if (tab == NULL) { valid = false; break; }
            *tab = '\0'; fields[i] = tab + 1;
        }
        uint64_t id, remaining;
        if (!valid || !joint_parse_uint(fields[0], UINT64_C(9007199254740991), &id) ||
            !joint_parse_uint(fields[1], JOINT_MAX_DEPTH, &remaining) ||
            strlen(fields[3]) != NISSY_SIZE_CUBE - 1 || fields[3][21] != '=') {
            exit_code = 1; break;
        }
        unsigned edge;
        for (edge = 0; edge < 12; edge++) if (!strcmp(fields[2], joint_edge_names[edge])) break;
        oriented_cube_t state = readcube(fields[3]);
        if (edge == 12 || !isconsistent(state) || !issolvable(state) ||
            state.orientation != ORIENTATION_UF) { exit_code = 1; break; }
        joint_result result = joint_probe(&tables, state.cube, edge, (unsigned)remaining,
            max_nodes, (unsigned)max_ms);
        char solution[128] = {0};
        if (result.status == JOINT_FOUND) {
            cube_t checked = state.cube;
            for (unsigned i = 0; i < result.length; i++) checked = move(checked, result.moves[i]);
            if (!joint_is_goal(checked, edge) || result.length > remaining ||
                writemoves(result.length, result.moves, sizeof solution, solution) < 0) {
                exit_code = 1; break;
            }
        }
        printf("{\"trialId\":%" PRIu64 ",\"edge\":\"%s\",\"remaining\":%" PRIu64
            ",\"status\":\"%s\",\"reason\":\"%s\",\"nodes\":%" PRIu64
            ",\"seconds\":%.9f,\"lowerBound\":%u,\"solution\":\"%s\",\"length\":",
            id, joint_edge_names[edge], remaining,
            result.status == JOINT_FOUND ? "found_le_r" :
                result.status == JOINT_EXHAUSTED ? "proved_gt_r" : "unknown",
            result.stop_reason, result.nodes, result.seconds, result.lower_bound, solution);
        if (result.status == JOINT_FOUND) printf("%u", result.length); else fputs("null", stdout);
        puts("}");
        if (fflush(stdout) != 0) { exit_code = 1; break; }
    }
    if (ferror(stdin)) exit_code = 1;
    if (exit_code != 0) fprintf(stderr, "invalid input, failed verification, or stream error\n");
    free(tables.bytes);
    return exit_code;
}
#endif
