#include "../test.h"

uint64_t permtoindex(size_t n, const uint8_t *);

void run(void) {
	char str[STRLENMAX];
	uint8_t a[100];
	uint64_t n, i, p;

	fgets(str, STRLENMAX, stdin);
	n = atoll(str);
	for (i = 0; i < n; i++) {
		fgets(str, STRLENMAX, stdin);
		a[i] = (uint8_t)atoi(str);
	}

	p = permtoindex(n, a);
	printf("%" PRIu64 "\n", p);
}
