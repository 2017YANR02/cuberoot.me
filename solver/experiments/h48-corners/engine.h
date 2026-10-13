#ifndef CUBEROOT_H48_CORNERS_ENGINE_H
#define CUBEROOT_H48_CORNERS_ENGINE_H

#include <stddef.h>
#include <stdint.h>
#include "nissy.h"

typedef struct cuberoot_h48_corners_engine cuberoot_h48_corners_engine;

typedef struct {
    size_t bytes;
    uint64_t entries;
    unsigned max_distance;
} cuberoot_h48_corners_info;

typedef struct {
    uint64_t lookups;
    uint64_t prunes;
} cuberoot_h48_corners_stats;

/* Read-only validation; these APIs never generate tables or load H10. */
long long cuberoot_h48_corners_probe(const unsigned char *data, size_t size,
    cuberoot_h48_corners_info *info);
long long cuberoot_h48_corners_init(const unsigned char *data, size_t size,
    cuberoot_h48_corners_engine **out);
/* The caller keeps the validated bytes alive and immutable until free(). */
void cuberoot_h48_corners_free(cuberoot_h48_corners_engine *engine);

/* One optimal HTM solution. A NULL engine selects the unchanged baseline.
 * The caller supplies an existing read-only H10 mapping; no file is opened.
 * Returns the nissy solution count or a negative NISSY_ERROR_* value. */
long long cuberoot_h48_corners_solve(const cuberoot_h48_corners_engine *engine,
    const char *scramble, unsigned threads, const unsigned char *h10_data,
    size_t h10_size, char *solution, size_t solution_size,
    long long stats[NISSY_SIZE_SOLVE_STATS],
    cuberoot_h48_corners_stats *corner_stats);

#endif
