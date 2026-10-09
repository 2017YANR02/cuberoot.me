#define TEST_H

#include <inttypes.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../src/utils/compilers.h"
#include "../src/utils/wrapthread.h"
#include "../src/nissy.h"
#include "../src/arch/arch.h"
#include "../src/core/core_types.h"
#include "../src/solvers/solutions_types_macros.h"
#include "../src/solvers/tables_types_macros.h"
#include "../src/solvers/h48/coordinate_types_macros.h"
#include "../src/solvers/h48/map_types_macros.h"
#include "../src/solvers/h48/gendata_types_macros.h"
#include "../src/solvers/coord/types_macros.h"

#define STRLENMAX 10000

/* Basic functions used in most tests */
oriented_cube_t solvedcube(void);
bool iserror(oriented_cube_t);
bool isconsistent(oriented_cube_t);
bool issolvable(oriented_cube_t);
bool issolved(oriented_cube_t);
oriented_cube_t readcube(char *);
int64_t writecube(oriented_cube_t, size_t n, char *);

/* Test function to be implemented by all tests */
void run(void);

void log_stderr(const char *str, void *unused)
{
	fprintf(stderr, "%s", str);
}

int main(void) {
	nissy_setlogger(log_stderr, NULL);
	run();
	return 0;
}
