/* Build against the independently patched recursive candidate snapshot.
 * Do not link another copy of nissy.c or the one-level BPMX engine. */
#include "bpmx.h"
#include "nissy.c"

void cuberoot_h48_bpmx_enable(bool enabled) {
    atomic_store(&h48_bpmx_enabled, enabled);
}
