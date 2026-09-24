#include "../test.h"

void pieces(cube_t *, uint8_t [SIZE(8)], uint8_t [SIZE(12)]);

void run(void) {
	int i;
	uint8_t corner[8], edge[12];
	char str[STRLENMAX], *aux;
	oriented_cube_t cube;

        aux = str;
	while (fgets(aux, STRLENMAX, stdin) != NULL)
		while (*aux != '\n')
			aux++;

	cube = readcube(str);
	pieces(&cube.cube, corner, edge);

	for (i = 0; i < 8; i++)
		printf("%" PRIu8 " ", corner[i]);
	printf("\n");
	for (i = 0; i < 12; i++)
		printf("%" PRIu8 " ", edge[i]);
	printf("\n");
}
