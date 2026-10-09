#include "../test.h"

uint64_t digitstosumzero(size_t n, uint8_t *, uint8_t);

void run(void) {
	char str[STRLENMAX];
	uint8_t i, b, a[100];
	size_t n;
	uint64_t p;

	fgets(str, STRLENMAX, stdin);
	n = atoi(str);
	fgets(str, STRLENMAX, stdin);
	b = (uint8_t)atoi(str);
	for (i = 0; i < n; i++) {
		fgets(str, STRLENMAX, stdin);
		a[i] = (uint8_t)atoi(str);
	}

	p = digitstosumzero(n, a, b);
	printf("%" PRIu64 "\n", p);
}
