#include "../test.h"

#define ABS(x) ((x) < 0 ? (-(x)) : (x))

double intpow(double, uint64_t);

const double tolerance = 1e-6;

void run(void) {
	char str[STRLENMAX];
	double b, r, c;
	uint64_t e;

	fgets(str, STRLENMAX, stdin);
	b = atof(str);
	fgets(str, STRLENMAX, stdin);
	e = atoll(str);
	fgets(str, STRLENMAX, stdin);
	r = atof(str);

	c = intpow(b, e);
	if (ABS(r - c) > tolerance)
		printf("Error! Expected %lf but got %lf\n", r, c);
	else
		printf("Ok\n");
}
