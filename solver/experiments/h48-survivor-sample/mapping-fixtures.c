/* Fixed encoding fixtures only: no solver, pruning data, or input arguments.
 * Compile against the preserved original vendor source. */
#include <assert.h>
#include <stdio.h>
#include "nissy.h"

int main(void) {
    const char *moves[] = {
        "U", "U2", "U'", "D", "D2", "D'", "R", "R2", "R'",
        "L", "L2", "L'", "F", "F2", "F'", "B", "B2", "B'",
    };
    char cube[NISSY_SIZE_CUBE], alg[16];
    nissy_setlogger(NULL, NULL);
    printf("[{\"alg\":\"\",\"cube\":\"%s\"}", NISSY_SOLVED_CUBE);
    for (unsigned a = 0; a < 18; a++) {
        assert(nissy_applymoves(NISSY_SOLVED_CUBE, moves[a], cube) == NISSY_OK);
        printf(",\n{\"alg\":\"%s\",\"cube\":\"%s\"}", moves[a], cube);
        for (unsigned b = 0; b < 18; b++) {
            snprintf(alg, sizeof alg, "%s %s", moves[a], moves[b]);
            assert(nissy_applymoves(NISSY_SOLVED_CUBE, alg, cube) == NISSY_OK);
            printf(",\n{\"alg\":\"%s\",\"cube\":\"%s\"}", alg, cube);
        }
    }
    puts("]");
    return 0;
}
