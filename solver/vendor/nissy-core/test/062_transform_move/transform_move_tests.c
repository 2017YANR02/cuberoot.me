#include "../test.h"

#define MAXMOVES 150

cube_t applytrans(cube_t, const char *);
uint8_t transform_move(uint8_t, uint8_t);
int64_t readmoves(const char *, size_t n, size_t m,
    size_t *, size_t *, uint8_t *, uint8_t *);
oriented_cube_t move_extended(oriented_cube_t, uint8_t);
oriented_cube_t applymoves(oriented_cube_t, const char *);
uint8_t readtrans(const char[SIZE(NISSY_SIZE_TRANSFORMATION)]);

void run(void) {
	char movestr[STRLENMAX], transtr[STRLENMAX], cubestr[STRLENMAX];
	uint8_t t, moves[MAXMOVES];
	size_t i, n, ninv;
	int64_t tot;
	oriented_cube_t cube;

	fgets(transtr, STRLENMAX, stdin);
	fgets(movestr, STRLENMAX, stdin);

	cube = solvedcube();
	tot = readmoves(movestr, MAXMOVES, 0, &n, &ninv, moves, NULL);
	if (tot < 0 || ninv != 0) {
		printf("Test error reading moves\n");
		return;
	}
	t = readtrans(transtr);
	for (i = 0; i < n; i++)
		cube = move_extended(cube, transform_move(moves[i], t));

	writecube(cube, STRLENMAX, cubestr);
	printf("%s\n", cubestr);
}
