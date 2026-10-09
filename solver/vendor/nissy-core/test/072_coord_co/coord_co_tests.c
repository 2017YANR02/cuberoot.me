#include "../test.h"

uint64_t coord_co(cube_t);

void run(void) {
	char str[STRLENMAX];
	oriented_cube_t cube;
	uint64_t result;

	fgets(str, STRLENMAX, stdin);
	cube = readcube(str);

	result = coord_co(cube.cube);

	printf("%" PRIu64 "\n", result);
}
