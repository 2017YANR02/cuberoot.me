#include "../test.h"

uint64_t coord_esep(cube_t);
cube_t invcoord_esep(uint64_t);

void run(void) {
	char str[STRLENMAX];
	oriented_cube_t cube;
	uint64_t i;

	fgets(str, STRLENMAX, stdin);
	cube = readcube(str);

	i = coord_esep(cube.cube);
	cube.cube = invcoord_esep(i);
	i = coord_esep(cube.cube);

	printf("%" PRIu64 "\n", i);
}
