#include "../test.h"

uint8_t readmove(char);
uint8_t readmodifier(char);
cube_t premove(cube_t, uint8_t);

void run(void) {
	char movestr[STRLENMAX], cubestr[STRLENMAX];
	uint8_t move;
	oriented_cube_t cube;

	fgets(movestr, STRLENMAX, stdin);
	move = readmove(movestr[0]) + readmodifier(movestr[1]);
	fgets(cubestr, STRLENMAX, stdin);
	cube = readcube(cubestr);

	cube.cube = premove(cube.cube, move);

	if (iserror(cube)) {
		printf("Error moving cube\n");
	} else if (!issolvable(cube)) {
		printf("Moved cube is not solvable\n");
	} else {
		writecube(cube, NISSY_SIZE_CUBE, cubestr);
		printf("%s\n", cubestr);
	}
}
