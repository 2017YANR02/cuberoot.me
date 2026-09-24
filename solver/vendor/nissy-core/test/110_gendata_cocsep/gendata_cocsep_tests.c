#include "../test.h"

#define BUF_SIZE 2000000

size_t gendata_cocsep(unsigned char *, uint64_t *, cube_t *);
int64_t readtableinfo(size_t, const unsigned char *, tableinfo_t *);

void run(void) {
	unsigned char buf[BUF_SIZE];
	uint32_t i;
	uint64_t selfsim[COCSEP_CLASSES];
	cube_t rep[COCSEP_CLASSES];
	size_t result;
	tableinfo_t info;

	result = gendata_cocsep(buf, selfsim, rep);
	if (readtableinfo(BUF_SIZE, buf, &info) != NISSY_OK) {
		printf("Error reading info from table\n");
		return;
	}

	printf("%zu\n", result);
	printf("Classes: %" PRIu64 "\n", info.classes);
	printf("Max value: %" PRIu8 "\n", info.maxvalue);
	for (i = 0; i < 10; i++)
		printf("%" PRIu32 ": %" PRIu64 "\n", i, info.distribution[i]);
}
