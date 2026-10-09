#include "../test.h"

void run(void) {
	char str[STRLENMAX], *aux;
	oriented_cube_t cube;

	aux = str;
	while (fgets(aux, STRLENMAX, stdin) != NULL)
		while (*aux != '\n')
			aux++;

	cube = readcube(str);

	if (iserror(cube)) {
		printf("Error reading cube\n");
	} else if (!issolvable(cube)) {
		printf("Cube is not solvable\n");
	} else {
		writecube(cube, NISSY_SIZE_CUBE, str);
		printf("%s\n", str);
	}
}
