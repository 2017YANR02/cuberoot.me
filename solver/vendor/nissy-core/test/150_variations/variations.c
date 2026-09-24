#include "../test.h"

long long nissy_variations(
    const char *, const char *, unsigned long long, char *);

void run(void) {
	long long err;
	char variation[STRLENMAX], moves[STRLENMAX], result[STRLENMAX];

	fgets(variation, STRLENMAX, stdin);
	variation[strlen(variation)-1] = '\0'; /* Remove newline */
	fgets(moves, STRLENMAX, stdin);

	err = nissy_variations(moves, variation, STRLENMAX, result);
	if (err < 0)
		printf("Error %lld\n", err);
	else
		printf("%lld\n%s", err, result);
}
