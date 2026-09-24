#include "../test.h"

uint64_t symmetry_mask(cube_t);

void run(void) {
	char str[STRLENMAX];
	uint64_t i, result;
	oriented_cube_t cube;

	fgets(str, STRLENMAX, stdin);
	cube = readcube(str);
	result = symmetry_mask(cube.cube); 

	for (i = 0; i < 48; result >>= 1, i++)
		printf("%" PRIu64, result % UINT64_C(2));
	printf("\n");
}
