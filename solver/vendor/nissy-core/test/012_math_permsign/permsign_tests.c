#include "../test.h"

int permsign(size_t n, const uint8_t *);

void run(void) {
	char str[STRLENMAX];
	uint8_t a[100];
	int p;
	uint64_t n, i;

	fgets(str, STRLENMAX, stdin);
	n = atoll(str);

	for (i = 0; i < n; i++) {
		fgets(str, STRLENMAX, stdin);
		a[i] = (uint8_t)atoi(str);
	}

	p = permsign(n, a);
	printf("%d\n", p);
}
