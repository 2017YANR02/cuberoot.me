/* Include path must select the separately patched source snapshot.
 * Do not also compile nissy.c as another translation unit. */
#include "bpmx.h"
#include "nissy.c"

void cuberoot_h48_bpmx_enable(bool enabled) {
    atomic_store(&h48_bpmx_enabled, enabled);
}
