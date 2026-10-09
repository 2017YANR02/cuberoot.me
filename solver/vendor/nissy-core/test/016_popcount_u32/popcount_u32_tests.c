#include "../test.h"

int popcount_u32(uint32_t x);

int
popcount_u32_simple(uint32_t x)
{
	int ret;

	for (ret = 0; x != 0; x >>= 1)
		ret += x & 1;

	return ret;
}

bool
correct(uint32_t x)
{
	int expected = popcount_u32_simple(x);
	int actual = popcount_u32(x);
	if (actual != expected) {
		printf("Error at %" PRIu32 ": expected %d bits, found %d\n",
		    x, expected, actual);
		return false;
	}
	return true;
}

void run(void) {
	uint32_t i;

	/* Test all numbers up to 2^16, and other ranges of 2^16 numbers */
	for (i = 0; i < 0xFFFF; i++) {
		if (!correct(i) ||
		    !correct(i + UINT32_C(0xFFFF0000)) ||
		    !correct(i + UINT32_C(1000000)) ||
		    !correct(i + UINT32_C(1)) ||
		    !correct(i + UINT32_C(1234567)))
		    return;
	}

	printf("Ok\n");
}
