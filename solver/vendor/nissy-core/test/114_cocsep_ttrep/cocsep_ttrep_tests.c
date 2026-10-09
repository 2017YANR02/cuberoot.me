#include "../test.h"

uint8_t inverse_trans(uint8_t);
cube_t transform_corners(cube_t, uint8_t);
uint64_t coord_cocsep(cube_t);
size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);

void run(void) {
	uint8_t t, tt;
	unsigned char buf[2000000];
	uint32_t *cocsepdata;
	uint64_t i, selfsim[COCSEP_CLASSES];
	uint64_t j, k, l;
	cube_t rep[COCSEP_CLASSES], c, d;

	gendata_cocsep(buf, selfsim, rep);
	cocsepdata = (uint32_t *)((char *)buf + INFOSIZE);

	for (i = 0; i < COCSEP_CLASSES; i++) {
		c = rep[i];
		for (t = 0; t < 48; t++) {
			d = transform_corners(c, t);
			j = coord_cocsep(d);
			tt = TTREP(cocsepdata[j]);
			d = transform_corners(d, tt);
			k = coord_cocsep(d);
			l = coord_cocsep(c);
			if (k != l)
				printf("cocsep %" PRIu64 " (%" PRIu64 "): "
				    "%" PRIu64 " ttrep %" PRIu32
				    " ->  %" PRId64 "\n", i, l, j, tt, k);
		}
	}
}
