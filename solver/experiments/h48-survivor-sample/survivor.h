#ifndef CUBEROOT_H48_SURVIVOR_SAMPLE_H
#define CUBEROOT_H48_SURVIVOR_SAMPLE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include "nissy.h"

#define CUBEROOT_H48_SURVIVOR_MAX_SAMPLES 64U
#define CUBEROOT_H48_SURVIVOR_CASE_ID_SIZE 128U

typedef struct cuberoot_h48_survivor_collector cuberoot_h48_survivor_collector;

typedef struct {
    char cube[NISSY_SIZE_CUBE];
    char case_id[CUBEROOT_H48_SURVIVOR_CASE_ID_SIZE];
    uint64_t priority;
    unsigned remaining;
    unsigned lb_normal;
    unsigned lb_inverse;
} cuberoot_h48_survivor_sample;

typedef struct {
    unsigned remaining;
    uint64_t seen_total; /* Eligible visits, including repeated full states. */
    size_t retained;     /* Distinct full states kept by bottom-k priority. */
} cuberoot_h48_survivor_layer_stats;

/* No H10 file is opened and no solve is started by this library.
 * Attach/set_case/clear/free only between completed nissy_solve calls.
 * The collector persists across cases and uses bounded O(capacity) memory. */
cuberoot_h48_survivor_collector *cuberoot_h48_survivor_create(
    uint64_t seed, unsigned capacity_per_layer);
void cuberoot_h48_survivor_free(cuberoot_h48_survivor_collector *collector);
long long cuberoot_h48_survivor_clear(cuberoot_h48_survivor_collector *collector,
    uint64_t seed);
long long cuberoot_h48_survivor_set_case(cuberoot_h48_survivor_collector *collector,
    const char *case_id);
/* Passing NULL detaches. Set a nonempty case_id before attaching. */
long long cuberoot_h48_survivor_attach(cuberoot_h48_survivor_collector *collector);
long long cuberoot_h48_survivor_get_layer_stats(
    const cuberoot_h48_survivor_collector *collector, unsigned remaining,
    cuberoot_h48_survivor_layer_stats *stats);
long long cuberoot_h48_survivor_get_sample(
    const cuberoot_h48_survivor_collector *collector, unsigned remaining,
    size_t index, cuberoot_h48_survivor_sample *sample);
/* Read/write APIs are called after solves complete. The caller owns FILE.
 * Emits a metadata row, then priority-sorted sample rows for r=10,11,12. */
long long cuberoot_h48_survivor_write_jsonl(
    const cuberoot_h48_survivor_collector *collector, FILE *output);

#endif
