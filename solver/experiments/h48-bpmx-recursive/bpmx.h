#ifndef CUBEROOT_H48_RECURSIVE_BPMX_H
#define CUBEROOT_H48_RECURSIVE_BPMX_H

#include <stdbool.h>
#include "nissy.h"

/* Each solve snapshots this setting before starting its workers. */
void cuberoot_h48_bpmx_enable(bool enabled);

enum {
    CUBEROOT_H48_BPMX_CUTS = 7,
    CUBEROOT_H48_BPMX_PENDING_NEIGHBORS = 8,
    CUBEROOT_H48_BPMX_RECURSIVE_CUTS = 9,
};

#endif
