#include "../test.h"

uint8_t readtrans(char [SIZE(NISSY_SIZE_TRANSFORMATION)]);
uint8_t inverse_trans(uint8_t);
oriented_cube_t applymoves(oriented_cube_t, char *);
oriented_cube_t applytrans(oriented_cube_t, char *);
extern char *transstr[];

void run(void) {
	uint8_t t, tinv;
	oriented_cube_t cube;

	for (t = 0; t < 48; t++) {
		cube = solvedcube();
		cube = applymoves(cube, "R");
		cube = applymoves(cube, "U");
		cube = applymoves(cube, "F");

		cube = applytrans(cube, transstr[t]);
		tinv = inverse_trans(t);
		cube = applytrans(cube, transstr[tinv]);

		if (iserror(cube)) {
			printf("Error transforming cube\n");
		} else if (!issolvable(cube)) {
			printf("Transformed cube is not solvable\n");
		} else {
			cube = applymoves(cube, "F'");
			cube = applymoves(cube, "U'");
			cube = applymoves(cube, "R'");
			if (!issolved(cube))
				printf("%s: Error! Got %" PRIu8 "\n",
				    transstr[t], tinv);
		}
	}
}
