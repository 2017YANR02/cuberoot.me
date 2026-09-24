#ifndef UTILS_MATH_H
#define UTILS_MATH_H

#define SWAP(x, y) do { x ^= y; y ^= x; x ^= y; } while (0)
#define MIN(x, y) ((x) < (y) ? (x) : (y))
#define MAX(x, y) ((x) > (y) ? (x) : (y))
#define DIV_ROUND_UP(n, d) (((n) + (d) - 1) / (d))
#define POSITIVE_MOD(x, y) (((x) % (y) + (y)) % (y))

STATIC uint64_t permtoindex(size_t, const uint8_t *);
STATIC void indextoperm(uint64_t, size_t, uint8_t *);
STATIC int permsign(size_t, const uint8_t *);
STATIC uint64_t digitstosumzero(size_t, const uint8_t *, uint8_t);
STATIC void sumzerotodigits(uint64_t, size_t, uint8_t, uint8_t *);
STATIC double intpow(double, uint64_t);

/* This code is only used for assertions in debug mode */
#ifdef DEBUG
STATIC bool isperm(size_t, const uint8_t *);
STATIC bool
isperm(size_t n, const uint8_t *a)
{
	size_t i;
	bool aux[FACTORIAL_MAX+1];

	memset(aux, false, n);
	
	for (i = 0; i < n; i++) {
		if (a[i] >= n)
			return false;
		else
			aux[a[i]] = true;
	}

	for (i = 0; i < n; i++)
		if (!aux[i])
			return false;

	return true;
}
#endif

STATIC uint64_t
permtoindex(size_t n, const uint8_t *a)
{
	size_t i, j;
	uint64_t c, ret;

	DBG_ASSERT(n <= FACTORIAL_MAX, "Error: cannot compute permtoindex() "
	    "for set of size %zu > %" PRIu64 "\n", n, FACTORIAL_MAX);
	DBG_ASSERT(isperm(n, a), "Error: cannot compute permtoindex() for "
	    "invalid permutation\n");

	for (i = 0, ret = 0; i < n; i++) {
		for (j = i+1, c = 0; j < n; j++)
			c += a[i] > a[j];
		ret += factorial[n-i-1] * c;
	}

	return ret;
}

STATIC void
indextoperm(uint64_t p, size_t n, uint8_t *r)
{
	uint64_t c, k;
	size_t i, j, used;

	DBG_ASSERT(n <= FACTORIAL_MAX, "Error: cannot compute indextoperm() "
	    "for set of size %zu > %" PRIu64 "\n", n, FACTORIAL_MAX);
	DBG_ASSERT(p < factorial[n], "Error: invalid permutation index %"
	    PRIu64 " for set of size %zu\n", p, n);

	for (i = 0, used = 0; i < n; i++) {
		k = p / factorial[n-i-1];

		/* Find k-th unused number */
		for (j = 0, c = 0; c <= k; j++)
			c += UINT64_C(1) - ((used & (UINT64_C(1)<<j)) >> j);

		r[i] = (uint8_t)(j-1);
		used |= UINT64_C(1) << (j-1);
		p %= factorial[n-i-1];
	}

	return;
}

STATIC int
permsign(size_t n, const uint8_t *a)
{
	size_t i, j, ret;

	for (i = 0, ret = 0; i < n; i++)
		for (j = i+1; j < n; j++)
			ret += a[i] > a[j];

	return ret % 2;
}

STATIC uint64_t
digitstosumzero(size_t n, const uint8_t *a, uint8_t b)
{
	uint64_t ret, p;
	size_t i, sum;

	DBG_ASSERT((n == 8 && b == 3 ) || (n == 12 && b == 2),
	    "Error: digitstosumzero() called with n=%zu and b=%" PRIu8
	    " (use n=8 b=3 or n=12 b=2)\n", n, b);

	for (i = 1, ret = 0, p = 1, sum = 0; i < n; i++, p *= (uint64_t)b) {
		DBG_ASSERT(a[i] < b, "Error: digit %" PRIu8
		    " > %" PRIu8 "in digitstosumzero()\n", a[i], b);
		sum += a[i];
		ret += p * (uint64_t)a[i];
	}

	return ret;
}

STATIC void
sumzerotodigits(uint64_t d, size_t n, uint8_t b, uint8_t *a)
{
	uint8_t sum;
	size_t i;

	DBG_ASSERT((n == 8 && b == 3 ) || (n == 12 && b == 2),
	    "Error: sumzerotodigits() called with n=%zu and b=%" PRIu8
	    " (use n=8 b=3 or n=12 b=2)\n", n, b);

	for (i = 1, sum = 0; i < n; i++, d /= (uint64_t)b) {
		a[i] = (uint8_t)(d % (uint64_t)b);
		sum += a[i];
	}
	a[0] = (b - (sum % b)) % b;

	return;
}

STATIC double
intpow(double b, uint64_t e)
{
	double r;

	if (e == 0)
		return 1.0;

	r = intpow(b, e/2);

	return e % 2 == 0 ? r * r : b * r * r;
}

#endif /* UTILS_MATH_H */
