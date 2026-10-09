#include "../test.h"

oriented_cube_t applymoves(oriented_cube_t, char *);

void run(void) {
	char movestr[STRLENMAX], cubestr[STRLENMAX];
	oriented_cube_t cube;

	fgets(movestr, STRLENMAX, stdin);
	fgets(cubestr, STRLENMAX, stdin);
	cube = readcube(cubestr);

	cube = applymoves(cube, movestr);

	if (iserror(cube)) {
		printf("Error moving cube\n");
	} else if (!issolvable(cube)) {
		printf("Moved cube is not solvable\n");
	} else {
		writecube(cube, NISSY_SIZE_CUBE, cubestr);
		printf("%s\n", cubestr);
	}
}
