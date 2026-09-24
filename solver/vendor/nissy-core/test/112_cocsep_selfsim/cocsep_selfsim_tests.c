/*
 * This test is tricky, we only have two cases for now: the solved cube
 * and the cube that is one quarter-turn-move off (all such cases are
 * equivalent due to symmetry). Adding more tests requires figuring out
 * by hand which one is the first position in its class to be reached.
 * Note that the .out files need a space before each newline.
 */
#include "../test.h"

size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);
uint64_t coord_cocsep(cube_t);

void run(void) {
	char str[STRLENMAX];
	unsigned char buf[2000000];
	uint32_t *cocsepdata, data;
	uint64_t coord, coclass;
	uint64_t selfsim[COCSEP_CLASSES], sim, t;
	oriented_cube_t cube;
	cube_t rep[COCSEP_CLASSES];

	gendata_cocsep(buf, selfsim, rep);
	cocsepdata = (uint32_t *)(buf + INFOSIZE);

	/* All cases in the same test so we do not generate data many times */

	while (fgets(str, STRLENMAX, stdin) != NULL) {
		cube = readcube(str);
		coord = coord_cocsep(cube.cube);
		data = cocsepdata[coord];
		coclass = (data & (0xFFFU << 16)) >> 16;
		sim = selfsim[coclass];
		for (t = 0; t < 48 && sim; t++, sim >>= 1) {
			if (sim & 1)
				printf("%" PRIu64 " ", t);
		}
		printf("\n");
	}
}
