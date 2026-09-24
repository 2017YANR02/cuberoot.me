#include "../test.h"

size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);
cube_t transform(cube_t, uint8_t);
uint64_t coord_cocsep(cube_t);

void run(void) {
	uint8_t t;
	unsigned char buf[2000000];
	uint32_t *cocsepdata;
	uint64_t selfsim[COCSEP_CLASSES];
	uint64_t coord, tcoord;
	char str[STRLENMAX];
	oriented_cube_t cube;
	cube_t rep[COCSEP_CLASSES], transd;

	fgets(str, STRLENMAX, stdin);
	cube = readcube(str);

	gendata_cocsep(buf, selfsim, rep);
	cocsepdata = (uint32_t *)((char *)buf + INFOSIZE);

	coord = COCLASS(cocsepdata[coord_cocsep(cube.cube)]);
	for (t = 0; t < 48; t++) {
		transd = transform(cube.cube, t);
		tcoord = COCLASS(cocsepdata[coord_cocsep(transd)]);
		if (coord != tcoord)
			printf("Error: expected %" PRIu64
			    " but got %" PRIu64 "\n", coord, tcoord);
	}
}
