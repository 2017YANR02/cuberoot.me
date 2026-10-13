#ifndef CUBEROOT_H48_BPMX_H
#define CUBEROOT_H48_BPMX_H

#include <stdbool.h>
#include "nissy.h"

/* Affects solves started after this call. Each solve snapshots the setting;
 * changing it does not change any solve already in progress. Default: false. */
void cuberoot_h48_bpmx_enable(bool enabled);

enum {
    CUBEROOT_H48_FACE_CUTS = 6,
    CUBEROOT_H48_BPMX_CUTS = 7,
    CUBEROOT_H48_BPMX_PENDING_NEIGHBORS = 8,
};

#endif
