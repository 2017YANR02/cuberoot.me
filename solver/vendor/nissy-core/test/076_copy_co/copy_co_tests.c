#include "../test.h"

void copy_co(cube_t *, cube_t);
void pieces(cube_t *, uint8_t [SIZE(8)], uint8_t [SIZE(12)]);

void run(void) {
	char str[STRLENMAX];
	oriented_cube_t cube1, cube2;
	uint8_t edge[12], corner[8];

	fgets(str, STRLENMAX, stdin);
	cube1 = readcube(str);
	fgets(str, STRLENMAX, stdin);
	cube2 = readcube(str);

	copy_co(&cube1.cube, cube2.cube);

	if (iserror(cube1)) {
		printf("Error copying CO\n");
	} else if (!isconsistent(cube2)) {
		pieces(&cube1.cube, corner, edge);
		fprintf(stderr, "edges: ");
		for (int i = 0; i < 12; i++)
			fprintf(stderr, "%d ", edge[i]);
		fprintf(stderr, "\n");
		for (int i = 0; i < 8; i++)
			fprintf(stderr, "%d ", corner[i]);
		fprintf(stderr, "\n");
		printf("Setting CO resulted in inconsistent cube\n");
	} else {
		writecube(cube1, NISSY_SIZE_CUBE, str);
		printf("%s\n", str);
	}
}
