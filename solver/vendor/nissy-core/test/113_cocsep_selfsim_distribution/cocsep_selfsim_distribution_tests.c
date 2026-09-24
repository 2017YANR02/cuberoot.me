#include "../test.h"

size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);

int bcount(uint64_t x) {
	int ret;
	uint64_t i;

	for (i = 0, ret = 0; i < 64; i++)
		if (x & (UINT64_C(1) << i))
			ret++;

	return ret;
}

void run(void) {
	unsigned char buf[2000000];
	int size[65], tot, j;
	uint64_t i, selfsim[COCSEP_CLASSES], sim;
	cube_t rep[COCSEP_CLASSES];

	memset(size, 0, 65 * sizeof(int));
	gendata_cocsep(buf, selfsim, rep);

	for (i = 0, tot = 0; i < COCSEP_CLASSES; i++) {
		sim = selfsim[i];
		if (sim >> 1)
			tot++;
		size[bcount(sim)]++;
	}

	printf("%d self-similar positions out of 3393\n", tot);
	printf("Size\tnumber of groups\n");
	for (j = 0; j <= 48; j++)
		if (size[j] != 0)
			printf("%d\t%d\n", j, size[j]);
}
