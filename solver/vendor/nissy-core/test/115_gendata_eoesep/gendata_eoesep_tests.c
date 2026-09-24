/*
The test does not generate the full table. For reference, these are the values:

0: 1
1: 1
2: 3
3: 23
4: 235
5: 2281
6: 22069
7: 182776
8: 767847
9: 617858
10: 8439
11: 3
*/

#include "../test.h"

#define DEPTH 6
#define EMAX (495*70)
#define CL 782
#define ISIZE 512
#define FULLSIZE (ISIZE + (CL*1024) + (4*EMAX))

unsigned char buf[FULLSIZE];

size_t gendata_eoesep(unsigned char [SIZE(FULLSIZE)], uint8_t);
int64_t readtableinfo(size_t, const unsigned char *, tableinfo_t *);

void run(void) {
	uint32_t i;
	size_t result;
	tableinfo_t info;

	result = gendata_eoesep(buf, DEPTH);
	if (readtableinfo(FULLSIZE, buf, &info) != NISSY_OK) {
		printf("Error reading info from table\n");
		return;
	}

	printf("%zu\n", result);
	printf("Classes (ESEP only): %" PRIu64 "\n", info.classes);
	for (i = 0; i <= DEPTH; i++)
		printf("%" PRIu32 ": %" PRIu64 "\n", i, info.distribution[i]);
}
