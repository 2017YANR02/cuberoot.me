#include "../test.h"

size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);
uint64_t coord_h48(cube_t, const uint32_t *, uint8_t);
cube_t invcoord_h48(uint64_t, const cube_t *, uint8_t);
cube_t transform(cube_t, uint8_t);

void run(void) {
	char str[STRLENMAX];
	int i;
	bool found;
	uint8_t h, t;
	unsigned char buf[2000000];
	uint32_t *cocsepdata;
	uint64_t selfsim[COCSEP_CLASSES];
	uint64_t c, cc;
	oriented_cube_t cube;
	cube_t invc, rep[COCSEP_CLASSES];

	gendata_cocsep(buf, selfsim, rep);
	cocsepdata = (uint32_t *)(buf + INFOSIZE);

	i = 1;
	h = 11;
	while (fgets(str, STRLENMAX, stdin) != NULL) {
		cube = readcube(str);
		c = coord_h48(cube.cube, cocsepdata, h);
		invc = invcoord_h48(c, rep, h);
		for (t = 0, found = false; t < 48; t++) {
			cube.cube = transform(invc, t);
			cc = coord_h48(cube.cube, cocsepdata, h);
			found = found || cc == c;
		}
		printf("%d %s\n", i, found ? "ok" : "ERROR");
		i++;
	}
}
