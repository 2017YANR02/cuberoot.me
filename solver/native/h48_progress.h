#ifndef CUBEROOT_H48_PROGRESS_H
#define CUBEROOT_H48_PROGRESS_H

#include <stdint.h>

enum cuberoot_h48_stage {
    H48_PREPARE = 0,
    H48_COCSEP,
    H48_CLEAR,
    H48_SHORT_ENUM,
    H48_SHORT_PROCESS,
    H48_DISTRIBUTION,
    H48_EOESEP,
    H48_VALIDATE,
    H48_FLUSH,
    H48_COMPLETE,
    H48_FAILED
};

void cuberoot_h48_progress_start(const char *table_path);
void cuberoot_h48_progress_stage(enum cuberoot_h48_stage stage,
                                 uint64_t done, uint64_t total, uint32_t detail);
void cuberoot_h48_progress_done(uint64_t done);
void cuberoot_h48_progress_add(uint64_t increment);
void cuberoot_h48_progress_distribution(uint64_t lines);
void cuberoot_h48_progress_finish(int success);

#endif
