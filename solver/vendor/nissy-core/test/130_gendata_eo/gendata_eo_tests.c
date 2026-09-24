/*
Pruning table values (from nissy):
0: 1
1: 2
2: 25
3: 202
4: 620
5: 900
6: 285
7: 13
*/

#include "../test.h"

#define ISIZE 512
#define FULLSIZE (ISIZE + 1024)

unsigned char buf[FULLSIZE];

long long gendata_coord_dispatch(
    const char *, unsigned long long, unsigned char *);
int64_t readtableinfo(size_t, const unsigned char *, tableinfo_t *);

void run(void) {
	uint32_t i;
	size_t result;
	tableinfo_t info;

	result = gendata_coord_dispatch("coord_EO_FB", FULLSIZE, buf);
	if (readtableinfo(FULLSIZE, buf, &info) != NISSY_OK) {
		printf("Error reading info from table\n");
		return;
	}

	printf("%zu\n", result);
	for (i = 0; i <= 10; i++)
		printf("%" PRIu32 ": %" PRIu64 "\n", i, info.distribution[i]);
}
