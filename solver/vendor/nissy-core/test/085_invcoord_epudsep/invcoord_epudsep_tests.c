#include "../test.h"

#define COMB_8_4 70

uint64_t coord_epudsep(cube_t);
cube_t invcoord_epudsep(uint64_t);

void run(void) {
	oriented_cube_t cube;
	uint64_t coord, coord2;

	cube.orientation = 0;

	/* Test all possible values for CP coordinate */
	for (coord = 0; coord < COMB_8_4; coord++) {
		cube.cube = invcoord_epudsep(coord);

		if (!isconsistent(cube)) {
			printf("Not consistent\n");
			return;
		}

		coord2 = coord_epudsep(cube.cube);
		if (coord != coord2) {
			printf("Error: invcoord of %" PRIu64
			    " returns %" PRIu64 "\n", coord, coord2);
			return;
		}
	}

	printf("All good\n");
}
