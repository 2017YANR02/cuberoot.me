#include "../test.h"

void sumzerotodigits(uint64_t, size_t n, uint8_t, uint8_t *);

void run(void) {
	char str[STRLENMAX];
	uint8_t i, n, b, a[100];
	uint64_t d;

	fgets(str, STRLENMAX, stdin);
	n = (uint8_t)atoi(str);
	fgets(str, STRLENMAX, stdin);
	b = (uint8_t)atoi(str);
	fgets(str, STRLENMAX, stdin);
	d = atoll(str);

	sumzerotodigits(d, n, b, a);
	
	for (i = 0; i < n; i++)
		printf("%" PRIu8 "\n", a[i]);
}
