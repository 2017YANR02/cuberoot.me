#include "../test.h"

int64_t readtableinfo(size_t, const unsigned char *, tableinfo_t *);
int64_t writetableinfo(const tableinfo_t *, size_t, unsigned char *);

uint64_t readn(void) {
	char str[STRLENMAX];

	fgets(str, STRLENMAX, stdin);
	return atoll(str);
}

tableinfo_t test_readinfo(void) {
	int i;
	tableinfo_t ret;
	char emptyline[2];

	fgets(ret.solver, INFO_SOLVER_STRLEN, stdin);
	for (i = 0; i < INFO_SOLVER_STRLEN; i++)
		if (ret.solver[i] == '\n')
			ret.solver[i] = 0;

	fgets(emptyline, 2, stdin);

	ret.type = readn();
	ret.infosize = readn();
	ret.fullsize = readn();
	ret.hash = readn();
	ret.entries = readn();
	ret.classes = readn();
	ret.h48h = (uint8_t)readn();
	ret.bits = (uint8_t)readn();
	ret.base = (uint8_t)readn();
	ret.maxvalue = (uint8_t)readn();
	ret.next = readn();

	fgets(emptyline, 2, stdin);

	for (i = 0; i < INFO_DISTRIBUTION_LEN; i++)
		ret.distribution[i] = readn();

	return ret;
}

void test_writeinfo(tableinfo_t info) {
	int i;

	printf("%s\n", info.solver);
	printf("\n");

	printf("%" PRIu64 "\n", info.type);
	printf("%" PRIu64 "\n", info.infosize);
	printf("%" PRIu64 "\n", info.fullsize);
	printf("%" PRIu64 "\n", info.hash);
	printf("%" PRIu64 "\n", info.entries);
	printf("%" PRIu64 "\n", info.classes);
	printf("%" PRIu8 "\n", info.h48h);
	printf("%" PRIu8 "\n", info.bits);
	printf("%" PRIu8 "\n", info.base);
	printf("%" PRIu8 "\n", info.maxvalue);
	printf("%" PRIu64 "\n", info.next);
	printf("\n");

	for (i = 0; i < INFO_DISTRIBUTION_LEN; i++)
		printf("%" PRIu64 "\n", info.distribution[i]);
}

void run(void) {
	unsigned char buf[INFOSIZE];
	tableinfo_t expected, actual;

	expected = test_readinfo();
	writetableinfo(&expected, INFOSIZE, buf);
	readtableinfo(INFOSIZE, buf, &actual);
	test_writeinfo(actual);
}
