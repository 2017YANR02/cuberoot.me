#include "../test.h"

oriented_cube_t applytrans(oriented_cube_t, char *);

void run(void) {
	char cubestr[STRLENMAX], transtr[STRLENMAX];
	oriented_cube_t cube;

	fgets(transtr, STRLENMAX, stdin);
	fgets(cubestr, STRLENMAX, stdin);
	cube = readcube(cubestr);

	cube = applytrans(cube, transtr);

	if (iserror(cube)) {
		printf("Error transforming cube\n");
	} else if (!issolvable(cube)) {
		printf("Transformed cube is not solvable\n");
	} else {
		writecube(cube, NISSY_SIZE_CUBE, cubestr);
		printf("%s\n", cubestr);
	}
}
