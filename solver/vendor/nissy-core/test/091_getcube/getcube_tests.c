#include "../test.h"

cube_t getcube(uint64_t, uint64_t, uint64_t, uint64_t);

void run(void) {
	char str[STRLENMAX];
	oriented_cube_t cube;
	uint64_t ep, eo, cp, co;

	fgets(str, STRLENMAX, stdin);
	ep = atoll(str);
	fgets(str, STRLENMAX, stdin);
	eo = atoll(str);
	fgets(str, STRLENMAX, stdin);
	cp = atoll(str);
	fgets(str, STRLENMAX, stdin);
	co = atoll(str);

	cube = (oriented_cube_t) {
		.cube = getcube(ep, eo, cp, co),
		.orientation = 0
	};

	if (iserror(cube)) {
		printf("Error cube\n");
	} else if (!isconsistent(cube)) {
		printf("Inconsistent cube\n");
	} else {
		writecube(cube, NISSY_SIZE_CUBE, str);
		printf("%s\n", str);
	}
}
